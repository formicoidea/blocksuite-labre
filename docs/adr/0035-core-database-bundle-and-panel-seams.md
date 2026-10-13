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
