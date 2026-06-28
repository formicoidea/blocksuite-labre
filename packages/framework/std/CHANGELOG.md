# @labre/std

## 0.29.0

### Minor Changes

- 9330750: Add an enumerable, host-overridable keyboard shortcut system (#30, phase 1).

  - `ShortcutDescriptor` + `ShortcutExtension` register shortcuts that are both
    manifest entries and binding sources; `ShortcutKeymapExtension` installs the
    effective keymap via the normal dispatcher mechanism.
  - `KeymapOverrideExtension(overrides)` lets the host rebind by id
    (`{ undo: ['Ctrl','Shift','Z'] }`) or disable (`'disabled'`); the effective
    combo is `override ?? default`.
  - Combo conflicts within a scope are reported (via an optional
    `ShortcutConflictReporterExtension`, else the console) and the duplicate is
    never bound silently.
  - Core `undo` / `redo` are migrated from the imperative page keymap to core
    descriptors, so they are now enumerable and rebindable.

  The framework-aware manifest (`getShortcutManifest(flags)`) and per-framework
  contributions are phase 2.

### Patch Changes

- @labre/global@0.29.0
- @labre/store@0.29.0

## 0.28.0

### Patch Changes

- 65cc055: Fix a `TypeError: Cannot read properties of null (reading 'firstElementChild')`
  in the inline editor. `VElement.getUpdateComplete` assumed the inner
  `[data-v-element]` span (and its child) were always present; when awaited while
  the element is mounting/unmounting, `querySelector` returns `null` and it threw.
  Now guarded — it resolves instead of crashing when the inner DOM isn't ready yet.
  - @labre/global@0.28.0
  - @labre/store@0.28.0

## 0.27.0

### Minor Changes

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

- @labre/global@0.27.0
- @labre/store@0.27.0

## 0.26.0

### Patch Changes

- @labre/global@0.26.0
- @labre/store@0.26.0

## 0.24.0

### Patch Changes

- @labre/global@0.24.0
- @labre/store@0.24.0

## 0.23.3

### Patch Changes

- @labre/global@0.23.3
- @labre/store@0.23.3

## 0.23.2

### Patch Changes

- @labre/global@0.23.2
- @labre/store@0.23.2

## 0.23.1

### Patch Changes

- @labre/global@0.23.1
- @labre/store@0.23.1

## 0.23.0

### Patch Changes

- @labre/global@0.23.0
- @labre/store@0.23.0
