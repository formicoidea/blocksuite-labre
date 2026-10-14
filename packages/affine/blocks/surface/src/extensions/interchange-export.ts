import {
  type ChromeWording,
  NotificationProvider,
  translateKey,
} from '@labre/affine-shared/services';
import { downloadBlob } from '@labre/affine-shared/utils';
import {
  type AnyCommandDescriptor,
  type BlockStdScope,
  type CommandFile,
  type CommandFileParams,
  FRAMEWORK_IDS,
  type FrameworkId,
  frameworkOfRole,
} from '@labre/std';
import { GfxControllerIdentifier } from '@labre/std/gfx';

import {
  type InterchangeExportCapability,
  interchangeCapabilities,
} from './interchange.js';

/**
 * **One "This view" export per `*:export` capability a framework registered**
 * (ADR 0034, amendment of 2026-10-14; ADR 0012).
 *
 * The registry already answers "what can Labre write, for which framework";
 * this projects that answer into view actions, the way the senior sub-menu is
 * a projection of the command descriptors. Nothing is declared per framework:
 * a capability registered from a framework's FLAG-GATED view extension yields
 * its action, a framework switched off registers no capability and therefore
 * lists no action (ADR 0009: a flag gates tooling), and the next framework that
 * declares an exporter is listed with no change here.
 *
 * Read off the registry at the moment the host lists the view's actions, NOT
 * registered as commands: a command enters the static registry
 * (`getCommands`), and from there every projection of it — the catalogue that
 * must hold every framework command, the per-framework counts, the senior
 * row's cap, Settings › Shortcuts — would grow by one row per format for an
 * entry that only a host menu draws. Each framework keeps its own selection
 * export (`bpmn.exportXml`, `uml.exportXmi`…) on its toolbar, catalogue and
 * palette; this is the whole-board twin a page-level "Export…" lists.
 *
 * The canvas's own capabilities (owner `'canvas'`, `canvas:drawio:export`)
 * are left out: they have their hand-written command (`canvas.export.drawio`),
 * and a second entry would list draw.io twice.
 */

/** "Export BPMN as .bpmn" — the framework's name, the format's extension. */
export const INTERCHANGE_EXPORT_LABEL: ChromeWording = [
  'com.labre.command.canvas.export.interchange',
  'Export {{framework}} as {{extension}}',
];

/** The notice's title when the writer could not say everything. */
export const INTERCHANGE_EXPORT_WARNINGS: ChromeWording = [
  'com.labre.command.canvas.export.interchange.warnings',
  'What this export could not write down',
];

export const INTERCHANGE_EXPORT_WORDINGS: readonly ChromeWording[] = [
  INTERCHANGE_EXPORT_LABEL,
  INTERCHANGE_EXPORT_WARNINGS,
];

/** One icon for every format: the registry declares none of its own. */
export const INTERCHANGE_EXPORT_ICON_KEY = 'canvas.export.interchange';

/**
 * `canvas.export.<framework>.<format>` — `canvas.export.bpmn.bpmn`,
 * `canvas.export.uml.xmi`. The framework is part of the id because a format
 * id is not unique across owners (`drawio` is UML's reader and the canvas's
 * writer). Stable: a host keys its test ids and icons on it, and usage is
 * recorded under it.
 */
export function interchangeExportActionId(
  capability: InterchangeExportCapability
): string {
  return `canvas.export.${capability.framework}.${capability.format.id}`;
}

const isFrameworkId = (id: string): id is FrameworkId =>
  (FRAMEWORK_IDS as readonly string[]).includes(id);

function surfaceElementsOf(std: BlockStdScope) {
  return std.get(GfxControllerIdentifier).surface?.elementModels ?? [];
}

/**
 * The whole board as the capability writes it, or `null` when the canvas
 * holds nothing of its framework.
 *
 * The WHOLE surface in document order, never the selection and never what
 * this viewer hid: a semantic export is a statement about the board, and
 * logic keeps what a viewer hid (ADR 0031) — the selection exports stay the
 * framework's own commands. The raw page title goes in, the capability makes
 * it safe to write to disk (`InterchangeExportContext.name`).
 */
export function interchangeExportFile(
  std: BlockStdScope,
  capability: InterchangeExportCapability
): { file: CommandFile; warnings: readonly string[] } | null {
  const elements = surfaceElementsOf(std);
  if (!elements.some(e => frameworkOfRole(e.role) === capability.framework)) {
    return null;
  }
  const title = std.store.workspace.meta.getDocMeta(std.store.id)?.title;
  const { text, filename, mime, warnings } = capability.run(elements, {
    name: title,
  });
  return {
    // The charset is the browser's business, not the format's.
    file: {
      blob: new Blob([text], { type: `${mime};charset=utf-8` }),
      filename,
    },
    warnings: warnings ?? [],
  };
}

/**
 * The view action of one capability. `owner` and `telemetry` name the
 * framework, so `runCommand` reports the export as that framework's
 * (`FrameworkElementAdded`, element `canvas:export-<format>`, module
 * `<framework> view-menu`). It READS: offered on a read-only page. Listed
 * only while the canvas holds an element of that framework (its role's
 * namespace): an export of nothing is not an export.
 *
 * A warning is never an error — the file is valid. What the writer could not
 * say goes to the notification seam, in its own English words (the
 * capability's `warnings` carry no key); with no seam, it is dropped.
 */
export function interchangeExportCommand(
  capability: InterchangeExportCapability & { framework: FrameworkId }
): AnyCommandDescriptor {
  return {
    id: interchangeExportActionId(capability),
    owner: capability.framework,
    kind: 'action',
    labelKey: INTERCHANGE_EXPORT_LABEL[0],
    labelFallback: INTERCHANGE_EXPORT_LABEL[1],
    category: 'export',
    iconKey: INTERCHANGE_EXPORT_ICON_KEY,
    surfaces: ['view-menu'],
    order: 14,
    scope: 'edgeless',
    defaultKeys: { mac: [], other: [] },
    telemetry: {
      framework: capability.framework,
      element: `canvas:export-${capability.format.id}`,
    },
    when: std =>
      surfaceElementsOf(std).some(
        e => frameworkOfRole(e.role) === capability.framework
      ),
    run: (std, _invocation, params) => {
      const exported = interchangeExportFile(std, capability);
      if (!exported) return;
      const deliver = (params as CommandFileParams | undefined)?.deliver;
      if (typeof deliver === 'function') deliver(exported.file);
      else downloadBlob(exported.file.blob, exported.file.filename);
      if (exported.warnings.length === 0) return;
      std.getOptional(NotificationProvider)?.notify({
        title: translateKey(std, ...INTERCHANGE_EXPORT_WARNINGS),
        message: exported.warnings.join('\n'),
        accent: 'warning',
        duration: 8000,
      });
    },
  };
}

/** A derived view action and the capability it runs. */
export interface InterchangeExportAction {
  command: AnyCommandDescriptor;
  capability: InterchangeExportCapability & { framework: FrameworkId };
}

/**
 * Every framework export this editor offers now, in the registry's id order:
 * what the registry holds, so what the flags let through.
 */
export function interchangeExportActions(
  std: BlockStdScope
): InterchangeExportAction[] {
  return interchangeCapabilities(std.provider, { direction: 'export' })
    .filter(
      (
        capability
      ): capability is InterchangeExportCapability & {
        framework: FrameworkId;
      } => isFrameworkId(capability.framework)
    )
    .map(capability => ({
      capability,
      command: interchangeExportCommand(capability),
    }));
}
