"use client";

import { useEffect, useMemo, useState } from "react";
import SereniusModal from "@/components/ui/SereniusModal";
import RecordAttachments from "@/components/attachments/RecordAttachments";
import { createSupabaseBrowserClient } from "@/lib/supabase-browser";
import type {
  CampaignFormMode,
  MailSettingsSummary,
  PartnerContactEstimate,
  PartnerEmailCampaign,
  PartnerEmailSuppression,
} from "../types";
import {
  CAMPAIGN_VERSION_OPTIONS,
  COMMUNICATION_TYPE_OPTIONS,
  EMAIL_STYLE_OPTIONS,
} from "../constants";

interface Props {
  slug: string;
  tenantId: string;
  mailSettings: MailSettingsSummary | null;
  contacts: PartnerContactEstimate[];
  suppressions: PartnerEmailSuppression[];
  campaign: PartnerEmailCampaign | null;
  mode: CampaignFormMode;
  canManage: boolean;
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

export default function CampaignModal({
  tenantId,
  mailSettings,
  contacts,
  suppressions,
  campaign,
  mode,
  canManage,
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

  useEffect(() => {
    setCurrentMode(mode);
    setCurrentCampaign(campaign);
    setError(null);
    setFormData(campaign ? mapCampaignToFormData(campaign) : buildDefaultFormData());
  }, [campaign, mode]);

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
      message_raw_html: formData.message_raw_html || null,
      delivery_datetime: formData.delivery_datetime
        ? new Date(formData.delivery_datetime).toISOString()
        : null,
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

  const isReadOnlyCampaign = !isCreate && !canEdit

  if (!isCreate && currentMode === "view") {
    const viewCampaign = currentCampaign

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
        <div style={{ padding: 24, display: "grid", gap: 20 }}>
          <div className="section-card" style={{ marginBottom: 0 }}>
            <div className="section-header">
              <span className="section-title">Campaign Details</span>
            </div>
              <div style={{ padding: "0 18px 8px" }}>
              <DetailRow label="Sending Status" value={prettyText(viewCampaign?.sending_status)} />
              <DetailRow label="Message Status" value={prettyText(viewCampaign?.message_status)} />
              <DetailRow label="Communication Type" value={prettyText(viewCampaign?.communication_type)} />
              <DetailRow label="Email Style" value={prettyText(viewCampaign?.email_style)} />
              <DetailRow label="Segment" value={prettyText(viewCampaign?.segment)} />
              <DetailRow label="Campaign Version" value={prettyText(viewCampaign?.campaign_version)} />
              <DetailRow label="Subject" value={prettyText(viewCampaign?.subject)} />
              <DetailRow label="Delivery Date/Time" value={formatDateTime(viewCampaign?.delivery_datetime)} />
              <DetailRow label="Email Sent At" value={formatDateTime(viewCampaign?.email_sent_at)} />
              <DetailRow label="Sent Type" value={prettyText(viewCampaign?.sent_type)} />
              <DetailRow label="Total Emails Sent" value={viewCampaign?.total_emails_sent ?? "—"} />
              <DetailRow label="Original Opens" value={viewCampaign?.original_opens ?? "—"} />
              <DetailRow label="Total Touches" value={viewCampaign?.total_touches ?? "—"} />
            </div>
          </div>

          <div className="section-card" style={{ marginBottom: 0 }}>
            <div className="section-header">
              <span className="section-title">HTML / Message Preview</span>
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
      maxWidth={1140}
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
      <div style={{ padding: 24 }}>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "minmax(0, 1.5fr) minmax(320px, 1fr)",
            gap: 20,
            alignItems: "start",
          }}
        >
          <div style={{ display: "grid", gap: 16 }}>
            <div className="section-card" style={{ marginBottom: 0 }}>
              <div className="section-header">
                <span className="section-title">Campaign Details</span>
              </div>

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
                        <option key={option} value={option}>
                          {option}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="form-group">
                    <label className="form-label">Email Style</label>
                    <select
                      className="form-input"
                      value={formData.email_style}
                      onChange={(e) => handleChange("email_style", e.target.value)}
                      disabled={!isCreate && !canEdit}
                    >
                      {EMAIL_STYLE_OPTIONS.map((option) => (
                        <option key={option} value={option}>
                          {option}
                        </option>
                      ))}
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
                    <div className="form-helper">
                      Used for recipient estimation.
                    </div>
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
                        <option key={option} value={option}>
                          {option}
                        </option>
                      ))}
                    </select>
                  </div>
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

                <div className="form-group">
                  <label className="form-label">Message</label>
                  <textarea
                    className="form-input"
                    rows={5}
                    value={formData.message}
                    onChange={(e) => handleChange("message", e.target.value)}
                    disabled={!isCreate && !canEdit}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Raw HTML</label>
                  <textarea
                    className="form-input"
                    rows={8}
                    value={formData.message_raw_html}
                    onChange={(e) => handleChange("message_raw_html", e.target.value)}
                    placeholder="<html>..."
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
                  <div style={{ color: "#b91c1c", fontSize: 13 }}>
                    {error}
                  </div>
                )}
              </div>
            </div>
          </div>

          <div style={{ display: "grid", gap: 16 }}>
            <RecipientEstimateCard
              contacts={contacts}
              suppressions={suppressions}
              segment={formData.segment}
              campaignVersion={formData.campaign_version}
            />

            <div className="section-card" style={{ marginBottom: 0 }}>
              <div className="section-header">
                <span className="section-title">Mail Sender Status</span>
              </div>
              <div style={{ padding: "16px 18px 18px", display: "grid", gap: 8 }}>
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
                  <>
                    <div className="empty-state">Mail sender is not configured yet.</div>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>

        {mailSettings == null && (
          <div style={{ marginTop: 12 }}>
            <a href={`/${slug}/setup?tab=integrations`} className="action-link">
              Configure in Setup → Integrations
            </a>
          </div>
        )}
      </div>
    </SereniusModal>
  );
}
