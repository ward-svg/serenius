'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import type { Partner, PartnerContact, PartnerTab } from '@/types/partners'

function fmt(n: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 2 }).format(n)
}
function fmtK(n: number) {
  if (n >= 1000000) return '$' + (n / 1000000).toFixed(1) + 'M'
  if (n >= 1000) return '$' + (n / 1000).toFixed(1) + 'K'
  return fmt(n)
}

const MONTHLY_PARTNERS = [
  { name: 'Dennis and Vicki McMillen', monthly: 500, annual: 6000, start: '04/01/2025', type: 'Rescue Care' },
  { name: 'John Lopez', monthly: 1000, annual: 12000, start: '12/07/2024', type: 'Rescue Care' },
  { name: 'Matt and Amber Campbell', monthly: 1500, annual: 18000, start: '09/05/2024', type: 'Rescue Care' },
  { name: 'Nancy and Ed Anders', monthly: 100, annual: 1200, start: '12/01/2024', type: 'Rescue Care' },
  { name: 'Ward McMillen', monthly: 500, annual: 6000, start: '08/01/2024', type: 'Rescue Care' },
  { name: 'Ward McMillen', monthly: 35, annual: 420, start: '04/26/2026', type: 'Pathways Sponsorship' },
]

interface Props {
  stats: { total: number; activeDonors: number; prospects: number; totalGiving: number; giving2026: number }
  activeDonors: Partner[]
  prospects: Partner[]
  pastPartners: Partner[]
  staff: PartnerContact[]
}

export default function PartnersClient({ stats, activeDonors, prospects, pastPartners, staff }: Props) {
  const [activeTab, setActiveTab] = useState<PartnerTab>('active')
  const [search, setSearch] = useState('')
  const [showPanel, setShowPanel] = useState(false)

  const filtered = useMemo(() => {
    if (!search) return activeDonors
    const q = search.toLowerCase()
    return activeDonors.filter(p =>
      p.display_name.toLowerCase().includes(q) ||
      (p.city ?? '').toLowerCase().includes(q) ||
      (p.primary_email ?? '').toLowerCase().includes(q)
    )
  }, [activeDonors, search])

  const monthlyTotals = MONTHLY_PARTNERS.reduce(
    (a, b) => ({ monthly: a.monthly + b.monthly, annual: a.annual + b.annual }),
    { monthly: 0, annual: 0 }
  )

  const rowCount = activeTab === 'active' ? filtered.length
    : activeTab === 'prospects' ? prospects.length
    : activeTab === 'staff' ? staff.length
    : pastPartners.length

  const totalCount = activeTab === 'active' ? activeDonors.length
    : activeTab === 'prospects' ? prospects.length
    : activeTab === 'staff' ? staff.length
    : pastPartners.length

  return (
    <div style={{ maxWidth: 1400, margin: '0 auto' }}>

      {/* Page header */}
      <div className="page-header">
        <div>
          <div className="page-title">Partner Management</div>
          <div className="page-subtitle">WellSpring Rescue — all partners, donors and prospects</div>
        </div>
        <button className="btn btn-primary btn-sm" onClick={() => setShowPanel(true)}>
          <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor">
            <path d="M6 1v10M1 6h10" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
          </svg>
          Add Partner
        </button>
      </div>

      {/* Stats */}
      <div className="stats-row">
        <div className="stat-card">
          <div className="stat-label">Total Partners</div>
          <div className="stat-value blue">{stats.total}</div>
          <div className="stat-sub">{stats.activeDonors} active donors</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Total Giving</div>
          <div className="stat-value green">{fmtK(stats.totalGiving)}</div>
          <div className="stat-sub">All time</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">2026 Giving</div>
          <div className="stat-value">{fmtK(stats.giving2026)}</div>
          <div className="stat-sub">Current year</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Prospects</div>
          <div className="stat-value amber">{stats.prospects}</div>
          <div className="stat-sub">Active prospects</div>
        </div>
      </div>

      {/* Monthly Partners */}
      <div className="section-card">
        <div className="section-header">
          <span className="section-title">Monthly Partners</span>
          <span className="section-count">{MONTHLY_PARTNERS.length} active pledges</span>
          <div className="section-actions">
            <button className="btn btn-ghost btn-sm">Export</button>
          </div>
        </div>
        <table className="monthly-table">
          <thead>
            <tr>
              <th>Partner / Record Gift</th>
              <th>Monthly Gift</th>
              <th>Annualized Value</th>
              <th>Start Date</th>
              <th>Pledge Type</th>
            </tr>
          </thead>
          <tbody>
            {MONTHLY_PARTNERS.map((p, i) => (
              <tr key={i}>
                <td><span className="partner-link">{p.name}</span></td>
                <td className="money">{fmt(p.monthly)}</td>
                <td className="money">{fmt(p.annual)}</td>
                <td>{p.start}</td>
                <td>{p.type}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="monthly-total">
              <td>Total</td>
              <td className="money">{fmt(monthlyTotals.monthly)}</td>
              <td className="money">{fmt(monthlyTotals.annual)}</td>
              <td /><td />
            </tr>
          </tfoot>
        </table>
      </div>

      {/* Main partners table */}
      <div className="section-card">

        {/* Tabs */}
        <div className="tab-row">
          {([
            { key: 'active' as PartnerTab, label: 'Active Partners', count: activeDonors.length },
            { key: 'prospects' as PartnerTab, label: 'Prospects', count: prospects.length },
            { key: 'staff' as PartnerTab, label: 'Staff / Volunteers', count: staff.length },
            { key: 'past' as PartnerTab, label: 'Past Relationships', count: pastPartners.length },
          ]).map(tab => (
            <button
              key={tab.key}
              className={`tab${activeTab === tab.key ? ' active' : ''}`}
              onClick={() => { setActiveTab(tab.key); setSearch('') }}
            >
              {tab.label} <span style={{
                marginLeft: 4,
                fontSize: 10,
                padding: '1px 6px',
                borderRadius: 10,
                background: activeTab === tab.key ? '#e7edff' : '#f0f0eb',
                color: activeTab === tab.key ? '#3b5bdb' : '#6b7280',
              }}>{tab.count}</span>
            </button>
          ))}
        </div>

        {/* Toolbar */}
        <div className="table-toolbar">
          <div className="search-wrap">
            <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
              <circle cx="7" cy="7" r="4"/><path d="M10.5 10.5l3 3"/>
            </svg>
            <input
              type="text"
              placeholder="Search partners..."
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
          <button className="filter-btn">
            <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor">
              <path d="M1 2h10L7 6v4L5 9V6L1 2z"/>
            </svg>
            Filters
          </button>
          <button className="btn btn-ghost btn-sm">Export CSV</button>
          <span className="table-count">
            Showing {rowCount === totalCount ? `1–${rowCount}` : `${rowCount} filtered`} of {totalCount}
          </span>
        </div>

        {/* Active Donors */}
        {activeTab === 'active' && (
          <div style={{ overflowX: 'auto' }}>
            <table>
              <thead>
                <tr>
                  <th style={{ width: 80 }}>Actions</th>
                  <th>Display Name</th>
                  <th>Salutation</th>
                  <th>Type</th>
                  <th>City</th>
                  <th>St</th>
                  <th>Primary Email</th>
                  <th>Primary Phone</th>
                  <th>Total Giving</th>
                  <th>2026</th>
                  <th>2025</th>
                  <th>2024</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(p => (
                  <tr key={p.id}>
                    <td>
                      <Link href={`/partners/${p.id}`} className="action-link">View/Edit</Link>
                    </td>
                    <td>
                      <Link href={`/partners/${p.id}`} className="partner-link">{p.display_name}</Link>
                    </td>
                    <td>{p.correspondence_greeting}</td>
                    <td>
                      <span className={`badge ${p.partner_type === 'Church' ? 'badge-church' : 'badge-family'}`}>
                        {p.partner_type}
                      </span>
                    </td>
                    <td>{p.city}</td>
                    <td>{p.state}</td>
                    <td>
                      {p.primary_email &&
                        <a href={`mailto:${p.primary_email}`} className="email-link">{p.primary_email}</a>
                      }
                    </td>
                    <td>{p.primary_phone &&
                      <a href={`tel:${p.primary_phone}`} style={{ textDecoration: 'none', color: 'inherit' }}>{p.primary_phone}</a>
                    }</td>
                    <td className="money">{fmt(p.total_giving)}</td>
                    <td className={`money${p.giving_2026 === 0 ? ' money-zero' : ''}`}>{fmt(p.giving_2026)}</td>
                    <td className={`money${p.giving_2025 === 0 ? ' money-zero' : ''}`}>{fmt(p.giving_2025)}</td>
                    <td className={`money${p.giving_2024 === 0 ? ' money-zero' : ''}`}>{fmt(p.giving_2024)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Prospects */}
        {activeTab === 'prospects' && (
          <div style={{ overflowX: 'auto' }}>
            <table>
              <thead>
                <tr>
                  <th style={{ width: 80 }}>Actions</th>
                  <th>Display Name</th>
                  <th>Salutation</th>
                  <th>Type</th>
                  <th>City</th>
                  <th>St</th>
                  <th>Primary Email</th>
                  <th>Primary Phone</th>
                  <th>Total Giving</th>
                  <th>Created Date</th>
                </tr>
              </thead>
              <tbody>
                {prospects.map(p => (
                  <tr key={p.id}>
                    <td><Link href={`/partners/${p.id}`} className="action-link">View/Edit</Link></td>
                    <td><Link href={`/partners/${p.id}`} className="partner-link">{p.display_name}</Link></td>
                    <td>{p.correspondence_greeting}</td>
                    <td><span className="badge badge-family">{p.partner_type}</span></td>
                    <td>{p.city}</td>
                    <td>{p.state}</td>
                    <td>{p.primary_email && <a href={`mailto:${p.primary_email}`} className="email-link">{p.primary_email}</a>}</td>
                    <td>{p.primary_phone}</td>
                    <td className={`money${p.total_giving === 0 ? ' money-zero' : ''}`}>{fmt(p.total_giving)}</td>
                    <td style={{ color: '#9ca3af', fontSize: 12 }}>{p.created_date}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Staff */}
        {activeTab === 'staff' && (
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Email Segment</th>
                <th>Primary Phone</th>
              </tr>
            </thead>
            <tbody>
              {staff.map(s => (
                <tr key={s.id}>
                  <td style={{ fontWeight: 500 }}>{[s.name_first, s.name_last].filter(Boolean).join(' ')}</td>
                  <td>{s.email && <a href={`mailto:${s.email}`} className="email-link">{s.email}</a>}</td>
                  <td>{s.email_segment}</td>
                  <td>{s.primary_phone}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {/* Past */}
        {activeTab === 'past' && (
          <table>
            <thead>
              <tr>
                <th style={{ width: 80 }}>Actions</th>
                <th>Display Name</th>
                <th>Salutation</th>
                <th>Type</th>
                <th>Relationship</th>
                <th>City</th>
                <th>St</th>
                <th>Primary Email</th>
                <th>Total Giving</th>
              </tr>
            </thead>
            <tbody>
              {pastPartners.map(p => (
                <tr key={p.id}>
                  <td><Link href={`/partners/${p.id}`} className="action-link">View/Edit</Link></td>
                  <td><Link href={`/partners/${p.id}`} className="partner-link">{p.display_name}</Link></td>
                  <td>{p.correspondence_greeting}</td>
                  <td><span className={`badge ${p.partner_type === 'Church' ? 'badge-church' : 'badge-family'}`}>{p.partner_type}</span></td>
                  <td><span className="badge badge-donor">{p.relationship_type}</span></td>
                  <td>{p.city}</td>
                  <td>{p.state}</td>
                  <td>{p.primary_email && <a href={`mailto:${p.primary_email}`} className="email-link">{p.primary_email}</a>}</td>
                  <td className="money">{fmt(p.total_giving)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Add Partner Panel */}
      {showPanel && <AddPartnerPanel onClose={() => setShowPanel(false)} />}
    </div>
  )
}

function AddPartnerPanel({ onClose }: { onClose: () => void }) {
  const [partnerType, setPartnerType] = useState('')
  const [saving, setSaving] = useState(false)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setSaving(true)
    const data = new FormData(e.currentTarget)
    const { error } = await supabase.from('partners').insert({
      display_name: `${data.get('name_first')} ${data.get('name_last')}`.trim(),
      correspondence_greeting: data.get('correspondence_greeting') as string || null,
      entity_name: data.get('entity_name') as string || null,
      partner_type: data.get('partner_type') as string || null,
      partner_status: data.get('partner_status') as string || null,
      relationship_type: data.get('relationship_type') as string || null,
      primary_email: data.get('primary_email') as string || null,
      primary_phone: data.get('primary_phone') as string || null,
      primary_phone_type: data.get('primary_phone_type') as string || null,
      secondary_phone: data.get('secondary_phone') as string || null,
      secondary_phone_type: data.get('secondary_phone_type') as string || null,
      street1: data.get('street1') as string || null,
      street2: data.get('street2') as string || null,
      city: data.get('city') as string || null,
      state: data.get('state') as string || null,
      zip: data.get('zip') as string || null,
      mailing_list: data.get('mailing_list') as string || null,
      total_giving: 0, giving_2023: 0, giving_2024: 0, giving_2025: 0, giving_2026: 0,
    })
    setSaving(false)
    if (!error) { onClose(); window.location.reload() }
    else alert('Error: ' + error.message)
  }

  return (
    <>
      <div className="panel-overlay" onClick={onClose} />
      <div className="panel">
        <div className="panel-header">
          <h2>Add New Partner</h2>
          <button className="panel-close" onClick={onClose}>
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M1 1l12 12M13 1L1 13"/>
            </svg>
          </button>
        </div>

        <form id="add-partner-form" onSubmit={handleSubmit} className="panel-body">
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Partner Type *</label>
              <select name="partner_type" required className="form-input" value={partnerType} onChange={e => setPartnerType(e.target.value)}>
                <option value="">Select...</option>
                <option>Family</option>
                <option>Church</option>
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
            {partnerType && partnerType !== 'Family' && (
              <div className="form-group">
                <label className="form-label">Entity Name</label>
                <input name="entity_name" type="text" placeholder="Organization name" className="form-input" />
              </div>
            )}
          </div>

          <div className="form-section-title">Primary Contact</div>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">First Name</label>
              <input name="name_first" type="text" placeholder="First" className="form-input" />
            </div>
            <div className="form-group">
              <label className="form-label">Last Name</label>
              <input name="name_last" type="text" placeholder="Last" className="form-input" />
            </div>
          </div>
          <div className="form-row full">
            <div className="form-group">
              <label className="form-label">Correspondence Greeting</label>
              <input name="correspondence_greeting" type="text" placeholder="e.g. Matt and Amber" className="form-input" />
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
                <option>Mobile</option><option>Home</option><option>Work</option>
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
                <option>Mobile</option><option>Home</option><option>Work</option>
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
        </form>

        <div className="panel-footer">
          <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button type="submit" form="add-partner-form" className="btn btn-primary" disabled={saving}>
            {saving ? 'Saving...' : 'Save Partner'}
          </button>
        </div>
      </div>
    </>
  )
}
