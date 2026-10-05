import type { ChromeWording } from '@labre/affine-shared/services';

/**
 * The words of the "Export SVG" options menu (ADR 0025, amendment of
 * 2026-10-04), one switch per part of the picture, and the one sentence said
 * when the switches leave nothing to draw. The command's own label and
 * description are declared on its descriptor.
 */

export const EXPORT_SVG_OPTION_FRAMEWORK: ChromeWording = [
  'com.labre.export.svg.option.framework',
  'Framework elements',
];

export const EXPORT_SVG_OPTION_SHAPES: ChromeWording = [
  'com.labre.export.svg.option.shapes',
  'Other shapes and strokes',
];

export const EXPORT_SVG_OPTION_TEXTS: ChromeWording = [
  'com.labre.export.svg.option.texts',
  'Other texts',
];

export const EXPORT_SVG_CONFIRM: ChromeWording = [
  'com.labre.export.svg.confirm',
  'Export',
];

export const EXPORT_SVG_NOTHING_TO_EXPORT: ChromeWording = [
  'com.labre.export.svg.nothing',
  'Nothing to export: the options leave nothing of this board to draw.',
];

export const EXPORT_SVG_WORDINGS: readonly ChromeWording[] = [
  EXPORT_SVG_OPTION_FRAMEWORK,
  EXPORT_SVG_OPTION_SHAPES,
  EXPORT_SVG_OPTION_TEXTS,
  EXPORT_SVG_CONFIRM,
  EXPORT_SVG_NOTHING_TO_EXPORT,
];
