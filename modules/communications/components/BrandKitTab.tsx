"use client";

import { useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase-browser";
import type { CommunicationEmailAsset, EmailBrandSettings } from "../types";
import EmailAssetsSection from "./EmailAssetsSection";

interface Props {
  tenantId: string;
  brandSettings: EmailBrandSettings | null;
  canManage: boolean;
  emailAssets: CommunicationEmailAsset[];
  onSaved: (settings: EmailBrandSettings) => void;
  onAssetsChange: (assets: CommunicationEmailAsset[]) => void;
}

type FormData = {
  organization_name: string;
  mailing_address: string;
  city: string;
  state: string;
  zip: string;
  country: string;
  phone: string;
  website_url: string;
  logo_url: string;
  logo_width: string;
  primary_color: string;
  accent_color: string;
  button_color: string;
  button_text_color: string;
  background_color: string;
  text_color: string;
  default_font: string;
  default_signature: string;
  default_donation_url: string;
  preference_center_url: string;
  unsubscribe_text: string;
  header_html: string;
  footer_html: string;
};

const DEFAULTS: FormData = {
  organization_name: "",
  mailing_address: "",
  city: "",
  state: "",
  zip: "",
  country: "US",
  phone: "",
  website_url: "",
  logo_url: "",
  logo_width: "",
  primary_color: "#1a56db",
  accent_color: "#e8f0fe",
  button_color: "#1a56db",
  button_text_color: "#ffffff",
  background_color: "#f9fafb",
  text_color: "#111827",
  default_font: "Arial, sans-serif",
  default_signature: "",
  default_donation_url: "",
  preference_center_url: "",
  unsubscribe_text: "If you no longer wish to receive these emails, you may unsubscribe at any time.",
  header_html: "",
  footer_html: "",
};

function settingsToForm(s: EmailBrandSettings): FormData {
  return {
    organization_name: s.organization_name ?? "",
    mailing_address: s.mailing_address ?? "",
    city: s.city ?? "",
    state: s.state ?? "",
    zip: s.zip ?? "",
    country: s.country ?? "US",
    phone: s.phone ?? "",
    website_url: s.website_url ?? "",
    logo_url: s.logo_url ?? "",
    logo_width: s.logo_width != null ? String(s.logo_width) : "",
    primary_color: s.primary_color,
    accent_color: s.accent_color,
    button_color: s.button_color,
    button_text_color: s.button_text_color,
    background_color: s.background_color,
    text_color: s.text_color,
    default_font: s.default_font,
    default_signature: s.default_signature ?? "",
    default_donation_url: s.default_donation_url ?? "",
    preference_center_url: s.preference_center_url ?? "",
    unsubscribe_text: s.unsubscribe_text,
    header_html: s.header_html ?? "",
    footer_html: s.footer_html ?? "",
  };
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        fontSize: 11,
        fontWeight: 700,
        color: "#6b7280",
        textTransform: "uppercase",
        letterSpacing: "0.07em",
        marginBottom: 12,
        marginTop: 8,
        paddingBottom: 6,
        borderBottom: "1px solid #e5e7eb",
      }}
    >
      {children}
    </div>
  );
}

function ColorField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="form-group">
      <label className="form-label">{label}</label>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <input
          type="color"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          style={{ width: 36, height: 36, padding: 2, border: "1px solid #d1d5db", borderRadius: 6, cursor: "pointer" }}
        />
        <input
          type="text"
          className="form-input"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          style={{ flex: 1, fontFamily: "monospace", fontSize: 13 }}
          placeholder="#000000"
        />
      </div>
    </div>
  );
}

export default function BrandKitTab({ tenantId, brandSettings, canManage, emailAssets, onSaved, onAssetsChange }: Props) {
  const [form, setForm] = useState<FormData>(() =>
    brandSettings ? settingsToForm(brandSettings) : { ...DEFAULTS },
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);

  function field(key: keyof FormData, value: string) {
    setForm((prev) => ({ ...prev, [key]: value }));
    setSaveSuccess(false);
  }

  async function handleSave() {
    setSaving(true);
    setError(null);
    setSaveSuccess(false);

    const logoWidth = form.logo_width.trim() ? parseInt(form.logo_width, 10) : null;
    if (form.logo_width.trim() && (Number.isNaN(logoWidth) || (logoWidth != null && logoWidth <= 0))) {
      setError("Logo width must be a positive number.");
      setSaving(false);
      return;
    }

    const supabase = createSupabaseBrowserClient();

    const payload = {
      tenant_id: tenantId,
      organization_name: form.organization_name.trim() || null,
      mailing_address: form.mailing_address.trim() || null,
      city: form.city.trim() || null,
      state: form.state.trim() || null,
      zip: form.zip.trim() || null,
      country: form.country.trim() || "US",
      phone: form.phone.trim() || null,
      website_url: form.website_url.trim() || null,
      logo_url: form.logo_url.trim() || null,
      logo_width: logoWidth,
      primary_color: form.primary_color,
      accent_color: form.accent_color,
      button_color: form.button_color,
      button_text_color: form.button_text_color,
      background_color: form.background_color,
      text_color: form.text_color,
      default_font: form.default_font.trim() || "Arial, sans-serif",
      default_signature: form.default_signature.trim() || null,
      default_donation_url: form.default_donation_url.trim() || null,
      preference_center_url: form.preference_center_url.trim() || null,
      unsubscribe_text: form.unsubscribe_text.trim() || "If you no longer wish to receive these emails, you may unsubscribe at any time.",
      header_html: form.header_html.trim() || null,
      footer_html: form.footer_html.trim() || null,
    };

    const selectCols =
      "id, tenant_id, logo_url, logo_width, header_html, footer_html, primary_color, accent_color, button_color, button_text_color, background_color, text_color, default_font, default_signature, default_donation_url, preference_center_url, social_links, organization_name, mailing_address, city, state, zip, country, phone, website_url, unsubscribe_text, created_by, created_at, updated_at";

    let saved: EmailBrandSettings | null = null;

    if (brandSettings) {
      const { data, error: err } = await supabase
        .from("communication_email_brand_settings")
        .update(payload)
        .eq("id", brandSettings.id)
        .eq("tenant_id", tenantId)
        .select(selectCols)
        .single();

      if (err || !data) {
        setError(err?.message ?? "Save failed.");
        setSaving(false);
        return;
      }

      saved = data as EmailBrandSettings;
    } else {
      const { data, error: err } = await supabase
        .from("communication_email_brand_settings")
        .insert(payload)
        .select(selectCols)
        .single();

      if (err || !data) {
        setError(err?.message ?? "Save failed.");
        setSaving(false);
        return;
      }

      saved = data as EmailBrandSettings;
    }

    setSaving(false);
    setSaveSuccess(true);
    onSaved(saved);
  }

  function handleUseAsLogo(url: string) {
    field("logo_url", url);
  }

  const footerPreviewLines = [
    form.organization_name,
    [form.mailing_address, form.city, form.state, form.zip].filter(Boolean).join(", "),
    form.country !== "US" ? form.country : null,
    form.phone,
    form.website_url,
  ].filter(Boolean);

  return (
    <>
    <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) 360px", gap: 16, alignItems: "start" }}>
      <div className="section-card">
        <div className="section-header">
          <span className="section-title">Brand Kit</span>
        </div>

        <div style={{ padding: "0 20px 24px" }}>
          {error ? (
            <div className="form-error" style={{ marginBottom: 16 }}>
              {error}
            </div>
          ) : null}

          <SectionTitle>Organization Identity</SectionTitle>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
            <div className="form-group" style={{ gridColumn: "1 / -1" }}>
              <label className="form-label">Organization Name</label>
              <input
                type="text"
                className="form-input"
                value={form.organization_name}
                onChange={(e) => field("organization_name", e.target.value)}
                placeholder="Your organization name"
              />
            </div>
            <div className="form-group" style={{ gridColumn: "1 / -1" }}>
              <label className="form-label">Mailing Address</label>
              <input
                type="text"
                className="form-input"
                value={form.mailing_address}
                onChange={(e) => field("mailing_address", e.target.value)}
                placeholder="Street address"
              />
            </div>
            <div className="form-group">
              <label className="form-label">City</label>
              <input
                type="text"
                className="form-input"
                value={form.city}
                onChange={(e) => field("city", e.target.value)}
              />
            </div>
            <div className="form-group">
              <label className="form-label">State</label>
              <input
                type="text"
                className="form-input"
                value={form.state}
                onChange={(e) => field("state", e.target.value)}
                placeholder="e.g. TX"
              />
            </div>
            <div className="form-group">
              <label className="form-label">ZIP</label>
              <input
                type="text"
                className="form-input"
                value={form.zip}
                onChange={(e) => field("zip", e.target.value)}
              />
            </div>
            <div className="form-group">
              <label className="form-label">Country</label>
              <input
                type="text"
                className="form-input"
                value={form.country}
                onChange={(e) => field("country", e.target.value)}
                placeholder="US"
              />
            </div>
            <div className="form-group">
              <label className="form-label">Phone</label>
              <input
                type="text"
                className="form-input"
                value={form.phone}
                onChange={(e) => field("phone", e.target.value)}
              />
            </div>
            <div className="form-group">
              <label className="form-label">Website URL</label>
              <input
                type="text"
                className="form-input"
                value={form.website_url}
                onChange={(e) => field("website_url", e.target.value)}
                placeholder="https://example.org"
              />
            </div>
          </div>

          <SectionTitle>Logo</SectionTitle>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 160px", gap: 16 }}>
            <div className="form-group">
              <label className="form-label">Logo URL</label>
              <input
                type="text"
                className="form-input"
                value={form.logo_url}
                onChange={(e) => field("logo_url", e.target.value)}
                placeholder="https://…/logo.png"
              />
              <div className="form-helper">If blank, falls back to the logo set in organization_branding.</div>
            </div>
            <div className="form-group">
              <label className="form-label">Logo Width (px)</label>
              <input
                type="number"
                className="form-input"
                value={form.logo_width}
                onChange={(e) => field("logo_width", e.target.value)}
                min={1}
                placeholder="200"
              />
            </div>
          </div>

          <SectionTitle>Colors</SectionTitle>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16 }}>
            <ColorField label="Primary Color" value={form.primary_color} onChange={(v) => field("primary_color", v)} />
            <ColorField label="Accent Color" value={form.accent_color} onChange={(v) => field("accent_color", v)} />
            <ColorField label="Button Color" value={form.button_color} onChange={(v) => field("button_color", v)} />
            <ColorField label="Button Text Color" value={form.button_text_color} onChange={(v) => field("button_text_color", v)} />
            <ColorField label="Background Color" value={form.background_color} onChange={(v) => field("background_color", v)} />
            <ColorField label="Text Color" value={form.text_color} onChange={(v) => field("text_color", v)} />
          </div>

          <SectionTitle>Typography</SectionTitle>
          <div className="form-group">
            <label className="form-label">Default Font</label>
            <input
              type="text"
              className="form-input"
              value={form.default_font}
              onChange={(e) => field("default_font", e.target.value)}
              placeholder="Arial, sans-serif"
            />
            <div className="form-helper">CSS font-family stack used in email templates.</div>
          </div>

          <SectionTitle>Email Content Defaults</SectionTitle>
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div className="form-group">
              <label className="form-label">Default Signature</label>
              <textarea
                className="form-textarea"
                value={form.default_signature}
                onChange={(e) => field("default_signature", e.target.value)}
                rows={3}
                placeholder="Sign-off text or HTML"
              />
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
              <div className="form-group">
                <label className="form-label">Default Donation URL</label>
                <input
                  type="text"
                  className="form-input"
                  value={form.default_donation_url}
                  onChange={(e) => field("default_donation_url", e.target.value)}
                  placeholder="https://…/donate"
                />
              </div>
              <div className="form-group">
                <label className="form-label">Preference Center URL</label>
                <input
                  type="text"
                  className="form-input"
                  value={form.preference_center_url}
                  onChange={(e) => field("preference_center_url", e.target.value)}
                  placeholder="https://…/preferences"
                />
                <div className="form-helper">If blank, defaults to the Serenius-hosted /mail/preferences/{"{token}"} page.</div>
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">Unsubscribe Text</label>
              <textarea
                className="form-textarea"
                value={form.unsubscribe_text}
                onChange={(e) => field("unsubscribe_text", e.target.value)}
                rows={2}
                placeholder="If you no longer wish to receive these emails…"
              />
              <div className="form-helper">Displayed in the required footer of every campaign email.</div>
            </div>
          </div>

          <SectionTitle>HTML Overrides</SectionTitle>
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div className="form-group">
              <label className="form-label">Header HTML</label>
              <textarea
                className="form-textarea"
                value={form.header_html}
                onChange={(e) => field("header_html", e.target.value)}
                rows={4}
                style={{ fontFamily: "monospace", fontSize: 12 }}
                placeholder="Optional HTML injected at the top of every email"
              />
            </div>
            <div className="form-group">
              <label className="form-label">Footer HTML</label>
              <textarea
                className="form-textarea"
                value={form.footer_html}
                onChange={(e) => field("footer_html", e.target.value)}
                rows={4}
                style={{ fontFamily: "monospace", fontSize: 12 }}
                placeholder="Optional HTML override for the footer (replaces the auto-generated footer)"
              />
              <div className="form-helper">
                If provided, this HTML replaces the auto-generated footer. Leave blank to use the standard footer built from your organization identity and unsubscribe text above.
              </div>
            </div>
          </div>

          {canManage ? (
            <div style={{ marginTop: 24, display: "flex", alignItems: "center", gap: 12 }}>
              <button
                type="button"
                className="btn btn-primary"
                onClick={handleSave}
                disabled={saving}
              >
                {saving ? "Saving…" : "Save Brand Kit"}
              </button>
              {saveSuccess ? (
                <span style={{ fontSize: 13, color: "#16a34a" }}>Saved.</span>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>

      <div>
        <div className="section-card">
          <div className="section-header">
            <span className="section-title">Footer Preview</span>
          </div>
          <div style={{ padding: "16px 20px 20px" }}>
            <div
              style={{
                background: form.background_color || "#f9fafb",
                border: "1px solid #e5e7eb",
                borderRadius: 8,
                padding: "16px 20px",
                fontSize: 12,
                color: form.text_color || "#6b7280",
                lineHeight: 1.6,
              }}
            >
              {footerPreviewLines.length > 0 ? (
                footerPreviewLines.map((line, i) => (
                  <div key={i}>{line}</div>
                ))
              ) : (
                <div style={{ color: "#9ca3af" }}>Organization identity not set.</div>
              )}
              {form.unsubscribe_text ? (
                <div style={{ marginTop: 10, borderTop: "1px solid #e5e7eb", paddingTop: 10 }}>
                  {form.unsubscribe_text}{" "}
                  <span style={{ color: form.primary_color || "#1a56db", textDecoration: "underline", cursor: "pointer" }}>
                    Unsubscribe
                  </span>
                </div>
              ) : null}
            </div>
            <div className="form-helper" style={{ marginTop: 8 }}>
              This is a preview of the required email footer built from your brand settings. Opt-out links will be generated at send time.
            </div>
          </div>
        </div>

        <div className="section-card" style={{ marginTop: 12 }}>
          <div className="section-header">
            <span className="section-title">Color Preview</span>
          </div>
          <div style={{ padding: "16px 20px 20px" }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <div
                style={{
                  background: form.button_color,
                  color: form.button_text_color,
                  borderRadius: 6,
                  padding: "8px 16px",
                  fontSize: 13,
                  fontWeight: 600,
                  textAlign: "center",
                  display: "inline-block",
                }}
              >
                Donate Now
              </div>
              <div style={{ fontSize: 12, color: "#6b7280", marginTop: 4 }}>
                Button example using button color / button text color.
              </div>
              <div
                style={{
                  background: form.accent_color,
                  border: `1px solid ${form.primary_color}`,
                  borderRadius: 6,
                  padding: "8px 12px",
                  fontSize: 12,
                  color: form.text_color,
                  marginTop: 4,
                }}
              >
                Accent background with primary border.
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
    <EmailAssetsSection
      tenantId={tenantId}
      assets={emailAssets}
      canManage={canManage}
      onAssetsChange={onAssetsChange}
      onUseAsLogo={handleUseAsLogo}
    />
    </>
  );
}
