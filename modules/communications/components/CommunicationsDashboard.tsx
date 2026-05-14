"use client";

import { useMemo, useState } from "react";
import {
  parseDateSortValue,
  sortByValue,
  type SortDirection,
  type SortState,
  type SortValue,
} from "@/lib/ui/sort";
import { createSupabaseBrowserClient } from "@/lib/supabase-browser";
import SereniusModal from "@/components/ui/SereniusModal";
import CampaignModal from "./CampaignModal";
import CampaignPreviewModal from "./CampaignPreviewModal";
import type {
  CampaignListFilter,
  CommunicationEmailAsset,
  CommunicationsPageData,
  PartnerEmailCampaign,
} from "../types";
import { CAMPAIGN_FILTERS } from "../constants";

interface Props extends CommunicationsPageData {
  canManage: boolean;
  onAssetsChange?: (assets: CommunicationEmailAsset[]) => void;
}

function formatDateTime(dateStr: string | null | undefined): string {
  if (!dateStr) return "—";
  const date = new Date(dateStr);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString("en-US", {
    month: "2-digit",
    day: "2-digit",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return "—";
  const date = new Date(dateStr);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("en-US", {
    month: "2-digit",
    day: "2-digit",
    year: "numeric",
  });
}

type CampaignSortKey =
  | "createdAt"
  | "subject"
  | "deliveryAt"
  | "emailSentAt"
  | "totalEmailsSent"
  | "originalOpens"
  | "totalTouches";

type CampaignSortOption =
  | "createdAt-desc"
  | "createdAt-asc"
  | "deliveryAt-desc"
  | "deliveryAt-asc"
  | "subject-asc"
  | "subject-desc"
  | "totalEmailsSent-desc"
  | "totalEmailsSent-asc"
  | "originalOpens-desc"
  | "originalOpens-asc"
  | "totalTouches-desc"
  | "totalTouches-asc";

const SORT_STATES: Record<CampaignSortOption, SortState<CampaignSortKey>> = {
  "createdAt-desc": { key: "createdAt", direction: "desc" as SortDirection },
  "createdAt-asc": { key: "createdAt", direction: "asc" as SortDirection },
  "deliveryAt-desc": { key: "deliveryAt", direction: "desc" as SortDirection },
  "deliveryAt-asc": { key: "deliveryAt", direction: "asc" as SortDirection },
  "subject-asc": { key: "subject", direction: "asc" as SortDirection },
  "subject-desc": { key: "subject", direction: "desc" as SortDirection },
  "totalEmailsSent-desc": { key: "totalEmailsSent", direction: "desc" as SortDirection },
  "totalEmailsSent-asc": { key: "totalEmailsSent", direction: "asc" as SortDirection },
  "originalOpens-desc": { key: "originalOpens", direction: "desc" as SortDirection },
  "originalOpens-asc": { key: "originalOpens", direction: "asc" as SortDirection },
  "totalTouches-desc": { key: "totalTouches", direction: "desc" as SortDirection },
  "totalTouches-asc": { key: "totalTouches", direction: "asc" as SortDirection },
};

function canTrashCampaign(campaign: PartnerEmailCampaign): boolean {
  const sending = (campaign.sending_status ?? "").toLowerCase();
  if (sending === "send complete") return false;
  if (campaign.email_sent_at !== null) return false;
  if ((campaign.total_emails_sent ?? 0) > 0) return false;
  return true;
}

function canPermanentDeleteCampaign(campaign: PartnerEmailCampaign): boolean {
  if (campaign.deleted_at === null) return false;
  return canTrashCampaign(campaign);
}

function classifyCampaign(campaign: PartnerEmailCampaign): CampaignListFilter {
  const sending = (campaign.sending_status ?? "").toLowerCase();
  const message = (campaign.message_status ?? "").toLowerCase();

  if (
    sending === "send complete" ||
    message === "message sent" ||
    message === "readiness sent" ||
    Boolean(campaign.email_sent_at)
  ) {
    return "completed";
  }
  if (
    sending === "canceled" ||
    sending === "failed" ||
    message === "failed" ||
    message === "canceled"
  ) {
    return "failed-canceled";
  }
  return "working-scheduled";
}

function getCampaignSortValue(campaign: PartnerEmailCampaign, key: CampaignSortKey): SortValue {
  switch (key) {
    case "createdAt":
      return parseDateSortValue(campaign.created_at);
    case "subject":
      return campaign.subject;
    case "deliveryAt":
      return parseDateSortValue(campaign.delivery_datetime);
    case "emailSentAt":
      return parseDateSortValue(campaign.email_sent_at);
    case "totalEmailsSent":
      return campaign.total_emails_sent;
    case "originalOpens":
      return campaign.original_opens;
    case "totalTouches":
      return campaign.total_touches;
  }
}

function statusBadgeStyle(value: string): React.CSSProperties {
  const v = value.toLowerCase();
  if (v === "send complete" || v === "message sent" || v === "ready") {
    return { background: "#dcfce7", color: "#15803d" };
  }
  if (v === "canceled" || v === "failed") {
    return { background: "#fee2e2", color: "#b91c1c" };
  }
  if (v === "in-process" || v === "scheduled") {
    return { background: "#dbeafe", color: "#1d4ed8" };
  }
  return { background: "#fef3c7", color: "#92400e" };
}

function versionBadgeStyle(version: string): React.CSSProperties {
  if (version === "A") return { background: "#dcfce7", color: "#15803d" };
  if (version === "B") return { background: "#dbeafe", color: "#1d4ed8" };
  if (version === "A+B") return { background: "#f3e8ff", color: "#6b21a8" };
  return { background: "#f3f4f6", color: "#374151" };
}

function EmailPreview({ html, text }: { html: string | null; text: string | null }) {
  if (html) {
    return (
      <div
        style={{
          width: 320,
          height: 220,
          overflow: "hidden",
          position: "relative",
          borderRadius: 6,
          border: "1px solid #e5e7eb",
          background: "#fff",
          flexShrink: 0,
        }}
      >
        <iframe
          srcDoc={html}
          sandbox=""
          referrerPolicy="no-referrer"
          style={{
            width: 600,
            height: 420,
            border: "none",
            transform: "scale(0.5333)",
            transformOrigin: "top left",
            pointerEvents: "none",
          }}
          title="Email preview"
          aria-hidden="true"
        />
      </div>
    );
  }
  if (text) {
    return (
      <div
        style={{
          width: 320,
          height: 220,
          overflow: "hidden",
          background: "#f9fafb",
          borderRadius: 6,
          border: "1px solid #e5e7eb",
          padding: "12px 14px",
          fontSize: 11,
          color: "#6b7280",
          lineHeight: 1.5,
          flexShrink: 0,
          whiteSpace: "pre-wrap",
          wordBreak: "break-word",
        }}
      >
        {text.slice(0, 600)}
      </div>
    );
  }
  return (
    <div
      style={{
        width: 320,
        height: 220,
        background: "#f9fafb",
        borderRadius: 6,
        border: "1px solid #e5e7eb",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        flexShrink: 0,
      }}
    >
      <span style={{ fontSize: 11, color: "#9ca3af" }}>No preview</span>
    </div>
  );
}

const PAGE_SIZE = 10;

function getPageNumbers(current: number, total: number): (number | string)[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const pages: (number | string)[] = [1];
  if (current > 3) pages.push("…");
  for (let p = Math.max(2, current - 1); p <= Math.min(total - 1, current + 1); p++) {
    pages.push(p);
  }
  if (current < total - 2) pages.push("…");
  pages.push(total);
  return pages;
}

export default function CommunicationsDashboard({
  slug,
  orgId,
  mailSettings,
  brandSettings,
  emailAssets,
  campaigns: initialCampaigns,
  opens,
  contacts,
  suppressions,
  testRecipients,
  canManage,
  onAssetsChange,
}: Props) {
  const [campaigns, setCampaigns] = useState<PartnerEmailCampaign[]>(initialCampaigns);
  const [activeFilter, setActiveFilter] = useState<CampaignListFilter>("working-scheduled");
  const [search, setSearch] = useState("");
  const [sortOption, setSortOption] = useState<CampaignSortOption>("createdAt-desc");
  const [selectedCampaign, setSelectedCampaign] = useState<PartnerEmailCampaign | null>(null);
  const [modalMode, setModalMode] = useState<"create" | "view" | "edit">("create");
  const [showCampaignModal, setShowCampaignModal] = useState(false);
  const [previewCampaign, setPreviewCampaign] = useState<PartnerEmailCampaign | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [trashingId, setTrashingId] = useState<string | null>(null);
  const [restoringId, setRestoringId] = useState<string | null>(null);
  const [modalForcedReadOnly, setModalForcedReadOnly] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<PartnerEmailCampaign | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [showEmptyTrashModal, setShowEmptyTrashModal] = useState(false);
  const [emptyTrashDeleting, setEmptyTrashDeleting] = useState(false);
  const [emptyTrashError, setEmptyTrashError] = useState<string | null>(null);

  const activeTestRecipientCount = useMemo(
    () => testRecipients.filter((r) => r.is_active).length,
    [testRecipients],
  );

  const totalOpenEvents = opens.reduce((sum, row) => sum + (row.open_count ?? 0), 0);
  const totalTouchRollups = campaigns.reduce((sum, c) => sum + (c.total_touches ?? 0), 0);
  const totalHistoricalSent = campaigns.reduce((sum, c) => sum + (c.total_emails_sent ?? 0), 0);

  const campaignCounts = useMemo(() => {
    const counts: Record<CampaignListFilter, number> = {
      "working-scheduled": 0,
      completed: 0,
      "failed-canceled": 0,
      trash: 0,
      all: 0,
    };
    for (const c of campaigns) {
      if (c.deleted_at !== null) {
        counts.trash += 1;
      } else {
        counts.all += 1;
        counts[classifyCampaign(c)] += 1;
      }
    }
    return counts;
  }, [campaigns]);

  const trashedCampaigns = campaigns.filter((c) => c.deleted_at !== null);
  const eligibleForEmptyTrash = trashedCampaigns.filter(canPermanentDeleteCampaign);

  const visibleCampaigns = useMemo(() => {
    let result: PartnerEmailCampaign[];
    if (activeFilter === "trash") {
      result = campaigns.filter((c) => c.deleted_at !== null);
    } else if (activeFilter === "all") {
      result = campaigns.filter((c) => c.deleted_at === null);
    } else {
      result = campaigns.filter(
        (c) => c.deleted_at === null && classifyCampaign(c) === activeFilter,
      );
    }

    if (search.trim()) {
      const q = search.trim().toLowerCase();
      result = result.filter(
        (c) =>
          (c.subject ?? "").toLowerCase().includes(q) ||
          (c.communication_type ?? "").toLowerCase().includes(q) ||
          (c.segment ?? "").toLowerCase().includes(q) ||
          (c.campaign_version ?? "").toLowerCase().includes(q) ||
          (c.sending_status ?? "").toLowerCase().includes(q) ||
          (c.message_status ?? "").toLowerCase().includes(q),
      );
    }

    return sortByValue(result, SORT_STATES[sortOption], getCampaignSortValue);
  }, [activeFilter, campaigns, search, sortOption]);

  const totalPages = Math.max(1, Math.ceil(visibleCampaigns.length / PAGE_SIZE));
  const safePage = Math.min(currentPage, totalPages);
  const pageStart = (safePage - 1) * PAGE_SIZE;
  const pagedCampaigns = visibleCampaigns.slice(pageStart, pageStart + PAGE_SIZE);

  function renderPaginationBar(extraStyle?: React.CSSProperties) {
    if (totalPages <= 1) return null;
    return (
      <div
        style={{
          padding: "12px 18px 16px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: 12,
          ...extraStyle,
        }}
      >
        <span style={{ fontSize: 12, color: "#6b7280" }}>
          Showing {pageStart + 1}–{Math.min(pageStart + PAGE_SIZE, visibleCampaigns.length)}{" "}
          of {visibleCampaigns.length} campaigns
        </span>
        <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            disabled={safePage <= 1}
            onClick={() => setCurrentPage(safePage - 1)}
          >
            Previous
          </button>
          {getPageNumbers(safePage, totalPages).map((p, i) =>
            p === "…" ? (
              <span
                key={`ellipsis-${i}`}
                style={{ padding: "0 6px", fontSize: 13, color: "#9ca3af" }}
              >
                …
              </span>
            ) : (
              <button
                key={p}
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={() => setCurrentPage(p as number)}
                style={
                  safePage === p
                    ? { background: "#eff6ff", color: "#1d4ed8", fontWeight: 600 }
                    : undefined
                }
                aria-current={safePage === p ? "page" : undefined}
              >
                {p}
              </button>
            ),
          )}
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            disabled={safePage >= totalPages}
            onClick={() => setCurrentPage(safePage + 1)}
          >
            Next
          </button>
        </div>
      </div>
    );
  }

  function openCampaign(campaign: PartnerEmailCampaign) {
    setSelectedCampaign(campaign);
    setModalMode("view");
    setModalForcedReadOnly(campaign.deleted_at !== null);
    setShowCampaignModal(true);
  }

  function openNewCampaign() {
    setSelectedCampaign(null);
    setModalMode("create");
    setShowCampaignModal(true);
  }

  function handleSavedCampaign(savedCampaign: PartnerEmailCampaign) {
    setCampaigns((prev) => {
      const idx = prev.findIndex((c) => c.id === savedCampaign.id);
      if (idx === -1) return [savedCampaign, ...prev];
      const next = [...prev];
      next[idx] = savedCampaign;
      return next;
    });
    setSelectedCampaign(savedCampaign);
    setModalMode("view");
    setShowCampaignModal(true);
  }

  async function handleTrashCampaign(campaign: PartnerEmailCampaign) {
    setTrashingId(campaign.id);
    try {
      const supabase = createSupabaseBrowserClient();
      const now = new Date().toISOString();
      const { error } = await supabase
        .from("partner_emails")
        .update({ deleted_at: now })
        .eq("id", campaign.id);
      if (error) throw error;
      setCampaigns((prev) =>
        prev.map((c) => (c.id === campaign.id ? { ...c, deleted_at: now } : c)),
      );
    } catch {
      alert("Failed to move campaign to Trash. Please try again.");
    } finally {
      setTrashingId(null);
    }
  }

  async function handleRestoreCampaign(campaign: PartnerEmailCampaign) {
    setRestoringId(campaign.id);
    try {
      const supabase = createSupabaseBrowserClient();
      const { error } = await supabase
        .from("partner_emails")
        .update({ deleted_at: null })
        .eq("id", campaign.id);
      if (error) throw error;
      setCampaigns((prev) =>
        prev.map((c) => (c.id === campaign.id ? { ...c, deleted_at: null } : c)),
      );
    } catch {
      alert("Failed to restore campaign. Please try again.");
    } finally {
      setRestoringId(null);
    }
  }

  async function handlePermanentDelete() {
    if (!deleteTarget) return;
    setDeletingId(deleteTarget.id);
    setDeleteError(null);
    try {
      const supabase = createSupabaseBrowserClient();
      const { error } = await supabase
        .from("partner_emails")
        .delete()
        .eq("id", deleteTarget.id)
        .eq("tenant_id", deleteTarget.tenant_id);
      if (error) throw error;
      setCampaigns((prev) => prev.filter((c) => c.id !== deleteTarget.id));
      setDeleteTarget(null);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      setDeleteError(
        msg.includes("foreign key") || msg.includes("violates")
          ? "This campaign has related records that prevent deletion. Contact support to clean up linked rows before retrying."
          : "Failed to permanently delete campaign. Please try again.",
      );
    } finally {
      setDeletingId(null);
    }
  }

  async function handleEmptyTrash() {
    const eligible = campaigns.filter(canPermanentDeleteCampaign);
    const eligibleIds = eligible.map((c) => c.id);
    if (eligibleIds.length === 0) {
      setShowEmptyTrashModal(false);
      return;
    }
    setEmptyTrashDeleting(true);
    setEmptyTrashError(null);
    try {
      const supabase = createSupabaseBrowserClient();
      const { error } = await supabase
        .from("partner_emails")
        .delete()
        .in("id", eligibleIds)
        .eq("tenant_id", orgId);
      if (error) throw error;
      const deletedSet = new Set(eligibleIds);
      setCampaigns((prev) => prev.filter((c) => !deletedSet.has(c.id)));
      setShowEmptyTrashModal(false);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      setEmptyTrashError(
        msg.includes("foreign key") || msg.includes("violates")
          ? "Some campaigns have related records that prevent deletion. Contact support to clean up linked rows before retrying."
          : "Failed to empty trash. Please try again.",
      );
    } finally {
      setEmptyTrashDeleting(false);
    }
  }

  return (
    <>
      {/* Summary stats */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
          gap: 12,
          marginBottom: 16,
        }}
      >
        <div className="stat-card">
          <div className="stat-label">Total Campaigns</div>
          <div className="stat-value blue">{campaignCounts.all}</div>
          <div className="stat-sub">All tenant campaigns</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Working / Scheduled</div>
          <div className="stat-value amber">{campaignCounts["working-scheduled"]}</div>
          <div className="stat-sub">Active or in-progress campaigns</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Completed</div>
          <div className="stat-value green">{campaignCounts.completed}</div>
          <div className="stat-sub">Finished campaigns</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Total Historical Sent</div>
          <div className="stat-value green">{totalHistoricalSent}</div>
          <div className="stat-sub">Messages sent across campaigns</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Total Opens</div>
          <div className="stat-value">{totalOpenEvents}</div>
          <div className="stat-sub">Touches: {totalTouchRollups}</div>
        </div>
      </div>

      {/* Campaign list */}
      <div className="section-card" style={{ marginBottom: 16 }}>
        <div className="section-header">
          <span className="section-title">Campaigns</span>
          <span className="section-count">{visibleCampaigns.length}</span>
          {canManage ? (
            <div className="section-actions">
              {activeFilter === "trash" && campaignCounts.trash > 0 ? (
                eligibleForEmptyTrash.length > 0 ? (
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    style={{ color: "#b91c1c" }}
                    onClick={() => { setEmptyTrashError(null); setShowEmptyTrashModal(true); }}
                  >
                    Empty Trash
                  </button>
                ) : (
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    disabled
                    title="No campaigns eligible for permanent deletion."
                  >
                    Empty Trash
                  </button>
                )
              ) : null}
              {activeFilter !== "trash" ? (
                <button type="button" className="btn btn-ghost btn-sm" onClick={openNewCampaign}>
                  New Campaign
                </button>
              ) : null}
            </div>
          ) : null}
        </div>

        {/* Filter tabs */}
        <div className="tab-row" style={{ padding: "0 18px 10px", gap: 8 }}>
          {CAMPAIGN_FILTERS.map((filter) => {
            const active = activeFilter === filter.key;
            const count = campaignCounts[filter.key];
            return (
              <button
                key={filter.key}
                type="button"
                className={`tab${active ? " active" : ""}`}
                onClick={() => { setActiveFilter(filter.key); setCurrentPage(1); }}
              >
                {filter.label}
                {count > 0 ? ` (${count})` : ""}
              </button>
            );
          })}
        </div>

        {/* Search + sort toolbar */}
        <div className="table-toolbar">
          <div className="search-wrap" style={{ flex: 1, maxWidth: 380 }}>
            <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6">
              <circle cx="6.5" cy="6.5" r="4.5" />
              <path d="M10 10l3 3" strokeLinecap="round" />
            </svg>
            <input
              type="search"
              placeholder="Search subject, type, segment, status…"
              value={search}
              onChange={(e) => { setSearch(e.target.value); setCurrentPage(1); }}
            />
          </div>
          <select
            className="campaign-sort-select"
            value={sortOption}
            onChange={(e) => { setSortOption(e.target.value as CampaignSortOption); setCurrentPage(1); }}
          >
            <option value="createdAt-desc">Created: Newest</option>
            <option value="createdAt-asc">Created: Oldest</option>
            <option value="deliveryAt-desc">Delivery: Newest</option>
            <option value="deliveryAt-asc">Delivery: Oldest</option>
            <option value="subject-asc">Subject: A–Z</option>
            <option value="subject-desc">Subject: Z–A</option>
            <option value="totalEmailsSent-desc">Total Sent: High–Low</option>
            <option value="totalEmailsSent-asc">Total Sent: Low–High</option>
            <option value="originalOpens-desc">Opens: High–Low</option>
            <option value="originalOpens-asc">Opens: Low–High</option>
            <option value="totalTouches-desc">Touches: High–Low</option>
            <option value="totalTouches-asc">Touches: Low–High</option>
          </select>
        </div>

        {renderPaginationBar({ borderBottom: "1px solid #f3f4f6" })}

        {/* Cards */}
        {visibleCampaigns.length === 0 ? (
          <div className="empty-state">
            {search.trim() ? "No campaigns match your search." : "No campaigns recorded yet."}
          </div>
        ) : (
          <div>
            {pagedCampaigns.map((campaign) => (
              <div key={campaign.id} className="campaign-card">
                {/* Preview column — clickable thumbnail */}
                <div className="campaign-preview-col">
                  <button
                    type="button"
                    className="campaign-preview-btn"
                    onClick={() => setPreviewCampaign(campaign)}
                    aria-label={`Preview email: ${campaign.subject || "no subject"}`}
                  >
                    <EmailPreview html={campaign.message_raw_html} text={campaign.message} />
                  </button>
                </div>

                {/* Metadata column */}
                <div className="campaign-meta-col">
                  {/* Subject + actions */}
                  <div
                    style={{
                      display: "flex",
                      alignItems: "flex-start",
                      justifyContent: "space-between",
                      gap: 12,
                    }}
                  >
                    <div
                      style={{
                        fontSize: 14,
                        fontWeight: 600,
                        color: "#111827",
                        lineHeight: 1.3,
                        flex: 1,
                        minWidth: 0,
                        wordBreak: "break-word",
                      }}
                    >
                      {campaign.subject ? (
                        campaign.subject
                      ) : (
                        <span style={{ color: "#9ca3af", fontWeight: 400 }}>No subject</span>
                      )}
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
                      {campaign.deleted_at !== null ? (
                        <span
                          className="badge"
                          style={{ background: "#fef2f2", color: "#b91c1c" }}
                        >
                          Trashed
                        </span>
                      ) : null}
                      <button
                        type="button"
                        className="action-link"
                        onClick={() => openCampaign(campaign)}
                      >
                        {campaign.deleted_at !== null ? "View" : "View/Edit"}
                      </button>
                      {campaign.deleted_at !== null ? (
                        <>
                          <button
                            type="button"
                            className="action-link"
                            onClick={() => handleRestoreCampaign(campaign)}
                            disabled={restoringId === campaign.id}
                          >
                            {restoringId === campaign.id ? "Restoring…" : "Restore"}
                          </button>
                          {canManage ? (
                            canPermanentDeleteCampaign(campaign) ? (
                              <button
                                type="button"
                                className="action-link"
                                style={{ color: "#b91c1c" }}
                                onClick={() => { setDeleteError(null); setDeleteTarget(campaign); }}
                              >
                                Delete Permanently
                              </button>
                            ) : (
                              <span
                                style={{ fontSize: 12, color: "#9ca3af" }}
                                title="Sent campaigns are kept for delivery history and cannot be permanently deleted."
                              >
                                Delete Permanently
                              </span>
                            )
                          ) : null}
                        </>
                      ) : canManage && canTrashCampaign(campaign) ? (
                        <button
                          type="button"
                          className="action-link"
                          style={{ color: "#b91c1c" }}
                          onClick={() => handleTrashCampaign(campaign)}
                          disabled={trashingId === campaign.id}
                        >
                          {trashingId === campaign.id ? "Moving…" : "Move to Trash"}
                        </button>
                      ) : null}
                    </div>
                  </div>

                  {/* Type / segment / version badges */}
                  <div
                    style={{ display: "flex", gap: 5, flexWrap: "wrap", alignItems: "center" }}
                  >
                    {campaign.communication_type ? (
                      <span className="badge badge-info">{campaign.communication_type}</span>
                    ) : null}
                    {campaign.segment ? (
                      <span className="badge" style={{ background: "#f3f4f6", color: "#374151" }}>
                        {campaign.segment}
                      </span>
                    ) : null}
                    {campaign.campaign_version ? (
                      <span
                        className="badge"
                        style={versionBadgeStyle(campaign.campaign_version)}
                      >
                        v{campaign.campaign_version}
                      </span>
                    ) : null}
                  </div>

                  {/* Status chips */}
                  <div
                    style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}
                  >
                    {campaign.sending_status ? (
                      <span
                        style={{ fontSize: 12, display: "flex", alignItems: "center", gap: 5 }}
                      >
                        <span style={{ color: "#6b7280" }}>Sending:</span>
                        <span className="badge" style={statusBadgeStyle(campaign.sending_status)}>
                          {campaign.sending_status}
                        </span>
                      </span>
                    ) : null}
                    {campaign.message_status ? (
                      <span
                        style={{ fontSize: 12, display: "flex", alignItems: "center", gap: 5 }}
                      >
                        <span style={{ color: "#6b7280" }}>Message:</span>
                        <span className="badge" style={statusBadgeStyle(campaign.message_status)}>
                          {campaign.message_status}
                        </span>
                      </span>
                    ) : null}
                  </div>

                  {/* Dates */}
                  <div
                    style={{
                      display: "flex",
                      gap: 16,
                      flexWrap: "wrap",
                      fontSize: 12,
                      color: "#6b7280",
                    }}
                  >
                    <span>
                      <span style={{ color: "#9ca3af" }}>Created:</span>{" "}
                      {formatDate(campaign.created_at)}
                    </span>
                    {campaign.delivery_datetime ? (
                      <span>
                        <span style={{ color: "#9ca3af" }}>Delivery:</span>{" "}
                        {formatDateTime(campaign.delivery_datetime)}
                      </span>
                    ) : null}
                    {campaign.email_sent_at ? (
                      <span>
                        <span style={{ color: "#9ca3af" }}>Sent:</span>{" "}
                        {formatDateTime(campaign.email_sent_at)}
                      </span>
                    ) : null}
                  </div>

                  {/* Metrics */}
                  <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
                    <MetricPill label="Sent" value={campaign.total_emails_sent} />
                    <MetricPill label="Opens" value={campaign.original_opens} />
                    <MetricPill label="Touches" value={campaign.total_touches} />
                    {campaign.number_of_attachments != null &&
                    campaign.number_of_attachments > 0 ? (
                      <MetricPill
                        label="Attachments"
                        value={campaign.number_of_attachments}
                      />
                    ) : null}
                  </div>
                </div>
              </div>
            ))}
            {renderPaginationBar({ borderTop: "1px solid #f3f4f6" })}
          </div>
        )}
      </div>

      {showCampaignModal ? (
        <CampaignModal
          tenantId={orgId}
          slug={slug}
          mailSettings={mailSettings}
          brandSettings={brandSettings}
          emailAssets={emailAssets}
          testRecipientCount={activeTestRecipientCount}
          contacts={contacts}
          suppressions={suppressions}
          campaign={selectedCampaign}
          mode={modalMode}
          canManage={canManage && !modalForcedReadOnly}
          onAssetsChange={onAssetsChange}
          onClose={() => {
            setSelectedCampaign(null);
            setModalMode("create");
            setModalForcedReadOnly(false);
            setShowCampaignModal(false);
          }}
          onSaved={handleSavedCampaign}
        />
      ) : null}

      {previewCampaign ? (
        <CampaignPreviewModal
          campaign={previewCampaign}
          onClose={() => setPreviewCampaign(null)}
        />
      ) : null}

      {showEmptyTrashModal ? (() => {
        const ineligibleCount = trashedCampaigns.length - eligibleForEmptyTrash.length;
        const bodyText =
          ineligibleCount === 0
            ? `You are getting ready to permanently delete ${eligibleForEmptyTrash.length} campaign(s). This cannot be undone.`
            : `You are getting ready to permanently delete ${eligibleForEmptyTrash.length} campaign(s). ${ineligibleCount} sent campaign(s) will be kept for delivery history. This cannot be undone.`;
        return (
          <SereniusModal
            title="Empty Trash?"
            maxWidth={480}
            closeOnOverlayClick={!emptyTrashDeleting}
            closeOnEscape={!emptyTrashDeleting}
            onClose={() => { if (!emptyTrashDeleting) { setShowEmptyTrashModal(false); setEmptyTrashError(null); } }}
            footer={
              <>
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  onClick={() => { setShowEmptyTrashModal(false); setEmptyTrashError(null); }}
                  disabled={emptyTrashDeleting}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="btn btn-sm"
                  style={{
                    background: "#dc2626",
                    color: "#fff",
                    border: "none",
                    opacity: emptyTrashDeleting ? 0.6 : 1,
                  }}
                  onClick={handleEmptyTrash}
                  disabled={emptyTrashDeleting}
                >
                  {emptyTrashDeleting ? "Deleting…" : "Empty Trash"}
                </button>
              </>
            }
          >
            <p style={{ fontSize: 14, color: "#374151", lineHeight: 1.6 }}>{bodyText}</p>
            {emptyTrashError ? (
              <p
                style={{
                  marginTop: 12,
                  fontSize: 13,
                  color: "#b91c1c",
                  background: "#fef2f2",
                  border: "1px solid #fecaca",
                  borderRadius: 6,
                  padding: "8px 12px",
                }}
              >
                {emptyTrashError}
              </p>
            ) : null}
          </SereniusModal>
        );
      })() : null}

      {deleteTarget ? (
        <SereniusModal
          title="Permanently delete campaign?"
          maxWidth={480}
          closeOnOverlayClick={deletingId === null}
          closeOnEscape={deletingId === null}
          onClose={() => { if (!deletingId) { setDeleteTarget(null); setDeleteError(null); } }}
          footer={
            <>
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={() => { setDeleteTarget(null); setDeleteError(null); }}
                disabled={deletingId !== null}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-sm"
                style={{
                  background: "#dc2626",
                  color: "#fff",
                  border: "none",
                  opacity: deletingId !== null ? 0.6 : 1,
                }}
                onClick={handlePermanentDelete}
                disabled={deletingId !== null}
              >
                {deletingId !== null ? "Deleting…" : "Delete Permanently"}
              </button>
            </>
          }
        >
          <p style={{ fontSize: 14, color: "#374151", lineHeight: 1.6 }}>
            You are getting ready to permanently delete{" "}
            <strong>
              &ldquo;{deleteTarget.subject || "this campaign"}&rdquo;
            </strong>
            . This cannot be undone.
          </p>
          {deleteError ? (
            <p
              style={{
                marginTop: 12,
                fontSize: 13,
                color: "#b91c1c",
                background: "#fef2f2",
                border: "1px solid #fecaca",
                borderRadius: 6,
                padding: "8px 12px",
              }}
            >
              {deleteError}
            </p>
          ) : null}
        </SereniusModal>
      ) : null}
    </>
  );
}

function MetricPill({ label, value }: { label: string; value: number | null | undefined }) {
  return (
    <span style={{ fontSize: 12, color: "#374151" }}>
      <span style={{ color: "#9ca3af" }}>{label}:</span>{" "}
      <span style={{ fontWeight: 500 }}>{value != null ? value.toLocaleString() : "—"}</span>
    </span>
  );
}
