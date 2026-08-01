# ADR 0009 — Reversed flag contract: flags gate tooling, never content

- Status: accepted (July 2026)
- Deciders: Mathieu Jolly
- Supersedes the "ship dark" part of [ADR 0002](./0002-flag-gated-block-registry.md)
- Implements product decision #9 (2026-07-29), workstream "validation platform",
  slice PF4

## Context

ADR 0002 made block registration flag-gated at the three assembly points
(`getAffineSchemas`, `getInternalStoreExtensions`, `getInternalViewExtensions`)
so a block could ship "dark" and be rolled out progressively. That ADR also
recorded the price: _"Disabling a block does NOT migrate documents that contain
it: a flag may only be turned off for blocks that never reached users'
documents."_

A year of use showed that price is the wrong way round for Labre. Architects
share documents across tenants whose enabled framework sets differ, and the
enterprise rollout pattern is "buy the Wardley module later" — so a document
containing Wardley elements routinely lands in an editor whose `wardley` flag is
off. Under ADR 0002 that document degrades: the schema is missing, so
`SyncController._createModel` throws, `Store._onBlockAdded` swallows it into a
`console.error`, and the block plus its whole subtree silently vanish from the
model tree (the Yjs data survives, but the content is invisible, un-editable and
unexportable — `Transformer._getSchema` throws `Flavour schema not found`, which
also breaks copy/paste and snapshot export for the entire document).

Losing the ability to _see_ content is never an acceptable consequence of a
commercial packaging switch. What we actually want to gate is the ability to
_author_ new content of that kind.

## Decision

The contract is reversed.

**Content side — never gated.** `getAffineSchemas` and
`getInternalStoreExtensions` register everything unconditionally. Every document
opens, renders, round-trips and saves identically whatever the flags say. No
deletion, no stripping, no downgrade, no schema-validation failure on load. Both
functions keep their `flags` parameter for source compatibility and ignore it.

**Tooling side — the only thing a flag gates.** A flag removes:

- the senior toolbar button (edgeless) and its submenus,
- the keyboard shortcuts the framework owns (`getShortcutManifest` already
  filters on `ShortcutDescriptor.owner`; unchanged and still correct),
- future side-panel / command-palette entries and validation rules (PF4.3-4.5,
  not built yet).

**One switch per framework.** Each gfx framework module therefore exposes two
view extensions instead of one:

| always registered                                                                                                                  | flag-gated                                                                         |
| ---------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| `…RenderViewExtension` — element view, element renderer, node view/renderer, interaction, contextual toolbar of a selected element | `…ViewExtension` — senior button, its Templates-panel category, creation shortcuts |

This is not a new pattern: `MindmapRenderViewExtension` and
`DddCoreDomainRenderViewExtension` were already split this way. PF4 generalises
it to `brush`, `wardley`, `edgy`, `bpmn` and `cynefin-estuarine`.

`scripts/build-bundles.mjs` already understood flag-less (always-on) extension
entries; the four framework bundles now list their render extension alongside
their gated one.

## Consequences

- **End of full "ship dark".** The core bundle carries every framework's
  renderer whether or not the host enables it. Accepted: correctness of stored
  documents outranks bundle size. A framework can still ship dark _as a bundle_
  (the `@labre/framework-*` split), which is a packaging decision, not a flag.
- **Disabling is lossless and reversible.** Elements already drawn stay in place,
  keep painting, stay selectable and stay editable; only the way to add new ones
  disappears. An OFF → ON cycle requires no re-entry of anything.
- **Scope of the reversal is surface elements.** Everything living in the
  surface `elements` map (brush, mindmap, wardley, edgy, cynefin, estuarine,
  bpmn, coreDomain) is fully reversed. Their element _models_ were already
  registered unconditionally (`elementsCtorMap` in
  `packages/affine/blocks/surface`), so with the renderers now unconditional too
  the canvas is complete under any flag set.
- **Residual gap — blocks.** Block view extensions (`database`, `code`, `image`,
  `latex`, `frame`, `edgeless-text`, …) still have renderer and tooling in the
  same extension, so a disabled block still renders as nothing (`lit-host`
  `Cannot find render flavour`, then `nothing`). Their _data_ is now safe —
  schema and store side are unconditional, so the document loads, round-trips,
  exports and re-renders untouched the moment the flag goes back on — but the
  render/tooling split has not been done for them. Deliberately deferred: doing
  it for ~16 blocks now would be speculative work ahead of a product need. When
  a block's flag must genuinely be shipped, split it the way the frameworks
  were.
- **Flags are no longer a document-compatibility hazard**, so the ADR 0002
  caveat "only disable blocks that never reached users' documents" is void and
  the `flags.ts` documentation has been rewritten accordingly.
- `OPTIONAL_BLOCKS` had `edgeless-text` listed twice; the duplicate is removed
  (no behaviour change — the derived union type was already deduplicated).
