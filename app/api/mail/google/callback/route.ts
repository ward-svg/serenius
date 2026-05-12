import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { assertTenantAccess } from '@/lib/auth/tenant-access'
import { createSupabaseServiceClient } from '@/lib/supabase-service'
import {
  exchangeGoogleMailCodeForTokens,
  getGoogleMailAccountInfo,
  GOOGLE_MAIL_OAUTH_COOKIE_NAME,
  parseGoogleMailOAuthCookie,
  parseGoogleMailOAuthState,
} from '@/lib/mail/google'

function getGoogleOAuthConfig() {
  const clientId = process.env.GOOGLE_CLIENT_ID
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET

  if (!clientId || !clientSecret) return null

  return { clientId, clientSecret }
}

function redirectWithStatus(request: NextRequest, returnTo: string, type: 'connected' | 'error', error?: string) {
  const redirectUrl = new URL(returnTo, request.url)
  redirectUrl.searchParams.set('tab', 'integrations')
  redirectUrl.searchParams.set('mail', type)
  if (error) redirectUrl.searchParams.set('mail_error', error)
  return redirectUrl
}

function clearOAuthCookie(response: NextResponse) {
  response.cookies.set(
    GOOGLE_MAIL_OAUTH_COOKIE_NAME,
    '',
    {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      maxAge: 0,
    }
  )
}

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url)
  const code = requestUrl.searchParams.get('code')
  const stateParam = requestUrl.searchParams.get('state')
  const errorParam = requestUrl.searchParams.get('error')

  const authCookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return authCookieStore.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) =>
            authCookieStore.set(name, value, options)
          )
        },
      },
    }
  )

  const oauthConfig = getGoogleOAuthConfig()
  const cookieState = parseGoogleMailOAuthCookie(request.cookies.get(GOOGLE_MAIL_OAUTH_COOKIE_NAME)?.value ?? null)
  const state = parseGoogleMailOAuthState(stateParam)
  const returnTo = state?.returnTo ?? cookieState?.returnTo ?? '/setup?tab=integrations#mail-sender'

  const fail = async (error: string, tenantId?: string | null) => {
    if (tenantId) {
      try {
        const serviceSupabase = createSupabaseServiceClient()
        await serviceSupabase
          .from('organization_mail_settings')
          .upsert({
            tenant_id: tenantId,
            provider: 'google_workspace',
            connection_status: 'error',
            updated_at: new Date().toISOString(),
          }, { onConflict: 'tenant_id,provider' })
      } catch {
        // Best effort only.
      }
    }

    const response = NextResponse.redirect(redirectWithStatus(request, returnTo, 'error', error))
    clearOAuthCookie(response)
    return response
  }

  try {
    if (errorParam) {
      return await fail('unknown_oauth_error', state?.tenantId ?? cookieState?.tenantId)
    }

    if (!oauthConfig) {
      return await fail('unknown_oauth_error', state?.tenantId ?? cookieState?.tenantId)
    }

    if (!code) {
      return await fail('missing_google_code', state?.tenantId ?? cookieState?.tenantId)
    }

    if (!state || !cookieState) {
      return await fail('invalid_oauth_state')
    }

    const accessCheck = await assertTenantAccess({
      tenantId: state.tenantId,
      tenantSlug: state.tenantSlug,
    })
    if ('error' in accessCheck) {
      return await fail('forbidden', state.tenantId)
    }

    const { data: userResult, error: userError } = await supabase.auth.getUser()
    if (userError) {
      return await fail('user_auth_failed', state.tenantId)
    }

    const user = userResult.user
    if (!user || user.id !== state.userId || user.id !== cookieState.userId || state.nonce !== cookieState.nonce) {
      return await fail('invalid_oauth_state', state.tenantId)
    }

    let serviceSupabase: ReturnType<typeof createSupabaseServiceClient>
    try {
      serviceSupabase = createSupabaseServiceClient()
    } catch {
      return await fail('missing_service_role_config', state.tenantId)
    }

    let tokens
    try {
      tokens = await exchangeGoogleMailCodeForTokens({
        code,
        codeVerifier: cookieState.codeVerifier,
        clientId: oauthConfig.clientId,
        clientSecret: oauthConfig.clientSecret,
        redirectUri: new URL('/api/mail/google/callback', request.url).toString(),
      })
    } catch {
      return await fail('token_exchange_failed', state.tenantId)
    }

    let account
    try {
      account = await getGoogleMailAccountInfo(tokens.accessToken)
    } catch {
      return await fail('google_account_lookup_failed', state.tenantId)
    }
    if (!account) {
      return await fail('google_account_lookup_failed', state.tenantId)
    }

    const { data: existingCredentials } = await serviceSupabase
      .from('organization_mail_credentials')
      .select('id, refresh_token')
      .eq('tenant_id', state.tenantId)
      .eq('provider', 'google_workspace')
      .maybeSingle()

    const refreshToken = tokens.refreshToken ?? existingCredentials?.refresh_token ?? null
    if (!refreshToken) {
      return await fail('credential_save_failed', state.tenantId)
    }

    const now = new Date().toISOString()
    const { error: credentialError } = await serviceSupabase
      .from('organization_mail_credentials')
      .upsert({
        tenant_id: state.tenantId,
        provider: 'google_workspace',
        access_token: tokens.accessToken,
        refresh_token: refreshToken,
        token_type: tokens.tokenType,
        scope: tokens.scope,
        expiry_date: tokens.expiryDate,
        external_account_email: account.email,
        external_account_name: account.name,
        provider_metadata: {
          integration_type: 'mail',
          connected_at: now,
          scope: tokens.scope,
          account_email: account.email,
          account_name: account.name,
        },
        updated_at: now,
      }, { onConflict: 'tenant_id,provider' })

    if (credentialError) {
      return await fail('credential_save_failed', state.tenantId)
    }

    const { data: existingSettings } = await serviceSupabase
      .from('organization_mail_settings')
      .select('id, display_name, from_name, from_email, reply_to, is_enabled, connection_status, send_mode, locked_at, locked_by, connected_at, connected_by, provider_account_email, provider_account_name')
      .eq('tenant_id', state.tenantId)
      .eq('provider', 'google_workspace')
      .maybeSingle()

    const settingsPayload = {
      tenant_id: state.tenantId,
      provider: 'google_workspace' as const,
      display_name: existingSettings?.display_name ?? null,
      from_name: existingSettings?.from_name ?? null,
      from_email: existingSettings?.from_email ?? null,
      reply_to: existingSettings?.reply_to ?? null,
      provider_account_email: account.email,
      provider_account_name: account.name,
      is_enabled: true,
      connection_status: 'connected' as const,
      send_mode: existingSettings?.send_mode ?? 'disabled',
      locked_at: existingSettings?.locked_at ?? null,
      locked_by: existingSettings?.locked_by ?? null,
      connected_at: now,
      connected_by: user.id,
      updated_at: now,
    }

    const { error: settingsError } = await serviceSupabase
      .from('organization_mail_settings')
      .upsert(settingsPayload, { onConflict: 'tenant_id,provider' })

    if (settingsError) {
      return await fail('settings_update_failed', state.tenantId)
    }

    const response = NextResponse.redirect(
      redirectWithStatus(request, returnTo, 'connected')
    )
    clearOAuthCookie(response)
    return response
  } catch {
    return await fail('unknown_oauth_error', state?.tenantId ?? cookieState?.tenantId)
  }
}
