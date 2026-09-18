# @labre/affine-gfx-connector

## 0.42.0

### Minor Changes

- 911d143: feat(edgeless): a connector carries two END labels beside its centre one — a multiplicity, a role name, a qualifier — each anchored beside the endpoint it belongs to and following that endpoint alone when a node moves. Four optional fields (`sourceLabel`, `sourceLabelXYWH`, `targetLabel`, `targetLabelXYWH`) are absent by default, so a connector that has none serialises exactly as before and an older build opens the document unchanged. Double-click near an endpoint to open that end's label; the connector toolbar gains "Source label" and "Target label". Canvas and DOM renderers paint the three boxes and clip the stroke around each. See `docs/adr/0020-connector-end-labels.md`.
- 911d143: feat(edgeless): connectors gain two hollow endpoint heads, `TriangleHollow` and `DiamondHollow` — the UML 2.5.1 heads for generalization and realization (hollow closed triangle) and shared aggregation (hollow diamond). Both appear in the start- and end-point menus of the connector toolbar, and both render on the canvas and in the DOM renderer. The outline keeps the connector's stroke colour while the interior is the shared notation card fill, so a hollow head reads as white against the box it points at in every theme. `PointStyle` is persisted on every connector: the two members are appended, no existing value changes, and a build that predates them simply paints no head at that end rather than failing to load the document. See `docs/adr/0016-hollow-endpoint-styles.md`.

### Patch Changes

- 2e179bb: Colour pickers on the canvas page through the palettes of the active frameworks: the editor palette is always the first page, and the picker opens on the palette of the framework the selected element belongs to — its own role, else the ends of a connector, else the smallest framework board it sits on. A connector between two Wardley components, a label beside them or a frame drawn round the map can now be tinted with the framework's own hues instead of a hex typed from memory. Offering a palette is tooling: a framework switched off simply loses its page, and every colour already stored stays exactly as it was drawn.
- 911d143: fix(edgeless): uml compartments, empty tiers and connector end labels

  Four things the PO's manual recette of the UML framework found:

  - **A classifier now grows to the height it is actually PAINTED at.** A tier
    wraps its words at the compartment's width, and the box was sized from the
    author's newlines alone — so one long attribute line was drawn through the
    separator under it and the node never grew for it. The line count is now the
    renderer's own wrap.
  - **A compartment emptied to its placeholder stays.** A canvas text with no
    words was deleted on commit, which took a classifier's whole name compartment
    out of its group and left the next double-click opening the shape's invisible
    inner text. A text that carries a framework ROLE **and a fixed width** is a
    compartment tier and survives being emptied; a roled label sized to its own
    words — a Wardley component's name, a BPMN task's — still goes.
  - **Morphing a classifier re-lays its compartments.** `«interface»` is a LINE
    (§9.5.4), so a class called `Ligne` becomes a two-line heading — and nothing
    re-fitted the box for it. The keyword is also written once now, never stacked
    on one that is already there.
  - **A double-click aimed at an arrowhead opens that end's label.** The 24-unit
    grab of `docs/adr/0018` was unreachable: a connector answered for its line
    only, so the gesture reached no view and the editor's add-text-here handler
    dropped a stray text block at the arrowhead instead. Only a connector a
    framework typed claims the discs — a plain arrow keeps its hairline — and each
    disc stops at the box of the element the end is bound to, a note or a frame as
    much as a shape.
  - **A board moved over a peer board no longer hides its own content.** Clearing
    the board it overlaps raised it just above the topmost background it covered,
    which for a UML diagram frame was the subject drawn inside it.
  - **A framework's toolbox re-ranks when it is reopened.** The popover was cached
    on the way out and handed straight back on the way in, so a command that had
    just earned its seat — an import, say — only appeared after a reload.

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
- Updated dependencies [55d9f13]
  - @labre/affine-widget-edgeless-toolbar@0.42.0
  - @labre/std@0.42.0
  - @labre/affine-block-surface@0.42.0
  - @labre/affine-model@0.42.0
  - @labre/affine-shared@0.42.0
  - @labre/store@0.42.0
  - @labre/affine-gfx-text@0.42.0
  - @labre/affine-components@0.42.0
  - @labre/global@0.42.0
  - @labre/affine-rich-text@0.42.0
  - @labre/affine-ext-loader@0.42.0

## 0.41.0

### Minor Changes

- 5776733: feat(blocks): route bypassed i18n keys through the seam instead of raw literals. The DDD/EDGY/C4 auto-legends (`createAutoLegend`) now resolve every row's label and a section's own title through the role/preset key it always carried, wherever a host registers a catalogue — the Context Map "Relationships" row, the Core Domain "Sub-domains" row, the Event Storming "Stickies" row and EDGY's facet section titles (three new keys, `com.labre.edgy.legend.facet.*`) all reached this by accident before. The templates panel resolves a command-derived template's tile tooltip through the command's own `labelKey` (`resolveTemplateName`), a category's tab label through its own key (`com.labre.framework.<id>`, new `TemplateCategory.nameKey`), the "Add" hover caption through a new `com.labre.template.panel.add` key, and search now matches a translated name as well as the English one. The connector's "Reverse direction" tooltip and the edgeless embed toolbar's "Card view" / "Embed view" switcher now resolve through the same keys their page-mode counterparts already used, instead of restating the words. `UniverseTagDefs` (`TagDef` / `TagValueDef`) gains an optional `labelKey` beside `label` — backward compatible, a host pack needs no change — and the library's own Wardley-natures / Porter-competition pack uses it; every renderer of a tag label (the "Qualify" toolbar, the reading panel) resolves it. New manifest source `'tag'`. None of this changes what a catalogue-less playground shows: every fallback is the exact English text already on screen.
- 6271b11: feat(blocks): the DDD frameworks' automatic legends, the surface/root editor chrome, the generic gfx tools (brush, connector, pointer, group, link, template) and a handful of shared services now resolve their strings through the translation seam instead of a baked-in English literal.

  Every DDD auto-legend's box title ("Legend") joins the shared `com.labre.board.legend.title` wording, and each framework's section titles (Context Map's "Boundaries"/"Relationships", Core Domain's "Sub-domains"/"Team interaction modes"/"Movement", Event Storming's "Stickies"/"Flow") get their own seed key via `AutoLegendSectionSpec.titleKey`. The Context Map relationship rows drop their pre-built `"PS — Partnership"` string in favor of `labelPrefix` + the role's own translated `labelKey`, resolved at legend-build time. The Aggregate Design Canvas template tab now carries a `TemplateCategory.nameKey` instead of a literal name.

  The edgeless block toolbar (turn-into menu, alignment menu, misc actions, the "More" submenu, zoom-to-selection and mindmap Tab/Enter shortcuts), the SVG importer's eighteen best-effort remarks (one key per sentence shape, `{{name}}`/`{{unit}}`/`{{kind}}` interpolated), the brush/eraser/pen tooltips, the connector toolbar (modes, styles, add-text) and quick-tool, the pointer hand/select tooltips, the group toolbar and its "Group {{n}}" seed, the link undo button, and the templates panel's search placeholder are all translated the same way — `translateKey(std, ...WORDING)` for chrome rendered with `std` in hand, a sibling `…Wording` field for static toolbar-action configs.

  Three importers (markdown, mix-text, plain-text `toDocSnapshot`) resolve their "Untitled" seed through a new shared `resolveWording(provider, wording)` helper (`@labre/affine-shared/adapters`, also now backing `ClipboardAdapter`'s size-limit toasts), since these transformers carry a `ServiceProvider` but no `std`. The doc-display-meta service's "Untitled"/"Deleted doc" fallbacks, the PNG export's untitled-doc filename, the comment toolbar button and the generic notification's "Undo" action follow the same pattern.

  `@labre/std`'s "Block Version Mismatched" card resolves its four wordings through a `TranslationProvider` looked up by NAME (`createIdentifier('AffineTranslationService')`) rather than by importing `@labre/affine-shared` — the dependency between the two packages runs the other way — proven by a new unit test that registers a fake provider under the same name from an independently-constructed identifier.

  With no host catalogue registered, every one of these surfaces renders exactly the English text it always has.

  Left as-is, and why: `MindmapElementModel.addNode`'s "New node" default is a model default (red zone) — the Tab/Enter call sites in `blocks/root` now pass the text explicitly instead, using a seed key declared in `blocks/root`'s own table since the mindmap framework's table does not carry it yet. `bracket-pairs.ts`'s pair names and the code-block language ids are internal matching keys, never displayed. The native `showOpenFilePicker` filter descriptions (`filesys.ts`) have no reasonable seam to a host catalogue from a plain module constant. `open-doc-config.ts`'s item labels are dead code today (only `.isAllowed` is read). The `senior-tool.ts` "Pen"/"Template" names are core tools with no framework descriptor, by the same design already documented for every other core tool.

  Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>

- 47d4ac6: feat(blocks): close four i18n seams the earlier lots reported missing. A colour panel's swatch (`edgeless-color-panel`, shape/note/connector/brush pickers) now resolves its visible name and aria-label through `resolvePaletteLabel` (`@labre/affine-components/color-picker`) instead of showing `Palette.key` raw — the default theme's colours (`Red`, `LightBlue`…) translate through a shared `PALETTE_NAME_WORDINGS` table, and a framework's own swatches (Wardley's evolution-cycle colours, EDGY's facet palette) translate through their own `NamedPalette.labelWording`, with no cross-framework import. `UniverseTagDefs` (tag packs) gained an optional pack-level `labelKey` and `descriptionKey` on `TagDef` / `TagValueDef`, resolved by `translateTagLabel` / the new `translateTagDescription`; Wardley's own nature and Porter-competition tags are keyed end to end. `InterchangeNote`'s `messageKey` can now carry a whole sentence with `{{name}}` / `{{count}}` holes (`messageParams`, already wired into `reportInterchangeImport`) — the remaining 16 BPMN import remarks and refusals (the last four now throw a translatable `InterchangeImportError` instead of a plain `Error`) and the 2 remaining Wardley OWM import remarks are keyed. With no `TranslationProvider` registered every one of these reads exactly as it did before.

### Patch Changes

- b2781b5: refactor(blocks): one chrome word, one key. Where several packages declared the same English interface word under different keys (Copy-style verbs, text formats, display modes, Reload, Rename, Settings…), they now share one wording from `@labre/affine-shared/services`, and the key manifest carries 52 fewer entries. Nothing changes on screen, and no key that existed in a previous release is removed: the merged keys were all introduced by this release's translation work. The manifest spec now fails when a new interface word is declared under a second key (real homonyms such as « Light » or « Left » are allow-listed with a reason).
- Updated dependencies [a513f05]
- Updated dependencies [6cfe313]
- Updated dependencies [5776733]
- Updated dependencies [4ed9484]
- Updated dependencies [6271b11]
- Updated dependencies [924f7d6]
- Updated dependencies [5744cfd]
- Updated dependencies [feca957]
- Updated dependencies [1dac32d]
- Updated dependencies [b2781b5]
- Updated dependencies [223b280]
- Updated dependencies [47d4ac6]
  - @labre/affine-shared@0.41.0
  - @labre/affine-block-surface@0.41.0
  - @labre/std@0.41.0
  - @labre/affine-components@0.41.0
  - @labre/affine-rich-text@0.41.0
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
  - @labre/affine-components@0.40.0
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
  - @labre/affine-components@0.39.2
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
  - @labre/affine-model@0.39.1
  - @labre/affine-block-surface@0.39.1
  - @labre/affine-components@0.39.1
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

- @labre/affine-block-surface@0.39.0
- @labre/affine-components@0.39.0
- @labre/affine-ext-loader@0.39.0
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
  - @labre/affine-block-surface@0.38.2
  - @labre/affine-components@0.38.2
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

- @labre/affine-block-surface@0.38.1
- @labre/affine-components@0.38.1
- @labre/affine-ext-loader@0.38.1
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
  - @labre/affine-components@0.36.0
  - @labre/affine-block-surface@0.36.0
  - @labre/affine-shared@0.36.0
  - @labre/std@0.36.0
  - @labre/affine-model@0.36.0
  - @labre/affine-gfx-text@0.36.0
  - @labre/affine-rich-text@0.36.0
  - @labre/affine-widget-edgeless-toolbar@0.36.0
  - @labre/affine-ext-loader@0.36.0
  - @labre/global@0.36.0
  - @labre/store@0.36.0

## 0.35.0

### Minor Changes

- 7f09608: feat(edgeless): the wardley value-chain link says "needs", in the house blue

  The dependency role's English verb was "depends on"; it is now `needs` — one
  word, in the user's own vocabulary, on a chip that is laid ALONG the link and
  must not outgrow it. The i18n KEY (`com.labre.wardley.role.dependency.verb`) is
  untouched, so a host catalogue keeps binding it; the French wording comes from
  there.

  The chip that shows it is painted `#2563eb`. The colour is declared by the
  ROLE (`EdgeDirectionDef.chipColor`, optional) rather than by the reveal
  mechanism, so exactly one relation changes: every other framework's typed edge
  — BPMN's sequence flow, C4's "uses", the DDD context map's "is upstream of",
  and Wardley's own evolution arrow — keeps the affordance blue it had.

  Documents are untouched: a chip colour is runtime configuration, and no element
  gained or lost a field.

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
  - @labre/affine-widget-edgeless-toolbar@0.35.0
  - @labre/affine-gfx-text@0.35.0
  - @labre/affine-rich-text@0.35.0
  - @labre/affine-ext-loader@0.35.0
  - @labre/global@0.35.0
  - @labre/store@0.35.0

## 0.34.2

### Patch Changes

- @labre/affine-block-surface@0.34.2
- @labre/affine-components@0.34.2
- @labre/affine-ext-loader@0.34.2
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
  - @labre/affine-components@0.34.1
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
  - @labre/affine-components@0.34.0
  - @labre/affine-widget-edgeless-toolbar@0.34.0
  - @labre/affine-gfx-text@0.34.0
  - @labre/affine-model@0.34.0
  - @labre/affine-rich-text@0.34.0
  - @labre/affine-ext-loader@0.34.0
  - @labre/global@0.34.0
  - @labre/store@0.34.0

## 0.33.0

### Patch Changes

- 1dbd735: Framework flows keep their style to themselves

  Arming a typed flow tool — a BPMN sequence flow, message flow or association, a
  Wardley link or change arrow, an EDGY relation, a Context Map pattern, an Event
  Storming flow, a Core Domain movement, a C4 relationship — used to write the
  flow's look into the shared "last used connector style". The next plain
  connector then came out dressed as that flow (dash, colour, arrowheads) while
  carrying none of its meaning; BPMN 2.0 (p.40) explicitly forbids other
  connectors adopting a flow's line style.

  The framework look now rides on the tool activation itself
  (`ConnectorToolOptions.style`) and is applied to the drawn edge at creation
  only. The last-props store is never touched by a framework activation, so the
  plain connector tool keeps drawing with the user's own last style — which
  still persists exactly as before when set from the plain tool itself.

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
  - @labre/affine-widget-edgeless-toolbar@0.33.0
  - @labre/affine-gfx-text@0.33.0
  - @labre/affine-rich-text@0.33.0
  - @labre/affine-ext-loader@0.33.0
  - @labre/global@0.33.0
  - @labre/store@0.33.0

## 0.32.0

### Minor Changes

- 7a3458a: feat(edgeless): semantic roles on surface elements, opened by Wardley (PF1)

  Surface elements gain an optional semantic role — the identity validation
  rules will be written against, never the shape type. A role id is namespaced
  by its framework (`<framework>:<role>`, e.g. `wardley:component`).

  - `@labre/std`: new optional `role` field on the base element model
    (`GfxPrimitiveElementModel`), plus the declarative role vocabulary
    (`RoleDef` / `RoleDefs` / `roleIsA`). Declared on the BASE class so the key
    survives paste, duplicate and template insertion — an element re-created
    from props only reaches the Y.Map through declared field accessors.
  - `@labre/affine-gfx-wardley`: declares the 8 Wardley roles — the 7 node kinds
    plus the `wardley:dependency` edge — and stamps them at the creation sites.
    The hierarchy is declarative data: `wardley:market` and `wardley:ecosystem`
    specialise `wardley:component`, so a rule written on the parent applies to
    them. The anchor (user / need) is a role of its own.
  - `@labre/affine-gfx-connector`: the connector tool accepts an optional `role`
    so a framework toolbox can activate it for a typed edge. The plain connector
    tool is unaffected.

  Backward compatible, no schema version bump and no migration: the `affine:surface`
  version stays at 5, existing documents load unchanged and read as neutral
  (no role). Generalist artefacts (square, triangle, free text, inertia bar,
  background) stay neutral — no `role` key is written for them. An `undefined`
  field default is no longer written into the Y.Map at creation, so a newly
  created element that does not use an optional field is byte-identical to one
  authored before that field existed.

  The built-in Wardley templates (map presets and toolbox presets alike) are
  typed too, so a map started from a preset validates exactly like a hand-drawn
  one. Legend glyphs stay deliberately neutral: a legend documents the map, it is
  not part of it, and typing its glyphs would add phantom artefacts to any rule.

  Known gaps, left for the milestone that consumes roles — both need a
  framework-level "default edge role" that does not exist yet:

  - **Quick-connect** (the draw-connector arrow on the element toolbar) produces
    a neutral edge: it activates the connector tool without a role.
  - **Auto-complete** is asymmetric, which is the more misleading of the two: the
    auto-completed NODE is a serialize/re-create copy of its source, so it does
    inherit `wardley:component`, while the connector that joins them is created
    directly and stays neutral. The result is two correctly typed components with
    an untyped edge between them — a shape a dependency rule would read as "no
    dependency declared" rather than as a missing annotation.

  RELEASE ORDER CONSTRAINT — read before shipping anything that depends on roles.

  A client that does NOT declare the `role` field silently DROPS it when it
  re-creates an element (paste, duplicate, template insertion): only declared
  field accessors reach the Y.Map. The declaration must therefore always be
  deployed before roles start circulating.

  1. This release is the DECLARATION, and it is inert: nothing in the library
     reads `role`. All `@labre/*` packages are versioned in lockstep, so no
     client can get the Wardley writer without the base field — but a client
     still running an EARLIER version would strip roles from anything it pastes.
     Roll this version out everywhere first.
  2. Only then may role-writing features be enabled beyond Wardley, and only
     after that may role-READING features ship (validation rules, role-aware
     toolbars, host-side reporting — tranche 3).

### Patch Changes

- d797f9a: Pen and highlighter strokes paint in the DOM, and every canvas element stacks where its layer says

  The DOM renderer knew how to paint shapes and connectors but not brush or
  highlighter strokes, so a board rendered through it lost every pen mark. Both
  strokes now have a DOM renderer of their own, drawing the same path the canvas
  renderer draws.

  Stacking was decided twice and disagreed. Each element renderer set its own
  `z-index` while a canvas layer only ever reserved a single CSS index, however
  many elements it held — so a shape and the note stacked just above it could
  claim the same value and overlap the wrong way round. A canvas layer now
  reserves one index per element, exactly like a block layer, and the `z-index`
  is written once, by the DOM renderer, for every element it paints.

- b93b43c: fix(edgeless): guard connector path generation against absent endpoint elements

  `ConnectorPathGenerator.updatePath` no longer throws a `TypeError` when a
  connector endpoint holds `{ id }` (no position) referencing an element that
  is absent from the store — a latent state previously reachable only because
  `connectorWatcher` filters it upstream. All three modes were affected:
  Straight and Curve dereferenced `.xywh` after an unguarded `as Connectable`
  cast, and Orthogonal destructured the empty result of
  `_computeStartEndPoint` into undefined points.

  Degraded behavior: the unresolvable endpoint falls back to its stored
  position when there is one; otherwise the connector keeps its last bound —
  a deliberate change from the former `[0,0,1,1]` collapse, so the ghost stays
  where the user last saw it — and RENDERING paints an empty path instead of
  crashing. The scope is the render path only: hit-testing over the empty
  path (`includesPoint`, `getNearestPoint`) can still throw from
  `getBezierParameters`, which does not handle a zero-length path — tracked
  as follow-up work, same root cause.

- 5ac0c68: fix(edgeless): hit-testing a degraded connector (empty path) no longer throws

  Follow-up to the absent-endpoint render fix: a connector whose endpoint
  references a vanished element keeps its last bound, so it stays indexed and
  hoverable — and `getElementByPoint` calls `includesPoint` on every mouse
  move. `includesPoint` (Curve mode), `getNearestPoint`,
  `getPointByOffsetDistance` and `getOffsetDistanceByPoint` now degrade on an
  empty path (miss / element origin / bound center / midpoint) instead of
  throwing. At the source, `getBezierParameters` handles a zero-length path
  the same way it already handled a single point.

  Also: `_getConnectorEndElement` no longer casts away null, and
  `updatePath` skips the redundant `path = []` rewrite (no signal
  notification when the path is already empty).

- be100e3: fix(edgeless): the direction reveal is one sentence, laid along the link

  PO acceptance of 02/08/2026, point 5: `depends on` was hiding the chevron and
  did not say what it was about. It now reads as the whole statement, turned onto
  the line it describes:

  ```
  Kettle | depends on > Electricity
  ```

  - **The sentence, not the verb.** The label is `{consumer} {verb} {provider}`,
    the two names read from the document — an element's own text, or the text of
    the sibling in its group carrying a role of `kind: 'text'`, which is how a
    framework artefact is composed on this canvas. Read generically, by kind: no
    framework's label role is named. An unnamed end is dropped rather than
    blanked, so a bare map still reads `depends on`.
  - **Along the link.** The label centres on the middle of the drawn path by ARC
    LENGTH and is rotated to the angle of the median segment. The old placement
    took the middle VERTEX, which on a two-point path is the target endpoint —
    which is how the tooltip ended up on the tip of the link, on top of the
    chevron. When the angle would stand the text on its head the box is turned by
    180°; the sentence itself never reverses.
  - **The point IS the arrow.** The box ends in a point on the side facing the
    target, so the reveal is one mark instead of two that cover each other. On a
    box turned 180° the point moves to its other end, because that is the end
    still facing the provider. Reversing the edge (M3) turns the box over and
    moves the point with it.
  - **The canvas chevron is gone**, and with it `EdgeDirectionOverlay`: there is
    nothing left for it to draw. The reveal is DOM only now, still in model units
    (the box scales with the zoom), still on hover AND selection, still silent on
    an edge bound to nothing, and still wording the verb through the host's
    catalogue.

  Breaking for a host that reached into these: `EdgeDirectionOverlay`,
  `targetAnchorOf` and `midpointOf` are removed in favour of `labelAnchorOf`, and
  the label's test id is `edge-direction-label` (was `edge-direction-verb`).

- ff3a5f7: fix(edgeless): the direction label is the verb alone, and it stays under the toolbars

  Second PO pass on the direction reveal (recette of 02/08/2026, points 4 and 5).
  Two complaints, one about the layer and one about the length.

  **It painted over the senior menu.** The label belongs to the canvas — it is
  glued to a link, in model units, turning and scaling with the map — and the
  toolbars overhang the canvas. Its host sat at `z-index: 2`, which cleared
  `edgeless-toolbar-widget`'s `1`, and the senior menu rides on that host's
  z-index because its sub-menus are appended inside its own subtree. The host is
  at `0` now: under the bottom toolbar and under `editor-toolbar`'s
  `--affine-z-index-popover`, and still over the canvas, since
  `.widgets-container` has `contain: layout` and paints as a whole above
  `.edgeless-container`. This is the deliberate reverse of the reading panel's
  choice — that panel is what the user is reading, so the toolbars wait
  underneath it; this one is part of the drawing.

  The armed tool's hint now hangs upwards from its anchor line rather than
  downwards, so the whole box clears the toolbar strip instead of having its
  lower third clipped by the toolbar it no longer paints over.

  **The label said too much.** `Kettle depends on Electricity` is a box longer
  than most links: it overhung both ends and covered the very components it was
  naming. The label is the **verb alone** now — `depends on` — still laid along
  the link, still ending in a point aimed at the provider, and still turning that
  point over when the edge is reversed. The two names are already drawn at both
  ends of the line; what the drawing does not say is what the line MEANS.

  Reading the names out of the document (`endpointNamesOf`) had no consumer left
  and is deleted. The reading panel resolves its own names through
  `readRelations`, where a name in prose is the point rather than an overlay.

- 724ed1c: Surface elements no longer lose props the running element class does not
  declare. `SurfaceBlockModel._createElementFromProps` (paste, duplicate,
  alt-drag clone, "turn into linked doc") and `SurfaceBlockModel.updateElement`
  used to copy incoming props by assigning them onto the model instance, so only
  a key backed by an `@field()` accessor ever reached the Y.Map — any other key
  became a plain JavaScript property, readable in the running tab, invisible to
  every peer, and gone on reload. Both sites now forward unrecognised keys
  verbatim into the element's Y.Map.

  **This changes the semantics of every paste, duplicate, clone, "turn into
  linked doc" and programmatic bulk update: the behaviour becomes "preserve what
  we do not understand", which is already the Yjs contract everywhere else in
  the element plumbing** — every single-key field write, stash/pop, undo/redo
  and the surface snapshot transformer preserved unknown keys already; these two
  bulk-assign sites were the exception.

  Why it matters: in a mixed-version fleet, a client running an older version of
  the library could copy an element annotated by a newer one and silently strip
  the annotation. Boards drifted into a half-annotated state with no user action
  that looked like it deleted anything, and "turn into linked doc" — which
  deletes the source right after the copy — destroyed the data outright.

  **The protection is not retroactive.** A fleet is only safe once every client
  runs a version from this release on; a client pinned before it keeps stripping
  on every copy. The rollout ordering constraint still applies — ship a field's
  declaration before the features that write it. What changes is that the floor
  no longer has to include the field itself: any release from here on preserves
  fields it has never heard of.

  Keys are routed explicitly. A key the element class declared (`@field()`,
  `@local()`, or a plain accessor with a setter) goes through its accessor as
  before; anything else is unknown data and goes to the Y.Map. The routing
  deliberately does not use `key in element`, which also matches methods
  (`serialize`, `isLocked`), getter-only derived props (`x`, `y`, `w`, `h`,
  `group`, `elementBound`…) and internal fields — assigning to those corrupted
  the model or threw inside `store.transact`, which swallowed the error and
  dropped every remaining prop of the same bulk update.

  Values are validated before being written. `Y.Map.set` accepts values it cannot
  later encode — a cyclic object is stored happily and only `encodeStateAsUpdate`
  fails, breaking persistence and sync for good with nothing in the app noticing.
  An unknown prop is therefore admitted only if it is a Yjs type, a binary blob,
  a primitive, or plain acyclic JSON; anything else (function, class instance,
  cycle) is dropped with a warning, exactly as before this change. `undefined`
  never creates a key on the unknown branch, so spreading an absent option cannot
  mint a phantom key; declared fields still accept `undefined` to clear them.

  Practical consequences for callers: a junk key passed to `addElement` /
  `updateElement` is now persisted instead of being swallowed — a dead
  `controllers: []` prop was removed from the connector tool's `addElement` call
  for that reason. And because copies are now faithful, a stale key already
  present in an old document (that same `controllers`) is propagated to copies
  instead of being cleaned by them: removing a prop from the code no longer
  removes it from documents that already carry it.

  No schema change, no version bump, no migration: documents written before and
  after this release remain mutually loadable.

- 3639562: feat(edgeless): the direction of a typed edge is a statement, and W4 reads it

  `docs/adr/0010` in one slice. For a connector carrying an edge role, the
  persisted `source → target` pair IS the relation's orientation and part of the
  document's meaning. That was already true of the data since #71 — and it was
  invisible: the Wardley link tool draws no arrowhead, nothing said which way to
  drag, nothing showed which way it came out, and nothing could change it. A rule
  on top of that would have been a rule on top of an accident, so the three
  mechanisms that turn the by-product into a statement ship WITH the rule, never
  before it.

  - **M1 — say it.** An edge role now declares its own `direction`: the verb the
    relation is read with (`depends on`), and the sentence that tells the user
    which way to draw it. The Wardley link tool shows it under its label in the
    senior sub-menu ("Drag from the component that has the need to what it
    needs"), and the evolution arrow shows its own. Keys and framework fallbacks,
    resolved through the host's catalogue: the library still puts no words in a
    framework's mouth. `CommandDescriptor.descriptionFallback` is new, beside the
    `descriptionKey` that already crossed the manifest seam and was never
    rendered.
  - **M2 — show it.** Hovering or selecting a typed edge reveals a chevron at its
    TARGET end plus the role's verb — an `Overlay` and a widget
    (`affine-edge-direction-widget`), never the element renderer, which knows
    neither hover nor selection. At rest the map keeps its canonical arrowless
    look: on a Wardley map a permanent head already means evolution movement, and
    two meanings on one glyph make both unreadable. Nothing is revealed for an
    edge bound to nothing — a stroke that relates nothing says nothing.
  - **M3 — let them fix it.** `edge.invert-direction` swaps `source` ↔ `target`
    AND the two endpoint styles, in one undo step, from the contextual toolbar,
    the palette, Settings › Shortcuts or the agent. `curveControlPoint` is
    deliberately untouched (an absolute pass-through point at t = 0.5, symmetric
    under a `P0` ↔ `P3` exchange, so the drawn curve does not move — an
    integration spec pins it). It writes through the surface and not through
    `EdgelessCRUDIdentifier`, so an inversion never becomes the default style of
    the next connector drawn.
  - **`b.flip-direction` is hidden for a typed edge.** It swaps the arrowhead
    STYLES without touching the ends: honest on a generalist connector, a lie on
    an edge whose direction is the relation. Reverse direction takes its place.
    Gated on the ROLE vocabulary, not on a framework flag — a stored typed edge
    stays protected on a board whose framework tooling is switched off.
  - **W4, a new rule family — `relative-order-along-axis`.** Given a typed edge,
    the two elements it links are compared along one declared axis of the frame,
    in the order the edge states. Wardley ships
    `wardley.provider-above-consumer`: "a provider may not sit above its
    consumer", `warning` under strict, `audit` under sketch, with 2% of the map's
    height of slack (a ratio, never model units — two components drawn level are
    not a mistake). Its finding names THREE elements for the first time: the two
    nodes and the edge, because reversing the edge is one of the two honest ways
    out and that gesture lives on the edge. It stays silent on an edge with a
    free end, a dangling end, a pair straddling two maps, a self-loop, and any
    edge whose role is not the one it names. Cost is linear in the RELATIONS
    somebody drew — a 200-node chain is 199 findings, not 19 900 comparisons —
    and measures ~0.3 ms on the 500-element reference map.
  - **The role VOCABULARY is now registered** (`RoleVocabularyExtension`, from a
    framework's always-on render extension) and readable
    (`findRoleDef`, `isTypedEdgeRole`). The library had the "is this a typed
    edge?" predicate since PF1 and used it nowhere.
  - **Templates.** The palette's "Link" and "Evolution arrow" swatches are
    de-typed: a horizontal stroke bound to nothing is a sample of a style, and it
    must claim nothing. Both template kits now decide what a stroke MEANS with
    one flag (`evolution`) instead of two different colour tests — a style
    inconsistency until W4 read these edges, a semantic one afterwards. Kodak's
    red _solid_ links stay typed dependencies, which is what they are.
  - **Telemetry.** `EdgeDirectionInverted` (ids only, never board content): how
    often a direction has to be corrected is the measurement of whether the
    drawing gesture announces itself well enough.
  - The inversion acts on the typed edges of the selection, so a lasso holding a
    Wardley link and a plain connector reverses the first and leaves the second
    alone — rather than showing no direction entry at all. A typed edge with a
    free end offers none: there is no relation there to reverse.
  - `VERDICT_PROPS` gains `source` and `target`, so re-pointing or reversing an
    edge re-judges the board instead of waiting for an unrelated drag.

- 5edd916: A big board stays responsive: the canvas redraws only what changed

  Every element event repainted the whole surface, and every stacking canvas was
  allocated at full viewport size however little of it a layer occupied — on a
  1440x900 screen at device pixel ratio 2 that is about 20 MB of pixel buffer per
  layer, whether the layer held one shape or a hundred. Editing a large map spent
  most of its frame budget in redraws nothing on screen could tell apart.

  A stacking canvas is now sized to the bound of the elements it actually holds,
  clipped to the viewport, and canvases freed by a layer change are pooled for
  reuse instead of being thrown away. A change to one element marks only the
  layer it lives in, so a pan, a zoom or a single edit no longer forces a full
  repaint. During a drag a layer's canvas is allowed to grow but never to shrink,
  so the dragged element does not flicker at the edge of its own canvas; the full
  redraw comes once, when the drag ends.

  The DOM renderers for brush, highlighter, shape and connector now keep the
  nodes they already built and overwrite their attributes, instead of rebuilding
  the whole SVG subtree on every frame — a hundred redraws of one stroke now
  allocate two nodes in total instead of two hundred.

  Alongside: a block host re-reads its stacking order when the layers change, so
  a reorder shows immediately; sending a mindmap node backwards moves the whole
  mindmap once rather than each selected node in turn; and a connector whose path
  is momentarily empty answers its geometry questions instead of throwing.

- Updated dependencies [832c793]
- Updated dependencies [c5c07b9]
- Updated dependencies [a2b7c44]
- Updated dependencies [ff5f060]
- Updated dependencies [1b59f3c]
- Updated dependencies [41ab595]
- Updated dependencies [0bfc872]
- Updated dependencies [8ded589]
- Updated dependencies [9e23b5b]
- Updated dependencies [a3aa598]
- Updated dependencies [90a9168]
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
- Updated dependencies [5ac0c68]
- Updated dependencies [630633b]
- Updated dependencies [1fa46c1]
- Updated dependencies [0473dcb]
- Updated dependencies [5b6e9bb]
- Updated dependencies [86e7562]
- Updated dependencies [492bac6]
- Updated dependencies [72b334c]
- Updated dependencies [30580db]
- Updated dependencies [08e9b24]
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
- Updated dependencies [48e90f4]
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
  - @labre/affine-model@0.32.0
  - @labre/affine-block-surface@0.32.0
  - @labre/affine-gfx-text@0.32.0
  - @labre/global@0.32.0
  - @labre/affine-widget-edgeless-toolbar@0.32.0
  - @labre/affine-rich-text@0.32.0
  - @labre/affine-ext-loader@0.32.0

## 0.31.0

### Patch Changes

- Updated dependencies [6a663b6]
  - @labre/store@0.31.0
  - @labre/affine-block-surface@0.31.0
  - @labre/affine-components@0.31.0
  - @labre/affine-ext-loader@0.31.0
  - @labre/affine-gfx-text@0.31.0
  - @labre/affine-model@0.31.0
  - @labre/affine-rich-text@0.31.0
  - @labre/affine-shared@0.31.0
  - @labre/std@0.31.0
  - @labre/affine-widget-edgeless-toolbar@0.31.0
  - @labre/global@0.31.0

## 0.30.2

### Patch Changes

- @labre/affine-block-surface@0.30.2
- @labre/affine-components@0.30.2
- @labre/affine-ext-loader@0.30.2
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

- @labre/affine-block-surface@0.30.1
- @labre/affine-components@0.30.1
- @labre/affine-ext-loader@0.30.1
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
  - @labre/affine-block-surface@0.30.0
  - @labre/affine-components@0.30.0
  - @labre/affine-gfx-text@0.30.0
  - @labre/affine-rich-text@0.30.0
  - @labre/affine-shared@0.30.0
  - @labre/affine-widget-edgeless-toolbar@0.30.0
  - @labre/affine-ext-loader@0.30.0
  - @labre/global@0.30.0
  - @labre/store@0.30.0

## 0.29.1

### Patch Changes

- @labre/affine-block-surface@0.29.1
- @labre/affine-components@0.29.1
- @labre/affine-ext-loader@0.29.1
- @labre/affine-gfx-text@0.29.1
- @labre/affine-model@0.29.1
- @labre/affine-rich-text@0.29.1
- @labre/affine-shared@0.29.1
- @labre/affine-widget-edgeless-toolbar@0.29.1
- @labre/global@0.29.1
- @labre/std@0.29.1
- @labre/store@0.29.1

## 0.29.0

### Patch Changes

- Updated dependencies [7375b9a]
- Updated dependencies [9330750]
  - @labre/affine-shared@0.29.0
  - @labre/std@0.29.0
  - @labre/affine-block-surface@0.29.0
  - @labre/affine-components@0.29.0
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
  - @labre/affine-block-surface@0.28.0
  - @labre/affine-components@0.28.0
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
  - @labre/affine-block-surface@0.27.0
  - @labre/affine-components@0.27.0
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

- Updated dependencies [8960a6c]
- Updated dependencies [6795191]
  - @labre/affine-model@0.26.0
  - @labre/affine-components@0.26.0
  - @labre/affine-block-surface@0.26.0
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

- Updated dependencies [8960a6c]
- Updated dependencies [6795191]
  - @labre/affine-model@0.25.0
  - @labre/affine-components@0.25.0
  - @labre/affine-block-surface@0.25.0
  - @labre/affine-gfx-text@0.25.0
  - @labre/affine-rich-text@0.25.0
  - @labre/affine-shared@0.25.0
  - @labre/affine-widget-edgeless-toolbar@0.25.0
  - @labre/affine-ext-loader@0.25.0
  - @labre/global@0.25.0
  - @labre/std@0.25.0
  - @labre/store@0.25.0

## 0.24.0

### Patch Changes

- @labre/affine-block-surface@0.24.0
- @labre/affine-components@0.24.0
- @labre/affine-ext-loader@0.24.0
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
  - @labre/affine-block-surface@0.23.3
  - @labre/affine-components@0.23.3
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
  - @labre/affine-block-surface@0.23.2
  - @labre/affine-components@0.23.2
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
  - @labre/affine-block-surface@0.23.1
  - @labre/affine-components@0.23.1
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
  - @labre/affine-components@0.23.0
  - @labre/affine-gfx-text@0.23.0
  - @labre/affine-rich-text@0.23.0
  - @labre/affine-ext-loader@0.23.0
  - @labre/global@0.23.0
  - @labre/std@0.23.0
  - @labre/store@0.23.0
