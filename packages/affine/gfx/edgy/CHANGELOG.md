# @labre/affine-gfx-edgy

## 0.42.0

### Minor Changes

- 6bc897b: **Breaking for hosts importing the table-shaped legend API** — migrate imports to `@labre/affine-block-surface` (see below).

  The table-shaped legend API is removed, now that every framework subscribes its rows to the catalogue (ADR 0026). Gone from `@labre/affine-block-surface`: `AutoLegendSpec`, `AutoLegendSectionSpec`, `AutoLegendEntry`, `autoLegendSections`, `createAutoLegend` and `roleLabel`. Gone from `@labre/affine-gfx-ddd-shared`: the whole `shared/legend-auto.ts` re-export module (those six plus `rolesInBound`), the deprecated `addLegend` / `measureLegend` / `LegendLayout` / `LegendRow` / `LegendSection` re-exports in `shared/prefabs.ts`, and `dddLegendIcon`. All of them had moved to `@labre/affine-block-surface` and were kept only so the frameworks could migrate one at a time; import `createBoardLegend`, `legendFromCommands`, `rolesInBound`, `addLegend`, `measureLegend` and `legendIcon` from there. `LABEL_COLOR`, `LABEL_FONT` and `LABEL_FONT_SIZE` are now declared once, by the surface block, and re-exported by `@labre/affine-gfx-ddd-shared` under the same names. EDGY no longer depends on the DDD bundle at all.

- b1bf440: EDGY, C4 and UML derive their automatic legend from their own commands instead of a table beside them: each entry of the toolbox subscribes the row its artefact draws, and the shared engine scans the board, orders the rows, groups them under the section keys already shipped and draws the box. The rows, the swatches and the wording are unchanged — a UML row still draws the real class, actor or hollow diamond, an EDGY row still shows its facet's fill, a C4 row still reads its role's name — and the one `FrameworkLegendCreated` event keeps its historical values (`uml` still reports `module: 'uml toolbox'`). Two readings move with the command order they now follow: C4 lists Component before Database and its Relations section before Frames, and UML lists its elements in the order the sub-menu offers them. The Legend button of the two EDGY frames leaves the always-on toolbar for the flag-gated one, beside Validation: generating a legend is tooling, while the legend it wrote is content and keeps being painted with the flag off.

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
- 515103b: feat(blocks): every seed the four gfx-primitive frameworks write into a document — a BPMN pool's and lane's default name, the two worked BPMN scenes, a C4 component's title and description tier and a boundary's name, a Wardley node's/pipeline's/market's/accelerator's caption and a background variant's axis titles, the two shipped Wardley maps, an EDGY facets diagram's three circle names, the "EDGY dynamic" metamodel template and its four hand-composed scenes — now resolves through the translation seam at placement (`translateKey`, ADR 0016), so a document created in a translated host starts in that language instead of English. Every hand-composed template (BPMN's two scenes, Wardley's two maps, EDGY's four scenes and its metamodel card) gained a `localize` rebuild, mirroring the derived-template mechanism already in place: without a host catalogue every one of them still inserts byte-identical English content. C4's type-line bracket word and technology placeholder, and the dead `AREA_LABEL` in Wardley, are deliberately left English — see this lot's notes. Model defaults (`BpmnPoolElementModel.name`, `C4BoundaryElementModel.name`, `EdgyFacetsElementModel`'s three labels) are untouched; existing documents keep their stored text exactly as before.
- c226803: feat(blocks): the five framework packages (Wardley, EDGY, Cynefin/Estuarine, BPMN, C4) resolve their remaining chrome and seeds through the translation seam instead of hard-coded English. Toolbar tooltips (Wardley's seven axis/gradient toggles, EDGY's facet-labels/hover-spotlight, Cynefin's three and Estuarine's four) carry a `…Wording`; Wardley's auto-legend (title, row descriptions, the two gradient captions, the Porter panel) and EDGY's legend section titles ("Base elements", "Relations") resolve at build time; Cynefin's canvas (headings, subheadings, the ten Probe/Sense/Respond decision lines, the seven teal annotations, the three exaptation sub-labels, the two markers and their note) and Estuarine's three curve legends resolve through the `CanvasRenderer`'s host, with the decision lines drawn as one run once a host answers rather than assuming the English bold-lead split; Cynefin's and Estuarine's Templates-panel tabs carry their own `nameKey`. BPMN's nine export warnings and four import quarantine notes are keyed (the export ones with `{{count}}`/`{{names}}` params, neutral on plural); Wardley's five fixed-wording OWM import remarks are too. C4's four type-line words and its technology placeholder now resolve through the host at both placement and every edit commit (`C4TypeLineWatcher`), and the comparisons that decide whether a type line is still the untouched prompt accept either the English literal or the host's own resolved wording — the shipped French proposal keeps these five words identical to English so a translated document still round-trips correctly through the `std`-free exporter. C4's own legend section titles ("Elements", "Frames", "Relations") are keyed too. With no `TranslationProvider` registered every surface reads byte-identical to before.
- 223b280: feat(blocks): close three shared translation seams the earlier i18n lots flagged as missing, then translate every string that was waiting on them. `Template.nameKey` gives a hand-composed template (a worked scene, an example map) a tile name of its own -- `resolveTemplateName` checks it before the `commandId`-derived path -- and every BPMN, Wardley, EDGY, Cynefin, Estuarine and mind-map hand-authored card now carries one. `AutoLegendSpec.titleKey` (already resolved by `createAutoLegend`) is now set for EDGY and C4's own "Legend" boxes, so both translate through the shared `BOARD_LEGEND_TITLE` key exactly like the three DDD boards already did. `MorphSpec.afterMorph` takes an optional 4th `std` parameter, which the morph toolbar now passes through: morphing an untouched TRANSLATED placeholder rewrites it to the target kind's own translated placeholder (`c4MorphedTypeLine`, `wardleyMorphedLabel`), where it used to fall back to English. Beyond the three seams: the note tool's overlay caption and a document's "Untitled" fallback (`inlines/reference`, the linked-doc HTML/Markdown exporters) now resolve through the shared `BLOCK_NAME_TEXT` / `DOC_UNTITLED` wordings instead of a raw literal; the "Template" senior-tool button gained a `labelKey`. Per a PO decision (2026-09-12), the linked-doc import dialog's English fallback now says "Labre" instead of the inherited "AFFiNE" in the two sentences that named it. Every addition is optional and retro-compatible: with no `TranslationProvider` registered, nothing on screen changes.
- 47d4ac6: feat(blocks): close four i18n seams the earlier lots reported missing. A colour panel's swatch (`edgeless-color-panel`, shape/note/connector/brush pickers) now resolves its visible name and aria-label through `resolvePaletteLabel` (`@labre/affine-components/color-picker`) instead of showing `Palette.key` raw — the default theme's colours (`Red`, `LightBlue`…) translate through a shared `PALETTE_NAME_WORDINGS` table, and a framework's own swatches (Wardley's evolution-cycle colours, EDGY's facet palette) translate through their own `NamedPalette.labelWording`, with no cross-framework import. `UniverseTagDefs` (tag packs) gained an optional pack-level `labelKey` and `descriptionKey` on `TagDef` / `TagValueDef`, resolved by `translateTagLabel` / the new `translateTagDescription`; Wardley's own nature and Porter-competition tags are keyed end to end. `InterchangeNote`'s `messageKey` can now carry a whole sentence with `{{name}}` / `{{count}}` holes (`messageParams`, already wired into `reportInterchangeImport`) — the remaining 16 BPMN import remarks and refusals (the last four now throw a translatable `InterchangeImportError` instead of a plain `Error`) and the 2 remaining Wardley OWM import remarks are keyed. With no `TranslationProvider` registered every one of these reads exactly as it did before.

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
  - @labre/affine-components@0.41.0
  - @labre/affine-gfx-shape@0.41.0
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
  - @labre/affine-components@0.40.0
  - @labre/affine-gfx-connector@0.40.0
  - @labre/affine-gfx-group@0.40.0
  - @labre/affine-gfx-pointer@0.40.0
  - @labre/affine-gfx-shape@0.40.0
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
  - @labre/affine-gfx-connector@0.39.3
  - @labre/affine-gfx-ddd-shared@0.39.3
  - @labre/affine-gfx-group@0.39.3
  - @labre/affine-gfx-pointer@0.39.3
  - @labre/affine-gfx-shape@0.39.3
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
  - @labre/affine-components@0.39.2
  - @labre/affine-gfx-connector@0.39.2
  - @labre/affine-gfx-ddd-shared@0.39.2
  - @labre/affine-gfx-group@0.39.2
  - @labre/affine-gfx-pointer@0.39.2
  - @labre/affine-gfx-shape@0.39.2
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
  - @labre/affine-gfx-shape@0.39.1
  - @labre/affine-block-surface@0.39.1
  - @labre/affine-components@0.39.1
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
  - @labre/affine-components@0.39.0
  - @labre/affine-ext-loader@0.39.0
  - @labre/affine-gfx-connector@0.39.0
  - @labre/affine-gfx-group@0.39.0
  - @labre/affine-gfx-pointer@0.39.0
  - @labre/affine-gfx-shape@0.39.0
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
  - @labre/affine-components@0.38.2
  - @labre/affine-gfx-connector@0.38.2
  - @labre/affine-gfx-ddd-shared@0.38.2
  - @labre/affine-gfx-group@0.38.2
  - @labre/affine-gfx-pointer@0.38.2
  - @labre/affine-gfx-shape@0.38.2
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
- @labre/affine-components@0.38.1
- @labre/affine-ext-loader@0.38.1
- @labre/affine-gfx-connector@0.38.1
- @labre/affine-gfx-ddd-shared@0.38.1
- @labre/affine-gfx-group@0.38.1
- @labre/affine-gfx-pointer@0.38.1
- @labre/affine-gfx-shape@0.38.1
- @labre/affine-gfx-template@0.38.1
- @labre/affine-model@0.38.1
- @labre/affine-shared@0.38.1
- @labre/affine-widget-edgeless-toolbar@0.38.1
- @labre/global@0.38.1
- @labre/std@0.38.1
- @labre/store@0.38.1

## 0.38.0

### Patch Changes

- 5faf2db: feat(edgeless): EDGY palette templates are derived from the creation commands

  An EDGY template of the senior menu's Templates panel used to be a hand-written
  copy of what the toolbox creates, and the copy had drifted: the four base
  elements (People, Outcome, Object, Activity) carried no semantic role at all,
  so an element dropped from the palette was invisible to the overlap rule, was
  never picked up by the auto legend and would not open the info panel; "People"
  arrived as a loose glyph and a loose name that walked apart the first time you
  dragged one of them; the words were English literals outside the translation
  seam; and the label box was a size the toolbox stopped using.

  Every single-artefact template is now produced by running its own command
  against a recording surface, so it cannot disagree with the button next to it.
  The blank EDGY board gains the template it never had. The five compositions
  (the facets overview, the customer journey, the service blueprint, the
  organisation chart and the EDGY dynamic metamodel) stay hand-composed, but are
  rebuilt on the same node description the toolbox draws from — and the person of
  the customer journey now travels grouped with its name. A parity test guards
  both directions: every artefact command has its template, every derived
  template matches its command.

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
  - @labre/affine-gfx-shape@0.38.0
  - @labre/affine-widget-edgeless-toolbar@0.38.0
  - @labre/affine-components@0.38.0
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
  - @labre/affine-gfx-shape@0.37.0
  - @labre/affine-gfx-template@0.37.0
  - @labre/affine-widget-edgeless-toolbar@0.37.0
  - @labre/affine-components@0.37.0
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

- 1149791: feat(edgeless): the wardley node colour picker offers the cycle swatches

  Selecting a Wardley artefact used to open the editor's historical palette —
  twenty hues that say nothing on a map, and none of the three the notation
  actually thinks in. Colouring a component by where it sits in the evolution
  cycle meant reaching for the custom picker and typing a hex, once per node,
  with nothing to keep two maps agreeing on what "War" looks like.

  The picker now leads with the cycle itself: **Wonder**, **Peace**, **War**
  (Simon Wardley's climatic pattern), saturated first and then in a light shade
  for a fill that has to sit under a label, followed by the three colours the map
  already draws with — the evolution arrow's red, the inertia bar's near-black,
  and a method's neutral grey. After them come the neutrals of the default
  palette, which every drawing needs and no notation owns; the legacy editor
  colours are gone. They are shortcuts, never constraints: no rule reads a node's
  colour, and the custom picker is still one click away.

  EDGY has had exactly this for its own facets, so the ~100 lines that wire the
  shape colour picker to a framework's swatches move into the shape package as
  `paletteColorAction(id, palettes)` (plus `neutralPalettes()`, the filter both
  lists end with). EDGY now calls the factory and keeps only its swatch list —
  same behaviour, said once — and the next framework that wants its palette in
  front of the picker declares an array instead of copying a file.

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

### Patch Changes

- Updated dependencies [aca4653]
- Updated dependencies [ea5d249]
- Updated dependencies [e9cd7e1]
- Updated dependencies [de3560d]
- Updated dependencies [7f09608]
- Updated dependencies [ad21e60]
- Updated dependencies [cf0d8a1]
  - @labre/affine-gfx-ddd-shared@0.35.0
  - @labre/affine-components@0.35.0
  - @labre/affine-block-surface@0.35.0
  - @labre/affine-shared@0.35.0
  - @labre/std@0.35.0
  - @labre/affine-model@0.35.0
  - @labre/affine-gfx-connector@0.35.0
  - @labre/affine-widget-edgeless-toolbar@0.35.0
  - @labre/affine-gfx-group@0.35.0
  - @labre/affine-gfx-pointer@0.35.0
  - @labre/affine-gfx-shape@0.35.0
  - @labre/affine-gfx-template@0.35.0
  - @labre/affine-ext-loader@0.35.0
  - @labre/global@0.35.0
  - @labre/store@0.35.0

## 0.34.2

### Patch Changes

- @labre/affine-block-surface@0.34.2
- @labre/affine-components@0.34.2
- @labre/affine-ext-loader@0.34.2
- @labre/affine-gfx-connector@0.34.2
- @labre/affine-gfx-ddd-shared@0.34.2
- @labre/affine-gfx-group@0.34.2
- @labre/affine-gfx-pointer@0.34.2
- @labre/affine-gfx-shape@0.34.2
- @labre/affine-gfx-template@0.34.2
- @labre/affine-model@0.34.2
- @labre/affine-shared@0.34.2
- @labre/affine-widget-edgeless-toolbar@0.34.2
- @labre/global@0.34.2
- @labre/std@0.34.2
- @labre/store@0.34.2

## 0.34.1

### Patch Changes

- 6120f7a: fix(edgeless): a framework background is picked by its border, not its whole area

  Framework backgrounds and boards hit-tested their entire rectangle, so they
  competed with their own content for every click. A board created after the
  shapes it covers sits above them in the paint order and swallowed 100% of the
  clicks on those shapes; one sitting below filled every gap the content left —
  the interior of an unfilled shape, the space beside a small node — which is
  where the "one time in two" came from. Eleven element types were affected: the
  BPMN pool, both C4 frames, the event-storming board, the core domain chart, the
  Wardley background and the context-map board (subclasses of the
  framework-background primitive), plus the EDGY board, the EDGY facets diagram,
  Cynefin and Estuarine (standalone implementations of the same geometry).

  A background is now selected by a band along its border, ten screen pixels wide
  and adjusted for the zoom like every shape's stroke, with two carve-outs:

  - a **BPMN pool** keeps its title bands clickable — the participant strip on the
    left and the lane strip beside it — which is the bpmn.io convention and the
    only part of a pool that is the pool rather than the process drawn on it;
  - **editable label zones** (Wardley axis titles, EDGY facet names, C4 board and
    boundary names) still receive the double-click that renames them, and a BPMN
    pool's lane separators still receive the drag that moves them. Pointer events
    now reach a view through the VIEW's `includesPoint` rather than the model's —
    it delegates to the model by default, so nothing else changes — which is what
    lets a framework declare its own gesture zones beside the code that draws
    them.

  The lasso (`containsBound` / `intersectsBound`) is untouched, and a selected
  background is still dragged from anywhere inside it: the drag path asks about
  the element's visible extent (`ignoreTransparent: false`), which the interior
  still answers, exactly as an unfilled shape does.

- cb49bb1: fix(edgeless): the edgy venn stops hosting the spotlight — board logic lives on
  the edgy board

  The EDGY "Enterprise Design Facets" Venn (`edgy`) was registered as a
  spotlight host alongside the EDGY board (`edgyBoard`), so any element laid
  inside its circles got the hover spotlight: hovering one faded everything else
  on the diagram. That is board logic on a drawing. The Venn frames a notation;
  it does not host a dependency reading.

  `SpotlightHostExtension('edgy')` is gone and the "Enable / disable hover
  spotlight" toggle has left the Venn's contextual toolbar. The board keeps both,
  unchanged. The Venn keeps its appearance toggles — labels, pictos, crop,
  resize — plus its legend, which moves from `d.legend` to `c.legend` now that
  the row is one shorter.

  `spotlightEnabled` STAYS on `EdgyFacetsElementModel`: documents written before
  this change carry the property and must stay loadable. It is simply inert —
  nothing reads it on a Venn any more.

  The host lookup `SpotlightManager` runs on every pointermove is now the
  exported pure `findSpotlightHost(target, elements, hostTypes)`, so the rule a
  Venn grants nothing and a board grants is pinned by a unit test rather than by
  a DI registration read by eye.

  Refs #195

- Updated dependencies [6120f7a]
- Updated dependencies [cb49bb1]
  - @labre/affine-model@0.34.1
  - @labre/std@0.34.1
  - @labre/affine-block-surface@0.34.1
  - @labre/affine-components@0.34.1
  - @labre/affine-gfx-connector@0.34.1
  - @labre/affine-gfx-ddd-shared@0.34.1
  - @labre/affine-gfx-group@0.34.1
  - @labre/affine-gfx-pointer@0.34.1
  - @labre/affine-gfx-shape@0.34.1
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
  - @labre/affine-components@0.34.0
  - @labre/affine-widget-edgeless-toolbar@0.34.0
  - @labre/affine-gfx-connector@0.34.0
  - @labre/affine-gfx-ddd-shared@0.34.0
  - @labre/affine-gfx-group@0.34.0
  - @labre/affine-gfx-pointer@0.34.0
  - @labre/affine-gfx-shape@0.34.0
  - @labre/affine-gfx-template@0.34.0
  - @labre/affine-model@0.34.0
  - @labre/affine-ext-loader@0.34.0
  - @labre/global@0.34.0
  - @labre/store@0.34.0

## 0.33.0

### Minor Changes

- 6fd58e5: feat(edgeless): the two EDGY backgrounds generate the legend of what is drawn on them

  Select the **facets diagram** or the **EDGY board** and its toolbar now offers
  the same legend button the three DDD backgrounds were given: it reads what is
  actually inside the background's perimeter and drops a legend of exactly that,
  bottom-left, as a real editable group of elements. A board with a Purpose, a
  Content and two relations on it gets a three-row legend; add a Journey and press
  again.

  What it lists, grouped the way EDGY reads:

  - **Identity**, **Architecture** and **Experience** — one row per official
    element of the facet present, in the pastel its zone is drawn with;
  - **Intersections** — Organisation, Product and Brand together, each in its own
    colour, because they are the three lenses between the facets and not facets of
    their own;
  - **Base elements** — People, Outcome, Object and Activity, listed only when one
    is on the board BARE. A Content is an Object in the vocabulary, but a board
    carrying a Content has not necessarily got a bare Object on it, and the legend
    does not claim one;
  - **Relations** — one row, whatever the verb. A link says "expresses" or
    "traverses" on the link itself, where the reader is already looking; twenty-two
    legend rows would restate the metamodel instead of documenting the drawing.

  Every row is DERIVED from the metamodel: which elements exist, which zone each
  belongs to, what colour that zone is painted. The element table now names its
  zone instead of repeating a colour literal, so the swatch in the legend is by
  construction the fill on the diagram, and a thirteenth element would get its
  legend row the same way it gets its role — with no edit. Detection is by
  **semantic role**, like every other reader of a board, so a re-coloured element
  stays in its row and a rectangle somebody drew to think with stays out.

  The twelve official elements and the four base kinds also gained the English
  wording their roles were missing, which is what the legend prints when the host
  ships no catalogue.

  Registered always-on, next to the resize and spotlight toggles: a legend is
  elements written into the document, not tooling a flag may take away.

- 21aa9d8: An EDGY relation drawn by hand names itself

  The EDGY toolbox gains a **Relation** entry. Pick it, drag from one element to
  another, and the link is typed: it carries the verb the metamodel gives that
  pair — as a role the validation reads, and as the visible label the template
  already puts on its own 24 links. "Process **realises** Capability", "Journey
  **traverses** Channel", written by the tool, not by the user.

  Until now those 24 typed relations could only be born of the "EDGY dynamic"
  template. A practitioner drawing their own board had a plain connector: no verb,
  no role, nothing the metamodel check could read. The vocabulary was there and
  there was no way to speak it by hand.

  **One entry, not twenty-two.** The metamodel's 24 relations run between 24
  distinct ordered pairs of elements, so the verb is entirely determined by which
  two elements the link ends up attached to — there is exactly one thing a link
  from a Journey to a Channel can say. Offering a list of twenty-two verbs would
  be asking a question the method already answers.

  Three things it deliberately does not do:

  - **it never turns a link round.** Draw a Channel → Journey link and it is named
    `traverses` all the same and left pointing the way it was drawn. The
    metamodel check then reports the sentence as one EDGY does not declare, and
    "Reverse direction" is one click away on the link's toolbar. Silently flipping
    a deliberate gesture would be the tool overruling the user; leaving the link
    anonymous would hide the mistake.
  - **it never says anything about a pair the metamodel does not know**, and never
    about a link with an end on a People node, a base Object, a plain sticky or
    another framework's element. Outside the alphabet is outside the conversation.
  - **it never rewrites a verb already there.** A relation is named once, on the
    way from the generic link to the verb, and never back. Move an end while the
    link is still anonymous and it is named again from the new pair; move an end
    after it has a verb and the verb stays — it is the user's statement by then.

  Nothing is backfilled and nothing else changes: links drawn before this release
  keep exactly what they carry, and a plain connector stays a plain connector.

- 9f91a96: EDGY boards are now checked against the metamodel

  The EDGY artefacts carry a semantic role at last: the four base elements say
  which kind they are, the twelve official elements of the metamodel say which
  element they are, the facets diagram and the blank board say they are a frame,
  and each of the 24 canonical relations carries a role named after its verb —
  "expresses", "traverses", "is part of". The verb still travels with the link as
  a visible label; the role is what the tool reads.

  On top of that vocabulary, two checks appear on a selected EDGY background,
  under the Validation dropdown the Wardley map already had:

  - **a relation the metamodel does not declare** is reported, read as one
    sentence — source, verb, target. "A journey traverses a channel" is EDGY; the
    same link drawn the other way round is not, and the finding names all three
    elements so either fix is one gesture away.
  - **two artefacts on top of each other** are reported, because on a facets
    diagram where an element sits is what says which facet it belongs to.

  Both come with the Sketch / Strict profile choice — Sketch is the default and
  says nothing on the canvas — and with a four-item work-quality checklist for
  the things no algorithm can decide: intersection elements linked to both parent
  facets, elements wearing their facet's colour, relations that read correctly,
  all three facets explored.

  Nothing is backfilled. A board drawn before this release carries no role on
  anything, so it is never evaluated and never says a word; only the EDGY dynamic
  template and the elements created from the EDGY palette are stamped. The
  illustrative templates (customer journey, service blueprint, organisation
  chart) stay deliberately neutral drawings.

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
  - @labre/affine-components@0.33.0
  - @labre/affine-shared@0.33.0
  - @labre/affine-model@0.33.0
  - @labre/std@0.33.0
  - @labre/affine-gfx-ddd-shared@0.33.0
  - @labre/affine-gfx-connector@0.33.0
  - @labre/affine-widget-edgeless-toolbar@0.33.0
  - @labre/affine-gfx-group@0.33.0
  - @labre/affine-gfx-pointer@0.33.0
  - @labre/affine-gfx-shape@0.33.0
  - @labre/affine-gfx-template@0.33.0
  - @labre/affine-ext-loader@0.33.0
  - @labre/global@0.33.0
  - @labre/store@0.33.0

## 0.32.0

### Minor Changes

- 5b6e9bb: feat(edgeless): EDGY dynamic template, blank EDGY board and dependency spotlight

  - New "EDGY dynamic" template (template panel + EDGY senior menu): the facets
    background (without writings) with the 12 EDGY elements as prefab nodes,
    linked by the 24 canonical relations of the metamodel, each carrying its
    verb as a native connector label.
  - New blank "EDGY board" background element for free-form EDGY modelling.
  - New modular spotlight-on-hover: backgrounds registered as spotlight hosts
    (`SpotlightHostExtension`) grant the elements laid inside their bounds a
    dependency highlight — hovering a node fades everything but the node, its
    connectors and their endpoints. Enabled for the EDGY facets diagram and the
    EDGY board; other frameworks (e.g. Wardley) can opt in with one line.
  - The facets element gains optional backward-compatible `showPictos`,
    `cropToCircles` and `spotlightEnabled` flags; the board gains
    `spotlightEnabled`. Both background toolbars expose a spotlight toggle.
  - The classic "Enterprise Design facets" diagram (senior menu + template
    panel) is now cropped to the circles plus a facet-label allowance — no
    more dead margins around the Venn. Existing documents keep the previous
    letterboxed rendering (`cropToCircles` defaults to false).
  - Fix: canvas view events (click/dblclick) now route to the TOPMOST view
    under the pointer (paint order), so elements laid on a background stay
    editable — previously the background could swallow the double-click.
  - EDGY template gallery: Customer journey, Service blueprint and
    Organisation chart connectors are now ATTACHED to their elements (they
    follow moves, endpoints clip to edges); the blueprint's diagonal arrows
    no longer render as orthogonal zigzags.

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
- Updated dependencies [8ded589]
- Updated dependencies [9e23b5b]
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
  - @labre/affine-model@0.32.0
  - @labre/affine-gfx-shape@0.32.0
  - @labre/affine-gfx-connector@0.32.0
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
  - @labre/affine-components@0.31.0
  - @labre/affine-ext-loader@0.31.0
  - @labre/affine-gfx-connector@0.31.0
  - @labre/affine-gfx-group@0.31.0
  - @labre/affine-gfx-pointer@0.31.0
  - @labre/affine-gfx-shape@0.31.0
  - @labre/affine-gfx-template@0.31.0
  - @labre/affine-model@0.31.0
  - @labre/affine-shared@0.31.0
  - @labre/std@0.31.0
  - @labre/affine-widget-edgeless-toolbar@0.31.0
  - @labre/global@0.31.0

## 0.30.2

### Patch Changes

- @labre/affine-block-surface@0.30.2
- @labre/affine-components@0.30.2
- @labre/affine-ext-loader@0.30.2
- @labre/affine-gfx-connector@0.30.2
- @labre/affine-gfx-group@0.30.2
- @labre/affine-gfx-pointer@0.30.2
- @labre/affine-gfx-shape@0.30.2
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
- @labre/affine-components@0.30.1
- @labre/affine-ext-loader@0.30.1
- @labre/affine-gfx-connector@0.30.1
- @labre/affine-gfx-group@0.30.1
- @labre/affine-gfx-pointer@0.30.1
- @labre/affine-gfx-shape@0.30.1
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
- Updated dependencies [8de86f4]
  - @labre/std@0.30.0
  - @labre/affine-model@0.30.0
  - @labre/affine-gfx-shape@0.30.0
  - @labre/affine-block-surface@0.30.0
  - @labre/affine-components@0.30.0
  - @labre/affine-gfx-connector@0.30.0
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
- @labre/affine-components@0.29.1
- @labre/affine-ext-loader@0.29.1
- @labre/affine-gfx-connector@0.29.1
- @labre/affine-gfx-group@0.29.1
- @labre/affine-gfx-pointer@0.29.1
- @labre/affine-gfx-shape@0.29.1
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
  - @labre/affine-components@0.29.0
  - @labre/affine-gfx-connector@0.29.0
  - @labre/affine-gfx-group@0.29.0
  - @labre/affine-gfx-pointer@0.29.0
  - @labre/affine-gfx-shape@0.29.0
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
  - @labre/affine-components@0.28.0
  - @labre/affine-gfx-connector@0.28.0
  - @labre/affine-gfx-group@0.28.0
  - @labre/affine-gfx-pointer@0.28.0
  - @labre/affine-gfx-shape@0.28.0
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
  - @labre/affine-components@0.27.0
  - @labre/affine-gfx-connector@0.27.0
  - @labre/affine-gfx-group@0.27.0
  - @labre/affine-gfx-pointer@0.27.0
  - @labre/affine-gfx-shape@0.27.0
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
- Updated dependencies [6795191]
  - @labre/affine-model@0.26.0
  - @labre/affine-components@0.26.0
  - @labre/affine-block-surface@0.26.0
  - @labre/affine-gfx-connector@0.26.0
  - @labre/affine-gfx-group@0.26.0
  - @labre/affine-gfx-pointer@0.26.0
  - @labre/affine-gfx-shape@0.26.0
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
- Updated dependencies [6795191]
  - @labre/affine-model@0.25.0
  - @labre/affine-components@0.25.0
  - @labre/affine-block-surface@0.25.0
  - @labre/affine-gfx-connector@0.25.0
  - @labre/affine-gfx-group@0.25.0
  - @labre/affine-gfx-pointer@0.25.0
  - @labre/affine-gfx-shape@0.25.0
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
  - @labre/affine-components@0.24.0
  - @labre/affine-ext-loader@0.24.0
  - @labre/affine-gfx-connector@0.24.0
  - @labre/affine-gfx-group@0.24.0
  - @labre/affine-gfx-pointer@0.24.0
  - @labre/affine-gfx-shape@0.24.0
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
  - @labre/affine-components@0.23.3
  - @labre/affine-gfx-connector@0.23.3
  - @labre/affine-gfx-group@0.23.3
  - @labre/affine-gfx-pointer@0.23.3
  - @labre/affine-gfx-shape@0.23.3
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
  - @labre/affine-components@0.23.2
  - @labre/affine-gfx-connector@0.23.2
  - @labre/affine-gfx-group@0.23.2
  - @labre/affine-gfx-pointer@0.23.2
  - @labre/affine-gfx-shape@0.23.2
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
  - @labre/affine-components@0.23.1
  - @labre/affine-gfx-connector@0.23.1
  - @labre/affine-gfx-group@0.23.1
  - @labre/affine-gfx-pointer@0.23.1
  - @labre/affine-gfx-shape@0.23.1
  - @labre/affine-gfx-template@0.23.1
  - @labre/affine-widget-edgeless-toolbar@0.23.1
  - @labre/affine-ext-loader@0.23.1
  - @labre/affine-model@0.23.1
  - @labre/global@0.23.1
  - @labre/std@0.23.1
  - @labre/store@0.23.1

## 0.23.0

### Minor Changes

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
  - @labre/affine-components@0.23.0
  - @labre/affine-gfx-connector@0.23.0
  - @labre/affine-gfx-group@0.23.0
  - @labre/affine-gfx-pointer@0.23.0
  - @labre/affine-gfx-shape@0.23.0
  - @labre/affine-ext-loader@0.23.0
  - @labre/global@0.23.0
  - @labre/std@0.23.0
  - @labre/store@0.23.0
