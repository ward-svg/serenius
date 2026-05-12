'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import SortableHeader from '@/components/ui/SortableHeader'
import {
  nextSortState,
  sortByValue,
  type SortState,
  type SortValue,
} from '@/lib/ui/sort'

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

interface Props {
  organizations: OrganizationRow[]
  organizationSettings: OrganizationSettingsRow[]
  organizationStorageSettings: OrganizationStorageRow[]
  platformUsersCount: number
}

type TenantSortKey = 'organization' | 'slug' | 'plan' | 'modules' | 'storage' | 'status'

function countBy<T extends string>(values: T[]) {
  return values.reduce((map, value) => {
    map.set(value, (map.get(value) ?? 0) + 1)
    return map
  }, new Map<T, number>())
}

function getStorageStatus(storage: OrganizationStorageRow | undefined): string {
  if (storage?.provider === 'google_drive') {
    if (storage.connection_status === 'connected' && storage.is_enabled) {
      return 'Connected'
    }

    return storage.is_enabled ? 'Manual' : 'Disabled'
  }

  if (storage?.provider) return `Unsupported · ${storage.provider}`

  return 'Not configured'
}

export default function PlatformAdminDashboard({
  organizations,
  organizationSettings,
  organizationStorageSettings,
  platformUsersCount,
}: Props) {
  const [tenantSort, setTenantSort] = useState<SortState<TenantSortKey> | null>(null)
  const activeTenants = organizations.filter(org => org.is_active).length
  const inactiveTenants = organizations.length - activeTenants
  const plansInUse = new Set(
    organizations
      .map(org => org.plan?.trim())
      .filter((plan): plan is string => Boolean(plan)),
  ).size
  const modulesEnabledTotal = organizationSettings.reduce(
    (sum, settings) => sum + (settings.modules_enabled?.length ?? 0),
    0,
  )
  const connectedStorageCount = organizationStorageSettings.filter(
    setting => setting.provider === 'google_drive' && setting.connection_status === 'connected' && setting.is_enabled,
  ).length
  const disabledStorageCount = organizationStorageSettings.filter(
    setting => setting.provider === 'google_drive' && (!setting.is_enabled || setting.connection_status === 'disabled'),
  ).length
  const unsupportedStorageCount = organizationStorageSettings.filter(
    setting => setting.provider && setting.provider !== 'google_drive',
  ).length

  const planCounts = countBy(
    organizations.map(org => org.plan?.trim() || 'Unassigned'),
  )
  const tenantRows = useMemo(() => {
    return organizations.map(org => {
      const settings = organizationSettings.find(setting => setting.tenant_id === org.id)
      const storage = organizationStorageSettings.find(setting => setting.tenant_id === org.id)

      return {
        org,
        modulesEnabled: settings?.modules_enabled?.length ?? 0,
        storageStatus: getStorageStatus(storage),
      }
    })
  }, [organizationSettings, organizationStorageSettings, organizations])
  const sortedTenantRows = useMemo(() => {
    return sortByValue(tenantRows, tenantSort, (row, key): SortValue => {
      switch (key) {
        case 'organization':
          return row.org.name
        case 'slug':
          return row.org.slug
        case 'plan':
          return row.org.plan
        case 'modules':
          return row.modulesEnabled
        case 'storage':
          return row.storageStatus
        case 'status':
          return row.org.is_active
      }
    })
  }, [tenantRows, tenantSort])

  return (
    <div className="space-y-6">
      <div className="section-card p-5">
        <div className="section-header">
          <div>
            <h1 className="section-title">Tenant Administration</h1>
            <p className="section-subtitle">
              Serenius-level management for superadmins. Tenant Setup stays separate.
            </p>
          </div>
          <Link
            href="/platform-admin/create"
            className="btn btn-primary btn-sm"
          >
            Create Tenant
          </Link>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <div className="section-card p-4">
          <div className="text-xs font-semibold uppercase tracking-wide text-gray-400">Tenants</div>
          <div className="mt-2 text-3xl font-semibold text-gray-900">{organizations.length}</div>
          <div className="mt-1 text-xs text-gray-500">
            Active {activeTenants} · Inactive {inactiveTenants}
          </div>
        </div>
        <div className="section-card p-4">
          <div className="text-xs font-semibold uppercase tracking-wide text-gray-400">Platform Users</div>
          <div className="mt-2 text-3xl font-semibold text-gray-900">{platformUsersCount}</div>
          <div className="mt-1 text-xs text-gray-500">
            Tenant-scoped user profiles
          </div>
        </div>
        <div className="section-card p-4">
          <div className="text-xs font-semibold uppercase tracking-wide text-gray-400">Plans &amp; Modules</div>
          <div className="mt-2 text-3xl font-semibold text-gray-900">{plansInUse}</div>
          <div className="mt-1 text-xs text-gray-500">
            {modulesEnabledTotal} enabled module assignments
          </div>
        </div>
        <div className="section-card p-4">
          <div className="text-xs font-semibold uppercase tracking-wide text-gray-400">Integration Health</div>
          <div className="mt-2 text-3xl font-semibold text-gray-900">{connectedStorageCount}</div>
          <div className="mt-1 text-xs text-gray-500">
            Connected storage · {disabledStorageCount} disabled · {unsupportedStorageCount} unsupported
          </div>
        </div>
      </div>

      <div className="section-card p-0 overflow-hidden">
        <div className="section-header px-4 py-3 border-b border-gray-200 bg-gray-50">
          <div>
            <h2 className="section-title">Tenants</h2>
            <p className="section-subtitle">Organization list and current configuration snapshot.</p>
          </div>
          <div className="section-count">{organizations.length}</div>
        </div>

        {organizations.length === 0 ? (
          <div className="empty-state">No tenants found.</div>
        ) : (
          <div className="table-scroll">
            <table className="data-table">
              <thead>
                <tr>
                  <th className="actions-column">ACTIONS</th>
                  <SortableHeader
                    label="Organization"
                    sortKey="organization"
                    sort={tenantSort}
                    onSort={(key) => setTenantSort((current) => nextSortState(current, key))}
                  />
                  <SortableHeader
                    label="Slug"
                    sortKey="slug"
                    sort={tenantSort}
                    onSort={(key) => setTenantSort((current) => nextSortState(current, key))}
                  />
                  <SortableHeader
                    label="Plan"
                    sortKey="plan"
                    sort={tenantSort}
                    onSort={(key) => setTenantSort((current) => nextSortState(current, key))}
                  />
                  <SortableHeader
                    label="Modules"
                    sortKey="modules"
                    sort={tenantSort}
                    onSort={(key) => setTenantSort((current) => nextSortState(current, key))}
                    align="right"
                  />
                  <SortableHeader
                    label="Storage"
                    sortKey="storage"
                    sort={tenantSort}
                    onSort={(key) => setTenantSort((current) => nextSortState(current, key))}
                  />
                  <SortableHeader
                    label="Status"
                    sortKey="status"
                    sort={tenantSort}
                    onSort={(key) => setTenantSort((current) => nextSortState(current, key))}
                  />
                </tr>
              </thead>
              <tbody>
                {sortedTenantRows.map(({ org, modulesEnabled, storageStatus }) => {
                  return (
                    <tr key={org.id}>
                      <td className="actions-column">
                        <Link href={`/${org.slug}/partners`} className="action-link">
                          Open
                        </Link>
                        <Link href={`/platform-admin/tenants/${org.slug}`} className="action-link ml-3">
                          Manage
                        </Link>
                      </td>
                      <td className="font-medium text-gray-900">{org.name}</td>
                      <td className="text-gray-500">{org.slug}</td>
                      <td className="text-gray-600">{org.plan ?? '—'}</td>
                      <td className="text-gray-600">{modulesEnabled}</td>
                      <td className="text-gray-600">{storageStatus}</td>
                      <td>
                        <span
                          className={`badge-neutral ${org.is_active ? '' : 'opacity-70'}`}
                        >
                          {org.is_active ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="section-card p-4">
          <div className="section-header">
            <div>
              <h2 className="section-title">Platform Users</h2>
              <p className="section-subtitle">Invite and role editing will live here later.</p>
            </div>
          </div>
          <div className="mt-2 text-3xl font-semibold text-gray-900">{platformUsersCount}</div>
          <p className="mt-1 text-sm text-gray-500">
            Tenant-scoped user profiles are available for reference only in this slice.
          </p>
        </div>

        <div className="section-card p-4">
          <div className="section-header">
            <div>
              <h2 className="section-title">Plans &amp; Modules</h2>
              <p className="section-subtitle">Read-only inventory of current plan values and enabled modules.</p>
            </div>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            {Array.from(planCounts.entries()).length === 0 ? (
              <span className="text-sm text-gray-400">No plans configured.</span>
            ) : (
              Array.from(planCounts.entries()).map(([plan, count]) => (
                <span key={plan} className="badge-neutral">
                  {plan} · {count}
                </span>
              ))
            )}
          </div>
          <p className="mt-3 text-sm text-gray-500">
            {modulesEnabledTotal} enabled module assignments across {organizationSettings.length} settings rows.
          </p>
        </div>

        <div className="section-card p-4">
          <div className="section-header">
            <div>
              <h2 className="section-title">Integration Health</h2>
              <p className="section-subtitle">Storage connector status across organizations.</p>
            </div>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <span className="badge-neutral">Connected · {connectedStorageCount}</span>
            <span className="badge-neutral">Disabled · {disabledStorageCount}</span>
            <span className="badge-neutral">Unsupported · {unsupportedStorageCount}</span>
          </div>
          <p className="mt-3 text-sm text-gray-500">
            Google Drive storage is the only active connector in this foundation slice.
          </p>
        </div>
      </div>
    </div>
  )
}
