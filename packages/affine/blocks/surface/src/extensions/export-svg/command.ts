import { FrameworkBackgroundElementModel } from '@labre/affine-model';
import { downloadBlob, safeFilename } from '@labre/affine-shared/utils';
import type { AnyCommandDescriptor, BlockStdScope } from '@labre/std';
import { GfxControllerIdentifier } from '@labre/std/gfx';

import { renderBoardSvg } from './render.js';

/** What the file is, told to the browser. */
const SVG_MIME = 'image/svg+xml';

/** The name a board with no document title falls back to. */
const SVG_FILENAME_FALLBACK = 'board';

/**
 * The framework boards in the current canvas selection.
 *
 * `FrameworkBackgroundElementModel` is the whole test, and that is the point of
 * this command: eleven board kinds today — a Wardley map, a BPMN pool, a C4
 * board and its boundaries, the three DDD boards, Cynefin, Estuarine, the two
 * EDGY ones — and whatever a framework adds next, because a board IS the class
 * and nothing about SVG is per framework (ADR 0025).
 */
export function selectedBoards(
  std: BlockStdScope
): FrameworkBackgroundElementModel[] {
  return std
    .get(GfxControllerIdentifier)
    .selection.selectedElements.filter(
      (element): element is FrameworkBackgroundElementModel =>
        element instanceof FrameworkBackgroundElementModel
    );
}

/**
 * Render the selected board and hand it to the browser.
 *
 * ponytail: ONE board per click, the first of the selection. Browsers throttle
 * (and Safari silently drops) programmatic downloads fired in a burst, so a
 * selection of three boards would yield one file, two files or three depending
 * on the browser — a result nobody can read off the gesture. One board, one
 * file, every time.
 */
export function exportBoardSvg(std: BlockStdScope): void {
  const [board] = selectedBoards(std);
  if (!board) return;

  const { svg } = renderBoardSvg(std, board);
  const title = std.store.workspace.meta.getDocMeta(std.store.id)?.title;
  downloadBlob(
    // The charset is the browser's business, not the format's: `image/svg+xml`
    // is what the file IS, and this is how a blob is told to carry it.
    new Blob([svg], { type: `${SVG_MIME};charset=utf-8` }),
    `${safeFilename(title, SVG_FILENAME_FALLBACK)}.svg`
  );
}

/**
 * "Export SVG", in the command registry (ADR 0025).
 *
 * `owner: 'core'` and not a framework's, for the reason `map.audit` and
 * `validation.mapQuality` are core: the command belongs to no framework —
 * it renders whatever board is selected with the renderer that already paints
 * it — and a framework owner would have forced the id prefix `wardley.` and
 * then a second, identical command for every framework that follows. `'core'`
 * owners are exempt from the id-prefix rule (ADR 0008).
 *
 * It READS, so there is no read-only guard: taking a picture of a board you
 * cannot edit is precisely what a reader does.
 *
 * No `telemetry` field: `CommandTelemetry.framework` is typed on `FrameworkId`,
 * and this command cannot name one — the surface package knows a board by its
 * MODEL CLASS, and nothing in it maps `bpmnPool` back to `bpmn` without
 * importing the framework packages the layering forbids. Usage is still
 * measured, because `runCommand` records it outside the telemetry condition.
 */
const exportSvg: AnyCommandDescriptor = {
  id: 'export.svg',
  owner: 'core',
  kind: 'action',
  labelKey: 'com.labre.command.export.svg',
  labelFallback: 'Export SVG',
  descriptionKey: 'com.labre.command.export.svg.description',
  descriptionFallback:
    'Download the selected board and everything drawn on it as an SVG file.',
  // The category the framework exports already file under: this is the same
  // shelf as `wardley.exportOwm`, `bpmn.exportXml` and `c4.exportMermaid`, and
  // a host catalogue groups them together.
  category: 'interchange',
  // Deliberately NOT `'senior-menu'`: those slots are for artefacts you DRAW,
  // and "Export SVG" answers no question asked of a row of shapes — the same
  // arbitration `bpmn.exportXml` is filed under (ADR 0014, R4).
  surfaces: ['catalogue', 'contextual-toolbar', 'palette', 'agent'],
  scope: 'edgeless',
  // Keyless by intent. Still bindable from Settings › Shortcuts, which is what
  // `toShortcutDescriptor` being total buys.
  defaultKeys: { mac: [], other: [] },
  // The serializable precondition a host catalogue can show; `when` narrows it
  // to "…and that selection contains a board", which no member of the closed
  // union can express.
  availability: 'selection:framework',
  when: std => selectedBoards(std).length > 0,
  run: std => exportBoardSvg(std),
};

export const exportSvgCommands: AnyCommandDescriptor[] = [exportSvg];
