import { TelemetryProvider } from '@labre/affine-shared/services';
import type { BlockStdScope } from '@labre/std';
import { describe, expect, it, vi } from 'vitest';

import {
  legendIcon,
  legendToolbarAction,
  type LegendToolbarActionOptions,
} from '../extensions/legend-toolbar';

/**
 * The shared legend button against the SEVEN payloads the seven hand-written
 * buttons were sending on the day they were replaced.
 *
 * These are wire values — a PostHog funnel reads them — so they are restated
 * here as literals, copied from the configs, rather than derived from the
 * factory's own arguments. A test that computed the expectation the same way
 * the code does would agree with any rename.
 */

/** A board element model, as far as this button is concerned. */
class FakeBoard {
  xywh = '[0,0,100,100]';
}

function stub(models: unknown[] = [new FakeBoard()]) {
  const track = vi.fn();
  const std = {
    // The engine is `createBoardLegend`'s business and has its own spec; here
    // nothing is drawn, so the surface is absent and it returns early.
    get: () => ({ surface: null }),
    getOptional: (identifier: unknown) =>
      identifier === (TelemetryProvider as unknown) ? { track } : undefined,
    store: { readonly: false },
  } as unknown as BlockStdScope;
  const ctx = {
    std,
    getSurfaceModelsByType: () => models,
  } as never;
  return { ctx, track, std };
}

/**
 * What each framework's own `?.track('FrameworkLegendCreated', …)` call sent,
 * copied from the config it was written in.
 */
const HISTORICAL: {
  what: string;
  options: Omit<LegendToolbarActionOptions<FakeBoard>, 'Model'>;
  id: string;
  payload: Record<string, string>;
}[] = [
  {
    // `gfx/c4/src/toolbar/config.ts`, `c4LegendToolbarConfig`.
    what: 'c4',
    options: { owner: 'c4', framework: 'c4' },
    id: 'b.legend',
    payload: {
      framework: 'c4',
      element: 'legend',
      page: 'whiteboard editor',
      segment: 'element toolbar',
      module: 'c4 toolbar',
    },
  },
  {
    // `gfx/edgy/src/toolbar/config.ts`, `legendAction`.
    what: 'edgy',
    options: { owner: 'edgy', framework: 'edgy' },
    id: 'b.legend',
    payload: {
      framework: 'edgy',
      element: 'legend',
      page: 'whiteboard editor',
      segment: 'element toolbar',
      module: 'edgy toolbar',
    },
  },
  {
    // `gfx/ddd-context-map/src/toolbar/board-config.ts`, action `b.legend`.
    what: 'context map',
    options: { owner: 'ddd-context-map', framework: 'context-map' },
    id: 'b.legend',
    payload: {
      framework: 'context-map',
      element: 'legend',
      page: 'whiteboard editor',
      segment: 'element toolbar',
      module: 'context-map toolbar',
    },
  },
  {
    // `gfx/ddd-core-domain/src/core-domain/toolbar-config.ts`, action `a.legend`.
    what: 'core domain',
    options: {
      id: 'a.legend',
      owner: 'ddd-core-domain',
      framework: 'core-domain',
    },
    id: 'a.legend',
    payload: {
      framework: 'core-domain',
      element: 'legend',
      page: 'whiteboard editor',
      segment: 'element toolbar',
      module: 'core-domain toolbar',
    },
  },
  {
    // `gfx/ddd-event-storming/src/toolbar/board-config.ts`, action `b.legend`.
    what: 'event storming',
    options: { owner: 'ddd-event-storming', framework: 'event-storming' },
    id: 'b.legend',
    payload: {
      framework: 'event-storming',
      element: 'legend',
      page: 'whiteboard editor',
      segment: 'element toolbar',
      module: 'event-storming toolbar',
    },
  },
  {
    // `gfx/wardley/src/toolbar/config.ts`, action `d.legend`.
    what: 'wardley',
    options: { id: 'd.legend', owner: 'wardley', framework: 'wardley' },
    id: 'd.legend',
    payload: {
      framework: 'wardley',
      element: 'legend',
      page: 'whiteboard editor',
      segment: 'element toolbar',
      module: 'wardley toolbar',
    },
  },
  {
    // `gfx/uml/src/toolbar/config.ts`, `umlLegendToolbarConfig`. The ONE
    // framework whose module is not `<framework> toolbar`: it says `toolbox`,
    // which is why the factory takes an override instead of always deriving.
    what: 'uml',
    options: { owner: 'uml', framework: 'uml', module: 'uml toolbox' },
    id: 'b.legend',
    payload: {
      framework: 'uml',
      element: 'legend',
      page: 'whiteboard editor',
      segment: 'element toolbar',
      module: 'uml toolbox',
    },
  },
];

describe('the shared legend button', () => {
  for (const { what, options, id, payload } of HISTORICAL) {
    it(`emits ${what}'s historical payload, unchanged`, () => {
      const { ctx, track } = stub();
      const action = legendToolbarAction({ ...options, Model: FakeBoard });

      expect(action.id).toBe(id);
      action.run?.(ctx);

      expect(track).toHaveBeenCalledTimes(1);
      expect(track).toHaveBeenCalledWith('FrameworkLegendCreated', payload);
    });
  }

  it('shows itself only when the board it documents is selected', () => {
    const action = legendToolbarAction({
      owner: 'c4',
      framework: 'c4',
      Model: FakeBoard,
    });
    const when = action.when as (ctx: never) => boolean;
    expect(when(stub([]).ctx)).toBe(false);
    expect(when(stub().ctx)).toBe(true);
  });

  it('says nothing at all on a read-only document', () => {
    const { ctx, track, std } = stub();
    (std.store as { readonly: boolean }).readonly = true;
    legendToolbarAction({
      owner: 'c4',
      framework: 'c4',
      Model: FakeBoard,
    }).run?.(ctx);
    expect(track).not.toHaveBeenCalled();
  });

  it('draws the one glyph, and lets a framework substitute its own', () => {
    const shared = legendToolbarAction({
      owner: 'c4',
      framework: 'c4',
      Model: FakeBoard,
    });
    expect(shared.icon).toBe(legendIcon);

    const own = legendToolbarAction({
      owner: 'wardley',
      framework: 'wardley',
      Model: FakeBoard,
      icon: legendIcon,
      tooltipWording: ['com.labre.board.toolbar.legend.components', 'Legend'],
    });
    expect(own.tooltipWording?.[0]).toBe(
      'com.labre.board.toolbar.legend.components'
    );
  });
});
