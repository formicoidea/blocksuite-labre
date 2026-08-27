import { SeniorToolExtension } from '@labre/affine-widget-edgeless-toolbar';
import { html } from 'lit';

export const c4SeniorTool = SeniorToolExtension('c4', ({ block }) => {
  return {
    name: 'C4 model',
    labelKey: 'com.labre.framework.c4',
    content: html`<edgeless-c4-senior-button
      .edgeless=${block}
    ></edgeless-c4-senior-button>`,
  };
});
