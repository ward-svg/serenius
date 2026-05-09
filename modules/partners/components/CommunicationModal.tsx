"use client";

import { useEffect, useState } from "react";
import SereniusModal from "@/components/ui/SereniusModal";
import { createSupabaseBrowserClient } from "@/lib/supabase-browser";
import type {
  PartnerCommunication,
  PartnerCommunicationFollowup,
} from "@/modules/partners/types";
import {
  COMMUNICATION_CHANNELS,
  COMMUNICATION_TYPES,
} from "@/modules/partners/constants";

interface Props {
  partnerId: string;
  tenantId: string;
  communication?: PartnerCommunication | null;
  followups?: PartnerCommunicationFollowup[];
  onClose: () => void;
  onSuccess: (communication: PartnerCommunication) => void;
}

type Mode = "view" | "edit";

type FormData = {
  communication_type: string;
  communication_channel: string;
  communication_date: string;
  notes: string;
  followup_needed: boolean;
  followup_due: string;
  followup_notes: string;
  followup_complete: boolean;
  completion_date: string;
  completion_notes: string;
  file_attachment_name: string;
  file_attachment_url: string;
};

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

function boolLabel(value: boolean | null | undefined): string {
  if (value == null) return "—";
  return value ? "Yes" : "No";
}

function valueOrDash(value: string | null | undefined): string {
  if (!value || value.trim() === "") return "—";
  return value;
}

  function truncate(value: string | null | undefined, limit: number): string {
    if (!value || value.trim() === "") return "—";
    return value.length > limit ? `${value.slice(0, limit)}…` : value;
  }

export default function CommunicationModal({
  partnerId,
  tenantId,
  communication,
  followups = [],
  onClose,
  onSuccess,
}: Props) {
  const supabase = createSupabaseBrowserClient();
  const isCreate = !communication;
  const [mode, setMode] = useState<Mode>(isCreate ? "edit" : "view");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formData, setFormData] = useState<FormData>({
    communication_type: "",
    communication_channel: "",
    communication_date: new Date().toISOString().split("T")[0],
    notes: "",
    followup_needed: false,
    followup_due: "",
    followup_notes: "",
    followup_complete: false,
    completion_date: "",
    completion_notes: "",
    file_attachment_name: "",
    file_attachment_url: "",
  });

  function mapCommunicationToFormData(source: PartnerCommunication): FormData {
    return {
      communication_type: source.communication_type ?? "",
      communication_channel: source.communication_channel ?? "",
      communication_date: source.communication_date?.split("T")[0] ?? "",
      notes: source.notes ?? "",
      followup_needed: source.followup_needed ?? false,
      followup_due: source.followup_due?.split("T")[0] ?? "",
      followup_notes: source.followup_notes ?? "",
      followup_complete: source.followup_complete ?? false,
      completion_date: source.completion_date?.split("T")[0] ?? "",
      completion_notes: source.completion_notes ?? "",
      file_attachment_name: source.file_attachment_name ?? "",
      file_attachment_url: source.file_attachment_url ?? "",
    };
  }

  useEffect(() => {
    if (!communication) return;

    setFormData(mapCommunicationToFormData(communication));
    setError(null);
    setMode("view");
  }, [communication]);

  function handleChange(field: keyof FormData, value: string | boolean) {
    setFormData((prev) => ({
      ...prev,
      [field]: value,
    }));
  }

  function returnToViewMode() {
    if (communication) {
      setFormData(mapCommunicationToFormData(communication));
    }

    setError(null);
    setMode("view");
  }

  const showFollowupDetails = formData.followup_needed;
  const showCompletionFields = !isCreate && formData.followup_needed;
  const attachmentName = communication?.file_attachment_name || null;
  const attachmentUrl = communication?.file_attachment_url || null;

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();

    setError(null);

    if (
      !formData.communication_type ||
      !formData.communication_channel ||
      !formData.communication_date
    ) {
      setError("Please complete all required fields.");
      return;
    }

    setSaving(true);

    const { data: userResult } = await supabase.auth.getUser();
    const now = new Date().toISOString();

    const payload = {
      tenant_id: tenantId,
      partner_id: partnerId,
      communication_type: formData.communication_type || null,
      communication_channel: formData.communication_channel || null,
      communication_date: formData.communication_date || null,
      notes: formData.notes || null,
      followup_needed: formData.followup_needed,
      followup_due: formData.followup_due || null,
      followup_notes: formData.followup_notes || null,
      followup_complete: formData.followup_complete,
      completion_date: formData.completion_date || null,
      completion_notes: formData.completion_notes || null,
      file_attachment_name: formData.file_attachment_name || null,
      file_attachment_url: formData.file_attachment_url || null,
    };

    const result = !isCreate
      ? await supabase
          .from("partner_communications")
          .update({
            ...payload,
            updated_at: now,
          })
          .eq("id", communication.id)
          .eq("tenant_id", tenantId)
          .select("*")
          .single()
      : await supabase
          .from("partner_communications")
          .insert({
            ...payload,
            created_by: userResult.user?.id ?? null,
            created_at: now,
            updated_at: now,
          })
          .select("*")
          .single();

    setSaving(false);

    if (result.error) {
      setError(result.error.message);
      return;
    }

    const savedCommunication = result.data as PartnerCommunication;

    onSuccess(savedCommunication);

    if (isCreate) {
      onClose();
      return;
    }

    setFormData(mapCommunicationToFormData(savedCommunication));
    setMode("view");
  }

  if (!isCreate && mode === "view") {
    const viewCommunication = communication;
    const attachedFollowups = followups.filter(
      (followup) => followup.communication_id === viewCommunication?.id,
    );
    const showAttachments = Boolean(attachmentName || attachmentUrl);

    return (
      <SereniusModal
        title="View Communication"
        description={
          viewCommunication
            ? `${formatDate(viewCommunication.communication_date)} · ${valueOrDash(viewCommunication.communication_type)}`
            : undefined
        }
        onClose={onClose}
        maxWidth={900}
        contentPadding={0}
        headerActions={
          <button
            type="button"
            className="btn btn-ghost"
            onClick={() => setMode("edit")}
          >
            Edit Communication
          </button>
        }
      >
        <div style={{ padding: 24, display: "flex", flexDirection: "column", gap: 16 }}>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Communication Date</label>
              <div style={{ fontSize: 14, color: "#111827", paddingTop: 4 }}>
                {formatDate(viewCommunication?.communication_date)}
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Type</label>
              <div style={{ fontSize: 14, color: "#111827", paddingTop: 4 }}>
                {valueOrDash(viewCommunication?.communication_type)}
              </div>
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Channel</label>
              <div style={{ fontSize: 14, color: "#111827", paddingTop: 4 }}>
                {valueOrDash(viewCommunication?.communication_channel)}
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Follow-Up Needed</label>
              <div style={{ fontSize: 14, color: "#111827", paddingTop: 4 }}>
                {boolLabel(viewCommunication?.followup_needed)}
              </div>
            </div>
          </div>

          {viewCommunication?.followup_needed ? (
            <>
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Follow-Up Due</label>
                  <div style={{ fontSize: 14, color: "#111827", paddingTop: 4 }}>
                    {formatDate(viewCommunication?.followup_due)}
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">Follow-Up Complete</label>
                  <div style={{ fontSize: 14, color: "#111827", paddingTop: 4 }}>
                    {boolLabel(viewCommunication?.followup_complete)}
                  </div>
                </div>
              </div>

              <div className="form-row full">
                <div className="form-group">
                  <label className="form-label">Follow-Up Notes</label>
                  <div
                    style={{
                      fontSize: 14,
                      color: "#111827",
                      whiteSpace: "pre-wrap",
                      lineHeight: 1.6,
                      paddingTop: 4,
                    }}
                  >
                    {valueOrDash(viewCommunication?.followup_notes)}
                  </div>
                </div>
              </div>

              <div className="form-row full">
                <div className="form-group">
                  <label className="form-label">Completion Notes</label>
                  <div
                    style={{
                      fontSize: 14,
                      color: "#111827",
                      whiteSpace: "pre-wrap",
                      lineHeight: 1.6,
                      paddingTop: 4,
                    }}
                  >
                    {valueOrDash(viewCommunication?.completion_notes)}
                  </div>
                </div>
              </div>

          {showAttachments ? (
            <div className="section-card" style={{ marginBottom: 0 }}>
              <div className="section-header">
                <span className="section-title">Attachments</span>
              </div>
              <div style={{ padding: "12px 18px" }}>
                {attachmentName ? (
                  <div style={{ fontSize: 13, color: "#111827", marginBottom: attachmentUrl ? 8 : 0 }}>
                    {attachmentName}
                  </div>
                ) : null}
                {attachmentUrl ? (
                  <a
                    className="action-link"
                    href={attachmentUrl}
                    target="_blank"
                    rel="noreferrer"
                  >
                    {attachmentUrl}
                  </a>
                ) : null}
              </div>
            </div>
          ) : null}
            </>
          ) : null}

          <div className="form-row full">
            <div className="form-group">
              <label className="form-label">Notes</label>
              <div style={{ fontSize: 14, color: "#111827", whiteSpace: "pre-wrap", lineHeight: 1.6, paddingTop: 4 }}>
                {valueOrDash(viewCommunication?.notes)}
              </div>
            </div>
          </div>

          <div className="section-card" style={{ marginBottom: 0 }}>
            <div className="section-header">
              <span className="section-title">Follow-Up Tasks</span>
              <span className="section-count">{attachedFollowups.length}</span>
            </div>
            {attachedFollowups.length === 0 ? (
              <div className="empty-state">No follow-up tasks linked yet.</div>
            ) : (
              <div className="table-scroll">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Action</th>
                      <th>Due</th>
                      <th>Assigned To</th>
                      <th>Completed</th>
                      <th>Notes</th>
                    </tr>
                  </thead>
                  <tbody>
                    {attachedFollowups.map((followup) => (
                      <tr key={followup.id}>
                        <td>{followup.action_type}</td>
                        <td>{formatDate(followup.due_date)}</td>
                        <td>{followup.assigned_to ?? "—"}</td>
                        <td>{boolLabel(followup.completed)}</td>
                        <td>{truncate(followup.instructions, 80)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {error ? <div style={{ color: "#c92a2a", fontSize: 13 }}>{error}</div> : null}
        </div>
      </SereniusModal>
    );
  }

  return (
    <SereniusModal
      title={isCreate ? "New Communication" : "Edit Communication"}
      onClose={onClose}
      maxWidth={900}
      contentPadding={0}
      showCloseButton={isCreate}
      closeOnOverlayClick={isCreate}
      closeOnEscape={isCreate}
      headerActions={
        !isCreate ? (
          <button
            type="button"
            className="btn btn-ghost"
            onClick={returnToViewMode}
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
            onClick={isCreate ? onClose : returnToViewMode}
            disabled={saving}
          >
            Cancel
          </button>

          <button
            type="submit"
            form="communication-form"
            className="btn btn-primary"
            disabled={saving}
          >
            {saving ? "Saving..." : isCreate ? "Create Communication" : "Save Changes"}
          </button>
        </>
      }
    >
      <form id="communication-form" onSubmit={handleSubmit}>
        <div style={{ padding: 24 }}>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Communication Type *</label>
              <select
                className="form-input"
                value={formData.communication_type}
                onChange={(e) => handleChange("communication_type", e.target.value)}
              >
                <option value="">Select...</option>
                {COMMUNICATION_TYPES.map((type) => (
                  <option key={type} value={type}>
                    {type}
                  </option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">Communication Channel *</label>
              <select
                className="form-input"
                value={formData.communication_channel}
                onChange={(e) =>
                  handleChange("communication_channel", e.target.value)
                }
              >
                <option value="">Select...</option>
                {COMMUNICATION_CHANNELS.map((channel) => (
                  <option key={channel} value={channel}>
                    {channel}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Communication Date *</label>
              <input
                type="date"
                className="form-input"
                value={formData.communication_date}
                onChange={(e) =>
                  handleChange("communication_date", e.target.value)
                }
              />
            </div>
          </div>

          <div className="form-row full">
            <div className="form-group">
              <label className="form-label">Notes</label>
              <textarea
                rows={4}
                className="form-input"
                value={formData.notes}
                onChange={(e) => handleChange("notes", e.target.value)}
              />
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label className="form-label">
                <input
                  type="checkbox"
                  checked={formData.followup_needed}
                  onChange={(e) =>
                    handleChange("followup_needed", e.target.checked)
                  }
                  style={{ marginRight: 8 }}
                />
                Follow-Up Needed
              </label>
            </div>

            {showFollowupDetails ? (
              <div className="form-group">
                <label className="form-label">Follow-Up Due</label>
                <input
                  type="date"
                  className="form-input"
                  value={formData.followup_due}
                  onChange={(e) => handleChange("followup_due", e.target.value)}
                />
              </div>
            ) : null}
          </div>

          {showFollowupDetails ? (
            <div className="form-row full">
              <div className="form-group">
                <label className="form-label">Follow-Up Notes</label>
                <textarea
                  rows={3}
                  className="form-input"
                  value={formData.followup_notes}
                  onChange={(e) => handleChange("followup_notes", e.target.value)}
                />
              </div>
            </div>
          ) : null}

          {showCompletionFields ? (
            <>
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">
                    <input
                      type="checkbox"
                      checked={formData.followup_complete}
                      onChange={(e) =>
                        handleChange("followup_complete", e.target.checked)
                      }
                      style={{ marginRight: 8 }}
                    />
                    Follow-Up Complete
                  </label>
                </div>

                <div className="form-group">
                  <label className="form-label">Completion Date</label>
                  <input
                    type="date"
                    className="form-input"
                    value={formData.completion_date}
                    onChange={(e) =>
                      handleChange("completion_date", e.target.value)
                    }
                  />
                </div>
              </div>

              <div className="form-row full">
                <div className="form-group">
                  <label className="form-label">Completion Notes</label>
                  <textarea
                    rows={3}
                    className="form-input"
                    value={formData.completion_notes}
                    onChange={(e) =>
                      handleChange("completion_notes", e.target.value)
                    }
                  />
                </div>
              </div>
            </>
          ) : null}

          {error ? <div style={{ color: "#c92a2a", fontSize: 13 }}>{error}</div> : null}
        </div>
      </form>
    </SereniusModal>
  );
}
