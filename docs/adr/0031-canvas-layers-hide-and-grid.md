# ADR 0031 — User layers, a shared hide, and a shared grid setting

- Status: **accepted** (2026-10-04)
- Deciders: Mathieu Jolly
- Milestone: product decisions "selection pane", "calques", "hide for
  everyone", "grid for everyone" (2026-10)
- Related ADRs: [0003](0003-telemetry-bus-and-taxonomy.md) (ids only),
  [0009](0009-reversed-flag-contract.md) (layers are content, the pane is
  tooling), [0011](0011-editor-anchored-info-panels.md) (where a canvas panel
  lives), [0012](0012-framework-interchange-and-foreign-preservation.md) (the
  PR #73 preservation rule an older client relies on),
  [0025](0025-board-svg-export.md) (what a picture export draws).
- **Red zone, three times.** New optional props on the `affine:surface` block
  schema and on every gfx block schema (`packages/affine/model`,
  `packages/affine/blocks/surface`), new `@field()`s on
  `GfxPrimitiveElementModel` and a change to the z-order comparator
  (`packages/framework/std` gfx plumbing, the red zone ADR 0012 named for the
  same file). Every field below is fixed HERE; no stage of the delivery plan
  writes a field this ADR does not name.

## Context

### The product decisions

- A **selection pane** (PowerPoint-like) lists the canvas elements by z-order,
  with groups, lock, hide, a filter by frame, and drag-to-reorder. It is
  exposed headless to the host, the way the artefact catalogue is.
- **Layers ("calques") ship in v1.** A layer is an ordered container; every
  element belongs to exactly one; a default layer exists implicitly and is
  never written while the user has created no layer; stacking is layer order,
  then `index` inside the layer; a group lives entirely in one layer; layers
  can be created, renamed, reordered, hidden, collapsed (UI state) and deleted
  (which deletes their members, in one undo step).
- **Hide is local by default** (per viewer, never written); a distinct action
  **"Hide for everyone"** persists and syncs.
- **The canvas grid follows the same rule**: a local preference by default,
  plus "Save for everyone", which stores a document-level setting.

### What the code has today, verified

- **Stacking is one fractional `index` per element**
  (`packages/framework/std/src/gfx/model/surface/element-model.ts:611-612`),
  compared by `compare` (`packages/framework/std/src/utils/layer.ts:127-169`):
  a group-like ancestor stacks its descendants right above itself
  (`layer.ts:140-143`), otherwise the outermost differing ancestors' `index`
  strings decide (`layer.ts:160-168`). `LayerManager`
  (`packages/framework/std/src/gfx/layer.ts:33-68`) groups that sorted order
  into runs of canvas elements and runs of DOM blocks so each run can be
  painted by one canvas or one stacking context. Its "layers" are a rendering
  device, NOT a user concept, and nothing here renames them.
- **A stored `hidden` exists on every element** (`element-model.ts:608-609`),
  honoured by both renderers (`packages/affine/blocks/surface/src/renderer/canvas-renderer.ts:366`, `746`;
  `renderer/dom-renderer.ts:585`, `673`), by the spatial index's search
  (`packages/framework/std/src/gfx/grid.ts:345-352`, so by picking —
  `getElementByPoint` and `getElementsByBound` both start from `grid.search`,
  `packages/framework/std/src/gfx/controller.ts:165`, `209` — and by the SVG
  export's element query, `blocks/surface/src/extensions/export-svg/render.ts:95-99`)
  and by a group's bound (`element-model.ts:1011-1013`). **Mindmap collapse
  writes it**: `node.element.hidden = collapsed` on every descendant
  (`packages/affine/model/src/elements/mindmap/mindmap.ts:882`).
- **A local `display` exists** (`element-model.ts:593-594`), read by the same
  four renderer sites but **not** by `grid.search`, so an element with
  `display = false` is invisible and still clickable. It is also already
  spoken for: the canvas text editor sets it to `false` while it edits and back
  to `true` when it closes (`packages/affine/gfx/text/src/edgeless-text-editor.ts:374`, `323`).
- **Blocks have no generic hide.** `affine:note` carries a deprecated `hidden`
  superseded by `displayMode` (`packages/affine/model/src/blocks/note/note-model.ts:93-101`).
  Gfx blocks share `GfxCompatibleProps = { xywh, index, lockedBySelf? }`
  (`packages/framework/std/src/gfx/model/gfx-block-model.ts:32-36`), declared
  per schema (`lockedBySelf: false` in each `…-model.ts`).
- **Lock exists** on elements (`element-model.ts:892-893`) and blocks
  (`gfx-block-model.ts:35`), and locked elements are already filtered out of
  interaction (`packages/framework/std/src/gfx/interactivity/manager.ts:349`).
- **Groups** are `GroupElementModel` with a stored `title`
  (`packages/affine/model/src/elements/group/group.ts:120`); **frames** are
  `affine:frame` blocks holding `childElementIds`
  (`packages/affine/model/src/blocks/frame/frame-model.ts:31`, `51`) and are
  group-compatible for z-order (`frame-model.ts:69-73`); **framework boards**
  are plain elements extending `FrameworkBackgroundElementModel`, whose
  contents are whatever lies on their perimeter, never a stored list.
- **Every `surface.addElement` runs `beforeAdd` middlewares**
  (`packages/framework/std/src/gfx/model/surface/surface-model.ts:951-968`);
  `EditPropsMiddlewareBuilder` is the one that stamps the last-used style and
  the `index` (`packages/affine/blocks/surface/src/extensions/edit-props-middleware-builder.ts:12-24`).
  Framework commands that call `surface.addElement` directly (UML,
  `gfx/uml/src/actions.ts:97`) go through it too.
- **An unknown element TYPE breaks the surface.** `_createElementFromYMap`
  throws `Invalid element type` (`surface-model.ts:523`) and the surface's
  initial load calls it for every entry with no catch (`surface-model.ts:765-778`).
  An unknown element PROP, by contrast, is preserved verbatim
  (`_assignElementProp`, `surface-model.ts:474-503`, PR #73), end to end
  through the real clipboard (`packages/integration-test/src/__tests__/edgeless/unknown-element-props.spec.ts`).
- **An unknown block PROP is kept too.** `_parseYBlock` reads every `prop:` key
  of the block into the model, declared or not
  (`packages/framework/store/src/model/block/sync-controller.ts:253-256`), and
  the model's `keys` are those (`sync-controller.ts:166`). A schema prop whose
  default is `undefined` is never written on load; any other default IS written
  into every document the first time it is opened (`sync-controller.ts:309-319`).
- **Per-viewer, per-document state has a home**: `EditPropsStore` keeps
  `localStorage` props, the viewport keyed by document id
  (`packages/affine/shared/src/services/edit-props-store.ts:27-48`, `128-132`).
  Host-owned preferences go through `EditorSettingService`
  (`packages/affine/shared/src/services/editor-setting-service.ts:9-27`),
  already a seam ("Editor settings (grid, snap, defaults)",
  `docs/integrate/04-host-seams.md`).
- **The grid is CSS only**: a `radial-gradient` background on the edgeless
  root (`packages/affine/blocks/root/src/edgeless/edgeless-root-block.ts:79-86`)
  and on the surface container (`packages/affine/blocks/surface/src/surface-block.ts:79-84`),
  repainted by the PNG export when it draws the background
  (`blocks/surface/src/extensions/export-manager/export-manager.ts:400-409`).
  No setting turns it off today.
- **The catalogue seam is the model for the pane**: two verbs, `open` /
  `close`, everything else enumerable from the library; `null` removes the
  control that would open nothing
  (`packages/affine/shared/src/services/artefact-catalogue-service.ts:26-73`).

## Decision

### 1. Three visibilities, three owners, never one field

| what                | owner                           | stored?             | who sees it |
| ------------------- | ------------------------------- | ------------------- | ----------- |
| `hidden`            | **mindmap collapse**, only      | yes (existing)      | everyone    |
| `hiddenForEveryone` | the "Hide for everyone" gesture | yes (**new**, §5)   | everyone    |
| local hide          | this viewer                     | no — `localStorage` | this viewer |

`display` keeps its single current owner, the text editor's session, and is
not reused (§6).

### 2. The layer list lives on the `affine:surface` block

Two optional props join `SurfaceBlockProps` and the surface schema
(`packages/affine/blocks/surface/src/surface-model.ts:15-36`), both with an
`undefined` default so the load pass writes nothing
(`sync-controller.ts:309-319`), and with no version bump (stays `5`):

```ts
export type SurfaceLayerRecord = {
  /** Seeded through the translation seam at creation; content from then on. */
  name: string;
  /** Fractional key, bottom → top; the same alphabet as an element's `index`. */
  index: string;
  /** "Hide for everyone" on the whole layer. Absent = visible. */
  hidden?: true;
};

export type SurfaceBlockProps = {
  elements: Boxed<Y.Map<Y.Map<unknown>>>; // unchanged
  /** User layers by id. Absent until the first layer is created. */
  layers?: Record<string, SurfaceLayerRecord>;
  /** The grid, saved for everyone (§9). Absent = nobody decided. */
  showGrid?: boolean;
};
```

- **One record per layer, written key by key.** `native2Y` stores a plain
  record as nested `Y.Map`s (`packages/framework/store/src/reactive/native-y.ts:30-37`)
  and the props proxy writes a nested key straight into its `Y.Map`
  (`createYProxy`, `reactive/proxy.ts:283`; `sync-controller.ts:231`). Every
  layer write therefore sets ONE record or ONE field of a record — never the
  whole prop, which is what `affine:frame` does with `childElementIds`
  (`frame-model.ts:105-106`) and what this ADR forbids copying — so a rename
  and a reorder of the same layer by two peers merge key by key, and two peers
  creating two layers keep both.
- **The default layer** has the reserved id `'@default'`: a `@` cannot appear
  in a nanoid, and the interchange scopes already reserve `@`-prefixed keys
  for exactly that reason (`element-model.ts:122-129`). It has **no record while `layers` is absent**. The
  gesture that creates the first user layer writes TWO records in one
  transaction: `'@default'` (named through the seam, "Layer 1") and the new
  one above it. From then on the default layer is an ordinary record — it can
  be renamed, reordered and hidden — and the one layer that cannot be deleted.
- **Nothing else is a layer.** `LayerManager`'s runs are untouched and keep
  their name in code; the user-facing word is "layer", the code type is
  `SurfaceLayerRecord`, and the two never meet in one identifier.

### 3. Membership is one optional id on the element, `undefined` = default

- Elements: `@field() accessor layer: string | undefined = undefined` on
  `GfxPrimitiveElementModel`, declared on the BASE class for the reason `role`
  and `pivotDocId` are (`element-model.ts:668-679`): an element re-created from
  props (paste, duplicate, template) reaches the `Y.Map` only through declared
  keys.
- Gfx blocks: `layer?: string` joins `GfxCompatibleProps`
  (`gfx-block-model.ts:32-36`) and `layer: undefined` joins the props of every
  gfx block schema: `affine:note`, `affine:frame`, `affine:image`,
  `affine:attachment`, `affine:bookmark`, `affine:edgeless-text`,
  `affine:latex`, `affine:embed-iframe`, and the seven
  `createEmbedBlockSchema` flavours (`affine:embed-figma`, `-github`, `-html`,
  `-linked-doc`, `-loom`, `-synced-doc`, `-youtube`; `packages/affine/model/src/utils/helper.ts:30-57`).
- **A dangling id is the default layer, and is never dropped.** An id with no
  record — a deleted layer that a peer's concurrent paste still names, the
  loser of the first-creation race (open point 6), a file from another
  document — reads as `'@default'` at paint time and in the pane. Nothing
  rewrites it on read; the next local gesture on that element may.

### 4. Stacking: layer rank first, then today's comparator

`compare(a, b)` gains one step in front of everything it does today:

1. Resolve each side's **effective layer**: the `layer` of its outermost
   group-like ELEMENT ancestor (`group`, `mindmap`), else its own; dangling or
   `undefined` → `'@default'`. **Frames are not counted**: an `affine:frame` is
   group-compatible for z-order (`frame-model.ts:69-73`), but a frame is a
   slide, and the whole point of layers on a slide is a background layer under
   a content layer inside one frame.
2. Different effective layers → the layers' `index` order decides.
3. Same layer → today's comparator, unchanged.

The lexicographic pair is still a total preorder, because the existing
comparator is one on every subset. **Fast path**: when `layers` is absent,
step 1 is skipped entirely, so a document with no user layer sorts with
exactly the code that sorts it today. The rank map is cached per revision of
the `layers` record.

Consequences in `LayerManager`, owed by the layers stage:

- `generateIndex()` keeps answering "above everything"; with rank first, that
  is "top of its own layer", which is what a new element wants.
- Bring forward / send backward / to front / to back move an element **within
  its layer**: `getReorderedIndex` (`layer.ts:710`) takes its neighbours among
  the same layer's members only.
- A local element with a creator sorts with its creator (`compareLocal`,
  `utils/layer.ts:97-120`, unchanged); one without a creator sorts above every
  layer, as overlays do today.

### 5. Groups, frames and boards

- **A group lives in one layer, stored once, on the outermost group.** Its
  descendants' own `layer` keys are ignored while they are inside it.
  Grouping elements from several layers puts the new group in the layer of
  its highest member; ungrouping writes the group's layer onto each released
  child, in the ungroup's own transaction. Moving a grouped element "to layer
  X" from the pane moves its outermost group.
- **Frames hold elements from any layer.** "Filter by frame" in the pane reads
  `childElementIds`; for a framework board it reads the perimeter, through the
  selection the SVG export already uses (`selectBoardElements`,
  `export-svg/render.ts:39-55`). Hiding a frame's layer hides the frame, not
  what it holds.
- **A board and the artefacts on it are independent members.** A Wardley map
  in a "Background" layer and its components in "Content" is legal, and is the
  first thing a user will do.

### 6. Creation, paste, duplicate, templates, imports

One `beforeAdd` middleware beside `EditPropsMiddlewareBuilder` decides the
layer of every element `surface.addElement` creates:

- `props.layer` names an existing record → kept (duplicate, alt-drag, paste
  within the same document);
- absent, or names no record in THIS surface → the viewer's **active layer**
  (the one selected in the pane; `'@default'`, written as `undefined`, when
  none is selected or no layer exists).

So a paste from another document, a template insertion and an interchange
import (ADR 0012) land in the active layer, and a duplicate stays beside its
source. Element ids are remapped on paste as they are today; layer ids are
never remapped, because they never travel between documents meaningfully.
Gfx blocks get the same rule from the CRUD `addBlock` path and the clipboard's
block path; a block created by `store.addBlock` with no layer is in the
default layer, which is correct, merely not the active one.

The active layer is a per-viewer, per-session choice. It is never stored.

### 7. "Hide for everyone" is a new field, not `hidden`

- Elements: `@field() accessor hiddenForEveryone: true | undefined = undefined`,
  on the base class. Unhiding removes the key (`clearField`,
  `element-model.ts:531-590`), so a document goes back to byte-identical.
- Gfx blocks: `hiddenForEveryone?: true` in `GfxCompatibleProps` and
  `hiddenForEveryone: undefined` in the same fifteen schemas as `layer` (§3).
  Unhiding deletes the `prop:` key through the props proxy's `deleteProperty`
  (`sync-controller.ts:204-213`), never by storing `false`.
- A whole layer: `hidden: true` on its record — one write, not one per member.

Why not reuse `hidden`: mindmap collapse writes it on every descendant of a
collapsed node and clears it on expand (`mindmap.ts:882`), so expanding a
branch would silently unhide a node somebody hid for everyone, and the pane
could not tell "collapsed" from "hidden". The two meanings need two fields; the
older one keeps its owner.

### 8. Local hide: a per-editor set, painted and picked, never searched

- `CanvasLocalVisibility`, a `LifeCycleWatcher` in
  `packages/affine/shared/src/services/`, holds two signals: hidden element ids
  and hidden layer ids. It persists them as one `EditPropsStore` local prop,
  keyed by document id like the viewport (`edit-props-store.ts:128-132`), and
  prunes ids the document no longer has when it loads them.
- **Not `display`.** The text editor owns it (`edgeless-text-editor.ts:323`,
  `374`): closing the editor on a locally hidden text would unhide it.
- **The hit-testing gap is closed at picking, not at search.** `std` gains a
  per-editor predicate hook on the `GfxController`; the affine service
  registers into it. The predicate is read where `display` is read today
  (the four renderer sites) AND by pointer picking and marquee selection
  (`GfxController.getElementByPoint` / `getElementsByBound` when called for a
  pointer). It is NOT added to `grid.search` (`grid.ts:345-352`), because
  `grid.search` also answers "what does this board contain" to rules, legends
  and exporters, and one viewer's local hide must never change what another
  viewer's rules or legend say about the same document.

### 9. Where each predicate applies

| consumer                                                  | mindmap `hidden`       | `hiddenForEveryone` / hidden layer | local hide          |
| --------------------------------------------------------- | ---------------------- | ---------------------------------- | ------------------- |
| canvas & DOM renderers                                    | skip (today)           | skip                               | skip                |
| pointer picking, marquee                                  | skip (today, via grid) | skip                               | skip                |
| `grid.search` for logic (rules, legend, semantic exports) | skip (today)           | **keep**                           | **keep**            |
| SVG / PNG export                                          | skip (today)           | skip                               | skip (open point 2) |
| selection pane                                            | listed                 | listed, marked                     | listed, marked      |
| a group's bound (local, never stored)                     | excluded (today)       | excluded                           | kept                |

**Hiding is not deleting.** A hidden element is loadable, listed in the pane,
selectable from it (its selection frame shows; it does not paint), counted by
rules and by semantic exports (OWM, `.bpmn`, mermaid), and no cascade deletes
it: the paths that delete (an emptied text closing its editor, an empty group
dissolving) are unchanged and never read any visibility. Stage 1 audits every
`grid.search` caller and lists which row of this table it belongs to.

### 10. Deleting a layer deletes its members, in one undo step

`store.captureSync()`, then — after the `store.readonly` check every mutation
entry point owes — every element and gfx block whose effective layer is that
layer, then the record, then `captureSync()` again. Groups go with their
layer; a connector whose ends were in that layer and which itself is in
another layer stays (it becomes a loose connector, as when its ends are
deleted today). `'@default'` cannot be deleted.

### 11. The grid: four levels, the nearest decision wins

1. **Local override**, per viewer and per document: an `EditPropsStore` local
   prop (`localStorage`), written by the grid toggle.
2. **Document setting**: `showGrid` on the surface (§2), written by "Save for
   everyone", which also clears the saver's local override so they see what
   everyone sees.
3. **Host / user default**: an optional `edgelessShowGrid` in
   `GeneralSettingSchema` (`editor-setting-service.ts:9-17`), through the
   existing seam — no new seam.
4. **Library default**: on.

Off removes the `radial-gradient` from both containers and makes the PNG
export skip `_drawEdgelessBackground`'s grid (`export-manager.ts:400-409`).
The SVG export draws no grid today and keeps not drawing one.

### 12. The selection pane: headless, one new seam

Challenged first, per the wicked-features list ("a new seam — can an existing
one carry it?"): the catalogue seam is `open(owner: CommandOwner)`, scoped to a
framework; stretching it to a second panel changes the signature of a shipped
seam. So one new seam, shaped exactly like it:

```ts
export interface SelectionPaneService {
  open(): void;
  close(): void;
}
export const SelectionPaneProvider = createIdentifier<SelectionPaneService>(
  'AffineSelectionPane'
);
export function SelectionPaneExtension(
  service: SelectionPaneService | null
): ExtensionType;
```

- **Data** is enumerable, not pushed: `selectionPaneTree(std)` returns a
  signal of nodes `{ id, kind: 'element' | 'block' | 'layer', type, role?,
groupId?, layerId, locked, hiddenLocal, hiddenForEveryone, children? }` in
  z-order, top first. Labels are read from the element (`title`, `text`,
  role wording) at render time by whoever draws; the tree carries ids.
- **Actions** are `CommandDescriptor`s (ADR 0008), `owner: 'core'`, on the
  `palette` and `agent` surfaces: `canvas.layer.create`, `.rename`,
  `.reorder`, `.delete`, `.moveElements`, `canvas.visibility.hideLocal`,
  `.hideForEveryone`, `.showAll`, `canvas.grid.toggle`, `.saveForEveryone`.
  A host's pane acts through `runCommand`, so telemetry and readonly checks
  happen once.
- **The library ships its own panel** (an ADR 0011 editor-anchored panel,
  docked left), registered beside the catalogue widget; the edgeless toolbar's
  button opens it through the provider.
- **Seams table row**, added to `docs/integrate/04-host-seams.md` by the stage
  that ships the pane: _Selection pane — `SelectionPaneExtension({ open,
close })` — the library draws its own side panel. `null` removes the pane,
  its toolbar button, and the local-hide and layer actions that only the pane
  can undo; elements already hidden for everyone stay hidden, layers keep
  stacking, and `canvas.visibility.showAll` stays in the palette._ Plus the
  test that mounts the editor with `null`.

### 13. Flags: none new

Layers, `hiddenForEveryone` and `showGrid` are content and are never gated
(ADR 0009). The pane is tooling, and the seam's `null` is already its
cold-assembly switch, exactly as for the catalogue. A new `OPTIONAL_CAPABILITIES`
key would be a second switch for one thing and a key every host's flag
service must learn; this ADR adds none (open point 3).

### 14. Telemetry: four events, ids and counts only

| event                     | properties                                                                                               |
| ------------------------- | -------------------------------------------------------------------------------------------------------- |
| `SelectionPaneOpened`     | `source: 'toolbar' \| 'palette' \| 'shortcut'`                                                           |
| `CanvasVisibilityChanged` | `target: 'element' \| 'layer'`, `scope: 'local' \| 'everyone'`, `hidden: boolean`, `count`               |
| `CanvasLayerChanged`      | `action: 'create' \| 'rename' \| 'reorder' \| 'delete' \| 'move-elements'`, `layerCount`, `memberCount?` |
| `CanvasGridToggled`       | `scope: 'local' \| 'everyone'`, `visible: boolean`                                                       |

Never a layer name, a group title or any element text. Typed in the telemetry
service beside `FrameworkDiagramEvents`
(`packages/affine/shared/src/services/telemetry-service/lifecycle.ts:195-203`),
documented in its README, emitted once by `runCommand` from the descriptors
where they fit and by the pane's drag handler for `reorder` /
`move-elements`.

## What stays loadable

| field                                | old document, new client                   | new document, 0.43 client                                                                                          | 0.43 client resaves / copies                                                                                          |
| ------------------------------------ | ------------------------------------------ | ------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------- |
| `surface.layers`                     | absent: one implicit layer, fast-path sort | ignored: stacks by `index` only — identical inside a layer, possibly different across layers after a layer reorder | never writes the surface's props, so the record is untouched                                                          |
| element `layer`                      | absent = default                           | undeclared key, ignored                                                                                            | kept through copy/duplicate (`_assignElementProp`, PR #73); a new element of an old client lands in the default layer |
| block `layer`                        | absent = default                           | unknown `prop:` key, parsed and kept (`sync-controller.ts:253-256`)                                                | kept: the snapshot walks the model's `keys`, which include it (guard test in stage 1)                                 |
| `hiddenForEveryone` (element, block) | absent = visible                           | **painted**: an old client shows what others hid                                                                   | kept, as above                                                                                                        |
| layer `hidden`                       | absent = visible                           | **painted**, as above                                                                                              | untouched                                                                                                             |
| `surface.showGrid`                   | absent: local / host / library decide      | ignored: the old client's grid is always on                                                                        | untouched                                                                                                             |

Nothing a 0.43 client can do loses a field this ADR adds. What it shows
differently is visibility (it shows everything) and, after a layer reorder,
cross-layer stacking. **Not** chosen: a dedicated `layer` element type in
`SurfaceElementModelMap`, because a 0.43 client throws on an unknown element
type while loading the surface (`surface-model.ts:523`, `765-778`) — the whole
canvas would fail to open, not merely lose its layers.

## Consequences

- **`compare` reads the surface.** It needs the rank map, so the layer
  resolution lives on the surface model and `compare` takes it from the
  elements it is handed. The fast path is what keeps the 500-element Wardley
  frame budget (`FRAME_BUDGET_MS = 16`) unchanged for documents without
  layers; the layers stage adds a budget case WITH three layers.
- **Fifteen block schemas gain two optional props.** Mechanical, but it is
  fifteen red-zone edits; one parity test asserts every `GfxCompatible`
  schema declares both, the way `lockedBySelf` is declared everywhere today.
- **A second hide everywhere a renderer asks "is this painted?"** — which is
  why stage 1 first funnels the four renderer sites through one predicate.
- **Rules and legends see hidden content.** That is the definition (§9), and a
  framework that ever wants "rules ignore hidden" must say so in its own ADR.
- **The grid becomes a setting** where it was only CSS; the PNG export reads
  it.
- **Two hosts' worth of new wording**: layer default names, pane labels, the
  ten commands. Keys, with English fallbacks; the French is the host's.

## Alternatives rejected

- **Layers as groups with a `core:layer` role.** No schema change, but group
  semantics leak everywhere a group is a group: one click selects the whole
  "layer", moving one element drags the layer, `getTopElements` returns the
  layer instead of its contents, and a real group could no longer span the
  layer structure. Every one of those would need an exception.
- **A `layer` element type.** The 0.43 crash above, plus a non-drawn element
  in the spatial index, the selection, "select all", the exporters.
- **The list as an ordered array of records.** `native2Y` makes it a `Y.Array`
  (`native-y.ts:21-29`), whose only reorder is delete + insert: a rename racing
  a reorder resurrects or duplicates the record. A fractional `index` per
  record reorders with one key write, the way elements already do.
- **Membership stored on every member of a group.** Two sources of truth for
  one fact, and the first regroup contradicts them.
- **Rewriting member `index`es on every layer reorder**, so old clients stack
  correctly. N writes for a one-field gesture, and still wrong after any
  concurrent reorder; old clients are a transitional population. Open point 1.
- **Reusing `hidden`** (§7) and **reusing `display`** (§8).
- **A document-level "hidden ids" side table.** Loses the clipboard, orphans
  rows on deletion — ADR 0012's D2 argument, unchanged.

## Staged delivery

Each stage is one PR, shippable alone, with its changeset. A stage writes only
fields fixed above; none writes before this ADR is accepted.

| #   | stage                     | writes                                                 | ships                                                                                                                                                                                                                                                                    |
| --- | ------------------------- | ------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1   | Groundwork                | nothing                                                | one paint predicate behind the four renderer sites (no behaviour change); the `grid.search` caller audit (§9); guard tests: unknown `prop:` on `affine:surface` and on a gfx block survives snapshot + clipboard; an unknown element type throws (pins why §3 is a prop) |
| 2   | Selection pane, read side | `index`, `lockedBySelf` (existing)                     | the seam + seams-table row + null-provider test; the panel; z-order list with groups, lock, filter by frame / board, drag-reorder within the stack; `SelectionPaneOpened`                                                                                                |
| 3   | Local hide                | nothing in the document                                | `CanvasLocalVisibility`, persistence, paint + pick predicate, eye toggle, `showAll`; `CanvasVisibilityChanged` (`scope: 'local'`)                                                                                                                                        |
| 4   | Grid                      | `surface.showGrid`                                     | local toggle, `edgelessShowGrid` host default, "Save for everyone", PNG export; `CanvasGridToggled`                                                                                                                                                                      |
| 5   | Hide for everyone         | `hiddenForEveryone` (elements, 15 block schemas)       | the field, the predicate's shared half, the pane action; `scope: 'everyone'`                                                                                                                                                                                             |
| 6   | Layers                    | `surface.layers`, `layer` (elements, 15 block schemas) | comparator + fast path + budget case; `beforeAdd` middleware; within-layer z-order commands; group / ungroup rules; pane sections: create, rename, reorder, move to layer, collapse; `CanvasLayerChanged`                                                                |
| 7   | Layer hide and delete     | layer record `hidden`; deletions                       | local and shared layer hide; delete with members in one undo step                                                                                                                                                                                                        |

## Open points for the maintainer

1. After a layer reorder, should member `index`es be rewritten so a 0.43 client
   stacks the same? Recommended: no.
2. Should SVG / PNG exports omit locally hidden elements (what you see is what
   you export)? Recommended: yes.
3. Is the seam's `null` enough to switch the pane off, with no new flag key?
   Recommended: yes.
4. Is it acceptable that a 0.43 client paints what others hid for everyone?
   Recommended: yes — it is in the document either way, and hosts upgrade
   together.
5. A paste whose layer id is unknown here lands in the active layer, a
   duplicate stays in its source's layer. Confirm?
6. Two peers creating the FIRST layer at the same moment each write
   `prop:layers`; one record set wins and the other peer's members fall back to
   the default layer (dangling ids, nothing dropped). Acceptable for v1, or
   should `layers` be pre-created empty on the first edgeless edit (a write on
   a gesture, not on load)?
7. Local hide persisted in `localStorage` per document (survives reload), or
   per session only?

Resolved at acceptance: every recommendation above is retained (1 no, 2 yes, 3 yes, 4 yes, 5 confirmed, 6 acceptable for v1, 7 persisted per document). The "Hide for everyone" and "Save for everyone" entries are painted with the theme warning tokens (`--affine-background-warning-color`, `--affine-warning-color`): the library has no announcement component and adds none.

## Amendments

**Snapshots carry the surface props (prerequisite of stage 4).** The
"untouched" in the loadability table held for Yjs sync only. A whole-document
snapshot — doc copy, template insertion, export / import — went through
`SurfaceBlockTransformer`, which rebuilt the surface's props as `{ elements }`
in both `toSnapshot` and `fromSnapshot`, so `layers` and `showGrid` (and any
surface prop a newer client wrote) were dropped by every snapshot round trip.
Stage 1 pinned it as an expected failure in
`packages/affine/all/src/__tests__/canvas-layers-format-guards.unit.spec.ts`.
The transformer now carries every surface prop other than `elements` through
both directions unchanged, unknown keys included; only `elements` is rebuilt.
A snapshot written before the fix holds `elements` alone and loads exactly as
before. Two consequences: a client that has this fix keeps `layers` /
`showGrid` through a snapshot even if it predates the fields (they are
unknown keys to it), and a 0.43 client's snapshot still drops them — the
loadability table's last column is right for sync and resave, not for a
0.43 snapshot copy.

A related edge stays open, in the store (red zone, not changed here): a block
model's `keys` are fixed when the model is built
(`packages/framework/store/src/model/block/sync-controller.ts`, `model.keys =
Object.keys(props)`), and a `prop:` key a peer adds afterwards reaches
`model.props` but not `keys`. The snapshot walks `keys`, so a client whose
schema does not declare the key (a 0.43 client for `layer` /
`hiddenForEveryone`) drops it from a snapshot-based duplicate until it reloads
the document. A client that declares the fields has them in `keys` from load
and is not affected.

**The pane filters by frame only, and a frame is not a row (2026-10-05,
product owner's review of the pane).** §5 and the staged-delivery table offered
"filter by frame / board", and the pane listed each `affine:frame` as a row of
the stack. Both are reversed. The filter offers `affine:frame` blocks only:
`selectionPaneFilterTargets` answers frames, its `kind` is always `'frame'`,
and `selectionPaneFilterMembers` answers `null` for anything else, so the
board-perimeter reading through `selectBoardElements` is no longer used by the
pane (the SVG export keeps it). A frame is the filter's scope, never an
element of the stack: `buildSelectionPaneTree` — hence the headless
`selectionPaneTree(std)` a host draws from — carries no frame node, and a
frame's members are listed where they paint, i.e. together, right above the
frame's place in the stack. Framework boards stay ordinary rows. Nothing
stored changes. The `com.labre.selection-pane.filter.board` key
("Board: {{name}}") is removed; a host catalogue may drop it.
