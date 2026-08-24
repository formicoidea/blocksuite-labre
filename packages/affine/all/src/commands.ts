import {
  coreCommands,
  pivotCommands,
  tagCommands,
} from '@labre/affine-block-root';
import {
  auditCommands,
  mapQualityCommands,
} from '@labre/affine-block-surface';
import { bpmnCommands } from '@labre/affine-gfx-bpmn';
import { cynefinEstuarineCommands } from '@labre/affine-gfx-cynefin-estuarine';
import { contextMapCommands } from '@labre/affine-gfx-ddd-context-map';
import { coreDomainCommands } from '@labre/affine-gfx-ddd-core-domain';
import { eventStormingCommands } from '@labre/affine-gfx-ddd-event-storming';
import { edgyCommands } from '@labre/affine-gfx-edgy';
import { shapeCommands } from '@labre/affine-gfx-shape';
import { wardleyCommands } from '@labre/affine-gfx-wardley';
import {
  type AnyCommandDescriptor,
  type CommandManifestEntry,
  type CommandSurface,
  type FrameworkId,
  toCommandManifestEntry,
} from '@labre/std';

import {
  isBlockEnabled,
  isCapabilityEnabled,
  type LabreFlags,
} from './flags.js';

/**
 * The command registry, enumerated WITHOUT an editor instance — the property
 * that makes it usable by host-side panels (Settings › Shortcuts, the
 * "more artefacts" sidepanel). See `docs/adr/0008`.
 *
 * Gating has two sides and both are honoured: registration (`CommandExtension`
 * inside each framework's flag-gated view extension) decides what BINDS, and
 * `isBlockEnabled` here decides what a host ENUMERATES. A unit test asserts the
 * two agree — a framework toggled off must vanish from the manifest and bind
 * nothing.
 *
 * Bundled distribution note: the framework groups below are STRIPPED from
 * `@formicoidea/labre-core` by `scripts/build-bundles.mjs` (`shortcuts: true`
 * on the framework's descriptor) — each framework bundle exports its own
 * commands and the host appends them for the frameworks it enables.
 */
interface FrameworkCommandGroup {
  owner: FrameworkId;
  commands: AnyCommandDescriptor[];
}

const FRAMEWORK_COMMAND_GROUPS: FrameworkCommandGroup[] = [
  { owner: 'wardley', commands: wardleyCommands },
  { owner: 'edgy', commands: edgyCommands },
  { owner: 'cynefin-estuarine', commands: cynefinEstuarineCommands },
  { owner: 'bpmn', commands: bpmnCommands },
  { owner: 'ddd-event-storming', commands: eventStormingCommands },
  { owner: 'ddd-core-domain', commands: coreDomainCommands },
  { owner: 'ddd-context-map', commands: contextMapCommands },
];

/**
 * Pure aggregator (exported for testing): core commands plus the commands of
 * every framework group whose flag is enabled.
 */
export function buildCommandRegistry(
  core: AnyCommandDescriptor[],
  groups: FrameworkCommandGroup[],
  flags?: LabreFlags
): AnyCommandDescriptor[] {
  const all = [...core];
  for (const { owner, commands } of groups) {
    if (isBlockEnabled(flags, owner)) all.push(...commands);
  }
  return all;
}

/**
 * Every command a given flag set exposes. Shapes are core canvas, so their
 * commands are always-on like root's — and so is Map quality (PF7.11), which
 * belongs to the SURFACE rather than to any framework: it appears for whichever
 * framework declared a nudge or an on-demand rule, and its own `when` asks the
 * engine that question. Listing it here would be wrong only if it were a
 * framework's, and it is not.
 *
 * `auditCommands` is `'core'`-owned but NOT always-on: it rides the `ai-audit`
 * capability switch, which is a second axis (see `OPTIONAL_CAPABILITIES`). The
 * read side is filtered here, the registration side by `AuditViewExtension` in
 * `getInternalViewExtensions` — the same two-sided gate a framework flag gets,
 * and the same test asserts the two agree.
 *
 * The two sit side by side deliberately: Map quality is the DETERMINISTIC
 * second moment (levels 1–2 of the validation taxonomy) and the audit is level
 * 3, which is why one is unconditional and the other rides a switch. Neither
 * depends on the other, and the engine depends on neither.
 */
export function getCommands(flags?: LabreFlags): AnyCommandDescriptor[] {
  return buildCommandRegistry(
    [
      ...coreCommands,
      ...pivotCommands,
      ...tagCommands,
      ...shapeCommands,
      ...mapQualityCommands,
      ...(isCapabilityEnabled(flags, 'ai-audit') ? auditCommands : []),
    ],
    FRAMEWORK_COMMAND_GROUPS,
    flags
  );
}

/**
 * The serializable catalogue manifest — what crosses the host seam for the
 * sidepanel, the palette and the agent. No functions, no templates: an
 * `iconKey` resolved lib-side, and availability as a closed union.
 */
export function getCommandManifest(
  flags?: LabreFlags
): CommandManifestEntry[] {
  return getCommands(flags).map(toCommandManifestEntry);
}

/** The manifest entries one surface offers, ordered. */
export function getCommandManifestForSurface(
  surface: CommandSurface,
  flags?: LabreFlags
): CommandManifestEntry[] {
  return getCommandManifest(flags)
    .filter(entry => entry.surfaces.includes(surface))
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
}
