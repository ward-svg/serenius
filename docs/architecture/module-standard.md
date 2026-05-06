# Serenius Module Standard

## Purpose

This document defines the official architecture standard for all Serenius application modules.

The goal is to ensure:
- consistency
- maintainability
- scalability
- tenant safety
- predictable AI-assisted development

All future modules should follow this structure unless explicitly approved otherwise.

---

# Core Principles

## 1. Thin Routes

Files inside `/app` should remain lightweight.

Routes are responsible for:
- routing
- auth boundaries
- tenant resolution
- loading initial data
- rendering module entry components

Routes should NOT contain:
- large business logic
- complex data transforms
- reusable utility logic
- inline database orchestration

---

## 2. Modules Own Business Logic

All module-specific logic belongs inside:

```txt
/modules/[module-name]/
```

Examples:
- `/modules/partners`
- `/modules/finance`
- `/modules/residents`

---

## 3. Shared UI Lives in `/components`

Only truly shared UI belongs in:

```txt
/components
```

Examples:
- buttons
- dialogs
- layout shells
- reusable table components
- form primitives

Module-specific UI belongs inside the module itself.

---

## 4. Shared Platform Logic Lives in `/lib`

Examples:
- auth
- tenant resolution
- Supabase clients
- permissions
- formatting helpers
- global utilities

---

## 5. Multi-Tenant Safety

Every module must:
- respect tenant isolation
- rely on RLS
- include tenant-aware querying
- avoid cross-tenant assumptions

No module may bypass tenant boundaries.

---

# Standard Module Structure

```txt
modules/
  partners/
    components/
    queries.ts
    actions.ts
    types.ts
    utils.ts
    constants.ts
    index.ts
```

---

# File Responsibilities

## components/

Contains:
- module-specific React components
- forms
- tables
- cards
- tabs
- modals

Avoid placing shared platform UI here.

---

## queries.ts

Contains:
- server-side data loading
- Supabase read operations
- aggregation helpers
- page data builders

Examples:

```ts
getPartnersPageData()
getPartnerById()
getPartnerGivingSummary()
```

---

## actions.ts

Contains:
- server actions
- mutations
- inserts
- updates
- deletes
- archive operations

Examples:

```ts
createPartner()
updatePartner()
archivePartner()
```

---

## types.ts

Contains:
- module-specific TypeScript types
- DTOs
- derived interfaces
- UI model types

Avoid duplicating generated DB types unnecessarily.

---

## utils.ts

Contains:
- formatting
- filtering
- calculations
- pure utility helpers

Examples:

```ts
formatPartnerName()
calculateGivingTotals()
filterPartners()
```

---

## constants.ts

Contains:
- enums
- tabs
- select options
- labels
- safe static config

Do NOT place live business data here.

---

## index.ts

Optional export barrel for cleaner imports.

---

# Route Pattern

Preferred route pattern:

```txt
app/(dashboard)/[slug]/partners/page.tsx
```

Route files should remain thin:

```ts
const data = await getPartnersPageData(slug)

return <PartnersPageClient {...data} />
```

---

# Naming Conventions

## Components

Use PascalCase:

```txt
PartnerTable.tsx
PartnerCard.tsx
AddPartnerModal.tsx
```

---

## Utilities

Use camelCase:

```txt
formatPartnerName.ts
calculateGivingTotals.ts
```

---

## Server Functions

Use explicit action names:

```ts
getPartnerById()
createPartner()
updatePartner()
```

Avoid vague names like:

```ts
loadData()
handleStuff()
```

---

# Styling Rules

- Preserve Tailwind v3
- Preserve globals.css design system
- Avoid unnecessary inline styles
- Prefer reusable UI patterns
- Use consistent spacing and typography

---

# AI Development Rules

AI-assisted development must:
- preserve existing architecture
- avoid schema assumptions
- avoid uncontrolled refactors
- respect tenant isolation
- preserve RLS compatibility
- avoid introducing duplicate patterns

---

# Future Goals

This module standard is designed to support:
- scalable multi-tenant architecture
- reusable module patterns
- feature gating
- permissions systems
- AI-assisted development workflows
- long-term maintainability