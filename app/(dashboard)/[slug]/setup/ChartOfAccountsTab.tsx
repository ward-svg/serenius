'use client'

import React, { useEffect, useState, useCallback } from 'react'
import { createSupabaseBrowserClient } from '@/lib/supabase-browser'

// ─── Types ────────────────────────────────────────────────────────────────────

interface MasterAccount {
  id: string
  number: string
  name: string
  account: string
  type: 'Income' | 'Expense'
  description: string | null
  available_to: string | null
  is_active: boolean
}

interface SubAccount {
  id: string
  gl_master_account_id: string
  number: string
  name: string
  account: string
  type: 'Income' | 'Expense'
  description: string | null
  available_to: string | null
  program_group: 'Program' | 'Administrative' | null
  is_active: boolean
}

type ModalMode = 'add-master' | 'edit-master' | 'add-sub' | 'edit-sub' | null

interface Props {
  tenantId: string
  isSuperAdmin: boolean
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function ChartOfAccountsTab({ tenantId, isSuperAdmin }: Props) {
  const [masters, setMasters]         = useState<MasterAccount[]>([])
  const [subs, setSubs]               = useState<SubAccount[]>([])
  const [loading, setLoading]         = useState(true)
  const [expandedMasters, setExpandedMasters] = useState<Set<string>>(new Set())

  // Filter / search
  const [search, setSearch]           = useState('')
  const [filterType, setFilterType]   = useState<'All' | 'Income' | 'Expense'>('All')
  const [showInactive, setShowInactive] = useState(false)

  // Modal
  const [modalMode, setModalMode]     = useState<ModalMode>(null)
  const [selectedMaster, setSelectedMaster] = useState<MasterAccount | null>(null)
  const [selectedSub, setSelectedSub] = useState<SubAccount | null>(null)
  const [parentMasterId, setParentMasterId] = useState<string | null>(null)

  // Form state
  const [form, setForm] = useState({
    number: '', name: '', type: 'Income' as 'Income' | 'Expense',
    description: '', available_to: '', program_group: '' as 'Program' | 'Administrative' | '',
  })

  // Import
  const [importError, setImportError] = useState<string | null>(null)
  const [importing, setImporting]     = useState(false)

  // Save state
  const [saving, setSaving]           = useState(false)
  const [error, setError]             = useState<string | null>(null)

  // ── Load ────────────────────────────────────────────────────────────────────

  const loadAccounts = useCallback(async () => {
    console.log('[ChartOfAccountsTab] loadAccounts called, tenantId:', tenantId)
    const supabase = createSupabaseBrowserClient()
    setLoading(true)
    const [masterRes, subRes] = await Promise.all([
      supabase.from('gl_master_accounts').select('*').eq('tenant_id', tenantId).order('number'),
      supabase.from('gl_sub_accounts').select('*').eq('tenant_id', tenantId).order('number'),
    ])
    console.log('[ChartOfAccountsTab] gl_master_accounts data:', masterRes.data, 'error:', masterRes.error)
    if (masterRes.data) setMasters(masterRes.data)
    if (subRes.data)    setSubs(subRes.data)
    setLoading(false)
  }, [tenantId])

  useEffect(() => { loadAccounts() }, [loadAccounts])

  // ── Helpers ─────────────────────────────────────────────────────────────────

  function openAddMaster() {
    setForm({ number: '', name: '', type: 'Income', description: '', available_to: '', program_group: '' })
    setSelectedMaster(null)
    setModalMode('add-master')
    setError(null)
  }

  function openEditMaster(m: MasterAccount) {
    setForm({
      number: m.number, name: m.name, type: m.type,
      description: m.description ?? '', available_to: m.available_to ?? '', program_group: '',
    })
    setSelectedMaster(m)
    setModalMode('edit-master')
    setError(null)
  }

  function openAddSub(masterId: string) {
    setForm({ number: '', name: '', type: 'Income', description: '', available_to: '', program_group: '' })
    setParentMasterId(masterId)
    setSelectedSub(null)
    setModalMode('add-sub')
    setError(null)
  }

  function openEditSub(s: SubAccount) {
    setForm({
      number: s.number, name: s.name, type: s.type,
      description: s.description ?? '', available_to: s.available_to ?? '',
      program_group: s.program_group ?? '',
    })
    setSelectedSub(s)
    setParentMasterId(s.gl_master_account_id)
    setModalMode('edit-sub')
    setError(null)
  }

  function toggleExpand(masterId: string) {
    setExpandedMasters(prev => {
      const next = new Set(prev)
      next.has(masterId) ? next.delete(masterId) : next.add(masterId)
      return next
    })
  }

  function expandAll()   { setExpandedMasters(new Set(masters.map(m => m.id))) }
  function collapseAll() { setExpandedMasters(new Set()) }

  // ── Save ────────────────────────────────────────────────────────────────────

  async function handleSave() {
    const supabase = createSupabaseBrowserClient()
    setSaving(true)
    setError(null)

    try {
      if (modalMode === 'add-master') {
        // Check unique number
        const exists = masters.some(m => m.number === form.number)
        if (exists) { setError('Account number already exists for this tenant.'); return }

        const { error: err } = await supabase.from('gl_master_accounts').insert({
          tenant_id: tenantId, number: form.number, name: form.name,
          type: form.type, description: form.description || null,
          available_to: form.available_to || null,
        })
        if (err) throw err

      } else if (modalMode === 'edit-master' && selectedMaster) {
        // Name must be unique per tenant
        const duplicate = masters.some(m => m.name === form.name && m.id !== selectedMaster.id)
        if (duplicate) { setError('An account with this name already exists.'); return }

        const { error: err } = await supabase.from('gl_master_accounts')
          .update({ name: form.name, description: form.description || null, available_to: form.available_to || null })
          .eq('id', selectedMaster.id)
        if (err) throw err

      } else if (modalMode === 'add-sub' && parentMasterId) {
        const exists = subs.some(s => s.number === form.number)
        if (exists) { setError('Account number already exists for this tenant.'); return }

        const masterType = masters.find(m => m.id === parentMasterId)?.type ?? form.type

        const { error: err } = await supabase.from('gl_sub_accounts').insert({
          tenant_id: tenantId, gl_master_account_id: parentMasterId,
          number: form.number, name: form.name, type: masterType,
          description: form.description || null, available_to: form.available_to || null,
          program_group: form.program_group || null,
        })
        if (err) throw err

      } else if (modalMode === 'edit-sub' && selectedSub) {
        const duplicate = subs.some(s => s.name === form.name && s.gl_master_account_id === selectedSub.gl_master_account_id && s.id !== selectedSub.id)
        if (duplicate) { setError('A sub-account with this name already exists under this master.'); return }

        const { error: err } = await supabase.from('gl_sub_accounts')
          .update({
            name: form.name, description: form.description || null,
            available_to: form.available_to || null,
            program_group: form.program_group || null,
          })
          .eq('id', selectedSub.id)
        if (err) throw err
      }

      setModalMode(null)
      loadAccounts()
    } catch (e: any) {
      setError(e.message ?? 'Save failed.')
    } finally {
      setSaving(false)
    }
  }

  // ── Toggle active ────────────────────────────────────────────────────────────

  async function toggleMasterActive(m: MasterAccount) {
    const supabase = createSupabaseBrowserClient()
    await supabase
      .from('gl_master_accounts')
      .update({ is_active: !m.is_active })
      .eq('id', m.id)
    loadAccounts()
  }

  async function toggleSubActive(s: SubAccount) {
    const supabase = createSupabaseBrowserClient()
    await supabase
      .from('gl_sub_accounts')
      .update({ is_active: !s.is_active })
      .eq('id', s.id)
    loadAccounts()
  }

  // ── CSV Import ───────────────────────────────────────────────────────────────

  async function handleImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const supabase = createSupabaseBrowserClient()
    setImporting(true)
    setImportError(null)

    try {
      const text = await file.text()
      const lines = text.split('\n').map(l => l.trim()).filter(Boolean)
      const header = lines[0].toLowerCase()

      // Expected columns: master_number, master_name, master_type, sub_number, sub_name, description, program_group
      if (!header.includes('master_number')) {
        setImportError('CSV must have a header row with: master_number, master_name, master_type, sub_number, sub_name')
        return
      }

      const cols = lines[0].split(',').map(c => c.trim().toLowerCase())
      const idx = (name: string) => cols.indexOf(name)

      const rows = lines.slice(1).map(line => {
        const parts = line.split(',').map(p => p.trim().replace(/^"|"$/g, ''))
        return {
          master_number:  parts[idx('master_number')]  ?? '',
          master_name:    parts[idx('master_name')]    ?? '',
          master_type:    parts[idx('master_type')]    ?? 'Income',
          sub_number:     parts[idx('sub_number')]     ?? '',
          sub_name:       parts[idx('sub_name')]       ?? '',
          description:    parts[idx('description')]    ?? '',
          program_group:  parts[idx('program_group')]  ?? '',
        }
      })

      // Deduplicate masters
      const masterMap = new Map<string, typeof rows[0]>()
      rows.forEach(r => { if (r.master_number && !masterMap.has(r.master_number)) masterMap.set(r.master_number, r) })

      // Upsert masters first
      for (const [, r] of masterMap) {
        const existing = masters.find(m => m.number === r.master_number)
        if (!existing) {
          await supabase.from('gl_master_accounts').insert({
            tenant_id: tenantId, number: r.master_number, name: r.master_name,
            type: (r.master_type === 'Expense' ? 'Expense' : 'Income') as 'Income' | 'Expense',
          })
        }
      }

      // Reload masters to get IDs
      const { data: freshMasters } = await supabase
        .from('gl_master_accounts').select('*').eq('tenant_id', tenantId)
      const masterById = new Map((freshMasters ?? []).map(m => [m.number, m]))

      // Upsert subs
      for (const r of rows) {
        if (!r.sub_number) continue
        const master = masterById.get(r.master_number)
        if (!master) continue
        const existingSub = subs.find(s => s.number === r.sub_number)
        if (!existingSub) {
          await supabase.from('gl_sub_accounts').insert({
            tenant_id: tenantId, gl_master_account_id: master.id,
            number: r.sub_number, name: r.sub_name,
            type: master.type,
            description: r.description || null,
            program_group: (r.program_group === 'Administrative' ? 'Administrative' : r.program_group === 'Program' ? 'Program' : null),
          })
        }
      }

      loadAccounts()
    } catch (e: any) {
      setImportError(e.message ?? 'Import failed.')
    } finally {
      setImporting(false)
      e.target.value = ''
    }
  }

  // ── Filtered view ────────────────────────────────────────────────────────────

  const filteredMasters = masters.filter(m => {
    if (filterType !== 'All' && m.type !== filterType) return false
    if (search && !m.account.toLowerCase().includes(search.toLowerCase())) {
      // Also check if any sub matches
      const subMatch = subs.filter(s => s.gl_master_account_id === m.id)
        .some(s => s.account.toLowerCase().includes(search.toLowerCase()))
      if (!subMatch) return false
    }
    return true
  })

  const subsForMaster = (masterId: string) =>
    subs.filter(s => s.gl_master_account_id === masterId)
      .filter(s => search ? s.account.toLowerCase().includes(search.toLowerCase()) : true)

  // ── Render ───────────────────────────────────────────────────────────────────

  if (loading) {
    return <div className="text-sm text-gray-400 py-8 text-center">Loading chart of accounts…</div>
  }

  return (
    <div className="space-y-4">

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3 justify-between">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search accounts…"
            className="border border-gray-300 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 w-56"
          />
          <select
            value={filterType}
            onChange={e => setFilterType(e.target.value as any)}
            className="border border-gray-300 rounded-md px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option>All</option>
            <option>Income</option>
            <option>Expense</option>
          </select>
          <label className="flex items-center gap-1.5 text-sm text-gray-600 cursor-pointer">
            <input type="checkbox" checked={showInactive} onChange={e => setShowInactive(e.target.checked)} />
            Show inactive
          </label>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={expandAll}   className="text-xs text-gray-500 hover:text-gray-700 underline">Expand all</button>
          <button onClick={collapseAll} className="text-xs text-gray-500 hover:text-gray-700 underline">Collapse all</button>
          {/* CSV Import */}
          <label className="px-3 py-1.5 text-xs border border-gray-300 rounded-md hover:bg-gray-50 text-gray-700 cursor-pointer">
            {importing ? 'Importing…' : 'Import CSV'}
            <input type="file" accept=".csv" className="hidden" onChange={handleImport} disabled={importing} />
          </label>
          <button onClick={openAddMaster} className="px-3 py-1.5 text-xs bg-blue-600 text-white rounded-md hover:bg-blue-700">
            + Add Master Account
          </button>
        </div>
      </div>

      {importError && (
        <div className="bg-red-50 border border-red-200 rounded-md px-4 py-2 text-sm text-red-700">
          {importError}
        </div>
      )}

      {/* CSV Template hint */}
      <p className="text-xs text-gray-400">
        CSV format: <code className="bg-gray-100 px-1 rounded">master_number, master_name, master_type, sub_number, sub_name, description, program_group</code>
      </p>

      {/* Account Tree: intentionally keeps chart hierarchy/number order instead of user sorting. */}
      <div className="section-card p-0 overflow-hidden">
        {filteredMasters.length === 0 ? (
          <div className="py-12 text-center text-gray-400 text-sm">
            No accounts found. Add your first master account to get started.
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wide w-8"></th>
                <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wide">Number</th>
                <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wide">Name</th>
                <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wide">Type</th>
                <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wide hidden md:table-cell">Description</th>
                <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wide">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredMasters.map(m => {
                const expanded = expandedMasters.has(m.id)
                const masterSubs = subsForMaster(m.id)
                return (
                  <React.Fragment key={m.id}>
                    {/* Master row */}
                    <tr key={m.id} className="border-b border-gray-100 bg-white hover:bg-gray-50">
                      <td className="px-4 py-2.5">
                        {masterSubs.length > 0 ? (
                          <button onClick={() => toggleExpand(m.id)} className="text-gray-400 hover:text-gray-600 text-xs">
                            {expanded ? '▼' : '▶'}
                          </button>
                        ) : (
                          <span className="text-gray-200 text-xs">—</span>
                        )}
                      </td>
                      <td className="px-4 py-2.5 font-mono font-semibold text-gray-800">{m.number}</td>
                      <td className="px-4 py-2.5 font-medium text-gray-900">{m.name}</td>
                      <td className="px-4 py-2.5">
                        <span className={`badge-${m.type === 'Income' ? 'success' : 'warning'} text-xs`}>
                          {m.type}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-gray-500 hidden md:table-cell text-xs">{m.description ?? '—'}</td>
                      <td className="px-4 py-2.5">
                        <div className="flex items-center gap-2">
                          <button onClick={() => openEditMaster(m)} className="text-xs text-blue-600 hover:underline">Edit</button>
                          <button onClick={() => openAddSub(m.id)} className="text-xs text-gray-500 hover:underline">+ Sub</button>
                        </div>
                      </td>
                    </tr>

                    {/* Sub-account rows */}
                    {expanded && masterSubs.map(s => (
                      <tr key={s.id} className="border-b border-gray-50 bg-gray-50/50 hover:bg-blue-50/30">
                        <td className="px-4 py-2"></td>
                        <td className="px-4 py-2 font-mono text-gray-600 pl-8">{s.number}</td>
                        <td className="px-4 py-2 text-gray-700 pl-8">
                          <span className="text-gray-300 mr-1">└</span>{s.name}
                        </td>
                        <td className="px-4 py-2">
                          <span className="text-xs text-gray-400">{s.type}</span>
                        </td>
                        <td className="px-4 py-2 text-gray-400 hidden md:table-cell text-xs">
                          {s.program_group ? <span className="badge-neutral text-xs mr-1">{s.program_group}</span> : null}
                          {s.description ?? ''}
                        </td>
                        <td className="px-4 py-2">
                          <button onClick={() => openEditSub(s)} className="text-xs text-blue-600 hover:underline">Edit</button>
                        </td>
                      </tr>
                    ))}
                  </React.Fragment>
                )
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Counts */}
      <p className="text-xs text-gray-400">
        {masters.length} master accounts · {subs.length} sub-accounts
      </p>

      {/* ── Modal ─────────────────────────────────────────────────────────── */}
      {modalMode && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md">
            <div className="px-5 py-4 border-b border-gray-200">
              <h3 className="font-semibold text-gray-900">
                {modalMode === 'add-master' && 'Add Master Account'}
                {modalMode === 'edit-master' && 'Edit Master Account'}
                {modalMode === 'add-sub' && 'Add Sub-Account'}
                {modalMode === 'edit-sub' && 'Edit Sub-Account'}
              </h3>
              {(modalMode === 'edit-master' || modalMode === 'edit-sub') && (
                <p className="text-xs text-gray-400 mt-0.5">Account number cannot be changed. Edit description only.</p>
              )}
            </div>
            <div className="px-5 py-4 space-y-4">

              {/* Number — add only */}
              {(modalMode === 'add-master' || modalMode === 'add-sub') && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Account Number <span className="text-red-500">*</span></label>
                  <input
                    type="text"
                    value={form.number}
                    onChange={e => setForm(f => ({ ...f, number: e.target.value }))}
                    className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder={modalMode === 'add-master' ? '20000' : '20100'}
                  />
                </div>
              )}

              {/* Number display — edit only */}
              {(modalMode === 'edit-master' || modalMode === 'edit-sub') && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Account Number</label>
                  <input
                    type="text"
                    value={form.number}
                    disabled
                    className="w-full border border-gray-200 rounded-md px-3 py-2 text-sm font-mono bg-gray-50 text-gray-400 cursor-not-allowed"
                  />
                </div>
              )}

              {/* Name */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Account Name <span className="text-red-500">*</span></label>
                <input
                  type="text"
                  value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="e.g. Direct Contributions Revenue"
                />
              </div>

              {/* Type — master add only */}
              {modalMode === 'add-master' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Type <span className="text-red-500">*</span></label>
                  <select
                    value={form.type}
                    onChange={e => setForm(f => ({ ...f, type: e.target.value as any }))}
                    className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="Income">Income</option>
                    <option value="Expense">Expense</option>
                  </select>
                </div>
              )}

              {/* Parent master — sub only */}
              {(modalMode === 'add-sub' || modalMode === 'edit-sub') && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Master Account</label>
                  <input
                    type="text"
                    value={masters.find(m => m.id === parentMasterId)?.account ?? ''}
                    disabled
                    className="w-full border border-gray-200 rounded-md px-3 py-2 text-sm bg-gray-50 text-gray-500 cursor-not-allowed"
                  />
                </div>
              )}

              {/* Program Group — sub accounts */}
              {(modalMode === 'add-sub' || modalMode === 'edit-sub') && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Program Group</label>
                  <select
                    value={form.program_group}
                    onChange={e => setForm(f => ({ ...f, program_group: e.target.value as any }))}
                    className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">— None —</option>
                    <option value="Program">Program</option>
                    <option value="Administrative">Administrative</option>
                  </select>
                </div>
              )}

              {/* Description */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <textarea
                  value={form.description}
                  onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                  rows={2}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                  placeholder="Optional description"
                />
              </div>

              {error && <p className="text-sm text-red-600">{error}</p>}
            </div>

            <div className="px-5 py-3 border-t border-gray-200 flex justify-end gap-2">
              <button
                onClick={() => setModalMode(null)}
                className="px-4 py-2 text-sm border border-gray-300 rounded-md hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={saving || !form.name || (modalMode !== 'edit-master' && modalMode !== 'edit-sub' && !form.number)}
                className="px-4 py-2 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
              >
                {saving ? 'Saving…' : 'Save Account'}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}
