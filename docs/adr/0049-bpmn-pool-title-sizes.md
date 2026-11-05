# ADR 0049 — The author sizes a BPMN pool's titles

- Status: **accepted** (2026-11-04)
- Deciders: Mathieu Jolly (PO approval of the two optional fields, lot 7)
- **Red zone**: stored format (`packages/affine/model`, element `bpmnPool`).
  Two optional fields, defaulting to `undefined`; nothing an existing document
  stores changes.
- Related ADRs: [0009](0009-reversed-flag-contract.md) (a flag never gates
  content), [0012](0012-framework-interchange-and-foreign-preservation.md)
  (interchange), [0020](0020-connector-end-labels.md) and
  [0037](0037-image-crop-is-a-view.md) (the precedent: an optional field an
  older client ignores).

## Context

A pool's title and its lane titles are painted at frozen sizes:
`POOL_NAME_FONT_SIZE = 15` and `POOL_LANE_NAME_FONT_SIZE = 13`
(`gfx/bpmn/src/consts.ts`), set statically in the `BPMN_POOL_BACKGROUND`
declaration. On a large process map read zoomed out, a 15-unit participant name
is hard to read, and the author has no way to say "this pool is the main
actor". The framework-background primitive
(`blocks/surface/src/framework-background`) already lets a declaration drive a
text from a model prop (`visibleProp`, `variantProp`), but not its size.

The `bpmnPool` element stores, before this ADR: `name`, `resizeEnabled`,
`rotate`, `xywh`, `lanes` (optional) and the base element keys (`index`,
`seed`, `layer`, `tags`, `validationExceptions`…).

## Decision

### Two optional fields on `BpmnPoolElementModel`

```ts
@field() accessor nameFontSize: number | undefined = undefined; // pool title
@field() accessor laneFontSize: number | undefined = undefined; // lane titles
```

- **Two settings, not one.** The participant and its lanes are two levels of
  the same hierarchy; the PO wants each sized on its own (a large participant
  name over quiet lane titles, or the reverse on a swimlane-heavy map).
- **`undefined`, never a number, by default.** `@field()` writes nothing for an
  `undefined` default, whereas a default other than `undefined` is written into
  every document the first time it opens. A pool whose author never touched the
  size stays byte-identical to one created before this ADR: no schema version,
  no migration, no write on load.
- **Absent means the declared size**: 15 for the title, 13 for the lanes,
  exactly as before. The size the toolbar shows is derived until a gesture
  records it.
- **The toolbar offers steps**: title 13 / 15 / 18 / 24 / 32, lanes
  11 / 13 / 15 / 18 / 24 (`POOL_NAME_FONT_SIZES`, `POOL_LANE_NAME_FONT_SIZES` in
  `gfx/bpmn/src/consts.ts`), plus the dropdown's free input clamped to the same
  range. One gesture is one undo step; picking the size already shown writes
  nothing. The lane setting only shows on a pool that has lanes.
- **A reader trusts nothing.** A stored value that is not a finite number
  greater than zero is ignored and the declared size is painted.

### One additive seam in the primitive

`BackgroundTextDef.sizeProp` and `BackgroundInstanceZonesDef.label.sizeProp`
(both optional) name a model prop holding the font size. One resolver,
`backgroundSizedStyle(style, sizeProp, model)` (`labels.ts`), returns the
declared style, or a copy carrying the stored size. The band resolver
(`backgroundBandWidths`), the renderer and the label hit boxes all read through
it, so a band thickens with the size (its thickness is derived from the line
height) and the double-click target follows what is painted. A declaration
with no `sizeProp` gets its declared style back, the same object, so no other
framework changes.

### Out of scope

- **The `.bpmn` export does not write the size** into the BPMN DI
  (`bpmndi:BPMNLabelStyle`), and the import reads none. The interchange stays as
  it was; an imported pool has no size and paints at the defaults.
- `maxLines` is unchanged (3 for the title, 2 for the lanes): a larger size
  wraps sooner.

## Consequences

- **What stays loadable**: every document ever written. A pool without the keys
  paints, selects and exports exactly as before (pinned by
  `bpmn-pool-title-size-format.unit.spec.ts` in `affine/model`: the stored key
  list of a fresh pool is unchanged, and loading a pool written without the
  keys writes nothing).
- **An older client** (2.5.0 and earlier) does not know the keys. Yjs keeps
  them in the element's map and the old client never touches them, so they
  survive its edits and sync back intact; it paints the pool at 15 / 13. A
  copy-paste or a duplicate made IN an older client re-creates the element
  through its declared accessors only, so that copy loses the sizes and paints
  at the defaults: a cosmetic loss, never a loss of content.
- The SVG and PNG exports paint through the same renderer and show the chosen
  sizes.
- The primitive gains a third model-driven text attribute beside `visibleProp`
  and `variantProp`; the next framework that wants an author-sized title
  declares a `sizeProp` and writes no drawing code.
