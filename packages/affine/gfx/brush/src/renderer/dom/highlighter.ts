import {
  DomElementRendererExtension,
  type DomRenderer,
} from '@labre/affine-block-surface';
import type { HighlighterElementModel } from '@labre/affine-model';
import { DefaultTheme } from '@labre/affine-model';

import { renderBrushLikeDom } from './shared.js';

export const HighlighterDomRendererExtension = DomElementRendererExtension(
  'highlighter',
  (
    model: HighlighterElementModel,
    domElement: HTMLElement,
    renderer: DomRenderer
  ) => {
    renderBrushLikeDom({
      model,
      domElement,
      renderer,
      color: renderer.getColorValue(
        model.color,
        DefaultTheme.hightlighterColor,
        true
      ),
    });
  }
);
