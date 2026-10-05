# Data flow

**Yjs is the model. Everything else reacts to it.**

## There is no second model

Most editors keep an in-memory model and sync it with a collaboration layer.
BlockSuite does not. The block tree _is_ Yjs types: a block is a `Y.Map`,
its rich text is a `Y.Text`, the surface elements are a `Y.Map` of `Y.Map`s.
Block models and element models are thin reactive views over those types.

Consequences:

- A write goes to Yjs first. The model updates from the Yjs event, then the
  views update from the model.
- Undo and redo are Yjs undo manager operations on the document.
- A remote update arrives as a Yjs update and follows the same path as a local
  edit.

## Reading state

Model props are exposed as signals (`@preact/signals-core`). Every prop `x`
has a companion `x$`. Views read `x$.value` inside `render()` and re-render
automatically when it changes.

```ts
// a block component
override render() {
  const text = this.model.props.text$.value;
  …
}

// an element model
const [x, y, w, h] = element.xywh$.value;
```

Outside a reactive context, read with `peek()` to avoid creating a
dependency by accident.

## Writing state

Never write to a Yjs type directly. Use the store or the CRUD service:

```ts
store.updateBlock(model, { checked: true });
store.addBlock('affine:paragraph', { text: new Text('hello') }, parent);
store.deleteBlock(model);

std.get(EdgelessCRUDIdentifier).updateElement(id, { xywh: '[0,0,100,50]' });
```

Writes happen inside a transaction. The store opens one for you. Group a
user-visible gesture into one undo step by calling `store.captureSync()`
before the first write.

Transient churn during a drag (every intermediate stroke point, every mouse
move) goes through `store.withoutTransact(() => …)` so it does not pollute
the undo stack; the final position is written normally.

## Stacking, user layers and the layer manager

The canvas paints in one order, and three words describe it. Keep them apart.

- **`index`.** Every canvas element and every gfx block stores a fractional
  `index`. `compare` (`packages/framework/std/src/utils/layer.ts`) sorts by
  it; a group-like ancestor (a group, a mindmap, a frame) stacks its
  descendants right above itself.
- **User layers** (ADR 0031) are content. The `affine:surface` block may carry
  a `layers` record (`SurfaceLayerRecord`: `name`, fractional `index`,
  optional `hidden`), and every element and gfx block an optional `layer` id.
  No id, or an id with no record, is the default layer, `'@default'`
  (`DEFAULT_LAYER_ID`), which has no record until a gesture needs one. A
  group lives in the layer of its outermost group; frames are not counted, so
  one frame can hold a background layer under a content layer. `compare`
  ranks by layer first, then decides as before; a surface with no `layers`
  takes a fast path that sorts exactly as documents did before layers
  existed (`SurfaceUserLayers`, `packages/framework/std/src/gfx/model/surface/user-layers.ts`).
- **`LayerManager`** (`packages/framework/std/src/gfx/layer.ts`) cuts that
  sorted order into runs of canvas elements and runs of DOM blocks, so each
  run is painted by one canvas or one stacking context. Its "layers" are a
  rendering device, never a user concept. In code a user layer is a
  `SurfaceLayerRecord`; the two never meet in one identifier.

The **selection pane** is a projection of that order, not a second model.
`selectionPaneTree(std)` (`packages/affine/blocks/surface/src/extensions/selection-pane/tree.ts`)
answers the paint order reversed (top first), built with the canvas's own
comparator: user layers as the top-level nodes (one unrecorded default layer
while the surface has none), groups and mind maps as nested rows, a frame as
an ordinary row at its place with its members as its siblings right above it.
The tree carries ids, never text; a host draws its own pane from it. Every
action the pane offers is a `canvas.*` command run through `runCommand`, and
opening the pane writes nothing.

Visibility has three owners (ADR 0031 §1): the stored `hidden` is mindmap
collapse's, the stored `hiddenForEveryone` is "Hide for everyone", and a
viewer's local hide is kept in `localStorage`, never in the document. Painting,
picking and exports honour all three; `grid.search`, which also answers rules,
legends and semantic exports, skips `hidden` alone.

## Reacting to changes

Subscribe to the store or the surface, and always check where the change came
from:

```ts
surface.elementUpdated.subscribe(({ id, props, local }) => {
  if (!local) return;          // a remote peer already did the cascade
  …
});
```

Without the guard, every collaborator re-applies the same cascade and the
document oscillates. This was a real bug (connector, frame and mindmap, fixed
in PR #253).

## Undo

The undo manager lives on the document. Editors do not own history. Rapid
operations are merged by time window; `captureSync()` closes the current
group.

## Awareness

Cursors, selections and presence are not in the document. They travel through
**awareness**, a separate channel with no history. Selection is data (block
path, index, length), so a remote selection renders without any DOM access.

## Persistence

Two paths, both available:

- **Streaming**: connect the Yjs document to one or more sources
  (IndexedDB, a server, a broadcast channel). Binary updates flow in and out.
  This is how documents are stored and synced.
- **Snapshot**: `Transformer` turns a document into a JSON tree and back.
  The Markdown, HTML and clipboard adapters are built on snapshots.

The server never stores JSON. It stores Yjs updates.

Next: [03-layers-and-packages.md](03-layers-and-packages.md).
