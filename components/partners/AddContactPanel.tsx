'use client'

import { useState, useEffect } from 'react'
import { createSupabaseBrowserClient } from '@/lib/supabase-browser'
import type { Partner } from '@/types/partners'

interface Props {
  partnerId: string
  partner: Partner
  onClose: () => void
  onSuccess: () => void
}

const PHONE_TYPES = ['Mobile', 'Home', 'Work', 'Other']
const EMAIL_SEGMENT_OPTIONS = [
  'Donors', 'All US', 'Prospects', 'Staff', 'Test Emails',
  'New Donor', 'New Prospect', 'iMessage Test', 'Mission Trips',
]

export default function AddContactPanel({ partnerId, partner, onClose, onSuccess }: Props) {
  const supabase = createSupabaseBrowserClient()
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [formData, setFormData] = useState({
    first_name: '',
    last_name: '',
    nickname: '',
    relationship: '',
    gender: '',
    marital_status: '',
    primary_email: '',
    secondary_email: '',
    primary_phone: '',
    primary_phone_type: '',
    secondary_phone: '',
    secondary_phone_type: '',
    birthday: '',
    anniversary: '',
    campaign_version: '',
    email_segments: [] as string[],
    text_message: '',
    display_financial_data: true,
    clone_primary_address: true,
    address_street: '',
    address_street2: '',
    address_city: '',
    address_state: '',
    address_zip: '',
  })

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [onClose])

  function handleChange(field: string, value: string | boolean) {
    setFormData(prev => ({ ...prev, [field]: value }))
  }

  function toggleSegment(segment: string) {
    setFormData(prev => ({
      ...prev,
      email_segments: prev.email_segments.includes(segment)
        ? prev.email_segments.filter(s => s !== segment)
        : [...prev.email_segments, segment],
    }))
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setSaving(true)
    setError(null)

    const displayName = `${formData.first_name} ${formData.last_name}`.trim()

    const addressPayload = formData.clone_primary_address
      ? {
          clone_primary_address: true,
          address_street: partner.address_street,
          address_street2: partner.address_street2,
          address_city: partner.address_city,
          address_state: partner.address_state,
          address_zip: partner.address_zip,
        }
      : {
          clone_primary_address: false,
          address_street: formData.address_street || null,
          address_street2: formData.address_street2 || null,
          address_city: formData.address_city || null,
          address_state: formData.address_state || null,
          address_zip: formData.address_zip || null,
        }

    const { error: insertError } = await supabase
      .from('partner_contacts')
      .insert({
        tenant_id: partner.tenant_id,
        partner_id: partnerId,
        first_name: formData.first_name,
        last_name: formData.last_name,
        display_name: displayName,
        nickname: formData.nickname || null,
        relationship: formData.relationship || null,
        gender: formData.gender || null,
        marital_status: formData.marital_status || null,
        primary_email: formData.primary_email || null,
        secondary_email: formData.secondary_email || null,
        primary_phone: formData.primary_phone || null,
        primary_phone_type: formData.primary_phone_type || null,
        secondary_phone: formData.secondary_phone || null,
        secondary_phone_type: formData.secondary_phone_type || null,
        birthday: formData.birthday || null,
        anniversary: formData.anniversary || null,
        campaign_version: formData.campaign_version || null,
        email_segment: formData.email_segments,
        text_message: formData.text_message || null,
        display_financial_data: formData.display_financial_data,
        ...addressPayload,
      })

    setSaving(false)

    if (insertError) {
      setError(insertError.message)
      return
    }

    onSuccess()
    onClose()
  }

  return (
    <>
      <div className="panel-overlay" onClick={onClose} />
      <div className="panel">

        <div className="panel-header">
          <h2>Add Contact</h2>
          <button className="panel-close" onClick={onClose} aria-label="Close panel">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M1 1l12 12M13 1L1 13" />
            </svg>
          </button>
        </div>

        <form id="add-contact-form" onSubmit={handleSubmit} className="panel-body">

          {/* ── Contact Info ── */}
          <div className="form-section-title">Contact Info</div>

          <div className="form-row">
            <div className="form-group">
              <label className="form-label">First Name *</label>
              <input
                type="text"
                className="form-input"
                required
                value={formData.first_name}
                onChange={e => handleChange('first_name', e.target.value)}
              />
            </div>
            <div className="form-group">
              <label className="form-label">Last Name *</label>
              <input
                type="text"
                className="form-input"
                required
                value={formData.last_name}
                onChange={e => handleChange('last_name', e.target.value)}
              />
            </div>
          </div>

          <div className="form-row full">
            <div className="form-group">
              <label className="form-label">Nickname</label>
              <input
                type="text"
                className="form-input"
                value={formData.nickname}
                onChange={e => handleChange('nickname', e.target.value)}
              />
            </div>
          </div>

          <div className="form-row full">
            <div className="form-group">
              <label className="form-label">Relationship</label>
              <select
                className="form-input"
                value={formData.relationship}
                onChange={e => handleChange('relationship', e.target.value)}
              >
                <option value="">Select...</option>
                <option>Self</option>
                <option>Husband</option>
                <option>Wife</option>
                <option>Father</option>
                <option>Mother</option>
                <option>Son</option>
                <option>Daughter</option>
                <option>Other</option>
              </select>
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Gender</label>
              <select
                className="form-input"
                value={formData.gender}
                onChange={e => handleChange('gender', e.target.value)}
              >
                <option value="">Select...</option>
                <option>Male</option>
                <option>Female</option>
                <option>Other</option>
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Marital Status</label>
              <select
                className="form-input"
                value={formData.marital_status}
                onChange={e => handleChange('marital_status', e.target.value)}
              >
                <option value="">Select...</option>
                <option>Single</option>
                <option>Married</option>
                <option>Widowed</option>
                <option>Divorced</option>
              </select>
            </div>
          </div>

          {/* ── Contact Details ── */}
          <div className="form-section-title" style={{ marginTop: 8 }}>Contact Details</div>

          <div className="form-row full">
            <div className="form-group">
              <label className="form-label">Primary Email</label>
              <input
                type="email"
                className="form-input"
                placeholder="email@example.com"
                value={formData.primary_email}
                onChange={e => handleChange('primary_email', e.target.value)}
              />
            </div>
          </div>

          <div className="form-row full">
            <div className="form-group">
              <label className="form-label">Secondary Email</label>
              <input
                type="email"
                className="form-input"
                placeholder="email@example.com"
                value={formData.secondary_email}
                onChange={e => handleChange('secondary_email', e.target.value)}
              />
            </div>
          </div>

          <div className="form-row full">
            <div className="form-group">
              <label className="form-label">Primary Phone</label>
              <div style={{ display: 'grid', gridTemplateColumns: '3fr 2fr', gap: 8 }}>
                <input
                  type="tel"
                  className="form-input"
                  placeholder="(___) ___-____"
                  value={formData.primary_phone}
                  onChange={e => handleChange('primary_phone', e.target.value)}
                />
                <select
                  className="form-input"
                  value={formData.primary_phone_type}
                  onChange={e => handleChange('primary_phone_type', e.target.value)}
                >
                  <option value="">Select...</option>
                  {PHONE_TYPES.map(o => <option key={o}>{o}</option>)}
                </select>
              </div>
            </div>
          </div>

          <div className="form-row full">
            <div className="form-group">
              <label className="form-label">Secondary Phone</label>
              <div style={{ display: 'grid', gridTemplateColumns: '3fr 2fr', gap: 8 }}>
                <input
                  type="tel"
                  className="form-input"
                  placeholder="(___) ___-____"
                  value={formData.secondary_phone}
                  onChange={e => handleChange('secondary_phone', e.target.value)}
                />
                <select
                  className="form-input"
                  value={formData.secondary_phone_type}
                  onChange={e => handleChange('secondary_phone_type', e.target.value)}
                >
                  <option value="">Select...</option>
                  {PHONE_TYPES.map(o => <option key={o}>{o}</option>)}
                </select>
              </div>
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Birthday</label>
              <input
                type="date"
                className="form-input"
                value={formData.birthday}
                onChange={e => handleChange('birthday', e.target.value)}
              />
            </div>
            <div className="form-group">
              <label className="form-label">Anniversary</label>
              <input
                type="date"
                className="form-input"
                value={formData.anniversary}
                onChange={e => handleChange('anniversary', e.target.value)}
              />
            </div>
          </div>

          <div className="form-row full">
            <div className="form-group">
              <label className="form-label">Campaign Version</label>
              <select
                className="form-input"
                value={formData.campaign_version}
                onChange={e => handleChange('campaign_version', e.target.value)}
              >
                <option value="">Select...</option>
                <option>A</option>
                <option>B</option>
                <option>C</option>
              </select>
            </div>
          </div>

          {/* ── Email Segment ── */}
          <div className="form-section-title" style={{ marginTop: 8 }}>Email Segment</div>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
            {EMAIL_SEGMENT_OPTIONS.map(segment => {
              const active = formData.email_segments.includes(segment)
              return (
                <button
                  key={segment}
                  type="button"
                  onClick={() => toggleSegment(segment)}
                  style={{
                    fontSize: 12,
                    padding: '4px 10px',
                    borderRadius: 12,
                    border: '1px solid',
                    cursor: 'pointer',
                    fontWeight: active ? 500 : 400,
                    background: active ? 'var(--brand-primary, #3b5bdb)' : 'transparent',
                    color: active ? '#fff' : '#6b7280',
                    borderColor: active ? 'var(--brand-primary, #3b5bdb)' : '#d1d5db',
                    transition: 'all 0.1s',
                  }}
                >
                  {segment}
                </button>
              )
            })}
          </div>

          {/* ── Preferences ── */}
          <div className="form-section-title" style={{ marginTop: 16 }}>Preferences</div>

          <div className="form-row full">
            <div className="form-group">
              <label className="form-label">Text Message opt-in</label>
              <select
                className="form-input"
                value={formData.text_message}
                onChange={e => handleChange('text_message', e.target.value)}
              >
                <option value="">Select...</option>
                <option>Yes</option>
                <option>No</option>
              </select>
            </div>
          </div>

          <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: '#374151', cursor: 'pointer', marginTop: 4 }}>
            <input
              type="checkbox"
              checked={formData.display_financial_data}
              onChange={e => handleChange('display_financial_data', e.target.checked)}
              style={{ accentColor: 'var(--brand-primary)', width: 15, height: 15 }}
            />
            Show financial data to this contact
          </label>

          {/* ── Address ── */}
          <div className="form-section-title" style={{ marginTop: 16 }}>Address</div>

          <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: '#374151', marginBottom: 12, cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={formData.clone_primary_address}
              onChange={e => handleChange('clone_primary_address', e.target.checked)}
              style={{ accentColor: 'var(--brand-primary)', width: 15, height: 15 }}
            />
            Same address as partner
          </label>

          {!formData.clone_primary_address && (
            <>
              <div className="form-row full">
                <div className="form-group">
                  <label className="form-label">Street Address</label>
                  <input
                    type="text"
                    className="form-input"
                    value={formData.address_street}
                    onChange={e => handleChange('address_street', e.target.value)}
                  />
                </div>
              </div>
              <div className="form-row full">
                <div className="form-group">
                  <label className="form-label">Street Address 2</label>
                  <input
                    type="text"
                    className="form-input"
                    value={formData.address_street2}
                    onChange={e => handleChange('address_street2', e.target.value)}
                  />
                </div>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">City</label>
                  <input
                    type="text"
                    className="form-input"
                    value={formData.address_city}
                    onChange={e => handleChange('address_city', e.target.value)}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">State</label>
                  <input
                    type="text"
                    className="form-input"
                    value={formData.address_state}
                    onChange={e => handleChange('address_state', e.target.value)}
                  />
                </div>
              </div>
              <div className="form-row full">
                <div className="form-group">
                  <label className="form-label">Zip Code</label>
                  <input
                    type="text"
                    className="form-input"
                    value={formData.address_zip}
                    onChange={e => handleChange('address_zip', e.target.value)}
                  />
                </div>
              </div>
            </>
          )}

          {error && (
            <div style={{
              marginTop: 12,
              padding: '10px 12px',
              background: '#fff5f5',
              border: '1px solid #ffa8a8',
              borderRadius: 6,
              fontSize: 13,
              color: '#c92a2a',
            }}>
              {error}
            </div>
          )}

        </form>

        <div className="panel-footer">
          <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button
            type="submit"
            form="add-contact-form"
            className="btn btn-primary"
            disabled={saving}
          >
            {saving ? 'Saving...' : 'Add Contact'}
          </button>
        </div>

      </div>
    </>
  )
}
