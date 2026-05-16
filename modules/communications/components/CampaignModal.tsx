"use client";

import React, { useEffect, useMemo, useState } from "react";
import SereniusModal from "@/components/ui/SereniusModal";
import RecordAttachments from "@/components/attachments/RecordAttachments";
import { createSupabaseBrowserClient } from "@/lib/supabase-browser";
import type {
  CampaignFormMode,
  CommunicationEmailAsset,
  EmailBrandSettings,
  EmailTemplate,
  MailSettingsSummary,
  PartnerContactEstimate,
  PartnerEmailCampaign,
  PartnerEmailSuppression,
} from "../types";
import type { EmailBuilderDesign } from "../email-builder-types";
import { hasBuilderBlocks, parseDesign, renderEmailBuilderHtml } from "../email-builder-renderer";
import { buildCampaignEmailFooter } from "@/lib/mail/campaign-email-footer";
import type { BrandSettingsForFooter } from "@/lib/mail/campaign-email-footer";
import BlockComposer from "./BlockComposer";
import {
  CAMPAIGN_SEGMENT_OPTIONS,
  CAMPAIGN_VERSION_OPTIONS,
  COMMUNICATION_TYPE_OPTIONS,
  TEMPLATE_TYPE_LABELS,
} from "../constants";

interface Props {
  slug: string;
  tenantId: string;
  mailSettings: MailSettingsSummary | null;
  testRecipientCount: number;
  contacts: PartnerContactEstimate[];
  suppressions: PartnerEmailSuppression[];
  templates?: EmailTemplate[];
  campaign: PartnerEmailCampaign | null;
  mode: CampaignFormMode;
  canManage: boolean;
  brandSettings?: EmailBrandSettings | null;
  emailAssets?: CommunicationEmailAsset[];
  onAssetsChange?: (assets: CommunicationEmailAsset[]) => void;
  onClose: () => void;
  onSaved: (campaign: PartnerEmailCampaign) => void;
  onCloned?: (campaign: PartnerEmailCampaign) => void;
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

function PersonalizationPanel() {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  function handleCopy() {
    navigator.clipboard?.writeText("{firstname}").then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    }).catch(() => {});
  }

  return (
    <div className="section-card" style={{ marginBottom: 0 }}>
      <div
        className="section-header"
        onClick={() => setOpen(v => !v)}
        style={{ cursor: "pointer", userSelect: "none" }}
      >
        <span className="section-title" style={{ flex: 1 }}>Personalization</span>
        <span style={{ fontSize: 11, color: "#6b7280", flexShrink: 0 }}>{open ? "▲" : "▼"}</span>
      </div>
      {open && (
        <div style={{ padding: "12px 18px 16px" }}>
          <p style={{ fontSize: 11, color: "#6b7280", marginBottom: 12, lineHeight: 1.5 }}>
            Use these fields in your subject line or email content. Serenius will replace them when emails are sent.
          </p>
          <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            <code
              style={{
                fontSize: 12,
                fontFamily: "monospace",
                background: "#f3f4f6",
                color: "#111827",
                padding: "3px 8px",
                borderRadius: 4,
                border: "1px solid #e5e7eb",
                flexShrink: 0,
              }}
            >
              {"{firstname}"}
            </code>
            <span style={{ fontSize: 12, color: "#6b7280", flex: 1 }}>
              Recipient first name — e.g.{" "}
              <span style={{ fontStyle: "italic" }}>Dear {"{firstname}"},</span>
            </span>
            <button
              type="button"
              onClick={handleCopy}
              style={{
                fontSize: 11,
                color: copied ? "#15803d" : "#6b7280",
                background: "none",
                border: "1px solid #e5e7eb",
                borderRadius: 4,
                cursor: "pointer",
                padding: "2px 8px",
                flexShrink: 0,
              }}
            >
              {copied ? "Copied!" : "Copy"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
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

type LiveReadinessStatus = "ready" | "needs" | "pending";

function LiveReadinessItem({
  status,
  text,
  helper,
}: {
  status: LiveReadinessStatus;
  text: string;
  helper?: string;
}) {
  const icon = status === "ready" ? "✓" : status === "needs" ? "○" : "—";
  const iconColor =
    status === "ready" ? "#15803d" : status === "needs" ? "#92400e" : "#9ca3af";
  const textColor =
    status === "ready" ? "#374151" : status === "needs" ? "#374151" : "#6b7280";
  return (
    <div style={{ display: "flex", alignItems: "flex-start", gap: 7, fontSize: 12, lineHeight: 1.4 }}>
      <span style={{ fontWeight: 700, flexShrink: 0, color: iconColor, width: 12, marginTop: 1 }}>
        {icon}
      </span>
      <div>
        <span style={{ color: textColor }}>{text}</span>
        {helper ? (
          <span style={{ color: "#9ca3af", display: "block", fontSize: 11, marginTop: 1 }}>
            {helper}
          </span>
        ) : null}
      </div>
    </div>
  );
}

function buildPreviewWithFooter(
  html: string,
  brandSettings: EmailBrandSettings | null | undefined,
): string {
  const footerInput: BrandSettingsForFooter | null = brandSettings
    ? {
        organization_name: brandSettings.organization_name,
        mailing_address: brandSettings.mailing_address,
        city: brandSettings.city,
        state: brandSettings.state,
        zip: brandSettings.zip,
        country: brandSettings.country,
        phone: brandSettings.phone,
        website_url: brandSettings.website_url,
        unsubscribe_text: brandSettings.unsubscribe_text,
        footer_html: brandSettings.footer_html,
        preference_center_url: brandSettings.preference_center_url,
        footer_background_color: brandSettings.footer_background_color,
        footer_text_color: brandSettings.footer_text_color,
        footer_link_color: brandSettings.footer_link_color,
        footer_font_size: brandSettings.footer_font_size,
        footer_divider_enabled: brandSettings.footer_divider_enabled,
        footer_divider_color: brandSettings.footer_divider_color,
      }
    : null
  const { html: footerHtml } = buildCampaignEmailFooter(footerInput, null)
  const previewLabel =
    `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">` +
    `<tr><td align="center" style="padding:0 10px 24px;">` +
    `<table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;width:100%;">` +
    `<tr><td style="padding:6px 24px;font-family:Arial,sans-serif;font-size:11px;` +
    `color:#9ca3af;text-align:center;background:#f9fafb;border-top:1px dashed #e5e7eb;">` +
    `Required email footer · Unsubscribe link generated per recipient at send time` +
    `</td></tr>` +
    `</table>` +
    `</td></tr>` +
    `</table>`
  const suffix = footerHtml + previewLabel
  const closeBodyIdx = html.toLowerCase().lastIndexOf('</body>')
  if (closeBodyIdx !== -1) {
    return html.slice(0, closeBodyIdx) + suffix + html.slice(closeBodyIdx)
  }
  return html + suffix
}

export default function CampaignModal({
  tenantId,
  mailSettings,
  testRecipientCount,
  contacts,
  suppressions,
  templates = [],
  campaign,
  mode,
  canManage,
  brandSettings,
  emailAssets,
  onAssetsChange,
  slug,
  onClose,
  onSaved,
  onCloned,
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
  const [cloning, setCloning] = useState(false);
  const [cloneError, setCloneError] = useState<string | null>(null);
  const [testSending, setTestSending] = useState(false);
  const [testSendResult, setTestSendResult] = useState<{ ok: boolean; message: string } | null>(null);
  const [liveSendConfirmOpen, setLiveSendConfirmOpen] = useState(false);
  const [liveSending, setLiveSending] = useState(false);
  const [liveSendResult, setLiveSendResult] = useState<{ ok: boolean; message: string } | null>(null);
  const [showRecipientPreview, setShowRecipientPreview] = useState(false);
  const [campaignDetailsOpen, setCampaignDetailsOpen] = useState<boolean>(() =>
    mode === "create" || !(campaign?.communication_type && campaign?.segment && campaign?.subject)
  );
  const [previewHeight, setPreviewHeight] = useState(680);
  const [rawHtmlPreviewDoc, setRawHtmlPreviewDoc] = useState<string>(campaign?.message_raw_html ?? "");
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>("");

  const activeTemplates = useMemo(
    () =>
      templates
        .filter((t) => t.status === "active" && !t.deleted_at)
        .sort((a, b) => {
          const ta = TEMPLATE_TYPE_LABELS[a.template_type] ?? a.template_type;
          const tb = TEMPLATE_TYPE_LABELS[b.template_type] ?? b.template_type;
          return ta !== tb ? ta.localeCompare(tb) : a.name.localeCompare(b.name);
        }),
    [templates],
  );

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
    setLiveSendResult(null);
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
      suppressions
        .filter((item) => !item.restored_at)
        .map((item) => item.email.trim().toLowerCase()),
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

  const recipientPreviewData = useMemo(() => {
    const seg = formData.segment.trim();
    const ver = (formData.campaign_version || "A+B").trim();
    if (!seg) return null;

    const suppressedSet = new Set(
      suppressions.filter((s) => !s.restored_at).map((s) => s.email.trim().toLowerCase()),
    );
    const eligible: Array<{ id: string | null; displayName: string | null; email: string; version: string }> = [];
    let suppressedCount = 0;
    let noEmailCount = 0;
    let skippedCount = 0;

    for (const contact of contacts) {
      const segs = contact.email_segment ?? [];
      if (!segs.includes(seg)) continue;

      const version = contact.campaign_version ?? "";
      const allowed =
        ver === "A+B" ? version === "A" || version === "B"
        : ver === "A" ? version === "A"
        : ver === "B" ? version === "B"
        : false;

      if (!allowed || version === "Skip") { skippedCount += 1; continue; }

      const email = contact.primary_email?.trim() ?? "";
      if (!email) { noEmailCount += 1; continue; }

      if (suppressedSet.has(email.toLowerCase())) { suppressedCount += 1; continue; }

      eligible.push({ id: contact.id ?? null, displayName: contact.display_name ?? null, email, version });
    }

    return { eligible, suppressedCount, noEmailCount, skippedCount };
  }, [contacts, formData.segment, formData.campaign_version, suppressions]);

  function handleChange(field: keyof FormData, value: string) {
    setFormData((prev) => ({
      ...prev,
      [field]: value,
    } as FormData));
  }

  function handleTemplateChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const id = e.target.value;
    setSelectedTemplateId(id);
    if (!id) return;
    const tpl = activeTemplates.find((t) => t.id === id);
    if (!tpl) return;
    const style = tpl.email_style || "Raw HTML";
    setFormData((prev) => ({
      ...prev,
      email_style: style,
      subject: tpl.subject_default ?? prev.subject,
      message_raw_html: tpl.html_template ?? "",
      design_json: (style === "Rich Text" && tpl.design_json && typeof tpl.design_json === "object" && !Array.isArray(tpl.design_json))
        ? tpl.design_json
        : {},
    }));
    setRawHtmlPreviewDoc(tpl.html_template ?? "");
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
            // If the campaign was test-sent, editing content requires a new test send.
            ...(currentCampaign.message_status === "Test Sent" ? { message_status: "Building" } : {}),
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
            template_id: selectedTemplateId || null,
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

  async function handleLiveSend() {
    if (!currentCampaign?.id) return;
    setLiveSending(true);
    setLiveSendResult(null);
    setLiveSendConfirmOpen(false);
    try {
      const res = await fetch(`/api/mail/google/campaign-live-send?tenantId=${tenantId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ campaign_id: currentCampaign.id }),
      });
      const data = await res.json();
      if (data.ok) {
        setCurrentCampaign((prev) =>
          prev
            ? {
                ...prev,
                sending_status: "Send Complete",
                message_status: "Message Sent",
                email_sent_at: new Date().toISOString(),
                total_emails_sent: data.recipients_sent,
              }
            : prev,
        );
        setLiveSendResult({
          ok: true,
          message: `Sent to ${data.recipients_sent} recipient${data.recipients_sent === 1 ? "" : "s"}.`,
        });
      } else {
        setLiveSendResult({ ok: false, message: data.error || "Live send failed." });
      }
    } catch {
      setLiveSendResult({ ok: false, message: "Network error. Please try again." });
    } finally {
      setLiveSending(false);
    }
  }

  async function handleClone() {
    if (!currentCampaign) return;
    setCloning(true);
    setCloneError(null);
    const { data: authResult } = await supabase.auth.getUser();
    const { data: cloned, error } = await supabase
      .from("partner_emails")
      .insert({
        tenant_id: tenantId,
        communication_type: currentCampaign.communication_type ?? null,
        email_style: currentCampaign.email_style ?? null,
        segment: currentCampaign.segment ?? null,
        campaign_version: currentCampaign.campaign_version ?? null,
        subject: currentCampaign.subject ? `Copy of ${currentCampaign.subject}` : "Copy",
        message: currentCampaign.message ?? null,
        message_raw_html: currentCampaign.message_raw_html ?? null,
        design_json: currentCampaign.design_json ?? {},
        template_id: currentCampaign.template_id ?? null,
        sending_status: "Draft",
        message_status: "Building",
        total_emails_sent: 0,
        original_opens: 0,
        total_touches: 0,
        email_sent_at: null,
        deleted_at: null,
        created_by: authResult.user?.id ?? null,
      })
      .select("*")
      .single();
    setCloning(false);
    if (error || !cloned) {
      setCloneError(error?.message ?? "Failed to duplicate campaign.");
      return;
    }
    onCloned?.(cloned as PartnerEmailCampaign);
  }

  const isReadOnlyCampaign = !isCreate && !canEdit

  const previewSegment = formData.segment || "";
  const previewVersion = formData.campaign_version || "A+B";

  const recipientPreviewModal = showRecipientPreview && recipientPreviewData ? (
    <SereniusModal
      title="Recipient Preview"
      description={`${previewSegment || "—"} segment · Version ${previewVersion}`}
      onClose={() => setShowRecipientPreview(false)}
      maxWidth={740}
    >
      <div style={{ padding: "16px 24px 24px" }}>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 16 }}>
          <span style={{ fontSize: 12, fontWeight: 600, background: "#dcfce7", color: "#15803d", padding: "3px 10px", borderRadius: 99 }}>
            {recipientPreviewData.eligible.length} Eligible
          </span>
          {recipientPreviewData.suppressedCount > 0 && (
            <span style={{ fontSize: 12, fontWeight: 500, background: "#fef3c7", color: "#92400e", padding: "3px 10px", borderRadius: 99 }}>
              {recipientPreviewData.suppressedCount} Suppressed
            </span>
          )}
          {recipientPreviewData.skippedCount > 0 && (
            <span style={{ fontSize: 12, fontWeight: 500, background: "#f3f4f6", color: "#6b7280", padding: "3px 10px", borderRadius: 99 }}>
              {recipientPreviewData.skippedCount} Version skipped
            </span>
          )}
          {recipientPreviewData.noEmailCount > 0 && (
            <span style={{ fontSize: 12, fontWeight: 500, background: "#f3f4f6", color: "#6b7280", padding: "3px 10px", borderRadius: 99 }}>
              {recipientPreviewData.noEmailCount} Missing email
            </span>
          )}
        </div>

        {recipientPreviewData.eligible.length === 0 ? (
          <div style={{ padding: "24px 0", textAlign: "center", color: "#9ca3af", fontSize: 13 }}>
            No eligible contacts after suppression and version checks.
          </div>
        ) : (
          <div style={{ overflowX: "auto", border: "1px solid #e5e7eb", borderRadius: 6 }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr style={{ background: "#f9fafb" }}>
                  <th style={{ padding: "8px 12px", textAlign: "left", fontWeight: 600, color: "#374151", borderBottom: "1px solid #e5e7eb", fontSize: 12 }}>Name</th>
                  <th style={{ padding: "8px 12px", textAlign: "left", fontWeight: 600, color: "#374151", borderBottom: "1px solid #e5e7eb", fontSize: 12 }}>Email</th>
                  <th style={{ padding: "8px 12px", textAlign: "left", fontWeight: 600, color: "#374151", borderBottom: "1px solid #e5e7eb", fontSize: 12 }}>Version</th>
                  <th style={{ padding: "8px 12px", textAlign: "left", fontWeight: 600, color: "#374151", borderBottom: "1px solid #e5e7eb", fontSize: 12 }}>Status</th>
                </tr>
              </thead>
              <tbody>
                {recipientPreviewData.eligible.map((row, idx) => (
                  <tr key={row.id ?? idx} style={{ borderBottom: "1px solid #f3f4f6" }}>
                    <td style={{ padding: "8px 12px", color: "#111827" }}>
                      {row.displayName || <span style={{ color: "#9ca3af" }}>—</span>}
                    </td>
                    <td style={{ padding: "8px 12px", color: "#374151", fontFamily: "monospace", fontSize: 12 }}>
                      {row.email}
                    </td>
                    <td style={{ padding: "8px 12px" }}>
                      <span style={{ background: "#ede9fe", color: "#5b21b6", fontSize: 11, padding: "2px 7px", borderRadius: 99 }}>
                        {row.version || "—"}
                      </span>
                    </td>
                    <td style={{ padding: "8px 12px" }}>
                      <span style={{ background: "#dcfce7", color: "#15803d", fontSize: 11, fontWeight: 500, padding: "2px 7px", borderRadius: 99 }}>
                        Eligible
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {(recipientPreviewData.suppressedCount > 0 || recipientPreviewData.skippedCount > 0 || recipientPreviewData.noEmailCount > 0) && (
          <div style={{ marginTop: 14, padding: "12px 14px", background: "#f9fafb", borderRadius: 6, fontSize: 12, color: "#6b7280", lineHeight: 1.7 }}>
            <div style={{ fontWeight: 600, color: "#374151", marginBottom: 4 }}>Excluded from this send</div>
            {recipientPreviewData.suppressedCount > 0 && (
              <div><strong>{recipientPreviewData.suppressedCount}</strong> suppressed — opted out or manually suppressed</div>
            )}
            {recipientPreviewData.skippedCount > 0 && (
              <div><strong>{recipientPreviewData.skippedCount}</strong> version skipped — contact version does not match campaign version ({previewVersion})</div>
            )}
            {recipientPreviewData.noEmailCount > 0 && (
              <div><strong>{recipientPreviewData.noEmailCount}</strong> missing email — no primary email on file</div>
            )}
          </div>
        )}
      </div>
    </SereniusModal>
  ) : null;

  if (!isCreate && currentMode === "view") {
    const viewCampaign = currentCampaign

    const hasSubject = !!(viewCampaign?.subject?.trim());
    const hasContent = !!(viewCampaign?.message_raw_html?.trim() || viewCampaign?.message?.trim());
    const hasOrgIdentity = !!(brandSettings?.organization_name?.trim() && brandSettings?.mailing_address?.trim());
    const mailReady =
      mailSettings?.connection_status === "connected" &&
      mailSettings?.is_enabled === true &&
      (mailSettings?.send_mode === "test_only" || mailSettings?.send_mode === "live");
    const hasTestRecipients = testRecipientCount > 0;
    const canTestSend = canManage && hasSubject && hasContent && !!mailReady && hasTestRecipients;
    const mailLive =
      mailSettings?.connection_status === "connected" &&
      mailSettings?.is_enabled === true &&
      mailSettings?.send_mode === "live";
    const isTestEmailsSegment = viewCampaign?.segment === "Test Emails";
    const liveAuthorized = !!mailSettings?.campaign_live_send_authorized;
    const hasTestSent = viewCampaign?.message_status === "Test Sent";
    const canLiveSend =
      canManage &&
      hasSubject &&
      hasContent &&
      !!mailLive &&
      liveAuthorized &&
      isTestEmailsSegment &&
      hasTestSent &&
      !isLockedCampaign(viewCampaign);

    return (
      <SereniusModal
        title="View Campaign"
        description={viewCampaign?.subject || "Campaign details"}
        onClose={onClose}
        maxWidth={1440}
        contentPadding={0}
        headerActions={
          <>
            {cloneError && (
              <span style={{ fontSize: 12, color: "#b91c1c", alignSelf: "center" }}>{cloneError}</span>
            )}
            {canManage && (
              <button
                type="button"
                className="btn btn-ghost"
                disabled={cloning}
                onClick={handleClone}
              >
                {cloning ? "Duplicating…" : "Duplicate Campaign"}
              </button>
            )}
            {canEdit && (
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => setCurrentMode("edit")}
              >
                Edit Campaign
              </button>
            )}
          </>
        }
      >
        <div style={{ padding: "24px 24px 128px" }}>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "minmax(0, 2fr) minmax(0, 3fr)",
              gap: 20,
              alignItems: "start",
            }}
          >
            {/* Left column */}
            <div style={{ display: "grid", gap: 16 }}>
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

                  {viewCampaign?.segment && canManage && recipientPreviewData && (
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <button
                        type="button"
                        className="btn btn-ghost btn-sm"
                        onClick={() => setShowRecipientPreview(true)}
                      >
                        Preview Recipients
                      </button>
                      {recipientPreviewData.eligible.length > 0 && (
                        <span style={{ fontSize: 12, color: "#6b7280" }}>
                          {recipientPreviewData.eligible.length} eligible
                        </span>
                      )}
                    </div>
                  )}

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
                          ? `Mail sender connected and enabled for test sends (current mode: ${mailSettings.send_mode ?? "not set"})`
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

              {/* Live Send Readiness Checklist */}
              <div className="section-card" style={{ marginBottom: 0 }}>
                <div className="section-header">
                  <span className="section-title">Live Send</span>
                </div>
                <div style={{ padding: "16px 18px 18px", display: "grid", gap: 10 }}>
                  {!isTestEmailsSegment && (
                    <p style={{ fontSize: 13, color: "#6b7280", lineHeight: 1.5, margin: "0 0 2px" }}>
                      Live sending is available for the <strong>Test Emails</strong> segment only in this build. Select that segment to enable the send button.
                    </p>
                  )}
                  <LiveReadinessItem
                    status={
                      mailSettings?.connection_status === "connected" &&
                      mailSettings?.is_enabled === true
                        ? "ready"
                        : "needs"
                    }
                    text="Mail sender connected and enabled"
                    helper={
                      mailSettings
                        ? `${mailSettings.from_email ?? mailSettings.provider_account_email ?? "configured"} · ${mailSettings.provider ?? "provider"}`
                        : "Configure in Delivery Setup → Integrations"
                    }
                  />
                  <LiveReadinessItem
                    status={mailLive ? "ready" : "needs"}
                    text="Send mode set to Live"
                    helper={
                      mailLive
                        ? undefined
                        : `Current mode: ${mailSettings?.send_mode ?? "not set"} — change to Live in Setup → Integrations`
                    }
                  />
                  <LiveReadinessItem
                    status={hasSubject ? "ready" : "needs"}
                    text="Subject line present"
                  />
                  <LiveReadinessItem
                    status={hasContent ? "ready" : "needs"}
                    text="Email content present (HTML or plain text)"
                  />
                  <LiveReadinessItem
                    status={isTestEmailsSegment ? "ready" : "needs"}
                    text='Segment set to "Test Emails"'
                    helper={isTestEmailsSegment ? undefined : "Only the Test Emails segment is permitted for live sends in this build."}
                  />
                  <LiveReadinessItem
                    status={
                      !estimate.ready
                        ? "needs"
                        : estimate.estimatedRecipients > 0
                          ? "ready"
                          : "needs"
                    }
                    text={
                      !estimate.ready
                        ? "Recipient estimate — select a segment first"
                        : estimate.estimatedRecipients > 0
                          ? `Recipient estimate: ${estimate.estimatedRecipients.toLocaleString()} eligible contact${estimate.estimatedRecipients === 1 ? "" : "s"}`
                          : "Recipient estimate: 0 eligible contacts in this segment"
                    }
                    helper={
                      estimate.ready && (estimate.suppressedCount > 0 || estimate.noEmailCount > 0 || estimate.skippedCount > 0)
                        ? `${estimate.suppressedCount} suppressed · ${estimate.noEmailCount} no email · ${estimate.skippedCount} skipped`
                        : undefined
                    }
                  />
                  {canManage && recipientPreviewData && (
                    <div style={{ paddingLeft: 19 }}>
                      <button
                        type="button"
                        className="btn btn-ghost btn-sm"
                        onClick={() => setShowRecipientPreview(true)}
                      >
                        Preview Recipients
                      </button>
                    </div>
                  )}
                  <LiveReadinessItem
                    status={viewCampaign?.message_status === "Test Sent" ? "ready" : "needs"}
                    text="Test email sent and verified"
                    helper={
                      viewCampaign?.message_status === "Test Sent"
                        ? undefined
                        : "Use Send Test Email above to verify delivery before live send."
                    }
                  />
                  <LiveReadinessItem
                    status={hasOrgIdentity ? "ready" : "needs"}
                    text="Required footer / organization identity"
                    helper={
                      hasOrgIdentity
                        ? "Organization name and mailing address configured in Brand Kit."
                        : "Add organization name and mailing address in Brand Kit."
                    }
                  />
                  <LiveReadinessItem
                    status="ready"
                    text="Opt-out workflow"
                    helper="Per-recipient opt-out tokens generated and injected at send time."
                  />
                  <LiveReadinessItem
                    status={liveAuthorized ? "ready" : "needs"}
                    text="Campaign live-send authorization"
                    helper={
                      liveAuthorized
                        ? undefined
                        : "Enable campaign live-send authorization in Communications → Delivery Setup."
                    }
                  />

                  {isTestEmailsSegment && (
                    <div style={{ marginTop: 4, paddingTop: 12, borderTop: "1px solid #f3f4f6" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
                        <button
                          type="button"
                          className="btn btn-primary btn-sm"
                          disabled={!canLiveSend || liveSending}
                          onClick={() => setLiveSendConfirmOpen(true)}
                        >
                          {liveSending ? "Sending…" : "Send to Test Emails Segment"}
                        </button>
                        {liveSendResult && (
                          <span
                            style={{
                              fontSize: 13,
                              fontWeight: 500,
                              color: liveSendResult.ok ? "#15803d" : "#b91c1c",
                            }}
                          >
                            {liveSendResult.message}
                          </span>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Right column: preview — sticky */}
            <div style={{ position: "sticky", top: 0 }}>
              <div className="section-card" style={{ marginBottom: 0, border: "1px solid #e5e7eb" }}>
                <div className="section-header">
                  <span className="section-title">
                    {viewCampaign?.message_raw_html ? "HTML Preview" : viewCampaign?.message ? "Message Preview" : "Campaign Preview"}
                  </span>
                </div>
                <div style={{ padding: "8px 12px 12px", overflowY: "auto", maxHeight: "calc(100vh - 260px)", minHeight: 200 }}>
                  <div style={{ border: "1px solid #e5e7eb", borderRadius: 8, overflow: "hidden", background: "#fff" }}>
                    {viewCampaign?.message_raw_html ? (
                      <iframe
                        title="Campaign HTML Preview"
                        sandbox=""
                        srcDoc={buildPreviewWithFooter(viewCampaign.message_raw_html, brandSettings)}
                        style={{ width: "100%", height: Math.max(previewHeight, 5000), border: 0, display: "block", pointerEvents: "none" }}
                      />
                    ) : viewCampaign?.message ? (
                      <div
                        style={{
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
                      <div style={{ padding: "24px 16px", textAlign: "center", color: "#9ca3af", fontSize: 13 }}>
                        No preview content available yet.
                      </div>
                    )}
                  </div>
                  {viewCampaign?.html_file_url && (
                    <div style={{ marginTop: 10, fontSize: 13, color: "#374151" }}>
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
                </div>
              </div>
            </div>
          </div>
        </div>

        {liveSendConfirmOpen && (
          <SereniusModal
            title="Confirm Live Send"
            description={`Send "${viewCampaign?.subject}" to ${estimate.estimatedRecipients} contact${estimate.estimatedRecipients === 1 ? "" : "s"}?`}
            onClose={() => setLiveSendConfirmOpen(false)}
            maxWidth={480}
            footer={
              <>
                <button
                  type="button"
                  className="btn btn-ghost"
                  onClick={() => setLiveSendConfirmOpen(false)}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={handleLiveSend}
                >
                  Send
                </button>
              </>
            }
          >
            <div style={{ padding: "16px 24px", display: "grid", gap: 10 }}>
              <p style={{ fontSize: 13, color: "#374151", lineHeight: 1.6, margin: 0 }}>
                This will send <strong>{viewCampaign?.subject}</strong> to{" "}
                <strong>{estimate.estimatedRecipients}</strong> eligible contact
                {estimate.estimatedRecipients === 1 ? "" : "s"} in the Test Emails segment
                with real opt-out links. This action cannot be undone.
              </p>
              {recipientPreviewData && (
                <div>
                  <button
                    type="button"
                    onClick={() => { setLiveSendConfirmOpen(false); setShowRecipientPreview(true); }}
                    style={{ background: "none", border: "none", padding: 0, fontSize: 12, color: "#3d5a80", cursor: "pointer", textDecoration: "underline" }}
                  >
                    View recipient list
                  </button>
                </div>
              )}
            </div>
          </SereniusModal>
        )}

        {recipientPreviewModal}
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
        {isCreate && activeTemplates.length > 0 ? (
          <div className="section-card" style={{ marginBottom: 0 }}>
            <div style={{ padding: "14px 18px 16px" }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: "#374151", marginBottom: 8 }}>
                Start from Template
              </div>
              <select
                className="form-input"
                value={selectedTemplateId}
                onChange={handleTemplateChange}
                style={{ marginBottom: 8 }}
              >
                <option value="">Blank campaign</option>
                {activeTemplates.map((t) => (
                  <option key={t.id} value={t.id}>
                    {TEMPLATE_TYPE_LABELS[t.template_type] ?? t.template_type} — {t.name}
                  </option>
                ))}
              </select>
              <p style={{ fontSize: 11, color: "#6b7280", margin: 0, lineHeight: 1.5 }}>
                Templates are copied into the campaign. Editing this campaign will not change the original template.
              </p>
            </div>
          </div>
        ) : null}

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
                        <select
                          className="form-input"
                          value={formData.segment}
                          onChange={(e) => handleChange("segment", e.target.value)}
                          disabled={!isCreate && !canEdit}
                        >
                          <option value="">Select segment…</option>
                          {CAMPAIGN_SEGMENT_OPTIONS.map((opt) => (
                            <option key={opt} value={opt}>{opt}</option>
                          ))}
                          {formData.segment && !(CAMPAIGN_SEGMENT_OPTIONS as readonly string[]).includes(formData.segment) && (
                            <option value={formData.segment}>Saved: {formData.segment}</option>
                          )}
                        </select>
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
                    {canManage && estimate.ready && recipientPreviewData && (
                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <button
                          type="button"
                          className="btn btn-ghost btn-sm"
                          onClick={() => setShowRecipientPreview(true)}
                        >
                          Preview Recipients
                        </button>
                        {recipientPreviewData.eligible.length > 0 && (
                          <span style={{ fontSize: 12, color: "#6b7280" }}>
                            {recipientPreviewData.eligible.length} eligible
                          </span>
                        )}
                      </div>
                    )}
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

                <PersonalizationPanel />

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
                        srcDoc={buildPreviewWithFooter(renderEmailBuilderHtml(parsedDesign, brandSettings ?? null), brandSettings)}
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
                      <select
                        className="form-input"
                        value={formData.segment}
                        onChange={(e) => handleChange("segment", e.target.value)}
                        disabled={!isCreate && !canEdit}
                      >
                        <option value="">Select segment…</option>
                        {CAMPAIGN_SEGMENT_OPTIONS.map((opt) => (
                          <option key={opt} value={opt}>{opt}</option>
                        ))}
                        {formData.segment && !(CAMPAIGN_SEGMENT_OPTIONS as readonly string[]).includes(formData.segment) && (
                          <option value={formData.segment}>Saved: {formData.segment}</option>
                        )}
                      </select>
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
                  {canManage && estimate.ready && recipientPreviewData && (
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <button
                        type="button"
                        className="btn btn-ghost btn-sm"
                        onClick={() => setShowRecipientPreview(true)}
                      >
                        Preview Recipients
                      </button>
                      {recipientPreviewData.eligible.length > 0 && (
                        <span style={{ fontSize: 12, color: "#6b7280" }}>
                          {recipientPreviewData.eligible.length} eligible
                        </span>
                      )}
                    </div>
                  )}
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

              <PersonalizationPanel />

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
                        srcDoc={buildPreviewWithFooter(rawHtmlPreviewDoc, brandSettings)}
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
      {recipientPreviewModal}
    </SereniusModal>
  );
}
