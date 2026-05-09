import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import {
  getAuthorizedDriveClientForTenant,
  getDriveFolderMetadata,
  prepareSereniusFolderStructure,
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
    .select('id, slug, is_active')
    .eq('id', tenantId)
    .maybeSingle()

  if (!org || !org.is_active) {
    return { error: NextResponse.json({ ok: false, error: 'Tenant not found.' }, { status: 404 }) }
  }

  return { ok: true as const }
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const tenantId = searchParams.get('tenantId')

  if (!tenantId) {
    return NextResponse.json({ ok: false, error: 'Missing tenantId.' }, { status: 400 })
  }

  const accessCheck = await assertTenantStorageAccess(tenantId)
  if ('error' in accessCheck) return accessCheck.error

  try {
    const context = await getAuthorizedDriveClientForTenant(tenantId)

    if (!context.settings.root_folder_id) {
      return NextResponse.json({ ok: false, error: 'Root folder ID is not configured.' }, { status: 400 })
    }

    const rootFolder = await getDriveFolderMetadata(context.accessToken, context.settings.root_folder_id)
    const prepared = await prepareSereniusFolderStructure(context.accessToken, rootFolder.id)

    return NextResponse.json({
      ok: true,
      rootFolder: {
        id: rootFolder.id,
        name: rootFolder.name,
        webViewLink: rootFolder.webViewLink,
      },
      folders: prepared.folders,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to prepare folder structure.'
    return NextResponse.json({ ok: false, error: message }, { status: 400 })
  }
}
