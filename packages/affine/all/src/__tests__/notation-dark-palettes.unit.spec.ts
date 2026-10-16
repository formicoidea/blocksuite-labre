import type { SurfaceBlockModel } from '@labre/affine-block-surface';
import {
  type ElementRenderer,
  ElementRendererIdentifier,
  NotationDarkPaletteIdentifier,
  NotationTint,
} from '@labre/affine-block-surface';
import { FrameworkPaletteIdentifier } from '@labre/affine-components/color-picker';
import {
  StoreExtensionManager,
  ViewExtensionManager,
} from '@labre/affine-ext-loader';
import {
  NOTATION_NEUTRALS,
  NOTATION_NEUTRALS_DARK,
  type NotationNeutral,
} from '@labre/affine-shared/consts';
import { Container } from '@labre/global/di';
import { Text } from '@labre/store';
import { TestWorkspace } from '@labre/store/test';
import { describe, expect, test, vi } from 'vitest';

import { getInternalStoreExtensions } from '../extensions/store.js';
import { getInternalViewExtensions } from '../extensions/view.js';
import { type BlockFlags, OPTIONAL_BLOCKS } from '../flags.js';
import { FRAMEWORK_DESCRIPTORS } from '../frameworks.js';

/**
 * GUARD — the dark variant of the notations (ADR 0039) holds for EVERY
 * framework, and holds by being resolved at render time.
 *
 * ## What it would catch
 *
 * - A framework that paints a near-black stencil, axis or label straight on
 *   the card and has no dark entry: on the dark canvas the ink vanishes and
 *   nothing fails, because nothing is stored differently. The render test
 *   below paints every board in light and in dark and compares each stroke and
 *   each word with the contrast it had on white.
 * - A dark palette registered from the FLAG-GATED extension: a map drawn while
 *   the flag was on would paint unreadable when it goes off. The palettes are
 *   read here with every flag off (ADR 0009).
 * - A hue of a standard quietly remapped: EDGY's facets and the C4 ladder stay
 *   as stored; a framework swatch that is dark on the dark card must be mapped
 *   or listed in `kept`, a decision in writing.
 * - Two frameworks mapping one light value to two dark values: the table is a
 *   union, first wins, so the second would be silently ignored.
 */

const ALL_OFF = Object.fromEntries(
  OPTIONAL_BLOCKS.map(block => [block, false])
) as BlockFlags;

const LIGHT_CARD = NOTATION_NEUTRALS.cardFill;
const DARK_CARD = NOTATION_NEUTRALS_DARK.cardFill;

/**
 * The host's dark selection accent (labre ADR-0049 § 7). The library does not
 * own it; it owns the bands it is drawn over, and those must leave it 3:1.
 */
const DARK_ACCENT = '#2a5bc8';

function luminance(hex: string) {
  const [r, g, b] = [1, 3, 5].map(i => {
    const c = Number.parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r! + 0.7152 * g! + 0.0722 * b!;
}

function contrast(a: string, b: string) {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi! + 0.05) / (lo! + 0.05);
}

const isHex = (value: unknown): value is string =>
  typeof value === 'string' && /^#[0-9a-f]{6}$/i.test(value);

function mount(scope: 'page' | 'edgeless', flags: BlockFlags) {
  const manager = new ViewExtensionManager(getInternalViewExtensions(flags));
  const container = new Container();
  manager.get(scope).forEach(ext => ext.setup(container));
  return container.provider();
}

function darkPalettes(flags: BlockFlags = ALL_OFF) {
  return [
    ...mount('edgeless', flags).getAll(NotationDarkPaletteIdentifier).values(),
  ];
}

describe('every framework registers its dark palette, always on', () => {
  test.each(['edgeless', 'page'] as const)(
    'with every flag off, in %s',
    scope => {
      const ids = [
        ...mount(scope, ALL_OFF).getAll(NotationDarkPaletteIdentifier).values(),
      ]
        .map(palette => palette.framework)
        .sort();
      expect(ids).toEqual(FRAMEWORK_DESCRIPTORS.map(d => d.id).sort());
    }
  );

  test('no light value is mapped twice, by two frameworks or over a neutral', () => {
    const seen = new Map<string, string>(
      Object.values(NOTATION_NEUTRALS).map(v => [v.toLowerCase(), 'neutrals'])
    );
    const clashes: string[] = [];
    for (const palette of darkPalettes()) {
      for (const light of Object.keys(palette.colors)) {
        const key = light.toLowerCase();
        const owner = seen.get(key);
        if (owner) clashes.push(`${key}: ${owner} and ${palette.framework}`);
        seen.set(key, palette.framework);
      }
    }
    expect(clashes).toEqual([]);
  });

  test('a framework swatch that is dark on the dark card is mapped or kept', () => {
    const tint = new NotationTint(darkPalettes());
    const kept = new Set(
      darkPalettes().flatMap(p => (p.kept ?? []).map(k => k.toLowerCase()))
    );
    const undecided: string[] = [];
    for (const palette of mount('edgeless', {})
      .getAll(FrameworkPaletteIdentifier)
      .values()) {
      for (const swatch of palette.palettes) {
        const value = swatch.value;
        if (!isHex(value)) continue;
        if (contrast(value, DARK_CARD) >= 3) continue;
        if (
          tint.resolve(value) !== value ||
          tint.resolve(value, 'fill') !== value
        )
          continue;
        if (kept.has(value.toLowerCase())) continue;
        undecided.push(`${palette.framework} ${swatch.key} ${value}`);
      }
    }
    expect(undecided).toEqual([]);
  });

  test('EDGY keeps its standard colours: no facet hue is remapped', () => {
    const tint = new NotationTint(darkPalettes());
    const neutrals = new Set(
      Object.values(NOTATION_NEUTRALS).map(v => v.toLowerCase())
    );
    const edgy = [
      ...mount('edgeless', {}).getAll(FrameworkPaletteIdentifier).values(),
    ].find(p => p.framework === 'edgy');
    const hues = (edgy?.palettes ?? [])
      .map(p => p.value)
      .filter(isHex)
      .filter(v => !neutrals.has(v.toLowerCase()));
    expect(hues.length).toBeGreaterThan(0);
    expect(hues.filter(v => tint.resolve(v, 'fill') !== v)).toEqual([]);
  });
});

describe('the dark values keep their contrast', () => {
  test.each(Object.keys(NOTATION_NEUTRALS) as NotationNeutral[])(
    'the %s neutral reads on the dark card at least as well as on white (capped at 7:1)',
    key => {
      if (key === 'cardFill') return;
      expect(
        contrast(NOTATION_NEUTRALS_DARK[key], DARK_CARD)
      ).toBeGreaterThanOrEqual(
        Math.min(7, contrast(NOTATION_NEUTRALS[key], LIGHT_CARD))
      );
    }
  );

  test('the words of the neutral scale are AA on the dark card', () => {
    for (const key of ['ink', 'frameInk', 'label'] as const) {
      expect(contrast(NOTATION_NEUTRALS_DARK[key], DARK_CARD)).toBeGreaterThan(
        4.5
      );
    }
  });

  test('the dark accent keeps 3:1 on the card and on every darker wash', () => {
    expect(contrast(DARK_ACCENT, DARK_CARD)).toBeGreaterThanOrEqual(3);
    const washes = darkPalettes()
      .flatMap(p => Object.values(p.colors))
      .filter(v => luminance(v) < luminance(DARK_CARD));
    expect(washes.length).toBeGreaterThan(0);
    for (const wash of washes) {
      expect([wash, contrast(DARK_ACCENT, wash) >= 3]).toEqual([wash, true]);
    }
  });

  test('a lightened ink keeps at least 3:1, or what it had on white', () => {
    for (const palette of darkPalettes()) {
      for (const [light, dark] of Object.entries(palette.colors)) {
        if (luminance(dark) < luminance(DARK_CARD)) continue;
        const floor = Math.min(3, contrast(light, LIGHT_CARD));
        expect([light, contrast(dark, DARK_CARD) >= floor]).toEqual([
          light,
          true,
        ]);
      }
    }
  });
});

describe('NotationTint', () => {
  const tint = new NotationTint([
    { framework: 'wardley', colors: { '#AbCdEf': '#123456' } },
    { framework: 'c4', colors: { '#abcdef': '#ffffff' } },
  ]);

  test('maps a neutral ink and keeps a hue', () => {
    expect(tint.resolve(NOTATION_NEUTRALS.ink)).toBe(
      NOTATION_NEUTRALS_DARK.ink
    );
    expect(tint.resolve('#2a9d99')).toBe('#2a9d99');
  });

  test('inverts white as a surface only', () => {
    expect(tint.resolve('#ffffff', 'fill')).toBe(DARK_CARD);
    expect(tint.resolve('#FFF', 'fill')).toBe(DARK_CARD);
    expect(tint.resolve('#ffffff')).toBe('#ffffff');
  });

  test('keeps the alpha, ignores case, first palette wins', () => {
    expect(tint.resolve('#abcdef80')).toBe('#12345680');
  });

  test('leaves anything that is not a hex literal alone', () => {
    for (const value of ['transparent', 'rgba(0,0,0,0.5)', '--affine-x', ''])
      expect(tint.resolve(value)).toBe(value);
  });

  test('ink follows its paper', () => {
    expect(tint.keepsInkOn('#438dd5')).toBe(true);
    expect(tint.keepsInkOn('#ffffff')).toBe(false);
    expect(tint.keepsInkOn('#438dd540')).toBe(false);
    expect(tint.keepsInkOn('transparent')).toBe(false);
  });
});

/**
 * Every framework's board, as the toolbox writes it: a type and a frame.
 * `edgy` (the facets) is the standard's own drawing, white centre and white
 * pictograms included, and keeps it on a dark canvas like its hues.
 */
const STANDARD_DRAWINGS = new Set(['edgy']);

const BOARDS = [
  'wardley',
  'edgyBoard',
  'edgy',
  'cynefin',
  'estuarine',
  'bpmnPool',
  'c4Board',
  'c4Boundary',
  'eventStorming',
  'coreDomain',
  'contextMap',
  'umlDiagram',
];

function surface() {
  const manager = new StoreExtensionManager(getInternalStoreExtensions({}));
  const collection = new TestWorkspace({ id: 'notation-dark' });
  collection.storeExtensions = manager.get('store');
  collection.meta.initialize();
  const store = collection.createDoc('doc:dark').getStore({ id: 'doc:dark' });
  let surfaceId = '';
  store.load(() => {
    const rootId = store.addBlock('affine:page', { title: new Text('Dark') });
    surfaceId = store.addBlock('affine:surface', {}, rootId);
  });
  return store.getBlock(surfaceId)?.model as SurfaceBlockModel;
}

type Paint = { kind: 'stroke' | 'text' | 'fill'; color: string };

/** Paints one element and records every hex colour it used, in order. */
function paint(type: string, tint: NotationTint | null) {
  const model = surface();
  const id = model.addElement({ type, xywh: '[0,0,1200,800]' });
  const element = model.getElementById(id);
  const render = mount('edgeless', {}).getOptional(
    ElementRendererIdentifier(type)
  ) as ElementRenderer | null;
  expect([type, !!render]).toEqual([type, true]);

  const paints: Paint[] = [];
  const ctx: Record<string, unknown> = {
    fillStyle: '',
    strokeStyle: '',
    measureText: (text: string) => ({ width: text.length * 7 }),
    createLinearGradient: () => ({ addColorStop: vi.fn() }),
    createRadialGradient: () => ({ addColorStop: vi.fn() }),
    getLineDash: () => [],
    getTransform: () => new DOMMatrix(),
  };
  const record = (kind: Paint['kind'], key: 'fillStyle' | 'strokeStyle') => {
    const color = ctx[key];
    if (isHex(color)) paints.push({ kind, color: color.toLowerCase() });
  };
  const proxy = new Proxy(ctx, {
    get(target, prop: string) {
      if (prop in target) return target[prop];
      if (prop === 'stroke' || prop === 'strokeRect' || prop === 'strokeText')
        return () => record('stroke', 'strokeStyle');
      if (prop === 'fillText') return () => record('text', 'fillStyle');
      if (prop === 'fill' || prop === 'fillRect')
        return () => record('fill', 'fillStyle');
      return () => {};
    },
    set(target, prop: string, value) {
      target[prop] = value;
      return true;
    },
  });
  const renderer = {
    std: { getOptional: () => null },
    notationTint: tint,
  };
  (render as unknown as (...args: unknown[]) => void)(
    element,
    proxy,
    new DOMMatrix(),
    renderer
  );
  return paints;
}

describe('every board paints readable in dark, as stored', () => {
  // happy-dom has no Path2D; the painters only construct one and hand it back.
  globalThis.Path2D ??= class {
    addPath() {}
  } as unknown as typeof Path2D;

  test.each(BOARDS)('%s', type => {
    const tint = new NotationTint(darkPalettes());
    const kept = new Set(darkPalettes().flatMap(p => p.kept ?? []));
    const light = paint(type, null);
    const dark = paint(type, tint);
    expect(light.length).toBeGreaterThan(0);
    expect(dark.map(p => p.kind)).toEqual(light.map(p => p.kind));

    const faded: string[] = [];
    light.forEach((before, i) => {
      const after = dark[i]!;
      if (before.kind === 'fill') {
        // The paper inverts: no white card on a dark canvas.
        if (
          before.color === LIGHT_CARD &&
          after.color === LIGHT_CARD &&
          !STANDARD_DRAWINGS.has(type)
        )
          faded.push(`${i} card still white`);
        return;
      }
      if (kept.has(before.color)) return;
      const floor = Math.min(3, contrast(before.color, LIGHT_CARD));
      if (contrast(after.color, DARK_CARD) < floor)
        faded.push(`${i} ${before.kind} ${before.color} -> ${after.color}`);
    });
    expect(faded).toEqual([]);
  });
});
