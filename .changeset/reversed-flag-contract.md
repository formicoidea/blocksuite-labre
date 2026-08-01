---
'@labre/affine': minor
'@labre/affine-gfx-wardley': minor
'@labre/affine-gfx-edgy': minor
'@labre/affine-gfx-bpmn': minor
'@labre/affine-gfx-cynefin-estuarine': minor
'@labre/affine-gfx-brush': minor
---

feat(blocks): flags gate tooling only — a disabled framework stays visible in documents

Block flags used to decide whether a block was registered at all. A document
containing a block or framework whose flag was off degraded on load: the schema
was missing, the block and its whole subtree silently disappeared from the
model, and snapshot export / copy-paste broke for the entire document.

The contract is now reversed (see `docs/adr/0009`):

- **Content is never gated.** `getAffineSchemas` and
  `getInternalStoreExtensions` register everything unconditionally. Every
  document opens, renders, round-trips and saves identically whatever the flags
  say — no deletion, no downgrade, no schema-validation failure on load. Both
  keep their `flags` parameter (now ignored) so existing calls compile
  unchanged.
- **Only tooling is gated.** A flag removes the framework's senior toolbar
  button, its submenus, its Templates-panel category and its keyboard
  shortcuts. Turning a framework off no longer touches what is already drawn:
  elements keep painting, stay selectable and stay editable, and an OFF → ON
  cycle requires no re-entry of anything.
- Brush, Wardley, EDGY, BPMN and Cynefin/Estuarine now expose two view
  extensions — an always-registered `…RenderViewExtension` and a flag-gated
  `…ViewExtension` — mirroring what Mindmap and DDD Core Domain already did.

Consequence accepted: the bundle now always carries every framework's renderer,
so a framework can no longer ship fully "dark" behind a flag (bundle-level
packaging via `@labre/framework-*` is unaffected).

Known residual: block view extensions (`database`, `code`, `image`, `frame`, …)
still bundle renderer and tooling together, so a disabled _block_ renders as
nothing. Its data is now safe in every case and comes back untouched when the
flag is re-enabled.
