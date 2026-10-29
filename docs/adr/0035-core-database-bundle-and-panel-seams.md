# ADR 0035 — The core-database bundle: stored databases render in core, the editing chrome ships apart; database panel seams

- Status: proposed
- Date: 2026-10-13
- Deciders: Mathieu Jolly
- **Red zone.** This ADR describes two red-zone changes without making them:
  the bundle scripts (`scripts/build-bundles.mjs`, §4) and new optional fields
  in the stored view data of `affine:database` (`props.views`, §8). Each lands
  in its own PR with a maintainer's approval (issues B14 and B1/B8).
- Relates to [ADR 0008](./0008-command-registry-foundation.md) (commands,
  § Packaging), [ADR 0009](./0009-reversed-flag-contract.md) (flags gate
  tooling, never content), [ADR 0003](./0003-telemetry-bus-and-taxonomy.md)
  (the library emits, the host transports), [ADR 0006](./0006-pivot-properties-provider.md)
  (typed, render-free values read as signals), [ADR 0023](./0023-every-displayed-string-through-a-key.md)
  (every string a key) and [ADR 0034](./0034-panel-seams-and-host-panels-facade.md)
  (one seam per panel the library opens, one façade for the host's panels).
- Host side, in the Labre app (`formicoidea/labre`), never restated here:
  labre ADR-0046 « Objet Base » (the base document, its `labre:sources` map,
  sources and their rows), labre ADR-0047 « Fiche de propriétés » (values in
  SQL, `page_properties`), labre ADR-0002 (the deviations from AFFiNE this
  ADR causes).

## Context

The Labre product is getting Notion-like databases ("bases"): rows are
documents, a database can have several data sources (product owner,
2026-10-13), each view targets one source, the views are Table, Board,
Gallery and List, and a row opens in a side preview, a centred window or a
full page, per view. Property values do not live in any Y.Doc: the host keeps
them in SQL and the library reads and writes them through a seam. The product
owner chose on 2026-10-12 to keep the view engine in the core bundle and to
ship the editing chrome in a new bundle of the library (PRD « Labre v2 :
refonte UI/UX, page system, base system, fils », decision D19 option B, and
its study 2 « bundle core-database »). This ADR fixes the library side.

What the code says at 0.46.1 (`f8272bc`):

- **The engine cannot leave core.** `@labre/data-view` and
  `@labre/affine-block-database` are imported by `foundation/src/effects.ts:31`,
  `blocks/root/src/configs/toolbar.ts:4`, `widgets/toolbar/src/toolbar.ts:1`,
  `widgets/keyboard-toolbar/src/config.ts:2` and `blocks/data-view`. A bundle
  carved out of them would make core import its own dependent, which
  `resolveToVendored` in `scripts/build-bundles.mjs` already refuses.
- **The database block is one gated extension.** `all/src/extensions/view.ts:196-197`
  registers `DataViewViewExtension` under `on('data-view')` and
  `DatabaseViewExtension` under `on('database')`; the latter carries both the
  block view and the slash menu (`blocks/database/src/view.ts`). With
  `{ database: false }` a stored database renders nothing: the known gap of
  ADR 0009's consequences, closed so far for `callout` only.
- **An unknown view throws.** `viewMetaGet` in
  `blocks/database/src/external-data-source.ts:208-216` throws
  `Unknown view type`; the presets are table, kanban and calendar
  (`blocks/database/src/views/index.ts`), and calendar is creatable from the
  slash menu (`configs/slash-menu.ts:52`), so calendar views may be stored.
- **One schema per block.** `ExternalDataSourceBase(model)` reads its columns
  from the block that hosts its views. A database whose views span several
  sources has no place to say which schema a view reads.
- **Read-only on mobile.** `readonly$` includes `IS_MOBILE`
  (`external-data-source.ts:161-162`).
- **A row opens one way.** `database-block.ts:487-489` routes
  `openDetailPanel` to `PeekViewProvider`, with no mode.
- **One host data seam exists.** `DatabaseDataSourceProvider`
  (`blocks/database/src/service/index.ts`), used when the block carries an
  `externalSourceId` (`database-block.ts:179-183`), with a synchronous read
  contract. The Labre app registers its collection source there.
- **View data is an open record per mode** stored in `props.views`
  (`ViewBasicDataType { id, name, mode }` in
  `model/src/blocks/database/types.ts`, plus each preset's data, e.g.
  `data-view/src/view-presets/table/define.ts`). Table and kanban already
  store per-view property visibility as `columns[].hide`.
- **Bundles.** `build-bundles.mjs` vendors every umbrella dependency into
  `@formicoidea/labre-core` except `EXCLUDED_FROM_CORE` (the frameworks and
  `ddd-shared`), and strips each framework's import, registration lines and
  flag from core's copies of `extensions/view.ts` and `flags.ts`.
  `compile-bundles.mjs` and `publish-bundles.mjs` derive their order from the
  emitted manifests (`compile-bundles.mjs:52`, `publish-bundles.mjs:27`).

Every stored database must keep rendering in a host that installs core only
(labre-mcp, the marketing demo, any third party).

## Decision

1. **Content renders in core; the editing chrome ships in
   `@formicoidea/labre-core-database`.** The test: a core-only host shows
   every stored database, every stored view and every value its source
   provides, editable cell by cell. The bundle adds ways to create and
   arrange, never a way to see.

   | Stays in core (`@labre/data-view`, `blocks/database`, `affine-shared`)                                                                                                                                                                                                                                                                   | New package `packages/affine/database-editor` (`@labre/affine-database-editor`)                                                                                                                                                                                                                                            |
   | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
   | the view engine; the `affine:database` block; every preset that renders stored data (table, kanban, calendar render-only, new gallery and list); the unknown-view fallback; per-view fields; one schema per source; cell hydration; mobile editing; the row-open seam; the properties panel seam; the title band seam and the chips band | the Notion view bar (inline and full page, tabs then "N more"); the full-page database host; "+ view" with its source choice; the "Open pages in" setting; the library's own properties panel element; the data-source picker seam and the entries that call it; its `com.labre.database.*` wordings; its telemetry events |

   Hosts alias the bundle as `@labre/core-database`.

2. **The name is `core-database`.** It is not a `framework-*`: that prefix
   means an entry in `FRAMEWORK_DESCRIPTORS`, with a senior button, a
   `FrameworkId` and a notation; this has none. `core-` says lockstep: it
   pins the exact core version, extends core's own block and is released
   with it. It is not `base` or `base-editor`: "base" is the host's object (a
   document kind with members, rights and a parent), which the library does
   not know. Library identifiers say `database`, never `base`. The workspace
   directory says what it holds (`database-editor`); the published name says
   where it sits.
3. **Dependency rule between bundles.** `labre-core-database` depends on
   `@formicoidea/labre-core` at the exact version and on no other bundle;
   core never imports it (already a build error); no framework bundle and not
   `ddd-shared` imports it, and it imports none of them. A seam identifier
   lives in the lowest package that reads it, so the bundle may call a core
   seam and core never needs the bundle. What both need goes in core.
4. **The bundle script change (B14, red zone, described here, written in its
   own PR).**
   - `packages/affine/all/src/frameworks.ts` gains a third data-only list,
     `EDITOR_BUNDLES`, with one entry: `bundle: 'core-database'`,
     `pkg: '@labre/affine-database-editor'`, `dir: 'affine/database-editor'`,
     `info: 'coreDatabaseBundle'`, and two extensions, an always-on
     `DatabaseEditorViewExtension` (view bar, full-page host, panel element)
     and `DatabaseEditorToolingViewExtension` under the `database` flag
     (creation entries).
   - `build-bundles.mjs` reads it like `AUXILIARY_BUNDLES`: the package joins
     `EXCLUDED_FROM_CORE`; its import and registration lines are stripped from
     core's copy of `extensions/view.ts` and its group from `translations.ts`,
     as for a framework; **its flag is not stripped from `flags.ts`**, because
     `database` is core's own key and core's creation tooling still reads it.
     That one difference is why it is a separate list and not an
     `AUXILIARY_BUNDLES` entry, whose flags the script strips.
   - The emitted manifest: `exports` `.`, `./view` and `./descriptor` (the
     multi-extension descriptor shape), `dependencies`
     `{ '@formicoidea/labre-core': VERSION, …third-party }`, and the
     `LICENSE` through `copyLicense`. If the bundle contributes command
     descriptors it ships a data-only `./commands-manifest`, checked like a
     framework's.
   - `compile-bundles.mjs` and `publish-bundles.mjs` need no change: they
     order from the manifests, so core-database compiles and publishes after
     core.
   - The umbrella `@labre/affine` registers both extensions in
     `extensions/view.ts`, so the playground and the integration suite
     exercise them; only core's published copy loses them.
5. **No new flag key.** B4 splits the database the way `callout` was split:
   an always-on `DatabaseRenderViewExtension` (block view, presets, cells,
   row opening) and `DatabaseViewExtension` under `database` (slash entries,
   view creation); `data-view` the same. The bundle's two extensions follow
   the same line under the same key. The host's kill switch on creating a
   database is not a library flag: it is whether the host passes
   `createDatabase` to the picker seam (§9c). When the host fills that
   seam, the slash entries that create a database ("Table View" and its
   siblings, `configs/slash-menu.ts`) call `createDatabase` instead of
   inserting a native inline database, then insert a linked view of what the
   host returns: a native database is no longer offered for creation but
   every stored one still renders (labre ADR-0046). Without the seam, the
   entries behave as in 0.46.
6. **An unknown view degrades to a table; calendar is render-only.**
   `viewMetaGet` never throws: an unknown `mode` renders through the table
   preset over the source's properties, its stored data is never rewritten
   (nothing is written on load), its view settings are read-only and its tab
   says "Shown as a table" (a key). `views/index.ts` splits renderable from
   creatable presets: calendar stays renderable and leaves every path that
   creates one: the slash entry (`configs/slash-menu.ts:52`), "Create …" in
   the views bar (`data-view/.../views-bar/views-view.ts:139`, which lists
   `viewMetas`), the Layout switch (`.../view-options/view-options.ts:260`)
   and the conversions into calendar (`view-presets/convert.ts:31-40`); the
   conversions out of calendar stay, so a stored calendar can become a table
   or a board; a timeline was never a preset here, so a
   stored `timeline` takes the unknown path. Guard
   `unknown-view-fallback.unit.spec.ts` (`blocks/database`, B3): a block with
   views `calendar`, `timeline` and an invented mode mounts without throwing
   and its `props.views` is deep-equal before and after; a parity line holds
   creatable ⊂ renderable, and no menu (views bar, Layout, conversions)
   offers `calendar` as a target.
7. **One schema per source (B1).** `ExternalDataSourceBase` becomes
   `HostedDataSourceBase(hostModel, resolveSource)`: the views stay in
   `hostModel.props.views`; a view names the source it reads by an optional
   `sourceId` in its view data; absent, it reads the block's single implicit
   source, which is every database stored today. `resolveSource(sourceId)`
   returns that source's schema owner (an `affine:database` block model) and
   its rows. Where the host keeps its sources and their schema blocks is the
   host's format (labre ADR-0046): the library never reads a `labre:*` key.
   An inline linked view keeps using `externalSourceId` plus the per-view
   `sourceId`; no new block prop, no new flavour.
8. **Stored view-data fields (red zone, B1 and B8).** Appended as optional,
   `undefined` by default, never written on load: `sourceId?: string` and
   `openIn?: 'side' | 'center' | 'full'` (append-only; absent reads `side`).
   Gallery and list store per-view visibility in the shape table and kanban
   already use, `columns[].hide`. A 0.46 client ignores the new fields; an
   older client meeting a `gallery` or `list` view takes its own unknown-view
   path (a throw before B3 ships, which is why B3 ships first).
9. **The seams the host fills.** Each adds its row to
   `docs/integrate/04-host-seams.md` and a test that mounts without it, in the
   PR that ships it.
   - a. **Open a row** (B9): `DatabaseOpenRowExtension({ open(req) } | null)`,
     in core (`blocks/database`), because core's row click reads it.
     `req = { docId, mode, newTab }`; `mode` is the view's `openIn`;
     Ctrl/Cmd-click sends `full` with `newTab: true`. Read only when the
     source says its rows are documents (`rowsAreDocuments`, read-only, on the
     hosted source); a block-backed row keeps the detail
     panel.
   - b. **Properties panel** (B10): `PropertiesPanelExtension({ open(req), close } | null)`,
     in core (`affine-shared/services`), shaped as ADR 0034 §1, one panel
     with a typed request like the catalogue's `open(owner)`.
     `req = { scope: 'page', docId }` (the chips band's button) or
     `{ scope: 'source', docId, blockId, sourceId, viewId? }` (the view bar,
     the view settings). The library's own panel element ships in the bundle;
     a host mounts it in its left sidebar, or draws its own and calls the
     verbs §10 adds to `@labre/affine/host-panels`.
   - c. **Data-source picker** (B12):
     `DataSourcePickerExtension({ list(), createDatabase?(), createSource?(databaseId) } | null)`,
     in the bundle (only the bundle reads it). `list()` returns a signal of
     `{ id, title, sources: { id, title }[] }[]`. Callers: the "Linked view of
     a database" entry, the creating slash entries (§5) and "+ view" ("on an
     existing source" or "with a new source").
   - d. **Title band** (P1, before B1): `TitleBandExtension(service)` /
     `TitleBandProvider`, in core (`affine-shared/services`), the one seam
     that feeds the band under the page title and in the note header. Its
     property sheet, read:
     `sheet$(docId)` returns a signal synchronously, `loading`, `ready`,
     `missing` or `error` as in ADR 0006; `ready` holds the ordered visible
     properties `{ id, namespace: 'workspace' | 'database', name, type, data, value, readonly }`
     where `type` and `data` are a data-view property type and its config and
     `value` the JSON a data-view cell holds, so a chip and a cell render with
     the same property preset. Visibility is resolved by the host; a visible
     property with no value comes back with an empty value and draws an empty
     chip. Write: `set(docId, propertyId, value): Promise<void>`; the library
     shows the pending state and never applies the value itself, the host's
     store does and owns the rollback. Optional `add(docId)` (the "+") and
     `collapsed$(docId)` / `setCollapsed(docId, v)`. The library never learns
     where values live. Not `PivotPropertiesProvider` (ADR 0006): that seam
     is keyed by an element's `pivotDocId`, read-only, with its own value
     union; the sheet is keyed by a document, written, and speaks the
     data-view property types. A row's values thus reach the library twice,
     through its sheet (the chips) and through the database's source (the
     cells): the host backs both with one store, the library never caches
     either.
     The band takes one more host row, optional: `notShown$(docId)`, a signal
     of `{ docId, title }[]`, the child pages this document holds but does
     not display (labre ADR-0045). The library reads it **in the canvas view
     only** and draws it in the note header as a "Not shown in this
     document" row (a key) of page links that open through the
     linked-document path. In the page view the library never draws it: the
     host draws that row under the title itself, so a document never shows
     two. The host decides what belongs there; the library never computes a
     parent or a child. Absent or empty, no row.
   - e. **Cell hydration** (B2), a widening of the `DataSourceBase` contract
     rather than a seam: `cellStatus(rowId, propertyId)` is `ready`,
     `pending` or `error`; `valuesState$` is a signal of
     `{ status: 'loading' | 'ready' | 'error', since }`; optional
     `retryValues()`. The base class answers `ready` always, so the inline
     source and every 0.46 host source are unchanged. A pending cell draws a
     skeleton; filter and group counts show an ellipsis until `ready`; after
     3 s a banner says the values are loading; on `error` the cells stay
     empty and a banner offers Retry. Nothing is written in any state. Inline
     views behave the same.
   - f. **Row titles** (B15): a hosted source answers the title property as a
     plain string from its own store; no row's document is loaded to draw a
     title. No new seam.
10. **Host-panels verbs and commands (B10).** What a host's properties panel
    needs (read a source's properties and their visibility in a view, hide,
    show, reorder, rename, add) is added to `@labre/affine/host-panels`
    (core), and every write is a core command run through `runCommand`
    (ADR 0034 §5), so the library's panel and a host's write the same way.
11. **The chips band is core.** One component under the page title and in the
    note header, inside the note's transform so it follows the zoom, drawn
    with the data-view property presets, fed by §9d alone (the note header
    also draws the "Not shown in this document" row, §9d). A page has
    properties whether or not it is a row, and the band ships in P1, before
    the bundle exists.
12. **Telemetry (B17)** follows the taxonomy README: PascalCase events
    (`DatabaseRowOpened { mode, newTab }`, `DatabaseViewAdded { viewType, source: 'existing' | 'new' }`,
    `DatabaseValuesLoadFailed`, …), ids only, never a value, a title or a
    property name. A `base.*` namespace is the host's own.

## Seams table rows (to add with the code)

| Seam                                        | Register with                                                                     | When absent                                                                                                                                                                                                                                                                                                                            |
| ------------------------------------------- | --------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Open a database row                         | `DatabaseOpenRowExtension({ open })` or `(null)`                                  | rows open through the peek view as in 0.46 and the view's "Open pages in" setting has no effect; with no peek view either, the open button is hidden. `null` says the same as absent                                                                                                                                                   |
| Properties panel                            | `PropertiesPanelExtension({ open, close })` or `(null)`                           | no panel button beside the chips band's "+"; a view's properties stay reachable through the data-view's own properties popover, the only way back to a hidden property. `null` says the same as absent                                                                                                                                 |
| Data-source picker (`@labre/core-database`) | `DataSourcePickerExtension({ list, createDatabase?, createSource? })` or `(null)` | no "Linked view of a database" entry and "+ view" offers only the sources the block already shows; without `createDatabase` nothing creates a database (the host's kill switch); without `createSource`, no "with a new source"                                                                                                        |
| Title band                                  | `TitleBandExtension(service)`                                                     | no band under the title or in the note header: no chips, no "Not shown in this document" row; nothing else changes, since no value lives in the document. Without `add`, no "+"; without `collapsed$`, the band opens expanded every time; without `notShown$`, no such row in the note header (the page view's row is the host's own) |
| Cell hydration (DataSource contract)        | implement `cellStatus` / `valuesState$` / `retryValues` on the host's data source | every cell is ready at once, no skeleton and no banner: the 0.46 behaviour                                                                                                                                                                                                                                                             |

## Consequences

- **What stays loadable.** Every database stored by 0.46 renders, in core
  alone, with every flag off: B4 removes the last way a flag blanked one, B3
  the last way a view mode crashed one. The new view-data fields are optional
  and never written on load; `externalSourceId` keeps its meaning.
- **For a host.** It installs `@labre/core-database` beside
  `@labre/affine`, registers the bundle's always-on extension
  unconditionally and the tooling one under its `database` flag, and fills
  the seams above. A host that installs nothing new loses no content and no
  feature it has today. Every new `@formicoidea/*` range is bumped together.
- **For a contributor.** A database change asks first: does a stored
  database need it to be seen? Then it is core. Only creation and
  arrangement chrome go to `database-editor`. The bundle never gets a model,
  a store extension or a schema.
- **Docs to update with the code:** `CLAUDE.md` § Library contract (the
  bundle list), `docs/integrate/01-install.md`, `03-flags.md` (the
  `database` split), `04-host-seams.md` (the rows above), `08-host-panels.md`
  (the verbs), the `flags.ts` docblock's "known gap", and an amendment to
  ADR 0009 when B4 lands.
- **Blast radius (wicked features).** It touches the nearly thirty host
  seams (four rows and one contract widening, each with a `null` or default
  story), the persisted format (two optional view fields, B8 reviewed as red
  zone), the bundle list (one bundle, one list in `frameworks.ts`, no
  dependency between bundles), the key catalogue (`com.labre.database.*`, FR
  in the host) and the two views of a document (the chips band in page title
  and note header). It creates no new flag key, no new block flavour, no new
  element type and no framework. The one new wicked surface is "a database
  has several sources", kept behind one contract, `resolveSource`.
- **Guards** (all in this repo, created by the issue named):
  `unknown-view-fallback.unit.spec.ts` (B3);
  `database-render-gating.unit.spec.ts`, `{ database: false, 'data-view': false }`
  still renders a stored database, modelled on `callout-turn-into-gating`
  (B4); a "mounts without the provider" spec per seam (B9, B10, B12, P1
  title band); `hydration-status.unit.spec.ts`, a source with no `cellStatus`
  draws no skeleton (B2); `core-database-boundary.unit.spec.ts`
  (`affine/all`), no package vendored into core imports
  `@labre/affine-database-editor` and the bundle imports no framework (B14).
  `unknown-view-fallback` names this library spec only; the host side is
  held by labre's `lib-boundary.test.ts`.

## Issues B1 to B17

| #   | Issue                                                                                        | Package              | Decision |
| --- | -------------------------------------------------------------------------------------------- | -------------------- | -------- |
| B1  | data-view: one schema per source, `HostedDataSourceBase(hostModel, resolveSource)`           | core (data-view)     | §7, §8   |
| B2  | data-view: cell hydration status, skeletons and banners                                      | core (data-view)     | §9e      |
| B3  | database: an unknown view falls back to a table; calendar render-only, no conversion into it | core (database)      | §6       |
| B4  | database: split the render view extension from creation tooling                              | core (database, all) | §5       |
| B5  | database: mobile editing (`readonly$` no longer forced by `IS_MOBILE`)                       | core (database)      | §1       |
| B6  | data-view: gallery preset                                                                    | core (data-view)     | §1, §8   |
| B7  | data-view: list preset                                                                       | core (data-view)     | §1, §8   |
| B8  | data-view: per-view visibility on every preset and the `openIn` view field (red zone)        | core (data-view)     | §8       |
| B9  | `DatabaseOpenRowExtension`                                                                   | core (database)      | §9a      |
| B10 | `PropertiesPanelExtension` (source scope), panel element, host-panels verbs                  | core + bundle        | §9b, §10 |
| B11 | Notion view bar widget, inline and full page                                                 | bundle               | §1       |
| B12 | `DataSourcePickerExtension`                                                                  | bundle               | §9c      |
| B13 | full-page database host                                                                      | bundle               | §1       |
| B14 | `database-editor` package and the `core-database` bundle in the scripts (red zone)           | scripts, all         | §3, §4   |
| B15 | title column read from the source, no row document loaded                                    | core (data-view)     | §9f      |
| B16 | data-view: dark-mode token audit                                                             | core (data-view)     | §1       |
| B17 | telemetry: database events in the taxonomy                                                   | core + bundle        | §12      |

The title band seam, the page scope of the properties panel seam and
the chips band (§9b, §9d, §11) are P1 work in core and carry no B number.
B3 and B4 ship before B6 and B7, so no host meets a stored gallery view it
cannot draw.

## Amendments

### 2026-10-13: the "Not shown on this page" row, both views, with "Show here"

Amends §9d and §11 (and the title band row of the seams table above). Asked by
the Labre v2 page system (labre ADR-0045 §7, amended there the same day).

- **The library draws the row in both views.** §9d had the library read
  `notShown$` on the canvas only and left the page view's row to the host,
  under the title. The band already sits under the title in the page view, so
  a second component there drew the same list twice over two code bases. The
  band now reads `notShown$` in both views and draws the row under its chips;
  a host that drew its own row under the title drops it. The seam is
  unchanged: same optional `notShown$(docId)`, same `{ docId, title }[]`.
- **"Show here" (`com.labre.title-band.show-here`).** Each listed page gains a
  button that inserts an `affine:embed-linked-doc` card of it into the open
  document: at the end of the last note the page view shows (a new note when
  there is none) in the page view; centred in the visible canvas, as a
  `vertical` card, through the CRUD `addBlock` that stamps the viewer's active
  layer (ADR 0031 §6), then selected, on the canvas. One gesture is one undo
  step (`captureSync`); it emits `BlockCreated`. A read-only document keeps the
  page links and gets no button. The title still opens the page through the
  linked-document path, and without `RefNodeSlotsProvider` there is still no
  row at all.
- **The row says "page".** Its English fallback becomes "Not shown on this
  page" (was "Not shown in this document"), same key
  `com.labre.title-band.not-shown`: in Labre v2 everything is a page (product
  owner decision, 2026-10-13).
- **The library still computes nothing.** It writes the card and nothing else:
  no parent, no child, no tree. Dropping the page from `notShown$` once the
  card exists is the host's reading of the document (labre ADR-0045 §7,
  `displayedChildren`). The card is the ordinary linked-doc block, with no new
  prop: no stored format changes.
- Held by `fragments/doc-title/src/__tests__/title-band.unit.spec.ts` (both
  views, the insert in each view, read-only, no provider) and
  `integration-test/src/__tests__/edgeless/title-band.spec.ts` (a rendered card
  at the end of the note and at the canvas centre, one undo step, and the
  canvas's linked and synced cards of a page).

### 2026-10-13: the chips are the inline table's cells

Amends §11 ("drawn with the data-view property presets", which P1 deferred:
the band drew its own chips and editors). Asked by the product owner: the
library reuses the components it already designed, never a second drawing.

- **One drawing per type.** Each chip mounts the cell renderer a table cell
  mounts (`checkbox`, `select`, `multi-select`, `date`, `number`,
  `progress`, `text`, and the database block's `link`) for display and
  edit, with the table's own styles and popups (the tag menu, the date
  picker): in the page view and in the note header, where it follows the zoom.
  The band keeps only its layout (name, value, "+", panel button, collapse)
  and the "Not shown on this page" row, unchanged.
- **The smallest seam in data-view: a cell outside any view.**
  `createStandaloneCell(meta, source)` builds a `Cell` over signals with no
  view, row or data source, providing only what the presets read (the
  property's name, config, type and read-only state, the view's flags and
  `serviceGet`); `<dv-standalone-cell>` mounts its renderer and owns the
  table's edit lifecycle. `standalone-cell.unit.spec.ts` mounts every preset
  through it, so a renderer that starts reading more fails there.
- **A registry for a cell owned above the band.** The link cell lives in
  `blocks/database`, which depends on `doc-title` (through the note and the
  drag handle): it registers itself with `StandaloneCellMetaExtension` from
  the database view extension, and the band looks it up by type. Without that
  extension a URL is drawn by the text cell.
- **Fixed options.** The seam writes values, not a property's config, so the
  tag menu takes no `onOptionsChange` here and offers no "Create", no option
  menu and no reordering (`Property.dataCanSet`, optional, absent means
  writable: the table is unchanged). Creating an option from the band would
  widen `TitleBandService` with an optional config write; not done.
- **What moves for a host.** `TitleBandService` is unchanged. A number now
  reads as in a table cell, unformatted unless the store's
  `enable_database_number_formatting` flag is on; dates read `yyyy/MM/dd`.
  The key `com.labre.title-band.clear` is gone (the date picker's own Clear
  replaces it); `chipEditorKind` and `ChipEditorKind` leave the
  `doc-title` entry, unused since the cells decide what a click opens.
- **A fix the band surfaced.** The text cell committed on Enter and again on
  leaving, after resetting its input to the old value: the second write put
  the old value back as soon as a host applied the first. Enter now only
  leaves, which commits once.
- Held by `data-view/src/__tests__/standalone-cell.unit.spec.ts`,
  `fragments/doc-title/src/__tests__/title-band.unit.spec.ts` (each type drawn
  and edited by its cell) and `integration-test/…/edgeless/title-band.spec.ts`.

### 2026-10-14: B14 as built

Records what §4 left open when the package and the script change landed.

- **Entry shape.** An `EDITOR_BUNDLES` entry carries a `label` beside the
  fields §4 lists: it is the `owner` of the bundle's translation group in
  `translations.ts` (`EDITOR_TRANSLATION_GROUPS`, one line,
  `{ owner: 'core-database', … }`), the way `AUXILIARY_BUNDLES` uses it.
- **`.` is data-only.** The package root exports
  `databaseEditorTranslationEntries` and nothing that pulls Lit; the two
  providers live behind `./view`, as for a framework. Both are empty
  (`ponytail:` lines name B10 to B13) and the list of wordings is empty.
- **Imports are checked against core alone.** The script rewrites the
  bundle's `@labre/*` imports with core's shim map only, without the shared
  bundles a framework may reach, so an import of a framework or of
  `ddd-shared` fails `build:bundles`; `core-database-boundary.unit.spec.ts`
  asks the same of the source and also checks that no library package but the
  umbrella's two stripped assembly files imports the package.
- **Descriptor.** The emitted `./descriptor` has the multi-extension shape
  (`coreDatabaseBundle = { flag: 'database', telemetryKey: 'core-database', extensions }`);
  `telemetryKey` only echoes the label, there is no historical PostHog value.
- **Emitted bundles.** Every other bundle is byte-identical to 0.48.0's;
  core differs only by the leftover comments and the empty group list in its
  `translations.ts` and the `EDITOR_BUNDLES` data in `frameworks.ts`.

### 2026-10-14: B1, B2 and B15 as built

Amends §7, §9e and §9f with what the code had to decide. No stored format
changes beyond §8 (shipped on its own, `view-basic-data.unit.spec.ts` in
`affine/model`).

- **The data layer follows the current view.** `HostedDataSourceBase` is still
  one data source per block. `source$`, `schema$` and `rows$` answer for the
  current view's `sourceId`: one view is drawn at a time, and property ids
  never collide across sources (labre ADR-0046 §3: uuids). A per-view data
  layer would have reshaped every `SingleView` reader in data-view; not done.
- **No `resolveSource`, no sources.** A source built without it (the inline
  source, every 0.48 host source, `ExternalDataSourceBase(model)`, kept as an
  alias) reads the block itself whatever a view's `sourceId` says: the 0.48
  reading. "Source not found" only exists for a host that resolves sources.
- **"Source not found" replaces the tools too.** Through an optional
  `viewPlaceholder(logic)` of `DataViewRendererConfig`, the database block
  draws its title, its view bar (to pick another view) and the notice
  (`com.labre.database.source-missing`, `.hint`) instead of the view: no
  filter, no "+ row", no cell, so nothing can write to a source that is not
  there, and `readonly$` is left alone.
- **Hydration never writes.** A cell that is not `ready` mounts no renderer
  (skeleton or empty, `renderCellStatus`) and `CellBase.valueSet` /
  `jsonValueSet` refuse it, which covers paste, drag-to-fill, kanban drops and
  every editor. "Filter and group counts" are, in this code, the group header
  counts and the column statistics: the filter bar counts rules, not rows.
  The banner lives in the database block's header (it needs the translation
  seam), driven by the pure `valuesBannerOf(state, now)`.
- **The hosted title is a property meta, not a seam.** `hostedTitleColumnConfig`
  keeps the `title` type (stored columns, `header.titleColumn` and the
  fixed-property rules unchanged) with a string value drawn by the plain-text
  cell. A source with `rowsAreDocuments` returns it from `propertyMetaGet`;
  the base reads `titleOf(rowId)` for that column. The base cannot swap the
  meta itself: `propertyMetaGet` is a 0.48 host's own method, and taking it
  over would ask every host for an `override`.
- Held by `data-view/src/__tests__/hydration-status.unit.spec.ts`,
  `blocks/database/src/__tests__/hosted-data-source.unit.spec.ts` and
  `values-banner.unit.spec.ts`.

### 2026-10-14: the gallery and list presets (B6, B7)

Records what B6 and B7 decided where §1 and §8 left it open. Not a red zone:
the two modes are new values of the open `mode` field, with the per-view
data shape table and kanban already store (`columns[].hide`, `filter`,
`sort`); no model field changes.

- **One manager, two drawings.** `FlatSingleView` (`data-view/src/view-presets/flat/`)
  is the table's manager without widths, statistics and groups: per-view order
  and visibility, the filter and sort traits, row creation from the filter's
  default values. `GallerySingleView` and `ListSingleView` only name their
  mode. Grouping arrives with B8 on the same manager.
- **The table's cells, not a drawing of their own.** Every value is the cell
  renderer a table cell mounts, hosted by `<dv-standalone-cell>` with the
  view's real `Cell` (§11 amended 2026-10-13), so the tag menu, the date picker
  and the inputs are the table's. The host gains an optional
  `onEditingChange(editing)`, through which the presets lock the view's rows
  while a value edits, as a table does.
- **A row opens; a value edits.** The title is drawn read-only, so a click on
  it, or anywhere on a card or a row outside its values, or on its open
  button, opens the row through `root.openDetailPanel`, the path the table's
  and the kanban's open buttons take (the row-open seam of §9a plugs in
  there). A click on a value opens its editor. A read-only view lets every
  click through to the row.
- **Defaults.** A new gallery or list stores its title shown and every other
  property hidden (Notion's default for both layouts); a property added from
  the view is shown. A list draws no chip for an empty value. A layout switch
  into a gallery or a list, or out of one into a table or a board, keeps the
  filter and the sort (`flat-converts.ts`); calendar is a source only (§6).
- **One UI for desktop and mobile.** `mobileLogic` is the `pcLogic` class, named so a touch screen draws this UI on purpose (`mobile-editing.unit.spec.ts`): the cards reflow, the
  list wraps its chips under the title below 640px, touch screens get 44px
  rows. Editing on mobile follows the block's `readonly$` (B5).
- **Hydration and document rows (§9e, §9f).** A value whose `status$` is not
  `ready` mounts no cell: the presets draw `renderCellStatus`, as a table
  cell does, so a pending value is a skeleton nobody can edit over, and a list
  keeps the chip of an empty value still loading. A source whose rows are
  documents titles them through `titleOf` with nothing in the presets: the
  title cell reads `cellValueGet` and `propertyMetaGet('title')`, the
  hosted title column.
- **Not done.** No card cover (a `ponytail:` line names the upgrade, a stored
  `header.coverColumn` as the kanban's); no slash-menu entry creating a
  gallery or a list (the views bar and the Layout switch create them); the
  views' `defaultName` ("Gallery View", "List View") is a literal, as the
  table's and the kanban's, until view creation resolves its name through the
  seam.
- Held by `data-view/src/__tests__/gallery-list-views.unit.spec.ts`,
  `all/src/__tests__/database/gallery-list-views.unit.spec.ts` (the real
  block source, no write on load; a hosted source with document rows) and
  `integration-test/src/__tests__/page/database-gallery-list.spec.ts`.

### 2026-10-14: B8 as built (per-view settings, `openIn`, grouping on every layout)

Records what B8 decided where §8 left it open. Not a red zone: no stored
field is added. Grouping reuses the `groupBy` and `groupProperties` table and
kanban have always stored (`groupProperties[].hide` was stored, always
`false`, and read by nobody), `openIn` is the optional field §8 shipped on
its own.

- **Per view, already.** Hidden properties, their order and the sort were
  per view in every preset (`columns[].hide` and its order, `sort`; B6 and
  B7 for gallery and list); calculations are the table's column statistics,
  per view in `columns[].statCalcType`. Gallery and list draw no
  calculation: there is no column to put one under, and Notion offers none
  in these layouts; their group headers count rows, as the table's and the
  board's do.
- **"Open pages in".** A view setting (side peek, center peek, full page)
  in the view settings menu, offered only when the source says its rows are
  documents (`rowsAreDocuments`): a block-backed row keeps the detail panel
  whatever the view stores. `viewOpenInSet` writes on the pick alone, never
  when it changes nothing (picking "Side peek" on a view with no `openIn`
  leaves it absent), never on a read-only or fallback view. `viewOpenIn`
  reads `side` for an absent or unknown value. Both live in
  `data-view/src/core/view/open-in.ts`, exported. The row-open seam (B9)
  reads the same field with its own `openInOf`; `database-seams.spec.ts`
  holds the two together (a pick changes the `mode` the host's opener
  receives). A layout switch keeps `openIn` and `sourceId`: the block's
  `updateView` merges the converted data into the stored view.
- **Grouping on every layout.** Gallery and list take the table's
  `GroupTrait` with the table's ops, now one copy for the four presets
  (`core/group-by/group-properties.ts`); a layout switch into a gallery or a
  list keeps `groupBy`, as table and kanban kept it between them. A grouped
  gallery or list draws each group under the table's group header (title,
  count, "+" adding a row into the group, a menu); a row changes group by
  its value, not by a drag.
- **Hidden groups.** "Hide group" is in every group's menu and an eye per
  group in the view's Group settings; it writes `groupProperties[].hide` for
  everyone. `GroupTrait.groupsDataList$` keeps every group (a reorder or a
  card move writes an entry for every key and must keep a hidden one's);
  layouts draw `visibleGroups$` and end with `<dv-hidden-groups>`, which
  lists `hiddenGroups$` with a "Show group" button (none on a read-only
  view). The table's select-all skips hidden groups.
- **Folded groups are personal.** `localStorage`, key
  `labre:data-view:group-collapsed:<viewId>:<groupKey>`, only a folded group
  has an entry; never the document, as the local hide of ADR 0031. Not a
  host seam: it would be a row in the seams table forever for a device
  ergonomic. The table used to keep its fold in `sessionStorage`
  (`affine:table-group:*`), per tab; those entries are not read back. A
  kanban column folds to its header.
- **Not done.** The virtual table (`enable_table_virtual_scroll`, off by
  default) hides hidden groups but neither lists them nor folds (a
  `ponytail:` line); "Ungroup" and "Delete cards" stay table and board
  entries of the group menu; the table's own literals ("Expand group",
  "Collapse group") are left to the data-view wording pass, which can reuse
  `com.labre.data-view.group.expand` and `.collapse`.
- Held by `data-view/src/__tests__/grouping-views.unit.spec.ts`,
  `table-group-collapse.unit.spec.ts`,
  `all/src/__tests__/database/grouping-open-in.unit.spec.ts` and
  `integration-test/src/__tests__/page/database-grouping.spec.ts`.

### 2026-10-14: the row-open, properties panel and data-source picker seams as built (B9, B10, B12), and the band's option writes

Records what B9, B10 and B12 decided where §9a to §9c left it open. Not a red
zone: no stored field changes; every seam is optional and its absence keeps
0.48.

- **B9, one path.** `DatabaseOpenRowExtension({ open })` lives in
  `@labre/affine-block-database` and plugs into the block's
  `openDetailPanel`, which `DataViewRootUILogic.openDetailPanel` calls for
  every view (table, kanban, gallery, list). The request is
  `{ docId, mode, newTab, viewId, blockId }`; it goes to the host only for a
  source with `rowsAreDocuments`, a row that is a block keeps the library's
  detail. `mode` is the view's stored `openIn`, `side` when absent or
  unknown; a Ctrl/Cmd click is `newTab: true` with `mode: 'full'`
  (`isNewTabClick`, data-view core).
- **B10, the library draws the source panel.** The view options' "Properties"
  asks `PropertiesPanelProvider` with
  `{ scope: 'source', docId, blockId, sourceId, viewId }` through a data-view
  service key (`PropertiesPanelOpenerKey`) the block sets, so data-view
  imports no seam; `sourceId` is the block id for a view with no `sourceId`.
  The panel is `affine-database-properties-panel` in the bundle: the table
  view's own `data-view-properties-setting`, `panelHeaderStyles`, "Show all /
  Hide all", Close calling the host's `close()`. It writes through the view
  as the popover does. `ponytail:` the §10 host-panels verbs and commands are
  not written; the panel is the native list, add when a host panel must
  write without mounting it.
- **B12, the identifier in core.** §9c put the picker in the bundle; the
  identifier `DataSourcePickerProvider` moved to `@labre/affine-shared`
  because core's own "Table View" / "Kanban View" read `createDatabase` (§3:
  a seam lives in the lowest package that reads it). The menu
  (`popDataSourcePicker`, `databaseId` for one database's sources) and the
  "Linked view of a database" slash entry stay in the bundle. A linked view is
  one `affine:database` block with the host's `externalSourceId`, the
  database title, one view with the picked `sourceId`, inserted as one undo
  step; a board on a source with nothing to group by lands as a table.
- **The band's option writes.** `TitleBandService.setData?` and
  `TitleBandProperty.dataWritable?` (both optional, `title-band-signature`
  guard): a select chip creates and renames options only when both are
  there and the chip is writable. It is a definition write distinct from the
  value write: `setData(docId, propertyId, { ...data, options })` first, then
  the `set` that selects a created option. The tag menu takes
  `optionEdits: 'create-rename'` (no delete, colour or reorder).
- **Not done.** The "Open pages in" setting UI (the views bar's), telemetry for
  a row opened (B17), and the views bar's "+ view" calling the picker.
- Held by `blocks/database/src/__tests__/open-row.unit.spec.ts`,
  `creating-entries.unit.spec.ts`, `shared/src/__tests__/services/data-source-picker-null.unit.spec.ts`,
  `title-band-signature.unit.spec.ts`, `doc-title/src/__tests__/title-band.unit.spec.ts`,
  `database-editor/src/__tests__/data-source-picker.unit.spec.ts` and
  `integration-test/src/__tests__/page/database-seams.spec.ts`.

### 2026-10-14: B11 and B13 as built

Amends §1 (the split table) and §9c with what the view bar and the full-page
host had to decide. No stored format changes; no new host seam.

- **The tabs stay in core.** §1 put "the Notion view bar" in the bundle, but
  its own test is that a core-only host shows every stored view: the tabs,
  "N more" and switching are how a view is reached, so they are core's
  `data-view-header-views`, measured by `component-overflow` through the pure
  `fitOverflow` (`data-view/src/core/component/overflow/fit.ts`). Tabs keep
  the order of the views and stop at the first that does not fit; the
  current view always keeps a tab, in place of the last one that would have
  fitted. "N more" lists only the views without a tab; "+" is always drawn
  after them and is the bar's only creation entry (0.48 drew it only when
  every tab fitted and offered "Create …" inside "N More"). A phone gets 44px
  targets and nothing else.
- **What the bundle adds to the bar is "+".** Core reads an
  `AddViewMenuIdentifier` (`data-view`, the lowest package that reads it,
  §3) through `std.getOptional`; `DatabaseEditorToolingViewExtension`
  registers one, so `{ database: false }` drops it with the rest of the
  creation tooling. It is a registry between library packages, never filled
  by a host, so it has no row in the seams table. On a source that resolves
  sources (`HostedDataSourceBase.resolvesSources`, new, with `sourceOf`) it
  offers "On an existing source" (the sources the views read, one per
  schema block, a sub-menu each when there are several) and "With a new
  source" when the picker gives `createSource`; with one source and nothing
  to create, the presets are the menu, as on an inline database. A view
  added on a source writes that `sourceId` and re-derives its default data
  from it, in the gesture's one undo step.
- **The third entry is not drawn.** labre ADR-0046 §5 and the PRD give "+
  view" three entries, the third importing a view from another database
  (REQ-DB-2). This ADR has no seam for it; it waits for an amendment that
  gives the picker an import verb, with the "This view" work of the host's
  third wave.
- **"+ view" reads the picker (closes the B12 "Not done" above).** With a
  `DataSourcePickerProvider`, the tooling extension adapts it
  (`addViewSourcePicker`) on the database the block shows, its
  `externalSourceId` being the id the picker lists it under: the sources
  of that database no view reads yet join "On an existing source", and
  "With a new source" calls `createSource(databaseId)` then adds a table on
  the new source. It lists them inline rather than popping
  `popDataSourcePicker` over its own menu, so each source keeps its presets.
  Without a picker, the sources the views read, as the seams table says.
- **The full page draws the host block alone.** `<affine-database-page
.store .extensions .hostBlockId>` (`DatabasePageHost`, defined by the
  always-on extension) builds a page editor on the database document with
  the host's page extensions plus `databasePageRootExtension`, which
  replaces the page root with `<affine-database-page-root>`: it renders the
  host database block and its own widgets, nothing else. No note, no schema
  block, none of the page root's widgets (drag handle, block menu, slash
  menu, toolbar with "Turn into", box selection) and none of its handlers
  (Backspace on a block selection, ⌘A, the click below that appends a
  paragraph). A first version drew the whole page editor and hid the schema
  blocks in CSS; ⌘A then Backspace, ⌘X, a drag or a file drop still reached
  them, and they carry the sources (labre ADR-0046): losing one loses the
  database. Two guards hold what is not drawn out of reach, because a
  flavour keymap fires for a selection on any MODEL descendant, drawn or
  not: the store's selection is held to the host (a block or text selection
  strictly inside it, any other selection on it or inside it,
  `selectionStaysInHost`), and a drag carrying files never reaches the
  editor. Same block, presets, cells and row opening as inline; nothing
  written. Which block hosts the views is passed in, never read from a
  `labre:*` key. Without that block it says so
  (`com.labre.database.page.host-missing`).
- Held by `data-view/src/__tests__/views-bar-overflow.unit.spec.ts`,
  `database-editor/src/__tests__/add-view-menu.unit.spec.ts`,
  `database-editor/src/__tests__/database-page.unit.spec.ts`,
  `blocks/database/src/__tests__/hosted-data-source.unit.spec.ts` (`sourceOf`)
  `integration-test/…/page/database-views-bar.spec.ts` (1024px and a
  narrow bar) and `integration-test/…/page/database-page-guards.spec.ts`
  (each destructive gesture replayed, a click below, a file drop).

### 2026-10-14: the menu beside "New" and a text column for hosted sources

Two host needs of labre's base templates (labre PRD REQ-DB-6, 14 and 15) and
of its base columns. Not a red zone: no stored field, no new flag, no new
bundle; one new seam, optional, whose absence keeps 0.48.

- **The menu beside "New" is a seam in core.** `DatabaseNewRowMenuExtension(service | null)`
  / `DatabaseNewRowMenuProvider` in `@labre/affine-block-database`, mirroring
  `DatabaseOpenRowExtension` (§9a): the block reads it with
  `std.getOptional` when it builds its source and hands data-view an opener
  (`NewRowMenuOpenerKey`, `data-view/src/core/view-manager/`) with a
  `serviceSet`, as `PropertiesPanelOpenerKey` (B10), so data-view imports no
  seam. Core and not the bundle, because "New" is core's: the header tool
  `data-view-header-tools-add-row` that every view draws (table, kanban,
  gallery, list, calendar), the full page included, since it draws the same
  block (B13). The request is `{ anchor, blockId, viewId }`; the host draws
  the menu and does what it offers. The library knows no template.
- **"New" is unchanged; the chevron is added.** Absent or `null`, the single
  button of 0.48. Registered, the same button, then a chevron reusing
  `data-view-component-button` as a split button, labelled by
  `com.labre.database.new-record.more` ("Templates and options"), resolved
  by the block so the wording lives with the seam's other words; 44px on a
  coarse pointer. The main part still calls `addRow`, hence the source's
  `rowAdd`: a host applies its default template there, so every way of
  adding a row (the header, a group's "+", the gallery's "New page" card,
  the table's last row) gets it without asking the menu. Only the header's
  "New" draws a chevron; the in-view entries keep their one gesture.
- **A text column for hosted sources, not for the inline database.**
  data-view's plain-text preset (`text`, a string value) is `hide: true` and
  was reachable from no public entry: a host whose values are plain JSON
  (labre ADR-0046 §3, no `rich-text`) could offer no text column.
  `hostedTextColumnConfig` (`blocks/database/src/properties/text/hosted.ts`,
  exported beside `hostedTitleColumnConfig`) is that preset, shown, named as
  the inline Text column. It is not added to `databaseBlockProperties`: the
  inline database's Text is `rich-text`, two "Text" types would sit in its
  menus, and a `text` column stored inline would be a type a 0.48 client
  does not draw. A host lists it in `getPropertyMetas` and answers it from
  `propertyMetaGet('text')`; the preset itself is left as it was.
- Held by `blocks/database/src/__tests__/new-row-menu.unit.spec.ts`,
  `hosted-data-source.unit.spec.ts` (a hosted text column),
  `data-view/src/__tests__/new-row-menu.unit.spec.ts` and
  `integration-test/…/page/database-seams.spec.ts` (without and with the
  seam).

### 2026-10-14: B17 as built, and new views named at the gesture

Amends §12, the "Not done" line of the gallery and list amendment and the
B17 item of the B9 amendment above.

- **The taxonomy is the telemetry README's "Databases" section**, the
  contract: `DatabaseViewAdded { viewType, source }`,
  `DatabaseViewTypeChanged`, `DatabaseGroupChanged`,
  `DatabaseRowOpened { mode, newTab, rowKind }` and
  `DatabaseValuesLoadFailed { retryable }`; filters and sorts keep their
  historical `CreateDatabaseFilter` and `DatabaseSort*` series rather than
  starting a second one. Each has one emission point (the creating gesture,
  the block's `openDetailPanel` once B9's request is built, `GroupTrait`,
  the values banner), so
  gallery and list report through the same paths as table and kanban. Code
  that holds a view but no UI logic reports through the source's
  `DataViewEventTraceKey`, which the block sets beside `EditorHostKey`.
- **The boundary with `base.*`** is written in the README: the library
  reports what happens inside a mounted database view; the host reports
  what only it observes (a base created, a row page created or moved,
  membership, sharing) and never re-reports a gesture the library already
  reported through a seam.
- **New views are named at the gesture.** Each preset keeps its English
  `defaultName` and declares `defaultNameKey`; the views bar, the database
  slash entries and "Turn into a database" write the name resolved through
  the catalogue (`viewDefaultName`), so no stored name changes and none is
  re-translated. The bar's `addView`, which B11's `AddViewMenuContext` hands
  the bundle, resolves the name and reports `DatabaseViewAdded` once, so
  "on an existing source" and "with a new source" (`source: 'new'`) name and
  report a view the way the bar's own presets do; the bundle's preset
  entries show the resolved name too. A host that creates a view itself
  (the full-page base) passes the resolved name to `viewAdd(type, name)`.
- **A layout change keeps the view's `sourceId` and `openIn`.**
  `viewChangeType` rebuilds the view's data, but every block source writes
  it merged over the stored view, so both survive; a guard holds it
  (`all/src/__tests__/database/database-telemetry.unit.spec.ts`).

### 2026-10-14: a title without a body, and "New" asking whether it has a menu

Two gaps the host found on a base's full page (labre A4). No stored field,
no new seam, no new flag; two optional members whose absence keeps what
shipped.

- **`<doc-title .bodyBlockId>`.** On the full page (B13) the title sits
  above `<affine-database-page>`, but its Enter split the title into a first
  paragraph of the document's first note and its ArrowDown focused or
  created one: a note the page never draws, holding the schema blocks that
  carry the sources. The host swallowed both keys in capture. `DocTitle`
  gains `bodyBlockId?: string` (default `undefined`, the 0.48 behaviour).
  Set, the title has no body of its own: Enter and ArrowDown drop the
  title's caret and call the block's `focusFirstCell` when it has one
  (`DatabaseBlockComponent.focusFirstCell`, new, the current view's first
  cell for a table or kanban; the other presets ignore it). Nothing is
  written, and nothing is focused when the block has no cell to take it.
  Enter does what ArrowDown does: the title text is stored as typed, so
  leaving the title is all "validating" it means. The page host does not
  set it on the title, because the host composes the two elements; it is
  the host's one line (`title.bodyBlockId = hostBlockId`).
- **`DatabaseNewRowMenuService.canOpen?({ blockId, viewId })`.** The
  service is registered once per editor, so the chevron also showed on an
  inline table of a base, where the host has nothing to open. The block
  passes it to data-view's `NewRowMenuOpener.canOpen?(viewId)`, which the
  header's "New" asks at each render: `false` draws the single button of
  0.48, absent means every view (as the seam first shipped). The request
  type is `DatabaseNewRowMenuTarget`, the open request without its anchor.
  It is called on every render of "New": the host answers from what it
  already holds.
- Held by `integration-test/…/page/doc-title-body-block.spec.ts` (with and
  without `bodyBlockId`), `integration-test/…/page/database-seams.spec.ts`
  (with `canOpen`), `data-view/src/__tests__/new-row-menu.unit.spec.ts`
  (asked at each render) and
  `blocks/database/src/__tests__/new-row-menu.unit.spec.ts` (the type only
  widens).

### 2026-10-14: "This view" on the full page, and importing a view

Labre PRD REQ-DB-2, DB-4 and DB-10. Amends §9c (the picker) and the "+ view"
of B11, whose third entry waited for this amendment.

- **The full page's settings are view-menu commands.** The host already
  lists the current view's own actions in its menu with `getViewActions`
  and runs them with `runViewAction` (ADR 0034, amendment of 2026-10-13).
  The full page registers six commands on that surface, from
  `databasePageRootExtension`, so they exist on the full page and nowhere
  else: `database.view.layout`, `.group`, `.open-in`, `.properties`,
  `.save-template` and `.import` (`database-page/view-menu-commands.ts`,
  `scope: 'page'`, no chord). They are a projection of the view settings,
  not a second implementation: a setting opens the very menu the view
  settings' entry opens, through `openSetting(key)` of the view's options
  button, anchored on it, its "back" leading to the view settings. The
  entries' openers moved out of `popViewOptions` into
  `widget-presets/tools/presets/view-options/view-settings.ts`
  (`popViewSetting`, `viewSettingAvailable`), which both call. A setting is
  listed where the view settings offer it (grouping needs the group trait,
  "Open pages in" rows that are pages) and not on a read-only page. They are
  not in `@labre/affine`'s `getCommands()`: core never imports the bundle.
- **No new seam: the picker carries the two transfers.** `DataSourcePickerService`
  gains two optional verbs. `importView(request)` hands the host the
  database the copy lands in, the current view's `sourceId`, that source's
  properties and the layouts this database adds; the host lets the reader
  choose a view and map its properties, then calls `request.add({ view,
properties, mapping })`. `saveViewTemplate(template)` hands the current
  view as a template: everything but its filters, sorts and manual orders
  (REQ-DB-4), with its source's properties. Absent, "+ view" has no import
  entry and the page lists neither command. "+ view" draws its third entry,
  "Import a view from another database", when the verb is there.
- **A copy, never a link.** `add` re-checks read-only, refuses a layout
  this database does not add (no calendar is created any more), and writes
  a new view with a new id on the current view's source, as one undo step
  (`viewDataAdd`), then shows it and reports `DatabaseViewAdded { source:
'import' }` (the union is append-only, so `import` is appended).
  `remapView` (pure, exported for the host's dialog to preview the same
  result) rewrites every property id through the mapping: an ignored
  property's column leaves, a filter condition or a sort key on it is
  removed, a grouping by it is undone, a select condition keeps the options
  of the same name, the rows' manual orders are emptied; it counts what it
  removed so the dialog can say so.
- **Conditional colours are not built.** No view stores colour rules; they
  need a stored field on the views (`packages/affine/model`, a red zone),
  left to its own change. A template simply carries whatever the view
  stores, so it will carry them once they exist.

### 2026-10-14: conditional colours are ADR 0036

The "Conditional colours are not built" line of the amendment above is
superseded by [ADR 0036](./0036-database-view-conditional-colors.md): the
optional `colorRules` field on a view, painted in core, edited from the view
settings and from "This view" (`database.view.color-rules`), carried by a
template and remapped by an import.

### 2026-10-26: the full page holds its heading, one scroller

The host composed the full page (B13) as its own `.affine-page-viewport`
holding `<doc-title>` then `<affine-database-page>`, which renders a second
viewport around its editor. Both viewports scroll: on a long table the page
showed two vertical scrollbars, the table's inside the page's (labre recette
of 2026-10-26). The page's spacing was also a text page's: the title's 38px
bottom padding and the inline block's 8px top margin and padding stood
between the name and the view bar.

- `DatabasePageHost` gains `heading?: HTMLElement | null` (default `null`,
  the previous rendering). The page renders it first inside its own
  viewport, before the editor exists too; that viewport is the page's only
  scroller (`overflow-y: auto`, the element fills its host's height). The
  host passes its `<doc-title>` (with `bodyBlockId`) instead of wrapping both
  in a viewport of its own. `doc-title` still finds the editor through its
  nearest `.affine-page-viewport`.
- On this page only, the heading sits on the view bar: the title's and its
  band's bottom padding are zero, and the root removes the block's top
  margin and padding. Text pages and the inline block keep theirs.
- No stored field, no seam, no flag. A host that keeps its own viewport
  still mounts and still shows two scrollers, as before.
- Held by `database-editor/src/__tests__/database-page-root-styles.unit.spec.ts`
  and `integration-test/…/page/doc-title-body-block.spec.ts`, which mounts
  the title through `heading`.
- Later the same day, the page scrolls both ways (labre recette): the table
  kept its own sideways scroller, so data-view's column header could not
  stick natively and its script put it back on each scroll, a frame late,
  and it jumped. On this page only, a table view makes the root as wide as
  its columns (`width: max-content`, at least the page), the table's wrapper
  and scroller (`dv-table-wrapper`, `dv-table-scroll-container`, stable
  classes added for this) stop being scrollers, the column header is
  `position: sticky; top: 0`, and the heading and the view bar stay in view
  sideways (`position: sticky`, a viewport wide). Data-view's script leaves
  a header that is already sticky alone. The inline table and the other
  views keep their behaviour. Held by
  `integration-test/…/page/database-page-scroll.spec.ts`.

### 2026-10-27: a value on its way draws a spinner, not a skeleton

Amends §9e and the B2 line. A `pending` cell (`renderCellStatus`) and the
title band's loading row now draw the library's spinner (`LoadingIcon`,
`@labre/affine-components/icons`) centred in what loads, instead of a grey
skeleton: the Labre app allows a spinner as its only loading indicator
(its ADR-0057, recette 3). Nothing else changes: a pending cell mounts no
editor and takes no write. The test id is now `dv-cell-loading` (was
`dv-cell-skeleton`); the band keeps `title-band-loading`. `LoadingIcon`
rotates by SMIL instead of a `<style>` inside its SVG, which was a global
sheet in light DOM and would not render under happy-dom. Held by
`hydration-status.unit.spec.ts` and `title-band.unit.spec.ts`.

### 2026-10-27: a child's own card drops the link arrow; page cards in a note are lines

Amends §9d (and the title band row of `docs/integrate/04-host-seams.md`).
Asked by the product owner in the Labre recette 3 (P2-7, labre ADR-0045
amended the same day): the host stops supplying `notShown$` (a page moved
under another now gets its card at the end of it, written by the host), so
the row disappears from Labre; the seam stays for any other host.

- **`TitleBandService.children$(docId)`, optional.** The ids of the
  document's child pages in the host's tree. A linked-doc card or a
  synced-doc embed of one of them, in that document, draws the plain page (or
  canvas) icon; any other card, and every inline `@` reference, keeps the
  linked-page icon with its arrow. The card reads it inside its icon
  computation (`embed-doc/src/common/child-card.ts`), so a move redraws it.
  An existing seam carries it rather than a new one: the band is already the
  host's voice on the page's children, and a host built against 0.59 can
  implement the optional method before it upgrades. Without it, every card
  keeps the arrow (0.59). No stored prop: the distinction is the host's tree,
  never the card's.
- **A page card placed in a note is a line.** `LINKED_DOC_NOTE_STYLE`
  (`'list'`, "Small horizontal style") is written by every site that places
  a page card in a note when no one chose a style: the slash menu's "New
  Page", a page drop, "Show here" in the page view, "Linked doc", an inline
  reference turned into a card, "Create linked doc" from a selection. The
  model's default (`horizontal`) does not change: every stored card already
  carries it. Canvas cards keep their style (`vertical`).
- Held by `embed-doc/src/__tests__/child-card-icon.unit.spec.ts` (no
  provider, a band without `children$`, a child, a move) and
  `card-line-style.unit.spec.ts`.

### 2026-10-28: database v2 — a derived layout, the source chosen after the gesture, and changed from the view's settings

Asked by the product owner on 2026-10-28, after reading that the full page
and the inline block share one engine but that the full page re-dresses the
inline rendering through CSS keyed on its own root's tag name (the amendment
of 2026-10-26 above), and that a view's source is chosen once, when the view
is added. Three decisions, no stored field, no flag, no new seam: the picker
seam (§9c) carries everything. CSV import and database templates stay out
(product owner, same day). Each view keeps its own configuration (filters,
sorts, grouping, columns, `sourceId`, §8); the schema stays the source's.

- **A. The layout is derived, never declared.** The database block measures
  two facts of the DOM it is drawn in and sets `data-standalone` on itself
  when both hold: its parent block component is the root component (inline,
  the parent is always a note; the full page's root renders the host block
  directly), and a `<doc-title>` whose `body-block-id` is its id sits in its
  scroll container (`getScrollContainer`, the one `.affine-page-viewport`).
  `DocTitle.bodyBlockId` reflects as `body-block-id` so the fact is
  observable and a `MutationObserver` follows it. The block hands data-view
  the same fact as a signal under `PageLayoutKey` (`data-view`, the lowest
  reader, through `serviceSet` like `PropertiesPanelOpenerKey`), and the
  table view sets `data-page-layout` on itself. The rules of 2026-10-26 move
  to their owners: the title row hidden, the block's top margin and padding
  zero and the header container sticky in `blocks/database`'s own styles,
  keyed on `data-standalone`; the wrapper and scroller `overflow: visible`,
  the sticky column header and the `max-content` width in the table preset,
  keyed on `data-page-layout`; the column header reads the key instead of
  probing `position: sticky`. `database-page-root.ts` keeps only what is the
  page root's (width, side padding, the missing notice) and one width rule
  keyed on the explicit `dv-table-view-ui[data-page-layout]`, since a kanban
  keeps its own sideways scroller. No selector names the root any more.
  Degraded rendering: a page mounted without a heading draws the block as
  inline (title row shown, its own scroller), accepted. Nothing is stored
  and nothing is written: the attribute is a measurement.
- **B. The gesture is the write; the source is chosen just after.** With a
  picker and the bundle's creation menu, "Table View" and "Kanban View"
  insert a native `affine:database` at once (zero rows, since its rows would
  be orphaned by the connection) and open a popover anchored on it offering
  "New empty source" (`createDatabase()`) and "Link an existing source" (the
  picker's list, without its "New…" entries). Core reaches the popover
  through `DatabaseCreationMenuIdentifier` (`blocks/database`), a registry
  between library packages on the `AddViewMenuIdentifier` model, never a
  host seam. Connecting (`connectDatabaseToSource`) writes `externalSourceId`,
  the title when empty, `columns: []` and the view's `sourceId` with its
  default data re-derived over the host source, and removes the native rows,
  as one undo step distinct from the insertion: the undo manager merges by
  time window only, and folding two gestures would need a store verb (red
  zone). Undo once is therefore the "popover closed" state, a native inline
  database, which closing the popover also leaves. Without a picker, the
  native three-row database of 0.48; with a picker but without the bundle's
  menu, the 0.49 path (`createHostedDatabaseView`) is kept. "Turn into a
  database" and the mobile keyboard toolbar keep inserting a native database
  (follow-ups).
- **C. A view changes its source from its settings.** data-view's view
  options menu gains `ViewSettingsMenuIdentifier` (core, the lowest reader,
  read with `std.getOptional`; `popViewOptions` takes an optional trailing
  `std`, a widening); the bundle contributes "Source", after Layout, on a
  `HostedDataSourceBase` that resolves sources, writable, with a picker. It
  pops the picker on this database's sources, "New source" included through
  `createSource`. A pick rewrites the current view through
  `remapView(view, from, to, defaultMapping(from, to))` plus the new
  `sourceId`, silently (id first, then same name and type; an orphaned
  filter, sort, column or grouping is dropped, as the product owner chose
  over a dialog; the `dropped` counts stay available for a later toast),
  `captureSync()` then one write; picking the current source writes nothing.
  `database.view.source` joins the full page's "This view" commands and pops
  the same picker on the options button; `ViewSettingKey` is not widened.
  One event, `DatabaseViewSourceChanged { source: 'existing' | 'new' }`, ids
  only.
- **D. The database is a package family of its own.** Asked the same day:
  the layout and the connection are not enough, the source tree must say
  what the database now is, a first-class element of the library beside the
  gfx frameworks. After A, B and C land, a migration PR of its own, with no
  behaviour change, moves the four packages into a new family
  `packages/affine/database/` and renames them: `data-view` becomes
  `database/engine` (`@labre/affine-database-engine`, the view engine),
  `blocks/database` becomes `database/block` (`@labre/affine-database-block`,
  the `affine:database` block), `blocks/data-view` becomes
  `database/view-block` (`@labre/affine-database-view-block`) and
  `database-editor` becomes `database/editor` (its name,
  `@labre/affine-database-editor`, already fits). The schema stays in
  `affine/model` (the file format). The published bundles keep their names
  (`labre-core`, `labre-core-database`): `EDITOR_BUNDLES.dir` and the bundle
  script's exclusion list follow the move, the architecture map reads the
  new family by predicate (`model.c4` gains the `database` kind beside
  `gfx`), `vitest.workspace.ts` and the composite `tsconfig` references
  follow. Renaming a workspace package is host-visible when a host imports
  it directly (the Labre app imports `@labre/data-view`): the changeset is a
  **major** and the report names the old and new specifiers; no
  compatibility alias is kept (an unusable entry point is deleted, not kept
  as noise). `git mv` keeps the history.
- Held by `blocks/database/src/__tests__/standalone-layout.unit.spec.ts`,
  `data-view/src/__tests__/page-layout.unit.spec.ts`,
  `database-editor/src/__tests__/database-page-root-styles.unit.spec.ts`
  (the root's styles name neither `affine-database-title` nor `dv-table-`),
  `integration-test/…/page/database-standalone-layout.spec.ts` (A);
  `blocks/database/src/__tests__/creating-entries.unit.spec.ts`,
  `connect-database-to-source.unit.spec.ts`,
  `database-editor/src/__tests__/creation-popover.unit.spec.ts`,
  `integration-test/…/page/database-creation-popover.spec.ts` (B);
  `database-editor/src/__tests__/change-source.unit.spec.ts`,
  `view-settings-source.unit.spec.ts`, `view-menu-commands.unit.spec.ts`,
  `all/src/__tests__/database/view-source-telemetry.unit.spec.ts`,
  `integration-test/…/page/database-change-source.spec.ts` (C).

### 2026-10-29: B, a host may require a source

Asked by the Labre product owner on 2026-10-29: in Labre a table or a
kanban on a page is always backed by a base. Two readings were withdrawn the
same day: closing the popover runs "New empty source" ("if no source is
selected, the view must be empty, that's all"), then a rule on "no source
AND no row" ("no rows does NOT mean no source"). What stands, decided by the
product owner on review of #566:

- **The option.** `DataSourcePickerService.requireSource?: boolean`, an
  optional field of the existing picker seam (§9c): no new seam, a widening.
  Absent or `false`, B is unchanged.
- **The source decides, never the row count** (`sourceRequirement`,
  `database/block`). Nothing is stored: a native database and a creation
  gesture left unfinished are the same bytes (no `externalSourceId`, views
  without `sourceId`), so the rule cannot tell them apart and does not try.

| Block                                                                | Shows                                                                                                                                       |
| -------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| a source the host resolves, rows or none                             | the ordinary editable table (`'none'`)                                                                                                      |
| no source, no row (the popover dismissed)                            | an empty view: title, "No source connected", "Connect a source" (`'connect'`)                                                               |
| no source, native rows (before 1.0, a host without picker, pasted)   | the rows READ-ONLY with a notice (`'read-only'`); documents render forever                                                                  |
| a hosted source the host no longer resolves (source or base deleted) | the same empty view as `'connect'`, view bar kept (another view may still read a source), replacing "Source not found" (§7) under this host |

- **Read-only is the data source's.** `HostedDataSourceBase.locked$` joins
  `readonly$`, which every write path of the view layer already reads
  (cells, paste, drag, "New", view and property menus); the block sets it
  on the native source of a block with no source. So a native database is
  never edited, whatever its row count, and no row is ever added beside the
  host's databases.
- **"Connect a source"** reopens the creation popover
  (`DatabaseCreationMenuIdentifier`) over the block, for its current view
  (`DatabaseCreationRequest.viewId`, a widening of a registry between
  library packages). A block with no source is connected as in B
  (`connectDatabaseToSource`); a hosted view whose source is gone is
  re-pointed (`reconnectDatabaseView`): the block takes the picked
  database's `externalSourceId` when it differs, the view its `sourceId`
  and data re-derived over it, the other views untouched, one undo step.
  The button is absent on a read-only document and without the bundle's
  menu. Closing the popover writes nothing.
- **One creation gesture.** The mobile keyboard toolbar's "Table view" and
  "Kanban view" run the slash entries' gesture (`createDatabaseByGesture`):
  with a picker they no longer insert three native rows the host would not
  see. This closes B's follow-up for every host with a picker, not only one
  that sets the option.
- **"Create Table" (`convertToDatabase`) is hidden** when the host requires
  a source (`canConvertToDatabase`): it would build a native database shown
  read-only at once. The "turn into a base" flow (`createDatabaseFrom`, the
  "Move into a base" button of the read-only notice) is a PR of its own.
- **Deleting a source** (the last view reading it, and the original source
  taking its base along) is the host's, through a hook of its own PR; nothing
  here deletes or creates a source.
- **Test ids** for a host's end-to-end suite: `database-creation-new-source`,
  `database-creation-link-existing-entry` (a sub-menu entry now takes a
  `testId` of its own, beside the one of the menu it opens,
  `database-creation-link-existing`), `database-source-required`,
  `database-source-required-connect`, `database-source-required-read-only`.
- **Undo, copy, paste.** The rule writes nothing, so undo is B's: undoing
  a connection gives the database with no source back, which shows the
  empty view again. A copy carries the block's props and children, so it
  pastes in the same state.
- Held by `database/block/src/__tests__/source-requirement.unit.spec.ts`,
  `database/editor/src/__tests__/creation-popover.unit.spec.ts` and
  `integration-test/…/page/database-creation-popover.spec.ts`.
