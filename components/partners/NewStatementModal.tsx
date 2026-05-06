'use client'

import { useState } from 'react'
import { createSupabaseBrowserClient } from '@/lib/supabase-browser'
import type { PartnerStatement } from '@/types/partners'

interface Props {
  partnerId: string
  tenantId: string
  onClose: () => void
  onSuccess: (statement: PartnerStatement) => void
}

export default function NewStatementModal({ partnerId, tenantId, onClose, onSuccess }: Props) {
  const supabase = createSupabaseBrowserClient()
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [formData, setFormData] = useState({
    year: String(new Date().getFullYear()),
    total_giving: '',
    intro_letter_url: '',
    giving_report_url: '',
    combined_statement_url: '',
  })

  function handleChange(field: string, value: string) {
    setFormData(prev => ({ ...prev, [field]: value }))
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()

    const yearNum = parseInt(formData.year, 10)
    if (!formData.year || isNaN(yearNum) || yearNum < 1900 || yearNum > 2100) {
      setError('Please enter a valid 4-digit year.')
      return
    }

    setSaving(true)
    setError(null)

    const { data: existing } = await supabase
      .from('partner_statements')
      .select('id')
      .eq('partner_id', partnerId)
      .eq('year', yearNum)
      .maybeSingle()

    if (existing) {
      setError(`A statement for ${formData.year} already exists for this partner.`)
      setSaving(false)
      return
    }

    const { data, error: insertError } = await supabase
      .from('partner_statements')
      .insert({
        tenant_id: tenantId,
        partner_id: partnerId,
        year: yearNum,
        total_giving: formData.total_giving ? parseFloat(formData.total_giving) : null,
        intro_letter_url: formData.intro_letter_url || null,
        giving_report_url: formData.giving_report_url || null,
        combined_statement_url: formData.combined_statement_url || null,
      })
      .select('*')
      .single()

    setSaving(false)

    if (insertError || !data) {
      setError(insertError?.message ?? 'Failed to save statement.')
      return
    }

    onSuccess(data as PartnerStatement)
    onClose()
  }

  return (
    <div
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 50, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '64px 24px 24px', overflowY: 'auto' }}
      onClick={onClose}
    >
      <div
        style={{ background: 'white', borderRadius: 10, boxShadow: '0 20px 60px rgba(0,0,0,0.2)', width: '100%', maxWidth: 560, display: 'flex', flexDirection: 'column' }}
        onClick={e => e.stopPropagation()}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', borderBottom: '1px solid #e4e4e0' }}>
          <div style={{ fontSize: 15, fontWeight: 600, color: '#111827' }}>New Annual Statement</div>
          <button type="button" onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 6, color: '#6b7280', display: 'flex' }} aria-label="Close">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8">
              <path d="M2 2l12 12M14 2L2 14" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        <form id="new-statement-form" onSubmit={handleSubmit} style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column' }}>

          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Year *</label>
              <input
                type="number"
                className="form-input"
                placeholder="2025"
                min="1900"
                max="2100"
                value={formData.year}
                onChange={e => handleChange('year', e.target.value)}
              />
            </div>
            <div className="form-group">
              <label className="form-label">Total Giving</label>
              <input
                type="number"
                className="form-input"
                placeholder="0.00"
                min="0"
                step="0.01"
                value={formData.total_giving}
                onChange={e => handleChange('total_giving', e.target.value)}
              />
            </div>
          </div>

          <div className="form-row full">
            <div className="form-group">
              <label className="form-label">Intro Letter URL</label>
              <input
                type="text"
                className="form-input"
                placeholder="https://docs.google.com/..."
                value={formData.intro_letter_url}
                onChange={e => handleChange('intro_letter_url', e.target.value)}
              />
            </div>
          </div>

          <div className="form-row full">
            <div className="form-group">
              <label className="form-label">Giving Report URL</label>
              <input
                type="text"
                className="form-input"
                placeholder="https://docs.google.com/spreadsheets/..."
                value={formData.giving_report_url}
                onChange={e => handleChange('giving_report_url', e.target.value)}
              />
            </div>
          </div>

          <div className="form-row full">
            <div className="form-group">
              <label className="form-label">Combined Statement URL</label>
              <input
                type="text"
                className="form-input"
                placeholder="https://drive.google.com/..."
                value={formData.combined_statement_url}
                onChange={e => handleChange('combined_statement_url', e.target.value)}
              />
            </div>
          </div>

          {error && (
            <div style={{ marginTop: 8, padding: '10px 12px', background: '#fff5f5', border: '1px solid #ffa8a8', borderRadius: 6, fontSize: 13, color: '#c92a2a' }}>
              {error}
            </div>
          )}
        </form>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, padding: '14px 24px', borderTop: '1px solid #e4e4e0' }}>
          <button type="button" className="btn btn-ghost" onClick={onClose} disabled={saving}>Cancel</button>
          <button type="submit" form="new-statement-form" className="btn btn-primary" disabled={saving}>
            {saving ? 'Saving...' : 'Save Statement'}
          </button>
        </div>
      </div>
    </div>
  )
}
