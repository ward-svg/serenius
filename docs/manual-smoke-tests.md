# Serenius Manual Smoke Tests

## Auth / Tenant Routing
- ward@serenius.org lands on /platform-admin.
- wardmac72@gmail.com lands on /platform-admin.
- ward@wsrv.org lands on /wellspring.
- ward@shorechristian.org lands on /shorechristian.
- Tenant admins do not see the Serenius Platform sidebar section.
- Tenant admins cannot access another tenant slug.
- Superadmins can access tenant routes by slug.
- Unauthenticated users are redirected to /login.

## Platform Admin
- Platform pages show Serenius platform branding.
- Tenant Admin dashboard loads.
- Switch Tenant page loads.
- Manage Tenant opens for a tenant.
- Plan/modules save successfully.
- Slug remains read-only.
- Tenant Admins section remains read-only unless intentionally changed.

## Tenant Setup
- Setup page loads.
- Organization tab loads.
- Branding fields render.
- Logo preview/upload still works where configured.
- Integrations tab loads.
- Storage integration page loads.
- Plan is not visible in tenant Setup.
- Modules tab is not visible in tenant Setup.
- ?tab=modules falls back safely.

## Partner Module
- Partner list loads.
- Partner detail opens.
- General info loads.
- Contacts load.
- Financial gifts load.
- Pledges load.
- In-Kind Gifts shows records when present.
- In-Kind Gifts empty state appears when no records.
- Existing In-Kind Gift opens read-only first.
- Edit mode has Back to View.
- Communications load.
- Shared files/attachments still work where enabled.
- Email interactions grid loads as read-only telemetry.

## Google Drive / Storage
- WellSpring storage status loads.
- WellSpring connected storage actions still work.
- Shore Christian Google Drive may remain blocked until the Google Cloud OAuth app is changed from Internal to External.
- No Google API calls are made from browser/client code.
- OAuth tokens are not exposed to client code.

## Branding / UI
- Login page uses Serenius brand styling.
- Platform routes use Serenius platform theme.
- Tenant routes use tenant theme.
- Sidebar background uses sidebar_background_color fallback chain.
- Tables use table-scroll where needed.
- Operational tables use leftmost ACTIONS column.

## Build / Deployment
- npm run lint passes or known lint issues are documented.
- npm run build passes locally.
- Main branch is clean before push.
- Vercel deploy completes successfully after push.
