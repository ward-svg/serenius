import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase-server'
import { createSupabaseServiceClient } from '@/lib/supabase-service'
import { ensureAuthUserForTenantAdmin } from '@/lib/auth/admin'

export const revalidate = 0

interface CreateTenantPayload {
  organizationName?: string
  slug?: string
  plan?: string
  initialTenantAdminFullName?: string
  initialTenantAdminEmail?: string
}

interface AuthenticatedUser {
  id: string
  email: string | null
}

function slugifyTenantSlug(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

function isValidSlug(slug: string) {
  return /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)
}

async function requireSuperAdmin(): Promise<AuthenticatedUser> {
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

  return {
    id: userResult.user.id,
    email: userResult.user.email ?? null,
  }
}

async function getRoleId(serviceSupabase: ReturnType<typeof createSupabaseServiceClient>, roleName: string) {
  const { data, error } = await serviceSupabase
    .from('roles')
    .select('id, name')
    .eq('name', roleName)
    .maybeSingle<{ id: string; name: string }>()

  if (error) throw error
  if (!data) throw new Error(`Role not found: ${roleName}`)
  return data.id
}

export async function POST(request: NextRequest) {
  try {
    await requireSuperAdmin()

    const payload = (await request.json()) as CreateTenantPayload
    const organizationName = payload.organizationName?.trim()
    const requestedSlug = payload.slug?.trim()
    const plan = payload.plan?.trim() || null
    const initialTenantAdminFullName = payload.initialTenantAdminFullName?.trim()
    const initialTenantAdminEmail = payload.initialTenantAdminEmail?.trim().toLowerCase()

    if (!organizationName) {
      return NextResponse.json({ error: 'Organization name is required.' }, { status: 400 })
    }

    if (!initialTenantAdminFullName) {
      return NextResponse.json({ error: 'Initial tenant admin full name is required.' }, { status: 400 })
    }

    if (!initialTenantAdminEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(initialTenantAdminEmail)) {
      return NextResponse.json({ error: 'A valid initial tenant admin email is required.' }, { status: 400 })
    }

    const normalizedSlug = slugifyTenantSlug(requestedSlug || organizationName)
    if (!normalizedSlug || !isValidSlug(normalizedSlug)) {
      return NextResponse.json({ error: 'Slug must be lowercase and URL-safe.' }, { status: 400 })
    }

    const serviceSupabase = createSupabaseServiceClient()

    const { data: existingOrg, error: existingOrgError } = await serviceSupabase
      .from('organizations')
      .select('id')
      .eq('slug', normalizedSlug)
      .maybeSingle<{ id: string }>()

    if (existingOrgError) {
      throw existingOrgError
    }

    if (existingOrg) {
      return NextResponse.json({ error: 'A tenant with this slug already exists.' }, { status: 409 })
    }

    const { data: orgData, error: orgError } = await serviceSupabase
      .from('organizations')
      .insert({
        name: organizationName,
        slug: normalizedSlug,
        plan,
        is_active: true,
      })
      .select('id, name, slug')
      .single<{ id: string; name: string; slug: string }>()

    if (orgError || !orgData) {
      throw orgError ?? new Error('Organization insert failed.')
    }

    const [settingsExisting, brandingExisting, mailExisting, storageExisting] = await Promise.all([
      serviceSupabase
        .from('organization_settings')
        .select('id')
        .eq('tenant_id', orgData.id)
        .maybeSingle<{ id: string }>(),
      serviceSupabase
        .from('organization_branding')
        .select('id')
        .eq('tenant_id', orgData.id)
        .maybeSingle<{ id: string }>(),
      serviceSupabase
        .from('organization_mail')
        .select('id')
        .eq('tenant_id', orgData.id)
        .maybeSingle<{ id: string }>(),
      serviceSupabase
        .from('organization_storage_settings')
        .select('id')
        .eq('tenant_id', orgData.id)
        .maybeSingle<{ id: string }>(),
    ])

    const settingsRow = {
      tenant_id: orgData.id,
      timezone: 'America/New_York',
      date_format: 'MM/DD/YYYY',
      currency: 'USD',
      fiscal_year_start: 'January',
      modules_enabled: [] as string[],
      max_users: 25,
      storage_limit_gb: 10,
      google_maps_api_key: null,
      serenius_api_key: null,
      serenius_api_key_generated_at: null,
    }

    if (settingsExisting.error) throw settingsExisting.error
    if (settingsExisting.data) {
      const { error } = await serviceSupabase
        .from('organization_settings')
        .update(settingsRow)
        .eq('tenant_id', orgData.id)
      if (error) throw error
    } else {
      const { error } = await serviceSupabase
        .from('organization_settings')
        .insert(settingsRow)
      if (error) throw error
    }

    const brandingRow = {
      tenant_id: orgData.id,
      app_name: organizationName,
      primary_color: '#3D5A80',
      secondary_color: '#98C1D9',
      accent_color: '#EE6C4D',
      alert_color: '#EE6C4D',
      sidebar_background_color: null,
      sidebar_color: '#293241',
      font_heading: 'Inter',
      font_body: 'Inter',
      logo_url: null,
    }

    if (brandingExisting.error) throw brandingExisting.error
    if (brandingExisting.data) {
      const { error } = await serviceSupabase
        .from('organization_branding')
        .update(brandingRow)
        .eq('tenant_id', orgData.id)
      if (error) throw error
    } else {
      const { error } = await serviceSupabase
        .from('organization_branding')
        .insert(brandingRow)
      if (error) throw error
    }

    const mailRow = {
      tenant_id: orgData.id,
      from_name: organizationName,
      from_email: null,
      reply_to: null,
    }

    if (mailExisting.error) throw mailExisting.error
    if (mailExisting.data) {
      const { error } = await serviceSupabase
        .from('organization_mail')
        .update(mailRow)
        .eq('tenant_id', orgData.id)
      if (error) throw error
    } else {
      const { error } = await serviceSupabase
        .from('organization_mail')
        .insert(mailRow)
      if (error) throw error
    }

    const storageRow = {
      tenant_id: orgData.id,
      provider: 'google_drive',
      display_name: 'Google Drive',
      root_folder_id: null,
      root_folder_url: null,
      is_enabled: false,
      connection_status: 'manual',
      locked_at: null,
      locked_by: null,
      connected_at: null,
      connected_by: null,
    }

    if (storageExisting.error) throw storageExisting.error
    if (storageExisting.data) {
      const { error } = await serviceSupabase
        .from('organization_storage_settings')
        .update(storageRow)
        .eq('tenant_id', orgData.id)
      if (error) throw error
    } else {
      const { error } = await serviceSupabase
        .from('organization_storage_settings')
        .insert(storageRow)
      if (error) throw error
    }

    const tenantAdminRoleId = await getRoleId(serviceSupabase, 'tenant_admin')
    const authUser = await ensureAuthUserForTenantAdmin(initialTenantAdminEmail, initialTenantAdminFullName)

    const { data: existingProfile, error: profileLookupError } = await serviceSupabase
      .from('user_profiles')
      .select('id')
      .eq('user_id', authUser.id)
      .maybeSingle<{ id: string }>()

    if (profileLookupError) throw profileLookupError

    let profileId = existingProfile?.id ?? null

    if (profileId) {
      const { error: profileUpdateError } = await serviceSupabase
        .from('user_profiles')
        .update({
          tenant_id: orgData.id,
          full_name: initialTenantAdminFullName,
          email: authUser.email ?? initialTenantAdminEmail,
        })
        .eq('id', profileId)
      if (profileUpdateError) throw profileUpdateError
    } else {
      const { data: insertedProfile, error: profileInsertError } = await serviceSupabase
        .from('user_profiles')
        .insert({
          user_id: authUser.id,
          tenant_id: orgData.id,
          full_name: initialTenantAdminFullName,
          email: authUser.email ?? initialTenantAdminEmail,
        })
        .select('id')
        .single<{ id: string }>()
      if (profileInsertError || !insertedProfile) throw profileInsertError ?? new Error('Failed to create user profile.')
      profileId = insertedProfile.id
    }

    const { data: existingRole, error: roleLookupError } = await serviceSupabase
      .from('user_roles')
      .select('id')
      .eq('tenant_id', orgData.id)
      .eq('user_id', profileId)
      .eq('role_id', tenantAdminRoleId)
      .maybeSingle<{ id: string }>()

    if (roleLookupError) throw roleLookupError

    if (!existingRole) {
      const { error: roleInsertError } = await serviceSupabase
        .from('user_roles')
        .insert({
          tenant_id: orgData.id,
          user_id: profileId,
          role_id: tenantAdminRoleId,
        })
      if (roleInsertError) throw roleInsertError
    }

    return NextResponse.json({
      ok: true,
      tenantId: orgData.id,
      tenantSlug: orgData.slug,
    })
  } catch (error) {
    if (error instanceof Response) {
      return error
    }

    console.error('[platform-admin/tenants] create tenant failed', error)
    return NextResponse.json({ error: 'Failed to create tenant.' }, { status: 500 })
  }
}
