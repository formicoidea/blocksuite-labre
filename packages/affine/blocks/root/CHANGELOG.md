# @labre/affine-block-root

## 0.28.0

### Patch Changes

- Updated dependencies [1cd6c92]
- Updated dependencies [65cc055]
  - @labre/affine-block-database@0.28.0
  - @labre/data-view@0.28.0
  - @labre/std@0.28.0
  - @labre/affine-block-attachment@0.28.0
  - @labre/affine-block-bookmark@0.28.0
  - @labre/affine-block-edgeless-text@0.28.0
  - @labre/affine-block-embed@0.28.0
  - @labre/affine-block-frame@0.28.0
  - @labre/affine-block-image@0.28.0
  - @labre/affine-block-note@0.28.0
  - @labre/affine-block-paragraph@0.28.0
  - @labre/affine-block-surface@0.28.0
  - @labre/affine-components@0.28.0
  - @labre/affine-gfx-brush@0.28.0
  - @labre/affine-gfx-connector@0.28.0
  - @labre/affine-gfx-group@0.28.0
  - @labre/affine-gfx-mindmap@0.28.0
  - @labre/affine-gfx-note@0.28.0
  - @labre/affine-gfx-pointer@0.28.0
  - @labre/affine-gfx-shape@0.28.0
  - @labre/affine-gfx-text@0.28.0
  - @labre/affine-inline-preset@0.28.0
  - @labre/affine-model@0.28.0
  - @labre/affine-rich-text@0.28.0
  - @labre/affine-shared@0.28.0
  - @labre/affine-widget-edgeless-selected-rect@0.28.0
  - @labre/affine-widget-edgeless-toolbar@0.28.0
  - @labre/affine-ext-loader@0.28.0
  - @labre/global@0.28.0
  - @labre/store@0.28.0

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

- Updated dependencies [14ef3e7]
- Updated dependencies [91f6397]
- Updated dependencies [91f6397]
  - @labre/affine-block-database@0.27.0
  - @labre/affine-widget-edgeless-selected-rect@0.27.0
  - @labre/std@0.27.0
  - @labre/affine-block-attachment@0.27.0
  - @labre/affine-block-bookmark@0.27.0
  - @labre/affine-block-edgeless-text@0.27.0
  - @labre/affine-block-embed@0.27.0
  - @labre/affine-block-frame@0.27.0
  - @labre/affine-block-image@0.27.0
  - @labre/affine-block-note@0.27.0
  - @labre/affine-block-paragraph@0.27.0
  - @labre/affine-block-surface@0.27.0
  - @labre/affine-components@0.27.0
  - @labre/data-view@0.27.0
  - @labre/affine-gfx-brush@0.27.0
  - @labre/affine-gfx-connector@0.27.0
  - @labre/affine-gfx-group@0.27.0
  - @labre/affine-gfx-mindmap@0.27.0
  - @labre/affine-gfx-note@0.27.0
  - @labre/affine-gfx-pointer@0.27.0
  - @labre/affine-gfx-shape@0.27.0
  - @labre/affine-gfx-text@0.27.0
  - @labre/affine-inline-preset@0.27.0
  - @labre/affine-model@0.27.0
  - @labre/affine-rich-text@0.27.0
  - @labre/affine-shared@0.27.0
  - @labre/affine-widget-edgeless-toolbar@0.27.0
  - @labre/affine-ext-loader@0.27.0
  - @labre/global@0.27.0
  - @labre/store@0.27.0

## 0.26.0

### Patch Changes

- Updated dependencies [8960a6c]
- Updated dependencies [6795191]
  - @labre/affine-block-database@0.26.0
  - @labre/affine-model@0.26.0
  - @labre/affine-components@0.26.0
  - @labre/affine-gfx-mindmap@0.26.0
  - @labre/affine-block-attachment@0.26.0
  - @labre/affine-block-bookmark@0.26.0
  - @labre/affine-block-edgeless-text@0.26.0
  - @labre/affine-block-embed@0.26.0
  - @labre/affine-block-frame@0.26.0
  - @labre/affine-block-image@0.26.0
  - @labre/affine-block-note@0.26.0
  - @labre/affine-block-paragraph@0.26.0
  - @labre/affine-block-surface@0.26.0
  - @labre/affine-gfx-brush@0.26.0
  - @labre/affine-gfx-connector@0.26.0
  - @labre/affine-gfx-group@0.26.0
  - @labre/affine-gfx-note@0.26.0
  - @labre/affine-gfx-pointer@0.26.0
  - @labre/affine-gfx-shape@0.26.0
  - @labre/affine-gfx-text@0.26.0
  - @labre/affine-inline-preset@0.26.0
  - @labre/affine-rich-text@0.26.0
  - @labre/affine-shared@0.26.0
  - @labre/affine-widget-edgeless-selected-rect@0.26.0
  - @labre/affine-widget-edgeless-toolbar@0.26.0
  - @labre/data-view@0.26.0
  - @labre/affine-ext-loader@0.26.0
  - @labre/global@0.26.0
  - @labre/std@0.26.0
  - @labre/store@0.26.0

## 0.25.0

### Patch Changes

- Updated dependencies [8960a6c]
- Updated dependencies [6795191]
  - @labre/affine-block-database@0.25.0
  - @labre/affine-model@0.25.0
  - @labre/affine-components@0.25.0
  - @labre/affine-gfx-mindmap@0.25.0
  - @labre/affine-block-attachment@0.25.0
  - @labre/affine-block-bookmark@0.25.0
  - @labre/affine-block-edgeless-text@0.25.0
  - @labre/affine-block-embed@0.25.0
  - @labre/affine-block-frame@0.25.0
  - @labre/affine-block-image@0.25.0
  - @labre/affine-block-note@0.25.0
  - @labre/affine-block-paragraph@0.25.0
  - @labre/affine-block-surface@0.25.0
  - @labre/affine-gfx-brush@0.25.0
  - @labre/affine-gfx-connector@0.25.0
  - @labre/affine-gfx-group@0.25.0
  - @labre/affine-gfx-note@0.25.0
  - @labre/affine-gfx-pointer@0.25.0
  - @labre/affine-gfx-shape@0.25.0
  - @labre/affine-gfx-text@0.25.0
  - @labre/affine-inline-preset@0.25.0
  - @labre/affine-rich-text@0.25.0
  - @labre/affine-shared@0.25.0
  - @labre/affine-widget-edgeless-selected-rect@0.25.0
  - @labre/affine-widget-edgeless-toolbar@0.25.0
  - @labre/data-view@0.25.0
  - @labre/affine-ext-loader@0.25.0
  - @labre/global@0.25.0
  - @labre/std@0.25.0
  - @labre/store@0.25.0

## 0.24.0

### Patch Changes

- Updated dependencies [bc31490]
- Updated dependencies [bc31490]
  - @labre/affine-gfx-mindmap@0.24.0
  - @labre/affine-block-attachment@0.24.0
  - @labre/affine-block-bookmark@0.24.0
  - @labre/affine-block-database@0.24.0
  - @labre/affine-block-edgeless-text@0.24.0
  - @labre/affine-block-embed@0.24.0
  - @labre/affine-block-frame@0.24.0
  - @labre/affine-block-image@0.24.0
  - @labre/affine-block-note@0.24.0
  - @labre/affine-block-paragraph@0.24.0
  - @labre/affine-block-surface@0.24.0
  - @labre/affine-components@0.24.0
  - @labre/data-view@0.24.0
  - @labre/affine-ext-loader@0.24.0
  - @labre/affine-gfx-brush@0.24.0
  - @labre/affine-gfx-connector@0.24.0
  - @labre/affine-gfx-group@0.24.0
  - @labre/affine-gfx-note@0.24.0
  - @labre/affine-gfx-pointer@0.24.0
  - @labre/affine-gfx-shape@0.24.0
  - @labre/affine-gfx-text@0.24.0
  - @labre/affine-inline-preset@0.24.0
  - @labre/affine-model@0.24.0
  - @labre/affine-rich-text@0.24.0
  - @labre/affine-shared@0.24.0
  - @labre/affine-widget-edgeless-selected-rect@0.24.0
  - @labre/affine-widget-edgeless-toolbar@0.24.0
  - @labre/global@0.24.0
  - @labre/std@0.24.0
  - @labre/store@0.24.0

## 0.23.3

### Patch Changes

- Updated dependencies
  - @labre/affine-shared@0.23.3
  - @labre/affine-block-attachment@0.23.3
  - @labre/affine-block-bookmark@0.23.3
  - @labre/affine-block-database@0.23.3
  - @labre/affine-block-edgeless-text@0.23.3
  - @labre/affine-block-embed@0.23.3
  - @labre/affine-block-frame@0.23.3
  - @labre/affine-block-image@0.23.3
  - @labre/affine-block-note@0.23.3
  - @labre/affine-block-paragraph@0.23.3
  - @labre/affine-block-surface@0.23.3
  - @labre/affine-components@0.23.3
  - @labre/data-view@0.23.3
  - @labre/affine-gfx-brush@0.23.3
  - @labre/affine-gfx-connector@0.23.3
  - @labre/affine-gfx-group@0.23.3
  - @labre/affine-gfx-mindmap@0.23.3
  - @labre/affine-gfx-note@0.23.3
  - @labre/affine-gfx-pointer@0.23.3
  - @labre/affine-gfx-shape@0.23.3
  - @labre/affine-gfx-text@0.23.3
  - @labre/affine-inline-preset@0.23.3
  - @labre/affine-rich-text@0.23.3
  - @labre/affine-widget-edgeless-selected-rect@0.23.3
  - @labre/affine-widget-edgeless-toolbar@0.23.3
  - @labre/affine-ext-loader@0.23.3
  - @labre/affine-model@0.23.3
  - @labre/global@0.23.3
  - @labre/std@0.23.3
  - @labre/store@0.23.3

## 0.23.2

### Patch Changes

- Updated dependencies [ee682da]
  - @labre/affine-shared@0.23.2
  - @labre/affine-block-attachment@0.23.2
  - @labre/affine-block-bookmark@0.23.2
  - @labre/affine-block-database@0.23.2
  - @labre/affine-block-edgeless-text@0.23.2
  - @labre/affine-block-embed@0.23.2
  - @labre/affine-block-frame@0.23.2
  - @labre/affine-block-image@0.23.2
  - @labre/affine-block-note@0.23.2
  - @labre/affine-block-paragraph@0.23.2
  - @labre/affine-block-surface@0.23.2
  - @labre/affine-components@0.23.2
  - @labre/data-view@0.23.2
  - @labre/affine-gfx-brush@0.23.2
  - @labre/affine-gfx-connector@0.23.2
  - @labre/affine-gfx-group@0.23.2
  - @labre/affine-gfx-mindmap@0.23.2
  - @labre/affine-gfx-note@0.23.2
  - @labre/affine-gfx-pointer@0.23.2
  - @labre/affine-gfx-shape@0.23.2
  - @labre/affine-gfx-text@0.23.2
  - @labre/affine-inline-preset@0.23.2
  - @labre/affine-rich-text@0.23.2
  - @labre/affine-widget-edgeless-selected-rect@0.23.2
  - @labre/affine-widget-edgeless-toolbar@0.23.2
  - @labre/affine-ext-loader@0.23.2
  - @labre/affine-model@0.23.2
  - @labre/global@0.23.2
  - @labre/std@0.23.2
  - @labre/store@0.23.2

## 0.23.1

### Patch Changes

- Updated dependencies [1beb60e]
  - @labre/affine-shared@0.23.1
  - @labre/affine-block-attachment@0.23.1
  - @labre/affine-block-bookmark@0.23.1
  - @labre/affine-block-database@0.23.1
  - @labre/affine-block-edgeless-text@0.23.1
  - @labre/affine-block-embed@0.23.1
  - @labre/affine-block-frame@0.23.1
  - @labre/affine-block-image@0.23.1
  - @labre/affine-block-note@0.23.1
  - @labre/affine-block-paragraph@0.23.1
  - @labre/affine-block-surface@0.23.1
  - @labre/affine-components@0.23.1
  - @labre/data-view@0.23.1
  - @labre/affine-gfx-brush@0.23.1
  - @labre/affine-gfx-connector@0.23.1
  - @labre/affine-gfx-group@0.23.1
  - @labre/affine-gfx-mindmap@0.23.1
  - @labre/affine-gfx-note@0.23.1
  - @labre/affine-gfx-pointer@0.23.1
  - @labre/affine-gfx-shape@0.23.1
  - @labre/affine-gfx-text@0.23.1
  - @labre/affine-inline-preset@0.23.1
  - @labre/affine-rich-text@0.23.1
  - @labre/affine-widget-edgeless-selected-rect@0.23.1
  - @labre/affine-widget-edgeless-toolbar@0.23.1
  - @labre/affine-ext-loader@0.23.1
  - @labre/affine-model@0.23.1
  - @labre/global@0.23.1
  - @labre/std@0.23.1
  - @labre/store@0.23.1

## 0.23.0

### Patch Changes

- Updated dependencies [9014c87]
- Updated dependencies [c775151]
- Updated dependencies [d2f435f]
  - @labre/affine-model@0.23.0
  - @labre/affine-block-surface@0.23.0
  - @labre/affine-shared@0.23.0
  - @labre/affine-widget-edgeless-toolbar@0.23.0
  - @labre/affine-block-attachment@0.23.0
  - @labre/affine-block-bookmark@0.23.0
  - @labre/affine-block-database@0.23.0
  - @labre/affine-block-edgeless-text@0.23.0
  - @labre/affine-block-embed@0.23.0
  - @labre/affine-block-frame@0.23.0
  - @labre/affine-block-image@0.23.0
  - @labre/affine-block-note@0.23.0
  - @labre/affine-block-paragraph@0.23.0
  - @labre/affine-components@0.23.0
  - @labre/affine-gfx-brush@0.23.0
  - @labre/affine-gfx-connector@0.23.0
  - @labre/affine-gfx-group@0.23.0
  - @labre/affine-gfx-mindmap@0.23.0
  - @labre/affine-gfx-note@0.23.0
  - @labre/affine-gfx-pointer@0.23.0
  - @labre/affine-gfx-shape@0.23.0
  - @labre/affine-gfx-text@0.23.0
  - @labre/affine-inline-preset@0.23.0
  - @labre/affine-rich-text@0.23.0
  - @labre/affine-widget-edgeless-selected-rect@0.23.0
  - @labre/data-view@0.23.0
  - @labre/affine-ext-loader@0.23.0
  - @labre/global@0.23.0
  - @labre/std@0.23.0
  - @labre/store@0.23.0
