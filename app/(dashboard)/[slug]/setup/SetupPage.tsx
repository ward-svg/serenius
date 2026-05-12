'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { createSupabaseBrowserClient } from '@/lib/supabase-browser'
import ChartOfAccountsTab from './ChartOfAccountsTab'
import IntegrationsTab from './IntegrationsTab'
import GiftCategoriesTab from './GiftCategoriesTab'
import UsersRolesTab from './UsersRolesTab'
import type {
  OrganizationStorageConnection,
  OrganizationStorageSettings,
  SetupIntegrationNotice,
  StorageSettingsInput,
} from './types'

// ─── Types ────────────────────────────────────────────────────────────────────

interface Organization {
  id: string
  name: string
  slug: string
}

interface OrganizationBranding {
  id: string
  primary_color: string | null
  secondary_color: string | null
  accent_color: string | null
  sidebar_background_color: string | null
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

type Tab = 'organization' | 'integrations' | 'chart-of-accounts' | 'gift-categories' | 'users-roles'

interface SetupPageProps {
  tenantSlug: string
  initialTab?: Tab
  googleOAuthConfigured?: boolean
  integrationNotice?: SetupIntegrationNotice | null
  mailIntegrationNotice?: SetupIntegrationNotice | null
}

// ─── Constants ────────────────────────────────────────────────────────────────

const TABS: { id: Tab; label: string }[] = [
  { id: 'organization',      label: 'Organization'       },
  { id: 'integrations',      label: 'Integrations'       },
  { id: 'chart-of-accounts', label: 'Chart of Accounts'  },
  { id: 'gift-categories',   label: 'Gift Categories'    },
  { id: 'users-roles',       label: 'Users & Roles'      },
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

export default function SetupPage({
  tenantSlug,
  initialTab = 'organization',
  googleOAuthConfigured = false,
  integrationNotice = null,
  mailIntegrationNotice = null,
}: SetupPageProps) {
  // Access control
  const [authorized, setAuthorized]   = useState<boolean | null>(null)
  const [isSuperAdmin, setIsSuperAdmin] = useState(false)

  // Data
  const [org, setOrg]               = useState<Organization | null>(null)
  const [branding, setBranding]     = useState<OrganizationBranding | null>(null)
  const [settings, setSettings]     = useState<OrganizationSettings | null>(null)
  const [mail, setMail]             = useState<OrganizationMail | null>(null)
  const [storageSettings, setStorageSettings] = useState<OrganizationStorageSettings | null>(null)
  const [storageConnection, setStorageConnection] = useState<OrganizationStorageConnection | null>(null)

  // UI state
  const [activeTab, setActiveTab]   = useState<Tab>(initialTab)
  const [loading, setLoading]       = useState(true)
  const [saving, setSaving]         = useState(false)
  const [saveError, setSaveError]   = useState<string | null>(null)
  const [saveSuccess, setSaveSuccess] = useState(false)

  // API key reveal toggles
  const [showMapsKey, setShowMapsKey]         = useState(false)
  const [showSereniusKey, setShowSereniusKey] = useState(false)
  const [logoUploading, setLogoUploading] = useState(false)
  const [logoUploadMessage, setLogoUploadMessage] = useState<string | null>(null)
  const [logoUploadError, setLogoUploadError] = useState<string | null>(null)
  const logoUploadInputRef = useRef<HTMLInputElement | null>(null)

  // Form state (org tab)
  const [orgForm, setOrgForm]         = useState({ name: '' })
  const [brandForm, setBrandForm]     = useState({
    primary_color: '#3D5A80',
    secondary_color: '#98C1D9',
    accent_color: '#EE6C4D',
    sidebar_background_color: '',
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
  const canUploadBrandLogo =
    storageSettings?.provider === 'google_drive' &&
    storageSettings.is_enabled &&
    storageSettings.connection_status === 'connected' &&
    storageConnection?.credentialsConnected === true

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
      setOrgForm({ name: orgData.name })

      const [brandRes, settingsRes, mailRes, storageRes, connectionRes] = await Promise.all([
        supabase.from('organization_branding').select('*').eq('tenant_id', orgData.id).maybeSingle(),
        supabase.from('organization_settings').select('*').eq('tenant_id', orgData.id).maybeSingle(),
        supabase.from('organization_mail').select('*').eq('tenant_id', orgData.id).maybeSingle(),
        supabase.from('organization_storage_settings').select('*').eq('tenant_id', orgData.id).maybeSingle(),
        fetch(`/api/storage/google/status?tenantId=${encodeURIComponent(orgData.id)}`, {
          credentials: 'include',
          cache: 'no-store',
        }),
      ])

      if (brandRes.data) {
        setBranding(brandRes.data)
        setBrandForm({
          primary_color:   brandRes.data.primary_color   ?? '#3D5A80',
          secondary_color: brandRes.data.secondary_color ?? '#98C1D9',
          accent_color:    brandRes.data.accent_color    ?? '#EE6C4D',
          sidebar_background_color: brandRes.data.sidebar_background_color ?? '',
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

      setStorageSettings(storageRes.data ?? null)
      if (connectionRes.ok) {
        const connectionJson = await connectionRes.json() as { connection: OrganizationStorageConnection | null }
        setStorageConnection(connectionJson.connection ?? null)
      } else {
        setStorageConnection(null)
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
        sidebar_background_color: brandForm.sidebar_background_color || null,
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

  async function handleLogoUpload(file: File) {
    if (!org) return

    setLogoUploading(true)
    setLogoUploadError(null)
    setLogoUploadMessage(null)

    try {
      const formData = new FormData()
      formData.set('tenantId', org.id)
      formData.set('tenantSlug', org.slug)
      formData.set('file', file)

      const response = await fetch('/api/branding/logo/upload', {
        method: 'POST',
        credentials: 'include',
        body: formData,
      })

      const payload = await response.json().catch(() => null) as
        | { ok?: boolean; error?: string; logo_url?: string }
        | null

      if (!response.ok || !payload?.ok || !payload.logo_url) {
        throw new Error(payload?.error ?? 'Failed to upload logo.')
      }

      setBrandForm(form => ({ ...form, logo_url: payload.logo_url ?? '' }))
      setLogoUploadMessage('Logo uploaded successfully.')
      await loadData()
    } catch (error) {
      setLogoUploadError(error instanceof Error ? error.message : 'Failed to upload logo.')
    } finally {
      setLogoUploading(false)
    }
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

  async function handleSaveStorageSettings(values: StorageSettingsInput) {
    if (!org) {
      throw new Error('Organization context is unavailable.')
    }

    if (storageSettings?.provider && storageSettings.provider !== 'google_drive') {
      throw new Error('This organization is already using an unsupported storage provider in the current UI.')
    }

    const supabase = createSupabaseBrowserClient()
    const { data: authUser, error: authError } = await supabase.auth.getUser()
    if (authError) throw authError

    const existing = storageSettings
    const now = new Date().toISOString()
    const googleDriveOAuthConnected = existing?.provider === 'google_drive' && (
      existing.connection_status === 'connected' ||
      storageConnection?.credentialsConnected === true
    )
    const nextConnectionStatus = values.is_enabled
      ? (googleDriveOAuthConnected ? 'connected' : 'manual')
      : 'disabled'

    const { data, error } = await supabase
      .from('organization_storage_settings')
      .upsert({
        tenant_id: org.id,
        provider: 'google_drive',
        display_name: 'Google Drive',
        root_folder_id: values.root_folder_id || null,
        root_folder_url: values.root_folder_url || null,
        is_enabled: values.is_enabled,
        connection_status: nextConnectionStatus,
        locked_at: existing?.locked_at ?? now,
        locked_by: existing?.locked_by ?? authUser.user?.id ?? null,
      }, { onConflict: 'tenant_id' })
      .select('*')
      .single()

    if (error) throw error

    setStorageSettings(data as OrganizationStorageSettings)
    return data as OrganizationStorageSettings
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
          <p className="text-gray-500 text-sm">You don&apos;t have permission to access Setup.</p>
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
            Manage organization settings, integrations, chart of accounts, and system configuration
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
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Menu Background Color</label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={brandForm.sidebar_background_color || '#293241'}
                    onChange={e => setBrandForm(f => ({ ...f, sidebar_background_color: e.target.value }))}
                    className="h-9 w-14 rounded border border-gray-300 cursor-pointer p-0.5"
                  />
                  <input
                    type="text"
                    value={brandForm.sidebar_background_color}
                    onChange={e => setBrandForm(f => ({ ...f, sidebar_background_color: e.target.value }))}
                    className="flex-1 border border-gray-300 rounded-md px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="#293241"
                  />
                </div>
                <p className="text-xs text-gray-400 mt-1">
                  Used for the left navigation menu background.
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
                <div className="mt-2 flex items-center gap-2">
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    onClick={() => logoUploadInputRef.current?.click()}
                    disabled={logoUploading || !canUploadBrandLogo}
                    title={!canUploadBrandLogo ? 'Connect Google Drive in Integrations before uploading logo files.' : undefined}
                  >
                    {logoUploading ? 'Uploading…' : 'Upload Logo'}
                  </button>
                  {!canUploadBrandLogo && (
                    <span className="text-xs text-gray-500">
                      Connect Google Drive in Integrations before uploading logo files.
                    </span>
                  )}
                </div>
                <p className="text-xs text-gray-400 mt-2">
                  Recommended: transparent PNG or SVG, wide format, about 300 × 80 px. Keep extra whitespace minimal.
                </p>
                <input
                  ref={logoUploadInputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/webp,image/svg+xml"
                  className="hidden"
                  onChange={e => {
                    const file = e.target.files?.[0]
                    e.target.value = ''
                    if (!file) return
                    void handleLogoUpload(file)
                  }}
                />
                {brandForm.logo_url && (
                  <div className="mt-2 flex items-center gap-3">
                    <img
                      src={`/api/branding/logo?tenantSlug=${encodeURIComponent(org?.slug ?? tenantSlug)}`}
                      alt="Logo preview"
                      className="h-10 object-contain border rounded p-1"
                    />
                    <span className="text-xs text-gray-400">Preview</span>
                  </div>
                )}
                {logoUploadMessage && (
                  <p className="mt-2 text-xs text-green-700">{logoUploadMessage}</p>
                )}
                {logoUploadError && (
                  <p className="mt-2 text-xs text-red-700">{logoUploadError}</p>
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

      {activeTab === 'integrations' && org && (
        <IntegrationsTab
          tenantId={org.id}
          tenantSlug={tenantSlug}
          googleOAuthConfigured={googleOAuthConfigured}
          integrationNotice={integrationNotice}
          mailIntegrationNotice={mailIntegrationNotice}
          googleMapsApiKey={settingsForm.google_maps_api_key}
          setGoogleMapsApiKey={value => setSettingsForm(f => ({ ...f, google_maps_api_key: value }))}
          sereniusApiKey={settingsForm.serenius_api_key}
          sereniusApiKeyGeneratedAt={settings?.serenius_api_key_generated_at ?? null}
          showMapsKey={showMapsKey}
          setShowMapsKey={setShowMapsKey}
          showSereniusKey={showSereniusKey}
          setShowSereniusKey={setShowSereniusKey}
          onGenerateApiKey={handleGenerateApiKey}
          onCopyToClipboard={copyToClipboard}
          storageSettings={storageSettings}
          storageConnection={storageConnection}
          onSaveStorageSettings={handleSaveStorageSettings}
          onStorageSettingsChange={setStorageSettings}
        />
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
    </div>
  )
}
