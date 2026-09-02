import { createIdentifier } from '@labre/global/di';
import type { ExtensionType } from '@labre/store';
import type { TemplateResult } from 'lit';
import type { z } from 'zod';

import { SurfaceSelection } from '../selection/index.js';
import type { BlockStdScope } from '../scope/index.js';
import {
  ShortcutExtension,
  type ShortcutDescriptor,
  type ShortcutScope,
} from './shortcut.js';

/**
 * Where an element/tool creation was triggered from. Historically declared in
 * `@labre/affine-shared`'s telemetry types; it moved down here (and is
 * re-exported from there, unchanged) because {@link CommandInvocation} — the
 * single source of the "which surface invoked this" dimension — lives in
 * `@labre/std`. See `docs/adr/0008`.
 */
export type ElementCreationSource =
  | 'shortcut'
  | 'toolbar:general'
  | 'toolbar:dnd'
  | 'canvas:drop'
  | 'canvas:draw'
  | 'canvas:dbclick'
  | 'canvas:paste'
  | 'context-menu'
  | 'ai'
  | 'internal'
  | 'conversation'
  | 'manually save';

/**
 * The eight framework modules that own commands. An EXPLICIT list, not a
 * subset assertion over `OPTIONAL_BLOCKS`: that list mixes frameworks with
 * plain blocks. `packages/affine/all/src/frameworks.ts` asserts that every id
 * here is a real flag key (`satisfies readonly OptionalBlock[]`).
 *
 * `ddd-aggregate` is deliberately absent: it ships DDD *templates* only — no
 * senior button, no commands — so it is a packaging bundle, not a framework.
 */
export const FRAMEWORK_IDS = [
  'wardley',
  'edgy',
  'cynefin-estuarine',
  'bpmn',
  'c4',
  'ddd-event-storming',
  'ddd-core-domain',
  'ddd-context-map',
] as const;
export type FrameworkId = (typeof FRAMEWORK_IDS)[number];
export type CommandOwner = 'core' | FrameworkId;

/**
 * Serializable precondition. Closed union; extended only by an amendment to
 * `docs/adr/0008`. `'always'` is the default when omitted.
 */
export type Availability =
  | 'always'
  | 'selection' // any non-empty canvas selection, not text-editing
  | 'selection:framework' // selection contains the owner's element types
  | 'editable'; // document is not read-only

/**
 * Which surfaces a command opts into. Absent from the array = absent from the
 * surface. Settings › Shortcuts is NOT a member: EVERY command is bindable, so
 * opting out of it is not expressible on purpose.
 *
 * `'contextual-toolbar'` joined the union with `docs/adr/0010`'s M3, the first
 * command whose natural home is the toolbar of a selected element. The entry
 * itself is still declared by the element's own `ToolbarModuleConfig` — a
 * toolbar is a designed row, not an enumeration — but it INVOKES the registered
 * command, so the behaviour, the availability rule and the single telemetry
 * emission stay in one place, and `CommandInvocation.surface` reports where the
 * user actually clicked instead of borrowing another surface's name.
 */
export type CommandSurface =
  | 'senior-menu' // the senior button sub-menu — max 14 slots per owner
  | 'catalogue' // the "more artefacts" sidepanel
  | 'palette' // the search / command palette
  | 'contextual-toolbar' // the toolbar of a SELECTED element
  | 'agent'; // invocable by Labre's AI

export type CommandKind =
  | 'artefact' // creates an element
  | 'tool' // arms a tool
  | 'toggle' // flips a property
  | 'legend' // generates a legend
  | 'action'; // everything else (undo, duplicate, applyLastStyle)

/** Where the invocation came from — feeds `segment` / `module` / `control`. */
export interface CommandInvocation {
  surface: CommandSurface | 'shortcut';
  source: ElementCreationSource;
}

/**
 * The single source of truth for everything a framework offers. The keyboard
 * binding is one FACET of a command — present, possibly empty, always
 * rebindable — not a separate declaration.
 *
 * Two permanent projections derive from it and nothing else:
 * {@link toShortcutDescriptor} (in-editor keymap + Settings › Shortcuts) and
 * {@link toCommandManifestEntry} (the serializable catalogue seam).
 */
export interface CommandDescriptor<P = void> {
  /** Stable id; same namespace as the shortcut ids: `'wardley.addComponent'`. */
  id: string;
  owner: CommandOwner;
  kind: CommandKind;

  /** i18n keys — resolved host-side, as `ShortcutDescriptor.labelKey` is. */
  labelKey: string;
  /**
   * English default for the in-library chrome that has to SHOW the label (the
   * senior sub-menu tooltip). Same seam and same rule as the framework
   * background declarations: a host with no catalogue reads correctly, a host
   * with one always wins. Without it the switchover would replace today's
   * English tooltips with raw i18n keys.
   */
  labelFallback?: string;
  descriptionKey?: string;
  /**
   * English default for {@link descriptionKey}, same seam and same rule as
   * {@link labelFallback}: a host with a catalogue always wins, a host without
   * one still reads a sentence instead of a raw key.
   *
   * It exists because a description is now SHOWN in-library — the senior
   * sub-menu puts it under the label, which is where a tool announces what its
   * gesture means (`docs/adr/0010` M1). Before that, `descriptionKey` crossed
   * the manifest seam and was never rendered by this repository.
   */
  descriptionFallback?: string;
  /** Sub-category inside the owner's catalogue, e.g. `'backgrounds'`. */
  category?: string;
  /**
   * Stable asset key, NOT markup. Resolved to a template by the library's own
   * icon registry ({@link CommandIconExtension}); a host may substitute its
   * set, but need not.
   */
  iconKey?: string;
  /** Extra search terms for the palette. */
  keywords?: string[];

  surfaces: CommandSurface[];
  /** Ascending rank inside `senior-menu` / `catalogue`. */
  order?: number;

  scope: ShortcutScope;
  /**
   * Default chord. `{ mac: [], other: [] }` means "no default, still bindable"
   * — the shipped `redo-windows` precedent. Never `undefined`.
   */
  defaultKeys: { mac: string[]; other: string[] };

  /** Serializable precondition; defaults to `'always'`. Crosses the host seam. */
  availability?: Availability;
  /**
   * In-library refinement of {@link availability} — never contradicting it,
   * only narrowing. Not projected into either manifest.
   */
  when?: (std: BlockStdScope) => boolean;

  /** THE new capability: invocable without a keyboard event. */
  run: (
    std: BlockStdScope,
    invocation: CommandInvocation,
    params?: P
  ) => void | Promise<void>;
  /** Agent-facing parameter contract. */
  params?: z.ZodType<P>;

  /**
   * Emitted centrally by {@link runCommand} — never by the command body.
   * `framework` is the code-side id; the reporter maps it through
   * `FrameworkDescriptor.telemetryKey` so the wire value stays historical.
   */
  telemetry?: { framework: FrameworkId; element: string };
}

/**
 * A command with its parameter contract erased — what the REGISTRY holds.
 *
 * The registry is heterogeneous by design: nullary commands (`undo`,
 * `wardley.addComponent`) sit in the same list as parameterised ones
 * (`pivot.bind`, whose record id cannot come from the library). The default
 * `CommandDescriptor` — i.e. `CommandDescriptor<void>` — cannot express that:
 * under `strictFunctionTypes`, `run`'s parameter is contravariant and `params`
 * covariant, so a `CommandDescriptor<P>` is assignable to neither direction of
 * `CommandDescriptor<void>`.
 *
 * Erasure costs nothing at runtime: {@link runCommand} forwards `params`
 * opaquely, and a parameterised command re-validates with its own zod schema
 * inside `run` — which an agent-invocable command has to do regardless of what
 * the static type promises.
 */
export type AnyCommandDescriptor = CommandDescriptor<any>;

/**
 * Value kinds a command parameter may take across the host seam. Closed and
 * deliberately small: the seam describes what an agent must SEND, not the
 * host's type system. Anything richer stays behind `CommandDescriptor.params`,
 * which never crosses.
 */
export type CommandParamKind = 'string' | 'number' | 'boolean' | 'string[]';

/** One parameter, described serializably. See {@link describeCommandParams}. */
export interface CommandParam {
  key: string;
  kind: CommandParamKind;
  /** `false` when the key may be omitted entirely. */
  required: boolean;
  /** `null` is an accepted value carrying a meaning of its own. */
  nullable?: boolean;
}

/**
 * The serializable catalogue projection — no functions, no `TemplateResult`.
 * This is what crosses the host seam for the sidepanel, the palette and the
 * agent (ADR 0006: the seam stays typed and render-free).
 */
export interface CommandManifestEntry {
  id: string;
  owner: CommandOwner;
  kind: CommandKind;
  labelKey: string;
  labelFallback?: string;
  descriptionKey?: string;
  descriptionFallback?: string;
  category?: string;
  iconKey?: string;
  keywords?: string[];
  surfaces: CommandSurface[];
  order?: number;
  scope: ShortcutScope;
  defaultKeys: { mac: string[]; other: string[] };
  availability: Availability;
  /**
   * What an invoker must send. Absent = nullary, which is what almost every
   * command is. Derived from `CommandDescriptor.params`, never authored twice.
   */
  params?: CommandParam[];
  telemetry?: { framework: FrameworkId; element: string };
}

/**
 * The per-framework identity consumers 2-5 need, and that nothing owned before
 * — spelled five times across the repo and already drifted. It is also THE
 * source for packaging: `scripts/build-bundles.mjs` derives its bundle entries
 * from `FRAMEWORK_DESCRIPTORS` instead of a hand-maintained array.
 */
export interface FrameworkDescriptor {
  id: FrameworkId;
  /** Replaces the raw English `SeniorTool.name`. */
  labelKey: string;
  /**
   * The English wording behind {@link labelKey} — what a standalone editor
   * shows and what every restatement of the name (senior button, tooltip)
   * must agree with. Carried HERE so the manifest knows the fallback and the
   * drift check can hold the restatements to it.
   */
  labelFallback: string;
  iconKey: string;
  order?: number;
  /** First keystroke of this framework's chords — allocated, not ad hoc. */
  chordPrefix?: string;
  /**
   * Historical PostHog value for `FrameworkElementEvent.framework`, kept as-is
   * so the identity unification stays code-side and analytics never break.
   * e.g. id `'ddd-event-storming'` → telemetryKey `'event-storming'`.
   */
  telemetryKey: string;
  /**
   * Historical PostHog value for `TelemetryEvent.segment`. Not derivable from
   * {@link telemetryKey} (the three DDD frameworks all emit `'ddd toolbox'`),
   * and the "no analytics breakage" rule of ADR 0008 makes it load-bearing.
   */
  telemetrySegment: string;
  /** Packaging: the published bundle name suffix, e.g. `'framework-wardley'`. */
  bundle: string;
  /** Packaging: the exported host-wiring descriptor name. */
  info: string;
  pkg: string; // '@labre/affine-gfx-wardley'
  dir: string; // 'affine/gfx/wardley'
  extensions: { flag?: string; viewExtension: string }[];
  /** Packaging: the framework contributes shortcut-manifest entries. */
  shortcuts?: boolean;
}

/** Multi-instance: one registered {@link CommandDescriptor} per impl. */
export const CommandDescriptorIdentifier =
  createIdentifier<AnyCommandDescriptor>('CommandDescriptor');

/** Multi-instance: one `iconKey → template` table per contributing package. */
export const CommandIconsIdentifier =
  createIdentifier<Record<string, TemplateResult>>('CommandIcons');

/**
 * Sink for the ONE telemetry emission per invocation. Declared here because
 * {@link runCommand} is the bottleneck; implemented in the affine layer, which
 * owns `TelemetryProvider` and the `telemetryKey` mapping.
 */
export type CommandTelemetryReporter = (report: {
  std: BlockStdScope;
  command: AnyCommandDescriptor;
  invocation: CommandInvocation;
}) => void;

export const CommandTelemetryIdentifier =
  createIdentifier<CommandTelemetryReporter>('CommandTelemetry');

/** What a {@link CommandUsageStore} knows about one command. */
export interface CommandUsageStats {
  count: number;
  lastUsedAt: number;
}

/**
 * Per-user recency and frequency, measured at the same bottleneck telemetry is
 * emitted from — and deliberately NOT the same thing.
 *
 * Telemetry is analytics: it leaves for a product dashboard, it only covers
 * commands that declare a `telemetry` field, and no in-editor decision may
 * depend on it. Usage is local state read back BY the editor: PF6 shows only
 * thirteen of a framework's commands in the senior sub-menu once the framework
 * has more than fourteen artefacts, ranked as "seven most-recent + six
 * most-used" (PO re-arbitration of 2026-08-28, superseding the 4 + 3 of
 * 2026-08-26). That ranking needs a measure for EVERY command — a `core` action, a
 * self-emitting one, one nobody ever thought to instrument — so the record call
 * sits outside the telemetry condition and stays there.
 *
 * ADR 0008 listed this as an open question ("needs a host-side usage store; the
 * registry only needs to accept an injected comparator"). This identifier is
 * the measurement half of that answer; the selection half is
 * {@link selectSeniorMenuCommands}.
 */
export interface CommandUsageStore {
  /** One invocation happened. Called by {@link runCommand}, best-effort. */
  record(command: AnyCommandDescriptor, invocation: CommandInvocation): void;
  /** `undefined` when the command was never invoked by this user. */
  statsOf(commandId: string): CommandUsageStats | undefined;
}

export const CommandUsageIdentifier =
  createIdentifier<CommandUsageStore>('CommandUsage');

const surfaceSelections = (std: BlockStdScope) =>
  std.selection.filter(SurfaceSelection);

/**
 * Mirrors `GfxSelectionManager.editing` without importing `@labre/std/gfx`
 * (which would close an import cycle through `extension/`): the gfx manager
 * derives it from exactly these selections.
 */
export const isEditingOnCanvas = (std: BlockStdScope) =>
  surfaceSelections(std).some(sel => sel.editing);

const hasCanvasSelection = (std: BlockStdScope) =>
  surfaceSelections(std).some(sel => sel.elements.length > 0);

/**
 * Evaluate a command's serializable precondition in-editor. `when` narrows it
 * further and is evaluated by the callers, never folded in here — the two are
 * deliberately separate so the manifest value stays the whole truth a host can
 * see.
 *
 * `'selection:framework'` evaluates as `'selection'`; narrowing to the owner's
 * element types is left to `when`. `validation.mapQuality` is the first command
 * to declare it, and it is also why the narrowing has not moved here: what makes
 * an element a framework's ROOT INSTANCE is a question for the validation
 * engine (which rule declares a `backgroundRole` this element's role satisfies),
 * and `@labre/std` neither knows nor should learn it. The serializable value
 * stays the whole truth a host catalogue can see; the in-editor refinement stays
 * in `when`. See ADR 0008 § Availability.
 */
export function isCommandAvailable(
  std: BlockStdScope,
  command: AnyCommandDescriptor
): boolean {
  switch (command.availability ?? 'always') {
    case 'always':
      return true;
    case 'selection':
    case 'selection:framework':
      return !isEditingOnCanvas(std) && hasCanvasSelection(std);
    case 'editable':
      return !std.store.readonly;
  }
}

/**
 * THE bottleneck: the one place a command runs, and therefore the one place
 * its telemetry is emitted and its usage measured. Every surface (sub-menu,
 * shortcut, palette, sidepanel, agent) goes through here, which is what removes
 * the per-menu `track()` duplicates.
 */
export function runCommand(
  std: BlockStdScope,
  command: AnyCommandDescriptor,
  invocation: CommandInvocation,
  params?: unknown
): void {
  const result = command.run(std, invocation, params as never);
  if (result instanceof Promise) result.catch(console.error);
  // Before the telemetry gate on purpose: usage is measured for EVERY command,
  // including the ones with no `telemetry` field and the self-emitting ones.
  std.getOptional(CommandUsageIdentifier)?.record(command, invocation);
  if (!command.telemetry) return;
  std.getOptional(CommandTelemetryIdentifier)?.({ std, command, invocation });
}

/**
 * One of the three permanent projections out of {@link CommandDescriptor} —
 * NOT a migration shim. It is TOTAL: keyless commands yield a descriptor with
 * empty `defaultKeys` rather than being dropped, so a `ShortcutOverrides` entry
 * on their id actually binds and Settings › Shortcuts can offer every command.
 *
 * `id`, `labelKey`, `defaultKeys`, `scope` and `owner` are carried over
 * verbatim, which is what keeps hosts' persisted v0.29 override tables valid.
 */
export function toShortcutDescriptor(
  command: AnyCommandDescriptor
): ShortcutDescriptor {
  return {
    id: command.id,
    labelKey: command.labelKey,
    defaultKeys: command.defaultKeys,
    scope: command.scope,
    owner: command.owner,
    handler: std => ctx => {
      // A keystroke aimed at a canvas text editor belongs to that editor.
      if (command.scope === 'edgeless' && isEditingOnCanvas(std)) return false;
      if (!isCommandAvailable(std, command)) return false;
      if (command.when && !command.when(std)) return false;
      ctx.get('defaultState').event.preventDefault();
      runCommand(std, command, { surface: 'shortcut', source: 'shortcut' });
      return true;
    },
  };
}

/**
 * The DATA-ONLY shortcut projection: what a host's Settings › Shortcuts pane
 * reads to draw a row, and nothing else. No `handler`, no `run`, no `params` —
 * so a module holding these entries carries no reference to the action graph
 * behind the command and can be published on its own subpath (each framework
 * bundle's `./commands-manifest`).
 *
 * It is the SIX fields the panel needs. `labelFallback` is one of them and that
 * is deliberate: the projection used to drop it, which left a host with no
 * catalogue rendering raw i18n keys for the rows it could not translate, and
 * forced every host to re-project from the main entry to recover a wording the
 * library already knew.
 *
 * `owner` is a {@link CommandOwner} rather than `ShortcutDescriptor`'s open
 * `string`: the panel groups by owner, and the closed union is what makes that
 * grouping exhaustive host-side.
 */
export interface ShortcutManifestEntry {
  id: string;
  labelKey: string;
  /** English default behind {@link labelKey}; see {@link CommandDescriptor.labelFallback}. */
  labelFallback?: string;
  defaultKeys: { mac: string[]; other: string[] };
  scope: ShortcutScope;
  owner: CommandOwner;
}

/**
 * The third permanent projection out of {@link CommandDescriptor}, beside
 * {@link toShortcutDescriptor} and {@link toCommandManifestEntry}. TOTAL for
 * the same reason the shortcut descriptor is: a keyless command still yields a
 * row, so Settings › Shortcuts can bind it.
 */
export function toShortcutManifestEntry(
  command: AnyCommandDescriptor
): ShortcutManifestEntry {
  return {
    id: command.id,
    labelKey: command.labelKey,
    labelFallback: command.labelFallback,
    defaultKeys: command.defaultKeys,
    scope: command.scope,
    owner: command.owner,
  };
}

/**
 * The shape of a zod definition, read through `_def` rather than `instanceof`.
 *
 * `instanceof z.ZodOptional` would need a VALUE import of zod in `@labre/std`,
 * which today imports it as a type only — a runtime dependency added to the
 * core bundle for an introspection that runs once per command at assembly time.
 * `_def.typeName` is zod-internal but stable across zod 3, and the whole reader
 * is defensive: anything it does not recognise yields no contract at all rather
 * than a wrong one.
 */
type ZodDefLike = {
  typeName?: string;
  innerType?: unknown;
  type?: unknown;
  shape?: () => Record<string, unknown>;
};

const zodDef = (schema: unknown): ZodDefLike =>
  (schema as { _def?: ZodDefLike } | undefined)?._def ?? {};

const ZOD_KIND: Record<string, CommandParamKind> = {
  ZodString: 'string',
  ZodNumber: 'number',
  ZodBoolean: 'boolean',
  ZodEnum: 'string',
};

/** Unwraps at most a few modifier layers; a deeper nesting is not describable. */
function describeParam(key: string, schema: unknown): CommandParam | undefined {
  let current = schema;
  let required = true;
  let nullable = false;

  for (let depth = 0; depth < 4; depth++) {
    const def = zodDef(current);
    if (def.typeName === 'ZodOptional' || def.typeName === 'ZodDefault') {
      required = false;
      current = def.innerType;
      continue;
    }
    if (def.typeName === 'ZodNullable') {
      nullable = true;
      current = def.innerType;
      continue;
    }
    break;
  }

  const def = zodDef(current);
  const kind =
    def.typeName === 'ZodArray'
      ? zodDef(def.type).typeName === 'ZodString'
        ? ('string[]' as const)
        : undefined
      : ZOD_KIND[def.typeName ?? ''];

  if (!kind) return undefined;
  return nullable ? { key, kind, required, nullable } : { key, kind, required };
}

/**
 * Project a command's zod parameter contract onto the serializable seam, so the
 * `'agent'` surface is usable end to end: without it an agent reading the
 * manifest has no way to learn that `pivot.bind` needs a `pivotDocId`, and an
 * argument-less call is a silent no-op.
 *
 * All or nothing on purpose. A partially described object would be worse than
 * none: an agent would send what it was told and have its call rejected by the
 * schema for a key the manifest never mentioned. So one undescribable property
 * withdraws the whole contract, and the command reads as "parameters exist, but
 * this seam cannot state them" — which is the honest answer.
 */
export function describeCommandParams(
  schema: unknown
): CommandParam[] | undefined {
  const def = zodDef(schema);
  if (def.typeName !== 'ZodObject' || typeof def.shape !== 'function') {
    return undefined;
  }

  const params: CommandParam[] = [];
  for (const [key, property] of Object.entries(def.shape())) {
    const param = describeParam(key, property);
    if (!param) return undefined;
    params.push(param);
  }
  return params.length ? params : undefined;
}

/** The serializable projection. Functions and templates stop here. */
export function toCommandManifestEntry(
  command: AnyCommandDescriptor
): CommandManifestEntry {
  return {
    id: command.id,
    owner: command.owner,
    kind: command.kind,
    labelKey: command.labelKey,
    labelFallback: command.labelFallback,
    descriptionKey: command.descriptionKey,
    descriptionFallback: command.descriptionFallback,
    category: command.category,
    iconKey: command.iconKey,
    keywords: command.keywords,
    surfaces: command.surfaces,
    order: command.order,
    scope: command.scope,
    defaultKeys: command.defaultKeys,
    availability: command.availability ?? 'always',
    params: describeCommandParams(command.params),
    telemetry: command.telemetry,
  };
}

let _commandId = 1;

/**
 * Register a package's commands. ONE call gives both faces: the enumerable
 * registry (in-editor consumers) and — through {@link toShortcutDescriptor} —
 * the keymap bindings. Registering inside a flag-gated view extension is what
 * makes a disabled framework vanish from both at once.
 */
export function CommandExtension(
  commands: AnyCommandDescriptor[],
  icons?: Record<string, TemplateResult>
): ExtensionType {
  return {
    setup: di => {
      commands.forEach(command => {
        di.addImpl(
          CommandDescriptorIdentifier(`Command-${_commandId++}`),
          command
        );
      });
      if (icons) {
        di.addImpl(
          CommandIconsIdentifier(`CommandIcons-${_commandId++}`),
          icons
        );
      }
      ShortcutExtension(commands.map(toShortcutDescriptor)).setup(di);
    },
  };
}

/** Every command registered in this editor assembly. */
export function getRegisteredCommands(
  std: BlockStdScope
): AnyCommandDescriptor[] {
  return [...std.provider.getAll(CommandDescriptorIdentifier).values()];
}

/**
 * The commands one owner contributes to one surface, in `order` then
 * declaration order. This is what a senior sub-menu renders — no hard-coded
 * button list anywhere.
 */
export function getCommandsForSurface(
  std: BlockStdScope,
  owner: CommandOwner,
  surface: CommandSurface
): AnyCommandDescriptor[] {
  return getRegisteredCommands(std)
    .filter(c => c.owner === owner && c.surfaces.includes(surface))
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
}

/**
 * The senior sub-menu's hard cap: 14 buttons in one row of the popover. The
 * registry test asserts no owner DECLARES more than this; the ranking below is
 * what happens when an owner's whole catalogue outgrows it.
 */
export const SENIOR_MENU_CAP = 14;

const MENU_RECENT_SLOTS = 7;
const MENU_USED_SLOTS = 6;

/**
 * How many buttons survive once an owner overflows: {@link MENU_RECENT_SLOTS}
 * by recency plus {@link MENU_USED_SLOTS} by frequency — thirteen (PO
 * re-arbitration of 2026-08-28, superseding the 4 + 3 of 2026-08-26).
 *
 * Thirteen and not fourteen because the permanent "More artefacts…" button is
 * the fourteenth: an overflowed sub-menu therefore renders exactly the cap, and
 * the row a user meets past the cap is as wide as the one they meet below it.
 */
export const SENIOR_MENU_RANKED_SLOTS = MENU_RECENT_SLOTS + MENU_USED_SLOTS;

const HEAD_RECENT_SLOTS = 4;
const HEAD_USED_SLOTS = 3;

/**
 * How many rows the catalogue sidepanel's "Recent & frequent" head section
 * holds: {@link HEAD_RECENT_SLOTS} + {@link HEAD_USED_SLOTS} = seven.
 *
 * Deliberately NOT {@link SENIOR_MENU_RANKED_SLOTS}, and this is the third
 * decision of 2026-08-28 (architect's ruling on review of the two PO ones). The
 * sub-menu's thirteen is argued from ITS geometry — a horizontal row of ~24px
 * icon buttons, thirteen of them plus the More button making up the fourteen
 * cap. None of that transfers to a vertical list of 44px rows in a panel
 * `min(320px, 85vw)` wide: thirteen of those is ~604px of head section, which
 * on a 13" laptop is the entire first screen, every row of it a duplicate of a
 * row filed below, pushing the categories — the panel's actual information
 * architecture — wholly under the fold. Worst for exactly the power user the
 * section exists to serve.
 *
 * So the two surfaces share the ARBITRATION and not the MAGNITUDE: one
 * algorithm, two parameterisations. Seven keeps the size the PO recette of
 * 27/08/2026 signed off on, and the 4 + 3 split keeps both halves of a section
 * labelled "Recent & frequent" — a plain `.slice(0, 7)` of the sub-menu's pick
 * would have returned seven recency picks and zero frequency ones, quietly
 * deleting the "& frequent" half.
 */
export const CATALOGUE_HEAD_RANKED_SLOTS = HEAD_RECENT_SLOTS + HEAD_USED_SLOTS;

/**
 * Which of an owner's commands the senior sub-menu actually shows.
 *
 * Pure — no `std`, no DOM, no store — because this is the arbitration between
 * a framework's whole toolbox and fourteen buttons, and an arbitration nobody
 * can run in a unit test is a design review in disguise (`docs/adr/0008`,
 * amendment of 2026-08-26).
 *
 * Below the cap nothing is arbitrated: the sub-menu IS the framework's
 * `'senior-menu'` surface, authored order and all. Past it the sub-menu becomes
 * a shortcut to the thirteen commands THIS user reaches for, beside one button
 * to the catalogue sidepanel where the rest live.
 *
 * **Eligibility is declared, never earned** (PO ruling of 2026-08-28). What
 * gets ranked is the `'senior-menu'` surface — the ≤14 its author nominated —
 * and NOT the whole catalogue. The trigger still reads the catalogue (an owner
 * overflows when its total toolbox outgrows the cap), but a command that
 * deliberately declines the sub-menu stays out of it however often it is
 * invoked. `bpmn.exportXml` is the case that made the rule: its subject is the
 * whole BOARD, it lives in the pool's "⋮" and in the catalogue, and usage alone
 * used to drag it into a row of things you DRAW — where "Export BPMN" answers
 * no question a user asked. A surface a command declines is a statement about
 * where it belongs, not a default to be out-voted.
 *
 * The thirteen are chosen on two axes because one is not enough — frequency
 * alone never surfaces what the user picked up yesterday, recency alone
 * reshuffles every click. They are then laid out in **authored order**, not in
 * rank order: a menu whose buttons swap places under the cursor is the dark
 * pattern this whole feature exists to avoid, so what the ranking decides is
 * membership, never position.
 *
 * With no usage recorded at all, both axes collapse to authored order and the
 * result is the first thirteen of the nominated list — a deterministic cold
 * start, not an empty menu.
 *
 * @param menu the owner's `'senior-menu'` commands, already order-sorted. It is
 *   both the pool the ranking draws membership from and the authored order the
 *   survivors are laid back out in.
 * @param catalogue the owner's whole `'catalogue'` surface, already
 *   order-sorted. Read only for its length, to decide whether the owner
 *   overflows at all; it contributes no candidate.
 * @param statsOf per-user measure; `undefined` for a command never invoked
 */
export function selectSeniorMenuCommands(
  menu: AnyCommandDescriptor[],
  catalogue: AnyCommandDescriptor[],
  statsOf: (id: string) => CommandUsageStats | undefined
): { commands: AnyCommandDescriptor[]; overflow: boolean } {
  if (catalogue.length <= SENIOR_MENU_CAP) {
    return { commands: menu, overflow: false };
  }

  const authored = new Map(menu.map((command, index) => [command, index]));
  const order = (command: AnyCommandDescriptor) => authored.get(command) ?? 0;

  // (7, 6): thirteen icon buttons, plus the "More artefacts…" one, is the cap.
  const { commands } = pickByUsage(
    menu,
    statsOf,
    MENU_RECENT_SLOTS,
    MENU_USED_SLOTS
  );

  return {
    commands: commands.sort((a, b) => order(a) - order(b)),
    overflow: true,
  };
}

/**
 * The shared arbitration, over whatever pool its caller hands it: `recentSlots`
 * by recency plus `usedSlots` by frequency, deduplicated.
 *
 * The two slot counts are PARAMETERS rather than constants because the two
 * consumers share this ranking and not its magnitude — the sub-menu passes
 * (7, 6) for a row of icon buttons, the sidepanel head (4, 3) for a vertical
 * list of 44px rows. One arbitration, two parameterisations, still never two
 * opinions.
 *
 * Recency goes FIRST since the PO's re-arbitration of 2026-08-28 (it was 4
 * most-used + 3 most-recent): what a user reached for this morning is what they
 * are still working on, and a row that leads with the all-time workhorses is a
 * row that takes weeks to notice a new habit. So a command that tops BOTH axes
 * consumes a RECENT slot, and the most-used slot it would have taken goes to
 * the next candidate down the frequency ranking — which is what the backfill
 * loop below does by walking `mostUsed` whole rather than only its head.
 *
 * Returned in PICK order (the recency ranks first, the frequency additions
 * after); each consumer imposes its own display order. The `stats` map is
 * returned with them so a consumer that filters on "was this ever measured?"
 * does not ask the store a second time — see {@link rankCommandsByUsage}.
 */
function pickByUsage(
  pool: AnyCommandDescriptor[],
  statsOf: (id: string) => CommandUsageStats | undefined,
  recentSlots: number,
  usedSlots: number
): {
  commands: AnyCommandDescriptor[];
  stats: Map<AnyCommandDescriptor, CommandUsageStats | undefined>;
} {
  const authored = new Map(pool.map((command, index) => [command, index]));
  const order = (command: AnyCommandDescriptor) => authored.get(command) ?? 0;
  // One read per command per selection: the store answers from storage, and the
  // two axes would otherwise ask it the same question twice.
  const stats = new Map(pool.map(c => [c, statsOf(c.id)]));

  const rankBy = (
    primary: (used: CommandUsageStats) => number,
    secondary: (used: CommandUsageStats) => number
  ) =>
    [...pool].sort((a, b) => {
      const left = stats.get(a);
      const right = stats.get(b);
      // A command nobody ever invoked ranks after every command somebody did,
      // on either axis — it has no measure, not a low one.
      if (!left || !right) {
        return left ? -1 : right ? 1 : order(a) - order(b);
      }
      return (
        primary(right) - primary(left) ||
        secondary(right) - secondary(left) ||
        order(a) - order(b)
      );
    });

  const mostUsed = rankBy(
    used => used.count,
    used => used.lastUsedAt
  );
  const mostRecent = rankBy(
    used => used.lastUsedAt,
    used => used.count
  );

  const total = recentSlots + usedSlots;
  const chosen = new Set<AnyCommandDescriptor>();
  for (const command of mostRecent.slice(0, recentSlots)) {
    chosen.add(command);
  }
  // The `usedSlots` remaining seats, from the frequency ranking: walking it
  // whole rather than only its head is what makes a double pick free its
  // most-used slot for the next candidate instead of wasting it.
  for (const command of mostUsed) {
    if (chosen.size >= total) break;
    chosen.add(command);
  }

  return { commands: [...chosen].slice(0, total), stats };
}

/**
 * The commands a user actually reaches for, for surfaces that lead with them —
 * the catalogue sidepanel's "recent & frequent" head section (PO recette,
 * 27/08/2026).
 *
 * Same arbitration as the senior sub-menu ({@link pickByUsage}) — one ranking,
 * two consumers, never two opinions — with four deliberate differences:
 *
 * - it seats {@link CATALOGUE_HEAD_RANKED_SLOTS} (4 recent + 3 used), not the
 *   sub-menu's thirteen. The two surfaces share the arbitration and not the
 *   magnitude: see {@link CATALOGUE_HEAD_RANKED_SLOTS} for why thirteen 44px
 *   rows in a 320px panel would bury the categories under the fold.
 * - it ranks the CATALOGUE surface, and keeps doing so after the eligibility
 *   ruling of 2026-08-28 narrowed the sub-menu to `'senior-menu'` declarers.
 *   That ruling is about the sub-menu, which is a row of things you DRAW; the
 *   sidepanel is the full-catalogue surface, the one place every command of a
 *   framework is reachable, so a catalogue-only command like `bpmn.exportXml`
 *   heading this section is the section working — "here is what you reach for"
 *   over a panel that lists everything, not a board action smuggled into a
 *   palette. Passing the menu surface here would hide a user's own habits from
 *   the very panel built to show them.
 * - only commands that CARRY a measure are returned. The sub-menu backfills
 *   with authored order because it must always show something; a "recently
 *   used" section padded with the never-used would be a label that lies, so
 *   with no usage at all this returns `[]` and the section is simply absent.
 * - the PICK order is kept (the recency ranks, then the frequency additions),
 *   not re-sorted by authored order: the section's whole message is "yours,
 *   latest first", and it only recomposes when the panel reopens.
 */
export function rankCommandsByUsage(
  catalogue: AnyCommandDescriptor[],
  statsOf: (id: string) => CommandUsageStats | undefined
): AnyCommandDescriptor[] {
  const { commands, stats } = pickByUsage(
    catalogue,
    statsOf,
    HEAD_RECENT_SLOTS,
    HEAD_USED_SLOTS
  );
  // Through the map the ranking already built, not a second round of store
  // reads: "one read per command per selection" is a promise this function used
  // to break once per returned row.
  return commands.filter(command => stats.get(command) !== undefined);
}

/**
 * Register an icon table that no COMMAND owns.
 *
 * Same identifier, same `iconKey` namespace and same resolution as the table
 * `CommandExtension` registers, because an icon key is an icon key: what
 * differs is only which declaration carries the key. A framework's tag VALUES
 * are the second such declaration — `UniverseTagDefs` is a host-extensible DATA
 * format (a pack may ship as a `.json` asset), so a value can carry a
 * serializable `iconKey` and nothing else, and the template it names is
 * resolved here.
 *
 * Registering it inside a flag-gated view extension is what makes a disabled
 * framework's icons vanish with the rest of its tooling.
 */
export function IconTableExtension(
  icons: Record<string, TemplateResult>
): ExtensionType {
  return {
    setup: di => {
      di.addImpl(CommandIconsIdentifier(`Icons-${_commandId++}`), icons);
    },
  };
}

/**
 * Resolve an `iconKey` through every registered icon table.
 *
 * `undefined` when nothing answers — an unknown key, or a table that was never
 * registered because its framework is switched off. Every caller draws nothing
 * in that case rather than a placeholder: an icon is decoration, and a missing
 * one must never remove the label beside it.
 */
export function resolveIconKey(
  std: BlockStdScope,
  iconKey: string | undefined
): TemplateResult | undefined {
  if (!iconKey) return undefined;
  for (const table of std.provider.getAll(CommandIconsIdentifier).values()) {
    const icon = table[iconKey];
    if (icon) return icon;
  }
  return undefined;
}

/** {@link resolveIconKey}, named for its first and largest caller. */
export function getCommandIcon(
  std: BlockStdScope,
  iconKey: string | undefined
): TemplateResult | undefined {
  return resolveIconKey(std, iconKey);
}
