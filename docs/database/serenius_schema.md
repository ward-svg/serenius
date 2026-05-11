# SERENIUS DATABASE SCHEMA
**Last Updated:** May 2026  
**Stack:** Supabase (PostgreSQL), RLS enabled on all tables  
**Auth:** Supabase Auth — `auth.users`  
**Multi-tenancy:** All tables scoped by `tenant_id` → `organizations.id`  
**PK Standard:** UUID (`gen_random_uuid()`) on all tables  
**Import Bridge:** `knack_id text unique` on all migrated tables  
**Updated At:** Managed by `public.set_updated_at()` trigger function  

---

## CORE INFRASTRUCTURE

---

### `public.organizations`
**Module:** Core Infrastructure  
**Description:** Top-level tenant records. One row per organization using Serenius.

| Column | Type | Constraints |
|--------|------|-------------|
| id | uuid | PRIMARY KEY |
| name | text | NOT NULL |
| slug | text | UNIQUE NOT NULL |
| plan | text | |
| created_at | timestamptz | DEFAULT now() |
| updated_at | timestamptz | DEFAULT now() |

**Record Count:** 2 (WellSpring, Shore Christian)  
**RLS:** Readable by all authenticated users  

---

### `public.organization_branding`
**Module:** Core Infrastructure  
**Description:** Per-tenant branding — colors, logos, CSS custom properties injected at runtime.

| Column | Type | Constraints |
|--------|------|-------------|
| id | uuid | PRIMARY KEY |
| tenant_id | uuid | NOT NULL → organizations.id |
| app_name | text | NOT NULL DEFAULT 'Serenius' |
| logo_url | text | nullable |
| favicon_url | text | nullable |
| primary_color | text | NOT NULL DEFAULT '#3D5A80' |
| secondary_color | text | NOT NULL DEFAULT '#98C1D9' |
| accent_color | text | NOT NULL DEFAULT '#EE6C4D' |
| alert_color | text | NOT NULL DEFAULT '#EE6C4D' |
| sidebar_color | text | NOT NULL DEFAULT '#293241' (legacy) |
| sidebar_background_color | text | nullable — overrides sidebar_color when set |
| font_heading | text | NOT NULL DEFAULT 'Inter' |
| font_body | text | NOT NULL DEFAULT 'Inter' |
| custom_css | text | nullable |
| created_at | timestamptz | NOT NULL DEFAULT now() |
| updated_at | timestamptz | NOT NULL DEFAULT now() |

**Record Count:** 2  
**RLS:** Readable by all authenticated users  
**Color fallback chain:** `sidebar_background_color` → `primary_color` → `sidebar_color` → default navy  

---

### `public.organization_settings`
**Module:** Core Infrastructure  
**Description:** Feature flags, module gating, and API keys per tenant.

| Column | Type | Constraints |
|--------|------|-------------|
| id | uuid | PRIMARY KEY |
| tenant_id | uuid | → organizations.id |
| modules_enabled | text[] | Array of enabled module names |
| google_maps_api_key | text | nullable |
| serenius_api_key | text | nullable |
| serenius_api_key_generated_at | timestamptz | nullable |
| created_at | timestamptz | DEFAULT now() |
| updated_at | timestamptz | DEFAULT now() |

**Record Count:** 2  
**RLS:** Tenant isolation  

---

### `public.organization_mail`
**Module:** Core Infrastructure  
**Description:** Per-tenant outbound email configuration.

| Column | Type | Constraints |
|--------|------|-------------|
| id | uuid | PRIMARY KEY |
| tenant_id | uuid | → organizations.id |
| from_name | text | |
| from_email | text | |
| reply_to | text | |
| created_at | timestamptz | DEFAULT now() |
| updated_at | timestamptz | DEFAULT now() |

**Record Count:** 2  
**RLS:** Tenant isolation  

---

### `public.organization_storage_settings`
**Module:** Core Infrastructure / Setup  
**Description:** Organization-wide storage connector configuration. One row per tenant. Provider change requires assisted migration.

| Column | Type | Constraints |
|--------|------|-------------|
| id | uuid | PRIMARY KEY |
| tenant_id | uuid | NOT NULL → organizations.id CASCADE DELETE · UNIQUE |
| provider | text | NOT NULL DEFAULT 'google_drive' · CHECK ('google_drive', 'onedrive', 'dropbox', 's3') |
| display_name | text | nullable |
| root_folder_id | text | nullable |
| root_folder_url | text | nullable |
| is_enabled | boolean | NOT NULL DEFAULT false |
| connection_status | text | NOT NULL DEFAULT 'manual' · CHECK ('manual', 'connected', 'error', 'disabled') |
| locked_at | timestamptz | nullable |
| locked_by | uuid | → auth.users.id · nullable |
| connected_at | timestamptz | nullable |
| connected_by | uuid | → auth.users.id · nullable |
| created_at | timestamptz | NOT NULL DEFAULT now() |
| updated_at | timestamptz | NOT NULL DEFAULT now() |

**Record Count:** 0 (seeded per tenant on Setup)  
**Indexes:** tenant_id · provider · (tenant_id, provider)  
**RLS:** SELECT — all tenant members · INSERT/UPDATE/DELETE — tenant_admin + superadmin  
**No OAuth token columns** — tokens live in `organization_storage_credentials`  

---

### `public.organization_storage_credentials`
**Module:** Core Infrastructure / Setup  
**Security:** ⚠️ SENSITIVE — OAuth token material. Normal authenticated users CANNOT read this table.

| Column | Type | Constraints |
|--------|------|-------------|
| id | uuid | PRIMARY KEY |
| tenant_id | uuid | NOT NULL → organizations.id CASCADE DELETE |
| provider | text | NOT NULL DEFAULT 'google_drive' · CHECK ('google_drive', 'onedrive', 'dropbox', 's3') |
| access_token | text | nullable · SENSITIVE |
| refresh_token | text | nullable · SENSITIVE |
| token_type | text | nullable |
| scope | text | nullable |
| expiry_date | timestamptz | nullable |
| external_account_email | text | nullable (display only) |
| external_account_name | text | nullable (display only) |
| created_at | timestamptz | NOT NULL DEFAULT now() |
| updated_at | timestamptz | NOT NULL DEFAULT now() |
| | | UNIQUE (tenant_id, provider) |

**Record Count:** 0  
**Indexes:** tenant_id · (tenant_id, provider) · provider  
**RLS:** superadmin-only policy. Service role bypasses for OAuth routes.  
**Do NOT expose via:** views · client-facing generated types · anon key API routes  

---

### `public.user_profiles`
**Module:** Core Infrastructure  
**Description:** Maps Supabase auth users to tenants. Links to user_roles for permissions. `is_admin` was dropped — role system handles all permissions.

| Column | Type | Constraints |
|--------|------|-------------|
| id | uuid | PRIMARY KEY |
| user_id | uuid | → auth.users.id UNIQUE |
| tenant_id | uuid | → organizations.id (null = platform admin) |
| created_at | timestamptz | DEFAULT now() |
| updated_at | timestamptz | DEFAULT now() |

**Record Count:** 2  
**RLS:** Users see only their own profile  

**Live identity model (source of truth):**

| Email | profile.id | tenant_id | Role |
|-------|------------|-----------|------|
| ward@wsrv.org | 11de2b20-52fd-4330-83a5-d99bf0478865 | 00000000-0000-0000-0000-000000000001 | tenant_admin |
| wardmac72@gmail.com | cdb5a02d-72a3-4bb6-8885-313bdcc4ce62 | null | superadmin |

**Architecture rules — never violate:**
- Tenant admins: `user_profiles.tenant_id` = org id · `user_roles.tenant_id` = org id
- Platform superadmin: `user_profiles.tenant_id` = null · `user_roles.tenant_id` = null
- Never assign `tenant_id` to the platform superadmin account
- Never assign superadmin to a tenant-scoped account
- Do not mix tenant_admin and superadmin on the same account unless explicitly requested

---

### `public.roles`
**Module:** Core Infrastructure / Setup  
**Description:** Global platform-managed role definitions. Shared across all tenants.

| Column | Type | Constraints |
|--------|------|-------------|
| id | uuid | PRIMARY KEY |
| name | text | UNIQUE NOT NULL |
| description | text | |
| is_active | boolean | DEFAULT true |
| created_at | timestamptz | DEFAULT now() |
| updated_at | timestamptz | DEFAULT now() |

**Record Count:** 14  
**RLS:** Readable by all authenticated users · Writable by superadmin only  
**Seeded roles:** superadmin · tenant_admin · leadership · accounting · donor_management · project_management · marketing · family_connect · program_leadership · house_parent · house_assistant · empowerment · readonly · volunteer  

---

### `public.user_roles`
**Module:** Core Infrastructure / Setup  
**Description:** Junction table mapping users to roles within a tenant. A user can have multiple roles. `tenant_id = null` = platform-level role.

| Column | Type | Constraints |
|--------|------|-------------|
| id | uuid | PRIMARY KEY |
| user_id | uuid | NOT NULL → user_profiles.id CASCADE DELETE |
| tenant_id | uuid | → organizations.id CASCADE DELETE (null = platform-level) |
| role_id | uuid | NOT NULL → roles.id CASCADE DELETE |
| created_at | timestamptz | DEFAULT now() |
| | | UNIQUE (user_id, tenant_id, role_id) |

**Record Count:** 2 (ward@wsrv.org — tenant_admin/WellSpring · wardmac72@gmail.com — superadmin/null)  
**Indexes:** user_id · tenant_id · role_id  
**RLS:** Users see own assignments · tenant_admin/superadmin manage their scope  

---

### `public.record_attachments`
**Module:** Core Infrastructure (shared across all modules)  
**Description:** Generic polymorphic attachment metadata. Files live in tenant's configured storage provider. Serenius stores metadata and links only.

| Column | Type | Constraints |
|--------|------|-------------|
| id | uuid | PRIMARY KEY |
| tenant_id | uuid | NOT NULL → organizations.id CASCADE DELETE |
| record_type | text | NOT NULL · CHECK trim ≠ '' |
| record_id | uuid | NOT NULL · no FK (polymorphic by design) |
| storage_provider | text | NOT NULL DEFAULT 'google_drive' · CHECK ('google_drive', 'onedrive', 'dropbox', 's3') |
| provider_file_id | text | nullable |
| provider_folder_id | text | nullable |
| file_name | text | NOT NULL · CHECK trim ≠ '' |
| file_url | text | nullable |
| mime_type | text | nullable |
| file_size_bytes | bigint | nullable · CHECK ≥ 0 |
| description | text | nullable |
| metadata | jsonb | NOT NULL DEFAULT '{}' |
| uploaded_by | uuid | → auth.users.id SET NULL |
| created_at | timestamptz | NOT NULL DEFAULT now() |
| updated_at | timestamptz | NOT NULL DEFAULT now() |

**Record Count:** 0  
**Indexes:** tenant_id · (tenant_id, record_type, record_id) · storage_provider · uploaded_by · created_at DESC  
**RLS:** All tenant members can read/insert/update/delete · superadmin sees all  
**Current record_type values:** partner · partner_contact · partner_communication · partner_in_kind_gift · partner_statement · financial_gift · pledge · partner_email  
**Future record_type values:** family_connect · resident · child · export · document  

---

## PARTNERS MODULE

---

### `public.partners`
**Module:** Partners  
**Description:** Primary donor/partner records. One record per giving family or church organization.

| Column | Type | Constraints |
|--------|------|-------------|
| id | uuid | PRIMARY KEY |
| tenant_id | uuid | NOT NULL → organizations.id CASCADE DELETE |
| knack_id | text | UNIQUE |
| display_name | text | NOT NULL |
| entity_name | text | |
| correspondence_greeting | text | |
| external_id | text | |
| partner_type | text | CHECK ('Family', 'Church') |
| partner_status | text | CHECK ('Active', 'Past') |
| relationship_type | text | CHECK ('Donor', 'Prospect') |
| primary_email | text | |
| primary_phone | text | |
| secondary_phone | text | |
| address_street | text | |
| address_street2 | text | |
| address_city | text | |
| address_state | text | |
| address_zip | text | |
| address_country | text | |
| notes | text | |
| assigned_to | uuid | → user_profiles.id SET NULL (nullable) |
| created_by | uuid | → auth.users.id |
| created_at | timestamptz | DEFAULT now() |
| updated_at | timestamptz | DEFAULT now() |

**Record Count:** 64  
**Indexes:** tenant_id · knack_id · (tenant_id, assigned_to)  
**RLS:** Tenant isolation  
**Referenced By:** partner_contacts · pledges · financial_gifts · partner_statements · partner_in_kind_gifts · partner_communications · partner_email_opens  
**UI Pattern:** `assigned_to` renders as a staff dropdown — query `select id, display_name from user_profiles where tenant_id = current_tenant_id()`  

---

### `public.partner_contacts`
**Module:** Partners  
**Description:** Individual people linked to a partner. Multiple contacts per partner (husband, wife, adult children, etc.)

| Column | Type | Constraints |
|--------|------|-------------|
| id | uuid | PRIMARY KEY |
| tenant_id | uuid | NOT NULL → organizations.id CASCADE DELETE |
| partner_id | uuid | → partners.id CASCADE DELETE |
| knack_id | text | UNIQUE (original WSRV Record ID) |
| first_name | text | |
| last_name | text | |
| display_name | text | |
| nickname | text | |
| gender | text | CHECK ('Male', 'Female') |
| marital_status | text | |
| relationship | text | CHECK ('Self', 'Husband', 'Wife', 'Son') |
| email_segment | text[] | ARRAY — multi-select |
| communication_prefs | text[] | ARRAY — multi-select |
| primary_email | text | |
| secondary_email | text | |
| primary_phone | text | |
| primary_phone_type | text | |
| secondary_phone | text | |
| secondary_phone_type | text | |
| birthday | date | |
| anniversary | date | |
| address_street | text | |
| address_street2 | text | |
| address_city | text | |
| address_state | text | |
| address_zip | text | |
| address_latitude | numeric(10,7) | |
| address_longitude | numeric(10,7) | |
| clone_primary_address | boolean | DEFAULT false |
| campaign_version | text | CHECK ('A', 'B', 'Skip') |
| display_financial_data | boolean | DEFAULT false |
| text_message | text | |
| source_notes | text | |
| notes | text | |
| created_by | uuid | → auth.users.id |
| created_at | timestamptz | DEFAULT now() |
| updated_at | timestamptz | DEFAULT now() |

**Record Count:** 85  
**Indexes:** tenant_id · partner_id · knack_id  
**RLS:** Tenant isolation  
**email_segment values:** 'Donors, All US' · 'Prospects' · 'Staff' · 'Test Emails' · 'New Donor' · 'New Prospect' · 'iMessage Test' · 'Mission Trips'  
**Future FKs:** family_connect_id → family_connect.id · sponsored_children → residents.id  
**Referenced By:** partner_email_opens.partner_contact_id  

---

### `public.pledges`
**Module:** Partners  
**Description:** Recurring giving commitments from a partner. 'Increased' status = new pledge replaced this one at a higher amount — preserves audit trail.

| Column | Type | Constraints |
|--------|------|-------------|
| id | uuid | PRIMARY KEY |
| tenant_id | uuid | NOT NULL → organizations.id CASCADE DELETE |
| partner_id | uuid | → partners.id SET NULL |
| knack_id | text | UNIQUE |
| pledge_type | pledge_type_enum | ('Rescue Care', 'House Sponsor', 'General Fund', 'Pathways Sponsorship') |
| status | pledge_status_enum | ('Active', 'Completed', 'Canceled', 'Increased', 'On Hold') DEFAULT 'Active' |
| frequency | pledge_frequency_enum | ('Monthly', 'Quarterly', 'Annually', 'One Time') |
| pledge_amount | numeric(10,2) | NOT NULL CHECK > 0 |
| number_of_payments | integer | |
| annualized_value | numeric(10,2) | GENERATED ALWAYS (pledge_amount × payments/year) |
| start_date | date | |
| end_date | date | |
| on_hold_until | date | |
| house_knack_id | text | placeholder → houses.id |
| resident_knack_id | text | placeholder → residents.id |
| notes | text | |
| created_by | uuid | → auth.users.id |
| created_at | timestamptz | DEFAULT now() |
| updated_at | timestamptz | DEFAULT now() |

**Record Count:** 13  
**Indexes:** tenant_id · partner_id · status  
**RLS:** Tenant isolation  
**Referenced By:** financial_gifts.pledge_id  

---

### `public.financial_gifts`
**Module:** Partners  
**Description:** Individual gift transactions. May be linked to a pledge or standalone.

| Column | Type | Constraints |
|--------|------|-------------|
| id | uuid | PRIMARY KEY |
| tenant_id | uuid | NOT NULL → organizations.id CASCADE DELETE |
| partner_id | uuid | → partners.id SET NULL |
| pledge_id | uuid | → pledges.id SET NULL (null = standalone gift) |
| gl_master_account_id | uuid | → gl_master_accounts.id SET NULL |
| gl_sub_account_id | uuid | → gl_sub_accounts.id SET NULL |
| knack_id | text | UNIQUE |
| date_given | date | NOT NULL |
| amount | numeric(10,2) | NOT NULL CHECK > 0 |
| fee_donation | numeric(10,2) | DEFAULT 0 |
| base_gift | numeric(10,2) | GENERATED ALWAYS (amount - fee_donation) |
| processing_source | processing_source_type | ('Check', 'Stripe - Website', 'Authorize - Website', 'Paypal', 'Venmo', 'Gift In-Kind/New', 'Wire Transfer', 'Zelle') |
| towards | gift_towards_type | ('General Fund', 'Rescue Care', 'Child Sponsorship', 'Mission Trip', 'Girls Empowerment', 'Hope Matching Campaign', 'Land/Building Project', 'Other - See Notes') |
| towards_active_pledge | boolean | DEFAULT false |
| giving_year | smallint | |
| deposit_status | deposit_status_type | ('Completed', 'Historical') |
| bank_deposit | text | placeholder → bank_deposits.id |
| notes | text | |
| created_by | uuid | → auth.users.id |
| created_at | timestamptz | DEFAULT now() |
| updated_at | timestamptz | DEFAULT now() |

**Record Count:** 258  
**Indexes:** tenant_id · partner_id · pledge_id · gl_master_account_id · gl_sub_account_id · date_given · giving_year  
**RLS:** Tenant isolation  
**Linked gifts:** 184 linked to a pledge · 74 standalone  
**Future FKs:** bank_deposit → bank_deposits.id  

---

### `public.partner_statements`
**Module:** Partners  
**Description:** Annual giving statement packages per partner. Each record holds links to 3 Google Drive documents for one year.

| Column | Type | Constraints |
|--------|------|-------------|
| id | uuid | PRIMARY KEY |
| tenant_id | uuid | NOT NULL → organizations.id CASCADE DELETE |
| partner_id | uuid | → partners.id SET NULL |
| knack_id | text | UNIQUE (original Serenity Record ID) |
| year | smallint | NOT NULL |
| total_giving | numeric(10,2) | historical rollup (future: compute from financial_gifts) |
| intro_letter_url | text | |
| intro_letter_label | text | e.g. "Jim and Linda McMillen 2025 Intro Letter" |
| giving_report_url | text | |
| giving_report_label | text | |
| combined_statement_url | text | |
| combined_statement_label | text | |
| created_by | uuid | → auth.users.id |
| created_at | timestamptz | DEFAULT now() |
| updated_at | timestamptz | DEFAULT now() |

**Record Count:** 28  
**Indexes:** tenant_id · partner_id · year  
**RLS:** Tenant isolation  
**UI Pattern:** `<a href={url}>{label}</a>` — fall back to column name if label is null  

---

### `public.partner_in_kind_gifts`
**Module:** Partners  
**Description:** Non-cash gifts donated by a partner.

| Column | Type | Constraints |
|--------|------|-------------|
| id | uuid | PRIMARY KEY |
| tenant_id | uuid | NOT NULL → organizations.id CASCADE DELETE |
| partner_id | uuid | → partners.id SET NULL |
| knack_id | text | UNIQUE |
| description | text | |
| notes | text | |
| estimated_value | numeric(10,2) | |
| condition_type | inkind_gift_condition | ('New', 'Like New', 'Good', 'Fair', 'Poor') |
| asset_status | inkind_asset_status | ('Awaiting Transfer', 'Transferred', 'In Use', 'Disposed') |
| date_given | date | |
| date_transferred | date | |
| quantity | integer | nullable |
| location_notes | text | nullable |
| received_by | text | nullable |
| created_by | uuid | → auth.users.id |
| created_at | timestamptz | DEFAULT now() |
| updated_at | timestamptz | DEFAULT now() |

**Record Count:** 5  
**Indexes:** tenant_id · partner_id · date_given · (tenant_id, partner_id, date_given DESC)  
**RLS:** Tenant isolation  
**Future FK:** asset_id → assets.id *(In-Kind/Assets module)*  

---

### `public.partner_communications`
**Module:** Partners  
**Description:** Logged communication interactions with a partner. Supports follow-up task assignment to other staff.

| Column | Type | Constraints |
|--------|------|-------------|
| id | uuid | PRIMARY KEY |
| tenant_id | uuid | NOT NULL → organizations.id CASCADE DELETE |
| partner_id | uuid | → partners.id SET NULL |
| knack_id | text | UNIQUE |
| communication_type | comm_type_enum | ('Thank You For...', 'House Update', 'Program Update', 'Request') |
| communication_channel | comm_channel_enum | ('Email - Broadcast', 'Email - Personal', 'Face to Face', 'Phone Call', 'Small Group', 'Text') |
| communication_date | date | |
| notes | text | |
| followup_needed | boolean | DEFAULT false — legacy field |
| followup_due | date | |
| followup_notes | text | |
| followup_complete | boolean | DEFAULT false |
| completion_notes | text | |
| completion_date | date | |
| file_attachment_name | text | |
| file_attachment_url | text | |
| created_by | uuid | → auth.users.id |
| created_at | timestamptz | DEFAULT now() |
| updated_at | timestamptz | DEFAULT now() |

**Record Count:** 1  
**Indexes:** tenant_id · partner_id · communication_date · partial index on open follow-ups  
**RLS:** Tenant isolation  
**Referenced By:** partner_communication_followups.communication_id  

---

### `public.partner_communication_followups`
**Module:** Partners  
**Description:** Assigned follow-up tasks spawned from a communication. Allows delegation to other staff. One communication can have multiple tasks.

| Column | Type | Constraints |
|--------|------|-------------|
| id | uuid | PRIMARY KEY |
| tenant_id | uuid | NOT NULL → organizations.id CASCADE DELETE |
| communication_id | uuid | NOT NULL → partner_communications.id CASCADE DELETE |
| action_type | followup_action_enum | ('Send Thank You', 'Send Email', 'Mail Letter', 'Make Phone Call', 'Send Form', 'Schedule Visit', 'Other') |
| instructions | text | |
| assigned_to | uuid | → user_profiles.id SET NULL |
| assigned_by | uuid | → auth.users.id SET NULL |
| due_date | date | |
| completed | boolean | DEFAULT false |
| completed_at | timestamptz | |
| completion_notes | text | |
| created_at | timestamptz | DEFAULT now() |
| updated_at | timestamptz | DEFAULT now() |

**Record Count:** 0  
**Indexes:** tenant_id · communication_id · assigned_to · partial index on open tasks  
**RLS:** Tenant isolation  
**UI Pattern:** "My Tasks" — query where `assigned_to = current user profile id AND completed = false`  

---

### `public.partner_emails`
**Module:** Partners / Communications  
**Description:** Broadcast email campaign records — Serenius's built-in email system. One record per email send. Media attachments stored as JSONB array. HTML content stored as text; new workflow uses `record_attachments` for HTML files.

| Column | Type | Constraints |
|--------|------|-------------|
| id | uuid | PRIMARY KEY |
| tenant_id | uuid | NOT NULL → organizations.id CASCADE DELETE |
| knack_id | text | UNIQUE (WSRV Record ID integer) |
| knack_email_id | text | Knack MongoDB object ID — links to opens |
| sending_status | email_sending_status | ('Draft', 'In-Process', 'Send Complete', 'Canceled') |
| message_status | email_message_status | ('Test Email', 'Test Sent', 'Message Sent') |
| communication_type | email_communication_type | ('Ministry Update', 'New Donor', 'New Prospect', 'iMessage') |
| email_style | email_style_type | ('Raw HTML', 'Rich Text') |
| sent_type | email_sent_type | ('Final Communication') |
| segment | text | audience segment name |
| campaign_version | text | CHECK ('A', 'B', 'A+B') |
| subject | text | |
| message | text | rich text / editor content |
| message_raw_html | text | full HTML for rendering |
| html_file_name | text | legacy Knack HTML file name |
| html_file_url | text | legacy Knack HTML file URL |
| media_attachments | jsonb | DEFAULT '[]' — array of {order, filename, url} |
| number_of_attachments | integer | DEFAULT 0 |
| delivery_datetime | timestamptz | scheduled delivery time |
| email_sent_at | timestamptz | actual send timestamp |
| total_emails_sent | integer | recipient count |
| sent_to_bot | text | Knack automation flag |
| original_opens | integer | DEFAULT 0 — historical rollup from Knack |
| total_touches | integer | DEFAULT 0 — historical rollup from Knack |
| clear_partner_emails | text | Knack workflow field |
| created_by | uuid | → auth.users.id |
| created_at | timestamptz | DEFAULT now() |
| updated_at | timestamptz | DEFAULT now() |

**Record Count:** 38  
**Indexes:** tenant_id · knack_email_id · (tenant_id, sending_status) · delivery_datetime  
**RLS:** Tenant isolation  
**Referenced By:** partner_email_opens.partner_email_id  
**Media pattern:** `media_attachments` jsonb array for historical Knack data · new workflow uses `record_attachments` table  
**HTML pattern:** Upload HTML file → store via `record_attachments` → UI fetches and renders preview  

---

### `public.partner_email_opens`
**Module:** Partners / Communications  
**Description:** Individual delivery + open tracking per contact per email. One row per contact per email send. `first_opened = null` = delivered but never opened. `partner_contact_id` null for contacts with knack_id > 85 — backfillable via Knack API using `knack_contact_id`.

| Column | Type | Constraints |
|--------|------|-------------|
| id | uuid | PRIMARY KEY |
| tenant_id | uuid | NOT NULL → organizations.id CASCADE DELETE |
| partner_email_id | uuid | → partner_emails.id SET NULL |
| partner_id | uuid | → partners.id SET NULL |
| partner_contact_id | uuid | → partner_contacts.id SET NULL (null for unmatched contacts) |
| knack_id | text | UNIQUE (WSRV ID integer) |
| knack_compute_id | text | Knack composite key (email_id:contact_id:timestamp) |
| knack_email_id | text | Knack MongoDB email object ID |
| knack_contact_id | text | WSRV integer — stored for future partner_contact_id backfill |
| knack_record_id | text | Knack hidden UUID record ID |
| campaign_message | text | subject / campaign name at send time |
| sent_at | timestamptz | |
| first_opened | timestamptz | null = delivered not opened |
| last_opened | timestamptz | |
| open_count | integer | DEFAULT 0 |
| user_agent | text | |
| user_country | text | |
| user_ip_address | text | |
| created_at | timestamptz | DEFAULT now() |
| updated_at | timestamptz | DEFAULT now() |

**Record Count:** 492  
**Indexes:** tenant_id · partner_email_id · partner_id · partner_contact_id · sent_at · knack_email_id · partial index on opened records only  
**RLS:** Tenant isolation  
**Open stats:** 267 opened · 225 delivered never opened  
**Backfill path:** `knack_contact_id` → Knack API → `partner_contacts.knack_id` → populate `partner_contact_id`  

---

## GL / FINANCIAL CONFIGURATION

---

### `public.gl_master_accounts`
**Module:** Banking/Finance (config)  
**Description:** Parent-level chart of accounts. Each tenant manages their own set.

| Column | Type | Constraints |
|--------|------|-------------|
| id | uuid | PRIMARY KEY |
| tenant_id | uuid | NOT NULL → organizations.id CASCADE DELETE |
| knack_id | text | UNIQUE |
| number | text | NOT NULL |
| name | text | NOT NULL |
| account | text | GENERATED ALWAYS (number \|\| ' - ' \|\| name) |
| type | gl_account_type | ('Income', 'Expense') NOT NULL |
| description | text | |
| available_to | text | ('US', 'Zambia', 'US, Zambia') |
| is_active | boolean | DEFAULT true |
| created_by | uuid | → auth.users.id |
| created_at | timestamptz | DEFAULT now() |
| updated_at | timestamptz | DEFAULT now() |

**Record Count:** 15  
**Indexes:** tenant_id · (tenant_id, number)  
**RLS:** Tenant isolation  
**Referenced By:** gl_sub_accounts · financial_gifts · gift_category_settings  

---

### `public.gl_sub_accounts`
**Module:** Banking/Finance (config)  
**Description:** Child-level accounts linked to a master. Budget tracking lives here. Actuals computed via queries.

| Column | Type | Constraints |
|--------|------|-------------|
| id | uuid | PRIMARY KEY |
| tenant_id | uuid | NOT NULL → organizations.id CASCADE DELETE |
| gl_master_account_id | uuid | → gl_master_accounts.id SET NULL |
| knack_id | text | UNIQUE |
| number | text | NOT NULL |
| name | text | NOT NULL |
| account | text | GENERATED ALWAYS (number \|\| ' - ' \|\| name) |
| type | gl_account_type | ('Income', 'Expense') NOT NULL |
| description | text | |
| available_to | text | |
| program_group | gl_program_group | ('Program', 'Administrative') |
| budget_2024 | numeric(12,2) | |
| budget_2025 | numeric(12,2) | |
| budget_2025_quarterly | numeric(12,2) | |
| is_active | boolean | DEFAULT true |
| created_by | uuid | → auth.users.id |
| created_at | timestamptz | DEFAULT now() |
| updated_at | timestamptz | DEFAULT now() |

**Record Count:** 106  
**Indexes:** tenant_id · gl_master_account_id · (tenant_id, number)  
**RLS:** Tenant isolation  
**Referenced By:** financial_gifts · gift_category_settings  

---

### `public.gift_category_settings`
**Module:** Partners / Banking/Finance (config)  
**Description:** Tenant-level config mapping gift "towards" categories to GL accounts. Auto-populates GL fields when a gift is recorded.

| Column | Type | Constraints |
|--------|------|-------------|
| id | uuid | PRIMARY KEY |
| tenant_id | uuid | NOT NULL → organizations.id CASCADE DELETE |
| category_name | text | NOT NULL · UNIQUE (tenant_id, category_name) |
| gl_master_account_id | uuid | → gl_master_accounts.id SET NULL |
| gl_sub_account_id | uuid | → gl_sub_accounts.id SET NULL |
| is_active | boolean | DEFAULT true |
| sort_order | integer | DEFAULT 0 |
| created_by | uuid | → auth.users.id |
| created_at | timestamptz | DEFAULT now() |
| updated_at | timestamptz | DEFAULT now() |

**Record Count:** 10 (WellSpring seed)  
**RLS:** Tenant isolation  
**Seeded categories:** Child Sponsorship · General Fund · Girls Empowerment · Hope Matching Campaign · House Sponsor · Land/Building Project · Mission Trip · Other - See Notes · Pathways Sponsorship · Rescue Care  
**All mapped to:** 20000 - Direct Contributions Revenue / 20100 - Individual Contributions  

---

## RELATIONSHIP MAP

```
organizations
  ├── user_profiles                     (tenant_id)
  │     └── user_roles                  (user_id)
  │           └── roles                 (role_id)
  ├── organization_branding             (tenant_id)
  ├── organization_settings             (tenant_id)
  ├── organization_mail                 (tenant_id)
  ├── organization_storage_settings     (tenant_id)
  ├── organization_storage_credentials  (tenant_id)
  ├── record_attachments                (tenant_id — polymorphic)
  ├── partners                          (tenant_id)
  │     ├── partner_contacts            (partner_id)
  │     │     └── partner_email_opens   (partner_contact_id)
  │     ├── pledges                     (partner_id)
  │     │     └── financial_gifts       (pledge_id — nullable)
  │     ├── financial_gifts             (partner_id)
  │     ├── partner_statements          (partner_id)
  │     ├── partner_in_kind_gifts       (partner_id)
  │     ├── partner_communications      (partner_id)
  │     │     └── partner_communication_followups (communication_id)
  │     └── partner_email_opens         (partner_id)
  ├── partner_emails                    (tenant_id)
  │     └── partner_email_opens         (partner_email_id)
  ├── gl_master_accounts                (tenant_id)
  │     └── gl_sub_accounts             (gl_master_account_id)
  └── gift_category_settings            (tenant_id)
        ├── → gl_master_accounts        (gl_master_account_id)
        └── → gl_sub_accounts           (gl_sub_account_id)

financial_gifts
  ├── → partners                        (partner_id)
  ├── → pledges                         (pledge_id — nullable)
  ├── → gl_master_accounts              (gl_master_account_id)
  └── → gl_sub_accounts                 (gl_sub_account_id)
```

---

## FUTURE FK PLACEHOLDERS

| Table | Column | Future Reference | Module |
|-------|--------|-----------------|--------|
| financial_gifts | bank_deposit (text) | bank_deposits.id | Banking |
| pledges | house_knack_id (text) | houses.id | Resident Care |
| pledges | resident_knack_id (text) | residents.id | Resident Care |
| partner_contacts | family_connect (text) | family_connect.id | Family Connect |
| partner_contacts | sponsored_children (text) | residents.id | Resident Care |
| partner_in_kind_gifts | asset_id (commented out) | assets.id | In-Kind/Assets |
| partner_email_opens | partner_contact_id (partial) | backfill via Knack API | — |

---

## ENUM TYPES

| Type | Values |
|------|--------|
| gl_account_type | Income · Expense |
| gl_program_group | Program · Administrative |
| pledge_type_enum | Rescue Care · House Sponsor · General Fund · Pathways Sponsorship |
| pledge_frequency_enum | Monthly · Quarterly · Annually · One Time |
| pledge_status_enum | Active · Completed · Canceled · Increased · On Hold |
| processing_source_type | Check · Stripe - Website · Authorize - Website · Paypal · Venmo · Gift In-Kind/New · Wire Transfer · Zelle |
| gift_towards_type | General Fund · Rescue Care · Child Sponsorship · Mission Trip · Girls Empowerment · Hope Matching Campaign · Land/Building Project · Other - See Notes |
| deposit_status_type | Completed · Historical |
| inkind_gift_condition | New · Like New · Good · Fair · Poor |
| inkind_asset_status | Awaiting Transfer · Transferred · In Use · Disposed |
| comm_type_enum | Thank You For... · House Update · Program Update · Request |
| comm_channel_enum | Email - Broadcast · Email - Personal · Face to Face · Phone Call · Small Group · Text |
| followup_action_enum | Send Thank You · Send Email · Mail Letter · Make Phone Call · Send Form · Schedule Visit · Other |
| email_sending_status | Draft · In-Process · Send Complete · Canceled |
| email_message_status | Test Email · Test Sent · Message Sent |
| email_communication_type | Ministry Update · New Donor · New Prospect · iMessage |
| email_style_type | Raw HTML · Rich Text |
| email_sent_type | Final Communication |

---

## RECORD COUNTS SUMMARY

| Table | Records |
|-------|---------|
| organizations | 2 |
| organization_branding | 2 |
| organization_settings | 2 |
| organization_mail | 2 |
| organization_storage_settings | 0 |
| organization_storage_credentials | 0 |
| user_profiles | 1 |
| roles | 14 |
| user_roles | 1 |
| record_attachments | 0 |
| partners | 64 |
| partner_contacts | 85 |
| pledges | 13 |
| financial_gifts | 258 |
| partner_statements | 28 |
| partner_in_kind_gifts | 5 |
| partner_communications | 1 |
| partner_communication_followups | 0 |
| partner_emails | 38 |
| partner_email_opens | 492 |
| gl_master_accounts | 15 |
| gl_sub_accounts | 106 |
| gift_category_settings | 10 |
| **TOTAL** | **1,140** |

---

## HELPER FUNCTIONS

| Function | Returns | Purpose |
|----------|---------|---------|
| `public.has_role(role_name text)` | boolean | Check if current auth user has a specific role |
| `public.current_tenant_id()` | uuid | Get current auth user's tenant_id from user_profiles |
| `public.set_updated_at()` | trigger | Auto-update updated_at on any table |

---

## PLATFORM STANDARDS

```
PK:             uuid PRIMARY KEY DEFAULT gen_random_uuid()
Tenant scope:   tenant_id uuid NOT NULL REFERENCES organizations(id)
Import bridge:  knack_id text UNIQUE (on all migrated tables)
Timestamps:     created_at timestamptz DEFAULT now()
                updated_at timestamptz DEFAULT now()
                updated_at trigger: public.set_updated_at()
Created by:     created_by uuid REFERENCES auth.users(id)
RLS standard:   tenant_id = public.current_tenant_id()
                OR public.has_role('superadmin')
Admin access:   has_role('superadmin') — platform-wide
                has_role('tenant_admin') — org-level config writes
Sensitive:      service role only + superadmin policy
                (organization_storage_credentials)
Dollar-quoting: Use $HTML$...$HTML$ for large HTML text fields
                to safely handle embedded single quotes
```
