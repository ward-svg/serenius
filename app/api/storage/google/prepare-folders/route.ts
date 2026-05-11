import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { assertTenantAccess } from '@/lib/auth/tenant-access'
import {
  getAuthorizedDriveClientForTenant,
  getDriveFolderMetadata,
  prepareSereniusFolderStructure,
} from '@/lib/storage/google'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const tenantId = searchParams.get('tenantId')

  if (!tenantId) {
    return NextResponse.json({ ok: false, error: 'Missing tenantId.' }, { status: 400 })
  }

  const accessCheck = await assertTenantAccess({ tenantId })
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
