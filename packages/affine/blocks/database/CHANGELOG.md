# @labre/affine-block-database

## 0.35.0

### Patch Changes

- Updated dependencies [ea5d249]
- Updated dependencies [de3560d]
- Updated dependencies [7f09608]
- Updated dependencies [cf0d8a1]
  - @labre/affine-components@0.35.0
  - @labre/affine-shared@0.35.0
  - @labre/std@0.35.0
  - @labre/affine-model@0.35.0
  - @labre/data-view@0.35.0
  - @labre/affine-inline-preset@0.35.0
  - @labre/affine-inline-reference@0.35.0
  - @labre/affine-rich-text@0.35.0
  - @labre/affine-widget-drag-handle@0.35.0
  - @labre/affine-widget-slash-menu@0.35.0
  - @labre/affine-ext-loader@0.35.0
  - @labre/global@0.35.0
  - @labre/store@0.35.0

## 0.34.2

### Patch Changes

- @labre/affine-components@0.34.2
- @labre/data-view@0.34.2
- @labre/affine-ext-loader@0.34.2
- @labre/affine-inline-preset@0.34.2
- @labre/affine-inline-reference@0.34.2
- @labre/affine-model@0.34.2
- @labre/affine-rich-text@0.34.2
- @labre/affine-shared@0.34.2
- @labre/affine-widget-drag-handle@0.34.2
- @labre/affine-widget-slash-menu@0.34.2
- @labre/global@0.34.2
- @labre/std@0.34.2
- @labre/store@0.34.2

## 0.34.1

### Patch Changes

- Updated dependencies [6120f7a]
- Updated dependencies [cb49bb1]
  - @labre/affine-model@0.34.1
  - @labre/std@0.34.1
  - @labre/affine-components@0.34.1
  - @labre/affine-inline-preset@0.34.1
  - @labre/affine-inline-reference@0.34.1
  - @labre/affine-rich-text@0.34.1
  - @labre/affine-shared@0.34.1
  - @labre/affine-widget-drag-handle@0.34.1
  - @labre/data-view@0.34.1
  - @labre/affine-widget-slash-menu@0.34.1
  - @labre/affine-ext-loader@0.34.1
  - @labre/global@0.34.1
  - @labre/store@0.34.1

## 0.34.0

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
  - @labre/affine-components@0.34.0
  - @labre/affine-inline-reference@0.34.0
  - @labre/affine-widget-slash-menu@0.34.0
  - @labre/data-view@0.34.0
  - @labre/affine-inline-preset@0.34.0
  - @labre/affine-model@0.34.0
  - @labre/affine-rich-text@0.34.0
  - @labre/affine-widget-drag-handle@0.34.0
  - @labre/affine-ext-loader@0.34.0
  - @labre/global@0.34.0
  - @labre/store@0.34.0

## 0.33.0

### Patch Changes

- Updated dependencies [3fbf69c]
- Updated dependencies [f929e12]
- Updated dependencies [13360cd]
- Updated dependencies [c03090c]
- Updated dependencies [32e4d45]
- Updated dependencies [139d77b]
- Updated dependencies [6bba40c]
- Updated dependencies [a8325bb]
- Updated dependencies [ff19911]
- Updated dependencies [b03132c]
- Updated dependencies [48049d6]
- Updated dependencies [7136db0]
- Updated dependencies [5737a56]
- Updated dependencies [168617d]
- Updated dependencies [9022c92]
- Updated dependencies [edfaba2]
- Updated dependencies [e42e0c0]
- Updated dependencies [256ee0b]
- Updated dependencies [4a3b26e]
- Updated dependencies [48c3b52]
- Updated dependencies [6a20738]
- Updated dependencies [f09f9a3]
  - @labre/affine-components@0.33.0
  - @labre/affine-shared@0.33.0
  - @labre/affine-model@0.33.0
  - @labre/std@0.33.0
  - @labre/affine-widget-drag-handle@0.33.0
  - @labre/data-view@0.33.0
  - @labre/affine-inline-preset@0.33.0
  - @labre/affine-inline-reference@0.33.0
  - @labre/affine-rich-text@0.33.0
  - @labre/affine-widget-slash-menu@0.33.0
  - @labre/affine-ext-loader@0.33.0
  - @labre/global@0.33.0
  - @labre/store@0.33.0

## 0.32.0

### Patch Changes

- 8ded589: A database can now be read as a month

  Until now a database offered two shapes: a table and a kanban board. Neither
  of them answers the question a transformation roadmap asks first — what is
  happening in March? A calendar view now sits beside them: pick it from the
  slash menu ("Calendar View"), from the view switcher, or convert an existing
  table or kanban into one and keep its filters and sort.

  The view maps one date property to the grid and, optionally, a second one to
  close a range, so a workstream that runs from the 4th to the 19th is drawn as
  a single bar across the weeks it spans rather than as a dot on its start day.
  Cards can be dragged from one day to another (a range keeps its length), a
  range can be stretched by its edges, and clicking an empty day creates a row
  already dated. Months are navigated with the arrows or the "Today" button.

  Hosts can feed the same grid from outside the document by registering a
  `CalendarExternalSourceProvider`; the editor ships none, so a standalone
  playground simply shows the database's own rows.

- acbec17: A link pasted into a database cell no longer swallows the sentence around it

  Pasting into a title or rich-text cell was all-or-nothing: if the whole
  clipboard happened to parse as a URL the entire paste became one link,
  otherwise nothing was linked at all. So `docs:https://example.com` arrived as
  flat text with a dead address in it, and `(https://example.com).` became a link
  that quietly included the closing bracket and the full stop.

  The paste is now read segment by segment: prose stays prose, addresses become
  links, and the punctuation hugging an address stays outside it. A paste that is
  nothing but a single address still resolves to a linked doc when it points at
  one, exactly as before. Title cells also claim the paste before the document
  clipboard sees it, so a paste there can no longer leak into the page.

- 9bf1d3e: Enter on a database title no longer leaves a phantom record behind

  Validating the title of a database with Enter — the one gesture everybody makes
  after typing a name — prepended a row to the table. The user got a title and an
  empty record they never asked for, at the top of their data, and the field kept
  the caret so nothing signalled what had happened.

  Enter now does what it looks like it does: it commits the title and leaves the
  field. Adding a record stays where it belongs, on the "+" affordances of the
  view. An Enter that only confirms an IME composition is still ignored, as
  before.

- Updated dependencies [832c793]
- Updated dependencies [c5c07b9]
- Updated dependencies [a2b7c44]
- Updated dependencies [ff5f060]
- Updated dependencies [1b59f3c]
- Updated dependencies [41ab595]
- Updated dependencies [0bfc872]
- Updated dependencies [8ded589]
- Updated dependencies [50ab9ae]
- Updated dependencies [f832f27]
- Updated dependencies [9e23b5b]
- Updated dependencies [a3aa598]
- Updated dependencies [90a9168]
- Updated dependencies [6417a2f]
- Updated dependencies [9ffab42]
- Updated dependencies [c6eac56]
- Updated dependencies [d797f9a]
- Updated dependencies [9fde974]
- Updated dependencies [d360f72]
- Updated dependencies [50ab9ae]
- Updated dependencies [6264dfc]
- Updated dependencies [c2e1020]
- Updated dependencies [463989f]
- Updated dependencies [ceb2761]
- Updated dependencies [751ac44]
- Updated dependencies [54488cd]
- Updated dependencies [9453013]
- Updated dependencies [b746d6b]
- Updated dependencies [5ac0c68]
- Updated dependencies [1fa46c1]
- Updated dependencies [d8eb24a]
- Updated dependencies [0473dcb]
- Updated dependencies [5b6e9bb]
- Updated dependencies [492bac6]
- Updated dependencies [72b334c]
- Updated dependencies [fc52023]
- Updated dependencies [30580db]
- Updated dependencies [08e9b24]
- Updated dependencies [5076cb8]
- Updated dependencies [3c5c97e]
- Updated dependencies [9cf65a2]
- Updated dependencies [7c10406]
- Updated dependencies [02797b5]
- Updated dependencies [413fe7b]
- Updated dependencies [724ed1c]
- Updated dependencies [c7612da]
- Updated dependencies [0ddfd47]
- Updated dependencies [3639562]
- Updated dependencies [5d16745]
- Updated dependencies [48e90f4]
- Updated dependencies [5a61fb2]
- Updated dependencies [5edd916]
- Updated dependencies [5a16359]
- Updated dependencies [025d6f5]
- Updated dependencies [b1ed4ef]
- Updated dependencies [985a92f]
- Updated dependencies [b889326]
- Updated dependencies [1efc6d5]
- Updated dependencies [4162e4a]
- Updated dependencies [fad4c08]
- Updated dependencies [7b66d8d]
- Updated dependencies [4bb44ef]
- Updated dependencies [30061cb]
- Updated dependencies [77b0100]
- Updated dependencies [8d33c60]
- Updated dependencies [7a3458a]
  - @labre/std@0.32.0
  - @labre/affine-shared@0.32.0
  - @labre/affine-widget-drag-handle@0.32.0
  - @labre/store@0.32.0
  - @labre/affine-components@0.32.0
  - @labre/data-view@0.32.0
  - @labre/affine-model@0.32.0
  - @labre/affine-inline-preset@0.32.0
  - @labre/global@0.32.0
  - @labre/affine-widget-slash-menu@0.32.0
  - @labre/affine-inline-reference@0.32.0
  - @labre/affine-rich-text@0.32.0
  - @labre/affine-ext-loader@0.32.0

## 0.31.0

### Patch Changes

- Updated dependencies [6a663b6]
  - @labre/store@0.31.0
  - @labre/affine-components@0.31.0
  - @labre/data-view@0.31.0
  - @labre/affine-ext-loader@0.31.0
  - @labre/affine-inline-preset@0.31.0
  - @labre/affine-inline-reference@0.31.0
  - @labre/affine-model@0.31.0
  - @labre/affine-rich-text@0.31.0
  - @labre/affine-shared@0.31.0
  - @labre/affine-widget-drag-handle@0.31.0
  - @labre/affine-widget-slash-menu@0.31.0
  - @labre/std@0.31.0
  - @labre/global@0.31.0

## 0.30.2

### Patch Changes

- @labre/affine-components@0.30.2
- @labre/data-view@0.30.2
- @labre/affine-ext-loader@0.30.2
- @labre/affine-inline-preset@0.30.2
- @labre/affine-inline-reference@0.30.2
- @labre/affine-model@0.30.2
- @labre/affine-rich-text@0.30.2
- @labre/affine-shared@0.30.2
- @labre/affine-widget-drag-handle@0.30.2
- @labre/affine-widget-slash-menu@0.30.2
- @labre/global@0.30.2
- @labre/std@0.30.2
- @labre/store@0.30.2

## 0.30.1

### Patch Changes

- @labre/affine-components@0.30.1
- @labre/data-view@0.30.1
- @labre/affine-ext-loader@0.30.1
- @labre/affine-inline-preset@0.30.1
- @labre/affine-inline-reference@0.30.1
- @labre/affine-model@0.30.1
- @labre/affine-rich-text@0.30.1
- @labre/affine-shared@0.30.1
- @labre/affine-widget-drag-handle@0.30.1
- @labre/affine-widget-slash-menu@0.30.1
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
  - @labre/affine-components@0.30.0
  - @labre/data-view@0.30.0
  - @labre/affine-inline-preset@0.30.0
  - @labre/affine-inline-reference@0.30.0
  - @labre/affine-rich-text@0.30.0
  - @labre/affine-shared@0.30.0
  - @labre/affine-widget-drag-handle@0.30.0
  - @labre/affine-widget-slash-menu@0.30.0
  - @labre/affine-ext-loader@0.30.0
  - @labre/global@0.30.0
  - @labre/store@0.30.0

## 0.29.1

### Patch Changes

- @labre/affine-components@0.29.1
- @labre/data-view@0.29.1
- @labre/affine-ext-loader@0.29.1
- @labre/affine-inline-preset@0.29.1
- @labre/affine-inline-reference@0.29.1
- @labre/affine-model@0.29.1
- @labre/affine-rich-text@0.29.1
- @labre/affine-shared@0.29.1
- @labre/affine-widget-drag-handle@0.29.1
- @labre/affine-widget-slash-menu@0.29.1
- @labre/global@0.29.1
- @labre/std@0.29.1
- @labre/store@0.29.1

## 0.29.0

### Patch Changes

- Updated dependencies [7375b9a]
- Updated dependencies [9330750]
  - @labre/affine-shared@0.29.0
  - @labre/std@0.29.0
  - @labre/affine-components@0.29.0
  - @labre/data-view@0.29.0
  - @labre/affine-inline-preset@0.29.0
  - @labre/affine-inline-reference@0.29.0
  - @labre/affine-rich-text@0.29.0
  - @labre/affine-widget-drag-handle@0.29.0
  - @labre/affine-widget-slash-menu@0.29.0
  - @labre/affine-model@0.29.0
  - @labre/affine-ext-loader@0.29.0
  - @labre/global@0.29.0
  - @labre/store@0.29.0

## 0.28.0

### Minor Changes

- 1cd6c92: Add `ExternalDataSourceBase` and a rebuildable, disposable database source
  (closes #22).

  Hosts that back an `affine:database` with their own collection (via
  `DatabaseDataSourceProvider`) previously had to reimplement the whole
  `DataSourceBase` (~33 abstract members). They can now extend
  **`ExternalDataSourceBase`**, which keeps the view config in the model blob and
  implements all the generic machinery — view manager / metas / converts, view-data
  CRUD, feature flags, readonly, and the reactive plumbing. A concrete source only
  provides a small synchronous data contract (`getRows`, `getCellValue`,
  `getProperty*`, `getPropertyMetas`) plus the mutations, and calls the protected
  `invalidate()` from its own change observers to refresh the view. The inline blob
  source (`DatabaseBlockDataSource`) now extends this base, so it keeps exercising
  every shared code path.

  `DataSourceBase` gains an overridable `dispose()`. The database block now holds a
  _reference_ to its source: it rebuilds (and disposes the old one) whenever
  `externalSourceId` changes — covering promote-swap, detach, import and re-point —
  and disposes on disconnect, ending the observer leak. The block never couples the
  source's lifecycle to its own (a source may be embedded in several blocks).

### Patch Changes

- Updated dependencies [1cd6c92]
- Updated dependencies [65cc055]
  - @labre/data-view@0.28.0
  - @labre/std@0.28.0
  - @labre/affine-components@0.28.0
  - @labre/affine-inline-preset@0.28.0
  - @labre/affine-inline-reference@0.28.0
  - @labre/affine-model@0.28.0
  - @labre/affine-rich-text@0.28.0
  - @labre/affine-shared@0.28.0
  - @labre/affine-widget-drag-handle@0.28.0
  - @labre/affine-widget-slash-menu@0.28.0
  - @labre/affine-ext-loader@0.28.0
  - @labre/global@0.28.0
  - @labre/store@0.28.0

## 0.27.0

### Patch Changes

- 14ef3e7: feat(database): export databaseBlockViews (view metas) for external DataSources

  An external `DataSource` (the seam from #18) must populate `viewMetas` with the
  table + kanban `ViewMeta`, exactly as the inline `DatabaseBlockDataSource` does
  via `viewMetas = databaseBlockViews`. Those metas were defined in `./views` but
  not re-exported from the package index, so host apps couldn't reach them.

  Re-export `./views` from the package surface — `databaseBlockViews`,
  `databaseBlockViewMap`, `databaseBlockViewConverts` are now importable. No
  behavior change to the inline block.

- Updated dependencies [91f6397]
  - @labre/std@0.27.0
  - @labre/affine-components@0.27.0
  - @labre/data-view@0.27.0
  - @labre/affine-inline-preset@0.27.0
  - @labre/affine-inline-reference@0.27.0
  - @labre/affine-model@0.27.0
  - @labre/affine-rich-text@0.27.0
  - @labre/affine-shared@0.27.0
  - @labre/affine-widget-drag-handle@0.27.0
  - @labre/affine-widget-slash-menu@0.27.0
  - @labre/affine-ext-loader@0.27.0
  - @labre/global@0.27.0
  - @labre/store@0.27.0

## 0.26.0

### Minor Changes

- 8960a6c: feat(database): pluggable DataSource for affine:database (injection seam)

  The inline database block (`affine:database`) always built its own
  `DatabaseBlockDataSource`, so a host app could not back it with an external
  source. This adds a minimal, backward-compatible injection seam:

  - New optional model prop `externalSourceId?: string` (schema version 3 → 4;
    no runtime migration — optional prop with a default).
  - New `DatabaseDataSourceProvider` identifier (exported from
    `@labre/affine-block-database`). When a host registers it **and** the block
    carries an `externalSourceId`, the block renders via the injected source.

  With no provider registered and no `externalSourceId`, behavior is identical to
  before. Persistence stays entirely host-side.

### Patch Changes

- Updated dependencies [8960a6c]
- Updated dependencies [6795191]
  - @labre/affine-model@0.26.0
  - @labre/affine-components@0.26.0
  - @labre/affine-inline-preset@0.26.0
  - @labre/affine-inline-reference@0.26.0
  - @labre/affine-rich-text@0.26.0
  - @labre/affine-shared@0.26.0
  - @labre/affine-widget-drag-handle@0.26.0
  - @labre/data-view@0.26.0
  - @labre/affine-widget-slash-menu@0.26.0
  - @labre/affine-ext-loader@0.26.0
  - @labre/global@0.26.0
  - @labre/std@0.26.0
  - @labre/store@0.26.0

## 0.25.0

### Minor Changes

- 8960a6c: feat(database): pluggable DataSource for affine:database (injection seam)

  The inline database block (`affine:database`) always built its own
  `DatabaseBlockDataSource`, so a host app could not back it with an external
  source. This adds a minimal, backward-compatible injection seam:

  - New optional model prop `externalSourceId?: string` (schema version 3 → 4;
    no runtime migration — optional prop with a default).
  - New `DatabaseDataSourceProvider` identifier (exported from
    `@labre/affine-block-database`). When a host registers it **and** the block
    carries an `externalSourceId`, the block renders via the injected source.

  With no provider registered and no `externalSourceId`, behavior is identical to
  before. Persistence stays entirely host-side.

### Patch Changes

- Updated dependencies [8960a6c]
- Updated dependencies [6795191]
  - @labre/affine-model@0.25.0
  - @labre/affine-components@0.25.0
  - @labre/affine-inline-preset@0.25.0
  - @labre/affine-inline-reference@0.25.0
  - @labre/affine-rich-text@0.25.0
  - @labre/affine-shared@0.25.0
  - @labre/affine-widget-drag-handle@0.25.0
  - @labre/data-view@0.25.0
  - @labre/affine-widget-slash-menu@0.25.0
  - @labre/affine-ext-loader@0.25.0
  - @labre/global@0.25.0
  - @labre/std@0.25.0
  - @labre/store@0.25.0

## 0.24.0

### Patch Changes

- @labre/affine-components@0.24.0
- @labre/data-view@0.24.0
- @labre/affine-ext-loader@0.24.0
- @labre/affine-inline-preset@0.24.0
- @labre/affine-inline-reference@0.24.0
- @labre/affine-model@0.24.0
- @labre/affine-rich-text@0.24.0
- @labre/affine-shared@0.24.0
- @labre/affine-widget-drag-handle@0.24.0
- @labre/affine-widget-slash-menu@0.24.0
- @labre/global@0.24.0
- @labre/std@0.24.0
- @labre/store@0.24.0

## 0.23.3

### Patch Changes

- Updated dependencies
  - @labre/affine-shared@0.23.3
  - @labre/affine-components@0.23.3
  - @labre/data-view@0.23.3
  - @labre/affine-inline-preset@0.23.3
  - @labre/affine-inline-reference@0.23.3
  - @labre/affine-rich-text@0.23.3
  - @labre/affine-widget-drag-handle@0.23.3
  - @labre/affine-widget-slash-menu@0.23.3
  - @labre/affine-ext-loader@0.23.3
  - @labre/affine-model@0.23.3
  - @labre/global@0.23.3
  - @labre/std@0.23.3
  - @labre/store@0.23.3

## 0.23.2

### Patch Changes

- Updated dependencies [ee682da]
  - @labre/affine-shared@0.23.2
  - @labre/affine-components@0.23.2
  - @labre/data-view@0.23.2
  - @labre/affine-inline-preset@0.23.2
  - @labre/affine-inline-reference@0.23.2
  - @labre/affine-rich-text@0.23.2
  - @labre/affine-widget-drag-handle@0.23.2
  - @labre/affine-widget-slash-menu@0.23.2
  - @labre/affine-ext-loader@0.23.2
  - @labre/affine-model@0.23.2
  - @labre/global@0.23.2
  - @labre/std@0.23.2
  - @labre/store@0.23.2

## 0.23.1

### Patch Changes

- Updated dependencies [1beb60e]
  - @labre/affine-shared@0.23.1
  - @labre/affine-components@0.23.1
  - @labre/data-view@0.23.1
  - @labre/affine-inline-preset@0.23.1
  - @labre/affine-inline-reference@0.23.1
  - @labre/affine-rich-text@0.23.1
  - @labre/affine-widget-drag-handle@0.23.1
  - @labre/affine-widget-slash-menu@0.23.1
  - @labre/affine-ext-loader@0.23.1
  - @labre/affine-model@0.23.1
  - @labre/global@0.23.1
  - @labre/std@0.23.1
  - @labre/store@0.23.1

## 0.23.0

### Patch Changes

- Updated dependencies [9014c87]
- Updated dependencies [c775151]
  - @labre/affine-model@0.23.0
  - @labre/affine-shared@0.23.0
  - @labre/affine-components@0.23.0
  - @labre/affine-inline-preset@0.23.0
  - @labre/affine-inline-reference@0.23.0
  - @labre/affine-rich-text@0.23.0
  - @labre/affine-widget-drag-handle@0.23.0
  - @labre/data-view@0.23.0
  - @labre/affine-widget-slash-menu@0.23.0
  - @labre/affine-ext-loader@0.23.0
  - @labre/global@0.23.0
  - @labre/std@0.23.0
  - @labre/store@0.23.0
