import 'server-only'
import crypto from 'crypto'

export const ALLOWED_MIME_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
])

const ALLOWED_EXTENSIONS = new Set(['jpg', 'jpeg', 'png', 'gif', 'webp'])

const BLOCKED_MIME_TYPES = new Set([
  'image/svg+xml',
  'text/html',
  'application/javascript',
])

// Authoritative extension from MIME type — never trust the browser filename extension alone
const MIME_TO_EXT: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/gif': 'gif',
  'image/webp': 'webp',
}

export const MAX_ASSET_BYTES = 5 * 1024 * 1024 // 5 MB

export const ALLOWED_ASSET_TYPES = new Set([
  'logo',
  'body_image',
  'icon',
  'template_thumbnail',
  'attachment',
  'other',
])

export function validateAssetFile(
  file: File,
): { ok: true } | { ok: false; error: string; status: number } {
  if (file.size > MAX_ASSET_BYTES) {
    return { ok: false, error: 'File exceeds the 5 MB upload limit.', status: 413 }
  }

  const mime = (file.type ?? '').toLowerCase().trim()

  if (!mime) {
    return { ok: false, error: 'File has no MIME type.', status: 415 }
  }

  if (BLOCKED_MIME_TYPES.has(mime)) {
    return {
      ok: false,
      error: `${mime} is not permitted for tenant uploads. SVG, HTML, and JavaScript are blocked.`,
      status: 415,
    }
  }

  if (!ALLOWED_MIME_TYPES.has(mime)) {
    return {
      ok: false,
      error: 'Only image/jpeg, image/png, image/gif, and image/webp are allowed.',
      status: 415,
    }
  }

  const rawName = (file.name ?? '').trim()
  const ext = rawName.split('.').pop()?.toLowerCase() ?? ''
  if (!ALLOWED_EXTENSIONS.has(ext)) {
    return {
      ok: false,
      error: `File extension .${ext || '(none)'} is not allowed. Allowed: jpg, jpeg, png, gif, webp.`,
      status: 415,
    }
  }

  return { ok: true }
}

export function sanitizeFileName(originalName: string, mimeType: string): string {
  const ext = MIME_TO_EXT[mimeType.toLowerCase()] ?? 'bin'
  const base = originalName
    .replace(/\.[^.]+$/, '')      // strip extension
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, '-') // non-alphanumeric → dash
    .replace(/-{2,}/g, '-')         // collapse repeated dashes
    .replace(/^-+|-+$/g, '')        // trim leading/trailing dashes
    .slice(0, 60)

  return `${base || 'asset'}.${ext}`
}

export function computeSha256(buffer: Buffer): string {
  return crypto.createHash('sha256').update(buffer).digest('hex')
}

// Extract image dimensions from the file buffer without an external library.
// PNG and GIF have trivially parseable fixed-offset headers.
// JPEG and WebP require scanning/variant-aware parsing — return null for those.
export function extractImageDimensions(
  buffer: Buffer,
  mimeType: string,
): { width: number; height: number } | null {
  try {
    if (mimeType === 'image/png' && buffer.length >= 24) {
      // PNG: 8-byte magic + IHDR chunk (4-len + 4-"IHDR" + 4-width + 4-height)
      return { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) }
    }
    if (mimeType === 'image/gif' && buffer.length >= 10) {
      // GIF: 6-byte header + 2-byte width (LE) + 2-byte height (LE)
      return { width: buffer.readUInt16LE(6), height: buffer.readUInt16LE(8) }
    }
    return null
  } catch {
    return null
  }
}
