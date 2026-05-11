import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { assertTenantAccess } from '@/lib/auth/tenant-access'
import {
  buildTenantRootFolderName,
  createOrReuseTenantRootFolder,
  getAuthorizedDriveClientForTenant,
} from '@/lib/storage/google'

export async function POST(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const tenantId = searchParams.get('tenantId')
  const tenantSlug = searchParams.get('tenantSlug')

  if (!tenantId) {
    return NextResponse.json({ ok: false, error: 'Missing tenantId.' }, { status: 400 })
  }

  const accessCheck = await assertTenantAccess({ tenantId })
  if ('error' in accessCheck) return accessCheck.error

  try {
    const context = await getAuthorizedDriveClientForTenant(tenantId)
    const folderName = buildTenantRootFolderName({
      organizationName: accessCheck.organization.name,
      tenantSlug: tenantSlug ?? accessCheck.organization.slug,
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
