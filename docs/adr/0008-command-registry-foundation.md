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
manifest's defining property today. So the registry is one declaration
projected into two shapes:

- `CommandDescriptor` — the in-library authoring shape. Holds `run`, the
  availability predicate and the icon template. Never crosses the host seam.
- `CommandManifestEntry` — the **serializable** projection that does, replacing
  today's `ShortcutManifestEntry`. No functions, no `TemplateResult`: an
  `iconKey` the host maps to its own asset, and availability reduced to a
  declarative `AvailabilityHint` (or omitted, which means "always offerable").
  This honours [ADR 0006](0006-pivot-properties-provider.md)'s rule that the
  host seam stays typed and render-free.

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
  /** Stable asset key, NOT markup — the host resolves it to its own icon. */
  iconKey?: string;
  /** In-library rendering only; never projected into the manifest. */
  icon?: () => TemplateResult;
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

  /** In-library availability. Projected to a declarative hint for the host. */
  when?: (std: BlockStdScope) => boolean;
  availability?: AvailabilityHint; // e.g. { requires: 'selection' }

  /** THE new capability: invocable without a keyboard event. */
  run: (
    std: BlockStdScope,
    invocation: CommandInvocation,
    params?: P
  ) => void | Promise<void>;
  /** Agent-facing parameter contract (zod is already a std dependency). */
  params?: z.ZodType<P>;

  /** Central emit; the invocation supplies segment/module/control. */
  telemetry?: { framework: FrameworkId; element: string };
}

/** The per-framework identity consumers 2-5 need, and nothing owns today. */
export interface FrameworkDescriptor {
  id: FrameworkId;
  labelKey: string; // replaces the raw English `SeniorTool.name`
  iconKey: string;
  order?: number;
  /** First keystroke of this framework's chords — allocated, not chosen ad hoc. */
  chordPrefix?: string;
}
```

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
- Telemetry moves from hand-written `track(...)` calls in each menu to the
  descriptor's `telemetry` field, emitted centrally on `run`. ADR 0003's _event
  names_ and payload shape are unchanged, and cynefin-estuarine starts emitting
  at all. But unifying framework identity on `FrameworkId` **renames the
  `framework` property values** (`'cynefin'` → `'cynefin-estuarine'`,
  `'event-storming'` → `'ddd-event-storming'`, and likewise for core-domain and
  context-map). That is a breaking change for already-collected PostHog data:
  either the host maps the old values at ingest, or dashboards must union both
  spellings across the cutover. This rename is the one change that lands
  **before** the switchover, on its own — see Rollout.
- Adding a framework artefact becomes one descriptor instead of an entry in a
  Lit template plus (optionally) a second one in `shortcuts.ts` — and it is
  then automatically present in all five surfaces.
- The 14-slot cap becomes a test failure rather than a design review.
- **`ShortcutManifestEntry` changes shape** — a host-visible breaking change.
  `when: string` disappears (no descriptor in the repo sets it, so the blast
  radius is a type error, not a behaviour change), `defaultKeys` becomes
  always-present, and the entry gains `owner: CommandOwner`, `kind`, `category`
  and `iconKey`. Hosts recompile; nothing silently changes at runtime.
- **Settings › Shortcuts gains rows it never had**: every keyless command is
  now listed and bindable, so the panel grows from ~10 entries to roughly the
  full artefact count. That is the intent, but the panel needs the `owner` /
  `category` grouping to stay usable at that size.
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

## Rollout — one switchover, two sequenced follow-ons

> Owner arbitration, 2026-08-01: a big bang is acceptable and preferred when it
> saves time and debt. The plan below was re-derived under that criterion.

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
| 0. Telemetry `framework` rename                   | crosses a system boundary | **Kept, sequenced first** — see below.                                                                                                                                                                |
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
`CommandInvocation` / `FrameworkId` / `FrameworkDescriptor` /
`toShortcutDescriptor` in `@labre/std`; the `CommandRegistry` aggregator
replacing `FRAMEWORK_SHORTCUT_GROUPS`; `RESERVED_EDGELESS_KEYS` and its mirror
test; all 7 frameworks' artefacts as descriptors, with their senior menus
rewritten as renderers over the registry and their hard-coded button lists and
`_track` helpers deleted; `WardleyActionSource` collapsed into
`CommandInvocation`; `chordPrefix` allocated against the reservation list.

### What stays sequenced, and by which invariant

1. **The telemetry `framework` rename lands first, on its own.** Not prudence:
   the invariant is analytics continuity, and it is owned by a system outside
   this repo. PostHog dashboards must be cut over in lockstep, which no test in
   this repository can assert. Landing it separately gives that cutover its own
   revert boundary. (If open question 3 resolves toward a `telemetryKey` field
   instead, this step disappears entirely and folds into the switchover.)
2. **Folding surface (e) in lands after.** The invariant it would close is
   already closed by `RESERVED_EDGELESS_KEYS`, so this is an improvement, not a
   prerequisite. It is also a genuinely different refactor: several of those
   bindings are stateful cycles rather than commands (`c` cycles connector
   mode, `Shift-s` cycles shape type, `k` and `-` are conditional on selection),
   so expressing them as descriptors changes their semantics and deserves its
   own review. When it lands, `RESERVED_EDGELESS_KEYS` is deleted and conflict
   detection covers the whole edgeless keyboard.
3. **New consumers ship as they are built.** Sidepanel catalogue, palette and
   agent bridge read the registry directly. This is feature sequencing, not
   migration.

### `toShortcutDescriptor` is architecture, not a migration shim

Worth stating explicitly, because a big bang is the moment to delete
transitional adapters and this one must survive. It is not a compatibility
layer with an expiry date: it is one of the **two permanent projections** out
of the single source — `CommandDescriptor` → `ShortcutDescriptor` for the
in-editor keymap, and `CommandDescriptor` → `CommandManifestEntry` for the host
seam. It runs on every editor assembly, forever. Keeping the derivation (rather
than letting frameworks author `ShortcutDescriptor`s directly) is what keeps
the resolution engine, the override format and the conflict reporter untouched
while there is still exactly one declaration.

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
  only needs to accept an injected comparator.
- **Per-user pinning** of the 14 senior slots.

## Open questions

To settle before this ADR goes `accepted`:

1. **How declarative can `availability` be?** The two-tier split hinges on
   reducing `when: (std) => boolean` to a hint a host panel can evaluate with
   no editor. A small closed union (`'selection'`, `'selection:framework'`,
   `'always'`) probably covers the real cases, but it has not been checked
   against every existing `when` in `ToolbarAction` configs. If it cannot be
   closed, consumers 2 and 3 fall back to showing the command as always
   available and letting `run` no-op — acceptable, but it should be a decision,
   not a discovery.
2. **Who owns `iconKey` → asset resolution?** The library has the SVGs today.
   Shipping the manifest render-free means the host needs either its own icon
   set or a separate, explicitly non-manifest accessor for the library's. ADR
   0006 forbids markup across the seam; it does not say where the pixels come
   from.
3. **Does the telemetry `framework` rename happen here or in its own change?**
   The Rollout assumes its own change, landing first. If PostHog history
   matters more than tidiness, the
   alternative is keeping the current values as a `telemetryKey` field on
   `FrameworkDescriptor` — one more spelling, but zero analytics breakage.
4. **`FrameworkDescriptor` vs the bundle descriptor.** `scripts/build-bundles.mjs`
   already generates a per-framework `{ flag, telemetry, viewExtension }`
   object. Whether `FrameworkDescriptor` subsumes it, or the generator emits
   it, decides whether the bundle script keeps a hand-maintained `FRAMEWORKS`
   list at all.
