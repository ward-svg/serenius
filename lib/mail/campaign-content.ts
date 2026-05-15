const TEST_FOOTER_HTML =
  '<div style="margin:32px 0 0;padding:14px 20px;border-top:3px solid #f59e0b;background:#fffbeb;font-family:sans-serif;font-size:12px;color:#78350f;line-height:1.6;">' +
  '<strong>&#9888; This is a test email.</strong> Sent only to configured test recipients — not to campaign contacts.<br>' +
  'Opt-out links are not active. No suppression records are written for test sends.' +
  '</div>'

const TEST_FOOTER_TEXT =
  '\n\n---\nTHIS IS A TEST EMAIL\n' +
  'Sent only to configured test recipients — not to campaign contacts.\n' +
  'Opt-out links are not active. No suppression records are written for test sends.\n---'

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

export function resolveTestFirstName(displayName: string | null | undefined): string {
  const trimmed = (displayName ?? '').trim()
  if (!trimmed) return 'Friend'
  return trimmed.split(/\s+/)[0]
}

export function buildCampaignTestEmailContent(input: {
  messageRawHtml: string | null
  messagePlain: string | null
  recipientDisplayName: string | null
  orgName: string
  brandFooter?: { html: string; text: string } | null
}): { html: string; text: string } {
  const firstName = resolveTestFirstName(input.recipientDisplayName)
  const orgFooterHtml = input.brandFooter?.html ?? ''
  const orgFooterText = input.brandFooter?.text ?? ''

  if (input.messageRawHtml) {
    const resolved = input.messageRawHtml.replace(/\{firstname\}/gi, firstName)
    // Insert test banner + org footer before </body> if present, otherwise append
    const suffix = TEST_FOOTER_HTML + orgFooterHtml
    const closeBodyIdx = resolved.toLowerCase().lastIndexOf('</body>')
    const html =
      closeBodyIdx !== -1
        ? resolved.slice(0, closeBodyIdx) + suffix + resolved.slice(closeBodyIdx)
        : resolved + suffix
    return {
      html,
      text: `(HTML email — view in your email client.)${TEST_FOOTER_TEXT}${orgFooterText}`,
    }
  }

  if (input.messagePlain) {
    const resolved = input.messagePlain.replace(/\{firstname\}/gi, firstName)
    return {
      html:
        `<div style="font-family:sans-serif;font-size:14px;line-height:1.7;color:#111827;white-space:pre-wrap;">${escapeHtml(resolved)}</div>` +
        TEST_FOOTER_HTML +
        orgFooterHtml,
      text: resolved + TEST_FOOTER_TEXT + orgFooterText,
    }
  }

  return {
    html: `<p style="font-family:sans-serif;">(No content.)</p>${TEST_FOOTER_HTML}${orgFooterHtml}`,
    text: `(No content.)${TEST_FOOTER_TEXT}${orgFooterText}`,
  }
}
