import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { assertTenantAccess } from '@/lib/auth/tenant-access'
import { createSupabaseServiceClient } from '@/lib/supabase-service'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const tenantId = searchParams.get('tenantId')

  if (!tenantId) {
    return NextResponse.json({ error: 'Missing tenantId.' }, { status: 400 })
  }

  const accessCheck = await assertTenantAccess({ tenantId })
  if ('error' in accessCheck) {
    return accessCheck.error
  }

  const serviceSupabase = createSupabaseServiceClient()
  const [settingsRes, credentialsRes] = await Promise.all([
    serviceSupabase
      .from('organization_mail_settings')
      .select('provider, connection_status, send_mode, is_enabled, provider_account_email, provider_account_name, connected_at, from_email, from_name, reply_to')
      .eq('tenant_id', tenantId)
      .eq('provider', 'google_workspace')
      .maybeSingle(),
    serviceSupabase
      .from('organization_mail_credentials')
      .select('id')
      .eq('tenant_id', tenantId)
      .eq('provider', 'google_workspace')
      .maybeSingle(),
  ])

  const connection = {
    provider: settingsRes.data?.provider ?? null,
    connection_status: settingsRes.data?.connection_status ?? null,
    send_mode: settingsRes.data?.send_mode ?? null,
    is_enabled: settingsRes.data?.is_enabled ?? null,
    provider_account_email: settingsRes.data?.provider_account_email ?? null,
    provider_account_name: settingsRes.data?.provider_account_name ?? null,
    connected_at: settingsRes.data?.connected_at ?? null,
    from_email: settingsRes.data?.from_email ?? null,
    from_name: settingsRes.data?.from_name ?? null,
    reply_to: settingsRes.data?.reply_to ?? null,
    credentialsConnected: Boolean(credentialsRes.data),
  }

  return NextResponse.json({ connection })
}

