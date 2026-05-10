import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createSupabaseServerClient } from '@/lib/supabase-server'
import { createSupabaseServiceClient } from '@/lib/supabase-service'
import PlatformAdminDashboard from '@/components/platform-admin/PlatformAdminDashboard'

export const revalidate = 0

interface OrganizationRow {
  id: string
  name: string
  slug: string
  plan: string | null
  is_active: boolean
}

interface OrganizationSettingsRow {
  tenant_id: string
  modules_enabled: string[] | null
  max_users: number | null
  storage_limit_gb: number | null
}

interface OrganizationStorageRow {
  tenant_id: string
  provider: string | null
  connection_status: string | null
  is_enabled: boolean
}

export default async function PlatformAdminPage() {
  const supabase = await createSupabaseServerClient()
  const [{ data: userResult }, superRes] = await Promise.all([
    supabase.auth.getUser(),
    supabase.rpc('has_role', { role_name: 'superadmin' }),
  ])

  if (!userResult.user) {
    redirect('/login')
  }

  if (superRes.data !== true) {
    return (
      <div className="mx-auto max-w-3xl py-8">
          <div className="section-card p-6">
            <div className="section-header">
              <div>
              <h1 className="section-title">Tenant Administration</h1>
                <p className="section-subtitle">
                  This area is available to Serenius superadmins only.
                </p>
              </div>
            </div>
            <p className="mt-4 text-sm text-gray-600">
            You do not have access to Tenant Administration.
            </p>
          <div className="mt-6">
            <Link href="/" className="btn btn-ghost">
              Go to Dashboard
            </Link>
          </div>
        </div>
      </div>
    )
  }

  const serviceSupabase = createSupabaseServiceClient()

  const [
    { data: organizationsData },
    { data: settingsData },
    { data: storageData },
    { count: platformUsersCount },
  ] = await Promise.all([
    serviceSupabase
      .from('organizations')
      .select('id, name, slug, plan, is_active')
      .order('name'),
    serviceSupabase
      .from('organization_settings')
      .select('tenant_id, modules_enabled, max_users, storage_limit_gb'),
    serviceSupabase
      .from('organization_storage_settings')
      .select('tenant_id, provider, connection_status, is_enabled'),
    serviceSupabase
      .from('user_profiles')
      .select('id', { count: 'exact', head: true }),
  ])

  return (
    <PlatformAdminDashboard
      organizations={(organizationsData ?? []) as OrganizationRow[]}
      organizationSettings={(settingsData ?? []) as OrganizationSettingsRow[]}
      organizationStorageSettings={(storageData ?? []) as OrganizationStorageRow[]}
      platformUsersCount={platformUsersCount ?? 0}
    />
  )
}
