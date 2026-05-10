import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase-server'
import { createSupabaseServiceClient } from '@/lib/supabase-service'
import {
  buildGoogleDriveRenderableImageUrl,
  getAuthorizedDriveClientForTenant,
  makeDriveFilePublic,
  uploadFileToDrive,
} from '@/lib/storage/google'

export const runtime = 'nodejs'

const MAX_BRANDING_LOGO_UPLOAD_BYTES = 5 * 1024 * 1024
const ALLOWED_IMAGE_MIME_TYPES = new Set([
  'image/png',
  'image/jpeg',
  'image/webp',
  'image/svg+xml',
])

async function assertLogoUploadAccess(tenantId: string) {
  const supabase = await createSupabaseServerClient()

  const [{ data: userResult }, { data: isSuperAdmin }, { data: isTenantAdmin }] = await Promise.all([
    supabase.auth.getUser(),
    supabase.rpc('has_role', { role_name: 'superadmin' }),
    supabase.rpc('has_role', { role_name: 'tenant_admin' }),
  ])

  if (!userResult.user) {
    return { error: NextResponse.json({ ok: false, error: 'Unauthenticated.' }, { status: 401 }) }
  }

  if (isSuperAdmin === true) {
    return { ok: true as const, userId: userResult.user.id, role: 'superadmin' as const }
  }

  if (isTenantAdmin !== true) {
    return { error: NextResponse.json({ ok: false, error: 'Forbidden.' }, { status: 403 }) }
  }

  const serviceSupabase = createSupabaseServiceClient()
  const { data: profile, error } = await serviceSupabase
    .from('user_profiles')
    .select('id, tenant_id')
    .eq('user_id', userResult.user.id)
    .maybeSingle<{ id: string; tenant_id: string | null }>()

  if (error) {
    throw error
  }

  if (!profile || profile.tenant_id !== tenantId) {
    return { error: NextResponse.json({ ok: false, error: 'Forbidden.' }, { status: 403 }) }
  }

  return { ok: true as const, userId: userResult.user.id, role: 'tenant_admin' as const }
}

function getFileExtension(mimeType: string) {
  switch (mimeType) {
    case 'image/png':
      return 'png'
    case 'image/jpeg':
      return 'jpg'
    case 'image/webp':
      return 'webp'
    case 'image/svg+xml':
      return 'svg'
    default:
      return 'img'
  }
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const tenantId = String(formData.get('tenantId') ?? '').trim()
    const tenantSlug = String(formData.get('tenantSlug') ?? '').trim() || null
    const fileValue = formData.get('file')

    if (!tenantId && !tenantSlug) {
      return NextResponse.json({ ok: false, error: 'Missing tenantId.' }, { status: 400 })
    }

    if (!(fileValue instanceof File)) {
      return NextResponse.json({ ok: false, error: 'Missing file.' }, { status: 400 })
    }

    if (!ALLOWED_IMAGE_MIME_TYPES.has(fileValue.type)) {
      return NextResponse.json({ ok: false, error: 'Logo uploads must be PNG, JPEG, WebP, or SVG images.' }, { status: 400 })
    }

    if (fileValue.size > MAX_BRANDING_LOGO_UPLOAD_BYTES) {
      return NextResponse.json({ ok: false, error: 'Logo files must be 5 MB or smaller.' }, { status: 413 })
    }

    const serviceSupabase = createSupabaseServiceClient()
    const { data: tenantRow, error: tenantLookupError } = tenantId
      ? await serviceSupabase
        .from('organizations')
        .select('id, slug, is_active')
        .eq('id', tenantId)
        .maybeSingle<{ id: string; slug: string; is_active: boolean }>()
      : await serviceSupabase
        .from('organizations')
        .select('id, slug, is_active')
        .eq('slug', tenantSlug)
        .maybeSingle<{ id: string; slug: string; is_active: boolean }>()

    if (tenantLookupError) {
      throw tenantLookupError
    }

    if (!tenantRow || !tenantRow.is_active) {
      return NextResponse.json({ ok: false, error: 'Tenant not found.' }, { status: 404 })
    }

    if (tenantSlug && tenantRow.slug !== tenantSlug) {
      return NextResponse.json({ ok: false, error: 'Tenant slug does not match the requested tenant.' }, { status: 400 })
    }

    const accessCheck = await assertLogoUploadAccess(tenantRow.id)
    if ('error' in accessCheck) return accessCheck.error

    const context = await getAuthorizedDriveClientForTenant(tenantRow.id)
    if (!context.settings.is_enabled || context.settings.connection_status !== 'connected') {
      return NextResponse.json({ ok: false, error: 'Google Drive storage is not connected.' }, { status: 400 })
    }

    if (!context.settings.root_folder_id) {
      return NextResponse.json({ ok: false, error: 'Root folder ID is not configured.' }, { status: 400 })
    }

    const uploadedFile = await uploadFileToDrive(context.accessToken, {
      file: fileValue,
      folderId: context.settings.root_folder_id,
      fileName: `serenius-logo.${getFileExtension(fileValue.type)}`,
      mimeType: fileValue.type,
    })

    await makeDriveFilePublic(context.accessToken, uploadedFile.id)

    const logoUrl = buildGoogleDriveRenderableImageUrl(uploadedFile.id)

    const { data: brandingRow, error: brandingLookupError } = await serviceSupabase
      .from('organization_branding')
      .select('id')
      .eq('tenant_id', tenantRow.id)
      .maybeSingle<{ id: string }>()

    if (brandingLookupError) {
      throw brandingLookupError
    }

    if (!brandingRow) {
      return NextResponse.json({ ok: false, error: 'Branding record not found for this tenant.' }, { status: 404 })
    }

    const { error: updateError } = await serviceSupabase
      .from('organization_branding')
      .update({
        logo_url: logoUrl,
      })
      .eq('tenant_id', tenantRow.id)

    if (updateError) {
      throw updateError
    }

    return NextResponse.json({
      ok: true,
      logo_url: logoUrl,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Logo upload failed.'
    console.error('[branding/logo/upload] failed', message)
    return NextResponse.json({ ok: false, error: message }, { status: 500 })
  }
}
