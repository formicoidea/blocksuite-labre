# @labre/affine-widget-edgeless-selected-rect

## 0.34.1

### Patch Changes

- Updated dependencies [6120f7a]
- Updated dependencies [cb49bb1]
  - @labre/affine-model@0.34.1
  - @labre/std@0.34.1
  - @labre/affine-block-surface@0.34.1
  - @labre/affine-block-frame@0.34.1
  - @labre/affine-block-note@0.34.1
  - @labre/affine-components@0.34.1
  - @labre/affine-gfx-connector@0.34.1
  - @labre/affine-gfx-shape@0.34.1
  - @labre/affine-gfx-text@0.34.1
  - @labre/affine-inline-reference@0.34.1
  - @labre/affine-shared@0.34.1
  - @labre/affine-ext-loader@0.34.1
  - @labre/global@0.34.1

## 0.34.0

### Patch Changes

- Updated dependencies [881d3f5]
- Updated dependencies [6c1bdfb]
- Updated dependencies [8b00f7d]
- Updated dependencies [5f76ab3]
- Updated dependencies [f09d68c]
  - @labre/std@0.34.0
  - @labre/affine-shared@0.34.0
  - @labre/affine-block-surface@0.34.0
  - @labre/affine-block-frame@0.34.0
  - @labre/affine-block-note@0.34.0
  - @labre/affine-components@0.34.0
  - @labre/affine-inline-reference@0.34.0
  - @labre/affine-gfx-connector@0.34.0
  - @labre/affine-gfx-shape@0.34.0
  - @labre/affine-gfx-text@0.34.0
  - @labre/affine-model@0.34.0
  - @labre/affine-ext-loader@0.34.0
  - @labre/global@0.34.0

## 0.33.0

### Patch Changes

- Updated dependencies [3fbf69c]
- Updated dependencies [f929e12]
- Updated dependencies [13360cd]
- Updated dependencies [5c39582]
- Updated dependencies [8890efe]
- Updated dependencies [c03090c]
- Updated dependencies [32e4d45]
- Updated dependencies [139d77b]
- Updated dependencies [6bba40c]
- Updated dependencies [a8325bb]
- Updated dependencies [ff19911]
- Updated dependencies [7aa932c]
- Updated dependencies [b03132c]
- Updated dependencies [48049d6]
- Updated dependencies [7136db0]
- Updated dependencies [932bf35]
- Updated dependencies [5737a56]
- Updated dependencies [168617d]
- Updated dependencies [932bf35]
- Updated dependencies [1dbd735]
- Updated dependencies [9022c92]
- Updated dependencies [b97efc6]
- Updated dependencies [edfaba2]
- Updated dependencies [46ce0c9]
- Updated dependencies [334bd61]
- Updated dependencies [2ec39c0]
- Updated dependencies [e42e0c0]
- Updated dependencies [256ee0b]
- Updated dependencies [4a3b26e]
- Updated dependencies [48c3b52]
- Updated dependencies [6a20738]
- Updated dependencies [f09f9a3]
  - @labre/affine-block-surface@0.33.0
  - @labre/affine-components@0.33.0
  - @labre/affine-shared@0.33.0
  - @labre/affine-model@0.33.0
  - @labre/std@0.33.0
  - @labre/affine-gfx-connector@0.33.0
  - @labre/affine-block-frame@0.33.0
  - @labre/affine-block-note@0.33.0
  - @labre/affine-gfx-shape@0.33.0
  - @labre/affine-gfx-text@0.33.0
  - @labre/affine-inline-reference@0.33.0
  - @labre/affine-ext-loader@0.33.0
  - @labre/global@0.33.0

## 0.32.0

### Patch Changes

- 9453013: Selection, handles and remote cursors follow their element inside a scaled editor

  An editor embedded in a host that scales it — a synced edgeless doc opened
  inside another document — paints its blocks in the container's already scaled
  space. The overlays drawn over those blocks were instead placed in real screen
  pixels, so the container scaled them a second time: the selection rectangle, the
  resize and element handles, the link chip, the remote cursors and the shape text
  editor all drifted away from the shapes they belong to, and further away with
  every scroll and zoom.

  Every one of them now states its placement the way a block states its own, so
  they sit on their element again. A standalone editor, where the host applies no
  scale, is unaffected.

- 695471f: The auto-complete arrow only appears on what the click can actually complete

  Clicking an auto-complete arrow on a Wardley map threw
  `TypeError: Cannot read properties of undefined (reading 'background')` and left
  the canvas untouched. The arrow was being offered on a **group**: a Wardley
  component is a `wardleyNode` plus its text label bundled together, and selecting
  it on the canvas selects that group, not the node. `createEdgelessElement` then
  took "not a shape" to mean "therefore a note" and read `current.props.background`
  — a surface element has no `props` bag at all.

  **Two levels, so the crash cannot come back by another door.**
  `createEdgelessElement` now recognises the two things it can clone — a shape
  (subclasses included: Wardley, EDGY and BPMN nodes all pass) and a note block —
  and returns `null` for anything else instead of reading a `props` bag on faith.
  The caller already treated a falsy id as "nothing to complete".

  **And the arrows now agree with the click.** The render guard hung on a stale
  hover flag rather than on the predicate the click handlers use, so any selected
  element grew arrows as soon as the pointer left it — a group, a free text label,
  a framework background, or the first element of a multi-selection. It is now the
  same single predicate throughout: exactly one element selected, it is the one the
  widget holds, and it is a shape or a note. The dead hover flag and the pointer
  tracking that fed it are gone.

  Nothing changes for a shape (four arrows, click clones it and draws the
  connector), a note (two arrows, click adds a note), a mindmap node (its sub- and
  sibling-node buttons), or the drag-out gesture that opens the shape picker. A
  lone Wardley node — selected by entering the group — is a shape, and completes
  into a properly typed Wardley clone rather than a plain rectangle.

- 0ddfd47: fix(edgeless): a readonly board refuses element moves, resizes and tool arming

  Surface-element writes go through `store.transact`. `SurfaceBlockModel` does
  throw on readonly, but that is an exception raised at the bottom of a gesture:
  several paths never reach it, and the ones that do surface an uncaught error on
  `window` instead of a clean refusal.

  What actually changes on a readonly board:

  - **The mouse no longer moves anything.** `DefaultTool.dragStart` went straight
    to `handleElementMove`, which writes `xywh` through a `@field()` accessor —
    raw `store.transact`, no crud, no exception. A drag on a readonly board wrote
    into the Yjs document exactly as on an editable one. The refusal sits in
    `InteractivityManager.handleElementMove` / `handleElementResize` /
    `handleElementRotate` / `requestElementClone` — the layer that actually
    writes, so no gesture entry point can go round it. Panning, rubber-band
    selection and plain selection stay available; moving content, alt-drag
    cloning and resizing do not.
  - **`edgeless-selected-rect` drops its 8 resize handles.** The gate existed but
    only ran on selection change, so a board switched to readonly while something
    was selected kept its handles — and dragging one wrote.
  - **Creation tools refuse to arm** (`p`, `Shift-p`, `c`, `t`, `n`, `f`, `e`,
    `s`). They call `surface.addElement` / `store.addBlock` directly and raised
    uncaught `BlockSuiteError`s on ordinary keystrokes. The whitelist lives on
    `ToolController.setTool`, the single bottleneck every entry point goes
    through — keyboard managers, the toolbar and its mixins, senior buttons —
    because `s` is bound by `shape-draggable.ts` straight onto the mixin and
    never reaches the edgeless keyboard manager. Selection, pan and the
    presentation navigator still switch.
  - **`createGroupFromSelectedCommand` / `ungroupCommand`** refuse **before**
    their `removeChild` calls, which used to run even though the follow-up
    `addElement` would refuse — orphaning the selection out of its parent group,
    or dissolving the group outright on `Shift+Mod+G`. This is the one
    destructive bug of the set.
  - **Mindmap keyboard writes**: node text overwrite on letter-typing (both the
    wrapped hotkeys and the generic keyDown listener), `addNode` on Enter/Tab,
    arrow-key element moves (arrow **navigation** stays), Backspace/Delete.
  - **`ValidationManager.setException` / `setProfile` / `revokeExceptionsOn`**
    return empty/`false`; every caller gates its `track` on those returns, so a
    write that never happened is never reported.
  - **`applyLastStyle`**: no targets, so the command's `when` fails and the
    keystroke falls through to the `redo-windows` alias that shares Mod+Y on
    Windows.

  `EdgelessCRUDExtension` (`addElement` / `updateElement` / `deleteElements` /
  `removeElement`) and `EdgelessRootService.removeElement` / `reorderElement` now
  refuse with a `console.error` instead of letting the model throw — the same
  contract as `store.updateBlock` / `deleteBlock` / `moveBlocks`. That is a change
  of failure MODE, not a new refusal: the surface model already said no.

  `framework/store` and `sync` are untouched.

- 5a16359: Auto-complete puts the caret in the note it just created, and its panel where it was clicked

  Completing a shape into a note asked the browser to place the caret at a point
  measured from the editor's own top left corner, while the browser reads such a
  point from the window's. Wherever the editor is not flush against the window —
  a sidebar, a header, a panel — the caret was dropped that far away from the new
  note, and typing went nowhere. The panel of shape and note choices was opened
  from the pointer with the same mismatch, in the opposite direction.

  Both now speak the coordinates the browser does. The panel also states its own
  position, and the edges it keeps away from, in the space of the container an
  embedding host may have scaled, so it stays on screen there too.

- Updated dependencies [832c793]
- Updated dependencies [c5c07b9]
- Updated dependencies [ff5f060]
- Updated dependencies [913da26]
- Updated dependencies [1b59f3c]
- Updated dependencies [41ab595]
- Updated dependencies [0bfc872]
- Updated dependencies [8ded589]
- Updated dependencies [9e23b5b]
- Updated dependencies [a3aa598]
- Updated dependencies [90a9168]
- Updated dependencies [aa08529]
- Updated dependencies [6417a2f]
- Updated dependencies [d797f9a]
- Updated dependencies [9fde974]
- Updated dependencies [d360f72]
- Updated dependencies [9fe5773]
- Updated dependencies [50ab9ae]
- Updated dependencies [89b90e9]
- Updated dependencies [463989f]
- Updated dependencies [f7f23b2]
- Updated dependencies [751ac44]
- Updated dependencies [9453013]
- Updated dependencies [b746d6b]
- Updated dependencies [b93b43c]
- Updated dependencies [5ac0c68]
- Updated dependencies [630633b]
- Updated dependencies [1fa46c1]
- Updated dependencies [be100e3]
- Updated dependencies [ff3a5f7]
- Updated dependencies [0473dcb]
- Updated dependencies [5b6e9bb]
- Updated dependencies [86e7562]
- Updated dependencies [492bac6]
- Updated dependencies [72b334c]
- Updated dependencies [30580db]
- Updated dependencies [08e9b24]
- Updated dependencies [dc5261e]
- Updated dependencies [5076cb8]
- Updated dependencies [3c5c97e]
- Updated dependencies [7c10406]
- Updated dependencies [02797b5]
- Updated dependencies [413fe7b]
- Updated dependencies [724ed1c]
- Updated dependencies [c7612da]
- Updated dependencies [3e1665b]
- Updated dependencies [0ddfd47]
- Updated dependencies [3639562]
- Updated dependencies [5d16745]
- Updated dependencies [1c37478]
- Updated dependencies [b684b4c]
- Updated dependencies [48e90f4]
- Updated dependencies [5edd916]
- Updated dependencies [5a16359]
- Updated dependencies [b1ed4ef]
- Updated dependencies [985a92f]
- Updated dependencies [b889326]
- Updated dependencies [1efc6d5]
- Updated dependencies [4162e4a]
- Updated dependencies [3ac3587]
- Updated dependencies [fad4c08]
- Updated dependencies [7b940cf]
- Updated dependencies [7b66d8d]
- Updated dependencies [184c412]
- Updated dependencies [4bb44ef]
- Updated dependencies [30061cb]
- Updated dependencies [c2735aa]
- Updated dependencies [346b5d9]
- Updated dependencies [77b0100]
- Updated dependencies [8d33c60]
- Updated dependencies [061729e]
- Updated dependencies [7a3458a]
  - @labre/std@0.32.0
  - @labre/affine-shared@0.32.0
  - @labre/affine-block-note@0.32.0
  - @labre/affine-components@0.32.0
  - @labre/affine-model@0.32.0
  - @labre/affine-gfx-shape@0.32.0
  - @labre/affine-gfx-connector@0.32.0
  - @labre/affine-block-surface@0.32.0
  - @labre/affine-gfx-text@0.32.0
  - @labre/global@0.32.0
  - @labre/affine-block-frame@0.32.0
  - @labre/affine-inline-reference@0.32.0
  - @labre/affine-ext-loader@0.32.0

## 0.31.0

### Patch Changes

- @labre/affine-block-frame@0.31.0
- @labre/affine-block-note@0.31.0
- @labre/affine-block-surface@0.31.0
- @labre/affine-components@0.31.0
- @labre/affine-ext-loader@0.31.0
- @labre/affine-gfx-connector@0.31.0
- @labre/affine-gfx-shape@0.31.0
- @labre/affine-gfx-text@0.31.0
- @labre/affine-inline-reference@0.31.0
- @labre/affine-model@0.31.0
- @labre/affine-shared@0.31.0
- @labre/std@0.31.0
- @labre/global@0.31.0

## 0.30.2

### Patch Changes

- @labre/affine-block-frame@0.30.2
- @labre/affine-block-note@0.30.2
- @labre/affine-block-surface@0.30.2
- @labre/affine-components@0.30.2
- @labre/affine-ext-loader@0.30.2
- @labre/affine-gfx-connector@0.30.2
- @labre/affine-gfx-shape@0.30.2
- @labre/affine-gfx-text@0.30.2
- @labre/affine-inline-reference@0.30.2
- @labre/affine-model@0.30.2
- @labre/affine-shared@0.30.2
- @labre/global@0.30.2
- @labre/std@0.30.2

## 0.30.1

### Patch Changes

- @labre/affine-block-frame@0.30.1
- @labre/affine-block-note@0.30.1
- @labre/affine-block-surface@0.30.1
- @labre/affine-components@0.30.1
- @labre/affine-ext-loader@0.30.1
- @labre/affine-gfx-connector@0.30.1
- @labre/affine-gfx-shape@0.30.1
- @labre/affine-gfx-text@0.30.1
- @labre/affine-inline-reference@0.30.1
- @labre/affine-model@0.30.1
- @labre/affine-shared@0.30.1
- @labre/global@0.30.1
- @labre/std@0.30.1

## 0.30.0

### Patch Changes

- Updated dependencies [9d0fe0c]
- Updated dependencies [4aeb85e]
- Updated dependencies [ecba791]
- Updated dependencies [8de86f4]
  - @labre/std@0.30.0
  - @labre/affine-block-frame@0.30.0
  - @labre/affine-model@0.30.0
  - @labre/affine-gfx-shape@0.30.0
  - @labre/affine-block-note@0.30.0
  - @labre/affine-block-surface@0.30.0
  - @labre/affine-components@0.30.0
  - @labre/affine-gfx-connector@0.30.0
  - @labre/affine-gfx-text@0.30.0
  - @labre/affine-inline-reference@0.30.0
  - @labre/affine-shared@0.30.0
  - @labre/affine-ext-loader@0.30.0
  - @labre/global@0.30.0

## 0.29.1

### Patch Changes

- @labre/affine-block-frame@0.29.1
- @labre/affine-block-note@0.29.1
- @labre/affine-block-surface@0.29.1
- @labre/affine-components@0.29.1
- @labre/affine-ext-loader@0.29.1
- @labre/affine-gfx-connector@0.29.1
- @labre/affine-gfx-shape@0.29.1
- @labre/affine-gfx-text@0.29.1
- @labre/affine-inline-reference@0.29.1
- @labre/affine-model@0.29.1
- @labre/affine-shared@0.29.1
- @labre/global@0.29.1
- @labre/std@0.29.1

## 0.29.0

### Patch Changes

- Updated dependencies [7375b9a]
- Updated dependencies [9330750]
  - @labre/affine-shared@0.29.0
  - @labre/std@0.29.0
  - @labre/affine-block-frame@0.29.0
  - @labre/affine-block-note@0.29.0
  - @labre/affine-block-surface@0.29.0
  - @labre/affine-components@0.29.0
  - @labre/affine-gfx-connector@0.29.0
  - @labre/affine-gfx-shape@0.29.0
  - @labre/affine-gfx-text@0.29.0
  - @labre/affine-inline-reference@0.29.0
  - @labre/affine-model@0.29.0
  - @labre/affine-ext-loader@0.29.0
  - @labre/global@0.29.0

## 0.28.0

### Patch Changes

- Updated dependencies [65cc055]
  - @labre/std@0.28.0
  - @labre/affine-block-frame@0.28.0
  - @labre/affine-block-note@0.28.0
  - @labre/affine-block-surface@0.28.0
  - @labre/affine-components@0.28.0
  - @labre/affine-gfx-connector@0.28.0
  - @labre/affine-gfx-shape@0.28.0
  - @labre/affine-gfx-text@0.28.0
  - @labre/affine-inline-reference@0.28.0
  - @labre/affine-model@0.28.0
  - @labre/affine-shared@0.28.0
  - @labre/affine-ext-loader@0.28.0
  - @labre/global@0.28.0

## 0.27.0

### Minor Changes

- 91f6397: Round out the canvas element link feature (edit / remove / groups / a11y).

  - The context menu is now link-state aware: an unlinked element shows **Link**,
    a linked one shows **Edit link** (re-pick a doc or URL) and **Remove link**
    (clears the stored target). External-URL links now emit a `Link` telemetry
    event, matching the existing `LinkedDocCreated` for doc links.
  - The hover arrow now resolves to the nearest **linked group**: hovering a child
    of a group that carries a link shows the arrow on the group's bounds (a child
    with its own link still wins).
  - The hover arrow is keyboard accessible: `role="button"`, focusable, with an
    `aria-label`/`title` and Enter/Space activation.
  - **Link** / **Edit link** are hidden when the host does not provide
    `QuickSearchProvider` (they would otherwise no-op); **Remove link** stays
    available since clearing needs no picker.

- 91f6397: Link a canvas drawing element to an existing doc or an external URL.

  A new **Link** item in the edgeless element context menu opens the same
  quick-search modal as the existing link feature (doc of the workspace _or_ an
  internet URL) and attaches the chosen target to the selected drawing element
  (shape, text, connector, group — anything but blocks/frames). The link is
  stored as two optional fields on the surface element base model
  (`externalLink` / `linkedDocId`), which are backward-compatible (old documents
  read `undefined`, no migration).

  When the linked element is hovered on the canvas, a small arrow button appears
  (via the `edgeless-element-link` widget): clicking it opens the doc in the host
  side-view (through `docLinkClicked`) or the URL in a new tab. Minimal by
  design — no embed card, unlike "Create linked doc".

  Out of scope for v1: links on block-type canvas elements (image / note /
  bookmark), selecting-time affordance, and editing/removing the link from the
  menu.

### Patch Changes

- Updated dependencies [91f6397]
  - @labre/std@0.27.0
  - @labre/affine-block-frame@0.27.0
  - @labre/affine-block-note@0.27.0
  - @labre/affine-block-surface@0.27.0
  - @labre/affine-components@0.27.0
  - @labre/affine-gfx-connector@0.27.0
  - @labre/affine-gfx-shape@0.27.0
  - @labre/affine-gfx-text@0.27.0
  - @labre/affine-inline-reference@0.27.0
  - @labre/affine-model@0.27.0
  - @labre/affine-shared@0.27.0
  - @labre/affine-ext-loader@0.27.0
  - @labre/global@0.27.0

## 0.26.0

### Patch Changes

- Updated dependencies [8960a6c]
- Updated dependencies [6795191]
  - @labre/affine-model@0.26.0
  - @labre/affine-components@0.26.0
  - @labre/affine-block-frame@0.26.0
  - @labre/affine-block-note@0.26.0
  - @labre/affine-block-surface@0.26.0
  - @labre/affine-gfx-connector@0.26.0
  - @labre/affine-gfx-shape@0.26.0
  - @labre/affine-gfx-text@0.26.0
  - @labre/affine-shared@0.26.0
  - @labre/affine-ext-loader@0.26.0
  - @labre/global@0.26.0
  - @labre/std@0.26.0

## 0.25.0

### Patch Changes

- Updated dependencies [8960a6c]
- Updated dependencies [6795191]
  - @labre/affine-model@0.25.0
  - @labre/affine-components@0.25.0
  - @labre/affine-block-frame@0.25.0
  - @labre/affine-block-note@0.25.0
  - @labre/affine-block-surface@0.25.0
  - @labre/affine-gfx-connector@0.25.0
  - @labre/affine-gfx-shape@0.25.0
  - @labre/affine-gfx-text@0.25.0
  - @labre/affine-shared@0.25.0
  - @labre/affine-ext-loader@0.25.0
  - @labre/global@0.25.0
  - @labre/std@0.25.0

## 0.24.0

### Patch Changes

- @labre/affine-block-frame@0.24.0
- @labre/affine-block-note@0.24.0
- @labre/affine-block-surface@0.24.0
- @labre/affine-components@0.24.0
- @labre/affine-ext-loader@0.24.0
- @labre/affine-gfx-connector@0.24.0
- @labre/affine-gfx-shape@0.24.0
- @labre/affine-gfx-text@0.24.0
- @labre/affine-model@0.24.0
- @labre/affine-shared@0.24.0
- @labre/global@0.24.0
- @labre/std@0.24.0

## 0.23.3

### Patch Changes

- Updated dependencies
  - @labre/affine-shared@0.23.3
  - @labre/affine-block-frame@0.23.3
  - @labre/affine-block-note@0.23.3
  - @labre/affine-block-surface@0.23.3
  - @labre/affine-components@0.23.3
  - @labre/affine-gfx-connector@0.23.3
  - @labre/affine-gfx-shape@0.23.3
  - @labre/affine-gfx-text@0.23.3
  - @labre/affine-ext-loader@0.23.3
  - @labre/affine-model@0.23.3
  - @labre/global@0.23.3
  - @labre/std@0.23.3

## 0.23.2

### Patch Changes

- Updated dependencies [ee682da]
  - @labre/affine-shared@0.23.2
  - @labre/affine-block-frame@0.23.2
  - @labre/affine-block-note@0.23.2
  - @labre/affine-block-surface@0.23.2
  - @labre/affine-components@0.23.2
  - @labre/affine-gfx-connector@0.23.2
  - @labre/affine-gfx-shape@0.23.2
  - @labre/affine-gfx-text@0.23.2
  - @labre/affine-ext-loader@0.23.2
  - @labre/affine-model@0.23.2
  - @labre/global@0.23.2
  - @labre/std@0.23.2

## 0.23.1

### Patch Changes

- Updated dependencies [1beb60e]
  - @labre/affine-shared@0.23.1
  - @labre/affine-block-frame@0.23.1
  - @labre/affine-block-note@0.23.1
  - @labre/affine-block-surface@0.23.1
  - @labre/affine-components@0.23.1
  - @labre/affine-gfx-connector@0.23.1
  - @labre/affine-gfx-shape@0.23.1
  - @labre/affine-gfx-text@0.23.1
  - @labre/affine-ext-loader@0.23.1
  - @labre/affine-model@0.23.1
  - @labre/global@0.23.1
  - @labre/std@0.23.1

## 0.23.0

### Patch Changes

- Updated dependencies [9014c87]
- Updated dependencies [c775151]
  - @labre/affine-model@0.23.0
  - @labre/affine-block-surface@0.23.0
  - @labre/affine-shared@0.23.0
  - @labre/affine-block-frame@0.23.0
  - @labre/affine-block-note@0.23.0
  - @labre/affine-components@0.23.0
  - @labre/affine-gfx-connector@0.23.0
  - @labre/affine-gfx-shape@0.23.0
  - @labre/affine-gfx-text@0.23.0
  - @labre/affine-ext-loader@0.23.0
  - @labre/global@0.23.0
  - @labre/std@0.23.0
