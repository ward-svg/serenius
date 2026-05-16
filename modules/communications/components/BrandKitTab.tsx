"use client";

import { useState, useMemo, useEffect } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase-browser";
import { buildCampaignEmailFooter } from "@/lib/mail/campaign-email-footer";
import type { EmailBrandSettings } from "../types";

interface Props {
  tenantId: string;
  brandSettings: EmailBrandSettings | null;
  canManage: boolean;
  onSaved: (settings: EmailBrandSettings) => void;
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
  heading_font: string;
  body_font: string;
  default_signature: string;
  default_donation_url: string;
  preference_center_url: string;
  unsubscribe_text: string;
  header_html: string;
  footer_html: string;
  footer_background_color: string;
  footer_text_color: string;
  footer_link_color: string;
  footer_font_size: string;
  footer_divider_enabled: boolean;
  footer_divider_color: string;
  theme_color_1: string;
  theme_color_2: string;
  theme_color_3: string;
  theme_color_4: string;
  theme_color_5: string;
  preference_page_background_color: string;
  preference_card_background_color: string;
  preference_text_color: string;
  preference_button_color: string;
  preference_button_text_color: string;
  preference_logo_background_color: string;
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
  heading_font: "Georgia, 'Times New Roman', serif",
  body_font: "Arial, Helvetica, sans-serif",
  default_signature: "",
  default_donation_url: "",
  preference_center_url: "",
  unsubscribe_text: "If you no longer wish to receive these emails, you may unsubscribe at any time.",
  header_html: "",
  footer_html: "",
  footer_background_color: "#f4f4f0",
  footer_text_color: "#6b7280",
  footer_link_color: "#3d5a80",
  footer_font_size: "12",
  footer_divider_enabled: true,
  footer_divider_color: "#e5e7eb",
  theme_color_1: "#98C1D9",
  theme_color_2: "#3D5A80",
  theme_color_3: "#293241",
  theme_color_4: "#4C5253",
  theme_color_5: "#E0FBFC",
  preference_page_background_color: "",
  preference_card_background_color: "",
  preference_text_color: "",
  preference_button_color: "",
  preference_button_text_color: "",
  preference_logo_background_color: "",
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
    heading_font: s.heading_font,
    body_font: s.body_font,
    default_signature: s.default_signature ?? "",
    default_donation_url: s.default_donation_url ?? "",
    preference_center_url: s.preference_center_url ?? "",
    unsubscribe_text: s.unsubscribe_text,
    header_html: s.header_html ?? "",
    footer_html: s.footer_html ?? "",
    footer_background_color: s.footer_background_color || '#f4f4f0',
    footer_text_color: s.footer_text_color || '#6b7280',
    footer_link_color: s.footer_link_color || '#3d5a80',
    footer_font_size: String(s.footer_font_size ?? 12),
    footer_divider_enabled: s.footer_divider_enabled ?? true,
    footer_divider_color: s.footer_divider_color || '#e5e7eb',
    theme_color_1: s.theme_color_1 || '#98C1D9',
    theme_color_2: s.theme_color_2 || '#3D5A80',
    theme_color_3: s.theme_color_3 || '#293241',
    theme_color_4: s.theme_color_4 || '#4C5253',
    theme_color_5: s.theme_color_5 || '#E0FBFC',
    preference_page_background_color: s.preference_page_background_color ?? "",
    preference_card_background_color: s.preference_card_background_color ?? "",
    preference_text_color: s.preference_text_color ?? "",
    preference_button_color: s.preference_button_color ?? "",
    preference_button_text_color: s.preference_button_text_color ?? "",
    preference_logo_background_color: s.preference_logo_background_color ?? "",
  };
}

function isValidHex(v: string): boolean {
  return /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(v.trim())
}

const PREFERENCE_COLOR_KEYS = [
  "preference_page_background_color",
  "preference_card_background_color",
  "preference_text_color",
  "preference_button_color",
  "preference_button_text_color",
  "preference_logo_background_color",
] as const;

type PreferenceColorKey = (typeof PREFERENCE_COLOR_KEYS)[number];

type ResolvedPreferenceColors = {
  pageBackground: string;
  cardBackground: string;
  textColor: string;
  buttonColor: string;
  buttonTextColor: string;
  logoBackground: string;
};

function resolveHexColor(value: string | null | undefined, fallback: string): string {
  const trimmed = value?.trim() ?? "";
  return trimmed && isValidHex(trimmed) ? trimmed : fallback;
}

function colorInputValue(value: string): string {
  const resolved = resolveHexColor(value, "#000000").toLowerCase();
  if (/^#[0-9a-f]{3}$/.test(resolved)) {
    return `#${resolved[1]}${resolved[1]}${resolved[2]}${resolved[2]}${resolved[3]}${resolved[3]}`;
  }
  return /^#[0-9a-f]{6}$/.test(resolved) ? resolved : "#000000";
}

function resolvePreferencePageColors(form: FormData): ResolvedPreferenceColors {
  const pageBackground = resolveHexColor(
    form.preference_page_background_color,
    resolveHexColor(form.background_color, "#f9fafb"),
  );
  const cardBackground = resolveHexColor(form.preference_card_background_color, "#ffffff");
  const textColor = resolveHexColor(
    form.preference_text_color,
    resolveHexColor(form.text_color, "#111827"),
  );
  const buttonColor = resolveHexColor(
    form.preference_button_color,
    resolveHexColor(form.button_color, resolveHexColor(form.primary_color, "#3d5a80")),
  );
  const buttonTextColor = resolveHexColor(
    form.preference_button_text_color,
    resolveHexColor(form.button_text_color, "#ffffff"),
  );
  const logoBackground = resolveHexColor(
    form.preference_logo_background_color,
    resolveHexColor(form.primary_color, "#111827"),
  );

  return {
    pageBackground,
    cardBackground,
    textColor,
    buttonColor,
    buttonTextColor,
    logoBackground,
  };
}

function hasPreferenceColorOverrides(form: FormData): boolean {
  return PREFERENCE_COLOR_KEYS.some((key) => form[key].trim() !== "");
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

function PreferenceColorField({
  label,
  value,
  resolvedValue,
  inheritedLabel,
  onChange,
}: {
  label: string;
  value: string;
  resolvedValue: string;
  inheritedLabel: string;
  onChange: (v: string) => void;
}) {
  const hasValue = value.trim() !== "";
  const displayValue = hasValue ? value : resolvedValue;
  return (
    <div className="form-group">
      <label className="form-label" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
        <span>{label}</span>
        <span
          style={{
            fontSize: 10,
            fontWeight: 700,
            color: hasValue ? "#1d4ed8" : "#6b7280",
            background: hasValue ? "#dbeafe" : "#f3f4f6",
            borderRadius: 999,
            padding: "2px 7px",
            textTransform: "uppercase",
            letterSpacing: "0.04em",
            flexShrink: 0,
          }}
        >
          {hasValue ? "Custom" : "Inherited"}
        </span>
      </label>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <input
          type="color"
          value={colorInputValue(displayValue)}
          onChange={(e) => onChange(e.target.value)}
          style={{ width: 36, height: 36, padding: 2, border: "1px solid #d1d5db", borderRadius: 6, cursor: "pointer" }}
        />
        <input
          type="text"
          className="form-input"
          value={displayValue}
          onChange={(e) => onChange(e.target.value)}
          style={{ flex: 1, fontFamily: "monospace", fontSize: 13 }}
          placeholder={resolvedValue}
        />
        {hasValue && (
          <button
            type="button"
            className="btn btn-ghost"
            style={{ fontSize: 12, padding: "4px 8px", whiteSpace: "nowrap", flexShrink: 0 }}
            onClick={() => onChange("")}
          >
            Clear
          </button>
        )}
      </div>
      <div className="form-helper">
        {hasValue ? `Fallback: ${inheritedLabel} (${resolvedValue})` : `Inheriting ${inheritedLabel} (${resolvedValue})`}
      </div>
    </div>
  );
}

function PreferencePagePreview({
  colors,
  orgName,
  logoUrl,
}: {
  colors: ResolvedPreferenceColors;
  orgName: string;
  logoUrl: string;
}) {
  return (
    <div>
      <div style={{ fontSize: 12, fontWeight: 600, color: "#374151", marginBottom: 8 }}>
        Preference Page Preview
      </div>
      <div
        style={{
          background: colors.pageBackground,
          border: "1px solid #e5e7eb",
          borderRadius: 8,
          padding: 16,
        }}
      >
        <div
          style={{
            maxWidth: 300,
            margin: "0 auto",
            background: colors.cardBackground,
            border: "1px solid #e5e7eb",
            borderRadius: 10,
            padding: 18,
            boxShadow: "0 1px 3px rgba(0,0,0,0.06)",
            fontFamily: "Arial, Helvetica, sans-serif",
          }}
        >
          <div style={{ fontSize: 9, fontWeight: 700, color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 12 }}>
            Email Preferences
          </div>
          <div style={{ marginBottom: 14 }}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                width: "100%",
                maxWidth: 188,
                minHeight: 72,
                background: colors.logoBackground,
                borderRadius: 7,
                padding: "10px 14px",
                boxSizing: "border-box",
                marginBottom: 8,
                color: "#ffffff",
                fontSize: 10,
                fontWeight: 700,
              }}
            >
              {logoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={logoUrl}
                  alt={orgName}
                  style={{ maxWidth: "100%", maxHeight: 52, objectFit: "contain", display: "block" }}
                />
              ) : (
                "Logo"
              )}
            </div>
            <div style={{ fontSize: 12, fontWeight: 700, color: colors.textColor }}>{orgName}</div>
          </div>
          <div style={{ fontSize: 18, lineHeight: 1.25, fontWeight: 700, color: colors.textColor, marginBottom: 9 }}>
            Confirm unsubscribe
          </div>
          <div style={{ fontSize: 12, lineHeight: 1.55, color: colors.textColor, marginBottom: 14 }}>
            You&rsquo;re unsubscribing from campaign emails from {orgName}.
          </div>
          <button
            type="button"
            style={{
              background: colors.buttonColor,
              color: colors.buttonTextColor,
              border: "none",
              borderRadius: 6,
              padding: "8px 14px",
              fontSize: 12,
              fontWeight: 700,
            }}
          >
            Yes, unsubscribe me
          </button>
          <div style={{ borderTop: "1px solid #f3f4f6", marginTop: 18, paddingTop: 10, textAlign: "center", fontSize: 10, color: "#d1d5db" }}>
            Powered by Serenius
          </div>
        </div>
      </div>
    </div>
  );
}

export default function BrandKitTab({ tenantId, brandSettings, canManage, onSaved }: Props) {
  const [form, setForm] = useState<FormData>(() =>
    brandSettings ? settingsToForm(brandSettings) : { ...DEFAULTS },
  );
  const [preferenceColorsOpen, setPreferenceColorsOpen] = useState<boolean>(() =>
    brandSettings ? hasPreferenceColorOverrides(settingsToForm(brandSettings)) : false,
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);

  const preferenceColors = useMemo(() => resolvePreferencePageColors(form), [form]);
  const hasPreferenceOverrides = hasPreferenceColorOverrides(form);

  useEffect(() => {
    if (preferenceColorsOpen && !hasPreferenceOverrides) {
      setPreferenceColorsOpen(false);
    }
  }, [hasPreferenceOverrides, preferenceColorsOpen]);

  function field(key: keyof FormData, value: string) {
    setForm((prev) => ({ ...prev, [key]: value }));
    setSaveSuccess(false);
  }

  function preferenceField(key: PreferenceColorKey, value: string) {
    setForm((prev) => ({ ...prev, [key]: value }));
    setSaveSuccess(false);
  }

  function startPreferenceCustomization() {
    setForm((prev) => {
      const colors = resolvePreferencePageColors(prev);
      return {
        ...prev,
        preference_page_background_color: prev.preference_page_background_color.trim() || colors.pageBackground,
        preference_card_background_color: prev.preference_card_background_color.trim() || colors.cardBackground,
        preference_text_color: prev.preference_text_color.trim() || colors.textColor,
        preference_button_color: prev.preference_button_color.trim() || colors.buttonColor,
        preference_button_text_color: prev.preference_button_text_color.trim() || colors.buttonTextColor,
        preference_logo_background_color: prev.preference_logo_background_color.trim() || colors.logoBackground,
      };
    });
    setPreferenceColorsOpen(true);
    setSaveSuccess(false);
  }

  function clearPreferenceColors() {
    setForm((prev) => ({
      ...prev,
      preference_page_background_color: "",
      preference_card_background_color: "",
      preference_text_color: "",
      preference_button_color: "",
      preference_button_text_color: "",
      preference_logo_background_color: "",
    }));
    setPreferenceColorsOpen(false);
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

    const footerFontSizeNum = parseInt(form.footer_font_size, 10);
    if (Number.isNaN(footerFontSizeNum) || footerFontSizeNum < 11 || footerFontSizeNum > 16) {
      setError("Footer font size must be between 11 and 16.");
      setSaving(false);
      return;
    }

    const fBg = form.footer_background_color.trim()
    const fText = form.footer_text_color.trim()
    const fLink = form.footer_link_color.trim()
    const fDivider = form.footer_divider_color.trim()

    if (!isValidHex(fBg)) {
      setError("Footer background color is invalid. Use a hex color like #f4f4f0.")
      setSaving(false)
      return
    }
    if (!isValidHex(fText)) {
      setError("Footer text color is invalid. Use a hex color like #6b7280.")
      setSaving(false)
      return
    }
    if (!isValidHex(fLink)) {
      setError("Footer link color is invalid. Use a hex color like #3d5a80.")
      setSaving(false)
      return
    }
    if (form.footer_divider_enabled && !isValidHex(fDivider)) {
      setError("Footer divider color is invalid. Use a hex color like #e5e7eb.")
      setSaving(false)
      return
    }

    const normHex = (v: string) => v.toLowerCase()
    if (normHex(fText) === normHex(fBg)) {
      setError("Footer text color and background color cannot be the same — text would be invisible.")
      setSaving(false)
      return
    }
    if (normHex(fLink) === normHex(fBg)) {
      setError("Footer link color and background color cannot be the same — link would be invisible.")
      setSaving(false)
      return
    }
    if (form.footer_divider_enabled && normHex(fDivider) === normHex(fBg)) {
      setError("Footer divider color and background color cannot be the same — divider would be invisible.")
      setSaving(false)
      return
    }

    const themeColorEntries: Array<[keyof FormData, string]> = [
      ["theme_color_1", "Theme Color 1"],
      ["theme_color_2", "Theme Color 2"],
      ["theme_color_3", "Theme Color 3"],
      ["theme_color_4", "Theme Color 4"],
      ["theme_color_5", "Theme Color 5"],
    ]
    for (const [key, label] of themeColorEntries) {
      if (!isValidHex(form[key] as string)) {
        setError(`${label} is invalid. Use a hex color like #98c1d9.`)
        setSaving(false)
        return
      }
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
      heading_font: form.heading_font || "Georgia, 'Times New Roman', serif",
      body_font: form.body_font || "Arial, Helvetica, sans-serif",
      default_signature: form.default_signature.trim() || null,
      default_donation_url: form.default_donation_url.trim() || null,
      preference_center_url: form.preference_center_url.trim() || null,
      unsubscribe_text: form.unsubscribe_text.trim() || "If you no longer wish to receive these emails, you may unsubscribe at any time.",
      header_html: form.header_html.trim() || null,
      footer_html: form.footer_html.trim() || null,
      footer_background_color: form.footer_background_color,
      footer_text_color: form.footer_text_color,
      footer_link_color: form.footer_link_color,
      footer_font_size: footerFontSizeNum,
      footer_divider_enabled: form.footer_divider_enabled,
      footer_divider_color: form.footer_divider_color,
      theme_color_1: form.theme_color_1,
      theme_color_2: form.theme_color_2,
      theme_color_3: form.theme_color_3,
      theme_color_4: form.theme_color_4,
      theme_color_5: form.theme_color_5,
      preference_page_background_color: form.preference_page_background_color.trim() || null,
      preference_card_background_color: form.preference_card_background_color.trim() || null,
      preference_text_color: form.preference_text_color.trim() || null,
      preference_button_color: form.preference_button_color.trim() || null,
      preference_button_text_color: form.preference_button_text_color.trim() || null,
      preference_logo_background_color: form.preference_logo_background_color.trim() || null,
    };

    const selectCols =
      "id, tenant_id, logo_url, logo_width, header_html, footer_html, primary_color, accent_color, button_color, button_text_color, background_color, text_color, default_font, heading_font, body_font, default_signature, default_donation_url, preference_center_url, social_links, organization_name, mailing_address, city, state, zip, country, phone, website_url, unsubscribe_text, footer_background_color, footer_text_color, footer_link_color, footer_font_size, footer_divider_enabled, footer_divider_color, preference_page_background_color, preference_card_background_color, preference_text_color, preference_button_color, preference_button_text_color, preference_logo_background_color, theme_color_1, theme_color_2, theme_color_3, theme_color_4, theme_color_5, created_by, created_at, updated_at";

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

  const footerPreviewDoc = useMemo(() => {
    const { html } = buildCampaignEmailFooter(
      {
        organization_name: form.organization_name.trim() || null,
        mailing_address: form.mailing_address.trim() || null,
        city: form.city.trim() || null,
        state: form.state.trim() || null,
        zip: form.zip.trim() || null,
        country: form.country.trim() || null,
        phone: form.phone.trim() || null,
        website_url: form.website_url.trim() || null,
        unsubscribe_text: form.unsubscribe_text.trim() || null,
        footer_html: null,
        preference_center_url: form.preference_center_url.trim() || null,
        footer_background_color: form.footer_background_color || null,
        footer_text_color: form.footer_text_color || null,
        footer_link_color: form.footer_link_color || null,
        footer_font_size: Number(form.footer_font_size) || null,
        footer_divider_enabled: form.footer_divider_enabled,
        footer_divider_color: form.footer_divider_color || null,
      },
      '#', // placeholder — unique opt-out link generated per recipient at send time
    )
    const note =
      '<div style="font-family:Arial,Helvetica,sans-serif;font-size:11px;color:#9ca3af;' +
      'text-align:center;padding:4px 0 10px;">' +
      'Unsubscribe link shown as placeholder &mdash; unique link generated per recipient at send time' +
      '</div>'
    return `<!DOCTYPE html><html><head><meta charset="utf-8"></head><body style="margin:0;padding:0;">${html}${note}</body></html>`
  }, [
    form.organization_name, form.mailing_address, form.city, form.state, form.zip,
    form.country, form.phone, form.website_url, form.unsubscribe_text,
    form.preference_center_url, form.footer_background_color, form.footer_text_color,
    form.footer_link_color, form.footer_font_size, form.footer_divider_enabled,
    form.footer_divider_color,
  ])

  return (
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
          <div
            style={{
              background: "#eff6ff",
              border: "1px solid #bfdbfe",
              borderRadius: 6,
              padding: "8px 12px",
              marginBottom: 16,
              fontSize: 12,
              color: "#1e40af",
              lineHeight: 1.5,
            }}
          >
            <strong>Required for live sending.</strong>{" "}
            These organization identity fields are used in the required email footer before live campaign sends are enabled.
          </div>
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
          <div style={{ display: "grid", gridTemplateColumns: "1fr 160px", gap: 16, alignItems: "start" }}>
            <div>
              {/* Checkerboard preview — same pattern as Image Gallery asset cards */}
              <div
                style={{
                  height: 140,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  overflow: "hidden",
                  borderRadius: 8,
                  border: "1px solid #e5e7eb",
                  backgroundColor: "#e5e7eb",
                  backgroundImage: [
                    "linear-gradient(45deg, #d1d5db 25%, transparent 25%)",
                    "linear-gradient(-45deg, #d1d5db 25%, transparent 25%)",
                    "linear-gradient(45deg, transparent 75%, #d1d5db 75%)",
                    "linear-gradient(-45deg, transparent 75%, #d1d5db 75%)",
                  ].join(", "),
                  backgroundSize: "12px 12px",
                  backgroundPosition: "0 0, 0 6px, 6px -6px, -6px 0px",
                  marginBottom: 8,
                }}
              >
                {form.logo_url ? (
                  <img
                    src={form.logo_url}
                    alt="Logo preview"
                    style={{ maxWidth: "90%", maxHeight: 120, objectFit: "contain", display: "block" }}
                    onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
                  />
                ) : (
                  <span style={{ fontSize: 12, color: "#9ca3af" }}>No logo selected</span>
                )}
              </div>
              {form.logo_url ? (
                <div style={{ display: "flex", alignItems: "flex-start", gap: 8, marginBottom: 4 }}>
                  <span style={{ fontSize: 11, color: "#9ca3af", wordBreak: "break-all", flex: 1, minWidth: 0, lineHeight: 1.4 }}>
                    {form.logo_url}
                  </span>
                  {canManage && (
                    <button
                      type="button"
                      className="btn btn-ghost"
                      style={{ fontSize: 12, padding: "2px 10px", whiteSpace: "nowrap", flexShrink: 0 }}
                      onClick={() => field("logo_url", "")}
                    >
                      Remove
                    </button>
                  )}
                </div>
              ) : null}
              <div className="form-helper">Set via &ldquo;Use as Logo&rdquo; in the Image Gallery tab.</div>
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

          <SectionTitle>Theme Colors</SectionTitle>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16 }}>
            <ColorField label="Theme Color 1" value={form.theme_color_1} onChange={(v) => field("theme_color_1", v)} />
            <ColorField label="Theme Color 2" value={form.theme_color_2} onChange={(v) => field("theme_color_2", v)} />
            <ColorField label="Theme Color 3" value={form.theme_color_3} onChange={(v) => field("theme_color_3", v)} />
            <ColorField label="Theme Color 4" value={form.theme_color_4} onChange={(v) => field("theme_color_4", v)} />
            <ColorField label="Theme Color 5" value={form.theme_color_5} onChange={(v) => field("theme_color_5", v)} />
          </div>
          <div className="form-helper" style={{ marginBottom: 8 }}>
            Theme colors appear as reusable swatches in the email builder.
          </div>

          <SectionTitle>Typography</SectionTitle>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
            <div className="form-group">
              <label className="form-label">Personality / Heading Font</label>
              <select
                className="form-input"
                value={form.heading_font}
                onChange={(e) => field("heading_font", e.target.value)}
              >
                <option value="Georgia, 'Times New Roman', serif">Georgia, 'Times New Roman', serif</option>
                <option value="'Times New Roman', Times, serif">'Times New Roman', Times, serif</option>
                <option value="Arial, Helvetica, sans-serif">Arial, Helvetica, sans-serif</option>
                <option value="Verdana, Geneva, sans-serif">Verdana, Geneva, sans-serif</option>
                <option value="Tahoma, Geneva, sans-serif">Tahoma, Geneva, sans-serif</option>
                <option value="'Trebuchet MS', Arial, sans-serif">'Trebuchet MS', Arial, sans-serif</option>
              </select>
              <div className="form-helper">Used for emotional headings, hero headlines, quotes, closings, and scripture-style text.</div>
            </div>
            <div className="form-group">
              <label className="form-label">Body / Functional Font</label>
              <select
                className="form-input"
                value={form.body_font}
                onChange={(e) => field("body_font", e.target.value)}
              >
                <option value="Arial, Helvetica, sans-serif">Arial, Helvetica, sans-serif</option>
                <option value="Verdana, Geneva, sans-serif">Verdana, Geneva, sans-serif</option>
                <option value="Tahoma, Geneva, sans-serif">Tahoma, Geneva, sans-serif</option>
                <option value="'Trebuchet MS', Arial, sans-serif">'Trebuchet MS', Arial, sans-serif</option>
                <option value="Georgia, 'Times New Roman', serif">Georgia, 'Times New Roman', serif</option>
                <option value="'Times New Roman', Times, serif">'Times New Roman', Times, serif</option>
              </select>
              <div className="form-helper">Used for paragraphs, labels, cards, buttons, lists, and footer details.</div>
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">Default Font (Legacy)</label>
            <input
              type="text"
              className="form-input"
              value={form.default_font}
              onChange={(e) => field("default_font", e.target.value)}
              placeholder="Arial, sans-serif"
            />
            <div className="form-helper">Fallback font-family stack. Heading and body fonts above take precedence for builder blocks.</div>
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
          </div>

          <SectionTitle>Required Email Footer</SectionTitle>
          <div
            style={{
              background: "#f0fdf4",
              border: "1px solid #bbf7d0",
              borderRadius: 6,
              padding: "8px 12px",
              marginBottom: 16,
              fontSize: 12,
              color: "#15803d",
              lineHeight: 1.5,
            }}
          >
            <strong>System-enforced compliance footer.</strong>{" "}
            This footer is automatically added to all campaign emails. Organization identity and unsubscribe access are required and cannot be removed.
          </div>
          <div className="form-group">
            <label className="form-label">Unsubscribe Message</label>
            <textarea
              className="form-textarea"
              value={form.unsubscribe_text}
              onChange={(e) => field("unsubscribe_text", e.target.value)}
              rows={2}
              placeholder="If you no longer wish to receive these emails…"
            />
            <div className="form-helper">
              You can adjust the wording, but Serenius will always include a working unsubscribe link in every campaign email.
            </div>
          </div>

          <div style={{ marginTop: 16 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: "#374151", marginBottom: 12 }}>Footer Appearance</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16, marginBottom: 16 }}>
              <ColorField
                label="Background Color"
                value={form.footer_background_color}
                onChange={(v) => field("footer_background_color", v)}
              />
              <ColorField
                label="Text Color"
                value={form.footer_text_color}
                onChange={(v) => field("footer_text_color", v)}
              />
              <ColorField
                label="Link Color"
                value={form.footer_link_color}
                onChange={(v) => field("footer_link_color", v)}
              />
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "120px 1fr", gap: 16, alignItems: "start" }}>
              <div className="form-group">
                <label className="form-label">Font Size (px)</label>
                <input
                  type="number"
                  className="form-input"
                  value={form.footer_font_size}
                  onChange={(e) => field("footer_font_size", e.target.value)}
                  min={11}
                  max={16}
                  placeholder="12"
                />
                <div className="form-helper">11–16 px</div>
              </div>
              <div>
                <div className="form-group">
                  <label className="form-label" style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <input
                      type="checkbox"
                      checked={form.footer_divider_enabled}
                      onChange={(e) => setForm((prev) => ({ ...prev, footer_divider_enabled: e.target.checked }))}
                    />
                    Show divider line
                  </label>
                </div>
                {form.footer_divider_enabled && (
                  <ColorField
                    label="Divider Color"
                    value={form.footer_divider_color}
                    onChange={(v) => field("footer_divider_color", v)}
                  />
                )}
              </div>
            </div>
          </div>

          <div style={{ marginTop: 20, marginBottom: 20 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: "#374151", marginBottom: 8 }}>Footer Preview</div>
            <div style={{ border: "1px solid #e5e7eb", borderRadius: 8, overflow: "hidden", background: "#fff" }}>
              <iframe
                srcDoc={footerPreviewDoc}
                title="Required email footer preview"
                style={{ width: "100%", height: 0, border: "none", display: "block" }}
                scrolling="no"
                onLoad={(e) => {
                  const body = e.currentTarget.contentWindow?.document?.body
                  if (body) {
                    e.currentTarget.style.height = `${Math.max(80, body.scrollHeight)}px`
                  }
                }}
              />
            </div>
            <div className="form-helper" style={{ marginTop: 6 }}>
              Live preview — updates as you change colors, font size, and divider settings above. Required compliance footer appended to every campaign email.
            </div>
          </div>

          <SectionTitle>Public Preference Page</SectionTitle>
          <div className="form-helper" style={{ marginBottom: 14 }}>
            These colors are used on public unsubscribe and email preference pages.
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "minmax(0, 1fr) 320px",
              gap: 18,
              alignItems: "start",
              marginBottom: 20,
            }}
          >
            <div>
              {!preferenceColorsOpen ? (
                <div
                  style={{
                    border: "1px solid #e5e7eb",
                    borderRadius: 8,
                    padding: 14,
                    background: "#fafafa",
                  }}
                >
                  <div style={{ fontSize: 13, fontWeight: 700, color: "#374151", marginBottom: 4 }}>
                    Currently inheriting from your main Brand Kit colors.
                  </div>
                  <div style={{ fontSize: 12, color: "#6b7280", lineHeight: 1.5, marginBottom: 12 }}>
                    The hosted preference page will use your existing background, text, button, and primary colors unless you customize it here.
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 14 }}>
                    {[
                      ["Page Background", preferenceColors.pageBackground],
                      ["Card Background", preferenceColors.cardBackground],
                      ["Text Color", preferenceColors.textColor],
                      ["Button Color", preferenceColors.buttonColor],
                      ["Button Text", preferenceColors.buttonTextColor],
                      ["Logo Background", preferenceColors.logoBackground],
                    ].map(([label, value]) => (
                      <div key={label} style={{ display: "flex", alignItems: "center", gap: 7, minWidth: 0 }}>
                        <span
                          style={{
                            width: 18,
                            height: 18,
                            borderRadius: 4,
                            border: "1px solid #d1d5db",
                            background: value,
                            flexShrink: 0,
                          }}
                        />
                        <span style={{ fontSize: 11, color: "#6b7280", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                          {label}: <span style={{ fontFamily: "monospace" }}>{value}</span>
                        </span>
                      </div>
                    ))}
                  </div>
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={startPreferenceCustomization}
                    disabled={!canManage}
                  >
                    Customize preference page colors
                  </button>
                </div>
              ) : (
                <>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      gap: 12,
                      marginBottom: 12,
                    }}
                  >
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 700, color: "#374151" }}>
                        Custom preference page colors
                      </div>
                      <div className="form-helper">
                        Fields marked Inherited still follow your main Brand Kit colors.
                      </div>
                    </div>
                    {hasPreferenceOverrides ? (
                      <button
                        type="button"
                        className="btn btn-ghost"
                        style={{ fontSize: 12, whiteSpace: "nowrap" }}
                        onClick={clearPreferenceColors}
                        disabled={!canManage}
                      >
                        Clear custom preference colors
                      </button>
                    ) : null}
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16 }}>
                    <PreferenceColorField
                      label="Page Background"
                      value={form.preference_page_background_color}
                      resolvedValue={preferenceColors.pageBackground}
                      inheritedLabel="Background Color"
                      onChange={(v) => preferenceField("preference_page_background_color", v)}
                    />
                    <PreferenceColorField
                      label="Card Background"
                      value={form.preference_card_background_color}
                      resolvedValue={preferenceColors.cardBackground}
                      inheritedLabel="white"
                      onChange={(v) => preferenceField("preference_card_background_color", v)}
                    />
                    <PreferenceColorField
                      label="Text Color"
                      value={form.preference_text_color}
                      resolvedValue={preferenceColors.textColor}
                      inheritedLabel="Text Color"
                      onChange={(v) => preferenceField("preference_text_color", v)}
                    />
                    <PreferenceColorField
                      label="Button Color"
                      value={form.preference_button_color}
                      resolvedValue={preferenceColors.buttonColor}
                      inheritedLabel="Button Color / Primary Color"
                      onChange={(v) => preferenceField("preference_button_color", v)}
                    />
                    <PreferenceColorField
                      label="Button Text Color"
                      value={form.preference_button_text_color}
                      resolvedValue={preferenceColors.buttonTextColor}
                      inheritedLabel="Button Text Color"
                      onChange={(v) => preferenceField("preference_button_text_color", v)}
                    />
                    <PreferenceColorField
                      label="Logo Background"
                      value={form.preference_logo_background_color}
                      resolvedValue={preferenceColors.logoBackground}
                      inheritedLabel="Primary Color"
                      onChange={(v) => preferenceField("preference_logo_background_color", v)}
                    />
                  </div>
                </>
              )}
            </div>

            <PreferencePagePreview
              colors={preferenceColors}
              orgName={form.organization_name.trim() || "Your organization"}
              logoUrl={form.logo_url.trim()}
            />
          </div>

          <SectionTitle>Email Header HTML</SectionTitle>
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
              <div className="form-helper">HTML injected before the campaign body. Leave blank for no header.</div>
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
  );
}
