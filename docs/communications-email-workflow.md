# Serenius Communications Email Workflow

**Status:** Planning / Architecture Reference  
**Last Updated:** May 2026  
**Audience:** App/UI agent, DB/import agent, Ward

This document captures product decisions, architecture boundaries, and implementation sequencing for the Serenius Communications email workflow. New email features must follow this document.

---

## 1. Product Boundary

Serenius is a ministry and nonprofit operations platform. It is **not** a generic email-list import or blast tool.

**Serenius will not support:**
- Importing arbitrary mailing lists or CSV contact files for marketing email.
- Sending to email addresses that are not connected to relational Partner Contact records.
- Anonymous subscriber lists.

**Serenius will support:**
- Marketing email campaigns sent to tenant Partner Contacts.
- Contacts are relational records linked to Partners, carrying segment, version, and suppression data.
- All recipient resolution happens from `partner_contacts`, not from uploaded address lists.

This boundary is intentional. It preserves data integrity, keeps email compliance tightly coupled to the donor relationship model, and avoids scope creep into generic ESP territory.

---

## 2. Current Implemented State (as of May 2026)

The following features are live in the application:

| Feature | Status |
|---|---|
| Communications campaign dashboard (`/[slug]/communications`) | Live |
| Campaign create / view / edit modal (`CampaignModal`) | Live |
| Campaign status filters (All, Draft/Building, In-Process/Ready, Completed, Failed/Canceled) | Live |
| Recipient estimate card (segment + version + suppression preview) | Live |
| Mail Sender setup under Setup → Integrations | Live |
| Google Workspace OAuth connect / disconnect | Live |
| `organization_mail_settings` table and connection status display | Live |
| `organization_mail_test_recipients` CRUD in Setup → Integrations | Live |
| Test-only Gmail send (`/api/mail/google/test-send`) | Live — requires `send_mode = test_only` or `live` |
| Test recipients list on Communications dashboard (read-only summary) | Live |
| `partner_email_suppressions` table | Live (schema only — no UI yet) |
| Campaign open tracking endpoint | **Not implemented** |
| Live / final campaign send | **Controlled — Test Emails segment only, cap 10** |
| Campaign template system | **Not implemented** |
| Brand Kit / Email Studio | **Not implemented** |
| Required footer renderer (`lib/mail/campaign-email-footer.ts`) | **Live — test and live sends** |
| Footer org identity fields in Brand Kit | **Live — UI input + save** |
| Opt-out redemption endpoint (`/mail/preferences/[token]`) | **Live — endpoint exists** |
| Opt-out token generation helper (`lib/mail/opt-out-tokens.ts`) | **Live** |
| Controlled live campaign send route (`/api/mail/google/campaign-live-send`) | **Live — Test Emails segment only, cap 10** |
| Suppression pre-check at live send time | **Live** |
| `campaign_live_send_authorized` field on `organization_mail_settings` | **Live — DB column exists** |
| Campaign live-send authorization UI (Communications → Delivery Setup) | **Live** |

**Mail Sender is a tenant-wide email conduit.** It is not campaign-specific infrastructure. The connected Google Workspace sender may be used by communications campaigns today, and by workflow emails, notifications, receipts, or other system emails in the future. Feature-specific safeguards (campaign readiness checks, segment gating, suppression, opt-out) belong inside those features — not in the global Mail Sender setup.

The setup test-send route (`/api/mail/google/test-send`) sends a basic plaintext + HTML verification message to active test recipients only. It does not send campaign content, does not append a footer, and does not exercise the opt-out system. It exists to validate OAuth credentials and delivery identity. Available in both Test only and Live mode (blocked only in Disabled mode).

**Mail sender `send_mode` values** (configured in Setup → Integrations, stored in `organization_mail_settings`):

| Value | Label | Behavior |
|---|---|---|
| `disabled` | Disabled | Outbound email is disabled for this tenant. Setup test send is also blocked. |
| `test_only` | Test only | Only configured test recipients can receive email through this sender. Campaign test sends require `send_mode IN ('test_only', 'live')`. |
| `live` | Live | Production email is allowed through this sender. Individual features may still require their own readiness checks. Campaign live send additionally requires `campaign_live_send_authorized = true`. Setup test send remains available. |

**`send_mode` is the primary user-facing control.** `is_enabled` is internal — it is derived from `send_mode` at save time (`disabled` → `false`; `test_only`/`live` → `true`) and is not shown in the setup UI.

**Live mode agreement:** Selecting Live in Setup → Integrations requires checking an explicit agreement checkbox before saving: "I understand Live mode allows this tenant to send production email through this connected sender. Individual features may apply additional safeguards." This agreement is not stored in the database — it must be re-confirmed each editing session. It acknowledges the tenant-wide change, not any specific feature.

The Send Mode dropdown in Setup → Integrations exposes all three values. Selecting Live does not bypass feature-level safeguards — the campaign live send route independently validates `send_mode === 'live'`, `segment === 'Test Emails'`, suppression checks, and recipient cap before sending.

**Campaign live-send authorization** (`campaign_live_send_authorized` on `organization_mail_settings`) is a separate, campaign-feature-level gate managed from **Communications → Delivery Setup** — not from the global Mail Sender setup page. It must be explicitly enabled by a `canManage` user via a confirmation checkbox before any campaign live send is permitted. It can also be revoked from that same screen. Test sends do not check this field — they require only `send_mode IN ('test_only', 'live')`.

---

## 3. Communications IA / Navigation Direction

The current Communications area structure:

```
/[slug]/communications
  ├── Campaigns          (current)
  ├── Templates          (current)
  ├── Image Gallery      (current)
  ├── Brand Kit          (current)
  ├── Delivery Setup     (current)
  ├── Metrics            (planned — future)
  └── Suppressions       (planned — future)
```

**Information architecture decisions:**

- **Mail Sender connection** belongs under **Setup → Integrations**. It is tenant infrastructure configuration that requires admin access and OAuth credentials. Marketing users should not need to reconfigure the mail provider to send campaigns. A **Delivery Setup** tab in Communications provides a read-only summary and link, keeping it accessible without duplicating configuration.
- **Templates, Image Gallery, and Brand Kit** belong under **Communications**, not Setup. Marketing staff must be able to manage email templates, images, and brand defaults without needing general Setup or admin access.
- **Image Gallery** is a top-level Communications tab for Public Email Assets (uploaded images used across campaigns, templates, and builder blocks). It is separate from Brand Kit so assets are discoverable independently of brand configuration. "Use as Logo" in Image Gallery immediately saves the selected URL to brand settings.
- **Suppressions / Opt-outs** belong under **Communications**. They are a compliance and deliverability concern tied directly to the campaign workflow, not to tenant system configuration.

---

## 4. Roles and Access Direction

Intended access model for Communications features. Do not implement permission changes now — document only.

| Role | Campaigns | Templates | Brand Kit | Metrics | Suppressions | Mail Sender (Setup) |
|---|---|---|---|---|---|---|
| `tenant_admin` | Full | Full | Full | Full | Full | Full |
| `marketing` | Full | Full | Full | Read | Read | None |
| `leadership` | Read / Approve | Read | Read | Read | None | None |
| `readonly` | Read | Read | None | Read | None | None |

Current enforcement: `canManage` is passed from the server component and gates create/edit actions. Role-based access expansion is a future slice — do not add permission infrastructure during template or brand kit work.

---

## 5. Campaign Recipient Rules

The following rules govern live send recipient resolution. These are not yet enforced at send time (live send is not enabled), but must be implemented before live sending is permitted.

**Source:**
- Recipients come from `partner_contacts` only.
- No external address lists. No ad hoc To: inputs.

**Required per contact:**
- `primary_email` must be present and non-empty.
- `contact.email_segment` (a `string[]`) must include the campaign's segment value as an exact match (`email_segment.includes(campaignSegment)`).

**Segment values:**
- Campaign segment is selected from `CAMPAIGN_SEGMENT_OPTIONS` in `modules/communications/constants.ts` — a controlled list of the individual strings assignable to `partner_contacts.email_segment`.
- Current options: `Donors`, `All US`, `Prospects`, `Staff`, `Test Emails`, `New Donor`, `New Prospect`, `iMessage Test`, `Mission Trips`.
- These match the `EMAIL_SEGMENT_OPTIONS` used in `ContactDetailModal` and `AddContactPanel` in the Partners module.
- Free-text segment entry was removed — campaigns must select from this list to avoid typo-driven targeting failures.
- Campaigns with a previously saved segment value not in the list display a "Saved: {value}" option and retain it until changed.

**Campaign version filtering:**
- Campaign version `A+B`: include contacts where `campaign_version` is `A` or `B`.
- Campaign version `A`: include only `campaign_version = A`.
- Campaign version `B`: include only `campaign_version = B`.
- `campaign_version = Skip`: always excluded regardless of campaign version setting.

**Suppression:**
- `partner_email_suppressions` must be checked before every send.
- Any contact email matching a suppression record (`unsubscribed`, `bounced`, `complained`, `manually_suppressed`, `invalid_email`) is excluded.
- Suppression check is case-insensitive on the email address.

**Communication preferences:**
- `communication_prefs` on `partner_contacts` may be honored once reliability is confirmed. Not blocking for initial live send implementation.

**Current state:**
- The `RecipientEstimateCard` in `CampaignModal` applies segment, version, and suppression logic for display purposes.
- The live send route (`/api/mail/google/campaign-live-send`) mirrors this logic exactly at send time: segment containment, version filter, `Skip` exclusion, suppression set check.
- Controlled live send is gated to the `Test Emails` segment only with a cap of 10 recipients.

---

## 6. Campaign Live Send Readiness Checklist and Send Button (Implemented)

The "Live Send" section card appears in Campaign View mode in `CampaignModal`. It shows readiness state and — when the segment is `Test Emails` — a "Send to Test Emails Segment" button. Three status states:

| Icon | State | Meaning |
|---|---|---|
| ✓ | Ready | Condition met |
| ○ | Needs attention | Not yet done, user can address now |
| — | Pending | Infrastructure not yet built |

**Checklist items:**

| Item | Field / Logic | State logic |
|---|---|---|
| Mail sender connected and enabled | `mailSettings.connection_status === 'connected' && is_enabled === true` | Ready / Needs |
| Send mode set to Live | `mailSettings.send_mode === 'live'` | Ready / Needs |
| Subject line present | `campaign.subject` non-empty | Ready / Needs |
| Email content present | `message_raw_html` or `message` non-empty | Ready / Needs |
| Segment set to "Test Emails" | `campaign.segment === 'Test Emails'` | Ready / Needs |
| Recipient estimate > 0 | `estimate` useMemo (segment + version + suppression) | Ready / Needs |
| Test email sent and verified | `campaign.message_status === 'Test Sent'` | Ready / Needs |
| Required footer / organization identity | `brandSettings.organization_name` + `mailing_address` both non-empty | Ready / Needs |
| Opt-out workflow | Per-recipient token generation at send time | Always Ready |
| Campaign live-send authorization | `mailSettings.campaign_live_send_authorized === true` | Ready / Needs — managed in Communications → Delivery Setup |

**Live send button:** Visible only when `campaign.segment === 'Test Emails'`. Enabled when all conditions above are met (including `campaign_live_send_authorized`) and campaign is not locked. Clicking opens a confirmation modal (showing subject + recipient count) before posting to `/api/mail/google/campaign-live-send`.

**On success:** Campaign `sending_status` → `Send Complete`, `message_status` → `Message Sent`, `email_sent_at` and `total_emails_sent` updated. Campaign becomes locked — no further edits or sends.

**On partial failure:** Job status recorded as `completed` only if all recipients succeeded. Campaign status is not updated on any failure — partial sends do not lock the campaign.

---

## 7. Required Footer and Opt-Out Workflow

Every campaign email sent to real recipients must include a required footer before live sending is enabled. This is non-negotiable for CAN-SPAM and nonprofit trust compliance.

### 7.1 Footer Renderer (Implemented)

`lib/mail/campaign-email-footer.ts` exports `buildCampaignEmailFooter(brandSettings, unsubscribeUrl)`.

**The required compliance footer is system-owned.** Organization identity (name, mailing address) and a working unsubscribe link are always included and cannot be removed. Tenants may adjust the unsubscribe wording via `unsubscribe_text` in Brand Kit, but Serenius always includes a working unsubscribe link in every live campaign email.

**Identity source:** `communication_email_brand_settings` — fields `organization_name`, `mailing_address`, `city`, `state`, `zip`, `country`, `unsubscribe_text`, `footer_html`.

**Footer styling:** Six style columns on `communication_email_brand_settings` control visual presentation within system guardrails: `footer_background_color`, `footer_text_color`, `footer_link_color` (all hex strings), `footer_font_size` (integer 11–16, DB CHECK constraint), `footer_divider_enabled` (boolean), `footer_divider_color` (hex). These are configurable in Brand Kit under "Required Email Footer → Footer Appearance."

**Safe defaults:** The renderer always falls back to safe defaults when style fields are null or empty: background `#f4f4f0`, text `#6b7280`, link `#3d5a80`, font size 12, divider enabled with color `#e5e7eb`. Brand Kit `settingsToForm` also applies these same defaults when reading DB values — null or blank values never fall through to black (`#000000`). This prevents invisible-on-invisible footer rendering.

**Brand Kit theme colors:** `communication_email_brand_settings` has five extended palette columns — `theme_color_1` through `theme_color_5` — with DB defaults `#98C1D9`, `#3D5A80`, `#293241`, `#4C5253`, `#E0FBFC`. These are editable in Brand Kit under a "Theme Colors" section (after Core Colors). Helper copy: "Theme colors appear as reusable swatches in the email builder." Null/empty values fall back to the DB defaults in `settingsToForm`.

**Builder color swatches:** `BrandColorField` (used for all 20 block-level color controls in Serenius Builder) renders a swatch strip below the chip+hex input. Swatches include the 6 core brand colors (primary, accent, button, button text, background, body text), the 5 theme colors (Theme Color 1–5), and 2 static fallbacks (white `#ffffff`, light gray `#f3f4f6`). All 13 are deduplicated case-insensitively — if two fields share the same hex, only the first swatch appears. Swatches show on hover as a `title` tooltip with their label name. Clicking a swatch immediately applies that color; manual hex entry in the text input is unchanged. The swatch strip is hidden when the field is disabled.

**Builder block font sizes:** All ten font-size number inputs in `BlockComposer` (header tagline, hero eyebrow/headline/subtitle, story text, highlight heading/body, CTA heading/body/button text) allow `min=2` `max=120` to support creative use cases such as captions, labels, fine print, and decorative micro-copy. Steps and default values are unchanged. The CTA `buttonTextSize` field is optional; existing blocks without it fall back to `15px` in the renderer — matching the previous hardcoded default. The required compliance footer font size remains guarded at `min=11` `max=16` in Brand Kit — that guardrail is enforced by the DB CHECK constraint and `BrandKitTab` validation and is entirely separate from builder block controls.

**Brand Kit save validation:** Before saving, the app validates hex format for all four footer color fields (background, text, link, divider-when-enabled) and blocks if any match would make content invisible: text==background, link==background, or (when divider enabled) divider==background. Font size must be 11–16. All five theme color fields are also validated as hex before save (no same-color blocking — duplicates are harmless and deduplicated in the builder). Clear inline errors direct the user to the specific field.

**Brand Kit footer preview:** Brand Kit includes a live footer preview rendered directly by `buildCampaignEmailFooter` in an iframe, using current unsaved form values. The preview updates as the user changes colors, font size, divider settings, and organization identity fields. The preview passes a `#` placeholder unsubscribe URL so the user can see the link color and placement; a note below the iframe explains that a unique opt-out link is generated per recipient at send time. The preview is inline, positioned below the Footer Appearance controls in the main form.

**Behavior:**
- The org identity block (name, address) and unsubscribe link (when `unsubscribeUrl` is provided) are always rendered in both HTML and plain text. These elements are system-enforced.
- If `footer_html` is set in Brand Kit, it is rendered as an **intro section** that appears before the required compliance block — it does not replace the org identity or unsubscribe link.
- If `unsubscribeUrl` is null (test sends, previews), no opt-out link is rendered — no fake link, no placeholder.
- The compliance block is generated from identity fields regardless of `footer_html`.

**Test send integration:**
- The campaign test-send route (`/api/mail/google/campaign-test-send`) loads `communication_email_brand_settings` and calls `buildCampaignEmailFooter(brandSettings, null)`.
- Test emails include: campaign content → test banner (amber) → organization footer (neutral, no live unsubscribe link).
- `buildCampaignTestEmailContent` accepts `brandFooter?: { html, text }` and appends it after the test banner.
- The test banner remains visible above the footer so recipients see the "test only" notice clearly.

**Live send:**
- The live-send route calls `createEmailOptOutToken` per recipient, then passes the returned `preferenceUrl` as `unsubscribeUrl` to `buildCampaignEmailFooter`.
- The footer renderer appends the org identity + working unsubscribe link to every live recipient email.
- The live-send route enforces that `organization_name` and `mailing_address` are present before sending (HTTP 400 if missing).

**Campaign previews:**
- Campaign View, Builder Edit, and Raw HTML Edit previews in `CampaignModal` all append the required footer using `buildCampaignEmailFooter(brandSettings, null)` (no live unsubscribe link).
- A preview label "Required email footer · Unsubscribe link generated per recipient at send time" appears below the footer in the preview iframe.
- Previews show the actual final email structure so users see the footer before sending.
- The footer is not stored inside `message_raw_html` or `design_json` — it is appended at render/send/preview time.
- **Brand Kit save → preview update:** `CommunicationsWorkspace` holds `brandSettings` in React state and passes it explicitly to `CommunicationsDashboard` (and therefore `CampaignModal`). After saving Brand Kit, campaign previews automatically reflect the updated footer styles — no page refresh required.
- **"Apply Brand Kit Defaults"** (in Serenius Builder) applies Brand Kit colors and logo to builder blocks only. It has no effect on the required compliance footer, which always uses current Brand Kit settings from the shared state.

### 7.2 Opt-Out Redemption Endpoint (Implemented)

**Route:** `app/mail/preferences/[token]/page.tsx` → `/mail/preferences/{rawToken}`

This is a public Server Component page — no authentication required. The raw token in the URL is the credential.

**Token redemption flow:**
1. Raw token extracted from URL param `[token]`.
2. Hashed with `sha256` via Node.js `crypto.createHash`. Raw token is never stored, logged, or compared directly.
3. Service-role Supabase client used for all queries (`createSupabaseServiceClient`) — `email_opt_out_tokens` RLS is superadmin-only.
4. Lookup `email_opt_out_tokens` where `token_hash = sha256(rawToken)`.
5. Four lookup outcomes:
   - **Not found** → "Invalid link." — no DB writes.
   - **Already used** (`used_at` is set) → idempotent "Already unsubscribed." — no DB writes.
   - **Expired** (`expires_at` is set and in the past) → "This link has expired." — no DB writes.
   - **Valid** → proceed with suppression write.

**Valid token behavior:**
- Check for existing `partner_email_suppressions` row (same `tenant_id` + `email` case-insensitive + `suppression_type`) to avoid duplicates on crash recovery.
- If no existing suppression: insert `partner_email_suppressions` with `source = 'email_opt_out'`, `reason = 'Recipient opted out via email link'`, `suppression_type` from token (default `unsubscribed`), `partner_contact_id` from token (nullable).
- Email address comes from `email_opt_out_tokens.email` (NOT NULL in schema) — no missing email issue.
- `partner_email_id` is NOT stored in `partner_email_suppressions` (no such column in schema).
- After suppression is written: mark `token.used_at = now()`. Suppression is written first — it is the safety-critical record.

**Security:**
- `noindex, nofollow` metadata — page not indexed by search engines.
- Raw token never appears in logs, DB selects, or responses.
- `token_hash` is not selected back from the DB.
- Recipient email is not displayed on the confirmation page.
- All four outcome messages are intentionally generic — no internal details exposed.

**What is still deferred:**
- Unsubscribe link injection into outbound campaign HTML (requires live send route).
- Preference center UI (preference management beyond simple opt-out).

**Test send guardrails (unchanged):**
- Test sends pass `unsubscribeUrl = null` to the footer renderer — no opt-out link in test emails.
- Test sends do not call `createEmailOptOutToken` and do not create `email_opt_out_tokens` rows.
- Test sends do not write suppression records.

**Nonprofit opt-out notifications:**
- Nonprofits may want to be alerted when a partner opts out, since it signals a relationship change.
- Future workflow: opt-out may trigger creation of a `partner_communications` log entry and/or a `partner_communication_followups` task assigned to the partner's staff contact.
- Do not implement this automatically — it requires user configuration.

### 7.3 Opt-Out Token Generation Helper (Implemented)

**File:** `lib/mail/opt-out-tokens.ts`

**Export:** `createEmailOptOutToken(params): Promise<{ tokenId, rawToken, tokenHash, preferenceUrl }>`

**Parameters:**
- `supabase` — service-role client (required; table has superadmin-only RLS)
- `tenantId` — required; validated before insert
- `email` — required; validated before insert
- `partnerContactId` — optional; stored on token row for suppression linkback
- `partnerEmailId` — optional; stored on token row for audit linkback
- `suppressionType` — default `'unsubscribed'`; enum: `unsubscribed | manually_suppressed | bounced | complained | invalid_email`
- `expiresAt` — default `null` (no expiration for standard unsubscribe links)
- `baseUrl` — optional; if provided, returns an absolute URL (`{baseUrl}/mail/preferences/{rawToken}`); otherwise returns a relative path

**Token generation:**
- `randomBytes(32).toString('hex')` — 256 bits of entropy, 64-char hex, URL-safe, no padding.
- `createHash('sha256').update(rawToken).digest('hex')` — only the hash is stored.
- Raw token is returned to the caller only; never stored, never logged.

**Collision handling:**
- `token_hash` has a `UNIQUE` constraint. On a `23505` Postgres error the helper retries up to 3 times with a fresh token. Any other DB error is thrown immediately (not swallowed). After 3 failed attempts, throws with a clear message.

**Preference URL:**
- Relative: `/mail/preferences/{rawToken}`
- Absolute (if `baseUrl` provided): `{baseUrl}/mail/preferences/{rawToken}` (trailing slash stripped from baseUrl)
- `preference_center_url` override from brand settings is deferred — the live send route will need to decide whether to use the Serenius-hosted path or a custom URL.

**Wiring status:**
- Called per-recipient in `/api/mail/google/campaign-live-send/route.ts`. Token generation failure for a contact aborts that recipient and records a `failed` audit row; the send loop continues for remaining contacts.
- Test send route does not call this helper (by design — no opt-out links in test emails).
- `baseUrl` is extracted from `request.url` in the live send route (`new URL(request.url)` → `${protocol}//${host}`).

### 7.4 Live Email Content Builder (Implemented)

`lib/mail/campaign-content.ts` exports `buildCampaignLiveEmailContent(input)`.

- No test banner — live emails go directly to real recipients.
- Inserts `brandFooter.html` before `</body>` if present, otherwise appends it.
- `{firstname}` resolved per-recipient via `resolveTestFirstName`.
- Plain text: `resolved + brandFooter.text`.
- Footer includes the real opt-out link because `preferenceUrl` (from `createEmailOptOutToken`) is passed as `unsubscribeUrl` to `buildCampaignEmailFooter` before calling this function.

---

## 7. Template and Brand Kit Direction

### 7.1 WellSpring Raw HTML Workflow

WellSpring currently uses externally generated raw HTML from a dedicated Claude/AI brand agent. This workflow is supported and should continue to be supported. The `message_raw_html` field on `partner_emails` stores the full HTML. `CampaignModal` renders it in a sandboxed iframe.

Serenius must append the required footer to this HTML at send time — it must not be embedded in the externally authored template.

### 7.2 Template System — Recommended Phases

Do not jump directly to a heavy WYSIWYG or drag-and-drop builder. Build in safe, incremental phases.

**Phase 1 — Template Library**
- Reusable HTML templates stored in a `email_templates` or `communication_email_templates` table.
- Templates use simple placeholder substitution (e.g. `{firstname}`). See Section 11 for the token standard.
- Marketing users can browse, preview, and select a template when creating a campaign.
- Templates can be edited as raw HTML by authorized users.
- WellSpring continues to paste raw HTML directly — templates are additive, not required.

**Phase 2 — Brand Kit / Email Studio**
- Tenant-level defaults stored in a `email_brand_settings` or `communication_email_brand_settings` table.
- Controls: email logo, primary/accent colors, footer text, mailing address, social links, donation button defaults, email signature block.
- Brand Kit values are injected into template placeholders and into the required footer at send time.
- Brand Kit is managed under Communications, not Setup.

### 7.3 Template Trash Lifecycle (Implemented)

Templates support a soft-delete / trash workflow. `communication_email_templates.deleted_at` is `NULL` for active templates and a timestamp when trashed.

**Trash rules:**
- Move to Trash: sets `deleted_at` to now and clears `is_default`. No confirmation required. Reversible.
- Restore: clears `deleted_at`. No confirmation required.
- Delete Permanently: hard deletes the row. Requires in-app confirmation modal. Cannot be undone.
- Empty Trash: hard deletes all trashed templates in one operation. Requires in-app confirmation modal.

**Effect on campaigns:**
- `partner_emails.template_id` is `ON DELETE SET NULL`. Hard-deleting a template nulls the reference but does not affect campaign content — campaigns hold an independent copy of template content at creation time.
- Trashed templates are excluded from the campaign creation template selector (`activeTemplates` filter in `CampaignModal`).

**TemplatesTab filter tabs:**
- **Available**: not trashed, status ≠ archived (default view)
- **Draft**: not trashed, status = draft
- **Active**: not trashed, status = active
- **Archived**: not trashed, status = archived
- **All**: not trashed (all statuses)
- **Trash**: deleted_at is set

Trashed templates are viewable but not editable (modal opens read-only regardless of `canManage`).

---

### 7.4 Create Campaign from Template (Implemented — Raw HTML and Serenius Builder)

Templates function as **launchpads**, not live-linked parents. Creating a campaign from a template copies the template's content into the new `partner_emails` row at creation time. After that point, the campaign and the template are fully independent:

- Later edits to the template do not affect existing campaigns that were created from it.
- Later edits to the campaign do not affect the original template.
- `partner_emails.template_id` records which template was used (nullable, SET NULL on template delete — for future reporting/analytics only).

**Template editing in TemplateModal:**
- Both Raw HTML and Serenius Builder templates can be created and edited in `TemplateModal`.
- For Builder templates (`email_style = "Rich Text"`): `design_json` is the editable source. `html_template` is saved as the rendered output of `renderEmailBuilderHtml(design_json, brandSettings)` at save time.
- For Raw HTML templates (`email_style = "Raw HTML"`): `html_template` is edited directly. `design_json` is preserved as-is (defaults to `{}`).
- Switching Content Mode in the editor changes the UI immediately: Builder shows `BlockComposer` with a live preview; Raw HTML shows the textarea.
- The modal expands to 1440px wide in Builder mode to accommodate the two-column layout.

**Campaign creation from template (copy-on-create):**
- `email_style`, `design_json`, and `html_template` are all copied from the template into the new campaign at creation time.
- For Builder templates: `email_style = "Rich Text"`, `design_json` is copied, `message_raw_html` is copied from `html_template` (the pre-rendered snapshot).
- `preheader_default` is not copied — `partner_emails` has no preheader column (deferred).
- After creation, the campaign and template are fully independent.

**Phase 3 — Simple Block Editor**
- Structured email layout stored as design JSON (blocks: header, text, image, button, divider, footer).
- Server renders design JSON to email-safe HTML at send time.
- No third-party editor dependency — a simple internal block system.
- Raw HTML override remains available for power users.

**Phase 4 — Richer Editor (if needed)**
- Evaluate only if Phase 3 proves insufficient for tenant needs.
- No third-party WYSIWYG packages without explicit approval.

---

## 8. Suggested Future Schema

The following tables are proposed for the DB/import agent to design and implement. **Do not write UI or app code that depends on these tables until the DB/import agent has confirmed and applied the schema and updated `docs/database/serenius_schema.md`.**

### `communication_email_templates` (or `email_templates`)
Stores reusable email templates per tenant.

Likely columns: `id`, `tenant_id`, `name`, `description`, `email_style` (Raw HTML / Block), `subject_default`, `html_content`, `design_json`, `is_active`, `created_by`, `created_at`, `updated_at`.

### `communication_email_brand_settings` (or `email_brand_settings`)
One row per tenant. Stores email brand defaults.

Likely columns: `id`, `tenant_id`, `logo_url`, `primary_color`, `accent_color`, `footer_text`, `mailing_address`, `donation_button_url`, `social_links` (jsonb), `signature_html`, `created_at`, `updated_at`.

### `email_template_versions` (optional)
Version history for templates if audit trail is needed.

### `email_send_jobs` (or `campaign_send_runs`)
One row per campaign send attempt. Tracks job status, batch progress, error state.

Likely columns: `id`, `tenant_id`, `campaign_id` (→ `partner_emails.id`), `send_type` (`test` / `live`), `status`, `recipient_count`, `sent_count`, `failed_count`, `started_at`, `completed_at`, `error_log`, `created_by`, `created_at`.

### `email_send_recipients` (optional, for per-recipient audit)
One row per recipient per send job. May be used for opt-out token storage if tokens are not a separate table.

Likely columns: `id`, `tenant_id`, `send_job_id`, `partner_contact_id`, `email`, `opt_out_token` (uuid, unique), `status` (`queued` / `sent` / `failed` / `skipped`), `sent_at`, `error`, `opted_out_at`.

### `email_opt_out_tokens` (alternative to embedding tokens in send recipients)
Standalone opt-out token table if a lighter approach is preferred.

Likely columns: `id`, `tenant_id`, `token` (uuid, unique), `email`, `partner_contact_id`, `campaign_id`, `redeemed_at`, `created_at`.

### Notes
- All tables require `tenant_id` and RLS.
- `email_send_recipients` or a token table must exist before live sending or footer opt-out links can be implemented.
- Schema changes must be applied by the DB/import agent. Do not proceed with UI implementation until confirmed schema is committed to `docs/database/serenius_schema.md`.

---

## 9. Public Email Asset Storage

Public media assets (images for email templates and campaigns) are uploaded through the Serenius server and served from `https://assets.serenius.app`.

**Architecture boundaries — never violate:**
- Browser clients never write directly to `assets.serenius.app`. All uploads go through `POST /api/communications/assets/upload`.
- SFTP credentials are server-side env vars only (`ASSETS_SFTP_HOST`, `ASSETS_SFTP_USER`, `ASSETS_SFTP_PASSWORD`, `ASSETS_SFTP_PORT`, `ASSETS_SFTP_BASE_PATH`). They are never returned to clients.
- Uploaded assets are public HTTPS files — anyone with the URL can access them. Do not upload private or sensitive content through this route.

**Allowed MIME types (v1):** image/jpeg · image/png · image/gif · image/webp

**Not allowed for tenant uploads:** image/svg+xml · text/html · application/javascript · anything not in the allowlist

**Public URL pattern:** `https://assets.serenius.app/t/{tenantSlug}/email/{assetId}/{safeFileName}`

**Metadata** is recorded in `communication_email_assets` after a confirmed SFTP upload. If the upload fails, no DB row is written.

---

## 10. Next Implementation Milestones

Recommended sequencing. Each milestone is a safe, shippable slice.

1. ~~**Template and Brand schema**~~ — ✅ Done. `communication_email_templates` and `communication_email_brand_settings` live. Schema doc updated.
2. ~~**Communications Templates tab shell**~~ — ✅ Done. Templates tab with full create/edit/trash lifecycle.
3. ~~**Brand Kit foundation**~~ — ✅ Done. Full brand settings form with logo, colors, typography, footer fields.
4. ~~**Campaign test send with campaign content**~~ — ✅ Done. `/api/mail/google/campaign-test-send` sends actual `message_raw_html` with per-recipient `{firstname}` token replacement (subject + body), amber test footer ("This is a test email. Opt-out links are not active."), `email_send_jobs` + `email_send_recipients` audit rows (`job_type/recipient_type = test`), no opt-out tokens, no suppression writes. Campaign `message_status` → "Test Sent" on full success.
5. ~~**Campaign readiness checklist**~~ — ✅ Done. "Live Send Readiness" section card in Campaign View mode. Checks: sender connected, subject present, content present, segment selected, recipient estimate > 0, test email sent. Required footer and opt-out workflow marked Pending until those slices are implemented. Live send button NOT added — checklist is informational only.
6. **Opt-out token model and suppression workflow** — DB/import agent adds send recipient or token table. Implement opt-out endpoint. Wire suppression write. Footer opt-out link becomes real.
7. **Live send job and batching** — Only after all above are complete and tested. Batch sending with per-recipient token injection, suppression pre-check, error logging to `email_send_jobs`.

---

## 10. Open Questions

These items need Ward's input before implementation proceeds:

- **Mailing address for footer:** Does WellSpring want to add a physical mailing address field to `organization_branding`, or manage it separately in `email_brand_settings`?
- **Opt-out notification:** Should opt-outs automatically create a `partner_communications` log entry or a follow-up task, or only create a suppression record and let staff notice it in the suppressions list?
- **Template ownership:** Will templates be created by Ward/Claude only (power-user workflow), or should marketing staff eventually be able to create and edit templates in the UI?
- **Send mode gate:** The current `send_mode` field has a `live` value. When live sending is enabled, should `send_mode = live` be the only gate, or is a separate per-campaign approval step needed (e.g., leadership approval before a campaign can move from Draft to Ready)?

---

## 11. Personalization Tokens

Serenius personalization tokens use **single curly braces**. Do not use double braces `{{}}`, square brackets `[]`, percent syntax `%`, or snake_case variants in user-facing guidance or templates.

**Format:** `{tokenname}`

**Supported V1 tokens:**

| Token | Description | Example usage |
|---|---|---|
| `{firstname}` | Recipient first name (from `partner_contacts.first_name`) | `Dear {firstname},` |

**Scope:** Tokens are supported in subject lines, Builder block content, Raw HTML content, and future template fields.

**Send-time behavior:** Token replacement is applied server-side at send time. Tokens in subject and body are replaced with the matched contact field value before delivery. If a contact has no first name, the token will be replaced with an empty string (future: a configurable fallback).

**Do not document or expose tokens not yet confirmed as supported.** Add entries to this table only when the send-time replacement logic is implemented and tested.
