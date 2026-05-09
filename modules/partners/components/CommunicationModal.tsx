"use client";

import { useEffect, useState } from "react";
import SereniusModal from "@/components/ui/SereniusModal";
import RecordAttachments from "@/components/attachments/RecordAttachments";
import AddAttachmentModal, {
  type AddAttachmentValues,
  type UploadAttachmentValues,
} from "@/components/attachments/AddAttachmentModal";
import { createSupabaseBrowserClient } from "@/lib/supabase-browser";
import { createRecordAttachment } from "@/lib/attachments/queries";
import type { UploadAttachmentResult } from "@/components/attachments/AddAttachmentModal";
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
  partnerDisplayName: string;
  tenantId: string;
  communication?: PartnerCommunication | null;
  followups?: PartnerCommunicationFollowup[];
  onClose: () => void;
  onSuccess: (communication: PartnerCommunication) => void;
}

type Mode = "view" | "edit";

type PendingAttachmentKind = "upload" | "link";
type PendingAttachmentStatus = "pending" | "uploading" | "uploaded" | "failed";

type PendingAttachment = {
  id: string;
  kind: PendingAttachmentKind;
  status: PendingAttachmentStatus;
  file?: File;
  file_name: string;
  file_url?: string;
  description: string;
  error?: string;
};

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
  partnerDisplayName,
  tenantId,
  communication,
  followups = [],
  onClose,
  onSuccess,
}: Props) {
  const supabase = createSupabaseBrowserClient();
  const [currentCommunication, setCurrentCommunication] = useState<PartnerCommunication | null>(communication ?? null);
  const [mode, setMode] = useState<Mode>(communication ? "view" : "edit");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [attachmentError, setAttachmentError] = useState<string | null>(null);
  const [showAttachmentModal, setShowAttachmentModal] = useState(false);
  const [pendingAttachments, setPendingAttachments] = useState<PendingAttachment[]>([]);
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

  function createPendingAttachmentId() {
    return globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  }

  function makePendingUploadAttachment(values: UploadAttachmentValues): PendingAttachment {
    return {
      id: createPendingAttachmentId(),
      kind: "upload",
      status: "pending",
      file: values.file,
      file_name: values.file.name,
      description: values.description.trim(),
    };
  }

  function makePendingLinkAttachment(values: AddAttachmentValues): PendingAttachment {
    return {
      id: createPendingAttachmentId(),
      kind: "link",
      status: "pending",
      file_name: values.file_name,
      file_url: values.file_url,
      description: values.description.trim(),
    };
  }

  function formatPendingAttachmentSize(file: File | undefined) {
    if (!file) return "—";

    const bytes = file.size;
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
  }

  function getPendingAttachmentLabel(item: PendingAttachment) {
    if (item.status === "failed") return "Failed";
    if (item.status === "uploading") return "Uploading";
    if (item.status === "uploaded") return "Uploaded";
    return item.kind === "upload" ? "Pending upload" : "Pending link";
  }

  function getPendingAttachmentTitle(item: PendingAttachment) {
    return item.kind === "upload"
      ? item.file?.name ?? item.file_name
      : item.file_name;
  }

  useEffect(() => {
    if (communication) {
      setCurrentCommunication(communication);
      setFormData(mapCommunicationToFormData(communication));
      setMode("view");
    } else {
      setCurrentCommunication(null);
      setFormData({
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
      setMode("edit");
    }
    setError(null);
    setAttachmentError(null);
    setPendingAttachments([]);
  }, [communication]);

  function handleChange(field: keyof FormData, value: string | boolean) {
    setFormData((prev) => ({
      ...prev,
      [field]: value,
    }));
  }

  function returnToViewMode() {
    if (currentCommunication) {
      setFormData(mapCommunicationToFormData(currentCommunication));
    }

    setError(null);
    setAttachmentError(null);
    setMode("view");
  }

  const showFollowupDetails = formData.followup_needed;
  const showCompletionFields = Boolean(currentCommunication) && formData.followup_needed;
  const attachmentName = currentCommunication?.file_attachment_name || null;
  const attachmentUrl = currentCommunication?.file_attachment_url || null;
  const communicationId = currentCommunication?.id ?? null;
  const isCreate = !currentCommunication;
  const failedPendingAttachments = pendingAttachments.filter(
    (attachment) => attachment.status === "failed",
  );
  const showPendingAttachmentSection = isCreate || pendingAttachments.length > 0;
  const pendingAttachmentSectionTitle = isCreate ? "Files" : "Pending Files";
  const sharedAttachmentsSection = communicationId ? (
    <div style={{ marginTop: 16 }}>
      <RecordAttachments
        tenantId={tenantId}
        recordType="partner_communication"
        recordId={communicationId}
        title="Communication Files"
        emptyMessage="No files added yet."
        uploadContext={{
          partnerId,
          partnerDisplayName,
        }}
        />
      </div>
    ) : null;

  function renderPendingAttachmentList() {
    if (pendingAttachments.length === 0) {
      return null;
    }

    return (
      <div style={{ padding: "0 18px 18px", display: "flex", flexDirection: "column", gap: 12 }}>
        {pendingAttachments.map((attachment) => {
          const isUpload = attachment.kind === "upload";
          const sizeLabel =
            isUpload && attachment.file
              ? formatPendingAttachmentSize(attachment.file)
              : attachment.file_url ?? "—";

          return (
            <div
              key={attachment.id}
              style={{
                border: "1px solid #e5e7eb",
                borderRadius: 8,
                background: "#fff",
                padding: "12px 14px",
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "flex-start",
                  justifyContent: "space-between",
                  gap: 12,
                }}
              >
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div
                    style={{
                      fontSize: 14,
                      fontWeight: 600,
                      color: "#111827",
                      wordBreak: "break-word",
                    }}
                  >
                    {getPendingAttachmentTitle(attachment)}
                  </div>
                  <div style={{ fontSize: 12, color: "#6b7280", marginTop: 2 }}>
                    {isUpload ? `File size: ${sizeLabel}` : `Link: ${sizeLabel}`}
                  </div>
                  {attachment.description ? (
                    <div
                      style={{
                        fontSize: 12,
                        color: "#374151",
                        whiteSpace: "pre-wrap",
                        marginTop: 6,
                        lineHeight: 1.5,
                      }}
                    >
                      {attachment.description}
                    </div>
                  ) : null}
                  {attachment.error ? (
                    <div style={{ fontSize: 12, color: "#c92a2a", marginTop: 6 }}>
                      {attachment.error}
                    </div>
                  ) : null}
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
                  <span
                    style={{
                      fontSize: 12,
                      fontWeight: 600,
                      color:
                        attachment.status === "failed"
                          ? "#c92a2a"
                          : attachment.status === "uploading"
                            ? "#1d4ed8"
                            : "#6b7280",
                    }}
                  >
                    {getPendingAttachmentLabel(attachment)}
                  </span>
                  {attachment.status !== "uploading" ? (
                    <button
                      type="button"
                      className="btn btn-ghost btn-sm"
                      onClick={() => removePendingAttachment(attachment.id)}
                      disabled={saving}
                    >
                      Remove
                    </button>
                  ) : null}
                </div>
              </div>
            </div>
          );
        })}

        {failedPendingAttachments.length > 0 && currentCommunication?.id ? (
          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={handleRetryPendingAttachments}
              disabled={saving}
            >
              Retry Failed Files
            </button>
          </div>
        ) : null}
      </div>
    );
  }

  async function handleQueueUpload(values: UploadAttachmentValues) {
    setAttachmentError(null);
    setPendingAttachments((prev) => [...prev, makePendingUploadAttachment(values)]);
  }

  async function handleQueueLink(values: AddAttachmentValues) {
    setAttachmentError(null);
    setPendingAttachments((prev) => [...prev, makePendingLinkAttachment(values)]);
  }

  function removePendingAttachment(id: string) {
    setPendingAttachments((prev) => prev.filter((current) => current.id !== id));
  }

  async function processPendingAttachments(recordId: string, items: PendingAttachment[]) {
    const { data: userResult } = await supabase.auth.getUser();
    const results: UploadAttachmentResult[] = [];

    for (const item of items) {
      setPendingAttachments((prev) =>
        prev.map((current) =>
          current.id === item.id
            ? { ...current, status: "uploading", error: undefined }
            : current,
        ),
      );

      try {
        if (item.kind === "upload") {
          const formData = new FormData();
          formData.set("tenantId", tenantId);
          formData.set("recordType", "partner_communication");
          formData.set("recordId", recordId);
          formData.set("file", item.file as File);
          formData.set("partnerId", partnerId);
          formData.set("partnerDisplayName", partnerDisplayName);
          if (item.description.trim()) {
            formData.set("description", item.description.trim());
          }

          const response = await fetch("/api/attachments/upload", {
            method: "POST",
            credentials: "include",
            body: formData,
          });

          const data = await response.json().catch(() => null) as
            | { ok?: boolean; error?: string }
            | null;

          if (!response.ok || !data?.ok) {
            throw new Error(data?.error || "Failed to upload file.");
          }
        } else {
          await createRecordAttachment(supabase, {
            tenant_id: tenantId,
            record_type: "partner_communication",
            record_id: recordId,
            storage_provider: "google_drive",
            file_name: item.file_name,
            file_url: item.file_url ?? "",
            description: item.description || null,
            uploaded_by: userResult.user?.id ?? null,
          });
        }

        results.push({ file: item.kind === "upload" ? (item.file as File) : new File([], item.file_name), status: "uploaded" });
        setPendingAttachments((prev) => prev.filter((current) => current.id !== item.id));
      } catch (attachmentError) {
        const message = attachmentError instanceof Error ? attachmentError.message : "Failed to save file.";
        results.push({ file: item.kind === "upload" ? (item.file as File) : new File([], item.file_name), status: "failed", error: message });
        setPendingAttachments((prev) =>
          prev.map((current) =>
            current.id === item.id
              ? { ...current, status: "failed", error: message }
              : current,
          ),
        );
      }
    }

    return results;
  }

  async function handleRetryPendingAttachments() {
    if (!currentCommunication?.id) return;

    const failedItems = pendingAttachments.filter((attachment) => attachment.status === "failed");
    if (failedItems.length === 0) return;

    setAttachmentError(null);
    const results = await processPendingAttachments(currentCommunication.id, failedItems);
    const failedNames = results.filter((result) => result.status === "failed").map((result) => result.file.name);
    if (failedNames.length > 0) {
      setAttachmentError(`Some files could not be uploaded: ${failedNames.join(", ")}.`);
    } else {
      setAttachmentError(null);
    }
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();

    setError(null);
    setAttachmentError(null);

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
          .eq("id", currentCommunication!.id)
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

    if (result.error) {
      setSaving(false);
      setError(result.error.message);
      return;
    }

    const savedCommunication = result.data as PartnerCommunication;

    if (isCreate) {
      onSuccess(savedCommunication);

      if (pendingAttachments.length === 0) {
        setSaving(false);
        onClose();
        return;
      }

      const queuedAttachments = [...pendingAttachments];
      const attachmentResults = await processPendingAttachments(savedCommunication.id, queuedAttachments);
      const failedNames = attachmentResults
        .filter((result) => result.status === "failed")
        .map((result) => result.file.name);

      if (failedNames.length === 0) {
        setPendingAttachments([]);
        setSaving(false);
        onClose();
        return;
      }

      setCurrentCommunication(savedCommunication);
      setFormData(mapCommunicationToFormData(savedCommunication));
      setMode("view");
      setSaving(false);
      setAttachmentError(
        `Communication was created, but some files failed: ${failedNames.join(", ")}.`,
      );
      return;
    }

    onSuccess(savedCommunication);
    setFormData(mapCommunicationToFormData(savedCommunication));
    setMode("view");
    setSaving(false);
  }

  if (!isCreate && mode === "view") {
    const viewCommunication = currentCommunication;
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
            </>
          ) : null}

          {showAttachments ? (
            <div className="section-card" style={{ marginBottom: 0 }}>
              <div className="section-header">
                <span className="section-title">Files</span>
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

          {sharedAttachmentsSection}

          {showPendingAttachmentSection ? (
            <div className="section-card" style={{ marginBottom: 0 }}>
              <div className="section-header">
                <span className="section-title">{pendingAttachmentSectionTitle}</span>
                <span className="section-count">{pendingAttachments.length}</span>
              </div>
              {renderPendingAttachmentList()}
            </div>
          ) : null}

          {error ? <div style={{ color: "#c92a2a", fontSize: 13 }}>{error}</div> : null}
        </div>
      </SereniusModal>
    );
  }

  return (
    <>
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

          {showPendingAttachmentSection ? (
            <div className="section-card" style={{ marginTop: 16, marginBottom: 0 }}>
              <div className="section-header">
                <span className="section-title">{pendingAttachmentSectionTitle}</span>
                <span className="section-count">{pendingAttachments.length}</span>
                {isCreate ? (
                  <div className="section-actions">
                    <button
                      type="button"
                      className="btn btn-ghost btn-sm"
                      onClick={() => setShowAttachmentModal(true)}
                      disabled={saving}
                    >
                      Add Files
                    </button>
                  </div>
                ) : null}
              </div>
              {isCreate ? (
                <div
                  style={{
                    padding: "0 18px 12px",
                    fontSize: 13,
                    color: "#6b7280",
                    lineHeight: 1.6,
                  }}
                >
                  You can add files now. They’ll upload after this communication is saved.
                </div>
              ) : null}
              {renderPendingAttachmentList()}
              {!isCreate && failedPendingAttachments.length > 0 ? (
                <div style={{ padding: "0 18px 18px", display: "flex", justifyContent: "flex-end" }}>
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    onClick={handleRetryPendingAttachments}
                    disabled={saving}
                  >
                    Retry Failed Files
                  </button>
                </div>
              ) : null}
            </div>
          ) : null}

          {error ? <div style={{ color: "#c92a2a", fontSize: 13 }}>{error}</div> : null}
          {attachmentError ? <div style={{ color: "#92400e", fontSize: 13 }}>{attachmentError}</div> : null}
        </div>
      </form>
      </SereniusModal>
      {showAttachmentModal ? (
        <AddAttachmentModal
          onClose={() => setShowAttachmentModal(false)}
          onSaveLink={handleQueueLink}
          onUploadFile={handleQueueUpload}
          allowUpload
        />
      ) : null}
    </>
  );
}
