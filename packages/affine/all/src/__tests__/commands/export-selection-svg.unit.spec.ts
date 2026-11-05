import {
  exportSelectionSvgToolbarConfig,
  exportSvgToolbarConfig,
} from '@labre/affine-block-surface';
import {
  ShapeElementModel,
  WardleyBackgroundElementModel,
} from '@labre/affine-model';
import type { ToolbarContext } from '@labre/affine-shared/services';
import { describe, expect, test } from 'vitest';

import { getCommands } from '../../commands.js';

/**
 * "Export selection as SVG" (`selection.export.svg`), as the registry and the
 * "⋮" see it.
 *
 * Would have caught: `export.svg` widened to loose selections (its agent
 * contract is "export the selected board"); the selection entry shown beside
 * the board's own, two "Export … SVG" lines in one menu; the entry missing
 * from a selection with no board; and the command gaining a telemetry field
 * or the agent surface it deliberately declines.
 *
 * The export itself — the file, its markers, what is left out — is
 * `blocks/surface/…/export-selection-svg.unit.spec.ts` and the browser
 * suite's `canvas-svg-export.spec.ts`.
 */

const commands = getCommands();
const byId = (id: string) => commands.find(command => command.id === id);

/** A `ToolbarContext` reduced to the two questions the modules ask it. */
const stubContext = (models: readonly object[]) =>
  ({
    getSurfaceModels: () => models,
    getSurfaceModelsByType: (klass: abstract new (...args: never) => unknown) =>
      models.filter(model => model instanceof klass),
  }) as unknown as ToolbarContext;

const shape = () => Object.create(ShapeElementModel.prototype) as object;
const board = () =>
  Object.create(WardleyBackgroundElementModel.prototype) as object;

describe('the selection.export.svg descriptor', () => {
  const command = byId('selection.export.svg');

  test('is a core export on the selection, outside the agent surface', () => {
    expect(command).toBeTruthy();
    expect(command!.owner).toBe('core');
    expect(command!.kind).toBe('action');
    expect(command!.availability).toBe('selection');
    expect(command!.category).toBe('export');
    expect(command!.labelKey).toBe('com.labre.command.selection.export.svg');
    expect(command!.descriptionKey).toBe(
      'com.labre.command.selection.export.svg.description'
    );
    expect([...command!.surfaces].sort()).toEqual([
      'catalogue',
      'contextual-toolbar',
      'palette',
    ]);
    expect(command!.telemetry).toBeUndefined();
  });

  test('leaves export.svg as the board export it was', () => {
    expect(byId('export.svg')!.availability).toBe('selection:framework');
  });
});

describe('the "⋮" entries of a canvas selection', () => {
  test('a selection without a board gets the selection entry, not the board one', () => {
    const ctx = stubContext([shape(), shape()]);
    expect(exportSelectionSvgToolbarConfig.when(ctx)).toBe(true);
    expect(exportSvgToolbarConfig.when(ctx)).toBe(false);
  });

  test('a selection holding a board gets the board entry alone', () => {
    const ctx = stubContext([board(), shape()]);
    expect(exportSelectionSvgToolbarConfig.when(ctx)).toBe(false);
    expect(exportSvgToolbarConfig.when(ctx)).toBe(true);
  });

  test('no selection, no entry', () => {
    expect(exportSelectionSvgToolbarConfig.when(stubContext([]))).toBe(false);
  });
});
