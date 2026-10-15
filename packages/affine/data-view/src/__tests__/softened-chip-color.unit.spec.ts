import { describe, expect, it } from 'vitest';

import { selectOptionColors } from '../core/component/tags/colors.js';
import {
  isSoftenedChipColor,
  PASTEL_MAX_SHARE,
  SOFTENED_BACKGROUND_TOKEN,
  SOFTENED_SHARE,
  softenedChipColor,
} from '../core/component/tags/softened-colors.js';
import { colorRulePaint } from '../core/view/color-rules.js';

/**
 * The one stored colour shape that is not a palette colour: a framework
 * colour softened into a chip colour (ADR 0036 amendment of 2026-10-14,
 * "framework pages"). A rule's colour is put into a style only when it is a
 * palette colour or passes `isSoftenedChipColor`, so this check is all that
 * stands between a stored string and the page's CSS.
 *
 * What it would have caught:
 * - a validator loose enough to let a crafted value through: a second
 *   declaration, a `url(`, another variable, a nested function, a value
 *   with trailing text or a different spelling of the same shape;
 * - a generated value the validator refuses (a picked framework swatch that
 *   then paints nothing as a rule);
 * - a pastel that does not keep its light-theme look, or a softened value
 *   built from anything but the colour's light value;
 * - the palette colours or their old spellings no longer painting.
 */

const mix = (hex: string, share: number) =>
  `color-mix(in srgb, ${hex} ${share}%, var(${SOFTENED_BACKGROUND_TOKEN}))`;

const channels = (hex: string) => {
  const value = Number.parseInt(hex.slice(1), 16);
  return [(value >> 16) & 0xff, (value >> 8) & 0xff, value & 0xff];
};

/** What `color-mix(in srgb, …)` paints over a white light background. */
function onWhite(softened: string): number[] {
  const match = /#([0-9a-f]{6}) (\d+)%/.exec(softened);
  expect(match).not.toBeNull();
  const share = Number(match![2]) / 100;
  return channels(`#${match![1]}`).map(
    value => value * share + 255 * (1 - share)
  );
}

describe('softening a framework colour', () => {
  it('mixes a saturated colour at the fixed share with the background token', () => {
    expect(softenedChipColor('#d6455d')).toBe(mix('#d6455d', SOFTENED_SHARE));
    // Upper-case input, lower-case output: one spelling per value.
    expect(softenedChipColor('#F5963B')).toBe(mix('#f5963b', SOFTENED_SHARE));
  });

  it('keeps a pastel exactly as it reads in the light theme', () => {
    for (const pastel of ['#b9e9fa', '#faf2c9', '#fff1a8', '#e6e6e6']) {
      const softened = softenedChipColor(pastel)!;
      expect(isSoftenedChipColor(softened)).toBe(true);
      onWhite(softened).forEach((value, index) =>
        expect(Math.abs(value - channels(pastel)[index]!)).toBeLessThan(1)
      );
    }
    // #fff1a8 needs 35% to be a mix with white, more than the fixed share.
    expect(softenedChipColor('#fff1a8')).toMatch(/ 35%,/);
  });

  it('softens a colour past the pastel limit instead of keeping it', () => {
    // #ff99bd is a mix with white only from 40% up: softened, not kept.
    expect(softenedChipColor('#ff99bd')).toBe(mix('#ff99bd', SOFTENED_SHARE));
    expect(PASTEL_MAX_SHARE).toBeGreaterThan(SOFTENED_SHARE);
  });

  it('reads the light value of a dark/light pair, and refuses what is no #rrggbb', () => {
    expect(softenedChipColor({ dark: '#ffffff', light: '#000000' })).toBe(
      mix('#000000', SOFTENED_SHARE)
    );
    expect(softenedChipColor({ normal: '#000000' })).toBe(
      mix('#000000', SOFTENED_SHARE)
    );
    for (const value of [
      'transparent',
      'var(--affine-palette-shape-red)',
      '#fff',
      '#11223344',
      'rgb(0, 0, 0)',
    ]) {
      expect(softenedChipColor(value)).toBeUndefined();
    }
  });
});

describe('the stored-value check', () => {
  it('accepts exactly what softening writes', () => {
    for (const value of ['#000000', '#ffffff', '#3ec9f2', '#c6dbfc']) {
      expect(isSoftenedChipColor(softenedChipColor(value))).toBe(true);
    }
    expect(isSoftenedChipColor(mix('#0a0b0c', 1))).toBe(true);
    expect(isSoftenedChipColor(mix('#0a0b0c', 100))).toBe(true);
  });

  it.each([
    // Injection attempts.
    'red; background:url(https://example.com/x.png)',
    `${mix('#000000', 30)}; background:url(x)`,
    `color-mix(in srgb, #000000 30%, var(--x)) , url(x)`,
    `color-mix(in srgb, #000000 30%, var(${SOFTENED_BACKGROUND_TOKEN})) , url(x)`,
    `color-mix(in srgb, #000000 30%, var(${SOFTENED_BACKGROUND_TOKEN}, url(x)))`,
    `color-mix(in srgb, url(x) 30%, var(${SOFTENED_BACKGROUND_TOKEN}))`,
    `color-mix(in srgb, var(--x) 30%, var(${SOFTENED_BACKGROUND_TOKEN}))`,
    `color-mix(in srgb, #000000 30%, var(--affine-v2-layer-background-primary2))`,
    `color-mix(in srgb, #000000 30%, var(--affine-tag-red))`,
    `color-mix(in srgb, #000000 30%, var(${SOFTENED_BACKGROUND_TOKEN}))\n`,
    ` ${mix('#000000', 30)}`,
    // Other spellings of the same shape: refused, one spelling only.
    mix('#ABCDEF', 30),
    mix('#abc', 30),
    mix('#000000', 0),
    mix('#000000', 101),
    mix('#000000', 30.5),
    mix('#000000', 7).replace(' 7%', ' 07%'),
    `color-mix(in srgb,#000000 30%,var(${SOFTENED_BACKGROUND_TOKEN}))`,
    `color-mix(in oklch, #000000 30%, var(${SOFTENED_BACKGROUND_TOKEN}))`,
    `COLOR-MIX(in srgb, #000000 30%, var(${SOFTENED_BACKGROUND_TOKEN}))`,
    '',
  ])('refuses %j', value => {
    expect(isSoftenedChipColor(value)).toBe(false);
    expect(colorRulePaint(value)).toBeUndefined();
  });

  it('refuses what is not a string', () => {
    for (const value of [undefined, null, 30, {}, ['#000000']]) {
      expect(isSoftenedChipColor(value)).toBe(false);
    }
  });
});

describe('what a rule paints', () => {
  it('paints a softened colour as stored', () => {
    const softened = softenedChipColor('#5b9cf6')!;
    expect(colorRulePaint(softened)).toBe(softened);
  });

  it('still paints the palette colours and their old spellings', () => {
    for (const item of selectOptionColors) {
      expect(colorRulePaint(item.color)).toBe(item.color);
      expect(colorRulePaint(item.oldColor)).toBe(item.color);
    }
  });
});
