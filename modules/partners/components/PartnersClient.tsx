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
import SortableHeader from '@/components/ui/SortableHeader'
import {
  nextSortState,
  normalizePhoneSortValue,
  parseDateSortValue,
  sortByValue,
  type SortState,
  type SortValue,
} from '@/lib/ui/sort'

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

type PartnerSortKey =
  | 'name'
  | 'salutation'
  | 'type'
  | 'relationship'
  | 'city'
  | 'state'
  | 'email'
  | 'phone'
  | 'totalGiving'
  | 'ytd2026'
  | 'createdAt'

type PartnerTableKey = 'active' | 'prospects' | 'past'

type PartnerSortState = SortState<PartnerSortKey>
type MonthlyPledgeSortKey =
  | 'partnerName'
  | 'monthlyGift'
  | 'annualizedValue'
  | 'startDate'
  | 'pledgeType'
type StaffSortKey = 'name' | 'email' | 'emailSegment' | 'phone'

function getPartnerSortValue(
  partner: Partner,
  key: PartnerSortKey,
  givingByPartner: Record<string, { total: number; ytd: number }>
): SortValue {
  switch (key) {
    case 'name':
      return partner.display_name
    case 'salutation':
      return partner.correspondence_greeting
    case 'type':
      return partner.partner_type
    case 'relationship':
      return partner.relationship_type
    case 'city':
      return partner.address_city
    case 'state':
      return partner.address_state
    case 'email':
      return partner.primary_email
    case 'phone':
      return normalizePhoneSortValue(partner.primary_phone)
    case 'totalGiving':
      return givingByPartner[partner.id]?.total ?? 0
    case 'ytd2026':
      return givingByPartner[partner.id]?.ytd ?? 0
    case 'createdAt':
      return parseDateSortValue(partner.created_at)
  }
}

function getMonthlyPledgeSortValue(
  pledge: MonthlyPartnerPledge,
  key: MonthlyPledgeSortKey
): SortValue {
  switch (key) {
    case 'partnerName':
      return pledge.partner_name
    case 'monthlyGift':
      return pledge.pledge_amount
    case 'annualizedValue':
      return pledge.annualized_value
    case 'startDate':
      return parseDateSortValue(pledge.start_date)
    case 'pledgeType':
      return pledge.pledge_type
  }
}

function getStaffName(staff: PartnerContact): string {
  return [staff.first_name, staff.last_name].filter(Boolean).join(' ')
}

function getStaffSortValue(
  staff: PartnerContact,
  key: StaffSortKey
): SortValue {
  switch (key) {
    case 'name':
      return getStaffName(staff) || staff.display_name
    case 'email':
      return staff.primary_email
    case 'emailSegment':
      return staff.email_segment?.join(', ')
    case 'phone':
      return normalizePhoneSortValue(staff.primary_phone)
  }
}

function sortPartners(
  partners: Partner[],
  sort: PartnerSortState | null,
  givingByPartner: Record<string, { total: number; ytd: number }>
) {
  return sortByValue(
    partners,
    sort,
    (partner, key) => getPartnerSortValue(partner, key, givingByPartner)
  )
}

function SortablePartnerHeader({
  label,
  sortKey,
  table,
  sort,
  onSort,
  align,
}: {
  label: string
  sortKey: PartnerSortKey
  table: PartnerTableKey
  sort: PartnerSortState | null
  onSort: (table: PartnerTableKey, key: PartnerSortKey) => void
  align?: "left" | "right"
}) {
  return (
    <SortableHeader
      label={label}
      sortKey={sortKey}
      sort={sort}
      onSort={(key) => onSort(table, key)}
      align={align}
    />
  )
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
  const [partnerSorts, setPartnerSorts] = useState<
    Record<PartnerTableKey, PartnerSortState | null>
  >({
    active: null,
    prospects: null,
    past: null,
  })
  const [monthlyPledgeSort, setMonthlyPledgeSort] =
    useState<SortState<MonthlyPledgeSortKey> | null>(null)
  const [staffSort, setStaffSort] = useState<SortState<StaffSortKey> | null>(null)

  const filtered = useMemo(() => {
    if (!search) return activeDonors

    const q = search.toLowerCase()

    return activeDonors.filter(p =>
      p.display_name.toLowerCase().includes(q) ||
      (p.address_city ?? '').toLowerCase().includes(q) ||
      (p.primary_email ?? '').toLowerCase().includes(q)
    )
  }, [activeDonors, search])

  const sortedActivePartners = useMemo(
    () => sortPartners(filtered, partnerSorts.active, givingByPartner),
    [filtered, partnerSorts.active, givingByPartner]
  )

  const sortedProspects = useMemo(
    () => sortPartners(prospects, partnerSorts.prospects, givingByPartner),
    [prospects, partnerSorts.prospects, givingByPartner]
  )

  const sortedPastPartners = useMemo(
    () => sortPartners(pastPartners, partnerSorts.past, givingByPartner),
    [pastPartners, partnerSorts.past, givingByPartner]
  )
  const sortedMonthlyPledges = useMemo(
    () => sortByValue(monthlyPledges, monthlyPledgeSort, getMonthlyPledgeSortValue),
    [monthlyPledgeSort, monthlyPledges]
  )
  const sortedStaff = useMemo(
    () => sortByValue(staff, staffSort, getStaffSortValue),
    [staff, staffSort]
  )

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
      sortedMonthlyPledges.map(p => ({
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
      sortedActivePartners.map(p => ({
        'Partner Name': p.display_name,
        Salutation: p.correspondence_greeting,
        Type: p.partner_type,
        City: p.address_city,
        ST: p.address_state,
        'Primary Email': p.primary_email,
        'Primary Phone': p.primary_phone,
        'Total Giving': givingByPartner[p.id]?.total ?? 0,
        'YTD 2026': givingByPartner[p.id]?.ytd ?? 0,
      }))
    )
  }

  function handlePartnerSort(table: PartnerTableKey, key: PartnerSortKey) {
    setPartnerSorts(prev => {
      return {
        ...prev,
        [table]: nextSortState(prev[table], key),
      }
    })
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
          className="btn btn-ghost btn-sm"
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
              <SortableHeader
                label="Partner Name"
                sortKey="partnerName"
                sort={monthlyPledgeSort}
                onSort={(key) => setMonthlyPledgeSort((current) => nextSortState(current, key))}
              />
              <SortableHeader
                label="Monthly Gift"
                sortKey="monthlyGift"
                sort={monthlyPledgeSort}
                onSort={(key) => setMonthlyPledgeSort((current) => nextSortState(current, key))}
                align="right"
              />
              <SortableHeader
                label="Annualized Value"
                sortKey="annualizedValue"
                sort={monthlyPledgeSort}
                onSort={(key) => setMonthlyPledgeSort((current) => nextSortState(current, key))}
                align="right"
              />
              <SortableHeader
                label="Start Date"
                sortKey="startDate"
                sort={monthlyPledgeSort}
                onSort={(key) => setMonthlyPledgeSort((current) => nextSortState(current, key))}
              />
              <SortableHeader
                label="Pledge Type"
                sortKey="pledgeType"
                sort={monthlyPledgeSort}
                onSort={(key) => setMonthlyPledgeSort((current) => nextSortState(current, key))}
              />
            </tr>
          </thead>

          <tbody>
            {sortedMonthlyPledges.map(p => (
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
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th className="actions-column">ACTIONS</th>
                  <SortablePartnerHeader
                    table="active"
                    sortKey="name"
                    label="Partner Name"
                    sort={partnerSorts.active}
                    onSort={handlePartnerSort}
                  />
                  <SortablePartnerHeader
                    table="active"
                    sortKey="salutation"
                    label="Salutation"
                    sort={partnerSorts.active}
                    onSort={handlePartnerSort}
                  />
                  <SortablePartnerHeader
                    table="active"
                    sortKey="type"
                    label="Type"
                    sort={partnerSorts.active}
                    onSort={handlePartnerSort}
                  />
                  <SortablePartnerHeader
                    table="active"
                    sortKey="city"
                    label="City"
                    sort={partnerSorts.active}
                    onSort={handlePartnerSort}
                  />
                  <SortablePartnerHeader
                    table="active"
                    sortKey="state"
                    label="ST"
                    sort={partnerSorts.active}
                    onSort={handlePartnerSort}
                  />
                  <SortablePartnerHeader
                    table="active"
                    sortKey="email"
                    label="Primary Email"
                    sort={partnerSorts.active}
                    onSort={handlePartnerSort}
                  />
                  <SortablePartnerHeader
                    table="active"
                    sortKey="phone"
                    label="Primary Phone"
                    sort={partnerSorts.active}
                    onSort={handlePartnerSort}
                  />
                  <SortablePartnerHeader
                    table="active"
                    sortKey="totalGiving"
                    label="Total Giving"
                    sort={partnerSorts.active}
                    onSort={handlePartnerSort}
                    align="right"
                  />
                  <SortablePartnerHeader
                    table="active"
                    sortKey="ytd2026"
                    label="YTD 2026"
                    sort={partnerSorts.active}
                    onSort={handlePartnerSort}
                    align="right"
                  />
                </tr>
              </thead>

              <tbody>
                {sortedActivePartners.map(p => (
                  <tr key={p.id}>
                    <td className="actions-column">
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
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th className="actions-column">ACTIONS</th>
                  <SortablePartnerHeader
                    table="prospects"
                    sortKey="name"
                    label="Partner Name"
                    sort={partnerSorts.prospects}
                    onSort={handlePartnerSort}
                  />
                  <SortablePartnerHeader
                    table="prospects"
                    sortKey="salutation"
                    label="Salutation"
                    sort={partnerSorts.prospects}
                    onSort={handlePartnerSort}
                  />
                  <SortablePartnerHeader
                    table="prospects"
                    sortKey="type"
                    label="Type"
                    sort={partnerSorts.prospects}
                    onSort={handlePartnerSort}
                  />
                  <SortablePartnerHeader
                    table="prospects"
                    sortKey="city"
                    label="City"
                    sort={partnerSorts.prospects}
                    onSort={handlePartnerSort}
                  />
                  <SortablePartnerHeader
                    table="prospects"
                    sortKey="state"
                    label="ST"
                    sort={partnerSorts.prospects}
                    onSort={handlePartnerSort}
                  />
                  <SortablePartnerHeader
                    table="prospects"
                    sortKey="email"
                    label="Primary Email"
                    sort={partnerSorts.prospects}
                    onSort={handlePartnerSort}
                  />
                  <SortablePartnerHeader
                    table="prospects"
                    sortKey="phone"
                    label="Primary Phone"
                    sort={partnerSorts.prospects}
                    onSort={handlePartnerSort}
                  />
                  <th>Total Giving</th>
                  <SortablePartnerHeader
                    table="prospects"
                    sortKey="createdAt"
                    label="Created Date"
                    sort={partnerSorts.prospects}
                    onSort={handlePartnerSort}
                  />
                </tr>
              </thead>

              <tbody>
                {sortedProspects.map(p => (
                  <tr key={p.id}>
                    <td className="actions-column">
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
                <SortableHeader
                  label="Name"
                  sortKey="name"
                  sort={staffSort}
                  onSort={(key) => setStaffSort((current) => nextSortState(current, key))}
                />
                <SortableHeader
                  label="Email"
                  sortKey="email"
                  sort={staffSort}
                  onSort={(key) => setStaffSort((current) => nextSortState(current, key))}
                />
                <SortableHeader
                  label="Email Segment"
                  sortKey="emailSegment"
                  sort={staffSort}
                  onSort={(key) => setStaffSort((current) => nextSortState(current, key))}
                />
                <SortableHeader
                  label="Primary Phone"
                  sortKey="phone"
                  sort={staffSort}
                  onSort={(key) => setStaffSort((current) => nextSortState(current, key))}
                />
              </tr>
            </thead>

            <tbody>
              {sortedStaff.map(s => (
                <tr key={s.id}>
                  <td style={{ fontWeight: 500 }}>
                    {getStaffName(s) || '—'}
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
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th className="actions-column">ACTIONS</th>
                  <SortablePartnerHeader
                    table="past"
                    sortKey="name"
                    label="Partner Name"
                    sort={partnerSorts.past}
                    onSort={handlePartnerSort}
                  />
                  <SortablePartnerHeader
                    table="past"
                    sortKey="salutation"
                    label="Salutation"
                    sort={partnerSorts.past}
                    onSort={handlePartnerSort}
                  />
                  <SortablePartnerHeader
                    table="past"
                    sortKey="type"
                    label="Type"
                    sort={partnerSorts.past}
                    onSort={handlePartnerSort}
                  />
                  <SortablePartnerHeader
                    table="past"
                    sortKey="relationship"
                    label="Relationship"
                    sort={partnerSorts.past}
                    onSort={handlePartnerSort}
                  />
                  <SortablePartnerHeader
                    table="past"
                    sortKey="city"
                    label="City"
                    sort={partnerSorts.past}
                    onSort={handlePartnerSort}
                  />
                  <SortablePartnerHeader
                    table="past"
                    sortKey="state"
                    label="ST"
                    sort={partnerSorts.past}
                    onSort={handlePartnerSort}
                  />
                  <SortablePartnerHeader
                    table="past"
                    sortKey="email"
                    label="Primary Email"
                    sort={partnerSorts.past}
                    onSort={handlePartnerSort}
                  />
                  <th>Total Giving</th>
                </tr>
              </thead>

              <tbody>
                {sortedPastPartners.map(p => (
                  <tr key={p.id}>
                    <td className="actions-column">
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
          </div>
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
