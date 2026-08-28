# ADR 0008 — Command registry built on the shortcut manifest

- Status: proposed (August 2026) — requires human approval.
- Deciders: Mathieu Jolly
- Related ADRs: [0002](0002-flag-gated-block-registry.md) (flag registry),
  [0003](0003-telemetry-bus-and-taxonomy.md) (event taxonomy),
  [0006](0006-pivot-properties-provider.md) (render-free host seam),
  [0009](0009-reversed-flag-contract.md) (flags gate tooling, not content).

## Context

Recorded from spike PF3.2 of the gfx-layer overhaul.

Labre is growing a "command registry": ONE enumerable, framework-filterable
source of truth describing every command/artefact a senior button (a framework
button in the edgeless toolbar) offers. Five consumers must read it without
duplicating it:

1. the senior button's sub-menu (hard cap: 14 slots),
2. the "more artefacts" sidepanel (full catalogue, by sub-category),
3. Settings › Shortcuts,
4. the search / command palette,
5. Labre's AI (artefact invocation by an agent).

Cross-cutting: framework gating — a disabled framework must vanish from all
five surfaces at once. The gating mechanism itself is the flag registry of
[ADR 0002](0002-flag-gated-block-registry.md); this ADR only decides what the
five surfaces read.

### What exists today

The library already has **five unrelated declaration surfaces**, and a
framework's artefacts are spelled out in two or three of them.

**(a) The shortcut manifest** — `ShortcutDescriptor` in
`packages/framework/std/src/extension/shortcut.ts`, aggregated by
`getShortcutManifest(flags)` in `packages/affine/all/src/shortcuts.ts`. It is
the only structure that is already a _manifest_: enumerable without an editor
instance, metadata-only (`ShortcutManifestEntry = Omit<ShortcutDescriptor,
'handler'>`), and flag-gated per framework through `FRAMEWORK_SHORTCUT_GROUPS`.

Against the acceptance checklist, it already exposes:

| Requirement            | Status                                                                                                                                                                                                                                        |
| ---------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| stable id              | yes — `id` (`'undo'`, `'wardley.addComponent'`)                                                                                                                                                                                               |
| i18n label             | yes — `labelKey`, resolved host-side                                                                                                                                                                                                          |
| scope                  | yes — `ShortcutScope = 'global' \| 'page' \| 'edgeless'`                                                                                                                                                                                      |
| owning framework       | **partial** — the field exists but `owner` is plain `string` (`shortcut.ts:36`); the only typing is `FrameworkShortcutGroup.owner: OptionalBlock` (`affine/all/src/shortcuts.ts:15`)                                                          |
| host overrides         | yes — `ShortcutOverrides`, injected via `KeymapOverrideExtension` (`packages/affine/shared/src/services/keymap-override-service.ts`)                                                                                                          |
| conflict detection     | **partial** — `canonicalCombo` + `resolveKeymap` never silently bind a duplicate and report through `ShortcutConflictReporterIdentifier`, but only among _registered descriptors_; the imperative bindings of surface (e) are invisible to it |
| chords (letter+letter) | yes — `defaultKeys` is a keystroke _sequence_, with v0.29 legacy-format compat (`normalizeLegacyCombo`)                                                                                                                                       |
| flag gating            | yes — `buildShortcutManifest` filters on `isBlockEnabled`                                                                                                                                                                                     |

Coverage is real, not aspirational: 15 tests in
`packages/framework/std/src/__tests__/shortcut.unit.spec.ts` plus the manifest
tests in `packages/affine/all/src/__tests__/shortcuts/shortcuts.unit.spec.ts`.

**(b) The senior-button sub-menus** — hand-written Lit components, one per
framework: `packages/affine/gfx/wardley/src/toolbar/wardley-menu.ts` (13
buttons), `gfx/edgy/src/toolbar/edgy-menu.ts` (7), `gfx/bpmn/src/toolbar/bpmn-menu.ts`
(6), plus cynefin-estuarine and the three DDD menus. Each button hard-codes an
English `.tooltip=${'…'}` string and an icon import. The senior button itself
is a second hard-coded label (`SeniorToolExtension('wardley', … name: 'Wardley
map' …)` in `toolbar/senior-tool.ts`).

**(c) The element toolbar** — `ToolbarAction`
(`packages/affine/shared/src/services/toolbar-service/action.ts`, assembled by
`ToolbarModuleConfig` in the sibling `config.ts`), a genuinely
declarative `{ id, icon, tooltip, when, active, run }` shape. But it is
_selection-contextual_: every action is written against `ToolbarContext` and
only exists while matching elements are selected. It is not enumerable
off-canvas and carries no keys, no owner, no i18n key.

**(d) The slash menu** — `SlashMenuItem`
(`packages/affine/widgets/slash-menu/src/types.ts`), with `name`, `description`,
`icon`, `group` (`'${number}_${string}@${number}'`), `searchAlias`, `when`. It
already solves grouping and search aliasing, but names are raw English strings,
it is bound to a `BlockModel` context, and it has no keys and no owner.

**(e) The imperative edgeless bindings** — and this is the one that matters
most for chords. `packages/affine/blocks/root/src/edgeless/edgeless-keyboard.ts:89-215`
binds, through a single raw `bindHotKey({...})` call and **entirely outside the
manifest**: `v` (select), `t` (text), `c` (connector), `h` (pan), `n` (note),
`p` (brush), `Shift-p` (highlighter), **`e` (eraser)**, `k` and `-` (note
slicer), `f` (frame), `@` (quick search), `Shift-s` (shape cycling). They are
not `ShortcutDescriptor`s, so they are neither enumerable, nor rebindable, nor
visible to `resolveKeymap`'s conflict detection. Two of them already emit
telemetry with `control: 'shortcut'` (`edgeless-keyboard.ts:158-164, 202-208`).

### The duplication, concretely

Wardley is the only framework with keyboard shortcuts
(`gfx/wardley/src/shortcuts.ts`, 7 chords `w`+letter). Both the shortcuts and
the menu call the _same_ action functions in `gfx/wardley/src/actions.ts`
(`createWardleyNode`, `activateWardleyConnector`, …) — the behaviour layer is
already shared. What is duplicated is the **declaration**: the menu lists 13
artefacts with English tooltips, the manifest lists 7 with `labelKey`s, and the
two lists have already drifted — 6 artefacts exist only in the menu (the
`opportunity`, `benefit` and `evolution-gradient` backgrounds, market,
ecosystem, anchor); nothing detects the omission. EDGY and BPMN have menus and
zero manifest entries, so today they are invisible to Settings › Shortcuts.

Framework **identity** is spelled five times with no shared type, and has
already drifted: the flag key (`OPTIONAL_BLOCKS` in
`packages/affine/all/src/flags.ts`) says `'cynefin-estuarine'`,
`'ddd-event-storming'`, `'ddd-core-domain'`, `'ddd-context-map'`, while the
telemetry union (`FrameworkElementEvent.framework` in
`packages/affine/shared/src/services/telemetry-service/lifecycle.ts`) says
`'cynefin'`, `'event-storming'`, `'core-domain'`, `'context-map'`. The senior
tool id (`SeniorToolExtension('wardley', …)`), the `ShortcutDescriptor.owner`
and the bundle descriptor generated by `scripts/build-bundles.mjs` are three
further copies of the same key.

## Gap analysis

What the manifest would still be missing as a command registry:

- **Programmatic invocability (blocking).** `ShortcutDescriptor.handler` is
  `(std: BlockStdScope) => UIEventHandler`: keyboard-shaped by construction —
  it receives a `UIEventStateContext`, calls
  `ctx.get('defaultState').event.preventDefault()` and returns a boolean to
  consume the keystroke (see the `wardleyShortcut` factory in
  `gfx/wardley/src/shortcuts.ts`). Consumers 1, 2, 4 and 5 have no such event.
  This is the one property that cannot be added as a field — it changes the
  shape of the callable.
- **Keyless commands.** Most artefacts will never ship a default chord — not
  because of a numeric budget (the second keystroke of a `w`+letter chord is
  bounded by the alphabet plus modifiers, not by anything in the product), but
  because defaults are curated: only the frequent gestures earn one. The
  registry must therefore hold commands with no default binding, and Settings ›
  Shortcuts must still be able to _assign_ one. Note this is already possible:
  `redo-windows` (`blocks/root/src/keyboard/shortcuts.ts:49-61`) ships
  `mac: []` and is a perfectly meaningful manifest entry, and `resolveKeymap`
  skips empty keys gracefully (`shortcut.ts:152`). What is missing is a
  descriptor that declares itself keyless _by intent_ rather than by platform.
- **Prefix-letter allocation.** The real scarce resource is the framework's
  _first_ chord letter, and it is contended by surface (e): `e` is the eraser,
  `c` the connector, `n` the note, `t` the text tool. `w` was free by luck.
  Nothing today can answer "which single letters are taken?", because the
  competitors are not descriptors — an EDGY prefix on `e` would shadow the
  eraser with no conflict report.
- **Sub-categories.** No grouping field. The catalogue sidepanel needs one;
  the closest precedent in the repo is `SlashMenuItem.group`.
- **Icons.** None. Icons are Lit templates local to each menu — a sibling
  `toolbar/icons.ts` for wardley / edgy / bpmn / cynefin-estuarine, inline SVG
  literals or the shared `gfx/ddd-shared/src/toolbar/icons.ts` for the DDD
  modules. Unreachable from the manifest either way.
- **Description / search terms.** No `description`, no alias list; the palette
  needs both (`SlashMenuItem` has `description` + `searchAlias`).
- **Surface targeting.** No way to say "this appears in the sub-menu but not
  in the palette". Today the manifest is implicitly a single surface.
- **Ordering.** No rank. `SeniorTool.order` orders the buttons _between_
  frameworks; nothing orders artefacts _within_ one.
- **Availability predicate.** `when?: string` is a host-interpreted opaque
  string, unused by every descriptor in the repo, and unusable by an in-library
  consumer.
- **Recency / frequency of use.** Absent, and deliberately not a library
  concern — it is per-user state. The registry only needs to accept an
  injected ranking comparator.
- **Kind.** Nothing distinguishes "creates an element" from "arms a tool" from
  "flips a property". The agent surface needs that distinction, and so does a
  catalogue that shows artefacts but not toggles.
- **Parameters.** Commands are nullary. `createWardleyBackground(gfx, variant)`
  is exposed today as four separate menu buttons; an agent wants one command
  with a typed `variant` parameter.
- **Framework identity — key.** `owner` is `string` — see the drift above.
- **Framework identity — display.** Worse than the key: the framework's
  user-visible name is a raw English string on `SeniorTool.name`
  (`'Wardley map'`, `wardley/src/toolbar/senior-tool.ts:6`). Consumers 2, 3, 4
  and 5 each need a per-framework label, icon and order (sidepanel sections,
  Settings groups, palette breadcrumb "Wardley map › Component", agent). There
  is no framework-level descriptor at all.
- **Telemetry — the emitter.** Not in the descriptor; each menu re-implements
  its own `track` helper (`gfx/wardley/src/actions.ts` for wardley, `_track`
  methods in `bpmn-menu.ts` and `edgy-menu.ts`, `DddMenuBase.track` for the DDD
  trio) — and `gfx/cynefin-estuarine/src/toolbar/menu.ts` emits nothing at all.
- **Telemetry — the invoking surface.** Wardley already discriminates menu from
  keyboard: `WardleyActionSource` (`actions.ts:60-73`) sets `segment`/`module`
  to _wardley menu_ vs _keyboard shortcut_, and `segment`/`module`/`control`
  are base `TelemetryEvent` fields (`telemetry-service/types.ts:15-23`). With
  five surfaces, "which surface invoked this" becomes _the_ metric arbitrating
  the 14 slots against the sidepanel against the palette. A nullary `run(std)`
  would destroy that dimension, so it must be an argument.

## Decision

**Extend the manifest, but invert the direction of dependency.** Introduce a
`CommandDescriptor` in `@labre/std` as the single source of truth; the keyboard
binding becomes one _facet_ of a command — present, possibly empty, always
rebindable — and `ShortcutDescriptor` becomes a projection of it rather than
its own declaration.

We keep the shortcut _resolution engine_ untouched (`canonicalCombo`,
`normalizeLegacyCombo`, `resolveKeymap`, `ShortcutKeymapExtension`, the
override table, the conflict reporter). It is the only piece of this area that
is fully specified and tested, it carries a released persistence format
(v0.29 override tables), and nothing about the five consumers argues against
it. We replace the _declaration_ surface above it, not the engine below it.

### Two tiers, because the consumers sit on two sides of a seam

Consumers 1, 4 and 5 run inside the editor and can call functions. Consumers 2
and 3 are host-side panels that must render **without an editor mounted** — the
manifest's defining property today. So there is one declaration and **three
projections**, all derived, none authored:

- `CommandDescriptor` — the in-library authoring shape and the single source.
  Holds `run`, the availability predicate and the icon template. Never crosses
  the host seam.
- `ShortcutDescriptor` → `ShortcutManifestEntry` — the existing chain, for the
  keymap and for Settings › Shortcuts. **Keeps representing shortcuts and
  nothing else** (owner decision, see Icons below): it gains no `iconKey`, no
  `category`, no catalogue metadata.
- `CommandManifestEntry` — the **serializable** catalogue projection, for
  consumers 2, 4 and 5. No functions, no `TemplateResult`: an `iconKey`, and
  availability reduced to the closed `Availability` union. This honours
  [ADR 0006](0006-pivot-properties-provider.md)'s rule that the host seam stays
  typed and render-free.

  > **Amended 2026-08-01 (PR #89).** It also carries `params?: CommandParam[]`,
  > a minimal serializable description (`key`, `kind`, `required`, `nullable`)
  > **derived** from `CommandDescriptor.params` rather than authored twice. The
  > first parameterised command made the omission concrete: consumer 5 could
  > read the whole catalogue and still have no way to learn that `pivot.bind`
  > needs a record id, and an argument-less invocation is a silent no-op. The
  > zod schema itself never crosses — it is a graph of functions. Derivation is
  > all-or-nothing: one property the reader cannot describe withdraws the whole
  > contract, because a partial one would have an agent send exactly what the
  > manifest told it to and be rejected for a key the manifest never mentioned.

### Availability is a closed union — audit and decision

The open question was whether `when: (std) => boolean` reduces to something a
host panel can evaluate with no editor. Answered by inventorying every
availability predicate in the repo: **119 sites** (95 toolbar, 18 slash-menu,
5 code-toolbar, plus 2 static `enable` booleans).

The decisive finding is one of **scope**. 52 of those predicates are genuinely
irreducible — cardinality-branching (`edgeless/configs/toolbar/more.ts:301`
returns a different answer for 0 / 1 / >1 elements), command chains executed
inside the predicate (`blocks/root/src/configs/toolbar.ts:68,135,152,178`),
DOM ancestor tests and hover payloads (`inlines/link/src/link-node/configs/toolbar.ts:295`),
runtime component state (`blocks/surface-ref/src/configs/toolbar.ts:20`),
provider lookups keyed on model data (`blocks/embed/src/configs/toolbar.ts:206`).
**Every one of them belongs to the element toolbar or the slash menu** —
surfaces (c) and (d), which this ADR already places out of scope. None of them
is a framework artefact command, and none would migrate into the registry.

Within the actual in-scope population — the ~55 framework artefacts plus
`coreShortcuts` and `shapeShortcuts` — the predicates are almost trivial:

| Case                                                        | Population                                                                                                                                                                                                                                     |
| ----------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| no precondition at all (menu buttons carry no `when` today) | ~48 of ~55 artefacts                                                                                                                                                                                                                           |
| non-empty selection and not text-editing                    | `duplicate`, `applyLastStyle` (`blocks/root/src/keyboard/shortcuts.ts:73-77,107-111`), `shape.cycleTextFit` (`gfx/shape/src/shortcuts.ts:19-25`)                                                                                               |
| selection of a specific framework model type                | the wardley background toggles, if ever promoted from element toolbar to command (`gfx/wardley/src/toolbar/config.ts:167`)                                                                                                                     |
| document not read-only                                      | the only real state precondition in the repo: `enable: !block.store.readonly` (`blocks/frame/src/edgeless-toolbar/quick-tool.ts:13`, `gfx/link/src/undo-tool.ts:17`) and `!doc.readonly` (`blocks/code/src/code-toolbar/config.ts:92,236,271`) |

So the union closes, with **one member added beyond the proposed three** —
`'editable'`, which is not speculative: read-only documents ship today and no
creation command should be offered in one.

```ts
/** Serializable precondition. Closed; extended only by an ADR amendment. */
export type Availability =
  | 'always' // default when omitted
  | 'selection' // any non-empty selection, not text-editing
  | 'selection:framework' // selection contains the owner's element types
  | 'editable'; // document is not read-only
```

**Availability and surface are orthogonal, and compose.** (Owner proposal of
2026-08-01, requalified.) `'ai'` was proposed as an availability value; it is
not one — the AI is consumer 5, an axis that already exists as
`CommandSurface`. A command declares _who may invoke it_ through `surfaces` and
_under what state_ through `availability`, independently:

```ts
{ surfaces: ['catalogue', 'agent'], availability: 'selection' }
// offered in the sidepanel and invocable by the agent — but only with a selection
```

**Document modes are legitimate state preconditions, but only one exists.**
Adding a member for a concept with no implementation would be inventing a
contract, so: **the union is closed but extensible by decision.** Extending it
requires an amendment to this ADR.

The named waiting list is the set of **document / canvas modes** — states the
document as a whole can be in, which condition what commands may be offered
while that state holds. Two are known, with opposite statuses (owner decision,
2026-08-01):

| Mode        | Implemented today?                                                                                                                                                                                           | In the union?                                                                                      |
| ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------- |
| `read-only` | **Yes** — the binary `store.readonly` ships and is already read by `blocks/frame/src/edgeless-toolbar/quick-tool.ts:13`, `gfx/link/src/undo-tool.ts:17`, `blocks/code/src/code-toolbar/config.ts:92,236,271` | **Yes**, as `'editable'` — the union expresses the permissive side, so `'editable'` ≡ ¬`read-only` |
| `revision`  | **No** — no such document mode exists                                                                                                                                                                        | **No.** Waiting list; admitted by decision when the mode exists                                    |

`revision` is therefore the **only** named candidate, and it does not enter the
union now: it is admitted by an amendment to this ADR at the moment the mode
actually exists, not before.

An "AI mode" was considered as a second candidate and **rejected as a
duplicate**: an AI operating in the document is not a document mode, it is the
`'agent'` surface already decided above — consumer 5 invoking a command, listed
in `surfaces` like any other caller. There is one AI concept in this design and
it lives on the surface axis.

For the record, the two clusters deliberately **not** admitted, and their
assigned fallback (displayed available, `run` no-ops or is a no-op-safe
toggle): feature-flag gating (4 sites, e.g.
`gfx/connector/src/toolbar/config.ts:223` — flags are the host's business via
`BlockFlags`, not a per-command precondition) and injected-provider presence
(7 sites, e.g. `blocks/root/src/edgeless/configs/toolbar/more.ts:383` gating on
`QuickSearchProvider`). Both are editor-toolbar concerns; if a command ever
needs one, that is the amendment trigger.

### Target schema

```ts
/**
 * Single framework identity. Derived from an EXPLICIT sub-list, not asserted as
 * a subset of `OPTIONAL_BLOCKS`: that list mixes frameworks with plain blocks
 * and even contains `'edgeless-text'` twice (`flags.ts:34` and `:48`).
 */
export const FRAMEWORK_IDS = [
  'wardley',
  'edgy',
  'cynefin-estuarine',
  'bpmn',
  'ddd-event-storming',
  'ddd-core-domain',
  'ddd-context-map',
] as const satisfies readonly OptionalBlock[];
export type FrameworkId = (typeof FRAMEWORK_IDS)[number];
export type CommandOwner = 'core' | FrameworkId;

/** Which surfaces a command opts into. Absent from the array = absent from the surface. */
export type CommandSurface =
  | 'senior-menu' // (1) senior button sub-menu — max 14 slots per owner
  | 'catalogue' // (2) "more artefacts" sidepanel
  | 'palette' // (4) search / command palette
  | 'agent'; // (5) invocable by Labre's AI
// (3) Settings › Shortcuts is NOT in this union: every command is bindable.

export type CommandKind =
  | 'artefact' // creates an element (createWardleyNode…)
  | 'tool' // arms a tool (activateWardleyConnector…)
  | 'toggle' // flips a property (wardley background toggles)
  | 'legend' // generates a legend (FrameworkLegendCreated, ADR 0003 § 3)
  | 'action'; // everything else (undo, duplicate, applyLastStyle)

/** Where the invocation came from — feeds `segment`/`module`/`control`. */
export interface CommandInvocation {
  surface: CommandSurface | 'shortcut';
  /** Maps onto the existing `ElementCreationSource` union (`types.ts:1-13`). */
  source: ElementCreationSource;
}

export interface CommandDescriptor<P = void> {
  /** Stable id; same namespace as today's shortcut ids: `'wardley.addComponent'`. */
  id: string;
  owner: CommandOwner;
  kind: CommandKind;

  /** i18n keys — resolved host-side, as `ShortcutDescriptor.labelKey` already is. */
  labelKey: string;
  descriptionKey?: string;
  /** Sub-category inside the owner's catalogue, e.g. `'backgrounds'`, `'nodes'`. */
  category?: string;
  /**
   * Stable asset key, NOT markup. Resolved to a template by the library's own
   * icon registry (see Icons); a host may substitute its set, but need not.
   */
  iconKey?: string;
  /** Extra search terms for the palette (cf. `SlashMenuItem.searchAlias`). */
  keywords?: string[];

  surfaces: CommandSurface[];
  /** Ascending rank inside `senior-menu` / `catalogue` (cf. `SeniorTool.order`). */
  order?: number;

  scope: ShortcutScope;
  /**
   * Default chord. `{ mac: [], other: [] }` means "no default, still bindable"
   * — the shipped `redo-windows` precedent. Never `undefined`.
   */
  defaultKeys: { mac: string[]; other: string[] };

  /** Serializable precondition; defaults to `'always'`. Crosses the seam. */
  availability?: Availability;
  /**
   * Escape hatch for an in-library refinement of `availability` (never
   * contradicting it, only narrowing). Not projected into the manifest.
   */
  when?: (std: BlockStdScope) => boolean;

  /** THE new capability: invocable without a keyboard event. */
  run: (
    std: BlockStdScope,
    invocation: CommandInvocation,
    params?: P
  ) => void | Promise<void>;
  /** Agent-facing parameter contract (zod is already a std dependency). */
  params?: z.ZodType<P>;

  /**
   * Central emit at `run()`; the invocation supplies segment/module/control.
   * `framework` is the code-side id — the emitter maps it through
   * `FrameworkDescriptor.telemetryKey` so the wire value stays historical.
   */
  telemetry?: { framework: FrameworkId; element: string };
}

/**
 * The per-framework identity consumers 2-5 need, and nothing owns today. Also
 * THE source for packaging: `scripts/build-bundles.mjs` derives from this
 * list instead of its hand-maintained `FRAMEWORKS` array (see Packaging).
 */
export interface FrameworkDescriptor {
  id: FrameworkId;
  labelKey: string; // replaces the raw English `SeniorTool.name`
  iconKey: string;
  order?: number;
  /** First keystroke of this framework's chords — allocated, not chosen ad hoc. */
  chordPrefix?: string;
  /**
   * Historical PostHog value for `FrameworkElementEvent.framework`, kept as-is
   * so the identity rename stays code-side and analytics never break.
   * e.g. id `'ddd-event-storming'` → telemetryKey `'event-storming'`.
   */
  telemetryKey: string;
  /** Packaging: the bundle entry is derived from these. */
  pkg: string; // '@labre/affine-gfx-wardley'
  dir: string; // 'affine/gfx/wardley'
  extensions: { flag?: FrameworkId; viewExtension: string }[];
}
```

### Icons: one source of truth, and it is the library

The icons stay **in the package**, where the SVGs already live
(`gfx/*/src/toolbar/icons.ts`, `gfx/ddd-shared/src/toolbar/icons.ts`). The
render-free rule is honoured by splitting the lookup out of the data:

- The serializable projections carry `iconKey` and nothing else. No
  `TemplateResult` ever crosses the host seam.
- The library exposes a **separate accessor, outside any manifest** — an icon
  registry `iconKey → TemplateResult`, assembled from the existing per-package
  icon modules. In-editor consumers (1, 4) call it directly.
- A host **may** substitute its own set by mapping the keys itself. The default
  is the library's; the host inherits working icons by doing nothing.

Corollary, stated because it is the rule that keeps this clean: **the shortcut
manifest is an interface that represents shortcuts — nothing else lives
there.** `ShortcutManifestEntry` gains no `iconKey` and no `category`. Icons
never transit through it. Catalogue metadata travels on
`CommandManifestEntry`, which is a different projection for different
consumers.

### Telemetry emits at the bottleneck

Emission happens in **the one function that is not duplicated** — the
registry's single `run()` — and nowhere else. Today every surface re-implements
its own emit (`gfx/wardley/src/actions.ts:126-138`, the `_track` methods in
`bpmn-menu.ts:169-180` and `edgy-menu.ts:245-256`, `DddMenuBase.track`), which
is how cynefin-estuarine ended up emitting nothing at all and how the same
artefact can be counted differently depending on which menu created it.
Centralising removes the per-surface duplicates outright.

The surface dimension is not lost, because it is an argument:
`CommandInvocation.surface` (already specified above) tells the single emitter
which of the five consumers invoked the command, feeding `segment` / `module` /
`control`.

Analytics continuity is bought with `FrameworkDescriptor.telemetryKey`: the
historical values (`'cynefin'`, `'event-storming'`, `'core-domain'`,
`'context-map'`) keep being emitted, while `FrameworkId` unifies identity
**code-side only**. Zero breakage for existing PostHog dashboards, and the
drift stops being a drift because one type now maps to the other explicitly.

### Packaging derives from the same descriptors

`scripts/build-bundles.mjs` currently hand-maintains a `FRAMEWORKS` array
duplicating what `FrameworkDescriptor` will hold. It is deleted:
`FRAMEWORK_DESCRIPTORS` becomes the single list, and the bundle script derives
each entry from it.

Mechanism, chosen as the simplest that works: the descriptors live in a
**data-only module** (`packages/affine/all/src/frameworks.ts`) — plain object
literals, type imports only, no lit and no runtime imports — so both the
library and the build script can read it without a bundler. The script's
existing anchor-drift guard (it already throws when the source it patches has
moved) then guards the derivation instead of a hand-copied list.

Coordination with **PR #70**: that PR changed the generated bundle descriptor's
shape — `viewExtension` is removed and replaced by `extensions`, deliberately
un-aliased, because the reversed flag contract splits each framework into an
always-registered renderer and a flag-gated tooling extension. The target
format here is therefore the post-#70 one, which is why
`FrameworkDescriptor.extensions` is a list of `{ flag?, viewExtension }` rather
than the older flat `{ flag, telemetry, viewExtension }`. `telemetry` becomes
`telemetryKey` per the decision above. This ADR's implementation lands after
#70 and adopts its shape; it does not reopen it.

### Reserving the prefix letter

The registry cannot detect a collision it cannot see, so it must be told about
surface (e). The cheapest form that satisfies the single-source mandate without
rewriting `edgeless-keyboard.ts` on day one:

```ts
/** Single-keystroke edgeless bindings owned by imperative code (surface (e)). */
export const RESERVED_EDGELESS_KEYS = [
  'v',
  't',
  'c',
  'h',
  'n',
  'p',
  'Shift-p',
  'e',
  'k',
  'f',
  '-',
  '@',
  'Shift-s',
] as const;
```

declared next to the bindings it mirrors, asserted against them by a unit test,
and checked against every `FrameworkDescriptor.chordPrefix`. That turns "`e` is
the eraser" from tribal knowledge into a failing test. Folding those bindings
into real descriptors is the better end state (sequenced after the switchover,
see Rollout), but the reservation list is what closes the conflict-detection
hole in the meantime.

### Mapping to `ShortcutDescriptor`

One projection, in `@labre/std`, keeps the existing keymap path intact — a
permanent derivation, not a migration shim (see Rollout). It is
**total** — every command yields a descriptor, keyless ones included:

```ts
export function toShortcutDescriptor(c: CommandDescriptor): ShortcutDescriptor {
  return {
    id: c.id, // unchanged → overrides keep working
    labelKey: c.labelKey,
    // Keyless commands emit empty arrays rather than being dropped: they stay
    // registered, so a `ShortcutOverrides` entry on their id actually binds.
    defaultKeys: c.defaultKeys,
    scope: c.scope,
    owner: c.owner,
    // The guard + preventDefault boilerplate that the `wardleyShortcut`
    // factory repeats for every chord today, written once here.
    handler: std => ctx => {
      if (c.when && !c.when(std)) return false;
      ctx.get('defaultState').event.preventDefault();
      void c.run(std, { surface: 'shortcut', source: 'shortcut' });
      return true;
    },
  };
}
```

Returning a descriptor rather than `null` is what keeps consumer 3 functional.
`resolveKeymap` iterates _registered descriptors_ (`shortcut.ts:147-151`), so an
override on an id that was never registered is inert — dropping keyless commands
would leave Settings › Shortcuts unable to bind precisely the commands a user
most wants to bind. Empty keys cost nothing at runtime: `shortcut.ts:152` skips
them, exactly as it already does for `redo-windows` on mac.

Field-by-field: `id`, `labelKey`, `defaultKeys`, `scope`, `owner` are carried
over **unchanged** — ids and override tables persisted by hosts stay valid.
`ShortcutDescriptor.when?: string` (a host-interpreted string, unused by every
descriptor in the repo) is dropped in favour of the typed `when` predicate plus
the serializable `availability` hint.

`getShortcutManifest(flags)` keeps its **signature**, but its element type
changes: `ShortcutManifestEntry` is host-visible and today includes `when:
string` (copied verbatim by `toEntry`, `affine/all/src/shortcuts.ts:34-41`).
Settings › Shortcuts needs no rewrite, but this is a breaking type change for
any host reading `when` — see Consequences.

### Invariants enforced by unit tests

- **≤ 14 commands per `owner` carry `'senior-menu'`.** This is the only
  numeric cap, and it is a UI one: 14 slots in the sub-menu. There is
  deliberately **no cap on how many commands carry a chord** — the second
  keystroke is bounded by the alphabet plus modifiers, not by the menu, and a
  framework with 20 chords is legitimate.
- Within an owner, all chords share the framework's `chordPrefix` and their
  second keystrokes are unique.
- Every `chordPrefix` is unique across owners **and** absent from
  `RESERVED_EDGELESS_KEYS`.
- `id` prefix matches `owner` (`'wardley.'` for `owner: 'wardley'`).
- Every `owner` other than `'core'` is a `FrameworkId`; `'core'`-owned commands
  are exempt from the id-prefix and chord-prefix rules above.
- `RESERVED_EDGELESS_KEYS` matches the keys actually bound in
  `edgeless-keyboard.ts` — the test that keeps the mirror honest.

### Alternatives rejected

- **A brand-new structure, manifest untouched.** Rejected: it would strand the
  conflict detection, the canonicalisation and the v0.29 override compat, and
  leave two registries where the brief asks for one.
- **Promote `ToolbarAction` to the registry.** Rejected: every action is
  written against `ToolbarContext` and a live selection; it cannot be
  enumerated without an editor, which consumers 2, 3 and 5 require.
- **Promote `SlashMenuItem`.** Rejected: raw English `name`, `BlockModel`-bound
  context, no keys, no owner. Its `group` and `searchAlias` ideas are taken
  (`category`, `keywords`); the type is not.

## Consequences

- The registry lives in `@labre/std` (where `ShortcutDescriptor` already is)
  and the aggregator stays in `packages/affine/all/src` next to
  `getShortcutManifest`, so the existing flag gating and the bundle stripping
  (`shortcuts: true` in `scripts/build-bundles.mjs`) apply unchanged. Every
  framework bundle will need that flag, not just wardley.
- The senior menus become _renderers_: `wardley-menu.ts` and its siblings lose
  their hard-coded button lists and render `commands.filter(c =>
c.surfaces.includes('senior-menu'))`. Their Lit shell, styling and popper
  behaviour are unaffected.
- Tooltips become i18n keys. Today's English literals are the de-facto labels;
  moving them to `labelKey` is a user-visible change for a host that ships no
  translation for the new keys — the host must extend its catalogue in the same
  release.
- Telemetry moves from hand-written `track(...)` calls in each menu to a single
  emit at the registry's `run()`, the one non-duplicated function. ADR 0003's
  event names and payload shape are unchanged, the per-surface duplicate
  emitters disappear, and cynefin-estuarine starts emitting at all. **No
  analytics breakage**: `FrameworkDescriptor.telemetryKey` keeps emitting the
  historical `framework` values while `FrameworkId` unifies identity code-side
  only. Existing PostHog dashboards keep working untouched.
- Adding a framework artefact becomes one descriptor instead of an entry in a
  Lit template plus (optionally) a second one in `shortcuts.ts` — and it is
  then automatically present in all five surfaces.
- The 14-slot cap becomes a test failure rather than a design review.
- **`ShortcutManifestEntry` changes shape, but stays about shortcuts** —
  a host-visible breaking change, kept minimal by the icons decision.
  `when: string` disappears (no descriptor in the repo sets it, so the blast
  radius is a type error, not a behaviour change), `defaultKeys` becomes
  always-present, and `owner` narrows from `string` to `CommandOwner`. It does
  **not** gain `category` or `iconKey` — those live on `CommandManifestEntry`.
  Hosts recompile; nothing silently changes at runtime.
- **Settings › Shortcuts gains rows it never had**: every keyless command is
  now listed and bindable, so the panel grows from ~10 entries to roughly the
  full artefact count. That is the intent, but the panel needs `owner`
  grouping (which it has) to stay usable at that size.
- **`scripts/build-bundles.mjs` loses its hand-maintained `FRAMEWORKS` array**
  and derives from `FRAMEWORK_DESCRIPTORS`. Adding a framework becomes one
  descriptor instead of an entry in the script plus a flag plus a senior-tool
  id plus a telemetry union member.
- **Flag gating now has two sides, and both must be honoured.**
  [ADR 0009](0009-reversed-flag-contract.md) splits each framework into an
  always-registered render extension and a flag-gated tooling extension, and
  keeps `ShortcutExtension(...)` inside the tooling one — so registration
  remains the gate for _bindings_, unchanged. But the _manifest_ is enumerated
  off-editor by `buildShortcutManifest`, which filters at read time on
  `isBlockEnabled`. Commands must therefore be filtered on both paths, and a
  test must assert the two agree: a framework toggled off must vanish from the
  manifest **and** bind nothing.
- Nothing here touches `packages/framework/store` or `sync`, and no block
  schema changes: the registry is view-layer only, with no document-format
  impact.

## Rollout — one switchover, one sequenced follow-on

> Owner arbitration, 2026-08-01: a big bang is acceptable and preferred when it
> saves time and debt. The plan below was re-derived under that criterion.
> Amended the same day: resolving open question 3 in favour of `telemetryKey`
> removed the last change that had to land before the switchover.

### Re-evaluating the incremental plan

The earlier six-step plan was sequenced by prudence, not by necessity. Judged
against the new criterion, most of the sequencing existed only to avoid a large
PR — and it bought that smallness by **deliberately reintroducing the exact
duplication this ADR exists to remove**:

| Former step                                       | Why it was separate       | Verdict                                                                                                                                                                                               |
| ------------------------------------------------- | ------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1. Types only, "nothing consumes it yet"          | staging                   | **Dropped.** Ships dead code in a release. Types land with their first consumer.                                                                                                                      |
| 2 / 3 split (wardley commands, then wardley menu) | staging                   | **Merged.** Between them, wardley declares its artefacts twice — as descriptors _and_ as the hard-coded Lit list. A duplication window we would be creating on purpose.                               |
| 4. One PR per framework (×7)                      | staging                   | **Merged.** The transformation is mechanical and identical seven times; sequencing it costs 7 review cycles and keeps the registry half-populated, which blocks consumers 2/4/5 from shipping at all. |
| 0. Reserved keys                                  | prerequisite              | **Merged** into the switchover — it is one `const` plus a mirror test, and the switchover is what needs it.                                                                                           |
| 0. Telemetry `framework` rename                   | crosses a system boundary | **Dissolved.** `telemetryKey` keeps the historical values, so there is no analytics cutover to sequence and no rename to land first.                                                                  |
| 5. Fold surface (e) in                            | distinct refactor         | **Kept, sequenced after** — see below.                                                                                                                                                                |
| 6. New consumers                                  | product dependency order  | **Kept** — the sidepanel, palette and agent bridge are unbuilt features, not migration steps.                                                                                                         |

Rough sizing. The switchover is ~55 command descriptors across 7 gfx packages
(wardley 13, edgy 7, bpmn 6, cynefin-estuarine ~6, the three DDD menus ~22),
plus `@labre/std`, `affine/all` and root. What the big bang **saves**: ~10
coordination PRs; a compatibility branch in `buildShortcutManifest` to merge
legacy `ShortcutDescriptor[]` groups with registry-derived ones, written and
then deleted; and one release in which wardley carries two declarations of the
same 13 artefacts. What it **costs**: a single PR whose regression surface is
the edgeless keymap, needing one focused recette pass instead of seven small
ones.

### The non-negotiables, and why atomicity serves them better

Two invariants are not negotiable at any speed. Neither argues for
incrementalism — both argue _against_ it:

- **Persisted v0.29 override tables stay valid.** Ids are preserved by
  construction (`toShortcutDescriptor` copies `id` verbatim). The risk is not
  renaming an id, it is having _two code paths_ producing descriptors while a
  user's override table spans both. The incremental plan creates exactly that
  window, for as many releases as the rollout takes; an atomic switchover never
  has one. Guarded by a golden test: for every id in today's manifest, the
  effective keymap per scope must be byte-identical before and after.
- **No hole in conflict detection.** `resolveKeymap` can only report on the
  descriptors it sees. Converting frameworks one at a time means partial
  coverage for the whole rollout; converting them together means the complete
  set is visible from the first release. `RESERVED_EDGELESS_KEYS` closes the
  remaining hole (surface (e)) in the same PR.

### What switches atomically

One release, one PR: `CommandDescriptor` / `CommandManifestEntry` /
`Availability` / `CommandInvocation` / `FrameworkId` / `FrameworkDescriptor` /
`toShortcutDescriptor` in `@labre/std`; `FRAMEWORK_DESCRIPTORS` as the
data-only module, with `scripts/build-bundles.mjs` deriving from it and its
`FRAMEWORKS` array deleted; the `CommandRegistry` aggregator replacing
`FRAMEWORK_SHORTCUT_GROUPS`; the icon registry behind `iconKey`;
`RESERVED_EDGELESS_KEYS` and its mirror test; all 7 frameworks' artefacts as
descriptors, with their senior menus rewritten as renderers over the registry
and their hard-coded button lists and `_track` helpers deleted;
`WardleyActionSource` collapsed into `CommandInvocation`; `chordPrefix`
allocated against the reservation list.

Ordering against PR #70: this lands **after** it, adopting its `extensions`
bundle-descriptor shape rather than reopening it.

### What stays sequenced, and by which invariant

1. **Folding surface (e) in lands after.** The invariant it would close is
   already closed by `RESERVED_EDGELESS_KEYS`, so this is an improvement, not a
   prerequisite. It is also a genuinely different refactor: several of those
   bindings are stateful cycles rather than commands (`c` cycles connector
   mode, `Shift-s` cycles shape type, `k` and `-` are conditional on selection),
   so expressing them as descriptors changes their semantics and deserves its
   own review. When it lands, `RESERVED_EDGELESS_KEYS` is deleted and conflict
   detection covers the whole edgeless keyboard.
2. **New consumers ship as they are built.** Sidepanel catalogue, palette and
   agent bridge read the registry directly. This is feature sequencing, not
   migration.

### `toShortcutDescriptor` is architecture, not a migration shim

Worth stating explicitly, because a big bang is the moment to delete
transitional adapters and this one must survive. It is not a compatibility
layer with an expiry date: it is one of the **three permanent projections** out
of the single source — `→ ShortcutDescriptor` for the in-editor keymap (and
from it `ShortcutManifestEntry` for Settings › Shortcuts), and
`→ CommandManifestEntry` for the catalogue seam. It runs on every editor
assembly, forever. Keeping the derivation (rather than letting frameworks
author `ShortcutDescriptor`s directly) is what keeps the resolution engine, the
override format and the conflict reporter untouched while there is still
exactly one declaration.

### Out of scope

- **The element toolbar** (surface (c)) stays as it is. It is contextual on a
  live selection, not a catalogue of what a framework offers, so it is not a
  sixth consumer. Where an element action and a command coincide, the toolbar
  action delegates to `run` rather than the registry growing a selection-bound
  surface.
- **The slash menu** (surface (d)) stays as it is for now. It is the _page_
  editor's block-insertion menu, not a framework artefact catalogue, and
  merging it would drag `BlockModel` context into the registry. Revisit once
  the palette (consumer 4) ships — the two overlap, and the palette is the
  better place to converge.
- **Recency / frequency ranking**: needs a host-side usage store; the registry
  only needs to accept an injected comparator. **Superseded** by the amendment
  of 2026-08-26 below.
- **Per-user pinning** of the 14 senior slots.

## Resolved questions

The four open questions this ADR carried were arbitrated by the owner on
2026-08-01 and are now decisions in the body above. Recorded here with their
resolution so the reasoning is not lost:

1. **How declarative can `availability` be?** → **Closed union of four.**
   Settled by audit rather than assumption: all 119 availability predicates in
   the repo were inventoried, and the 52 irreducible ones turned out to belong
   without exception to surfaces (c) and (d), which are out of scope. The
   in-scope population needs `'always' | 'selection' | 'selection:framework'`
   plus `'editable'`. See _Availability is a closed union_.
2. **Who owns `iconKey` → asset resolution?** → **The library.** Icons stay in
   the package; the manifest carries only `iconKey`; a separate lib-side
   registry resolves keys to templates; the host may substitute but inherits a
   working default. Corollary: the shortcut manifest represents shortcuts and
   nothing else — icons never transit through it. See _Icons_.
3. **Telemetry rename here or separately?** → **Neither: `telemetryKey`.**
   Emission moves to the single `run()` bottleneck, surface discrimination
   rides on `CommandInvocation.surface`, and historical PostHog values keep
   being emitted, so identity unification stays code-side with zero analytics
   breakage. This dissolved the one step that had to precede the switchover.
   See _Telemetry emits at the bottleneck_.
4. **`FrameworkDescriptor` vs the bundle descriptor?** → **`FrameworkDescriptor`
   is the source.** The hand-maintained `FRAMEWORKS` array in
   `scripts/build-bundles.mjs` is deleted and derived from a data-only
   descriptor module, in the `extensions` shape PR #70 introduced. See
   _Packaging_.

5. **Does "emission at the bottleneck and nowhere else" survive a
   PARAMETERISED command?** → **No, and the exception is narrow and enumerated.**
   Added 2026-08-01 by the MF1 implementation (PR #89), which shipped the first
   command carrying a `params` schema.

   `runCommand`'s reporter receives `{ std, command, invocation }` and derives
   the event from `CommandKind` plus a **static** `telemetry: { framework,
element }` on the descriptor. `pivot.bind` reports
   `FrameworkElementPromoted`, whose `direction` depends on the params
   (`pivotDocId: null` demotes), whose `role` / `framework` depend on the
   elements selected, and whose `elementCount` depends on how many of them
   actually changed. None of that is expressible as a constant on a descriptor,
   and the event is not one of the three the bottleneck maps to.

   The rule therefore reads: **a command whose event is a function of its
   parameters or of what its run actually changed emits from its own body; every
   other command emits at the bottleneck, which stays the default and the rule.**
   A self-emitting command MUST NOT also declare `telemetry` — that is the
   silent failure this exception opens (the same gesture reported twice,
   forever), and it is guarded by a registry unit test enumerating the
   self-emitting ids plus a live-reporter test asserting one event per
   invocation.

   _Rejected alternative:_ widening `CommandTelemetryReporter` to receive
   `params` (or making `CommandDescriptor.telemetry` a function of them). It
   would have preserved the single-emitter letter for a comparable cost, but it
   moves per-command event construction into a shared reporter that must then
   switch on command id — recreating in one file the per-surface divergence this
   ADR removed, and coupling `@labre/affine`'s reporter to every framework's
   event vocabulary. Revisit if a second self-emitting command appears: two is a
   pattern, and at that point the reporter should take a builder rather than the
   list growing.

6. **Does `Availability` compose?** → **No, and that is now a known gap.**
   Recorded 2026-08-01 (PR #89). `isCommandAvailable` switches on ONE value, so
   a command that is both selection-gated and edit-gated cannot say so: it
   declares the precondition a host panel most needs to see and enforces the
   other through `when`, which does not cross the seam. `pivot.bind` declares
   `'selection'` and gates read-only in `when` and in `run` — the latter because
   `runCommand` consults neither, so the palette and the agent reach `run`
   directly.

   This is an **amendment trigger**, not a decision: the union is small enough
   that `Availability[]` (read as a conjunction) or a `'selection+editable'`
   member would both work. It is not done here because the gap is older and
   wider than this command — `duplicate` and `applyLastStyle` carry
   `'selection'` and would throw in a read-only document today — and fixing it
   properly means auditing every command, which belongs in its own change.

Nothing is left open. What remains deliberately outside the decision is listed
under _Out of scope_ above; the extension points are the `Availability` union —
closed today, with one named waiting-list candidate (`revision`, a document mode
that does not exist yet) and the composition gap of resolved question 6 — and
the self-emission exception of resolved question 5.

## Amended 2026-08-26 — usage ranking resolved, and a shortcut budget

Recorded by the BPMN-prerequisites tranches. Two points.

**1. Recency / frequency ranking is no longer out of scope.** The bullet under
_Out of scope_ ("needs a host-side usage store; the registry only needs to
accept an injected comparator") is superseded: the store exists, and the
ranking is not a comparator but a selection.

- **Measurement** — `CommandUsageIdentifier`, a store seam fed by `runCommand`,
  so usage is counted at the same bottleneck telemetry emits from and no
  surface counts on its own. The library ships a localStorage default; a host
  overrides it to persist per user in its own database.
- **Selection** — `selectSeniorMenuCommands`, a pure helper, not a sort passed
  to the menu. Per PF6: overflow applies **iff** the owner's catalogue exceeds
  14; then the sub-menu shows **7 ranked slots — the 4 most-used plus the 3
  most-recent, deduplicated** — beside a permanent _More artefacts_ button
  opening the catalogue sidepanel (consumer 2). With no usage recorded yet, the
  authored `order` is the cold start, so a fresh install is deterministic.

  > **Re-arbitrated 2026-08-28** — see the amendment below: **13 ranked slots =
  > 7 most-recent + 6 most-used**, and the pool ranked is the `'senior-menu'`
  > surface, not the catalogue.

The 14-slot cap of _Invariants enforced by unit tests_ is unchanged; the ranked
7 are what a framework shows once it is past that cap.

**2. PF10 — at most 14 default-bound shortcuts per framework.** A convention,
aligned with the 14 senior slots so that one framework prefix plus one artefact
letter remains enough to address every default binding. The resolution engine
is untouched: this is enforced by a unit test in
`packages/affine/all/src/__tests__/commands/registry.unit.spec.ts`, alongside
the slot cap. It narrows — without contradicting — the note above that there is
"deliberately no cap on how many commands carry a chord": the alphabet still
does not constrain it, curation does. Past 14, a framework binds through a host
override rather than by default.

Chord-**prefix** allocation stays deferred per framework: a `chordPrefix`
declared before that framework ships its first chord is dead data that reserves
a scarce letter for nothing. It is allocated against `RESERVED_EDGELESS_KEYS`
at the moment the first chord lands, which the existing prefix tests already
enforce.

## Amended 2026-08-28 — the sub-menu seats thirteen, and only its declarers

Two PO rulings on the senior sub-menu, recorded against the arbitrage of
2026-08-26 above.

**1. Ranked membership requires the `senior-menu` surface.** The 2026-08-26
selection ranked the CATALOGUE, on the reasoning that "a command its author left
out of the fourteen but the user invokes constantly has earned a slot". The PO
met the consequence in recette: `bpmn.exportXml` — a command whose subject is
the whole BOARD, which deliberately declines `'senior-menu'` and lives in the
pool's "⋮" and in the catalogue — was pulled into the sub-menu by its own usage,
where "Export BPMN" in a row of things you DRAW answers no question a user
asked. A declined surface is a statement about where a command belongs, not a
default that usage may out-vote. `selectSeniorMenuCommands` therefore ranks the
`'senior-menu'` surface only.

What does NOT change: the overflow **trigger** still reads the catalogue (an
owner overflows when its whole toolbox outgrows the 14, whatever it nominated),
membership is still laid out in **author order**, and the cold start is still
the authored head of the ranked pool. Enforced by
`packages/framework/std/src/__tests__/senior-menu-selection.unit.spec.ts` (a
catalogue-only command with 9999 invocations never enters the row) and end to
end by `catalogue-overflow.spec.ts` and `bpmn.spec.ts`.

`rankCommandsByUsage` — the catalogue sidepanel's _Recent & frequent_ head
section — **keeps ranking the catalogue**, deliberately. The ruling is about the
sub-menu; the sidepanel is the full-catalogue surface, the one place every
command of a framework is reachable, so a board action a user really does reach
for belongs at its head. One arbitration, two pools, and the difference is
documented on both functions.

**2. Thirteen ranked slots: 7 most-recent + 6 most-used** (was 7 = 4 most-used +
3 most-recent). Two changes in one: the count, and the priority. Seven buttons
out of a fourteen-wide row left it visibly half-empty for no reason a user could
read; thirteen plus the permanent _More artefacts_ button is exactly the cap, so
an overflowed row is as wide as one that never overflowed. And recency now leads
because what a user reached for this morning is what they are still working on,
while a row led by all-time workhorses takes weeks to notice a new habit.

The dedup rule follows the inversion: a command that tops **both** axes consumes
a **recent** slot, and the most-used slot it did not take goes to the next
candidate down the frequency ranking — so a user with three double picks still
gets six workhorses, not three. Cold start is unchanged in kind and scaled in
size: with nothing measured, both axes collapse to authored order and the row is
the **first thirteen of the nominated list**, in pure author order.

`SENIOR_MENU_CAP` (14) and the PF10 shortcut budget (14) are untouched.

**3. The sidepanel head section stays at seven — the two surfaces share the
arbitration, not the magnitude.** Architect's ruling, on adversarial review of
the two above, and recorded here because otherwise this surface's row count
would have moved as an unowned side effect of a different surface's constant.

`pickByUsage` capped at `SENIOR_MENU_RANKED_SLOTS`, so raising the sub-menu's
number would have raised the _Recent & frequent_ head from ≤7 to ≤13 rows. But
13 is argued entirely from the sub-menu's geometry — a horizontal row of ~24px
icon buttons, 13 of them plus _More artefacts…_ making up the 14 cap. The head
section is a vertical list of `TOUCH_TARGET_MIN_PX` (44px) rows in a panel
`min(320px, 85vw)` wide: 13 × 44 + a section label ≈ 604px, which on a 13"
laptop is the whole first screen, every row of it a duplicate of a row filed
below (by design — the head is a shortcut, not a re-filing), pushing the
categories wholly under the fold. That is worst for exactly the power user the
section exists to serve.

So the slot counts became **parameters** of `pickByUsage(pool, statsOf,
recentSlots, usedSlots)`: the sub-menu passes (7, 6), the head section (4, 3)
through `CATALOGUE_HEAD_RANKED_SLOTS`. This keeps "one arbitration, two
consumers, never two opinions" intact — the split is a parameter, not a fork —
and keeps the size the PO recette of 27/08/2026 signed off on. Recency-first
applies to both; for a section labelled "**Recent** & frequent" that is a
straightforward improvement. Note that the naive `.slice(0, 7)` of the
sub-menu's pick would NOT have worked: it returns seven recency picks and zero
frequency ones, silently deleting the "& frequent" half.

Both magnitudes are now sensed by tests rather than described: `the head section
seats seven, four of them by recency` (unit, eleven measured commands for seven
seats) and `the head section stops at seven rows however much was used`
(integration, on the rendered panel — the previous head-section spec exercised a
single used command and was insensitive to any cap).
