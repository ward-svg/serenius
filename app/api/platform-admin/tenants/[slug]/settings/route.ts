import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase-server'
import { createSupabaseServiceClient } from '@/lib/supabase-service'
import { SERENIUS_MODULES } from '@/lib/modules/registry'
import type { SereniusModuleKey } from '@/lib/modules/types'

export const revalidate = 0

interface RouteContext {
  params: Promise<{ slug: string }>
}

interface UpdateTenantSettingsPayload {
  organizationId?: string
  organizationName?: string
  plan?: string
  modulesEnabled?: string[]
}

interface OrganizationRow {
  id: string
  slug: string
}

const VALID_MODULE_KEYS = new Set<SereniusModuleKey>(SERENIUS_MODULES.map(module => module.key))

async function requireSuperAdmin() {
  const supabase = await createSupabaseServerClient()
  const [{ data: userResult }, superRes] = await Promise.all([
    supabase.auth.getUser(),
    supabase.rpc('has_role', { role_name: 'superadmin' }),
  ])

  if (!userResult.user) {
    throw new Response('Unauthenticated', { status: 401 })
  }

  if (superRes.data !== true) {
    throw new Response('Forbidden', { status: 403 })
  }

  return createSupabaseServiceClient()
}

function normalizeModulesEnabled(values: unknown): string[] {
  if (!Array.isArray(values)) return []
  const normalized = values.filter(
    (value): value is SereniusModuleKey => typeof value === 'string' && VALID_MODULE_KEYS.has(value as SereniusModuleKey),
  )
  return Array.from(new Set(normalized))
}

function createDefaultSettingsRow(tenantId: string, modulesEnabled: string[]) {
  return {
    tenant_id: tenantId,
    timezone: 'America/New_York',
    date_format: 'MM/DD/YYYY',
    currency: 'USD',
    fiscal_year_start: 'January',
    modules_enabled: modulesEnabled,
    max_users: 25,
    storage_limit_gb: 10,
    google_maps_api_key: null,
    serenius_api_key: null,
    serenius_api_key_generated_at: null,
  }
}

export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const serviceSupabase = await requireSuperAdmin()
    const { slug } = await context.params
    const payload = (await request.json()) as UpdateTenantSettingsPayload

    const requestedOrganizationName = payload.organizationName?.trim()
    const requestedPlan = payload.plan?.trim() || null
    const requestedModules = normalizeModulesEnabled(payload.modulesEnabled)

    const { data: organization, error: organizationError } = await serviceSupabase
      .from('organizations')
      .select('id, slug')
      .eq('slug', slug)
      .maybeSingle<OrganizationRow>()

    if (organizationError) {
      throw organizationError
    }

    if (!organization) {
      return NextResponse.json({ error: 'Tenant not found.' }, { status: 404 })
    }

    if (payload.organizationId && payload.organizationId !== organization.id) {
      return NextResponse.json({ error: 'Tenant mismatch.' }, { status: 400 })
    }

    if (!requestedOrganizationName) {
      return NextResponse.json({ error: 'Organization name is required.' }, { status: 400 })
    }

    const { error: organizationUpdateError } = await serviceSupabase
      .from('organizations')
      .update({
        name: requestedOrganizationName,
        plan: requestedPlan,
      })
      .eq('id', organization.id)

    if (organizationUpdateError) {
      throw organizationUpdateError
    }

    const { data: settingsRow, error: settingsLookupError } = await serviceSupabase
      .from('organization_settings')
      .select('tenant_id')
      .eq('tenant_id', organization.id)
      .maybeSingle<{ tenant_id: string }>()

    if (settingsLookupError) {
      throw settingsLookupError
    }

    if (settingsRow) {
      const { error: settingsUpdateError } = await serviceSupabase
        .from('organization_settings')
        .update({ modules_enabled: requestedModules })
        .eq('tenant_id', organization.id)
      if (settingsUpdateError) throw settingsUpdateError
    } else {
      const { error: settingsInsertError } = await serviceSupabase
        .from('organization_settings')
        .insert(createDefaultSettingsRow(organization.id, requestedModules))
      if (settingsInsertError) throw settingsInsertError
    }

    return NextResponse.json({
      ok: true,
      organization_name: requestedOrganizationName,
      plan: requestedPlan,
      modules_enabled: requestedModules,
    })
  } catch (error) {
    if (error instanceof Response) {
      return error
    }

    console.error('[platform-admin/tenants/settings] update tenant settings failed', error)
    return NextResponse.json({ error: 'Failed to save tenant settings.' }, { status: 500 })
  }
}
