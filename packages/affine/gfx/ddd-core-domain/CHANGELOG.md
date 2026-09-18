# @labre/affine-gfx-ddd-core-domain

## 0.42.0

### Minor Changes

- 3c62c32: The three DDD frameworks subscribe their legend instead of tabulating it: Context Map, Event Storming and the Core Domain Chart no longer keep a hand-written table beside their commands — each command that draws an artefact declares the row it puts in the board's legend, and the shared engine derives the box from the framework's own commands, in their order, filtered by what is actually drawn. Same rows, same labels, same sub-titles, same i18n keys.

  One visible change: the Legend button moves from the always-on contextual toolbar to each framework's flag-gated row, beside Validation. Turning the framework off now takes the button away, while every legend already drawn keeps being painted.

### Patch Changes

- 90ddf64: Framework artefacts are placed like shapes: choosing one arms a tool with a ghost under the cursor, Shift+S cycles the armed artefact, a click places it there.
- f294deb: The labels of every framework background — Core Domain Chart, Event Storming, Cynefin and Estuarine included — are renamed in place by double-click, as on the Wardley map.
- 9ecfc77: The Event Storming flow, the Core Domain movement and the Context Map relationships arm the connector again when chosen from their sub-menu; they are declared as tools and report `FrameworkToolPicked`.
- 2e179bb: Colour pickers on the canvas page through the palettes of the active frameworks: the editor palette is always the first page, and the picker opens on the palette of the framework the selected element belongs to — its own role, else the ends of a connector, else the smallest framework board it sits on. A connector between two Wardley components, a label beside them or a frame drawn round the map can now be tinted with the framework's own hues instead of a hex typed from memory. Offering a palette is tooling: a framework switched off simply loses its page, and every colour already stored stays exactly as it was drawn.
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
- Updated dependencies [8506cc4]
- Updated dependencies [9ecfc77]
- Updated dependencies [48213e7]
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
  - @labre/affine-gfx-ddd-shared@0.42.0
  - @labre/affine-model@0.42.0
  - @labre/affine-shared@0.42.0
  - @labre/store@0.42.0
  - @labre/affine-gfx-connector@0.42.0
  - @labre/affine-components@0.42.0
  - @labre/affine-gfx-shape@0.42.0
  - @labre/affine-gfx-group@0.42.0
  - @labre/global@0.42.0
  - @labre/affine-gfx-pointer@0.42.0
  - @labre/affine-ext-loader@0.42.0

## 0.41.0

### Minor Changes

- 5776733: feat(blocks): route bypassed i18n keys through the seam instead of raw literals. The DDD/EDGY/C4 auto-legends (`createAutoLegend`) now resolve every row's label and a section's own title through the role/preset key it always carried, wherever a host registers a catalogue — the Context Map "Relationships" row, the Core Domain "Sub-domains" row, the Event Storming "Stickies" row and EDGY's facet section titles (three new keys, `com.labre.edgy.legend.facet.*`) all reached this by accident before. The templates panel resolves a command-derived template's tile tooltip through the command's own `labelKey` (`resolveTemplateName`), a category's tab label through its own key (`com.labre.framework.<id>`, new `TemplateCategory.nameKey`), the "Add" hover caption through a new `com.labre.template.panel.add` key, and search now matches a translated name as well as the English one. The connector's "Reverse direction" tooltip and the edgeless embed toolbar's "Card view" / "Embed view" switcher now resolve through the same keys their page-mode counterparts already used, instead of restating the words. `UniverseTagDefs` (`TagDef` / `TagValueDef`) gains an optional `labelKey` beside `label` — backward compatible, a host pack needs no change — and the library's own Wardley-natures / Porter-competition pack uses it; every renderer of a tag label (the "Qualify" toolbar, the reading panel) resolves it. New manifest source `'tag'`. None of this changes what a catalogue-less playground shows: every fallback is the exact English text already on screen.
- 75770e1: feat(blocks): every seed the DDD frameworks, the generic diagrams and the gfx-primitive packages write into a document at creation now resolves through the translation seam (`translateKey`, ADR 0016), so a document created in a translated host starts in that language instead of English — a document created before these keys existed keeps its plain text.

  Event Storming's eight sticky captions and its hotspot; Core Domain's five sub-domain dots and three Team Topologies markers (both palettes derived from tables shared in `ddd-shared`, exported once as `dddSharedTranslationEntries` and spread into each consuming framework rather than restated); Context Map's bounded-context bubble and its cloud's "System" name; Cynefin/Estuarine's two hand-composed compositions ("Decision sorting"'s four domain stickies, "Constraint map"'s three hexagon captions); the standalone "Aggregate Design Canvas" template's header and nine section titles; the five generic ("Other") templates — SWOT's four quadrant labels, Kanban's card/column words, the Business Model Canvas's title and nine section names, Fishbone's category/effect/item words, Gantt's phase names and its `{{n}}`-parameterised week header; a frame's and a group's default title (`Frame {{n}}` / `Group {{n}}`); the "/ Mind Map" slash command's and the drag-from-basket mindmap tool's root and child captions; the four starter mindmap templates' root and three topic captions; and an imported `.mm`/`.opml` file's untitled-node fallback.

  Every hand-composed template touched (the mindmap starters, the two Cynefin/Estuarine compositions, the Aggregate Design Canvas, the five generic diagrams) gained a `localize` rebuild mirroring the derived-template mechanism already in place: without a host catalogue every one of them still inserts byte-identical English content. Non-framework packages that write seeds now have their own small `translations.ts`, listed under a new `PACKAGE_SEED_WORDINGS` table in the manifest (source `seed`, alongside the existing chrome-sourced `PACKAGE_WORDINGS`) — the same minimal extension the seed-source manifest already needed for a framework's own seeds.

  Left untouched, and why: the DDD Context Map's nine relationship patterns write no seed at all since WS2 (the palette arms the connector tool rather than dropping a labelled group — nothing to translate); the mindmap model's own "New node" default (a red zone — `packages/affine/model`) and the two callers that rely on it sit in packages outside this lot's scope; the code and shared-adapter "Plain Text"/"Untitled" fallbacks run in the paste/import pipeline's `Transformer`, whose optional `provider` is never wired to the editor's `TranslationProvider` by any existing caller.

  Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>

- 6271b11: feat(blocks): the DDD frameworks' automatic legends, the surface/root editor chrome, the generic gfx tools (brush, connector, pointer, group, link, template) and a handful of shared services now resolve their strings through the translation seam instead of a baked-in English literal.

  Every DDD auto-legend's box title ("Legend") joins the shared `com.labre.board.legend.title` wording, and each framework's section titles (Context Map's "Boundaries"/"Relationships", Core Domain's "Sub-domains"/"Team interaction modes"/"Movement", Event Storming's "Stickies"/"Flow") get their own seed key via `AutoLegendSectionSpec.titleKey`. The Context Map relationship rows drop their pre-built `"PS — Partnership"` string in favor of `labelPrefix` + the role's own translated `labelKey`, resolved at legend-build time. The Aggregate Design Canvas template tab now carries a `TemplateCategory.nameKey` instead of a literal name.

  The edgeless block toolbar (turn-into menu, alignment menu, misc actions, the "More" submenu, zoom-to-selection and mindmap Tab/Enter shortcuts), the SVG importer's eighteen best-effort remarks (one key per sentence shape, `{{name}}`/`{{unit}}`/`{{kind}}` interpolated), the brush/eraser/pen tooltips, the connector toolbar (modes, styles, add-text) and quick-tool, the pointer hand/select tooltips, the group toolbar and its "Group {{n}}" seed, the link undo button, and the templates panel's search placeholder are all translated the same way — `translateKey(std, ...WORDING)` for chrome rendered with `std` in hand, a sibling `…Wording` field for static toolbar-action configs.

  Three importers (markdown, mix-text, plain-text `toDocSnapshot`) resolve their "Untitled" seed through a new shared `resolveWording(provider, wording)` helper (`@labre/affine-shared/adapters`, also now backing `ClipboardAdapter`'s size-limit toasts), since these transformers carry a `ServiceProvider` but no `std`. The doc-display-meta service's "Untitled"/"Deleted doc" fallbacks, the PNG export's untitled-doc filename, the comment toolbar button and the generic notification's "Undo" action follow the same pattern.

  `@labre/std`'s "Block Version Mismatched" card resolves its four wordings through a `TranslationProvider` looked up by NAME (`createIdentifier('AffineTranslationService')`) rather than by importing `@labre/affine-shared` — the dependency between the two packages runs the other way — proven by a new unit test that registers a fake provider under the same name from an independently-constructed identifier.

  With no host catalogue registered, every one of these surfaces renders exactly the English text it always has.

  Left as-is, and why: `MindmapElementModel.addNode`'s "New node" default is a model default (red zone) — the Tab/Enter call sites in `blocks/root` now pass the text explicitly instead, using a seed key declared in `blocks/root`'s own table since the mindmap framework's table does not carry it yet. `bracket-pairs.ts`'s pair names and the code-block language ids are internal matching keys, never displayed. The native `showOpenFilePicker` filter descriptions (`filesys.ts`) have no reasonable seam to a host catalogue from a plain module constant. `open-doc-config.ts`'s item labels are dead code today (only `.isAllowed` is read). The `senior-tool.ts` "Pen"/"Template" names are core tools with no framework descriptor, by the same design already documented for every other core tool.

  Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>

### Patch Changes

- Updated dependencies [a513f05]
- Updated dependencies [6cfe313]
- Updated dependencies [5776733]
- Updated dependencies [75770e1]
- Updated dependencies [4ed9484]
- Updated dependencies [6271b11]
- Updated dependencies [924f7d6]
- Updated dependencies [5744cfd]
- Updated dependencies [feca957]
- Updated dependencies [1dac32d]
- Updated dependencies [b2781b5]
- Updated dependencies [223b280]
- Updated dependencies [47d4ac6]
  - @labre/affine-gfx-group@0.41.0
  - @labre/affine-shared@0.41.0
  - @labre/affine-gfx-template@0.41.0
  - @labre/affine-block-surface@0.41.0
  - @labre/affine-gfx-connector@0.41.0
  - @labre/affine-gfx-ddd-shared@0.41.0
  - @labre/std@0.41.0
  - @labre/affine-gfx-pointer@0.41.0
  - @labre/affine-widget-edgeless-toolbar@0.41.0
  - @labre/affine-model@0.41.0
  - @labre/affine-ext-loader@0.41.0
  - @labre/global@0.41.0
  - @labre/store@0.41.0

## 0.40.0

### Minor Changes

- 95ff0a5: feat(edgeless): every framework notation now shares one neutral scale, `NOTATION_NEUTRALS` (`@labre/affine-shared/consts`), taken from the Wardley map: ink, frame ink, label grey, divider, card, card border and legend border. Board strips (BPMN participant band, C4 title band) are plain white. Framework hues and stencil-prescribed neutrals (C4 `#444444`, the EDGY base-shape ink `#262626`, Cynefin/Estuarine official inks) are unchanged. Board backgrounds repaint with the scale. Colours already stored on user elements are left untouched, and only newly created elements take the new defaults.

### Patch Changes

- Updated dependencies [95ff0a5]
- Updated dependencies [95ff0a5]
  - @labre/affine-shared@0.40.0
  - @labre/affine-block-surface@0.40.0
  - @labre/affine-gfx-ddd-shared@0.40.0
  - @labre/affine-gfx-template@0.40.0
  - @labre/affine-gfx-connector@0.40.0
  - @labre/affine-gfx-group@0.40.0
  - @labre/affine-gfx-pointer@0.40.0
  - @labre/affine-widget-edgeless-toolbar@0.40.0
  - @labre/affine-ext-loader@0.40.0
  - @labre/affine-model@0.40.0
  - @labre/global@0.40.0
  - @labre/std@0.40.0
  - @labre/store@0.40.0

## 0.39.3

### Patch Changes

- Updated dependencies [4ab8a5b]
  - @labre/affine-block-surface@0.39.3
  - @labre/affine-gfx-connector@0.39.3
  - @labre/affine-gfx-ddd-shared@0.39.3
  - @labre/affine-gfx-group@0.39.3
  - @labre/affine-gfx-pointer@0.39.3
  - @labre/affine-gfx-template@0.39.3
  - @labre/affine-widget-edgeless-toolbar@0.39.3
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
  - @labre/affine-gfx-connector@0.39.2
  - @labre/affine-gfx-ddd-shared@0.39.2
  - @labre/affine-gfx-group@0.39.2
  - @labre/affine-gfx-pointer@0.39.2
  - @labre/affine-gfx-template@0.39.2
  - @labre/affine-widget-edgeless-toolbar@0.39.2
  - @labre/affine-ext-loader@0.39.2
  - @labre/affine-model@0.39.2
  - @labre/global@0.39.2
  - @labre/std@0.39.2
  - @labre/store@0.39.2

## 0.39.1

### Patch Changes

- Updated dependencies [00eab3d]
  - @labre/affine-gfx-connector@0.39.1
  - @labre/affine-model@0.39.1
  - @labre/affine-block-surface@0.39.1
  - @labre/affine-gfx-ddd-shared@0.39.1
  - @labre/affine-gfx-group@0.39.1
  - @labre/affine-gfx-pointer@0.39.1
  - @labre/affine-gfx-template@0.39.1
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
  - @labre/affine-gfx-ddd-shared@0.39.0
  - @labre/affine-block-surface@0.39.0
  - @labre/affine-ext-loader@0.39.0
  - @labre/affine-gfx-connector@0.39.0
  - @labre/affine-gfx-group@0.39.0
  - @labre/affine-gfx-pointer@0.39.0
  - @labre/affine-model@0.39.0
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
  - @labre/affine-gfx-connector@0.38.2
  - @labre/affine-gfx-ddd-shared@0.38.2
  - @labre/affine-gfx-group@0.38.2
  - @labre/affine-gfx-pointer@0.38.2
  - @labre/affine-gfx-template@0.38.2
  - @labre/affine-model@0.38.2
  - @labre/affine-shared@0.38.2
  - @labre/affine-widget-edgeless-toolbar@0.38.2
  - @labre/affine-ext-loader@0.38.2
  - @labre/global@0.38.2
  - @labre/store@0.38.2

## 0.38.1

### Patch Changes

- f0e3906: fix(edgeless): each DDD framework registers its own templates category

  The Event Storming, Core Domain Chart and Context Map template categories are
  now registered by the framework that owns them, under that framework's flag,
  like every other framework's. The aggregate bundle registers the Aggregate
  Design Canvas only: it used to import the three sibling framework bundles to
  register all four, a dependency the published bundle layout does not allow,
  and the 0.38.0 publish stopped on it.

  - @labre/affine-block-surface@0.38.1
  - @labre/affine-ext-loader@0.38.1
  - @labre/affine-gfx-connector@0.38.1
  - @labre/affine-gfx-ddd-shared@0.38.1
  - @labre/affine-gfx-group@0.38.1
  - @labre/affine-gfx-pointer@0.38.1
  - @labre/affine-gfx-template@0.38.1
  - @labre/affine-model@0.38.1
  - @labre/affine-shared@0.38.1
  - @labre/affine-widget-edgeless-toolbar@0.38.1
  - @labre/global@0.38.1
  - @labre/std@0.38.1
  - @labre/store@0.38.1

## 0.38.0

### Patch Changes

- 5bf6a03: feat(edgeless): DDD palette templates are derived from the creation commands

  The Event Storming, Core Domain Chart and Context Map sections of the Templates
  panel were hand-written surface JSON, last touched in June 2026 while the three
  toolboxes kept moving — so what the panel dropped had stopped being what the
  buttons draw. A sticky arrived as one flat rectangle instead of the shadow and
  face a post-it is made of, without the text fit that keeps the handwriting
  inside the square; not one of the thirty-one templates carried a semantic role,
  which is what the validation engine, the automatic legend and "Change type" all
  read, so an Event Storming board built from the panel was mute to all three; the
  Core Domain chart was not recognised as a chart; the sub-domain dots came
  without their name, and the markers without their letter.

  Every one of them is now DERIVED: the template is produced by running the
  command itself against a recording surface, so it cannot disagree with the
  toolbox, and each package's parity test re-runs its commands and compares. The
  Event Storming board and the Context Map board join the panel, which never had
  them.

  Ten entries are removed rather than repaired: the nine Context Map relationship
  patterns and Core Domain's "Movement over time". Those buttons stopped dropping
  a drawing some time ago — a relation and a movement are statements you draw
  between two real artefacts, and the palette was still shipping the mid-air
  version they replaced. Draw them from the sub-menu instead, where the endpoints
  attach.

  The Aggregate Design Canvas stays hand-composed (no command draws it) and its
  title bar, until now dark on dark, is legible again.

- Updated dependencies [28c0609]
- Updated dependencies [206b5a1]
- Updated dependencies [6a7c31a]
- Updated dependencies [90a23e1]
- Updated dependencies [b202320]
- Updated dependencies [6aa0081]
- Updated dependencies [f28a24f]
- Updated dependencies [5bf6a03]
- Updated dependencies [13d17cf]
- Updated dependencies [65bfe30]
- Updated dependencies [dd22937]
- Updated dependencies [2b18c93]
  - @labre/affine-block-surface@0.38.0
  - @labre/affine-model@0.38.0
  - @labre/affine-shared@0.38.0
  - @labre/affine-gfx-ddd-shared@0.38.0
  - @labre/affine-gfx-template@0.38.0
  - @labre/affine-gfx-group@0.38.0
  - @labre/affine-gfx-connector@0.38.0
  - @labre/affine-gfx-pointer@0.38.0
  - @labre/affine-widget-edgeless-toolbar@0.38.0
  - @labre/affine-ext-loader@0.38.0
  - @labre/global@0.38.0
  - @labre/std@0.38.0
  - @labre/store@0.38.0

## 0.37.0

### Minor Changes

- 9c7947d: feat(edgeless): every framework's artefacts can be read, not only Wardley's

  The reversed reading (MF3) shipped generic and was used once. The engine, the
  click on the contextual toolbar and the panel never named a framework — but
  `gfx/wardley/src/view.ts` was the only file that ever registered a
  `ReadingProfile`, and the panel is gated on one. So "Read this component"
  appeared on a Wardley component and nowhere else: an EDGY element, a BPMN task,
  a C4 container, an Estuarine constraint had no entry at all, and nothing
  failed. The product owner found it by clicking.

  **Seven profiles more, declared where they belong.** Each framework now
  declares its own `reading.ts` and registers it from its FLAG-GATED view
  extension, exactly as Wardley does (reading is tooling, `docs/adr/0009`).
  Selecting any role-carrying artefact opens the panel with its type and the
  chain it specialises, its typed relations, and the Linked / Not linked section
  with "Link to a record". Four frameworks needed more than one profile —
  BPMN has four parent-less node families and C4's four levels are deliberately
  flat — and no role was invented to spare them: an id is forever
  (`docs/adr/0007`).

  **The panel stopped speaking Wardley.** `ReadingProfile.relation` now carries
  the framework's own two words for the ends of its relation, so a sequence flow
  reads "Followed by" / "Preceded by", a context map "Downstream" / "Upstream",
  a storming board "Leads to" / "Follows". It also carries an opt-in
  `geometry: 'vertical'`, which only Wardley takes: on a value chain a consumer
  is drawn above what it needs, so a link pointing the other way contradicts the
  drawing and the value flow can be read from the bottom up. On a pool or a
  context map neither sentence is true, so the contradiction note and the value
  flow section are simply absent — as is the evolution phase for a framework
  that declares no frame. A Wardley map's panel is unchanged, word for word.

  **Reading is not validation**, and `docs/adr/0013` says so in an amendment: the
  Estuarine constraint hexagon gets a profile (type and record, no rule, no
  verdict); a free element on a Cynefin board carries no role and stays
  unreadable, which is that decision working rather than a gap.

  Two smaller corrections travel with it. The phase comparison now accepts the
  zone label the HOST's catalogue gives, so a French deployment storing
  "Produit" is no longer told for ever that its board disagrees. And the two
  relation wordings moved out of the translation manifest's chrome table into
  Wardley's own declaration, with the same keys and the same English — a host
  that already translated them translates nothing twice.

### Patch Changes

- Updated dependencies [9c7947d]
  - @labre/affine-block-surface@0.37.0
  - @labre/affine-gfx-connector@0.37.0
  - @labre/affine-gfx-ddd-shared@0.37.0
  - @labre/affine-gfx-group@0.37.0
  - @labre/affine-gfx-pointer@0.37.0
  - @labre/affine-gfx-template@0.37.0
  - @labre/affine-widget-edgeless-toolbar@0.37.0
  - @labre/affine-ext-loader@0.37.0
  - @labre/affine-model@0.37.0
  - @labre/affine-shared@0.37.0
  - @labre/global@0.37.0
  - @labre/std@0.37.0
  - @labre/store@0.37.0

## 0.36.0

### Patch Changes

- 60fb357: feat(telemetry): the block lifecycle reports canvas flavours only, and a framework's board command says so

  Two decisions the product owner took on 2026-09-03, ahead of launch, on what
  the telemetry bus should carry.

  **Canvas only.** `BlockEdited` / `BlockDeleted` / `BlockAbandoned` /
  `BlockUsageDuration` used to fire for every flavour. Per-paragraph editing
  sessions were the volume driver of the whole bus — at near-zero usage they
  already outnumbered every framework event combined — and they answer no
  question the document cannot answer later: which documents carry prose next to
  a map is a corpus query. What evaporates if not captured is behaviour on the
  canvas — hesitation, abandonment, time spent on a map — so the watcher now
  reports the surface, the cards placed on it and the media dropped there
  (`CANVAS_FLAVOURS`), and nothing else. The trade-off is explicit: the "compare
  every block with one query" promise of the lifecycle contract is given up for
  prose. Reversible in one line.

  **`role: 'board'`.** "How many boards are created per framework used" is the
  ratio that says whether the board gesture is understood at all — and it could
  not be read: Wardley names its board `background:classic`, BPMN `pool`, C4 and
  EDGY `board`, Cynefin `cynefin` / `estuarine`, core-domain `background`. A
  prefix convention would drift silently with the next framework. The board
  command now declares `telemetry.board: true`, the central reporter forwards
  it as a new `role` dimension on `FrameworkElementAdded` (absent on every other
  event — no existing value changes), and a unit test pins the board elements of
  all eight frameworks: a framework shipped without a board command fails the
  build.

- Updated dependencies [9fa662a]
- Updated dependencies [60fb357]
- Updated dependencies [3db21ea]
- Updated dependencies [7381b0b]
- Updated dependencies [f7c5b9b]
  - @labre/affine-block-surface@0.36.0
  - @labre/affine-shared@0.36.0
  - @labre/std@0.36.0
  - @labre/affine-model@0.36.0
  - @labre/affine-gfx-connector@0.36.0
  - @labre/affine-gfx-group@0.36.0
  - @labre/affine-gfx-pointer@0.36.0
  - @labre/affine-gfx-template@0.36.0
  - @labre/affine-widget-edgeless-toolbar@0.36.0
  - @labre/affine-gfx-ddd-shared@0.36.0
  - @labre/affine-ext-loader@0.36.0
  - @labre/global@0.36.0
  - @labre/store@0.36.0

## 0.35.0

### Minor Changes

- aca4653: feat(edgeless): core domain dots and markers morph inside their families

  A Core Domain sub-domain dot and a Team Topologies marker can now be told to be
  a nearby kind of themselves, from the **Change type** dropdown on their own
  contextual toolbar — the same affordance BPMN nodes and C4 components already
  carry. Realising halfway through a chart that this dot is really a platform
  sub-domain no longer costs a delete, a re-draw and a re-typed caption: the
  position on the chart, the movement arrows attached to it and the name somebody
  wrote are all kept.

  Two families, and nothing between them: the five dots
  (`bigBet`, `platform`, `outsourced`, `bcCurrent`, `bcFuture`) are mutually
  reachable, and so are the three markers (`collaboration`, `xaas`,
  `facilitating`). A dot never becomes a marker — a sub-domain is plotted ON the
  chart and a marker is an annotation ABOUT it, which is the same disjunction the
  role vocabulary draws.

  The words follow two different rules, because they are two different kinds of
  thing. The **caption** is content: it is rewritten only when it is still exactly
  the source kind's own creation prompt, so a dot called "Billing" keeps that name
  whatever it becomes. The marker's **letter** is notation — C, X and F are Team
  Topologies' own glyphs, not words anybody wrote — so it is always rewritten to
  the target's, in the same undo step as the colour.

  The kind is read back out of the artefact's `role`, so a dot drawn before the
  role vocabulary existed simply is not offered the menu: nothing is inferred from
  its colour and nothing is backfilled. The dropdown is TOOLING and lives in the
  flag-gated view extension (`docs/adr/0009`) — turning `ddd-core-domain` off
  takes the menu away and leaves every stored chart loading, painting and
  round-tripping exactly as before.

### Patch Changes

- 6e4306c: fix(edgeless): the morph dropdown draws the sticky and dot swatches

  The Event Storming and Core Domain swatch icons declared a `viewBox` and no
  size of their own: the senior sub-menu sizes icons with a container rule, so
  they rendered there and collapsed to nothing in the "Change type" dropdown —
  nine invisible stickies, five invisible dots (playground recette of the morph
  train, 02/09/2026). Every swatch now carries `width`/`height` like the other
  frameworks' icons, so it renders at 24px wherever it is drawn. The sub-menu is
  unchanged: its container rule was already forcing the same 24px.

- Updated dependencies [aca4653]
- Updated dependencies [ea5d249]
- Updated dependencies [e9cd7e1]
- Updated dependencies [de3560d]
- Updated dependencies [7f09608]
- Updated dependencies [ad21e60]
- Updated dependencies [cf0d8a1]
  - @labre/affine-gfx-ddd-shared@0.35.0
  - @labre/affine-block-surface@0.35.0
  - @labre/affine-shared@0.35.0
  - @labre/std@0.35.0
  - @labre/affine-model@0.35.0
  - @labre/affine-gfx-connector@0.35.0
  - @labre/affine-widget-edgeless-toolbar@0.35.0
  - @labre/affine-gfx-group@0.35.0
  - @labre/affine-gfx-pointer@0.35.0
  - @labre/affine-gfx-template@0.35.0
  - @labre/affine-ext-loader@0.35.0
  - @labre/global@0.35.0
  - @labre/store@0.35.0

## 0.34.2

### Patch Changes

- @labre/affine-block-surface@0.34.2
- @labre/affine-ext-loader@0.34.2
- @labre/affine-gfx-connector@0.34.2
- @labre/affine-gfx-ddd-shared@0.34.2
- @labre/affine-gfx-group@0.34.2
- @labre/affine-gfx-pointer@0.34.2
- @labre/affine-gfx-template@0.34.2
- @labre/affine-model@0.34.2
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
  - @labre/affine-gfx-connector@0.34.1
  - @labre/affine-gfx-ddd-shared@0.34.1
  - @labre/affine-gfx-group@0.34.1
  - @labre/affine-gfx-pointer@0.34.1
  - @labre/affine-gfx-template@0.34.1
  - @labre/affine-shared@0.34.1
  - @labre/affine-widget-edgeless-toolbar@0.34.1
  - @labre/affine-ext-loader@0.34.1
  - @labre/global@0.34.1
  - @labre/store@0.34.1

## 0.34.0

### Minor Changes

- 881d3f5: feat(blocks): every framework bundle publishes a data-only ./commands-manifest subpath, and bundle .d.ts stop leaking \_pkgs internals

  ## `./commands-manifest` (#181)

  A host settings pane that lists the framework commands — id, label, chord,
  scope, owner — had one published route to them: the bundle's MAIN entry. A
  `CommandDescriptor` carries its `run`, so that entry pulls the framework's whole
  action graph behind it: the import/export machinery (Wardley's `import.js` alone
  is 47 KB), the surface, gfx, model and shared deep paths of core. Nothing can be
  tree-shaken away, because every descriptor genuinely references its handler. The
  pane's chunk was carrying eight action graphs to draw about a hundred static
  rows.

  Each framework bundle now also publishes `./commands-manifest`, modelled on the
  existing `./descriptor`: the same commands projected to the six fields a
  shortcuts panel needs — `id`, `owner`, `labelKey`, `labelFallback`, `scope`,
  `defaultKeys` — with no `run`, no `params`, and type-only imports, so the module
  references nothing at all. It is a few hundred bytes per framework instead of
  megabytes.

  The projection is `toShortcutManifestEntry`, new in `@labre/std` beside the two
  projections that were already there. `scripts/build-bundles.mjs` refuses to
  build a framework whose manifest module reaches for a runtime import, and a unit
  test pins every manifest row-for-row against the commands it projects, so the
  second copy cannot drift from the first.

  ## `labelFallback` survives the projection (#181)

  `getShortcutManifest`'s row type kept `labelKey` but dropped `labelFallback`,
  which left a host with no translation catalogue rendering raw i18n keys — and
  forced every host to re-project from the main entry to recover a wording the
  library already knew. `ShortcutManifestEntry` now carries it, and it is declared
  once, in `@labre/std`, so core's rows and a framework bundle's rows are the same
  type: a host concatenates them. `owner` also narrows from `string` to
  `CommandOwner`, and the never-populated `when?: string` is gone.

  ## `_pkgs/*` in the emitted declarations (#60)

  The published `.d.ts` named internal core subpaths — `_pkgs/global/utils`,
  `_pkgs/global/di`, `_pkgs/affine-widget-edgeless-toolbar` — that core's
  `exports` map did not carry. tsc synthesises them when emitting a dependent
  bundle's declarations, by reverse-mapping the tsconfig `paths` entry onto the
  file a type physically lives in. Only `skipLibCheck: true` hid it; a consumer
  that type-checks the bundle declarations got unresolved-module errors.

  `scripts/compile-bundles.mjs` now scans the finished emit for those references
  and publishes exactly the subpaths it finds, then re-checks every reference
  against the map it wrote. Rewriting the specifiers to a public shim was the
  alternative and was not taken: a rewrite only has a target when a public shim
  happens to re-export that exact module, and nothing guarantees one exists for
  every internal declaration tsc may name. Publishing the subpath always has a
  target, and deriving the list from the emit keeps the exposure to what the
  declarations genuinely need.

### Patch Changes

- 8b00f7d: fix(blocks): core toasts, board tooltips, catalogue headers and seed texts cross the translation seam

  A host that wires `TranslationExtension` now gets a catalogue that covers the
  editor, instead of one that covers everything except the parts a user actually
  reads first. Six families of hard-coded English are gone (refs #182, #183);
  every one of them is a `com.labre.*` key with the previous literal as its
  English fallback, so an editor with no `TranslationProvider` registered reads
  exactly what it read before.

  - **Toasts** — "Copied to clipboard", "Linked doc created", "Note removed from
    Page Mode", "Frame inserted into Page.", "No link found".
  - **Board toolbars** — the resize toggle every framework board carries, and the
    two legend wordings, declared once in `@labre/affine-shared` rather than
    eight times.
  - **Editor chrome** — the toolbar verbs (Copy, Duplicate, Delete, Lock, Link,
    More, Bring to Front, Send to Back, Create linked doc, Draw connector), the
    view switcher (Switch / Inline / Card / Embed view) and the linked-doc card's
    four "nothing to show" sentences. `ToolbarAction` gained `labelWording` /
    `tooltipWording`: a declared `[key, English]` pair the toolbar resolves when
    it builds the row, which keeps a call site one line and keeps the row's width
    planning honest about what it is about to say.
  - **Catalogue headers** — every framework now contributes its own
    `com.labre.catalogue.category.*` keys. Core's registry names no framework
    category once `build:bundles` has stripped it, so a bundled host was drawing
    translated entries under English headers.
  - **BPMN import remarks** — the three whose wording is a fixed sentence carry a
    key (`InterchangeNote.messageKey`). The ones that name an element, an id or a
    count of lanes do not: the seam has no interpolation.
  - **Seed texts** — the caption a placed BPMN or EDGY artefact is given, and a
    C4 board's name, are resolved AT PLACEMENT. What lands in the document is
    content the author owns from that moment on and is never re-translated.

  `getTranslationKeyManifest()` gains all of it, including a new `'seed'` source
  for the words a framework writes onto the canvas.

  Three surfaces are deliberately left English, and each one is a refusal rather
  than an oversight. The **C4 component tier seeds** (`NODE_LABEL`,
  `C4_TYPE_PLACEHOLDER`, `DESCRIPTION_PLACEHOLDER`) are read back as SENTINELS by
  the morph and by the mermaid exporter, which is a pure function of the board
  and has no `std` to re-resolve them with — translating them would change what
  an export writes. The **code block's "⋮"** is a `MenuItemGroup` rendered over a
  generic context that carries no `std`. The **slash menu** and the **mobile
  keyboard toolbar** item names are their own vocabularies, untouched apart from
  the toasts they raise.

- Updated dependencies [881d3f5]
- Updated dependencies [6c1bdfb]
- Updated dependencies [8b00f7d]
- Updated dependencies [5f76ab3]
- Updated dependencies [f09d68c]
  - @labre/std@0.34.0
  - @labre/affine-shared@0.34.0
  - @labre/affine-block-surface@0.34.0
  - @labre/affine-widget-edgeless-toolbar@0.34.0
  - @labre/affine-gfx-connector@0.34.0
  - @labre/affine-gfx-ddd-shared@0.34.0
  - @labre/affine-gfx-group@0.34.0
  - @labre/affine-gfx-pointer@0.34.0
  - @labre/affine-gfx-template@0.34.0
  - @labre/affine-model@0.34.0
  - @labre/affine-ext-loader@0.34.0
  - @labre/global@0.34.0
  - @labre/store@0.34.0

## 0.33.0

### Minor Changes

- 7136db0: A Core Domain Chart is checked, and its movements are drawn as statements

  Selecting a chart now offers Validation — Sketch (the default, where every
  finding is silent and reaches a report rather than the canvas) or Strict — and
  Work quality, three expectations to tick: the chart has a legend, movements are
  dated and justified, the core has been agreed by the team.

  Four checks ship with it. An outsourced sub-domain plotted in the Core quadrant
  is a strategy contradiction and says so; a movement that does not run from a
  current position to a future one — drawn backwards, or looping onto its own
  start — is reported with both ends named; two sub-domains drawn on top of each
  other are flagged as unreadable; and a dot recoloured off the five legend
  colours is recorded as an audit finding, never as a badge. Everything else stays
  silent: a free connector, a movement onto a big bet or onto a plain shape, a dot
  on blank canvas, and any artefact drawn before today, which carries no semantic
  role and is never judged. No document is migrated and no chart is backfilled.

  "Movement over time" is now a drag rather than an arrow dropped on the canvas:
  picking it arms the connector tool, pre-styled dashed red, and you draw from
  where the context stands today to where it is heading — which is what makes the
  direction a statement the chart can read back. Arrows drawn before this change
  keep working as drawings.

  The chart's own drawing is now declared rather than coded: the same bands, the
  same axes, the same words, to the unit. The declaration also carries a second
  reading of the frame — a migration chart naming its four quadrants low-hanging
  fruit, risk-seeking, risk-averse and last toothpaste — which no rule cites and
  which has no switch in the interface yet.

- cbd9471: feat(edgeless): the three DDD boards generate the legend of what is drawn on them

  Select a **Context Map board**, an **Event Storming board** or a **Core Domain
  Chart** and its toolbar now offers a legend button. Pressing it reads what is
  actually inside the background's perimeter and drops a legend of exactly that,
  bottom-left of the board — the same gesture a Wardley map has had for a while,
  and the same result: a real, editable, movable group of elements, not an overlay.
  A board with three sticky kinds on it gets a three-row legend; add a fourth kind
  and press the button again for a legend that mentions it.

  What each board lists:

  - **Context Map** — the bounded context, and one row per relationship pattern
    drawn, with its DDD Crew abbreviation and its own line style (dashed for
    Separate Ways and Big Ball of Mud, exactly as the board draws them);
  - **Event Storming** — one row per sticky kind stuck to the board, in its own
    colour, hotspot included, plus a Flow row once an arc has been drawn;
  - **Core Domain Chart** — one row per sub-domain kind placed, in its own colour,
    one row per Team Topologies marker used, square and letter included, plus the
    red dashed Movement over time.

  The legend reads the artefacts' **semantic roles**, not their shapes and not
  their fill colours. That is what makes it agree with the validation rules — both
  read the same field — and it is what keeps a restyled sticky in the legend and an
  orange rectangle somebody drew to think with out of it.

  One consequence on the Core Domain Chart, whose legend button already existed and
  used to scan fill colours: a chart the tool recognises nothing on — every chart
  drawn before roles existed — now yields a framed, titled legend with no rows
  instead of the whole notation; a legend lists what is drawn, not what could have
  been. The five sub-domain colours it does list are the same five the palette
  draws with, by construction, and so are the three marker colours.

  Reading by role is also what finally lets the chart list its **Team Topologies
  markers** honestly. Collaboration, X-as-a-Service and Facilitating are now
  artefacts the tool recognises rather than three coloured squares, so a chart with
  a marker on it gets a "Team interaction modes" section naming the ones actually
  used — with the same letter in the same coloured square the chart draws — and a
  chart with none is not told about modes it did not use. Being recognised costs
  them nothing else: a marker is an annotation, not a sub-domain, so the overlap
  and legend-colour checks written on sub-domains still leave it alone, including
  when it is parked right against the dot it comments on.

  Every legend box is now titled **"Legend"**. The three DDD tools shipped with a
  French title on an otherwise English notation; the boxes are elements written
  into the document, so existing ones keep whatever title they were drawn with.

  The **Context Map palette keeps its own Legend entry**, which still lays out the
  full notation, cloud included. The two gestures answer two
  different questions — "what does this notation mean" and "what did we actually
  draw here" — so that module deliberately has both. The cloud is the one artefact
  the automatic legend cannot mention: it carries no role, on purpose, because a
  relationship drawn onto one is a sketch the tool stays silent about.

  Every legend button is available with its framework's button switched off: a
  legend is elements written into the document, not tooling.

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

- 2ec39c0: validation rules carry their provenance — standard, recommendation or Labre convention — and the violation bubble says so

  A rule now declares where its authority comes from, as data rather than as prose
  buried in its message: `standard` with the page of the specification it reads,
  `recommendation` for a SHOULD or an industry linter's rule, `labre-convention`
  for a house style of this editor and nothing else. The violation bubble shows it
  as one discreet line under the finding, with the rule's own citation printed
  verbatim — so a convention can never reach an architect dressed as a norm
  violation, which is what an external review of the BPMN integration asked for.

  The field is purely descriptive: no evaluator reads it, and a rule that declares
  one raises exactly the findings it raised before.

  All twenty-two BPMN rules declare it — twelve `standard`, each with its page,
  eight `recommendation` naming a linter or the sentence the standard merely
  permits, and two conventions that say so out loud. The self-loop check left
  `bpmn.sequence-flow-endpoints` and became `bpmn.sequence-flow-self-loop`: the
  endpoints matrix is BPMN 2.0.2 p.95 and the no-self-loop habit is ours, so one
  rule could not have declared either honestly. Same wording, same severity, same
  i18n keys, one new rule id in the profiles.

  That new id is the one thing this change does not carry over: user exceptions
  are persisted per rule id, so an exception granted on a self-looping flow under
  `bpmn.sequence-flow-endpoints` no longer matches and the finding returns. No
  migration ships, because BPMN landed days ago and these packages are
  unpublished, so the set of affected documents is empty — but the same rename
  after publication would need a migration or an alias, and should not lean on
  this precedent.

  The other five frameworks' rules are annotated too — mostly `recommendation`
  naming the method, with the readability nudges declared as the Labre
  conventions they always were.

- 7ec4478: Senior button components resolve their own label through the translation seam

  The toolbar's navigation tooltips learned to translate a senior tool's
  `labelKey`, but the seven framework senior-button components still carried
  their label as a hard-coded English string. Each button now resolves the same
  `com.labre.framework.<id>` key through `translateKey`, with the previous
  English wording as fallback — so a host catalogue that already translates the
  toolbar translates the buttons too, and a standalone playground reads exactly
  as before.

- a9eb4f6: Senior buttons name themselves in the user's language

  The edgeless toolbar's senior-tool tooltips were the last piece of chrome that
  could only say "Wardley map" or "Event Storming" — a raw English string carried
  on the tool itself, invisible to the host catalogue. A senior tool can now
  declare `labelKey` alongside its `name`, and the toolbar resolves it through
  the same `TranslationProvider` seam every other library wording already uses.

  The seven frameworks declare the key their descriptor already publishes
  (`com.labre.framework.<id>`), so a host that built its catalogue from
  `getTranslationKeyManifest()` translates the buttons with no new key to add.
  `name` stays required and stays the fallback: it is what a standalone
  playground shows, and it is all the core tools (note, shape, template…) have —
  they own no framework identity, so they declare no key.

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
- Updated dependencies [cbd9471]
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
- Updated dependencies [7ec4478]
- Updated dependencies [a9eb4f6]
- Updated dependencies [e42e0c0]
- Updated dependencies [256ee0b]
- Updated dependencies [4a3b26e]
- Updated dependencies [48c3b52]
- Updated dependencies [6a20738]
- Updated dependencies [f09f9a3]
  - @labre/affine-block-surface@0.33.0
  - @labre/affine-shared@0.33.0
  - @labre/affine-model@0.33.0
  - @labre/std@0.33.0
  - @labre/affine-gfx-ddd-shared@0.33.0
  - @labre/affine-gfx-connector@0.33.0
  - @labre/affine-widget-edgeless-toolbar@0.33.0
  - @labre/affine-gfx-group@0.33.0
  - @labre/affine-gfx-pointer@0.33.0
  - @labre/affine-gfx-template@0.33.0
  - @labre/affine-ext-loader@0.33.0
  - @labre/global@0.33.0
  - @labre/store@0.33.0

## 0.32.0

### Minor Changes

- b889326: feat(blocks): every key the library will ever ask for, on one list

  A host wiring `TranslationProvider` had no way to build its catalogue except
  chasing `translateKey` call sites and `labelKey` declarations across the repo
  — and no way to know a library upgrade had added one. This slice closes the
  seam from the other side: the library now says, out loud and exhaustively,
  which keys it can ask for.

  - **`getTranslationKeyManifest()`** (`@labre/affine/translations`) — the i18n
    sibling of `getShortcutManifest` / `getCommandManifest`: every
    `com.labre.*` key with its English fallback and its source
    (`command`, `role`, `rule`, `profile`, `nudge`, `audit-criterion`,
    `reading`, `background`, `framework`, `chrome`), enumerable without an
    editor instance and flag-independent, so one catalogue serves whatever a
    host later toggles on. Data-declared keys are WALKED from the same runtime
    declarations the editor registers — a key added to a rule or a command
    appears by construction. The widget chrome literals, which live in lit
    templates, are restated once; a unit test scans the library source and
    fails when a used key is missing from the manifest, when a manifest entry
    is used by nobody, or when a restated fallback drifts from what the widget
    renders.
  - **The manifest is COMPOSED, not centralised.** Each framework package
    exports its own contribution (`wardleyTranslationEntries`,
    `edgyTranslationEntries`, …) and the core manifest assembles the chrome's
    entries with the frameworks' — the same shape the command registry already
    has, and for the same reason: `@formicoidea/labre-core` is the editor minus
    the frameworks, so a manifest that named them from the core side would be
    complete in the monorepo and 107 keys of 175 short in the distribution hosts
    actually consume. `scripts/build-bundles.mjs` strips the groups from core's
    copy exactly as it strips the command groups, and a bundled host composes
    with `mergeTranslationEntries` (`@labre/std`, new).
  - The chrome wordings that sit behind template-literal keys (violation
    severities, exemption scopes, relation sides) are now EXPORTED tables the
    manifest walks rather than wordings restated a second time — which is what
    lets the drift check reach them.
  - The translation service grew the README the seam deserved
    (`packages/affine/shared/src/services/translation-service/README.md`):
    host wiring, fallback contract, how to bootstrap a catalogue from the
    manifest, how to compose it in the bundled distribution, and why the 22
    entries with no fallback must not be seeded into `en`. The service moved
    from `translation-service.ts` to `translation-service/index.ts` to house it
    — the barrel export is unchanged, no import moves.

### Patch Changes

- Updated dependencies [832c793]
- Updated dependencies [c5c07b9]
- Updated dependencies [a2b7c44]
- Updated dependencies [ff5f060]
- Updated dependencies [1b59f3c]
- Updated dependencies [41ab595]
- Updated dependencies [0bfc872]
- Updated dependencies [9e23b5b]
- Updated dependencies [a3aa598]
- Updated dependencies [6417a2f]
- Updated dependencies [d797f9a]
- Updated dependencies [9fde974]
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
  - @labre/affine-gfx-template@0.32.0
  - @labre/affine-model@0.32.0
  - @labre/affine-block-surface@0.32.0
  - @labre/affine-gfx-group@0.32.0
  - @labre/global@0.32.0
  - @labre/affine-gfx-pointer@0.32.0
  - @labre/affine-widget-edgeless-toolbar@0.32.0
  - @labre/affine-gfx-ddd-shared@0.32.0
  - @labre/affine-ext-loader@0.32.0

## 0.31.0

### Patch Changes

- Updated dependencies [6a663b6]
  - @labre/store@0.31.0
  - @labre/affine-block-surface@0.31.0
  - @labre/affine-ext-loader@0.31.0
  - @labre/affine-gfx-ddd-shared@0.31.0
  - @labre/affine-gfx-group@0.31.0
  - @labre/affine-gfx-pointer@0.31.0
  - @labre/affine-gfx-template@0.31.0
  - @labre/affine-model@0.31.0
  - @labre/affine-shared@0.31.0
  - @labre/std@0.31.0
  - @labre/affine-widget-edgeless-toolbar@0.31.0
  - @labre/global@0.31.0

## 0.30.2

### Patch Changes

- @labre/affine-block-surface@0.30.2
- @labre/affine-ext-loader@0.30.2
- @labre/affine-gfx-ddd-shared@0.30.2
- @labre/affine-gfx-group@0.30.2
- @labre/affine-gfx-pointer@0.30.2
- @labre/affine-gfx-template@0.30.2
- @labre/affine-model@0.30.2
- @labre/affine-shared@0.30.2
- @labre/affine-widget-edgeless-toolbar@0.30.2
- @labre/global@0.30.2
- @labre/std@0.30.2
- @labre/store@0.30.2

## 0.30.1

### Patch Changes

- @labre/affine-block-surface@0.30.1
- @labre/affine-ext-loader@0.30.1
- @labre/affine-gfx-ddd-shared@0.30.1
- @labre/affine-gfx-group@0.30.1
- @labre/affine-gfx-pointer@0.30.1
- @labre/affine-gfx-template@0.30.1
- @labre/affine-model@0.30.1
- @labre/affine-shared@0.30.1
- @labre/affine-widget-edgeless-toolbar@0.30.1
- @labre/global@0.30.1
- @labre/std@0.30.1
- @labre/store@0.30.1

## 0.30.0

### Patch Changes

- Updated dependencies [9d0fe0c]
- Updated dependencies [ecba791]
- Updated dependencies [ecba791]
- Updated dependencies [8de86f4]
  - @labre/std@0.30.0
  - @labre/affine-gfx-ddd-shared@0.30.0
  - @labre/affine-model@0.30.0
  - @labre/affine-block-surface@0.30.0
  - @labre/affine-gfx-group@0.30.0
  - @labre/affine-gfx-pointer@0.30.0
  - @labre/affine-gfx-template@0.30.0
  - @labre/affine-shared@0.30.0
  - @labre/affine-widget-edgeless-toolbar@0.30.0
  - @labre/affine-ext-loader@0.30.0
  - @labre/global@0.30.0
  - @labre/store@0.30.0

## 0.29.1

### Patch Changes

- @labre/affine-block-surface@0.29.1
- @labre/affine-ext-loader@0.29.1
- @labre/affine-gfx-ddd-shared@0.29.1
- @labre/affine-gfx-group@0.29.1
- @labre/affine-gfx-pointer@0.29.1
- @labre/affine-gfx-template@0.29.1
- @labre/affine-model@0.29.1
- @labre/affine-shared@0.29.1
- @labre/affine-widget-edgeless-toolbar@0.29.1
- @labre/global@0.29.1
- @labre/std@0.29.1
- @labre/store@0.29.1

## 0.29.0

### Patch Changes

- cbdd8c6: Remove the duplicate "Notation legend" button from the Core Domain Chart senior
  toolbar submenu. The legend is now created only from the map-background
  contextual toolbar, so there is a single entry point.
- Updated dependencies [7375b9a]
- Updated dependencies [9330750]
  - @labre/affine-shared@0.29.0
  - @labre/std@0.29.0
  - @labre/affine-block-surface@0.29.0
  - @labre/affine-gfx-ddd-shared@0.29.0
  - @labre/affine-gfx-group@0.29.0
  - @labre/affine-gfx-pointer@0.29.0
  - @labre/affine-gfx-template@0.29.0
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
  - @labre/affine-gfx-ddd-shared@0.28.0
  - @labre/affine-gfx-group@0.28.0
  - @labre/affine-gfx-pointer@0.28.0
  - @labre/affine-gfx-template@0.28.0
  - @labre/affine-model@0.28.0
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
  - @labre/affine-gfx-ddd-shared@0.27.0
  - @labre/affine-gfx-group@0.27.0
  - @labre/affine-gfx-pointer@0.27.0
  - @labre/affine-gfx-template@0.27.0
  - @labre/affine-model@0.27.0
  - @labre/affine-shared@0.27.0
  - @labre/affine-widget-edgeless-toolbar@0.27.0
  - @labre/affine-ext-loader@0.27.0
  - @labre/global@0.27.0
  - @labre/store@0.27.0
