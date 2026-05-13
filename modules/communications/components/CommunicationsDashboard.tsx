"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import SortableHeader from "@/components/ui/SortableHeader";
import {
  nextSortState,
  parseDateSortValue,
  sortByValue,
  type SortState,
  type SortValue,
} from "@/lib/ui/sort";
import CampaignModal from "./CampaignModal";
import type {
  CampaignListFilter,
  CommunicationsPageData,
  MailTestRecipient,
  PartnerEmailCampaign,
} from "../types";
import { CAMPAIGN_FILTERS } from "../constants";

interface Props extends CommunicationsPageData {
  canManage: boolean;
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

function prettyText(value: string | null | undefined): string {
  if (!value || value.trim() === "") return "—";
  return value;
}

type CampaignSortKey =
  | "createdAt"
  | "sendingStatus"
  | "messageStatus"
  | "communicationType"
  | "segment"
  | "campaignVersion"
  | "subject"
  | "deliveryAt"
  | "emailSentAt"
  | "totalEmailsSent"
  | "originalOpens"
  | "totalTouches";

type TestRecipientSortKey = "name" | "email" | "notes";

function classifyCampaign(campaign: PartnerEmailCampaign): CampaignListFilter {
  const sending = (campaign.sending_status ?? "").toLowerCase();
  const message = (campaign.message_status ?? "").toLowerCase();

  if (
    sending === "send complete" ||
    message === "message sent" ||
    Boolean(campaign.email_sent_at)
  ) {
    return "completed";
  }

  if (sending === "canceled" || sending === "failed" || message === "failed") {
    return "failed-canceled";
  }

  if (
    sending === "in-process" ||
    sending === "scheduled" ||
    sending === "ready" ||
    message === "scheduled"
  ) {
    return "in-process-ready";
  }

  if (
    sending === "draft" ||
    sending === "building" ||
    message === "building" ||
    message === "test email"
  ) {
    return "draft-building";
  }

  if (!campaign.email_sent_at) {
    return "draft-building";
  }

  return "completed";
}

function getCampaignSortValue(
  campaign: PartnerEmailCampaign,
  key: CampaignSortKey,
): SortValue {
  switch (key) {
    case "createdAt":
      return parseDateSortValue(campaign.created_at);
    case "sendingStatus":
      return campaign.sending_status;
    case "messageStatus":
      return campaign.message_status;
    case "communicationType":
      return campaign.communication_type;
    case "segment":
      return campaign.segment;
    case "campaignVersion":
      return campaign.campaign_version;
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

function getTestRecipientSortValue(
  recipient: MailTestRecipient,
  key: TestRecipientSortKey,
): SortValue {
  switch (key) {
    case "name":
      return recipient.display_name;
    case "email":
      return recipient.email;
    case "notes":
      return recipient.notes;
  }
}

export default function CommunicationsDashboard({
  slug,
  orgId,
  orgName,
  mailSettings,
  testRecipients,
  campaigns: initialCampaigns,
  opens,
  contacts,
  suppressions,
  canManage,
}: Props) {
  const [campaigns, setCampaigns] = useState<PartnerEmailCampaign[]>(initialCampaigns);
  const [activeFilter, setActiveFilter] = useState<CampaignListFilter>("all");
  const [selectedCampaign, setSelectedCampaign] = useState<PartnerEmailCampaign | null>(null);
  const [modalMode, setModalMode] = useState<"create" | "view" | "edit">("create");
  const [showCampaignModal, setShowCampaignModal] = useState(false);
  const [campaignSort, setCampaignSort] = useState<SortState<CampaignSortKey> | null>(null);
  const [testRecipientSort, setTestRecipientSort] =
    useState<SortState<TestRecipientSortKey> | null>(null);

  const activeTestRecipients = useMemo(
    () => testRecipients.filter((recipient) => recipient.is_active),
    [testRecipients],
  );
  const visibleTestRecipients = useMemo(
    () => sortByValue(activeTestRecipients, testRecipientSort, getTestRecipientSortValue),
    [activeTestRecipients, testRecipientSort],
  );

  const totalOpenEvents = opens.reduce(
    (sum, openRow) => sum + (openRow.open_count ?? 0),
    0,
  );
  const totalTouchRollups = campaigns.reduce(
    (sum, campaign) => sum + (campaign.total_touches ?? 0),
    0,
  );
  const totalHistoricalSent = campaigns.reduce(
    (sum, campaign) => sum + (campaign.total_emails_sent ?? 0),
    0,
  );

  const campaignCounts = useMemo(() => {
    const counts: Record<CampaignListFilter, number> = {
      all: campaigns.length,
      "draft-building": 0,
      "in-process-ready": 0,
      completed: 0,
      "failed-canceled": 0,
    };

    for (const campaign of campaigns) {
      counts[classifyCampaign(campaign)] += 1;
    }

    return counts;
  }, [campaigns]);

  const visibleCampaigns = useMemo(() => {
    const filteredCampaigns =
      activeFilter === "all"
        ? campaigns
        : campaigns.filter((campaign) => classifyCampaign(campaign) === activeFilter);

    return sortByValue(filteredCampaigns, campaignSort, getCampaignSortValue);
  }, [activeFilter, campaignSort, campaigns]);

  function openCampaign(campaign: PartnerEmailCampaign) {
    setSelectedCampaign(campaign);
    setModalMode("view");
    setShowCampaignModal(true);
  }

  function openNewCampaign() {
    setSelectedCampaign(null);
    setModalMode("create");
    setShowCampaignModal(true);
  }

  function handleSavedCampaign(savedCampaign: PartnerEmailCampaign) {
    setCampaigns((prev) => {
      const existingIndex = prev.findIndex((campaign) => campaign.id === savedCampaign.id);

      if (existingIndex === -1) {
        return [savedCampaign, ...prev];
      }

      const next = [...prev];
      next[existingIndex] = savedCampaign;
      return next;
    });

    setSelectedCampaign(savedCampaign);
    setModalMode("view");
    setShowCampaignModal(true);
  }

  return (
    <>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
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
          <div className="stat-label">Draft / Building</div>
          <div className="stat-value amber">{campaignCounts["draft-building"]}</div>
          <div className="stat-sub">Campaigns still in progress</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">In Process / Ready</div>
          <div className="stat-value">{campaignCounts["in-process-ready"]}</div>
          <div className="stat-sub">Scheduled or queued campaigns</div>
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

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "minmax(0, 1.6fr) minmax(320px, 1fr)",
          gap: 12,
          marginBottom: 16,
          alignItems: "start",
        }}
      >
        <div className="section-card" style={{ marginBottom: 0 }}>
          <div className="section-header">
            <span className="section-title">Mail Sender Status</span>
          </div>
          <div style={{ padding: "0 18px 8px" }}>
            {mailSettings ? (
              <>
                <DetailRow label="Provider" value={prettyText(mailSettings.provider)} />
                <DetailRow label="Display Name" value={prettyText(mailSettings.display_name)} />
                <DetailRow label="From Name" value={prettyText(mailSettings.from_name)} />
                <DetailRow label="From Email" value={prettyText(mailSettings.from_email)} />
                <DetailRow label="Reply To" value={prettyText(mailSettings.reply_to)} />
                <DetailRow label="Connection Status" value={prettyText(mailSettings.connection_status)} />
                <DetailRow label="Send Mode" value={prettyText(mailSettings.send_mode)} />
                <DetailRow label="Provider Account Email" value={prettyText(mailSettings.provider_account_email)} />
                <DetailRow label="Enabled" value={mailSettings.is_enabled ? "Yes" : "No"} />
              </>
            ) : (
              <div style={{ padding: "16px 0 18px" }}>
                <div className="empty-state" style={{ textAlign: "left" }}>
                  Mail sender is not configured yet.
                </div>
                <div style={{ marginTop: 10 }}>
                  <Link
                    href={`/${slug}/setup?tab=integrations#mail-sender`}
                    className="action-link"
                  >
                    Configure Mail Sender
                  </Link>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="section-card" style={{ marginBottom: 0 }}>
          <div className="section-header">
            <span className="section-title">Test Recipients</span>
            <span className="section-count">{activeTestRecipients.length}</span>
          </div>

          {activeTestRecipients.length === 0 ? (
            <div className="empty-state">
              No active test recipients configured yet.
            </div>
          ) : (
            <div className="table-scroll">
              <table className="data-table">
                <thead>
                  <tr>
                    <SortableHeader
                      label="Name"
                      sortKey="name"
                      sort={testRecipientSort}
                      onSort={(key) => setTestRecipientSort((current) => nextSortState(current, key))}
                    />
                    <SortableHeader
                      label="Email"
                      sortKey="email"
                      sort={testRecipientSort}
                      onSort={(key) => setTestRecipientSort((current) => nextSortState(current, key))}
                    />
                    <SortableHeader
                      label="Notes"
                      sortKey="notes"
                      sort={testRecipientSort}
                      onSort={(key) => setTestRecipientSort((current) => nextSortState(current, key))}
                    />
                  </tr>
                </thead>
                <tbody>
                  {visibleTestRecipients.map((recipient) => (
                      <tr key={recipient.id}>
                        <td>{recipient.display_name || "—"}</td>
                        <td>{recipient.email}</td>
                        <td>{recipient.notes || "—"}</td>
                      </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <div style={{ padding: "0 18px 16px" }}>
            <div className="form-helper">
              Test recipient CRUD will be added in a later slice.
            </div>
          </div>
        </div>
      </div>

        <div className="section-card" style={{ marginBottom: 16 }}>
        <div className="section-header">
          <span className="section-title">Campaigns</span>
          <span className="section-count">{visibleCampaigns.length}</span>
          {canManage ? (
            <div className="section-actions">
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={openNewCampaign}
              >
                New Campaign
              </button>
            </div>
          ) : null}
        </div>

        <div className="tab-row" style={{ padding: "0 18px 10px", gap: 8 }}>
          {CAMPAIGN_FILTERS.map((filter) => {
            const active = activeFilter === filter.key
            const count = campaignCounts[filter.key]
            return (
              <button
                key={filter.key}
                type="button"
                className={`tab${active ? " active" : ""}`}
                onClick={() => setActiveFilter(filter.key)}
              >
                {filter.label} {count > 0 ? `(${count})` : ""}
              </button>
            )
          })}
        </div>

        {visibleCampaigns.length === 0 ? (
          <div className="empty-state">No campaigns recorded yet.</div>
        ) : (
          <div className="table-scroll">
            <table className="data-table">
              <thead>
                <tr>
                  <th className="actions-column">ACTIONS</th>
                  <SortableHeader
                    label="Created Date"
                    sortKey="createdAt"
                    sort={campaignSort}
                    onSort={(key) => setCampaignSort((current) => nextSortState(current, key))}
                  />
                  <SortableHeader
                    label="Sending Status"
                    sortKey="sendingStatus"
                    sort={campaignSort}
                    onSort={(key) => setCampaignSort((current) => nextSortState(current, key))}
                  />
                  <SortableHeader
                    label="Message Status"
                    sortKey="messageStatus"
                    sort={campaignSort}
                    onSort={(key) => setCampaignSort((current) => nextSortState(current, key))}
                  />
                  <SortableHeader
                    label="Communication Type"
                    sortKey="communicationType"
                    sort={campaignSort}
                    onSort={(key) => setCampaignSort((current) => nextSortState(current, key))}
                  />
                  <SortableHeader
                    label="Segment"
                    sortKey="segment"
                    sort={campaignSort}
                    onSort={(key) => setCampaignSort((current) => nextSortState(current, key))}
                  />
                  <SortableHeader
                    label="Campaign Version"
                    sortKey="campaignVersion"
                    sort={campaignSort}
                    onSort={(key) => setCampaignSort((current) => nextSortState(current, key))}
                  />
                  <SortableHeader
                    label="Subject"
                    sortKey="subject"
                    sort={campaignSort}
                    onSort={(key) => setCampaignSort((current) => nextSortState(current, key))}
                  />
                  <SortableHeader
                    label="Delivery Date/Time"
                    sortKey="deliveryAt"
                    sort={campaignSort}
                    onSort={(key) => setCampaignSort((current) => nextSortState(current, key))}
                  />
                  <SortableHeader
                    label="Email Sent"
                    sortKey="emailSentAt"
                    sort={campaignSort}
                    onSort={(key) => setCampaignSort((current) => nextSortState(current, key))}
                  />
                  <SortableHeader
                    label="Total Emails Sent"
                    sortKey="totalEmailsSent"
                    sort={campaignSort}
                    onSort={(key) => setCampaignSort((current) => nextSortState(current, key))}
                    align="right"
                  />
                  <SortableHeader
                    label="Original Opens"
                    sortKey="originalOpens"
                    sort={campaignSort}
                    onSort={(key) => setCampaignSort((current) => nextSortState(current, key))}
                    align="right"
                  />
                  <SortableHeader
                    label="Total Touches"
                    sortKey="totalTouches"
                    sort={campaignSort}
                    onSort={(key) => setCampaignSort((current) => nextSortState(current, key))}
                    align="right"
                  />
                </tr>
              </thead>
              <tbody>
                {visibleCampaigns.map((campaign) => (
                  <tr key={campaign.id}>
                    <td className="actions-column">
                      <button
                        type="button"
                        className="action-link"
                        onClick={() => openCampaign(campaign)}
                      >
                        View/Edit
                      </button>
                    </td>
                    <td>{formatDate(campaign.created_at)}</td>
                    <td>{campaign.sending_status || "—"}</td>
                    <td>{campaign.message_status || "—"}</td>
                    <td>{campaign.communication_type || "—"}</td>
                    <td>{campaign.segment || "—"}</td>
                    <td>{campaign.campaign_version || "—"}</td>
                    <td>{campaign.subject || "—"}</td>
                    <td>{formatDateTime(campaign.delivery_datetime)}</td>
                    <td>{formatDateTime(campaign.email_sent_at)}</td>
                    <td style={{ textAlign: "right" }}>{campaign.total_emails_sent ?? "—"}</td>
                    <td style={{ textAlign: "right" }}>{campaign.original_opens ?? "—"}</td>
                    <td style={{ textAlign: "right" }}>{campaign.total_touches ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showCampaignModal ? (
        <CampaignModal
          tenantId={orgId}
          slug={slug}
          mailSettings={mailSettings}
          contacts={contacts}
          suppressions={suppressions}
          campaign={selectedCampaign}
          mode={modalMode}
          canManage={canManage}
          onClose={() => {
            setSelectedCampaign(null)
            setModalMode("create")
            setShowCampaignModal(false)
          }}
          onSaved={handleSavedCampaign}
        />
      ) : null}
    </>
  )
}

function DetailRow({
  label,
  value,
}: {
  label: string
  value: React.ReactNode
}) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "180px 1fr",
        gap: 12,
        padding: "9px 0",
        borderBottom: "1px solid #f3f4f6",
        alignItems: "flex-start",
      }}
    >
      <span style={{ fontSize: 12, fontWeight: 500, color: "#6b7280", paddingTop: 1 }}>
        {label}
      </span>
      <span style={{ fontSize: 13, color: "#111827", lineHeight: 1.5 }}>
        {value ?? <span style={{ color: "#d1d5db" }}>—</span>}
      </span>
    </div>
  )
}
