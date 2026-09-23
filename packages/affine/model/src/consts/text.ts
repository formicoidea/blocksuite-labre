import { z } from 'zod';

import type { Color } from '../themes/color.js';
import { createEnumMap } from '../utils/enum.js';

export enum TextAlign {
  Center = 'center',
  Left = 'left',
  Right = 'right',
}

export const TextAlignMap = createEnumMap(TextAlign);

export enum TextVerticalAlign {
  Bottom = 'bottom',
  Center = 'center',
  Top = 'top',
}

export type TextStyleProps = {
  color: Color;
  fontFamily: FontFamily;
  fontSize: number;
  fontStyle: FontStyle;
  fontWeight: FontWeight;
  textAlign: TextAlign;
};

export enum FontWeight {
  Bold = '700',
  Light = '300',
  Medium = '500',
  Regular = '400',
  SemiBold = '600',
}

export const FontWeightMap = createEnumMap(FontWeight);

export enum FontStyle {
  Italic = 'italic',
  Normal = 'normal',
}

/**
 * A stored value: every member stays forever, whether or not a host still
 * ships its files. `Satoshi` is in no default font list since #396 (its
 * licence forbids offering it as a selectable font in a SaaS or design tool),
 * but an element that carries it keeps loading and painting with the
 * `sans-serif` fallback. `PlusJakartaSans` (SIL OFL 1.1) is its replacement.
 */
export enum FontFamily {
  BebasNeue = 'blocksuite:surface:BebasNeue',
  Inter = 'blocksuite:surface:Inter',
  Kalam = 'blocksuite:surface:Kalam',
  Lora = 'blocksuite:surface:Lora',
  OrelegaOne = 'blocksuite:surface:OrelegaOne',
  PlusJakartaSans = 'blocksuite:surface:PlusJakartaSans',
  Poppins = 'blocksuite:surface:Poppins',
  Satoshi = 'blocksuite:surface:Satoshi',
}

export const FontFamilyMap = createEnumMap(FontFamily);

/**
 * The name a family goes by where its enum key cannot spell it: a proper name
 * with spaces. Proper names carry no i18n key, like the other family names
 * (ADR 0023).
 */
const SPACED_FONT_FAMILY_NAMES: Partial<Record<FontFamily, string>> = {
  [FontFamily.PlusJakartaSans]: 'Plus Jakarta Sans',
};

/**
 * Every family with the name the picker shows, in declaration order. What a
 * picker OFFERS is this list narrowed to the families the host configured
 * (`FontConfig`, #396); this is the order and the names it keeps.
 */
export const FontFamilyList = (
  Object.entries(FontFamilyMap) as [FontFamily, string][]
).map(([family, key]): [FontFamily, string] => [
  family,
  SPACED_FONT_FAMILY_NAMES[family] ?? key,
]);

export enum TextResizing {
  AUTO_WIDTH_AND_HEIGHT,
  AUTO_HEIGHT,
}

/**
 * How a shape reconciles its text with its bounds. Orthogonal to
 * {@link TextResizing} (which only applies in `Grow` mode). A string enum on
 * purpose: the value is persisted in documents and must never depend on
 * member order.
 */
export enum TextFitMode {
  /** Fixed font size, the shape grows to fit the text (default). */
  Grow = 'grow',
  /**
   * Fixed shape size, the font size shrinks so the text fits
   * (post-it behavior).
   */
  Contained = 'contained',
  /** Fixed shape size and font size; the text may paint past the bounds. */
  Overflow = 'overflow',
}

export const FontFamilySchema = z.nativeEnum(FontFamily);
export const FontWeightSchema = z.nativeEnum(FontWeight);
export const FontStyleSchema = z.nativeEnum(FontStyle);
export const TextAlignSchema = z.nativeEnum(TextAlign);
