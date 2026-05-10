'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'

function slugify(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

export default function PlatformTenantCreateForm() {
  const router = useRouter()
  const [organizationName, setOrganizationName] = useState('')
  const [slug, setSlug] = useState('')
  const [plan, setPlan] = useState('')
  const [initialTenantAdminFullName, setInitialTenantAdminFullName] = useState('')
  const [initialTenantAdminEmail, setInitialTenantAdminEmail] = useState('')
  const [slugTouched, setSlugTouched] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const suggestedSlug = useMemo(() => slugify(organizationName), [organizationName])

  function handleNameChange(value: string) {
    setOrganizationName(value)
    if (!slugTouched) {
      setSlug(slugify(value))
    }
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setSaving(true)
    setError(null)

    try {
      const response = await fetch('/api/platform-admin/tenants', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          organizationName,
          slug,
          plan,
          initialTenantAdminFullName,
          initialTenantAdminEmail,
        }),
      })

      const payload = await response.json().catch(() => null) as
        | { error?: string; tenantSlug?: string }
        | null

      if (!response.ok) {
        setError(payload?.error ?? 'Failed to create tenant.')
        return
      }

      router.push(`/${payload?.tenantSlug ?? slug}/setup`)
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create tenant.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid gap-4 md:grid-cols-2">
        <label className="space-y-1">
          <span className="block text-sm font-medium text-gray-700">Organization Name</span>
          <input
            type="text"
            value={organizationName}
            onChange={e => handleNameChange(e.target.value)}
            className="form-input"
            placeholder="WellSpring Rescue Village"
            required
          />
        </label>

        <label className="space-y-1">
          <span className="block text-sm font-medium text-gray-700">Slug</span>
          <input
            type="text"
            value={slug}
            onChange={e => {
              setSlugTouched(true)
              setSlug(slugify(e.target.value))
            }}
            className="form-input"
            placeholder={suggestedSlug || 'wellspring'}
            required
          />
          <p className="text-xs text-gray-400">Will be normalized to a lowercase URL-safe slug.</p>
        </label>
      </div>

      <label className="space-y-1 block">
        <span className="block text-sm font-medium text-gray-700">Plan</span>
        <input
          type="text"
          value={plan}
          onChange={e => setPlan(e.target.value)}
          className="form-input"
          placeholder="Foundation"
        />
      </label>

      <div className="grid gap-4 md:grid-cols-2">
        <label className="space-y-1">
          <span className="block text-sm font-medium text-gray-700">Initial Tenant Admin Full Name</span>
          <input
            type="text"
            value={initialTenantAdminFullName}
            onChange={e => setInitialTenantAdminFullName(e.target.value)}
            className="form-input"
            placeholder="Ward McMillen"
            required
          />
        </label>

        <label className="space-y-1">
          <span className="block text-sm font-medium text-gray-700">Initial Tenant Admin Email</span>
          <input
            type="email"
            value={initialTenantAdminEmail}
            onChange={e => setInitialTenantAdminEmail(e.target.value)}
            className="form-input"
            placeholder="ward@wsrv.org"
            required
          />
        </label>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="flex items-center justify-end gap-3">
        <button
          type="button"
          className="btn btn-ghost"
          onClick={() => router.push('/platform-admin')}
          disabled={saving}
        >
          Cancel
        </button>
        <button
          type="submit"
          className="btn btn-primary"
          disabled={saving}
        >
          {saving ? 'Creating…' : 'Create Tenant'}
        </button>
      </div>
    </form>
  )
}
