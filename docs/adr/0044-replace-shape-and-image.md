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

## Amendments

### 2026-10-27 — one « Replace » menu on a canvas image, a choice of shape, an image command

The product owner's remark: replacing gave no choice. From a shape it could
only be an image, from an image only a rectangle, and the image's own
« Replace » (another picture) vanished without a host, which read as "the
library is not reachable".

- **One menu.** The canvas image toolbar draws ONE « Replace » menu button
  (`editor-menu-button`, the crop menu's shape) where it drew two buttons
  (`a.replace`, `a.replace-with-shape`). It keeps the id `a.replace`, so it
  sits where « Replace » sat. Its entries: « Replace with image » and
  « Replace with shape »; each shows only when its command would act
  (`blocks/image/src/replace/toolbar.ts`).
- **A choice of shape.** « Replace with shape » is a sub-menu listing the
  shape tool's own shapes (`ShapeComponentConfig` of `@labre/affine-gfx-shape`:
  names, icons and wordings), drawn with `renderPickerMenuItems`.
  `canvas.image.replaceWithShape` takes two new optional params, `shapeType`
  (the `ShapeType` enum) and `radius` (0 to 0.5 of the box, the rounded
  rectangle's 0.1); absent, the v1 rectangle, so the palette and the agent
  are unchanged. `replaceImageWithShape` takes them instead of hardcoding a
  rectangle. `@labre/affine-block-image` now depends on
  `@labre/affine-gfx-shape`; the reverse stays forbidden.
- **An image command.** « Replace with image » on an image is
  `canvas.image.replaceWithImage` (owner `core`, surfaces `contextual-toolbar`
  and `palette`, not `agent`: a dialog is answered by a person). It swaps the
  picture of the same block (same id, corner, width and caption, the height
  follows the ratio, a crop is dropped; `replaceImageSource`), from the
  host's `AssetPickerProvider` in `replace` mode when there is one, from the
  system file chooser otherwise. The same helper (`pickImageSource`) serves
  the shape's « Replace with image » and the PAGE toolbar's « Replace », which
  is now offered without a host too. A locked image is refused; a captioned
  one is not, since nothing it holds is dropped. It emits
  `ElementReplaced { from: 'image', to: 'image' }` from its body (listed among
  the self-emitting commands).
- The shape toolbar keeps « Replace with image » as is and gains no shape
  entry: « Switch shape type » already replaces a shape by another one.
- Still no stored-format change: the shapes written are the ones the shape
  tool writes (a polygon without `vertices` paints its default pentagon, as
  after « Switch shape type »).

### 2026-11-04 — anything replaces anything, in the frame of what it replaces

Decision of the product owner, from a recette: « je veux que tout soit remplaçable par
l'autre image <=> fichier <=> html <=> forme », and « le remplacement d'un élément par un
autre doit absolument se faire dans les dimensions du cadre existant ». Not a red zone: no
schema, no stored field, no enum value changes.

- **The matrix.** On a canvas image, file, html and shape all replace one another, both ways
  (shape to shape stays « Switch shape type »). In a page and in a note, image, file and html;
  a shape exists in neither, so its entry does not appear there.
- **The frame stays.** On a canvas `xywh`, `rotate`, `index`, layer, connectors and container
  membership, through the hand-over above, in one undo step. In a page, the displayed width and
  height of what is replaced (`replace/frame.ts`).
- **A picture is cut to the frame, never distorted.** The largest centred window of the frame's
  proportions (`cropToBox`, the shape's already), written in `crop` (ADR 0037); a smaller picture
  is enlarged by the same mechanism, and a window covering everything is the absent key. This
  **replaces**, for image to image, « the height follows the ratio, a crop is dropped » of the
  amendment of 2026-10-27. A file of 752×544 on a canvas replaced by a picture is 752×544, no
  longer 460×230.
- **In a page**, `width` and `height` are the whole picture's (ADR 0037), so a crop stores a whole
  picture larger than the frame. A file's card has a frame too: a picture replacing it takes that
  size, low as it is, because the product owner said « absolument ». An image at its natural size
  with no stored size and never laid out (another page, in « Replace everywhere ») has no frame
  to read and stays at its natural size.
- **A file in a page takes the column:** an attachment there stores no width, and giving it one is a
  stored-format decision this amendment does not take. An html view takes the frame's height,
  which it stores in `xywh` (ADR 0048). A plain card keeps its own height.
- **A file in a large frame on a canvas is a card contained in it:** the largest uniform scale that
  fits, centred, a band in a wide frame and a tile otherwise (`cardStyleFor`). `xywh` stays the
  frame, so a later replace finds it. This replaces the two-axis scale of the canvas card; a card
  resized by hand keeps its ratio, so it draws as before.
- **One gesture.** The host's dialog opens on all its sections for every replace, the request's
  `kind` saying which section is the replaced element's; without a host, the system file chooser,
  any type. `AssetPickerRequest` does not change. The caller looks at the type of the reference
  answered (`pickReplacement`).
- **One way through.** `replaceWithAnswer` in `@labre/affine-block-image` sorts every pair, and
  another file in the same attachment stays in the attachment package, which knows how a file is
  shown (`replaceAttachmentFile`). `@labre/affine-block-attachment` now depends on the image
  package; the html helpers it needs in return moved to `@labre/affine-shared/services`. The direct
  conversion it had (`turnIntoImageBlock`) stays for the view menu, whose gesture is not a replace.
- **Menus.** On a canvas, image and attachment draw the same « Replace » menu
  (`replaceMenuToolbarAction`, ids `a.replace` and `d.replace`): an entry for the dialog, the
  sub-menu of shapes. The shape keeps its entry, which accepts anything. In a page, the existing
  button opens the dialog.
- **Refusals stay:** read-only, locked, notation shape, mind-map node, a shape with text, and a
  caption or comments lost to a shape. A caption and comments cross between image and attachment,
  which both hold them. A citation's card is held by its footnote and is refused too.
- **Commands and telemetry.** `canvas.attachment.replace` and
  `canvas.attachment.replaceWithShape` (owner `core`, no `agent`). The ids
  `canvas.shape.replaceWithImage` and `canvas.image.replaceWithImage` stay, though what they answer
  grew: identifiers are never removed. `ElementReplaced` gains `attachment` (html and any file);
  a block inserted by a replace is `BlockCreated`.

### 2026-11-24 — a video embed is painted at its bound's ratio

Issue #738, port of upstream toeverything/AFFiNE a28cad2, reworked after review. Not a red zone:
no schema, no stored field, no enum value changes.

- **The exception.** The contained card of the amendment of 2026-11-04 stays for every card. A
  video EMBED (`embed: true` on a `video/` file whose embed view is drawn) is no longer a card
  contained in its frame: its box takes the bound whole, at the card's width
  (`scale = bound.w / 752`, height `bound.h / scale`, upstream's formula), and the `<video>`
  inside is `object-fit: contain`, so a clip is never cropped and never stretched. The canvas
  block tells a video embed by its file type and `embedded()`, not by `style`, whose type names
  the card styles only.
- **Why the exception.** « Turn into embed view » on a video writes a bound at the clip's own
  ratio. Contained as a card, that bound would still be painted as a 752 × 544 box letterboxed
  in it, and the fix would not show on a canvas.
- **Measure first, then write once.** The house precedent: `turnIntoImageBlock` and
  `resetImageSize` read an image's size before their one write. « Turn into embed view » on a
  video notes the block's `sourceId`, `embed` and `xywh`, reads the clip's size
  (`readVideoSize`, `@labre/affine-shared/utils`: up to 3 s, `null` on error or timeout), then
  writes once, after `captureSync`: `embed: true`, `style: 'video'` and a box at the block's
  corner, 752 wide, the clip's height for that width (`752 × h / w`), the card's 544 when the
  size is `null`. One write, one undo step; the undo manager is never touched.
- **Only if nothing moved.** The write happens only when the store is still writable, the block
  still exists, and `sourceId`, `embed` and `xywh` are exactly as noted: a « Replace »,
  « Card view » or « Embed view » by another path, a resize by the user or a peer, an undo or a
  deletion during the read leaves the block as it is, and nothing is written. A second « Embed
  view » while the clip is read is the same gesture: it reads nothing and writes nothing.
- **What the user sees.** The card stays a card while the clip is read: a few milliseconds for a
  file whose metadata the browser reads at once, up to 3 s for one it cannot decode, after which
  the box takes the card's height. Nothing in the toolbar waits on the action: its « Embed view »
  calls `convertTo` and traces the click; the view menu reads the model and follows the write.
- **A replace keeps its frame.** `replaceAttachmentFile` calls `convertTo` with
  `{ keepBound: true }` (a new optional `AttachmentEmbedConvertOptions` passed to an embed
  config's `action`): the video action then writes synchronously, inside the replace's
  transaction, `embed: true`, `style: 'video'` and the card's box, the replace writes the frame
  back, and the clip is never read. A video replacing an embed of any proportions is painted at
  the frame's ratio, the clip letterboxed in it, in one undo step, as the amendment of
  2026-11-04 asks.
- **Stored embeds.** A video embed saved before reads 752 × 544, the card's ratio, and is painted
  exactly as before; its clip, no longer cropped, letterboxes in it. Nothing is rewritten on load:
  only a new « Turn into embed view » writes the clip's ratio.
- Held by `blocks/attachment/src/__tests__/video-embed-ratio.unit.spec.ts`.
