import { SeniorToolExtension } from '@labre/affine-widget-edgeless-toolbar';
import { html } from 'lit';

/** A single senior tool hosting both the Cynefin and Estuarine frameworks. */
export const cynefinEstuarineSeniorTool = SeniorToolExtension(
  'cynefin-estuarine',
  ({ block }) => {
    return {
      name: 'Cynefin / Estuarine',
      labelKey: 'com.labre.framework.cynefin-estuarine',
      content: html`<edgeless-cynefin-estuarine-senior-button
        .edgeless=${block}
      ></edgeless-cynefin-estuarine-senior-button>`,
    };
  }
);
