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
| Test-only Gmail send (`/api/mail/google/test-send`) | Live — requires `send_mode = test_only` |
| Test recipients list on Communications dashboard (read-only summary) | Live |
| `partner_email_suppressions` table | Live (schema only — no UI yet) |
| Campaign open tracking endpoint | **Not implemented** |
| Live / final campaign send | **Not enabled** |
| Campaign template system | **Not implemented** |
| Brand Kit / Email Studio | **Not implemented** |
| Required footer / opt-out workflow | **Not implemented** |

The test-send route (`/api/mail/google/test-send`) sends a basic plaintext + HTML verification message to active test recipients only. It does not send campaign content, does not append a footer, and does not exercise the opt-out system. It exists to validate OAuth credentials and connectivity.

---

## 3. Communications IA / Navigation Direction

The intended Communications area structure:

```
/[slug]/communications
  ├── Campaigns          (current)
  ├── Templates          (planned — Phase 1)
  ├── Brand Kit          (planned — Phase 2)
  ├── Metrics            (planned — future)
  └── Suppressions       (planned — future)
```

**Information architecture decisions:**

- **Mail Sender connection** belongs under **Setup → Integrations**. It is tenant infrastructure configuration that requires admin access and OAuth credentials. Marketing users should not need to reconfigure the mail provider to send campaigns.
- **Templates and Brand Kit** belong under **Communications**, not Setup. Marketing staff must be able to manage email templates and brand defaults without needing general Setup or admin access.
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
- `email_segment` must include the campaign's segment value.

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
- The `RecipientEstimateCard` in `CampaignModal` already applies segment, version, and suppression logic for display purposes.
- This estimate logic must be mirrored exactly in the server-side send route when live sending is implemented.

---

## 6. Required Footer and Opt-Out Workflow

Every campaign email sent to real recipients must include a required footer before live sending is enabled. This is non-negotiable for CAN-SPAM and nonprofit trust compliance.

**Footer requirements:**
- Organization name and address (from `organization_branding` or a future mailing address field).
- Opt-out / manage preferences link.
- The link must be tenant-scoped and contact-scoped (a unique token per recipient per send).

**Opt-out mechanics:**
- Opt-out link click must write a suppression record to `partner_email_suppressions` with `suppression_type = unsubscribed`.
- Suppression is by email address, optionally linked to `partner_contact_id`.
- The opt-out endpoint must be anonymous (no auth required — the token is the credential).
- Token model: a unique per-recipient token generated at send time, stored in a future send audit or opt-out token table, resolved on click.

**Nonprofit opt-out notifications:**
- Nonprofits may want to be alerted when a partner opts out, since it signals a relationship change.
- Future workflow: opt-out may trigger creation of a `partner_communications` log entry and/or a `partner_communication_followups` task assigned to the partner's staff contact.
- Do not implement this automatically — it requires user configuration.

**Test email guardrails:**
- Test emails sent to `organization_mail_test_recipients` must display a clear banner: "This is a test email. Opt-out links are not active."
- Opt-out tokens must not be generated for test sends until a real opt-out token model exists.
- Test sends must not write suppression records.

---

## 7. Template and Brand Kit Direction

### 7.1 WellSpring Raw HTML Workflow

WellSpring currently uses externally generated raw HTML from a dedicated Claude/AI brand agent. This workflow is supported and should continue to be supported. The `message_raw_html` field on `partner_emails` stores the full HTML. `CampaignModal` renders it in a sandboxed iframe.

Serenius must append the required footer to this HTML at send time — it must not be embedded in the externally authored template.

### 7.2 Template System — Recommended Phases

Do not jump directly to a heavy WYSIWYG or drag-and-drop builder. Build in safe, incremental phases.

**Phase 1 — Template Library**
- Reusable HTML templates stored in a `email_templates` or `communication_email_templates` table.
- Templates use simple placeholder substitution (`{{organization_name}}`, `{{first_name}}`, etc.).
- Marketing users can browse, preview, and select a template when creating a campaign.
- Templates can be edited as raw HTML by authorized users.
- WellSpring continues to paste raw HTML directly — templates are additive, not required.

**Phase 2 — Brand Kit / Email Studio**
- Tenant-level defaults stored in a `email_brand_settings` or `communication_email_brand_settings` table.
- Controls: email logo, primary/accent colors, footer text, mailing address, social links, donation button defaults, email signature block.
- Brand Kit values are injected into template placeholders and into the required footer at send time.
- Brand Kit is managed under Communications, not Setup.

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

1. **Template and Brand schema** — DB/import agent designs and applies `communication_email_templates` and `communication_email_brand_settings`. Schema doc updated.
2. **Communications Templates tab shell** — Read-only listing of templates. No edit UI yet. Establishes the navigation tab.
3. **Brand Kit foundation** — Form to manage `email_brand_settings` for the tenant. Logo, colors, footer address, social links.
4. **Campaign test send with campaign content** — Update test-send route to use actual campaign HTML (`message_raw_html`) plus a clearly labeled test footer ("This is a test — opt-out links are not active."). No real opt-out tokens yet.
5. **Campaign readiness checklist** — Add a checklist panel to `CampaignModal` before any send action: mail sender connected, send mode correct, test recipients configured, subject present, HTML content present, recipient estimate > 0.
6. **Opt-out token model and suppression workflow** — DB/import agent adds send recipient or token table. Implement opt-out endpoint. Wire suppression write. Footer opt-out link becomes real.
7. **Live send job and batching** — Only after all above are complete and tested. Batch sending with per-recipient token injection, suppression pre-check, error logging to `email_send_jobs`.

---

## 10. Open Questions

These items need Ward's input before implementation proceeds:

- **Mailing address for footer:** Does WellSpring want to add a physical mailing address field to `organization_branding`, or manage it separately in `email_brand_settings`?
- **Opt-out notification:** Should opt-outs automatically create a `partner_communications` log entry or a follow-up task, or only create a suppression record and let staff notice it in the suppressions list?
- **Template ownership:** Will templates be created by Ward/Claude only (power-user workflow), or should marketing staff eventually be able to create and edit templates in the UI?
- **Send mode gate:** The current `send_mode` field has a `live` value. When live sending is enabled, should `send_mode = live` be the only gate, or is a separate per-campaign approval step needed (e.g., leadership approval before a campaign can move from Draft to Ready)?
