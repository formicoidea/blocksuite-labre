# @labre/affine-gfx-mindmap

## 0.43.0

### Patch Changes

- f1a4af7: Twenty-six strings a French host still read in English now go through the
  translation seam: the colour picker's Heavy row, the slash menu's List and
  Style headers, the five "Other" template tiles, the embed error card's
  sentence, the SVG import's three refusals, the two "Untitled" linked-doc
  titles, and the accessible name of every toolbar menu (which used to read
  "changer le type de forme-menu"). New keys, English fallbacks letter for
  letter what shipped — a host with no catalogue sees no change.

  New keys: `com.labre.palette-name.heavy-{red,orange,yellow,green,blue,purple,magenta}`,
  `com.labre.slash-menu.group.list`,
  `com.labre.template.name.{swot,kanban-board,business-model-canvas,fishbone,gantt-chart}`,
  `com.labre.embed.iframe.error.{no-embed-data,invalid-url,message}`,
  `com.labre.interchange.svg.error.{malformed-xml,not-svg,sanitized-away}`,
  `com.labre.interchange.import.default-name`, `com.labre.menu-aria.style`,
  `com.labre.text-toolbar.alignment-menu`,
  `com.labre.shape.toolbar.switch-type-menu`,
  `com.labre.mindmap.toolbar.layout-menu`,
  `com.labre.connector.toolbar.{start-point-style,end-point-style,shape}-menu`,
  `com.labre.bpmn.import.error.missing-namespace`.

- Updated dependencies [da68dbb]
- Updated dependencies [72f7282]
- Updated dependencies [8f54236]
- Updated dependencies [f1a4af7]
- Updated dependencies [8a927dd]
  - @labre/affine-shared@0.43.0
  - @labre/affine-block-surface@0.43.0
  - @labre/affine-components@0.43.0
  - @labre/affine-gfx-template@0.43.0
  - @labre/affine-widget-edgeless-toolbar@0.43.0
  - @labre/affine-gfx-shape@0.43.0
  - @labre/affine-gfx-text@0.43.0
  - @labre/affine-gfx-connector@0.43.0
  - @labre/affine-block-attachment@0.43.0
  - @labre/affine-block-edgeless-text@0.43.0
  - @labre/affine-block-image@0.43.0
  - @labre/affine-gfx-pointer@0.43.0
  - @labre/affine-rich-text@0.43.0
  - @labre/affine-ext-loader@0.43.0
  - @labre/affine-model@0.43.0
  - @labre/global@0.43.0
  - @labre/std@0.43.0
  - @labre/store@0.43.0

## 0.42.0

### Patch Changes

- Updated dependencies [87ef822]
- Updated dependencies [90ddf64]
- Updated dependencies [f294deb]
- Updated dependencies [911d143]
- Updated dependencies [911d143]
- Updated dependencies [0dcd69b]
- Updated dependencies [911d143]
- Updated dependencies [a441d96]
- Updated dependencies [4899136]
- Updated dependencies [2f5c621]
- Updated dependencies [911d143]
- Updated dependencies [9ecfc77]
- Updated dependencies [48213e7]
- Updated dependencies [dd1c772]
- Updated dependencies [512ab39]
- Updated dependencies [7437481]
- Updated dependencies [2e179bb]
- Updated dependencies [911d143]
- Updated dependencies [4f5faa3]
- Updated dependencies [e5d0e6e]
- Updated dependencies [911d143]
- Updated dependencies [f3f412a]
- Updated dependencies [d756a4a]
- Updated dependencies [6bc897b]
- Updated dependencies [f6ece47]
- Updated dependencies [ef0e3da]
- Updated dependencies [e2f6ca5]
- Updated dependencies [fff6bea]
- Updated dependencies [d1851b1]
- Updated dependencies [5a8ec30]
- Updated dependencies [549056e]
- Updated dependencies [2bb7318]
- Updated dependencies [c73b25f]
- Updated dependencies [7898f84]
- Updated dependencies [911d143]
- Updated dependencies [911d143]
- Updated dependencies [911d143]
- Updated dependencies [911d143]
- Updated dependencies [911d143]
- Updated dependencies [911d143]
- Updated dependencies [911d143]
- Updated dependencies [911d143]
- Updated dependencies [ad28f94]
- Updated dependencies [55d9f13]
  - @labre/affine-widget-edgeless-toolbar@0.42.0
  - @labre/std@0.42.0
  - @labre/affine-block-surface@0.42.0
  - @labre/affine-gfx-template@0.42.0
  - @labre/affine-model@0.42.0
  - @labre/affine-shared@0.42.0
  - @labre/store@0.42.0
  - @labre/affine-gfx-text@0.42.0
  - @labre/affine-gfx-connector@0.42.0
  - @labre/affine-block-edgeless-text@0.42.0
  - @labre/affine-components@0.42.0
  - @labre/affine-gfx-shape@0.42.0
  - @labre/global@0.42.0
  - @labre/affine-gfx-pointer@0.42.0
  - @labre/affine-block-attachment@0.42.0
  - @labre/affine-block-image@0.42.0
  - @labre/affine-rich-text@0.42.0
  - @labre/affine-ext-loader@0.42.0

## 0.41.0

### Minor Changes

- 75770e1: feat(blocks): every seed the DDD frameworks, the generic diagrams and the gfx-primitive packages write into a document at creation now resolves through the translation seam (`translateKey`, ADR 0016), so a document created in a translated host starts in that language instead of English — a document created before these keys existed keeps its plain text.

  Event Storming's eight sticky captions and its hotspot; Core Domain's five sub-domain dots and three Team Topologies markers (both palettes derived from tables shared in `ddd-shared`, exported once as `dddSharedTranslationEntries` and spread into each consuming framework rather than restated); Context Map's bounded-context bubble and its cloud's "System" name; Cynefin/Estuarine's two hand-composed compositions ("Decision sorting"'s four domain stickies, "Constraint map"'s three hexagon captions); the standalone "Aggregate Design Canvas" template's header and nine section titles; the five generic ("Other") templates — SWOT's four quadrant labels, Kanban's card/column words, the Business Model Canvas's title and nine section names, Fishbone's category/effect/item words, Gantt's phase names and its `{{n}}`-parameterised week header; a frame's and a group's default title (`Frame {{n}}` / `Group {{n}}`); the "/ Mind Map" slash command's and the drag-from-basket mindmap tool's root and child captions; the four starter mindmap templates' root and three topic captions; and an imported `.mm`/`.opml` file's untitled-node fallback.

  Every hand-composed template touched (the mindmap starters, the two Cynefin/Estuarine compositions, the Aggregate Design Canvas, the five generic diagrams) gained a `localize` rebuild mirroring the derived-template mechanism already in place: without a host catalogue every one of them still inserts byte-identical English content. Non-framework packages that write seeds now have their own small `translations.ts`, listed under a new `PACKAGE_SEED_WORDINGS` table in the manifest (source `seed`, alongside the existing chrome-sourced `PACKAGE_WORDINGS`) — the same minimal extension the seed-source manifest already needed for a framework's own seeds.

  Left untouched, and why: the DDD Context Map's nine relationship patterns write no seed at all since WS2 (the palette arms the connector tool rather than dropping a labelled group — nothing to translate); the mindmap model's own "New node" default (a red zone — `packages/affine/model`) and the two callers that rely on it sit in packages outside this lot's scope; the code and shared-adapter "Plain Text"/"Untitled" fallbacks run in the paste/import pipeline's `Transformer`, whose optional `provider` is never wired to the editor's `TranslationProvider` by any existing caller.

  Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>

- 1dac32d: feat(blocks): translate the edgeless toolbar, canvas tools and generic widgets at the seam. The edgeless toolbar (font weight/style, style toggles, tool tooltips, zoom bar), the mindmap and shape frameworks (senior/quick tools, style and layout menus, shape names, templates category tab), the text toolbar, the outline panel and its floating mini-viewer, the adapter/debug panel, the document title placeholder, the drag-and-drop preview, the auto-connect index badges, the "+" auto-complete panel and floating link button, the "⋮" overflow menu, and the "@" linked-doc menu (including its import dialog and the remote-cursor fallback name) now resolve through `translateKey`/`ChromeWording` instead of hardcoded English. A new `com.labre.mindmap.seed.new-node` seed replaces the mindmap model's own "New node" default at every call site in these packages. With no `TranslationProvider` registered every surface reads exactly as before, letter for letter.
- 223b280: feat(blocks): close three shared translation seams the earlier i18n lots flagged as missing, then translate every string that was waiting on them. `Template.nameKey` gives a hand-composed template (a worked scene, an example map) a tile name of its own -- `resolveTemplateName` checks it before the `commandId`-derived path -- and every BPMN, Wardley, EDGY, Cynefin, Estuarine and mind-map hand-authored card now carries one. `AutoLegendSpec.titleKey` (already resolved by `createAutoLegend`) is now set for EDGY and C4's own "Legend" boxes, so both translate through the shared `BOARD_LEGEND_TITLE` key exactly like the three DDD boards already did. `MorphSpec.afterMorph` takes an optional 4th `std` parameter, which the morph toolbar now passes through: morphing an untouched TRANSLATED placeholder rewrites it to the target kind's own translated placeholder (`c4MorphedTypeLine`, `wardleyMorphedLabel`), where it used to fall back to English. Beyond the three seams: the note tool's overlay caption and a document's "Untitled" fallback (`inlines/reference`, the linked-doc HTML/Markdown exporters) now resolve through the shared `BLOCK_NAME_TEXT` / `DOC_UNTITLED` wordings instead of a raw literal; the "Template" senior-tool button gained a `labelKey`. Per a PO decision (2026-09-12), the linked-doc import dialog's English fallback now says "Labre" instead of the inherited "AFFiNE" in the two sentences that named it. Every addition is optional and retro-compatible: with no `TranslationProvider` registered, nothing on screen changes.

### Patch Changes

- a513f05: Displayed English now says "Canvas" where it said "Edgeless" and "Document" where "Page" named the document mode (display-mode options, note and frame toolbars, toasts, slash-menu group headers, surface-ref placeholders, the frame and mind-map slash-menu previews). Translation keys, identifiers and stored values are unchanged. Three keys that already shipped change their English fallback: `com.labre.embed.synced-doc.empty-preview`, `com.labre.toast.frame-inserted-into-page` and `com.labre.toast.note-removed-from-page-mode`. The mobile keyboard toolbar is left as is.
- b2781b5: refactor(blocks): one chrome word, one key. Where several packages declared the same English interface word under different keys (Copy-style verbs, text formats, display modes, Reload, Rename, Settings…), they now share one wording from `@labre/affine-shared/services`, and the key manifest carries 52 fewer entries. Nothing changes on screen, and no key that existed in a previous release is removed: the merged keys were all introduced by this release's translation work. The manifest spec now fails when a new interface word is declared under a second key (real homonyms such as « Light » or « Left » are allow-listed with a reason).
- Updated dependencies [a513f05]
- Updated dependencies [6cfe313]
- Updated dependencies [5776733]
- Updated dependencies [75770e1]
- Updated dependencies [4ed9484]
- Updated dependencies [c4661f2]
- Updated dependencies [6271b11]
- Updated dependencies [924f7d6]
- Updated dependencies [5744cfd]
- Updated dependencies [feca957]
- Updated dependencies [1dac32d]
- Updated dependencies [b2781b5]
- Updated dependencies [223b280]
- Updated dependencies [47d4ac6]
  - @labre/affine-shared@0.41.0
  - @labre/affine-gfx-template@0.41.0
  - @labre/affine-block-surface@0.41.0
  - @labre/affine-gfx-connector@0.41.0
  - @labre/std@0.41.0
  - @labre/affine-block-attachment@0.41.0
  - @labre/affine-block-image@0.41.0
  - @labre/affine-gfx-pointer@0.41.0
  - @labre/affine-components@0.41.0
  - @labre/affine-rich-text@0.41.0
  - @labre/affine-block-edgeless-text@0.41.0
  - @labre/affine-gfx-shape@0.41.0
  - @labre/affine-gfx-text@0.41.0
  - @labre/affine-widget-edgeless-toolbar@0.41.0
  - @labre/affine-model@0.41.0
  - @labre/affine-ext-loader@0.41.0
  - @labre/global@0.41.0
  - @labre/store@0.41.0

## 0.40.0

### Patch Changes

- Updated dependencies [95ff0a5]
- Updated dependencies [95ff0a5]
  - @labre/affine-shared@0.40.0
  - @labre/affine-block-surface@0.40.0
  - @labre/affine-gfx-template@0.40.0
  - @labre/affine-block-edgeless-text@0.40.0
  - @labre/affine-block-attachment@0.40.0
  - @labre/affine-block-image@0.40.0
  - @labre/affine-components@0.40.0
  - @labre/affine-gfx-connector@0.40.0
  - @labre/affine-gfx-pointer@0.40.0
  - @labre/affine-gfx-shape@0.40.0
  - @labre/affine-gfx-text@0.40.0
  - @labre/affine-rich-text@0.40.0
  - @labre/affine-widget-edgeless-toolbar@0.40.0
  - @labre/affine-ext-loader@0.40.0
  - @labre/affine-model@0.40.0
  - @labre/global@0.40.0
  - @labre/std@0.40.0
  - @labre/store@0.40.0

## 0.39.3

### Patch Changes

- Updated dependencies [4ab8a5b]
- Updated dependencies [070e1ec]
  - @labre/affine-block-surface@0.39.3
  - @labre/affine-components@0.39.3
  - @labre/affine-block-attachment@0.39.3
  - @labre/affine-block-edgeless-text@0.39.3
  - @labre/affine-block-image@0.39.3
  - @labre/affine-gfx-connector@0.39.3
  - @labre/affine-gfx-pointer@0.39.3
  - @labre/affine-gfx-shape@0.39.3
  - @labre/affine-gfx-template@0.39.3
  - @labre/affine-gfx-text@0.39.3
  - @labre/affine-widget-edgeless-toolbar@0.39.3
  - @labre/affine-rich-text@0.39.3
  - @labre/affine-ext-loader@0.39.3
  - @labre/affine-model@0.39.3
  - @labre/affine-shared@0.39.3
  - @labre/global@0.39.3
  - @labre/std@0.39.3
  - @labre/store@0.39.3

## 0.39.2

### Patch Changes

- Updated dependencies [07b47b8]
  - @labre/affine-shared@0.39.2
  - @labre/affine-block-surface@0.39.2
  - @labre/affine-block-attachment@0.39.2
  - @labre/affine-block-edgeless-text@0.39.2
  - @labre/affine-block-image@0.39.2
  - @labre/affine-components@0.39.2
  - @labre/affine-gfx-connector@0.39.2
  - @labre/affine-gfx-pointer@0.39.2
  - @labre/affine-gfx-shape@0.39.2
  - @labre/affine-gfx-template@0.39.2
  - @labre/affine-gfx-text@0.39.2
  - @labre/affine-rich-text@0.39.2
  - @labre/affine-widget-edgeless-toolbar@0.39.2
  - @labre/affine-ext-loader@0.39.2
  - @labre/affine-model@0.39.2
  - @labre/global@0.39.2
  - @labre/std@0.39.2
  - @labre/store@0.39.2

## 0.39.1

### Patch Changes

- 00eab3d: A remote edit never triggers a local persisted write in the connector watcher,
  the frame manager or a mindmap's children observer. Readonly viewers no longer
  write — or throw — on remote polygon moves, connector mode changes, block adds
  above a frame, or mindmap children rewrites. Connector label and mindmap node
  view lookups are null-safe.
- Updated dependencies [00eab3d]
  - @labre/affine-gfx-connector@0.39.1
  - @labre/affine-model@0.39.1
  - @labre/affine-gfx-shape@0.39.1
  - @labre/affine-block-attachment@0.39.1
  - @labre/affine-block-edgeless-text@0.39.1
  - @labre/affine-block-image@0.39.1
  - @labre/affine-block-surface@0.39.1
  - @labre/affine-components@0.39.1
  - @labre/affine-gfx-pointer@0.39.1
  - @labre/affine-gfx-template@0.39.1
  - @labre/affine-gfx-text@0.39.1
  - @labre/affine-rich-text@0.39.1
  - @labre/affine-shared@0.39.1
  - @labre/affine-widget-edgeless-toolbar@0.39.1
  - @labre/affine-ext-loader@0.39.1
  - @labre/global@0.39.1
  - @labre/std@0.39.1
  - @labre/store@0.39.1

## 0.39.0

### Patch Changes

- 8f7a4f2: fix(edgeless): the Templates panel lists exactly the categories of the frameworks registered on its editor, without a reload (#244)

  A framework's category was appended to a module-level registry from
  `effect()` and never removed, so a host that re-mounted the editor with a
  framework switched off kept seeing its category until a full page reload.
  Categories are now registered in the editor's DI container
  (`TemplateCategoryExtension`, from the flag-gated view extension's `setup()`)
  and the panel reads them from the `std` of the edgeless it opens on. The
  remembered category tab falls back to the first one when it no longer exists.

  API: `extendTemplateCategory` is removed; register
  `TemplateCategoryExtension(category)` from `setup()` instead.
  `EdgelessTemplatePanel.templates.extend(manager)` (the global host hook) is
  unchanged, and `templateManagerFor(std)` exposes the per-editor catalogue.

- Updated dependencies [8f7a4f2]
  - @labre/affine-gfx-template@0.39.0
  - @labre/affine-block-attachment@0.39.0
  - @labre/affine-block-edgeless-text@0.39.0
  - @labre/affine-block-image@0.39.0
  - @labre/affine-block-surface@0.39.0
  - @labre/affine-components@0.39.0
  - @labre/affine-ext-loader@0.39.0
  - @labre/affine-gfx-connector@0.39.0
  - @labre/affine-gfx-pointer@0.39.0
  - @labre/affine-gfx-shape@0.39.0
  - @labre/affine-gfx-text@0.39.0
  - @labre/affine-model@0.39.0
  - @labre/affine-rich-text@0.39.0
  - @labre/affine-shared@0.39.0
  - @labre/affine-widget-edgeless-toolbar@0.39.0
  - @labre/global@0.39.0
  - @labre/std@0.39.0
  - @labre/store@0.39.0

## 0.38.2

### Patch Changes

- Updated dependencies [0ffa45b]
  - @labre/std@0.38.2
  - @labre/affine-block-attachment@0.38.2
  - @labre/affine-block-edgeless-text@0.38.2
  - @labre/affine-block-image@0.38.2
  - @labre/affine-block-surface@0.38.2
  - @labre/affine-components@0.38.2
  - @labre/affine-gfx-connector@0.38.2
  - @labre/affine-gfx-pointer@0.38.2
  - @labre/affine-gfx-shape@0.38.2
  - @labre/affine-gfx-template@0.38.2
  - @labre/affine-gfx-text@0.38.2
  - @labre/affine-model@0.38.2
  - @labre/affine-rich-text@0.38.2
  - @labre/affine-shared@0.38.2
  - @labre/affine-widget-edgeless-toolbar@0.38.2
  - @labre/affine-ext-loader@0.38.2
  - @labre/global@0.38.2
  - @labre/store@0.38.2

## 0.38.1

### Patch Changes

- @labre/affine-block-attachment@0.38.1
- @labre/affine-block-edgeless-text@0.38.1
- @labre/affine-block-image@0.38.1
- @labre/affine-block-surface@0.38.1
- @labre/affine-components@0.38.1
- @labre/affine-ext-loader@0.38.1
- @labre/affine-gfx-connector@0.38.1
- @labre/affine-gfx-pointer@0.38.1
- @labre/affine-gfx-shape@0.38.1
- @labre/affine-gfx-template@0.38.1
- @labre/affine-gfx-text@0.38.1
- @labre/affine-model@0.38.1
- @labre/affine-rich-text@0.38.1
- @labre/affine-shared@0.38.1
- @labre/affine-widget-edgeless-toolbar@0.38.1
- @labre/global@0.38.1
- @labre/std@0.38.1
- @labre/store@0.38.1

## 0.38.0

### Patch Changes

- Updated dependencies [28c0609]
- Updated dependencies [206b5a1]
- Updated dependencies [6a7c31a]
- Updated dependencies [90a23e1]
- Updated dependencies [b202320]
- Updated dependencies [6aa0081]
- Updated dependencies [f28a24f]
- Updated dependencies [13d17cf]
- Updated dependencies [65bfe30]
- Updated dependencies [dd22937]
- Updated dependencies [2b18c93]
  - @labre/affine-block-surface@0.38.0
  - @labre/affine-model@0.38.0
  - @labre/affine-shared@0.38.0
  - @labre/affine-gfx-template@0.38.0
  - @labre/affine-block-attachment@0.38.0
  - @labre/affine-block-edgeless-text@0.38.0
  - @labre/affine-block-image@0.38.0
  - @labre/affine-gfx-connector@0.38.0
  - @labre/affine-gfx-pointer@0.38.0
  - @labre/affine-gfx-shape@0.38.0
  - @labre/affine-gfx-text@0.38.0
  - @labre/affine-widget-edgeless-toolbar@0.38.0
  - @labre/affine-components@0.38.0
  - @labre/affine-rich-text@0.38.0
  - @labre/affine-ext-loader@0.38.0
  - @labre/global@0.38.0
  - @labre/std@0.38.0
  - @labre/store@0.38.0

## 0.37.0

### Patch Changes

- Updated dependencies [9c7947d]
  - @labre/affine-block-surface@0.37.0
  - @labre/affine-block-attachment@0.37.0
  - @labre/affine-block-edgeless-text@0.37.0
  - @labre/affine-block-image@0.37.0
  - @labre/affine-gfx-connector@0.37.0
  - @labre/affine-gfx-pointer@0.37.0
  - @labre/affine-gfx-shape@0.37.0
  - @labre/affine-gfx-template@0.37.0
  - @labre/affine-gfx-text@0.37.0
  - @labre/affine-widget-edgeless-toolbar@0.37.0
  - @labre/affine-components@0.37.0
  - @labre/affine-ext-loader@0.37.0
  - @labre/affine-model@0.37.0
  - @labre/affine-rich-text@0.37.0
  - @labre/affine-shared@0.37.0
  - @labre/global@0.37.0
  - @labre/std@0.37.0
  - @labre/store@0.37.0

## 0.36.0

### Patch Changes

- Updated dependencies [9fa662a]
- Updated dependencies [60fb357]
- Updated dependencies [3db21ea]
- Updated dependencies [7381b0b]
- Updated dependencies [f7c5b9b]
- Updated dependencies [1149791]
  - @labre/affine-components@0.36.0
  - @labre/affine-block-surface@0.36.0
  - @labre/affine-shared@0.36.0
  - @labre/std@0.36.0
  - @labre/affine-model@0.36.0
  - @labre/affine-gfx-shape@0.36.0
  - @labre/affine-block-attachment@0.36.0
  - @labre/affine-block-edgeless-text@0.36.0
  - @labre/affine-block-image@0.36.0
  - @labre/affine-gfx-connector@0.36.0
  - @labre/affine-gfx-pointer@0.36.0
  - @labre/affine-gfx-template@0.36.0
  - @labre/affine-gfx-text@0.36.0
  - @labre/affine-rich-text@0.36.0
  - @labre/affine-widget-edgeless-toolbar@0.36.0
  - @labre/affine-ext-loader@0.36.0
  - @labre/global@0.36.0
  - @labre/store@0.36.0

## 0.35.0

### Patch Changes

- Updated dependencies [ea5d249]
- Updated dependencies [e9cd7e1]
- Updated dependencies [de3560d]
- Updated dependencies [7f09608]
- Updated dependencies [ad21e60]
- Updated dependencies [cf0d8a1]
  - @labre/affine-components@0.35.0
  - @labre/affine-block-surface@0.35.0
  - @labre/affine-shared@0.35.0
  - @labre/std@0.35.0
  - @labre/affine-model@0.35.0
  - @labre/affine-gfx-connector@0.35.0
  - @labre/affine-widget-edgeless-toolbar@0.35.0
  - @labre/affine-block-attachment@0.35.0
  - @labre/affine-block-edgeless-text@0.35.0
  - @labre/affine-block-image@0.35.0
  - @labre/affine-gfx-pointer@0.35.0
  - @labre/affine-gfx-shape@0.35.0
  - @labre/affine-gfx-template@0.35.0
  - @labre/affine-gfx-text@0.35.0
  - @labre/affine-rich-text@0.35.0
  - @labre/affine-ext-loader@0.35.0
  - @labre/global@0.35.0
  - @labre/store@0.35.0

## 0.34.2

### Patch Changes

- @labre/affine-block-attachment@0.34.2
- @labre/affine-block-edgeless-text@0.34.2
- @labre/affine-block-image@0.34.2
- @labre/affine-block-surface@0.34.2
- @labre/affine-components@0.34.2
- @labre/affine-ext-loader@0.34.2
- @labre/affine-gfx-connector@0.34.2
- @labre/affine-gfx-pointer@0.34.2
- @labre/affine-gfx-shape@0.34.2
- @labre/affine-gfx-template@0.34.2
- @labre/affine-gfx-text@0.34.2
- @labre/affine-model@0.34.2
- @labre/affine-rich-text@0.34.2
- @labre/affine-shared@0.34.2
- @labre/affine-widget-edgeless-toolbar@0.34.2
- @labre/global@0.34.2
- @labre/std@0.34.2
- @labre/store@0.34.2

## 0.34.1

### Patch Changes

- Updated dependencies [6120f7a]
- Updated dependencies [cb49bb1]
  - @labre/affine-model@0.34.1
  - @labre/std@0.34.1
  - @labre/affine-block-surface@0.34.1
  - @labre/affine-block-attachment@0.34.1
  - @labre/affine-block-edgeless-text@0.34.1
  - @labre/affine-block-image@0.34.1
  - @labre/affine-components@0.34.1
  - @labre/affine-gfx-connector@0.34.1
  - @labre/affine-gfx-pointer@0.34.1
  - @labre/affine-gfx-shape@0.34.1
  - @labre/affine-gfx-template@0.34.1
  - @labre/affine-gfx-text@0.34.1
  - @labre/affine-rich-text@0.34.1
  - @labre/affine-shared@0.34.1
  - @labre/affine-widget-edgeless-toolbar@0.34.1
  - @labre/affine-ext-loader@0.34.1
  - @labre/global@0.34.1
  - @labre/store@0.34.1

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
  - @labre/affine-block-attachment@0.34.0
  - @labre/affine-block-image@0.34.0
  - @labre/affine-components@0.34.0
  - @labre/affine-widget-edgeless-toolbar@0.34.0
  - @labre/affine-block-edgeless-text@0.34.0
  - @labre/affine-gfx-connector@0.34.0
  - @labre/affine-gfx-pointer@0.34.0
  - @labre/affine-gfx-shape@0.34.0
  - @labre/affine-gfx-template@0.34.0
  - @labre/affine-gfx-text@0.34.0
  - @labre/affine-model@0.34.0
  - @labre/affine-rich-text@0.34.0
  - @labre/affine-ext-loader@0.34.0
  - @labre/global@0.34.0
  - @labre/store@0.34.0

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
- Updated dependencies [a9eb4f6]
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
  - @labre/affine-widget-edgeless-toolbar@0.33.0
  - @labre/affine-block-attachment@0.33.0
  - @labre/affine-block-edgeless-text@0.33.0
  - @labre/affine-block-image@0.33.0
  - @labre/affine-gfx-pointer@0.33.0
  - @labre/affine-gfx-shape@0.33.0
  - @labre/affine-gfx-template@0.33.0
  - @labre/affine-gfx-text@0.33.0
  - @labre/affine-rich-text@0.33.0
  - @labre/affine-ext-loader@0.33.0
  - @labre/global@0.33.0
  - @labre/store@0.33.0

## 0.32.0

### Patch Changes

- Updated dependencies [832c793]
- Updated dependencies [c5c07b9]
- Updated dependencies [a2b7c44]
- Updated dependencies [ff5f060]
- Updated dependencies [1b59f3c]
- Updated dependencies [41ab595]
- Updated dependencies [0bfc872]
- Updated dependencies [8ded589]
- Updated dependencies [9e23b5b]
- Updated dependencies [b9ed412]
- Updated dependencies [a3aa598]
- Updated dependencies [90a9168]
- Updated dependencies [aa08529]
- Updated dependencies [6417a2f]
- Updated dependencies [d797f9a]
- Updated dependencies [9fde974]
- Updated dependencies [d360f72]
- Updated dependencies [50ab9ae]
- Updated dependencies [89b90e9]
- Updated dependencies [463989f]
- Updated dependencies [f7f23b2]
- Updated dependencies [751ac44]
- Updated dependencies [54488cd]
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
- Updated dependencies [5076cb8]
- Updated dependencies [3c5c97e]
- Updated dependencies [19edf48]
- Updated dependencies [69cdc3d]
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
- Updated dependencies [48e90f4]
- Updated dependencies [0991104]
- Updated dependencies [5edd916]
- Updated dependencies [5a16359]
- Updated dependencies [025d6f5]
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
  - @labre/store@0.32.0
  - @labre/affine-components@0.32.0
  - @labre/affine-gfx-template@0.32.0
  - @labre/affine-block-edgeless-text@0.32.0
  - @labre/affine-model@0.32.0
  - @labre/affine-gfx-shape@0.32.0
  - @labre/affine-gfx-connector@0.32.0
  - @labre/affine-block-surface@0.32.0
  - @labre/affine-gfx-text@0.32.0
  - @labre/global@0.32.0
  - @labre/affine-gfx-pointer@0.32.0
  - @labre/affine-widget-edgeless-toolbar@0.32.0
  - @labre/affine-block-attachment@0.32.0
  - @labre/affine-block-image@0.32.0
  - @labre/affine-rich-text@0.32.0
  - @labre/affine-ext-loader@0.32.0

## 0.31.0

### Patch Changes

- Updated dependencies [6a663b6]
  - @labre/store@0.31.0
  - @labre/affine-block-attachment@0.31.0
  - @labre/affine-block-edgeless-text@0.31.0
  - @labre/affine-block-image@0.31.0
  - @labre/affine-block-surface@0.31.0
  - @labre/affine-components@0.31.0
  - @labre/affine-ext-loader@0.31.0
  - @labre/affine-gfx-connector@0.31.0
  - @labre/affine-gfx-pointer@0.31.0
  - @labre/affine-gfx-shape@0.31.0
  - @labre/affine-gfx-template@0.31.0
  - @labre/affine-gfx-text@0.31.0
  - @labre/affine-model@0.31.0
  - @labre/affine-rich-text@0.31.0
  - @labre/affine-shared@0.31.0
  - @labre/std@0.31.0
  - @labre/affine-widget-edgeless-toolbar@0.31.0
  - @labre/global@0.31.0

## 0.30.2

### Patch Changes

- @labre/affine-block-attachment@0.30.2
- @labre/affine-block-edgeless-text@0.30.2
- @labre/affine-block-image@0.30.2
- @labre/affine-block-surface@0.30.2
- @labre/affine-components@0.30.2
- @labre/affine-ext-loader@0.30.2
- @labre/affine-gfx-connector@0.30.2
- @labre/affine-gfx-pointer@0.30.2
- @labre/affine-gfx-shape@0.30.2
- @labre/affine-gfx-template@0.30.2
- @labre/affine-gfx-text@0.30.2
- @labre/affine-model@0.30.2
- @labre/affine-rich-text@0.30.2
- @labre/affine-shared@0.30.2
- @labre/affine-widget-edgeless-toolbar@0.30.2
- @labre/global@0.30.2
- @labre/std@0.30.2
- @labre/store@0.30.2

## 0.30.1

### Patch Changes

- @labre/affine-block-attachment@0.30.1
- @labre/affine-block-edgeless-text@0.30.1
- @labre/affine-block-image@0.30.1
- @labre/affine-block-surface@0.30.1
- @labre/affine-components@0.30.1
- @labre/affine-ext-loader@0.30.1
- @labre/affine-gfx-connector@0.30.1
- @labre/affine-gfx-pointer@0.30.1
- @labre/affine-gfx-shape@0.30.1
- @labre/affine-gfx-template@0.30.1
- @labre/affine-gfx-text@0.30.1
- @labre/affine-model@0.30.1
- @labre/affine-rich-text@0.30.1
- @labre/affine-shared@0.30.1
- @labre/affine-widget-edgeless-toolbar@0.30.1
- @labre/global@0.30.1
- @labre/std@0.30.1
- @labre/store@0.30.1

## 0.30.0

### Patch Changes

- Updated dependencies [9d0fe0c]
- Updated dependencies [ecba791]
- Updated dependencies [8de86f4]
  - @labre/std@0.30.0
  - @labre/affine-model@0.30.0
  - @labre/affine-gfx-shape@0.30.0
  - @labre/affine-block-attachment@0.30.0
  - @labre/affine-block-edgeless-text@0.30.0
  - @labre/affine-block-image@0.30.0
  - @labre/affine-block-surface@0.30.0
  - @labre/affine-components@0.30.0
  - @labre/affine-gfx-connector@0.30.0
  - @labre/affine-gfx-pointer@0.30.0
  - @labre/affine-gfx-template@0.30.0
  - @labre/affine-gfx-text@0.30.0
  - @labre/affine-rich-text@0.30.0
  - @labre/affine-shared@0.30.0
  - @labre/affine-widget-edgeless-toolbar@0.30.0
  - @labre/affine-ext-loader@0.30.0
  - @labre/global@0.30.0
  - @labre/store@0.30.0

## 0.29.1

### Patch Changes

- @labre/affine-block-attachment@0.29.1
- @labre/affine-block-edgeless-text@0.29.1
- @labre/affine-block-image@0.29.1
- @labre/affine-block-surface@0.29.1
- @labre/affine-components@0.29.1
- @labre/affine-ext-loader@0.29.1
- @labre/affine-gfx-connector@0.29.1
- @labre/affine-gfx-pointer@0.29.1
- @labre/affine-gfx-shape@0.29.1
- @labre/affine-gfx-template@0.29.1
- @labre/affine-gfx-text@0.29.1
- @labre/affine-model@0.29.1
- @labre/affine-rich-text@0.29.1
- @labre/affine-shared@0.29.1
- @labre/affine-widget-edgeless-toolbar@0.29.1
- @labre/global@0.29.1
- @labre/std@0.29.1
- @labre/store@0.29.1

## 0.29.0

### Minor Changes

- 054423b: Replace the edgeless "Others" senior toolbar button (and its submenu) with two
  standalone senior buttons placed next to pen/eraser: **Text** (insert an
  editable text element) and **Add file** (open the file picker and insert the
  image/attachment). Each is a single tap and is individually flag-gated
  (`edgeless-text`, `edgeless-media`, replacing the old `other` flag). The actions
  reuse the former submenu's `textRender` / `mediaRender`, so text/file insertion
  is unchanged.

### Patch Changes

- 3a3c99b: Render the mindmap toolbar icon at its natural size (was capped smaller than the
  neighbouring text / add-file / shape icons), so the senior tool row reads
  homogeneously.
- 43462b5: Fix the Mind Map / Others senior toolbar buttons not opening on touch devices.
  The draggable controller calls `preventDefault` on `touchstart`, which suppresses
  the synthesized click that opens the menu, so tapping the icon did nothing
  (Others) or only the non-icon edge responded (Mind Map). Wire the controller's
  `onElementClick` (a tap without drag) to the same toggle as the button click,
  and add `touch-action: manipulation` for snappier taps.
- ab409c5: Scale up the Text / Add file toolbar icons so they read at the same size as the
  neighbouring pen/shape icons (their natural SVG size was smaller).
- 40db887: Use the former "Others" submenu's drawn icons for the standalone Text / Add file
  toolbar buttons (instead of generic monochrome icons), with a playful resting
  tilt that pops upright and scales on hover — echoing the old basket animation.
- Updated dependencies [7375b9a]
- Updated dependencies [9330750]
  - @labre/affine-shared@0.29.0
  - @labre/std@0.29.0
  - @labre/affine-block-attachment@0.29.0
  - @labre/affine-block-edgeless-text@0.29.0
  - @labre/affine-block-image@0.29.0
  - @labre/affine-block-surface@0.29.0
  - @labre/affine-components@0.29.0
  - @labre/affine-gfx-connector@0.29.0
  - @labre/affine-gfx-pointer@0.29.0
  - @labre/affine-gfx-shape@0.29.0
  - @labre/affine-gfx-template@0.29.0
  - @labre/affine-gfx-text@0.29.0
  - @labre/affine-rich-text@0.29.0
  - @labre/affine-widget-edgeless-toolbar@0.29.0
  - @labre/affine-model@0.29.0
  - @labre/affine-ext-loader@0.29.0
  - @labre/global@0.29.0
  - @labre/store@0.29.0

## 0.28.0

### Patch Changes

- Updated dependencies [65cc055]
  - @labre/std@0.28.0
  - @labre/affine-block-attachment@0.28.0
  - @labre/affine-block-edgeless-text@0.28.0
  - @labre/affine-block-image@0.28.0
  - @labre/affine-block-surface@0.28.0
  - @labre/affine-components@0.28.0
  - @labre/affine-gfx-connector@0.28.0
  - @labre/affine-gfx-pointer@0.28.0
  - @labre/affine-gfx-shape@0.28.0
  - @labre/affine-gfx-template@0.28.0
  - @labre/affine-gfx-text@0.28.0
  - @labre/affine-model@0.28.0
  - @labre/affine-rich-text@0.28.0
  - @labre/affine-shared@0.28.0
  - @labre/affine-widget-edgeless-toolbar@0.28.0
  - @labre/affine-ext-loader@0.28.0
  - @labre/global@0.28.0
  - @labre/store@0.28.0

## 0.27.0

### Patch Changes

- Updated dependencies [91f6397]
  - @labre/std@0.27.0
  - @labre/affine-block-attachment@0.27.0
  - @labre/affine-block-edgeless-text@0.27.0
  - @labre/affine-block-image@0.27.0
  - @labre/affine-block-surface@0.27.0
  - @labre/affine-components@0.27.0
  - @labre/affine-gfx-connector@0.27.0
  - @labre/affine-gfx-pointer@0.27.0
  - @labre/affine-gfx-shape@0.27.0
  - @labre/affine-gfx-template@0.27.0
  - @labre/affine-gfx-text@0.27.0
  - @labre/affine-model@0.27.0
  - @labre/affine-rich-text@0.27.0
  - @labre/affine-shared@0.27.0
  - @labre/affine-widget-edgeless-toolbar@0.27.0
  - @labre/affine-ext-loader@0.27.0
  - @labre/global@0.27.0
  - @labre/store@0.27.0

## 0.26.0

### Patch Changes

- 6795191: fix(edgeless): keep mobile canvas toolbars within the viewport

  On narrow (mobile) viewports two canvas toolbars overflowed off-screen,
  hiding actions:

  - The selected-element contextual toolbar grew to `max-content` with no
    upper bound. It is now capped to the available viewport width (floating-ui
    `size` middleware) and wraps to a second row instead of overflowing. (A
    scroll container was avoided on purpose: the "More" dropdown is a descendant
    of the toolbar, so `overflow` would clip it and make it unclickable.)
  - The senior framework slide-menu was sized to `max-width: calc(100vw - 16px)`
    but right-aligned to a center-ish toolbar button, so a near-full-width menu
    hung off the LEFT edge on mobile. It is now centered on the main toolbar and
    capped to 95% of the toolbar's width (the existing slide-menu scroll handles
    any remaining overflow), via a shared `clampSeniorMenuToToolbar` helper that
    replaces the duplicated inline positioning in all six framework senior
    buttons (Wardley, BPMN, Cynefin, EDGY, Mind Map, DDD). Desktop is unaffected
    since those menus are narrower than the cap.

- Updated dependencies [8960a6c]
- Updated dependencies [6795191]
  - @labre/affine-model@0.26.0
  - @labre/affine-components@0.26.0
  - @labre/affine-block-attachment@0.26.0
  - @labre/affine-block-edgeless-text@0.26.0
  - @labre/affine-block-image@0.26.0
  - @labre/affine-block-surface@0.26.0
  - @labre/affine-gfx-connector@0.26.0
  - @labre/affine-gfx-pointer@0.26.0
  - @labre/affine-gfx-shape@0.26.0
  - @labre/affine-gfx-template@0.26.0
  - @labre/affine-gfx-text@0.26.0
  - @labre/affine-rich-text@0.26.0
  - @labre/affine-shared@0.26.0
  - @labre/affine-widget-edgeless-toolbar@0.26.0
  - @labre/affine-ext-loader@0.26.0
  - @labre/global@0.26.0
  - @labre/std@0.26.0
  - @labre/store@0.26.0

## 0.25.0

### Patch Changes

- 6795191: fix(edgeless): keep mobile canvas toolbars within the viewport

  On narrow (mobile) viewports two canvas toolbars overflowed off-screen,
  hiding actions:

  - The selected-element contextual toolbar grew to `max-content` with no
    upper bound. It is now capped to the available viewport width (floating-ui
    `size` middleware) and wraps to a second row instead of overflowing. (A
    scroll container was avoided on purpose: the "More" dropdown is a descendant
    of the toolbar, so `overflow` would clip it and make it unclickable.)
  - The senior framework slide-menu was sized to `max-width: calc(100vw - 16px)`
    but right-aligned to a center-ish toolbar button, so a near-full-width menu
    hung off the LEFT edge on mobile. It is now centered on the main toolbar and
    capped to 95% of the toolbar's width (the existing slide-menu scroll handles
    any remaining overflow), via a shared `clampSeniorMenuToToolbar` helper that
    replaces the duplicated inline positioning in all six framework senior
    buttons (Wardley, BPMN, Cynefin, EDGY, Mind Map, DDD). Desktop is unaffected
    since those menus are narrower than the cap.

- Updated dependencies [8960a6c]
- Updated dependencies [6795191]
  - @labre/affine-model@0.25.0
  - @labre/affine-components@0.25.0
  - @labre/affine-block-attachment@0.25.0
  - @labre/affine-block-edgeless-text@0.25.0
  - @labre/affine-block-image@0.25.0
  - @labre/affine-block-surface@0.25.0
  - @labre/affine-gfx-connector@0.25.0
  - @labre/affine-gfx-pointer@0.25.0
  - @labre/affine-gfx-shape@0.25.0
  - @labre/affine-gfx-template@0.25.0
  - @labre/affine-gfx-text@0.25.0
  - @labre/affine-rich-text@0.25.0
  - @labre/affine-shared@0.25.0
  - @labre/affine-widget-edgeless-toolbar@0.25.0
  - @labre/affine-ext-loader@0.25.0
  - @labre/global@0.25.0
  - @labre/std@0.25.0
  - @labre/store@0.25.0

## 0.24.0

### Minor Changes

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

- bc31490: fix(edgeless): keep senior-button sub-menus anchored to their button

  Two senior-button sub-menus positioned themselves against the whole toolbar
  instead of their own button, so they drifted once senior buttons can be hidden
  at runtime:

  - **Wardley map** right-aligned to the rightmost senior-tool slot (via a layout
    scan), which moves when buttons are toggled off.
  - **Others** (the mindmap basket) had no `position: relative` on its host, so
    the popup's clip wrapper anchored to the toolbar and left-aligned there.

  Both now right-align to their own button edge like every framework senior button
  (Cynefin, EDGY, BPMN, DDD), which stays correct whatever buttons are hidden.

- Updated dependencies [bc31490]
  - @labre/affine-gfx-template@0.24.0
  - @labre/affine-block-attachment@0.24.0
  - @labre/affine-block-edgeless-text@0.24.0
  - @labre/affine-block-image@0.24.0
  - @labre/affine-block-surface@0.24.0
  - @labre/affine-components@0.24.0
  - @labre/affine-ext-loader@0.24.0
  - @labre/affine-gfx-connector@0.24.0
  - @labre/affine-gfx-pointer@0.24.0
  - @labre/affine-gfx-shape@0.24.0
  - @labre/affine-gfx-text@0.24.0
  - @labre/affine-model@0.24.0
  - @labre/affine-rich-text@0.24.0
  - @labre/affine-shared@0.24.0
  - @labre/affine-widget-edgeless-toolbar@0.24.0
  - @labre/global@0.24.0
  - @labre/std@0.24.0
  - @labre/store@0.24.0

## 0.23.3

### Patch Changes

- Updated dependencies
  - @labre/affine-shared@0.23.3
  - @labre/affine-block-attachment@0.23.3
  - @labre/affine-block-edgeless-text@0.23.3
  - @labre/affine-block-image@0.23.3
  - @labre/affine-block-surface@0.23.3
  - @labre/affine-components@0.23.3
  - @labre/affine-gfx-connector@0.23.3
  - @labre/affine-gfx-pointer@0.23.3
  - @labre/affine-gfx-shape@0.23.3
  - @labre/affine-gfx-text@0.23.3
  - @labre/affine-rich-text@0.23.3
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
  - @labre/affine-block-edgeless-text@0.23.2
  - @labre/affine-block-image@0.23.2
  - @labre/affine-block-surface@0.23.2
  - @labre/affine-components@0.23.2
  - @labre/affine-gfx-connector@0.23.2
  - @labre/affine-gfx-pointer@0.23.2
  - @labre/affine-gfx-shape@0.23.2
  - @labre/affine-gfx-text@0.23.2
  - @labre/affine-rich-text@0.23.2
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
  - @labre/affine-block-edgeless-text@0.23.1
  - @labre/affine-block-image@0.23.1
  - @labre/affine-block-surface@0.23.1
  - @labre/affine-components@0.23.1
  - @labre/affine-gfx-connector@0.23.1
  - @labre/affine-gfx-pointer@0.23.1
  - @labre/affine-gfx-shape@0.23.1
  - @labre/affine-gfx-text@0.23.1
  - @labre/affine-rich-text@0.23.1
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
  - @labre/affine-block-edgeless-text@0.23.0
  - @labre/affine-block-image@0.23.0
  - @labre/affine-components@0.23.0
  - @labre/affine-gfx-connector@0.23.0
  - @labre/affine-gfx-pointer@0.23.0
  - @labre/affine-gfx-shape@0.23.0
  - @labre/affine-gfx-text@0.23.0
  - @labre/affine-rich-text@0.23.0
  - @labre/affine-ext-loader@0.23.0
  - @labre/global@0.23.0
  - @labre/std@0.23.0
  - @labre/store@0.23.0
