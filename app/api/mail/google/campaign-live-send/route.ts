import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { assertTenantAccess } from '@/lib/auth/tenant-access'
import { createSupabaseServiceClient } from '@/lib/supabase-service'
import { buildCampaignLiveEmailContent, resolveTestFirstName } from '@/lib/mail/campaign-content'
import {
  buildGmailRawMessage,
  refreshGoogleMailAccessToken,
  sendGmailMessage,
} from '@/lib/mail/google'
import { buildCampaignEmailFooter } from '@/lib/mail/campaign-email-footer'
import { createEmailOptOutToken } from '@/lib/mail/opt-out-tokens'

// Controlled: only this segment is permitted for live sends in this build
const LIVE_SEND_SEGMENT = 'Test Emails'
const LIVE_SEND_CAP = 10

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

  const { data: campaign, error: campaignError } = await serviceSupabase
    .from('partner_emails')
    .select(
      'id, tenant_id, subject, message_raw_html, message, sending_status, message_status, email_sent_at, total_emails_sent, segment, campaign_version, deleted_at',
    )
    .eq('id', campaignId)
    .eq('tenant_id', tenantId)
    .maybeSingle()

  if (campaignError || !campaign) {
    return NextResponse.json({ ok: false, error: 'Campaign not found.' }, { status: 404 })
  }

  if (campaign.deleted_at) {
    return NextResponse.json({ ok: false, error: 'Campaign has been deleted.' }, { status: 400 })
  }

  if (campaign.segment !== LIVE_SEND_SEGMENT) {
    return NextResponse.json(
      {
        ok: false,
        error: `Live send is only available for the "${LIVE_SEND_SEGMENT}" segment in this build.`,
      },
      { status: 400 },
    )
  }

  if (
    (campaign.sending_status ?? '').toLowerCase() === 'send complete' ||
    (campaign.message_status ?? '').toLowerCase() === 'message sent' ||
    Number(campaign.total_emails_sent ?? 0) > 0 ||
    campaign.email_sent_at
  ) {
    return NextResponse.json(
      { ok: false, error: 'This campaign has already been sent.' },
      { status: 400 },
    )
  }

  if (!campaign.subject?.trim()) {
    return NextResponse.json(
      { ok: false, error: 'Campaign must have a subject before sending.' },
      { status: 400 },
    )
  }

  if (!campaign.message_raw_html?.trim() && !campaign.message?.trim()) {
    return NextResponse.json(
      { ok: false, error: 'Campaign must have HTML or message content before sending.' },
      { status: 400 },
    )
  }

  const { data: settings, error: settingsError } = await serviceSupabase
    .from('organization_mail_settings')
    .select(
      'id, tenant_id, provider, display_name, from_name, from_email, reply_to, provider_account_email, provider_account_name, is_enabled, connection_status, send_mode, campaign_live_send_authorized',
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
    settings.send_mode !== 'live'
  ) {
    return NextResponse.json(
      {
        ok: false,
        error:
          'Mail sender must be connected, enabled, and set to Live mode before live sending.',
      },
      { status: 400 },
    )
  }

  if (!settings.campaign_live_send_authorized) {
    return NextResponse.json(
      {
        ok: false,
        error:
          'Campaign live send is not authorized for this tenant. Enable campaign live-send authorization in Communications → Delivery Setup.',
      },
      { status: 403 },
    )
  }

  const { data: brandSettingsRow } = await serviceSupabase
    .from('communication_email_brand_settings')
    .select(
      'organization_name, mailing_address, city, state, zip, country, phone, website_url, unsubscribe_text, footer_html, preference_center_url',
    )
    .eq('tenant_id', tenantId)
    .maybeSingle()

  const { data: allContacts, error: contactsError } = await serviceSupabase
    .from('partner_contacts')
    .select('id, primary_email, display_name, email_segment, campaign_version')
    .eq('tenant_id', tenantId)
    .is('deleted_at', null)
    .not('primary_email', 'is', null)

  if (contactsError) {
    return NextResponse.json({ ok: false, error: contactsError.message }, { status: 400 })
  }

  const { data: suppressionRows } = await serviceSupabase
    .from('partner_email_suppressions')
    .select('email')
    .eq('tenant_id', tenantId)

  const suppressedSet = new Set(
    (suppressionRows ?? []).map((s) => s.email.trim().toLowerCase()),
  )

  const campaignVersion = campaign.campaign_version ?? 'A+B'

  const eligibleContacts = (allContacts ?? []).filter((contact) => {
    const segments: string[] = contact.email_segment ?? []
    if (!segments.includes(LIVE_SEND_SEGMENT)) return false

    const email = contact.primary_email?.trim() ?? ''
    if (!email) return false

    if (suppressedSet.has(email.toLowerCase())) return false

    const version = contact.campaign_version ?? ''
    if (version === 'Skip') return false

    const versionAllowed =
      campaignVersion === 'A+B'
        ? version === 'A' || version === 'B'
        : campaignVersion === 'A'
          ? version === 'A'
          : campaignVersion === 'B'
            ? version === 'B'
            : false

    return versionAllowed
  })

  if (eligibleContacts.length === 0) {
    return NextResponse.json(
      {
        ok: false,
        error: `No eligible contacts found in the "${LIVE_SEND_SEGMENT}" segment after suppression checks.`,
      },
      { status: 400 },
    )
  }

  if (eligibleContacts.length > LIVE_SEND_CAP) {
    return NextResponse.json(
      {
        ok: false,
        error: `Recipient count (${eligibleContacts.length}) exceeds the controlled send cap of ${LIVE_SEND_CAP}.`,
      },
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
        error: 'A connected Google Workspace account email is required before sending.',
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

  const requestUrl = new URL(request.url)
  const baseUrl = `${requestUrl.protocol}//${requestUrl.host}`

  const startedAt = new Date().toISOString()
  const { data: job, error: jobError } = await serviceSupabase
    .from('email_send_jobs')
    .insert({
      tenant_id: tenantId,
      partner_email_id: campaign.id,
      job_type: 'final',
      status: 'running',
      requested_by: accessCheck.userId,
      provider: 'google_workspace',
      sender_email: senderEmail,
      sender_name: senderName,
      recipient_count: eligibleContacts.length,
      sent_count: 0,
      failed_count: 0,
      suppressed_count: 0,
      skipped_count: 0,
      segment_snapshot: campaign.segment,
      campaign_version_snapshot: campaignVersion,
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
    opt_out_token_id: string | null
    provider_message_id: string | null
    sent_at: string | null
    error: string | null
  }
  const recipientRows: RecipientRow[] = []
  let recipientsSent = 0

  for (const contact of eligibleContacts) {
    const email = contact.primary_email!.trim()
    const firstName = resolveTestFirstName(contact.display_name)
    const subject = campaign.subject.replace(/\{firstname\}/gi, firstName)

    let optOutTokenId: string | null = null
    let preferenceUrl: string | null = null
    try {
      const tokenResult = await createEmailOptOutToken({
        supabase: serviceSupabase,
        tenantId,
        email,
        partnerContactId: contact.id ?? null,
        partnerEmailId: campaign.id,
        suppressionType: 'unsubscribed',
        baseUrl,
      })
      optOutTokenId = tokenResult.tokenId
      preferenceUrl = tokenResult.preferenceUrl
    } catch (tokenError) {
      const message =
        tokenError instanceof Error ? tokenError.message : 'Failed to generate opt-out token.'
      failedRecipients.push({ email, error: message })
      recipientRows.push({
        tenant_id: tenantId,
        job_id: job.id,
        partner_email_id: campaign.id,
        email,
        display_name: contact.display_name ?? null,
        recipient_type: 'contact',
        status: 'failed',
        opt_out_token_id: null,
        provider_message_id: null,
        sent_at: null,
        error: message,
      })
      continue
    }

    const brandFooter = buildCampaignEmailFooter(brandSettingsRow ?? null, preferenceUrl)

    const { html, text } = buildCampaignLiveEmailContent({
      messageRawHtml: campaign.message_raw_html,
      messagePlain: campaign.message,
      recipientDisplayName: contact.display_name,
      brandFooter,
    })

    const rawMessage = buildGmailRawMessage({
      to: email,
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
        email,
        display_name: contact.display_name ?? null,
        recipient_type: 'contact',
        status: 'sent',
        opt_out_token_id: optOutTokenId,
        provider_message_id: gmailResult.id ?? null,
        sent_at: new Date().toISOString(),
        error: null,
      })
    } catch (sendError) {
      const message =
        sendError instanceof Error ? sendError.message : 'Failed to send message.'
      failedRecipients.push({ email, error: message })
      recipientRows.push({
        tenant_id: tenantId,
        job_id: job.id,
        partner_email_id: campaign.id,
        email,
        display_name: contact.display_name ?? null,
        recipient_type: 'contact',
        status: 'failed',
        opt_out_token_id: optOutTokenId,
        provider_message_id: null,
        sent_at: null,
        error: message,
      })
    }
  }

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

  if (recipientsSent > 0 && failedRecipients.length === 0) {
    await serviceSupabase
      .from('partner_emails')
      .update({
        sending_status: 'Send Complete',
        message_status: 'Message Sent',
        email_sent_at: completedAt,
        total_emails_sent: recipientsSent,
        updated_at: completedAt,
      })
      .eq('id', campaign.id)
      .eq('tenant_id', tenantId)
  }

  const responseBody = {
    ok: recipientsSent > 0,
    job_id: job.id,
    recipients_attempted: eligibleContacts.length,
    recipients_sent: recipientsSent,
    recipients_failed: failedRecipients.length,
    failed_recipients: failedRecipients,
  }

  if (recipientsSent === 0) {
    return NextResponse.json(
      {
        ...responseBody,
        ok: false,
        error: failedRecipients[0]?.error ?? 'Live send failed.',
      },
      { status: 400 },
    )
  }

  return NextResponse.json(responseBody)
}
