import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { MAX_ATTACHMENT_UPLOAD_BYTES } from '@/lib/attachments/constants'
import { createSupabaseServiceClient } from '@/lib/supabase-service'
import {
  getAuthorizedDriveClientForTenant,
  resolveDriveUploadFolderForRecord,
  uploadFileToDrive,
} from '@/lib/storage/google'

export const runtime = 'nodejs'

async function assertUploadAccess(tenantId: string) {
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
    .select('id, is_active')
    .eq('id', tenantId)
    .maybeSingle()

  if (!org || !org.is_active) {
    return { error: NextResponse.json({ ok: false, error: 'Tenant not found.' }, { status: 404 }) }
  }

  return { ok: true as const, userId: userResult.user.id }
}

function toErrorResponse(error: unknown, status = 400) {
  const message = error instanceof Error ? error.message : 'Upload failed.'
  return NextResponse.json({ ok: false, error: message }, { status })
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const tenantId = String(formData.get('tenantId') ?? '').trim()
    const recordType = String(formData.get('recordType') ?? '').trim()
    const recordId = String(formData.get('recordId') ?? '').trim()
    const partnerId = String(formData.get('partnerId') ?? '').trim() || null
    const partnerDisplayName = String(formData.get('partnerDisplayName') ?? '').trim() || null
    const description = String(formData.get('description') ?? '').trim() || null
    const fileValue = formData.get('file')

    if (!tenantId) {
      return NextResponse.json({ ok: false, error: 'Missing tenantId.' }, { status: 400 })
    }

    if (!recordType) {
      return NextResponse.json({ ok: false, error: 'Missing recordType.' }, { status: 400 })
    }

    if (!recordId) {
      return NextResponse.json({ ok: false, error: 'Missing recordId.' }, { status: 400 })
    }

    if (recordType !== 'partner_communication') {
      return NextResponse.json({ ok: false, error: `Unsupported recordType: ${recordType}` }, { status: 400 })
    }

    if (!(fileValue instanceof File)) {
      return NextResponse.json({ ok: false, error: 'Missing file.' }, { status: 400 })
    }

    if (fileValue.size > MAX_ATTACHMENT_UPLOAD_BYTES) {
      return NextResponse.json({ ok: false, error: 'File exceeds the 100 MB upload limit.' }, { status: 413 })
    }

    const accessCheck = await assertUploadAccess(tenantId)
    if ('error' in accessCheck) return accessCheck.error

    const serviceSupabase = createSupabaseServiceClient()
    const { data: communication, error: communicationError } = await serviceSupabase
      .from('partner_communications')
      .select('id, tenant_id, partner_id')
      .eq('id', recordId)
      .eq('tenant_id', tenantId)
      .maybeSingle()

    if (communicationError) {
      throw communicationError
    }

    if (!communication) {
      return NextResponse.json({ ok: false, error: 'Record not found for this tenant.' }, { status: 404 })
    }

    if (partnerId && communication.partner_id && partnerId !== communication.partner_id) {
      return NextResponse.json({ ok: false, error: 'Partner context does not match the communication record.' }, { status: 400 })
    }

    const context = await getAuthorizedDriveClientForTenant(tenantId)
    if (!context.settings.is_enabled || context.settings.connection_status !== 'connected') {
      return NextResponse.json({ ok: false, error: 'Google Drive storage is not connected.' }, { status: 400 })
    }

    if (!context.settings.root_folder_id) {
      return NextResponse.json({ ok: false, error: 'Root folder ID is not configured.' }, { status: 400 })
    }

    const resolvedPartnerId = partnerId || communication.partner_id || null
    const resolvedPartnerDisplayName = partnerDisplayName || null
    const { rootFolder, recordFolder } = await resolveDriveUploadFolderForRecord(context.accessToken, {
      rootFolderId: context.settings.root_folder_id,
      recordType: 'partner_communication',
      recordId,
      partnerId: resolvedPartnerId,
      partnerDisplayName: resolvedPartnerDisplayName,
    })

    const uploadedFile = await uploadFileToDrive(context.accessToken, {
      file: fileValue,
      folderId: recordFolder.id,
      fileName: fileValue.name,
      mimeType: fileValue.type || 'application/octet-stream',
    })
    const fileUrl = uploadedFile.webViewLink ?? `https://drive.google.com/file/d/${uploadedFile.id}/view`

    const { data: insertedAttachment, error: insertError } = await serviceSupabase
      .from('record_attachments')
      .insert({
        tenant_id: tenantId,
        record_type: recordType,
        record_id: recordId,
        storage_provider: 'google_drive',
        provider_file_id: uploadedFile.id,
        provider_folder_id: recordFolder.id,
        file_name: uploadedFile.name || fileValue.name,
        file_url: fileUrl,
        mime_type: uploadedFile.mimeType || fileValue.type || null,
        file_size_bytes: uploadedFile.size ? Number(uploadedFile.size) : null,
        description,
        uploaded_by: accessCheck.userId,
        metadata: {
          originalFileName: fileValue.name,
          googleMimeType: uploadedFile.mimeType || fileValue.type || null,
          uploadSource: 'serenius_upload',
          rootFolderId: rootFolder.id,
          downloadUrl: uploadedFile.webContentLink ?? null,
        },
      })
      .select('id, file_name, file_url, mime_type, file_size_bytes, storage_provider, provider_file_id, provider_folder_id, created_at')
      .single()

    if (insertError) {
      throw insertError
    }

    return NextResponse.json({
      ok: true,
      attachment: insertedAttachment,
    })
  } catch (error) {
    return toErrorResponse(error)
  }
}
