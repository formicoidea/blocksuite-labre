# ADR 0044 — Replace a shape by an image, and an image by a shape

- Status: **accepted** (2026-10-26, approved by the maintainer with the feature)
- Deciders: Mathieu Jolly
- Related ADRs: [0003](0003-telemetry-bus-and-taxonomy.md) (ids only),
  [0008](0008-command-registry-foundation.md) (one descriptor per action),
  [0031](0031-canvas-layers-hide-and-grid.md) (every creation path stamps a
  layer), [0037](0037-image-crop-is-a-view.md) (a crop is a stored view).
- **Not a red zone**: no schema, no stored field, no enum value changes. The
  gesture writes props that already exist (`crop` of ADR 0037 included).

## Context

An author sketches a layout with rectangles, then wants a picture where a
rectangle stands — and, the other way round, wants to turn a picture back into
a placeholder box. The canvas has three neighbouring gestures, and none fits:

- **Morph** (`blocks/surface/src/extensions/morph-toolbar.ts`) rewrites an
  element in place and keeps its id. It works because the two kinds are the
  same model. A shape is a canvas ELEMENT (`ShapeElementModel`, stored in the
  surface's `elements` map); an image is a BLOCK (`affine:image`, a child of
  the surface block). One cannot become the other in place.
- **Replace the picture** of an image (`blocks/image/src/asset-picker.ts`,
  `replaceImage`) swaps the `sourceId` of an existing image block.
- **Turn a bookmark into an embed** (`blocks/bookmark/src/configs/toolbar.ts`)
  is the precedent this ADR follows: a new block at the old one's place, the
  connectors re-pointed with `reassociateConnectorsCommand`, the old one gone.

## Decision

### The gesture deliberately does not preserve identity

« Replace with image » on a shape and « Replace with shape » on a canvas image
CREATE a new model and DELETE the old one. The id changes. Keeping it would
require a block and an element to share an id across the two stores, which
nothing in the model supports and every reader of the surface would have to
learn.

### What is carried over

In one undo step (one `captureSync`, then the creation and one `store.transact`
for the hand-over; a block added inside a transaction has no model until it
ends, and the container needs the model):

- `xywh`, `rotate` and `index` — the new model takes the old one's place, size,
  rotation and z-order;
- the user layer: `sourceLayerOf(old)` then `applyCreationLayer` (ADR 0031 §6),
  the default layer included;
- connector endpoints: every connector whose `source.id` or `target.id` is the
  old id is re-pointed to the new id, its `position` kept
  (`reassociateConnectors`, shared with the bookmark conversion);
- container membership: when the old model belongs to a group element or a
  frame (`model.group`), the new model is added to that container BEFORE the
  old one is deleted, so the container never sees itself empty.

Shape → image writes the largest centred `crop` (ADR 0037) whose proportions,
in source pixels, are the shape box's: the picture is never distorted, it is
cut to the box. A crop that would cover the whole picture is not written (ADR
0037: the whole image is the absent key). Image → shape writes a rectangle; the
rest of its style is the shape tool's (the canvas's `EditPropsStore` last-used
props, the model's defaults otherwise). The blob stays in the asset store: the
same picture may be referenced elsewhere, and undo brings the image back.

### What is refused (nothing written, no empty undo step)

- a read-only store;
- a locked model (`isLocked()`, by itself or by an ancestor);
- a shape with a `role`: a notation element means something to its framework
  (rules, legends, morphs, interchange), and a picture means nothing there;
- a shape carrying text, and an image carrying a caption or comments — in v1
  the gesture never loses data the author typed;
- a shape that is a mind-map node: the mind map owns its tree, an image cannot
  be one of its nodes.

### Ellipse, diamond and the other outlines are cut to their bounding box

A crop is a rectangle (ADR 0037). A picture cut to an ellipse or a diamond
would need a new stored field (a mask shape on `affine:image`), which is a
stored-format decision this ADR does not take. The image fills the shape's
bounding box; replacing it back gives a rectangle.

### Where it lives

Both directions live in `@labre/affine-block-image` (`src/replace/`): the image
package already depends on the surface block, and `gfx/shape` never imports the
image package. The shape's toolbar entry is a second module on the shape
flavour, registered from the image package under its own owner
(`toolbarModuleKey('affine:surface:shape', 'image-replace')`). The image's
entry sits beside its existing « Replace ». Both entries invoke a
`CommandDescriptor` (`canvas.shape.replaceWithImage`,
`canvas.image.replaceWithShape`, owner `core`, availability `editable`),
registered from the image view extension and enumerated by `getCommands`
behind the `image` flag.

The picture of shape → image comes from the host's `AssetPickerProvider` when
there is one (`mode: 'replace'`, one asset), from the system file chooser
otherwise — the same rule as every other image entry point.

### Telemetry

The command bodies emit, because the facts are those of the invocation:

- shape → image emits `BlockCreated { blockType: 'affine:image' }` (an image
  block is inserted by a user action, the existing event) and
  `ElementReplaced { from: 'shape', to: 'image' }`;
- image → shape emits `ElementReplaced { from: 'image', to: 'shape' }`.

`ElementReplaced` carries kinds only: never an id, never a `sourceId`, never
content. Both commands are listed among the self-emitting ones of
`registry.unit.spec.ts`.

## Consequences

- No stored-format change: an older client opens the result like any image or
  shape it already knows (a 0.49 client shows a cropped image whole, as ADR
  0037 says).
- **An element link** (a URL or a reference block pointing at the shape's id
  through `docs/element-link-integration.md`) dangles after a replace, exactly
  as it does after a delete. Undo restores the old id. Carrying links over
  would mean rewriting references in other documents, which this library does
  not own.
- A remote peer receives the new model, then one transaction with the
  re-pointed connectors, the swapped container entry and the deletion. Nothing
  cascades on the receiving side: a peer that sees only the first update sees
  both models for a moment, never a dangling connector.
- A framework that wants a picture in a notation slot needs its own decision;
  this gesture refuses roled shapes on purpose.
