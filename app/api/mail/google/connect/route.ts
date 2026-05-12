import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { assertTenantAccess } from '@/lib/auth/tenant-access'
import {
  buildGoogleMailOAuthUrl,
  buildPkceCodeChallenge,
  createGoogleMailOAuthState,
  GOOGLE_MAIL_OAUTH_COOKIE_NAME,
} from '@/lib/mail/google'

function getGoogleMailOAuthConfig() {
  const clientId = process.env.GOOGLE_CLIENT_ID
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET

  if (!clientId || !clientSecret) return null

  return { clientId, clientSecret }
}

function buildReturnToPath(tenantSlug: string) {
  return `/${tenantSlug}/setup?tab=integrations#mail-sender`
}

function withMailError(url: URL, error: string) {
  url.searchParams.set('tab', 'integrations')
  url.searchParams.set('mail', 'error')
  url.searchParams.set('mail_error', error)
  return url
}

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url)
  const tenantId = requestUrl.searchParams.get('tenantId')
  const tenantSlug = requestUrl.searchParams.get('tenantSlug')

  if (!tenantId && !tenantSlug) {
    return NextResponse.redirect(
      withMailError(new URL('/setup?tab=integrations#mail-sender', request.url), 'missing_tenant_context'),
    )
  }

  const oauthConfig = getGoogleMailOAuthConfig()
  if (!oauthConfig) {
    const returnTo = tenantSlug ? buildReturnToPath(tenantSlug) : '/setup?tab=integrations#mail-sender'
    return NextResponse.redirect(
      withMailError(new URL(returnTo, request.url), 'mail_oauth_not_configured'),
    )
  }

  const accessCheck = await assertTenantAccess({ tenantId, tenantSlug })
  if ('error' in accessCheck) {
    return accessCheck.error
  }

  const returnTo = buildReturnToPath(accessCheck.organization.slug)
  const state = createGoogleMailOAuthState({
    tenantId: accessCheck.organization.id,
    tenantSlug: accessCheck.organization.slug,
    userId: accessCheck.userId,
    returnTo,
  })

  const oauthUrl = buildGoogleMailOAuthUrl({
    clientId: oauthConfig.clientId,
    redirectUri: new URL('/api/mail/google/callback', request.url).toString(),
    state: state.state,
    codeChallenge: buildPkceCodeChallenge(state.codeVerifier),
  })

  const response = NextResponse.redirect(oauthUrl)
  response.cookies.set(
    GOOGLE_MAIL_OAUTH_COOKIE_NAME,
    state.cookieValue,
    {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      maxAge: 10 * 60,
    }
  )

  const now = new Date().toISOString()
  const { error: settingsError } = await accessCheck.supabase
    .from('organization_mail_settings')
    .upsert({
      tenant_id: accessCheck.organization.id,
      provider: 'google_workspace',
      updated_at: now,
    }, { onConflict: 'tenant_id,provider' })

  if (settingsError) {
    const redirectUrl = withMailError(new URL(returnTo, request.url), 'mail_settings_prepare_failed')
    return NextResponse.redirect(redirectUrl)
  }

  return response
}

