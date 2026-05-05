'use client'

import type { PartnerContact } from '@/types/partners'

interface Props {
  contact: PartnerContact
  onClose: () => void
  onEdit: (contact: PartnerContact) => void
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
        padding: '9px 0 9px 0',
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
  return <a href={`tel:${value}`} className="action-link">{value}</a>
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
      {[
        [address_city, address_state].filter(Boolean).join(', '),
        address_zip,
      ].filter(Boolean).join(' ')}
    </span>
  )
}

export default function ContactDetailModal({ contact, onClose, onEdit }: Props) {
  function handleEdit() {
    onClose()
    onEdit(contact)
  }
  const fullName = [contact.first_name, contact.last_name].filter(Boolean).join(' ') || '—'

  return (
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
      onClick={onClose}
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

        {/* Modal header */}
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
              View Contact Details
            </div>
            <div style={{ fontSize: 15, fontWeight: 500, color: '#374151', marginTop: 3 }}>{fullName}</div>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              padding: 6, color: '#6b7280', display: 'flex', alignItems: 'center',
            }}
            aria-label="Close"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8">
              <path d="M2 2l12 12M14 2L2 14" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        {/* Two-column body */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: 0,
          padding: '20px 20px 0',
          borderBottom: '1px solid #e4e4e0',
        }}>

          {/* Left column */}
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

          {/* Right column */}
          <div style={{ paddingLeft: 16 }}>
            <div style={{ marginBottom: 14 }}>
              <button
                onClick={handleEdit}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  fontSize: 12,
                  fontWeight: 500,
                  padding: '6px 12px',
                  border: '1px solid #d1d5db',
                  borderRadius: 6,
                  background: 'white',
                  cursor: 'pointer',
                  color: '#374151',
                }}
              >
                <svg width="12" height="12" viewBox="0 0 13 13" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <path d="M9 1.5l2.5 2.5L4 11.5H1.5V9L9 1.5z" strokeLinejoin="round" />
                </svg>
                Edit Contact
              </button>
            </div>

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

        {/* Family Connect section */}
        <div style={{ padding: '20px 20px 24px' }}>
          <div style={{
            fontSize: 14,
            fontWeight: 600,
            color: '#1f2937',
            marginTop: 8,
            marginBottom: 12,
            paddingTop: 16,
            borderTop: '1px solid #e5e7eb',
          }}>
            Family Connect Details
          </div>

          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <tbody>
              <Row
                label="Sponsored Children"
                value={<span style={{ color: '#d1d5db' }}>—</span>}
                // TODO: link to sponsored_children table
              />
              <Row
                label="Show Financial Data in Portal"
                value={contact.display_financial_data ? 'Yes' : 'No'}
              />
            </tbody>
          </table>

          <div style={{
            marginTop: 12,
            padding: '12px 14px',
            background: '#f8f8f6',
            borderRadius: 6,
            border: '1px solid #e4e4e0',
          }}>
            <div style={{ fontSize: 12, color: '#9ca3af', fontStyle: 'italic' }}>
              Family Connect portal coming soon
            </div>
          </div>
        </div>

      </div>
    </div>
  )
}
