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
 * Builds the required email footer for a campaign send.
 *
 * @param brandSettings - Org identity fields from communication_email_brand_settings (null = no settings yet)
 * @param unsubscribeUrl - Tokenized opt-out URL for the recipient, or null for test sends
 *
 * Returns { html, text } ready to be appended after campaign content.
 * If footer_html is set on brandSettings, it is used as the HTML footer override.
 * If unsubscribeUrl is null, no opt-out link is rendered (test send behavior).
 */
export function buildCampaignEmailFooter(
  brandSettings: BrandSettingsForFooter | null,
  unsubscribeUrl: string | null,
): { html: string; text: string } {
  const s = brandSettings
  const identityLines = s ? buildIdentityLines(s) : []
  const unsubscribeText = s?.unsubscribe_text?.trim() || 'Unsubscribe or manage preferences'

  // Plain text footer — always built from identity fields regardless of footer_html override
  const textLines: string[] = [...identityLines]
  if (unsubscribeUrl) {
    textLines.push(`${unsubscribeText}: ${unsubscribeUrl}`)
  }
  const text = textLines.length > 0 ? '\n\n' + textLines.join('\n') : ''

  // HTML footer
  let html: string

  if (s?.footer_html?.trim()) {
    // Custom HTML override — rendered as-is; plain text is still built from identity fields above
    html = s.footer_html.trim()
  } else {
    const identityHtml = identityLines.map(l => escapeHtml(l)).join('<br>')
    const unsubscribeHtml = unsubscribeUrl
      ? `<div style="margin-top:10px;border-top:1px solid #e5e7eb;padding-top:10px;">` +
        `<a href="${escapeHtml(unsubscribeUrl)}" style="color:#6b7280;text-decoration:underline;">` +
        `${escapeHtml(unsubscribeText)}</a></div>`
      : ''

    html =
      identityHtml || unsubscribeHtml
        ? `<div style="margin:32px 0 0;padding:16px 24px;border-top:1px solid #e5e7eb;` +
          `font-family:Arial,Helvetica,sans-serif;font-size:11px;color:#6b7280;` +
          `line-height:1.7;text-align:center;">` +
          identityHtml +
          unsubscribeHtml +
          `</div>`
        : ''
  }

  return { html, text }
}
