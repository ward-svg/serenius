'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import type { ReactNode } from 'react'
import type { Partner, PartnerContact } from '@/modules/partners/types'
import { createSupabaseBrowserClient } from '@/lib/supabase-browser'
import { formatPhone } from '@/lib/formatPhone'
import AddContactPanel from './AddContactPanel'
import ContactDetailModal from './ContactDetailModal'
import PartnerModal from './PartnerModal'
import FinancialTab from './FinancialTab'

type DetailTab = 'general' | 'financial' | 'inkind' | 'communications'

interface Props {
  slug: string
  initialPartner: Partner
  contacts: PartnerContact[]
  createdByName: string | null
  totalGiving: number
  givingYTD: number
  firstGiftDate: string | null
  googleMapsApiKey: string | null
}

function getInitials(name: string): string {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map(w => w[0].toUpperCase())
    .join('')
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '—'

  const d = new Date(dateStr)

  if (isNaN(d.getTime())) return '—'

  return d.toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  })
}

function fmtCurrency(n: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 2,
  }).format(n)
}

export default function PartnerDetailClient({
  slug,
  initialPartner,
  contacts: initialContacts,
  createdByName,
  totalGiving,
  givingYTD,
  firstGiftDate,
  googleMapsApiKey,
}: Props) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const initialTab = searchParams.get('tab') === 'financial' ? 'financial' : 'general'

  const [partner, setPartner] = useState<Partner>(initialPartner)
  const [activeTab, setActiveTab] = useState<DetailTab>(initialTab)
  const [contacts, setContacts] = useState<PartnerContact[]>(initialContacts)
  const [showAddContact, setShowAddContact] = useState(false)
  const [selectedContact, setSelectedContact] = useState<PartnerContact | null>(null)
  const [showPartnerModal, setShowPartnerModal] = useState(false)
  const [activePledgeCount, setActivePledgeCount] = useState(0)
  const [totalAnnualized, setTotalAnnualized] = useState(0)
  const [editingNotes, setEditingNotes] = useState(false)
  const [notesValue, setNotesValue] = useState(initialPartner.notes ?? '')
  const [savingNotes, setSavingNotes] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    if (editingNotes) textareaRef.current?.focus()
  }, [editingNotes])

  useEffect(() => {
    const supabase = createSupabaseBrowserClient()

    supabase
      .from('pledges')
      .select('annualized_value, status')
      .eq('partner_id', partner.id)
      .eq('tenant_id', partner.tenant_id)
      .eq('status', 'Active')
      .then(({ data }) => {
        setActivePledgeCount(data?.length ?? 0)
        setTotalAnnualized(
          data?.reduce((sum, p) => sum + (p.annualized_value ?? 0), 0) ?? 0
        )
      })
  }, [partner.id, partner.tenant_id])

  async function saveNotes() {
    setSavingNotes(true)

    const supabase = createSupabaseBrowserClient()

    await supabase
      .from('partners')
      .update({ notes: notesValue || null })
      .eq('id', partner.id)

    setSavingNotes(false)
    setEditingNotes(false)
  }

  const tabs: { key: DetailTab; label: string }[] = [
    { key: 'general', label: 'General Information' },
    { key: 'financial', label: 'Financial / Pledges' },
    { key: 'inkind', label: 'In-Kind Gifts' },
    { key: 'communications', label: 'Communications' },
  ]

  const addressParts = [
    partner.address_street,
    partner.address_city,
    partner.address_state,
    partner.address_zip,
  ].filter(Boolean) as string[]

  const mapsQuery =
    addressParts.length > 0 ? encodeURIComponent(addressParts.join(', ')) : null

  const mapsEmbedUrl =
    mapsQuery && googleMapsApiKey
      ? `https://www.google.com/maps/embed/v1/place?key=${googleMapsApiKey}&q=${mapsQuery}`
      : null

  return (
    <div style={{ maxWidth: 1200, margin: '0 auto' }}>
      {/* Tabs */}
      <div className="tab-row" style={{ marginBottom: 20 }}>
        {tabs.map(tab => (
          <button
            key={tab.key}
            className={`tab${activeTab === tab.key ? ' active' : ''}`}
            onClick={() => setActiveTab(tab.key)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* ── Tab 1: General Information ── */}
      {activeTab === 'general' && (
        <>
          {/* Partner Header Bar */}
          <div className="section-card" style={{ marginBottom: 12 }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 16,
                padding: '16px 20px',
              }}
            >
              <div
                style={{
                  width: 48,
                  height: 48,
                  borderRadius: '50%',
                  background: 'var(--color-background-info, #E6F1FB)',
                  color: 'var(--color-text-info, #185FA5)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 16,
                  fontWeight: 600,
                  flexShrink: 0,
                  letterSpacing: 0.5,
                }}
              >
                {getInitials(partner.display_name)}
              </div>

              <div style={{ flex: 1, minWidth: 0 }}>
                <h1
                  style={{
                    fontSize: 20,
                    fontWeight: 500,
                    color: '#1a1a1a',
                    marginBottom: 6,
                  }}
                >
                  {partner.display_name}
                </h1>

                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    flexWrap: 'wrap',
                    marginBottom: partner.correspondence_greeting ? 4 : 0,
                  }}
                >
                  {partner.partner_type && <PartnerTypeBadge type={partner.partner_type} />}
                  {partner.partner_type && (partner.partner_status || partner.relationship_type) && <Dot />}
                  {partner.partner_status && <StatusBadge status={partner.partner_status} />}
                  {partner.partner_status && partner.relationship_type && <Dot />}
                  {partner.relationship_type && <RelationshipBadge type={partner.relationship_type} />}
                  {(partner.partner_type || partner.partner_status || partner.relationship_type) && <Dot />}
                  <span style={{ fontSize: 11, color: '#9ca3af' }}>
                    Partner since {formatDate(partner.created_at)}
                  </span>
                </div>

                {partner.correspondence_greeting && (
                  <div style={{ fontSize: 12, color: '#9ca3af' }}>
                    Correspondence: {partner.correspondence_greeting}
                  </div>
                )}
              </div>

              <button
                className="btn btn-ghost btn-sm"
                onClick={() => setShowPartnerModal(true)}
              >
                Edit Partner
              </button>
            </div>
          </div>

          {/* KPI Cards */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(4, 1fr)',
              gap: 12,
              marginBottom: 12,
            }}
          >
            <div className="stat-card">
              <div className="stat-label">Lifetime Giving</div>
              <div
                className="stat-value"
                style={{
                  fontSize: 22,
                  color: totalGiving > 0 ? '#3B6D11' : '#9ca3af',
                }}
              >
                {fmtCurrency(totalGiving)}
              </div>
              <div className="stat-sub">
                {firstGiftDate
                  ? `Since ${new Date(firstGiftDate).toLocaleDateString('en-US', {
                      month: 'long',
                      year: 'numeric',
                    })}`
                  : 'No gifts recorded'}
              </div>
            </div>

            <div className="stat-card">
              <div className="stat-label">Giving YTD</div>
              <div
                className="stat-value"
                style={{
                  fontSize: 22,
                  color: givingYTD > 0 ? '#3B6D11' : '#9ca3af',
                }}
              >
                {fmtCurrency(givingYTD)}
              </div>
              <div className="stat-sub">2026 · current year</div>
            </div>

            <div className="stat-card">
              <div className="stat-label">Active Pledges</div>
              <div
                className="stat-value"
                style={{
                  fontSize: 22,
                  color: activePledgeCount > 0 ? '#3B6D11' : '#9ca3af',
                }}
              >
                {fmtCurrency(totalAnnualized)}
              </div>
              <div className="stat-sub">
                {activePledgeCount === 0
                  ? 'no active pledges'
                  : `${activePledgeCount} active ${
                      activePledgeCount === 1 ? 'pledge' : 'pledges'
                    }`}
              </div>
            </div>

            <div className="stat-card">
              <div className="stat-label">Engagement</div>
              <div className="stat-value" style={{ fontSize: 22, color: '#185FA5' }}>
                —
              </div>
              <div className="stat-sub">Engagement tracking coming soon</div>
            </div>
          </div>

          {/* Two-column: Partner Details + Location */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: 12,
              marginBottom: 12,
            }}
          >
            {/* Left: Partner Details */}
            <div className="section-card" style={{ marginBottom: 0 }}>
              <div className="section-header">
                <span className="section-title">Partner Details</span>
              </div>

              <div style={{ padding: '0 18px 8px' }}>
                <DetailRow label="Primary Contact" value={partner.display_name} />
                <DetailRow label="Correspondence" value={partner.correspondence_greeting} />

                <DetailRow
                  label="Primary Email"
                  value={
                    partner.primary_email ? (
                      <a href={`mailto:${partner.primary_email}`} className="email-link">
                        {partner.primary_email}
                      </a>
                    ) : null
                  }
                />

                <DetailRow
                  label="Primary Phone"
                  value={
                    partner.primary_phone ? (
                      <span>
                        <a
                          href={`tel:${partner.primary_phone}`}
                          style={{
                            color: 'var(--brand-primary, #3b5bdb)',
                            textDecoration: 'none',
                          }}
                        >
                          {formatPhone(partner.primary_phone)}
                        </a>
                        {partner.primary_phone_type && (
                          <span style={{ marginLeft: 6, fontSize: 11, color: '#9ca3af' }}>
                            ({partner.primary_phone_type})
                          </span>
                        )}
                      </span>
                    ) : null
                  }
                />

                <DetailRow
                  label="Secondary Phone"
                  value={
                    partner.secondary_phone ? (
                      <span>
                        <a
                          href={`tel:${partner.secondary_phone}`}
                          style={{
                            color: 'var(--brand-primary, #3b5bdb)',
                            textDecoration: 'none',
                          }}
                        >
                          {formatPhone(partner.secondary_phone)}
                        </a>
                        {partner.secondary_phone_type && (
                          <span style={{ marginLeft: 6, fontSize: 11, color: '#9ca3af' }}>
                            ({partner.secondary_phone_type})
                          </span>
                        )}
                      </span>
                    ) : null
                  }
                />

                <DetailRow label="Primary Address" value={<AddressBlock partner={partner} />} />

                <DetailRow
                  label="Partner Since"
                  value={<span style={{ fontSize: 12 }}>{formatDate(partner.created_at)}</span>}
                />

                <DetailRow
                  label="Added By"
                  value={
                    createdByName ? (
                      <span style={{ fontSize: 12, color: '#6b7280' }}>
                        {createdByName}
                      </span>
                    ) : null
                  }
                />
              </div>
            </div>

            {/* Right: Location */}
            <div
              className="section-card"
              style={{
                marginBottom: 0,
                display: 'flex',
                flexDirection: 'column',
                overflow: 'hidden',
              }}
            >
              <div className="section-header">
                <span className="section-title">Location</span>
                {mapsQuery && (
                  <a
                    href={`https://maps.google.com/?q=${mapsQuery}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      fontSize: 11,
                      color: 'var(--brand-primary, #3b5bdb)',
                      textDecoration: 'none',
                      marginLeft: 'auto',
                    }}
                  >
                    Open in Google Maps →
                  </a>
                )}
              </div>

              <div
                style={{
                  flex: 1,
                  minHeight: 260,
                  background: 'var(--color-background-secondary, #f5f5f2)',
                }}
              >
                {mapsEmbedUrl ? (
                  <iframe
                    title={`Map for ${partner.display_name}`}
                    src={mapsEmbedUrl}
                    width="100%"
                    height="100%"
                    style={{
                      border: 0,
                      minHeight: 260,
                      display: 'block',
                    }}
                    loading="lazy"
                    allowFullScreen
                    referrerPolicy="no-referrer-when-downgrade"
                  />
                ) : (
                  <div
                    style={{
                      minHeight: 260,
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 10,
                      padding: '20px 24px',
                      textAlign: 'center',
                    }}
                  >
                    <div
                      style={{
                        width: 40,
                        height: 40,
                        borderRadius: '50%',
                        background: 'var(--color-background-info, #E6F1FB)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <svg width="14" height="18" viewBox="0 0 14 18" fill="none">
                        <path
                          d="M7 0C3.13 0 0 3.13 0 7c0 4.875 7 11 7 11s7-6.125 7-11c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5S5.62 4.5 7 4.5s2.5 1.12 2.5 2.5S8.38 9.5 7 9.5z"
                          fill="var(--color-text-info, #185FA5)"
                        />
                      </svg>
                    </div>

                    <p
                      style={{
                        fontSize: 12,
                        color: '#6b7280',
                        maxWidth: 260,
                        lineHeight: 1.5,
                      }}
                    >
                      {mapsQuery
                        ? 'Google Maps API key is not configured for this tenant.'
                        : 'No address available for this partner.'}
                    </p>

                    {addressParts.length > 0 && (
                      <p style={{ fontSize: 10, color: '#9ca3af' }}>
                        {addressParts.join(', ')}
                      </p>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Notes */}
          <div className="section-card" style={{ marginBottom: 12 }}>
            <div className="section-header">
              <span className="section-title">Notes</span>
              {!editingNotes && (
                <div className="section-actions">
                  <button
                    className="btn-icon"
                    onClick={() => setEditingNotes(true)}
                    aria-label="Edit notes"
                  >
                    <svg
                      width="13"
                      height="13"
                      viewBox="0 0 13 13"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.5"
                    >
                      <path
                        d="M9 1.5l2.5 2.5L4 11.5H1.5V9L9 1.5z"
                        strokeLinejoin="round"
                      />
                    </svg>
                    Edit
                  </button>
                </div>
              )}
            </div>

            <div style={{ padding: '14px 18px' }}>
              {editingNotes ? (
                <>
                  <textarea
                    ref={textareaRef}
                    rows={5}
                    value={notesValue}
                    onChange={e => setNotesValue(e.target.value)}
                    className="form-input"
                    style={{
                      width: '100%',
                      resize: 'vertical',
                      fontSize: 13,
                      lineHeight: 1.6,
                    }}
                  />
                  <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                    <button
                      className="btn btn-ghost btn-sm"
                      onClick={saveNotes}
                      disabled={savingNotes}
                    >
                      {savingNotes ? 'Saving...' : 'Save'}
                    </button>
                    <button
                      className="btn btn-ghost btn-sm"
                      onClick={() => {
                        setNotesValue(partner.notes ?? '')
                        setEditingNotes(false)
                      }}
                      disabled={savingNotes}
                    >
                      Cancel
                    </button>
                  </div>
                </>
              ) : notesValue ? (
                <p
                  style={{
                    fontSize: 13,
                    lineHeight: 1.6,
                    color: '#1a1a1a',
                    whiteSpace: 'pre-wrap',
                  }}
                >
                  {notesValue}
                </p>
              ) : (
                <p style={{ fontSize: 13, color: '#9ca3af', fontStyle: 'italic' }}>
                  No notes added yet
                </p>
              )}
            </div>
          </div>

          {/* Contacts */}
          <div className="section-card" style={{ marginBottom: 20 }}>
            <div className="section-header">
              <span className="section-title">Contacts</span>
              <span className="section-count">{contacts.length}</span>
              <div className="section-actions">
                <button
                  className="btn btn-ghost btn-sm"
                  onClick={() => setShowAddContact(true)}
                >
                  + Add Contact
                </button>
              </div>
            </div>

            {contacts.length === 0 ? (
              <div
                style={{
                  padding: '32px 18px',
                  textAlign: 'center',
                  color: '#9ca3af',
                  fontSize: 13,
                }}
              >
                No contacts yet. Add the first contact.
              </div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table>
                  <thead>
                    <tr>
                      <th style={{ width: 80 }}>ACTIONS</th>
                      <th>Name</th>
                      <th>Nickname</th>
                      <th>Primary Phone</th>
                      <th>Email</th>
                      <th>Email Segment</th>
                      <th>Campaign</th>
                      <th>Relationship</th>
                    </tr>
                  </thead>

                  <tbody>
                    {contacts.map(c => (
                      <tr key={c.id}>
                        <td>
                          <button
                            type="button"
                            onClick={() => setSelectedContact(c)}
                            className="action-link"
                          >
                            View/Edit
                          </button>
                        </td>
                        <td style={{ fontWeight: 500 }}>
                          {[c.first_name, c.last_name].filter(Boolean).join(' ') || '—'}
                        </td>
                        <td>{c.nickname || '—'}</td>
                        <td>
                          {c.primary_phone ? (
                            <a
                              href={`tel:${c.primary_phone}`}
                              style={{
                                color: 'var(--brand-primary, #3b5bdb)',
                                textDecoration: 'none',
                              }}
                            >
                              {formatPhone(c.primary_phone)}
                            </a>
                          ) : (
                            '—'
                          )}
                        </td>
                        <td>
                          {c.primary_email ? (
                            <a href={`mailto:${c.primary_email}`} className="email-link">
                              {c.primary_email}
                            </a>
                          ) : (
                            '—'
                          )}
                        </td>
                        <td>{c.email_segment?.length ? c.email_segment.join(', ') : '—'}</td>
                        <td>{c.campaign_version || '—'}</td>
                        <td>{c.relationship ?? '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}

      {/* ── Tab 2: Financial / Pledges ── */}
      {activeTab === 'financial' && (
        <FinancialTab partnerId={partner.id} partner={partner} />
      )}

      {/* ── Tab 3: In-Kind Gifts ── */}
      {activeTab === 'inkind' && (
        <div className="section-card">
          <div className="section-header">
            <span className="section-title">In-Kind Gifts</span>
          </div>
          <div
            style={{
              padding: '32px 18px',
              textAlign: 'center',
              color: '#9ca3af',
              fontSize: 13,
            }}
          >
            In-Kind gifts coming soon.
          </div>
        </div>
      )}

      {/* ── Tab 4: Communications ── */}
      {activeTab === 'communications' && (
        <div className="section-card">
          <div className="section-header">
            <span className="section-title">Communications</span>
          </div>
          <div
            style={{
              padding: '32px 18px',
              textAlign: 'center',
              color: '#9ca3af',
              fontSize: 13,
            }}
          >
            Communications coming soon.
          </div>
        </div>
      )}

      {/* Back link */}
      <div style={{ paddingTop: 4, paddingBottom: 16 }}>
        <Link
          href={`/${slug}/partners`}
          style={{
            fontSize: 13,
            color: 'var(--brand-primary, #3b5bdb)',
            textDecoration: 'none',
          }}
        >
          ← Back to Partners
        </Link>
      </div>

      {/* Partner Modal */}
      {showPartnerModal && (
        <PartnerModal
          partner={partner}
          onClose={() => setShowPartnerModal(false)}
          onSuccess={updated => setPartner(updated)}
        />
      )}

      {/* Contact Detail Modal */}
      {selectedContact && (
        <ContactDetailModal
          contact={selectedContact}
          partner={partner}
          onClose={() => setSelectedContact(null)}
          onSuccess={updated => {
            setContacts(prev => prev.map(c => (c.id === updated.id ? updated : c)))
            setSelectedContact(updated)
          }}
        />
      )}

      {/* Add Contact Panel */}
      {showAddContact && (
        <AddContactPanel
          partnerId={partner.id}
          partner={partner}
          onClose={() => setShowAddContact(false)}
          onSuccess={() => router.refresh()}
        />
      )}
    </div>
  )
}

// ── Sub-components ──

function Dot() {
  return (
    <span
      style={{
        display: 'inline-block',
        width: 4,
        height: 4,
        borderRadius: '50%',
        background: 'var(--color-border-secondary, #e4e4e0)',
        flexShrink: 0,
      }}
    />
  )
}

function DetailRow({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: '140px 1fr',
        gap: 12,
        padding: '9px 0',
        borderBottom: '1px solid #f8f8f5',
        alignItems: 'flex-start',
      }}
    >
      <span style={{ fontSize: 12, fontWeight: 500, color: '#6b7280', paddingTop: 1 }}>
        {label}
      </span>
      <span style={{ fontSize: 13, color: '#1a1a1a', lineHeight: 1.5 }}>
        {value ?? <span style={{ color: '#d1d5db' }}>—</span>}
      </span>
    </div>
  )
}

function AddressBlock({ partner }: { partner: Partner }) {
  const lines = [
    partner.address_street,
    partner.address_street2,
    [partner.address_city, partner.address_state].filter(Boolean).join(', ') +
      (partner.address_zip ? ' ' + partner.address_zip : '') || null,
    partner.address_country && partner.address_country !== 'US'
      ? partner.address_country
      : null,
  ].filter(Boolean) as string[]

  if (lines.length === 0) return <span style={{ color: '#d1d5db' }}>—</span>

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      {lines.map((line, i) => (
        <span key={i}>{line}</span>
      ))}
    </div>
  )
}

function PartnerTypeBadge({ type }: { type: Partner['partner_type'] }) {
  if (!type) return null

  const cls: Record<string, string> = {
    Family: 'badge badge-family',
    Church: 'badge badge-church',
    Business: 'badge badge-business',
    Organization: 'badge badge-org',
    School: 'badge badge-school',
  }

  return <span className={cls[type] ?? 'badge'}>{type}</span>
}

function RelationshipBadge({ type }: { type: Partner['relationship_type'] }) {
  if (!type) return null

  return (
    <span className={type === 'Donor' ? 'badge badge-donor' : 'badge badge-prospect'}>
      {type}
    </span>
  )
}

function StatusBadge({ status }: { status: Partner['partner_status'] }) {
  if (!status) return null

  return (
    <span className={status === 'Active' ? 'badge badge-active' : 'badge badge-past'}>
      {status}
    </span>
  )
}
