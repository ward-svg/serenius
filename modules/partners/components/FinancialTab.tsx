"use client";

import { useMemo, useState, useEffect } from "react";
import SortableHeader from "@/components/ui/SortableHeader";
import { createSupabaseBrowserClient } from "@/lib/supabase-browser";
import {
  nextSortState,
  parseDateSortValue,
  sortByValue,
  type SortState,
  type SortValue,
} from "@/lib/ui/sort";
import type {
  Partner,
  Pledge,
  FinancialGift,
  PartnerStatement,
} from "@/modules/partners/types";

import NewPledgeModal from "./NewPledgeModal";
import GiftModal from "./GiftModal";

const GIFTS_PER_PAGE = 25;

type ActivePledgeSortKey = "pledgeType" | "monthlyValue" | "annualizedValue";
type PledgeSortKey =
  | "pledgeType"
  | "status"
  | "startDate"
  | "endDate"
  | "pledgeAmount"
  | "frequency";
type GiftSortKey =
  | "dateGiven"
  | "amount"
  | "feeDonation"
  | "baseGift"
  | "notes"
  | "processingSource"
  | "towards";
type StatementSortKey = "year" | "combinedStatement";

const STATUS_STYLES: Record<
  string,
  { bg: string; color: string; border: string }
> = {
  Active: { bg: "#ebfbee", color: "#2f9e44", border: "#b2f2bb" },
  Completed: { bg: "#e8f4fd", color: "#1971c2", border: "#a5d8ff" },
  Canceled: { bg: "#fff5f5", color: "#c92a2a", border: "#ffa8a8" },
  Increased: { bg: "#f3e8ff", color: "#7c3aed", border: "#d8b4fe" },
  "On Hold": { bg: "#fff9db", color: "#e67700", border: "#ffe066" },
};

function fmtCurrency(n: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  }).format(n);
}

function fmtDate(dateStr: string | null): string {
  if (!dateStr) return "—";
  const parts = dateStr.split("T")[0].split("-");
  if (parts.length < 3) return dateStr;
  return `${parts[1]}/${parts[2]}/${parts[0]}`;
}

function monthlyValue(p: Pledge): number {
  if (p.frequency === "Monthly") return p.pledge_amount ?? 0;
  if (p.frequency === "Quarterly") return (p.pledge_amount ?? 0) / 3;
  if (p.frequency === "Annually") return (p.pledge_amount ?? 0) / 12;
  return 0;
}

function groupByTowards(
  giftList: FinancialGift[],
): Array<[string, { amount: number; count: number }]> {
  return Object.entries(
    giftList.reduce(
      (acc, g) => {
        const key = g.towards ?? "Other";
        if (!acc[key]) acc[key] = { amount: 0, count: 0 };
        acc[key].amount += g.amount ?? 0;
        acc[key].count += 1;
        return acc;
      },
      {} as Record<string, { amount: number; count: number }>,
    ),
  ).sort((a, b) => b[1].amount - a[1].amount);
}

function truncate(s: string | null, n: number): string {
  if (!s) return "—";
  return s.length > n ? s.slice(0, n) + "…" : s;
}

function getActivePledgeSortValue(
  pledge: Pledge,
  key: ActivePledgeSortKey,
): SortValue {
  switch (key) {
    case "pledgeType":
      return pledge.pledge_type;
    case "monthlyValue":
      return monthlyValue(pledge);
    case "annualizedValue":
      return pledge.annualized_value;
  }
}

function getPledgeSortValue(pledge: Pledge, key: PledgeSortKey): SortValue {
  switch (key) {
    case "pledgeType":
      return pledge.pledge_type;
    case "status":
      return pledge.status;
    case "startDate":
      return parseDateSortValue(pledge.start_date);
    case "endDate":
      return parseDateSortValue(pledge.end_date);
    case "pledgeAmount":
      return pledge.pledge_amount;
    case "frequency":
      return pledge.frequency;
  }
}

function getGiftSortValue(gift: FinancialGift, key: GiftSortKey): SortValue {
  switch (key) {
    case "dateGiven":
      return parseDateSortValue(gift.date_given);
    case "amount":
      return gift.amount;
    case "feeDonation":
      return gift.fee_donation;
    case "baseGift":
      return gift.base_gift;
    case "notes":
      return gift.notes;
    case "processingSource":
      return gift.processing_source;
    case "towards":
      return gift.towards;
  }
}

function getStatementSortValue(
  statement: PartnerStatement,
  key: StatementSortKey,
): SortValue {
  switch (key) {
    case "year":
      return statement.year;
    case "combinedStatement":
      return statement.combined_statement_label;
  }
}

function StatusBadge({ status }: { status: string }) {
  const s = STATUS_STYLES[status] ?? {
    bg: "#f3f4f6",
    color: "#6b7280",
    border: "#e5e7eb",
  };
  return (
    <span
      style={{
        display: "inline-block",
        fontSize: 11,
        fontWeight: 500,
        padding: "2px 8px",
        borderRadius: 10,
        whiteSpace: "nowrap",
        background: s.bg,
        color: s.color,
        border: `1px solid ${s.border}`,
      }}
    >
      {status}
    </span>
  );
}

const TH: React.CSSProperties = {
  textAlign: "left",
  fontSize: 11,
  fontWeight: 500,
  color: "#6b7280",
  padding: "6px 0",
  borderBottom: "1px solid #e4e4e0",
};
const TH_R: React.CSSProperties = { ...TH, textAlign: "right" };
const TD: React.CSSProperties = {
  fontSize: 13,
  padding: "6px 0",
  borderBottom: "1px solid #f8f8f5",
  color: "#111827",
};
const TD_R: React.CSSProperties = { ...TD, textAlign: "right" };
const TD_MUTED: React.CSSProperties = { ...TD_R, color: "#6b7280" };

interface Props {
  partnerId: string;
  partner: Partner;
}

export default function FinancialTab({ partnerId, partner }: Props) {
  const [pledges, setPledges] = useState<Pledge[]>([]);
  const [gifts, setGifts] = useState<FinancialGift[]>([]);
  const [statements, setStatements] = useState<PartnerStatement[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNewPledge, setShowNewPledge] = useState(false);
  const [editingPledge, setEditingPledge] = useState<Pledge | null>(null);

  const [showNewGift, setShowNewGift] = useState(false);
  const [editingGift, setEditingGift] = useState<FinancialGift | null>(null);
  const [activePledgeSort, setActivePledgeSort] =
    useState<SortState<ActivePledgeSortKey> | null>(null);
  const [pledgeSort, setPledgeSort] = useState<SortState<PledgeSortKey> | null>(null);
  const [giftSort, setGiftSort] = useState<SortState<GiftSortKey> | null>(null);
  const [statementSort, setStatementSort] =
    useState<SortState<StatementSortKey> | null>(null);

  const [newGiftDefaults, setNewGiftDefaults] = useState<{
    pledgeId?: string | null;
    defaultAmount?: number | null;
    defaultTowards?: string | null;
    towardsActivePledge?: boolean;
  } | null>(null);

  const [pendingInitialGiftPrompt, setPendingInitialGiftPrompt] =
    useState<Pledge | null>(null);

  const [giftsPage, setGiftsPage] = useState(1);

  useEffect(() => {
    const supabase = createSupabaseBrowserClient();
    async function fetchAll() {
      setLoading(true);
      const [pledgesRes, giftsRes, statementsRes] = await Promise.all([
        supabase
          .from("pledges")
          .select("*")
          .eq("partner_id", partnerId)
          .eq("tenant_id", partner.tenant_id)
          .order("start_date", { ascending: false }),
        supabase
          .from("financial_gifts")
          .select("*")
          .eq("partner_id", partnerId)
          .eq("tenant_id", partner.tenant_id)
          .order("date_given", { ascending: false }),
        supabase
          .from("partner_statements")
          .select("*")
          .eq("partner_id", partnerId)
          .eq("tenant_id", partner.tenant_id)
          .order("year", { ascending: false }),
      ]);
      setPledges((pledgesRes.data ?? []) as Pledge[]);
      setGifts((giftsRes.data ?? []) as FinancialGift[]);
      setStatements((statementsRes.data ?? []) as PartnerStatement[]);
      setLoading(false);
    }
    fetchAll();
  }, [partnerId, partner.tenant_id]);

  async function reloadFinancialData() {
    const supabase = createSupabaseBrowserClient();

    setLoading(true);

    const [pledgesRes, giftsRes, statementsRes] = await Promise.all([
      supabase
        .from("pledges")
        .select("*")
        .eq("partner_id", partnerId)
        .eq("tenant_id", partner.tenant_id)
        .order("start_date", {
          ascending: false,
        }),

      supabase
        .from("financial_gifts")
        .select("*")
        .eq("partner_id", partnerId)
        .eq("tenant_id", partner.tenant_id)
        .order("date_given", {
          ascending: false,
        }),

      supabase
        .from("partner_statements")
        .select("*")
        .eq("partner_id", partnerId)
        .eq("tenant_id", partner.tenant_id)
        .order("year", {
          ascending: false,
        }),
    ]);

    setPledges((pledgesRes.data ?? []) as Pledge[]);

    setGifts((giftsRes.data ?? []) as FinancialGift[]);

    setStatements((statementsRes.data ?? []) as PartnerStatement[]);

    setLoading(false);
  }

  // ── Computed ──────────────────────────────────────────────

  const currentYear = new Date().getFullYear();

  const lifetimeGiving = gifts.reduce((sum, g) => sum + (g.amount ?? 0), 0);

  const givingYTD = gifts
    .filter(
      (g) =>
        (g.giving_year ?? new Date(g.date_given).getFullYear()) === currentYear,
    )
    .reduce((sum, g) => sum + (g.amount ?? 0), 0);

  const givingByYear = gifts.reduce(
    (acc, g) => {
      const yr = g.giving_year ?? new Date(g.date_given).getFullYear();
      acc[yr] = (acc[yr] ?? 0) + (g.amount ?? 0);
      return acc;
    },
    {} as Record<number, number>,
  );

  const recentYears = Object.keys(givingByYear)
    .map(Number)
    .sort((a, b) => b - a)
    .slice(0, 4)
    .reverse();

  const activePledges = useMemo(
    () => pledges.filter((p) => p.status === "Active"),
    [pledges],
  );
  const sortedActivePledges = useMemo(
    () => sortByValue(activePledges, activePledgeSort, getActivePledgeSortValue),
    [activePledgeSort, activePledges],
  );
  const sortedPledges = useMemo(
    () => sortByValue(pledges, pledgeSort, getPledgeSortValue),
    [pledgeSort, pledges],
  );
  const sortedGifts = useMemo(
    () => sortByValue(gifts, giftSort, getGiftSortValue),
    [giftSort, gifts],
  );
  const sortedStatements = useMemo(
    () => sortByValue(statements, statementSort, getStatementSortValue),
    [statementSort, statements],
  );
  const pledgeTotalMonthly = activePledges.reduce(
    (sum, p) => sum + monthlyValue(p),
    0,
  );
  const pledgeTotalAnnualized = activePledges.reduce(
    (sum, p) => sum + (p.annualized_value ?? 0),
    0,
  );

  const currentYearGifts = gifts.filter(
    (g) =>
      (g.giving_year ?? new Date(g.date_given).getFullYear()) === currentYear,
  );
  const priorYearGifts = gifts.filter(
    (g) =>
      (g.giving_year ?? new Date(g.date_given).getFullYear()) ===
      currentYear - 1,
  );

  const currentYearByTowards = groupByTowards(currentYearGifts);
  const priorYearByTowards = groupByTowards(priorYearGifts);

  const totalGifts = gifts.length;
  const totalPages = Math.max(1, Math.ceil(totalGifts / GIFTS_PER_PAGE));
  const paginatedGifts = sortedGifts.slice(
    (giftsPage - 1) * GIFTS_PER_PAGE,
    giftsPage * GIFTS_PER_PAGE,
  );

  function handleGiftSort(key: GiftSortKey) {
    setGiftSort((current) => nextSortState(current, key));
    setGiftsPage(1);
  }

  async function handleDeleteStatement(id: string, year: number) {
    if (!window.confirm(`Delete ${year} statement? This cannot be undone.`))
      return;
    const supabase = createSupabaseBrowserClient();
    const { error } = await supabase
      .from("partner_statements")
      .delete()
      .eq("id", id);
    if (!error) setStatements((prev) => prev.filter((s) => s.id !== id));
  }

  if (loading) {
    return (
      <div
        style={{
          padding: "48px 0",
          textAlign: "center",
          color: "#9ca3af",
          fontSize: 13,
        }}
      >
        Loading financial data…
      </div>
    );
  }

  return (
    <div>
      {/* ── 1. Partner Header ── */}
      <div style={{ marginBottom: 16 }}>
        <h2
          style={{ fontSize: 20, fontWeight: 600, color: "#111827", margin: 0 }}
        >
          {partner.display_name}
        </h2>
        <p style={{ fontSize: 14, color: "#6b7280", margin: "2px 0 0" }}>
          Financial Summary
        </p>
      </div>

      {/* ── 2. Scorecards ── */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(3, 1fr)",
          gap: 12,
          marginBottom: 20,
        }}
      >
        <div className="stat-card">
          <div className="stat-label">Lifetime Giving</div>
          <div
            className="stat-value"
            style={{
              fontSize: 22,
              color: lifetimeGiving > 0 ? "#3B6D11" : "#9ca3af",
            }}
          >
            {fmtCurrency(lifetimeGiving)}
          </div>
          <div className="stat-sub">All financial gifts</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Giving YTD</div>
          <div
            className="stat-value"
            style={{
              fontSize: 22,
              color: givingYTD > 0 ? "#3B6D11" : "#9ca3af",
            }}
          >
            {fmtCurrency(givingYTD)}
          </div>
          <div className="stat-sub">{currentYear} · current year</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Active Pledges</div>
          <div
            className="stat-value"
            style={{
              fontSize: 22,
              color: activePledges.length > 0 ? "#3B6D11" : "#9ca3af",
            }}
          >
            {fmtCurrency(pledgeTotalAnnualized)}
          </div>
          <div className="stat-sub">
            {activePledges.length === 0
              ? "no active pledges"
              : `${activePledges.length} active ${activePledges.length === 1 ? "pledge" : "pledges"}`}
          </div>
        </div>
      </div>

      {/* ── 3. Giving by Year ── */}
      <div
        style={{
          display: "flex",
          gap: 12,
          flexWrap: "wrap",
          paddingBottom: 20,
          marginBottom: 20,
          borderBottom: "1px solid #e4e4e0",
        }}
      >
        {recentYears.length === 0 ? (
          <p style={{ color: "#9ca3af", fontSize: 13, margin: 0 }}>
            No giving recorded yet
          </p>
        ) : (
          recentYears.map((yr) => (
            <div
              key={yr}
              style={{
                padding: "12px 20px",
                background: "#f8f8f6",
                borderRadius: 8,
                border: "1px solid #e4e4e0",
                minWidth: 110,
                textAlign: "center",
              }}
            >
              <div
                style={{
                  fontSize: 11,
                  fontWeight: 500,
                  color: "#9ca3af",
                  textTransform: "uppercase",
                  letterSpacing: "0.06em",
                }}
              >
                {yr}
              </div>
              <div
                style={{
                  fontSize: 18,
                  fontWeight: 600,
                  color: "#111827",
                  marginTop: 4,
                }}
              >
                {fmtCurrency(givingByYear[yr] ?? 0)}
              </div>
            </div>
          ))
        )}
      </div>

      {/* ── 4. Two-column ── */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 16,
          marginBottom: 16,
        }}
      >
        {/* Left column: Active Pledges + Annual Giving Statements stacked */}
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {/* Active Pledges Summary */}
          <div className="section-card" style={{ marginBottom: 0 }}>
            <div className="section-header">
              <span className="section-title">Active Pledges</span>
              <span className="section-count">{activePledges.length}</span>
            </div>
            {activePledges.length === 0 ? (
              <div className="empty-state">
                No active pledges
              </div>
            ) : (
              <div className="table-scroll">
                <table
                  style={{
                    width: "100%",
                    tableLayout: "fixed",
                    borderCollapse: "collapse",
                  }}
                >
                  <colgroup>
                    <col style={{ width: "40%" }} />
                    <col style={{ width: "30%" }} />
                    <col style={{ width: "30%" }} />
                  </colgroup>
                  <thead>
                    <tr>
                      <SortableHeader
                        label="Pledge Type"
                        sortKey="pledgeType"
                        sort={activePledgeSort}
                        onSort={(key) => setActivePledgeSort((current) => nextSortState(current, key))}
                      />
                      <SortableHeader
                        label="Monthly Value"
                        sortKey="monthlyValue"
                        sort={activePledgeSort}
                        onSort={(key) => setActivePledgeSort((current) => nextSortState(current, key))}
                        align="right"
                      />
                      <SortableHeader
                        label="Annualized Value"
                        sortKey="annualizedValue"
                        sort={activePledgeSort}
                        onSort={(key) => setActivePledgeSort((current) => nextSortState(current, key))}
                        align="right"
                      />
                    </tr>
                  </thead>
                  <tbody>
                    {sortedActivePledges.map((p) => (
                      <tr key={p.id}>
                        <td>{p.pledge_type}</td>
                        <td className="money" style={{ textAlign: "right" }}>
                          {fmtCurrency(monthlyValue(p))}
                        </td>
                        <td className="money" style={{ textAlign: "right" }}>
                          {p.annualized_value != null
                            ? fmtCurrency(p.annualized_value)
                            : "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr>
                      <td
                        style={{
                          padding: "8px 12px",
                          borderTop: "2px solid #e4e4e0",
                          fontSize: 13,
                          fontWeight: 600,
                          color: "#111827",
                        }}
                      >
                        Total
                      </td>
                      <td
                        className="money"
                        style={{
                          textAlign: "right",
                          borderTop: "2px solid #e4e4e0",
                          fontWeight: 600,
                        }}
                      >
                        {fmtCurrency(pledgeTotalMonthly)}
                      </td>
                      <td
                        className="money"
                        style={{
                          textAlign: "right",
                          borderTop: "2px solid #e4e4e0",
                          fontWeight: 600,
                        }}
                      >
                        {fmtCurrency(pledgeTotalAnnualized)}
                      </td>
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
              <div
                style={{
                  padding: "16px 18px",
                  textAlign: "center",
                  color: "#9ca3af",
                  fontSize: 13,
                }}
              >
                No statements on file
              </div>
            ) : (
              <div className="table-scroll">
                <table>
                  <thead>
                    <tr>
                      <th className="actions-column">ACTIONS</th>
                      <SortableHeader
                        label="Year"
                        sortKey="year"
                        sort={statementSort}
                        onSort={(key) => setStatementSort((current) => nextSortState(current, key))}
                      />
                      <SortableHeader
                        label="Combined Statement"
                        sortKey="combinedStatement"
                        sort={statementSort}
                        onSort={(key) => setStatementSort((current) => nextSortState(current, key))}
                      />
                    </tr>
                  </thead>
                  <tbody>
                    {sortedStatements.map((s) => (
                      <tr key={s.id}>
                        <td className="actions-column">
                          <button
                            type="button"
                            className="action-link action-link-danger"
                            onClick={() => handleDeleteStatement(s.id, s.year)}
                          >
                            Delete
                          </button>
                        </td>
                        <td style={{ fontWeight: 500 }}>{s.year}</td>
                        <td>
                          {s.combined_statement_url ? (
                            <a
                              href={s.combined_statement_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-blue-600 hover:underline"
                              style={{ fontSize: 13 }}
                            >
                              {s.combined_statement_label ??
                                "Combined Statement →"}
                            </a>
                          ) : (
                            "—"
                          )}
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
          <div style={{ padding: "4px 18px 16px" }}>
            <div
              style={{
                fontSize: 12,
                fontWeight: 600,
                color: "#374151",
                marginBottom: 8,
              }}
            >
              Current Year ({currentYear})
            </div>
            {currentYearByTowards.length === 0 ? (
              <p style={{ fontSize: 13, color: "#9ca3af", marginBottom: 16 }}>
                No gifts recorded
              </p>
            ) : (
              <table
                style={{
                  width: "100%",
                  borderCollapse: "collapse",
                  marginBottom: 8,
                }}
              >
                <thead>
                  <tr>
                    <th style={TH}>Towards</th>
                    <th style={{ ...TH_R, padding: "6px 8px" }}>Amount</th>
                    <th style={TH_R}>Gifts</th>
                  </tr>
                </thead>
                <tbody>
                  {currentYearByTowards.map(([towards, { amount, count }]) => (
                    <tr key={towards}>
                      <td style={TD}>{towards}</td>
                      <td style={{ ...TD_R, padding: "6px 8px" }}>
                        {fmtCurrency(amount)}
                      </td>
                      <td style={TD_MUTED}>{count}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr>
                    <td
                      style={{
                        ...TD,
                        fontWeight: 600,
                        borderTop: "1px solid #e4e4e0",
                        borderBottom: "none",
                      }}
                    >
                      Total Giving
                    </td>
                    <td
                      style={{
                        ...TD_R,
                        fontWeight: 600,
                        padding: "6px 8px",
                        borderTop: "1px solid #e4e4e0",
                        borderBottom: "none",
                      }}
                    >
                      {fmtCurrency(
                        currentYearGifts.reduce(
                          (s, g) => s + (g.amount ?? 0),
                          0,
                        ),
                      )}
                    </td>
                    <td
                      style={{
                        ...TD_MUTED,
                        fontWeight: 600,
                        borderTop: "1px solid #e4e4e0",
                        borderBottom: "none",
                      }}
                    >
                      {currentYearGifts.length}
                    </td>
                  </tr>
                </tfoot>
              </table>
            )}

            <div style={{ borderTop: "1px solid #e4e4e0", margin: "12px 0" }} />

            <div
              style={{
                fontSize: 12,
                fontWeight: 600,
                color: "#374151",
                marginBottom: 8,
              }}
            >
              Prior Year ({currentYear - 1})
            </div>
            {priorYearByTowards.length === 0 ? (
              <p style={{ fontSize: 13, color: "#9ca3af" }}>
                No gifts recorded
              </p>
            ) : (
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr>
                    <th style={TH}>Towards</th>
                    <th style={{ ...TH_R, padding: "6px 8px" }}>Amount</th>
                    <th style={TH_R}>Gifts</th>
                  </tr>
                </thead>
                <tbody>
                  {priorYearByTowards.map(([towards, { amount, count }]) => (
                    <tr key={towards}>
                      <td style={TD}>{towards}</td>
                      <td style={{ ...TD_R, padding: "6px 8px" }}>
                        {fmtCurrency(amount)}
                      </td>
                      <td style={TD_MUTED}>{count}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr>
                    <td
                      style={{
                        ...TD,
                        fontWeight: 600,
                        borderTop: "1px solid #e4e4e0",
                        borderBottom: "none",
                      }}
                    >
                      Total Giving
                    </td>
                    <td
                      style={{
                        ...TD_R,
                        fontWeight: 600,
                        padding: "6px 8px",
                        borderTop: "1px solid #e4e4e0",
                        borderBottom: "none",
                      }}
                    >
                      {fmtCurrency(
                        priorYearGifts.reduce((s, g) => s + (g.amount ?? 0), 0),
                      )}
                    </td>
                    <td
                      style={{
                        ...TD_MUTED,
                        fontWeight: 600,
                        borderTop: "1px solid #e4e4e0",
                        borderBottom: "none",
                      }}
                    >
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
      <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
        <button
          className="btn btn-ghost btn-sm"
          onClick={() => setShowNewPledge(true)}
        >
          + New Pledge
        </button>
        <button
          className="btn btn-ghost btn-sm"
          onClick={() => setShowNewGift(true)}
        >
          + Record Giving
        </button>
      </div>

      {/* ── 7. Pledges Table ── */}
      <div className="section-card" style={{ marginBottom: 16 }}>
        <div className="section-header">
          <span className="section-title">Pledges</span>
          <span className="section-count">{pledges.length}</span>
        </div>
        {pledges.length === 0 ? (
          <div className="empty-state">
            No pledges recorded yet
          </div>
        ) : (
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th className="actions-column">ACTIONS</th>
                  <SortableHeader
                    label="Pledge Type"
                    sortKey="pledgeType"
                    sort={pledgeSort}
                    onSort={(key) => setPledgeSort((current) => nextSortState(current, key))}
                  />
                  <SortableHeader
                    label="Status"
                    sortKey="status"
                    sort={pledgeSort}
                    onSort={(key) => setPledgeSort((current) => nextSortState(current, key))}
                  />
                  <SortableHeader
                    label="Start Date"
                    sortKey="startDate"
                    sort={pledgeSort}
                    onSort={(key) => setPledgeSort((current) => nextSortState(current, key))}
                  />
                  <SortableHeader
                    label="End Date"
                    sortKey="endDate"
                    sort={pledgeSort}
                    onSort={(key) => setPledgeSort((current) => nextSortState(current, key))}
                  />
                  <SortableHeader
                    label="Pledge Amount"
                    sortKey="pledgeAmount"
                    sort={pledgeSort}
                    onSort={(key) => setPledgeSort((current) => nextSortState(current, key))}
                    align="right"
                  />
                  <SortableHeader
                    label="Frequency"
                    sortKey="frequency"
                    sort={pledgeSort}
                    onSort={(key) => setPledgeSort((current) => nextSortState(current, key))}
                  />
                </tr>
              </thead>
              <tbody>
                {sortedPledges.map((p) => (
                  <tr key={p.id}>
                    <td className="actions-column">
                      <button
                        type="button"
                        className="action-link"
                        onClick={() => setEditingPledge(p)}
                      >
                        View/Edit
                      </button>
                    </td>
                    <td>{p.pledge_type}</td>
                    <td>
                      <StatusBadge status={p.status} />
                    </td>
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
          <div
            className="section-actions"
            style={{ display: "flex", alignItems: "center", gap: 10 }}
          >
            {totalGifts > 0 && (
              <span style={{ fontSize: 12, color: "#6b7280" }}>
                Showing {(giftsPage - 1) * GIFTS_PER_PAGE + 1}–
                {Math.min(giftsPage * GIFTS_PER_PAGE, totalGifts)} of{" "}
                {totalGifts}
              </span>
            )}
            <button
              onClick={() => setGiftsPage((p) => Math.max(1, p - 1))}
              disabled={giftsPage === 1}
              style={{
                border: "1px solid #e4e4e0",
                borderRadius: 4,
                padding: "3px 8px",
                background: "white",
                cursor: giftsPage === 1 ? "default" : "pointer",
                color: giftsPage === 1 ? "#d1d5db" : "#374151",
                fontSize: 13,
              }}
            >
              ←
            </button>
            <button
              onClick={() => setGiftsPage((p) => Math.min(totalPages, p + 1))}
              disabled={giftsPage >= totalPages || totalGifts === 0}
              style={{
                border: "1px solid #e4e4e0",
                borderRadius: 4,
                padding: "3px 8px",
                background: "white",
                cursor:
                  giftsPage >= totalPages || totalGifts === 0
                    ? "default"
                    : "pointer",
                color:
                  giftsPage >= totalPages || totalGifts === 0
                    ? "#d1d5db"
                    : "#374151",
                fontSize: 13,
              }}
            >
              →
            </button>
          </div>
        </div>
        {totalGifts === 0 ? (
          <div className="empty-state">
            No gifts recorded yet
          </div>
        ) : (
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th className="actions-column">ACTIONS</th>
                  <SortableHeader
                    label="Date Given"
                    sortKey="dateGiven"
                    sort={giftSort}
                    onSort={handleGiftSort}
                  />
                  <SortableHeader
                    label="Total Gift"
                    sortKey="amount"
                    sort={giftSort}
                    onSort={handleGiftSort}
                    align="right"
                  />
                  <SortableHeader
                    label="Fee Donation"
                    sortKey="feeDonation"
                    sort={giftSort}
                    onSort={handleGiftSort}
                    align="right"
                  />
                  <SortableHeader
                    label="Base Gift"
                    sortKey="baseGift"
                    sort={giftSort}
                    onSort={handleGiftSort}
                    align="right"
                  />
                  <SortableHeader
                    label="Notes"
                    sortKey="notes"
                    sort={giftSort}
                    onSort={handleGiftSort}
                  />
                  <SortableHeader
                    label="Processing Source"
                    sortKey="processingSource"
                    sort={giftSort}
                    onSort={handleGiftSort}
                  />
                  <SortableHeader
                    label="Towards"
                    sortKey="towards"
                    sort={giftSort}
                    onSort={handleGiftSort}
                  />
                </tr>
              </thead>
              <tbody>
                {paginatedGifts.map((g) => (
                  <tr key={g.id}>
                    <td className="actions-column">
                      <button
                        type="button"
                        className="action-link"
                        onClick={() => setEditingGift(g)}
                      >
                        View/Edit
                      </button>
                    </td>
                    <td>{fmtDate(g.date_given)}</td>
                    <td className="money">{fmtCurrency(g.amount)}</td>
                    <td className="money">
                      {g.fee_donation != null
                        ? fmtCurrency(g.fee_donation)
                        : "—"}
                    </td>
                    <td className="money">
                      {g.base_gift != null ? fmtCurrency(g.base_gift) : "—"}
                    </td>
                    <td
                      style={{
                        maxWidth: 200,
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {truncate(g.notes, 40)}
                    </td>
                    <td>{g.processing_source ?? "—"}</td>
                    <td>{g.towards ?? "—"}</td>
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
          onSuccess={async (pledge) => {
            setShowNewPledge(false);
            await reloadFinancialData();
            setPendingInitialGiftPrompt(pledge);
          }}
        />
      )}

      {pendingInitialGiftPrompt && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.45)",
            zIndex: 50,
            display: "flex",
            justifyContent: "center",
            alignItems: "flex-start",
            overflowY: "auto",
            padding: "80px 24px",
          }}
          onClick={() => setPendingInitialGiftPrompt(null)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: "100%",
              maxWidth: 520,
              background: "white",
              borderRadius: 12,
              overflow: "hidden",
              boxShadow: "0 20px 60px rgba(0,0,0,0.25)",
            }}
          >
            <div
              style={{
                padding: "18px 24px",
                borderBottom: "1px solid #e4e4e0",
                fontWeight: 600,
                fontSize: 16,
              }}
            >
              Pledge Created
            </div>

            <div style={{ padding: 24 }}>
              <p
                style={{
                  margin: 0,
                  fontSize: 14,
                  color: "#374151",
                  lineHeight: 1.6,
                }}
              >
                Would you like to record an initial gift for this pledge now?
              </p>

              <div
                style={{
                  marginTop: 12,
                  padding: "12px 14px",
                  background: "#f8f8f6",
                  border: "1px solid #e4e4e0",
                  borderRadius: 8,
                  fontSize: 13,
                  color: "#374151",
                }}
              >
                <strong>{pendingInitialGiftPrompt.pledge_type}</strong>
                <br />
                {fmtCurrency(pendingInitialGiftPrompt.pledge_amount)} ·{" "}
                {pendingInitialGiftPrompt.frequency}
              </div>

              <div
                style={{
                  display: "flex",
                  justifyContent: "flex-end",
                  gap: 8,
                  marginTop: 24,
                }}
              >
                <button
                  type="button"
                  className="btn btn-ghost"
                  onClick={() => setPendingInitialGiftPrompt(null)}
                >
                  Done
                </button>

                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={() => {
                    setNewGiftDefaults({
                      pledgeId: pendingInitialGiftPrompt.id,
                      defaultAmount: pendingInitialGiftPrompt.pledge_amount,
                      defaultTowards: pendingInitialGiftPrompt.pledge_type,
                      towardsActivePledge: true,
                    });

                    setPendingInitialGiftPrompt(null);
                    setShowNewGift(true);
                  }}
                >
                  Record Gift
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showNewGift && (
        <GiftModal
          partnerId={partnerId}
          tenantId={partner.tenant_id}
          pledgeId={newGiftDefaults?.pledgeId}
          defaultAmount={newGiftDefaults?.defaultAmount}
          defaultTowards={newGiftDefaults?.defaultTowards}
          towardsActivePledge={newGiftDefaults?.towardsActivePledge}
          onClose={() => {
            setShowNewGift(false);
            setNewGiftDefaults(null);
          }}
          onSuccess={async (_savedGift) => {
            await reloadFinancialData();
            setShowNewGift(false);
            setNewGiftDefaults(null);
          }}
        />
      )}

      {editingGift && (
        <GiftModal
          partnerId={partnerId}
          tenantId={partner.tenant_id}
          gift={editingGift}
          onClose={() => setEditingGift(null)}
          onSuccess={async (savedGift) => {
            await reloadFinancialData();
            setEditingGift(savedGift === editingGift ? null : savedGift);
          }}
        />
      )}

      {editingPledge && (
        <NewPledgeModal
          partnerId={partnerId}
          tenantId={partner.tenant_id}
          pledge={editingPledge}
          onClose={() => setEditingPledge(null)}
          onSuccess={async (savedPledge) => {
            await reloadFinancialData();
            setEditingPledge(
              savedPledge.status === "Canceled" ? null : savedPledge
            );
          }}
        />
      )}

    </div>
  );
}
