"use client";

import { useMemo, useState } from "react";
import SereniusModal from "@/components/ui/SereniusModal";
import { createSupabaseBrowserClient } from "@/lib/supabase-browser";
import type {
  CampaignFormMode,
  CommunicationEmailAsset,
  EmailBrandSettings,
  EmailTemplate,
} from "../types";
import {
  TEMPLATE_STATUS_LABELS,
  TEMPLATE_STATUS_OPTIONS,
  TEMPLATE_TYPE_LABELS,
  TEMPLATE_TYPE_OPTIONS,
} from "../constants";
import BlockComposer from "./BlockComposer";
import { parseDesign, renderEmailBuilderHtml } from "../email-builder-renderer";
import type { EmailBuilderDesign } from "../email-builder-types";

interface Props {
  tenantId: string;
  template: EmailTemplate | null;
  mode: CampaignFormMode;
  canManage: boolean;
  brandSettings: EmailBrandSettings | null;
  emailAssets: CommunicationEmailAsset[];
  onAssetUploaded?: (asset: CommunicationEmailAsset) => void;
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
  design_json: Record<string, unknown>;
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
    design_json: {},
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
    design_json:
      t.design_json && typeof t.design_json === "object" && !Array.isArray(t.design_json)
        ? t.design_json
        : {},
  };
}

function prettyText(value: string | null | undefined): string {
  if (!value || value.trim() === "") return "—";
  return value;
}

function PersonalizationPanel() {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  function handleCopy() {
    navigator.clipboard
      ?.writeText("{firstname}")
      .then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      })
      .catch(() => {});
  }

  return (
    <div className="section-card" style={{ marginBottom: 0 }}>
      <div
        className="section-header"
        onClick={() => setOpen((v) => !v)}
        style={{ cursor: "pointer", userSelect: "none" }}
      >
        <span className="section-title" style={{ flex: 1 }}>
          Personalization
        </span>
        <span style={{ fontSize: 11, color: "#6b7280", flexShrink: 0 }}>{open ? "▲" : "▼"}</span>
      </div>
      {open && (
        <div style={{ padding: "12px 18px 16px" }}>
          <p style={{ fontSize: 11, color: "#6b7280", marginBottom: 12, lineHeight: 1.5 }}>
            Use these tokens in your subject line or HTML content. Serenius will replace them when
            emails are sent.
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

const SELECT_FIELDS =
  "id, tenant_id, name, description, template_type, status, is_default, email_style, subject_default, preheader_default, html_template, plain_text_template, design_json, thumbnail_url, created_by, created_at, updated_at";

export default function TemplateModal({
  tenantId,
  template,
  mode,
  canManage,
  brandSettings,
  emailAssets,
  onAssetUploaded,
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
  const [showHtmlPreview, setShowHtmlPreview] = useState(true);
  const [previewHeight, setPreviewHeight] = useState(680);
  const [rawHtmlPreviewDoc, setRawHtmlPreviewDoc] = useState<string>(
    template?.html_template ?? "",
  );
  const [templateDetailsOpen, setTemplateDetailsOpen] = useState(true);

  const parsedDesign: EmailBuilderDesign = useMemo(
    () => parseDesign(form.design_json),
    [form.design_json],
  );

  const isBuilder = form.email_style === "Rich Text";

  function field(key: keyof FormData, value: string | boolean) {
    setForm((prev) => ({ ...prev, [key]: value } as FormData));
  }

  function updateDesignJson(design: EmailBuilderDesign) {
    setForm((prev) => ({
      ...prev,
      design_json: design as unknown as Record<string, unknown>,
    }));
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
  }

  function enterEdit() {
    if (template) {
      setForm(templateToForm(template));
      setRawHtmlPreviewDoc(template.html_template ?? "");
    }
    onModeChange("edit");
  }

  function cancelEdit() {
    if (template) {
      setForm(templateToForm(template));
      setRawHtmlPreviewDoc(template.html_template ?? "");
      onModeChange("view");
    } else {
      onClose();
    }
  }

  async function handleSave() {
    if (!form.name.trim()) {
      setError("Name is required.");
      setTemplateDetailsOpen(true);
      return;
    }

    setSaving(true);
    setError(null);

    const supabase = createSupabaseBrowserClient();

    const renderedHtml = isBuilder
      ? renderEmailBuilderHtml(parsedDesign, brandSettings)
      : form.html_template.trim() || null;

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
      html_template: renderedHtml,
      plain_text_template: form.plain_text_template.trim() || null,
      design_json: form.design_json,
    };

    let saved: EmailTemplate | null = null;

    if (template) {
      const { data, error: err } = await supabase
        .from("communication_email_templates")
        .update(payload)
        .eq("id", template.id)
        .eq("tenant_id", tenantId)
        .select(SELECT_FIELDS)
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
        .select(SELECT_FIELDS)
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
        setError(
          `Template saved, but could not clear default flag from other templates: ${clearErr.message}`,
        );
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
      maxWidth={1440}
      contentPadding={mode === "view" ? 0 : 28}
      headerActions={headerActions}
      footer={
        isEditing ? (
          <>
            <button
              type="button"
              className="btn btn-ghost"
              onClick={cancelEdit}
              disabled={saving}
            >
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
      {mode === "view" && template ? (
        /* ── VIEW MODE — two-column workspace ── */
        <div style={{ padding: "24px 24px 40px" }}>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "minmax(0, 2fr) minmax(0, 3fr)",
              gap: 20,
              alignItems: "start",
            }}
          >
            {/* Left column: details */}
            <div className="section-card" style={{ marginBottom: 0 }}>
              <div className="section-header">
                <span className="section-title">Template Details</span>
              </div>
              <div style={{ padding: "4px 18px 18px" }}>
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
                  value={
                    template.email_style === "Rich Text"
                      ? "Serenius Builder"
                      : (template.email_style || "Raw HTML")
                  }
                />
                <ViewRow label="Default" value={template.is_default ? "Yes" : "No"} />
                <ViewRow label="Subject Default" value={prettyText(template.subject_default)} />
                <ViewRow
                  label="Preheader Default"
                  value={prettyText(template.preheader_default)}
                />
                <ViewRow label="Description" value={prettyText(template.description)} />

                {template.email_style !== "Rich Text" ? (
                  template.plain_text_template ? (
                    <div style={{ marginTop: 12, borderTop: "1px solid #f3f4f6", paddingTop: 12 }}>
                      <div
                        style={{
                          fontSize: 11,
                          fontWeight: 600,
                          color: "#9ca3af",
                          textTransform: "uppercase",
                          letterSpacing: "0.05em",
                          marginBottom: 6,
                        }}
                      >
                        Plain Text Template
                      </div>
                      <pre
                        style={{
                          background: "#f9fafb",
                          border: "1px solid #e5e7eb",
                          borderRadius: 6,
                          padding: "8px 12px",
                          fontSize: 11,
                          fontFamily: "monospace",
                          whiteSpace: "pre-wrap",
                          maxHeight: 160,
                          overflowY: "auto",
                          color: "#374151",
                          margin: 0,
                        }}
                      >
                        {template.plain_text_template}
                      </pre>
                    </div>
                  ) : (
                    <ViewRow label="Plain Text Template" value="—" />
                  )
                ) : null}
              </div>
            </div>

            {/* Right column: preview — sticky */}
            <div style={{ position: "sticky", top: 0 }}>
              <div
                className="section-card"
                style={{ marginBottom: 0, border: "1px solid #e5e7eb" }}
              >
                <div className="section-header">
                  <span className="section-title">
                    {template.email_style === "Rich Text"
                      ? "Rendered Preview"
                      : showHtmlPreview
                        ? "HTML Preview"
                        : "HTML Source"}
                  </span>
                  {template.email_style !== "Rich Text" && template.html_template ? (
                    <div className="section-actions">
                      <button
                        type="button"
                        className="btn btn-ghost btn-sm"
                        onClick={() => setShowHtmlPreview((v) => !v)}
                      >
                        {showHtmlPreview ? "Show Source" : "Preview"}
                      </button>
                    </div>
                  ) : null}
                </div>
                <div
                  style={{
                    padding: "8px 12px 12px",
                    overflowY: "auto",
                    maxHeight: "calc(100vh - 260px)",
                    minHeight: 200,
                  }}
                >
                  {template.html_template ? (
                    showHtmlPreview || template.email_style === "Rich Text" ? (
                      <div
                        style={{
                          border: "1px solid #e5e7eb",
                          borderRadius: 8,
                          overflow: "hidden",
                          background: "#fff",
                        }}
                      >
                        <iframe
                          srcDoc={template.html_template}
                          sandbox="allow-same-origin"
                          onLoad={handlePreviewLoad}
                          style={{
                            width: "100%",
                            height: Math.max(previewHeight, 5000),
                            border: 0,
                            display: "block",
                            pointerEvents: "none",
                          }}
                          title="Template preview"
                        />
                      </div>
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
                          overflowY: "auto",
                          whiteSpace: "pre-wrap",
                          wordBreak: "break-all",
                          color: "#374151",
                          margin: 0,
                          maxHeight: "calc(100vh - 320px)",
                        }}
                      >
                        {template.html_template}
                      </pre>
                    )
                  ) : (
                    <div
                      style={{
                        padding: "24px 16px",
                        textAlign: "center",
                        color: "#9ca3af",
                        fontSize: 13,
                      }}
                    >
                      No preview available.
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : (
        /* ── CREATE / EDIT MODE — two-column workspace ── */
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "minmax(0, 3fr) minmax(0, 2fr)",
            gap: 20,
            alignItems: "start",
          }}
        >
          {/* Left column */}
          <div style={{ display: "grid", gap: 16 }}>
            {/* Template Details — collapsible */}
            <div className="section-card" style={{ marginBottom: 0 }}>
              <div
                className="section-header"
                onClick={() => setTemplateDetailsOpen((v) => !v)}
                style={{ cursor: "pointer", userSelect: "none" }}
              >
                <span className="section-title" style={{ flex: 1 }}>
                  Template Details
                </span>
                {!templateDetailsOpen && (
                  <span
                    style={{
                      fontSize: 11,
                      color: "#9ca3af",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                      maxWidth: 280,
                    }}
                  >
                    {form.name || "Untitled"}
                  </span>
                )}
                <span style={{ fontSize: 11, color: "#6b7280", flexShrink: 0 }}>
                  {templateDetailsOpen ? "▲" : "▼"}
                </span>
              </div>
              {templateDetailsOpen && (
                <div style={{ padding: "16px 18px 18px", display: "grid", gap: 14 }}>
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

                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
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
                    <div className="form-group">
                      <label className="form-label">Content Mode</label>
                      <select
                        className="form-select"
                        value={form.email_style}
                        onChange={(e) => {
                          field("email_style", e.target.value);
                          if (e.target.value === "Raw HTML") {
                            setRawHtmlPreviewDoc(form.html_template);
                          }
                        }}
                      >
                        <option value="Raw HTML">Raw HTML</option>
                        <option value="Rich Text">Serenius Builder</option>
                      </select>
                    </div>
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
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
                    <label className="form-label">Description</label>
                    <textarea
                      className="form-textarea"
                      value={form.description}
                      onChange={(e) => field("description", e.target.value)}
                      rows={2}
                      placeholder="Optional description"
                    />
                  </div>

                  <div>
                    <label
                      style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}
                    >
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

                  {error && (
                    <div style={{ color: "#b91c1c", fontSize: 13 }}>{error}</div>
                  )}
                </div>
              )}
            </div>

            <PersonalizationPanel />

            {isBuilder ? (
              <BlockComposer
                design={parsedDesign}
                brandSettings={brandSettings}
                emailAssets={emailAssets}
                tenantId={tenantId}
                canEdit={true}
                onChange={updateDesignJson}
                onAssetUploaded={onAssetUploaded}
              />
            ) : (
              /* HTML Content card */
              <div className="section-card" style={{ marginBottom: 0 }}>
                <div className="section-header">
                  <span className="section-title">HTML Content</span>
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    onClick={() => setRawHtmlPreviewDoc(form.html_template)}
                  >
                    Refresh Preview
                  </button>
                </div>
                <div style={{ padding: "16px 18px 18px", display: "grid", gap: 14 }}>
                  <textarea
                    className="form-textarea"
                    rows={18}
                    value={form.html_template}
                    onChange={(e) => field("html_template", e.target.value)}
                    placeholder="<html>..."
                    style={{ fontFamily: "monospace", fontSize: 12, resize: "vertical" }}
                  />
                  <div className="form-group">
                    <label className="form-label">Plain Text Template</label>
                    <textarea
                      className="form-textarea"
                      value={form.plain_text_template}
                      onChange={(e) => field("plain_text_template", e.target.value)}
                      rows={6}
                      style={{ fontFamily: "monospace", fontSize: 12, resize: "vertical" }}
                      placeholder="Plain text version of the email"
                    />
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Right column — sticky preview */}
          <div style={{ position: "sticky", top: 0 }}>
            <div
              className="section-card"
              style={{ marginBottom: 0, border: "1px solid #e5e7eb" }}
            >
              <div className="section-header">
                <span className="section-title">
                  {isBuilder ? "Live Preview" : "Preview"}
                </span>
              </div>
              <div
                style={{
                  padding: "8px 12px 12px",
                  overflowY: "auto",
                  maxHeight: "calc(100vh - 260px)",
                  minHeight: 200,
                }}
              >
                <div
                  style={{
                    border: "1px solid #e5e7eb",
                    borderRadius: 8,
                    overflow: "hidden",
                    background: "#fff",
                  }}
                >
                  {isBuilder ? (
                    <iframe
                      srcDoc={renderEmailBuilderHtml(parsedDesign, brandSettings)}
                      sandbox=""
                      onLoad={handlePreviewLoad}
                      style={{
                        width: "100%",
                        height: Math.max(previewHeight, 5000),
                        border: 0,
                        display: "block",
                        pointerEvents: "none",
                      }}
                      title="Live Preview"
                    />
                  ) : rawHtmlPreviewDoc ? (
                    <iframe
                      srcDoc={rawHtmlPreviewDoc}
                      sandbox=""
                      style={{
                        width: "100%",
                        height: Math.max(previewHeight, 5000),
                        border: 0,
                        display: "block",
                        pointerEvents: "none",
                      }}
                      title="HTML Preview"
                    />
                  ) : (
                    <div
                      style={{
                        padding: "24px 16px",
                        textAlign: "center",
                        color: "#9ca3af",
                        fontSize: 13,
                      }}
                    >
                      No HTML content yet. Paste HTML and click Refresh Preview.
                    </div>
                  )}
                </div>
              </div>
            </div>
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
