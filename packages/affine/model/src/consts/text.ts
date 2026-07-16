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

export enum FontFamily {
  BebasNeue = 'blocksuite:surface:BebasNeue',
  Inter = 'blocksuite:surface:Inter',
  Kalam = 'blocksuite:surface:Kalam',
  Lora = 'blocksuite:surface:Lora',
  OrelegaOne = 'blocksuite:surface:OrelegaOne',
  Poppins = 'blocksuite:surface:Poppins',
  Satoshi = 'blocksuite:surface:Satoshi',
}

export const FontFamilyMap = createEnumMap(FontFamily);

export const FontFamilyList = Object.entries(FontFamilyMap) as {
  [K in FontFamily]: [K, (typeof FontFamilyMap)[K]];
}[FontFamily][];

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
