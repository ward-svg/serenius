# Serenius Schema Change Workflow

Serenius uses Supabase Postgres with Row Level Security and tenant-scoped data. This document defines how database schema changes are planned, confirmed, documented, and handed off to app/UI work.

## Source of Truth

The live Supabase database is the operational source of truth.

`docs/database/serenius_schema.md` is the committed schema reference used by ChatGPT, Codex, and future module work. It should reflect the current confirmed live schema, including:

- tables
- columns
- types
- constraints
- foreign keys
- record counts where useful
- RLS notes
- module ownership
- future FK placeholders
- enum values
- helper functions

The schema reference is documentation, not a migration system.

## Ownership

The DB/import agent owns:

- table design
- SQL migrations
- enum changes
- indexes
- triggers
- RLS policies
- helper functions
- data imports
- historical Knack migration mapping
- regeneration of `serenius_schema.md`

Codex owns:

- app/UI implementation
- module components
- route behavior
- TypeScript types generated or written from confirmed schema
- safe documentation updates when given confirmed schema details

Codex must not invent database structure from UI requirements.

## Standard Workflow

Use this flow for every schema change:

1. Identify the module or feature requirement.
2. Determine whether existing tables/columns support the requirement.
3. If schema changes are needed, stop UI work.
4. Send the requirement to the DB/import agent.
5. DB/import agent prepares SQL, migrations, RLS, indexes, helper functions, and import/backfill logic if needed.
6. DB/import agent applies or provides the confirmed database changes.
7. DB/import agent regenerates the current schema export.
8. Update `docs/database/serenius_schema.md` from the fresh schema export supplied by Ward or the DB/import agent.
9. Resume Codex/UI work against the committed schema reference.
10. Run `npm run build` after meaningful app changes.

## Rules for UI and Codex Work

Before writing UI or app logic, verify the needed tables and columns exist in:

`docs/database/serenius_schema.md`

If a needed table, column, enum value, function, or relationship is missing, Codex must stop and report the gap instead of guessing.

RLS is required on every application table.

Codex must not:

- add app code that depends on unconfirmed columns
- create mock schema assumptions in production code
- change Supabase schema from a UI/module task
- expose service-role database access to client components
- expose sensitive credential tables or token material
- bypass tenant isolation for convenience

## Tenant Standards

All functional tenant-owned tables must include:

```sql
tenant_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE
