import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { assertTenantAccess } from '@/lib/auth/tenant-access'
import { createSupabaseServiceClient } from '@/lib/supabase-service'
import {
  ALLOWED_ASSET_TYPES,
  computeSha256,
  extractImageDimensions,
  sanitizeFileName,
  validateAssetFile,
} from '@/lib/assets/validation'
import { uploadAssetViaSftp } from '@/lib/assets/sftp'

export const runtime = 'nodejs'

function getAssetsPublicBaseUrl(): string {
  const base = process.env.ASSETS_PUBLIC_BASE_URL?.trim()
  if (!base) throw new Error('ASSETS_PUBLIC_BASE_URL is not configured.')
  return base.replace(/\/+$/, '')
}

export async function POST(request: NextRequest) {
  let formData: FormData
  try {
    formData = await request.formData()
  } catch {
    return NextResponse.json({ ok: false, error: 'Invalid multipart form data.' }, { status: 400 })
  }

  const tenantId = String(formData.get('tenantId') ?? '').trim()
  const assetTypeRaw = String(formData.get('asset_type') ?? '').trim()
  const altText = String(formData.get('alt_text') ?? '').trim() || null
  const fileValue = formData.get('file')

  if (!tenantId) {
    return NextResponse.json({ ok: false, error: 'Missing tenantId.' }, { status: 400 })
  }

  if (!(fileValue instanceof File)) {
    return NextResponse.json({ ok: false, error: 'Missing file.' }, { status: 400 })
  }

  const assetType = assetTypeRaw || 'body_image'
  if (!ALLOWED_ASSET_TYPES.has(assetType)) {
    return NextResponse.json(
      {
        ok: false,
        error: `Invalid asset_type "${assetType}". Allowed: ${[...ALLOWED_ASSET_TYPES].join(', ')}.`,
      },
      { status: 400 },
    )
  }

  // Validate MIME type, extension, and size before auth to give clear feedback early
  const fileValidation = validateAssetFile(fileValue)
  if (!fileValidation.ok) {
    return NextResponse.json({ ok: false, error: fileValidation.error }, { status: fileValidation.status })
  }

  // Auth: require tenant_admin or superadmin — uses existing guard, no new permission system
  const accessCheck = await assertTenantAccess({ tenantId })
  if ('error' in accessCheck) {
    return accessCheck.error
  }

  const tenantSlug = accessCheck.organization.slug

  // Read file into buffer for checksum, dimension extraction, and SFTP upload
  let fileBuffer: Buffer
  try {
    fileBuffer = Buffer.from(await fileValue.arrayBuffer())
  } catch {
    return NextResponse.json({ ok: false, error: 'Failed to read file.' }, { status: 400 })
  }

  const mimeType = fileValue.type.toLowerCase().trim()
  const originalFileName = fileValue.name ?? ''
  const safeFileName = sanitizeFileName(originalFileName, mimeType)
  const assetId = crypto.randomUUID()
  const relativePath = `${tenantSlug}/email/${assetId}/${safeFileName}`
  const checksum = computeSha256(fileBuffer)
  const dimensions = extractImageDimensions(fileBuffer, mimeType)

  let publicBaseUrl: string
  try {
    publicBaseUrl = getAssetsPublicBaseUrl()
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : 'Asset server not configured.' },
      { status: 500 },
    )
  }

  const publicUrl = `${publicBaseUrl}/${relativePath}`

  // Upload via SFTP — do not insert DB row if upload fails
  try {
    await uploadAssetViaSftp({ fileBuffer, relativePath })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'SFTP upload failed.'
    return NextResponse.json({ ok: false, error: `Upload failed: ${message}` }, { status: 502 })
  }

  // Insert metadata row after confirmed upload
  const serviceSupabase = createSupabaseServiceClient()
  const { data: asset, error: insertError } = await serviceSupabase
    .from('communication_email_assets')
    .insert({
      tenant_id: accessCheck.organization.id,
      asset_type: assetType,
      file_name: safeFileName,
      original_file_name: originalFileName || null,
      storage_provider: 'serenius_assets',
      storage_path: relativePath,
      public_url: publicUrl,
      mime_type: mimeType,
      file_size_bytes: fileValue.size,
      width: dimensions?.width ?? null,
      height: dimensions?.height ?? null,
      alt_text: altText,
      checksum_sha256: checksum,
      uploaded_by: accessCheck.userId,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .select('id, asset_type, file_name, original_file_name, storage_path, public_url, mime_type, file_size_bytes, width, height, alt_text, created_at')
    .single()

  if (insertError || !asset) {
    // File is on SFTP but metadata insert failed — log the path for recovery
    console.error('[asset-upload] DB insert failed after SFTP upload. Manual cleanup may be needed.', {
      relativePath,
      publicUrl,
      error: insertError?.message,
    })
    return NextResponse.json(
      {
        ok: false,
        error: 'File was uploaded but metadata could not be saved. Please contact support.',
        storage_path: relativePath,
      },
      { status: 500 },
    )
  }

  return NextResponse.json({ ok: true, asset })
}
