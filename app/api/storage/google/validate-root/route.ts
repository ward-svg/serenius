import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { assertTenantAccess } from '@/lib/auth/tenant-access'
import {
  getAuthorizedDriveClientForTenant,
  getDriveFolderMetadata,
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

    const folder = await getDriveFolderMetadata(context.accessToken, context.settings.root_folder_id)

    return NextResponse.json({
      ok: true,
      folder: {
        id: folder.id,
        name: folder.name,
        webViewLink: folder.webViewLink,
      },
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to validate root folder.'
    return NextResponse.json({ ok: false, error: message }, { status: 400 })
  }
}
