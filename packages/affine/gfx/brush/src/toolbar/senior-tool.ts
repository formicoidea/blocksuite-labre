import { SeniorToolExtension } from '@labre/affine-widget-edgeless-toolbar';
import { html } from 'lit';

import { BRUSH_TOOLTIP_PEN } from '../translations.js';

export const penSeniorTool = SeniorToolExtension('pen', ({ block }) => {
  return {
    name: BRUSH_TOOLTIP_PEN[1],
    labelKey: BRUSH_TOOLTIP_PEN[0],
    content: html`<div class="pen-and-eraser">
      <edgeless-pen-tool-button .edgeless=${block}></edgeless-pen-tool-button>

      <edgeless-eraser-tool-button
        .edgeless=${block}
      ></edgeless-eraser-tool-button>
    </div> `,
  };
});
