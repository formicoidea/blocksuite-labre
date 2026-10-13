import { downloadBlob } from '@labre/affine-shared/utils';
import type {
  AnyCommandDescriptor,
  BlockStdScope,
  CommandFile,
  CommandFileParams,
} from '@labre/std';

import { ExportManager } from './export-manager.js';

/**
 * "Export as PNG" and "Export as PDF" of the canvas, in the command registry
 * (ADR 0034, amendment of 2026-10-13). `owner: 'core'`: the picture is the
 * canvas's, whatever drew on it.
 *
 * On the `'view-menu'` surface because the export is proper to the canvas
 * VIEW (the host's "This view" section reads them through `getViewActions`),
 * and on the palette. Not `'agent'`: an agent turn would drop a file on the
 * user's disk they did not ask for.
 *
 * The library renders and the host decides where the bytes go: given
 * `params.deliver` (`CommandFileParams`), the command hands the file over and
 * downloads nothing — `runViewAction` passes one and returns the file. Without
 * it (the palette, a bound chord) the command downloads the file itself, which
 * is what a standalone editor needs. Nothing to draw, no file, no error.
 *
 * It READS, so there is no read-only guard: a reader exports what they see.
 * No `telemetry` field, for `export.svg`'s reason — it names no framework —
 * and usage is still measured by `runCommand`.
 */

function deliverOf(params: unknown): CommandFileParams['deliver'] {
  const deliver = (params as CommandFileParams | undefined)?.deliver;
  return typeof deliver === 'function' ? deliver : undefined;
}

async function exportCanvas(
  std: BlockStdScope,
  render: (exporter: ExportManager) => Promise<CommandFile | null>,
  params: unknown
): Promise<void> {
  const exporter = std.getOptional(ExportManager);
  if (!exporter) return;
  const file = await render(exporter);
  if (!file) return;
  const deliver = deliverOf(params);
  if (deliver) deliver(file);
  else downloadBlob(file.blob, file.filename);
}

const exportPng: AnyCommandDescriptor = {
  id: 'canvas.export.png',
  owner: 'core',
  kind: 'action',
  labelKey: 'com.labre.command.canvas.export.png',
  labelFallback: 'Export as PNG',
  descriptionKey: 'com.labre.command.canvas.export.png.description',
  descriptionFallback:
    'Download the whole canvas as an image, as you see it on your screen.',
  category: 'export',
  iconKey: 'canvas.export.png',
  keywords: ['png', 'image', 'export', 'download', 'picture'],
  surfaces: ['view-menu', 'palette'],
  order: 10,
  scope: 'edgeless',
  defaultKeys: { mac: [], other: [] },
  when: std => !!std.getOptional(ExportManager),
  run: (std, _invocation, params) =>
    exportCanvas(std, exporter => exporter.pngFile(), params),
};

const exportPdf: AnyCommandDescriptor = {
  id: 'canvas.export.pdf',
  owner: 'core',
  kind: 'action',
  labelKey: 'com.labre.command.canvas.export.pdf',
  labelFallback: 'Export as PDF',
  descriptionKey: 'com.labre.command.canvas.export.pdf.description',
  descriptionFallback:
    'Download the whole canvas as a one-page PDF holding its image.',
  category: 'export',
  iconKey: 'canvas.export.pdf',
  keywords: ['pdf', 'export', 'download', 'print'],
  surfaces: ['view-menu', 'palette'],
  order: 11,
  scope: 'edgeless',
  defaultKeys: { mac: [], other: [] },
  when: std => !!std.getOptional(ExportManager),
  run: (std, _invocation, params) =>
    exportCanvas(std, exporter => exporter.pdfFile(), params),
};

export const canvasExportCommands: AnyCommandDescriptor[] = [
  exportPng,
  exportPdf,
];
