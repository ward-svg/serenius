'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createSupabaseBrowserClient } from '@/lib/supabase-browser'

interface Props {
  orgId: string | null
  slug: string
  onClose: () => void
  onSuccess: () => void
}

interface ContactCard {
  id: string
  included: boolean
  name_first: string
  name_last: string
  relationship: string
  email: string
  phone: string
  phone_type: string
  clone_address: boolean
}

const ENTITY_TYPES = ['Church', 'Business', 'Organization', 'School']

function parseContacts(
  nameFirst: string,
  nameLast: string,
  email: string,
  phone: string,
  phoneType: string,
): ContactCard[] {
  const paired = nameFirst.match(/^(.+?)\s+(?:&|and)\s+(.+?)$/i)
  if (paired) {
    return [
      {
        id: '1',
        included: true,
        name_first: paired[1].trim(),
        name_last: nameLast,
        relationship: 'Husband',
        email,
        phone,
        phone_type: phoneType,
        clone_address: true,
      },
      {
        id: '2',
        included: true,
        name_first: paired[2].trim(),
        name_last: nameLast,
        relationship: 'Wife',
        email: '',
        phone: '',
        phone_type: '',
        clone_address: true,
      },
    ]
  }
  return [
    {
      id: '1',
      included: true,
      name_first: nameFirst,
      name_last: nameLast,
      relationship: 'Self',
      email,
      phone,
      phone_type: phoneType,
      clone_address: true,
    },
  ]
}

export default function AddPartnerPanel({ orgId, slug: _slug, onClose, onSuccess }: Props) {
  const router = useRouter()
  const supabase = createSupabaseBrowserClient()

  const [step, setStep] = useState<1 | 2>(1)
  const [partnerType, setPartnerType] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [partnerId, setPartnerId] = useState<number | null>(null)
  const [partnerAddress, setPartnerAddress] = useState<{
    street1: string | null
    street2: string | null
    city: string | null
    state: string | null
    zip: string | null
  }>({ street1: null, street2: null, city: null, state: null, zip: null })
  const [contacts, setContacts] = useState<ContactCard[]>([])

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [onClose])

  const isEntityType = ENTITY_TYPES.includes(partnerType)

  async function handleStep1Submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    setSaving(true)

    const fd = new FormData(e.currentTarget)
    const str = (key: string) => (fd.get(key) as string ?? '').trim()
    const strOrNull = (key: string) => str(key) || null

    const nameFirst = str('name_first')
    const nameLast = str('name_last')
    const entityName = strOrNull('entity_name')
    const email = str('primary_email')
    const phone = str('primary_phone')
    const phoneType = str('primary_phone_type')
    const street1 = strOrNull('street1')
    const street2 = strOrNull('street2')
    const city = strOrNull('city')
    const state = strOrNull('state')
    const zip = strOrNull('zip')

    const displayName = isEntityType
      ? (entityName ?? `${nameFirst} ${nameLast}`.trim())
      : `${nameFirst}${nameLast ? ' ' + nameLast : ''}`.trim()

    const { data: inserted, error: insertError } = await supabase
      .from('partners')
      .insert({
        display_name: displayName,
        correspondence_greeting: strOrNull('correspondence_greeting'),
        entity_name: entityName,
        partner_type: partnerType || null,
        partner_status: strOrNull('partner_status'),
        relationship_type: strOrNull('relationship_type'),
        primary_email: email || null,
        primary_phone: phone || null,
        primary_phone_type: phoneType || null,
        secondary_phone: strOrNull('secondary_phone'),
        secondary_phone_type: strOrNull('secondary_phone_type'),
        street1,
        street2,
        city,
        state,
        zip,
        mailing_list: strOrNull('mailing_list'),
        tenant_id: orgId,
        total_giving: 0,
        giving_2023: 0,
        giving_2024: 0,
        giving_2025: 0,
        giving_2026: 0,
      })
      .select('id')
      .single()

    setSaving(false)

    if (insertError || !inserted) {
      setError(insertError?.message ?? 'Failed to save partner.')
      return
    }

    setPartnerId(inserted.id)
    setPartnerAddress({ street1, street2, city, state, zip })
    setContacts(parseContacts(nameFirst, nameLast, email, phone, phoneType))
    setStep(2)
  }

  async function handleStep2Submit() {
    if (!partnerId) return
    setSaving(true)
    setError(null)

    const included = contacts.filter(c => c.included)
    const rows = included.map(c => ({
      tenant_id: orgId,
      partner_id: partnerId,
      name_first: c.name_first || null,
      name_last: c.name_last || null,
      email: c.email || null,
      primary_phone: c.phone || null,
      primary_phone_type: c.phone_type || null,
      relationship: c.relationship || null,
      clone_primary_address: c.clone_address,
      ...(c.clone_address
        ? partnerAddress
        : { street1: null, street2: null, city: null, state: null, zip: null }),
    }))

    const { error: contactError } = await supabase.from('partner_contacts').insert(rows)
    setSaving(false)

    if (contactError) {
      setError(contactError.message)
      return
    }

    onSuccess()
    router.refresh()
  }

  function updateContact(id: string, field: keyof ContactCard, value: string | boolean) {
    setContacts(prev => prev.map(c => c.id === id ? { ...c, [field]: value } : c))
  }

  const includedCount = contacts.filter(c => c.included).length

  return (
    <>
      <div className="panel-overlay" onClick={onClose} />
      <div className="panel">

        {/* Header */}
        <div className="panel-header">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <h2>{step === 1 ? 'Add New Partner' : 'Add Contacts'}</h2>
            {step === 2 && (
              <span style={{ fontSize: 11, color: '#9ca3af' }}>
                Step 2 of 2 — review and confirm contacts
              </span>
            )}
          </div>
          <button className="panel-close" onClick={onClose} aria-label="Close panel">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M1 1l12 12M13 1L1 13" />
            </svg>
          </button>
        </div>

        {/* ── Step 1: Partner form ── */}
        {step === 1 && (
          <>
            <form id="add-partner-form" onSubmit={handleStep1Submit} className="panel-body">

              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Partner Type *</label>
                  <select
                    name="partner_type"
                    required
                    className="form-input"
                    value={partnerType}
                    onChange={e => setPartnerType(e.target.value)}
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
                  <select name="partner_status" required className="form-input">
                    <option value="">Select...</option>
                    <option>Active</option>
                    <option>Past</option>
                  </select>
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Relationship Type *</label>
                  <select name="relationship_type" required className="form-input">
                    <option value="">Select...</option>
                    <option>Donor</option>
                    <option>Prospect</option>
                  </select>
                </div>
                {isEntityType && (
                  <div className="form-group">
                    <label className="form-label">Entity Name *</label>
                    <input
                      name="entity_name"
                      type="text"
                      placeholder="Organization name"
                      className="form-input"
                      required
                    />
                  </div>
                )}
              </div>

              <div className="form-section-title">
                {isEntityType ? 'Primary Contact Person' : 'Primary Contact'}
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">First Name</label>
                  <input name="name_first" type="text" placeholder="First" className="form-input" />
                  {!isEntityType && (
                    <span className="form-hint">Tip: "Matt and Amber" creates 2 contacts</span>
                  )}
                </div>
                <div className="form-group">
                  <label className="form-label">Last Name</label>
                  <input name="name_last" type="text" placeholder="Last" className="form-input" />
                </div>
              </div>

              <div className="form-row full">
                <div className="form-group">
                  <label className="form-label">Correspondence Greeting</label>
                  <input
                    name="correspondence_greeting"
                    type="text"
                    placeholder="e.g. Matt and Amber"
                    className="form-input"
                  />
                  <span className="form-hint">Used in letters and email salutations</span>
                </div>
              </div>

              <div className="form-section-title">Contact Info</div>

              <div className="form-row full">
                <div className="form-group">
                  <label className="form-label">Primary Email</label>
                  <input name="primary_email" type="email" placeholder="email@example.com" className="form-input" />
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Primary Phone</label>
                  <input name="primary_phone" type="tel" placeholder="(___) ___-____" className="form-input" />
                </div>
                <div className="form-group">
                  <label className="form-label">Phone Type</label>
                  <select name="primary_phone_type" className="form-input">
                    <option value="">Select...</option>
                    <option>Mobile</option>
                    <option>Home</option>
                    <option>Work</option>
                  </select>
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Secondary Phone</label>
                  <input name="secondary_phone" type="tel" placeholder="(___) ___-____" className="form-input" />
                </div>
                <div className="form-group">
                  <label className="form-label">Phone Type</label>
                  <select name="secondary_phone_type" className="form-input">
                    <option value="">Select...</option>
                    <option>Mobile</option>
                    <option>Home</option>
                    <option>Work</option>
                  </select>
                </div>
              </div>

              <div className="form-section-title">Address</div>

              <div className="form-row full">
                <div className="form-group">
                  <label className="form-label">Street Address</label>
                  <input name="street1" type="text" placeholder="123 Main St" className="form-input" />
                </div>
              </div>
              <div className="form-row full">
                <div className="form-group">
                  <label className="form-label">Street Address 2</label>
                  <input name="street2" type="text" placeholder="Apt, Suite, etc." className="form-input" />
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">City</label>
                  <input name="city" type="text" className="form-input" />
                </div>
                <div className="form-group">
                  <label className="form-label">State</label>
                  <input name="state" type="text" className="form-input" />
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Zip Code</label>
                  <input name="zip" type="text" className="form-input" />
                </div>
                <div className="form-group">
                  <label className="form-label">Mailing List</label>
                  <select name="mailing_list" className="form-input">
                    <option value="">Select...</option>
                    <option>Newsletter</option>
                    <option>House Updates</option>
                    <option value="Newsletter, House Updates">Newsletter, House Updates</option>
                  </select>
                </div>
              </div>

              {error && <ErrorBanner message={error} />}
            </form>

            <div className="panel-footer">
              <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
              <button type="submit" form="add-partner-form" className="btn btn-primary" disabled={saving}>
                {saving ? 'Saving...' : 'Save & Continue →'}
              </button>
            </div>
          </>
        )}

        {/* ── Step 2: Contact cards ── */}
        {step === 2 && (
          <>
            <div className="panel-body">
              <p style={{ fontSize: 13, color: '#6b7280', marginBottom: 20 }}>
                {contacts.length === 1
                  ? 'We generated 1 contact from the partner record. Review and edit before saving.'
                  : `We generated ${contacts.length} contacts from the partner record. Review and edit before saving.`}
              </p>

              {contacts.map((contact, idx) => (
                <ContactCardItem
                  key={contact.id}
                  contact={contact}
                  index={idx}
                  onUpdate={(field, value) => updateContact(contact.id, field, value)}
                />
              ))}

              {error && <ErrorBanner message={error} />}
            </div>

            <div className="panel-footer">
              <button
                type="button"
                onClick={onSuccess}
                style={{
                  fontSize: 12,
                  color: '#9ca3af',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  marginRight: 'auto',
                  padding: '7px 0',
                }}
              >
                Skip — I'll add contacts later
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={handleStep2Submit}
                disabled={saving || includedCount === 0}
              >
                {saving
                  ? 'Saving...'
                  : `Create ${includedCount} Contact${includedCount !== 1 ? 's' : ''} & Finish`}
              </button>
            </div>
          </>
        )}
      </div>
    </>
  )
}

function ContactCardItem({
  contact,
  index,
  onUpdate,
}: {
  contact: ContactCard
  index: number
  onUpdate: (field: keyof ContactCard, value: string | boolean) => void
}) {
  return (
    <div style={{
      border: '1px solid #e0e0db',
      borderRadius: 8,
      marginBottom: 16,
      overflow: 'hidden',
      opacity: contact.included ? 1 : 0.55,
      transition: 'opacity 0.15s',
    }}>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        padding: '9px 14px',
        background: '#fafaf8',
        borderBottom: contact.included ? '1px solid #f0f0eb' : 'none',
      }}>
        <span style={{ fontSize: 12, fontWeight: 500, color: '#6b7280' }}>
          Contact {index + 1}
        </span>
        <button
          type="button"
          onClick={() => onUpdate('included', !contact.included)}
          style={{
            marginLeft: 'auto',
            fontSize: 11,
            fontWeight: 500,
            padding: '2px 10px',
            borderRadius: 10,
            border: '1px solid',
            cursor: 'pointer',
            background: contact.included ? '#ebfbee' : '#f8f9fa',
            color: contact.included ? '#2f9e44' : '#868e96',
            borderColor: contact.included ? '#b2f2bb' : '#dee2e6',
          }}
        >
          {contact.included ? 'Included' : 'Excluded'}
        </button>
      </div>

      {contact.included && (
        <div style={{ padding: 14 }}>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">First Name</label>
              <input
                type="text"
                className="form-input"
                value={contact.name_first}
                onChange={e => onUpdate('name_first', e.target.value)}
              />
            </div>
            <div className="form-group">
              <label className="form-label">Last Name</label>
              <input
                type="text"
                className="form-input"
                value={contact.name_last}
                onChange={e => onUpdate('name_last', e.target.value)}
              />
            </div>
          </div>

          <div className="form-row full">
            <div className="form-group">
              <label className="form-label">Relationship</label>
              <select
                className="form-input"
                value={contact.relationship}
                onChange={e => onUpdate('relationship', e.target.value)}
              >
                <option value="">Select...</option>
                <option>Self</option>
                <option>Husband</option>
                <option>Wife</option>
                <option>Partner</option>
                <option>Son</option>
                <option>Daughter</option>
                <option>Other</option>
              </select>
            </div>
          </div>

          <div className="form-row full">
            <div className="form-group">
              <label className="form-label">Email</label>
              <input
                type="email"
                className="form-input"
                value={contact.email}
                onChange={e => onUpdate('email', e.target.value)}
              />
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Phone</label>
              <input
                type="tel"
                className="form-input"
                value={contact.phone}
                onChange={e => onUpdate('phone', e.target.value)}
              />
            </div>
            <div className="form-group">
              <label className="form-label">Phone Type</label>
              <select
                className="form-input"
                value={contact.phone_type}
                onChange={e => onUpdate('phone_type', e.target.value)}
              >
                <option value="">Select...</option>
                <option>Mobile</option>
                <option>Home</option>
                <option>Work</option>
              </select>
            </div>
          </div>

          <label style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            fontSize: 12,
            color: '#6b7280',
            cursor: 'pointer',
            marginTop: 4,
          }}>
            <input
              type="checkbox"
              checked={contact.clone_address}
              onChange={e => onUpdate('clone_address', e.target.checked)}
              style={{ accentColor: 'var(--brand-primary, #3b5bdb)', width: 14, height: 14 }}
            />
            Clone address from partner
          </label>
        </div>
      )}
    </div>
  )
}

function ErrorBanner({ message }: { message: string }) {
  return (
    <div style={{
      marginTop: 12,
      padding: '10px 12px',
      background: '#fff5f5',
      border: '1px solid #ffa8a8',
      borderRadius: 6,
      fontSize: 13,
      color: '#c92a2a',
    }}>
      {message}
    </div>
  )
}
