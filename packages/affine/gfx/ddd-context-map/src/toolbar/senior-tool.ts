import { SeniorToolExtension } from '@labre/affine-widget-edgeless-toolbar';
import { html } from 'lit';

/** Independent senior tool — Context Map. */
export const contextMapSeniorTool = SeniorToolExtension(
  'ddd-context-map',
  ({ block }) => ({
    name: 'Context Map',
    labelKey: 'com.labre.framework.ddd-context-map',
    content: html`<edgeless-ddd-context-map-senior-button
      .edgeless=${block}
    ></edgeless-ddd-context-map-senior-button>`,
  })
);
