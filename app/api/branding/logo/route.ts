import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase-server'
import { createSupabaseServiceClient } from '@/lib/supabase-service'
import {
  extractGoogleDriveFileIdFromUrl,
  fetchGoogleDriveFileBytes,
  getAuthorizedDriveClientForTenant,
} from '@/lib/storage/google'

export const runtime = 'nodejs'

interface TenantRow {
  id: string
  slug: string
  is_active: boolean
}

interface BrandingRow {
  tenant_id: string
  logo_url: string | null
}

async function resolveTenant(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const tenantId = searchParams.get('tenantId')?.trim() || null
  const tenantSlug = searchParams.get('tenantSlug')?.trim() || null

  if (!tenantId && !tenantSlug) {
    return { error: NextResponse.json({ ok: false, error: 'Missing tenant identifier.' }, { status: 400 }) }
  }

  const supabase = await createSupabaseServerClient()
  const { data: userResult } = await supabase.auth.getUser()

  if (!userResult.user) {
    return { error: NextResponse.json({ ok: false, error: 'Unauthenticated.' }, { status: 401 }) }
  }

  const [{ data: isSuperAdmin }, { data: isTenantAdmin }] = await Promise.all([
    supabase.rpc('has_role', { role_name: 'superadmin' }),
    supabase.rpc('has_role', { role_name: 'tenant_admin' }),
  ])

  const serviceSupabase = createSupabaseServiceClient()

  const { data: tenantRow, error: tenantError } = tenantId
    ? await serviceSupabase
      .from('organizations')
      .select('id, slug, is_active')
      .eq('id', tenantId)
      .maybeSingle<TenantRow>()
    : await serviceSupabase
      .from('organizations')
      .select('id, slug, is_active')
      .eq('slug', tenantSlug)
      .maybeSingle<TenantRow>()

  if (tenantError) {
    throw tenantError
  }

  if (!tenantRow || !tenantRow.is_active) {
    return { error: NextResponse.json({ ok: false, error: 'Tenant not found.' }, { status: 404 }) }
  }

  if (tenantSlug && tenantRow.slug !== tenantSlug) {
    return { error: NextResponse.json({ ok: false, error: 'Tenant slug does not match the requested tenant.' }, { status: 400 }) }
  }

  if (isSuperAdmin !== true) {
    if (isTenantAdmin !== true) {
      return { error: NextResponse.json({ ok: false, error: 'Forbidden.' }, { status: 403 }) }
    }

    const { data: profile, error: profileError } = await serviceSupabase
      .from('user_profiles')
      .select('id, tenant_id')
      .eq('user_id', userResult.user.id)
      .maybeSingle<{ id: string; tenant_id: string | null }>()

    if (profileError) {
      throw profileError
    }

    if (!profile || profile.tenant_id !== tenantRow.id) {
      return { error: NextResponse.json({ ok: false, error: 'Forbidden.' }, { status: 403 }) }
    }
  }

  return { tenant: tenantRow }
}

export async function GET(request: NextRequest) {
  try {
    const resolved = await resolveTenant(request)
    if ('error' in resolved) return resolved.error

    const serviceSupabase = createSupabaseServiceClient()
    const { data: brandingRow, error: brandingError } = await serviceSupabase
      .from('organization_branding')
      .select('tenant_id, logo_url')
      .eq('tenant_id', resolved.tenant.id)
      .maybeSingle<BrandingRow>()

    if (brandingError) {
      throw brandingError
    }

    if (!brandingRow?.logo_url) {
      return NextResponse.json({ ok: false, error: 'Logo not configured.' }, { status: 404 })
    }

    const fileId = extractGoogleDriveFileIdFromUrl(brandingRow.logo_url)
    if (!fileId) {
      return NextResponse.json({ ok: false, error: 'Unsupported logo URL format.' }, { status: 400 })
    }

    const driveContext = await getAuthorizedDriveClientForTenant(resolved.tenant.id)
    const { bytes, contentType } = await fetchGoogleDriveFileBytes(driveContext.accessToken, fileId)

    return new NextResponse(bytes, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'private, max-age=300, stale-while-revalidate=300',
        'X-Content-Type-Options': 'nosniff',
      },
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to load tenant logo.'
    return NextResponse.json({ ok: false, error: message }, { status: 500 })
  }
}
