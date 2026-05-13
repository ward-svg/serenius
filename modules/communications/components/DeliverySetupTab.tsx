"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import SortableHeader from "@/components/ui/SortableHeader";
import {
  nextSortState,
  sortByValue,
  type SortState,
  type SortValue,
} from "@/lib/ui/sort";
import type { MailSettingsSummary, MailTestRecipient } from "../types";

interface Props {
  slug: string;
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

export default function DeliverySetupTab({ slug, mailSettings, testRecipients }: Props) {
  const [testRecipientSort, setTestRecipientSort] =
    useState<SortState<TestRecipientSortKey> | null>(null);

  const activeTestRecipients = useMemo(
    () => testRecipients.filter((r) => r.is_active),
    [testRecipients],
  );

  const visibleTestRecipients = useMemo(
    () => sortByValue(activeTestRecipients, testRecipientSort, getTestRecipientSortValue),
    [activeTestRecipients, testRecipientSort],
  );

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
  );
}
