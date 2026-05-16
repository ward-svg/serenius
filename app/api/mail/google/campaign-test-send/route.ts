import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { assertTenantAccess } from '@/lib/auth/tenant-access'
import { createSupabaseServiceClient } from '@/lib/supabase-service'
import { buildCampaignTestEmailContent, resolveTestFirstName } from '@/lib/mail/campaign-content'
import {
  buildGmailRawMessage,
  refreshGoogleMailAccessToken,
  sendGmailMessage,
} from '@/lib/mail/google'
import { buildCampaignEmailFooter } from '@/lib/mail/campaign-email-footer'

function isGoogleTokenExpired(expiryDate: string | null) {
  if (!expiryDate) return false
  const expiryTime = new Date(expiryDate).getTime()
  if (Number.isNaN(expiryTime)) return false
  return Date.now() >= expiryTime - 60_000
}

export async function POST(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const tenantId = searchParams.get('tenantId')

  if (!tenantId) {
    return NextResponse.json({ ok: false, error: 'Missing tenantId.' }, { status: 400 })
  }

  let body: { campaign_id?: string } = {}
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ ok: false, error: 'Invalid request body.' }, { status: 400 })
  }

  const campaignId = body.campaign_id
  if (!campaignId) {
    return NextResponse.json({ ok: false, error: 'Missing campaign_id.' }, { status: 400 })
  }

  const accessCheck = await assertTenantAccess({ tenantId })
  if ('error' in accessCheck) {
    return accessCheck.error
  }

  const serviceSupabase = createSupabaseServiceClient()

  // Load campaign scoped by both id and tenant_id — never trust client-supplied tenant
  const { data: campaign, error: campaignError } = await serviceSupabase
    .from('partner_emails')
    .select('id, tenant_id, subject, message_raw_html, message, sending_status, message_status')
    .eq('id', campaignId)
    .eq('tenant_id', tenantId)
    .maybeSingle()

  if (campaignError || !campaign) {
    return NextResponse.json({ ok: false, error: 'Campaign not found.' }, { status: 404 })
  }

  if (!campaign.subject?.trim()) {
    return NextResponse.json(
      { ok: false, error: 'Campaign must have a subject before test sending.' },
      { status: 400 },
    )
  }

  if (!campaign.message_raw_html?.trim() && !campaign.message?.trim()) {
    return NextResponse.json(
      { ok: false, error: 'Campaign must have HTML or message content before test sending.' },
      { status: 400 },
    )
  }

  const { data: settings, error: settingsError } = await serviceSupabase
    .from('organization_mail_settings')
    .select(
      'id, tenant_id, provider, display_name, from_name, from_email, reply_to, provider_account_email, provider_account_name, is_enabled, connection_status, send_mode',
    )
    .eq('tenant_id', tenantId)
    .eq('provider', 'google_workspace')
    .maybeSingle()

  if (settingsError || !settings) {
    return NextResponse.json(
      { ok: false, error: 'Mail sender settings are not configured.' },
      { status: 400 },
    )
  }

  if (
    settings.connection_status !== 'connected' ||
    settings.is_enabled !== true ||
    settings.send_mode === 'disabled'
  ) {
    return NextResponse.json(
      {
        ok: false,
        error: 'Mail sender must be connected, enabled, and in Test only or Live mode before test sending.',
      },
      { status: 400 },
    )
  }

  const { data: brandSettingsRow } = await serviceSupabase
    .from('communication_email_brand_settings')
    .select(
      'organization_name, mailing_address, city, state, zip, country, phone, website_url, unsubscribe_text, footer_html, preference_center_url, footer_background_color, footer_text_color, footer_link_color, footer_font_size, footer_divider_enabled, footer_divider_color',
    )
    .eq('tenant_id', tenantId)
    .maybeSingle()

  const brandFooter = buildCampaignEmailFooter(brandSettingsRow ?? null, null)

  const { data: recipients, error: recipientsError } = await serviceSupabase
    .from('organization_mail_test_recipients')
    .select('id, email, display_name, is_active')
    .eq('tenant_id', tenantId)
    .eq('is_active', true)
    .order('email', { ascending: true })

  if (recipientsError) {
    return NextResponse.json({ ok: false, error: recipientsError.message }, { status: 400 })
  }

  if (!recipients || recipients.length === 0) {
    return NextResponse.json(
      { ok: false, error: 'No active test recipients are configured.' },
      { status: 400 },
    )
  }

  const { data: credentials, error: credentialsError } = await serviceSupabase
    .from('organization_mail_credentials')
    .select(
      'id, access_token, refresh_token, token_type, scope, expiry_date, external_account_email, external_account_name',
    )
    .eq('tenant_id', tenantId)
    .eq('provider', 'google_workspace')
    .maybeSingle()

  if (credentialsError || !credentials) {
    return NextResponse.json(
      { ok: false, error: 'Google Workspace credentials are not available.' },
      { status: 400 },
    )
  }

  let accessToken = credentials.access_token
  let refreshToken = credentials.refresh_token ?? null

  if (isGoogleTokenExpired(credentials.expiry_date) && !refreshToken) {
    return NextResponse.json(
      {
        ok: false,
        error: 'The connected Google access token has expired and no refresh token is available.',
      },
      { status: 400 },
    )
  }

  if (isGoogleTokenExpired(credentials.expiry_date) && refreshToken) {
    try {
      const refreshed = await refreshGoogleMailAccessToken({ refreshToken })
      accessToken = refreshed.accessToken
      refreshToken = refreshed.refreshToken ?? refreshToken

      const { error: refreshSaveError } = await serviceSupabase
        .from('organization_mail_credentials')
        .update({
          access_token: refreshed.accessToken,
          refresh_token: refreshToken,
          token_type: refreshed.tokenType,
          scope: refreshed.scope,
          expiry_date: refreshed.expiryDate,
          updated_at: new Date().toISOString(),
        })
        .eq('id', credentials.id)
      if (refreshSaveError) throw refreshSaveError
    } catch (error) {
      return NextResponse.json(
        {
          ok: false,
          error:
            error instanceof Error
              ? error.message
              : 'Unable to refresh the Google access token.',
        },
        { status: 400 },
      )
    }
  }

  const connectedAccountEmail = credentials.external_account_email?.trim() || null
  if (!connectedAccountEmail && !settings.from_email?.trim()) {
    return NextResponse.json(
      {
        ok: false,
        error: 'A connected Google Workspace account email is required before test sending.',
      },
      { status: 400 },
    )
  }

  const senderEmail =
    settings.from_email?.trim() &&
    settings.from_email.trim().toLowerCase() === connectedAccountEmail?.toLowerCase()
      ? settings.from_email.trim()
      : connectedAccountEmail ?? settings.from_email!.trim()

  const senderName =
    settings.from_name?.trim() ||
    settings.display_name?.trim() ||
    credentials.external_account_name?.trim() ||
    accessCheck.organization.name

  const replyTo = settings.reply_to?.trim() || settings.from_email?.trim() || senderEmail

  // Create audit job record
  const startedAt = new Date().toISOString()
  const { data: job, error: jobError } = await serviceSupabase
    .from('email_send_jobs')
    .insert({
      tenant_id: tenantId,
      partner_email_id: campaign.id,
      job_type: 'test',
      status: 'running',
      requested_by: accessCheck.userId,
      provider: 'google_workspace',
      sender_email: senderEmail,
      sender_name: senderName,
      recipient_count: recipients.length,
      sent_count: 0,
      failed_count: 0,
      suppressed_count: 0,
      skipped_count: 0,
      started_at: startedAt,
    })
    .select('id')
    .single()

  if (jobError || !job) {
    return NextResponse.json(
      { ok: false, error: 'Failed to create send job record.' },
      { status: 500 },
    )
  }

  const failedRecipients: Array<{ email: string; error: string }> = []
  type RecipientRow = {
    tenant_id: string
    job_id: string
    partner_email_id: string
    email: string
    display_name: string | null
    recipient_type: string
    status: string
    provider_message_id: string | null
    sent_at: string | null
    error: string | null
  }
  const recipientRows: RecipientRow[] = []
  let recipientsSent = 0

  for (const recipient of recipients) {
    const firstName = resolveTestFirstName(recipient.display_name)
    const subject = `[TEST] ${campaign.subject.replace(/\{firstname\}/gi, firstName)}`

    const { html, text } = buildCampaignTestEmailContent({
      messageRawHtml: campaign.message_raw_html,
      messagePlain: campaign.message,
      recipientDisplayName: recipient.display_name,
      orgName: accessCheck.organization.name,
      brandFooter,
    })

    const rawMessage = buildGmailRawMessage({
      to: recipient.email,
      subject,
      fromName: senderName,
      fromEmail: senderEmail,
      replyTo,
      text,
      html,
    })

    try {
      const gmailResult = await sendGmailMessage({ accessToken, rawMessage })
      recipientsSent += 1
      recipientRows.push({
        tenant_id: tenantId,
        job_id: job.id,
        partner_email_id: campaign.id,
        email: recipient.email,
        display_name: recipient.display_name ?? null,
        recipient_type: 'test',
        status: 'sent',
        provider_message_id: gmailResult.id ?? null,
        sent_at: new Date().toISOString(),
        error: null,
      })
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to send message.'
      failedRecipients.push({ email: recipient.email, error: message })
      recipientRows.push({
        tenant_id: tenantId,
        job_id: job.id,
        partner_email_id: campaign.id,
        email: recipient.email,
        display_name: recipient.display_name ?? null,
        recipient_type: 'test',
        status: 'failed',
        provider_message_id: null,
        sent_at: null,
        error: message,
      })
    }
  }

  // Insert per-recipient audit rows
  if (recipientRows.length > 0) {
    await serviceSupabase.from('email_send_recipients').insert(recipientRows)
  }

  const completedAt = new Date().toISOString()
  const jobStatus = recipientsSent === 0 ? 'failed' : 'completed'

  await serviceSupabase
    .from('email_send_jobs')
    .update({
      status: jobStatus,
      sent_count: recipientsSent,
      failed_count: failedRecipients.length,
      completed_at: completedAt,
      last_error: failedRecipients.length > 0 ? failedRecipients[0].error : null,
      updated_at: completedAt,
    })
    .eq('id', job.id)

  if (recipientsSent === 0) {
    return NextResponse.json(
      {
        ok: false,
        job_id: job.id,
        recipients_attempted: recipients.length,
        recipients_sent: 0,
        recipients_failed: failedRecipients.length,
        failed_recipients: failedRecipients,
        error: failedRecipients[0]?.error ?? 'Test send failed.',
      },
      { status: 400 },
    )
  }

  // Update campaign message_status only when all sends succeeded
  if (failedRecipients.length === 0) {
    const { error: statusUpdateError } = await serviceSupabase
      .from('partner_emails')
      .update({ message_status: 'Test Sent', updated_at: completedAt })
      .eq('id', campaign.id)
      .eq('tenant_id', tenantId)

    if (statusUpdateError) {
      console.error('[campaign-test-send] Failed to persist Test Sent status:', statusUpdateError.message)
      return NextResponse.json(
        {
          ok: false,
          error: 'Test send was delivered but campaign status could not be updated. Contact support if this persists.',
        },
        { status: 500 },
      )
    }
  }

  return NextResponse.json({
    ok: true,
    job_id: job.id,
    recipients_attempted: recipients.length,
    recipients_sent: recipientsSent,
    recipients_failed: failedRecipients.length,
    failed_recipients: failedRecipients,
    campaign_id: campaign.id,
    message_status: 'Test Sent',
    updated_at: completedAt,
  })
}
