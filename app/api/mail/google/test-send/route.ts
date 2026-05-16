import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { assertTenantAccess } from '@/lib/auth/tenant-access'
import { createSupabaseServiceClient } from '@/lib/supabase-service'
import {
  buildGmailRawMessage,
  refreshGoogleMailAccessToken,
  sendGmailMessage,
} from '@/lib/mail/google'

function isGoogleTokenExpired(expiryDate: string | null) {
  if (!expiryDate) return false
  const expiryTime = new Date(expiryDate).getTime()
  if (Number.isNaN(expiryTime)) return false
  return Date.now() >= expiryTime - 60_000
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (character) => {
    switch (character) {
      case '&':
        return '&amp;'
      case '<':
        return '&lt;'
      case '>':
        return '&gt;'
      case '"':
        return '&quot;'
      case '\'':
        return '&#39;'
      default:
        return character
    }
  })
}

export async function POST(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const tenantId = searchParams.get('tenantId')

  if (!tenantId) {
    return NextResponse.json({ ok: false, error: 'Missing tenantId.' }, { status: 400 })
  }

  const accessCheck = await assertTenantAccess({ tenantId })
  if ('error' in accessCheck) {
    return accessCheck.error
  }

  const serviceSupabase = createSupabaseServiceClient()
  const { data: settings, error: settingsError } = await serviceSupabase
    .from('organization_mail_settings')
    .select('id, tenant_id, provider, display_name, from_name, from_email, reply_to, provider_account_email, provider_account_name, is_enabled, connection_status, send_mode, locked_at, locked_by, connected_at, connected_by, created_at, updated_at')
    .eq('tenant_id', tenantId)
    .eq('provider', 'google_workspace')
    .maybeSingle()

  if (settingsError || !settings) {
    return NextResponse.json({ ok: false, error: 'Mail sender settings are not configured.' }, { status: 400 })
  }

  if (settings.connection_status !== 'connected' || settings.is_enabled !== true || settings.send_mode === 'disabled') {
    return NextResponse.json({
      ok: false,
      error: 'Mail sender must be connected, enabled, and in Test only or Live mode before test sending.',
    }, { status: 400 })
  }

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
    return NextResponse.json({
      ok: false,
      error: 'No active test recipients are configured.',
    }, { status: 400 })
  }

  const { data: credentials, error: credentialsError } = await serviceSupabase
    .from('organization_mail_credentials')
    .select('id, access_token, refresh_token, token_type, scope, expiry_date, external_account_email, external_account_name')
    .eq('tenant_id', tenantId)
    .eq('provider', 'google_workspace')
    .maybeSingle()

  if (credentialsError || !credentials) {
    return NextResponse.json({ ok: false, error: 'Google Workspace credentials are not available.' }, { status: 400 })
  }

  let accessToken = credentials.access_token
  let refreshToken = credentials.refresh_token ?? null

  if (isGoogleTokenExpired(credentials.expiry_date) && !refreshToken) {
    return NextResponse.json({
      ok: false,
      error: 'The connected Google access token has expired and no refresh token is available.',
    }, { status: 400 })
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
      if (refreshSaveError) {
        throw refreshSaveError
      }
    } catch (error) {
      return NextResponse.json({
        ok: false,
        error: error instanceof Error ? error.message : 'Unable to refresh the Google access token.',
      }, { status: 400 })
    }
  }

  const connectedAccountEmail = credentials.external_account_email?.trim() || null
  if (!connectedAccountEmail && !settings.from_email?.trim()) {
    return NextResponse.json({
      ok: false,
      error: 'A connected Google Workspace account email is required before test sending.',
    }, { status: 400 })
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
  const subject = 'Serenius Mail Sender Test'
  const html = `<p>This is a test email from Serenius Mail Sender for ${escapeHtml(accessCheck.organization.name)}.</p>`
  const text = `This is a test email from Serenius Mail Sender for ${accessCheck.organization.name}.`

  const failedRecipients: Array<{ email: string; error: string }> = []
  let recipientsSent = 0

  for (const recipient of recipients) {
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
      await sendGmailMessage({ accessToken, rawMessage })
      recipientsSent += 1
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to send message.'
      failedRecipients.push({ email: recipient.email, error: message })
    }
  }

  const responseBody = {
    ok: failedRecipients.length === 0 || recipientsSent > 0,
    recipients_attempted: recipients.length,
    recipients_sent: recipientsSent,
    failed_recipients: failedRecipients,
  }

  if (recipientsSent === 0) {
    return NextResponse.json({
      ...responseBody,
      ok: false,
      error: failedRecipients[0]?.error ?? 'Test send failed.',
    }, { status: 400 })
  }

  return NextResponse.json(responseBody)
}
