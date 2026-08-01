---
'@labre/std': minor
'@labre/affine-gfx-wardley': minor
'@labre/affine-gfx-connector': minor
---

feat(edgeless): semantic roles on surface elements, opened by Wardley (PF1)

Surface elements gain an optional semantic role — the identity validation
rules will be written against, never the shape type. A role id is namespaced
by its framework (`<framework>:<role>`, e.g. `wardley:component`).

- `@labre/std`: new optional `role` field on the base element model
  (`GfxPrimitiveElementModel`), plus the declarative role vocabulary
  (`RoleDef` / `RoleDefs` / `roleIsA`). Declared on the BASE class so the key
  survives paste, duplicate and template insertion — an element re-created
  from props only reaches the Y.Map through declared field accessors.
- `@labre/affine-gfx-wardley`: declares the 8 Wardley roles — the 7 node kinds
  plus the `wardley:dependency` edge — and stamps them at the creation sites.
  The hierarchy is declarative data: `wardley:market` and `wardley:ecosystem`
  specialise `wardley:component`, so a rule written on the parent applies to
  them. The anchor (user / need) is a role of its own.
- `@labre/affine-gfx-connector`: the connector tool accepts an optional `role`
  so a framework toolbox can activate it for a typed edge. The plain connector
  tool is unaffected.

Backward compatible, no schema version bump and no migration: the `affine:surface`
version stays at 5, existing documents load unchanged and read as neutral
(no role). Generalist artefacts (square, triangle, free text, inertia bar,
background) stay neutral — no `role` key is written for them. An `undefined`
field default is no longer written into the Y.Map at creation, so a newly
created element that does not use an optional field is byte-identical to one
authored before that field existed.

Known gaps, deliberately left for the milestone that consumes roles: connectors
drawn through quick-connect (the element-toolbar arrow) or auto-complete, and
the built-in Wardley map templates, still produce neutral edges/nodes.

RELEASE ORDER CONSTRAINT — read before shipping anything that depends on roles.

A client that does NOT declare the `role` field silently DROPS it when it
re-creates an element (paste, duplicate, template insertion): only declared
field accessors reach the Y.Map. The declaration must therefore always be
deployed before roles start circulating.

1. This release is the DECLARATION, and it is inert: nothing in the library
   reads `role`. All `@labre/*` packages are versioned in lockstep, so no
   client can get the Wardley writer without the base field — but a client
   still running an EARLIER version would strip roles from anything it pastes.
   Roll this version out everywhere first.
2. Only then may role-writing features be enabled beyond Wardley, and only
   after that may role-READING features ship (validation rules, role-aware
   toolbars, host-side reporting — tranche 3).
