"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import SortableHeader from "@/components/ui/SortableHeader";
import { createSupabaseBrowserClient } from "@/lib/supabase-browser";
import {
  nextSortState,
  sortByValue,
  type SortState,
  type SortValue,
} from "@/lib/ui/sort";
import type { MailSettingsSummary, MailTestRecipient } from "../types";

interface Props {
  slug: string;
  orgId: string;
  canManage: boolean;
  mailSettings: MailSettingsSummary | null;
  testRecipients: MailTestRecipient[];
}

type TestRecipientSortKey = "name" | "email" | "notes";

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

function prettyText(value: string | null | undefined): string {
  if (!value || value.trim() === "") return "—";
  return value;
}

function DetailRow({ label, value }: { label: string; value: React.ReactNode }) {
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

function StatusChip({ authorized }: { authorized: boolean }) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 5,
        padding: "3px 10px",
        borderRadius: 12,
        fontSize: 12,
        fontWeight: 600,
        background: authorized ? "#dcfce7" : "#fef9c3",
        color: authorized ? "#15803d" : "#854d0e",
      }}
    >
      {authorized ? "Authorized" : "Not authorized"}
    </span>
  );
}

export default function DeliverySetupTab({ slug, orgId, canManage, mailSettings, testRecipients }: Props) {
  const [testRecipientSort, setTestRecipientSort] =
    useState<SortState<TestRecipientSortKey> | null>(null);

  const [authorized, setAuthorized] = useState<boolean>(
    mailSettings?.campaign_live_send_authorized ?? false,
  );
  const [agreementChecked, setAgreementChecked] = useState(false);
  const [revokeChecked, setRevokeChecked] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);

  const activeTestRecipients = useMemo(
    () => testRecipients.filter((r) => r.is_active),
    [testRecipients],
  );

  const visibleTestRecipients = useMemo(
    () => sortByValue(activeTestRecipients, testRecipientSort, getTestRecipientSortValue),
    [activeTestRecipients, testRecipientSort],
  );

  async function handleSaveAuthorization(newValue: boolean) {
    if (!mailSettings) return;
    setSaving(true);
    setSaveError(null);
    setSaveSuccess(false);
    const supabase = createSupabaseBrowserClient();
    const { error } = await supabase
      .from("organization_mail_settings")
      .update({ campaign_live_send_authorized: newValue })
      .eq("id", mailSettings.id)
      .eq("tenant_id", orgId);
    setSaving(false);
    if (error) {
      setSaveError(error.message);
    } else {
      setAuthorized(newValue);
      setAgreementChecked(false);
      setRevokeChecked(false);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 4000);
    }
  }

  return (
    <div>
      {/* Context banner */}
      <div className="section-card" style={{ marginBottom: 12 }}>
        <div
          style={{
            padding: "12px 18px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 16,
          }}
        >
          <div style={{ fontSize: 13, color: "#6b7280" }}>
            Mail sender connection and test recipients are configured in{" "}
            <strong style={{ color: "#374151" }}>Setup → Integrations</strong>.
            This view shows current delivery status only.
          </div>
          <Link
            href={`/${slug}/setup?tab=integrations#mail-sender`}
            className="btn btn-ghost btn-sm"
            style={{ flexShrink: 0 }}
          >
            Open Setup → Integrations
          </Link>
        </div>
      </div>

      <div style={{ display: "grid", gap: 12 }}>
        {/* Campaign Live Send Authorization */}
        <div className="section-card" style={{ marginBottom: 0 }}>
          <div className="section-header">
            <span className="section-title">Campaign Live Send Authorization</span>
            <StatusChip authorized={authorized} />
          </div>
          <div style={{ padding: "16px 18px 20px", display: "grid", gap: 14 }}>
            <p style={{ fontSize: 13, color: "#6b7280", lineHeight: 1.6, margin: 0 }}>
              This authorization enables campaign live sends from{" "}
              <strong style={{ color: "#374151" }}>Communications → Campaigns</strong>. It
              does not send anything by itself. Each campaign still requires:
            </p>
            <ul
              style={{
                margin: 0,
                paddingLeft: 20,
                fontSize: 13,
                color: "#6b7280",
                lineHeight: 1.8,
              }}
            >
              <li>
                Mail sender <strong style={{ color: "#374151" }}>send_mode = Live</strong>{" "}
                (configured in Setup → Integrations)
              </li>
              <li>Campaign segment set to <strong style={{ color: "#374151" }}>Test Emails</strong> (current build gate)</li>
              <li>Subject and email content present</li>
              <li>Test email sent and verified</li>
              <li>Required footer / organization identity (Brand Kit)</li>
              <li>Recipient count ≤ 10 (current controlled rollout cap)</li>
            </ul>

            {!mailSettings ? (
              <div
                style={{
                  padding: "10px 14px",
                  background: "#fafafa",
                  border: "1px solid #e5e7eb",
                  borderRadius: 6,
                  fontSize: 13,
                  color: "#6b7280",
                }}
              >
                Mail sender is not configured.{" "}
                <Link href={`/${slug}/setup?tab=integrations#mail-sender`} className="action-link">
                  Configure Mail Sender
                </Link>{" "}
                first.
              </div>
            ) : canManage ? (
              authorized ? (
                <div style={{ display: "grid", gap: 10 }}>
                  <div
                    style={{
                      padding: "10px 14px",
                      background: "#f0fdf4",
                      border: "1px solid #bbf7d0",
                      borderRadius: 6,
                      fontSize: 13,
                      color: "#15803d",
                    }}
                  >
                    Campaign live sends are currently authorized for this tenant.
                  </div>
                  <label
                    style={{
                      display: "flex",
                      alignItems: "flex-start",
                      gap: 10,
                      cursor: "pointer",
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={revokeChecked}
                      onChange={(e) => setRevokeChecked(e.target.checked)}
                      style={{ marginTop: 2, flexShrink: 0 }}
                    />
                    <span style={{ fontSize: 13, color: "#374151", lineHeight: 1.5 }}>
                      I want to revoke campaign live-send authorization for this tenant.
                    </span>
                  </label>
                  <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
                    <button
                      type="button"
                      className="btn btn-ghost btn-sm"
                      disabled={!revokeChecked || saving}
                      onClick={() => handleSaveAuthorization(false)}
                    >
                      {saving ? "Saving…" : "Revoke Authorization"}
                    </button>
                    {saveSuccess && (
                      <span style={{ fontSize: 13, color: "#15803d", fontWeight: 500 }}>
                        Authorization revoked.
                      </span>
                    )}
                    {saveError && (
                      <span style={{ fontSize: 13, color: "#b91c1c", fontWeight: 500 }}>
                        {saveError}
                      </span>
                    )}
                  </div>
                </div>
              ) : (
                <div style={{ display: "grid", gap: 10 }}>
                  <label
                    style={{
                      display: "flex",
                      alignItems: "flex-start",
                      gap: 10,
                      cursor: "pointer",
                      padding: "10px 14px",
                      background: "#fffbeb",
                      border: "1px solid #fde68a",
                      borderRadius: 6,
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={agreementChecked}
                      onChange={(e) => setAgreementChecked(e.target.checked)}
                      style={{ marginTop: 2, flexShrink: 0 }}
                    />
                    <span style={{ fontSize: 13, color: "#374151", lineHeight: 1.5 }}>
                      I confirm campaign live sending has been tested, recipient targeting
                      will be reviewed before sending, and this tenant accepts responsibility
                      for campaign email distribution.
                    </span>
                  </label>
                  <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
                    <button
                      type="button"
                      className="btn btn-primary btn-sm"
                      disabled={!agreementChecked || saving}
                      onClick={() => handleSaveAuthorization(true)}
                    >
                      {saving ? "Saving…" : "Authorize Campaign Live Sending"}
                    </button>
                    {saveSuccess && (
                      <span style={{ fontSize: 13, color: "#15803d", fontWeight: 500 }}>
                        Authorization enabled.
                      </span>
                    )}
                    {saveError && (
                      <span style={{ fontSize: 13, color: "#b91c1c", fontWeight: 500 }}>
                        {saveError}
                      </span>
                    )}
                  </div>
                </div>
              )
            ) : (
              <div style={{ fontSize: 13, color: "#6b7280" }}>
                {authorized
                  ? "Campaign live sends are authorized. Contact an admin to change this."
                  : "Campaign live sends are not authorized. Contact an admin to enable them."}
              </div>
            )}
          </div>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "minmax(0, 1.6fr) minmax(300px, 1fr)",
            gap: 12,
            alignItems: "start",
          }}
        >
          {/* Mail Sender Status */}
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
                  <DetailRow
                    label="Connection Status"
                    value={prettyText(mailSettings.connection_status)}
                  />
                  <DetailRow label="Send Mode" value={prettyText(mailSettings.send_mode)} />
                  <DetailRow
                    label="Provider Account Email"
                    value={prettyText(mailSettings.provider_account_email)}
                  />
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

          {/* Test Recipients */}
          <div className="section-card" style={{ marginBottom: 0 }}>
            <div className="section-header">
              <span className="section-title">Test Recipients</span>
              <span className="section-count">{activeTestRecipients.length}</span>
            </div>
            {activeTestRecipients.length === 0 ? (
              <div className="empty-state">No active test recipients configured yet.</div>
            ) : (
              <div className="table-scroll">
                <table className="data-table">
                  <thead>
                    <tr>
                      <SortableHeader
                        label="Name"
                        sortKey="name"
                        sort={testRecipientSort}
                        onSort={(key) => setTestRecipientSort((s) => nextSortState(s, key))}
                      />
                      <SortableHeader
                        label="Email"
                        sortKey="email"
                        sort={testRecipientSort}
                        onSort={(key) => setTestRecipientSort((s) => nextSortState(s, key))}
                      />
                      <SortableHeader
                        label="Notes"
                        sortKey="notes"
                        sort={testRecipientSort}
                        onSort={(key) => setTestRecipientSort((s) => nextSortState(s, key))}
                      />
                    </tr>
                  </thead>
                  <tbody>
                    {visibleTestRecipients.map((r) => (
                      <tr key={r.id}>
                        <td>{r.display_name || "—"}</td>
                        <td>{r.email}</td>
                        <td>{r.notes || "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <div style={{ padding: "0 18px 16px" }}>
              <div className="form-helper">
                Manage test recipients in Setup → Integrations.
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
