import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createSupabaseServerClient } from '@/lib/supabase-server'
import { createSupabaseServiceClient } from '@/lib/supabase-service'
import PlatformSwitchTenantTable from '@/components/platform-admin/PlatformSwitchTenantTable'

export const revalidate = 0

interface OrganizationRow {
  id: string
  name: string
  slug: string
  plan: string | null
}

interface OrganizationSettingsRow {
  tenant_id: string
  modules_enabled: string[] | null
}

function getSearchParamValue(value: string | string[] | undefined, fallback = '') {
  if (Array.isArray(value)) return value[0] ?? fallback
  return value ?? fallback
}

export default async function SwitchTenantPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>
}) {
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

  const resolvedSearchParams = searchParams ? await searchParams : {}
  const search = getSearchParamValue(resolvedSearchParams.q).trim().toLowerCase()

  const serviceSupabase = createSupabaseServiceClient()
  const [{ data: organizationsData }, { data: settingsData }] = await Promise.all([
    serviceSupabase
      .from('organizations')
      .select('id, name, slug, plan')
      .order('name'),
    serviceSupabase
      .from('organization_settings')
      .select('tenant_id, modules_enabled'),
  ])

  const organizations = (organizationsData ?? []) as OrganizationRow[]
  const settings = (settingsData ?? []) as OrganizationSettingsRow[]

  const filteredOrganizations = organizations.filter(org => {
    if (!search) return true
    return org.name.toLowerCase().includes(search) || org.slug.toLowerCase().includes(search)
  })

  return (
    <div className="space-y-6">
      <div className="section-card p-5">
        <div className="section-header">
          <div>
            <h1 className="section-title">Switch Tenant</h1>
            <p className="section-subtitle">Tenant switching will live here.</p>
          </div>
          <Link href="/platform-admin" className="btn btn-ghost btn-sm">
            Back to Tenant Administration
          </Link>
        </div>
      </div>

      <div className="section-card p-4">
        <form method="get" className="flex gap-3">
          <input
            type="search"
            name="q"
            defaultValue={search}
            placeholder="Search tenants by name or slug"
            className="form-input flex-1"
          />
          <button type="submit" className="btn btn-ghost">
            Search
          </button>
        </form>
      </div>

      <div className="section-card p-0 overflow-hidden">
        <div className="section-header px-4 py-3 border-b border-gray-200 bg-gray-50">
          <div>
            <h2 className="section-title">Tenants</h2>
            <p className="section-subtitle">Open a tenant to jump into its dashboard shell.</p>
          </div>
          <div className="section-count">{filteredOrganizations.length}</div>
        </div>

        {filteredOrganizations.length === 0 ? (
          <div className="empty-state">No tenants found.</div>
        ) : (
          <PlatformSwitchTenantTable
            organizations={filteredOrganizations}
            settings={settings}
          />
        )}
      </div>
    </div>
  )
}
