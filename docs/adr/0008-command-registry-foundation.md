# ADR 0008 — Command registry built on the shortcut manifest

- Status: proposed (August 2026)
- Deciders: Mathieu Jolly

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

The library already has **four unrelated declaration surfaces**, and a
framework's artefacts are spelled out in two or three of them.

**(a) The shortcut manifest** — `ShortcutDescriptor` in
`packages/framework/std/src/extension/shortcut.ts`, aggregated by
`getShortcutManifest(flags)` in `packages/affine/all/src/shortcuts.ts`. It is
the only structure that is already a _manifest_: enumerable without an editor
instance, metadata-only (`ShortcutManifestEntry = Omit<ShortcutDescriptor,
'handler'>`), and flag-gated per framework through `FRAMEWORK_SHORTCUT_GROUPS`.

Against the acceptance checklist, it already exposes:

| Requirement            | Status                                                                                                                               |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| stable id              | yes — `id` (`'undo'`, `'wardley.addComponent'`)                                                                                      |
| i18n label             | yes — `labelKey`, resolved host-side                                                                                                 |
| scope                  | yes — `ShortcutScope = 'global' \| 'page' \| 'edgeless'`                                                                             |
| owning framework       | yes — `owner: 'core' \| <block flag>`                                                                                                |
| host overrides         | yes — `ShortcutOverrides`, injected via `KeymapOverrideExtension` (`packages/affine/shared/src/services/keymap-override-service.ts`) |
| conflict detection     | yes — `canonicalCombo` + `resolveKeymap`, reported through `ShortcutConflictReporterIdentifier`; duplicates are never silently bound |
| chords (letter+letter) | yes — `defaultKeys` is a keystroke _sequence_, with v0.29 legacy-format compat (`normalizeLegacyCombo`)                              |
| flag gating            | yes — `buildShortcutManifest` filters on `isBlockEnabled`                                                                            |

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

### The duplication, concretely

Wardley is the only framework with keyboard shortcuts
(`gfx/wardley/src/shortcuts.ts`, 7 chords `w`+letter). Both the shortcuts and
the menu call the _same_ action functions in `gfx/wardley/src/actions.ts`
(`createWardleyNode`, `activateWardleyConnector`, …) — the behaviour layer is
already shared. What is duplicated is the **declaration**: the menu lists 13
artefacts with English tooltips, the manifest lists 7 with `labelKey`s, and the
two lists have already drifted — `createWardleyMarket` and the `opportunity` /
`benefit` / `evolution-gradient` background variants exist only in the menu;
nothing detects the omission. EDGY and BPMN have menus and zero manifest
entries, so today they are invisible to Settings › Shortcuts.

Framework **identity** is duplicated four times with no shared type, and has
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
- **Non-bound commands.** A descriptor without keys is meaningless today
  (`resolveKeymap` skips empty `defaultKeys`), yet most artefacts will never
  get a chord: only 14 letters are available per framework, while wardley
  alone already offers 13 menu items and will grow. The registry must hold
  commands whose `defaultKeys` is absent.
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
- **Framework identity.** `owner` is `string` — see the drift documented above.
- **Telemetry.** Not in the descriptor; each menu re-implements its own `track`
  helper (`gfx/wardley/src/actions.ts` for wardley, `_track` methods in
  `bpmn-menu.ts` and `edgy-menu.ts`, `DddMenuBase.track` for the DDD trio) —
  and `gfx/cynefin-estuarine/src/toolbar/menu.ts` emits nothing at all.

## Decision

**Extend the manifest, but invert the direction of dependency.** Introduce a
`CommandDescriptor` in `@labre/std` as the single source of truth; a keyboard
binding becomes one optional _facet_ of a command, and `ShortcutDescriptor`
becomes a projection of it rather than its own declaration.

We keep the shortcut _resolution engine_ untouched (`canonicalCombo`,
`normalizeLegacyCombo`, `resolveKeymap`, `ShortcutKeymapExtension`, the
override table, the conflict reporter). It is the only piece of this area that
is fully specified and tested, it carries a released persistence format
(v0.29 override tables), and nothing about the five consumers argues against
it. We replace the _declaration_ surface above it, not the engine below it.

### Target schema

```ts
/** Single framework identity, replacing the 4 drifting string keys. */
export type CommandOwner = 'core' | FrameworkId; // FrameworkId ⊂ OptionalBlock

/** Which surfaces a command opts into. Absent from the array = absent from the surface. */
export type CommandSurface =
  | 'senior-menu' // (1) senior button sub-menu — max 14 per owner
  | 'catalogue' // (2) "more artefacts" sidepanel
  | 'shortcuts' // (3) Settings › Shortcuts (implied by `defaultKeys`)
  | 'palette' // (4) search / command palette
  | 'agent'; // (5) invocable by Labre's AI

export type CommandKind =
  | 'artefact' // creates an element (createWardleyNode…)
  | 'tool' // arms a tool (activateWardleyConnector…)
  | 'toggle' // flips a property (wardley background toggles)
  | 'action'; // everything else (undo, duplicate, applyLastStyle)

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
  /** Lazy so the manifest stays enumerable without mounting an editor. */
  icon?: () => TemplateResult;
  /** Extra search terms for the palette (cf. `SlashMenuItem.searchAlias`). */
  keywords?: string[];

  surfaces: CommandSurface[];
  /** Ascending rank inside `senior-menu` / `catalogue` (cf. `SeniorTool.order`). */
  order?: number;

  scope: ShortcutScope;
  /** Chord sequence, unchanged semantics. Omit for a command with no binding. */
  defaultKeys?: { mac: string[]; other: string[] };

  /** Availability. Replaces `ShortcutDescriptor.when?: string` with a predicate. */
  when?: (std: BlockStdScope) => boolean;

  /** THE new capability: invocable without a keyboard event. */
  run: (std: BlockStdScope, params?: P) => void | Promise<void>;
  /** Agent-facing parameter contract (zod is already a std dependency). */
  params?: z.ZodType<P>;

  /** Feeds FrameworkElementAdded / FrameworkToolPicked automatically. */
  telemetry?: { framework: FrameworkId; element: string };
}
```

### Mapping to `ShortcutDescriptor`

One adapter, in `@labre/std`, keeps the existing keymap path intact:

```ts
export function toShortcutDescriptor(
  c: CommandDescriptor
): ShortcutDescriptor | null {
  if (!c.defaultKeys) return null; // not a shortcut, still a command
  return {
    id: c.id, // unchanged → overrides keep working
    labelKey: c.labelKey,
    defaultKeys: c.defaultKeys,
    scope: c.scope,
    owner: c.owner,
    // The guard + preventDefault boilerplate that the `wardleyShortcut`
    // factory repeats for every chord today, written once here.
    handler: std => ctx => {
      if (c.when && !c.when(std)) return false;
      ctx.get('defaultState').event.preventDefault();
      void c.run(std);
      return true;
    },
  };
}
```

Field-by-field: `id`, `labelKey`, `defaultKeys`, `scope`, `owner` are carried
over **unchanged** — ids and override tables persisted by hosts stay valid.
`ShortcutDescriptor.when?: string` (a host-interpreted string, currently unused
by any descriptor in the repo) is dropped in favour of the typed `when`
predicate. `handler` is derived, never authored.

`getShortcutManifest(flags)` keeps its signature and becomes a thin projection
of the command registry, so Settings › Shortcuts needs no change.

### Invariants enforced by unit tests

- ≤ 14 commands per `owner` carry `'senior-menu'`; ≤ 14 per `owner` carry
  `defaultKeys` (the letter+letter chord budget).
- Chord second letters are unique within an owner; the first letter is the
  framework's and is unique across owners.
- `id` prefix matches `owner` (`'wardley.'` for `owner: 'wardley'`).
- Every `owner` other than `'core'` is a `FrameworkId`, itself derived from
  `OPTIONAL_BLOCKS`; `'core'`-owned commands are exempt from the prefix and
  chord-budget rules above.

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
  spellings across the cutover. Sequencing this rename is a prerequisite of
  step 1, not a side effect of it.
- Adding a framework artefact becomes one descriptor instead of an entry in a
  Lit template plus (optionally) a second one in `shortcuts.ts` — and it is
  then automatically present in all five surfaces.
- The 14-slot cap becomes a test failure rather than a design review.
- Nothing here touches `packages/framework/store` or `sync`, and no block
  schema changes: the registry is view-layer only, with no document-format
  impact.

## Migration plan (incremental, no big-bang)

1. **Types only.** Add `CommandDescriptor`, `CommandSurface`, `CommandKind`,
   `FrameworkId` and `toShortcutDescriptor` to `@labre/std`; add a
   `CommandRegistry` aggregator beside `getShortcutManifest`, flag-gated the
   same way. Nothing consumes it yet. Unit tests for the invariants.
2. **Wardley as the reference.** Rewrite `gfx/wardley/src/shortcuts.ts` as
   `commands.ts`: the 7 existing chords keep their ids and keys, and the 6
   menu-only artefacts (the `opportunity`, `benefit` and `evolution-gradient`
   backgrounds, market, ecosystem, anchor) join them
   with `surfaces: ['senior-menu', 'catalogue', 'palette', 'agent']` and no
   `defaultKeys`. `ShortcutExtension(wardleyShortcuts)` in `view.ts` becomes
   `ShortcutExtension(wardleyCommands.map(toShortcutDescriptor).filter(...))`.
   Manifest output for existing ids must be byte-identical — assert it.
3. **Wardley menu becomes a consumer.** `wardley-menu.ts` renders from the
   registry. Delete the hard-coded button list; i18n keys land in the host
   catalogue. Integration spec: the 13 buttons still render, in order.
4. **Roll out per framework** — edgy, bpmn, cynefin-estuarine, the three DDD
   modules — one PR each, same shape. Each gains Settings › Shortcuts presence
   for free (they have none today) but ships with `defaultKeys` only where a
   chord letter is available.
5. **New consumers.** Sidepanel catalogue, palette and the agent bridge read
   the registry directly; `getShortcutManifest` becomes a projection helper
   kept for host compatibility.

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
