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
