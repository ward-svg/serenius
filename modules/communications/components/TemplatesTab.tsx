"use client";

import { useMemo, useState } from "react";
import SereniusModal from "@/components/ui/SereniusModal";
import { createSupabaseBrowserClient } from "@/lib/supabase-browser";
import type { CommunicationEmailAsset, EmailBrandSettings, EmailTemplate } from "../types";
import { TEMPLATE_STATUS_LABELS, TEMPLATE_TYPE_LABELS } from "../constants";
import TemplateModal from "./TemplateModal";

interface Props {
  tenantId: string;
  templates: EmailTemplate[];
  canManage: boolean;
  brandSettings: EmailBrandSettings | null;
  emailAssets: CommunicationEmailAsset[];
  onTemplatesChange: (templates: EmailTemplate[]) => void;
  onAssetsChange?: (assets: CommunicationEmailAsset[]) => void;
}

type TemplateFilter = "available" | "draft" | "active" | "archived" | "all" | "trash";

function filterTemplates(templates: EmailTemplate[], filter: TemplateFilter): EmailTemplate[] {
  switch (filter) {
    case "available":
      return templates.filter((t) => !t.deleted_at && t.status !== "archived");
    case "draft":
      return templates.filter((t) => !t.deleted_at && t.status === "draft");
    case "active":
      return templates.filter((t) => !t.deleted_at && t.status === "active");
    case "archived":
      return templates.filter((t) => !t.deleted_at && t.status === "archived");
    case "all":
      return templates.filter((t) => !t.deleted_at);
    case "trash":
      return templates.filter((t) => !!t.deleted_at);
  }
}

function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return "—";
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-US", { month: "2-digit", day: "2-digit", year: "numeric" });
}

function TemplatePreview({ html }: { html: string | null }) {
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
          title="Template preview"
          aria-hidden="true"
        />
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

function statusBadgeStyle(status: string): React.CSSProperties {
  if (status === "active") return { background: "#dcfce7", color: "#15803d" };
  if (status === "archived") return { background: "#f3f4f6", color: "#6b7280" };
  return { background: "#fef3c7", color: "#92400e" };
}

const FILTER_DEFS: { key: TemplateFilter; label: string }[] = [
  { key: "available", label: "Available" },
  { key: "draft", label: "Draft" },
  { key: "active", label: "Active" },
  { key: "archived", label: "Archived" },
  { key: "all", label: "All" },
  { key: "trash", label: "Trash" },
];

export default function TemplatesTab({
  tenantId,
  templates,
  canManage,
  brandSettings,
  emailAssets,
  onTemplatesChange,
  onAssetsChange,
}: Props) {
  const [activeFilter, setActiveFilter] = useState<TemplateFilter>("available");

  const [selectedTemplate, setSelectedTemplate] = useState<EmailTemplate | null>(null);
  const [modalMode, setModalMode] = useState<"create" | "view" | "edit">("create");
  const [showModal, setShowModal] = useState(false);

  const [trashingId, setTrashingId] = useState<string | null>(null);
  const [restoringId, setRestoringId] = useState<string | null>(null);

  const [deleteTarget, setDeleteTarget] = useState<EmailTemplate | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const [showEmptyTrashModal, setShowEmptyTrashModal] = useState(false);
  const [emptyTrashDeleting, setEmptyTrashDeleting] = useState(false);
  const [emptyTrashError, setEmptyTrashError] = useState<string | null>(null);

  const templateCounts = useMemo(() => {
    const counts: Record<TemplateFilter, number> = {
      available: 0,
      draft: 0,
      active: 0,
      archived: 0,
      all: 0,
      trash: 0,
    };
    for (const t of templates) {
      if (t.deleted_at) {
        counts.trash += 1;
      } else {
        counts.all += 1;
        if (t.status !== "archived") counts.available += 1;
        if (t.status === "draft") counts.draft += 1;
        if (t.status === "active") counts.active += 1;
        if (t.status === "archived") counts.archived += 1;
      }
    }
    return counts;
  }, [templates]);

  const trashedTemplates = useMemo(() => templates.filter((t) => !!t.deleted_at), [templates]);
  const visible = useMemo(
    () => filterTemplates(templates, activeFilter),
    [templates, activeFilter],
  );

  function openNew() {
    setSelectedTemplate(null);
    setModalMode("create");
    setShowModal(true);
  }

  function openTemplate(template: EmailTemplate, readOnly = false) {
    setSelectedTemplate(template);
    setModalMode("view");
    setShowModal(true);
    void readOnly;
  }

  function handleSaved(saved: EmailTemplate) {
    onTemplatesChange(
      templates.some((t) => t.id === saved.id)
        ? templates.map((t) => (t.id === saved.id ? saved : t))
        : [saved, ...templates],
    );
    setSelectedTemplate(saved);
    setModalMode("view");
  }

  function handleDefaultCleared(savedId: string) {
    onTemplatesChange(templates.map((t) => (t.id === savedId ? t : { ...t, is_default: false })));
  }

  function handleClose() {
    setSelectedTemplate(null);
    setShowModal(false);
  }

  async function handleMoveToTrash(template: EmailTemplate) {
    setTrashingId(template.id);
    try {
      const supabase = createSupabaseBrowserClient();
      const now = new Date().toISOString();
      const { error } = await supabase
        .from("communication_email_templates")
        .update({ deleted_at: now, is_default: false })
        .eq("id", template.id)
        .eq("tenant_id", tenantId);
      if (error) throw error;
      onTemplatesChange(
        templates.map((t) =>
          t.id === template.id ? { ...t, deleted_at: now, is_default: false } : t,
        ),
      );
    } catch {
      // silent — row visually unchanged if it fails
    } finally {
      setTrashingId(null);
    }
  }

  async function handleRestore(template: EmailTemplate) {
    setRestoringId(template.id);
    try {
      const supabase = createSupabaseBrowserClient();
      const { error } = await supabase
        .from("communication_email_templates")
        .update({ deleted_at: null })
        .eq("id", template.id)
        .eq("tenant_id", tenantId);
      if (error) throw error;
      onTemplatesChange(
        templates.map((t) => (t.id === template.id ? { ...t, deleted_at: null } : t)),
      );
    } catch {
      // silent
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
        .from("communication_email_templates")
        .delete()
        .eq("id", deleteTarget.id)
        .eq("tenant_id", deleteTarget.tenant_id);
      if (error) throw error;
      onTemplatesChange(templates.filter((t) => t.id !== deleteTarget.id));
      setDeleteTarget(null);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      setDeleteError(
        msg.includes("foreign key") || msg.includes("violates")
          ? "This template has related records that prevent deletion. Contact support."
          : "Failed to permanently delete template. Please try again.",
      );
    } finally {
      setDeletingId(null);
    }
  }

  async function handleEmptyTrash() {
    const eligibleIds = templates.filter((t) => !!t.deleted_at).map((t) => t.id);
    if (eligibleIds.length === 0) {
      setShowEmptyTrashModal(false);
      return;
    }
    setEmptyTrashDeleting(true);
    setEmptyTrashError(null);
    try {
      const supabase = createSupabaseBrowserClient();
      const { error } = await supabase
        .from("communication_email_templates")
        .delete()
        .in("id", eligibleIds)
        .eq("tenant_id", tenantId);
      if (error) throw error;
      const deletedSet = new Set(eligibleIds);
      onTemplatesChange(templates.filter((t) => !deletedSet.has(t.id)));
      setShowEmptyTrashModal(false);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      setEmptyTrashError(
        msg.includes("foreign key") || msg.includes("violates")
          ? "Some templates have related records that prevent deletion. Contact support."
          : "Failed to empty trash. Please try again.",
      );
    } finally {
      setEmptyTrashDeleting(false);
    }
  }

  const isTrashTab = activeFilter === "trash";

  return (
    <>
      <div className="section-card" style={{ marginBottom: 16 }}>
        <div className="section-header">
          <span className="section-title">Templates</span>
          <span className="section-count">{visible.length}</span>
          {canManage ? (
            <div className="section-actions">
              {isTrashTab && trashedTemplates.length > 0 ? (
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  style={{ color: "#b91c1c" }}
                  onClick={() => {
                    setEmptyTrashError(null);
                    setShowEmptyTrashModal(true);
                  }}
                >
                  Empty Trash
                </button>
              ) : null}
              {!isTrashTab ? (
                <button type="button" className="btn btn-ghost btn-sm" onClick={openNew}>
                  New Template
                </button>
              ) : null}
            </div>
          ) : null}
        </div>

        {/* Filter tabs — same pattern as campaign filters */}
        <div className="tab-row" style={{ padding: "0 18px 10px", gap: 8 }}>
          {FILTER_DEFS.map(({ key, label }) => {
            const count = templateCounts[key];
            return (
              <button
                key={key}
                type="button"
                className={`tab${activeFilter === key ? " active" : ""}`}
                onClick={() => setActiveFilter(key)}
              >
                {label}
                {count > 0 ? ` (${count})` : ""}
              </button>
            );
          })}
        </div>

        {visible.length === 0 ? (
          <div className="empty-state">
            {isTrashTab ? "Trash is empty." : "No templates in this view."}
          </div>
        ) : (
          <div>
            {visible.map((template) => (
              <div key={template.id} className="campaign-card">
                {/* Preview column */}
                <div className="campaign-preview-col">
                  <TemplatePreview html={template.html_template} />
                </div>

                {/* Metadata column */}
                <div className="campaign-meta-col">
                  {/* Name + actions row */}
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
                      {template.name}
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
                      {isTrashTab ? (
                        <span className="badge" style={{ background: "#fef2f2", color: "#b91c1c" }}>
                          Trashed
                        </span>
                      ) : null}
                      <button
                        type="button"
                        className="action-link"
                        onClick={() => openTemplate(template, isTrashTab)}
                      >
                        {isTrashTab ? "View" : "View/Edit"}
                      </button>
                      {isTrashTab ? (
                        <>
                          <button
                            type="button"
                            className="action-link"
                            disabled={restoringId === template.id}
                            onClick={() => handleRestore(template)}
                          >
                            {restoringId === template.id ? "Restoring…" : "Restore"}
                          </button>
                          {canManage ? (
                            <button
                              type="button"
                              className="action-link"
                              style={{ color: "#b91c1c" }}
                              disabled={!!deletingId}
                              onClick={() => {
                                setDeleteError(null);
                                setDeleteTarget(template);
                              }}
                            >
                              Delete Permanently
                            </button>
                          ) : null}
                        </>
                      ) : canManage ? (
                        <button
                          type="button"
                          className="action-link"
                          style={{ color: "#b91c1c" }}
                          disabled={trashingId === template.id}
                          onClick={() => handleMoveToTrash(template)}
                        >
                          {trashingId === template.id ? "Moving…" : "Move to Trash"}
                        </button>
                      ) : null}
                    </div>
                  </div>

                  {/* Subject default */}
                  {template.subject_default ? (
                    <div style={{ fontSize: 13, color: "#374151", lineHeight: 1.4 }}>
                      <span style={{ color: "#9ca3af" }}>Subject:</span>{" "}
                      {template.subject_default}
                    </div>
                  ) : null}

                  {/* Description snippet */}
                  {template.description ? (
                    <div
                      style={{
                        fontSize: 12,
                        color: "#6b7280",
                        lineHeight: 1.5,
                        overflow: "hidden",
                        display: "-webkit-box",
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: "vertical",
                      }}
                    >
                      {template.description}
                    </div>
                  ) : null}

                  {/* Badges row */}
                  <div style={{ display: "flex", gap: 5, flexWrap: "wrap", alignItems: "center" }}>
                    {template.template_type ? (
                      <span className="badge badge-info">
                        {TEMPLATE_TYPE_LABELS[template.template_type] ?? template.template_type}
                      </span>
                    ) : null}
                    <span className="badge" style={{ background: "#f3f4f6", color: "#374151" }}>
                      {template.email_style === "Rich Text" ? "Serenius Builder" : "Raw HTML"}
                    </span>
                    <span className="badge" style={statusBadgeStyle(template.status)}>
                      {TEMPLATE_STATUS_LABELS[template.status] ?? template.status}
                    </span>
                    {template.is_default ? (
                      <span className="badge" style={{ background: "#eff6ff", color: "#1d4ed8" }}>
                        Default
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
                      <span style={{ color: "#9ca3af" }}>Updated:</span>{" "}
                      {formatDate(template.updated_at)}
                    </span>
                    {isTrashTab && template.deleted_at ? (
                      <span>
                        <span style={{ color: "#9ca3af" }}>Trashed:</span>{" "}
                        {formatDate(template.deleted_at)}
                      </span>
                    ) : null}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {showModal ? (
        <TemplateModal
          tenantId={tenantId}
          template={selectedTemplate}
          mode={modalMode}
          canManage={selectedTemplate?.deleted_at ? false : canManage}
          brandSettings={brandSettings}
          emailAssets={emailAssets}
          onAssetUploaded={(asset) => onAssetsChange?.([asset, ...emailAssets])}
          onClose={handleClose}
          onSaved={handleSaved}
          onModeChange={setModalMode}
          onDefaultCleared={handleDefaultCleared}
        />
      ) : null}

      {deleteTarget ? (
        <SereniusModal
          title="Permanently delete template?"
          maxWidth={480}
          closeOnOverlayClick={!deletingId}
          closeOnEscape={!deletingId}
          onClose={() => {
            if (!deletingId) {
              setDeleteTarget(null);
              setDeleteError(null);
            }
          }}
          footer={
            <>
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                disabled={!!deletingId}
                onClick={() => {
                  setDeleteTarget(null);
                  setDeleteError(null);
                }}
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
                  opacity: deletingId ? 0.6 : 1,
                }}
                disabled={!!deletingId}
                onClick={handlePermanentDelete}
              >
                {deletingId ? "Deleting…" : "Delete Permanently"}
              </button>
            </>
          }
        >
          <p style={{ fontSize: 14, color: "#374151", lineHeight: 1.6 }}>
            You are getting ready to permanently delete{" "}
            <strong>&ldquo;{deleteTarget.name}&rdquo;</strong>. This cannot be undone. Campaigns
            created from this template are not affected.
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

      {showEmptyTrashModal ? (
        <SereniusModal
          title="Empty Template Trash?"
          maxWidth={480}
          closeOnOverlayClick={!emptyTrashDeleting}
          closeOnEscape={!emptyTrashDeleting}
          onClose={() => {
            if (!emptyTrashDeleting) {
              setShowEmptyTrashModal(false);
              setEmptyTrashError(null);
            }
          }}
          footer={
            <>
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                disabled={emptyTrashDeleting}
                onClick={() => {
                  setShowEmptyTrashModal(false);
                  setEmptyTrashError(null);
                }}
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
                disabled={emptyTrashDeleting}
                onClick={handleEmptyTrash}
              >
                {emptyTrashDeleting ? "Deleting…" : "Empty Trash"}
              </button>
            </>
          }
        >
          <p style={{ fontSize: 14, color: "#374151", lineHeight: 1.6 }}>
            You are getting ready to permanently delete all {trashedTemplates.length} template
            {trashedTemplates.length === 1 ? "" : "s"} in the trash. This cannot be undone.
            Campaigns created from these templates are not affected.
          </p>
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
      ) : null}
    </>
  );
}
