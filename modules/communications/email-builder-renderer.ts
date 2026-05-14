import type { EmailBrandSettings } from './types';
import type {
  CtaBlock,
  EmailBuilderBlock,
  EmailBuilderDesign,
  HeaderBlock,
  HeroBlock,
  HighlightBlock,
  StoryBlock,
} from './email-builder-types';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function esc(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function safeUrl(url: string): string {
  const t = (url ?? '').trim();
  if (t.startsWith('https://') || t.startsWith('http://')) return t;
  return '#';
}

export function hasBuilderBlocks(design: EmailBuilderDesign): boolean {
  return design.blocks.length > 0;
}

export function parseDesign(raw: Record<string, unknown>): EmailBuilderDesign {
  if (
    raw !== null &&
    typeof raw === 'object' &&
    !Array.isArray(raw) &&
    raw['version'] === 1 &&
    Array.isArray(raw['blocks'])
  ) {
    return raw as unknown as EmailBuilderDesign;
  }
  return { version: 1, blocks: [] };
}

// ---------------------------------------------------------------------------
// Block renderers — each returns one or more <tr> rows for the inner table
// ---------------------------------------------------------------------------

function renderHeader(block: HeaderBlock, brand: EmailBrandSettings | null): string {
  const bg = block.backgroundColor || brand?.primary_color || '#1a56db';
  const align = block.alignment || 'center';
  const logoUrl = block.logoUrl || brand?.logo_url || '';
  const logoWidth = block.logoWidth || brand?.logo_width || 180;
  const headingFont = brand?.heading_font || brand?.default_font || "Georgia, 'Times New Roman', serif";
  const bodyFont = brand?.body_font || brand?.default_font || 'Arial, Helvetica, sans-serif';
  const orgName = brand?.organization_name || '';

  const logoHtml = logoUrl
    ? `<img src="${esc(safeUrl(logoUrl))}" width="${Number(logoWidth)}" alt="${esc(orgName || 'Logo')}" style="display:block;${align === 'center' ? 'margin:0 auto;' : ''}border:0;max-width:100%;">`
    : (orgName ? `<p style="margin:0;font-size:20px;font-weight:700;color:#ffffff;font-family:${esc(headingFont)};">${esc(orgName)}</p>` : '');

  const taglineOffset = align !== 'center' ? Math.max(0, block.taglineOffset ?? 0) : 0;
  const taglineOffsetStyle = align === 'left' && taglineOffset > 0
    ? `padding-left:${taglineOffset}px;`
    : align === 'right' && taglineOffset > 0
    ? `padding-right:${taglineOffset}px;`
    : '';

  const taglineHtml = block.tagline
    ? `<p style="margin:6px 0 0;font-size:13px;color:#ffffff;font-family:${esc(bodyFont)};opacity:0.85;${taglineOffsetStyle}">${esc(block.tagline)}</p>`
    : '';

  return `<tr>
  <td bgcolor="${esc(bg)}" style="background-color:${esc(bg)};padding:20px 30px;" align="${align}">
    ${logoHtml}${taglineHtml}
  </td>
</tr>`;
}

function renderHero(block: HeroBlock, brand: EmailBrandSettings | null): string {
  const bg = block.backgroundColor || brand?.primary_color || '#1a56db';
  const textColorFallback = block.textColor || brand?.button_text_color || '#ffffff';
  const align = block.alignment || 'center';
  const headingFont = brand?.heading_font || brand?.default_font || "Georgia, 'Times New Roman', serif";
  const bodyFont = brand?.body_font || brand?.default_font || 'Arial, Helvetica, sans-serif';
  const paddingY = typeof block.paddingY === 'number' ? block.paddingY : 40;
  const headlineSize = typeof block.headlineSize === 'number' ? block.headlineSize : 28;
  const subtitleSize = typeof block.subtitleSize === 'number' ? block.subtitleSize : 16;
  const eyebrowColor = block.eyebrowColor || textColorFallback;
  const eyebrowSize = typeof block.eyebrowSize === 'number' ? block.eyebrowSize : 11;
  const eyebrowUppercase = block.eyebrowUppercase !== false;
  const headlineColor = block.headlineColor || textColorFallback;
  const subtitleColor = block.subtitleColor || textColorFallback;

  const parts: string[] = [];
  if (block.eyebrow) {
    parts.push(`<p style="margin:0 0 8px;font-size:${eyebrowSize}px;font-family:${esc(bodyFont)};color:${esc(eyebrowColor)};${eyebrowUppercase ? 'text-transform:uppercase;' : ''}letter-spacing:0.1em;font-weight:600;">${esc(block.eyebrow)}</p>`);
  }
  if (block.headline) {
    parts.push(`<h1 style="margin:0 0 12px;font-size:${headlineSize}px;font-family:${esc(headingFont)};color:${esc(headlineColor)};font-weight:700;line-height:1.2;">${esc(block.headline)}</h1>`);
  }
  if (block.subtitle) {
    parts.push(`<p style="margin:0;font-size:${subtitleSize}px;font-family:${esc(bodyFont)};color:${esc(subtitleColor)};line-height:1.5;">${esc(block.subtitle)}</p>`);
  }

  return `<tr>
  <td bgcolor="${esc(bg)}" style="background-color:${esc(bg)};padding:${paddingY}px 30px;" align="${align}">
    ${parts.join('')}
  </td>
</tr>`;
}

function renderStory(block: StoryBlock, brand: EmailBrandSettings | null): string {
  const color = brand?.text_color || '#111827';
  const bodyFont = brand?.body_font || brand?.default_font || 'Arial, Helvetica, sans-serif';
  const content = (block.content || '').trim();

  const paragraphs = content
    ? content
        .split(/\n\n+/)
        .map(
          (p) =>
            `<p style="margin:0 0 14px;font-size:15px;font-family:${esc(bodyFont)};color:${esc(color)};line-height:1.6;">${esc(p).replace(/\n/g, '<br>')}</p>`,
        )
        .join('')
    : `<p style="margin:0;font-size:15px;font-family:${esc(bodyFont)};color:#9ca3af;">No content.</p>`;

  return `<tr>
  <td style="padding:24px 30px;background-color:#ffffff;">
    ${paragraphs}
  </td>
</tr>`;
}

function renderHighlight(block: HighlightBlock, brand: EmailBrandSettings | null): string {
  const headingFont = brand?.heading_font || brand?.default_font || "Georgia, 'Times New Roman', serif";
  const bodyFont = brand?.body_font || brand?.default_font || 'Arial, Helvetica, sans-serif';
  const primary = brand?.primary_color || '#1a56db';
  const accent = brand?.accent_color || '#e8f0fe';
  const text = brand?.text_color || '#111827';
  const items = block.items.filter(Boolean);

  if (block.variant === 'quote') {
    return `<tr>
  <td style="padding:16px 30px;background-color:#ffffff;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
      <td style="border-left:4px solid ${esc(primary)};padding:12px 20px;background-color:${esc(accent)};">
        ${block.heading ? `<p style="margin:0 0 6px;font-size:12px;font-weight:700;font-family:${esc(bodyFont)};color:${esc(primary)};text-transform:uppercase;letter-spacing:0.05em;">${esc(block.heading)}</p>` : ''}
        ${block.body ? `<p style="margin:0;font-size:15px;font-family:${esc(headingFont)};color:${esc(text)};line-height:1.6;font-style:italic;">${esc(block.body)}</p>` : ''}
      </td>
    </tr></table>
  </td>
</tr>`;
  }

  if (block.variant === 'list') {
    const listHtml = items.length
      ? `<ul style="margin:8px 0 0;padding:0 0 0 20px;">${items.map((i) => `<li style="margin:0 0 6px;font-size:14px;font-family:${esc(bodyFont)};color:${esc(text)};line-height:1.5;">${esc(i)}</li>`).join('')}</ul>`
      : '';
    return `<tr>
  <td style="padding:24px 30px;background-color:#ffffff;">
    ${block.heading ? `<p style="margin:0 0 10px;font-size:17px;font-weight:700;font-family:${esc(headingFont)};color:${esc(text)};">${esc(block.heading)}</p>` : ''}
    ${block.body ? `<p style="margin:0 0 8px;font-size:14px;font-family:${esc(bodyFont)};color:${esc(text)};line-height:1.5;">${esc(block.body)}</p>` : ''}
    ${listHtml}
  </td>
</tr>`;
  }

  // callout
  const itemsHtml = items.length
    ? `<ul style="margin:10px 0 0;padding:0 0 0 18px;">${items.map((i) => `<li style="font-size:14px;font-family:${esc(bodyFont)};color:${esc(text)};margin:0 0 4px;">${esc(i)}</li>`).join('')}</ul>`
    : '';
  return `<tr>
  <td style="padding:16px 30px;background-color:#ffffff;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
      <td style="background-color:${esc(accent)};border:1px solid #d1d5db;border-radius:8px;padding:20px 24px;">
        ${block.heading ? `<p style="margin:0 0 8px;font-size:16px;font-weight:700;font-family:${esc(headingFont)};color:${esc(primary)};">${esc(block.heading)}</p>` : ''}
        ${block.body ? `<p style="margin:0;font-size:14px;font-family:${esc(bodyFont)};color:${esc(text)};line-height:1.6;">${esc(block.body)}</p>` : ''}
        ${itemsHtml}
      </td>
    </tr></table>
  </td>
</tr>`;
}

function renderCta(block: CtaBlock, brand: EmailBrandSettings | null): string {
  const headingFont = brand?.heading_font || brand?.default_font || "Georgia, 'Times New Roman', serif";
  const bodyFont = brand?.body_font || brand?.default_font || 'Arial, Helvetica, sans-serif';
  const btnColor = brand?.button_color || '#1a56db';
  const btnText = brand?.button_text_color || '#ffffff';
  const text = brand?.text_color || '#111827';
  const primary = brand?.primary_color || '#1a56db';
  const accent = brand?.accent_color || '#e8f0fe';
  const href = safeUrl(block.buttonUrl || brand?.default_donation_url || '');
  const items = block.items.filter(Boolean);

  const btnHtml = block.buttonText
    ? `<a href="${esc(href)}" style="display:inline-block;background-color:${esc(btnColor)};color:${esc(btnText)};font-family:${esc(bodyFont)};font-size:15px;font-weight:700;padding:12px 28px;text-decoration:none;border-radius:6px;">${esc(block.buttonText)}</a>`
    : '';

  if (block.variant === 'button') {
    return `<tr>
  <td style="padding:24px 30px;background-color:#ffffff;text-align:center;">
    ${block.heading ? `<p style="margin:0 0 8px;font-size:17px;font-weight:700;font-family:${esc(headingFont)};color:${esc(text)};">${esc(block.heading)}</p>` : ''}
    ${block.body ? `<p style="margin:0 0 16px;font-size:14px;font-family:${esc(bodyFont)};color:${esc(text)};line-height:1.5;">${esc(block.body)}</p>` : ''}
    ${btnHtml}
  </td>
</tr>`;
  }

  if (block.variant === 'offer') {
    const itemsHtml = items.length
      ? `<ul style="margin:0 0 16px;padding:0;list-style:none;">${items.map((i) => `<li style="font-size:13px;font-family:${esc(bodyFont)};color:${esc(text)};margin:0 0 4px;">${esc(i)}</li>`).join('')}</ul>`
      : '';
    return `<tr>
  <td style="padding:24px 30px;background-color:#ffffff;text-align:center;">
    ${block.heading ? `<p style="margin:0 0 8px;font-size:17px;font-weight:700;font-family:${esc(headingFont)};color:${esc(text)};">${esc(block.heading)}</p>` : ''}
    ${block.amount ? `<p style="margin:0 0 8px;font-size:36px;font-weight:800;font-family:${esc(headingFont)};color:${esc(primary)};">${esc(block.amount)}</p>` : ''}
    ${block.body ? `<p style="margin:0 0 16px;font-size:14px;font-family:${esc(bodyFont)};color:${esc(text)};line-height:1.5;">${esc(block.body)}</p>` : ''}
    ${itemsHtml}
    ${btnHtml}
  </td>
</tr>`;
  }

  // panel
  const itemsHtml = items.length
    ? `<ul style="margin:0 0 16px;padding:0 0 0 18px;">${items.map((i) => `<li style="font-size:14px;font-family:${esc(bodyFont)};color:${esc(text)};margin:0 0 4px;">${esc(i)}</li>`).join('')}</ul>`
    : '';
  return `<tr>
  <td style="padding:16px 30px;background-color:#ffffff;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
      <td style="background-color:${esc(accent)};border-radius:8px;padding:24px;text-align:center;">
        ${block.heading ? `<p style="margin:0 0 8px;font-size:18px;font-weight:700;font-family:${esc(headingFont)};color:${esc(primary)};">${esc(block.heading)}</p>` : ''}
        ${block.body ? `<p style="margin:0 0 16px;font-size:14px;font-family:${esc(bodyFont)};color:${esc(text)};line-height:1.5;">${esc(block.body)}</p>` : ''}
        ${itemsHtml}
        ${btnHtml}
      </td>
    </tr></table>
  </td>
</tr>`;
}

function renderBlock(block: EmailBuilderBlock, brand: EmailBrandSettings | null): string {
  switch (block.type) {
    case 'header': return renderHeader(block, brand);
    case 'hero': return renderHero(block, brand);
    case 'story': return renderStory(block, brand);
    case 'highlight': return renderHighlight(block, brand);
    case 'cta': return renderCta(block, brand);
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export function applyBrandDefaultsToDesign(
  design: EmailBuilderDesign,
  brand: EmailBrandSettings,
): EmailBuilderDesign {
  const blocks = design.blocks.map((block): EmailBuilderBlock => {
    switch (block.type) {
      case 'header':
        return {
          ...block,
          logoUrl: brand.logo_url || block.logoUrl || '',
          logoWidth: brand.logo_width || block.logoWidth || 180,
          backgroundColor: brand.primary_color || block.backgroundColor,
        };
      case 'hero':
        return {
          ...block,
          backgroundColor: brand.primary_color || block.backgroundColor,
          textColor: brand.button_text_color || block.textColor,
          eyebrowColor: brand.button_text_color || block.eyebrowColor,
          headlineColor: brand.button_text_color || block.headlineColor,
          subtitleColor: brand.button_text_color || block.subtitleColor,
        };
      case 'cta':
        return {
          ...block,
          buttonUrl: block.buttonUrl || brand.default_donation_url || '',
        };
      case 'story':
      case 'highlight':
        return block;
    }
  });
  return { ...design, blocks };
}

export function renderEmailBuilderHtml(
  design: EmailBuilderDesign,
  brand: EmailBrandSettings | null,
): string {
  const bg = brand?.background_color || '#f9fafb';
  const bodyFont = brand?.body_font || brand?.default_font || 'Arial, Helvetica, sans-serif';

  const blocksHtml = design.blocks.length
    ? design.blocks.map((b) => renderBlock(b, brand)).join('\n')
    : `<tr><td style="padding:48px 30px;text-align:center;color:#9ca3af;font-family:${esc(bodyFont)};font-size:14px;">No content blocks added yet.</td></tr>`;

  return `<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
<html xmlns="http://www.w3.org/1999/xhtml" lang="en">
<head>
<meta http-equiv="Content-Type" content="text/html; charset=UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>Email</title>
<style type="text/css">
body{margin:0;padding:0;}
img{border:0;display:block;}
table{border-collapse:collapse;}
</style>
</head>
<body style="margin:0;padding:0;background-color:${esc(bg)};" bgcolor="${esc(bg)}">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${esc(bg)}" style="background-color:${esc(bg)};">
<tr><td align="center" style="padding:20px 10px;">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;width:100%;background-color:#ffffff;font-family:${esc(bodyFont)};">
${blocksHtml}
</table>
</td></tr>
</table>
</body>
</html>`;
}
