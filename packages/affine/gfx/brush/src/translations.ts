import { type ChromeWording, COLOR_LABEL } from '@labre/affine-shared/services';

/**
 * This package's own wordings, joined into `PACKAGE_WORDINGS` in
 * `@labre/affine/translations` — see that file and
 * `packages/affine/shared/src/services/translation-service/README.md`.
 *
 * `senior-tool.ts`'s own `name: 'Pen'` is NOT here: `SeniorTool.labelKey`
 * exists only for a framework's own button — the core tools (note, shape,
 * template, pen…) declare no framework descriptor and therefore no key, by
 * design (`packages/affine/widgets/edgeless-toolbar/src/extension/index.ts`).
 */

export const BRUSH_TOOLTIP_ERASER: ChromeWording = [
  'com.labre.brush.tooltip.eraser',
  'Eraser',
];

export const BRUSH_TOOLTIP_PEN: ChromeWording = [
  'com.labre.brush.tooltip.pen',
  'Pen',
];

export const BRUSH_TOOLTIP_HIGHLIGHTER: ChromeWording = [
  'com.labre.brush.tooltip.highlighter',
  'Highlighter',
];

/** An alias (L7 dedupe): the same word as {@link COLOR_LABEL}, one key. */
export const BRUSH_LABEL_COLOR = COLOR_LABEL;

export const BRUSH_WORDINGS: readonly ChromeWording[] = [
  BRUSH_TOOLTIP_ERASER,
  BRUSH_TOOLTIP_PEN,
  BRUSH_TOOLTIP_HIGHLIGHTER,
];
