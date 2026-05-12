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
}

interface OrganizationSettingsRow {
  tenant_id: string
  modules_enabled: string[] | null
}

interface Props {
  organizations: OrganizationRow[]
  settings: OrganizationSettingsRow[]
}

type SwitchTenantSortKey = 'organization' | 'slug' | 'plan' | 'modules'

export default function PlatformSwitchTenantTable({
  organizations,
  settings,
}: Props) {
  const [sort, setSort] = useState<SortState<SwitchTenantSortKey> | null>(null)
  const rows = useMemo(() => {
    return organizations.map(org => {
      const settingsRow = settings.find(setting => setting.tenant_id === org.id)

      return {
        org,
        modulesCount: settingsRow?.modules_enabled?.length ?? 0,
      }
    })
  }, [organizations, settings])
  const sortedRows = useMemo(
    () =>
      sortByValue(rows, sort, (row, key): SortValue => {
        switch (key) {
          case 'organization':
            return row.org.name
          case 'slug':
            return row.org.slug
          case 'plan':
            return row.org.plan
          case 'modules':
            return row.modulesCount
        }
      }),
    [rows, sort],
  )

  return (
    <div className="table-scroll">
      <table className="data-table">
        <thead>
          <tr>
            <th className="actions-column">ACTIONS</th>
            <SortableHeader
              label="Organization"
              sortKey="organization"
              sort={sort}
              onSort={(key) => setSort((current) => nextSortState(current, key))}
            />
            <SortableHeader
              label="Slug"
              sortKey="slug"
              sort={sort}
              onSort={(key) => setSort((current) => nextSortState(current, key))}
            />
            <SortableHeader
              label="Plan"
              sortKey="plan"
              sort={sort}
              onSort={(key) => setSort((current) => nextSortState(current, key))}
            />
            <SortableHeader
              label="Modules"
              sortKey="modules"
              sort={sort}
              onSort={(key) => setSort((current) => nextSortState(current, key))}
              align="right"
            />
          </tr>
        </thead>
        <tbody>
          {sortedRows.map(({ org, modulesCount }) => (
            <tr key={org.id}>
              <td className="actions-column">
                <Link href={`/${org.slug}/partners`} className="action-link">
                  Open
                </Link>
              </td>
              <td className="font-medium text-gray-900">{org.name}</td>
              <td className="text-gray-500">{org.slug}</td>
              <td className="text-gray-600">{org.plan ?? '—'}</td>
              <td className="text-gray-600">{modulesCount}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
