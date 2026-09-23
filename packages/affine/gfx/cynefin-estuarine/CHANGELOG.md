# @labre/affine-gfx-cynefin-estuarine

## 0.43.1

### Patch Changes

- Updated dependencies [2602909]
  - @labre/affine-widget-edgeless-toolbar@0.43.1
  - @labre/affine-shared@0.43.1
  - @labre/affine-model@0.43.1
  - @labre/affine-gfx-pointer@0.43.1
  - @labre/affine-gfx-shape@0.43.1
  - @labre/affine-gfx-template@0.43.1
  - @labre/affine-block-surface@0.43.1
  - @labre/affine-components@0.43.1
  - @labre/affine-ext-loader@0.43.1
  - @labre/global@0.43.1
  - @labre/std@0.43.1
  - @labre/store@0.43.1

## 0.43.0

### Patch Changes

- 72f7282: A Cynefin frame dragged off its proportion no longer keeps the empty bands it
  letterboxes: when the resize handle is let go, its border comes back onto the
  drawing, so the board can be selected by the edge you can see. At 1600 × 600
  that is 383 model units of nothing removed from each side. The picture itself is
  untouched — same shape, same size, same centre — and the resize and its crop are
  one undo step. A frame stretched before this change is cropped the next time it
  is resized; nothing is rewritten behind the user's back, and a readonly document
  writes nothing at all.

  The uniform fit the three hand-drawn frameworks share (Cynefin, Estuarine, EDGY
  and the DDD stencils) was copied in three packages and is now one function in
  `@labre/affine-block-surface`, so the crop reads the very function the renderer
  paints through.

- a672979: Stretching an Estuarine map no longer tears its axes apart: the arrowheads stay welded to the end of the axis they belong to, and the italic `e` / `t` letters keep the same gap from their axis, however wide or tall the map is pulled. A map at its normal proportions is unchanged, to the pixel.
- bd3f165: A new Estuarine map is born on a box that hugs its drawing instead of the loose SVG viewBox it was authored in: the board's border — the edge you grab it by — now runs about 7 units from the ink on all four sides, where it stood up to 35 away. The drawing itself keeps exactly the size it had, so the new board is simply smaller (828 × 961 → 791 × 944). An Estuarine map already in a document keeps its box and its contents, and its drawing grows to fill it — about +4.7 % wide and +1.8 % tall.
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
  - @labre/affine-gfx-pointer@0.43.0
  - @labre/affine-ext-loader@0.43.0
  - @labre/affine-model@0.43.0
  - @labre/global@0.43.0
  - @labre/std@0.43.0
  - @labre/store@0.43.0

## 0.42.0

### Patch Changes

- 90ddf64: Framework artefacts are placed like shapes: choosing one arms a tool with a ghost under the cursor, Shift+S cycles the armed artefact, a click places it there.
- f294deb: The labels of every framework background — Core Domain Chart, Event Storming, Cynefin and Estuarine included — are renamed in place by double-click, as on the Wardley map.
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
  - @labre/affine-model@0.42.0
  - @labre/affine-shared@0.42.0
  - @labre/store@0.42.0
  - @labre/affine-components@0.42.0
  - @labre/affine-gfx-shape@0.42.0
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

- c226803: feat(blocks): the five framework packages (Wardley, EDGY, Cynefin/Estuarine, BPMN, C4) resolve their remaining chrome and seeds through the translation seam instead of hard-coded English. Toolbar tooltips (Wardley's seven axis/gradient toggles, EDGY's facet-labels/hover-spotlight, Cynefin's three and Estuarine's four) carry a `…Wording`; Wardley's auto-legend (title, row descriptions, the two gradient captions, the Porter panel) and EDGY's legend section titles ("Base elements", "Relations") resolve at build time; Cynefin's canvas (headings, subheadings, the ten Probe/Sense/Respond decision lines, the seven teal annotations, the three exaptation sub-labels, the two markers and their note) and Estuarine's three curve legends resolve through the `CanvasRenderer`'s host, with the decision lines drawn as one run once a host answers rather than assuming the English bold-lead split; Cynefin's and Estuarine's Templates-panel tabs carry their own `nameKey`. BPMN's nine export warnings and four import quarantine notes are keyed (the export ones with `{{count}}`/`{{names}}` params, neutral on plural); Wardley's five fixed-wording OWM import remarks are too. C4's four type-line words and its technology placeholder now resolve through the host at both placement and every edit commit (`C4TypeLineWatcher`), and the comparisons that decide whether a type line is still the untouched prompt accept either the English literal or the host's own resolved wording — the shipped French proposal keeps these five words identical to English so a translated document still round-trips correctly through the `std`-free exporter. C4's own legend section titles ("Elements", "Frames", "Relations") are keyed too. With no `TranslationProvider` registered every surface reads byte-identical to before.
- 223b280: feat(blocks): close three shared translation seams the earlier i18n lots flagged as missing, then translate every string that was waiting on them. `Template.nameKey` gives a hand-composed template (a worked scene, an example map) a tile name of its own -- `resolveTemplateName` checks it before the `commandId`-derived path -- and every BPMN, Wardley, EDGY, Cynefin, Estuarine and mind-map hand-authored card now carries one. `AutoLegendSpec.titleKey` (already resolved by `createAutoLegend`) is now set for EDGY and C4's own "Legend" boxes, so both translate through the shared `BOARD_LEGEND_TITLE` key exactly like the three DDD boards already did. `MorphSpec.afterMorph` takes an optional 4th `std` parameter, which the morph toolbar now passes through: morphing an untouched TRANSLATED placeholder rewrites it to the target kind's own translated placeholder (`c4MorphedTypeLine`, `wardleyMorphedLabel`), where it used to fall back to English. Beyond the three seams: the note tool's overlay caption and a document's "Untitled" fallback (`inlines/reference`, the linked-doc HTML/Markdown exporters) now resolve through the shared `BLOCK_NAME_TEXT` / `DOC_UNTITLED` wordings instead of a raw literal; the "Template" senior-tool button gained a `labelKey`. Per a PO decision (2026-09-12), the linked-doc import dialog's English fallback now says "Labre" instead of the inherited "AFFiNE" in the two sentences that named it. Every addition is optional and retro-compatible: with no `TranslationProvider` registered, nothing on screen changes.

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
  - @labre/affine-shared@0.41.0
  - @labre/affine-gfx-template@0.41.0
  - @labre/affine-block-surface@0.41.0
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
  - @labre/affine-gfx-template@0.40.0
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
  - @labre/affine-model@0.39.1
  - @labre/affine-block-surface@0.39.1
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
  - @labre/affine-block-surface@0.39.0
  - @labre/affine-ext-loader@0.39.0
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

- @labre/affine-block-surface@0.38.1
- @labre/affine-ext-loader@0.38.1
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

- 495ceb9: feat(edgeless): Cynefin and Estuarine palette templates are derived from the creation commands

  The Cynefin and Estuarine templates of the senior menu's Templates panel used to
  be a hand-written copy of what the toolbox creates, and the copy had drifted:
  the hexagons carried no text-fit mode, so their text stretched them instead of
  shrinking inside them, and the estuarine background was drawn at its reference
  size while the button draws it 20% larger.

  They are now produced by running the command itself against a recording surface,
  so a hexagon or a map dropped from the palette is the same artefact as one drawn
  from the button. What each artefact IS lives in a single description the actions
  and the palette both read.

  The "Constraint map" template gets its captions back: the names were positioned
  by an offset computed for a hexagon half the current size, so since the hexagons
  were doubled every name had been drawn on top of the shape it names. The offset
  now follows the hexagon's size, and the map is laid out at the scale the toolbox
  draws it. A parity test guards both directions: every artefact command has its
  template, every derived template matches its command, and the constraint map's
  captions stay below their hexagons.

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
  - @labre/affine-gfx-pointer@0.36.0
  - @labre/affine-gfx-template@0.36.0
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
  - @labre/affine-block-surface@0.35.0
  - @labre/affine-shared@0.35.0
  - @labre/std@0.35.0
  - @labre/affine-model@0.35.0
  - @labre/affine-widget-edgeless-toolbar@0.35.0
  - @labre/affine-gfx-pointer@0.35.0
  - @labre/affine-gfx-template@0.35.0
  - @labre/affine-ext-loader@0.35.0
  - @labre/global@0.35.0
  - @labre/store@0.35.0

## 0.34.2

### Patch Changes

- @labre/affine-block-surface@0.34.2
- @labre/affine-ext-loader@0.34.2
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
  - @labre/affine-gfx-pointer@0.34.0
  - @labre/affine-gfx-template@0.34.0
  - @labre/affine-model@0.34.0
  - @labre/affine-ext-loader@0.34.0
  - @labre/global@0.34.0
  - @labre/store@0.34.0

## 0.33.0

### Minor Changes

- 2dc39cf: An Estuarine map offers a quality checklist, and its reference lines are drawn as ghosts

  The three reference curves (Liminal, Volatile, Counter-factual) are no longer
  solid: a shown curve is now a discreet dashed ghost, so the tool's suggestion
  stops looking like the answer and the line the group actually negotiates reads
  as the statement. Flipping a curve back on plays a short reveal animation —
  dashes marching along the path under a brighter stroke that fades into the
  ghost — so a line coming back at low opacity is still seen arriving. Users who
  have asked their system for reduced motion get the ghost with no animation.

  Existing maps change appearance: curves drawn solid yesterday are ghosts today.
  Nothing in the document changed, and the toggles mean exactly what they meant.

  Selecting an Estuarine map also offers Map quality: four expectations to tick —
  the counter-factual line negotiated by the group, the volatile zone delimited,
  a Monitor / Research / Request strategy above the line, and every hexagon
  typed. Estuarine ships no validation rule and, deliberately, no severity
  profile: a dial over an empty rule set would be a control that decides nothing.
  Maps and hexagons created from the toolbox or from a template now carry a
  semantic role; anything drawn before today stays neutral and unjudged. Cynefin
  contributes nothing here and is out of the validation perimeter for good.

### Patch Changes

- 753872b: An Estuarine map's axes follow the size it is given

  Stretching an Estuarine background used to leave the drawing at its authored
  proportions, centred, with short axes floating in empty margins: the map was
  fitted uniformly and letterboxed. It now follows the element in both
  directions — the time axis runs the full real width, the energy axis the full
  real height, arrowheads land at the real ends, and the three reference curves
  cover the whole plane, because a negotiated boundary belongs to the plane and
  not to a picture.

  What is NOT stretched: stroke widths, arrowhead triangles and every word
  (axis letters, curve legends) keep one isotropic scale, so a map pulled
  sideways gets no fat lines, no elongated arrowheads and no squashed type.

  A map left at its authored 690 × 801 ratio — including one simply scaled up or
  down — paints exactly what it painted before. Nothing in the document changed.

  Cynefin is untouched on purpose: its background is a figurative drawing, and
  the uniform fit is the right answer there.

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
  - @labre/affine-shared@0.33.0
  - @labre/affine-model@0.33.0
  - @labre/std@0.33.0
  - @labre/affine-widget-edgeless-toolbar@0.33.0
  - @labre/affine-gfx-pointer@0.33.0
  - @labre/affine-gfx-template@0.33.0
  - @labre/affine-ext-loader@0.33.0
  - @labre/global@0.33.0
  - @labre/store@0.33.0

## 0.32.0

### Minor Changes

- 521accb: feat(blocks): flags gate tooling only — a disabled framework stays visible in documents

  Block flags used to decide whether a block was registered at all. A document
  containing a block or framework whose flag was off degraded on load: the schema
  was missing, the block and its whole subtree silently disappeared from the
  model, and snapshot export / copy-paste broke for the entire document.

  The contract is now reversed (see `docs/adr/0009`):

  - **Content is never gated.** `getAffineSchemas` and
    `getInternalStoreExtensions` register everything unconditionally. Every
    document opens, renders, round-trips and saves identically whatever the flags
    say — no deletion, no downgrade, no schema-validation failure on load. Both
    keep their `flags` parameter (now ignored) so existing calls compile
    unchanged.
  - **Only tooling is gated.** A flag removes the framework's senior toolbar
    button, its submenus, its Templates-panel category and its keyboard
    shortcuts. Turning a framework off no longer touches what is already drawn:
    elements keep painting, stay selectable and stay editable, and an OFF → ON
    cycle requires no re-entry of anything.
  - Brush, Wardley, EDGY, BPMN and Cynefin/Estuarine now expose two view
    extensions — an always-registered `…RenderViewExtension` and a flag-gated
    `…ViewExtension` — mirroring what Mindmap and DDD Core Domain already did.

  Consequence accepted: the bundle now always carries every framework's renderer,
  so a framework can no longer ship fully "dark" behind a flag.

  **BREAKING — published framework descriptors.** The four split framework
  bundles (`@formicoidea/labre-framework-{wardley,edgy,bpmn,cynefin}`) change the
  shape of their exported descriptor:

  ```diff
    export const wardleyFramework = {
      flag: 'wardley',
      telemetry: 'wardley',
  -   viewExtension: WardleyViewExtension,
  +   extensions: [
  +     { viewExtension: WardleyRenderViewExtension },
  +     { flag: 'wardley', viewExtension: WardleyViewExtension },
  +   ],
    } as const;
  ```

  `flag` and `telemetry` are unchanged. **`viewExtension` is removed** and is
  deliberately not aliased: no single extension has the old
  `flags[flag] ? register(viewExtension) : skip` semantics any more — aliasing it
  to the gated extension would leave the renderer unregistered even with the flag
  ON, and aliasing it to a composite would drop rendering with the flag OFF.

  Host migration — register every entry in `extensions`, applying `flag` only
  where present:

  ```ts
  const exts = wardleyFramework.extensions
    .filter(e => !e.flag || flags[e.flag] !== false)
    .map(e => e.viewExtension);
  ```

  `@formicoidea/labre-framework-ddd-core-domain` already shipped this list shape;
  the three single-extension DDD bundles keep the original shape untouched.

  Known residual: block view extensions (`database`, `code`, `image`, `frame`, …)
  still bundle renderer and tooling together, so a disabled _block_ renders as
  nothing. Its data is now safe in every case and comes back untouched when the
  flag is re-enabled.

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
  - @labre/global@0.32.0
  - @labre/affine-gfx-pointer@0.32.0
  - @labre/affine-widget-edgeless-toolbar@0.32.0
  - @labre/affine-ext-loader@0.32.0

## 0.31.0

### Patch Changes

- Updated dependencies [6a663b6]
  - @labre/store@0.31.0
  - @labre/affine-block-surface@0.31.0
  - @labre/affine-ext-loader@0.31.0
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

- 09f1d82: Estuarine hexi cards: pointy-top orientation (the two-vertex symmetry
  axis is now vertical — a 90° rotation) and default size doubled to
  120×120. The hexi constants are shared between the toolbar menu and the
  templates.
  - @labre/affine-block-surface@0.30.1
  - @labre/affine-ext-loader@0.30.1
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

- ecba791: Per-framework text-fit defaults. Event Storming stickies and Context Map
  bubbles now carry their label as the shape's own text (contained /
  overflow fit) instead of a separate grouped text element — double-click
  edits in place and the box never deforms; previously created prefabs keep
  their old structure and keep working. Estuarine hexi constraints default
  to contained; BPMN nodes and the Wardley inertia bar default to overflow.
- Updated dependencies [9d0fe0c]
- Updated dependencies [ecba791]
- Updated dependencies [8de86f4]
  - @labre/std@0.30.0
  - @labre/affine-model@0.30.0
  - @labre/affine-block-surface@0.30.0
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

- Updated dependencies [7375b9a]
- Updated dependencies [9330750]
  - @labre/affine-shared@0.29.0
  - @labre/std@0.29.0
  - @labre/affine-block-surface@0.29.0
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
  - @labre/affine-gfx-pointer@0.27.0
  - @labre/affine-gfx-template@0.27.0
  - @labre/affine-model@0.27.0
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
  - @labre/affine-model@0.26.0
  - @labre/affine-block-surface@0.26.0
  - @labre/affine-gfx-pointer@0.26.0
  - @labre/affine-gfx-template@0.26.0
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
  - @labre/affine-model@0.25.0
  - @labre/affine-block-surface@0.25.0
  - @labre/affine-gfx-pointer@0.25.0
  - @labre/affine-gfx-template@0.25.0
  - @labre/affine-shared@0.25.0
  - @labre/affine-widget-edgeless-toolbar@0.25.0
  - @labre/affine-ext-loader@0.25.0
  - @labre/global@0.25.0
  - @labre/std@0.25.0
  - @labre/store@0.25.0

## 0.24.0

### Patch Changes

- Updated dependencies [bc31490]
  - @labre/affine-gfx-template@0.24.0
  - @labre/affine-block-surface@0.24.0
  - @labre/affine-ext-loader@0.24.0
  - @labre/affine-gfx-pointer@0.24.0
  - @labre/affine-model@0.24.0
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
  - @labre/affine-gfx-pointer@0.23.3
  - @labre/affine-gfx-template@0.23.3
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
  - @labre/affine-gfx-pointer@0.23.2
  - @labre/affine-gfx-template@0.23.2
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
  - @labre/affine-gfx-pointer@0.23.1
  - @labre/affine-gfx-template@0.23.1
  - @labre/affine-widget-edgeless-toolbar@0.23.1
  - @labre/affine-ext-loader@0.23.1
  - @labre/affine-model@0.23.1
  - @labre/global@0.23.1
  - @labre/std@0.23.1
  - @labre/store@0.23.1

## 0.23.0

### Minor Changes

- c775151: Update the Cynefin background to the latest Liminal Cynefin artwork: add the
  teal "iterate" liminal curve, the Probe/Sense/Respond decision text for each
  domain, the teal annotation labels (strategy by design, radical innovation,
  good/best practice, exaptation sub-labels) and the central Aporia (A) /
  Confusion (C) markers.

  The toolbar exposes independent toggles: "Show / hide titles" (domain names +
  the A/C marker glyphs and names), "Show / hide explanatory text" (subheadings,
  decisions, annotations, notes) and "Show / hide liminal line" (the teal curve).

- c775151: Update the Estuarine map background to the latest artwork (reference space
  690×801): darker magenta axes (#941253) with larger arrowheads, the Volatile
  boundary redrawn as an explicit curve (instead of a half-circle arc), refreshed
  Liminal / Counter-factual curves, and letter-spaced legends with their own
  colours (green LIMINAL, red VOLATILE, dark COUNTER FACTUAL, red italic e / t
  axis letters). The per-curve and axis-label toggles are unchanged.
- d2f435f: Turn the edgeless template panel into a per-framework catalog of worked-example
  diagrams and prefab components. Each framework package contributes its own
  category (Wardley, EDGY, Cynefin, Estuarine, BPMN) via a new
  `extendTemplateCategory` helper, and a generic "Other" category (SWOT, Kanban,
  Business Model Canvas, Fishbone, Gantt) ships from the template package. Every
  template is composed only from existing shapes — the framework's own prefab
  shapes first, general BlockSuite shapes second — so dragging a card inserts real,
  editable elements.

  The templates senior-toolbar button now renders last (new optional `order` on
  `SeniorTool`), and the playground's placeholder cat stickers are removed.

### Patch Changes

- Updated dependencies [9014c87]
- Updated dependencies [c775151]
- Updated dependencies [d2f435f]
  - @labre/affine-model@0.23.0
  - @labre/affine-block-surface@0.23.0
  - @labre/affine-shared@0.23.0
  - @labre/affine-gfx-template@0.23.0
  - @labre/affine-widget-edgeless-toolbar@0.23.0
  - @labre/affine-gfx-pointer@0.23.0
  - @labre/affine-ext-loader@0.23.0
  - @labre/global@0.23.0
  - @labre/std@0.23.0
  - @labre/store@0.23.0
