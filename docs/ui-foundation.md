# Serenius UI Foundation

This branch established the baseline UI conventions for the Serenius partner module and related shared surfaces. Keep future work aligned with these patterns.

## Tenant Brand Colors

- `Primary`: structure, navigation, active system state.
- `Secondary`: subtle backgrounds and info accents.
- `Accent`: action links, edit/add interactions, secondary workflow accents.
- Destructive actions should use semantic destructive styling, not the tenant accent color.

## Buttons

- Use `btn btn-primary` for Save, Create, Submit, and Confirm actions.
- Use `btn btn-ghost` for Cancel, Back, Edit, Add, New, Record, and other contextual actions.
- Use `btn btn-danger` for destructive modal or footer actions.
- Use `btn-sm` when controls should stay compact.

## Inline Actions

- Use `action-link` for row or table navigation, and for View/Edit, Open, or Manage actions.
- Use `action-link-danger` for destructive row or table actions.
- Do not use full danger buttons inside dense table rows unless there is a strong reason.

## Tables And Grids

- Keep the leftmost column as `ACTIONS` for operational tables.
- Do not label action headers as `View/Edit Details`.
- Use clear row action labels such as `View/Edit`, `Open`, or `Manage`.
- Primary record fields may also be clickable when useful.
- Partner grids should use `Partner Name`, not `Display Name`.
- Use `table-scroll` for horizontal table wrappers.
- Use `empty-state` for standard centered empty states.
- Use `actions-column` for action header or cell widths when appropriate.
- Keep money cells right-aligned.

## Modals

- Existing records opened from `View/Edit` row actions should open in read-only view mode first.
- View mode uses normal close behavior.
- View mode has a header action like `Edit [Record]`.
- Edit mode has `Back to View`.
- Edit mode disables overlay, Escape, and X close.
- Edit mode footer uses `Cancel` and `Save Changes`.
- Save returns to view mode with the saved row visible.
- Create flows open directly in form or edit mode and close after successful create unless the workflow explicitly needs to remain open.

## Module Ownership

- Keep routes thin.
- Keep module-specific UI in `modules/[module]/components`.
- Keep module business and data logic in the module.
- Keep shared `/components` limited to platform or shared UI.
- Avoid importing module barrels into client components if the barrel exports server code.

## Current Partner Module Examples

- `ContactDetailModal`
- `NewPledgeModal`
- `GiftModal`
- `FinancialTab`
- `PartnersClient`

