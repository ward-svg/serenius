# Serenius Module Development Rules

## Source of Truth

- Verify table and column names against `docs/database/serenius_schema.md` or confirmed SQL before writing UI.
- Use `docs/database/schema-change-workflow.md` to decide when UI work must stop for schema confirmation.
- Do not assume a column exists.

## Module Boundaries

- Keep routes thin.
- Keep module UI inside `modules/[module]/components`.
- Keep module business and data logic inside `modules/[module]`.
- Use shared `/components` only for shared or platform UI.

## Auth and Tenant Safety

- Always preserve tenant isolation.
- Tenant-scoped tables must include `tenant_id`.
- Never expose service role logic to client components.
- Never expose Google OAuth tokens.

## UI Rules

- Follow `docs/ui-foundation.md`.
- Use established button, action, table, and modal patterns.
- Use simple human language.

## Database Rules

- UI work should not create or alter tables.
- Schema changes happen separately through SQL or a DB agent.
- RLS is required on every new table.
- Do not rely on unconfirmed schema details in UI work.

## Build Discipline

- Run `npm run build` after meaningful changes.
- Use small safe slices.
- Avoid broad refactors during feature work.

## Tailwind

- Tailwind v3 only.
- Preserve custom classes in `app/globals.css`.
- Do not migrate to Tailwind v4.
