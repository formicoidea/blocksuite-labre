import { SeniorToolExtension } from '@labre/affine-widget-edgeless-toolbar';
import { html } from 'lit';

/** Independent senior tool — Core Domain Chart. */
export const coreDomainSeniorTool = SeniorToolExtension(
  'ddd-core-domain',
  ({ block }) => ({
    name: 'Core Domain Chart',
    content: html`<edgeless-ddd-core-domain-senior-button
      .edgeless=${block}
    ></edgeless-ddd-core-domain-senior-button>`,
  })
);
