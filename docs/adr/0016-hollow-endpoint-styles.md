# ADR 0016 — Hollow endpoint heads widen a persisted enum

- Status: **accepted** (2026-09-14)
- Deciders: Mathieu Jolly
- Milestone: UML 2.5.1, tranche A
- Related ADRs: [0010](0010-persisted-relation-direction.md) (the persisted pair
  a relation family reads), [0012](0012-framework-interchange-and-foreign-preservation.md)
  (unknown data is preserved, never dropped).
- Related rule: R33 in
  [../add-a-framework/02-framework-rules.md](../add-a-framework/02-framework-rules.md)
  (neutrals come from one scale).

## The question

UML 2.5.1 draws three of its most common relations with a **hollow** head:
generalization and realization end in a hollow closed triangle, shared
aggregation in a hollow diamond. The connector we already ship has both
geometries — `PointStyle.Triangle` and `PointStyle.Diamond` — but paints them
FILLED with the connector's stroke colour, which in UML means something else
entirely (composition, not aggregation).

`PointStyle` is not an internal detail. Its **string values are persisted**: a
connector stores two of them, `frontEndpointStyle` and `rearEndpointStyle`, on
every document that has ever been saved. So the question is not "how do we draw
a hollow triangle" but "how do we add one to an enum that user documents
already carry".

## Decision

### The enum is widened, append-only

`TriangleHollow` and `DiamondHollow` are **appended** to `PointStyle`. No
existing member is renamed, removed, or given a different string value, and none
ever will be — a rename turns every stored connector carrying the old value into
an unknown style. `PointStyleMap` derives from the enum and needs no edit;
`ConnectorEndpointSchema = z.nativeEnum(PointStyle)` in
`@labre/affine-shared/utils/zod-schema` derives too, so the new values validate
with no change there either.

An alternative — a separate `fillStyle` boolean beside the existing
`Triangle` / `Diamond` — was rejected. It would be a **second** persisted field
on every connector, a schema change of an existing block (red zone) rather than
a widening, and every producer, adapter and toolbar would have to carry the pair
instead of one value.

### An older client paints an empty head

Both renderers switch on the style with **no `default` branch**, and that is
deliberate, documented at both sites:

- the canvas renderer's `renderEndpoint`
  (`packages/affine/gfx/connector/src/element-renderer/index.ts`),
- the DOM renderer's `createArrowMarker`
  (`.../element-renderer/connector-dom/index.ts`).

A build that predates a member therefore falls through and draws nothing at that
end. The connector itself — its geometry, its label, its bindings, its stored
style string — is untouched and round-trips intact. **Degraded, never broken**,
and never a throw in the middle of a frame. The reverse direction is free: an
old document only ever carries members that already existed.

### A hollow head is filled with the notation card fill

The interior is `NOTATION_NEUTRALS.cardFill` (R33), exported as
`HOLLOW_HEAD_FILL` from the connector's renderer utils. Not a theme-resolved
token, and not `transparent`.

- `transparent` lets the connector's own line, and whatever is behind it, show
  through the head. A UML hollow triangle is a solid white shape with a dark
  outline sitting **on top of** the line it terminates, not a wireframe.
- A theme token would follow the host's dark mode and paint the head dark —
  next to a UML class box that is itself `cardFill` white in every theme,
  because the whole notation layer is theme-independent by R33. The head would
  disagree with the box it points at.

So in a dark host the hollow head is card-white, like the box. That is the
intended reading, and it is the same decision the framework notations already
made for their own fills.

Mechanically: `renderRoundedPolygon` and `getArrowOptions` gained an optional
`fillColor` that **defaults to the stroke colour**, so every existing solid head
is byte-for-byte what it was; only the two new cases pass something else. The
rough (scribbled) path already read `options.fillColor` through `getRcOptions`
and needed no change.

### The connector toolbar lists them

Both endpoint menus gain the two entries — hollow diamond beside `Diamond`,
hollow triangle beside `Triangle`, in both the front and rear lists. This is
**required**, not cosmetic: `renderMenu` paints its trigger with
`renderCurrentMenuItemWith(items, currentValue, 'icon')`, which returns
`undefined` for a value no list carries. An unlisted style would give a blank
endpoint button on any connector that has it — including one created by a
framework action rather than by the menu. `endpoint-style.unit.spec.ts` asserts
that both lists cover every `PointStyle` member, because nothing at the type
level can.

The four icons are hand-authored in
`packages/affine/gfx/connector/src/toolbar/hollow-endpoint-icons.ts`:
`@blocksuite/icons` has no hollow variant, and we do not publish to that scope
(ADR 0001). They reuse its `0 0 24 24` / `1em` geometry so a hollow entry lines
up with the filled neighbour beside it.

### UML is the first consumer, not the owner

The two members live in `@labre/affine-model` beside the other five, gated by
nothing. They are connector vocabulary, available to any framework — a flag
gates TOOLING, never content (ADR 0009), and a stored connector must paint
whatever the flags say. The UML framework module (tranche B onward) is simply
the first thing that asks for them, for generalization, realization and shared
aggregation.

## Consequences

- **`PointStyle` is now formally append-only**, and its docblock says so at the
  declaration. Any future head — a UML "navigable" open arrow, a crow's foot —
  is appended the same way.
- **A document written by this build and opened by an older one is safe** but
  visibly poorer: a generalization arrives as a plain line. There is no
  migration to write, and no data is lost in either direction.
- **Two renderers now have to be kept in step.** A third head has to be added to
  the canvas switch, the DOM marker switch, and both toolbar lists, or it is
  invisible somewhere. The unit spec covers the toolbar half and the marker
  half; the canvas half is covered by the integration suite.
- **`createArrowMarker` and the two toolbar lists became exported** so the spec
  can observe them. They stay internal to the package (not re-exported from its
  entry points).
- **The connector package's vitest config gained `environment: 'happy-dom'`** —
  the marker assertions build real SVG nodes.
