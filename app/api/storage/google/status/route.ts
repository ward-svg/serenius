import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { createSupabaseServiceClient } from '@/lib/supabase-service'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const tenantId = searchParams.get('tenantId')

  if (!tenantId) {
    return NextResponse.json({ error: 'Missing tenantId.' }, { status: 400 })
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

  const [{ data: userResult }, superRes, adminRes] = await Promise.all([
    supabase.auth.getUser(),
    supabase.rpc('has_role', { role_name: 'superadmin' }),
    supabase.rpc('has_role', { role_name: 'tenant_admin' }),
  ])

  if (!userResult.user) {
    return NextResponse.json({ error: 'Unauthenticated.' }, { status: 401 })
  }

  if (superRes.data !== true && adminRes.data !== true) {
    return NextResponse.json({ error: 'Forbidden.' }, { status: 403 })
  }

  const serviceSupabase = createSupabaseServiceClient()
  const [settingsRes, credentialsRes] = await Promise.all([
    serviceSupabase
      .from('organization_storage_settings')
      .select('provider, connection_status')
      .eq('tenant_id', tenantId)
      .maybeSingle(),
    serviceSupabase
      .from('organization_storage_credentials')
      .select('provider, external_account_email, external_account_name')
      .eq('tenant_id', tenantId)
      .eq('provider', 'google_drive')
      .maybeSingle(),
  ])

  const connection = {
    provider: settingsRes.data?.provider ?? credentialsRes.data?.provider ?? null,
    connectionStatus: settingsRes.data?.connection_status ?? null,
    credentialsConnected: Boolean(credentialsRes.data),
    externalAccountEmail: credentialsRes.data?.external_account_email ?? null,
    externalAccountName: credentialsRes.data?.external_account_name ?? null,
  }

  return NextResponse.json({ connection })
}
