import { downloadBlob } from '@labre/affine-shared/utils';
import type {
  AnyCommandDescriptor,
  BlockStdScope,
  CommandFile,
  CommandFileParams,
} from '@labre/std';
import {
  GfxBlockElementModel,
  GfxControllerIdentifier,
  type GfxModel,
  GfxPrimitiveElementModel,
} from '@labre/std/gfx';

import { CANVAS_DRAWIO_EXPORT } from './capability.js';

/**
 * What the export takes: the selection when there is one, the whole canvas
 * otherwise — in the canvas's own z-order, and as this viewer SEES it (ADR
 * 0031: what they hid is neither painted nor exported, the PNG's rule).
 *
 * A selected group or frame brings what it holds: selecting a classifier
 * selects its group, and a group exported without its shape and its words
 * would be an empty box.
 */
export function canvasDrawioSource(std: BlockStdScope): GfxModel[] {
  const gfx = std.get(GfxControllerIdentifier);
  const selection = gfx.selection.editing ? [] : gfx.selection.selectedElements;

  let models: GfxModel[];
  if (selection.length === 0) {
    models = gfx.gfxElements;
  } else {
    const picked = new Set<GfxModel>();
    for (const model of selection) {
      picked.add(model);
      const descendants = (model as { descendantElements?: unknown })
        .descendantElements;
      if (Array.isArray(descendants)) {
        for (const descendant of descendants as GfxModel[]) {
          picked.add(descendant);
        }
      }
    }
    models = [...picked];
  }
  return models
    .filter(model => !gfx.localVisibility.isHidden(model))
    .sort((a, b) => gfx.layer.compare(a, b));
}

/**
 * The canvas (or its selection) as a draw.io file, or `null` when there is
 * nothing on it. Through the declared capability, never round it.
 */
export function canvasDrawioFile(std: BlockStdScope): CommandFile | null {
  const models = canvasDrawioSource(std);
  if (models.length === 0) return null;
  const { text, filename, mime } = CANVAS_DRAWIO_EXPORT.run(
    models.filter(
      (model): model is GfxPrimitiveElementModel =>
        model instanceof GfxPrimitiveElementModel
    ),
    {
      name: std.store.workspace.meta.getDocMeta(std.store.id)?.title,
      blocks: models.filter(
        (model): model is GfxBlockElementModel =>
          model instanceof GfxBlockElementModel
      ),
    }
  );
  return { blob: new Blob([text], { type: mime }), filename };
}

/**
 * "Export as draw.io", the third export of the canvas's "This view" section
 * (ADR 0034, amendment of 2026-10-13), on the model of `canvas.export.png`:
 * given `params.deliver` it hands the file over and downloads nothing
 * (`runViewAction`), without it (the palette) it downloads the file itself.
 *
 * `owner: 'core'` and never gated, for the PNG's reason: a picture of what is
 * on the canvas is not a framework's tooling. Not `'agent'`: an agent turn
 * would drop a file the user did not ask for. It READS, so no read-only guard.
 * Nothing to export, no file and no error.
 */
const exportDrawio: AnyCommandDescriptor = {
  id: 'canvas.export.drawio',
  owner: 'core',
  kind: 'action',
  labelKey: 'com.labre.command.canvas.export.drawio',
  labelFallback: 'Export as draw.io',
  descriptionKey: 'com.labre.command.canvas.export.drawio.description',
  descriptionFallback:
    'Download the selection, or the whole canvas, as a draw.io drawing: shapes, lines and words, best effort, no round trip.',
  category: 'export',
  iconKey: 'canvas.export.drawio',
  keywords: ['drawio', 'draw.io', 'diagrams.net', 'mxgraph', 'export'],
  surfaces: ['view-menu', 'palette'],
  order: 12,
  scope: 'edgeless',
  defaultKeys: { mac: [], other: [] },
  run: (std, _invocation, params) => {
    const file = canvasDrawioFile(std);
    if (!file) return;
    const deliver = (params as CommandFileParams | undefined)?.deliver;
    if (typeof deliver === 'function') deliver(file);
    else downloadBlob(file.blob, file.filename);
  },
};

export const canvasDrawioExportCommands: AnyCommandDescriptor[] = [
  exportDrawio,
];
