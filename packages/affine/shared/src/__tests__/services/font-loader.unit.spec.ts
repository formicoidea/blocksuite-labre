/**
 * @vitest-environment happy-dom
 */
import { FontFamily, FontStyle, FontWeight } from '@labre/affine-model';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { FontConfig } from '../../services/font-loader/config';
import {
  AffineCanvasTextFonts,
  CommunityCanvasTextFonts,
} from '../../services/font-loader/config';
import { FontLoaderService } from '../../services/font-loader/font-loader-service';

class FakeFontFace {
  loaded = Promise.resolve(this);

  constructor(
    readonly family: string,
    readonly source: string,
    readonly descriptors: { weight: string; style: string }
  ) {}

  load() {
    return this.loaded;
  }
}

const registry = new Set<FakeFontFace>();

const font = (
  family: FontFamily,
  weight: FontWeight,
  url = `${family}-${weight}`
): FontConfig => ({
  font: family,
  url,
  weight,
  style: FontStyle.Normal,
});

const critical = font(FontFamily.Inter, FontWeight.Regular);
const alsoCritical = font(FontFamily.Inter, FontWeight.SemiBold);
const deferred = [
  font(FontFamily.Lora, FontWeight.Regular),
  font(FontFamily.Satoshi, FontWeight.Regular),
  font(FontFamily.BebasNeue, FontWeight.Regular),
  font(FontFamily.OrelegaOne, FontWeight.Regular),
  font(FontFamily.Lora, FontWeight.Bold),
];

const mount = (config: FontConfig[]) => {
  const service = new FontLoaderService({
    getOptional: () => config,
  } as never);
  service.mounted();
  return service;
};

const families = () => [...registry].map(face => face.family);

beforeEach(() => {
  registry.clear();
  vi.useFakeTimers();
  vi.stubGlobal('FontFace', FakeFontFace);
  vi.stubGlobal('requestIdleCallback', undefined);
  Object.defineProperty(document, 'fonts', {
    configurable: true,
    value: {
      add: (face: FakeFontFace) => registry.add(face),
      delete: (face: FakeFontFace) => registry.delete(face),
    },
  });
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('FontLoaderService', () => {
  it('registers only the critical canvas fonts up front', () => {
    mount([critical, alsoCritical, ...deferred]);

    expect(families()).toEqual([FontFamily.Inter, FontFamily.Inter]);
  });

  it('registers the rest in batches once the editor has settled', async () => {
    mount([critical, alsoCritical, ...deferred]);

    await vi.advanceTimersByTimeAsync(5000);
    expect(registry.size).toBe(2 + 4);

    await vi.advanceTimersByTimeAsync(1000);
    expect(registry.size).toBe(2 + deferred.length);
  });

  it('resolves ready only once every font has been registered', async () => {
    const service = mount([critical, alsoCritical, ...deferred]);
    let resolved = false;
    void service.ready.then(() => {
      resolved = true;
    });

    await vi.advanceTimersByTimeAsync(5000);
    expect(resolved).toBe(false);

    await vi.advanceTimersByTimeAsync(1000);
    expect(resolved).toBe(true);
    expect(registry.size).toBe(2 + deferred.length);
  });

  it('registers the same face only once', () => {
    const service = mount([critical]);

    service.load([critical, { ...critical }]);

    expect(registry.size).toBe(1);
  });

  it('falls back to the first few fonts when none is critical', () => {
    mount(deferred);

    expect(registry.size).toBe(3);
  });

  it('stops the deferred queue when it is unmounted', async () => {
    const service = mount([critical, alsoCritical, ...deferred]);

    service.unmounted();
    await vi.advanceTimersByTimeAsync(10000);

    expect(registry.size).toBe(0);
    await expect(service.ready).resolves.toBeUndefined();
  });
});

describe('CommunityCanvasTextFonts', () => {
  /** The heaviest weight the list registers for a family and style. */
  const heaviestOf = (family: FontFamily, style: FontStyle) =>
    CommunityCanvasTextFonts.filter(
      config => config.font === family && config.style === style
    )
      .map(config => config.weight)
      .sort()
      .pop();

  it.each([
    [FontFamily.Inter, FontStyle.Normal],
    [FontFamily.Inter, FontStyle.Italic],
    [FontFamily.Poppins, FontStyle.Normal],
    [FontFamily.Poppins, FontStyle.Italic],
    [FontFamily.BebasNeue, FontStyle.Normal],
    [FontFamily.PlusJakartaSans, FontStyle.Normal],
    [FontFamily.PlusJakartaSans, FontStyle.Italic],
  ])('ships a 700 face for %s %s', (family, style) => {
    expect(heaviestOf(family, style)).toBe(FontWeight.Bold);
  });

  /**
   * Kalam and Lora have no 600 file of their own: their `SemiBold` entries
   * already point at the 700 one, so a second Bold row would repeat the
   * Semibold row rather than add a weight.
   */
  it.each([FontFamily.Kalam, FontFamily.Lora])(
    'keeps %s on a single heavy face',
    family => {
      expect(heaviestOf(family, FontStyle.Normal)).toBe(FontWeight.SemiBold);
    }
  );
});

/**
 * #396, PO decision: Plus Jakarta Sans (SIL OFL 1.1) replaces Satoshi, whose
 * licence forbids offering it as a selectable font in a SaaS or design tool.
 * These would have caught Satoshi coming back into a default list, and Plus
 * Jakarta Sans losing the faces its weight panel offers.
 */
describe('default font lists (#396)', () => {
  it.each([
    ['CommunityCanvasTextFonts', CommunityCanvasTextFonts],
    ['AffineCanvasTextFonts', AffineCanvasTextFonts],
  ])('%s offers no Satoshi face', (_, list) => {
    expect(list.filter(config => config.font === FontFamily.Satoshi)).toEqual(
      []
    );
  });

  it('CommunityCanvasTextFonts ships Plus Jakarta Sans light to bold, upright and italic', () => {
    const faces = CommunityCanvasTextFonts.filter(
      config => config.font === FontFamily.PlusJakartaSans
    ).map(config => `${config.weight} ${config.style}`);

    expect(faces).toEqual([
      '300 normal',
      '400 normal',
      '600 normal',
      '700 normal',
      '300 italic',
      '400 italic',
      '600 italic',
      '700 italic',
    ]);
  });
});
