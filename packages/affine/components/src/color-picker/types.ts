// https://www.w3.org/TR/css-color-4/

import type { ChromeWording } from '@labre/affine-shared/services';
import type { ColorScheme, Palette } from '@labre/affine-model';

// Red, green, blue. All in the range [0, 1].
export type Rgb = {
  // red 0-1
  r: number;
  // green 0-1
  g: number;
  // blue 0-1
  b: number;
};

// Red, green, blue, alpha. All in the range [0, 1].
export type Rgba = Rgb & {
  // alpha 0-1
  a: number;
};

// Hue, saturation, value. All in the range [0, 1].
export type Hsv = {
  // hue 0-1
  h: number;
  // saturation 0-1
  s: number;
  // value 0-1
  v: number;
};

// Hue, saturation, value, alpha. All in the range [0, 1].
export type Hsva = Hsv & {
  // alpha 0-1
  a: number;
};

export type Point = { x: number; y: number };

export type NavType = 'colors' | 'custom';

export type NavTab<Type> = { type: Type; name: string };

export type ModeType = 'normal' | `${ColorScheme}`;

export type ModeTab<Type> = NavTab<Type> & { hsva: Hsva };

export type ModeRgba = { type: ModeType; rgba: Rgba };

export type PickColorType = 'palette' | ModeType;

export type PickColorEvent =
  | { type: 'start' | 'end' }
  | { type: 'pick'; detail: Palette };

/**
 * A swatch that names itself, for a colour panel that has to display
 * something better than `Palette.key` — the framework-agnostic extension
 * point `resolvePaletteLabel` (`utils.ts`) checks FIRST, before falling back
 * to the default theme's own `PALETTE_NAME_WORDINGS` lookup
 * (`@labre/affine-shared/services`) and, with neither, to the raw `key`
 * exactly as every colour panel displayed it before this type existed.
 *
 * `Palette` itself (`packages/affine/model`, RED ZONE) is never touched: a
 * framework that wants its own swatch names (Wardley's "Wonder" / "Peace" /
 * "War", EDGY's "Identity" / "Architecture"…) builds its palette as
 * `NamedPalette[]` OUTSIDE the model, in its own `toolbar/node-config.ts` —
 * see `packages/affine/gfx/wardley/src/toolbar/node-config.ts` and its EDGY
 * counterpart. Optional and additive: a plain `Palette[]` (the default
 * theme's tables, any pre-existing caller) is still assignable wherever a
 * `NamedPalette[]` is expected, so nothing that already worked has to change.
 */
export type NamedPalette = Palette & { labelWording?: ChromeWording };
