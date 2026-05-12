'use client'

import { useEffect, useMemo, useState, useCallback } from 'react'
import SortableHeader from '@/components/ui/SortableHeader'
import { createSupabaseBrowserClient } from '@/lib/supabase-browser'
import {
  nextSortState,
  sortByValue,
  type SortState,
  type SortValue,
} from '@/lib/ui/sort'

// ─── Types ────────────────────────────────────────────────────────────────────

interface GiftCategory {
  id: string
  category_name: string
  gl_master_account_id: string | null
  gl_sub_account_id: string | null
  is_active: boolean
  sort_order: number
}

interface MasterAccount {
  id: string
  number: string
  name: string
  account: string
}

interface SubAccount {
  id: string
  gl_master_account_id: string
  number: string
  name: string
  account: string
}

interface Props {
  tenantId: string
}

type CategorySortKey = 'category' | 'masterAccount' | 'subAccount'

// ─── Component ────────────────────────────────────────────────────────────────

export default function GiftCategoriesTab({ tenantId }: Props) {
  const [categories, setCategories]   = useState<GiftCategory[]>([])
  const [masters, setMasters]         = useState<MasterAccount[]>([])
  const [subs, setSubs]               = useState<SubAccount[]>([])
  const [loading, setLoading]         = useState(true)

  // Modal
  const [showModal, setShowModal]     = useState(false)
  const [editingId, setEditingId]     = useState<string | null>(null)

  // Form
  const [form, setForm] = useState({
    category_name: '',
    gl_master_account_id: '',
    gl_sub_account_id: '',
    is_active: true,
  })

  const [saving, setSaving]           = useState(false)
  const [error, setError]             = useState<string | null>(null)
  const [categorySort, setCategorySort] = useState<SortState<CategorySortKey> | null>(null)

  // ── Load ────────────────────────────────────────────────────────────────────

  const load = useCallback(async () => {
    const supabase = createSupabaseBrowserClient()
    setLoading(true)
    const [catRes, masterRes, subRes] = await Promise.all([
      supabase.from('gift_category_settings').select('*').eq('tenant_id', tenantId).order('sort_order').order('category_name'),
      supabase.from('gl_master_accounts').select('id, number, name, account').eq('tenant_id', tenantId).order('number'),
      supabase.from('gl_sub_accounts').select('id, gl_master_account_id, number, name, account').eq('tenant_id', tenantId).order('number'),
    ])
    if (catRes.data)    setCategories(catRes.data)
    if (masterRes.data) setMasters(masterRes.data)
    if (subRes.data)    setSubs(subRes.data)
    setLoading(false)
  }, [tenantId])

  useEffect(() => { load() }, [load])

  // ── Helpers ─────────────────────────────────────────────────────────────────

  const subsForMaster = (masterId: string) =>
    subs.filter(s => s.gl_master_account_id === masterId)

  const masterLabel = (id: string | null) =>
    id ? (masters.find(m => m.id === id)?.account ?? '—') : '—'

  const subLabel = (id: string | null) =>
    id ? (subs.find(s => s.id === id)?.account ?? '—') : '—'

  function openAdd() {
    setEditingId(null)
    setForm({ category_name: '', gl_master_account_id: '', gl_sub_account_id: '', is_active: true })
    setError(null)
    setShowModal(true)
  }

  function openEdit(cat: GiftCategory) {
    setEditingId(cat.id)
    setForm({
      category_name:        cat.category_name,
      gl_master_account_id: cat.gl_master_account_id ?? '',
      gl_sub_account_id:    cat.gl_sub_account_id    ?? '',
      is_active:            cat.is_active,
    })
    setError(null)
    setShowModal(true)
  }

  // ── Save ────────────────────────────────────────────────────────────────────

  async function handleSave() {
    const supabase = createSupabaseBrowserClient()
    setSaving(true)
    setError(null)

    try {
      if (!form.category_name.trim()) {
        setError('Category name is required.')
        return
      }

      // Unique name check
      const duplicate = categories.some(c =>
        c.category_name.toLowerCase() === form.category_name.trim().toLowerCase() &&
        c.id !== editingId
      )
      if (duplicate) {
        setError('A category with this name already exists.')
        return
      }

      const payload = {
        category_name:        form.category_name.trim(),
        gl_master_account_id: form.gl_master_account_id || null,
        gl_sub_account_id:    form.gl_sub_account_id    || null,
        is_active:            form.is_active,
      }

      if (editingId) {
        const { error: err } = await supabase.from('gift_category_settings').update(payload).eq('id', editingId)
        if (err) throw err
      } else {
        const maxSort = categories.length > 0 ? Math.max(...categories.map(c => c.sort_order)) + 1 : 0
        const { error: err } = await supabase.from('gift_category_settings').insert({
          ...payload, tenant_id: tenantId, sort_order: maxSort,
        })
        if (err) throw err
      }

      setShowModal(false)
      load()
    } catch (e: any) {
      setError(e.message ?? 'Save failed.')
    } finally {
      setSaving(false)
    }
  }

  // ── Toggle active ────────────────────────────────────────────────────────────

  async function toggleActive(cat: GiftCategory) {
    const supabase = createSupabaseBrowserClient()
    await supabase.from('gift_category_settings')
      .update({ is_active: !cat.is_active })
      .eq('id', cat.id)
    load()
  }

  const active = useMemo(
    () => categories.filter(c => c.is_active),
    [categories],
  )
  const inactive = useMemo(
    () => categories.filter(c => !c.is_active),
    [categories],
  )
  const getCategorySortValue = useCallback((cat: GiftCategory, key: CategorySortKey): SortValue => {
    switch (key) {
      case 'category':
        return cat.category_name
      case 'masterAccount':
        return masterLabel(cat.gl_master_account_id)
      case 'subAccount':
        return subLabel(cat.gl_sub_account_id)
    }
  }, [masters, subs])
  const sortedActive = useMemo(
    () => sortByValue(active, categorySort, getCategorySortValue),
    [active, categorySort, getCategorySortValue],
  )
  const sortedInactive = useMemo(
    () => sortByValue(inactive, categorySort, getCategorySortValue),
    [categorySort, getCategorySortValue, inactive],
  )

  // ── Render ───────────────────────────────────────────────────────────────────

  if (loading) {
    return <div className="text-sm text-gray-400 py-8 text-center">Loading gift categories…</div>
  }

  return (
    <div className="space-y-4">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-gray-600">
            Gift categories appear on financial gifts and pledges. Each maps to a GL master and sub-account for automatic coding.
          </p>
        </div>
        <button onClick={openAdd} className="px-3 py-1.5 text-xs bg-blue-600 text-white rounded-md hover:bg-blue-700 whitespace-nowrap">
          + Add Category
        </button>
      </div>

      {/* Active Categories */}
      <div className="section-card p-0 overflow-hidden">
        <div className="px-4 py-3 bg-gray-50 border-b border-gray-200">
          <h3 className="text-sm font-semibold text-gray-700">Active Categories ({active.length})</h3>
        </div>
        {active.length === 0 ? (
          <div className="py-8 text-center text-sm text-gray-400">No active categories.</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100">
                <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wide actions-column">ACTIONS</th>
                <SortableHeader
                  label="Category"
                  sortKey="category"
                  sort={categorySort}
                  onSort={(key) => setCategorySort((current) => nextSortState(current, key))}
                  className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wide"
                />
                <SortableHeader
                  label="Master Account"
                  sortKey="masterAccount"
                  sort={categorySort}
                  onSort={(key) => setCategorySort((current) => nextSortState(current, key))}
                  className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wide hidden md:table-cell"
                />
                <SortableHeader
                  label="Sub Account"
                  sortKey="subAccount"
                  sort={categorySort}
                  onSort={(key) => setCategorySort((current) => nextSortState(current, key))}
                  className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wide hidden md:table-cell"
                />
              </tr>
            </thead>
            <tbody>
              {sortedActive.map(cat => (
                <tr key={cat.id} className="border-b border-gray-50 hover:bg-gray-50">
                  <td className="px-4 py-2.5 actions-column">
                    <div className="flex items-center gap-3">
                      <button onClick={() => openEdit(cat)} className="text-xs text-blue-600 hover:underline">Edit</button>
                      <button onClick={() => toggleActive(cat)} className="text-xs text-gray-400 hover:text-gray-600 hover:underline">
                        Deactivate
                      </button>
                    </div>
                  </td>
                  <td className="px-4 py-2.5 font-medium text-gray-900">{cat.category_name}</td>
                  <td className="px-4 py-2.5 text-gray-500 hidden md:table-cell text-xs font-mono">
                    {masterLabel(cat.gl_master_account_id)}
                  </td>
                  <td className="px-4 py-2.5 text-gray-500 hidden md:table-cell text-xs font-mono">
                    {subLabel(cat.gl_sub_account_id)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Inactive Categories */}
      {inactive.length > 0 && (
        <div className="section-card p-0 overflow-hidden">
          <div className="px-4 py-3 bg-gray-50 border-b border-gray-200">
            <h3 className="text-sm font-semibold text-gray-400">Inactive Categories ({inactive.length})</h3>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100">
                <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-400 uppercase tracking-wide actions-column">ACTIONS</th>
                <SortableHeader
                  label="Category"
                  sortKey="category"
                  sort={categorySort}
                  onSort={(key) => setCategorySort((current) => nextSortState(current, key))}
                  className="text-left px-4 py-2.5 text-xs font-semibold text-gray-400 uppercase tracking-wide"
                />
                <SortableHeader
                  label="Master Account"
                  sortKey="masterAccount"
                  sort={categorySort}
                  onSort={(key) => setCategorySort((current) => nextSortState(current, key))}
                  className="text-left px-4 py-2.5 text-xs font-semibold text-gray-400 uppercase tracking-wide hidden md:table-cell"
                />
                <SortableHeader
                  label="Sub Account"
                  sortKey="subAccount"
                  sort={categorySort}
                  onSort={(key) => setCategorySort((current) => nextSortState(current, key))}
                  className="text-left px-4 py-2.5 text-xs font-semibold text-gray-400 uppercase tracking-wide hidden md:table-cell"
                />
              </tr>
            </thead>
            <tbody>
              {sortedInactive.map(cat => (
                <tr key={cat.id} className="border-b border-gray-50 opacity-60 hover:opacity-100">
                  <td className="px-4 py-2.5 actions-column">
                    <div className="flex items-center gap-3">
                      <button onClick={() => openEdit(cat)} className="text-xs text-blue-600 hover:underline">Edit</button>
                      <button onClick={() => toggleActive(cat)} className="text-xs text-green-600 hover:underline">
                        Reactivate
                      </button>
                    </div>
                  </td>
                  <td className="px-4 py-2.5 text-gray-500 line-through">{cat.category_name}</td>
                  <td className="px-4 py-2.5 text-gray-400 hidden md:table-cell text-xs font-mono">
                    {masterLabel(cat.gl_master_account_id)}
                  </td>
                  <td className="px-4 py-2.5 text-gray-400 hidden md:table-cell text-xs font-mono">
                    {subLabel(cat.gl_sub_account_id)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ── Modal ─────────────────────────────────────────────────────────── */}
      {showModal && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md">
            <div className="px-5 py-4 border-b border-gray-200">
              <h3 className="font-semibold text-gray-900">
                {editingId ? 'Edit Gift Category' : 'Add Gift Category'}
              </h3>
              <p className="text-xs text-gray-400 mt-0.5">
                Map this category to a GL master and sub-account for automatic coding on gifts.
              </p>
            </div>
            <div className="px-5 py-4 space-y-4">

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Category Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={form.category_name}
                  onChange={e => setForm(f => ({ ...f, category_name: e.target.value }))}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="e.g. Christmas 2026"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Master Account</label>
                <select
                  value={form.gl_master_account_id}
                  onChange={e => setForm(f => ({ ...f, gl_master_account_id: e.target.value, gl_sub_account_id: '' }))}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">— Select master account —</option>
                  {masters.map(m => (
                    <option key={m.id} value={m.id}>{m.account}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Sub Account</label>
                <select
                  value={form.gl_sub_account_id}
                  onChange={e => setForm(f => ({ ...f, gl_sub_account_id: e.target.value }))}
                  disabled={!form.gl_master_account_id}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-50 disabled:text-gray-400"
                >
                  <option value="">— Select sub-account —</option>
                  {subsForMaster(form.gl_master_account_id).map(s => (
                    <option key={s.id} value={s.id}>{s.account}</option>
                  ))}
                </select>
                {!form.gl_master_account_id && (
                  <p className="text-xs text-gray-400 mt-1">Select a master account first.</p>
                )}
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="cat-active"
                  checked={form.is_active}
                  onChange={e => setForm(f => ({ ...f, is_active: e.target.checked }))}
                  className="rounded"
                />
                <label htmlFor="cat-active" className="text-sm text-gray-700">Active</label>
              </div>

              {error && <p className="text-sm text-red-600">{error}</p>}
            </div>

            <div className="px-5 py-3 border-t border-gray-200 flex justify-end gap-2">
              <button onClick={() => setShowModal(false)}
                className="px-4 py-2 text-sm border border-gray-300 rounded-md hover:bg-gray-50">
                Cancel
              </button>
              <button onClick={handleSave} disabled={saving || !form.category_name.trim()}
                className="px-4 py-2 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50">
                {saving ? 'Saving…' : 'Save Category'}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}
