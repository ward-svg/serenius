'use client'

import { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import type {
  Partner,
  PartnerContact,
  PartnerTab,
  MonthlyPartnerPledge,
} from '@/modules/partners/types'
import { PARTNER_TABS } from '@/modules/partners/constants'
import {
  formatCompactCurrency,
  formatCurrency,
} from '@/modules/partners/utils'
import AddPartnerModal from './AddPartnerModal'
import { formatPhone } from '@/lib/formatPhone'

interface Props {
  slug: string
  orgId: string | null
  stats: {
    total: number
    activeDonors: number
    prospects: number
    totalGiving: number
    giving2026: number
  }
  activeDonors: Partner[]
  prospects: Partner[]
  pastPartners: Partner[]
  staff: PartnerContact[]
  monthlyPledges: MonthlyPartnerPledge[]
  givingByPartner: Record<string, { total: number; ytd: number }>
}

function downloadCsv(
  filename: string,
  rows: Record<string, string | number | null | undefined>[]
) {
  if (rows.length === 0) return

  const headers = Object.keys(rows[0])

  const escapeCsv = (value: string | number | null | undefined) => {
    const str = value == null ? '' : String(value)
    return `"${str.replace(/"/g, '""')}"`
  }

  const csv = [
    headers.join(','),
    ...rows.map(row =>
      headers.map(header => escapeCsv(row[header])).join(',')
    ),
  ].join('\n')

  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)

  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)

  URL.revokeObjectURL(url)
}

function getTabCount(
  tab: PartnerTab,
  counts: {
    active: number
    prospects: number
    staff: number
    past: number
  }
) {
  return counts[tab]
}

export default function PartnersClient({
  slug,
  orgId,
  stats,
  activeDonors,
  prospects,
  pastPartners,
  staff,
  monthlyPledges,
  givingByPartner,
}: Props) {
  const router = useRouter()
  const [activeTab, setActiveTab] = useState<PartnerTab>('active')
  const [search, setSearch] = useState('')
  const [showAddPartner, setShowAddPartner] = useState(false)

  const filtered = useMemo(() => {
    if (!search) return activeDonors

    const q = search.toLowerCase()

    return activeDonors.filter(p =>
      p.display_name.toLowerCase().includes(q) ||
      (p.address_city ?? '').toLowerCase().includes(q) ||
      (p.primary_email ?? '').toLowerCase().includes(q)
    )
  }, [activeDonors, search])

  const monthlyTotals = monthlyPledges.reduce(
    (a, b) => ({
      monthly: a.monthly + b.pledge_amount,
      annual: a.annual + b.annualized_value,
    }),
    { monthly: 0, annual: 0 }
  )

  const tabCounts = {
    active: activeDonors.length,
    prospects: prospects.length,
    staff: staff.length,
    past: pastPartners.length,
  }

  const rowCount =
    activeTab === 'active'
      ? filtered.length
      : getTabCount(activeTab, tabCounts)

  const totalCount = getTabCount(activeTab, tabCounts)

  function exportMonthlyPledgesCsv() {
    downloadCsv(
      'monthly-partner-pledges.csv',
      monthlyPledges.map(p => ({
        'Partner / Record Gift': p.partner_name,
        'Monthly Gift': p.pledge_amount,
        'Annualized Value': p.annualized_value,
        'Start Date': p.start_date,
        'Pledge Type': p.pledge_type,
      }))
    )
  }

  function exportActivePartnersCsv() {
    downloadCsv(
      'active-partners.csv',
      filtered.map(p => ({
        'Display Name': p.display_name,
        Salutation: p.correspondence_greeting,
        Type: p.partner_type,
        City: p.address_city,
        State: p.address_state,
        'Primary Email': p.primary_email,
        'Primary Phone': p.primary_phone,
        'Total Giving': givingByPartner[p.id]?.total ?? 0,
        'YTD 2026': givingByPartner[p.id]?.ytd ?? 0,
      }))
    )
  }

  return (
    <div style={{ maxWidth: 1400, margin: '0 auto' }}>
      {/* Page header */}
      <div className="page-header">
        <div>
          <div className="page-title">Partner Management</div>
          <div className="page-subtitle">
            WellSpring Rescue — all partners, donors and prospects
          </div>
        </div>

        <button
          className="btn btn-primary btn-sm"
          onClick={() => setShowAddPartner(true)}
        >
          <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor">
            <path
              d="M6 1v10M1 6h10"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
            />
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
          <div className="stat-value green">
            {formatCompactCurrency(stats.totalGiving)}
          </div>
          <div className="stat-sub">All time</div>
        </div>

        <div className="stat-card">
          <div className="stat-label">2026 Giving</div>
          <div className="stat-value">
            {formatCompactCurrency(stats.giving2026)}
          </div>
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
          <span className="section-count">
            {monthlyPledges.length} active pledges
          </span>
          <div className="section-actions">
            <button
              className="btn btn-ghost btn-sm"
              onClick={exportMonthlyPledgesCsv}
            >
              Export CSV
            </button>
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
            {monthlyPledges.map(p => (
              <tr key={p.id}>
                <td>
                  <Link
                    href={`/${slug}/partners/${p.partner_id}?tab=financial`}
                    className="partner-link"
                  >
                    {p.partner_name}
                  </Link>
                </td>
                <td className="money">{formatCurrency(p.pledge_amount)}</td>
                <td className="money">{formatCurrency(p.annualized_value)}</td>
                <td>{p.start_date}</td>
                <td>{p.pledge_type}</td>
              </tr>
            ))}
          </tbody>

          <tfoot>
            <tr className="monthly-total">
              <td>Total</td>
              <td className="money">{formatCurrency(monthlyTotals.monthly)}</td>
              <td className="money">{formatCurrency(monthlyTotals.annual)}</td>
              <td />
              <td />
            </tr>
          </tfoot>
        </table>
      </div>

      {/* Main partners table */}
      <div className="section-card">
        {/* Tabs */}
        <div className="tab-row">
          {PARTNER_TABS.map(tab => (
            <button
              key={tab.key}
              className={`tab${activeTab === tab.key ? ' active' : ''}`}
              onClick={() => {
                setActiveTab(tab.key)
                setSearch('')
              }}
            >
              {tab.label}{' '}
              <span
                style={{
                  marginLeft: 4,
                  fontSize: 10,
                  padding: '1px 6px',
                  borderRadius: 10,
                  background: activeTab === tab.key ? '#e7edff' : '#f0f0eb',
                  color: activeTab === tab.key ? '#3b5bdb' : '#6b7280',
                }}
              >
                {getTabCount(tab.key, tabCounts)}
              </span>
            </button>
          ))}
        </div>

        {/* Toolbar */}
        <div className="table-toolbar">
          <div className="search-wrap">
            <svg
              viewBox="0 0 16 16"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
            >
              <circle cx="7" cy="7" r="4" />
              <path d="M10.5 10.5l3 3" />
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
              <path d="M1 2h10L7 6v4L5 9V6L1 2z" />
            </svg>
            Filters
          </button>

          <button
            className="btn btn-ghost btn-sm"
            onClick={exportActivePartnersCsv}
          >
            Export CSV
          </button>

          <span className="table-count">
            Showing{' '}
            {rowCount === totalCount
              ? `1–${rowCount}`
              : `${rowCount} filtered`}{' '}
            of {totalCount}
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
                  <th>YTD 2026</th>
                </tr>
              </thead>

              <tbody>
                {filtered.map(p => (
                  <tr key={p.id}>
                    <td>
                      <Link
                        href={`/${slug}/partners/${p.id}`}
                        className="action-link"
                      >
                        View/Edit
                      </Link>
                    </td>

                    <td>
                      <Link
                        href={`/${slug}/partners/${p.id}`}
                        className="partner-link"
                      >
                        {p.display_name}
                      </Link>
                    </td>

                    <td>{p.correspondence_greeting}</td>

                    <td>
                      <span
                        className={`badge ${
                          p.partner_type === 'Church'
                            ? 'badge-church'
                            : 'badge-family'
                        }`}
                      >
                        {p.partner_type}
                      </span>
                    </td>

                    <td>{p.address_city}</td>
                    <td>{p.address_state}</td>

                    <td>
                      {p.primary_email && (
                        <a
                          href={`mailto:${p.primary_email}`}
                          className="email-link"
                        >
                          {p.primary_email}
                        </a>
                      )}
                    </td>

                    <td>
                      {p.primary_phone && (
                        <a
                          href={`tel:${p.primary_phone}`}
                          style={{ textDecoration: 'none', color: 'inherit' }}
                        >
                          {formatPhone(p.primary_phone)}
                        </a>
                      )}
                    </td>

                    <td className="money">
                      {formatCurrency(givingByPartner[p.id]?.total ?? 0)}
                    </td>
                    <td className="money">
                      {formatCurrency(givingByPartner[p.id]?.ytd ?? 0)}
                    </td>
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
                    <td>
                      <Link
                        href={`/${slug}/partners/${p.id}`}
                        className="action-link"
                      >
                        View/Edit
                      </Link>
                    </td>

                    <td>
                      <Link
                        href={`/${slug}/partners/${p.id}`}
                        className="partner-link"
                      >
                        {p.display_name}
                      </Link>
                    </td>

                    <td>{p.correspondence_greeting}</td>

                    <td>
                      <span className="badge badge-family">
                        {p.partner_type}
                      </span>
                    </td>

                    <td>{p.address_city}</td>
                    <td>{p.address_state}</td>

                    <td>
                      {p.primary_email && (
                        <a
                          href={`mailto:${p.primary_email}`}
                          className="email-link"
                        >
                          {p.primary_email}
                        </a>
                      )}
                    </td>

                    <td>{formatPhone(p.primary_phone)}</td>
                    <td className="money money-zero">—</td>
                    <td style={{ color: '#9ca3af', fontSize: 12 }}>
                      {p.created_at.split('T')[0]}
                    </td>
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
                  <td style={{ fontWeight: 500 }}>
                    {[s.first_name, s.last_name].filter(Boolean).join(' ')}
                  </td>

                  <td>
                    {s.primary_email && (
                      <a
                        href={`mailto:${s.primary_email}`}
                        className="email-link"
                      >
                        {s.primary_email}
                      </a>
                    )}
                  </td>

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
                  <td>
                    <Link
                      href={`/${slug}/partners/${p.id}`}
                      className="action-link"
                    >
                      View/Edit
                    </Link>
                  </td>

                  <td>
                    <Link
                      href={`/${slug}/partners/${p.id}`}
                      className="partner-link"
                    >
                      {p.display_name}
                    </Link>
                  </td>

                  <td>{p.correspondence_greeting}</td>

                  <td>
                    <span
                      className={`badge ${
                        p.partner_type === 'Church'
                          ? 'badge-church'
                          : 'badge-family'
                      }`}
                    >
                      {p.partner_type}
                    </span>
                  </td>

                  <td>
                    <span className="badge badge-donor">
                      {p.relationship_type}
                    </span>
                  </td>

                  <td>{p.address_city}</td>
                  <td>{p.address_state}</td>

                  <td>
                    {p.primary_email && (
                      <a
                        href={`mailto:${p.primary_email}`}
                        className="email-link"
                      >
                        {p.primary_email}
                      </a>
                    )}
                  </td>

                  <td className="money money-zero">—</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {showAddPartner && (
        <AddPartnerModal
          orgId={orgId}
          onClose={() => setShowAddPartner(false)}
          onSuccess={() => {
            setShowAddPartner(false)
            router.refresh()
          }}
        />
      )}
    </div>
  )
}