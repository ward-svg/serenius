'use client'

import { useState, useCallback } from 'react'
import { createSupabaseBrowserClient } from '@/lib/supabase-browser'
import type { Partner } from '@/types/partners'
import { formatPhone, normalizePhone } from '@/lib/formatPhone'

interface Props {
  partner: Partner
  onClose: () => void
  onSuccess: (updated: Partner) => void
}

const ENTITY_TYPES = ['Church', 'Business', 'Organization', 'School']
const CHANNELS = ['Facebook', 'Instagram', 'Email']
const PHONE_TYPES = ['Mobile', 'Home', 'Work', 'Other']

function buildFormData(p: Partner) {
  return {
    display_name: p.display_name ?? '',
    entity_name: p.entity_name ?? '',
    correspondence_greeting: p.correspondence_greeting ?? '',
    partner_type: p.partner_type ?? '',
    partner_status: p.partner_status ?? '',
    relationship_type: p.relationship_type ?? '',
    primary_email: p.primary_email ?? '',
    secondary_email: p.secondary_email ?? '',
    primary_phone: p.primary_phone ? formatPhone(p.primary_phone) : '',
    primary_phone_type: p.primary_phone_type ?? '',
    secondary_phone: p.secondary_phone ? formatPhone(p.secondary_phone) : '',
    secondary_phone_type: p.secondary_phone_type ?? '',
    address_street: p.address_street ?? '',
    address_street2: p.address_street2 ?? '',
    address_city: p.address_city ?? '',
    address_state: p.address_state ?? '',
    address_zip: p.address_zip ?? '',
    address_country: p.address_country ?? '',
    notes: p.notes ?? '',
  }
}

export default function PartnerModal({ partner, onClose, onSuccess }: Props) {
  const supabase = createSupabaseBrowserClient()
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [partnerType, setPartnerType] = useState(partner.partner_type ?? '')
  const [selectedChannels, setSelectedChannels] = useState<string[]>(partner.social_channels ?? [])
  const [formData, setFormData] = useState(() => buildFormData(partner))

  const isEntityType = ENTITY_TYPES.includes(partnerType)

  const handleChange = useCallback((field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }))
  }, [])

  function handlePhoneInput(e: React.ChangeEvent<HTMLInputElement>, field: string) {
    const digits = e.target.value.replace(/\D/g, '').slice(0, 10)
    let formatted = digits
    if (digits.length >= 7) {
      formatted = `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`
    } else if (digits.length >= 4) {
      formatted = `(${digits.slice(0, 3)}) ${digits.slice(3)}`
    } else if (digits.length >= 1) {
      formatted = `(${digits}`
    }
    setFormData(prev => ({ ...prev, [field]: formatted }))
  }

  function toggleChannel(channel: string) {
    setSelectedChannels(prev =>
      prev.includes(channel) ? prev.filter(c => c !== channel) : [...prev, channel]
    )
  }

  async function handleSave() {
    setSaving(true)
    setError(null)

    const { data, error: updateError } = await supabase
      .from('partners')
      .update({
        display_name: formData.display_name,
        entity_name: isEntityType ? formData.entity_name || null : null,
        correspondence_greeting: formData.correspondence_greeting || null,
        partner_type: formData.partner_type || null,
        partner_status: formData.partner_status || null,
        relationship_type: formData.relationship_type || null,
        primary_email: formData.primary_email || null,
        secondary_email: formData.secondary_email || null,
        primary_phone: normalizePhone(formData.primary_phone) || null,
        primary_phone_type: formData.primary_phone_type || null,
        secondary_phone: normalizePhone(formData.secondary_phone) || null,
        secondary_phone_type: formData.secondary_phone_type || null,
        address_street: formData.address_street || null,
        address_street2: formData.address_street2 || null,
        address_city: formData.address_city || null,
        address_state: formData.address_state || null,
        address_zip: formData.address_zip || null,
        address_country: formData.address_country || null,
        notes: formData.notes || null,
        social_channels: selectedChannels,
        updated_at: new Date().toISOString(),
      })
      .eq('id', partner.id)
      .select()
      .single()

    setSaving(false)

    if (updateError || !data) {
      setError(updateError?.message ?? 'Failed to save partner.')
      return
    }

    onSuccess(data as Partner)
    onClose()
  }

  return (
    <div
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 50, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '64px 24px 24px', overflowY: 'auto' }}
      onClick={onClose}
    >
      <div
        style={{ background: 'white', borderRadius: 10, boxShadow: '0 20px 60px rgba(0,0,0,0.2)', width: '100%', maxWidth: 760, display: 'flex', flexDirection: 'column' }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header — static, scrolls with modal */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', borderBottom: '1px solid #e4e4e0', borderRadius: '10px 10px 0 0' }}>
          <div>
            <div style={{ fontSize: 15, fontWeight: 600, color: '#111827' }}>Edit Partner</div>
            <div style={{ fontSize: 13, color: '#6b7280', marginTop: 2 }}>{partner.display_name}</div>
          </div>
          <button
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
        <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column' }}>

          {/* Partner Info */}
          <div className="form-section-title">Partner Info</div>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Partner Type *</label>
              <select
                className="form-input"
                value={partnerType}
                onChange={e => { setPartnerType(e.target.value); handleChange('partner_type', e.target.value) }}
              >
                <option value="">Select...</option>
                <option>Family</option>
                <option>Church</option>
                <option>Business</option>
                <option>Organization</option>
                <option>School</option>
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Partner Status *</label>
              <select className="form-input" value={formData.partner_status} onChange={e => handleChange('partner_status', e.target.value)}>
                <option value="">Select...</option>
                <option>Active</option>
                <option>Past</option>
              </select>
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Relationship Type *</label>
              <select className="form-input" value={formData.relationship_type} onChange={e => handleChange('relationship_type', e.target.value)}>
                <option value="">Select...</option>
                <option>Donor</option>
                <option>Prospect</option>
              </select>
            </div>
            {isEntityType && (
              <div className="form-group">
                <label className="form-label">Entity Name</label>
                <input type="text" className="form-input" placeholder="Organization or church name" value={formData.entity_name} onChange={e => handleChange('entity_name', e.target.value)} />
              </div>
            )}
          </div>

          {/* Identity */}
          <div className="form-section-title" style={{ marginTop: 8 }}>Identity</div>
          <div className="form-row full">
            <div className="form-group">
              <label className="form-label">Display Name</label>
              <input type="text" className="form-input" value={formData.display_name} onChange={e => handleChange('display_name', e.target.value)} />
              <span className="form-hint">The name shown throughout the system</span>
            </div>
          </div>
          <div className="form-row full">
            <div className="form-group">
              <label className="form-label">Correspondence Greeting</label>
              <input type="text" className="form-input" placeholder="e.g. Matt and Amber" value={formData.correspondence_greeting} onChange={e => handleChange('correspondence_greeting', e.target.value)} />
              <span className="form-hint">Used in letters and email salutations</span>
            </div>
          </div>

          {/* Contact Info */}
          <div className="form-section-title" style={{ marginTop: 8 }}>Contact Info</div>
          <div className="form-row full">
            <div className="form-group">
              <label className="form-label">Primary Email</label>
              <input type="email" className="form-input" value={formData.primary_email} onChange={e => handleChange('primary_email', e.target.value)} />
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Primary Phone</label>
              <input type="tel" className="form-input" value={formData.primary_phone} onChange={e => handlePhoneInput(e, 'primary_phone')} />
            </div>
            <div className="form-group">
              <label className="form-label">Type</label>
              <select className="form-input" value={formData.primary_phone_type} onChange={e => handleChange('primary_phone_type', e.target.value)}>
                <option value="">Select...</option>
                {PHONE_TYPES.map(o => <option key={o}>{o}</option>)}
              </select>
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Secondary Phone</label>
              <input type="tel" className="form-input" value={formData.secondary_phone} onChange={e => handlePhoneInput(e, 'secondary_phone')} />
            </div>
            <div className="form-group">
              <label className="form-label">Type</label>
              <select className="form-input" value={formData.secondary_phone_type} onChange={e => handleChange('secondary_phone_type', e.target.value)}>
                <option value="">Select...</option>
                {PHONE_TYPES.map(o => <option key={o}>{o}</option>)}
              </select>
            </div>
          </div>

          {/* Address */}
          <div className="form-section-title" style={{ marginTop: 8 }}>Address</div>
          <div className="form-row full">
            <div className="form-group">
              <label className="form-label">Street Address</label>
              <input type="text" className="form-input" value={formData.address_street} onChange={e => handleChange('address_street', e.target.value)} />
            </div>
          </div>
          <div className="form-row full">
            <div className="form-group">
              <label className="form-label">Street Address 2</label>
              <input type="text" className="form-input" placeholder="Apt, Suite, etc." value={formData.address_street2} onChange={e => handleChange('address_street2', e.target.value)} />
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">City</label>
              <input type="text" className="form-input" value={formData.address_city} onChange={e => handleChange('address_city', e.target.value)} />
            </div>
            <div className="form-group">
              <label className="form-label">State</label>
              <input type="text" className="form-input" value={formData.address_state} onChange={e => handleChange('address_state', e.target.value)} />
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Zip Code</label>
              <input type="text" className="form-input" value={formData.address_zip} onChange={e => handleChange('address_zip', e.target.value)} />
            </div>
            <div className="form-group">
              <label className="form-label">Country</label>
              <input type="text" className="form-input" placeholder="US" value={formData.address_country} onChange={e => handleChange('address_country', e.target.value)} />
            </div>
          </div>

          {/* Notes */}
          <div className="form-section-title" style={{ marginTop: 8 }}>Notes</div>
          <div className="form-row full">
            <div className="form-group">
              <textarea rows={4} className="form-input" style={{ resize: 'vertical' }} value={formData.notes} onChange={e => handleChange('notes', e.target.value)} />
            </div>
          </div>

          {/* Social Channels */}
          <div className="form-section-title" style={{ marginTop: 8 }}>Social Channels</div>
          <div style={{ display: 'flex', gap: 24, marginTop: 8 }}>
            {CHANNELS.map(channel => (
              <label key={channel} style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13, color: '#374151' }}>
                <input type="checkbox" checked={selectedChannels.includes(channel)} onChange={() => toggleChannel(channel)} style={{ accentColor: 'var(--brand-primary)', width: 15, height: 15 }} />
                {channel}
              </label>
            ))}
          </div>

          {error && (
            <div style={{ marginTop: 12, padding: '10px 12px', background: '#fff5f5', border: '1px solid #ffa8a8', borderRadius: 6, fontSize: 13, color: '#c92a2a' }}>
              {error}
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, padding: '14px 24px', borderTop: '1px solid #e4e4e0', borderRadius: '0 0 10px 10px' }}>
          <button className="btn btn-ghost" onClick={onClose} disabled={saving}>Cancel</button>
          <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>
  )
}
