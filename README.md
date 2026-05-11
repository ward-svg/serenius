# Serenius

Serenius is a secure multi-tenant ministry and nonprofit operations platform.

## Stack

- Next.js App Router
- TypeScript
- Supabase Postgres, Auth, and RLS
- Tailwind CSS v3
- Vercel

## Project Links

- Live app: https://serenius.app
- Repo: ward-svg/serenius

## Core Architecture

- Tenant routes are organized by slug.
- Platform admin lives at `/platform-admin`.
- Tenant isolation is enforced through Supabase RLS.
- Tenant branding is controlled through `organization_branding`.
- Storage integrations are server-side only.
- The live Supabase database is the operational source of truth.
- `docs/database/serenius_schema.md` is the committed schema reference for app and UI development.
- Schema changes are owned by the DB/import agent, not by UI module work.
- Do not invent tables, columns, enums, or relationships.
- If required schema is missing, stop and request schema confirmation before writing UI.

## Documentation

- `docs/database/serenius_schema.md`
- `docs/database/schema-change-workflow.md`
- `docs/ui-foundation.md`
- `docs/module-development-rules.md`
- `docs/build-discipline.md`
- `docs/manual-smoke-tests.md`

## Conventions

- Keep routes thin.
- Keep module UI inside `modules/[module]/components`.
- Keep module business and data logic inside `modules/[module]`.
- Use shared `/components` only for shared or platform UI.
- Do not introduce new packages without explicit approval.
- Do not change Supabase schema unless SQL is provided separately first.
- Run `npm run build` after meaningful changes.

## Local Development

```bash
npm install
npm run dev
npm run lint
npm run build
```

## Fonts

Serenius does not use `next/font/google` for Inter. Build-time Google Fonts fetching caused deployment flakiness, so the app relies on the existing CSS/system font stack instead.
