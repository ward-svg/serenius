"use client";

import type { EmailBrandSettings } from "../types";

interface Props {
  label: string;
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
  placeholder?: string;
  brandSettings?: EmailBrandSettings | null;
  helper?: string;
}

const chipStyle = {
  width: 36,
  height: 36,
  padding: 2,
  border: "1px solid #d1d5db",
  borderRadius: 6,
  flexShrink: 0,
  display: "block",
} as const;

const STATIC_SWATCHES = [
  { hex: "#ffffff", label: "White" },
  { hex: "#f3f4f6", label: "Light Gray" },
];

function getBrandSwatches(b: EmailBrandSettings) {
  return [
    { hex: b.primary_color, label: "Primary" },
    { hex: b.accent_color, label: "Accent" },
    { hex: b.button_color, label: "Button" },
    { hex: b.button_text_color, label: "Button Text" },
    { hex: b.background_color, label: "Background" },
    { hex: b.text_color, label: "Body Text" },
  ].filter((s): s is { hex: string; label: string } => !!s.hex);
}

export default function BrandColorField({
  label,
  value,
  onChange,
  disabled = false,
  placeholder = "#000000",
  brandSettings,
  helper,
}: Props) {
  const chipValue = value || placeholder;

  const swatches = (() => {
    const all = [
      ...(brandSettings ? getBrandSwatches(brandSettings) : []),
      ...STATIC_SWATCHES,
    ];
    const seen = new Set<string>();
    return all.filter((s) => {
      const key = s.hex.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  })();

  return (
    <div className="form-group" style={{ margin: 0 }}>
      {label && <label className="form-label">{label}</label>}
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <input
          type="color"
          value={chipValue}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          style={{ ...chipStyle, cursor: disabled ? "default" : "pointer" }}
        />
        <input
          type="text"
          className="form-input"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          placeholder={placeholder}
          style={{ fontFamily: "monospace" }}
        />
      </div>
      {!disabled && swatches.length > 0 && (
        <div style={{ display: "flex", gap: 4, marginTop: 6, flexWrap: "wrap" }}>
          {swatches.map((swatch) => (
            <button
              key={swatch.hex}
              type="button"
              title={swatch.label}
              onClick={() => onChange(swatch.hex)}
              style={{
                width: 20,
                height: 20,
                borderRadius: 4,
                background: swatch.hex,
                border:
                  value.toLowerCase() === swatch.hex.toLowerCase()
                    ? "2px solid #374151"
                    : "1px solid #d1d5db",
                cursor: "pointer",
                padding: 0,
                flexShrink: 0,
              }}
            />
          ))}
        </div>
      )}
      {helper && <div className="form-helper">{helper}</div>}
    </div>
  );
}
