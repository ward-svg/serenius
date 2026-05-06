'use client'

import { useEffect, useState, useCallback } from 'react'
import { createSupabaseBrowserClient } from '@/lib/supabase-browser'

// ─── Types ────────────────────────────────────────────────────────────────────

interface Props {
  tenantId: string
  isSuperAdmin: boolean
}

const ALL_MODULES = [
  { id: 'partners',       label: 'Partners & Donors',    description: 'Donor management, pledges, financial gifts, statements.' },
  { id: 'banking',        label: 'Banking & Finance',    description: 'Bank accounts, deposits, transactions, GL reporting.' },
  { id: 'resident_care',  label: 'Resident Care',        description: 'Resident records, houses, care tracking.' },
  { id: 'family_connect', label: 'Family Connect',       description: 'Family communication and engagement tools.' },
  { id: 'mission_trips',  label: 'Mission Trips',        description: 'Trip planning, member management, fundraising.' },
  { id: 'communications', label: 'Communications',       description: 'Email campaigns, messaging, open tracking.' },
  { id: 'in_kind_assets', label: 'In-Kind & Assets',     description: 'Non-cash gift tracking and asset management.' },
  { id: 'empowerment',    label: 'Empowerment Program',  description: 'Girls empowerment program tracking and reporting.' },
]

// ─── Component ────────────────────────────────────────────────────────────────

export default function ModulesTab({ tenantId, isSuperAdmin }: Props) {
  const [enabled, setEnabled]     = useState<string[]>([])
  const [settingsId, setSettingsId] = useState<string | null>(null)
  const [loading, setLoading]     = useState(true)
  const [saving, setSaving]       = useState(false)
  const [saved, setSaved]         = useState(false)

  const load = useCallback(async () => {
    const supabase = createSupabaseBrowserClient()
    setLoading(true)
    const { data } = await supabase
      .from('organization_settings')
      .select('id, modules_enabled')
      .eq('tenant_id', tenantId)
      .single()
    if (data) {
      setSettingsId(data.id)
      setEnabled(Array.isArray(data.modules_enabled) ? data.modules_enabled : [])
    }
    setLoading(false)
  }, [tenantId])

  useEffect(() => { load() }, [load])

  function toggle(moduleId: string) {
    if (!isSuperAdmin) return
    setEnabled(prev =>
      prev.includes(moduleId) ? prev.filter(m => m !== moduleId) : [...prev, moduleId]
    )
  }

  async function handleSave() {
    if (!settingsId || !isSuperAdmin) return
    const supabase = createSupabaseBrowserClient()
    setSaving(true)
    const { error } = await supabase
      .from('organization_settings')
      .update({ modules_enabled: enabled })
      .eq('id', settingsId)
    if (!error) {
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    }
    setSaving(false)
  }

  if (loading) {
    return <div className="text-sm text-gray-400 py-8 text-center">Loading modules…</div>
  }

  return (
    <div className="space-y-4">

      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-gray-600">
            Control which modules are available to this organization.
          </p>
          {!isSuperAdmin && (
            <p className="text-xs text-amber-600 mt-1">
              Module access is managed by Serenius support. Contact us to enable or disable modules.
            </p>
          )}
        </div>
        {isSuperAdmin && (
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-4 py-1.5 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
          >
            {saving ? 'Saving…' : saved ? 'Saved ✓' : 'Save Module Settings'}
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {ALL_MODULES.map(mod => {
          const isEnabled = enabled.includes(mod.id)
          return (
            <div
              key={mod.id}
              onClick={() => toggle(mod.id)}
              className={`section-card flex items-start gap-3 transition-all
                ${isSuperAdmin ? 'cursor-pointer hover:border-blue-300' : 'cursor-default'}
                ${isEnabled ? 'border-blue-200 bg-blue-50/30' : ''}
              `}
            >
              <div className={`mt-0.5 w-4 h-4 rounded border-2 flex items-center justify-center flex-shrink-0
                ${isEnabled ? 'bg-blue-600 border-blue-600' : 'border-gray-300 bg-white'}
              `}>
                {isEnabled && (
                  <svg className="w-2.5 h-2.5 text-white" viewBox="0 0 10 10" fill="none">
                    <path d="M1.5 5L4 7.5L8.5 2.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                )}
              </div>
              <div>
                <p className={`text-sm font-medium ${isEnabled ? 'text-gray-900' : 'text-gray-500'}`}>
                  {mod.label}
                </p>
                <p className="text-xs text-gray-400 mt-0.5">{mod.description}</p>
              </div>
            </div>
          )
        })}
      </div>

    </div>
  )
}
