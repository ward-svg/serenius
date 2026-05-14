"use client";

import { useState } from "react";
import type {
  CtaBlock,
  EmailBuilderBlock,
  EmailBuilderDesign,
  HeaderBlock,
  HeroBlock,
  HighlightBlock,
  StoryBlock,
} from "../email-builder-types";
import { applyBrandDefaultsToDesign } from "../email-builder-renderer";
import type { CommunicationEmailAsset, EmailBrandSettings } from "../types";

interface Props {
  design: EmailBuilderDesign;
  brandSettings: EmailBrandSettings | null;
  emailAssets: CommunicationEmailAsset[];
  canEdit: boolean;
  onChange: (design: EmailBuilderDesign) => void;
}

const BLOCK_LABELS: Record<EmailBuilderBlock["type"], string> = {
  header: "Header",
  hero: "Hero",
  story: "Story / Text",
  highlight: "Highlight / List",
  cta: "CTA / Offer",
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
      };
    case "story":
      return { id, type, content: "" };
    case "highlight":
      return { id, type, variant: "callout", heading: "", body: "", items: [] };
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

function HeaderEditor({
  block,
  brandSettings,
  emailAssets,
  disabled,
  onPatch,
}: {
  block: HeaderBlock;
  brandSettings: EmailBrandSettings | null;
  emailAssets: CommunicationEmailAsset[];
  disabled: boolean;
  onPatch: (patch: Partial<HeaderBlock>) => void;
}) {
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

  return (
    <div style={{ display: "grid", gap: 12 }}>
      {/* Logo preview */}
      <div className="form-group" style={{ margin: 0 }}>
        <label className="form-label">Logo</label>
        <div style={{ display: "grid", gridTemplateColumns: "120px 1fr", gap: 12, alignItems: "start" }}>
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
          {/* Logo identity panel */}
          <div style={{ display: "grid", gap: 4, paddingTop: 2 }}>
            {block.logoUrl ? (
              <>
                <span
                  style={{
                    display: "inline-block",
                    width: "fit-content",
                    fontSize: 10,
                    fontWeight: 700,
                    background: isPrimaryLogo ? "#dcfce7" : "#dbeafe",
                    color: isPrimaryLogo ? "#166534" : "#1d4ed8",
                    borderRadius: 9999,
                    padding: "1px 8px",
                    letterSpacing: "0.02em",
                  }}
                >
                  {isPrimaryLogo ? "✓ Primary Logo" : "Campaign Logo"}
                </span>
                <span style={{ fontSize: 13, fontWeight: 600, color: "#111827", lineHeight: 1.3 }}>
                  {assetName ?? "Saved campaign logo"}
                </span>
              </>
            ) : (
              <span style={{ fontSize: 12, color: "#9ca3af" }}>No logo selected</span>
            )}
            <span style={{ fontSize: 11, color: "#6b7280", lineHeight: 1.4 }}>
              Set in Brand Kit → Logo. Use "Use as Logo" to assign an uploaded asset.
            </span>
          </div>
        </div>
      </div>
      {/* Tagline + Width */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 140px", gap: 12 }}>
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
        <div className="form-group" style={{ margin: 0 }}>
          <label className="form-label">Width (px)</label>
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
      {/* Alignment + Background Color */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <div className="form-group" style={{ margin: 0 }}>
          <label className="form-label">Alignment</label>
          <AlignSelect
            value={block.alignment}
            onChange={(v) => onPatch({ alignment: v as HeaderBlock["alignment"] })}
            disabled={disabled}
          />
        </div>
        <div className="form-group" style={{ margin: 0 }}>
          <label className="form-label">Background Color</label>
          <input
            type="text"
            className="form-input"
            value={block.backgroundColor}
            onChange={(e) => onPatch({ backgroundColor: e.target.value })}
            disabled={disabled}
            placeholder="#1a56db"
            style={{ fontFamily: "monospace" }}
          />
        </div>
      </div>
    </div>
  );
}

function HeroEditor({
  block,
  disabled,
  onPatch,
}: {
  block: HeroBlock;
  disabled: boolean;
  onPatch: (patch: Partial<HeroBlock>) => void;
}) {
  return (
    <div style={{ display: "grid", gap: 12 }}>
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
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
        <div className="form-group" style={{ margin: 0 }}>
          <label className="form-label">Alignment</label>
          <AlignSelect
            value={block.alignment}
            onChange={(v) => onPatch({ alignment: v as HeroBlock["alignment"] })}
            disabled={disabled}
          />
        </div>
        <div className="form-group" style={{ margin: 0 }}>
          <label className="form-label">Background</label>
          <input
            type="text"
            className="form-input"
            value={block.backgroundColor}
            onChange={(e) => onPatch({ backgroundColor: e.target.value })}
            disabled={disabled}
            placeholder="#f3f4f6"
            style={{ fontFamily: "monospace" }}
          />
        </div>
        <div className="form-group" style={{ margin: 0 }}>
          <label className="form-label">Text Color</label>
          <input
            type="text"
            className="form-input"
            value={block.textColor}
            onChange={(e) => onPatch({ textColor: e.target.value })}
            disabled={disabled}
            placeholder="#111827"
            style={{ fontFamily: "monospace" }}
          />
        </div>
      </div>
    </div>
  );
}

function StoryEditor({
  block,
  disabled,
  onPatch,
}: {
  block: StoryBlock;
  disabled: boolean;
  onPatch: (patch: Partial<StoryBlock>) => void;
}) {
  return (
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
  );
}

function HighlightEditor({
  block,
  disabled,
  onPatch,
}: {
  block: HighlightBlock;
  disabled: boolean;
  onPatch: (patch: Partial<HighlightBlock>) => void;
}) {
  return (
    <div style={{ display: "grid", gap: 12 }}>
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
    </div>
  );
}

function CtaEditor({
  block,
  disabled,
  onPatch,
}: {
  block: CtaBlock;
  disabled: boolean;
  onPatch: (patch: Partial<CtaBlock>) => void;
}) {
  return (
    <div style={{ display: "grid", gap: 12 }}>
      <div className="form-group" style={{ margin: 0 }}>
        <label className="form-label">Variant</label>
        <select
          className="form-input"
          value={block.variant}
          onChange={(e) => onPatch({ variant: e.target.value as CtaBlock["variant"] })}
          disabled={disabled}
        >
          <option value="button">Button — centered heading and CTA button</option>
          <option value="panel">Panel — accent background with heading and button</option>
          <option value="offer">Offer — large amount display with donation button</option>
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
          placeholder="Support WellSpring this month"
        />
      </div>
      <div className="form-group" style={{ margin: 0 }}>
        <label className="form-label">Body</label>
        <textarea
          className="form-textarea"
          rows={2}
          value={block.body}
          onChange={(e) => onPatch({ body: e.target.value })}
          disabled={disabled}
          placeholder="Brief supporting text."
        />
      </div>
      {block.variant === "offer" && (
        <div className="form-group" style={{ margin: 0 }}>
          <label className="form-label">Amount</label>
          <input
            type="text"
            className="form-input"
            value={block.amount}
            onChange={(e) => onPatch({ amount: e.target.value })}
            disabled={disabled}
            placeholder="$50 / month"
          />
        </div>
      )}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <div className="form-group" style={{ margin: 0 }}>
          <label className="form-label">Button Text</label>
          <input
            type="text"
            className="form-input"
            value={block.buttonText}
            onChange={(e) => onPatch({ buttonText: e.target.value })}
            disabled={disabled}
            placeholder="Donate Now"
          />
        </div>
        <div className="form-group" style={{ margin: 0 }}>
          <label className="form-label">Button URL</label>
          <input
            type="text"
            className="form-input"
            value={block.buttonUrl}
            onChange={(e) => onPatch({ buttonUrl: e.target.value })}
            disabled={disabled}
            placeholder="https://…"
          />
          <div className="form-helper">Defaults to Brand Kit donation URL if blank.</div>
        </div>
      </div>
      {(block.variant === "panel" || block.variant === "offer") && (
        <ItemsList
          items={block.items}
          disabled={disabled}
          onChange={(items) => onPatch({ items })}
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Block card
// ---------------------------------------------------------------------------

function BlockCard({
  block,
  idx,
  total,
  expanded,
  disabled,
  brandSettings,
  emailAssets,
  onExpand,
  onMoveUp,
  onMoveDown,
  onRemove,
  onPatch,
}: {
  block: EmailBuilderBlock;
  idx: number;
  total: number;
  expanded: boolean;
  disabled: boolean;
  brandSettings: EmailBrandSettings | null;
  emailAssets: CommunicationEmailAsset[];
  onExpand: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onRemove: () => void;
  onPatch: (patch: Record<string, unknown>) => void;
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
              disabled={disabled}
              onPatch={(patch) => onPatch(patch as Record<string, unknown>)}
            />
          )}
          {block.type === "hero" && (
            <HeroEditor
              block={block}
              disabled={disabled}
              onPatch={(patch) => onPatch(patch as Record<string, unknown>)}
            />
          )}
          {block.type === "story" && (
            <StoryEditor
              block={block}
              disabled={disabled}
              onPatch={(patch) => onPatch(patch as Record<string, unknown>)}
            />
          )}
          {block.type === "highlight" && (
            <HighlightEditor
              block={block}
              disabled={disabled}
              onPatch={(patch) => onPatch(patch as Record<string, unknown>)}
            />
          )}
          {block.type === "cta" && (
            <CtaEditor
              block={block}
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

const BLOCK_TYPES: EmailBuilderBlock["type"][] = ["header", "hero", "story", "highlight", "cta"];

export default function BlockComposer({ design, brandSettings, emailAssets, canEdit, onChange }: Props) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  function updateBlock(id: string, patch: Record<string, unknown>) {
    const newBlocks = design.blocks.map((b) =>
      b.id === id ? ({ ...b, ...patch } as EmailBuilderBlock) : b,
    );
    onChange({ ...design, blocks: newBlocks });
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
  }

  function handleApplyBrandDefaults() {
    if (!brandSettings) return;
    if (!window.confirm(
      "Apply the current Brand Kit logo, colors, and defaults to this campaign's builder blocks? Text content will be preserved. Save the campaign to keep the changes."
    )) return;
    onChange(applyBrandDefaultsToDesign(design, brandSettings));
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
              Use "Apply Brand Kit Defaults" after Brand Kit changes to refresh an existing draft.
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
                onExpand={() => setExpandedId((prev) => (prev === block.id ? null : block.id))}
                onMoveUp={() => moveUp(idx)}
                onMoveDown={() => moveDown(idx)}
                onRemove={() => removeBlock(block.id)}
                onPatch={(patch) => updateBlock(block.id, patch)}
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
