# @labre/affine

## 0.30.2

### Patch Changes

- 33acdfa: Publish bundles whose ESM specifiers Node can resolve

  The compiled bundles emitted specifiers verbatim from the vendored source, so
  `dist` shipped extensionless relative imports (`from './shortcuts'`), extensionless
  subpath imports (`from 'lodash-es/last'`), and bare imports of bundler-only proxy
  directories (`@atlaskit/pragmatic-drag-and-drop/element/adapter`). Bundlers accept
  all three; Node's ESM resolver accepts none, so any consumer that let Node resolve
  the bundles — a test runner treating them as externalized deps, a bundler-less
  import — failed with ERR_MODULE_NOT_FOUND / ERR_UNSUPPORTED_DIR_IMPORT.

  `compile-bundles.mjs` now rewrites every emitted specifier to an explicit one and
  fails the build on any relative import that resolves to nothing.

  - @labre/affine-block-attachment@0.30.2
  - @labre/affine-block-bookmark@0.30.2
  - @labre/affine-block-callout@0.30.2
  - @labre/affine-block-code@0.30.2
  - @labre/affine-block-data-view@0.30.2
  - @labre/affine-block-database@0.30.2
  - @labre/affine-block-divider@0.30.2
  - @labre/affine-block-edgeless-text@0.30.2
  - @labre/affine-block-embed@0.30.2
  - @labre/affine-block-embed-doc@0.30.2
  - @labre/affine-block-frame@0.30.2
  - @labre/affine-block-image@0.30.2
  - @labre/affine-block-latex@0.30.2
  - @labre/affine-block-list@0.30.2
  - @labre/affine-block-note@0.30.2
  - @labre/affine-block-paragraph@0.30.2
  - @labre/affine-block-root@0.30.2
  - @labre/affine-block-surface@0.30.2
  - @labre/affine-block-surface-ref@0.30.2
  - @labre/affine-block-table@0.30.2
  - @labre/affine-components@0.30.2
  - @labre/data-view@0.30.2
  - @labre/affine-ext-loader@0.30.2
  - @labre/affine-foundation@0.30.2
  - @labre/affine-fragment-adapter-panel@0.30.2
  - @labre/affine-fragment-doc-title@0.30.2
  - @labre/affine-fragment-frame-panel@0.30.2
  - @labre/affine-fragment-outline@0.30.2
  - @labre/affine-gfx-bpmn@0.30.2
  - @labre/affine-gfx-brush@0.30.2
  - @labre/affine-gfx-connector@0.30.2
  - @labre/affine-gfx-cynefin-estuarine@0.30.2
  - @labre/affine-gfx-ddd-aggregate@0.30.2
  - @labre/affine-gfx-ddd-context-map@0.30.2
  - @labre/affine-gfx-ddd-core-domain@0.30.2
  - @labre/affine-gfx-ddd-event-storming@0.30.2
  - @labre/affine-gfx-ddd-shared@0.30.2
  - @labre/affine-gfx-edgy@0.30.2
  - @labre/affine-gfx-group@0.30.2
  - @labre/affine-gfx-link@0.30.2
  - @labre/affine-gfx-mindmap@0.30.2
  - @labre/affine-gfx-note@0.30.2
  - @labre/affine-gfx-pointer@0.30.2
  - @labre/affine-gfx-shape@0.30.2
  - @labre/affine-gfx-template@0.30.2
  - @labre/affine-gfx-text@0.30.2
  - @labre/affine-gfx-turbo-renderer@0.30.2
  - @labre/affine-gfx-wardley@0.30.2
  - @labre/affine-inline-comment@0.30.2
  - @labre/affine-inline-footnote@0.30.2
  - @labre/affine-inline-latex@0.30.2
  - @labre/affine-inline-link@0.30.2
  - @labre/affine-inline-mention@0.30.2
  - @labre/affine-inline-preset@0.30.2
  - @labre/affine-inline-reference@0.30.2
  - @labre/affine-model@0.30.2
  - @labre/affine-rich-text@0.30.2
  - @labre/affine-shared@0.30.2
  - @labre/affine-widget-drag-handle@0.30.2
  - @labre/affine-widget-edgeless-auto-connect@0.30.2
  - @labre/affine-widget-edgeless-dragging-area@0.30.2
  - @labre/affine-widget-edgeless-selected-rect@0.30.2
  - @labre/affine-widget-edgeless-toolbar@0.30.2
  - @labre/affine-widget-edgeless-zoom-toolbar@0.30.2
  - @labre/affine-widget-frame-title@0.30.2
  - @labre/affine-widget-keyboard-toolbar@0.30.2
  - @labre/affine-widget-linked-doc@0.30.2
  - @labre/affine-widget-note-slicer@0.30.2
  - @labre/affine-widget-page-dragging-area@0.30.2
  - @labre/affine-widget-remote-selection@0.30.2
  - @labre/affine-widget-scroll-anchoring@0.30.2
  - @labre/affine-widget-slash-menu@0.30.2
  - @labre/affine-widget-toolbar@0.30.2
  - @labre/affine-widget-viewport-overlay@0.30.2
  - @labre/global@0.30.2
  - @labre/std@0.30.2
  - @labre/store@0.30.2
  - @labre/sync@0.30.2

## 0.30.1

### Patch Changes

- Updated dependencies [09f1d82]
  - @labre/affine-gfx-cynefin-estuarine@0.30.1
  - @labre/affine-block-attachment@0.30.1
  - @labre/affine-block-bookmark@0.30.1
  - @labre/affine-block-callout@0.30.1
  - @labre/affine-block-code@0.30.1
  - @labre/affine-block-data-view@0.30.1
  - @labre/affine-block-database@0.30.1
  - @labre/affine-block-divider@0.30.1
  - @labre/affine-block-edgeless-text@0.30.1
  - @labre/affine-block-embed@0.30.1
  - @labre/affine-block-embed-doc@0.30.1
  - @labre/affine-block-frame@0.30.1
  - @labre/affine-block-image@0.30.1
  - @labre/affine-block-latex@0.30.1
  - @labre/affine-block-list@0.30.1
  - @labre/affine-block-note@0.30.1
  - @labre/affine-block-paragraph@0.30.1
  - @labre/affine-block-root@0.30.1
  - @labre/affine-block-surface@0.30.1
  - @labre/affine-block-surface-ref@0.30.1
  - @labre/affine-block-table@0.30.1
  - @labre/affine-components@0.30.1
  - @labre/data-view@0.30.1
  - @labre/affine-ext-loader@0.30.1
  - @labre/affine-foundation@0.30.1
  - @labre/affine-fragment-adapter-panel@0.30.1
  - @labre/affine-fragment-doc-title@0.30.1
  - @labre/affine-fragment-frame-panel@0.30.1
  - @labre/affine-fragment-outline@0.30.1
  - @labre/affine-gfx-bpmn@0.30.1
  - @labre/affine-gfx-brush@0.30.1
  - @labre/affine-gfx-connector@0.30.1
  - @labre/affine-gfx-ddd-aggregate@0.30.1
  - @labre/affine-gfx-ddd-context-map@0.30.1
  - @labre/affine-gfx-ddd-core-domain@0.30.1
  - @labre/affine-gfx-ddd-event-storming@0.30.1
  - @labre/affine-gfx-ddd-shared@0.30.1
  - @labre/affine-gfx-edgy@0.30.1
  - @labre/affine-gfx-group@0.30.1
  - @labre/affine-gfx-link@0.30.1
  - @labre/affine-gfx-mindmap@0.30.1
  - @labre/affine-gfx-note@0.30.1
  - @labre/affine-gfx-pointer@0.30.1
  - @labre/affine-gfx-shape@0.30.1
  - @labre/affine-gfx-template@0.30.1
  - @labre/affine-gfx-text@0.30.1
  - @labre/affine-gfx-turbo-renderer@0.30.1
  - @labre/affine-gfx-wardley@0.30.1
  - @labre/affine-inline-comment@0.30.1
  - @labre/affine-inline-footnote@0.30.1
  - @labre/affine-inline-latex@0.30.1
  - @labre/affine-inline-link@0.30.1
  - @labre/affine-inline-mention@0.30.1
  - @labre/affine-inline-preset@0.30.1
  - @labre/affine-inline-reference@0.30.1
  - @labre/affine-model@0.30.1
  - @labre/affine-rich-text@0.30.1
  - @labre/affine-shared@0.30.1
  - @labre/affine-widget-drag-handle@0.30.1
  - @labre/affine-widget-edgeless-auto-connect@0.30.1
  - @labre/affine-widget-edgeless-dragging-area@0.30.1
  - @labre/affine-widget-edgeless-selected-rect@0.30.1
  - @labre/affine-widget-edgeless-toolbar@0.30.1
  - @labre/affine-widget-edgeless-zoom-toolbar@0.30.1
  - @labre/affine-widget-frame-title@0.30.1
  - @labre/affine-widget-keyboard-toolbar@0.30.1
  - @labre/affine-widget-linked-doc@0.30.1
  - @labre/affine-widget-note-slicer@0.30.1
  - @labre/affine-widget-page-dragging-area@0.30.1
  - @labre/affine-widget-remote-selection@0.30.1
  - @labre/affine-widget-scroll-anchoring@0.30.1
  - @labre/affine-widget-slash-menu@0.30.1
  - @labre/affine-widget-toolbar@0.30.1
  - @labre/affine-widget-viewport-overlay@0.30.1
  - @labre/global@0.30.1
  - @labre/std@0.30.1
  - @labre/store@0.30.1
  - @labre/sync@0.30.1

## 0.30.0

### Minor Changes

- 8deda2d: Wardley canvas keyboard chords: press `w`, then `c` (component), `l` (link
  tool), `a` (evolution arrow), `i` (inertia), `p` (pipeline), `m` (method) or
  `b` (classic background). Edgeless-only, disabled with the `wardley` block
  flag, host-rebindable via the shortcut manifest (`getShortcutManifest` now
  lists the `wardley` group). The wardley menu actions were extracted into
  standalone functions shared by the toolbar and the shortcuts.

### Patch Changes

- Updated dependencies [9d0fe0c]
- Updated dependencies [4aeb85e]
- Updated dependencies [ecba791]
- Updated dependencies [ecba791]
- Updated dependencies [8de86f4]
- Updated dependencies [d295c58]
- Updated dependencies [8deda2d]
  - @labre/std@0.30.0
  - @labre/affine-block-frame@0.30.0
  - @labre/affine-gfx-ddd-shared@0.30.0
  - @labre/affine-gfx-ddd-context-map@0.30.0
  - @labre/affine-gfx-cynefin-estuarine@0.30.0
  - @labre/affine-gfx-bpmn@0.30.0
  - @labre/affine-gfx-wardley@0.30.0
  - @labre/affine-model@0.30.0
  - @labre/affine-gfx-shape@0.30.0
  - @labre/affine-block-root@0.30.0
  - @labre/affine-block-attachment@0.30.0
  - @labre/affine-block-bookmark@0.30.0
  - @labre/affine-block-callout@0.30.0
  - @labre/affine-block-code@0.30.0
  - @labre/affine-block-data-view@0.30.0
  - @labre/affine-block-database@0.30.0
  - @labre/affine-block-divider@0.30.0
  - @labre/affine-block-edgeless-text@0.30.0
  - @labre/affine-block-embed@0.30.0
  - @labre/affine-block-embed-doc@0.30.0
  - @labre/affine-block-image@0.30.0
  - @labre/affine-block-latex@0.30.0
  - @labre/affine-block-list@0.30.0
  - @labre/affine-block-note@0.30.0
  - @labre/affine-block-paragraph@0.30.0
  - @labre/affine-block-surface@0.30.0
  - @labre/affine-block-surface-ref@0.30.0
  - @labre/affine-block-table@0.30.0
  - @labre/affine-components@0.30.0
  - @labre/data-view@0.30.0
  - @labre/affine-foundation@0.30.0
  - @labre/affine-fragment-adapter-panel@0.30.0
  - @labre/affine-fragment-doc-title@0.30.0
  - @labre/affine-fragment-frame-panel@0.30.0
  - @labre/affine-fragment-outline@0.30.0
  - @labre/affine-gfx-brush@0.30.0
  - @labre/affine-gfx-connector@0.30.0
  - @labre/affine-gfx-ddd-aggregate@0.30.0
  - @labre/affine-gfx-ddd-core-domain@0.30.0
  - @labre/affine-gfx-ddd-event-storming@0.30.0
  - @labre/affine-gfx-edgy@0.30.0
  - @labre/affine-gfx-group@0.30.0
  - @labre/affine-gfx-link@0.30.0
  - @labre/affine-gfx-mindmap@0.30.0
  - @labre/affine-gfx-note@0.30.0
  - @labre/affine-gfx-pointer@0.30.0
  - @labre/affine-gfx-template@0.30.0
  - @labre/affine-gfx-text@0.30.0
  - @labre/affine-gfx-turbo-renderer@0.30.0
  - @labre/affine-inline-comment@0.30.0
  - @labre/affine-inline-footnote@0.30.0
  - @labre/affine-inline-latex@0.30.0
  - @labre/affine-inline-link@0.30.0
  - @labre/affine-inline-mention@0.30.0
  - @labre/affine-inline-preset@0.30.0
  - @labre/affine-inline-reference@0.30.0
  - @labre/affine-rich-text@0.30.0
  - @labre/affine-shared@0.30.0
  - @labre/affine-widget-drag-handle@0.30.0
  - @labre/affine-widget-edgeless-auto-connect@0.30.0
  - @labre/affine-widget-edgeless-dragging-area@0.30.0
  - @labre/affine-widget-edgeless-selected-rect@0.30.0
  - @labre/affine-widget-edgeless-toolbar@0.30.0
  - @labre/affine-widget-edgeless-zoom-toolbar@0.30.0
  - @labre/affine-widget-frame-title@0.30.0
  - @labre/affine-widget-keyboard-toolbar@0.30.0
  - @labre/affine-widget-linked-doc@0.30.0
  - @labre/affine-widget-note-slicer@0.30.0
  - @labre/affine-widget-page-dragging-area@0.30.0
  - @labre/affine-widget-remote-selection@0.30.0
  - @labre/affine-widget-scroll-anchoring@0.30.0
  - @labre/affine-widget-slash-menu@0.30.0
  - @labre/affine-widget-toolbar@0.30.0
  - @labre/affine-widget-viewport-overlay@0.30.0
  - @labre/affine-ext-loader@0.30.0
  - @labre/global@0.30.0
  - @labre/store@0.30.0
  - @labre/sync@0.30.0

## 0.29.1

### Patch Changes

- Re-publish so the host seams shipped in #30 and #37 are reachable from the
  published bundle via `@formicoidea/labre-core/shared/services`:

  - `KeymapOverrideExtension`, `ShortcutConflictReporterExtension`, `canonicalCombo`
    and the `ShortcutOverrides` / `ShortcutManifestEntry` / `ShortcutConflict` types (#30)
  - `LinkedDocContentResolverExtension`, `LinkedDocContentResolverIdentifier`
    and the `LinkedDocContentResolver` type (#37)

  The re-exports already exist in source (`shared/services` barrel); they only
  predated the `0.29.0` npm tarball, so the host could not import them. No code
  change — a fresh release exposes them. Closes #43.

  - @labre/affine-block-attachment@0.29.1
  - @labre/affine-block-bookmark@0.29.1
  - @labre/affine-block-callout@0.29.1
  - @labre/affine-block-code@0.29.1
  - @labre/affine-block-data-view@0.29.1
  - @labre/affine-block-database@0.29.1
  - @labre/affine-block-divider@0.29.1
  - @labre/affine-block-edgeless-text@0.29.1
  - @labre/affine-block-embed@0.29.1
  - @labre/affine-block-embed-doc@0.29.1
  - @labre/affine-block-frame@0.29.1
  - @labre/affine-block-image@0.29.1
  - @labre/affine-block-latex@0.29.1
  - @labre/affine-block-list@0.29.1
  - @labre/affine-block-note@0.29.1
  - @labre/affine-block-paragraph@0.29.1
  - @labre/affine-block-root@0.29.1
  - @labre/affine-block-surface@0.29.1
  - @labre/affine-block-surface-ref@0.29.1
  - @labre/affine-block-table@0.29.1
  - @labre/affine-components@0.29.1
  - @labre/data-view@0.29.1
  - @labre/affine-ext-loader@0.29.1
  - @labre/affine-foundation@0.29.1
  - @labre/affine-fragment-adapter-panel@0.29.1
  - @labre/affine-fragment-doc-title@0.29.1
  - @labre/affine-fragment-frame-panel@0.29.1
  - @labre/affine-fragment-outline@0.29.1
  - @labre/affine-gfx-bpmn@0.29.1
  - @labre/affine-gfx-brush@0.29.1
  - @labre/affine-gfx-connector@0.29.1
  - @labre/affine-gfx-cynefin-estuarine@0.29.1
  - @labre/affine-gfx-ddd-aggregate@0.29.1
  - @labre/affine-gfx-ddd-context-map@0.29.1
  - @labre/affine-gfx-ddd-core-domain@0.29.1
  - @labre/affine-gfx-ddd-event-storming@0.29.1
  - @labre/affine-gfx-ddd-shared@0.29.1
  - @labre/affine-gfx-edgy@0.29.1
  - @labre/affine-gfx-group@0.29.1
  - @labre/affine-gfx-link@0.29.1
  - @labre/affine-gfx-mindmap@0.29.1
  - @labre/affine-gfx-note@0.29.1
  - @labre/affine-gfx-pointer@0.29.1
  - @labre/affine-gfx-shape@0.29.1
  - @labre/affine-gfx-template@0.29.1
  - @labre/affine-gfx-text@0.29.1
  - @labre/affine-gfx-turbo-renderer@0.29.1
  - @labre/affine-gfx-wardley@0.29.1
  - @labre/affine-inline-comment@0.29.1
  - @labre/affine-inline-footnote@0.29.1
  - @labre/affine-inline-latex@0.29.1
  - @labre/affine-inline-link@0.29.1
  - @labre/affine-inline-mention@0.29.1
  - @labre/affine-inline-preset@0.29.1
  - @labre/affine-inline-reference@0.29.1
  - @labre/affine-model@0.29.1
  - @labre/affine-rich-text@0.29.1
  - @labre/affine-shared@0.29.1
  - @labre/affine-widget-drag-handle@0.29.1
  - @labre/affine-widget-edgeless-auto-connect@0.29.1
  - @labre/affine-widget-edgeless-dragging-area@0.29.1
  - @labre/affine-widget-edgeless-selected-rect@0.29.1
  - @labre/affine-widget-edgeless-toolbar@0.29.1
  - @labre/affine-widget-edgeless-zoom-toolbar@0.29.1
  - @labre/affine-widget-frame-title@0.29.1
  - @labre/affine-widget-keyboard-toolbar@0.29.1
  - @labre/affine-widget-linked-doc@0.29.1
  - @labre/affine-widget-note-slicer@0.29.1
  - @labre/affine-widget-page-dragging-area@0.29.1
  - @labre/affine-widget-remote-selection@0.29.1
  - @labre/affine-widget-scroll-anchoring@0.29.1
  - @labre/affine-widget-slash-menu@0.29.1
  - @labre/affine-widget-toolbar@0.29.1
  - @labre/affine-widget-viewport-overlay@0.29.1
  - @labre/global@0.29.1
  - @labre/std@0.29.1
  - @labre/store@0.29.1
  - @labre/sync@0.29.1

## 0.29.0

### Minor Changes

- 054423b: Replace the edgeless "Others" senior toolbar button (and its submenu) with two
  standalone senior buttons placed next to pen/eraser: **Text** (insert an
  editable text element) and **Add file** (open the file picker and insert the
  image/attachment). Each is a single tap and is individually flag-gated
  (`edgeless-text`, `edgeless-media`, replacing the old `other` flag). The actions
  reuse the former submenu's `textRender` / `mediaRender`, so text/file insertion
  is unchanged.
- 7aab287: Add `getShortcutManifest(flags)` (#30, phase 2): the enumerable, framework-aware
  shortcut manifest for a host "Shortcuts" settings panel. It returns the core
  shortcuts plus the shortcuts contributed by the currently-enabled frameworks
  (flag-gated like `getInternalViewExtensions`), as metadata-only entries (no
  runtime handler). Enumerable without an editor instance. Exposed at
  `@labre/affine/shortcuts`. The per-framework contribution seam is ready
  (`coreShortcuts` is now exported from the root block); no framework ships
  shortcuts yet, so the manifest currently returns core only.

### Patch Changes

- Updated dependencies [cbdd8c6]
- Updated dependencies [ad7a655]
- Updated dependencies [7375b9a]
- Updated dependencies [3a3c99b]
- Updated dependencies [43462b5]
- Updated dependencies [054423b]
- Updated dependencies [ab409c5]
- Updated dependencies [40db887]
- Updated dependencies [7aab287]
- Updated dependencies [9330750]
  - @labre/affine-gfx-ddd-core-domain@0.29.0
  - @labre/affine-gfx-link@0.29.0
  - @labre/affine-shared@0.29.0
  - @labre/affine-block-embed-doc@0.29.0
  - @labre/affine-gfx-mindmap@0.29.0
  - @labre/affine-block-root@0.29.0
  - @labre/std@0.29.0
  - @labre/affine-block-attachment@0.29.0
  - @labre/affine-block-bookmark@0.29.0
  - @labre/affine-block-callout@0.29.0
  - @labre/affine-block-code@0.29.0
  - @labre/affine-block-data-view@0.29.0
  - @labre/affine-block-database@0.29.0
  - @labre/affine-block-divider@0.29.0
  - @labre/affine-block-edgeless-text@0.29.0
  - @labre/affine-block-embed@0.29.0
  - @labre/affine-block-frame@0.29.0
  - @labre/affine-block-image@0.29.0
  - @labre/affine-block-latex@0.29.0
  - @labre/affine-block-list@0.29.0
  - @labre/affine-block-note@0.29.0
  - @labre/affine-block-paragraph@0.29.0
  - @labre/affine-block-surface@0.29.0
  - @labre/affine-block-surface-ref@0.29.0
  - @labre/affine-block-table@0.29.0
  - @labre/affine-components@0.29.0
  - @labre/data-view@0.29.0
  - @labre/affine-foundation@0.29.0
  - @labre/affine-fragment-adapter-panel@0.29.0
  - @labre/affine-fragment-doc-title@0.29.0
  - @labre/affine-fragment-frame-panel@0.29.0
  - @labre/affine-fragment-outline@0.29.0
  - @labre/affine-gfx-bpmn@0.29.0
  - @labre/affine-gfx-brush@0.29.0
  - @labre/affine-gfx-connector@0.29.0
  - @labre/affine-gfx-cynefin-estuarine@0.29.0
  - @labre/affine-gfx-ddd-aggregate@0.29.0
  - @labre/affine-gfx-ddd-context-map@0.29.0
  - @labre/affine-gfx-ddd-event-storming@0.29.0
  - @labre/affine-gfx-ddd-shared@0.29.0
  - @labre/affine-gfx-edgy@0.29.0
  - @labre/affine-gfx-group@0.29.0
  - @labre/affine-gfx-note@0.29.0
  - @labre/affine-gfx-pointer@0.29.0
  - @labre/affine-gfx-shape@0.29.0
  - @labre/affine-gfx-template@0.29.0
  - @labre/affine-gfx-text@0.29.0
  - @labre/affine-gfx-wardley@0.29.0
  - @labre/affine-inline-comment@0.29.0
  - @labre/affine-inline-footnote@0.29.0
  - @labre/affine-inline-latex@0.29.0
  - @labre/affine-inline-link@0.29.0
  - @labre/affine-inline-mention@0.29.0
  - @labre/affine-inline-preset@0.29.0
  - @labre/affine-inline-reference@0.29.0
  - @labre/affine-rich-text@0.29.0
  - @labre/affine-widget-drag-handle@0.29.0
  - @labre/affine-widget-edgeless-auto-connect@0.29.0
  - @labre/affine-widget-edgeless-dragging-area@0.29.0
  - @labre/affine-widget-edgeless-selected-rect@0.29.0
  - @labre/affine-widget-edgeless-toolbar@0.29.0
  - @labre/affine-widget-edgeless-zoom-toolbar@0.29.0
  - @labre/affine-widget-frame-title@0.29.0
  - @labre/affine-widget-keyboard-toolbar@0.29.0
  - @labre/affine-widget-linked-doc@0.29.0
  - @labre/affine-widget-note-slicer@0.29.0
  - @labre/affine-widget-page-dragging-area@0.29.0
  - @labre/affine-widget-remote-selection@0.29.0
  - @labre/affine-widget-scroll-anchoring@0.29.0
  - @labre/affine-widget-slash-menu@0.29.0
  - @labre/affine-widget-toolbar@0.29.0
  - @labre/affine-widget-viewport-overlay@0.29.0
  - @labre/affine-gfx-turbo-renderer@0.29.0
  - @labre/affine-model@0.29.0
  - @labre/affine-ext-loader@0.29.0
  - @labre/global@0.29.0
  - @labre/store@0.29.0
  - @labre/sync@0.29.0

## 0.28.0

### Patch Changes

- Updated dependencies [1cd6c92]
- Updated dependencies [65cc055]
  - @labre/affine-block-database@0.28.0
  - @labre/data-view@0.28.0
  - @labre/std@0.28.0
  - @labre/affine-block-data-view@0.28.0
  - @labre/affine-block-root@0.28.0
  - @labre/affine-widget-keyboard-toolbar@0.28.0
  - @labre/affine-widget-toolbar@0.28.0
  - @labre/affine-block-table@0.28.0
  - @labre/affine-foundation@0.28.0
  - @labre/affine-block-attachment@0.28.0
  - @labre/affine-block-bookmark@0.28.0
  - @labre/affine-block-callout@0.28.0
  - @labre/affine-block-code@0.28.0
  - @labre/affine-block-divider@0.28.0
  - @labre/affine-block-edgeless-text@0.28.0
  - @labre/affine-block-embed@0.28.0
  - @labre/affine-block-embed-doc@0.28.0
  - @labre/affine-block-frame@0.28.0
  - @labre/affine-block-image@0.28.0
  - @labre/affine-block-latex@0.28.0
  - @labre/affine-block-list@0.28.0
  - @labre/affine-block-note@0.28.0
  - @labre/affine-block-paragraph@0.28.0
  - @labre/affine-block-surface@0.28.0
  - @labre/affine-block-surface-ref@0.28.0
  - @labre/affine-components@0.28.0
  - @labre/affine-fragment-adapter-panel@0.28.0
  - @labre/affine-fragment-doc-title@0.28.0
  - @labre/affine-fragment-frame-panel@0.28.0
  - @labre/affine-fragment-outline@0.28.0
  - @labre/affine-gfx-bpmn@0.28.0
  - @labre/affine-gfx-brush@0.28.0
  - @labre/affine-gfx-connector@0.28.0
  - @labre/affine-gfx-cynefin-estuarine@0.28.0
  - @labre/affine-gfx-ddd-aggregate@0.28.0
  - @labre/affine-gfx-ddd-context-map@0.28.0
  - @labre/affine-gfx-ddd-core-domain@0.28.0
  - @labre/affine-gfx-ddd-event-storming@0.28.0
  - @labre/affine-gfx-ddd-shared@0.28.0
  - @labre/affine-gfx-edgy@0.28.0
  - @labre/affine-gfx-group@0.28.0
  - @labre/affine-gfx-link@0.28.0
  - @labre/affine-gfx-mindmap@0.28.0
  - @labre/affine-gfx-note@0.28.0
  - @labre/affine-gfx-pointer@0.28.0
  - @labre/affine-gfx-shape@0.28.0
  - @labre/affine-gfx-template@0.28.0
  - @labre/affine-gfx-text@0.28.0
  - @labre/affine-gfx-turbo-renderer@0.28.0
  - @labre/affine-gfx-wardley@0.28.0
  - @labre/affine-inline-comment@0.28.0
  - @labre/affine-inline-footnote@0.28.0
  - @labre/affine-inline-latex@0.28.0
  - @labre/affine-inline-link@0.28.0
  - @labre/affine-inline-mention@0.28.0
  - @labre/affine-inline-preset@0.28.0
  - @labre/affine-inline-reference@0.28.0
  - @labre/affine-model@0.28.0
  - @labre/affine-rich-text@0.28.0
  - @labre/affine-shared@0.28.0
  - @labre/affine-widget-drag-handle@0.28.0
  - @labre/affine-widget-edgeless-auto-connect@0.28.0
  - @labre/affine-widget-edgeless-dragging-area@0.28.0
  - @labre/affine-widget-edgeless-selected-rect@0.28.0
  - @labre/affine-widget-edgeless-toolbar@0.28.0
  - @labre/affine-widget-edgeless-zoom-toolbar@0.28.0
  - @labre/affine-widget-frame-title@0.28.0
  - @labre/affine-widget-linked-doc@0.28.0
  - @labre/affine-widget-note-slicer@0.28.0
  - @labre/affine-widget-page-dragging-area@0.28.0
  - @labre/affine-widget-remote-selection@0.28.0
  - @labre/affine-widget-scroll-anchoring@0.28.0
  - @labre/affine-widget-slash-menu@0.28.0
  - @labre/affine-widget-viewport-overlay@0.28.0
  - @labre/affine-ext-loader@0.28.0
  - @labre/global@0.28.0
  - @labre/store@0.28.0
  - @labre/sync@0.28.0

## 0.27.0

### Patch Changes

- Updated dependencies [14ef3e7]
- Updated dependencies [91f6397]
- Updated dependencies [91f6397]
  - @labre/affine-block-database@0.27.0
  - @labre/affine-block-root@0.27.0
  - @labre/affine-widget-edgeless-selected-rect@0.27.0
  - @labre/std@0.27.0
  - @labre/affine-block-data-view@0.27.0
  - @labre/affine-widget-keyboard-toolbar@0.27.0
  - @labre/affine-widget-toolbar@0.27.0
  - @labre/affine-widget-note-slicer@0.27.0
  - @labre/affine-block-attachment@0.27.0
  - @labre/affine-block-bookmark@0.27.0
  - @labre/affine-block-callout@0.27.0
  - @labre/affine-block-code@0.27.0
  - @labre/affine-block-divider@0.27.0
  - @labre/affine-block-edgeless-text@0.27.0
  - @labre/affine-block-embed@0.27.0
  - @labre/affine-block-embed-doc@0.27.0
  - @labre/affine-block-frame@0.27.0
  - @labre/affine-block-image@0.27.0
  - @labre/affine-block-latex@0.27.0
  - @labre/affine-block-list@0.27.0
  - @labre/affine-block-note@0.27.0
  - @labre/affine-block-paragraph@0.27.0
  - @labre/affine-block-surface@0.27.0
  - @labre/affine-block-surface-ref@0.27.0
  - @labre/affine-block-table@0.27.0
  - @labre/affine-components@0.27.0
  - @labre/data-view@0.27.0
  - @labre/affine-foundation@0.27.0
  - @labre/affine-fragment-adapter-panel@0.27.0
  - @labre/affine-fragment-doc-title@0.27.0
  - @labre/affine-fragment-frame-panel@0.27.0
  - @labre/affine-fragment-outline@0.27.0
  - @labre/affine-gfx-bpmn@0.27.0
  - @labre/affine-gfx-brush@0.27.0
  - @labre/affine-gfx-connector@0.27.0
  - @labre/affine-gfx-cynefin-estuarine@0.27.0
  - @labre/affine-gfx-ddd-aggregate@0.27.0
  - @labre/affine-gfx-ddd-context-map@0.27.0
  - @labre/affine-gfx-ddd-core-domain@0.27.0
  - @labre/affine-gfx-ddd-event-storming@0.27.0
  - @labre/affine-gfx-ddd-shared@0.27.0
  - @labre/affine-gfx-edgy@0.27.0
  - @labre/affine-gfx-group@0.27.0
  - @labre/affine-gfx-link@0.27.0
  - @labre/affine-gfx-mindmap@0.27.0
  - @labre/affine-gfx-note@0.27.0
  - @labre/affine-gfx-pointer@0.27.0
  - @labre/affine-gfx-shape@0.27.0
  - @labre/affine-gfx-template@0.27.0
  - @labre/affine-gfx-text@0.27.0
  - @labre/affine-gfx-turbo-renderer@0.27.0
  - @labre/affine-gfx-wardley@0.27.0
  - @labre/affine-inline-comment@0.27.0
  - @labre/affine-inline-footnote@0.27.0
  - @labre/affine-inline-latex@0.27.0
  - @labre/affine-inline-link@0.27.0
  - @labre/affine-inline-mention@0.27.0
  - @labre/affine-inline-preset@0.27.0
  - @labre/affine-inline-reference@0.27.0
  - @labre/affine-model@0.27.0
  - @labre/affine-rich-text@0.27.0
  - @labre/affine-shared@0.27.0
  - @labre/affine-widget-drag-handle@0.27.0
  - @labre/affine-widget-edgeless-auto-connect@0.27.0
  - @labre/affine-widget-edgeless-dragging-area@0.27.0
  - @labre/affine-widget-edgeless-toolbar@0.27.0
  - @labre/affine-widget-edgeless-zoom-toolbar@0.27.0
  - @labre/affine-widget-frame-title@0.27.0
  - @labre/affine-widget-linked-doc@0.27.0
  - @labre/affine-widget-page-dragging-area@0.27.0
  - @labre/affine-widget-remote-selection@0.27.0
  - @labre/affine-widget-scroll-anchoring@0.27.0
  - @labre/affine-widget-slash-menu@0.27.0
  - @labre/affine-widget-viewport-overlay@0.27.0
  - @labre/affine-ext-loader@0.27.0
  - @labre/global@0.27.0
  - @labre/store@0.27.0
  - @labre/sync@0.27.0

## 0.26.0

### Minor Changes

- 66cd7e6: feat(blocks): ship each DDD senior button as its own package + bundle

  DDD was a single package holding three senior buttons (Event Storming, Core
  Domain Chart, Context Map), so the release bundler vendored it into
  `labre-core` instead of emitting framework bundles. It is now split per the
  "one senior button = one package" rule:

  - `@labre/affine-gfx-ddd-shared` → published as `@formicoidea/labre-ddd-shared`
    (shared base: consts/prefabs/menu-base/icons/template builders).
  - `@labre/affine-gfx-ddd-event-storming`, `-core-domain`, `-context-map`,
    `-aggregate` → published as `@formicoidea/labre-framework-ddd-*`, each
    depending on `labre-core` + `labre-ddd-shared`.

  `scripts/build-bundles.mjs` is now data-driven (adding a senior-button package
  is one `FRAMEWORKS` entry, with multi-extension/flag support), and
  `compile-/publish-bundles.mjs` resolve and order bundle→bundle dependencies
  (core → shared → frameworks). DDD no longer ships inside `labre-core` —
  consumers import it from the dedicated framework packages.

### Patch Changes

- Updated dependencies [8960a6c]
- Updated dependencies [6795191]
  - @labre/affine-block-database@0.26.0
  - @labre/affine-model@0.26.0
  - @labre/affine-components@0.26.0
  - @labre/affine-widget-toolbar@0.26.0
  - @labre/affine-gfx-wardley@0.26.0
  - @labre/affine-gfx-bpmn@0.26.0
  - @labre/affine-gfx-cynefin-estuarine@0.26.0
  - @labre/affine-gfx-edgy@0.26.0
  - @labre/affine-gfx-mindmap@0.26.0
  - @labre/affine-gfx-ddd-shared@0.26.0
  - @labre/affine-block-data-view@0.26.0
  - @labre/affine-block-root@0.26.0
  - @labre/affine-widget-keyboard-toolbar@0.26.0
  - @labre/affine-block-attachment@0.26.0
  - @labre/affine-block-bookmark@0.26.0
  - @labre/affine-block-callout@0.26.0
  - @labre/affine-block-code@0.26.0
  - @labre/affine-block-divider@0.26.0
  - @labre/affine-block-edgeless-text@0.26.0
  - @labre/affine-block-embed@0.26.0
  - @labre/affine-block-embed-doc@0.26.0
  - @labre/affine-block-frame@0.26.0
  - @labre/affine-block-image@0.26.0
  - @labre/affine-block-latex@0.26.0
  - @labre/affine-block-list@0.26.0
  - @labre/affine-block-note@0.26.0
  - @labre/affine-block-paragraph@0.26.0
  - @labre/affine-block-surface@0.26.0
  - @labre/affine-block-surface-ref@0.26.0
  - @labre/affine-block-table@0.26.0
  - @labre/affine-fragment-adapter-panel@0.26.0
  - @labre/affine-fragment-doc-title@0.26.0
  - @labre/affine-fragment-frame-panel@0.26.0
  - @labre/affine-fragment-outline@0.26.0
  - @labre/affine-gfx-brush@0.26.0
  - @labre/affine-gfx-connector@0.26.0
  - @labre/affine-gfx-ddd-aggregate@0.26.0
  - @labre/affine-gfx-ddd-context-map@0.26.0
  - @labre/affine-gfx-ddd-core-domain@0.26.0
  - @labre/affine-gfx-ddd-event-storming@0.26.0
  - @labre/affine-gfx-group@0.26.0
  - @labre/affine-gfx-link@0.26.0
  - @labre/affine-gfx-note@0.26.0
  - @labre/affine-gfx-pointer@0.26.0
  - @labre/affine-gfx-shape@0.26.0
  - @labre/affine-gfx-template@0.26.0
  - @labre/affine-gfx-text@0.26.0
  - @labre/affine-inline-comment@0.26.0
  - @labre/affine-inline-footnote@0.26.0
  - @labre/affine-inline-latex@0.26.0
  - @labre/affine-inline-link@0.26.0
  - @labre/affine-inline-mention@0.26.0
  - @labre/affine-inline-preset@0.26.0
  - @labre/affine-inline-reference@0.26.0
  - @labre/affine-rich-text@0.26.0
  - @labre/affine-shared@0.26.0
  - @labre/affine-widget-drag-handle@0.26.0
  - @labre/affine-widget-edgeless-auto-connect@0.26.0
  - @labre/affine-widget-edgeless-dragging-area@0.26.0
  - @labre/affine-widget-edgeless-selected-rect@0.26.0
  - @labre/affine-widget-edgeless-toolbar@0.26.0
  - @labre/affine-widget-edgeless-zoom-toolbar@0.26.0
  - @labre/affine-widget-frame-title@0.26.0
  - @labre/affine-widget-linked-doc@0.26.0
  - @labre/affine-widget-note-slicer@0.26.0
  - @labre/affine-widget-page-dragging-area@0.26.0
  - @labre/affine-widget-remote-selection@0.26.0
  - @labre/affine-widget-scroll-anchoring@0.26.0
  - @labre/affine-widget-viewport-overlay@0.26.0
  - @labre/data-view@0.26.0
  - @labre/affine-foundation@0.26.0
  - @labre/affine-widget-slash-menu@0.26.0
  - @labre/affine-ext-loader@0.26.0
  - @labre/affine-gfx-turbo-renderer@0.26.0
  - @labre/global@0.26.0
  - @labre/std@0.26.0
  - @labre/store@0.26.0
  - @labre/sync@0.26.0

## 0.25.0

### Minor Changes

- 66cd7e6: feat(blocks): ship each DDD senior button as its own package + bundle

  DDD was a single package holding three senior buttons (Event Storming, Core
  Domain Chart, Context Map), so the release bundler vendored it into
  `labre-core` instead of emitting framework bundles. It is now split per the
  "one senior button = one package" rule:

  - `@labre/affine-gfx-ddd-shared` → published as `@formicoidea/labre-ddd-shared`
    (shared base: consts/prefabs/menu-base/icons/template builders).
  - `@labre/affine-gfx-ddd-event-storming`, `-core-domain`, `-context-map`,
    `-aggregate` → published as `@formicoidea/labre-framework-ddd-*`, each
    depending on `labre-core` + `labre-ddd-shared`.

  `scripts/build-bundles.mjs` is now data-driven (adding a senior-button package
  is one `FRAMEWORKS` entry, with multi-extension/flag support), and
  `compile-/publish-bundles.mjs` resolve and order bundle→bundle dependencies
  (core → shared → frameworks). DDD no longer ships inside `labre-core` —
  consumers import it from the dedicated framework packages.

### Patch Changes

- Updated dependencies [8960a6c]
- Updated dependencies [6795191]
  - @labre/affine-block-database@0.25.0
  - @labre/affine-model@0.25.0
  - @labre/affine-components@0.25.0
  - @labre/affine-widget-toolbar@0.25.0
  - @labre/affine-gfx-wardley@0.25.0
  - @labre/affine-gfx-bpmn@0.25.0
  - @labre/affine-gfx-cynefin-estuarine@0.25.0
  - @labre/affine-gfx-edgy@0.25.0
  - @labre/affine-gfx-mindmap@0.25.0
  - @labre/affine-gfx-ddd-shared@0.25.0
  - @labre/affine-block-data-view@0.25.0
  - @labre/affine-block-root@0.25.0
  - @labre/affine-widget-keyboard-toolbar@0.25.0
  - @labre/affine-block-attachment@0.25.0
  - @labre/affine-block-bookmark@0.25.0
  - @labre/affine-block-callout@0.25.0
  - @labre/affine-block-code@0.25.0
  - @labre/affine-block-divider@0.25.0
  - @labre/affine-block-edgeless-text@0.25.0
  - @labre/affine-block-embed@0.25.0
  - @labre/affine-block-embed-doc@0.25.0
  - @labre/affine-block-frame@0.25.0
  - @labre/affine-block-image@0.25.0
  - @labre/affine-block-latex@0.25.0
  - @labre/affine-block-list@0.25.0
  - @labre/affine-block-note@0.25.0
  - @labre/affine-block-paragraph@0.25.0
  - @labre/affine-block-surface@0.25.0
  - @labre/affine-block-surface-ref@0.25.0
  - @labre/affine-block-table@0.25.0
  - @labre/affine-fragment-adapter-panel@0.25.0
  - @labre/affine-fragment-doc-title@0.25.0
  - @labre/affine-fragment-frame-panel@0.25.0
  - @labre/affine-fragment-outline@0.25.0
  - @labre/affine-gfx-brush@0.25.0
  - @labre/affine-gfx-connector@0.25.0
  - @labre/affine-gfx-ddd-aggregate@0.25.0
  - @labre/affine-gfx-ddd-context-map@0.25.0
  - @labre/affine-gfx-ddd-core-domain@0.25.0
  - @labre/affine-gfx-ddd-event-storming@0.25.0
  - @labre/affine-gfx-group@0.25.0
  - @labre/affine-gfx-link@0.25.0
  - @labre/affine-gfx-note@0.25.0
  - @labre/affine-gfx-pointer@0.25.0
  - @labre/affine-gfx-shape@0.25.0
  - @labre/affine-gfx-template@0.25.0
  - @labre/affine-gfx-text@0.25.0
  - @labre/affine-inline-comment@0.25.0
  - @labre/affine-inline-footnote@0.25.0
  - @labre/affine-inline-latex@0.25.0
  - @labre/affine-inline-link@0.25.0
  - @labre/affine-inline-mention@0.25.0
  - @labre/affine-inline-preset@0.25.0
  - @labre/affine-inline-reference@0.25.0
  - @labre/affine-rich-text@0.25.0
  - @labre/affine-shared@0.25.0
  - @labre/affine-widget-drag-handle@0.25.0
  - @labre/affine-widget-edgeless-auto-connect@0.25.0
  - @labre/affine-widget-edgeless-dragging-area@0.25.0
  - @labre/affine-widget-edgeless-selected-rect@0.25.0
  - @labre/affine-widget-edgeless-toolbar@0.25.0
  - @labre/affine-widget-edgeless-zoom-toolbar@0.25.0
  - @labre/affine-widget-frame-title@0.25.0
  - @labre/affine-widget-linked-doc@0.25.0
  - @labre/affine-widget-note-slicer@0.25.0
  - @labre/affine-widget-page-dragging-area@0.25.0
  - @labre/affine-widget-remote-selection@0.25.0
  - @labre/affine-widget-scroll-anchoring@0.25.0
  - @labre/affine-widget-viewport-overlay@0.25.0
  - @labre/data-view@0.25.0
  - @labre/affine-foundation@0.25.0
  - @labre/affine-widget-slash-menu@0.25.0
  - @labre/affine-ext-loader@0.25.0
  - @labre/affine-gfx-turbo-renderer@0.25.0
  - @labre/global@0.25.0
  - @labre/std@0.25.0
  - @labre/store@0.25.0
  - @labre/sync@0.25.0

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
