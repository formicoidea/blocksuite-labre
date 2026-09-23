# @labre/affine-gfx-brush

## 0.43.0

### Patch Changes

- Updated dependencies [da68dbb]
- Updated dependencies [72f7282]
- Updated dependencies [8f54236]
- Updated dependencies [f1a4af7]
- Updated dependencies [8a927dd]
  - @labre/affine-shared@0.43.0
  - @labre/affine-block-surface@0.43.0
  - @labre/affine-components@0.43.0
  - @labre/affine-widget-edgeless-toolbar@0.43.0
  - @labre/affine-rich-text@0.43.0
  - @labre/affine-ext-loader@0.43.0
  - @labre/affine-model@0.43.0
  - @labre/global@0.43.0
  - @labre/std@0.43.0
  - @labre/store@0.43.0

## 0.42.0

### Patch Changes

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
  - @labre/affine-components@0.42.0
  - @labre/global@0.42.0
  - @labre/affine-rich-text@0.42.0
  - @labre/affine-ext-loader@0.42.0

## 0.41.0

### Minor Changes

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
  - @labre/affine-rich-text@0.39.2
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
  - @labre/affine-components@0.39.1
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
  - @labre/affine-widget-edgeless-toolbar@0.35.0
  - @labre/affine-rich-text@0.35.0
  - @labre/affine-ext-loader@0.35.0
  - @labre/global@0.35.0
  - @labre/store@0.35.0

## 0.34.2

### Patch Changes

- @labre/affine-block-surface@0.34.2
- @labre/affine-components@0.34.2
- @labre/affine-ext-loader@0.34.2
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
  - @labre/affine-rich-text@0.33.0
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
  - @labre/affine-rich-text@0.23.0
  - @labre/affine-ext-loader@0.23.0
  - @labre/global@0.23.0
  - @labre/std@0.23.0
  - @labre/store@0.23.0
