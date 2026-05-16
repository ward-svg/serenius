export type BrandSettingsForFooter = {
  organization_name: string | null
  mailing_address: string | null
  city: string | null
  state: string | null
  zip: string | null
  country: string | null
  phone: string | null
  website_url: string | null
  unsubscribe_text: string | null
  footer_html: string | null
  preference_center_url: string | null
  footer_background_color: string | null
  footer_text_color: string | null
  footer_link_color: string | null
  footer_font_size: number | null
  footer_divider_enabled: boolean | null
  footer_divider_color: string | null
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (c) => {
    switch (c) {
      case '&': return '&amp;'
      case '<': return '&lt;'
      case '>': return '&gt;'
      case '"': return '&quot;'
      case "'": return '&#39;'
      default: return c
    }
  })
}

function buildIdentityLines(s: BrandSettingsForFooter): string[] {
  const lines: string[] = []

  if (s.organization_name?.trim()) {
    lines.push(s.organization_name.trim())
  }

  const cityState = [s.city?.trim(), s.state?.trim()].filter(Boolean).join(', ')
  const addressParts = [s.mailing_address?.trim(), cityState, s.zip?.trim()].filter(Boolean)
  if (addressParts.length > 0) {
    lines.push(addressParts.join(', '))
  }

  if (s.country?.trim() && s.country.trim().toUpperCase() !== 'US') {
    lines.push(s.country.trim())
  }

  return lines
}

/**
 * Builds the required compliance footer for a campaign email.
 *
 * The footer always contains the organization identity (name, mailing address) and,
 * when unsubscribeUrl is provided, a working unsubscribe link. These elements cannot
 * be removed or replaced — they are system-owned for CAN-SPAM compliance.
 *
 * Tenant-controlled style fields (footer_background_color, footer_text_color,
 * footer_link_color, footer_font_size, footer_divider_enabled, footer_divider_color)
 * control the visual presentation within system guardrails.
 *
 * If footer_html is set on brandSettings, it is rendered as an intro section that appears
 * BEFORE the required compliance block — not instead of it.
 *
 * @param brandSettings - Org identity and style fields from communication_email_brand_settings
 * @param unsubscribeUrl - Per-recipient tokenized opt-out URL, or null for test/preview sends
 */
export function buildCampaignEmailFooter(
  brandSettings: BrandSettingsForFooter | null,
  unsubscribeUrl: string | null,
): { html: string; text: string } {
  const s = brandSettings
  const identityLines = s ? buildIdentityLines(s) : []
  const unsubscribeText = s?.unsubscribe_text?.trim() || 'Unsubscribe or manage preferences'

  // Style values — clamp font size to DB constraint range server-side as a safety net
  const bgColor = s?.footer_background_color?.trim() || '#f4f4f0'
  const textColor = s?.footer_text_color?.trim() || '#6b7280'
  const linkColor = s?.footer_link_color?.trim() || '#3d5a80'
  const fontSize = Math.min(16, Math.max(11, s?.footer_font_size ?? 12))
  const dividerEnabled = s?.footer_divider_enabled !== false
  const dividerColor = s?.footer_divider_color?.trim() || '#e5e7eb'

  // Plain text — always built from identity fields and unsubscribe line (when URL provided)
  const textLines: string[] = [...identityLines]
  if (unsubscribeUrl) {
    textLines.push(`${unsubscribeText}: ${unsubscribeUrl}`)
  }
  const text = textLines.length > 0 ? '\n\n' + textLines.join('\n') : ''

  // HTML compliance block — always includes org identity + unsubscribe link (when URL provided).
  // This block is system-owned and cannot be suppressed.
  const identityHtml = identityLines.map(l => escapeHtml(l)).join('<br>')

  const dividerTopStyle = dividerEnabled ? `border-top:1px solid ${escapeHtml(dividerColor)};` : ''

  const unsubscribeHtml = unsubscribeUrl
    ? `<div style="margin-top:10px;${dividerTopStyle}padding-top:10px;">` +
      `<a href="${escapeHtml(unsubscribeUrl)}" style="color:${escapeHtml(linkColor)};text-decoration:underline;">` +
      `${escapeHtml(unsubscribeText)}</a></div>`
    : ''

  const complianceBlock = identityHtml || unsubscribeHtml
    ? `<div style="margin:32px 0 0;padding:16px 24px;${dividerTopStyle}` +
      `background-color:${escapeHtml(bgColor)};` +
      `font-family:Arial,Helvetica,sans-serif;font-size:${fontSize}px;` +
      `color:${escapeHtml(textColor)};line-height:1.7;text-align:center;">` +
      identityHtml + unsubscribeHtml +
      `</div>`
    : ''

  // footer_html (if set) is an intro section prepended before the required compliance block.
  // It cannot replace the required org identity or unsubscribe link.
  const html = s?.footer_html?.trim()
    ? s.footer_html.trim() + complianceBlock
    : complianceBlock

  return { html, text }
}
