import { SeniorToolExtension } from '@labre/affine-widget-edgeless-toolbar';
import { html } from 'lit';

import { SHAPE_TOOL_NAME } from '../translations.js';

export const shapeSeniorTool = SeniorToolExtension(
  'shape',
  ({ block, toolbarContainer }) => {
    return {
      name: 'Shape',
      labelKey: SHAPE_TOOL_NAME[0],
      content: html`<edgeless-shape-tool-button
        .edgeless=${block}
        .toolbarContainer=${toolbarContainer}
      ></edgeless-shape-tool-button>`,
    };
  }
);
