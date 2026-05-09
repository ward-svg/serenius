import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import {
  buildGoogleOAuthUrl,
  buildPkceCodeChallenge,
  createGoogleStorageOAuthState,
  GOOGLE_STORAGE_OAUTH_COOKIE_NAME,
} from '@/lib/storage/google'

function getGoogleOAuthConfig() {
  const clientId = process.env.GOOGLE_CLIENT_ID
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET
  const redirectUri = process.env.GOOGLE_REDIRECT_URI

  if (!clientId || !clientSecret || !redirectUri) return null

  return { clientId, clientSecret, redirectUri }
}

function buildReturnToPath(tenantSlug: string) {
  return `/${tenantSlug}/setup?tab=integrations`
}

function withStorageError(url: URL, error: string) {
  url.searchParams.set('tab', 'integrations')
  url.searchParams.set('storage', 'error')
  url.searchParams.set('storage_error', error)
  return url
}

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url)
  const tenantId = requestUrl.searchParams.get('tenantId')
  const tenantSlug = requestUrl.searchParams.get('tenantSlug')
  if (!tenantId && !tenantSlug) {
    return NextResponse.redirect(withStorageError(new URL('/setup?tab=integrations', request.url), 'missing_tenant_context'))
  }
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
  const orgQuery = tenantId
    ? supabase.from('organizations').select('id, slug, is_active').eq('id', tenantId).maybeSingle()
    : tenantSlug
      ? supabase.from('organizations').select('id, slug, is_active').eq('slug', tenantSlug).maybeSingle()
      : null

  if (!orgQuery) {
    return NextResponse.redirect(withStorageError(new URL('/setup?tab=integrations', request.url), 'missing_tenant_context'))
  }

  const [{ data: userResult }, superRes, adminRes, orgResult] = await Promise.all([
    supabase.auth.getUser(),
    supabase.rpc('has_role', { role_name: 'superadmin' }),
    supabase.rpc('has_role', { role_name: 'tenant_admin' }),
    orgQuery,
  ])

  const user = userResult.user
  const org = orgResult.data

  const fallbackUrl = new URL('/login', request.url)
  fallbackUrl.searchParams.set('redirectTo', tenantSlug ? buildReturnToPath(tenantSlug) : '/setup?tab=integrations')

  if (!org || !org.is_active) {
    if (tenantSlug) {
      return NextResponse.redirect(withStorageError(new URL(buildReturnToPath(tenantSlug), request.url), 'tenant_not_found'))
    }
    return NextResponse.redirect(fallbackUrl)
  }

  const returnTo = buildReturnToPath(org.slug)
  const returnToUrl = new URL(returnTo, request.url)

  if (!oauthConfig) {
    return NextResponse.redirect(withStorageError(returnToUrl, 'google_oauth_not_configured'))
  }

  if (!user) {
    return NextResponse.redirect(withStorageError(returnToUrl, 'not_authenticated'))
  }

  if (superRes.data !== true && adminRes.data !== true) {
    return NextResponse.redirect(withStorageError(returnToUrl, 'permission_denied'))
  }

  if (tenantId && tenantId !== org.id) {
    return NextResponse.redirect(withStorageError(returnToUrl, 'tenant_mismatch'))
  }

  const state = createGoogleStorageOAuthState({
    tenantId: org.id,
    tenantSlug: org.slug,
    userId: user.id,
    returnTo,
  })

  const oauthUrl = buildGoogleOAuthUrl({
    clientId: oauthConfig.clientId,
    redirectUri: oauthConfig.redirectUri,
    state: state.state,
    codeChallenge: buildPkceCodeChallenge(state.codeVerifier),
  })

  const response = NextResponse.redirect(oauthUrl)
  response.cookies.set(
    GOOGLE_STORAGE_OAUTH_COOKIE_NAME,
    state.cookieValue,
    {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      maxAge: 10 * 60,
    }
  )

  return response
}
