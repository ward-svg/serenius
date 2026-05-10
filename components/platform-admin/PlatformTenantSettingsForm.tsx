'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { SERENIUS_MODULES } from '@/lib/modules/registry'

interface Props {
  tenantSlug: string
  organizationId: string
  initialOrganizationName: string
  initialPlan: string | null
  organizationSlug: string
  initialModulesEnabled: string[]
}

const EDITABLE_MODULES = SERENIUS_MODULES.filter(module => module.enabledByDefault && !module.adminOnly)

export default function PlatformTenantSettingsForm({
  tenantSlug,
  organizationId,
  initialOrganizationName,
  organizationSlug,
  initialPlan,
  initialModulesEnabled,
}: Props) {
  const router = useRouter()
  const [organizationName, setOrganizationName] = useState(initialOrganizationName)
  const [plan, setPlan] = useState(initialPlan ?? '')
  const [selectedModules, setSelectedModules] = useState<string[]>(initialModulesEnabled)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const selectedCount = useMemo(() => selectedModules.length, [selectedModules])

  function toggleModule(key: string) {
    setSelectedModules(prev => (
      prev.includes(key)
        ? prev.filter(item => item !== key)
        : [...prev, key]
    ))
  }

  async function handleSave() {
    setSaving(true)
    setError(null)
    setSuccess(null)

    try {
      const response = await fetch(`/api/platform-admin/tenants/${encodeURIComponent(tenantSlug)}/settings`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          organizationId,
          organizationName: organizationName.trim(),
          plan: plan.trim(),
          modulesEnabled: selectedModules,
        }),
      })

      const payload = await response.json().catch(() => null) as
        | { ok?: boolean; error?: string; plan?: string | null; organization_name?: string; modules_enabled?: string[] }
        | null

      if (!response.ok || !payload?.ok) {
        throw new Error(payload?.error ?? 'Failed to save tenant settings.')
      }

      const nextOrganizationName = payload.organization_name ?? organizationName
      const nextPlan = payload.plan ?? ''
      const nextModules = payload.modules_enabled ?? selectedModules

      setOrganizationName(nextOrganizationName)
      setPlan(nextPlan)
      setSelectedModules(nextModules)
      setSuccess('Tenant settings saved.')
      router.refresh()
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Failed to save tenant settings.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="section-card p-5">
        <div className="section-header">
          <div>
            <h2 className="section-title">Tenant Identity</h2>
            <p className="section-subtitle">Basic provisioning details for this tenant.</p>
          </div>
        </div>

        <div className="mt-5 grid gap-4 md:grid-cols-3">
          <label className="space-y-1">
            <span className="block text-sm font-medium text-gray-700">Organization Name</span>
            <input
              type="text"
              value={organizationName}
              onChange={e => setOrganizationName(e.target.value)}
              className="form-input"
              placeholder="WellSpring Rescue Village"
            />
          </label>
          <label className="space-y-1">
            <span className="block text-sm font-medium text-gray-700">Slug</span>
            <input
              type="text"
              value={organizationSlug}
              className="form-input bg-gray-50 text-gray-500"
              readOnly
            />
            <p className="text-xs text-gray-400">Slug editing is not part of this slice.</p>
          </label>
          <label className="space-y-1">
            <span className="block text-sm font-medium text-gray-700">Plan</span>
            <input
              type="text"
              value={plan}
              onChange={e => setPlan(e.target.value)}
              className="form-input"
              placeholder="e.g. foundation, pro"
            />
          </label>
        </div>
      </div>

      <div className="section-card p-5 space-y-4">
        <div className="section-header">
          <div>
            <h2 className="section-title">Enabled Modules</h2>
            <p className="section-subtitle">Select the modules this tenant can access.</p>
          </div>
          <div className="section-count">{selectedCount} selected</div>
        </div>

        <div className="space-y-3">
          {EDITABLE_MODULES.map(module => {
            const isEnabled = selectedModules.includes(module.key)
            return (
              <label
                key={module.key}
                className={`flex items-start gap-3 rounded-lg border p-4 transition-colors ${
                  isEnabled
                    ? 'border-slate-300 bg-slate-50'
                    : 'border-gray-200 bg-white hover:bg-gray-50'
                }`}
              >
                <input
                  type="checkbox"
                  checked={isEnabled}
                  onChange={() => toggleModule(module.key)}
                  className="mt-1 h-4 w-4 rounded border-gray-300 text-slate-700 focus:ring-slate-500"
                />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium text-gray-900">{module.label}</span>
                    <span className="badge-neutral text-xs">{module.group}</span>
                  </div>
                  <p className="mt-1 text-sm text-gray-500">
                    {isEnabled ? 'Enabled for this tenant.' : 'Available for this tenant.'}
                  </p>
                </div>
              </label>
            )
          })}
        </div>

        {error && (
          <div className="empty-state" style={{ color: '#b91c1c' }}>
            {error}
          </div>
        )}

        {success && (
          <div className="empty-state" style={{ color: '#166534' }}>
            {success}
          </div>
        )}

        <div className="flex justify-end pt-2">
          <button
            type="button"
            className="btn btn-primary"
            onClick={handleSave}
            disabled={saving}
          >
            {saving ? 'Saving…' : 'Save Tenant Settings'}
          </button>
        </div>
      </div>
    </div>
  )
}
