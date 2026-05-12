'use client'

import { useMemo, useState } from 'react'
import SortableHeader from '@/components/ui/SortableHeader'
import {
  nextSortState,
  sortByValue,
  type SortState,
  type SortValue,
} from '@/lib/ui/sort'

interface UserProfileRow {
  id: string
  user_id: string
}

interface Props {
  adminProfiles: UserProfileRow[]
}

type TenantAdminSortKey = 'profileId' | 'userId'

export default function TenantAdminsTable({ adminProfiles }: Props) {
  const [sort, setSort] = useState<SortState<TenantAdminSortKey> | null>(null)
  const sortedProfiles = useMemo(
    () =>
      sortByValue(adminProfiles, sort, (profile, key): SortValue => {
        switch (key) {
          case 'profileId':
            return profile.id
          case 'userId':
            return profile.user_id
        }
      }),
    [adminProfiles, sort],
  )

  return (
    <div className="table-scroll">
      <table className="data-table">
        <thead>
          <tr>
            <th className="actions-column">ACTIONS</th>
            <SortableHeader
              label="Profile ID"
              sortKey="profileId"
              sort={sort}
              onSort={(key) => setSort((current) => nextSortState(current, key))}
            />
            <SortableHeader
              label="User ID"
              sortKey="userId"
              sort={sort}
              onSort={(key) => setSort((current) => nextSortState(current, key))}
            />
          </tr>
        </thead>
        <tbody>
          {sortedProfiles.map(profile => (
            <tr key={profile.id}>
              <td className="actions-column">
                <span className="action-link cursor-default opacity-60">View</span>
              </td>
              <td className="font-mono text-xs text-gray-600">{profile.id}</td>
              <td className="font-mono text-xs text-gray-500">{profile.user_id}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
