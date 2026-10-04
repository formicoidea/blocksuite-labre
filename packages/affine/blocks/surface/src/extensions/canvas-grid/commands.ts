import { CanvasGrid, TelemetryProvider } from '@labre/affine-shared/services';
import type { AnyCommandDescriptor, BlockStdScope } from '@labre/std';

/**
 * The canvas grid's two commands (ADR 0031 §11, §12), `owner: 'core'`, on the
 * palette and the agent. The library has no page "more" menu — that belongs
 * to the host — so these are the grid's whole UI here; a host puts them in
 * its own menu through `runCommand`.
 *
 * Both self-emit `CanvasGridToggled` (see the telemetry README): `scope` is
 * which gesture ran, and a save that changes nothing reports nothing.
 */

function reportGrid(
  std: BlockStdScope,
  scope: 'local' | 'everyone',
  visible: boolean
) {
  std.getOptional(TelemetryProvider)?.track('CanvasGridToggled', {
    page: 'whiteboard editor',
    scope,
    visible,
  });
}

/**
 * Show or hide the grid for THIS viewer, on this document. Writes nothing to
 * the document, so a reader may do it too.
 */
const toggleGrid: AnyCommandDescriptor = {
  id: 'canvas.grid.toggle',
  owner: 'core',
  kind: 'action',
  labelKey: 'com.labre.command.canvas.grid.toggle',
  labelFallback: 'Show or hide the grid',
  descriptionKey: 'com.labre.command.canvas.grid.toggle.description',
  descriptionFallback:
    'Show or hide the canvas grid on your screen only. Nothing changes for anyone else.',
  keywords: ['grid', 'dots', 'background'],
  surfaces: ['palette', 'agent'],
  scope: 'edgeless',
  defaultKeys: { mac: [], other: [] },
  when: std => !!std.getOptional(CanvasGrid),
  run: std => {
    const grid = std.getOptional(CanvasGrid);
    if (!grid) return;
    reportGrid(std, 'local', grid.toggle());
  },
};

/**
 * Store the grid as this viewer sees it on the document, for everyone, and
 * drop this viewer's own override. Read-only refuses (`availability`, and
 * again in `CanvasGrid.saveForEveryone`).
 */
const saveGridForEveryone: AnyCommandDescriptor = {
  id: 'canvas.grid.saveForEveryone',
  owner: 'core',
  kind: 'action',
  labelKey: 'com.labre.command.canvas.grid.save-for-everyone',
  labelFallback: 'Save the grid for everyone',
  descriptionKey: 'com.labre.command.canvas.grid.save-for-everyone.description',
  descriptionFallback:
    'Make the grid as you see it now the setting of this document, for everyone who opens it.',
  keywords: ['grid', 'dots', 'background', 'document'],
  surfaces: ['palette', 'agent'],
  scope: 'edgeless',
  defaultKeys: { mac: [], other: [] },
  availability: 'editable',
  when: std => !!std.getOptional(CanvasGrid),
  run: std => {
    const saved = std.getOptional(CanvasGrid)?.saveForEveryone() ?? null;
    if (saved === null) return;
    reportGrid(std, 'everyone', saved);
  },
};

export const canvasGridCommands: AnyCommandDescriptor[] = [
  toggleGrid,
  saveGridForEveryone,
];
