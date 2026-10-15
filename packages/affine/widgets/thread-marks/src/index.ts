import { WidgetViewExtension } from '@labre/std';
import { literal, unsafeStatic } from 'lit/static-html.js';

import { AFFINE_THREAD_MARKS_WIDGET } from './widget.js';

export * from './excerpt.js';
export * from './text-range.js';
export * from './toolbar.js';
export * from './translations.js';
export * from './widget.js';

export const threadMarksWidget = WidgetViewExtension(
  'affine:page',
  AFFINE_THREAD_MARKS_WIDGET,
  literal`${unsafeStatic(AFFINE_THREAD_MARKS_WIDGET)}`
);
