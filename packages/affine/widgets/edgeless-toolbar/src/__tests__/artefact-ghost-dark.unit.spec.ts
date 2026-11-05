import {
  CanvasRenderer,
  ElementRendererIdentifier,
  type NotationDarkPalette,
  NotationDarkPaletteIdentifier,
} from '@labre/affine-block-surface';
import { ColorScheme } from '@labre/affine-model';
import { Bound } from '@labre/global/gfx';
import type { BlockStdScope } from '@labre/std';
import {
  type GfxController,
  GfxControllerIdentifier,
  GfxLocalVisibility,
  type GfxPrimitiveElementModel,
  type SurfaceBlockModel,
  type Viewport,
} from '@labre/std/gfx';
import { signal } from '@preact/signals-core';
import { Subject } from 'rxjs';
import { describe, expect, test } from 'vitest';

import { ArtefactGhostOverlay } from '../placement/artefact-ghost-overlay.js';

/**
 * The ghost an armed artefact leaves under the cursor is painted in the scheme
 * the placed artefact will be painted in: on a dark canvas, a notation's
 * stored light ink goes through the dark table (ADR 0039).
 *
 * What it would have caught (recette P7-15, « Éditeur sombre »): the overlay
 * called the element renderers itself, outside the canvas renderer's paint
 * loop — the only place the dark tint was set — so every framework that
 * registers a `NotationDarkPaletteExtension` (BPMN, C4, Cynefin, the three
 * DDD boards, EDGY, UML, Wardley) showed a light ghost on a dark canvas while
 * the element it placed turned dark.
 */

const INK = '#1f2328';
const DARK_INK = '#eaeaea';
const PAPER = '#fbf3db';
const DARK_PAPER = '#2b2b2b';

/** The recorded footprint: offsets around the cursor. */
const FOOTPRINT = new Bound(-50, -25, 100, 50);
const VIEWPORT = new Bound(0, 0, 1000, 1000);
const SCREEN = { width: 800, height: 600 };

type Stroke = { fillStyle: string; strokeStyle: string };

/**
 * A real `CanvasRenderer` on a stub surface, one framework palette, and a
 * painter that does what every element renderer does: read its stored colours
 * through the renderer it is handed.
 */
const harness = (scheme: ColorScheme) => {
  const palettes: NotationDarkPalette[] = [
    {
      framework: 'wardley',
      colors: { [INK]: DARK_INK, [PAPER]: DARK_PAPER },
    },
  ];

  const painter = (
    model: { strokeColor: string; fillColor: string },
    ctx: CanvasRenderingContext2D,
    _matrix: DOMMatrix,
    renderer: CanvasRenderer
  ) => {
    ctx.fillStyle = renderer.getColorValue(
      model.fillColor,
      PAPER,
      true,
      'fill'
    );
    ctx.strokeStyle = renderer.getColorValue(model.strokeColor, INK, true);
    ctx.fill();
  };

  const gfx = {
    tool: {
      dragging$: signal(false),
      lastMouseViewPos$: signal({ x: 0, y: 0 }),
    },
    localVisibility: new GfxLocalVisibility(),
    getElementById: () => null,
    viewport: {
      zoom: 1,
      viewportBounds: VIEWPORT,
      viewportUpdated: new Subject<void>(),
      toModelCoord: (x: number, y: number) => [x, y],
    },
  } as unknown as GfxController;

  const std = {
    get: (identifier: unknown) => {
      if (identifier === (GfxControllerIdentifier as unknown)) return gfx;
      throw new Error('unexpected service');
    },
    getOptional: (identifier: { identifierName?: string; variant?: string }) =>
      identifier?.identifierName ===
        (ElementRendererIdentifier as { identifierName: string })
          .identifierName && identifier.variant === 'shape'
        ? painter
        : undefined,
    provider: {
      getAll: (identifier: unknown) =>
        identifier === (NotationDarkPaletteIdentifier as unknown)
          ? new Map(palettes.map(p => [p.framework, p]))
          : new Map(),
    },
  } as unknown as BlockStdScope;
  (gfx as unknown as { std: BlockStdScope }).std = std;

  const renderer = new CanvasRenderer({
    std,
    viewport: {
      ...SCREEN,
      viewScale: 1,
      viewportUpdated: new Subject(),
      sizeUpdated: new Subject(),
      zooming$: new Subject<boolean>(),
    } as unknown as Viewport,
    layerManager: { layers: [], getCanvasLayers: () => [] } as never,
    gridManager: {} as never,
    surfaceModel: {
      elementModels: [],
      elementAdded: new Subject(),
      elementRemoved: new Subject(),
      elementUpdated: new Subject(),
      localElementAdded: new Subject(),
      localElementDeleted: new Subject(),
      localElementUpdated: new Subject(),
    } as unknown as SurfaceBlockModel,
    provider: {
      getColorScheme: () => scheme,
      getColorValue: (color, fallback) => {
        const value = color ?? fallback;
        return typeof value === 'string' ? value : 'transparent';
      },
    },
  });
  Object.assign(gfx, { surfaceComponent: { renderer } });

  /** A detached model as the placement tool builds it, `role` included. */
  const model = (role?: string) =>
    ({
      id: role ?? 'neutral',
      type: 'shape',
      role,
      strokeColor: INK,
      fillColor: PAPER,
      opacity: 1,
      deserializedXYWH: FOOTPRINT.toXYWH(),
      elementBound: FOOTPRINT,
    }) as unknown as GfxPrimitiveElementModel;

  /** What the ghost leaves on a context that records every stroke. */
  const paintGhost = (models: GfxPrimitiveElementModel[]) => {
    const strokes: Stroke[] = [];
    const ctx = {
      fillStyle: '',
      strokeStyle: '',
      globalAlpha: 1,
      save() {},
      restore() {},
      getTransform: () => new DOMMatrix(),
      fill() {
        strokes.push({
          fillStyle: this.fillStyle,
          strokeStyle: this.strokeStyle,
        });
      },
    };
    const ghost = new ArtefactGhostOverlay(gfx, FOOTPRINT, 'Component', models);
    ghost.render(ctx as unknown as CanvasRenderingContext2D, {} as never);
    return { strokes, ghost };
  };

  return { renderer, model, paintGhost };
};

describe('the armed ghost follows the dark notation palette', () => {
  test('a notation ghost on a dark canvas paints the dark table, not the stored light ink', () => {
    const { model, paintGhost } = harness(ColorScheme.Dark);

    const { strokes, ghost } = paintGhost([model('wardley:component')]);

    expect(ghost.drawsArtefact).toBe(true);
    expect(strokes).toEqual([{ fillStyle: DARK_PAPER, strokeStyle: DARK_INK }]);
  });

  test('a neutral ghost and a light canvas paint as stored, and the tint ends with the ghost', () => {
    const dark = harness(ColorScheme.Dark);
    expect(dark.paintGhost([dark.model()]).strokes).toEqual([
      { fillStyle: PAPER, strokeStyle: INK },
    ]);
    expect(dark.renderer.notationTint).toBeNull();

    const light = harness(ColorScheme.Light);
    expect(
      light.paintGhost([light.model('wardley:component')]).strokes
    ).toEqual([{ fillStyle: PAPER, strokeStyle: INK }]);
  });
});
