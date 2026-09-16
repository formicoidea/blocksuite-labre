import { SeniorToolExtension } from '@labre/affine-widget-edgeless-toolbar';
import { html } from 'lit';

import { GFX_NOTE_TOOL_LABEL } from '../translations.js';

export const noteSeniorTool = SeniorToolExtension('note', ({ block }) => {
  return {
    name: GFX_NOTE_TOOL_LABEL[1],
    labelKey: GFX_NOTE_TOOL_LABEL[0],
    content: html`<edgeless-note-senior-button
      .edgeless=${block}
    ></edgeless-note-senior-button>`,
  };
});
