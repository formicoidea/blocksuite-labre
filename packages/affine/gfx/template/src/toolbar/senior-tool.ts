import { SeniorToolExtension } from '@labre/affine-widget-edgeless-toolbar';
import { html } from 'lit';

import { TEMPLATE_SENIOR_TOOL_NAME } from '../translations.js';

/** The Templates senior tool's id in the toolbar's registry. */
export const TEMPLATE_SENIOR_TOOL_ID = 'template';

export const templateSeniorTool = SeniorToolExtension(
  TEMPLATE_SENIOR_TOOL_ID,
  ({ block }) => {
    return {
      name: TEMPLATE_SENIOR_TOOL_NAME[1],
      labelKey: TEMPLATE_SENIOR_TOOL_NAME[0],
      // Render after every framework senior tool (default order is 0).
      order: 100,
      content: html`<edgeless-template-button .edgeless=${block}>
      </edgeless-template-button>`,
    };
  }
);
