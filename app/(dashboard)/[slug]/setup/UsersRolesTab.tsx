'use client'

import { useEffect, useState, useCallback } from 'react'
import { createSupabaseBrowserClient } from '@/lib/supabase-browser'

// ─── Types ────────────────────────────────────────────────────────────────────

interface UserProfile {
  id: string
  user_id: string
  tenant_id: string | null
}

interface Role {
  id: string
  name: string
  description: string | null
  is_active: boolean
}

interface UserRole {
  id: string
  user_id: string
  role_id: string
}

interface UserWithRoles {
  profile: UserProfile
  email: string
  roles: Role[]
}

interface Props {
  tenantId: string
  isSuperAdmin: boolean
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function UsersRolesTab({ tenantId, isSuperAdmin }: Props) {
  const [users, setUsers]   = useState<UserWithRoles[]>([])
  const [roles, setRoles]   = useState<Role[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    const supabase = createSupabaseBrowserClient()
    setLoading(true)
    try {
      const [profilesRes, rolesRes, userRolesRes] = await Promise.all([
        supabase.from('user_profiles').select('*').eq('tenant_id', tenantId),
        supabase.from('roles').select('*').eq('is_active', true).order('name'),
        supabase.from('user_roles').select('*').eq('tenant_id', tenantId),
      ])

      const profiles: UserProfile[] = profilesRes.data ?? []
      const allRoles: Role[]        = rolesRes.data    ?? []
      const userRoles: UserRole[]   = userRolesRes.data ?? []

      setRoles(allRoles)

      const enriched: UserWithRoles[] = profiles.map(p => ({
        profile: p,
        email: p.user_id, // placeholder — auth.users not directly queryable
        roles: userRoles
          .filter(ur => ur.user_id === p.id)
          .map(ur => allRoles.find(r => r.id === ur.role_id))
          .filter((r): r is Role => !!r),
      }))

      setUsers(enriched)
    } finally {
      setLoading(false)
    }
  }, [tenantId])

  useEffect(() => { load() }, [load])

  if (loading) {
    return <div className="text-sm text-gray-400 py-8 text-center">Loading users…</div>
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-600">
          Manage users and role assignments for this organization.
        </p>
        <button
          disabled
          className="px-3 py-1.5 text-xs bg-blue-600 text-white rounded-md opacity-50 cursor-not-allowed"
          title="Coming soon"
        >
          + Invite User
        </button>
      </div>

      <div className="section-card p-0 overflow-hidden">
        <div className="px-4 py-3 bg-gray-50 border-b border-gray-200">
          <h3 className="text-sm font-semibold text-gray-700">Users ({users.length})</h3>
        </div>
        {users.length === 0 ? (
          <div className="py-12 text-center text-sm text-gray-400">
            No users found for this organization.
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100">
                <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wide">User ID</th>
                <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wide">Roles</th>
                <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wide">Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map(u => (
                <tr key={u.profile.id} className="border-b border-gray-50 hover:bg-gray-50">
                  <td className="px-4 py-2.5 font-mono text-xs text-gray-500">{u.profile.user_id}</td>
                  <td className="px-4 py-2.5">
                    <div className="flex flex-wrap gap-1">
                      {u.roles.length === 0
                        ? <span className="text-xs text-gray-400">No roles assigned</span>
                        : u.roles.map(r => (
                          <span key={r.id} className="badge-neutral text-xs">{r.name}</span>
                        ))
                      }
                    </div>
                  </td>
                  <td className="px-4 py-2.5">
                    <button disabled className="text-xs text-blue-400 cursor-not-allowed" title="Coming soon">
                      Edit Roles
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="panel bg-amber-50 border-amber-200">
        <p className="text-xs text-amber-700">
          <strong>Coming soon:</strong> Invite users by email, edit role assignments, and manage user access directly from this screen.
          User email lookup requires a Supabase admin function — planned for the next infrastructure chat.
        </p>
      </div>

      {/* All available roles — reference */}
      <div className="section-card">
        <h3 className="text-sm font-semibold text-gray-700 mb-3">Available Roles</h3>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
          {roles.map(r => (
            <div key={r.id} className="flex items-start gap-2 p-2 rounded border border-gray-100 bg-gray-50">
              <div>
                <p className="text-xs font-medium text-gray-800">{r.name}</p>
                {r.description && <p className="text-xs text-gray-400">{r.description}</p>}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
