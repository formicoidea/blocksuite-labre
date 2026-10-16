import { type Color, ColorScheme } from '@labre/affine-model';
import { Bound } from '@labre/global/gfx';
import type { BlockStdScope } from '@labre/std';
import {
  GfxLocalVisibility,
  type SurfaceBlockModel,
  type Viewport,
} from '@labre/std/gfx';
import { signal } from '@preact/signals-core';
import { Subject } from 'rxjs';
import { describe, expect, it } from 'vitest';

import { CanvasRenderer } from '../renderer/canvas-renderer.js';
import {
  type NotationDarkPalette,
  NotationDarkPaletteIdentifier,
} from '../renderer/notation-tint.js';
import type { RoughCanvas } from '../utils/rough/canvas.js';

/**
 * The dark notation palette is resolved AT RENDER TIME, by the canvas
 * renderer, for notation elements only (ADR 0039).
 *
 * What it would catch: a dark tint leaking onto a neutral shape (a user's own
 * black stays black on a dark canvas), a `{ light, dark }` pair tinted on top
 * of its own dark side, the tint outliving the paint that set it, and the SVG
 * export's light override not reaching the stored colours.
 */

const INK = '#1f2328';
const DARK_INK = '#eaeaea';

type Painted = { id: string; color: string; scheme: ColorScheme };

function setup(scheme: ColorScheme) {
  const painted: Painted[] = [];
  const palettes: NotationDarkPalette[] = [
    { framework: 'wardley', colors: { '#666666': '#909090' } },
    { framework: 'c4', colors: { '#000000': DARK_INK } },
  ];

  const renderer = new CanvasRenderer({
    std: {
      get: () => ({
        tool: { dragging$: signal(false) },
        localVisibility: new GfxLocalVisibility(),
        getElementById: () => null,
      }),
      getOptional: () =>
        ((
          element: { id: string; color: Color },
          _ctx: unknown,
          _m: unknown,
          r: unknown
        ) => {
          const self = r as CanvasRenderer;
          painted.push({
            id: element.id,
            color: self.getColorValue(element.color, '#000000', true),
            scheme: self.getColorScheme(),
          });
        }) as never,
      provider: {
        getAll: (id: unknown) =>
          id === NotationDarkPaletteIdentifier
            ? new Map(palettes.map(p => [p.framework, p]))
            : new Map(),
      },
    } as unknown as BlockStdScope,
    viewport: {
      width: 800,
      height: 600,
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
      getColorValue: (color, fallback, _real, theme) => {
        const value = color ?? fallback;
        if (typeof value === 'string') return value;
        const side = theme ?? scheme;
        return 'normal' in value!
          ? value.normal
          : side === ColorScheme.Dark
            ? value.dark
            : value.light;
      },
    },
  });

  const element = (
    id: string,
    color: Color,
    role?: string,
    paper?: { filled: boolean; fillColor: string }
  ) => ({
    id,
    color,
    role,
    ...paper,
    type: 'shape',
    x: 0,
    y: 0,
    w: 10,
    h: 10,
    rotate: 0,
    opacity: 1,
    elementBound: new Bound(0, 0, 10, 10),
  });

  const paint = (elements: ReturnType<typeof element>[]) => {
    const ctx = new OffscreenCanvas(20, 20).getContext(
      '2d'
    ) as unknown as CanvasRenderingContext2D;
    renderer.renderBoundTo(
      ctx,
      {} as RoughCanvas,
      new Bound(0, 0, 20, 20),
      elements as never
    );
  };

  return { renderer, painted, paint, element };
}

describe('dark notation tint in the canvas renderer', () => {
  it('tints a notation element, never a neutral one', () => {
    const { painted, paint, element } = setup(ColorScheme.Dark);
    paint([
      element('notation', INK, 'wardley:component'),
      element('framework-grey', '#666666', 'wardley:link'),
      element('neutral', INK),
    ]);
    expect(painted.map(p => [p.id, p.color])).toEqual([
      ['notation', DARK_INK],
      ['framework-grey', '#909090'],
      ['neutral', INK],
    ]);
  });

  it('words of their own follow the fill they sit on', () => {
    const { painted, paint, element } = setup(ColorScheme.Dark);
    paint([
      element('c4-component', INK, 'c4:component', {
        filled: true,
        fillColor: '#85bbf0',
      }),
      element('title', '#000000', 'c4:title'),
    ]);
    paint([
      element('white-card', INK, 'uml:class', {
        filled: true,
        fillColor: '#ffffff',
      }),
      element('name', '#000000', 'uml:name'),
    ]);
    expect(painted.map(p => [p.id, p.color])).toEqual([
      ['c4-component', DARK_INK],
      ['title', '#000000'],
      ['white-card', DARK_INK],
      ['name', DARK_INK],
    ]);
  });

  it('never tints a { light, dark } pair', () => {
    const { painted, paint, element } = setup(ColorScheme.Dark);
    paint([element('pair', { light: INK, dark: '#ff0000' }, 'wardley:x')]);
    expect(painted[0]?.color).toBe('#ff0000');
  });

  it('paints as stored in the light scheme', () => {
    const { painted, paint, element } = setup(ColorScheme.Light);
    paint([element('notation', INK, 'wardley:component')]);
    expect(painted[0]?.color).toBe(INK);
  });

  it('drops the tint once the paint is over', () => {
    const { renderer, paint, element } = setup(ColorScheme.Dark);
    paint([element('notation', INK, 'wardley:component')]);
    expect(renderer.notationTint).toBeNull();
    expect(renderer.getColorValue(INK)).toBe(INK);
  });

  it('withColorScheme paints light on a dark canvas, then restores it', () => {
    const { renderer, painted, paint, element } = setup(ColorScheme.Dark);
    renderer.withColorScheme(ColorScheme.Light, () =>
      paint([element('pair', { light: INK, dark: '#ff0000' }, 'wardley:x')])
    );
    expect(painted[0]).toEqual({
      id: 'pair',
      color: INK,
      scheme: ColorScheme.Light,
    });
    expect(renderer.getColorScheme()).toBe(ColorScheme.Dark);
  });
});
