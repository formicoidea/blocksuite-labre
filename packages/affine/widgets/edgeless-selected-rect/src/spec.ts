import { WidgetViewExtension } from '@labre/std';
import { literal, unsafeStatic } from 'lit/static-html.js';

import { EDGELESS_ELEMENT_LINK_WIDGET } from './edgeless-element-link';
import { EDGELESS_SELECTED_RECT_WIDGET } from './edgeless-selected-rect';

export const edgelessSelectedRectWidget = WidgetViewExtension(
  'affine:page',
  EDGELESS_SELECTED_RECT_WIDGET,
  literal`${unsafeStatic(EDGELESS_SELECTED_RECT_WIDGET)}`
);

export const edgelessElementLinkWidget = WidgetViewExtension(
  'affine:page',
  EDGELESS_ELEMENT_LINK_WIDGET,
  literal`${unsafeStatic(EDGELESS_ELEMENT_LINK_WIDGET)}`
);
