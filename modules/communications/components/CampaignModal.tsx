"use client";

import React, { useEffect, useMemo, useState } from "react";
import SereniusModal from "@/components/ui/SereniusModal";
import RecordAttachments from "@/components/attachments/RecordAttachments";
import { createSupabaseBrowserClient } from "@/lib/supabase-browser";
import type {
  CampaignFormMode,
  CommunicationEmailAsset,
  EmailBrandSettings,
  MailSettingsSummary,
  PartnerContactEstimate,
  PartnerEmailCampaign,
  PartnerEmailSuppression,
} from "../types";
import type { EmailBuilderDesign } from "../email-builder-types";
import { hasBuilderBlocks, parseDesign, renderEmailBuilderHtml } from "../email-builder-renderer";
import BlockComposer from "./BlockComposer";
import {
  CAMPAIGN_VERSION_OPTIONS,
  COMMUNICATION_TYPE_OPTIONS,
} from "../constants";

interface Props {
  slug: string;
  tenantId: string;
  mailSettings: MailSettingsSummary | null;
  testRecipientCount: number;
  contacts: PartnerContactEstimate[];
  suppressions: PartnerEmailSuppression[];
  campaign: PartnerEmailCampaign | null;
  mode: CampaignFormMode;
  canManage: boolean;
  brandSettings?: EmailBrandSettings | null;
  emailAssets?: CommunicationEmailAsset[];
  onAssetsChange?: (assets: CommunicationEmailAsset[]) => void;
  onClose: () => void;
  onSaved: (campaign: PartnerEmailCampaign) => void;
}

type FormData = {
  communication_type: string;
  email_style: string;
  segment: string;
  campaign_version: string;
  subject: string;
  message: string;
  message_raw_html: string;
  delivery_datetime: string;
  design_json: Record<string, unknown>;
};

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

function normalizeDateTimeInput(value: string | null | undefined): string {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";

  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(
    date.getHours(),
  )}:${pad(date.getMinutes())}`;
}

function prettyText(value: string | null | undefined): string {
  if (!value || value.trim() === "") return "—";
  return value;
}

function isLockedCampaign(campaign: PartnerEmailCampaign | null): boolean {
  if (!campaign) return false;

  const sending = (campaign.sending_status ?? "").toLowerCase();
  const message = (campaign.message_status ?? "").toLowerCase();

  return (
    sending === "send complete" ||
    sending === "canceled" ||
    message === "message sent"
  );
}

function classifyCampaign(campaign: PartnerEmailCampaign): "draft-building" | "in-process-ready" | "completed" | "failed-canceled" {
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

function buildDefaultFormData(): FormData {
  return {
    communication_type: "",
    email_style: "Raw HTML",
    segment: "",
    campaign_version: "A+B",
    subject: "",
    message: "",
    message_raw_html: "",
    delivery_datetime: "",
    design_json: {},
  };
}

function mapCampaignToFormData(campaign: PartnerEmailCampaign): FormData {
  return {
    communication_type: campaign.communication_type ?? "",
    email_style: campaign.email_style ?? "Raw HTML",
    segment: campaign.segment ?? "",
    campaign_version: campaign.campaign_version ?? "A+B",
    subject: campaign.subject ?? "",
    message: campaign.message ?? "",
    message_raw_html: campaign.message_raw_html ?? "",
    delivery_datetime: normalizeDateTimeInput(campaign.delivery_datetime),
    design_json: (campaign.design_json && typeof campaign.design_json === "object" && !Array.isArray(campaign.design_json))
      ? campaign.design_json
      : {},
  };
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
  );
}

function RecipientEstimateCard({
  contacts,
  suppressions,
  segment,
  campaignVersion,
}: {
  contacts: PartnerContactEstimate[]
  suppressions: PartnerEmailSuppression[]
  segment: string
  campaignVersion: string
}) {
  const estimate = useMemo(() => {
    const selectedSegment = segment.trim();

    if (!selectedSegment) {
      return {
        estimatedRecipients: 0,
        suppressedCount: 0,
        noEmailCount: 0,
        skippedCount: 0,
        ready: false,
      };
    }

    const suppressedEmailSet = new Set(
      suppressions.map((item) => item.email.trim().toLowerCase()),
    );

    let estimatedRecipients = 0;
    let suppressedCount = 0;
    let noEmailCount = 0;
    let skippedCount = 0;

    for (const contact of contacts) {
      const email = contact.primary_email?.trim() ?? "";

      if (!email) {
        noEmailCount += 1;
        continue;
      }

      const segments = contact.email_segment ?? [];
      const segmentMatches = segments.includes(selectedSegment);

      if (!segmentMatches) {
        continue;
      }

      const version = contact.campaign_version ?? "";
      const versionAllowed =
        campaignVersion === "A+B"
          ? version === "A" || version === "B"
          : campaignVersion === "A"
            ? version === "A"
            : campaignVersion === "B"
              ? version === "B"
              : false;

      if (!versionAllowed || version === "Skip") {
        skippedCount += 1;
        continue;
      }

      if (suppressedEmailSet.has(email.toLowerCase())) {
        suppressedCount += 1;
        continue;
      }

      estimatedRecipients += 1;
    }

    return {
      estimatedRecipients,
      suppressedCount,
      noEmailCount,
      skippedCount,
      ready: true,
    };
  }, [campaignVersion, contacts, segment, suppressions]);

  return (
    <div className="section-card" style={{ marginBottom: 0, border: "1px solid #e5e7eb" }}>
      <div className="section-header">
        <span className="section-title">Recipient Estimate</span>
      </div>

      <div style={{ padding: "16px 18px 18px" }}>
        {!estimate.ready ? (
          <div className="empty-state">
            Select a segment to estimate recipients.
          </div>
        ) : (
          <div style={{ display: "grid", gap: 12 }}>
            <div className="stat-card">
              <div className="stat-label">Estimated Recipients</div>
              <div className="stat-value" style={{ fontSize: 22, color: estimate.estimatedRecipients > 0 ? "#3B6D11" : "#9ca3af" }}>
                {estimate.estimatedRecipients}
              </div>
              <div className="stat-sub">After suppression and campaign version checks</div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 10 }}>
              <div className="section-card" style={{ marginBottom: 0, boxShadow: "none" }}>
                <div className="section-header" style={{ padding: "10px 12px", borderBottom: 0 }}>
                  <span className="section-title" style={{ fontSize: 11 }}>Suppressed</span>
                </div>
                <div style={{ padding: "0 12px 12px", fontSize: 18, fontWeight: 600, color: "#9ca3af" }}>
                  {estimate.suppressedCount}
                </div>
              </div>
              <div className="section-card" style={{ marginBottom: 0, boxShadow: "none" }}>
                <div className="section-header" style={{ padding: "10px 12px", borderBottom: 0 }}>
                  <span className="section-title" style={{ fontSize: 11 }}>No Email</span>
                </div>
                <div style={{ padding: "0 12px 12px", fontSize: 18, fontWeight: 600, color: "#9ca3af" }}>
                  {estimate.noEmailCount}
                </div>
              </div>
              <div className="section-card" style={{ marginBottom: 0, boxShadow: "none" }}>
                <div className="section-header" style={{ padding: "10px 12px", borderBottom: 0 }}>
                  <span className="section-title" style={{ fontSize: 11 }}>Skipped</span>
                </div>
                <div style={{ padding: "0 12px 12px", fontSize: 18, fontWeight: 600, color: "#9ca3af" }}>
                  {estimate.skippedCount}
                </div>
              </div>
            </div>

            <p style={{ fontSize: 12, color: "#6b7280", lineHeight: 1.5 }}>
              Suppression checks will be applied before sending.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

function MetaItem({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <div style={{ fontSize: 11, fontWeight: 500, color: "#9ca3af", marginBottom: 2 }}>{label}</div>
      <div style={{ fontSize: 12, color: "#374151", lineHeight: 1.4 }}>{value}</div>
    </div>
  );
}

function campaignBadgeStyle(status: string): React.CSSProperties {
  const s = status.toLowerCase();
  if (s.includes("complete") || s.includes("sent") || s.includes("success")) {
    return { background: "#dcfce7", color: "#15803d" };
  }
  if (s.includes("cancel") || s.includes("fail")) {
    return { background: "#fee2e2", color: "#b91c1c" };
  }
  if (s.includes("process") || s.includes("scheduled") || s.includes("ready")) {
    return { background: "#dbeafe", color: "#1d4ed8" };
  }
  if (s.includes("test")) {
    return { background: "#fef3c7", color: "#92400e" };
  }
  return { background: "#f3f4f6", color: "#6b7280" };
}

function ReadinessItem({ ok, text }: { ok: boolean; text: string }) {
  return (
    <div style={{ display: "flex", alignItems: "flex-start", gap: 6, fontSize: 12, lineHeight: 1.4 }}>
      <span style={{ fontWeight: 700, flexShrink: 0, color: ok ? "#15803d" : "#9ca3af", width: 12 }}>
        {ok ? "✓" : "✗"}
      </span>
      <span style={{ color: ok ? "#374151" : "#6b7280" }}>{text}</span>
    </div>
  );
}

export default function CampaignModal({
  tenantId,
  mailSettings,
  testRecipientCount,
  contacts,
  suppressions,
  campaign,
  mode,
  canManage,
  brandSettings,
  emailAssets,
  onAssetsChange,
  slug,
  onClose,
  onSaved,
}: Props) {
  const supabase = createSupabaseBrowserClient();
  const isCreate = mode === "create";
  const [currentMode, setCurrentMode] = useState<CampaignFormMode>(mode);
  const [currentCampaign, setCurrentCampaign] = useState<PartnerEmailCampaign | null>(campaign);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formData, setFormData] = useState<FormData>(
    campaign ? mapCampaignToFormData(campaign) : buildDefaultFormData(),
  );
  const [testSending, setTestSending] = useState(false);
  const [testSendResult, setTestSendResult] = useState<{ ok: boolean; message: string } | null>(null);
  const [campaignDetailsOpen, setCampaignDetailsOpen] = useState<boolean>(() =>
    mode === "create" || !(campaign?.communication_type && campaign?.segment && campaign?.subject)
  );
  const [previewHeight, setPreviewHeight] = useState(680);
  const [rawHtmlPreviewDoc, setRawHtmlPreviewDoc] = useState<string>(campaign?.message_raw_html ?? "");

  const parsedDesign: EmailBuilderDesign = useMemo(
    () => parseDesign(formData.design_json),
    [formData.design_json],
  );

  useEffect(() => {
    setCurrentMode(mode);
    setCurrentCampaign(campaign);
    setError(null);
    setFormData(campaign ? mapCampaignToFormData(campaign) : buildDefaultFormData());
    setTestSendResult(null);
    setCampaignDetailsOpen(
      mode === "create" || !(campaign?.communication_type && campaign?.segment && campaign?.subject)
    );
    setRawHtmlPreviewDoc(campaign?.message_raw_html ?? "");
  }, [campaign, mode]);

  useEffect(() => {
    if (error) setCampaignDetailsOpen(true);
  }, [error]);

  function collapseAllSections() {
    setCampaignDetailsOpen(false);
  }

  function handlePreviewLoad(e: React.SyntheticEvent<HTMLIFrameElement>) {
    const iframeEl = e.currentTarget;

    function measure() {
      try {
        const doc = iframeEl.contentDocument;
        if (!doc) return;
        const h = Math.max(
          doc.documentElement.scrollHeight || 0,
          doc.body?.scrollHeight || 0,
          doc.documentElement.offsetHeight || 0,
          doc.body?.offsetHeight || 0,
        );
        if (h > 0) setPreviewHeight(h);
      } catch { /* noop: cross-origin guard */ }
    }

    measure();
    requestAnimationFrame(measure);
    setTimeout(measure, 100);
    setTimeout(measure, 300);

    // Re-measure once each image inside the iframe finishes loading.
    // { once: true } auto-removes the listener after it fires — no explicit cleanup needed.
    try {
      const doc = iframeEl.contentDocument;
      if (doc) {
        doc.querySelectorAll('img').forEach((img) => {
          if (!(img as HTMLImageElement).complete) {
            img.addEventListener('load', measure, { once: true });
            img.addEventListener('error', measure, { once: true });
          }
        });
      }
    } catch { /* noop: cross-origin guard */ }
  }

  const canEdit = canManage && !isLockedCampaign(currentCampaign);

  const estimate = useMemo(() => {
    const segment = formData.segment.trim();
    const campaignVersion = formData.campaign_version.trim() || "A+B";
    const suppressedEmailSet = new Set(
      suppressions.map((item) => item.email.trim().toLowerCase()),
    );

    if (!segment) {
      return {
        estimatedRecipients: 0,
        suppressedCount: 0,
        noEmailCount: 0,
        skippedCount: 0,
        ready: false,
      };
    }

    let estimatedRecipients = 0;
    let suppressedCount = 0;
    let noEmailCount = 0;
    let skippedCount = 0;

    for (const contact of contacts) {
      const segments = contact.email_segment ?? [];
      if (!segments.includes(segment)) {
        continue;
      }

      const version = contact.campaign_version ?? "";
      const versionAllowed =
        campaignVersion === "A+B"
          ? version === "A" || version === "B"
          : campaignVersion === "A"
            ? version === "A"
            : campaignVersion === "B"
              ? version === "B"
              : false;

      if (!versionAllowed || version === "Skip") {
        skippedCount += 1;
        continue;
      }

      const email = contact.primary_email?.trim() ?? "";
      if (!email) {
        noEmailCount += 1;
        continue;
      }

      if (suppressedEmailSet.has(email.toLowerCase())) {
        suppressedCount += 1;
        continue;
      }

      estimatedRecipients += 1;
    }

    return {
      estimatedRecipients,
      suppressedCount,
      noEmailCount,
      skippedCount,
      ready: true,
    };
  }, [contacts, formData.campaign_version, formData.segment, suppressions]);

  function handleChange(field: keyof FormData, value: string) {
    setFormData((prev) => ({
      ...prev,
      [field]: value,
    } as FormData));
  }

  function updateDesignJson(design: EmailBuilderDesign) {
    setFormData((prev) => ({
      ...prev,
      design_json: design as unknown as Record<string, unknown>,
    }));
  }

  function resetToCampaign() {
    if (currentCampaign) {
      setFormData(mapCampaignToFormData(currentCampaign));
    } else {
      setFormData(buildDefaultFormData());
    }

    setError(null);
    setCurrentMode(currentCampaign ? "view" : "create");
  }

  async function saveCampaign() {
    setSaving(true);
    setError(null);

    const payloadBase = {
      communication_type: formData.communication_type || null,
      email_style: formData.email_style || null,
      segment: formData.segment || null,
      campaign_version: formData.campaign_version || null,
      subject: formData.subject || null,
      message: formData.message || null,
      message_raw_html: formData.email_style !== "Raw HTML"
        ? (hasBuilderBlocks(parsedDesign)
            ? renderEmailBuilderHtml(parsedDesign, brandSettings ?? null)
            : (formData.message_raw_html || null))
        : (formData.message_raw_html || null),
      delivery_datetime: formData.delivery_datetime
        ? new Date(formData.delivery_datetime).toISOString()
        : null,
      design_json: formData.design_json,
    }

    const { data: authResult } = await supabase.auth.getUser()

    const result = currentCampaign
      ? await supabase
          .from("partner_emails")
          .update({
            ...payloadBase,
            updated_at: new Date().toISOString(),
          })
          .eq("id", currentCampaign.id)
          .eq("tenant_id", tenantId)
          .select("*")
          .single()
      : await supabase
          .from("partner_emails")
          .insert({
            tenant_id: tenantId,
            sending_status: "Draft",
            message_status: "Building",
            sent_type: null,
            total_emails_sent: 0,
            original_opens: 0,
            total_touches: 0,
            created_by: authResult.user?.id ?? null,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            ...payloadBase,
          })
          .select("*")
          .single()

    setSaving(false)

    if (result.error || !result.data) {
      setError(result.error?.message ?? "Failed to save campaign.")
      return
    }

    const savedCampaign = result.data as PartnerEmailCampaign
    setCurrentCampaign(savedCampaign)
    setCurrentMode("view")
    setFormData(mapCampaignToFormData(savedCampaign))
    onSaved(savedCampaign)
  }

  async function handleTestSend() {
    if (!currentCampaign?.id) return;
    setTestSending(true);
    setTestSendResult(null);
    try {
      const res = await fetch(`/api/mail/google/campaign-test-send?tenantId=${tenantId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ campaign_id: currentCampaign.id }),
      });
      const data = await res.json();
      if (data.ok) {
        setCurrentCampaign((prev) => (prev ? { ...prev, message_status: "Test Sent" } : prev));
        setTestSendResult({
          ok: true,
          message: `Test sent to ${data.recipients_sent} recipient${data.recipients_sent === 1 ? "" : "s"}.`,
        });
      } else {
        setTestSendResult({ ok: false, message: data.error || "Test send failed." });
      }
    } catch {
      setTestSendResult({ ok: false, message: "Network error. Please try again." });
    } finally {
      setTestSending(false);
    }
  }

  const isReadOnlyCampaign = !isCreate && !canEdit

  if (!isCreate && currentMode === "view") {
    const viewCampaign = currentCampaign

    const hasSubject = !!(viewCampaign?.subject?.trim());
    const hasContent = !!(viewCampaign?.message_raw_html?.trim() || viewCampaign?.message?.trim());
    const mailReady =
      mailSettings?.connection_status === "connected" &&
      mailSettings?.is_enabled === true &&
      mailSettings?.send_mode === "test_only";
    const hasTestRecipients = testRecipientCount > 0;
    const canTestSend = hasSubject && hasContent && !!mailReady && hasTestRecipients;

    return (
      <SereniusModal
        title="View Campaign"
        description={viewCampaign?.subject || "Campaign details"}
        onClose={onClose}
        maxWidth={1120}
        contentPadding={0}
        headerActions={
          canEdit ? (
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => setCurrentMode("edit")}
            >
              Edit Campaign
            </button>
          ) : null
        }
      >
        <div style={{ padding: "24px 24px 128px", display: "grid", gap: 20 }}>
          <div className="section-card" style={{ marginBottom: 0 }}>
            <div className="section-header">
              <span className="section-title">Campaign Details</span>
            </div>
            <div style={{ padding: "16px 18px 18px", display: "grid", gap: 14 }}>
              {/* Subject — prominent */}
              <div>
                <div style={{ fontSize: 11, fontWeight: 600, color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 4 }}>Subject</div>
                <div style={{ fontSize: 15, fontWeight: 600, color: viewCampaign?.subject ? "#111827" : "#d1d5db", lineHeight: 1.4 }}>
                  {viewCampaign?.subject || "No subject set"}
                </div>
              </div>

              {/* Status + classification badges */}
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {viewCampaign?.communication_type && (
                  <span className="badge badge-info">{viewCampaign.communication_type}</span>
                )}
                {viewCampaign?.segment && (
                  <span className="badge" style={{ background: "#f3f4f6", color: "#374151" }}>{viewCampaign.segment}</span>
                )}
                {viewCampaign?.campaign_version && (
                  <span className="badge" style={{ background: "#ede9fe", color: "#5b21b6" }}>{viewCampaign.campaign_version}</span>
                )}
                {viewCampaign?.sending_status && (
                  <span className="badge" style={campaignBadgeStyle(viewCampaign.sending_status)}>{viewCampaign.sending_status}</span>
                )}
                {viewCampaign?.message_status && (
                  <span className="badge" style={campaignBadgeStyle(viewCampaign.message_status)}>{viewCampaign.message_status}</span>
                )}
              </div>

              {/* Compact metadata grid */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px 24px" }}>
                <MetaItem label="Content Mode" value={viewCampaign?.email_style === "Rich Text" ? "Serenius Builder" : (viewCampaign?.email_style || "—")} />
                <MetaItem label="Created" value={formatDateTime(viewCampaign?.created_at)} />
                <MetaItem label="Delivery" value={formatDateTime(viewCampaign?.delivery_datetime)} />
                <MetaItem label="Email Sent At" value={formatDateTime(viewCampaign?.email_sent_at)} />
                <MetaItem label="Sent Type" value={prettyText(viewCampaign?.sent_type)} />
                <MetaItem label="Total Sent" value={viewCampaign?.total_emails_sent ?? "—"} />
                <MetaItem label="Opens" value={viewCampaign?.original_opens ?? "—"} />
                <MetaItem label="Touches" value={viewCampaign?.total_touches ?? "—"} />
              </div>
            </div>
          </div>

          <div className="section-card" style={{ marginBottom: 0 }}>
            <div className="section-header">
              <span className="section-title">
                {viewCampaign?.message_raw_html ? "HTML Preview" : viewCampaign?.message ? "Message Preview" : "Campaign Preview"}
              </span>
            </div>
            <div style={{ padding: "16px 18px 18px", display: "grid", gap: 14 }}>
              {viewCampaign?.html_file_url && (
                <div style={{ fontSize: 13, color: "#374151" }}>
                  <span style={{ fontWeight: 600 }}>HTML File:</span>{" "}
                  <a
                    href={viewCampaign.html_file_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="action-link"
                  >
                    {viewCampaign.html_file_name || "Open HTML file"}
                  </a>
                </div>
              )}

              {viewCampaign?.message_raw_html ? (
                <div
                  style={{
                    border: "1px solid #e5e7eb",
                    borderRadius: 12,
                    overflow: "hidden",
                    background: "#fff",
                  }}
                >
                  <iframe
                    title="Campaign HTML Preview"
                    sandbox=""
                    srcDoc={viewCampaign.message_raw_html}
                    style={{
                      width: "100%",
                      minHeight: 360,
                      border: 0,
                      display: "block",
                      background: "#fff",
                    }}
                  />
                </div>
              ) : viewCampaign?.message ? (
                <div
                  style={{
                    border: "1px solid #e5e7eb",
                    borderRadius: 12,
                    padding: 16,
                    background: "#fafaf8",
                    whiteSpace: "pre-wrap",
                    lineHeight: 1.6,
                    fontSize: 13,
                    color: "#111827",
                  }}
                >
                  {viewCampaign.message}
                </div>
              ) : (
                <div className="empty-state">
                  No preview content available yet.
                </div>
              )}
            </div>
          </div>

          {viewCampaign?.id ? (
            <RecordAttachments
              tenantId={tenantId}
              recordType="partner_email"
              recordId={viewCampaign.id}
              title="Campaign Files"
              emptyMessage="HTML and media file upload will use shared attachments in the next slice."
              readonly={isReadOnlyCampaign || !canManage}
            />
          ) : (
            <div className="section-card" style={{ marginBottom: 0 }}>
              <div className="section-header">
                <span className="section-title">Campaign Files</span>
              </div>
              <div className="empty-state">
                Save the campaign to manage HTML and media files.
              </div>
            </div>
          )}

          {/* Send Test Email */}
          <div className="section-card" style={{ marginBottom: 0 }}>
            <div className="section-header">
              <span className="section-title">Send Test Email</span>
            </div>
            <div style={{ padding: "16px 18px 18px", display: "grid", gap: 12 }}>
              <p style={{ fontSize: 13, color: "#6b7280", lineHeight: 1.5, margin: 0 }}>
                Sends this campaign only to configured test recipients. No partner or contact lists are included.
              </p>
              <div style={{ display: "grid", gap: 5 }}>
                <ReadinessItem ok={hasSubject} text="Subject" />
                <ReadinessItem ok={hasContent} text="Message content (HTML or plain text)" />
                <ReadinessItem
                  ok={!!mailReady}
                  text={
                    mailSettings
                      ? `Mail sender connected, enabled, and set to Test Only (current: ${mailSettings.send_mode ?? "not set"})`
                      : "Mail sender not configured — set up in Setup → Integrations"
                  }
                />
                <ReadinessItem
                  ok={hasTestRecipients}
                  text={
                    hasTestRecipients
                      ? `${testRecipientCount} active test recipient${testRecipientCount === 1 ? "" : "s"} configured`
                      : "No active test recipients — add them in Setup → Integrations"
                  }
                />
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  disabled={!canTestSend || testSending}
                  onClick={handleTestSend}
                >
                  {testSending ? "Sending…" : "Send Test Email"}
                </button>
                {testSendResult && (
                  <span
                    style={{
                      fontSize: 13,
                      fontWeight: 500,
                      color: testSendResult.ok ? "#15803d" : "#b91c1c",
                    }}
                  >
                    {testSendResult.message}
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
      </SereniusModal>
    );
  }

  return (
    <SereniusModal
      title={isCreate ? "New Campaign" : "Edit Campaign"}
      description={
        isCreate
          ? "Create a new email campaign draft. Real sending remains disabled."
          : "Update draft or in-process campaign details."
      }
      onClose={onClose}
      maxWidth={1440}
      contentPadding={0}
      showCloseButton={isCreate}
      closeOnOverlayClick={isCreate}
      closeOnEscape={isCreate}
      headerActions={
        !isCreate ? (
          <button
            type="button"
            className="btn btn-ghost"
            onClick={resetToCampaign}
          >
            Back to View
          </button>
        ) : null
      }
      footer={
        <>
          <button
            type="button"
            className="btn btn-ghost"
            onClick={isCreate ? onClose : resetToCampaign}
            disabled={saving}
          >
            Cancel
          </button>

          <button
            type="button"
            className="btn btn-primary"
            onClick={saveCampaign}
            disabled={saving || (!isCreate && !canEdit)}
          >
            {saving ? "Saving..." : isCreate ? "Create Campaign" : "Save Changes"}
          </button>
        </>
      }
    >
      <div style={{ padding: "24px 24px 128px", display: "grid", gap: 20 }}>
        {formData.email_style !== "Raw HTML" ? (
          <>
            {/* Builder mode: details + composer left, sticky live preview right */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "minmax(0, 3fr) minmax(0, 2fr)",
                gap: 20,
                alignItems: "start",
              }}
            >
              <div style={{ display: "grid", gap: 16 }}>
                <div className="section-card" style={{ marginBottom: 0 }}>
                  <div
                    className="section-header"
                    onClick={() => setCampaignDetailsOpen(v => !v)}
                    style={{ cursor: "pointer", userSelect: "none" }}
                  >
                    <span className="section-title" style={{ flex: 1 }}>Campaign Details</span>
                    {!campaignDetailsOpen && (
                      <span style={{ fontSize: 11, color: "#9ca3af", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 280 }}>
                        {[formData.subject, formData.segment].filter(Boolean).join(" · ") || "Incomplete"}
                      </span>
                    )}
                    <span style={{ fontSize: 11, color: "#6b7280", flexShrink: 0 }}>{campaignDetailsOpen ? "▲" : "▼"}</span>
                  </div>
                  {campaignDetailsOpen && (
                  <div style={{ padding: "16px 18px 18px", display: "grid", gap: 14 }}>
                    <div className="form-row">
                      <div className="form-group">
                        <label className="form-label">Communication Type</label>
                        <select
                          className="form-input"
                          value={formData.communication_type}
                          onChange={(e) => handleChange("communication_type", e.target.value)}
                          disabled={!isCreate && !canEdit}
                        >
                          <option value="">Select...</option>
                          {COMMUNICATION_TYPE_OPTIONS.map((option) => (
                            <option key={option} value={option}>{option}</option>
                          ))}
                        </select>
                      </div>
                      <div className="form-group">
                        <label className="form-label">Content Mode</label>
                        <select
                          className="form-input"
                          value={formData.email_style}
                          onChange={(e) => handleChange("email_style", e.target.value)}
                          disabled={!isCreate && !canEdit}
                        >
                          <option value="Raw HTML">Raw HTML</option>
                          <option value="Rich Text">Serenius Builder</option>
                        </select>
                      </div>
                    </div>
                    <div className="form-row">
                      <div className="form-group">
                        <label className="form-label">Segment</label>
                        <input
                          className="form-input"
                          type="text"
                          value={formData.segment}
                          onChange={(e) => handleChange("segment", e.target.value)}
                          placeholder="Donors, All US"
                          disabled={!isCreate && !canEdit}
                        />
                      </div>
                      <div className="form-group">
                        <label className="form-label">Campaign Version</label>
                        <select
                          className="form-input"
                          value={formData.campaign_version}
                          onChange={(e) => handleChange("campaign_version", e.target.value)}
                          disabled={!isCreate && !canEdit}
                        >
                          {CAMPAIGN_VERSION_OPTIONS.map((option) => (
                            <option key={option} value={option}>{option}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                    <div style={{ fontSize: 12, color: "#6b7280", lineHeight: 1.5 }}>
                      {!estimate.ready ? (
                        <span>Select a segment to estimate recipients.</span>
                      ) : (
                        <span>
                          {"Estimated Recipients: "}
                          <strong style={{ color: estimate.estimatedRecipients > 0 ? "#374151" : "#9ca3af" }}>
                            {estimate.estimatedRecipients}
                          </strong>
                          <span style={{ marginLeft: 8, color: "#9ca3af" }}>
                            · {estimate.suppressedCount} suppressed · {estimate.noEmailCount} no email · {estimate.skippedCount} skipped
                          </span>
                        </span>
                      )}
                    </div>
                    <div className="form-group">
                      <label className="form-label">Subject</label>
                      <input
                        className="form-input"
                        type="text"
                        value={formData.subject}
                        onChange={(e) => handleChange("subject", e.target.value)}
                        disabled={!isCreate && !canEdit}
                      />
                    </div>
                    <div className="form-row">
                      <div className="form-group">
                        <label className="form-label">Delivery Date/Time</label>
                        <input
                          className="form-input"
                          type="datetime-local"
                          value={formData.delivery_datetime}
                          onChange={(e) => handleChange("delivery_datetime", e.target.value)}
                          disabled={!isCreate && !canEdit}
                        />
                      </div>
                      <div className="form-group">
                        <label className="form-label">Status Note</label>
                        <div className="empty-state" style={{ textAlign: "left" }}>
                          Real sending is not active yet.
                        </div>
                      </div>
                    </div>
                    {error && (
                      <div style={{ color: "#b91c1c", fontSize: 13 }}>{error}</div>
                    )}
                  </div>
                  )}
                </div>

                <BlockComposer
                  design={parsedDesign}
                  brandSettings={brandSettings ?? null}
                  emailAssets={emailAssets ?? []}
                  tenantId={tenantId}
                  canEdit={isCreate || canEdit}
                  onChange={updateDesignJson}
                  onAssetUploaded={(asset) =>
                    onAssetsChange?.([asset, ...(emailAssets ?? [])])
                  }
                  onInteract={collapseAllSections}
                />
              </div>

              {/* Live preview — sticky within the modal scroll area */}
              <div style={{ position: "sticky", top: 0 }}>
                <div className="section-card" style={{ marginBottom: 0, border: "1px solid #e5e7eb" }}>
                  <div className="section-header">
                    <span className="section-title">Live Preview</span>
                  </div>
                  <div style={{ padding: "8px 12px 12px", overflowY: "auto", maxHeight: "calc(100vh - 260px)", minHeight: 200 }}>
                    <div style={{ border: "1px solid #e5e7eb", borderRadius: 8, overflow: "hidden", background: "#fff" }}>
                      <iframe
                        srcDoc={renderEmailBuilderHtml(parsedDesign, brandSettings ?? null)}
                        sandbox=""
                        onLoad={handlePreviewLoad}
                        style={{ width: "100%", height: Math.max(previewHeight, 5000), border: 0, display: "block", pointerEvents: "none" }}
                        title="Live Preview"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>

          </>
        ) : (
          /* Raw HTML mode: unified workspace */
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "minmax(0, 3fr) minmax(0, 2fr)",
              gap: 20,
              alignItems: "start",
            }}
          >
            <div style={{ display: "grid", gap: 16 }}>
              {/* Campaign Details accordion */}
              <div className="section-card" style={{ marginBottom: 0 }}>
                <div
                  className="section-header"
                  onClick={() => setCampaignDetailsOpen(v => !v)}
                  style={{ cursor: "pointer", userSelect: "none" }}
                >
                  <span className="section-title" style={{ flex: 1 }}>Campaign Details</span>
                  {!campaignDetailsOpen && (
                    <span style={{ fontSize: 11, color: "#9ca3af", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 280 }}>
                      {[formData.subject, formData.segment].filter(Boolean).join(" · ") || "Incomplete"}
                    </span>
                  )}
                  <span style={{ fontSize: 11, color: "#6b7280", flexShrink: 0 }}>{campaignDetailsOpen ? "▲" : "▼"}</span>
                </div>
                {campaignDetailsOpen && (
                <div style={{ padding: "16px 18px 18px", display: "grid", gap: 14 }}>
                  <div className="form-row">
                    <div className="form-group">
                      <label className="form-label">Communication Type</label>
                      <select
                        className="form-input"
                        value={formData.communication_type}
                        onChange={(e) => handleChange("communication_type", e.target.value)}
                        disabled={!isCreate && !canEdit}
                      >
                        <option value="">Select...</option>
                        {COMMUNICATION_TYPE_OPTIONS.map((option) => (
                          <option key={option} value={option}>{option}</option>
                        ))}
                      </select>
                    </div>
                    <div className="form-group">
                      <label className="form-label">Content Mode</label>
                      <select
                        className="form-input"
                        value={formData.email_style}
                        onChange={(e) => handleChange("email_style", e.target.value)}
                        disabled={!isCreate && !canEdit}
                      >
                        <option value="Raw HTML">Raw HTML</option>
                        <option value="Rich Text">Serenius Builder</option>
                      </select>
                    </div>
                  </div>
                  <div className="form-row">
                    <div className="form-group">
                      <label className="form-label">Segment</label>
                      <input
                        className="form-input"
                        type="text"
                        value={formData.segment}
                        onChange={(e) => handleChange("segment", e.target.value)}
                        placeholder="Donors, All US"
                        disabled={!isCreate && !canEdit}
                      />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Campaign Version</label>
                      <select
                        className="form-input"
                        value={formData.campaign_version}
                        onChange={(e) => handleChange("campaign_version", e.target.value)}
                        disabled={!isCreate && !canEdit}
                      >
                        {CAMPAIGN_VERSION_OPTIONS.map((option) => (
                          <option key={option} value={option}>{option}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <div style={{ fontSize: 12, color: "#6b7280", lineHeight: 1.5 }}>
                    {!estimate.ready ? (
                      <span>Select a segment to estimate recipients.</span>
                    ) : (
                      <span>
                        {"Estimated Recipients: "}
                        <strong style={{ color: estimate.estimatedRecipients > 0 ? "#374151" : "#9ca3af" }}>
                          {estimate.estimatedRecipients}
                        </strong>
                        <span style={{ marginLeft: 8, color: "#9ca3af" }}>
                          · {estimate.suppressedCount} suppressed · {estimate.noEmailCount} no email · {estimate.skippedCount} skipped
                        </span>
                      </span>
                    )}
                  </div>
                  <div className="form-group">
                    <label className="form-label">Subject</label>
                    <input
                      className="form-input"
                      type="text"
                      value={formData.subject}
                      onChange={(e) => handleChange("subject", e.target.value)}
                      disabled={!isCreate && !canEdit}
                    />
                  </div>
                  <div className="form-row">
                    <div className="form-group">
                      <label className="form-label">Delivery Date/Time</label>
                      <input
                        className="form-input"
                        type="datetime-local"
                        value={formData.delivery_datetime}
                        onChange={(e) => handleChange("delivery_datetime", e.target.value)}
                        disabled={!isCreate && !canEdit}
                      />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Status Note</label>
                      <div className="empty-state" style={{ textAlign: "left" }}>
                        Real sending is not active yet.
                      </div>
                    </div>
                  </div>
                  {error && (
                    <div style={{ color: "#b91c1c", fontSize: 13 }}>{error}</div>
                  )}
                </div>
                )}
              </div>

              {/* HTML editor */}
              <div className="section-card" style={{ marginBottom: 0 }}>
                <div className="section-header">
                  <span className="section-title">HTML Content</span>
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    onClick={() => setRawHtmlPreviewDoc(formData.message_raw_html)}
                  >
                    Refresh Preview
                  </button>
                </div>
                <div style={{ padding: "16px 18px 18px", display: "grid", gap: 10 }}>
                  <textarea
                    className="form-input"
                    rows={18}
                    value={formData.message_raw_html}
                    onChange={(e) => handleChange("message_raw_html", e.target.value)}
                    placeholder="<html>..."
                    disabled={!isCreate && !canEdit}
                    style={{ fontFamily: "monospace", fontSize: 12, resize: "vertical" }}
                  />
                  <div className="form-helper">Paste full email-safe HTML. Serenius will use this as the campaign body.</div>
                </div>
              </div>
            </div>

            {/* Right: HTML preview — sticky */}
            <div style={{ position: "sticky", top: 0 }}>
              <div className="section-card" style={{ marginBottom: 0, border: "1px solid #e5e7eb" }}>
                <div className="section-header">
                  <span className="section-title">Preview</span>
                </div>
                <div style={{ padding: "8px 12px 12px", overflowY: "auto", maxHeight: "calc(100vh - 260px)", minHeight: 200 }}>
                  <div style={{ border: "1px solid #e5e7eb", borderRadius: 8, overflow: "hidden", background: "#fff" }}>
                    {rawHtmlPreviewDoc ? (
                      <iframe
                        srcDoc={rawHtmlPreviewDoc}
                        sandbox=""
                        style={{ width: "100%", height: Math.max(previewHeight, 5000), border: 0, display: "block", pointerEvents: "none" }}
                        title="HTML Preview"
                      />
                    ) : (
                      <div style={{ padding: "24px 16px", textAlign: "center", color: "#9ca3af", fontSize: 13 }}>
                        No HTML content yet. Paste HTML and click Refresh Preview.
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </SereniusModal>
  );
}
