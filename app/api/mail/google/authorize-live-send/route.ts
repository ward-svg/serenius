import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { assertTenantAccess } from '@/lib/auth/tenant-access'
import { createSupabaseServiceClient } from '@/lib/supabase-service'

export async function POST(request: NextRequest) {
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON.' }, { status: 400 })
  }

  const { tenantId, mailSettingsId, authorized } = body as {
    tenantId?: string
    mailSettingsId?: string
    authorized?: boolean
  }

  if (!tenantId || !mailSettingsId || typeof authorized !== 'boolean') {
    return NextResponse.json({ error: 'Missing required fields.' }, { status: 400 })
  }

  const accessCheck = await assertTenantAccess({ tenantId })
  if ('error' in accessCheck) {
    return accessCheck.error
  }

  const supabase = createSupabaseServiceClient()
  const { data, error } = await supabase
    .from('organization_mail_settings')
    .update({ campaign_live_send_authorized: authorized })
    .eq('id', mailSettingsId)
    .eq('tenant_id', tenantId)
    .select('id, campaign_live_send_authorized')
    .maybeSingle()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  if (!data) {
    return NextResponse.json({ error: 'Mail settings not found or update rejected.' }, { status: 403 })
  }

  return NextResponse.json({ ok: true, campaign_live_send_authorized: data.campaign_live_send_authorized })
}
