'use client'

import { useState, useEffect } from 'react'
import { createSupabaseBrowserClient } from '@/lib/supabase-browser'
import type { Partner, Pledge, FinancialGift, PartnerStatement } from '@/types/partners'
import NewPledgeModal from './NewPledgeModal'
import NewStatementModal from './NewStatementModal'

const GIFTS_PER_PAGE = 25

const STATUS_STYLES: Record<string, { bg: string; color: string; border: string }> = {
  Active:    { bg: '#ebfbee', color: '#2f9e44', border: '#b2f2bb' },
  Completed: { bg: '#e8f4fd', color: '#1971c2', border: '#a5d8ff' },
  Canceled:  { bg: '#fff5f5', color: '#c92a2a', border: '#ffa8a8' },
  Increased: { bg: '#f3e8ff', color: '#7c3aed', border: '#d8b4fe' },
  'On Hold': { bg: '#fff9db', color: '#e67700', border: '#ffe066' },
}

function fmtCurrency(n: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 2 }).format(n)
}

function fmtDate(dateStr: string | null): string {
  if (!dateStr) return '—'
  const parts = dateStr.split('T')[0].split('-')
  if (parts.length < 3) return dateStr
  return `${parts[1]}/${parts[2]}/${parts[0]}`
}

function monthlyValue(p: Pledge): number {
  if (p.frequency === 'Monthly') return p.pledge_amount ?? 0
  if (p.frequency === 'Quarterly') return (p.pledge_amount ?? 0) / 3
  if (p.frequency === 'Annually') return (p.pledge_amount ?? 0) / 12
  return 0
}

function groupByTowards(giftList: FinancialGift[]): Array<[string, { amount: number; count: number }]> {
  return Object.entries(
    giftList.reduce((acc, g) => {
      const key = g.towards ?? 'Other'
      if (!acc[key]) acc[key] = { amount: 0, count: 0 }
      acc[key].amount += g.amount ?? 0
      acc[key].count += 1
      return acc
    }, {} as Record<string, { amount: number; count: number }>)
  ).sort((a, b) => b[1].amount - a[1].amount)
}

function truncate(s: string | null, n: number): string {
  if (!s) return '—'
  return s.length > n ? s.slice(0, n) + '…' : s
}

function StatusBadge({ status }: { status: string }) {
  const s = STATUS_STYLES[status] ?? { bg: '#f3f4f6', color: '#6b7280', border: '#e5e7eb' }
  return (
    <span style={{
      display: 'inline-block', fontSize: 11, fontWeight: 500,
      padding: '2px 8px', borderRadius: 10, whiteSpace: 'nowrap',
      background: s.bg, color: s.color, border: `1px solid ${s.border}`,
    }}>
      {status}
    </span>
  )
}

const TH: React.CSSProperties = {
  textAlign: 'left', fontSize: 11, fontWeight: 500, color: '#6b7280',
  padding: '6px 0', borderBottom: '1px solid #e4e4e0',
}
const TH_R: React.CSSProperties = { ...TH, textAlign: 'right' }
const TD: React.CSSProperties = {
  fontSize: 13, padding: '6px 0', borderBottom: '1px solid #f8f8f5', color: '#111827',
}
const TD_R: React.CSSProperties = { ...TD, textAlign: 'right' }
const TD_MUTED: React.CSSProperties = { ...TD_R, color: '#6b7280' }

interface Props {
  partnerId: string
  partner: Partner
}

export default function FinancialTab({ partnerId, partner }: Props) {
  const [pledges, setPledges] = useState<Pledge[]>([])
  const [gifts, setGifts] = useState<FinancialGift[]>([])
  const [statements, setStatements] = useState<PartnerStatement[]>([])
  const [loading, setLoading] = useState(true)
  const [showNewPledge, setShowNewPledge] = useState(false)
  const [showNewStatement, setShowNewStatement] = useState(false)
  const [giftsPage, setGiftsPage] = useState(1)

  useEffect(() => {
    const supabase = createSupabaseBrowserClient()
    async function fetchAll() {
      setLoading(true)
      const [pledgesRes, giftsRes, statementsRes] = await Promise.all([
        supabase
          .from('pledges')
          .select('*')
          .eq('partner_id', partnerId)
          .eq('tenant_id', partner.tenant_id)
          .order('start_date', { ascending: false }),
        supabase
          .from('financial_gifts')
          .select('*')
          .eq('partner_id', partnerId)
          .eq('tenant_id', partner.tenant_id)
          .order('date_given', { ascending: false }),
        supabase
          .from('partner_statements')
          .select('*')
          .eq('partner_id', partnerId)
          .eq('tenant_id', partner.tenant_id)
          .order('year', { ascending: false }),
      ])
      setPledges((pledgesRes.data ?? []) as Pledge[])
      setGifts((giftsRes.data ?? []) as FinancialGift[])
      setStatements((statementsRes.data ?? []) as PartnerStatement[])
      setLoading(false)
    }
    fetchAll()
  }, [partnerId, partner.tenant_id])

  // ── Computed ──────────────────────────────────────────────

  const currentYear = new Date().getFullYear()

  const lifetimeGiving = gifts.reduce((sum, g) => sum + (g.amount ?? 0), 0)

  const givingYTD = gifts
    .filter(g => (g.giving_year ?? new Date(g.date_given).getFullYear()) === currentYear)
    .reduce((sum, g) => sum + (g.amount ?? 0), 0)

  const givingByYear = gifts.reduce((acc, g) => {
    const yr = g.giving_year ?? new Date(g.date_given).getFullYear()
    acc[yr] = (acc[yr] ?? 0) + (g.amount ?? 0)
    return acc
  }, {} as Record<number, number>)

  const recentYears = Object.keys(givingByYear)
    .map(Number)
    .sort((a, b) => b - a)
    .slice(0, 4)
    .reverse()

  const activePledges = pledges.filter(p => p.status === 'Active')
  const pledgeTotalMonthly = activePledges.reduce((sum, p) => sum + monthlyValue(p), 0)
  const pledgeTotalAnnualized = activePledges.reduce((sum, p) => sum + (p.annualized_value ?? 0), 0)

  const currentYearGifts = gifts.filter(
    g => (g.giving_year ?? new Date(g.date_given).getFullYear()) === currentYear
  )
  const priorYearGifts = gifts.filter(
    g => (g.giving_year ?? new Date(g.date_given).getFullYear()) === currentYear - 1
  )

  const currentYearByTowards = groupByTowards(currentYearGifts)
  const priorYearByTowards = groupByTowards(priorYearGifts)

  const totalGifts = gifts.length
  const totalPages = Math.max(1, Math.ceil(totalGifts / GIFTS_PER_PAGE))
  const paginatedGifts = gifts.slice((giftsPage - 1) * GIFTS_PER_PAGE, giftsPage * GIFTS_PER_PAGE)

  async function handleDeleteStatement(id: string, year: number) {
    if (!window.confirm(`Delete ${year} statement? This cannot be undone.`)) return
    const supabase = createSupabaseBrowserClient()
    const { error } = await supabase.from('partner_statements').delete().eq('id', id)
    if (!error) setStatements(prev => prev.filter(s => s.id !== id))
  }

  if (loading) {
    return (
      <div style={{ padding: '48px 0', textAlign: 'center', color: '#9ca3af', fontSize: 13 }}>
        Loading financial data…
      </div>
    )
  }

  return (
    <div>

      {/* ── 1. Partner Header ── */}
      <div style={{ marginBottom: 16 }}>
        <h2 style={{ fontSize: 20, fontWeight: 600, color: '#111827', margin: 0 }}>
          {partner.display_name}
        </h2>
        <p style={{ fontSize: 14, color: '#6b7280', margin: '2px 0 0' }}>Financial Summary</p>
      </div>

      {/* ── 2. Scorecards ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 20 }}>
        <div className="stat-card">
          <div className="stat-label">Lifetime Giving</div>
          <div className="stat-value" style={{ fontSize: 22, color: lifetimeGiving > 0 ? '#3B6D11' : '#9ca3af' }}>
            {fmtCurrency(lifetimeGiving)}
          </div>
          <div className="stat-sub">All financial gifts</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Giving YTD</div>
          <div className="stat-value" style={{ fontSize: 22, color: givingYTD > 0 ? '#3B6D11' : '#9ca3af' }}>
            {fmtCurrency(givingYTD)}
          </div>
          <div className="stat-sub">{currentYear} · current year</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Active Pledges</div>
          <div className="stat-value" style={{ fontSize: 22, color: activePledges.length > 0 ? '#3B6D11' : '#9ca3af' }}>
            {fmtCurrency(pledgeTotalAnnualized)}
          </div>
          <div className="stat-sub">
            {activePledges.length === 0
              ? 'no active pledges'
              : `${activePledges.length} active ${activePledges.length === 1 ? 'pledge' : 'pledges'}`}
          </div>
        </div>
      </div>

      {/* ── 3. Giving by Year ── */}
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', paddingBottom: 20, marginBottom: 20, borderBottom: '1px solid #e4e4e0' }}>
        {recentYears.length === 0 ? (
          <p style={{ color: '#9ca3af', fontSize: 13, margin: 0 }}>No giving recorded yet</p>
        ) : (
          recentYears.map(yr => (
            <div key={yr} style={{ padding: '12px 20px', background: '#f8f8f6', borderRadius: 8, border: '1px solid #e4e4e0', minWidth: 110, textAlign: 'center' }}>
              <div style={{ fontSize: 11, fontWeight: 500, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{yr}</div>
              <div style={{ fontSize: 18, fontWeight: 600, color: '#111827', marginTop: 4 }}>
                {fmtCurrency(givingByYear[yr] ?? 0)}
              </div>
            </div>
          ))
        )}
      </div>

      {/* ── 4. Two-column ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>

        {/* Left column: Active Pledges + Annual Giving Statements stacked */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

          {/* Active Pledges Summary */}
          <div className="section-card" style={{ marginBottom: 0 }}>
            <div className="section-header">
              <span className="section-title">Active Pledges</span>
              <span className="section-count">{activePledges.length}</span>
            </div>
            {activePledges.length === 0 ? (
              <div style={{ padding: '24px 18px', textAlign: 'center', color: '#9ca3af', fontSize: 13 }}>
                No active pledges
              </div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', tableLayout: 'fixed', borderCollapse: 'collapse' }}>
                  <colgroup>
                    <col style={{ width: '40%' }} />
                    <col style={{ width: '30%' }} />
                    <col style={{ width: '30%' }} />
                  </colgroup>
                  <thead>
                    <tr>
                      <th>Pledge Type</th>
                      <th style={{ textAlign: 'right' }}>Monthly Value</th>
                      <th style={{ textAlign: 'right' }}>Annualized Value</th>
                    </tr>
                  </thead>
                  <tbody>
                    {activePledges.map(p => (
                      <tr key={p.id}>
                        <td>{p.pledge_type}</td>
                        <td className="money" style={{ textAlign: 'right' }}>{fmtCurrency(monthlyValue(p))}</td>
                        <td className="money" style={{ textAlign: 'right' }}>
                          {p.annualized_value != null ? fmtCurrency(p.annualized_value) : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr>
                      <td style={{ padding: '8px 12px', borderTop: '2px solid #e4e4e0', fontSize: 13, fontWeight: 600, color: '#111827' }}>Total</td>
                      <td className="money" style={{ textAlign: 'right', borderTop: '2px solid #e4e4e0', fontWeight: 600 }}>{fmtCurrency(pledgeTotalMonthly)}</td>
                      <td className="money" style={{ textAlign: 'right', borderTop: '2px solid #e4e4e0', fontWeight: 600 }}>{fmtCurrency(pledgeTotalAnnualized)}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </div>

          {/* Annual Giving Statements (simplified) */}
          <div className="section-card" style={{ marginBottom: 0 }}>
            <div className="section-header">
              <span className="section-title">Annual Giving Statements</span>
              <span className="section-count">{statements.length}</span>
            </div>
            {statements.length === 0 ? (
              <div style={{ padding: '16px 18px', textAlign: 'center', color: '#9ca3af', fontSize: 13 }}>
                No statements on file
              </div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table>
                  <thead>
                    <tr>
                      <th>Year</th>
                      <th>Combined Statement</th>
                      <th style={{ width: 60 }}></th>
                    </tr>
                  </thead>
                  <tbody>
                    {statements.map(s => (
                      <tr key={s.id}>
                        <td style={{ fontWeight: 500 }}>{s.year}</td>
                        <td>
                          {s.combined_statement_url
                            ? <a href={s.combined_statement_url} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline" style={{ fontSize: 13 }}>
                                {s.combined_statement_label ?? 'Combined Statement →'}
                              </a>
                            : '—'}
                        </td>
                        <td>
                          <button
                            style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', color: '#c92a2a', fontSize: 13 }}
                            onClick={() => handleDeleteStatement(s.id, s.year)}
                          >
                            Delete
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        {/* Right column: Gifts Received */}
        <div className="section-card" style={{ marginBottom: 0 }}>
          <div className="section-header">
            <span className="section-title">Gifts Received</span>
          </div>
          <div style={{ padding: '4px 18px 16px' }}>

            <div style={{ fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 8 }}>
              Current Year ({currentYear})
            </div>
            {currentYearByTowards.length === 0 ? (
              <p style={{ fontSize: 13, color: '#9ca3af', marginBottom: 16 }}>No gifts recorded</p>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 8 }}>
                <thead>
                  <tr>
                    <th style={TH}>Towards</th>
                    <th style={{ ...TH_R, padding: '6px 8px' }}>Amount</th>
                    <th style={TH_R}>Gifts</th>
                  </tr>
                </thead>
                <tbody>
                  {currentYearByTowards.map(([towards, { amount, count }]) => (
                    <tr key={towards}>
                      <td style={TD}>{towards}</td>
                      <td style={{ ...TD_R, padding: '6px 8px' }}>{fmtCurrency(amount)}</td>
                      <td style={TD_MUTED}>{count}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr>
                    <td style={{ ...TD, fontWeight: 600, borderTop: '1px solid #e4e4e0', borderBottom: 'none' }}>Total Giving</td>
                    <td style={{ ...TD_R, fontWeight: 600, padding: '6px 8px', borderTop: '1px solid #e4e4e0', borderBottom: 'none' }}>
                      {fmtCurrency(currentYearGifts.reduce((s, g) => s + (g.amount ?? 0), 0))}
                    </td>
                    <td style={{ ...TD_MUTED, fontWeight: 600, borderTop: '1px solid #e4e4e0', borderBottom: 'none' }}>
                      {currentYearGifts.length}
                    </td>
                  </tr>
                </tfoot>
              </table>
            )}

            <div style={{ borderTop: '1px solid #e4e4e0', margin: '12px 0' }} />

            <div style={{ fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 8 }}>
              Prior Year ({currentYear - 1})
            </div>
            {priorYearByTowards.length === 0 ? (
              <p style={{ fontSize: 13, color: '#9ca3af' }}>No gifts recorded</p>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr>
                    <th style={TH}>Towards</th>
                    <th style={{ ...TH_R, padding: '6px 8px' }}>Amount</th>
                    <th style={TH_R}>Gifts</th>
                  </tr>
                </thead>
                <tbody>
                  {priorYearByTowards.map(([towards, { amount, count }]) => (
                    <tr key={towards}>
                      <td style={TD}>{towards}</td>
                      <td style={{ ...TD_R, padding: '6px 8px' }}>{fmtCurrency(amount)}</td>
                      <td style={TD_MUTED}>{count}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr>
                    <td style={{ ...TD, fontWeight: 600, borderTop: '1px solid #e4e4e0', borderBottom: 'none' }}>Total Giving</td>
                    <td style={{ ...TD_R, fontWeight: 600, padding: '6px 8px', borderTop: '1px solid #e4e4e0', borderBottom: 'none' }}>
                      {fmtCurrency(priorYearGifts.reduce((s, g) => s + (g.amount ?? 0), 0))}
                    </td>
                    <td style={{ ...TD_MUTED, fontWeight: 600, borderTop: '1px solid #e4e4e0', borderBottom: 'none' }}>
                      {priorYearGifts.length}
                    </td>
                  </tr>
                </tfoot>
              </table>
            )}
          </div>
        </div>
      </div>

      {/* ── 6. Action Buttons ── */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        <button className="btn btn-primary btn-sm" onClick={() => setShowNewPledge(true)}>+ New Pledge</button>
        <button className="btn btn-ghost btn-sm" disabled>+ Record Giving</button>
      </div>

      {/* ── 7. Pledges Table ── */}
      <div className="section-card" style={{ marginBottom: 16 }}>
        <div className="section-header">
          <span className="section-title">Pledges</span>
          <span className="section-count">{pledges.length}</span>
        </div>
        {pledges.length === 0 ? (
          <div style={{ padding: '24px 18px', textAlign: 'center', color: '#9ca3af', fontSize: 13 }}>
            No pledges recorded yet
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table>
              <thead>
                <tr>
                  <th style={{ width: 70 }}>View/Edit</th>
                  <th>Pledge Type</th>
                  <th>Status</th>
                  <th>Start Date</th>
                  <th>End Date</th>
                  <th>Pledge Amount</th>
                  <th>Frequency</th>
                </tr>
              </thead>
              <tbody>
                {pledges.map(p => (
                  <tr key={p.id}>
                    <td>
                      <button className="action-link" style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer' }}>
                        View
                      </button>
                    </td>
                    <td>{p.pledge_type}</td>
                    <td><StatusBadge status={p.status} /></td>
                    <td>{fmtDate(p.start_date)}</td>
                    <td>{fmtDate(p.end_date)}</td>
                    <td className="money">{fmtCurrency(p.pledge_amount)}</td>
                    <td>{p.frequency}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── 8. Gifts Table ── */}
      <div className="section-card" style={{ marginBottom: 20 }}>
        <div className="section-header">
          <span className="section-title">Gifts</span>
          <span className="section-count">{totalGifts}</span>
          <div className="section-actions" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {totalGifts > 0 && (
              <span style={{ fontSize: 12, color: '#6b7280' }}>
                Showing {(giftsPage - 1) * GIFTS_PER_PAGE + 1}–{Math.min(giftsPage * GIFTS_PER_PAGE, totalGifts)} of {totalGifts}
              </span>
            )}
            <button
              onClick={() => setGiftsPage(p => Math.max(1, p - 1))}
              disabled={giftsPage === 1}
              style={{ border: '1px solid #e4e4e0', borderRadius: 4, padding: '3px 8px', background: 'white', cursor: giftsPage === 1 ? 'default' : 'pointer', color: giftsPage === 1 ? '#d1d5db' : '#374151', fontSize: 13 }}
            >←</button>
            <button
              onClick={() => setGiftsPage(p => Math.min(totalPages, p + 1))}
              disabled={giftsPage >= totalPages || totalGifts === 0}
              style={{ border: '1px solid #e4e4e0', borderRadius: 4, padding: '3px 8px', background: 'white', cursor: (giftsPage >= totalPages || totalGifts === 0) ? 'default' : 'pointer', color: (giftsPage >= totalPages || totalGifts === 0) ? '#d1d5db' : '#374151', fontSize: 13 }}
            >→</button>
          </div>
        </div>
        {totalGifts === 0 ? (
          <div style={{ padding: '24px 18px', textAlign: 'center', color: '#9ca3af', fontSize: 13 }}>
            No gifts recorded yet
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table>
              <thead>
                <tr>
                  <th style={{ width: 70 }}>View/Edit</th>
                  <th>Date Given</th>
                  <th>Total Gift</th>
                  <th>Fee Donation</th>
                  <th>Base Gift</th>
                  <th>Notes</th>
                  <th>Processing Source</th>
                  <th>Towards</th>
                </tr>
              </thead>
              <tbody>
                {paginatedGifts.map(g => (
                  <tr key={g.id}>
                    <td>
                      <button className="action-link" style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer' }}>
                        View
                      </button>
                    </td>
                    <td>{fmtDate(g.date_given)}</td>
                    <td className="money">{fmtCurrency(g.amount)}</td>
                    <td className="money">{g.fee_donation != null ? fmtCurrency(g.fee_donation) : '—'}</td>
                    <td className="money">{g.base_gift != null ? fmtCurrency(g.base_gift) : '—'}</td>
                    <td style={{ maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {truncate(g.notes, 40)}
                    </td>
                    <td>{g.processing_source ?? '—'}</td>
                    <td>{g.towards ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Modals ── */}
      {showNewPledge && (
        <NewPledgeModal
          partnerId={partnerId}
          tenantId={partner.tenant_id}
          onClose={() => setShowNewPledge(false)}
          onSuccess={(newPledge) => {
            setPledges(prev => [newPledge, ...prev])
            setShowNewPledge(false)
          }}
        />
      )}

      {showNewStatement && (
        <NewStatementModal
          partnerId={partnerId}
          tenantId={partner.tenant_id}
          onClose={() => setShowNewStatement(false)}
          onSuccess={(newStatement) => {
            setStatements(prev => [newStatement, ...prev].sort((a, b) => b.year - a.year))
            setShowNewStatement(false)
          }}
        />
      )}
    </div>
  )
}
