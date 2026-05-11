import 'server-only'

import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'

interface OrganizationRow {
  id: string
  name: string
  slug: string
  is_active: boolean
}

interface UserProfileRow {
  tenant_id: string | null
}

export interface TenantAccessContext {
  supabase: ReturnType<typeof createServerClient>
  userId: string
  isSuperAdmin: boolean
  tenantProfileId: string | null
  organization: OrganizationRow
}

export async function assertTenantAccess(input: { tenantId?: string | null; tenantSlug?: string | null }) {
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

  const [{ data: userResult }, superRes, adminRes, orgRes] = await Promise.all([
    supabase.auth.getUser(),
    supabase.rpc('has_role', { role_name: 'superadmin' }),
    supabase.rpc('has_role', { role_name: 'tenant_admin' }),
    input.tenantId
      ? supabase
        .from('organizations')
        .select('id, name, slug, is_active')
        .eq('id', input.tenantId)
        .maybeSingle<OrganizationRow>()
      : input.tenantSlug
        ? supabase
          .from('organizations')
          .select('id, name, slug, is_active')
          .eq('slug', input.tenantSlug)
          .maybeSingle<OrganizationRow>()
        : Promise.resolve({ data: null as OrganizationRow | null }),
  ])

  if (!userResult.user) {
    return { error: NextResponse.json({ ok: false, error: 'Unauthenticated.' }, { status: 401 }) }
  }

  const { data: profile } = await supabase
    .from('user_profiles')
    .select('tenant_id')
    .eq('user_id', userResult.user.id)
    .maybeSingle<UserProfileRow>()

  const isSuperAdmin = superRes.data === true
  const isTenantAdmin = adminRes.data === true
  const tenantProfileId = profile?.tenant_id ?? null
  const organization = orgRes.data

  if (!isSuperAdmin) {
    if (!isTenantAdmin || tenantProfileId !== organization?.id) {
      return { error: NextResponse.json({ ok: false, error: 'Forbidden.' }, { status: 403 }) }
    }
  }

  if (!organization || !organization.is_active) {
    return { error: NextResponse.json({ ok: false, error: 'Tenant not found.' }, { status: 404 }) }
  }

  return {
    ok: true as const,
    supabase,
    userId: userResult.user.id,
    isSuperAdmin,
    tenantProfileId,
    organization,
  }
}
