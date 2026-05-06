'use client'

import { useState } from 'react'
import { createSupabaseBrowserClient } from '@/lib/supabase-browser'
import type { Pledge } from '@/types/partners'

interface Props {
  partnerId: string
  tenantId: string
  onClose: () => void
  onSuccess: (pledge: Pledge) => void
}

const PLEDGE_TYPES = ['Rescue Care', 'House Sponsor', 'General Fund', 'Pathways Sponsorship']
const STATUSES = ['Active', 'Completed', 'Canceled', 'Increased', 'On Hold']
const FREQUENCIES = ['Monthly', 'Quarterly', 'Annually', 'One Time']

export default function NewPledgeModal({ partnerId, tenantId, onClose, onSuccess }: Props) {
  const supabase = createSupabaseBrowserClient()
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [formData, setFormData] = useState({
    pledge_type: '',
    status: '',
    frequency: '',
    pledge_amount: '',
    number_of_payments: '',
    start_date: '',
    end_date: '',
    on_hold_until: '',
    notes: '',
  })

  function handleChange(field: string, value: string) {
    setFormData(prev => ({ ...prev, [field]: value }))
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()

    if (!formData.pledge_type || !formData.status || !formData.frequency ||
        !formData.pledge_amount || !formData.start_date) {
      setError('Please fill in all required fields.')
      return
    }

    const amount = parseFloat(formData.pledge_amount)
    if (isNaN(amount) || amount <= 0) {
      setError('Pledge amount must be a valid positive number.')
      return
    }

    setSaving(true)
    setError(null)

    const { data, error: insertError } = await supabase
      .from('pledges')
      .insert({
        tenant_id: tenantId,
        partner_id: partnerId,
        pledge_type: formData.pledge_type,
        status: formData.status,
        frequency: formData.frequency,
        pledge_amount: amount,
        number_of_payments: formData.number_of_payments
          ? parseInt(formData.number_of_payments, 10)
          : null,
        start_date: formData.start_date,
        end_date: formData.end_date || null,
        on_hold_until: formData.on_hold_until || null,
        notes: formData.notes || null,
      })
      .select('*')
      .single()

    setSaving(false)

    if (insertError || !data) {
      setError(insertError?.message ?? 'Failed to create pledge.')
      return
    }

    onSuccess(data as Pledge)
    onClose()
  }

  return (
    <div
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 50, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '64px 24px 24px', overflowY: 'auto' }}
      onClick={onClose}
    >
      <div
        style={{ background: 'white', borderRadius: 10, boxShadow: '0 20px 60px rgba(0,0,0,0.2)', width: '100%', maxWidth: 620, display: 'flex', flexDirection: 'column' }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', borderBottom: '1px solid #e4e4e0' }}>
          <div style={{ fontSize: 15, fontWeight: 600, color: '#111827' }}>New Pledge</div>
          <button
            type="button"
            onClick={onClose}
            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 6, color: '#6b7280', display: 'flex' }}
            aria-label="Close"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8">
              <path d="M2 2l12 12M14 2L2 14" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <form id="new-pledge-form" onSubmit={handleSubmit} style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column' }}>

          {/* Pledge Info */}
          <div className="form-section-title">Pledge Info</div>

          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Pledge Type *</label>
              <select
                className="form-input"
                value={formData.pledge_type}
                onChange={e => handleChange('pledge_type', e.target.value)}
              >
                <option value="">Select...</option>
                {PLEDGE_TYPES.map(o => <option key={o}>{o}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Status *</label>
              <select
                className="form-input"
                value={formData.status}
                onChange={e => handleChange('status', e.target.value)}
              >
                <option value="">Select...</option>
                {STATUSES.map(o => <option key={o}>{o}</option>)}
              </select>
            </div>
          </div>

          <div className="form-row full">
            <div className="form-group">
              <label className="form-label">Frequency *</label>
              <select
                className="form-input"
                value={formData.frequency}
                onChange={e => handleChange('frequency', e.target.value)}
              >
                <option value="">Select...</option>
                {FREQUENCIES.map(o => <option key={o}>{o}</option>)}
              </select>
            </div>
          </div>

          {/* Amounts */}
          <div className="form-section-title" style={{ marginTop: 8 }}>Amounts</div>

          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Pledge Amount *</label>
              <input
                type="number"
                className="form-input"
                placeholder="0.00"
                min="0"
                step="0.01"
                value={formData.pledge_amount}
                onChange={e => handleChange('pledge_amount', e.target.value)}
              />
              <span className="form-hint">Amount per payment</span>
            </div>
            <div className="form-group">
              <label className="form-label">Number of Payments</label>
              <input
                type="number"
                className="form-input"
                placeholder="—"
                min="1"
                step="1"
                value={formData.number_of_payments}
                onChange={e => handleChange('number_of_payments', e.target.value)}
              />
            </div>
          </div>

          <p style={{ fontSize: 12, color: '#9ca3af', fontStyle: 'italic', marginTop: 0, marginBottom: 8 }}>
            Annualized value is calculated automatically
          </p>

          {/* Dates */}
          <div className="form-section-title" style={{ marginTop: 8 }}>Dates</div>

          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Start Date *</label>
              <input
                type="date"
                className="form-input"
                value={formData.start_date}
                onChange={e => handleChange('start_date', e.target.value)}
              />
            </div>
            <div className="form-group">
              <label className="form-label">End Date</label>
              <input
                type="date"
                className="form-input"
                value={formData.end_date}
                onChange={e => handleChange('end_date', e.target.value)}
              />
            </div>
          </div>

          {formData.status === 'On Hold' && (
            <div className="form-row full">
              <div className="form-group">
                <label className="form-label">On Hold Until</label>
                <input
                  type="date"
                  className="form-input"
                  value={formData.on_hold_until}
                  onChange={e => handleChange('on_hold_until', e.target.value)}
                />
              </div>
            </div>
          )}

          {/* Notes */}
          <div className="form-section-title" style={{ marginTop: 8 }}>Notes</div>

          <div className="form-row full">
            <div className="form-group">
              <textarea
                rows={3}
                className="form-input"
                style={{ resize: 'vertical' }}
                value={formData.notes}
                onChange={e => handleChange('notes', e.target.value)}
              />
            </div>
          </div>

          {error && (
            <div style={{ marginTop: 8, padding: '10px 12px', background: '#fff5f5', border: '1px solid #ffa8a8', borderRadius: 6, fontSize: 13, color: '#c92a2a' }}>
              {error}
            </div>
          )}
        </form>

        {/* Footer */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, padding: '14px 24px', borderTop: '1px solid #e4e4e0' }}>
          <button type="button" className="btn btn-ghost" onClick={onClose} disabled={saving}>
            Cancel
          </button>
          <button type="submit" form="new-pledge-form" className="btn btn-primary" disabled={saving}>
            {saving ? 'Saving...' : 'Create Pledge'}
          </button>
        </div>
      </div>
    </div>
  )
}
