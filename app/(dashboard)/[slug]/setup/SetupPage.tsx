'use client'

import { useEffect, useState, useCallback } from 'react'
import { createSupabaseBrowserClient } from '@/lib/supabase-browser'
import ChartOfAccountsTab from './ChartOfAccountsTab'
import GiftCategoriesTab from './GiftCategoriesTab'
import UsersRolesTab from './UsersRolesTab'
import ModulesTab from './ModulesTab'

// ─── Types ────────────────────────────────────────────────────────────────────

interface Organization {
  id: string
  name: string
  slug: string
  plan: string | null
}

interface OrganizationBranding {
  id: string
  primary_color: string | null
  secondary_color: string | null
  accent_color: string | null
  logo_url: string | null
}

interface OrganizationSettings {
  id: string
  timezone: string
  date_format: string
  currency: string
  fiscal_year_start: string
  modules_enabled: string[]
  max_users: number
  storage_limit_gb: number
  google_maps_api_key: string | null
  serenius_api_key: string | null
  serenius_api_key_generated_at: string | null
}

interface OrganizationMail {
  id: string
  from_name: string | null
  from_email: string | null
  reply_to: string | null
}

type Tab = 'organization' | 'chart-of-accounts' | 'gift-categories' | 'users-roles' | 'modules'

// ─── Constants ────────────────────────────────────────────────────────────────

const TABS: { id: Tab; label: string }[] = [
  { id: 'organization',      label: 'Organization'       },
  { id: 'chart-of-accounts', label: 'Chart of Accounts'  },
  { id: 'gift-categories',   label: 'Gift Categories'    },
  { id: 'users-roles',       label: 'Users & Roles'      },
  { id: 'modules',           label: 'Modules'            },
]

const TIMEZONES = [
  'America/New_York', 'America/Chicago', 'America/Denver',
  'America/Los_Angeles', 'America/Anchorage', 'Pacific/Honolulu',
  'America/Puerto_Rico', 'UTC',
]

const DATE_FORMATS = ['MM/DD/YYYY', 'DD/MM/YYYY', 'YYYY-MM-DD']

const CURRENCIES = ['USD', 'CAD', 'EUR', 'GBP', 'ZMW']

const FISCAL_YEAR_STARTS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

// ─── Component ────────────────────────────────────────────────────────────────

export default function SetupPage({ tenantSlug }: { tenantSlug: string }) {
  // Access control
  const [authorized, setAuthorized]   = useState<boolean | null>(null)
  const [isSuperAdmin, setIsSuperAdmin] = useState(false)

  // Data
  const [org, setOrg]               = useState<Organization | null>(null)
  const [branding, setBranding]     = useState<OrganizationBranding | null>(null)
  const [settings, setSettings]     = useState<OrganizationSettings | null>(null)
  const [mail, setMail]             = useState<OrganizationMail | null>(null)

  // UI state
  const [activeTab, setActiveTab]   = useState<Tab>('organization')
  const [loading, setLoading]       = useState(true)
  const [saving, setSaving]         = useState(false)
  const [saveError, setSaveError]   = useState<string | null>(null)
  const [saveSuccess, setSaveSuccess] = useState(false)

  // API key reveal toggles
  const [showMapsKey, setShowMapsKey]         = useState(false)
  const [showSereniusKey, setShowSereniusKey] = useState(false)

  // Form state (org tab)
  const [orgForm, setOrgForm]         = useState({ name: '', plan: '' })
  const [brandForm, setBrandForm]     = useState({
    primary_color: '#3D5A80',
    secondary_color: '#98C1D9',
    accent_color: '#EE6C4D',
    logo_url: '',
  })
  const [settingsForm, setSettingsForm] = useState({
    timezone: 'America/New_York',
    date_format: 'MM/DD/YYYY',
    currency: 'USD',
    fiscal_year_start: 'January',
    google_maps_api_key: '',
    serenius_api_key: '',
  })
  const [mailForm, setMailForm]       = useState({ from_name: '', from_email: '', reply_to: '' })

  // ── Auth check ──────────────────────────────────────────────────────────────

  useEffect(() => {
    async function checkAccess() {
      const supabase = createSupabaseBrowserClient()
      const [superRes, adminRes] = await Promise.all([
        supabase.rpc('has_role', { role_name: 'superadmin' }),
        supabase.rpc('has_role', { role_name: 'tenant_admin' }),
      ])
      console.log('[SetupPage] has_role superadmin:', superRes.data, superRes.error)
      console.log('[SetupPage] has_role tenant_admin:', adminRes.data, adminRes.error)
      const isSA = superRes.data === true
      const isTA = adminRes.data === true
      setIsSuperAdmin(isSA)
      setAuthorized(isSA || isTA)
    }
    checkAccess()
  }, [])

  // ── Data load ───────────────────────────────────────────────────────────────

  const loadData = useCallback(async () => {
    const supabase = createSupabaseBrowserClient()
    setLoading(true)
    try {
      const { data: orgData } = await supabase
        .from('organizations')
        .select('*')
        .eq('slug', tenantSlug)
        .single()

      if (!orgData) return
      setOrg(orgData)
      setOrgForm({ name: orgData.name, plan: orgData.plan ?? '' })

      const [brandRes, settingsRes, mailRes] = await Promise.all([
        supabase.from('organization_branding').select('*').eq('tenant_id', orgData.id).maybeSingle(),
        supabase.from('organization_settings').select('*').eq('tenant_id', orgData.id).maybeSingle(),
        supabase.from('organization_mail').select('*').eq('tenant_id', orgData.id).maybeSingle(),
      ])

      if (brandRes.data) {
        setBranding(brandRes.data)
        setBrandForm({
          primary_color:   brandRes.data.primary_color   ?? '#3D5A80',
          secondary_color: brandRes.data.secondary_color ?? '#98C1D9',
          accent_color:    brandRes.data.accent_color    ?? '#EE6C4D',
          logo_url:        brandRes.data.logo_url        ?? '',
        })
      }

      if (settingsRes.data) {
        setSettings(settingsRes.data)
        setSettingsForm({
          timezone:            settingsRes.data.timezone            ?? 'America/New_York',
          date_format:         settingsRes.data.date_format         ?? 'MM/DD/YYYY',
          currency:            settingsRes.data.currency            ?? 'USD',
          fiscal_year_start:   settingsRes.data.fiscal_year_start   ?? 'January',
          google_maps_api_key: settingsRes.data.google_maps_api_key ?? '',
          serenius_api_key:    settingsRes.data.serenius_api_key    ?? '',
        })
      }

      if (mailRes.data) {
        setMail(mailRes.data)
        setMailForm({
          from_name:  mailRes.data.from_name  ?? '',
          from_email: mailRes.data.from_email ?? '',
          reply_to:   mailRes.data.reply_to   ?? '',
        })
      }
    } finally {
      setLoading(false)
    }
  }, [tenantSlug])

  useEffect(() => {
    if (authorized) loadData()
  }, [authorized, loadData])

  // ── Save helpers ────────────────────────────────────────────────────────────

  async function saveOrganizationBranding(tenantId: string) {
    const supabase = createSupabaseBrowserClient()

    const { error } = await supabase
      .from('organization_branding')
      .update({
        primary_color: brandForm.primary_color,
        secondary_color: brandForm.secondary_color,
        accent_color: brandForm.accent_color,
        logo_url: brandForm.logo_url || null,
      })
      .eq('tenant_id', tenantId)

    return error
  }

  async function saveOrganizationSettings(tenantId: string) {
    const supabase = createSupabaseBrowserClient()

    const { error } = await supabase
      .from('organization_settings')
      .update({
        timezone: settingsForm.timezone,
        date_format: settingsForm.date_format,
        currency: settingsForm.currency,
        fiscal_year_start: settingsForm.fiscal_year_start,
        google_maps_api_key: settingsForm.google_maps_api_key || null,
      })
      .eq('tenant_id', tenantId)

    return error
  }

  async function saveOrganizationMail(tenantId: string) {
    const supabase = createSupabaseBrowserClient()

    const { error } = await supabase
      .from('organization_mail')
      .update({
        from_name: mailForm.from_name || null,
        from_email: mailForm.from_email || null,
        reply_to: mailForm.reply_to || null,
      })
      .eq('tenant_id', tenantId)

    return error
  }

  // ── Save ────────────────────────────────────────────────────────────────────

  async function handleSaveOrg() {
    if (!org) return

    const supabase = createSupabaseBrowserClient()
    setSaving(true)
    setSaveError(null)
    setSaveSuccess(false)

    try {
      const orgRes = await supabase
        .from('organizations')
        .update({
          name: orgForm.name,
          plan: orgForm.plan || null,
        })
        .eq('id', org.id)

      const [brandError, settingsError, mailError] = await Promise.all([
        saveOrganizationBranding(org.id),
        saveOrganizationSettings(org.id),
        saveOrganizationMail(org.id),
      ])

      const errors = [
        orgRes.error ? { section: 'Organization', error: orgRes.error } : null,
        brandError ? { section: 'Branding', error: brandError } : null,
        settingsError ? { section: 'Settings', error: settingsError } : null,
        mailError ? { section: 'Mail', error: mailError } : null,
      ].filter(Boolean) as { section: string; error: { message?: string } }[]

      if (errors.length > 0) {
        console.error('[SetupPage] save errors:', errors)
        setSaveError(
          `Failed to save ${errors.map(e => e.section).join(', ')}. Check console for details.`
        )
      } else {
        setSaveSuccess(true)
        setTimeout(() => setSaveSuccess(false), 3000)
        loadData()
      }
    } catch (error) {
      console.error('[SetupPage] unexpected save error:', error)
      setSaveError('Unexpected error. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  async function handleGenerateApiKey() {
    if (!org) return
    const supabase = createSupabaseBrowserClient()
    const newKey = 'srn_' + Array.from(crypto.getRandomValues(new Uint8Array(24)))
      .map(b => b.toString(16).padStart(2, '0')).join('')
    const now = new Date().toISOString()

    const { error } = await supabase
      .from('organization_settings')
      .update({ serenius_api_key: newKey, serenius_api_key_generated_at: now })
      .eq('tenant_id', org.id)

    if (!error) {
      setSettingsForm(f => ({ ...f, serenius_api_key: newKey }))
      setSettings(s => s ? { ...s, serenius_api_key: newKey, serenius_api_key_generated_at: now } : s)
      setShowSereniusKey(true)
    }
  }

  function copyToClipboard(value: string) {
    navigator.clipboard.writeText(value)
  }

  // ── Render guards ───────────────────────────────────────────────────────────

  if (authorized === null || loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-400 text-sm">Loading setup…</div>
      </div>
    )
  }

  if (authorized === false) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <p className="text-gray-500 text-sm">You don't have permission to access Setup.</p>
          <p className="text-gray-400 text-xs mt-1">Contact your administrator.</p>
        </div>
      </div>
    )
  }

  // ── Main render ─────────────────────────────────────────────────────────────

  return (
    <div>

      {/* Page Header */}
      <div className="page-header mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Setup &amp; Configuration</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Manage organization settings, chart of accounts, and system configuration
          </p>
        </div>
      </div>

      {/* Tab Bar */}
      <div className="border-b border-gray-200 mb-6">
        <nav className="flex gap-1 -mb-px">
          {TABS.map(t => (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id)}
              className={`tab ${activeTab === t.id ? 'tab-active' : ''}`}
            >
              {t.label}
            </button>
          ))}
        </nav>
      </div>

      {/* ── Organization Tab ──────────────────────────────────────────────── */}
      {activeTab === 'organization' && (
        <div className="space-y-6">

          {/* Organization Identity */}
          <div className="section-card p-6">
            <h2 className="text-base font-semibold text-gray-800 mb-4">Organization Identity</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Organization Name
                </label>
                <input
                  type="text"
                  value={orgForm.name}
                  onChange={e => setOrgForm(f => ({ ...f, name: e.target.value }))}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  URL Slug
                </label>
                <input
                  type="text"
                  value={org?.slug ?? ''}
                  disabled
                  className="w-full border border-gray-200 rounded-md px-3 py-2 text-sm bg-gray-50 text-gray-400 cursor-not-allowed"
                />
                <p className="text-xs text-gray-400 mt-1">Contact Serenius support to change your slug.</p>
              </div>
              {isSuperAdmin && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Plan
                    <span className="ml-1 badge-info text-xs">Superadmin only</span>
                  </label>
                  <input
                    type="text"
                    value={orgForm.plan}
                    onChange={e => setOrgForm(f => ({ ...f, plan: e.target.value }))}
                    className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="e.g. pro, free"
                  />
                </div>
              )}
            </div>
          </div>

          {/* Branding */}
          <div className="section-card p-6">
            <h2 className="text-base font-semibold text-gray-800 mb-4">Branding</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Primary Color</label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={brandForm.primary_color}
                    onChange={e => setBrandForm(f => ({ ...f, primary_color: e.target.value }))}
                    className="h-9 w-14 rounded border border-gray-300 cursor-pointer p-0.5"
                  />
                  <input
                    type="text"
                    value={brandForm.primary_color}
                    onChange={e => setBrandForm(f => ({ ...f, primary_color: e.target.value }))}
                    className="flex-1 border border-gray-300 rounded-md px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="#3D5A80"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Secondary Color</label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={brandForm.secondary_color}
                    onChange={e => setBrandForm(f => ({ ...f, secondary_color: e.target.value }))}
                    className="h-9 w-14 rounded border border-gray-300 cursor-pointer p-0.5"
                  />
                  <input
                    type="text"
                    value={brandForm.secondary_color}
                    onChange={e => setBrandForm(f => ({ ...f, secondary_color: e.target.value }))}
                    className="flex-1 border border-gray-300 rounded-md px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="#98C1D9"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Accent / Action Color</label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={brandForm.accent_color}
                    onChange={e => setBrandForm(f => ({ ...f, accent_color: e.target.value }))}
                    className="h-9 w-14 rounded border border-gray-300 cursor-pointer p-0.5"
                  />
                  <input
                    type="text"
                    value={brandForm.accent_color}
                    onChange={e => setBrandForm(f => ({ ...f, accent_color: e.target.value }))}
                    className="flex-1 border border-gray-300 rounded-md px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="#EE6C4D"
                  />
                </div>
                <p className="text-xs text-gray-400 mt-1">
                  Used for action links, edit/add interactions, and secondary workflow accents.
                </p>
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">Logo URL</label>
                <input
                  type="url"
                  value={brandForm.logo_url}
                  onChange={e => setBrandForm(f => ({ ...f, logo_url: e.target.value }))}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="https://..."
                />
                {brandForm.logo_url && (
                  <div className="mt-2 flex items-center gap-3">
                    <img src={brandForm.logo_url} alt="Logo preview" className="h-10 object-contain border rounded p-1" />
                    <span className="text-xs text-gray-400">Preview</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Regional Settings */}
          <div className="section-card p-6">
            <h2 className="text-base font-semibold text-gray-800 mb-4">Regional &amp; Fiscal Settings</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Timezone</label>
                <select
                  value={settingsForm.timezone}
                  onChange={e => setSettingsForm(f => ({ ...f, timezone: e.target.value }))}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {TIMEZONES.map(tz => <option key={tz} value={tz}>{tz}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Date Format</label>
                <select
                  value={settingsForm.date_format}
                  onChange={e => setSettingsForm(f => ({ ...f, date_format: e.target.value }))}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {DATE_FORMATS.map(f => <option key={f} value={f}>{f}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Currency</label>
                <select
                  value={settingsForm.currency}
                  onChange={e => setSettingsForm(f => ({ ...f, currency: e.target.value }))}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Fiscal Year Start</label>
                <select
                  value={settingsForm.fiscal_year_start}
                  onChange={e => setSettingsForm(f => ({ ...f, fiscal_year_start: e.target.value }))}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {FISCAL_YEAR_STARTS.map(m => <option key={m} value={m}>{m}</option>)}
                </select>
              </div>
            </div>
            {isSuperAdmin && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4 pt-4 border-t border-gray-100">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Max Users
                    <span className="ml-1 badge-info text-xs">Superadmin only</span>
                  </label>
                  <input
                    type="number"
                    value={settings?.max_users ?? ''}
                    disabled
                    className="w-full border border-gray-200 rounded-md px-3 py-2 text-sm bg-gray-50 text-gray-400 cursor-not-allowed"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Storage Limit (GB)
                    <span className="ml-1 badge-info text-xs">Superadmin only</span>
                  </label>
                  <input
                    type="number"
                    value={settings?.storage_limit_gb ?? ''}
                    disabled
                    className="w-full border border-gray-200 rounded-md px-3 py-2 text-sm bg-gray-50 text-gray-400 cursor-not-allowed"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Outbound Email */}
          <div className="section-card p-6">
            <h2 className="text-base font-semibold text-gray-800 mb-4">Outbound Email</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">From Name</label>
                <input
                  type="text"
                  value={mailForm.from_name}
                  onChange={e => setMailForm(f => ({ ...f, from_name: e.target.value }))}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="WellSpring Rescue Village"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">From Email</label>
                <input
                  type="email"
                  value={mailForm.from_email}
                  onChange={e => setMailForm(f => ({ ...f, from_email: e.target.value }))}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="info@example.org"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Reply-To</label>
                <input
                  type="email"
                  value={mailForm.reply_to}
                  onChange={e => setMailForm(f => ({ ...f, reply_to: e.target.value }))}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="replies@example.org"
                />
              </div>
            </div>
          </div>

          {/* API Keys */}
          <div className="section-card p-6">
            <h2 className="text-base font-semibold text-gray-800 mb-1">API &amp; Integrations</h2>
            <p className="text-xs text-gray-400 mb-4">Keys are stored securely and never exposed in logs.</p>

            <div className="space-y-5">
              {/* Google Maps */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Google Maps API Key
                </label>
                <p className="text-xs text-gray-400 mb-2">
                  Used for address autocomplete and geocoding. Get a key at{' '}
                  <a href="https://console.cloud.google.com" target="_blank" rel="noreferrer"
                    className="text-blue-500 hover:underline">Google Cloud Console</a>.
                </p>
                <div className="flex items-center gap-2">
                  <input
                    type={showMapsKey ? 'text' : 'password'}
                    value={settingsForm.google_maps_api_key}
                    onChange={e => setSettingsForm(f => ({ ...f, google_maps_api_key: e.target.value }))}
                    className="flex-1 border border-gray-300 rounded-md px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="AIza..."
                  />
                  <button
                    type="button"
                    onClick={() => setShowMapsKey(v => !v)}
                    className="px-3 py-2 text-xs border border-gray-300 rounded-md hover:bg-gray-50 text-gray-600"
                  >
                    {showMapsKey ? 'Hide' : 'Show'}
                  </button>
                  {settingsForm.google_maps_api_key && (
                    <button
                      type="button"
                      onClick={() => copyToClipboard(settingsForm.google_maps_api_key)}
                      className="px-3 py-2 text-xs border border-gray-300 rounded-md hover:bg-gray-50 text-gray-600"
                    >
                      Copy
                    </button>
                  )}
                </div>
              </div>

              {/* Serenius API Key */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Serenius API Key
                </label>
                <p className="text-xs text-gray-400 mb-2">
                  Used for external integrations and webhooks.
                  {settings?.serenius_api_key_generated_at && (
                    <span className="ml-1">
                      Last generated: {new Date(settings.serenius_api_key_generated_at).toLocaleDateString()}
                    </span>
                  )}
                </p>
                <div className="flex items-center gap-2">
                  <input
                    type={showSereniusKey ? 'text' : 'password'}
                    value={settingsForm.serenius_api_key}
                    readOnly
                    className="flex-1 border border-gray-200 rounded-md px-3 py-2 text-sm font-mono bg-gray-50 text-gray-600"
                    placeholder="No key generated yet"
                  />
                  <button
                    type="button"
                    onClick={() => setShowSereniusKey(v => !v)}
                    className="px-3 py-2 text-xs border border-gray-300 rounded-md hover:bg-gray-50 text-gray-600"
                  >
                    {showSereniusKey ? 'Hide' : 'Show'}
                  </button>
                  {settingsForm.serenius_api_key && (
                    <button
                      type="button"
                      onClick={() => copyToClipboard(settingsForm.serenius_api_key)}
                      className="px-3 py-2 text-xs border border-gray-300 rounded-md hover:bg-gray-50 text-gray-600"
                    >
                      Copy
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={handleGenerateApiKey}
                    className="px-3 py-2 text-xs bg-gray-800 text-white rounded-md hover:bg-gray-700"
                  >
                    {settingsForm.serenius_api_key ? 'Rotate Key' : 'Generate Key'}
                  </button>
                </div>
                {settingsForm.serenius_api_key && (
                  <p className="text-xs text-amber-600 mt-1">
                    ⚠ Rotating generates a new key immediately. Any existing integrations using the old key will stop working.
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Save Bar */}
          <div className="flex items-center justify-between pt-2 pb-4">
            <div>
              {saveError   && <p className="text-sm text-red-600">{saveError}</p>}
              {saveSuccess && <p className="text-sm text-green-600">Settings saved successfully.</p>}
            </div>
            <button
              onClick={handleSaveOrg}
              disabled={saving}
              className="px-5 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 disabled:opacity-50"
            >
              {saving ? 'Saving…' : 'Save Organization Settings'}
            </button>
          </div>

        </div>
      )}

      {/* ── Other Tabs (stubs — built next) ────────────────────────────────── */}
      {activeTab === 'chart-of-accounts' && org && (
        <ChartOfAccountsTab tenantId={org.id} isSuperAdmin={isSuperAdmin} />
      )}

      {activeTab === 'gift-categories' && org && (
        <GiftCategoriesTab tenantId={org.id} />
      )}

      {activeTab === 'users-roles' && org && (
        <UsersRolesTab tenantId={org.id} isSuperAdmin={isSuperAdmin} />
      )}

      {activeTab === 'modules' && org && (
        <ModulesTab tenantId={org.id} isSuperAdmin={isSuperAdmin} />
      )}

    </div>
  )
}
