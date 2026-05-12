import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { assertTenantAccess } from '@/lib/auth/tenant-access'
import { createSupabaseServiceClient } from '@/lib/supabase-service'

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
  const now = new Date().toISOString()

  const [credentialRes, settingsRes] = await Promise.all([
    serviceSupabase
      .from('organization_mail_credentials')
      .delete()
      .eq('tenant_id', tenantId)
      .eq('provider', 'google_workspace'),
    serviceSupabase
      .from('organization_mail_settings')
      .update({
        connection_status: 'disabled',
        is_enabled: false,
        provider_account_email: null,
        provider_account_name: null,
        connected_at: null,
        connected_by: null,
        send_mode: 'disabled',
        updated_at: now,
      })
      .eq('tenant_id', tenantId)
      .eq('provider', 'google_workspace'),
  ])

  if (credentialRes.error || settingsRes.error) {
    return NextResponse.json({
      ok: false,
      error: credentialRes.error?.message || settingsRes.error?.message || 'Failed to disconnect Google Workspace.',
    }, { status: 400 })
  }

  return NextResponse.json({ ok: true })
}

