"use client";

import { useState } from "react";
import SereniusModal from "@/components/ui/SereniusModal";
import { createSupabaseBrowserClient } from "@/lib/supabase-browser";
import type { CampaignFormMode, EmailTemplate } from "../types";
import {
  TEMPLATE_STATUS_LABELS,
  TEMPLATE_STATUS_OPTIONS,
  TEMPLATE_TYPE_LABELS,
  TEMPLATE_TYPE_OPTIONS,
} from "../constants";

interface Props {
  tenantId: string;
  template: EmailTemplate | null;
  mode: CampaignFormMode;
  canManage: boolean;
  onClose: () => void;
  onSaved: (template: EmailTemplate) => void;
  onModeChange: (mode: CampaignFormMode) => void;
  onDefaultCleared: (savedId: string) => void;
}

type FormData = {
  name: string;
  description: string;
  template_type: string;
  status: string;
  is_default: boolean;
  email_style: string;
  subject_default: string;
  preheader_default: string;
  html_template: string;
  plain_text_template: string;
};

function blankForm(): FormData {
  return {
    name: "",
    description: "",
    template_type: "general",
    status: "draft",
    is_default: false,
    email_style: "Raw HTML",
    subject_default: "",
    preheader_default: "",
    html_template: "",
    plain_text_template: "",
  };
}

function templateToForm(t: EmailTemplate): FormData {
  return {
    name: t.name,
    description: t.description ?? "",
    template_type: t.template_type,
    status: t.status,
    is_default: t.is_default,
    email_style: t.email_style ?? "Raw HTML",
    subject_default: t.subject_default ?? "",
    preheader_default: t.preheader_default ?? "",
    html_template: t.html_template ?? "",
    plain_text_template: t.plain_text_template ?? "",
  };
}

function prettyText(value: string | null | undefined): string {
  if (!value || value.trim() === "") return "—";
  return value;
}

export default function TemplateModal({
  tenantId,
  template,
  mode,
  canManage,
  onClose,
  onSaved,
  onModeChange,
  onDefaultCleared,
}: Props) {
  const isEditing = mode === "edit" || mode === "create";
  const [form, setForm] = useState<FormData>(() =>
    template ? templateToForm(template) : blankForm(),
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showHtmlPreview, setShowHtmlPreview] = useState(false);

  function field(key: keyof FormData, value: string | boolean) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function enterEdit() {
    if (template) setForm(templateToForm(template));
    onModeChange("edit");
  }

  function cancelEdit() {
    if (template) {
      setForm(templateToForm(template));
      onModeChange("view");
    } else {
      onClose();
    }
  }

  async function handleSave() {
    if (!form.name.trim()) {
      setError("Name is required.");
      return;
    }

    setSaving(true);
    setError(null);

    const supabase = createSupabaseBrowserClient();

    const payload = {
      tenant_id: tenantId,
      name: form.name.trim(),
      description: form.description.trim() || null,
      template_type: form.template_type,
      status: form.status,
      is_default: form.is_default,
      email_style: form.email_style,
      subject_default: form.subject_default.trim() || null,
      preheader_default: form.preheader_default.trim() || null,
      html_template: form.html_template.trim() || null,
      plain_text_template: form.plain_text_template.trim() || null,
    };

    let saved: EmailTemplate | null = null;

    if (template) {
      const { data, error: err } = await supabase
        .from("communication_email_templates")
        .update(payload)
        .eq("id", template.id)
        .eq("tenant_id", tenantId)
        .select(
          "id, tenant_id, name, description, template_type, status, is_default, email_style, subject_default, preheader_default, html_template, plain_text_template, design_json, thumbnail_url, created_by, created_at, updated_at",
        )
        .single();

      if (err || !data) {
        setError(err?.message ?? "Save failed.");
        setSaving(false);
        return;
      }

      saved = data as EmailTemplate;
    } else {
      const { data, error: err } = await supabase
        .from("communication_email_templates")
        .insert(payload)
        .select(
          "id, tenant_id, name, description, template_type, status, is_default, email_style, subject_default, preheader_default, html_template, plain_text_template, design_json, thumbnail_url, created_by, created_at, updated_at",
        )
        .single();

      if (err || !data) {
        setError(err?.message ?? "Save failed.");
        setSaving(false);
        return;
      }

      saved = data as EmailTemplate;
    }

    if (saved.is_default) {
      const { error: clearErr } = await supabase
        .from("communication_email_templates")
        .update({ is_default: false })
        .eq("tenant_id", tenantId)
        .neq("id", saved.id);

      if (clearErr) {
        setError(`Template saved, but could not clear default flag from other templates: ${clearErr.message}`);
        setSaving(false);
        onSaved(saved);
        return;
      }

      onDefaultCleared(saved.id);
    }

    setSaving(false);
    onSaved(saved);
  }

  const title =
    mode === "create"
      ? "New Template"
      : mode === "edit"
        ? `Edit Template — ${template?.name ?? ""}`
        : (template?.name ?? "Template");

  const headerActions =
    mode === "view" && canManage ? (
      <button type="button" className="btn btn-ghost btn-sm" onClick={enterEdit}>
        Edit
      </button>
    ) : mode === "edit" && template ? (
      <button type="button" className="btn btn-ghost btn-sm" onClick={cancelEdit}>
        Back to View
      </button>
    ) : null;

  return (
    <SereniusModal
      title={title}
      onClose={isEditing ? () => {} : onClose}
      showCloseButton={!isEditing}
      closeOnOverlayClick={!isEditing}
      closeOnEscape={!isEditing}
      maxWidth={960}
      headerActions={headerActions}
      footer={
        isEditing ? (
          <>
            <button type="button" className="btn btn-ghost" onClick={cancelEdit} disabled={saving}>
              Cancel
            </button>
            <button
              type="button"
              className="btn btn-primary"
              onClick={handleSave}
              disabled={saving}
            >
              {saving ? "Saving…" : "Save Template"}
            </button>
          </>
        ) : undefined
      }
    >
      {error ? (
        <div className="form-error" style={{ marginBottom: 16 }}>
          {error}
        </div>
      ) : null}

      {mode === "view" && template ? (
        <div>
          <ViewRow label="Name" value={prettyText(template.name)} />
          <ViewRow
            label="Type"
            value={TEMPLATE_TYPE_LABELS[template.template_type] ?? template.template_type}
          />
          <ViewRow
            label="Status"
            value={TEMPLATE_STATUS_LABELS[template.status] ?? template.status}
          />
          <ViewRow
            label="Content Mode"
            value={template.email_style === "Rich Text" ? "Serenius Builder" : (template.email_style || "Raw HTML")}
          />
          <ViewRow label="Default" value={template.is_default ? "Yes" : "No"} />
          <ViewRow label="Description" value={prettyText(template.description)} />
          <ViewRow label="Subject Default" value={prettyText(template.subject_default)} />
          <ViewRow label="Preheader Default" value={prettyText(template.preheader_default)} />

          {template.html_template ? (
            <div style={{ marginTop: 20 }}>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  marginBottom: 8,
                }}
              >
                <span style={{ fontSize: 12, fontWeight: 500, color: "#6b7280" }}>
                  HTML Template
                </span>
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  onClick={() => setShowHtmlPreview((v) => !v)}
                >
                  {showHtmlPreview ? "Show Source" : "Preview"}
                </button>
              </div>

              {showHtmlPreview ? (
                <iframe
                  srcDoc={template.html_template}
                  sandbox="allow-same-origin"
                  style={{
                    width: "100%",
                    height: 500,
                    border: "1px solid #e5e7eb",
                    borderRadius: 8,
                    background: "#fff",
                  }}
                  title="HTML preview"
                />
              ) : (
                <pre
                  style={{
                    background: "#f9fafb",
                    border: "1px solid #e5e7eb",
                    borderRadius: 8,
                    padding: "12px 16px",
                    fontSize: 12,
                    fontFamily: "monospace",
                    overflowX: "auto",
                    maxHeight: 300,
                    overflowY: "auto",
                    whiteSpace: "pre-wrap",
                    wordBreak: "break-all",
                    color: "#374151",
                  }}
                >
                  {template.html_template}
                </pre>
              )}
            </div>
          ) : (
            <ViewRow label="HTML Template" value="—" />
          )}

          {template.plain_text_template ? (
            <div style={{ marginTop: 16 }}>
              <div style={{ fontSize: 12, fontWeight: 500, color: "#6b7280", marginBottom: 6 }}>
                Plain Text Template
              </div>
              <pre
                style={{
                  background: "#f9fafb",
                  border: "1px solid #e5e7eb",
                  borderRadius: 8,
                  padding: "12px 16px",
                  fontSize: 12,
                  fontFamily: "monospace",
                  whiteSpace: "pre-wrap",
                  maxHeight: 200,
                  overflowY: "auto",
                  color: "#374151",
                }}
              >
                {template.plain_text_template}
              </pre>
            </div>
          ) : (
            <ViewRow label="Plain Text Template" value="—" />
          )}
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div className="form-group">
            <label className="form-label">
              Name <span style={{ color: "#ef4444" }}>*</span>
            </label>
            <input
              type="text"
              className="form-input"
              value={form.name}
              onChange={(e) => field("name", e.target.value)}
              placeholder="Template name"
            />
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
            <div className="form-group">
              <label className="form-label">Type</label>
              <select
                className="form-select"
                value={form.template_type}
                onChange={(e) => field("template_type", e.target.value)}
              >
                {TEMPLATE_TYPE_OPTIONS.map((opt) => (
                  <option key={opt} value={opt}>
                    {TEMPLATE_TYPE_LABELS[opt] ?? opt}
                  </option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">Status</label>
              <select
                className="form-select"
                value={form.status}
                onChange={(e) => field("status", e.target.value)}
              >
                {TEMPLATE_STATUS_OPTIONS.map((opt) => (
                  <option key={opt} value={opt}>
                    {TEMPLATE_STATUS_LABELS[opt] ?? opt}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Content Mode</label>
            <select
              className="form-select"
              value={form.email_style}
              onChange={(e) => field("email_style", e.target.value)}
            >
              <option value="Raw HTML">Raw HTML</option>
              <option value="Rich Text" disabled>
                Serenius Builder (coming soon)
              </option>
            </select>
            <div className="form-helper">
              Builder template editing is coming next. For now, create Raw HTML templates.
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Description</label>
            <textarea
              className="form-textarea"
              value={form.description}
              onChange={(e) => field("description", e.target.value)}
              rows={2}
              placeholder="Optional description"
            />
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
            <div className="form-group">
              <label className="form-label">Subject Default</label>
              <input
                type="text"
                className="form-input"
                value={form.subject_default}
                onChange={(e) => field("subject_default", e.target.value)}
                placeholder="Default subject line"
              />
            </div>

            <div className="form-group">
              <label className="form-label">Preheader Default</label>
              <input
                type="text"
                className="form-input"
                value={form.preheader_default}
                onChange={(e) => field("preheader_default", e.target.value)}
                placeholder="Default preheader text"
              />
            </div>
          </div>

          <div className="form-group">
            <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
              <input
                type="checkbox"
                checked={form.is_default}
                onChange={(e) => field("is_default", e.target.checked)}
              />
              <span className="form-label" style={{ margin: 0 }}>
                Set as default template for this type
              </span>
            </label>
            <div className="form-helper">
              Marking as default will clear the default flag from any other template.
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">HTML Template</label>
            <textarea
              className="form-textarea"
              value={form.html_template}
              onChange={(e) => field("html_template", e.target.value)}
              rows={14}
              style={{ fontFamily: "monospace", fontSize: 12 }}
              placeholder="Paste raw HTML here"
            />
          </div>

          <div className="form-group">
            <label className="form-label">Plain Text Template</label>
            <textarea
              className="form-textarea"
              value={form.plain_text_template}
              onChange={(e) => field("plain_text_template", e.target.value)}
              rows={6}
              style={{ fontFamily: "monospace", fontSize: 12 }}
              placeholder="Plain text version of the email"
            />
          </div>
        </div>
      )}
    </SereniusModal>
  );
}

function ViewRow({ label, value }: { label: string; value: React.ReactNode }) {
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
