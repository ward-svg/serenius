import type { EmailBrandSettings } from './types';
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

  const taglineFont = (block.taglineFontRole ?? 'body') === 'heading' ? headingFont : bodyFont;
  const taglineSize = typeof block.taglineSize === 'number' ? block.taglineSize : 13;
  const taglineColor = block.taglineColor || brand?.button_text_color || '#ffffff';

  const taglineHtml = block.tagline
    ? `<p style="margin:6px 0 0;font-size:${taglineSize}px;color:${esc(taglineColor)};font-family:${esc(taglineFont)};${taglineOffsetStyle}">${esc(block.tagline)}</p>`
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
  const eyebrowFont = (block.eyebrowFontRole ?? 'body') === 'heading' ? headingFont : bodyFont;
  const headlineColor = block.headlineColor || textColorFallback;
  const headlineFont = (block.headlineFontRole ?? 'heading') === 'heading' ? headingFont : bodyFont;
  const subtitleColor = block.subtitleColor || textColorFallback;
  const subtitleFont = (block.subtitleFontRole ?? 'body') === 'heading' ? headingFont : bodyFont;

  const parts: string[] = [];
  if (block.eyebrow) {
    parts.push(`<p style="margin:0 0 8px;font-size:${eyebrowSize}px;font-family:${esc(eyebrowFont)};color:${esc(eyebrowColor)};${eyebrowUppercase ? 'text-transform:uppercase;' : ''}letter-spacing:0.1em;font-weight:600;">${esc(block.eyebrow)}</p>`);
  }
  if (block.headline) {
    parts.push(`<h1 style="margin:0 0 12px;font-size:${headlineSize}px;font-family:${esc(headlineFont)};color:${esc(headlineColor)};font-weight:700;line-height:1.2;">${esc(block.headline)}</h1>`);
  }
  if (block.subtitle) {
    parts.push(`<p style="margin:0;font-size:${subtitleSize}px;font-family:${esc(subtitleFont)};color:${esc(subtitleColor)};line-height:1.5;">${esc(block.subtitle)}</p>`);
  }

  return `<tr>
  <td bgcolor="${esc(bg)}" style="background-color:${esc(bg)};padding:${paddingY}px 30px;" align="${align}">
    ${parts.join('')}
  </td>
</tr>`;
}

function renderStory(block: StoryBlock, brand: EmailBrandSettings | null): string {
  const bg = block.backgroundColor || '#ffffff';
  const color = block.textColor || brand?.text_color || '#111827';
  const headingFont = brand?.heading_font || brand?.default_font || "Georgia, 'Times New Roman', serif";
  const bodyFont = brand?.body_font || brand?.default_font || 'Arial, Helvetica, sans-serif';
  const font = (block.fontRole ?? 'body') === 'heading' ? headingFont : bodyFont;
  const textSize = typeof block.textSize === 'number' ? block.textSize : 15;
  const align = block.alignment || 'left';
  const paddingY = typeof block.paddingY === 'number' ? block.paddingY : 24;
  const content = (block.content || '').trim();

  const paragraphs = content
    ? content
        .split(/\n\n+/)
        .map(
          (p) =>
            `<p style="margin:0 0 14px;font-size:${textSize}px;font-family:${esc(font)};color:${esc(color)};line-height:1.6;">${esc(p).replace(/\n/g, '<br>')}</p>`,
        )
        .join('')
    : `<p style="margin:0;font-size:${textSize}px;font-family:${esc(font)};color:#9ca3af;">No content.</p>`;

  return `<tr>
  <td bgcolor="${esc(bg)}" style="background-color:${esc(bg)};padding:${paddingY}px 30px;text-align:${align};">
    ${paragraphs}
  </td>
</tr>`;
}

function renderHighlight(block: HighlightBlock, brand: EmailBrandSettings | null): string {
  const brandHeadingFont = brand?.heading_font || brand?.default_font || "Georgia, 'Times New Roman', serif";
  const brandBodyFont = brand?.body_font || brand?.default_font || 'Arial, Helvetica, sans-serif';
  const bgColor = block.backgroundColor || brand?.accent_color || '#e8f0fe';
  const accentColor = block.accentColor || brand?.primary_color || '#1a56db';
  const textColor = block.textColor || brand?.text_color || '#111827';
  const hFont = (block.headingFontRole ?? 'heading') === 'heading' ? brandHeadingFont : brandBodyFont;
  const bFont = (block.bodyFontRole ?? 'body') === 'heading' ? brandHeadingFont : brandBodyFont;
  const align = block.alignment || 'left';
  // Preserve current per-variant sizes for old blocks that lack these fields
  const headingSizeFallback = block.variant === 'quote' ? 12 : block.variant === 'list' ? 17 : 16;
  const bodySizeFallback = block.variant === 'quote' ? 15 : 14;
  const headingSize = typeof block.headingSize === 'number' ? block.headingSize : headingSizeFallback;
  const bodySize = typeof block.bodySize === 'number' ? block.bodySize : bodySizeFallback;
  const paddingYFallback = block.variant === 'list' ? 24 : 16;
  const paddingY = typeof block.paddingY === 'number' ? block.paddingY : paddingYFallback;
  const items = block.items.filter(Boolean);

  if (block.variant === 'quote') {
    return `<tr>
  <td style="padding:${paddingY}px 30px;background-color:#ffffff;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
      <td style="border-left:4px solid ${esc(accentColor)};padding:12px 20px;background-color:${esc(bgColor)};text-align:${align};">
        ${block.heading ? `<p style="margin:0 0 6px;font-size:${headingSize}px;font-weight:700;font-family:${esc(hFont)};color:${esc(accentColor)};text-transform:uppercase;letter-spacing:0.05em;">${esc(block.heading)}</p>` : ''}
        ${block.body ? `<p style="margin:0;font-size:${bodySize}px;font-family:${esc(bFont)};color:${esc(textColor)};line-height:1.6;font-style:italic;">${esc(block.body)}</p>` : ''}
      </td>
    </tr></table>
  </td>
</tr>`;
  }

  if (block.variant === 'list') {
    const listBg = block.backgroundColor || '#ffffff';
    const listHtml = items.length
      ? `<ul style="margin:8px 0 0;padding:0 0 0 20px;">${items.map((i) => `<li style="margin:0 0 6px;font-size:${bodySize}px;font-family:${esc(bFont)};color:${esc(textColor)};line-height:1.5;">${esc(i)}</li>`).join('')}</ul>`
      : '';
    return `<tr>
  <td bgcolor="${esc(listBg)}" style="background-color:${esc(listBg)};padding:${paddingY}px 30px;text-align:${align};">
    ${block.heading ? `<p style="margin:0 0 10px;font-size:${headingSize}px;font-weight:700;font-family:${esc(hFont)};color:${esc(textColor)};">${esc(block.heading)}</p>` : ''}
    ${block.body ? `<p style="margin:0 0 8px;font-size:${bodySize}px;font-family:${esc(bFont)};color:${esc(textColor)};line-height:1.5;">${esc(block.body)}</p>` : ''}
    ${listHtml}
  </td>
</tr>`;
  }

  // callout
  const itemsHtml = items.length
    ? `<ul style="margin:10px 0 0;padding:0 0 0 18px;">${items.map((i) => `<li style="font-size:${bodySize}px;font-family:${esc(bFont)};color:${esc(textColor)};margin:0 0 4px;">${esc(i)}</li>`).join('')}</ul>`
    : '';
  return `<tr>
  <td style="padding:${paddingY}px 30px;background-color:#ffffff;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
      <td style="background-color:${esc(bgColor)};border:1px solid #d1d5db;border-radius:8px;padding:20px 24px;text-align:${align};">
        ${block.heading ? `<p style="margin:0 0 8px;font-size:${headingSize}px;font-weight:700;font-family:${esc(hFont)};color:${esc(accentColor)};">${esc(block.heading)}</p>` : ''}
        ${block.body ? `<p style="margin:0;font-size:${bodySize}px;font-family:${esc(bFont)};color:${esc(textColor)};line-height:1.6;">${esc(block.body)}</p>` : ''}
        ${itemsHtml}
      </td>
    </tr></table>
  </td>
</tr>`;
}

function renderCta(block: CtaBlock, brand: EmailBrandSettings | null): string {
  const brandHeadingFont = brand?.heading_font || brand?.default_font || "Georgia, 'Times New Roman', serif";
  const brandBodyFont = brand?.body_font || brand?.default_font || 'Arial, Helvetica, sans-serif';
  const bg = block.backgroundColor || '#ffffff';
  const panelBg = block.accentColor || brand?.accent_color || '#e8f0fe';
  const accentText = block.accentColor || brand?.primary_color || '#1a56db';
  const textColor = block.textColor || brand?.text_color || '#111827';
  const btnBg = block.buttonColor || brand?.button_color || brand?.primary_color || '#1a56db';
  const btnTxt = block.buttonTextColor || brand?.button_text_color || '#ffffff';
  const hFont = (block.headingFontRole ?? 'heading') === 'heading' ? brandHeadingFont : brandBodyFont;
  const bFont = (block.bodyFontRole ?? 'body') === 'heading' ? brandHeadingFont : brandBodyFont;
  const align = block.alignment || 'center';
  // Preserve current per-variant sizes for old blocks that lack these fields
  const headingSizeFallback = block.variant === 'panel' ? 18 : 17;
  const headingSize = typeof block.headingSize === 'number' ? block.headingSize : headingSizeFallback;
  const bodySize = typeof block.bodySize === 'number' ? block.bodySize : 14;
  const paddingYFallback = block.variant === 'panel' ? 16 : 24;
  const paddingY = typeof block.paddingY === 'number' ? block.paddingY : paddingYFallback;
  const href = safeUrl(block.buttonUrl || brand?.default_donation_url || '');
  const items = block.items.filter(Boolean);

  const btnHtml = block.buttonText
    ? `<a href="${esc(href)}" style="display:inline-block;background-color:${esc(btnBg)};color:${esc(btnTxt)};font-family:${esc(bFont)};font-size:15px;font-weight:700;padding:12px 28px;text-decoration:none;border-radius:6px;">${esc(block.buttonText)}</a>`
    : '';

  if (block.variant === 'button') {
    return `<tr>
  <td bgcolor="${esc(bg)}" style="background-color:${esc(bg)};padding:${paddingY}px 30px;text-align:${align};">
    ${block.heading ? `<p style="margin:0 0 8px;font-size:${headingSize}px;font-weight:700;font-family:${esc(hFont)};color:${esc(textColor)};">${esc(block.heading)}</p>` : ''}
    ${block.body ? `<p style="margin:0 0 16px;font-size:${bodySize}px;font-family:${esc(bFont)};color:${esc(textColor)};line-height:1.5;">${esc(block.body)}</p>` : ''}
    ${btnHtml}
  </td>
</tr>`;
  }

  if (block.variant === 'offer') {
    const itemsHtml = items.length
      ? `<ul style="margin:0 0 16px;padding:0;list-style:none;">${items.map((i) => `<li style="font-size:${bodySize}px;font-family:${esc(bFont)};color:${esc(textColor)};margin:0 0 4px;">${esc(i)}</li>`).join('')}</ul>`
      : '';
    return `<tr>
  <td bgcolor="${esc(bg)}" style="background-color:${esc(bg)};padding:${paddingY}px 30px;text-align:${align};">
    ${block.heading ? `<p style="margin:0 0 8px;font-size:${headingSize}px;font-weight:700;font-family:${esc(hFont)};color:${esc(textColor)};">${esc(block.heading)}</p>` : ''}
    ${block.amount ? `<p style="margin:0 0 8px;font-size:36px;font-weight:800;font-family:${esc(hFont)};color:${esc(accentText)};">${esc(block.amount)}</p>` : ''}
    ${block.body ? `<p style="margin:0 0 16px;font-size:${bodySize}px;font-family:${esc(bFont)};color:${esc(textColor)};line-height:1.5;">${esc(block.body)}</p>` : ''}
    ${itemsHtml}
    ${btnHtml}
  </td>
</tr>`;
  }

  // panel
  const itemsHtml = items.length
    ? `<ul style="margin:0 0 16px;padding:0 0 0 18px;">${items.map((i) => `<li style="font-size:${bodySize}px;font-family:${esc(bFont)};color:${esc(textColor)};margin:0 0 4px;">${esc(i)}</li>`).join('')}</ul>`
    : '';
  return `<tr>
  <td style="padding:${paddingY}px 30px;background-color:#ffffff;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
      <td style="background-color:${esc(panelBg)};border-radius:8px;padding:24px;text-align:${align};">
        ${block.heading ? `<p style="margin:0 0 8px;font-size:${headingSize}px;font-weight:700;font-family:${esc(hFont)};color:${esc(accentText)};">${esc(block.heading)}</p>` : ''}
        ${block.body ? `<p style="margin:0 0 16px;font-size:${bodySize}px;font-family:${esc(bFont)};color:${esc(textColor)};line-height:1.5;">${esc(block.body)}</p>` : ''}
        ${itemsHtml}
        ${btnHtml}
      </td>
    </tr></table>
  </td>
</tr>`;
}

function renderImageBlock(block: ImageBlock, brand: EmailBrandSettings | null): string {
  const bg = block.backgroundColor || '#ffffff';
  const paddingY = typeof block.paddingY === 'number' ? block.paddingY : 24;
  const paddingX = typeof block.paddingX === 'number' ? block.paddingX : 30;
  const borderColorVal = block.borderColor || brand?.accent_color || '#e5e7eb';
  const borderStyle = block.borderStyle || 'none';
  const borderCss = borderStyle === 'thin'
    ? `1px solid ${esc(borderColorVal)}`
    : borderStyle === 'medium'
    ? `2px solid ${esc(borderColorVal)}`
    : '';
  const roundedCorners = block.roundedCorners || 'small';
  const radiusMap: Record<string, string> = { none: '0', small: '6px', medium: '12px', large: '18px' };
  const radius = radiusMap[roundedCorners] ?? '6px';
  const layout = block.layout || 'one';
  const images = block.images || [];
  const imgDecor = `${borderCss ? `border:${borderCss};` : ''}${radius !== '0' ? `border-radius:${radius};` : ''}`;

  if (layout === 'one') {
    const slot = images[0];
    const singleImageSize = block.singleImageSize || 'large';
    const widthMap: Record<string, { px: number; stylePx: string }> = {
      small:  { px: 280, stylePx: 'width:280px;max-width:280px;' },
      medium: { px: 420, stylePx: 'width:420px;max-width:420px;' },
      large:  { px: 560, stylePx: 'width:560px;max-width:560px;' },
      full:   { px: 600, stylePx: 'width:100%;max-width:640px;' },
    };
    const sizeConf = widthMap[singleImageSize] ?? widthMap['large'];
    if (!slot?.url || safeUrl(slot.url) === '#') {
      return `<tr>\n  <td bgcolor="${esc(bg)}" style="background-color:${esc(bg)};padding:${paddingY}px ${paddingX}px;"></td>\n</tr>`;
    }
    const imgStyle = `display:block;margin:0 auto;${sizeConf.stylePx}${imgDecor}`;
    const imgHtml = `<img src="${esc(safeUrl(slot.url))}" width="${sizeConf.px}" alt="${esc(slot.altText || '')}" style="${imgStyle}">`;
    return `<tr>
  <td bgcolor="${esc(bg)}" style="background-color:${esc(bg)};padding:${paddingY}px ${paddingX}px;" align="center">
    ${imgHtml}
  </td>
</tr>`;
  }

  const count = layout === 'two' ? 2 : 3;
  const gutter = 8;
  const cellWidthPct = layout === 'two' ? '50%' : '33.33%';
  const cells = Array.from({ length: count }, (_, i) => {
    const slot = images[i];
    const isLast = i === count - 1;
    const tdStyle = `vertical-align:top;width:${cellWidthPct};${isLast ? '' : `padding-right:${gutter}px;`}`;
    if (!slot?.url || safeUrl(slot.url) === '#') {
      return `<td style="${tdStyle}"></td>`;
    }
    const imgStyle = `display:block;width:100%;max-width:100%;${imgDecor}`;
    return `<td style="${tdStyle}"><img src="${esc(safeUrl(slot.url))}" alt="${esc(slot.altText || '')}" style="${imgStyle}"></td>`;
  });

  return `<tr>
  <td bgcolor="${esc(bg)}" style="background-color:${esc(bg)};padding:${paddingY}px ${paddingX}px;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
      ${cells.join('\n      ')}
    </tr></table>
  </td>
</tr>`;
}

function renderDivider(block: DividerBlock, brand: EmailBrandSettings | null): string {
  const bg = block.backgroundColor || '#ffffff';
  const lineColor = block.lineColor || brand?.accent_color || '#e5e7eb';
  const lineStyle = block.lineStyle || 'solid';
  const lineWidth = block.lineWidth || 'full';
  const alignment = block.alignment || 'center';
  const thickness = typeof block.thickness === 'number' ? block.thickness : 1;
  const paddingY = typeof block.paddingY === 'number' ? block.paddingY : 16;

  const widthPct = lineWidth === 'third' ? '33%' : lineWidth === 'half' ? '50%' : '100%';
  const marginStyle = alignment === 'center' ? 'margin:0 auto;' : alignment === 'right' ? 'margin:0 0 0 auto;' : '';

  return `<tr>
  <td bgcolor="${esc(bg)}" style="background-color:${esc(bg)};padding:${paddingY}px 30px;">
    <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="${widthPct}" style="width:${widthPct};${marginStyle}"><tr>
      <td style="font-size:0;line-height:0;border-top:${thickness}px ${esc(lineStyle)} ${esc(lineColor)};">&nbsp;</td>
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
    case 'image': return renderImageBlock(block, brand);
    case 'divider': return renderDivider(block, brand);
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
          taglineColor: brand.button_text_color || block.taglineColor,
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
          accentColor: brand.accent_color || block.accentColor,
          textColor: brand.text_color || block.textColor,
          buttonColor: brand.button_color || brand.primary_color || block.buttonColor,
          buttonTextColor: brand.button_text_color || block.buttonTextColor,
          buttonUrl: block.buttonUrl || brand.default_donation_url || '',
        };
      case 'story':
        return {
          ...block,
          textColor: brand.text_color || block.textColor,
        };
      case 'highlight':
        return {
          ...block,
          backgroundColor: brand.accent_color || block.backgroundColor,
          accentColor: brand.primary_color || block.accentColor,
          textColor: brand.text_color || block.textColor,
        };
      case 'image':
        return {
          ...block,
          borderColor: brand.accent_color || block.borderColor,
          backgroundColor: block.backgroundColor || brand.background_color || '#ffffff',
        };
      case 'divider':
        return {
          ...block,
          lineColor: brand.accent_color || block.lineColor,
        };
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
