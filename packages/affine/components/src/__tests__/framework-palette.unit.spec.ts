/**
 * The resolver and the carousel builder of `docs/adr/0027`: which framework a
 * selected element belongs to, and which pages the colour picker then offers.
 *
 * The models are prototype-grafted fakes rather than real elements: the
 * resolver reads exactly three things — `role`, `elementBound` and, for a
 * connector, `source`/`target` — and building a real surface would test Yjs
 * rather than the rule.
 */
import {
  ConnectorElementModel,
  FrameworkBackgroundElementModel,
  type Palette,
} from '@labre/affine-model';
import { Container } from '@labre/global/di';
import { Bound } from '@labre/global/gfx';
import type { BlockStdScope } from '@labre/std';
import type { GfxController, GfxModel } from '@labre/std/gfx';
import { describe, expect, test } from 'vitest';

import {
  BASE_PALETTE_KEY,
  frameworkOfElement,
  FrameworkPaletteExtension,
  frameworkPaletteGroups,
  frameworkOfSelection,
} from '../color-picker/framework-palette.js';

/** A model that answers `props` and nothing else, but passes `instanceof`. */
function fake<T>(proto: object, props: Record<string, unknown>): T {
  const model = Object.create(proto) as Record<string, unknown>;
  for (const [key, value] of Object.entries(props)) {
    Object.defineProperty(model, key, {
      value,
      enumerable: true,
      configurable: true,
      writable: true,
    });
  }
  return model as T;
}

const node = (
  id: string,
  role: string | undefined,
  [x, y, w, h]: [number, number, number, number]
) =>
  fake<GfxModel>(Object.prototype, {
    id,
    role,
    elementBound: new Bound(x, y, w, h),
  });

const board = (
  id: string,
  role: string,
  [x, y, w, h]: [number, number, number, number]
) =>
  fake<GfxModel>(FrameworkBackgroundElementModel.prototype, {
    id,
    role,
    elementBound: new Bound(x, y, w, h),
  });

const connector = (
  id: string,
  ends: { source?: string; target?: string },
  [x, y, w, h]: [number, number, number, number] = [0, 0, 10, 10]
) =>
  fake<GfxModel>(ConnectorElementModel.prototype, {
    id,
    role: undefined,
    source: ends.source ? { id: ends.source } : {},
    target: ends.target ? { id: ends.target } : {},
    elementBound: new Bound(x, y, w, h),
  });

/** A surface holding exactly `elements`. */
function gfxWith(elements: GfxModel[]): GfxController {
  const byId = new Map(elements.map(element => [element.id, element]));
  return {
    surface: { elementModels: elements },
    getElementById: (id: string) => byId.get(id) ?? null,
  } as unknown as GfxController;
}

describe('frameworkOfElement', () => {
  test("an element's own role names its framework", () => {
    const component = node('c', 'wardley:component', [10, 10, 20, 20]);
    expect(frameworkOfElement(gfxWith([component]), component)).toBe('wardley');
  });

  test('a role in no framework namespace names none', () => {
    const stray = node('s', 'something:else', [10, 10, 20, 20]);
    expect(frameworkOfElement(gfxWith([stray]), stray)).toBeUndefined();

    const neutral = node('n', undefined, [10, 10, 20, 20]);
    expect(frameworkOfElement(gfxWith([neutral]), neutral)).toBeUndefined();
  });

  test('a role-less connector takes the framework of its two ends', () => {
    const a = node('a', 'edgy:node', [10, 10, 20, 20]);
    const b = node('b', 'edgy:node', [60, 10, 20, 20]);
    const link = connector('l', { source: 'a', target: 'b' });
    expect(frameworkOfElement(gfxWith([a, b, link]), link)).toBe('edgy');
  });

  test('a connector whose ends disagree falls through to the board', () => {
    const sheet = board('m', 'wardley:map', [0, 0, 400, 400]);
    const a = node('a', 'edgy:node', [10, 10, 20, 20]);
    const b = node('b', 'wardley:component', [60, 10, 20, 20]);
    const link = connector('l', { source: 'a', target: 'b' }, [10, 10, 70, 20]);
    expect(frameworkOfElement(gfxWith([sheet, a, b, link]), link)).toBe(
      'wardley'
    );
  });

  test('a neutral element takes the framework of the board that contains it', () => {
    const sheet = board('m', 'wardley:map', [0, 0, 400, 400]);
    const shape = node('s', undefined, [10, 10, 20, 20]);
    expect(frameworkOfElement(gfxWith([sheet, shape]), shape)).toBe('wardley');
  });

  test('a board that merely overlaps does not claim the element', () => {
    const sheet = board('m', 'wardley:map', [0, 0, 400, 400]);
    // Straddling the right edge: overlapping is not containing.
    const shape = node('s', undefined, [380, 10, 60, 20]);
    expect(frameworkOfElement(gfxWith([sheet, shape]), shape)).toBeUndefined();
  });

  test('nested boards: the SMALLEST containing one wins', () => {
    const outer = board('o', 'c4:board', [0, 0, 400, 400]);
    const inner = board('i', 'edgy:board', [50, 50, 100, 100]);
    const shape = node('s', undefined, [60, 60, 20, 20]);
    expect(frameworkOfElement(gfxWith([outer, inner, shape]), shape)).toBe(
      'edgy'
    );
  });

  test('a board answers about itself by its own role, not by the sheet under it', () => {
    const outer = board('o', 'c4:board', [0, 0, 400, 400]);
    const inner = board('i', 'edgy:board', [50, 50, 100, 100]);
    expect(frameworkOfElement(gfxWith([outer, inner]), inner)).toBe('edgy');
  });
});

describe('frameworkOfSelection', () => {
  const sheet = board('m', 'wardley:map', [0, 0, 400, 400]);
  const wardleyNode = node('w', 'wardley:component', [10, 10, 20, 20]);
  const plain = node('p', undefined, [40, 40, 20, 20]);
  const edgyNode = node('e', 'edgy:node', [500, 10, 20, 20]);
  const gfx = gfxWith([sheet, wardleyNode, plain, edgyNode]);

  test('a selection that agrees answers that framework', () => {
    // `plain` has no role but sits on the map, so both resolve to `wardley`.
    expect(frameworkOfSelection(gfx, [wardleyNode, plain])).toBe('wardley');
  });

  test('a mixed selection answers none', () => {
    expect(frameworkOfSelection(gfx, [wardleyNode, edgyNode])).toBeUndefined();
  });

  test('an empty selection answers none', () => {
    expect(frameworkOfSelection(gfx, [])).toBeUndefined();
  });
});

/* ── The carousel ─────────────────────────────────────────────────────── */

const swatch = (key: string): Palette => ({ key, value: `#00000${key}` });

const WARDLEY_PAGE = [swatch('1')];
const EDGY_PAGE = [swatch('2')];
const BASE_PAGE = [swatch('3')];

/**
 * A std built on a real DI container, so the seam is exercised the way an
 * editor exercises it — and `getOptional` answers no catalogue, so every label
 * resolves to its English fallback.
 */
function stdWith(
  gfx: GfxController,
  ...registered: { setup: (di: never) => void }[]
) {
  const container = new Container();
  registered.forEach(extension => extension.setup(container as never));
  return {
    provider: container.provider(),
    get: () => gfx,
    getOptional: () => undefined,
  } as unknown as BlockStdScope;
}

const wardleyPalette = FrameworkPaletteExtension({
  framework: 'wardley',
  labelWording: ['com.labre.framework.wardley', 'Wardley map'],
  palettes: WARDLEY_PAGE,
});

const edgyPalette = FrameworkPaletteExtension({
  framework: 'edgy',
  labelWording: ['com.labre.framework.edgy', 'EDGY'],
  palettes: EDGY_PAGE,
});

describe('frameworkPaletteGroups', () => {
  const sheet = board('m', 'wardley:map', [0, 0, 400, 400]);
  const wardleyNode = node('w', 'wardley:component', [10, 10, 20, 20]);
  const edgyNode = node('e', 'edgy:node', [500, 10, 20, 20]);
  const gfx = gfxWith([sheet, wardleyNode, edgyNode]);

  test('the base palette is page one and is never hidden', () => {
    const { groups } = frameworkPaletteGroups(
      stdWith(gfx, wardleyPalette, edgyPalette),
      [wardleyNode],
      BASE_PAGE
    );
    expect(groups[0]).toEqual({
      key: BASE_PALETTE_KEY,
      label: 'Default',
      palettes: BASE_PAGE,
    });
  });

  test('the frameworks follow, in FRAMEWORK_IDS order, whatever the registration order', () => {
    const { groups } = frameworkPaletteGroups(
      // Registered EDGY first on purpose.
      stdWith(gfx, edgyPalette, wardleyPalette),
      [wardleyNode],
      BASE_PAGE
    );
    expect(groups.map(group => group.key)).toEqual([
      BASE_PALETTE_KEY,
      'wardley',
      'edgy',
    ]);
    expect(groups.map(group => group.label)).toEqual([
      'Default',
      'Wardley map',
      'EDGY',
    ]);
  });

  test('the carousel opens on the framework of the selected element', () => {
    const std = stdWith(gfx, wardleyPalette, edgyPalette);
    expect(
      frameworkPaletteGroups(std, [wardleyNode], BASE_PAGE).activeKey
    ).toBe('wardley');
    expect(frameworkPaletteGroups(std, [edgyNode], BASE_PAGE).activeKey).toBe(
      'edgy'
    );
  });

  test('a mixed selection, and a selection on no board, open on the base palette', () => {
    const std = stdWith(gfx, wardleyPalette, edgyPalette);
    expect(
      frameworkPaletteGroups(std, [wardleyNode, edgyNode], BASE_PAGE).activeKey
    ).toBe(BASE_PALETTE_KEY);
    expect(frameworkPaletteGroups(std, [], BASE_PAGE).activeKey).toBe(
      BASE_PALETTE_KEY
    );
  });

  test('a framework whose flag is off contributes no page, and its elements open on the base', () => {
    // Nothing registered: exactly what an editor mounted with the flags off
    // hands the picker.
    const { groups, activeKey } = frameworkPaletteGroups(
      stdWith(gfx),
      [wardleyNode],
      BASE_PAGE
    );
    expect(groups.map(group => group.key)).toEqual([BASE_PALETTE_KEY]);
    expect(activeKey).toBe(BASE_PALETTE_KEY);
  });
});
