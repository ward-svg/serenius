'use client'

import { useState, useEffect, useCallback } from 'react'
import { createSupabaseBrowserClient } from '@/lib/supabase-browser'
import type { Partner, PartnerContact } from '@/types/partners'
import { formatPhone, normalizePhone } from '@/lib/formatPhone'

interface Props {
  contact: PartnerContact
  partner: Partner
  onClose: () => void
  onSuccess: (updated: PartnerContact) => void
}

const PHONE_TYPES = ['Mobile', 'Home', 'Work', 'Other']
const EMAIL_SEGMENT_OPTIONS = [
  'Donors', 'All US', 'Prospects', 'Staff', 'Test Emails',
  'New Donor', 'New Prospect', 'iMessage Test', 'Mission Trips',
]

function buildFormData(c: PartnerContact) {
  return {
    first_name: c.first_name ?? '',
    last_name: c.last_name ?? '',
    nickname: c.nickname ?? '',
    relationship: c.relationship ?? '',
    gender: c.gender ?? '',
    marital_status: c.marital_status ?? '',
    primary_email: c.primary_email ?? '',
    secondary_email: c.secondary_email ?? '',
    primary_phone: c.primary_phone ? formatPhone(c.primary_phone) : '',
    primary_phone_type: c.primary_phone_type ?? '',
    secondary_phone: c.secondary_phone ? formatPhone(c.secondary_phone) : '',
    secondary_phone_type: c.secondary_phone_type ?? '',
    birthday: c.birthday ?? '',
    anniversary: c.anniversary ?? '',
    campaign_version: c.campaign_version ?? '',
    email_segments: c.email_segment ?? [] as string[],
    text_message: c.text_message ?? '',
    display_financial_data: c.display_financial_data ?? true,
    source_notes: c.source_notes ?? '',
    notes: c.notes ?? '',
    clone_primary_address: c.clone_primary_address ?? true,
    address_street: c.address_street ?? '',
    address_street2: c.address_street2 ?? '',
    address_city: c.address_city ?? '',
    address_state: c.address_state ?? '',
    address_zip: c.address_zip ?? '',
  }
}

function fmtDate(dateStr: string | null): string {
  if (!dateStr) return '—'
  const d = new Date(dateStr)
  if (isNaN(d.getTime())) return '—'
  return d.toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' })
}

function fmtDateTime(dateStr: string): string {
  const d = new Date(dateStr)
  if (isNaN(d.getTime())) return '—'
  return d.toLocaleString('en-US', {
    month: '2-digit', day: '2-digit', year: 'numeric',
    hour: 'numeric', minute: '2-digit', hour12: true,
  })
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <tr>
      <td style={{
        padding: '9px 0',
        fontSize: 12,
        fontWeight: 500,
        color: '#6b7280',
        whiteSpace: 'nowrap',
        verticalAlign: 'top',
        width: 160,
        borderBottom: '1px solid #f3f4f6',
      }}>
        {label}
      </td>
      <td style={{
        padding: '9px 12px',
        fontSize: 13,
        color: '#111827',
        borderBottom: '1px solid #f3f4f6',
        verticalAlign: 'top',
      }}>
        {value ?? <span style={{ color: '#d1d5db' }}>—</span>}
      </td>
    </tr>
  )
}

function PhoneLink({ value }: { value: string | null }) {
  if (!value) return <span style={{ color: '#d1d5db' }}>—</span>
  return <a href={`tel:${value}`} className="action-link">{formatPhone(value)}</a>
}

function EmailLink({ value }: { value: string | null }) {
  if (!value) return <span style={{ color: '#d1d5db' }}>—</span>
  return <a href={`mailto:${value}`} className="email-link">{value}</a>
}

function AddressBlock({ contact }: { contact: PartnerContact }) {
  const { address_street, address_street2, address_city, address_state, address_zip } = contact
  if (!address_street && !address_city && !address_zip) return <span style={{ color: '#d1d5db' }}>—</span>
  return (
    <span style={{ lineHeight: 1.7 }}>
      {address_street && <>{address_street}<br /></>}
      {address_street2 && <>{address_street2}<br /></>}
      {[[address_city, address_state].filter(Boolean).join(', '), address_zip].filter(Boolean).join(' ')}
    </span>
  )
}

export default function ContactDetailModal({ contact, partner, onClose, onSuccess }: Props) {
  const supabase = createSupabaseBrowserClient()
  const [mode, setMode] = useState<'view' | 'edit'>('view')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [formData, setFormData] = useState(() => buildFormData(contact))

  const fullName = [contact.first_name, contact.last_name].filter(Boolean).join(' ') || '—'

  // Reset form when cancelling back to view mode
  useEffect(() => {
    if (mode === 'view') {
      setFormData(buildFormData(contact))
      setError(null)
    }
  }, [mode, contact])

  const handleChange = useCallback((field: string, value: string | boolean) => {
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

  function toggleSegment(segment: string) {
    setFormData(prev => ({
      ...prev,
      email_segments: prev.email_segments.includes(segment)
        ? prev.email_segments.filter(s => s !== segment)
        : [...prev.email_segments, segment],
    }))
  }

  async function handleSave() {
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

    const { data, error: updateError } = await supabase
      .from('partner_contacts')
      .update({
        first_name: formData.first_name,
        last_name: formData.last_name,
        display_name: displayName,
        nickname: formData.nickname || null,
        relationship: formData.relationship || null,
        gender: formData.gender || null,
        marital_status: formData.marital_status || null,
        primary_email: formData.primary_email || null,
        secondary_email: formData.secondary_email || null,
        primary_phone: normalizePhone(formData.primary_phone) || null,
        primary_phone_type: formData.primary_phone_type || null,
        secondary_phone: normalizePhone(formData.secondary_phone) || null,
        secondary_phone_type: formData.secondary_phone_type || null,
        birthday: formData.birthday || null,
        anniversary: formData.anniversary || null,
        campaign_version: formData.campaign_version || null,
        email_segment: formData.email_segments,
        text_message: formData.text_message || null,
        display_financial_data: formData.display_financial_data,
        source_notes: formData.source_notes || null,
        notes: formData.notes || null,
        updated_at: new Date().toISOString(),
        ...addressPayload,
      })
      .eq('id', contact.id)
      .select()
      .single()

    setSaving(false)

    if (updateError || !data) {
      setError(updateError?.message ?? 'Failed to save contact.')
      return
    }

    onSuccess(data as PartnerContact)
    setMode('view')
  }

  // ── Shared modal shell ──────────────────────────────────
  const modalCard = (children: React.ReactNode, footer?: React.ReactNode) => (
    <div
      style={{
        position: 'fixed', inset: 0,
        background: 'rgba(0,0,0,0.4)',
        zIndex: 50,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
      }}
      onClick={mode === 'view' ? onClose : undefined}
    >
      <div
        style={{
          background: 'white',
          borderRadius: 10,
          boxShadow: '0 20px 60px rgba(0,0,0,0.2)',
          width: '100%',
          maxWidth: 900,
          maxHeight: '90vh',
          overflowY: 'auto',
          display: 'flex',
          flexDirection: 'column',
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '16px 20px',
          borderBottom: '1px solid #e4e4e0',
          position: 'sticky',
          top: 0,
          background: 'white',
          zIndex: 1,
        }}>
          <div>
            <div style={{ fontSize: 15, fontWeight: 600, color: '#111827' }}>
              {mode === 'view' ? 'View Contact Details' : 'Edit Contact'}
            </div>
            <div style={{ fontSize: 15, fontWeight: 500, color: '#374151', marginTop: 3 }}>{fullName}</div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {mode === 'view' ? (
              <>
                <button
                  onClick={() => setMode('edit')}
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: 6,
                    fontSize: 12, fontWeight: 500, padding: '6px 12px',
                    border: '1px solid #d1d5db', borderRadius: 6,
                    background: 'white', cursor: 'pointer', color: '#374151',
                  }}
                >
                  <svg width="12" height="12" viewBox="0 0 13 13" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <path d="M9 1.5l2.5 2.5L4 11.5H1.5V9L9 1.5z" strokeLinejoin="round" />
                  </svg>
                  Edit Contact
                </button>
                <button
                  onClick={onClose}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 6, color: '#6b7280', display: 'flex' }}
                  aria-label="Close"
                >
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8">
                    <path d="M2 2l12 12M14 2L2 14" strokeLinecap="round" />
                  </svg>
                </button>
              </>
            ) : (
              <button
                onClick={() => setMode('view')}
                style={{
                  fontSize: 12, fontWeight: 500, padding: '6px 12px',
                  border: '1px solid #d1d5db', borderRadius: 6,
                  background: 'white', cursor: 'pointer', color: '#374151',
                }}
              >
                ← Back to view
              </button>
            )}
          </div>
        </div>

        {/* Body */}
        {children}

        {/* Footer (edit mode only) */}
        {footer}
      </div>
    </div>
  )

  // ── VIEW MODE ───────────────────────────────────────────
  if (mode === 'view') {
    return modalCard(
      <>
        <div style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: 0,
          padding: '20px 20px 0',
          borderBottom: '1px solid #e4e4e0',
        }}>
          <div style={{ paddingRight: 16, borderRight: '1px solid #f0f0eb' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <tbody>
                <Row label="Name" value={fullName} />
                <Row label="Nickname" value={contact.nickname || '—'} />
                <Row label="Gender" value={contact.gender || '—'} />
                <Row label="Marital Status" value={contact.marital_status || '—'} />
                <Row label="Email" value={<EmailLink value={contact.primary_email} />} />
                <Row label="Secondary Email" value={<EmailLink value={contact.secondary_email} />} />
                <Row label="Primary Phone" value={<PhoneLink value={contact.primary_phone} />} />
                <Row label="Primary Phone Type" value={contact.primary_phone_type || '—'} />
                <Row label="Secondary Phone" value={<PhoneLink value={contact.secondary_phone} />} />
                <Row label="Secondary Phone Type" value={contact.secondary_phone_type || '—'} />
                <Row label="Campaign Version" value={contact.campaign_version || '—'} />
                <Row label="Email Segments" value={contact.email_segment?.length ? contact.email_segment.join(', ') : '—'} />
                <Row label="Relationship History" value={contact.source_notes || '—'} />
                <Row label="Notes" value={contact.notes || '—'} />
              </tbody>
            </table>
          </div>
          <div style={{ paddingLeft: 16 }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <tbody>
                <Row label="Relationship" value={contact.relationship || '—'} />
                <Row label="Birthday" value={fmtDate(contact.birthday)} />
                <Row label="Anniversary" value={fmtDate(contact.anniversary)} />
                <Row label="Address" value={<AddressBlock contact={contact} />} />
                <Row label="Created Date" value={fmtDateTime(contact.created_at)} />
                <Row label="Created By" value={contact.created_by || '—'} />
              </tbody>
            </table>
          </div>
        </div>

        {/* Family Connect */}
        <div style={{ padding: '20px 20px 24px' }}>
          <div style={{
            fontSize: 14, fontWeight: 600, color: '#1f2937',
            marginTop: 8, marginBottom: 12, paddingTop: 16,
            borderTop: '1px solid #e5e7eb',
          }}>
            Family Connect Details
          </div>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <tbody>
              <Row label="Sponsored Children" value={<span style={{ color: '#d1d5db' }}>—</span>} />
              {/* TODO: link to sponsored_children table */}
              <Row label="Show Financial Data in Portal" value={contact.display_financial_data ? 'Yes' : 'No'} />
            </tbody>
          </table>
          <div style={{ marginTop: 12, padding: '12px 14px', background: '#f8f8f6', borderRadius: 6, border: '1px solid #e4e4e0' }}>
            <div style={{ fontSize: 12, color: '#9ca3af', fontStyle: 'italic' }}>Family Connect portal coming soon</div>
          </div>
        </div>
      </>
    )
  }

  // ── EDIT MODE ───────────────────────────────────────────
  return modalCard(
    <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 0 }}>

      {/* Contact Info */}
      <div className="form-section-title">Contact Info</div>
      <div className="form-row">
        <div className="form-group">
          <label className="form-label">First Name *</label>
          <input type="text" className="form-input" required value={formData.first_name} onChange={e => handleChange('first_name', e.target.value)} />
        </div>
        <div className="form-group">
          <label className="form-label">Last Name *</label>
          <input type="text" className="form-input" required value={formData.last_name} onChange={e => handleChange('last_name', e.target.value)} />
        </div>
      </div>
      <div className="form-row full">
        <div className="form-group">
          <label className="form-label">Nickname</label>
          <input type="text" className="form-input" value={formData.nickname} onChange={e => handleChange('nickname', e.target.value)} />
        </div>
      </div>
      <div className="form-row full">
        <div className="form-group">
          <label className="form-label">Relationship</label>
          <select className="form-input" value={formData.relationship} onChange={e => handleChange('relationship', e.target.value)}>
            <option value="">Select...</option>
            {['Self','Husband','Wife','Father','Mother','Son','Daughter','Other'].map(o => <option key={o}>{o}</option>)}
          </select>
        </div>
      </div>
      <div className="form-row">
        <div className="form-group">
          <label className="form-label">Gender</label>
          <select className="form-input" value={formData.gender} onChange={e => handleChange('gender', e.target.value)}>
            <option value="">Select...</option>
            {['Male','Female','Other'].map(o => <option key={o}>{o}</option>)}
          </select>
        </div>
        <div className="form-group">
          <label className="form-label">Marital Status</label>
          <select className="form-input" value={formData.marital_status} onChange={e => handleChange('marital_status', e.target.value)}>
            <option value="">Select...</option>
            {['Single','Married','Widowed','Divorced'].map(o => <option key={o}>{o}</option>)}
          </select>
        </div>
      </div>

      {/* Contact Details */}
      <div className="form-section-title" style={{ marginTop: 8 }}>Contact Details</div>
      <div className="form-row full">
        <div className="form-group">
          <label className="form-label">Primary Email</label>
          <input type="email" className="form-input" value={formData.primary_email} onChange={e => handleChange('primary_email', e.target.value)} />
        </div>
      </div>
      <div className="form-row full">
        <div className="form-group">
          <label className="form-label">Secondary Email</label>
          <input type="email" className="form-input" value={formData.secondary_email} onChange={e => handleChange('secondary_email', e.target.value)} />
        </div>
      </div>
      <div className="form-row full">
        <div className="form-group">
          <label className="form-label">Primary Phone</label>
          <div style={{ display: 'grid', gridTemplateColumns: '3fr 2fr', gap: 8 }}>
            <input type="tel" className="form-input" placeholder="(___) ___-____" value={formData.primary_phone} onChange={e => handlePhoneInput(e, 'primary_phone')} />
            <select className="form-input" value={formData.primary_phone_type} onChange={e => handleChange('primary_phone_type', e.target.value)}>
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
            <input type="tel" className="form-input" placeholder="(___) ___-____" value={formData.secondary_phone} onChange={e => handlePhoneInput(e, 'secondary_phone')} />
            <select className="form-input" value={formData.secondary_phone_type} onChange={e => handleChange('secondary_phone_type', e.target.value)}>
              <option value="">Select...</option>
              {PHONE_TYPES.map(o => <option key={o}>{o}</option>)}
            </select>
          </div>
        </div>
      </div>
      <div className="form-row">
        <div className="form-group">
          <label className="form-label">Birthday</label>
          <input type="date" className="form-input" value={formData.birthday} onChange={e => handleChange('birthday', e.target.value)} />
        </div>
        <div className="form-group">
          <label className="form-label">Anniversary</label>
          <input type="date" className="form-input" value={formData.anniversary} onChange={e => handleChange('anniversary', e.target.value)} />
        </div>
      </div>
      <div className="form-row full">
        <div className="form-group">
          <label className="form-label">Campaign Version</label>
          <select className="form-input" value={formData.campaign_version} onChange={e => handleChange('campaign_version', e.target.value)}>
            <option value="">Select...</option>
            {['A','B','C'].map(o => <option key={o}>{o}</option>)}
          </select>
        </div>
      </div>

      {/* Email Segments */}
      <div className="form-section-title" style={{ marginTop: 8 }}>Email Segments</div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
        {EMAIL_SEGMENT_OPTIONS.map(segment => {
          const active = formData.email_segments.includes(segment)
          return (
            <button
              key={segment}
              type="button"
              onClick={() => toggleSegment(segment)}
              style={{
                fontSize: 12, padding: '4px 10px', borderRadius: 12, border: '1px solid',
                cursor: 'pointer', fontWeight: active ? 500 : 400, transition: 'all 0.1s',
                background: active ? 'var(--brand-primary, #3b5bdb)' : 'transparent',
                color: active ? '#fff' : '#6b7280',
                borderColor: active ? 'var(--brand-primary, #3b5bdb)' : '#d1d5db',
              }}
            >
              {segment}
            </button>
          )
        })}
      </div>

      {/* Preferences */}
      <div className="form-section-title" style={{ marginTop: 16 }}>Preferences</div>
      <div className="form-row full">
        <div className="form-group">
          <label className="form-label">Text Message opt-in</label>
          <select className="form-input" value={formData.text_message} onChange={e => handleChange('text_message', e.target.value)}>
            <option value="">Select...</option>
            <option>Yes</option>
            <option>No</option>
          </select>
        </div>
      </div>
      <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: '#374151', cursor: 'pointer', marginTop: 4 }}>
        <input type="checkbox" checked={formData.display_financial_data} onChange={e => handleChange('display_financial_data', e.target.checked)} style={{ accentColor: 'var(--brand-primary)', width: 15, height: 15 }} />
        Show financial data in portal
      </label>

      {/* Notes */}
      <div className="form-section-title" style={{ marginTop: 16 }}>Notes</div>
      <div className="form-row full">
        <div className="form-group">
          <label className="form-label">Relationship History</label>
          <textarea rows={3} className="form-input" style={{ resize: 'vertical' }} value={formData.source_notes} onChange={e => handleChange('source_notes', e.target.value)} />
        </div>
      </div>
      <div className="form-row full">
        <div className="form-group">
          <label className="form-label">Notes</label>
          <textarea rows={3} className="form-input" style={{ resize: 'vertical' }} value={formData.notes} onChange={e => handleChange('notes', e.target.value)} />
        </div>
      </div>

      {/* Address */}
      <div className="form-section-title" style={{ marginTop: 8 }}>Address</div>
      <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: '#374151', marginBottom: 12, cursor: 'pointer' }}>
        <input type="checkbox" checked={formData.clone_primary_address} onChange={e => handleChange('clone_primary_address', e.target.checked)} style={{ accentColor: 'var(--brand-primary)', width: 15, height: 15 }} />
        Same address as partner
      </label>
      {!formData.clone_primary_address && (
        <>
          <div className="form-row full"><div className="form-group">
            <label className="form-label">Street Address</label>
            <input type="text" className="form-input" value={formData.address_street} onChange={e => handleChange('address_street', e.target.value)} />
          </div></div>
          <div className="form-row full"><div className="form-group">
            <label className="form-label">Street Address 2</label>
            <input type="text" className="form-input" value={formData.address_street2} onChange={e => handleChange('address_street2', e.target.value)} />
          </div></div>
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
          <div className="form-row full"><div className="form-group">
            <label className="form-label">Zip Code</label>
            <input type="text" className="form-input" value={formData.address_zip} onChange={e => handleChange('address_zip', e.target.value)} />
          </div></div>
        </>
      )}

      {error && (
        <div style={{ marginTop: 12, padding: '10px 12px', background: '#fff5f5', border: '1px solid #ffa8a8', borderRadius: 6, fontSize: 13, color: '#c92a2a' }}>
          {error}
        </div>
      )}

    </div>,

    // Footer
    <div style={{
      display: 'flex', justifyContent: 'flex-end', gap: 8,
      padding: '14px 24px', borderTop: '1px solid #e4e4e0',
      position: 'sticky', bottom: 0, background: 'white',
    }}>
      <button className="btn btn-ghost" onClick={() => setMode('view')} disabled={saving}>Cancel</button>
      <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
        {saving ? 'Saving...' : 'Save Changes'}
      </button>
    </div>
  )
}
