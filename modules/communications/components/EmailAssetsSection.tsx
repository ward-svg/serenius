"use client";

import { useRef, useState } from "react";
import type { CommunicationEmailAsset } from "../types";

const ALLOWED_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
]);

const ALLOWED_EXTENSIONS = new Set(["jpg", "jpeg", "png", "gif", "webp"]);

const MAX_BYTES = 5 * 1024 * 1024;

const ASSET_TYPE_OPTIONS: { value: string; label: string }[] = [
  { value: "body_image", label: "Body Image" },
  { value: "logo", label: "Logo" },
  { value: "icon", label: "Icon" },
  { value: "template_thumbnail", label: "Template Thumbnail" },
  { value: "attachment", label: "Attachment" },
  { value: "other", label: "Other" },
];

const ASSET_TYPE_LABELS: Record<string, string> = Object.fromEntries(
  ASSET_TYPE_OPTIONS.map((o) => [o.value, o.label]),
);

interface Props {
  tenantId: string;
  assets: CommunicationEmailAsset[];
  canManage: boolean;
  onAssetsChange: (assets: CommunicationEmailAsset[]) => void;
  onUseAsLogo: (url: string) => void;
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function validateFile(file: File): string | null {
  if (file.size > MAX_BYTES) return "File exceeds the 5 MB limit.";
  const mime = file.type.toLowerCase().trim();
  if (!mime) return "File has no MIME type.";
  if (mime === "image/svg+xml") return "SVG files are not allowed.";
  if (mime === "text/html") return "HTML files are not allowed.";
  if (mime === "application/javascript") return "JavaScript files are not allowed.";
  if (!ALLOWED_MIME_TYPES.has(mime)) return "Only JPEG, PNG, GIF, and WebP images are allowed.";
  const ext = (file.name ?? "").split(".").pop()?.toLowerCase() ?? "";
  if (!ALLOWED_EXTENSIONS.has(ext)) return `Extension .${ext || "(none)"} is not allowed.`;
  return null;
}

export default function EmailAssetsSection({
  tenantId,
  assets,
  canManage,
  onAssetsChange,
  onUseAsLogo,
}: Props) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [assetType, setAssetType] = useState("body_image");
  const [altText, setAltText] = useState("");
  const [fileError, setFileError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadResult, setUploadResult] = useState<{ ok: boolean; message: string; url?: string } | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const totalBytes = assets.reduce((sum, a) => sum + (a.file_size_bytes ?? 0), 0);

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0] ?? null;
    setSelectedFile(file);
    setFileError(null);
    setUploadResult(null);
    if (file) {
      const err = validateFile(file);
      if (err) setFileError(err);
    }
  }

  async function handleUpload() {
    if (!selectedFile) {
      setFileError("Select a file to upload.");
      return;
    }
    const err = validateFile(selectedFile);
    if (err) {
      setFileError(err);
      return;
    }

    setUploading(true);
    setUploadResult(null);

    try {
      const fd = new FormData();
      fd.append("tenantId", tenantId);
      fd.append("file", selectedFile);
      fd.append("asset_type", assetType);
      if (altText.trim()) fd.append("alt_text", altText.trim());

      const res = await fetch("/api/communications/assets/upload", {
        method: "POST",
        body: fd,
      });

      const data = await res.json();

      if (!data.ok || !data.asset) {
        setUploadResult({ ok: false, message: data.error ?? "Upload failed." });
        return;
      }

      const asset = data.asset;
      const newAsset: CommunicationEmailAsset = {
        id: asset.id,
        tenant_id: tenantId,
        asset_type: asset.asset_type,
        file_name: asset.file_name,
        original_file_name: asset.original_file_name ?? null,
        public_url: asset.public_url,
        mime_type: asset.mime_type,
        file_size_bytes: asset.file_size_bytes,
        width: asset.width ?? null,
        height: asset.height ?? null,
        alt_text: asset.alt_text ?? null,
        created_at: asset.created_at,
        updated_at: asset.created_at,
      };

      onAssetsChange([newAsset, ...assets]);
      setUploadResult({ ok: true, message: "Uploaded.", url: asset.public_url });
      setSelectedFile(null);
      setAltText("");
      if (fileInputRef.current) fileInputRef.current.value = "";
    } catch {
      setUploadResult({ ok: false, message: "Network error. Please try again." });
    } finally {
      setUploading(false);
    }
  }

  async function handleCopy(assetId: string, url: string) {
    try {
      await navigator.clipboard.writeText(url);
      setCopiedId(assetId);
      setTimeout(() => setCopiedId((prev) => (prev === assetId ? null : prev)), 2000);
    } catch {
      // clipboard unavailable — silent
    }
  }

  return (
    <div className="section-card" style={{ marginTop: 16 }}>
      <div className="section-header">
        <span className="section-title">Public Email Assets</span>
        {assets.length > 0 && (
          <span className="section-count">
            {assets.length} asset{assets.length === 1 ? "" : "s"} · {formatFileSize(totalBytes)} used
          </span>
        )}
      </div>

      <div style={{ padding: "16px 20px 20px", display: "grid", gap: 20 }}>
        <p style={{ fontSize: 13, color: "#6b7280", lineHeight: 1.6, margin: 0 }}>
          Upload public images for email templates, campaign graphics, logos, and builder blocks.
          Assets are publicly accessible by URL and should not contain private information.
        </p>

        {/* Upload form */}
        {canManage && (
          <div
            style={{
              background: "#f9fafb",
              border: "1px solid #e5e7eb",
              borderRadius: 10,
              padding: "16px 18px",
              display: "grid",
              gap: 12,
            }}
          >
            <div style={{ display: "grid", gridTemplateColumns: "1fr 180px", gap: 12, alignItems: "start" }}>
              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label">File</label>
                <input
                  ref={fileInputRef}
                  type="file"
                  className="form-input"
                  accept="image/jpeg,image/png,image/gif,image/webp"
                  onChange={handleFileChange}
                  style={{ fontSize: 13 }}
                />
                <div className="form-helper">JPEG, PNG, GIF, or WebP · max 5 MB</div>
                {fileError && (
                  <div className="form-error" style={{ marginTop: 4 }}>{fileError}</div>
                )}
              </div>

              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label">Asset Type</label>
                <select
                  className="form-input"
                  value={assetType}
                  onChange={(e) => setAssetType(e.target.value)}
                >
                  {ASSET_TYPE_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 12, alignItems: "end" }}>
              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label">Alt Text</label>
                <input
                  type="text"
                  className="form-input"
                  value={altText}
                  onChange={(e) => setAltText(e.target.value)}
                  placeholder="Describe the image for accessibility"
                />
              </div>

              <button
                type="button"
                className="btn btn-primary"
                onClick={handleUpload}
                disabled={uploading || !selectedFile || !!fileError}
                style={{ whiteSpace: "nowrap" }}
              >
                {uploading ? "Uploading…" : "Upload"}
              </button>
            </div>

            {uploadResult && (
              <div
                style={{
                  fontSize: 13,
                  fontWeight: 500,
                  color: uploadResult.ok ? "#15803d" : "#b91c1c",
                  display: "flex",
                  flexDirection: "column",
                  gap: 2,
                }}
              >
                <span>{uploadResult.message}</span>
                {uploadResult.ok && uploadResult.url && (
                  <a
                    href={uploadResult.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="action-link"
                    style={{ fontSize: 12, fontWeight: 400 }}
                  >
                    {uploadResult.url}
                  </a>
                )}
              </div>
            )}
          </div>
        )}

        {/* Asset list */}
        {assets.length === 0 ? (
          <div className="empty-state">No public assets uploaded yet.</div>
        ) : (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))",
              gap: 12,
            }}
          >
            {assets.map((asset) => (
              <div
                key={asset.id}
                style={{
                  border: "1px solid #e5e7eb",
                  borderRadius: 10,
                  overflow: "hidden",
                  background: "#fff",
                  display: "flex",
                  flexDirection: "column",
                }}
              >
                {/* Thumbnail */}
                <div
                  style={{
                    background: "#f3f4f6",
                    height: 110,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    overflow: "hidden",
                  }}
                >
                  <img
                    src={asset.public_url}
                    alt={asset.alt_text ?? asset.file_name}
                    loading="lazy"
                    style={{
                      maxWidth: "100%",
                      maxHeight: 110,
                      objectFit: "contain",
                      display: "block",
                    }}
                    onError={(e) => {
                      (e.currentTarget as HTMLImageElement).style.display = "none";
                    }}
                  />
                </div>

                {/* Metadata */}
                <div style={{ padding: "10px 12px", display: "grid", gap: 4, flex: 1 }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: "#111827", wordBreak: "break-all", lineHeight: 1.3 }}>
                    {asset.original_file_name ?? asset.file_name}
                  </div>

                  <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginTop: 2 }}>
                    <span
                      style={{
                        fontSize: 10,
                        fontWeight: 600,
                        background: "#ede9fe",
                        color: "#5b21b6",
                        borderRadius: 9999,
                        padding: "1px 7px",
                      }}
                    >
                      {ASSET_TYPE_LABELS[asset.asset_type] ?? asset.asset_type}
                    </span>
                  </div>

                  <div style={{ fontSize: 11, color: "#6b7280", display: "grid", gap: 1, marginTop: 2 }}>
                    <span>{formatFileSize(asset.file_size_bytes)}</span>
                    {asset.width && asset.height && (
                      <span>{asset.width} × {asset.height} px</span>
                    )}
                    <span>{formatDate(asset.created_at)}</span>
                  </div>
                </div>

                {/* Actions */}
                <div
                  style={{
                    padding: "8px 12px",
                    borderTop: "1px solid #f3f4f6",
                    display: "flex",
                    flexWrap: "wrap",
                    gap: 6,
                  }}
                >
                  <button
                    type="button"
                    className="btn btn-ghost"
                    style={{ fontSize: 11, padding: "3px 8px" }}
                    onClick={() => handleCopy(asset.id, asset.public_url)}
                  >
                    {copiedId === asset.id ? "Copied!" : "Copy URL"}
                  </button>
                  <a
                    href={asset.public_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn btn-ghost"
                    style={{ fontSize: 11, padding: "3px 8px", textDecoration: "none" }}
                  >
                    Open ↗
                  </a>
                  {asset.asset_type === "logo" && canManage && (
                    <button
                      type="button"
                      className="btn btn-ghost"
                      style={{ fontSize: 11, padding: "3px 8px", color: "#1d4ed8" }}
                      onClick={() => onUseAsLogo(asset.public_url)}
                    >
                      Use as Logo
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
