Editor library for **Labre**, a markdown + whiteboard editor for enterprise transformation architects: one document, two views (page and canvas), business frameworks drawn on the canvas. Fork of BlockSuite (AFFiNE's editor), **assumed divergent** from upstream (ADR 0001). This file is the source of truth for how the library is built; decisions live in `docs/adr/`.

## What this repo is

- The **library**, not the product. Open source, MPL-2.0. The SaaS lives in the private `labre` repo (formicoidea/labre), which consumes this library as published npm bundles; a product need is a seam here, never a back door for one host (principle 17: no privileged consumer).
- 82 private `@labre/*` workspace packages under `packages/`, one Vite playground, one browser-mode integration suite; about ten `@formicoidea/labre-*` bundles generated at release time. Never `@blocksuite/*`: that scope belongs to the AFFiNE team.
- Web components (Lit), state in Yjs, signals for reactivity, no framework of its own. There is no first-party React wrapper; do not document one as if it shipped.
- Sibling checkouts: `../AFFiNE-upstream` (shallow reference clone, editor under `blocksuite/`), `../labre` (the private Labre app, holds the FR catalogue, the PostHog adapter and the seam registrations), `../labre-mcp`.

## Stack (arbitrated — do not re-debate)

One line per concern: `concern — the product or service chosen (+ the ADR, if there is one)`. One choice per concern, no alternative kept in reserve.

- Rendering + state — Lit web components in light DOM for blocks, `@preact/signals-core`, Yjs as the only model (docs/principles.md, part 1)
- Build — `tsc -b` on the whole workspace; esbuild only inside `scripts/*.mjs`
- Tests — Vitest 3 (happy-dom, browser mode with Playwright chromium where the canvas is needed); no Playwright e2e project of its own
- Formatting — Prettier only; no ESLint, no stylelint
- Versioning + publication — changesets (`@labre/*` as one fixed group), manual `ci:version` / `ci:publish` by a maintainer with npm rights on `@formicoidea`; no release workflow in CI (docs/contribute/05-release.md)
- Analytics, notifications, search, i18n, image proxy — none here: seams the host fills (ADR 0003, docs/integrate/04-host-seams.md)
- CI — GitHub Actions: PR checks, nightly cron, `workflow_dispatch`; deliberately no run per push to main
- Forbidden — tracking upstream, publishing under `@blocksuite/*`, ESLint, React inside the library, a dependency between two framework bundles, a flag that gates content, a default network endpoint owned by a third party without an injectable replacement

## Repo map

One line per location: `path in this repo — what lives there (counterpart in the structural model)`.

- Structural model: `../AFFiNE-upstream` (`blocksuite/` inside it). Same patterns, deliberate divergence; deviations are logged in ADRs, never silently (ADR 0001, docs/principles.md part 2).
- `packages/framework/{global,store,sync,std}` — DI, the document model over Yjs, doc/blob/awareness sources, the editor runtime (commands, selection, gfx, command registry). `store` and `sync` are a red zone.
- `packages/affine/model` — every block schema and surface element model. **This package is the file format**; every existing document must stay loadable.
- `packages/affine/{blocks,gfx,widgets,fragments,inlines,components,shared,rich-text,data-view,ext-loader}` — one package per feature; each exposes `./store` (what the document needs) and `./view` (what the editor needs).
- `packages/affine/gfx/wardley`, `gfx/edgy` — the canonical framework modules; mirror them (consts / element-renderer / element-view / node/ / toolbar/ / view.ts). Also `bpmn`, `c4`, `cynefin-estuarine`, `ddd-*`, `uml`.
- `packages/affine/all` (`@labre/affine`) — the assembly: `schemas.ts`, `extensions/{store,view}.ts`, `flags.ts`, `frameworks.ts`, `shortcuts.ts`, `translations.ts`, `commands.ts`, and the cross-framework parity tests in `src/__tests__/`.
- `packages/affine/shared/src/services/` — every host seam (telemetry, translation, notification, image proxy…), one file or folder each.
- `packages/playground` — the dev app (`yarn dev`, port 5173). `packages/integration-test` — the browser suite.
- `scripts/` — `build-bundles.mjs`, `compile-bundles.mjs`, `publish-bundles.mjs`, `changelog.mjs`, `vitest-global.js`.
- `docs/` — entry point `docs/README.md`: four guides (understand, integrate, contribute, add a framework), `principles.md`, `lessons.md`, `adr/README.md`. A change to a rule, a seam or a flag updates the matching page in the same PR. `DESIGN.md` at the root is the visual design system.

## Library contract

- Published as `@formicoidea/labre-core` plus one `@formicoidea/labre-framework-<id>` per framework (`wardley`, `edgy`, `bpmn`, `c4`, `cynefin`, `ddd-event-storming`, `ddd-core-domain`, `ddd-context-map`, `uml`), plus `labre-ddd-shared` and `labre-framework-ddd-aggregate` (DDD template categories, no senior button). The list is derived from `FRAMEWORK_DESCRIPTORS` and `AUXILIARY_BUNDLES` in `packages/affine/all/src/frameworks.ts`, which must stay data-only (type-only imports, no Lit) so the script can read it. Hosts alias the bundles back to `@labre/*`.
- Every bundle carries the umbrella's version; a framework bundle pins the **exact** core version and depends only on core and the shared bundle. A framework package that imports another framework package breaks publish: the build script has no bundle for that edge.
- Registry: `getAffineSchemas()`, `getInternalStoreExtensions()`, `getInternalViewExtensions(flags)` — the three assembly points. **Flags (`@labre/affine/flags`) gate TOOLING, never content**: schemas and store extensions are registered unconditionally, so every document opens and round-trips whatever the flags say; a flag only removes a framework's senior button, submenus, templates category and shortcuts. Frameworks therefore split their view into an always-on `…RenderViewExtension` and a flag-gated `…ViewExtension` (ADR 0009, which reverses the "ship dark" half of ADR 0002).
- Flags are `LabreFlags = BlockFlags & CapabilityFlags`: `OPTIONAL_BLOCKS` (things a document can contain) and `OPTIONAL_CAPABILITIES` (`ai-audit`, which persists nothing). Missing key means enabled. Hosts read the key lists from the library, never keep their own copy.
- Telemetry: `packages/affine/shared/src/services/telemetry-service/` is the bus. The library emits typed events, the host injects the adapter (`NoopTelemetryExtension` standalone, `TelemetryExtension({ track })` in the app). Taxonomy contract in its README (ADR 0003). Command telemetry is emitted once, by `runCommand`, from `CommandDescriptor.telemetry` (ADR 0008).
- Every seam documents what disappears when it is absent, in the table of `docs/integrate/04-host-seams.md`. A new seam adds a row and a test that mounts without the provider.
- Bundles are published **compiled** (`exports` → `dist`), and the emitted specifiers are rewritten so plain Node ESM resolves them. Refresh on the host side = bump every `@formicoidea/*` range together, then install.

## Gates — owned by the tooling, not by this file

- The enforced rules live in their config files — read them, never a paraphrase: `tsconfig.json` (strict, `noImplicitOverride`, `noUnusedLocals`, `verbatimModuleSyntax`, composite references), `.prettierrc`, `.prettierignore`, `.commitlintrc.json`, `.husky/*` (commit-msg → commitlint, pre-commit → lint-staged Prettier), `.github/workflows/*`, `.changeset/config.json`, `vitest.workspace.ts`, `package.json` scripts.
- Prettier is the only formatter. Never hand-format, never add a formatting lint rule.
- Conventional commits with a closed scope list: `page`, `edgeless`, `database`, `blocks`, `store`, `sync`, `std`, `presets`, `playground`, `inline`, `lit`, `examples`. No `wardley`, `bpmn` or `ddd` scope: canvas frameworks use `edgeless`, `blocks` when unsure. Subject sentence-case or fully lowercase; identifiers with a capital go in the body. The hook checks the message, `pr-title-lint.yml` checks the PR title.
- `yarn build` is `tsc -b` on the whole workspace, **tests included**. A partial `tsc -b <package>` may reuse a stale `.tsbuildinfo` and skip a file you just added: `--force` after adding a test.
- `literals.unit.spec.ts` is a ratchet: `literals.baseline.json` can only shrink. A new displayed literal with no key fails the build (ADR 0023).
- The dedupe check in CI is advisory (`continue-on-error`); never let it mask the typecheck.
- A red gate with a clean local diff is usually the environment: a CRLF worktree (`prettier --check` flags every file; check with `--end-of-line auto`), a stale `<package>/node_modules/.vite`, a missing `yarn install --immutable` in a fresh worktree.
- What no tool checks, and is still the house style: named exports only, `.js` suffix on relative imports in `src/` (test files under `__tests__` import siblings without it), no `customElements.define` at import time (each package's `effects.ts`, called from a provider's `effect()`), no default exports, `Object.create(null)` for role tables, early returns, composition over inheritance, DI over singletons, boring over clever.

## Hard invariants

Always in force, whatever you are doing. An invariant that once shipped broken gets a guard test whose header says what it would have caught.

- **The persisted format is forever.** Store, sync and schemas are red zones. Optional fields default to `undefined` (never written, so no migration); enum-like values are append-only; identifiers (roles, tag ids, command ids) are deprecated, never removed. A change to a stored format is an ADR before it is code.
- A flag gates tooling, never content a stored document needs. Documents must render everywhere, forever. A flag once removed a schema and copy/duplicate/resave dropped content silently (docs/lessons.md 6).
- Yjs is the only source of truth: write to the store through `updateElement` / `updateBlock`, never to a `Y.Map` directly, never to the view. Every mutation entry point checks `store.readonly` first.
- Cascade only on local edits, and only when writeable: `if (!local || surface.store.readonly) return;`. Remote peers must never re-apply a cascade; a cascade that cannot run is harmless because the author's own arrives through sync. Write a cascade **once**.
- Nothing in the editor blocks a gesture. Validation rules produce findings with a severity; the most permissive profile is the default. The sketch always wins.
- The library emits, the host transports. Telemetry, notifications, network, search, i18n: an injection point read with `std.getOptional(...)` and an explicit degraded behaviour (hide the button, log once, do nothing). `std.get(X)` only for what the library registers itself.
- Zero hardcoded user-facing string: every displayed string is a `com.labre.*` key with an English fallback in the declaration (ADR 0023). A model default never changes to translate a seed: the creation site writes the resolved value.
- Every network call in the library has an injectable endpoint and `fetch`; the default respects privacy (link preview and image proxy are the two that still default to a public worker — the seams table says so).
- Every package: `"private": true`, `"type": "module"`, `"sideEffects": false`, `"license": "MPL-2.0"`, a hand-written `exports` map. No license header per file; changing that is a red zone.
- One PR, one scope; gates green before merge.
- A quirk you do not understand gets a guard test before any change crosses it. No deletion in passing.

## Where to look, by what you are doing

Entry points, not an exhaustive list. Nothing is authorised by omission: if your task is not listed, the hard invariants still apply, mirror the closest canonical module, and state the assumption in one line in the PR. A missing entry is an entry to add, never a permission.

- A package, an entry point, an import across layers → _Structure, modules and boundaries_
- A block, a canvas element, a framework → _Block / framework template_, then `docs/add-a-framework/02-framework-rules.md`
- A Lit component, a signal, a service, a store write → _Lit, signals, DI and the store_
- Any user-facing string → _i18n_
- A network call, a seam, a fallback → _Seams, async and configuration_
- Pasted content, an embed, a remote URL, an import file → _Security_
- A schema, an element model, a stored prop → _Stored format_
- Gating a module or a capability → _Flags_
- Any test → _Testing_
- About to duplicate, abstract or delete → _Design and duplication_
- A comment, a doc, a decision worth remembering → _Comments, docs and ADRs_
- Estimating, or asked for "everywhere" / "every framework" → _Judgment_
- Opening, reviewing or merging a PR; releasing → _Review, scope and delivery_
- Deferring anything → _Debt_

## Structure, modules and boundaries

- Four layers, one direction: `framework/*` ← `affine/model` ← `affine/*` features ← `affine/all`. A package imports only from layers below it; `model` never imports a view, `std` never imports an `affine/*` package.
- A feature package is `packages/affine/<kind>/<name>` with `src/`, `src/__tests__/*.unit.spec.ts`, `effects.ts`, `store.ts`, `view.ts`, `translations.ts`. A framework adds `consts.ts`, `presets.ts`, `roles.ts`, `commands.ts`, `element-renderer/`, `element-view/`, `node/`, `toolbar/`, `templates/`, `rules.ts`, and exports `.` (headless data), `./view` (the two providers) and `./commands-manifest`.
- Mirror `gfx/wardley` rather than inventing a layout. Subclass, do not copy: a board extends `FrameworkBackgroundElementModel` and its view extends `DeclaredBackgroundView`; a menu extends `EdgelessCommandMenu`. Copied overrides are how `instanceof` skipped boards and elements sank (docs/lessons.md 15).
- Import a package through its entry point, never `dist/` or `src/` of another package; every import is declared in that workspace's `package.json` (`workspace:*`). Nothing under `store/test` is for hosts (ADR 0004).
- A framework contributes data, not menus: one `CommandDescriptor` per user-facing action; the senior sub-menu, catalogue, palette, shortcuts pane and agent are projections of it. One identity per framework, spelled once in `frameworks.ts` (`FrameworkId` = flag key = command owner = descriptor id; `telemetryKey` is frozen).
- No dependency added for what a few lines can do. A new peer-level dependency (anything a host also imports) is red-zone-adjacent: it affects every host's deduplication. Pin it, say so in the PR body.

## Lit, signals, DI and the store

- Blocks render in light DOM (`ShadowlessElement`): their styles are global, so scope every selector with the block's own class. Widgets and toolbar chrome keep shadow DOM.
- Mixin order is always `SignalWatcher(WithDisposable(Base))`; every subscription goes in `this._disposables`. No ad-hoc teardown.
- Read signals inside `render()`, derive with `computed`, group writes with `batch`, `peek()` outside a reactive context. **Never force a repaint by toggling a value off and on**: since signals-core 1.14 a batch ending on its initial value notifies nobody; bump a revision counter.
- DI: `createIdentifier<T>('Name')`, `di.override` / `di.addImpl` in `setup(di)`. Duplicate registration throws at boot; when two modules attach to one flavour, give the key an owner (`toolbarModuleKey(..., 'wardley-morph')`). Editor-scoped stateful services extend `LifeCycleWatcher`.
- `store.captureSync()` before a user gesture so one gesture is one undo step; `store.withoutTransact` for transient churn during a drag; never write when nothing changed (an unchanged write pushes an empty undo entry).
- Gfx models: persisted props are `@field()` accessors; `@derive`, `@convert`, `@observe`, `@local`, `@watch` for the rest. Painting is a bare renderer function registered with `ElementRendererExtension`; interaction is a `GfxElementModelView`. Picking geometry is the model's `includesPoint`; widen the interactive area in the **view**, calling `super` first. A gesture's reach is the element's hit test, not the picker's.
- A compartment is sized by what is painted: measure with the renderer's `wrapText` and `getLineHeight`, never a line count. A roled text with a fixed width survives being emptied.
- Colours: neutrals come from `NOTATION_NEUTRALS`, hues stay per framework in its `consts.ts`; a colour used to recognise a stored element stays a literal (R33). Framework palettes register from the gated extension (ADR 0027). The visual vocabulary is `DESIGN.md`.

## i18n

- The library ships no catalogue and negotiates no locale: `TranslationExtension({ t, language })` is the seam, English fallbacks are baked into the declarations, keys with no fallback render their key. The host owns the catalogue (the Labre app holds the French one).
- Keys are `com.labre.*`, unique and sorted, listed by `getTranslationKeyManifest()` (`manifest.unit.spec.ts`); each package declares its wordings in `translations.ts`, frameworks export `translationEntries` so a bundle carries its own words.
- Interpolation crosses the seam as i18next `{{name}}` placeholders; the host pluralises on `count`; the library only fills its English fallback, plurals stay neutral. Dates and numbers use `Intl` with `hostLocale(std)`, never keys.
- A `fallback: undefined` is a deliberate refusal. A term of art kept in English (Wardley "Pipeline") is a catalogue decision for the host, not an exception here.
- Every new displayed literal is a new key, or it fails `literals.unit.spec.ts`; the baseline only shrinks.

## Seams, async and configuration

- Read a host service with `std.getOptional(...)` and decide the degraded path explicitly; the seams table names it. Passing `null` for a default UI removes the button too: replace through an extension instead.
- Every outgoing request has an injectable endpoint and `fetch`; nothing in the library reads `process.env`.
- Every chain ends in an await, a catch or a rejection handler; every subscription is disposed with its owner.
- Explicit conditions on legitimate falsy values (`0`, empty string).
- Hosts read flags once at mount; the library does not re-read them. A refresh is a revision counter, not a toggle.

## Security

- Embedded iframes are sandboxed and refuse a non-http(s) URL. A remote image URL goes through `ImageProxyService`; a host that promises no third-party request sets its own proxy or `''`.
- An imported file (`.bpmn`, XMI, PlantUML, draw.io, OWM) is parsed by a pure function that returns serialized props; a hostile id is an id and nothing more; unknown data is preserved under `interchange[formatId]`, never executed (ADR 0012). An import re-checks `store.readonly` before it writes.
- No prose, no URL and no credential is ever emitted in telemetry: ids only, never board content, never a `pivotDocId`.
- Dependency advisories are fixed by raising the floor in the manifests, one changeset each; `dompurify` and `happy-dom` have been bumped that way.

## Stored format

- `packages/affine/model` is the file format; `packages/framework/store` and `sync` are the Yjs document format. A bad change corrupts documents irreversibly, so both are red zones and an ADR comes first.
- How to change a model safely: add optional fields with an `undefined` default; append to enums, never rename or remove; register a new element type in `SurfaceElementModelMap`; deprecate identifiers, never remove them; say in the ADR what stays loadable.
- Snapshots (JSON) feed the Markdown/HTML adapters; streaming binary Yjs updates are how documents are stored and synced. The server stores updates, never JSON.
- The persisted direction of a typed edge is semantic (source = subject of the role's verb, ADR 0010); preserve it through every transform. Connector end labels are four flat optional fields (ADR 0020); `PointStyle` is append-only (ADR 0016).

## Flags

- `OPTIONAL_BLOCKS` answers "does this block or framework exist for this user"; `OPTIONAL_CAPABILITIES` answers "does this build offer this capability". Same defaulting rule: missing means enabled. Do not file a capability under the block list, or the bundle script will look for a schema that does not exist.
- `{ x: false }` removes the senior button, sub-menu, catalogue entries, shortcuts, templates category, rules, legend button and palette page; elements already drawn keep painting, staying selectable and editable. A gated **block** still renders nothing until its view extension is split the way the frameworks' were (known gap, ADR 0009 consequences).
- A flag is three-state on the host side (`true`, `false`, absent); the host applies "missing means off" only to keys it created. A per-user preference may only narrow what the flag allows.
- Incident use: `{ x: false }` stops the bleeding; hiding content already written is a code change and a human decision.

## Testing

- Unit: Vitest, `src/__tests__/**/*.unit.spec.ts`, happy-dom by default, browser mode where the canvas is needed (`framework/std`, `gfx/bpmn`, `gfx/wardley` have a `vitest.browser.config.ts`). Root `vitest.workspace.ts` lists every package with tests; `yarn test:unit` runs them all, `yarn vitest run <filter>` from the package directory runs one.
- Integration: `packages/integration-test/src/__tests__/**/*.spec.ts`, Vitest browser mode on Playwright chromium, 1024×768, `isolate: false`, headless and `retry: 3` in CI. Keep `--no-file-parallelism` (in the script): the suite is load-sensitive. `setupEditor('edgeless' | 'page')` sets `window.doc` and `window.editor`.
- A feature or a bug fix ships with its test, colocated; the file starts with a docblock saying why the spec exists. Slow tests are a design smell, not a timeout bump. No focused test in a commit.
- Assert the observable effect, not the mechanics: drive `elementUpdated` with `local: true` and `local: false` for a cascade; mount the real extensions and read the container back for coverage (`reading-coverage.unit.spec.ts`), never the exported constant.
- Parity tests hold anything spelled twice: `templates-parity`, `commands-manifest`, `registry`, `senior-row-order`, `legend-subscription`, `board-role`, `framework-palettes-gating`, `export-svg-boards`. When you add a framework they fail until it is complete; that is their job.
- Prefer a compile error to a convention: `FrameworkId` is `satisfies readonly OptionalBlock[]`, a rule family without a scope line does not compile, a host that types its map as `Record<FrameworkId, …>` sees a new framework as a compile error.
- Performance is a budget test asserting a number (`FRAME_BUDGET_MS = 16` for a 500-element Wardley map); the bench takes the best of several samples and still flips under load. Rerun alone before calling it a regression.
- The playground is not a test oracle: console probes cannot subscribe to the app's signals (Vite serves a second signals-core instance), synthetic keydowns do not drive the dispatcher. Keyboard paths go in the integration suite.
- A cross-package change failing impossibly in one package's suite (an exported symbol reading as `undefined`, a stack frame quoting a line the file does not have) is a stale `<package>/node_modules/.vite`; delete it and rerun.

## Design and duplication

- Four copies of the same helper means one shared module; the `ddd-shared` package exists for that.
- One preset per artefact in `presets.ts`, read by creation and by morph; creation sites never restate sizes or fonts. One config read, one data access, imported everywhere.
- Look for what exists — a base class, a seam, a parity test, a fixture in `__tests__/corpus/` — before writing.
- No abstraction nobody asked for. A defensive fallback the library already guarantees is dead code: delete it.
- Deliberate duplication is acceptable only when a parity test holds it.
- The less you understand, the smaller the diff. A rewrite is an ADR, never a PR side effect.

## Comments, docs and ADRs

- Code is the source of truth. Comments are few, in English, and explain **why** — an invariant, a trap, a constraint — never what the code already says. Delete a comment that a rename would make redundant.
- This repo's docblocks are long on purpose: they are the memory of decisions, and they cite the ADR, issue or PR that motivated the code. A version reference ("since 0.40") is a verifiable fact; a date or a person is not.
- A deliberate shortcut is a `ponytail:` line naming the ceiling and the upgrade path.
- What you learned that the code does not say goes in an ADR, a guard-test header, `docs/lessons.md` or a why comment. Never only in the chat.
- One ADR per structural decision, `docs/adr/NNNN-short-title.md`, status and date, context / decision / consequences / amendments. Merge as `accepted` with or just before the code. Never edit an accepted decision: add a dated amendment or supersede in place. An ADR touching a red zone says so. Keep `docs/adr/README.md` current.
- A "we deliberately do not do X" is an ADR too (ADR 0013 is the model), so a coverage audit does not report it as missing.
- Contract docs live next to the code they govern (telemetry README, seams table, framework rules with their enforcing tests). Dated history belongs in ADRs and `lessons.md`, not here.

## Block / framework template

A new block (or gfx framework module) is DONE only when it has ALL of:

1. **Model/schema** in `packages/affine/model` (or element model for gfx), with a migration story for existing documents. A gfx BOARD extends `FrameworkBackgroundElementModel` and gets the generic "Export SVG" of its contextual toolbar for free (ADR 0025, rule R34).
2. **Store extension** + **view extension**, registered in `packages/affine/all/src/extensions/{store,view}.ts`.
3. **A flag** in `packages/affine/all/src/flags.ts` (`OPTIONAL_BLOCKS`) gating the module's TOOLING only, and for a framework a descriptor in `frameworks.ts` (one flag, one descriptor, one drawing, R35). Schema + store extension are registered unconditionally; a gfx framework splits its view into an always-on `…RenderViewExtension` and a flag-gated `…ViewExtension` (senior button, templates category, shortcuts, rules, legend, palette). Never gate anything a stored document needs to load or paint (ADR 0009).
4. **Telemetry**: creation sites emit `BlockCreated` (blocks); a framework declares `telemetry: { framework, element, board }` on its command descriptors and `runCommand` emits `FrameworkElementAdded` / `FrameworkToolPicked` (the board-placing command says `board: true`). Lifecycle events (edited/deleted/abandoned/duration) come free from `BlockLifecycleTelemetryWatcher`, for canvas flavours only (`CANVAS_FLAVOURS`); a prose-side block reports nothing but `BlockCreated`.
5. **Unit tests** (and an integration spec if it renders on the canvas). The shared parity tests in `packages/affine/all` fail until the framework is complete.
6. **One changeset** (`yarn changeset`) describing the user-facing change.

Mirror `gfx/wardley` for structure: consts / element-renderer / element-view / node/ / toolbar/ / view.ts. A framework is one drawing (R35): split when the boards are distinct sheets with disjoint vocabularies (the three DDD boards), keep one when artefacts mean something on each other's board (UML and its diagram kinds, ADR 0017). Optional parts (rules, nudges, legend, interchange, natures) a framework ships none of are declared absent in an ADR.

## Review, scope and delivery

- Branch model: `blocksuite-labre-main` is the integration and release branch, the repo default and the changeset `baseBranch`; every feature branch starts from it and every PR targets it. `main` is the dead upstream mirror (a PR against it shows thousands of files); `trimed-lib` is historical, do not branch from it. Check `git log -1` against `origin/blocksuite-labre-main` before starting: a worktree cut from a stale base once produced a 2211-file PR.
- One issue, one PR, a conventional-commit title, a changeset when a host can see the change. Body: what, why, how verified (commands and results), the ADR if one applies. Any out-of-scope commit leaves in its own branch, even when it is right.
- **Squash merge.** Sync a long-lived branch with `git merge origin/blocksuite-labre-main`; do not stack branches on other feature branches. `Closes #N` does not auto-close on a non-default branch: close issues by hand.
- CI (`test.yml`) runs format, typecheck+build, unit and integration on `pull_request`, on `workflow_dispatch` and on a nightly cron. **No run per push or merge to main, by policy**: merges rely on the PR run and the nightly safety net, so check `gh pr checks` before merging and rerun the PR job after a rebase. Two PRs green in isolation can still break main.
- Chromium in CI is installed after dropping the `packages.microsoft.com` apt source (intermittent 403); a broken chromium install is that, not a test failure.
- When CI quota is short, run locally in this order, each alone: `yarn lint:format`, `yarn build`, `yarn test:unit`, `yarn test:integration`.
- Two independent read-only reviewers with the same rubric; every finding cited as `file:line` and verified in the file. Review leans on this file and `docs/`, not on taste. The brief states the non-negotiables; gaps found in review usually come from a silent brief.
- A human reviews every PR; a red-zone change needs a maintainer's explicit approval and usually an ADR. Non-red-zone PRs may be merged by the agent once green.
- Release is manual and local: `yarn ci:version` (consumes `.changeset/`, bumps all `@labre/*` together by the highest pending bump, rewrites changelogs, reinstalls; does not commit) → commit `chore: version packages (x.y.z)` → `npm whoami` → `yarn ci:publish` (build packages, generate and compile bundles into `dist-bundles/`, publish in dependency order, skip versions already on the registry, refuse a bundle without its `LICENSE`). `ci:publish` is the product owner's call. `0.x` minors never break a host; a breaking change is a major even in `0.x`.
- Record the cause of a detour — a stale fact in memory, a wrong assumption — in `docs/lessons.md` when it will bite again, and fix the source, not only the symptom.

## Debt

- What is deferred is deferred with its reason and a ready-to-run task; in code it is a `ponytail:` line, never a bare `TODO`.
- Non-conforming code outside the diff is reported, not fixed in passing; a dedicated pass if the PO validates it.
- A risk measured and not fixed is written down with the trigger that would harden it (the flaky benches, the two integration specs fetching a dead asset host).

## Judgment

Nobody holds the whole theory of this repo, and a session starts with none.

- Work with a partial theory; do not wait for a complete one.
- Understand one real path end-to-end (a command from descriptor to `runCommand` to store write to renderer), then branch out. Read the path, not the repo.
- Take a position: an educated guess you state beats a question you could have answered yourself.
- A plausible model is not a checked one. When checking is cheap — run the package's tests, read the caller, mount the extension — check.
- State an assumption made under ambiguity in one line in the PR.
- Understanding is one value among several: the stored format, a host's privacy, a red zone or shipping the fix outrank a cleaner mental model.

### Wicked features

A wicked feature must be reconsidered every time any other feature is built. It is wicked at the level of the user-flow diagram, not the implementation. Avoid creating one; limit the blast radius of the ones we have.

Already wicked here — walk this list before estimating anything:

- Two views of one document (page and edgeless): switching converts nothing and keeps undo; every block may render in both.
- Nine frameworks (plus the DDD template categories) behind one registry, one flag each, one senior row capped at 13 + 1, one catalogue, one shortcuts pane, one legend engine, one palette carousel, one SVG export — every projection must hold for each.
- Nearly thirty host seams that must each degrade gracefully, and a table that says how.
- The persisted Yjs format, which is forever: every stored prop, enum value, role id and command id.
- Every displayed string as a `com.labre.*` key with an English fallback; the FR catalogue lives in the host.
- Granular source (82 workspaces, source-first `exports`) versus coarse publication (about ten compiled bundles, Node-resolvable): every new package must land in the right bundle.
- MPL-2.0 file-level copyleft: every published tarball ships the licence, every package manifest declares it.
- Upstream cherry-picks: the source tree keeps AFFiNE's layout so a cherry-pick stays cheap; the bundle scripts rewrite the emit rather than the ~1000 source sites.
- Collaboration: any cascade may receive a change from another peer or a readonly store.

A request matching one of these creates a new wicked feature — challenge it before building:

- A new framework or block family — registry, flag, descriptor, senior button, templates, rules, legend, palette, SVG export, bundle, parity tests, demo content. Ask first: is it one drawing (R35), or a kind on an existing board?
- A new flag key or a second flag axis — every host's flag service, the bundle script, the flags README. Ask: an existing key?
- A new seam — every host must decide what to inject, and the table gains a row forever. Ask: can an existing seam carry it?
- A new stored field or a new element type — a permanent constraint on every future reader. Ask: an optional field with an `undefined` default on an existing model?
- A new published bundle or a dependency between bundles — the build script, the publish order, the host's aliases.
- "Every framework should…", "every board gets…" — wicked by construction. Ask for the one framework that needs it, then make it a projection of declared data rather than per-framework code.
- A new mode or toggle everything must respect (a third view, a per-document setting) — ask: a per-action choice instead?
- A locale-specific behaviour beyond copy (a naming convention, a date format) — it crosses the seam as `language`; the library still chooses nothing.
- A network default pointing at a third party — forbidden without an injectable replacement; say so and stop.
- A flag gating content stored data needs — forbidden outright (ADR 0009); say so and stop.
- "Users should be able to import/export between…" — an interchange capability is a permanent contract on both sides; unknown data must be preserved (ADR 0012).
- A first-party React or Vue wrapper — a second copy of every seam and every doc; the host renders the container instead.

How to challenge:

- State the blast radius in one paragraph: which existing wicked features it touches, which new one it creates.
- Propose the version that creates none, and build that one unless the human insists.
- If accepted anyway, factor it behind one seam or one declaration that owns the rule, so the next framework does not have to know.

## Red zones — mandatory human review

- There is no `CODEOWNERS`; this section and `docs/contribute/03-rules.md` are the list. A change here needs a maintainer's explicit approval and usually an ADR.
- License headers / MPL-2.0 obligations (file-level copyleft), including the per-file "no header" rule and the `LICENSE` copied into every bundle.
- `packages/framework/store` and `sync` (Yjs document format: a bad change corrupts user documents irreversibly).
- Schema/model changes of existing blocks and elements (`packages/affine/model`) — they must stay loadable by documents created before the change.
- Anything that publishes packages or touches CI: `scripts/*-bundles.mjs`, `ci:version` / `ci:publish`, `.changeset/config.json`, `.github/workflows/*`.
- A flag that touches content — forbidden outright, not merely reviewed (ADR 0009).
- A new peer-level dependency (anything a host also imports) — red-zone-adjacent.
- Ask a human before: `yarn ci:publish`, any destructive git operation, any new third-party default endpoint.

## Upstream policy

We do not track upstream, but `../AFFiNE-upstream` (shallow clone of toeverything/AFFiNE, editor under `blocksuite/`) is kept as a reference for targeted cherry-picks: security bumps, block bug fixes, renderer fixes. A monthly triage lists upstream commits touching `blocksuite/` and skips AI, mobile, server and app-importer work. Structural drift is low (see autoDevFactory `docs/etude-affine-upstream.md`). Never publish under the `@blocksuite/*` scope — it belongs to the AFFiNE team (ADR 0001).

## Commands and local setup

- The commands are the root `package.json` scripts; this file does not copy them. The ones you will run: `yarn dev`, `yarn build`, `yarn test:unit`, `yarn test:integration`, `yarn lint:format`, `yarn format`, `yarn changeset`, `yarn build:bundles`.
- Node `>=18.19 <23` (`.nvmrc` says 22), Yarn 4.7.0 pinned by `packageManager` (Corepack). `yarn install --immutable`; `postinstall` installs the git hooks.
- Playground: `yarn dev` opens Vite on `http://localhost:5173`. Entries: `/starter/?init` (page), `/starter/?init&mode=edgeless` (whiteboard), `/starter/?init&room=x` plus a second tab on `/starter/?room=x` for collaboration through a broadcast channel. Packages are imported from source, edits reload live. `applyFlags` in the playground console exercises the flag contract.
- Run a package's tests **from its directory**: from the root, `--config <pkg>/vitest.config.ts` finds nothing and `--project` filters hang. Run `yarn test:unit` alone: a concurrent `tsc -b` starves the browser-mode projects. First integration run: `npx playwright install`.
- Known gotchas: worktrees check out with CRLF (Prettier flags every file; `.gitattributes` only forces LF on `*.snap`) and have no `node_modules`; the git stash is shared between worktrees, so never a bare `git stash` (use `git stash push -u -m <tag>` and `apply`, or a WIP commit); `npm publish` masks an expired token as a 404 (`npm whoami` first); no `python` on some machines, script edits with Node.

## Resources

Internal

- Entry point: `docs/README.md` · principles: `docs/principles.md` · lessons: `docs/lessons.md` · ADR index: `docs/adr/README.md`
- Contribute: `docs/contribute/01-setup.md` → `02-workflow.md`, `03-rules.md`, `04-testing.md`, `05-release.md`, `06-decisions.md`, `07-dev-practices.md`
- Integrate: `docs/integrate/01-install.md` → `03-flags.md`, `04-host-seams.md`, `05-persistence-and-sync.md`, `06-build-tooling.md`, `07-upgrade.md`
- Add a framework: `docs/add-a-framework/01-definition-of-done.md`, `02-framework-rules.md` (rules with their enforcing tests), `03-anatomy.md`, `04-step-by-step.md`, `05-review-checklist.md`
- Contracts next to the code: `packages/affine/shared/src/services/telemetry-service/README.md`, `packages/affine/all/src/flags.ts` docblock, `docs/element-link-integration.md`
- Design system: `DESIGN.md` · short build guide: `BUILDING.md`
- Release scripts: `scripts/build-bundles.mjs`, `compile-bundles.mjs`, `publish-bundles.mjs`

Sibling repos

- Labre app: `../labre` — https://github.com/formicoidea/labre (private). Consumes the bundles as `@labre/*` aliases; registers every seam in its `modules/editor/extensions.ts`; owns the FR catalogue and the PostHog adapter. Read its `CLAUDE.md` for the host side of every seam. Never modify it from a library session: deliver host follow-ups as information (keys, wording, mechanism).
- Structural model: `../AFFiNE-upstream` — https://github.com/toeverything/AFFiNE (editor under `blocksuite/`)
- MCP server: `../labre-mcp` — https://github.com/formicoidea/labre-mcp

External docs

- BlockSuite: https://blocksuite.io/guide/overview.html · Yjs: https://docs.yjs.dev · Lit: https://lit.dev/docs
- Preact signals: https://preactjs.com/guide/v10/signals · vanilla-extract: https://vanilla-extract.style
- Vitest: https://vitest.dev (browser mode: https://vitest.dev/guide/browser) · Playwright: https://playwright.dev · Vite: https://vite.dev
- Changesets: https://github.com/changesets/changesets · Yarn workspaces: https://yarnpkg.com/features/workspaces · commitlint: https://commitlint.js.org
- MPL-2.0: https://www.mozilla.org/en-US/MPL/2.0/FAQ/
