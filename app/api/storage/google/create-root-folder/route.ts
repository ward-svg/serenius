import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import {
  buildTenantRootFolderName,
  createOrReuseTenantRootFolder,
  getAuthorizedDriveClientForTenant,
} from '@/lib/storage/google'

async function assertTenantStorageAccess(tenantId: string) {
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
    return { error: NextResponse.json({ ok: false, error: 'Unauthenticated.' }, { status: 401 }) }
  }

  if (superRes.data !== true && adminRes.data !== true) {
    return { error: NextResponse.json({ ok: false, error: 'Forbidden.' }, { status: 403 }) }
  }

  const { data: org } = await supabase
    .from('organizations')
    .select('id, name, slug, is_active')
    .eq('id', tenantId)
    .maybeSingle()

  if (!org || !org.is_active) {
    return { error: NextResponse.json({ ok: false, error: 'Tenant not found.' }, { status: 404 }) }
  }

  return { ok: true as const, org, userId: userResult.user.id }
}

export async function POST(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const tenantId = searchParams.get('tenantId')
  const tenantSlug = searchParams.get('tenantSlug')

  if (!tenantId) {
    return NextResponse.json({ ok: false, error: 'Missing tenantId.' }, { status: 400 })
  }

  const accessCheck = await assertTenantStorageAccess(tenantId)
  if ('error' in accessCheck) return accessCheck.error

  try {
    const context = await getAuthorizedDriveClientForTenant(tenantId)
    const folderName = buildTenantRootFolderName({
      organizationName: accessCheck.org.name,
      tenantSlug: tenantSlug ?? accessCheck.org.slug,
    })

    const { folder, created } = await createOrReuseTenantRootFolder(context.accessToken, folderName)
    const { client } = context
    const { data: existingSettings } = await client
      .from('organization_storage_settings')
      .select('id, locked_at, locked_by')
      .eq('tenant_id', tenantId)
      .maybeSingle()

    const now = new Date().toISOString()
    const { error: settingsError } = await client
      .from('organization_storage_settings')
      .upsert({
        tenant_id: tenantId,
        provider: 'google_drive',
        display_name: 'Google Drive',
        root_folder_id: folder.id,
        root_folder_url: folder.webViewLink,
        is_enabled: true,
        connection_status: 'connected',
        locked_at: existingSettings?.locked_at ?? now,
        locked_by: existingSettings?.locked_by ?? accessCheck.userId,
      }, { onConflict: 'tenant_id' })

    if (settingsError) {
      throw settingsError
    }

    return NextResponse.json({
      ok: true,
      created,
      folderId: folder.id,
      folderName: folder.name,
      folderUrl: folder.webViewLink,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to create the root folder.'
    return NextResponse.json({ ok: false, error: message }, { status: 400 })
  }
}
