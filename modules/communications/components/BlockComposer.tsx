"use client";

import { useRef, useState } from "react";
import type {
  CtaBlock,
  DividerBlock,
  EmailBuilderBlock,
  EmailBuilderDesign,
  HeaderBlock,
  HeroBlock,
  HighlightBlock,
  ImageBlock,
  StoryBlock,
} from "../email-builder-types";
import { applyBrandDefaultsToDesign } from "../email-builder-renderer";
import type { CommunicationEmailAsset, EmailBrandSettings } from "../types";
import BrandColorField from "./BrandColorField";

interface Props {
  design: EmailBuilderDesign;
  brandSettings: EmailBrandSettings | null;
  emailAssets: CommunicationEmailAsset[];
  tenantId: string;
  canEdit: boolean;
  onChange: (design: EmailBuilderDesign) => void;
  onAssetUploaded?: (asset: CommunicationEmailAsset) => void;
  onInteract?: () => void;
}

const BLOCK_LABELS: Record<EmailBuilderBlock["type"], string> = {
  header: "Header",
  hero: "Hero",
  story: "Story / Text",
  highlight: "Highlight / List",
  cta: "CTA / Offer",
  image: "Image",
  divider: "Divider",
};

function newId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

function createBlock(type: EmailBuilderBlock["type"], brand: EmailBrandSettings | null): EmailBuilderBlock {
  const id = newId();
  switch (type) {
    case "header":
      return {
        id, type,
        logoUrl: brand?.logo_url ?? "",
        logoWidth: brand?.logo_width ?? 180,
        tagline: "",
        alignment: "center",
        backgroundColor: brand?.primary_color ?? "#1a56db",
        taglineColor: brand?.button_text_color ?? "#ffffff",
        taglineSize: 13,
        taglineFontRole: "body" as const,
      };
    case "hero":
      return {
        id, type,
        eyebrow: "",
        headline: "",
        subtitle: "",
        backgroundColor: brand?.primary_color ?? "#1a56db",
        textColor: brand?.button_text_color ?? "#ffffff",
        alignment: "center",
        paddingY: 32,
        headlineSize: 28,
        subtitleSize: 16,
        eyebrowColor: brand?.button_text_color ?? "#ffffff",
        eyebrowSize: 11,
        eyebrowUppercase: true,
        eyebrowFontRole: "body",
        headlineColor: brand?.button_text_color ?? "#ffffff",
        headlineFontRole: "heading",
        subtitleColor: brand?.button_text_color ?? "#ffffff",
        subtitleFontRole: "body",
      };
    case "story":
      return {
        id, type,
        content: "",
        backgroundColor: "#ffffff",
        textColor: brand?.text_color ?? "#111827",
        textSize: 15,
        fontRole: "body",
        alignment: "left",
        paddingY: 28,
      };
    case "highlight":
      return {
        id, type,
        variant: "callout",
        heading: "",
        body: "",
        items: [],
        backgroundColor: brand?.accent_color ?? "#e8f0fe",
        accentColor: brand?.primary_color ?? "#1a56db",
        textColor: brand?.text_color ?? "#111827",
        headingSize: 18,
        bodySize: 15,
        headingFontRole: "heading",
        bodyFontRole: "body",
        alignment: "left",
        paddingY: 24,
      };
    case "cta":
      return {
        id, type,
        variant: "button",
        heading: "",
        body: "",
        buttonText: "Donate Now",
        buttonUrl: brand?.default_donation_url ?? "",
        amount: "",
        items: [],
        backgroundColor: "#ffffff",
        accentColor: brand?.accent_color ?? "#e8f0fe",
        textColor: brand?.text_color ?? "#111827",
        buttonColor: brand?.button_color || brand?.primary_color || "#1a56db",
        buttonTextColor: brand?.button_text_color ?? "#ffffff",
        headingSize: 18,
        bodySize: 14,
        headingFontRole: "heading",
        bodyFontRole: "body",
        alignment: "center",
        paddingY: 24,
      };
    case "image":
      return {
        id, type,
        layout: "one",
        images: [],
        singleImageSize: "large",
        borderStyle: "none",
        borderColor: brand?.accent_color ?? "#e5e7eb",
        roundedCorners: "small",
        paddingY: 24,
        paddingX: 0,
        backgroundColor: "#ffffff",
      };
    case "divider":
      return {
        id, type,
        lineStyle: "solid",
        lineColor: brand?.accent_color ?? "#e5e7eb",
        backgroundColor: "#ffffff",
        lineWidth: "full",
        alignment: "center",
        thickness: 1,
        paddingY: 16,
      };
  }
}

// ---------------------------------------------------------------------------
// Sub-editors per block type
// ---------------------------------------------------------------------------

function AlignSelect({ value, onChange, disabled }: { value: string; onChange: (v: string) => void; disabled: boolean }) {
  return (
    <select
      className="form-input"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      disabled={disabled}
      style={{ flex: 1 }}
    >
      <option value="left">Left</option>
      <option value="center">Center</option>
      <option value="right">Right</option>
    </select>
  );
}

function ItemsList({
  items,
  disabled,
  onChange,
}: {
  items: string[];
  disabled: boolean;
  onChange: (items: string[]) => void;
}) {
  return (
    <div className="form-group" style={{ margin: 0 }}>
      <label className="form-label">Items</label>
      <div style={{ display: "grid", gap: 6 }}>
        {items.map((item, idx) => (
          <div key={idx} style={{ display: "flex", gap: 6 }}>
            <input
              type="text"
              className="form-input"
              value={item}
              onChange={(e) => {
                const next = [...items];
                next[idx] = e.target.value;
                onChange(next);
              }}
              disabled={disabled}
              placeholder={`Item ${idx + 1}`}
              style={{ flex: 1 }}
            />
            {!disabled && (
              <button
                type="button"
                className="btn btn-ghost"
                style={{ padding: "4px 10px", fontSize: 13 }}
                onClick={() => onChange(items.filter((_, i) => i !== idx))}
              >
                ×
              </button>
            )}
          </div>
        ))}
        {!disabled && (
          <button
            type="button"
            className="btn btn-ghost"
            style={{ fontSize: 12, padding: "4px 10px", alignSelf: "flex-start" }}
            onClick={() => onChange([...items, ""])}
          >
            + Add item
          </button>
        )}
      </div>
    </div>
  );
}

const UPLOAD_ALLOWED_MIME = new Set(["image/jpeg", "image/png", "image/gif", "image/webp"]);
const UPLOAD_ALLOWED_EXT = new Set(["jpg", "jpeg", "png", "gif", "webp"]);

function validateLogoFile(file: File): string | null {
  if (file.size > 5 * 1024 * 1024) return "File exceeds the 5 MB limit.";
  const mime = file.type.toLowerCase().trim();
  if (!mime || !UPLOAD_ALLOWED_MIME.has(mime)) return "Only JPEG, PNG, GIF, and WebP images are allowed.";
  const ext = (file.name ?? "").split(".").pop()?.toLowerCase() ?? "";
  if (!UPLOAD_ALLOWED_EXT.has(ext)) return `Extension .${ext || "(none)"} is not allowed.`;
  return null;
}

function HeaderEditor({
  block,
  brandSettings,
  emailAssets,
  tenantId,
  disabled,
  onPatch,
  onAssetUploaded,
}: {
  block: HeaderBlock;
  brandSettings: EmailBrandSettings | null;
  emailAssets: CommunicationEmailAsset[];
  tenantId: string;
  disabled: boolean;
  onPatch: (patch: Partial<HeaderBlock>) => void;
  onAssetUploaded?: (asset: CommunicationEmailAsset) => void;
}) {
  const [pickingUploadedAsset, setPickingUploadedAsset] = useState(false);
  const uploadFileRef = useRef<HTMLInputElement>(null);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0] ?? null;
    setUploadFile(file);
    setUploadError(file ? (validateLogoFile(file) ?? null) : null);
  }

  async function handleUpload() {
    if (!uploadFile || !tenantId) return;
    const err = validateLogoFile(uploadFile);
    if (err) { setUploadError(err); return; }
    setUploading(true);
    setUploadError(null);
    try {
      const fd = new FormData();
      fd.append("tenantId", tenantId);
      fd.append("file", uploadFile);
      fd.append("asset_type", "logo");
      fd.append("alt_text", uploadFile.name);
      const res = await fetch("/api/communications/assets/upload", { method: "POST", body: fd });
      const data = await res.json();
      if (!data.ok || !data.asset) {
        setUploadError(data.error ?? "Upload failed.");
        return;
      }
      const a = data.asset;
      const newAsset: CommunicationEmailAsset = {
        id: a.id,
        tenant_id: tenantId,
        asset_type: a.asset_type,
        file_name: a.file_name,
        original_file_name: a.original_file_name ?? null,
        public_url: a.public_url,
        mime_type: a.mime_type,
        file_size_bytes: a.file_size_bytes,
        width: a.width ?? null,
        height: a.height ?? null,
        alt_text: a.alt_text ?? null,
        created_at: a.created_at,
        updated_at: a.created_at,
      };
      const newWidth = block.logoWidth > 0
        ? block.logoWidth
        : newAsset.width
          ? Math.min(newAsset.width, 240)
          : 180;
      onPatch({ logoUrl: newAsset.public_url, logoWidth: newWidth });
      onAssetUploaded?.(newAsset);
      setPickingUploadedAsset(false);
      setUploadFile(null);
      if (uploadFileRef.current) uploadFileRef.current.value = "";
    } catch {
      setUploadError("Network error. Please try again.");
    } finally {
      setUploading(false);
    }
  }

  const imageAssets = emailAssets.filter((a) => a.mime_type.startsWith("image/"));
  const sortedImageAssets = [
    ...imageAssets.filter((a) => a.asset_type === "logo"),
    ...imageAssets.filter((a) => a.asset_type !== "logo"),
  ];

  const matchedAsset = block.logoUrl
    ? emailAssets.find((a) => a.public_url === block.logoUrl) ?? null
    : null;
  const assetName = matchedAsset
    ? (matchedAsset.original_file_name ?? matchedAsset.file_name)
    : null;
  const isPrimaryLogo =
    !!block.logoUrl &&
    !!brandSettings?.logo_url &&
    block.logoUrl === brandSettings.logo_url;
  const isUploadedAsset = !!block.logoUrl && !isPrimaryLogo && !!matchedAsset;
  const isSavedCampaign = !!block.logoUrl && !isPrimaryLogo && !matchedAsset;

  const appliedSource = !block.logoUrl
    ? "none"
    : isPrimaryLogo
      ? "brand-kit"
      : isUploadedAsset
        ? "uploaded-asset"
        : "saved-campaign";

  const selectValue = pickingUploadedAsset ? "uploaded-asset" : appliedSource;
  const showAssetDropdown = isUploadedAsset || pickingUploadedAsset;

  function handleSourceChange(val: string) {
    if (val === "brand-kit") {
      onPatch({
        logoUrl: brandSettings?.logo_url || "",
        logoWidth: brandSettings?.logo_width || block.logoWidth || 180,
      });
      setPickingUploadedAsset(false);
    } else if (val === "none") {
      onPatch({ logoUrl: "" });
      setPickingUploadedAsset(false);
    } else if (val === "uploaded-asset") {
      setPickingUploadedAsset(true);
    }
  }

  return (
    <div style={{ display: "grid", gap: 12 }}>
      {/* ── Header Background Color ── */}
      <BrandColorField
        label="Header Background Color"
        value={block.backgroundColor}
        onChange={(v) => onPatch({ backgroundColor: v })}
        disabled={disabled}
        placeholder="#1a56db"
        brandSettings={brandSettings}
        helper="Sets the header band color."
      />

      {/* ── Logo Source ── */}
      <div className="form-group" style={{ margin: 0 }}>
        <label className="form-label">Logo Source</label>
        <select
          className="form-input"
          value={selectValue}
          onChange={(e) => handleSourceChange(e.target.value)}
          disabled={disabled}
        >
          {isSavedCampaign && (
            <option value="saved-campaign" disabled>
              Saved Campaign Logo
            </option>
          )}
          <option value="brand-kit" disabled={!brandSettings?.logo_url}>
            Use Brand Kit Logo
          </option>
          <option value="uploaded-asset">Choose Uploaded Asset</option>
          <option value="none">No Logo</option>
        </select>
        {isSavedCampaign && (
          <div className="form-helper">
            This logo was saved to the campaign but is no longer in your uploaded assets. Switch source to replace it.
          </div>
        )}
      </div>

      {/* ── Asset picker ── visible when source is Choose Uploaded Asset */}
      {showAssetDropdown && (
        <div style={{ display: "grid", gap: 8 }}>
          {/* Existing asset selector */}
          {sortedImageAssets.length === 0 ? (
            <div style={{ fontSize: 12, color: "#6b7280" }}>No logo assets uploaded yet.</div>
          ) : (
            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label">Select Asset</label>
              <select
                className="form-input"
                value={block.logoUrl || ""}
                onChange={(e) => {
                  if (e.target.value) {
                    onPatch({ logoUrl: e.target.value });
                    setPickingUploadedAsset(false);
                  }
                }}
                disabled={disabled}
              >
                {pickingUploadedAsset && !isUploadedAsset && (
                  <option value="">— Choose an asset —</option>
                )}
                {sortedImageAssets.map((a) => (
                  <option key={a.id} value={a.public_url}>
                    {a.asset_type === "logo" ? "[Logo] " : ""}
                    {a.original_file_name ?? a.file_name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Upload new logo */}
          {!disabled && (
            <div style={{ display: "grid", gap: 6, paddingTop: 4, borderTop: "1px solid #f3f4f6" }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                Upload New Logo
              </div>
              <input
                ref={uploadFileRef}
                type="file"
                accept="image/jpeg,image/png,image/gif,image/webp"
                style={{ display: "none" }}
                onChange={handleFileSelect}
                disabled={uploading}
              />
              <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                <button
                  type="button"
                  className="btn btn-ghost"
                  style={{ fontSize: 12, padding: "4px 10px", whiteSpace: "nowrap" }}
                  onClick={() => uploadFileRef.current?.click()}
                  disabled={uploading}
                >
                  Choose File
                </button>
                {uploadFile && (
                  <span style={{ fontSize: 12, color: "#374151", wordBreak: "break-word", flex: 1, minWidth: 0 }}>
                    {uploadFile.name}
                  </span>
                )}
                {uploadFile && !uploadError && (
                  <button
                    type="button"
                    className="btn btn-primary"
                    style={{ fontSize: 12, padding: "4px 10px", whiteSpace: "nowrap", flexShrink: 0 }}
                    onClick={handleUpload}
                    disabled={uploading}
                  >
                    {uploading ? "Uploading…" : "Upload"}
                  </button>
                )}
              </div>
              <div className="form-helper">JPEG, PNG, GIF, or WebP · max 5 MB</div>
              {uploadError && (
                <div className="form-error" style={{ fontSize: 12 }}>{uploadError}</div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── Logo preview ── checkerboard + identity + width */}
      <div className="form-group" style={{ margin: 0 }}>
        <label className="form-label">Logo</label>
        <div style={{ display: "grid", gridTemplateColumns: "120px 1fr 120px", gap: 12, alignItems: "start" }}>
          {/* Checkerboard box — makes white/transparent logos visible */}
          <div
            style={{
              width: 120,
              height: 64,
              border: "1px solid #d1d5db",
              borderRadius: 6,
              overflow: "hidden",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
              backgroundColor: "#e5e7eb",
              backgroundImage: [
                "linear-gradient(45deg, #d1d5db 25%, transparent 25%)",
                "linear-gradient(-45deg, #d1d5db 25%, transparent 25%)",
                "linear-gradient(45deg, transparent 75%, #d1d5db 75%)",
                "linear-gradient(-45deg, transparent 75%, #d1d5db 75%)",
              ].join(", "),
              backgroundSize: "12px 12px",
              backgroundPosition: "0 0, 0 6px, 6px -6px, -6px 0px",
            }}
          >
            {block.logoUrl ? (
              <img
                src={block.logoUrl}
                alt="Logo preview"
                style={{ maxWidth: "100%", maxHeight: "100%", objectFit: "contain", display: "block" }}
                onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
              />
            ) : (
              <span style={{ fontSize: 11, color: "#9ca3af", textAlign: "center", padding: 6 }}>No logo</span>
            )}
          </div>
          {/* Identity panel */}
          <div style={{ display: "grid", gap: 4, paddingTop: 2 }}>
            {block.logoUrl ? (
              <>
                <span
                  style={{
                    display: "inline-block",
                    width: "fit-content",
                    fontSize: 10,
                    fontWeight: 700,
                    background: isPrimaryLogo ? "#dcfce7" : isSavedCampaign ? "#fef3c7" : "#dbeafe",
                    color: isPrimaryLogo ? "#166534" : isSavedCampaign ? "#92400e" : "#1d4ed8",
                    borderRadius: 9999,
                    padding: "1px 8px",
                    letterSpacing: "0.02em",
                  }}
                >
                  {isPrimaryLogo ? "✓ Primary Logo" : isSavedCampaign ? "Saved Campaign Logo" : "Campaign Logo"}
                </span>
                <span style={{ fontSize: 13, fontWeight: 600, color: "#111827", lineHeight: 1.3 }}>
                  {assetName ?? "Saved campaign logo"}
                </span>
              </>
            ) : (
              <span style={{ fontSize: 12, color: "#9ca3af" }}>No logo selected</span>
            )}
          </div>
          {/* Logo width */}
          <div className="form-group" style={{ margin: 0 }}>
            <label className="form-label">Logo Width (px)</label>
            <input
              type="number"
              className="form-input"
              value={block.logoWidth}
              onChange={(e) => onPatch({ logoWidth: Number(e.target.value) || 180 })}
              disabled={disabled}
              min={40}
              max={600}
            />
          </div>
        </div>
      </div>

      {/* ── Tagline ── text, alignment, and offset together */}
      <div className="form-group" style={{ margin: 0 }}>
        <label className="form-label">Tagline</label>
        <input
          type="text"
          className="form-input"
          value={block.tagline}
          onChange={(e) => onPatch({ tagline: e.target.value })}
          disabled={disabled}
          placeholder="Optional tagline below the logo"
        />
      </div>

      {/* ── Tagline Style ── color | size | font */}
      <BrandColorField
        label="Tagline Color"
        value={block.taglineColor ?? ""}
        onChange={(v) => onPatch({ taglineColor: v })}
        disabled={disabled}
        placeholder="#ffffff"
        brandSettings={brandSettings}
      />
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "flex-end" }}>
        <div className="form-group" style={{ margin: 0, flex: "0 0 56px" }}>
          <label className="form-label">Size</label>
          <input
            type="number"
            className="form-input"
            value={block.taglineSize ?? 13}
            min={10}
            max={24}
            step={1}
            onChange={(e) => onPatch({ taglineSize: Number(e.target.value) })}
            disabled={disabled}
          />
        </div>
        <div className="form-group" style={{ margin: 0, flex: "1 1 90px", minWidth: 90 }}>
          <label className="form-label">Font</label>
          <select
            className="form-input"
            value={block.taglineFontRole ?? "body"}
            onChange={(e) => onPatch({ taglineFontRole: e.target.value as HeaderBlock["taglineFontRole"] })}
            disabled={disabled}
          >
            <option value="body">Body</option>
            <option value="heading">Heading</option>
          </select>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, alignItems: "start" }}>
        <div className="form-group" style={{ margin: 0 }}>
          <label className="form-label">Alignment</label>
          <AlignSelect
            value={block.alignment}
            onChange={(v) => onPatch({ alignment: v as HeaderBlock["alignment"] })}
            disabled={disabled}
          />
        </div>
        <div className="form-group" style={{ margin: 0 }}>
          <label className="form-label">Tagline Offset (px)</label>
          <input
            type="number"
            className="form-input"
            value={block.taglineOffset ?? 0}
            onChange={(e) => onPatch({ taglineOffset: Math.max(0, Number(e.target.value) || 0) })}
            disabled={disabled || block.alignment === "center"}
            min={0}
            max={200}
            step={5}
          />
          <div className="form-helper">Nudges the tagline when alignment is Left or Right.</div>
        </div>
      </div>
    </div>
  );
}

function HeroEditor({
  block,
  brandSettings,
  disabled,
  onPatch,
}: {
  block: HeroBlock;
  brandSettings: EmailBrandSettings | null;
  disabled: boolean;
  onPatch: (patch: Partial<HeroBlock>) => void;
}) {
  return (
    <div style={{ display: "grid", gap: 12 }}>
      {/* A. Hero Background Color */}
      <BrandColorField
        label="Hero Background Color"
        value={block.backgroundColor}
        onChange={(v) => onPatch({ backgroundColor: v })}
        disabled={disabled}
        placeholder="#1a56db"
        brandSettings={brandSettings}
      />

      {/* B. Eyebrow */}
      <div className="form-group" style={{ margin: 0 }}>
        <label className="form-label">Eyebrow</label>
        <input
          type="text"
          className="form-input"
          value={block.eyebrow}
          onChange={(e) => onPatch({ eyebrow: e.target.value })}
          disabled={disabled}
          placeholder="MINISTRY UPDATE — MAY 2026"
        />
      </div>
      <BrandColorField
        label="Eyebrow Color"
        value={block.eyebrowColor ?? ""}
        onChange={(v) => onPatch({ eyebrowColor: v })}
        disabled={disabled}
        placeholder={block.textColor || "#ffffff"}
        brandSettings={brandSettings}
      />
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "flex-end" }}>
        <div className="form-group" style={{ margin: 0, flex: "0 0 56px" }}>
          <label className="form-label">Size</label>
          <input
            type="number"
            className="form-input"
            value={block.eyebrowSize ?? 11}
            min={9}
            max={18}
            step={1}
            onChange={(e) => onPatch({ eyebrowSize: Number(e.target.value) })}
            disabled={disabled}
          />
        </div>
        <div className="form-group" style={{ margin: 0, flex: "1 1 90px", minWidth: 90 }}>
          <label className="form-label">Font</label>
          <select
            className="form-input"
            value={block.eyebrowFontRole ?? "body"}
            onChange={(e) => onPatch({ eyebrowFontRole: e.target.value as "heading" | "body" })}
            disabled={disabled}
          >
            <option value="body">Body</option>
            <option value="heading">Heading</option>
          </select>
        </div>
        <div className="form-group" style={{ margin: 0, flex: "0 0 auto" }}>
          <label className="form-label">Uppercase</label>
          <label style={{ display: "flex", alignItems: "center", gap: 6, cursor: disabled ? "default" : "pointer", paddingTop: 6 }}>
            <input
              type="checkbox"
              checked={block.eyebrowUppercase !== false}
              onChange={(e) => onPatch({ eyebrowUppercase: e.target.checked })}
              disabled={disabled}
              style={{ width: 16, height: 16, flexShrink: 0 }}
            />
            <span style={{ fontSize: 12, color: "#374151" }}>On</span>
          </label>
        </div>
      </div>

      {/* C. Headline */}
      <div className="form-group" style={{ margin: 0 }}>
        <label className="form-label">Headline</label>
        <input
          type="text"
          className="form-input"
          value={block.headline}
          onChange={(e) => onPatch({ headline: e.target.value })}
          disabled={disabled}
          placeholder="God is moving in Honduras"
        />
      </div>
      <BrandColorField
        label="Headline Color"
        value={block.headlineColor ?? ""}
        onChange={(v) => onPatch({ headlineColor: v })}
        disabled={disabled}
        placeholder={block.textColor || "#ffffff"}
        brandSettings={brandSettings}
      />
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "flex-end" }}>
        <div className="form-group" style={{ margin: 0, flex: "0 0 56px" }}>
          <label className="form-label">Size</label>
          <input
            type="number"
            className="form-input"
            value={block.headlineSize ?? 28}
            min={20}
            max={56}
            step={2}
            onChange={(e) => onPatch({ headlineSize: Number(e.target.value) })}
            disabled={disabled}
          />
        </div>
        <div className="form-group" style={{ margin: 0, flex: "1 1 90px", minWidth: 90 }}>
          <label className="form-label">Font</label>
          <select
            className="form-input"
            value={block.headlineFontRole ?? "heading"}
            onChange={(e) => onPatch({ headlineFontRole: e.target.value as "heading" | "body" })}
            disabled={disabled}
          >
            <option value="heading">Heading</option>
            <option value="body">Body</option>
          </select>
        </div>
      </div>

      {/* D. Subtitle */}
      <div className="form-group" style={{ margin: 0 }}>
        <label className="form-label">Subtitle</label>
        <textarea
          className="form-textarea"
          rows={2}
          value={block.subtitle}
          onChange={(e) => onPatch({ subtitle: e.target.value })}
          disabled={disabled}
          placeholder="A short description or lead sentence."
        />
      </div>
      <BrandColorField
        label="Subtitle Color"
        value={block.subtitleColor ?? ""}
        onChange={(v) => onPatch({ subtitleColor: v })}
        disabled={disabled}
        placeholder={block.textColor || "#ffffff"}
        brandSettings={brandSettings}
      />
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "flex-end" }}>
        <div className="form-group" style={{ margin: 0, flex: "0 0 56px" }}>
          <label className="form-label">Size</label>
          <input
            type="number"
            className="form-input"
            value={block.subtitleSize ?? 16}
            min={12}
            max={32}
            step={1}
            onChange={(e) => onPatch({ subtitleSize: Number(e.target.value) })}
            disabled={disabled}
          />
        </div>
        <div className="form-group" style={{ margin: 0, flex: "1 1 90px", minWidth: 90 }}>
          <label className="form-label">Font</label>
          <select
            className="form-input"
            value={block.subtitleFontRole ?? "body"}
            onChange={(e) => onPatch({ subtitleFontRole: e.target.value as "heading" | "body" })}
            disabled={disabled}
          >
            <option value="body">Body</option>
            <option value="heading">Heading</option>
          </select>
        </div>
      </div>

      {/* E. Hero Layout */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, alignItems: "start" }}>
        <div className="form-group" style={{ margin: 0 }}>
          <label className="form-label">Vertical Padding (px)</label>
          <input
            type="number"
            className="form-input"
            value={block.paddingY ?? 40}
            min={16}
            max={80}
            step={4}
            onChange={(e) => onPatch({ paddingY: Number(e.target.value) })}
            disabled={disabled}
          />
        </div>
        <div className="form-group" style={{ margin: 0 }}>
          <label className="form-label">Alignment</label>
          <AlignSelect
            value={block.alignment}
            onChange={(v) => onPatch({ alignment: v as HeroBlock["alignment"] })}
            disabled={disabled}
          />
        </div>
      </div>
    </div>
  );
}

function StoryEditor({
  block,
  brandSettings,
  disabled,
  onPatch,
}: {
  block: StoryBlock;
  brandSettings: EmailBrandSettings | null;
  disabled: boolean;
  onPatch: (patch: Partial<StoryBlock>) => void;
}) {
  return (
    <div style={{ display: "grid", gap: 12 }}>
      {/* A. Story Background Color */}
      <BrandColorField
        label="Story Background Color"
        value={block.backgroundColor ?? ""}
        onChange={(v) => onPatch({ backgroundColor: v })}
        disabled={disabled}
        placeholder="#ffffff"
        brandSettings={brandSettings}
        helper="Sets the story block background."
      />

      {/* B. Content */}
      <div className="form-group" style={{ margin: 0 }}>
        <label className="form-label">Content</label>
        <textarea
          className="form-textarea"
          rows={7}
          value={block.content}
          onChange={(e) => onPatch({ content: e.target.value })}
          disabled={disabled}
          placeholder="Write your story content here. Double line breaks create new paragraphs."
        />
        <div className="form-helper">Double line breaks become paragraphs. Single line breaks become &lt;br&gt;.</div>
      </div>

      {/* C. Text Style */}
      <BrandColorField
        label="Text Color"
        value={block.textColor ?? ""}
        onChange={(v) => onPatch({ textColor: v })}
        disabled={disabled}
        placeholder="#111827"
        brandSettings={brandSettings}
      />
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "flex-end" }}>
        <div className="form-group" style={{ margin: 0, flex: "0 0 56px" }}>
          <label className="form-label">Size</label>
          <input
            type="number"
            className="form-input"
            value={block.textSize ?? 15}
            min={12}
            max={24}
            step={1}
            onChange={(e) => onPatch({ textSize: Number(e.target.value) })}
            disabled={disabled}
          />
        </div>
        <div className="form-group" style={{ margin: 0, flex: "1 1 90px", minWidth: 90 }}>
          <label className="form-label">Font</label>
          <select
            className="form-input"
            value={block.fontRole ?? "body"}
            onChange={(e) => onPatch({ fontRole: e.target.value as "heading" | "body" })}
            disabled={disabled}
          >
            <option value="body">Body</option>
            <option value="heading">Heading</option>
          </select>
        </div>
        <div className="form-group" style={{ margin: 0, flex: "1 1 90px", minWidth: 90 }}>
          <label className="form-label">Alignment</label>
          <AlignSelect
            value={block.alignment ?? "left"}
            onChange={(v) => onPatch({ alignment: v as StoryBlock["alignment"] })}
            disabled={disabled}
          />
        </div>
      </div>

      {/* D. Spacing */}
      <div className="form-group" style={{ margin: 0 }}>
        <label className="form-label">Vertical Padding (px)</label>
        <input
          type="number"
          className="form-input"
          value={block.paddingY ?? 24}
          min={12}
          max={64}
          step={4}
          onChange={(e) => onPatch({ paddingY: Number(e.target.value) })}
          disabled={disabled}
          style={{ maxWidth: 100 }}
        />
        <div className="form-helper">Adds space above and below the story text.</div>
      </div>
    </div>
  );
}

function HighlightEditor({
  block,
  brandSettings,
  disabled,
  onPatch,
}: {
  block: HighlightBlock;
  brandSettings: EmailBrandSettings | null;
  disabled: boolean;
  onPatch: (patch: Partial<HighlightBlock>) => void;
}) {
  return (
    <div style={{ display: "grid", gap: 12 }}>
      {/* A. Highlight Style */}
      <BrandColorField
        label="Background Color"
        value={block.backgroundColor ?? ""}
        onChange={(v) => onPatch({ backgroundColor: v })}
        disabled={disabled}
        placeholder="#e8f0fe"
        brandSettings={brandSettings}
      />
      <BrandColorField
        label="Accent Color"
        value={block.accentColor ?? ""}
        onChange={(v) => onPatch({ accentColor: v })}
        disabled={disabled}
        placeholder="#1a56db"
        brandSettings={brandSettings}
      />
      <BrandColorField
        label="Text Color"
        value={block.textColor ?? ""}
        onChange={(v) => onPatch({ textColor: v })}
        disabled={disabled}
        placeholder="#111827"
        brandSettings={brandSettings}
      />

      {/* B. Content */}
      <div className="form-group" style={{ margin: 0 }}>
        <label className="form-label">Variant</label>
        <select
          className="form-input"
          value={block.variant}
          onChange={(e) => onPatch({ variant: e.target.value as HighlightBlock["variant"] })}
          disabled={disabled}
        >
          <option value="quote">Quote — accented left-border callout</option>
          <option value="callout">Callout — accent background box</option>
          <option value="list">List — heading, body, bullet items</option>
        </select>
      </div>
      <div className="form-group" style={{ margin: 0 }}>
        <label className="form-label">Heading</label>
        <input
          type="text"
          className="form-input"
          value={block.heading}
          onChange={(e) => onPatch({ heading: e.target.value })}
          disabled={disabled}
          placeholder="Section heading or quote source"
        />
      </div>
      <div className="form-group" style={{ margin: 0 }}>
        <label className="form-label">Body</label>
        <textarea
          className="form-textarea"
          rows={3}
          value={block.body}
          onChange={(e) => onPatch({ body: e.target.value })}
          disabled={disabled}
          placeholder="Main content, quote text, or callout body."
        />
      </div>
      {(block.variant === "callout" || block.variant === "list") && (
        <ItemsList
          items={block.items}
          disabled={disabled}
          onChange={(items) => onPatch({ items })}
        />
      )}

      {/* C. Text Style */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "flex-end" }}>
        <div className="form-group" style={{ margin: 0, flex: "0 0 64px" }}>
          <label className="form-label">H. Size</label>
          <input
            type="number"
            className="form-input"
            value={block.headingSize ?? 18}
            min={14}
            max={32}
            step={1}
            onChange={(e) => onPatch({ headingSize: Number(e.target.value) })}
            disabled={disabled}
          />
        </div>
        <div className="form-group" style={{ margin: 0, flex: "1 1 90px", minWidth: 90 }}>
          <label className="form-label">H. Font</label>
          <select
            className="form-input"
            value={block.headingFontRole ?? "heading"}
            onChange={(e) => onPatch({ headingFontRole: e.target.value as "heading" | "body" })}
            disabled={disabled}
          >
            <option value="heading">Heading</option>
            <option value="body">Body</option>
          </select>
        </div>
        <div className="form-group" style={{ margin: 0, flex: "0 0 64px" }}>
          <label className="form-label">B. Size</label>
          <input
            type="number"
            className="form-input"
            value={block.bodySize ?? 15}
            min={12}
            max={24}
            step={1}
            onChange={(e) => onPatch({ bodySize: Number(e.target.value) })}
            disabled={disabled}
          />
        </div>
        <div className="form-group" style={{ margin: 0, flex: "1 1 90px", minWidth: 90 }}>
          <label className="form-label">B. Font</label>
          <select
            className="form-input"
            value={block.bodyFontRole ?? "body"}
            onChange={(e) => onPatch({ bodyFontRole: e.target.value as "heading" | "body" })}
            disabled={disabled}
          >
            <option value="body">Body</option>
            <option value="heading">Heading</option>
          </select>
        </div>
        <div className="form-group" style={{ margin: 0, flex: "1 1 90px", minWidth: 90 }}>
          <label className="form-label">Alignment</label>
          <AlignSelect
            value={block.alignment ?? "left"}
            onChange={(v) => onPatch({ alignment: v as HighlightBlock["alignment"] })}
            disabled={disabled}
          />
        </div>
      </div>

      {/* D. Spacing */}
      <div className="form-group" style={{ margin: 0 }}>
        <label className="form-label">Vertical Padding (px)</label>
        <input
          type="number"
          className="form-input"
          value={block.paddingY ?? 24}
          min={12}
          max={64}
          step={4}
          onChange={(e) => onPatch({ paddingY: Number(e.target.value) })}
          disabled={disabled}
          style={{ maxWidth: 100 }}
        />
        <div className="form-helper">Adds space above and below the highlight content.</div>
      </div>
    </div>
  );
}

function CtaEditor({
  block,
  brandSettings,
  disabled,
  onPatch,
}: {
  block: CtaBlock;
  brandSettings: EmailBrandSettings | null;
  disabled: boolean;
  onPatch: (patch: Partial<CtaBlock>) => void;
}) {
  return (
    <div style={{ display: "grid", gap: 12 }}>
      {/* A. CTA Style */}
      <BrandColorField
        label="Background Color"
        value={block.backgroundColor ?? ""}
        onChange={(v) => onPatch({ backgroundColor: v })}
        disabled={disabled}
        placeholder="#ffffff"
        brandSettings={brandSettings}
      />
      <BrandColorField
        label="Accent / Panel Color"
        value={block.accentColor ?? ""}
        onChange={(v) => onPatch({ accentColor: v })}
        disabled={disabled}
        placeholder="#e8f0fe"
        brandSettings={brandSettings}
      />
      <BrandColorField
        label="Text Color"
        value={block.textColor ?? ""}
        onChange={(v) => onPatch({ textColor: v })}
        disabled={disabled}
        placeholder="#111827"
        brandSettings={brandSettings}
      />
      <BrandColorField
        label="Button Color"
        value={block.buttonColor ?? ""}
        onChange={(v) => onPatch({ buttonColor: v })}
        disabled={disabled}
        placeholder="#1a56db"
        brandSettings={brandSettings}
      />
      <BrandColorField
        label="Button Text Color"
        value={block.buttonTextColor ?? ""}
        onChange={(v) => onPatch({ buttonTextColor: v })}
        disabled={disabled}
        placeholder="#ffffff"
        brandSettings={brandSettings}
      />

      {/* B. Content */}
      <div className="form-group" style={{ margin: 0 }}>
        <label className="form-label">Variant</label>
        <select className="form-input" value={block.variant} onChange={(e) => onPatch({ variant: e.target.value as CtaBlock["variant"] })} disabled={disabled}>
          <option value="button">Button — centered heading and CTA button</option>
          <option value="panel">Panel — accent background with heading and button</option>
          <option value="offer">Offer — large amount display with donation button</option>
        </select>
      </div>
      <div className="form-group" style={{ margin: 0 }}>
        <label className="form-label">Heading</label>
        <input type="text" className="form-input" value={block.heading} onChange={(e) => onPatch({ heading: e.target.value })} disabled={disabled} placeholder="Support WellSpring this month" />
      </div>
      <div className="form-group" style={{ margin: 0 }}>
        <label className="form-label">Body</label>
        <textarea className="form-textarea" rows={2} value={block.body} onChange={(e) => onPatch({ body: e.target.value })} disabled={disabled} placeholder="Brief supporting text." />
      </div>
      {block.variant === "offer" && (
        <div className="form-group" style={{ margin: 0 }}>
          <label className="form-label">Amount</label>
          <input type="text" className="form-input" value={block.amount} onChange={(e) => onPatch({ amount: e.target.value })} disabled={disabled} placeholder="$50 / month" />
        </div>
      )}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <div className="form-group" style={{ margin: 0 }}>
          <label className="form-label">Button Text</label>
          <input type="text" className="form-input" value={block.buttonText} onChange={(e) => onPatch({ buttonText: e.target.value })} disabled={disabled} placeholder="Donate Now" />
        </div>
        <div className="form-group" style={{ margin: 0 }}>
          <label className="form-label">Button URL</label>
          <input type="text" className="form-input" value={block.buttonUrl} onChange={(e) => onPatch({ buttonUrl: e.target.value })} disabled={disabled} placeholder="https://…" />
          <div className="form-helper">Defaults to Brand Kit donation URL if blank.</div>
        </div>
      </div>
      {(block.variant === "panel" || block.variant === "offer") && (
        <ItemsList items={block.items} disabled={disabled} onChange={(items) => onPatch({ items })} />
      )}

      {/* C. Text Style */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "flex-end" }}>
        <div className="form-group" style={{ margin: 0, flex: "0 0 64px" }}>
          <label className="form-label">H. Size</label>
          <input type="number" className="form-input" value={block.headingSize ?? 18} min={14} max={36} step={1} onChange={(e) => onPatch({ headingSize: Number(e.target.value) })} disabled={disabled} />
        </div>
        <div className="form-group" style={{ margin: 0, flex: "1 1 90px", minWidth: 90 }}>
          <label className="form-label">H. Font</label>
          <select className="form-input" value={block.headingFontRole ?? "heading"} onChange={(e) => onPatch({ headingFontRole: e.target.value as "heading" | "body" })} disabled={disabled}>
            <option value="heading">Heading</option>
            <option value="body">Body</option>
          </select>
        </div>
        <div className="form-group" style={{ margin: 0, flex: "0 0 64px" }}>
          <label className="form-label">B. Size</label>
          <input type="number" className="form-input" value={block.bodySize ?? 14} min={12} max={24} step={1} onChange={(e) => onPatch({ bodySize: Number(e.target.value) })} disabled={disabled} />
        </div>
        <div className="form-group" style={{ margin: 0, flex: "1 1 90px", minWidth: 90 }}>
          <label className="form-label">B. Font</label>
          <select className="form-input" value={block.bodyFontRole ?? "body"} onChange={(e) => onPatch({ bodyFontRole: e.target.value as "heading" | "body" })} disabled={disabled}>
            <option value="body">Body</option>
            <option value="heading">Heading</option>
          </select>
        </div>
        <div className="form-group" style={{ margin: 0, flex: "1 1 90px", minWidth: 90 }}>
          <label className="form-label">Alignment</label>
          <AlignSelect value={block.alignment ?? "center"} onChange={(v) => onPatch({ alignment: v as CtaBlock["alignment"] })} disabled={disabled} />
        </div>
      </div>

      {/* D. Spacing */}
      <div className="form-group" style={{ margin: 0 }}>
        <label className="form-label">Vertical Padding (px)</label>
        <input type="number" className="form-input" value={block.paddingY ?? 24} min={12} max={72} step={4} onChange={(e) => onPatch({ paddingY: Number(e.target.value) })} disabled={disabled} style={{ maxWidth: 100 }} />
        <div className="form-helper">Adds space above and below the CTA content.</div>
      </div>
    </div>
  );
}

function ImageEditor({
  block,
  brandSettings,
  emailAssets,
  tenantId,
  disabled,
  onPatch,
  onAssetUploaded,
}: {
  block: ImageBlock;
  brandSettings: EmailBrandSettings | null;
  emailAssets: CommunicationEmailAsset[];
  tenantId: string;
  disabled: boolean;
  onPatch: (patch: Partial<ImageBlock>) => void;
  onAssetUploaded?: (asset: CommunicationEmailAsset) => void;
}) {
  const imageAssets = emailAssets.filter((a) => a.mime_type.startsWith("image/"));
  const layoutCount = block.layout === "two" ? 2 : block.layout === "three" ? 3 : 1;

  const slotUploadRefs = useRef<(HTMLInputElement | null)[]>([null, null, null]);
  const [slotUploading, setSlotUploading] = useState<Record<number, boolean>>({});
  const [slotError, setSlotError] = useState<Record<number, string | null>>({});

  function patchSlot(slotIdx: number, slotPatch: Partial<{ assetId: string; url: string; altText: string }>) {
    const newImages = [...(block.images || [])];
    while (newImages.length <= slotIdx) newImages.push({ url: "" });
    newImages[slotIdx] = { ...newImages[slotIdx], ...slotPatch };
    onPatch({ images: newImages });
  }

  function clearSlot(slotIdx: number) {
    const newImages = [...(block.images || [])];
    while (newImages.length <= slotIdx) newImages.push({ url: "" });
    newImages[slotIdx] = { url: "" };
    onPatch({ images: newImages });
  }

  async function handleSlotUpload(slotIdx: number, file: File) {
    const err = validateLogoFile(file);
    if (err) {
      setSlotError((prev) => ({ ...prev, [slotIdx]: err }));
      return;
    }
    setSlotError((prev) => ({ ...prev, [slotIdx]: null }));
    setSlotUploading((prev) => ({ ...prev, [slotIdx]: true }));
    try {
      const fd = new FormData();
      fd.append("tenantId", tenantId);
      fd.append("file", file);
      fd.append("asset_type", "body_image");
      fd.append("alt_text", file.name);
      const res = await fetch("/api/communications/assets/upload", { method: "POST", body: fd });
      const data = await res.json();
      if (!data.ok || !data.asset) {
        setSlotError((prev) => ({ ...prev, [slotIdx]: data.error ?? "Upload failed." }));
        return;
      }
      const a = data.asset;
      const newAsset: CommunicationEmailAsset = {
        id: a.id,
        tenant_id: tenantId,
        asset_type: a.asset_type,
        file_name: a.file_name,
        original_file_name: a.original_file_name ?? null,
        public_url: a.public_url,
        mime_type: a.mime_type,
        file_size_bytes: a.file_size_bytes,
        width: a.width ?? null,
        height: a.height ?? null,
        alt_text: a.alt_text ?? null,
        created_at: a.created_at,
        updated_at: a.created_at,
      };
      onAssetUploaded?.(newAsset);
      const currentSlot = block.images?.[slotIdx];
      patchSlot(slotIdx, {
        assetId: newAsset.id,
        url: newAsset.public_url,
        altText: currentSlot?.altText || newAsset.original_file_name || newAsset.file_name,
      });
      const inputEl = slotUploadRefs.current[slotIdx];
      if (inputEl) inputEl.value = "";
    } catch {
      setSlotError((prev) => ({ ...prev, [slotIdx]: "Network error. Please try again." }));
    } finally {
      setSlotUploading((prev) => ({ ...prev, [slotIdx]: false }));
    }
  }

  const checkerStyle: React.CSSProperties = {
    width: 56,
    height: 56,
    border: "1px solid #d1d5db",
    borderRadius: 6,
    overflow: "hidden",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
    backgroundColor: "#e5e7eb",
    backgroundImage: [
      "linear-gradient(45deg, #d1d5db 25%, transparent 25%)",
      "linear-gradient(-45deg, #d1d5db 25%, transparent 25%)",
      "linear-gradient(45deg, transparent 75%, #d1d5db 75%)",
      "linear-gradient(-45deg, transparent 75%, #d1d5db 75%)",
    ].join(", "),
    backgroundSize: "12px 12px",
    backgroundPosition: "0 0, 0 6px, 6px -6px, -6px 0px",
  };

  return (
    <div style={{ display: "grid", gap: 12 }}>
      {/* A. Image Layout */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "flex-end" }}>
        <div className="form-group" style={{ margin: 0, flex: "1 1 120px" }}>
          <label className="form-label">Image Layout</label>
          <select
            className="form-input"
            value={block.layout || "one"}
            onChange={(e) => onPatch({ layout: e.target.value as ImageBlock["layout"] })}
            disabled={disabled}
          >
            <option value="one">1 Image</option>
            <option value="two">2 Images</option>
            <option value="three">3 Images</option>
          </select>
        </div>
        {(block.layout || "one") === "one" && (
          <div className="form-group" style={{ margin: 0, flex: "1 1 120px" }}>
            <label className="form-label">Single Image Size</label>
            <select
              className="form-input"
              value={block.singleImageSize || "large"}
              onChange={(e) => onPatch({ singleImageSize: e.target.value as ImageBlock["singleImageSize"] })}
              disabled={disabled}
            >
              <option value="small">Small (280px)</option>
              <option value="medium">Medium (420px)</option>
              <option value="large">Large (560px)</option>
              <option value="full">Full Width</option>
            </select>
          </div>
        )}
      </div>

      {/* B. Images */}
      <div style={{ display: "grid", gap: 10 }}>
        {Array.from({ length: layoutCount }, (_, i) => {
          const slot = block.images?.[i];
          const currentUrl = slot?.url || "";
          const matchedAsset = currentUrl
            ? imageAssets.find((a) => a.public_url === currentUrl) ?? null
            : null;
          const isUploading = !!slotUploading[i];
          const slotErr = slotError[i] ?? null;
          return (
            <div key={i} style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
              <div style={checkerStyle}>
                {currentUrl ? (
                  <img
                    src={currentUrl}
                    alt={`Image ${i + 1} preview`}
                    style={{ maxWidth: "100%", maxHeight: "100%", objectFit: "cover", display: "block" }}
                    onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
                  />
                ) : (
                  <span style={{ fontSize: 10, color: "#9ca3af" }}>None</span>
                )}
              </div>
              <div style={{ flex: 1, display: "grid", gap: 4 }}>
                <label className="form-label" style={{ margin: 0 }}>Image {i + 1}</label>
                <select
                  className="form-input"
                  value={currentUrl}
                  onChange={(e) => {
                    const selectedUrl = e.target.value;
                    if (!selectedUrl) { clearSlot(i); return; }
                    const asset = imageAssets.find((a) => a.public_url === selectedUrl);
                    patchSlot(i, {
                      assetId: asset?.id,
                      url: selectedUrl,
                      altText: slot?.altText || asset?.original_file_name || asset?.file_name || "",
                    });
                  }}
                  disabled={disabled || isUploading}
                >
                  <option value="">— Select image —</option>
                  {imageAssets.map((a) => (
                    <option key={a.id} value={a.public_url}>
                      {a.original_file_name || a.file_name}
                    </option>
                  ))}
                </select>
                {!disabled && (
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
                    {matchedAsset && (
                      <button type="button" className="btn btn-ghost" style={{ fontSize: 11, padding: "2px 8px" }} onClick={() => clearSlot(i)} disabled={isUploading}>
                        Clear
                      </button>
                    )}
                    <button
                      type="button"
                      className="btn btn-ghost"
                      style={{ fontSize: 11, padding: "2px 8px" }}
                      disabled={isUploading}
                      onClick={() => slotUploadRefs.current[i]?.click()}
                    >
                      {isUploading ? "Uploading…" : "Upload Image"}
                    </button>
                    <input
                      type="file"
                      ref={(el) => { slotUploadRefs.current[i] = el; }}
                      accept="image/jpeg,image/png,image/gif,image/webp"
                      style={{ display: "none" }}
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) handleSlotUpload(i, file);
                      }}
                    />
                  </div>
                )}
                {slotErr && <div className="form-error" style={{ fontSize: 12 }}>{slotErr}</div>}
              </div>
            </div>
          );
        })}
      </div>

      {/* C. Image Style */}
      <BrandColorField
        label="Background"
        value={block.backgroundColor ?? ""}
        onChange={(v) => onPatch({ backgroundColor: v })}
        disabled={disabled}
        placeholder="#ffffff"
        brandSettings={brandSettings}
      />
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "flex-end" }}>
        <div className="form-group" style={{ margin: 0, flex: "1 1 120px" }}>
          <label className="form-label">Border</label>
          <select className="form-input" value={block.borderStyle || "none"} onChange={(e) => onPatch({ borderStyle: e.target.value as ImageBlock["borderStyle"] })} disabled={disabled}>
            <option value="none">None</option>
            <option value="thin">Thin (1px)</option>
            <option value="medium">Medium (2px)</option>
          </select>
        </div>
        <div className="form-group" style={{ margin: 0, flex: "1 1 90px", minWidth: 90 }}>
          <label className="form-label">Corners</label>
          <select className="form-input" value={block.roundedCorners || "small"} onChange={(e) => onPatch({ roundedCorners: e.target.value as ImageBlock["roundedCorners"] })} disabled={disabled}>
            <option value="none">None</option>
            <option value="small">Small (6px)</option>
            <option value="medium">Medium (12px)</option>
            <option value="large">Large (18px)</option>
          </select>
        </div>
        <div className="form-group" style={{ margin: 0, flex: "0 0 80px" }}>
          <label className="form-label">Top/Bottom Space</label>
          <input type="number" className="form-input" value={block.paddingY ?? 24} min={0} max={72} step={4} onChange={(e) => onPatch({ paddingY: Number(e.target.value) })} disabled={disabled} />
        </div>
        <div className="form-group" style={{ margin: 0, flex: "0 0 80px" }}>
          <label className="form-label">Left/Right Space</label>
          <input type="number" className="form-input" value={block.paddingX ?? 0} min={0} max={80} step={4} onChange={(e) => onPatch({ paddingX: Number(e.target.value) })} disabled={disabled} />
        </div>
      </div>
      <BrandColorField
        label="Border Color"
        value={block.borderColor ?? ""}
        onChange={(v) => onPatch({ borderColor: v })}
        disabled={disabled || (block.borderStyle || "none") === "none"}
        placeholder="#e5e7eb"
        brandSettings={brandSettings}
      />
      <div className="form-helper">Top/Bottom Space adds room above and below the image block. Left/Right Space adds room on each side.</div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Block card
// ---------------------------------------------------------------------------

function DividerEditor({
  block,
  brandSettings,
  disabled,
  onPatch,
}: {
  block: DividerBlock;
  brandSettings: EmailBrandSettings | null;
  disabled: boolean;
  onPatch: (patch: Partial<DividerBlock>) => void;
}) {
  return (
    <div style={{ display: "grid", gap: 16 }}>
      <div>
        <div style={{ fontSize: 11, fontWeight: 600, color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 10 }}>
          Divider Style
        </div>
        <div style={{ display: "grid", gap: 12 }}>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <div style={{ flex: 1, minWidth: 160 }}>
              <BrandColorField
                label="Background Color"
                value={block.backgroundColor ?? "#ffffff"}
                onChange={(v) => onPatch({ backgroundColor: v })}
                disabled={disabled}
                placeholder="#ffffff"
                brandSettings={brandSettings}
              />
            </div>
            <div style={{ flex: 1, minWidth: 160 }}>
              <BrandColorField
                label="Line Color"
                value={block.lineColor ?? "#e5e7eb"}
                onChange={(v) => onPatch({ lineColor: v })}
                disabled={disabled}
                placeholder="#e5e7eb"
                brandSettings={brandSettings}
              />
            </div>
          </div>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <div className="form-group" style={{ margin: 0, flex: 1 }}>
              <label className="form-label">Line Style</label>
              <select
                className="form-input"
                value={block.lineStyle ?? "solid"}
                disabled={disabled}
                onChange={(e) => onPatch({ lineStyle: e.target.value as DividerBlock["lineStyle"] })}
              >
                <option value="solid">Solid</option>
                <option value="dashed">Dashed</option>
                <option value="dotted">Dotted</option>
              </select>
            </div>
            <div className="form-group" style={{ margin: 0, flex: "0 0 100px" }}>
              <label className="form-label">Thickness</label>
              <select
                className="form-input"
                value={String(block.thickness ?? 1)}
                disabled={disabled}
                onChange={(e) => onPatch({ thickness: Number(e.target.value) })}
              >
                <option value="1">1px</option>
                <option value="2">2px</option>
                <option value="3">3px</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      <div>
        <div style={{ fontSize: 11, fontWeight: 600, color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 10 }}>
          Layout
        </div>
        <div style={{ display: "grid", gap: 12 }}>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <div className="form-group" style={{ margin: 0, flex: 1 }}>
              <label className="form-label">Line Width</label>
              <select
                className="form-input"
                value={block.lineWidth ?? "full"}
                disabled={disabled}
                onChange={(e) => onPatch({ lineWidth: e.target.value as DividerBlock["lineWidth"] })}
              >
                <option value="third">One Third</option>
                <option value="half">Half</option>
                <option value="full">Full</option>
              </select>
            </div>
            <div className="form-group" style={{ margin: 0, flex: 1 }}>
              <label className="form-label">Alignment</label>
              <AlignSelect
                value={block.alignment ?? "center"}
                onChange={(v) => onPatch({ alignment: v as DividerBlock["alignment"] })}
                disabled={disabled}
              />
            </div>
            <div className="form-group" style={{ margin: 0, flex: "0 0 100px" }}>
              <label className="form-label">Top/Bottom Space</label>
              <input
                type="number"
                className="form-input"
                min={0}
                max={64}
                step={4}
                value={block.paddingY ?? 16}
                disabled={disabled}
                onChange={(e) => onPatch({ paddingY: Math.max(0, Math.min(64, Number(e.target.value))) })}
              />
            </div>
          </div>
          <div className="form-helper">Adds room above and below the divider.</div>
        </div>
      </div>
    </div>
  );
}

function BlockCard({
  block,
  idx,
  total,
  expanded,
  disabled,
  brandSettings,
  emailAssets,
  tenantId,
  onExpand,
  onMoveUp,
  onMoveDown,
  onRemove,
  onPatch,
  onAssetUploaded,
}: {
  block: EmailBuilderBlock;
  idx: number;
  total: number;
  expanded: boolean;
  disabled: boolean;
  brandSettings: EmailBrandSettings | null;
  emailAssets: CommunicationEmailAsset[];
  tenantId: string;
  onExpand: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onRemove: () => void;
  onPatch: (patch: Record<string, unknown>) => void;
  onAssetUploaded?: (asset: CommunicationEmailAsset) => void;
}) {
  const label = BLOCK_LABELS[block.type];

  return (
    <div
      style={{
        border: "1px solid #e5e7eb",
        borderRadius: 8,
        background: "#fff",
        overflow: "hidden",
      }}
    >
      {/* Card header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          padding: "10px 12px",
          background: expanded ? "#f0f9ff" : "#f9fafb",
          borderBottom: expanded ? "1px solid #e5e7eb" : "none",
          cursor: "pointer",
        }}
        onClick={onExpand}
      >
        <span
          style={{
            fontSize: 10,
            fontWeight: 700,
            background: "#dbeafe",
            color: "#1d4ed8",
            borderRadius: 9999,
            padding: "2px 8px",
            textTransform: "uppercase",
            letterSpacing: "0.05em",
            flexShrink: 0,
          }}
        >
          {label}
        </span>
        <span
          style={{
            fontSize: 13,
            color: "#374151",
            flex: 1,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {block.type === "header" && (block.tagline || "Logo / header bar")}
          {block.type === "hero" && (block.headline || "Hero section")}
          {block.type === "story" && ((block.content || "").slice(0, 60) || "Story content")}
          {block.type === "highlight" && (block.heading || block.variant)}
          {block.type === "cta" && (block.heading || block.buttonText || "CTA")}
          {block.type === "image" && (block.layout === "one" ? "Single image" : block.layout === "two" ? "2-image row" : "3-image row")}
          {block.type === "divider" && `${block.lineStyle ?? "solid"} line · ${block.lineWidth ?? "full"} width`}
        </span>
        <span style={{ fontSize: 11, color: "#9ca3af", flexShrink: 0 }}>
          {expanded ? "▲" : "▼"}
        </span>
        {!disabled && (
          <div
            style={{ display: "flex", gap: 4, flexShrink: 0 }}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              className="btn btn-ghost"
              style={{ padding: "2px 6px", fontSize: 12 }}
              disabled={idx === 0}
              onClick={onMoveUp}
              title="Move up"
            >
              ↑
            </button>
            <button
              type="button"
              className="btn btn-ghost"
              style={{ padding: "2px 6px", fontSize: 12 }}
              disabled={idx === total - 1}
              onClick={onMoveDown}
              title="Move down"
            >
              ↓
            </button>
            <button
              type="button"
              className="btn btn-ghost"
              style={{ padding: "2px 6px", fontSize: 12, color: "#b91c1c" }}
              onClick={onRemove}
              title="Remove block"
            >
              ×
            </button>
          </div>
        )}
      </div>

      {/* Expanded editor */}
      {expanded && (
        <div style={{ padding: "16px 14px" }}>
          {block.type === "header" && (
            <HeaderEditor
              block={block}
              brandSettings={brandSettings}
              emailAssets={emailAssets}
              tenantId={tenantId}
              disabled={disabled}
              onPatch={(patch) => onPatch(patch as Record<string, unknown>)}
              onAssetUploaded={onAssetUploaded}
            />
          )}
          {block.type === "hero" && (
            <HeroEditor
              block={block}
              brandSettings={brandSettings}
              disabled={disabled}
              onPatch={(patch) => onPatch(patch as Record<string, unknown>)}
            />
          )}
          {block.type === "story" && (
            <StoryEditor
              block={block}
              brandSettings={brandSettings}
              disabled={disabled}
              onPatch={(patch) => onPatch(patch as Record<string, unknown>)}
            />
          )}
          {block.type === "highlight" && (
            <HighlightEditor
              block={block}
              brandSettings={brandSettings}
              disabled={disabled}
              onPatch={(patch) => onPatch(patch as Record<string, unknown>)}
            />
          )}
          {block.type === "cta" && (
            <CtaEditor
              block={block}
              brandSettings={brandSettings}
              disabled={disabled}
              onPatch={(patch) => onPatch(patch as Record<string, unknown>)}
            />
          )}
          {block.type === "image" && (
            <ImageEditor
              block={block}
              brandSettings={brandSettings}
              emailAssets={emailAssets}
              tenantId={tenantId}
              disabled={disabled}
              onPatch={(patch) => onPatch(patch as Record<string, unknown>)}
              onAssetUploaded={onAssetUploaded}
            />
          )}
          {block.type === "divider" && (
            <DividerEditor
              block={block}
              brandSettings={brandSettings}
              disabled={disabled}
              onPatch={(patch) => onPatch(patch as Record<string, unknown>)}
            />
          )}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

const BLOCK_TYPES: EmailBuilderBlock["type"][] = ["header", "hero", "story", "highlight", "cta", "image", "divider"];

export default function BlockComposer({ design, brandSettings, emailAssets, tenantId, canEdit, onChange, onAssetUploaded, onInteract }: Props) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  function updateBlock(id: string, patch: Record<string, unknown>) {
    const newBlocks = design.blocks.map((b) =>
      b.id === id ? ({ ...b, ...patch } as EmailBuilderBlock) : b,
    );
    onChange({ ...design, blocks: newBlocks });
    onInteract?.();
  }

  function moveUp(idx: number) {
    if (idx === 0) return;
    const newBlocks = [...design.blocks];
    [newBlocks[idx - 1], newBlocks[idx]] = [newBlocks[idx], newBlocks[idx - 1]];
    onChange({ ...design, blocks: newBlocks });
  }

  function moveDown(idx: number) {
    if (idx === design.blocks.length - 1) return;
    const newBlocks = [...design.blocks];
    [newBlocks[idx + 1], newBlocks[idx]] = [newBlocks[idx], newBlocks[idx + 1]];
    onChange({ ...design, blocks: newBlocks });
  }

  function removeBlock(id: string) {
    onChange({ ...design, blocks: design.blocks.filter((b) => b.id !== id) });
    setExpandedId((prev) => (prev === id ? null : prev));
  }

  function addBlock(type: EmailBuilderBlock["type"]) {
    const newBlock = createBlock(type, brandSettings);
    onChange({ ...design, blocks: [...design.blocks, newBlock] });
    setExpandedId(newBlock.id);
    onInteract?.();
  }

  function handleApplyBrandDefaults() {
    if (!brandSettings) return;
    if (!window.confirm(
      "Apply the current Brand Kit logo, colors, and defaults to this campaign's builder blocks? Text content will be preserved. Save the campaign to keep the changes."
    )) return;
    onChange(applyBrandDefaultsToDesign(design, brandSettings));
    onInteract?.();
  }

  return (
    <div className="section-card" style={{ marginBottom: 0 }}>
      <div className="section-header">
        <span className="section-title">Serenius Builder</span>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {design.blocks.length > 0 && (
            <span className="section-count">
              {design.blocks.length} block{design.blocks.length === 1 ? "" : "s"}
            </span>
          )}
          {brandSettings && canEdit && (
            <button
              type="button"
              className="btn btn-ghost"
              style={{ fontSize: 11, padding: "3px 10px" }}
              onClick={handleApplyBrandDefaults}
            >
              Apply Brand Kit Defaults
            </button>
          )}
        </div>
      </div>

      <div style={{ padding: "12px 14px 16px", display: "grid", gap: 12 }}>
        <p style={{ margin: 0, fontSize: 12, color: "#6b7280", lineHeight: 1.5 }}>
          Serenius Builder renders structured blocks into email-safe HTML. Add blocks below, then save to generate the rendered preview.
          {brandSettings && canEdit && (
            <span style={{ display: "block", marginTop: 4, fontSize: 11, color: "#9ca3af" }}>
              Use &ldquo;Apply Brand Kit Defaults&rdquo; to apply Brand Kit colors and logo to builder blocks. The required email footer always reflects current Brand Kit settings automatically.
            </span>
          )}
        </p>

        {/* Block list */}
        {design.blocks.length === 0 ? (
          <div className="empty-state" style={{ padding: "20px 0" }}>
            No blocks yet. Add a block below to start building.
          </div>
        ) : (
          <div style={{ display: "grid", gap: 8 }}>
            {design.blocks.map((block, idx) => (
              <BlockCard
                key={block.id}
                block={block}
                idx={idx}
                total={design.blocks.length}
                expanded={expandedId === block.id}
                disabled={!canEdit}
                brandSettings={brandSettings}
                emailAssets={emailAssets}
                tenantId={tenantId}
                onExpand={() => { setExpandedId((prev) => (prev === block.id ? null : block.id)); onInteract?.(); }}
                onMoveUp={() => moveUp(idx)}
                onMoveDown={() => moveDown(idx)}
                onRemove={() => removeBlock(block.id)}
                onPatch={(patch) => updateBlock(block.id, patch)}
                onAssetUploaded={onAssetUploaded}
              />
            ))}
          </div>
        )}

        {/* Add block buttons */}
        {canEdit && (
          <div>
            <div style={{ fontSize: 11, fontWeight: 600, color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 8 }}>
              Add block
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {BLOCK_TYPES.map((type) => (
                <button
                  key={type}
                  type="button"
                  className="btn btn-ghost"
                  style={{ fontSize: 12, padding: "4px 12px" }}
                  onClick={() => addBlock(type)}
                >
                  + {BLOCK_LABELS[type]}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
