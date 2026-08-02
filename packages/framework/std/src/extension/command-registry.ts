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
 * The seven framework modules that own commands. An EXPLICIT list, not a
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
 */
export type CommandSurface =
  | 'senior-menu' // the senior button sub-menu — max 14 slots per owner
  | 'catalogue' // the "more artefacts" sidepanel
  | 'palette' // the search / command palette
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
 * its telemetry is emitted. Every surface (sub-menu, shortcut, palette,
 * sidepanel, agent) goes through here, which is what removes the per-menu
 * `track()` duplicates.
 */
export function runCommand(
  std: BlockStdScope,
  command: AnyCommandDescriptor,
  invocation: CommandInvocation,
  params?: unknown
): void {
  const result = command.run(std, invocation, params as never);
  if (result instanceof Promise) result.catch(console.error);
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
        di.addImpl(CommandIconsIdentifier(`CommandIcons-${_commandId++}`), icons);
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

/** Resolve an `iconKey` through the registered icon tables. */
export function getCommandIcon(
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
