import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createSupabaseServerClient } from '@/lib/supabase-server'
import { createSupabaseServiceClient } from '@/lib/supabase-service'
import PlatformTenantSettingsForm from '@/components/platform-admin/PlatformTenantSettingsForm'
import TenantAdminsTable from '@/components/platform-admin/TenantAdminsTable'

export const revalidate = 0

interface PageProps {
  params: Promise<{ slug: string }>
}

interface OrganizationRow {
  id: string
  name: string
  slug: string
  plan: string | null
}

interface UserProfileRow {
  id: string
  user_id: string
}

interface RoleRow {
  id: string
  name: string
}

interface UserRoleRow {
  user_id: string
  role_id: string
}

interface StorageRow {
  tenant_id: string
  provider: string | null
  connection_status: string | null
  is_enabled: boolean
  root_folder_url: string | null
  display_name: string | null
}

async function requireSuperAdmin() {
  const supabase = await createSupabaseServerClient()
  const [{ data: userResult }, superRes] = await Promise.all([
    supabase.auth.getUser(),
    supabase.rpc('has_role', { role_name: 'superadmin' }),
  ])

  if (!userResult.user) {
    redirect('/login')
  }

  if (superRes.data !== true) {
    redirect('/platform-admin')
  }

  return createSupabaseServiceClient()
}

export default async function PlatformTenantManagePage({ params }: PageProps) {
  const { slug } = await params
  const serviceSupabase = await requireSuperAdmin()

  const { data: organization } = await serviceSupabase
    .from('organizations')
    .select('id, name, slug, plan')
    .eq('slug', slug)
    .maybeSingle<OrganizationRow>()

  if (!organization) {
    redirect('/platform-admin')
  }

  const [settingsRes, storageRes, profilesRes, rolesRes, userRolesRes] = await Promise.all([
    serviceSupabase
      .from('organization_settings')
      .select('tenant_id, modules_enabled')
      .eq('tenant_id', organization.id)
      .maybeSingle<{ tenant_id: string; modules_enabled: string[] | null }>(),
    serviceSupabase
      .from('organization_storage_settings')
      .select('tenant_id, provider, connection_status, is_enabled, root_folder_url, display_name')
      .eq('tenant_id', organization.id)
      .maybeSingle<StorageRow>(),
    serviceSupabase
      .from('user_profiles')
      .select('id, user_id')
      .eq('tenant_id', organization.id)
      .order('created_at'),
    serviceSupabase
      .from('roles')
      .select('id, name')
      .eq('is_active', true),
    serviceSupabase
      .from('user_roles')
      .select('user_id, role_id')
      .eq('tenant_id', organization.id),
  ])

  const settings = settingsRes.data
  const storage = storageRes.data
  const profiles = (profilesRes.data ?? []) as UserProfileRow[]
  const roles = (rolesRes.data ?? []) as RoleRow[]
  const userRoles = (userRolesRes.data ?? []) as UserRoleRow[]

  const tenantAdminRoleIds = new Set(roles.filter(role => role.name === 'tenant_admin').map(role => role.id))
  const adminProfiles = profiles.filter(profile => (
    userRoles.some(role => role.user_id === profile.id && tenantAdminRoleIds.has(role.role_id))
  ))

  return (
    <div className="w-full space-y-6">
      <div className="section-card p-5">
        <div className="section-header">
          <div>
            <h1 className="section-title">Manage Tenant</h1>
            <p className="section-subtitle">
              Platform-level settings for {organization.name}.
            </p>
          </div>
          <Link href="/platform-admin" className="btn btn-ghost">
            Back to Tenant Administration
          </Link>
        </div>
      </div>

      <PlatformTenantSettingsForm
        tenantSlug={organization.slug}
        organizationId={organization.id}
        organizationSlug={organization.slug}
        initialOrganizationName={organization.name}
        initialPlan={organization.plan}
        initialModulesEnabled={settings?.modules_enabled ?? []}
      />

      <div className="section-card p-5">
        <div className="section-header">
          <div>
            <h2 className="section-title">Tenant Admins</h2>
            <p className="section-subtitle">Current tenant-scoped tenant_admin users.</p>
          </div>
        </div>

        {adminProfiles.length === 0 ? (
          <div className="empty-state">Tenant admin management will live here.</div>
        ) : (
          <TenantAdminsTable adminProfiles={adminProfiles} />
        )}
      </div>

      <div className="section-card p-5">
        <div className="section-header">
          <div>
            <h2 className="section-title">Integration Status</h2>
            <p className="section-subtitle">Read-only storage connector status for this tenant.</p>
          </div>
        </div>

        {storage ? (
          <div className="grid gap-4 md:grid-cols-3">
            <div>
              <div className="text-xs font-semibold uppercase tracking-wide text-gray-400">Provider</div>
              <div className="mt-1 text-sm text-gray-900">{storage.display_name ?? storage.provider ?? '—'}</div>
            </div>
            <div>
              <div className="text-xs font-semibold uppercase tracking-wide text-gray-400">Status</div>
              <div className="mt-1 text-sm text-gray-900">
                {storage.connection_status ?? '—'}
                {storage.is_enabled ? ' · Enabled' : ' · Disabled'}
              </div>
            </div>
            <div>
              <div className="text-xs font-semibold uppercase tracking-wide text-gray-400">Root Folder</div>
              {storage.root_folder_url ? (
                <a
                  href={storage.root_folder_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="action-link mt-1 inline-block"
                >
                  Open Root Folder
                </a>
              ) : (
                <div className="mt-1 text-sm text-gray-500">Storage is not configured.</div>
              )}
            </div>
          </div>
        ) : (
          <div className="empty-state">Storage is not configured.</div>
        )}
      </div>
    </div>
  )
}
