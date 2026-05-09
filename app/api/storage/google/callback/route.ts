import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { createSupabaseServiceClient } from '@/lib/supabase-service'
import {
  GOOGLE_STORAGE_OAUTH_COOKIE_NAME,
  exchangeGoogleCodeForTokens,
  getGoogleAccountInfo,
  parseGoogleStorageOAuthCookie,
  parseGoogleStorageOAuthState,
  serializeSafeError,
} from '@/lib/storage/google'

type StorageOAuthErrorCode =
  | 'missing_service_role_config'
  | 'invalid_oauth_state'
  | 'missing_google_code'
  | 'token_exchange_failed'
  | 'google_account_lookup_failed'
  | 'credential_save_failed'
  | 'storage_settings_update_failed'
  | 'user_auth_failed'
  | 'unknown_oauth_error'

class StorageOAuthError extends Error {
  constructor(
    public readonly code: StorageOAuthErrorCode,
    message: string,
    public readonly step: string,
    public readonly cause?: unknown,
  ) {
    super(message)
    this.name = 'StorageOAuthError'
  }
}

function getGoogleOAuthConfig() {
  const clientId = process.env.GOOGLE_CLIENT_ID
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET
  const redirectUri = process.env.GOOGLE_REDIRECT_URI

  if (!clientId || !clientSecret || !redirectUri) return null

  return { clientId, clientSecret, redirectUri }
}

function redirectWithStatus(request: NextRequest, returnTo: string, type: 'connected' | 'error', error?: string) {
  const redirectUrl = new URL(returnTo, request.url)
  redirectUrl.searchParams.set('tab', 'integrations')
  redirectUrl.searchParams.set('storage', type)
  if (error) redirectUrl.searchParams.set('storage_error', error)
  return redirectUrl
}

function clearOAuthCookie(response: NextResponse) {
  response.cookies.set(
    GOOGLE_STORAGE_OAUTH_COOKIE_NAME,
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

function getSafeErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message.replace(/\s+/g, ' ').trim().slice(0, 240)
  }

  if (error && typeof error === 'object') {
    const record = error as Record<string, unknown>
    if (typeof record.message === 'string') {
      return record.message.replace(/\s+/g, ' ').trim().slice(0, 240)
    }
  }

  return 'Unknown error'
}

function logOAuthFailure(step: string, code: StorageOAuthErrorCode, error: unknown) {
  console.error('[storage/google/callback] oauth failure', {
    step,
    code,
    error: serializeSafeError(error),
  })
}

function toStorageOAuthError(
  code: StorageOAuthErrorCode,
  message: string,
  step: string,
  cause?: unknown,
) {
  return new StorageOAuthError(code, message, step, cause)
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
  const cookieState = parseGoogleStorageOAuthCookie(request.cookies.get(GOOGLE_STORAGE_OAUTH_COOKIE_NAME)?.value ?? null)
  const state = parseGoogleStorageOAuthState(stateParam)
  const returnTo = state?.returnTo ?? cookieState?.returnTo ?? '/setup?tab=integrations'

  const fail = (error: string) => {
    const response = NextResponse.redirect(redirectWithStatus(request, returnTo, 'error', error))
    clearOAuthCookie(response)
    return response
  }

  try {
    if (errorParam) {
      throw toStorageOAuthError('unknown_oauth_error', `Google returned an OAuth error: ${errorParam}`, 'google_oauth_redirect')
    }

    if (!oauthConfig) {
      throw toStorageOAuthError('unknown_oauth_error', 'Google OAuth is not configured.', 'oauth_config')
    }

    if (!code) {
      throw toStorageOAuthError('missing_google_code', 'Google did not return an authorization code.', 'google_callback_entry')
    }

    if (!state || !cookieState) {
      throw toStorageOAuthError('invalid_oauth_state', 'Missing OAuth state.', 'oauth_state_parse')
    }

    const { data: userResult, error: userError } = await supabase.auth.getUser()
    if (userError) {
      throw toStorageOAuthError('user_auth_failed', userError.message, 'auth_user_lookup')
    }

    const user = userResult.user
    if (!user) {
      throw toStorageOAuthError('user_auth_failed', 'Authenticated user could not be loaded.', 'auth_user_lookup')
    }

    if (user.id !== state.userId || user.id !== cookieState.userId || state.nonce !== cookieState.nonce) {
      throw toStorageOAuthError('invalid_oauth_state', 'OAuth state validation failed.', 'oauth_state_validation')
    }

    let serviceSupabase: ReturnType<typeof createSupabaseServiceClient>
    try {
      serviceSupabase = createSupabaseServiceClient()
    } catch (error) {
      throw toStorageOAuthError('missing_service_role_config', getSafeErrorMessage(error), 'service_client', error)
    }

    const tokens = await exchangeGoogleCodeForTokens({
      code,
      codeVerifier: cookieState.codeVerifier,
      clientId: oauthConfig.clientId,
      clientSecret: oauthConfig.clientSecret,
      redirectUri: oauthConfig.redirectUri,
    }).catch(error => {
      throw toStorageOAuthError('token_exchange_failed', getSafeErrorMessage(error), 'token_exchange', error)
    })

    const account = await getGoogleAccountInfo(tokens.accessToken)
      .catch(error => {
        throw toStorageOAuthError('google_account_lookup_failed', getSafeErrorMessage(error), 'google_account_lookup', error)
      })

    if (!account) {
      throw toStorageOAuthError('google_account_lookup_failed', 'Google account info was not returned.', 'google_account_lookup')
    }

    const { data: existingCredentials } = await serviceSupabase
      .from('organization_storage_credentials')
      .select('id, refresh_token')
      .eq('tenant_id', state.tenantId)
      .eq('provider', 'google_drive')
      .maybeSingle()

    const refreshToken = tokens.refreshToken ?? existingCredentials?.refresh_token ?? null
    if (!refreshToken) {
      throw toStorageOAuthError('credential_save_failed', 'Google did not return a refresh token. Please reconnect and grant offline access.', 'credential_save_refresh_token')
    }

    if (existingCredentials?.id) {
      const { error: credentialUpdateError } = await serviceSupabase
        .from('organization_storage_credentials')
        .update({
          access_token: tokens.accessToken,
          refresh_token: refreshToken,
          token_type: tokens.tokenType,
          scope: tokens.scope,
          expiry_date: tokens.expiryDate,
          external_account_email: account.email,
          external_account_name: account.name,
        })
        .eq('id', existingCredentials.id)

      if (credentialUpdateError) {
        throw toStorageOAuthError('credential_save_failed', getSafeErrorMessage(credentialUpdateError), 'credential_update', credentialUpdateError)
      }
    } else {
      const { error: credentialInsertError } = await serviceSupabase
        .from('organization_storage_credentials')
        .insert({
          tenant_id: state.tenantId,
          provider: 'google_drive',
          access_token: tokens.accessToken,
          refresh_token: refreshToken,
          token_type: tokens.tokenType,
          scope: tokens.scope,
          expiry_date: tokens.expiryDate,
          external_account_email: account.email,
          external_account_name: account.name,
        })

      if (credentialInsertError) {
        throw toStorageOAuthError('credential_save_failed', getSafeErrorMessage(credentialInsertError), 'credential_insert', credentialInsertError)
      }
    }

    const { data: existingSettings } = await serviceSupabase
      .from('organization_storage_settings')
      .select('id, provider, root_folder_id, root_folder_url, locked_at, locked_by')
      .eq('tenant_id', state.tenantId)
      .maybeSingle()

    if (existingSettings?.provider && existingSettings.provider !== 'google_drive') {
      throw toStorageOAuthError('storage_settings_update_failed', 'This organization is already using an unsupported storage provider.', 'storage_settings_check')
    }

    const now = new Date().toISOString()
    const { error: settingsError } = await serviceSupabase
      .from('organization_storage_settings')
      .upsert({
        tenant_id: state.tenantId,
        provider: 'google_drive',
        display_name: 'Google Drive',
        root_folder_id: existingSettings?.root_folder_id ?? null,
        root_folder_url: existingSettings?.root_folder_url ?? null,
        is_enabled: true,
        connection_status: 'connected',
        locked_at: existingSettings?.locked_at ?? now,
        locked_by: existingSettings?.locked_by ?? user.id,
      }, { onConflict: 'tenant_id' })

    if (settingsError) {
      throw toStorageOAuthError('storage_settings_update_failed', getSafeErrorMessage(settingsError), 'storage_settings_upsert', settingsError)
    }

    const successResponse = NextResponse.redirect(redirectWithStatus(request, state.returnTo, 'connected'))
    clearOAuthCookie(successResponse)
    return successResponse
  } catch (error) {
    const storageError = error instanceof StorageOAuthError
      ? error
      : toStorageOAuthError('unknown_oauth_error', getSafeErrorMessage(error), 'callback_unhandled', error)

    logOAuthFailure(storageError.step, storageError.code, storageError.cause ?? error)
    return fail(storageError.code)
  }
}
