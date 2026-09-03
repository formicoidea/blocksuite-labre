import { backgroundSize } from '@labre/affine-block-surface';
import { ContextMapBoardElementModel } from '@labre/affine-model';
import { describe, expect, it } from 'vitest';

import { CONTEXT_MAP_BACKGROUND } from '../background';
import { contextMapCommands } from '../commands';
import { CONTEXT_MAP_ROLE } from '../roles';

describe('the context map board declaration', () => {
  it('declares the element type the model persists', () => {
    expect(CONTEXT_MAP_BACKGROUND.type).toBe('contextMap');
    // Read off a real instance rather than restated: the two halves of a new
    // element type are the only place this repo has ever drifted.
    expect(ContextMapBoardElementModel.prototype.type).toBe('contextMap');
  });

  it('carries the board role, so rules have a frame to measure against', () => {
    expect(CONTEXT_MAP_BACKGROUND.role).toBe(CONTEXT_MAP_ROLE.board);
  });

  it('has no axes and no zones — a context map is a graph, not a chart', () => {
    expect(CONTEXT_MAP_BACKGROUND.axes).toBeUndefined();
    expect(CONTEXT_MAP_BACKGROUND.zones).toBeUndefined();
    expect(CONTEXT_MAP_BACKGROUND.variantProp).toBeUndefined();
  });

  it('is created 1400 × 900, freely resizable in both directions', () => {
    expect(backgroundSize(CONTEXT_MAP_BACKGROUND)).toEqual({
      width: 1400,
      height: 900,
    });
    expect(CONTEXT_MAP_BACKGROUND.geometry.lockAspectRatio).toBe(false);
    expect(CONTEXT_MAP_BACKGROUND.geometry.resizable).toBe(true);
    // A second board dropped on a busy canvas matches the biggest thing there
    // rather than shrinking beside it — and, unlocked, in one axis at a time.
    expect(backgroundSize(CONTEXT_MAP_BACKGROUND, 2000, 400)).toEqual({
      width: 2000,
      height: 900,
    });
  });

  it('resolves every palette reference it uses', () => {
    const palette = CONTEXT_MAP_BACKGROUND.chrome?.palette ?? {};
    const surface = CONTEXT_MAP_BACKGROUND.chrome?.surface;
    for (const colour of [surface?.fill, surface?.border?.color]) {
      expect(colour?.startsWith('@')).toBe(true);
      expect(palette[colour!.slice(1)]).toMatch(/^#[0-9a-f]{6}$/i);
    }
  });
});

describe('the palette entry that creates it', () => {
  it('adds exactly one command, first in the sub-menu', () => {
    expect(contextMapCommands).toHaveLength(12);
    expect(contextMapCommands[0].id).toBe('ddd-context-map.addBoard');
    expect(contextMapCommands[0].telemetry).toEqual({
      framework: 'ddd-context-map',
      element: 'board',
      board: true,
    });
  });

  it('renames none of the historical telemetry values', () => {
    // ADR 0008's no-analytics-breakage rule. `board` is the only new one.
    expect(
      contextMapCommands.map(command => command.telemetry?.element)
    ).toEqual([
      'board',
      'bounded-context',
      'cloud',
      'relationship:partnership',
      'relationship:sharedKernel',
      'relationship:customerSupplier',
      'relationship:conformist',
      'relationship:acl',
      'relationship:ohs',
      'relationship:publishedLanguage',
      'relationship:separateWays',
      'relationship:bbom',
      // `legend` is gone from this list because the palette entry is gone (PO
      // recette, 27/08/2026) — not because a value was renamed. The board's
      // contextual auto-legend emits `FrameworkLegendCreated`, unchanged.
    ]);
  });
});
