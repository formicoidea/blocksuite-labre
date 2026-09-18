# @labre/affine-gfx-ddd-shared

## 0.42.0

### Minor Changes

- 6bc897b: **Breaking for hosts importing the table-shaped legend API** — migrate imports to `@labre/affine-block-surface` (see below).

  The table-shaped legend API is removed, now that every framework subscribes its rows to the catalogue (ADR 0026). Gone from `@labre/affine-block-surface`: `AutoLegendSpec`, `AutoLegendSectionSpec`, `AutoLegendEntry`, `autoLegendSections`, `createAutoLegend` and `roleLabel`. Gone from `@labre/affine-gfx-ddd-shared`: the whole `shared/legend-auto.ts` re-export module (those six plus `rolesInBound`), the deprecated `addLegend` / `measureLegend` / `LegendLayout` / `LegendRow` / `LegendSection` re-exports in `shared/prefabs.ts`, and `dddLegendIcon`. All of them had moved to `@labre/affine-block-surface` and were kept only so the frameworks could migrate one at a time; import `createBoardLegend`, `legendFromCommands`, `rolesInBound`, `addLegend`, `measureLegend` and `legendIcon` from there. `LABEL_COLOR`, `LABEL_FONT` and `LABEL_FONT_SIZE` are now declared once, by the surface block, and re-exported by `@labre/affine-gfx-ddd-shared` under the same names. EDGY no longer depends on the DDD bundle at all.

- 911d143: fix(blocks): a framework board is never raised above a board it strictly encloses when it is moved or resized, so a UML frame (or a C4 board) holding inner regions no longer jumps to the front and hides its own content (rule R10). The UML legend draws a real pictogram per notation — class box with its separators, actor, use case ellipse, package tab, component, node cube, lifeline, the typed edges with their hollow heads — instead of a plain chip; the shared legend gains glyph and edge swatches for any framework that wants them.

### Patch Changes

- 90ddf64: Framework artefacts are placed like shapes: choosing one arms a tool with a ghost under the cursor, Shift+S cycles the armed artefact, a click places it there.
- 8506cc4: The Context Map cloud now appears in the board's automatic legend ("System / Big Ball of Mud"): it is placed with a new `context-map:system` role. Relationships drawn onto a cloud stay unjudged by validation. Clouds placed before this release carry no role and stay out of the legend until replaced.
- f6ece47: The automatic legend becomes a platform: a command can subscribe the legend row its artefact deserves (`CommandDescriptor.legend`) and a board command the box that holds them (`legendBox`), and the surface block derives the whole legend from them — rows in command order, sub-titles from each row's own section or from the command's catalogue category, one row per role. One shared toolbar button and one telemetry emitter replace the seven copies, with the wire values unchanged. Nothing visible moves yet: every framework still draws its legend from its own table, re-exported from `@labre/affine-gfx-ddd-shared` while they migrate.
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
- Updated dependencies [d1851b1]
- Updated dependencies [5a8ec30]
- Updated dependencies [549056e]
- Updated dependencies [2bb7318]
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
  - @labre/affine-gfx-template@0.42.0
  - @labre/affine-model@0.42.0
  - @labre/affine-shared@0.42.0
  - @labre/store@0.42.0
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
  - @labre/affine-gfx-group@0.41.0
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
  - @labre/affine-model@0.39.1
  - @labre/affine-block-surface@0.39.1
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

- Updated dependencies [8f7a4f2]
  - @labre/affine-gfx-template@0.39.0
  - @labre/affine-block-surface@0.39.0
  - @labre/affine-ext-loader@0.39.0
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

- @labre/affine-block-surface@0.38.1
- @labre/affine-ext-loader@0.38.1
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
- Updated dependencies [13d17cf]
- Updated dependencies [65bfe30]
- Updated dependencies [dd22937]
- Updated dependencies [2b18c93]
  - @labre/affine-block-surface@0.38.0
  - @labre/affine-model@0.38.0
  - @labre/affine-shared@0.38.0
  - @labre/affine-gfx-template@0.38.0
  - @labre/affine-gfx-group@0.38.0
  - @labre/affine-gfx-pointer@0.38.0
  - @labre/affine-widget-edgeless-toolbar@0.38.0
  - @labre/affine-ext-loader@0.38.0
  - @labre/global@0.38.0
  - @labre/std@0.38.0
  - @labre/store@0.38.0

## 0.37.0

### Patch Changes

- Updated dependencies [9c7947d]
  - @labre/affine-block-surface@0.37.0
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

- Updated dependencies [9fa662a]
- Updated dependencies [60fb357]
- Updated dependencies [3db21ea]
- Updated dependencies [7381b0b]
- Updated dependencies [f7c5b9b]
  - @labre/affine-block-surface@0.36.0
  - @labre/affine-shared@0.36.0
  - @labre/std@0.36.0
  - @labre/affine-model@0.36.0
  - @labre/affine-gfx-group@0.36.0
  - @labre/affine-gfx-pointer@0.36.0
  - @labre/affine-gfx-template@0.36.0
  - @labre/affine-widget-edgeless-toolbar@0.36.0
  - @labre/affine-ext-loader@0.36.0
  - @labre/global@0.36.0
  - @labre/store@0.36.0

## 0.35.0

### Patch Changes

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
  - @labre/affine-gfx-group@0.34.1
  - @labre/affine-gfx-pointer@0.34.1
  - @labre/affine-gfx-template@0.34.1
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
  - @labre/affine-widget-edgeless-toolbar@0.34.0
  - @labre/affine-gfx-group@0.34.0
  - @labre/affine-gfx-pointer@0.34.0
  - @labre/affine-gfx-template@0.34.0
  - @labre/affine-model@0.34.0
  - @labre/affine-ext-loader@0.34.0
  - @labre/global@0.34.0
  - @labre/store@0.34.0

## 0.33.0

### Minor Changes

- 48049d6: feat(edgeless): a context map is drawn on a board, and its relationships are typed

  A Context Map now has a **board** to be drawn on — a white card, deliberately
  without axes or zones, because nothing about where a bounded context sits on the
  sheet means anything. What the board is for is the frame: it is what tells the
  tool which artefacts belong to the map, and it is what a per-map level of
  requirement is written on. It is created 1400 × 900 from a new first entry in the
  Context Map palette and can be stretched freely in either direction.

  The nine **relationship patterns changed gesture**. They used to drop a little
  drawing in mid-air — a line between two points, an abbreviation tag, two letters
  — that looked like the notation and said nothing: the line was attached to
  nothing, so nobody, human or machine, could tell which contexts it related, and
  the user still had to drag both ends onto the bubbles by hand. Choosing a pattern
  now arms the link tool, pre-styled (dashed for Separate Ways and Big Ball of Mud,
  an arrowhead towards the downstream end for the five upstream/downstream ones),
  and the user draws the relationship between two contexts. For the patterns that
  have a direction the tool says which way to drag: from the upstream context to
  the downstream one.

  That is what makes the map **readable by the tool**, and five checks come with
  it. It says so when a relationship loops back onto its own context, when the same
  pattern is drawn twice between the same two contexts, when a context is parked
  off the board, and — the two that are really about DDD — when a couple carries
  both a Conformist and an Anticorruption Layer, or a Customer/Supplier plus a
  pattern that contradicts it. An Anticorruption Layer on a Customer/Supplier is
  reported more quietly, at every level of requirement, because it is a question
  and not a mistake: it is legitimate while a model is being retired, and only the
  team knows whether that is the case. Everything else stays silent — a
  relationship drawn onto a cloud, onto a note, onto anything the model has not
  named is somebody sketching.

  Two levels of requirement ship with it, **Sketch** (the default: findings are
  recorded, the canvas says nothing) and **Strict**, chosen per board from the
  board's toolbar, plus a four-point quality checklist the tool cannot judge for
  you: every relationship carries a discussed pattern, Separate Ways are
  documented, every downstream of a Big Ball of Mud is protected, the map has a
  legend.

  **Nothing already drawn changes.** Maps made before this release carry no roles,
  so not one of them is judged, and the old relationship drawings keep rendering
  exactly as they are — they are simply drawings now, and the tool has nothing to
  say about them. Redrawing one with the new tool is what makes it a statement.

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

- 168617d: feat(edgeless): an event storming board carries a timeline, and its flows are typed

  Event Storming now has a **board** to be stormed on — a wide white roll, 3200 ×
  1400, freely stretchable in either direction — and it carries the one thing the
  method actually has a frame of reference for: a **time axis** along the bottom,
  running left to right. Nothing else is graduated, on purpose. How high a sticky
  sits on the wall means nothing, and drawing lanes to suggest it did would invent
  a meaning the framework does not have; swimlanes are deliberately left for a
  later release rather than half-shipped. The board is created from a new first
  entry in the Event Storming palette. The axis is drawn **heavy, and labelled
  big**: the word "Time" is set large enough to be read at the zoom where a whole
  3200-wide Big Picture fits on screen, which is the zoom a Big Picture is
  actually looked at. It is the only thing the board declares, and it should not
  be the smallest thing on it.

  The palette also gains the **Aggregate**, the pale-yellow sticky a command lands
  on and the thing that raises the event. Without it the canonical sentence —
  command, aggregate, domain event — could not be drawn at all. It is created
  larger than the others, as it is on a real wall, and in a paler yellow chosen so
  that the three yellows of the notation (constraint, actor, aggregate) can be told
  apart at a glance rather than only by position.

  **Flow changed gesture.** It used to drop a little arrow in mid-air, attached to
  nothing: it looked like the notation and said nothing, and the user still had to
  drag both ends onto the stickies by hand. Choosing Flow now arms the link tool
  and says which way to drag — from what happens first to what follows — and the
  arc the user draws references the two stickies for real.

  That is what makes the wall **readable by the tool**, and three checks come with
  it. It says so when a flow runs backwards along the timeline, when an arc is not
  one of the nine sentences Event Storming says (an actor issues a command; the
  command lands on an aggregate or an external system; that raises a domain event;
  the event triggers a policy or feeds a read model), and when two stickies cover
  each other badly enough to hide a word. Everything else stays silent: an arrow
  drawn at a **hotspot** or a constraint is somebody parking a question, not making
  a claim, and the tool has nothing to say about it — nor about an arc onto a note,
  onto a plain rectangle, or onto anything the model has not named. Two flows drawn
  between the same two stickies are not reported either: a wall gets a line drawn
  twice while three people talk at once.

  There is deliberately **no check on how stickies are named**. "Order placed"
  versus "Place order" is the first thing a facilitator corrects and the most
  tempting rule of the lot — and reading marker-pen prose in whatever language the
  room speaks is not something a tool can do without being wrong every fifth
  sticky. It is a checklist item instead, beside four others the tool cannot judge
  for you: the timeline has been read out loud and reordered, every hotspot has
  been discussed, the actors and external systems are identified, the pivotal
  events are marked.

  Three levels of requirement ship with it, chosen per board from the board's own
  toolbar, because Event Storming is not one activity but three. **Big Picture
  (Sketch)** (the default) says nothing at all — a Big Picture is supposed to be
  chaotic, and a tool arguing with that hand is judging one stage of the workshop
  by the criteria of a later one. **Process modelling** turns on the timeline and
  only the timeline: that stage is about ordering the frieze, and the kinds are
  still being settled. **Software design** turns on all three.

  **Nothing already drawn changes.** Walls stormed before this release carry no
  roles, so not one of them is judged, and the old flow arrows keep rendering
  exactly as they are — they are simply drawings now. Redrawing one with the new
  tool is what makes it a statement.

### Patch Changes

- 7ec4478: Senior button components resolve their own label through the translation seam

  The toolbar's navigation tooltips learned to translate a senior tool's
  `labelKey`, but the seven framework senior-button components still carried
  their label as a hard-coded English string. Each button now resolves the same
  `com.labre.framework.<id>` key through `translateKey`, with the previous
  English wording as fallback — so a host catalogue that already translates the
  toolbar translates the buttons too, and a standalone playground reads exactly
  as before.

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
  - @labre/affine-gfx-group@0.33.0
  - @labre/affine-gfx-pointer@0.33.0
  - @labre/affine-gfx-template@0.33.0
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
  - @labre/affine-ext-loader@0.32.0

## 0.31.0

### Patch Changes

- Updated dependencies [6a663b6]
  - @labre/store@0.31.0
  - @labre/affine-block-surface@0.31.0
  - @labre/affine-ext-loader@0.31.0
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

### Minor Changes

- ecba791: Per-framework text-fit defaults. Event Storming stickies and Context Map
  bubbles now carry their label as the shape's own text (contained /
  overflow fit) instead of a separate grouped text element — double-click
  edits in place and the box never deforms; previously created prefabs keep
  their old structure and keep working. Estuarine hexi constraints default
  to contained; BPMN nodes and the Wardley inertia bar default to overflow.

### Patch Changes

- Updated dependencies [9d0fe0c]
- Updated dependencies [ecba791]
- Updated dependencies [8de86f4]
  - @labre/std@0.30.0
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

- Updated dependencies [7375b9a]
- Updated dependencies [9330750]
  - @labre/affine-shared@0.29.0
  - @labre/std@0.29.0
  - @labre/affine-block-surface@0.29.0
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
  - @labre/affine-gfx-group@0.27.0
  - @labre/affine-gfx-pointer@0.27.0
  - @labre/affine-gfx-template@0.27.0
  - @labre/affine-model@0.27.0
  - @labre/affine-shared@0.27.0
  - @labre/affine-widget-edgeless-toolbar@0.27.0
  - @labre/affine-ext-loader@0.27.0
  - @labre/global@0.27.0
  - @labre/store@0.27.0
