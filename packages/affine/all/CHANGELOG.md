# @labre/affine

## 0.24.0

### Minor Changes

- bc31490: feat(edgeless): add Domain-Driven Design framework tools

  Three independently flag-gated edgeless senior buttons — Event Storming
  (Brandolini colour-coded stickies), Core Domain Chart (a new drawn background
  element + sub-domain dots, movement arrows and a Notation legend) and Context
  Map (bounded-context bubbles + the nine relationship patterns) — plus
  dedicated Templates-panel sections: one per senior button (Event Storming,
  Core Domain Chart, Context Map) and a standalone Aggregate Design Canvas.

  All three sub-menus compose the same shared prefab builders (sticky, dot,
  bubble, connector, group) over native shape/connector/text/group elements, so
  only the Core Domain Chart background adds a new element model. Flags:
  `ddd-event-storming`, `ddd-core-domain`, `ddd-context-map`, `ddd-templates`.

  A senior-button flag gates only its toolbar button: Core Domain Chart
  rendering (element view, painter, interaction and contextual toolbar) is
  always registered, so disabling `ddd-core-domain` no longer un-paints existing
  charts, and Templates-panel insertion still renders them.

- bc31490: feat(edgeless): split the "Others" toolbox into a dedicated Mind Map button

  The combined senior button now splits in two:

  - **Mind Map** — a dedicated senior button (the mindmap glyph, the `m` shortcut,
    the style picker + import), flag-gated by `mindmap`.
  - **Others** — keeps free-text and add-file, flag-gated by a new `other` flag
    (it no longer rides the `mindmap` flag), same basket icon minus the mindmap.

  Both buttons share one parameterized component/menu (`variant`). Mindmap
  rendering (element view, painter, interaction, contextual toolbars) is now
  always registered, independent of either flag — so disabling a button never
  un-paints existing mindmaps nor breaks Templates-panel insertion.

  A new **"Mind Map"** section in the Templates panel offers the 4 built-in styles
  as starter mindmaps. Inserting a mindmap template required teaching the
  template id-regeneration middleware (`replaceIdMiddleware`) to remap a mindmap's
  node-id references (`children` keys + `parent` back-refs), so inserted mindmaps
  rebuild correctly.

### Patch Changes

- Updated dependencies [bc31490]
- Updated dependencies [bc31490]
- Updated dependencies [bc31490]
  - @labre/affine-gfx-ddd@0.24.0
  - @labre/affine-gfx-mindmap@0.24.0
  - @labre/affine-gfx-template@0.24.0
  - @labre/affine-gfx-wardley@0.24.0
  - @labre/affine-block-root@0.24.0
  - @labre/affine-gfx-bpmn@0.24.0
  - @labre/affine-gfx-cynefin-estuarine@0.24.0
  - @labre/affine-gfx-edgy@0.24.0
  - @labre/affine-block-attachment@0.24.0
  - @labre/affine-block-bookmark@0.24.0
  - @labre/affine-block-callout@0.24.0
  - @labre/affine-block-code@0.24.0
  - @labre/affine-block-data-view@0.24.0
  - @labre/affine-block-database@0.24.0
  - @labre/affine-block-divider@0.24.0
  - @labre/affine-block-edgeless-text@0.24.0
  - @labre/affine-block-embed@0.24.0
  - @labre/affine-block-embed-doc@0.24.0
  - @labre/affine-block-frame@0.24.0
  - @labre/affine-block-image@0.24.0
  - @labre/affine-block-latex@0.24.0
  - @labre/affine-block-list@0.24.0
  - @labre/affine-block-note@0.24.0
  - @labre/affine-block-paragraph@0.24.0
  - @labre/affine-block-surface@0.24.0
  - @labre/affine-block-surface-ref@0.24.0
  - @labre/affine-block-table@0.24.0
  - @labre/affine-components@0.24.0
  - @labre/data-view@0.24.0
  - @labre/affine-ext-loader@0.24.0
  - @labre/affine-foundation@0.24.0
  - @labre/affine-fragment-adapter-panel@0.24.0
  - @labre/affine-fragment-doc-title@0.24.0
  - @labre/affine-fragment-frame-panel@0.24.0
  - @labre/affine-fragment-outline@0.24.0
  - @labre/affine-gfx-brush@0.24.0
  - @labre/affine-gfx-connector@0.24.0
  - @labre/affine-gfx-group@0.24.0
  - @labre/affine-gfx-link@0.24.0
  - @labre/affine-gfx-note@0.24.0
  - @labre/affine-gfx-pointer@0.24.0
  - @labre/affine-gfx-shape@0.24.0
  - @labre/affine-gfx-text@0.24.0
  - @labre/affine-gfx-turbo-renderer@0.24.0
  - @labre/affine-inline-comment@0.24.0
  - @labre/affine-inline-footnote@0.24.0
  - @labre/affine-inline-latex@0.24.0
  - @labre/affine-inline-link@0.24.0
  - @labre/affine-inline-mention@0.24.0
  - @labre/affine-inline-preset@0.24.0
  - @labre/affine-inline-reference@0.24.0
  - @labre/affine-model@0.24.0
  - @labre/affine-rich-text@0.24.0
  - @labre/affine-shared@0.24.0
  - @labre/affine-widget-drag-handle@0.24.0
  - @labre/affine-widget-edgeless-auto-connect@0.24.0
  - @labre/affine-widget-edgeless-dragging-area@0.24.0
  - @labre/affine-widget-edgeless-selected-rect@0.24.0
  - @labre/affine-widget-edgeless-toolbar@0.24.0
  - @labre/affine-widget-edgeless-zoom-toolbar@0.24.0
  - @labre/affine-widget-frame-title@0.24.0
  - @labre/affine-widget-keyboard-toolbar@0.24.0
  - @labre/affine-widget-linked-doc@0.24.0
  - @labre/affine-widget-note-slicer@0.24.0
  - @labre/affine-widget-page-dragging-area@0.24.0
  - @labre/affine-widget-remote-selection@0.24.0
  - @labre/affine-widget-scroll-anchoring@0.24.0
  - @labre/affine-widget-slash-menu@0.24.0
  - @labre/affine-widget-toolbar@0.24.0
  - @labre/affine-widget-viewport-overlay@0.24.0
  - @labre/global@0.24.0
  - @labre/std@0.24.0
  - @labre/store@0.24.0
  - @labre/sync@0.24.0

## 0.23.3

### Patch Changes

- Updated dependencies
  - @labre/affine-shared@0.23.3
  - @labre/affine-block-attachment@0.23.3
  - @labre/affine-block-bookmark@0.23.3
  - @labre/affine-block-callout@0.23.3
  - @labre/affine-block-code@0.23.3
  - @labre/affine-block-data-view@0.23.3
  - @labre/affine-block-database@0.23.3
  - @labre/affine-block-divider@0.23.3
  - @labre/affine-block-edgeless-text@0.23.3
  - @labre/affine-block-embed@0.23.3
  - @labre/affine-block-embed-doc@0.23.3
  - @labre/affine-block-frame@0.23.3
  - @labre/affine-block-image@0.23.3
  - @labre/affine-block-latex@0.23.3
  - @labre/affine-block-list@0.23.3
  - @labre/affine-block-note@0.23.3
  - @labre/affine-block-paragraph@0.23.3
  - @labre/affine-block-root@0.23.3
  - @labre/affine-block-surface@0.23.3
  - @labre/affine-block-surface-ref@0.23.3
  - @labre/affine-block-table@0.23.3
  - @labre/affine-components@0.23.3
  - @labre/data-view@0.23.3
  - @labre/affine-foundation@0.23.3
  - @labre/affine-fragment-adapter-panel@0.23.3
  - @labre/affine-fragment-doc-title@0.23.3
  - @labre/affine-fragment-frame-panel@0.23.3
  - @labre/affine-fragment-outline@0.23.3
  - @labre/affine-gfx-bpmn@0.23.3
  - @labre/affine-gfx-brush@0.23.3
  - @labre/affine-gfx-connector@0.23.3
  - @labre/affine-gfx-cynefin-estuarine@0.23.3
  - @labre/affine-gfx-edgy@0.23.3
  - @labre/affine-gfx-group@0.23.3
  - @labre/affine-gfx-link@0.23.3
  - @labre/affine-gfx-mindmap@0.23.3
  - @labre/affine-gfx-note@0.23.3
  - @labre/affine-gfx-pointer@0.23.3
  - @labre/affine-gfx-shape@0.23.3
  - @labre/affine-gfx-template@0.23.3
  - @labre/affine-gfx-text@0.23.3
  - @labre/affine-gfx-wardley@0.23.3
  - @labre/affine-inline-comment@0.23.3
  - @labre/affine-inline-footnote@0.23.3
  - @labre/affine-inline-latex@0.23.3
  - @labre/affine-inline-link@0.23.3
  - @labre/affine-inline-mention@0.23.3
  - @labre/affine-inline-preset@0.23.3
  - @labre/affine-inline-reference@0.23.3
  - @labre/affine-rich-text@0.23.3
  - @labre/affine-widget-drag-handle@0.23.3
  - @labre/affine-widget-edgeless-auto-connect@0.23.3
  - @labre/affine-widget-edgeless-dragging-area@0.23.3
  - @labre/affine-widget-edgeless-selected-rect@0.23.3
  - @labre/affine-widget-edgeless-toolbar@0.23.3
  - @labre/affine-widget-edgeless-zoom-toolbar@0.23.3
  - @labre/affine-widget-frame-title@0.23.3
  - @labre/affine-widget-keyboard-toolbar@0.23.3
  - @labre/affine-widget-linked-doc@0.23.3
  - @labre/affine-widget-note-slicer@0.23.3
  - @labre/affine-widget-page-dragging-area@0.23.3
  - @labre/affine-widget-remote-selection@0.23.3
  - @labre/affine-widget-scroll-anchoring@0.23.3
  - @labre/affine-widget-slash-menu@0.23.3
  - @labre/affine-widget-toolbar@0.23.3
  - @labre/affine-widget-viewport-overlay@0.23.3
  - @labre/affine-ext-loader@0.23.3
  - @labre/affine-gfx-turbo-renderer@0.23.3
  - @labre/affine-model@0.23.3
  - @labre/global@0.23.3
  - @labre/std@0.23.3
  - @labre/store@0.23.3
  - @labre/sync@0.23.3

## 0.23.2

### Patch Changes

- Updated dependencies [ee682da]
  - @labre/affine-shared@0.23.2
  - @labre/affine-block-attachment@0.23.2
  - @labre/affine-block-bookmark@0.23.2
  - @labre/affine-block-callout@0.23.2
  - @labre/affine-block-code@0.23.2
  - @labre/affine-block-data-view@0.23.2
  - @labre/affine-block-database@0.23.2
  - @labre/affine-block-divider@0.23.2
  - @labre/affine-block-edgeless-text@0.23.2
  - @labre/affine-block-embed@0.23.2
  - @labre/affine-block-embed-doc@0.23.2
  - @labre/affine-block-frame@0.23.2
  - @labre/affine-block-image@0.23.2
  - @labre/affine-block-latex@0.23.2
  - @labre/affine-block-list@0.23.2
  - @labre/affine-block-note@0.23.2
  - @labre/affine-block-paragraph@0.23.2
  - @labre/affine-block-root@0.23.2
  - @labre/affine-block-surface@0.23.2
  - @labre/affine-block-surface-ref@0.23.2
  - @labre/affine-block-table@0.23.2
  - @labre/affine-components@0.23.2
  - @labre/data-view@0.23.2
  - @labre/affine-foundation@0.23.2
  - @labre/affine-fragment-adapter-panel@0.23.2
  - @labre/affine-fragment-doc-title@0.23.2
  - @labre/affine-fragment-frame-panel@0.23.2
  - @labre/affine-fragment-outline@0.23.2
  - @labre/affine-gfx-bpmn@0.23.2
  - @labre/affine-gfx-brush@0.23.2
  - @labre/affine-gfx-connector@0.23.2
  - @labre/affine-gfx-cynefin-estuarine@0.23.2
  - @labre/affine-gfx-edgy@0.23.2
  - @labre/affine-gfx-group@0.23.2
  - @labre/affine-gfx-link@0.23.2
  - @labre/affine-gfx-mindmap@0.23.2
  - @labre/affine-gfx-note@0.23.2
  - @labre/affine-gfx-pointer@0.23.2
  - @labre/affine-gfx-shape@0.23.2
  - @labre/affine-gfx-template@0.23.2
  - @labre/affine-gfx-text@0.23.2
  - @labre/affine-gfx-wardley@0.23.2
  - @labre/affine-inline-comment@0.23.2
  - @labre/affine-inline-footnote@0.23.2
  - @labre/affine-inline-latex@0.23.2
  - @labre/affine-inline-link@0.23.2
  - @labre/affine-inline-mention@0.23.2
  - @labre/affine-inline-preset@0.23.2
  - @labre/affine-inline-reference@0.23.2
  - @labre/affine-rich-text@0.23.2
  - @labre/affine-widget-drag-handle@0.23.2
  - @labre/affine-widget-edgeless-auto-connect@0.23.2
  - @labre/affine-widget-edgeless-dragging-area@0.23.2
  - @labre/affine-widget-edgeless-selected-rect@0.23.2
  - @labre/affine-widget-edgeless-toolbar@0.23.2
  - @labre/affine-widget-edgeless-zoom-toolbar@0.23.2
  - @labre/affine-widget-frame-title@0.23.2
  - @labre/affine-widget-keyboard-toolbar@0.23.2
  - @labre/affine-widget-linked-doc@0.23.2
  - @labre/affine-widget-note-slicer@0.23.2
  - @labre/affine-widget-page-dragging-area@0.23.2
  - @labre/affine-widget-remote-selection@0.23.2
  - @labre/affine-widget-scroll-anchoring@0.23.2
  - @labre/affine-widget-slash-menu@0.23.2
  - @labre/affine-widget-toolbar@0.23.2
  - @labre/affine-widget-viewport-overlay@0.23.2
  - @labre/affine-ext-loader@0.23.2
  - @labre/affine-gfx-turbo-renderer@0.23.2
  - @labre/affine-model@0.23.2
  - @labre/global@0.23.2
  - @labre/std@0.23.2
  - @labre/store@0.23.2
  - @labre/sync@0.23.2

## 0.23.1

### Patch Changes

- Updated dependencies [1beb60e]
  - @labre/affine-shared@0.23.1
  - @labre/affine-block-attachment@0.23.1
  - @labre/affine-block-bookmark@0.23.1
  - @labre/affine-block-callout@0.23.1
  - @labre/affine-block-code@0.23.1
  - @labre/affine-block-data-view@0.23.1
  - @labre/affine-block-database@0.23.1
  - @labre/affine-block-divider@0.23.1
  - @labre/affine-block-edgeless-text@0.23.1
  - @labre/affine-block-embed@0.23.1
  - @labre/affine-block-embed-doc@0.23.1
  - @labre/affine-block-frame@0.23.1
  - @labre/affine-block-image@0.23.1
  - @labre/affine-block-latex@0.23.1
  - @labre/affine-block-list@0.23.1
  - @labre/affine-block-note@0.23.1
  - @labre/affine-block-paragraph@0.23.1
  - @labre/affine-block-root@0.23.1
  - @labre/affine-block-surface@0.23.1
  - @labre/affine-block-surface-ref@0.23.1
  - @labre/affine-block-table@0.23.1
  - @labre/affine-components@0.23.1
  - @labre/data-view@0.23.1
  - @labre/affine-foundation@0.23.1
  - @labre/affine-fragment-adapter-panel@0.23.1
  - @labre/affine-fragment-doc-title@0.23.1
  - @labre/affine-fragment-frame-panel@0.23.1
  - @labre/affine-fragment-outline@0.23.1
  - @labre/affine-gfx-bpmn@0.23.1
  - @labre/affine-gfx-brush@0.23.1
  - @labre/affine-gfx-connector@0.23.1
  - @labre/affine-gfx-cynefin-estuarine@0.23.1
  - @labre/affine-gfx-edgy@0.23.1
  - @labre/affine-gfx-group@0.23.1
  - @labre/affine-gfx-link@0.23.1
  - @labre/affine-gfx-mindmap@0.23.1
  - @labre/affine-gfx-note@0.23.1
  - @labre/affine-gfx-pointer@0.23.1
  - @labre/affine-gfx-shape@0.23.1
  - @labre/affine-gfx-template@0.23.1
  - @labre/affine-gfx-text@0.23.1
  - @labre/affine-gfx-wardley@0.23.1
  - @labre/affine-inline-comment@0.23.1
  - @labre/affine-inline-footnote@0.23.1
  - @labre/affine-inline-latex@0.23.1
  - @labre/affine-inline-link@0.23.1
  - @labre/affine-inline-mention@0.23.1
  - @labre/affine-inline-preset@0.23.1
  - @labre/affine-inline-reference@0.23.1
  - @labre/affine-rich-text@0.23.1
  - @labre/affine-widget-drag-handle@0.23.1
  - @labre/affine-widget-edgeless-auto-connect@0.23.1
  - @labre/affine-widget-edgeless-dragging-area@0.23.1
  - @labre/affine-widget-edgeless-selected-rect@0.23.1
  - @labre/affine-widget-edgeless-toolbar@0.23.1
  - @labre/affine-widget-edgeless-zoom-toolbar@0.23.1
  - @labre/affine-widget-frame-title@0.23.1
  - @labre/affine-widget-keyboard-toolbar@0.23.1
  - @labre/affine-widget-linked-doc@0.23.1
  - @labre/affine-widget-note-slicer@0.23.1
  - @labre/affine-widget-page-dragging-area@0.23.1
  - @labre/affine-widget-remote-selection@0.23.1
  - @labre/affine-widget-scroll-anchoring@0.23.1
  - @labre/affine-widget-slash-menu@0.23.1
  - @labre/affine-widget-toolbar@0.23.1
  - @labre/affine-widget-viewport-overlay@0.23.1
  - @labre/affine-ext-loader@0.23.1
  - @labre/affine-gfx-turbo-renderer@0.23.1
  - @labre/affine-model@0.23.1
  - @labre/global@0.23.1
  - @labre/std@0.23.1
  - @labre/store@0.23.1
  - @labre/sync@0.23.1

## 0.23.0

### Patch Changes

- Updated dependencies [9014c87]
- Updated dependencies [c775151]
- Updated dependencies [c775151]
- Updated dependencies [d2f435f]
  - @labre/affine-gfx-bpmn@0.23.0
  - @labre/affine-model@0.23.0
  - @labre/affine-block-surface@0.23.0
  - @labre/affine-shared@0.23.0
  - @labre/affine-gfx-cynefin-estuarine@0.23.0
  - @labre/affine-gfx-template@0.23.0
  - @labre/affine-gfx-wardley@0.23.0
  - @labre/affine-gfx-edgy@0.23.0
  - @labre/affine-widget-edgeless-toolbar@0.23.0
  - @labre/affine-block-attachment@0.23.0
  - @labre/affine-block-bookmark@0.23.0
  - @labre/affine-block-callout@0.23.0
  - @labre/affine-block-code@0.23.0
  - @labre/affine-block-data-view@0.23.0
  - @labre/affine-block-database@0.23.0
  - @labre/affine-block-divider@0.23.0
  - @labre/affine-block-edgeless-text@0.23.0
  - @labre/affine-block-embed@0.23.0
  - @labre/affine-block-embed-doc@0.23.0
  - @labre/affine-block-frame@0.23.0
  - @labre/affine-block-image@0.23.0
  - @labre/affine-block-latex@0.23.0
  - @labre/affine-block-list@0.23.0
  - @labre/affine-block-note@0.23.0
  - @labre/affine-block-paragraph@0.23.0
  - @labre/affine-block-root@0.23.0
  - @labre/affine-block-surface-ref@0.23.0
  - @labre/affine-block-table@0.23.0
  - @labre/affine-components@0.23.0
  - @labre/affine-fragment-adapter-panel@0.23.0
  - @labre/affine-fragment-doc-title@0.23.0
  - @labre/affine-fragment-frame-panel@0.23.0
  - @labre/affine-fragment-outline@0.23.0
  - @labre/affine-gfx-brush@0.23.0
  - @labre/affine-gfx-connector@0.23.0
  - @labre/affine-gfx-group@0.23.0
  - @labre/affine-gfx-link@0.23.0
  - @labre/affine-gfx-mindmap@0.23.0
  - @labre/affine-gfx-note@0.23.0
  - @labre/affine-gfx-pointer@0.23.0
  - @labre/affine-gfx-shape@0.23.0
  - @labre/affine-gfx-text@0.23.0
  - @labre/affine-inline-comment@0.23.0
  - @labre/affine-inline-footnote@0.23.0
  - @labre/affine-inline-latex@0.23.0
  - @labre/affine-inline-link@0.23.0
  - @labre/affine-inline-mention@0.23.0
  - @labre/affine-inline-preset@0.23.0
  - @labre/affine-inline-reference@0.23.0
  - @labre/affine-rich-text@0.23.0
  - @labre/affine-widget-drag-handle@0.23.0
  - @labre/affine-widget-edgeless-auto-connect@0.23.0
  - @labre/affine-widget-edgeless-dragging-area@0.23.0
  - @labre/affine-widget-edgeless-selected-rect@0.23.0
  - @labre/affine-widget-edgeless-zoom-toolbar@0.23.0
  - @labre/affine-widget-frame-title@0.23.0
  - @labre/affine-widget-keyboard-toolbar@0.23.0
  - @labre/affine-widget-linked-doc@0.23.0
  - @labre/affine-widget-note-slicer@0.23.0
  - @labre/affine-widget-page-dragging-area@0.23.0
  - @labre/affine-widget-remote-selection@0.23.0
  - @labre/affine-widget-scroll-anchoring@0.23.0
  - @labre/affine-widget-toolbar@0.23.0
  - @labre/affine-widget-viewport-overlay@0.23.0
  - @labre/data-view@0.23.0
  - @labre/affine-foundation@0.23.0
  - @labre/affine-widget-slash-menu@0.23.0
  - @labre/affine-ext-loader@0.23.0
  - @labre/affine-gfx-turbo-renderer@0.23.0
  - @labre/global@0.23.0
  - @labre/std@0.23.0
  - @labre/store@0.23.0
  - @labre/sync@0.23.0
