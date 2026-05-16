"use client";

import React, { useEffect, useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase-browser";
import SereniusModal from "@/components/ui/SereniusModal";

type FilterTab = "active" | "restored" | "all";

interface OptOutRow {
  id: string;
  email: string;
  suppression_type: string;
  source: string | null;
  suppressed_at: string;
  partner_contact_id: string | null;
  partner_email_id: string | null;
  restored_at: string | null;
  restored_by: string | null;
  restore_reason: string | null;
  partner_contacts: Array<{ display_name: string | null }>;
  partner_emails: Array<{ subject: string | null }>;
}

interface Props {
  tenantId: string;
  canManage: boolean;
}

function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return "—";
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("en-US", {
    month: "2-digit",
    day: "2-digit",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

function suppressionTypeLabel(type: string): string {
  switch (type) {
    case "unsubscribed": return "Unsubscribed";
    case "bounced": return "Bounced";
    case "complained": return "Complaint";
    case "manually_suppressed": return "Manual";
    case "invalid_email": return "Invalid Email";
    default: return type;
  }
}

function sourceLabel(source: string | null): string {
  if (!source) return "—";
  switch (source) {
    case "email_opt_out": return "Email link";
    case "bounce_webhook": return "Bounce";
    case "manual": return "Manual";
    case "campaign_unsubscribe": return "Campaign";
    default: return source;
  }
}

function suppressionTypeBadgeStyle(type: string): React.CSSProperties {
  switch (type) {
    case "unsubscribed":
      return { background: "#fef3c7", color: "#92400e", fontSize: 11, padding: "2px 7px", borderRadius: 99, whiteSpace: "nowrap" };
    case "bounced":
    case "complained":
      return { background: "#fee2e2", color: "#b91c1c", fontSize: 11, padding: "2px 7px", borderRadius: 99, whiteSpace: "nowrap" };
    default:
      return { background: "#f3f4f6", color: "#6b7280", fontSize: 11, padding: "2px 7px", borderRadius: 99, whiteSpace: "nowrap" };
  }
}

const thStyle: React.CSSProperties = {
  padding: "9px 14px",
  textAlign: "left",
  fontWeight: 600,
  color: "#374151",
  borderBottom: "1px solid #e5e7eb",
  fontSize: 12,
  whiteSpace: "nowrap",
};

const tdStyle: React.CSSProperties = {
  padding: "9px 14px",
  color: "#374151",
  verticalAlign: "top",
};

const EMPTY_STATE: Record<FilterTab, string> = {
  active: "No active opt-outs.",
  restored: "No restored records.",
  all: "No opt-outs recorded yet.",
};

export default function OptOutsTab({ tenantId, canManage }: Props) {
  const [rows, setRows] = useState<OptOutRow[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [filter, setFilter] = useState<FilterTab>("active");
  const [restoreTarget, setRestoreTarget] = useState<OptOutRow | null>(null);
  const [restoreNote, setRestoreNote] = useState("");
  const [restoring, setRestoring] = useState(false);
  const [restoreError, setRestoreError] = useState<string | null>(null);

  useEffect(() => {
    const supabase = createSupabaseBrowserClient();
    supabase
      .from("partner_email_suppressions")
      .select(
        `id, email, suppression_type, source, suppressed_at,
         partner_contact_id, partner_email_id,
         restored_at, restored_by, restore_reason,
         partner_contacts(display_name),
         partner_emails(subject)`,
      )
      .eq("tenant_id", tenantId)
      .order("suppressed_at", { ascending: false })
      .limit(100)
      .then(({ data, error }) => {
        if (error) {
          setLoadError(error.message);
        } else {
          setRows((data ?? []) as OptOutRow[]);
        }
      });
  }, [tenantId]);

  const visibleRows = rows === null
    ? null
    : rows.filter((r) => {
        if (filter === "active") return !r.restored_at;
        if (filter === "restored") return !!r.restored_at;
        return true;
      });

  function openRestore(row: OptOutRow) {
    setRestoreTarget(row);
    setRestoreNote("");
    setRestoreError(null);
  }

  function closeRestore() {
    setRestoreTarget(null);
    setRestoreNote("");
    setRestoreError(null);
  }

  async function handleRestore() {
    if (!restoreTarget || !restoreNote.trim()) return;
    setRestoring(true);
    setRestoreError(null);

    const supabase = createSupabaseBrowserClient();
    const { data: authResult } = await supabase.auth.getUser();
    const userId = authResult.user?.id ?? null;
    const now = new Date().toISOString();

    const { error } = await supabase
      .from("partner_email_suppressions")
      .update({
        restored_at: now,
        restored_by: userId,
        restore_reason: restoreNote.trim(),
      })
      .eq("id", restoreTarget.id);

    setRestoring(false);

    if (error) {
      setRestoreError(error.message);
      return;
    }

    const restoredId = restoreTarget.id;
    const note = restoreNote.trim();
    setRows((prev) =>
      prev
        ? prev.map((r) =>
            r.id === restoredId
              ? { ...r, restored_at: now, restored_by: userId, restore_reason: note }
              : r,
          )
        : prev,
    );
    closeRestore();
  }

  return (
    <>
      <div className="section-card">
        <div className="section-header">
          <span className="section-title">Opt-Outs</span>
          <div style={{ display: "flex", gap: 4, marginLeft: 8 }}>
            {(["active", "restored", "all"] as FilterTab[]).map((f) => (
              <button
                key={f}
                type="button"
                onClick={() => setFilter(f)}
                style={{
                  fontSize: 11,
                  fontWeight: filter === f ? 600 : 400,
                  padding: "3px 10px",
                  borderRadius: 99,
                  border: "1px solid",
                  cursor: "pointer",
                  borderColor: filter === f ? "#3d5a80" : "#e5e7eb",
                  background: filter === f ? "#3d5a80" : "transparent",
                  color: filter === f ? "#fff" : "#6b7280",
                  transition: "none",
                }}
              >
                {f === "active" ? "Active" : f === "restored" ? "Restored" : "All"}
              </button>
            ))}
          </div>
          {visibleRows !== null && (
            <span style={{ fontSize: 12, color: "#6b7280", marginLeft: 8 }}>
              {visibleRows.length} record{visibleRows.length === 1 ? "" : "s"}
            </span>
          )}
        </div>

        {loadError && (
          <div style={{ padding: "16px 18px", color: "#b91c1c", fontSize: 13 }}>
            {loadError}
          </div>
        )}

        {!loadError && visibleRows === null && (
          <div className="empty-state">Loading…</div>
        )}

        {!loadError && visibleRows !== null && visibleRows.length === 0 && (
          <div className="empty-state">{EMPTY_STATE[filter]}</div>
        )}

        {!loadError && visibleRows !== null && visibleRows.length > 0 && (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr style={{ background: "#f9fafb" }}>
                  <th style={thStyle}>Name</th>
                  <th style={thStyle}>Email</th>
                  <th style={thStyle}>Campaign</th>
                  <th style={thStyle}>Type</th>
                  <th style={thStyle}>Source</th>
                  <th style={thStyle}>Opted Out</th>
                  <th style={thStyle}>Status</th>
                  {canManage && <th style={thStyle}></th>}
                </tr>
              </thead>
              <tbody>
                {visibleRows.map((row) => {
                  const name = row.partner_contacts[0]?.display_name ?? null;
                  const campaign = row.partner_emails[0]?.subject ?? null;
                  const isActive = !row.restored_at;
                  return (
                    <tr key={row.id} style={{ borderBottom: "1px solid #f3f4f6" }}>
                      <td style={tdStyle}>
                        {name ?? <span style={{ color: "#9ca3af" }}>—</span>}
                      </td>
                      <td style={{ ...tdStyle, fontFamily: "monospace", fontSize: 12 }}>
                        {row.email}
                      </td>
                      <td style={tdStyle}>
                        {campaign ?? <span style={{ color: "#9ca3af" }}>—</span>}
                      </td>
                      <td style={tdStyle}>
                        <span style={suppressionTypeBadgeStyle(row.suppression_type)}>
                          {suppressionTypeLabel(row.suppression_type)}
                        </span>
                      </td>
                      <td style={tdStyle}>{sourceLabel(row.source)}</td>
                      <td style={{ ...tdStyle, whiteSpace: "nowrap" }}>
                        {formatDate(row.suppressed_at)}
                      </td>
                      <td style={tdStyle}>
                        {isActive ? (
                          <span style={{ background: "#dcfce7", color: "#15803d", fontSize: 11, fontWeight: 500, padding: "2px 7px", borderRadius: 99, whiteSpace: "nowrap" }}>
                            Active
                          </span>
                        ) : (
                          <div style={{ display: "grid", gap: 3 }}>
                            <span style={{ background: "#e0f2fe", color: "#075985", fontSize: 11, fontWeight: 500, padding: "2px 7px", borderRadius: 99, whiteSpace: "nowrap", display: "inline-block" }}>
                              Restored
                            </span>
                            <span style={{ fontSize: 11, color: "#6b7280", whiteSpace: "nowrap" }}>
                              {formatDate(row.restored_at)}
                            </span>
                            {row.restore_reason && (
                              <span style={{ fontSize: 11, color: "#374151", fontStyle: "italic", maxWidth: 200, display: "block" }}>
                                {row.restore_reason}
                              </span>
                            )}
                          </div>
                        )}
                      </td>
                      {canManage && (
                        <td style={{ ...tdStyle, whiteSpace: "nowrap" }}>
                          {isActive && (
                            <button
                              type="button"
                              className="btn btn-ghost btn-sm"
                              onClick={() => openRestore(row)}
                            >
                              Restore
                            </button>
                          )}
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {restoreTarget && (
        <SereniusModal
          title="Restore email subscription?"
          description={restoreTarget.email}
          onClose={closeRestore}
          maxWidth={480}
          footer={
            <>
              <button type="button" className="btn btn-ghost" onClick={closeRestore}>
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-primary"
                disabled={!restoreNote.trim() || restoring}
                onClick={handleRestore}
              >
                {restoring ? "Restoring…" : "Restore"}
              </button>
            </>
          }
        >
          <div style={{ padding: "16px 24px", display: "grid", gap: 12 }}>
            <p style={{ fontSize: 13, color: "#374151", lineHeight: 1.6, margin: 0 }}>
              This will allow this email address to receive future campaign emails again. Only restore this address if the recipient personally requested it or confirmed the opt-out was accidental.
            </p>
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: "#374151", display: "block", marginBottom: 6 }}>
                Restore reason / confirmation note{" "}
                <span style={{ color: "#b91c1c" }}>*</span>
              </label>
              <textarea
                className="form-input"
                rows={3}
                value={restoreNote}
                onChange={(e) => setRestoreNote(e.target.value)}
                placeholder="e.g. Recipient called and confirmed the opt-out was accidental."
              />
            </div>
            {restoreError && (
              <div style={{ color: "#b91c1c", fontSize: 13 }}>{restoreError}</div>
            )}
          </div>
        </SereniusModal>
      )}
    </>
  );
}
