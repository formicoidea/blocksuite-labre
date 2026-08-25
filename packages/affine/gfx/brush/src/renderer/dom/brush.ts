import {
  DomElementRendererExtension,
  type DomRenderer,
} from '@labre/affine-block-surface';
import type { BrushElementModel } from '@labre/affine-model';
import { DefaultTheme } from '@labre/affine-model';

import { renderBrushLikeDom } from './shared.js';

export const BrushDomRendererExtension = DomElementRendererExtension(
  'brush',
  (
    model: BrushElementModel,
    domElement: HTMLElement,
    renderer: DomRenderer
  ) => {
    renderBrushLikeDom({
      model,
      domElement,
      renderer,
      color: renderer.getColorValue(model.color, DefaultTheme.black, true),
    });
  }
);
