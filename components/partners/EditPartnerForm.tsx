'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createSupabaseBrowserClient } from '@/lib/supabase-browser'
import type { Partner } from '@/types/partners'

interface Props {
  partner: Partner
  slug: string
}

const ENTITY_TYPES = ['Church', 'Business', 'Organization', 'School']
const CHANNELS = ['Facebook', 'Instagram', 'Email']

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '—'
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'long', day: 'numeric', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

export default function EditPartnerForm({ partner, slug }: Props) {
  const router = useRouter()

  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [partnerType, setPartnerType] = useState(partner.partner_type ?? '')
  const [selectedChannels, setSelectedChannels] = useState<string[]>(
    partner.social_channels ?? []
  )
  const [formData, setFormData] = useState({
    display_name: partner.display_name ?? '',
    entity_name: partner.entity_name ?? '',
    correspondence_greeting: partner.correspondence_greeting ?? '',
    partner_type: partner.partner_type ?? '',
    partner_status: partner.partner_status ?? '',
    relationship_type: partner.relationship_type ?? '',
    primary_email: partner.primary_email ?? '',
    secondary_email: partner.secondary_email ?? '',
    primary_phone: partner.primary_phone ?? '',
    primary_phone_type: partner.primary_phone_type ?? '',
    secondary_phone: partner.secondary_phone ?? '',
    secondary_phone_type: partner.secondary_phone_type ?? '',
    address_street: partner.address_street ?? '',
    address_street2: partner.address_street2 ?? '',
    address_city: partner.address_city ?? '',
    address_state: partner.address_state ?? '',
    address_zip: partner.address_zip ?? '',
    address_country: partner.address_country ?? '',
  })

  const isEntityType = ENTITY_TYPES.includes(partnerType)

  function toggleChannel(channel: string) {
    setSelectedChannels(prev =>
      prev.includes(channel)
        ? prev.filter(c => c !== channel)
        : [...prev, channel]
    )
  }

  function handleChange(field: string, value: string) {
    setFormData(prev => ({ ...prev, [field]: value }))
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setSaving(true)
    setError(null)

    const supabase = createSupabaseBrowserClient()

    const { error: updateError } = await supabase
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
        primary_phone: formData.primary_phone || null,
        primary_phone_type: formData.primary_phone_type || null,
        secondary_phone: formData.secondary_phone || null,
        secondary_phone_type: formData.secondary_phone_type || null,
        address_street: formData.address_street || null,
        address_street2: formData.address_street2 || null,
        address_city: formData.address_city || null,
        address_state: formData.address_state || null,
        address_zip: formData.address_zip || null,
        address_country: formData.address_country || null,
        social_channels: selectedChannels,
        updated_at: new Date().toISOString(),
      })
      .eq('id', partner.id)

    setSaving(false)

    if (updateError) {
      setError(updateError.message)
      return
    }

    router.push(`/${slug}/partners/${partner.id}`)
    router.refresh()
  }

  return (
    <div style={{ maxWidth: 800, margin: '0 auto', paddingBottom: 80 }}>

      {/* Back link */}
      <div style={{ marginBottom: 16 }}>
        <Link
          href={`/${slug}/partners/${partner.id}`}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 4,
            fontSize: 13,
            color: 'var(--brand-primary)',
            textDecoration: 'none',
          }}
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M9 2L4 7l5 5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          {partner.display_name}
        </Link>
      </div>

      {/* Page header */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 20, fontWeight: 500, color: '#111827' }}>Edit Partner</div>
        <div style={{ fontSize: 13, color: '#9ca3af', marginTop: 2 }}>{partner.display_name}</div>
      </div>

      {/* Form card */}
      <form id="edit-partner-form" onSubmit={handleSubmit} className="section-card" style={{ padding: '20px 24px' }}>

        {/* Section 1: Classification */}
        <div className="form-section-title">Classification</div>

        <div className="form-row">
          <div className="form-group">
            <label className="form-label">Partner Type</label>
            <select
              name="partner_type"
              className="form-input"
              value={partnerType}
              onChange={e => {
                setPartnerType(e.target.value)
                handleChange('partner_type', e.target.value)
              }}
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
            <label className="form-label">Partner Status</label>
            <select
              name="partner_status"
              className="form-input"
              value={formData.partner_status}
              onChange={e => handleChange('partner_status', e.target.value)}
            >
              <option value="">Select...</option>
              <option>Active</option>
              <option>Past</option>
            </select>
          </div>
        </div>

        <div className="form-row">
          <div className="form-group">
            <label className="form-label">Relationship Type</label>
            <select
              name="relationship_type"
              className="form-input"
              value={formData.relationship_type}
              onChange={e => handleChange('relationship_type', e.target.value)}
            >
              <option value="">Select...</option>
              <option>Donor</option>
              <option>Prospect</option>
            </select>
          </div>
          {isEntityType && (
            <div className="form-group">
              <label className="form-label">Entity Name</label>
              <input
                type="text"
                name="entity_name"
                className="form-input"
                placeholder="Organization or church name"
                value={formData.entity_name}
                onChange={e => handleChange('entity_name', e.target.value)}
              />
            </div>
          )}
        </div>

        {/* Section 2: Identity */}
        <div className="form-section-title" style={{ marginTop: 20 }}>Identity</div>

        <div className="form-row full">
          <div className="form-group">
            <label className="form-label">Display Name</label>
            <input
              type="text"
              name="display_name"
              className="form-input"
              value={formData.display_name}
              onChange={e => handleChange('display_name', e.target.value)}
            />
            <span className="form-hint">The name shown throughout the system</span>
          </div>
        </div>

        <div className="form-row full">
          <div className="form-group">
            <label className="form-label">Correspondence Greeting</label>
            <input
              type="text"
              name="correspondence_greeting"
              className="form-input"
              placeholder="e.g. Matt and Amber"
              value={formData.correspondence_greeting}
              onChange={e => handleChange('correspondence_greeting', e.target.value)}
            />
            <span className="form-hint">Used in letters and email salutations e.g. Matt and Amber</span>
          </div>
        </div>

        {/* Section 3: Contact Info */}
        <div className="form-section-title" style={{ marginTop: 20 }}>Contact Info</div>

        <div className="form-row full">
          <div className="form-group">
            <label className="form-label">Primary Email</label>
            <input
              type="email"
              name="primary_email"
              className="form-input"
              value={formData.primary_email}
              onChange={e => handleChange('primary_email', e.target.value)}
            />
          </div>
        </div>

        <div className="form-row">
          <div className="form-group">
            <label className="form-label">Primary Phone</label>
            <input
              type="tel"
              name="primary_phone"
              className="form-input"
              value={formData.primary_phone}
              onChange={e => handleChange('primary_phone', e.target.value)}
            />
          </div>
          <div className="form-group">
            <label className="form-label">Type</label>
            <select
              name="primary_phone_type"
              className="form-input"
              value={formData.primary_phone_type}
              onChange={e => handleChange('primary_phone_type', e.target.value)}
            >
              <option value="">Select...</option>
              <option>Mobile</option>
              <option>Home</option>
              <option>Work</option>
              <option>Other</option>
            </select>
          </div>
        </div>

        <div className="form-row">
          <div className="form-group">
            <label className="form-label">Secondary Phone</label>
            <input
              type="tel"
              name="secondary_phone"
              className="form-input"
              value={formData.secondary_phone}
              onChange={e => handleChange('secondary_phone', e.target.value)}
            />
          </div>
          <div className="form-group">
            <label className="form-label">Type</label>
            <select
              name="secondary_phone_type"
              className="form-input"
              value={formData.secondary_phone_type}
              onChange={e => handleChange('secondary_phone_type', e.target.value)}
            >
              <option value="">Select...</option>
              <option>Mobile</option>
              <option>Home</option>
              <option>Work</option>
              <option>Other</option>
            </select>
          </div>
        </div>

        {/* Section 4: Address */}
        <div className="form-section-title" style={{ marginTop: 20 }}>Address</div>

        <div className="form-row full">
          <div className="form-group">
            <label className="form-label">Street Address</label>
            <input
              type="text"
              name="address_street"
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
              name="address_street2"
              className="form-input"
              placeholder="Apt, Suite, etc."
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
              name="address_city"
              className="form-input"
              value={formData.address_city}
              onChange={e => handleChange('address_city', e.target.value)}
            />
          </div>
          <div className="form-group">
            <label className="form-label">State</label>
            <input
              type="text"
              name="address_state"
              className="form-input"
              value={formData.address_state}
              onChange={e => handleChange('address_state', e.target.value)}
            />
          </div>
        </div>

        <div className="form-row">
          <div className="form-group">
            <label className="form-label">Zip Code</label>
            <input
              type="text"
              name="address_zip"
              className="form-input"
              value={formData.address_zip}
              onChange={e => handleChange('address_zip', e.target.value)}
            />
          </div>
          <div className="form-group">
            <label className="form-label">Country</label>
            <input
              type="text"
              name="address_country"
              className="form-input"
              placeholder="US"
              value={formData.address_country}
              onChange={e => handleChange('address_country', e.target.value)}
            />
          </div>
        </div>

        {/* Section 5: Engagement & Social Channels */}
        <div className="form-section-title" style={{ marginTop: 20 }}>Engagement & Social Channels</div>
        <p style={{ fontSize: 12, color: '#9ca3af', margin: '4px 0 0' }}>
          Track which platforms this partner is active on. Used to calculate engagement score.
        </p>

        <div style={{ display: 'flex', gap: 24, marginTop: 10 }}>
          {CHANNELS.map(option => (
            <label
              key={option}
              style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13, color: '#374151' }}
            >
              <input
                type="checkbox"
                checked={selectedChannels.includes(option)}
                onChange={() => toggleChannel(option)}
                style={{ accentColor: 'var(--brand-primary)', width: 15, height: 15 }}
              />
              {option}
            </label>
          ))}
        </div>

      </form>

      {/* Error banner */}
      {error && (
        <div style={{
          padding: '10px 12px',
          background: '#fff5f5',
          border: '1px solid #ffa8a8',
          borderRadius: 6,
          fontSize: 13,
          color: '#c92a2a',
          margin: '0 0 12px',
        }}>
          {error}
        </div>
      )}

      {/* Sticky footer */}
      <div style={{
        position: 'sticky',
        bottom: 0,
        background: 'white',
        borderTop: '1px solid #e4e4e0',
        padding: '14px 24px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginLeft: -24,
        marginRight: -24,
      }}>
        <span style={{ fontSize: 12, color: '#9ca3af' }}>
          Last updated {formatDate(partner.updated_at)}
        </span>
        <div style={{ display: 'flex', gap: 8 }}>
          <Link href={`/${slug}/partners/${partner.id}`} className="btn btn-ghost">
            Cancel
          </Link>
          <button
            type="submit"
            form="edit-partner-form"
            className="btn btn-primary"
            disabled={saving}
          >
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </div>

    </div>
  )
}
