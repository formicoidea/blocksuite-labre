import { SeniorToolExtension } from '@labre/affine-widget-edgeless-toolbar';
import { html } from 'lit';

/** Independent senior tool — Event Storming. */
export const eventStormingSeniorTool = SeniorToolExtension(
  'ddd-event-storming',
  ({ block }) => ({
    name: 'Event Storming',
    content: html`<edgeless-ddd-event-storming-senior-button
      .edgeless=${block}
    ></edgeless-ddd-event-storming-senior-button>`,
  })
);

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

/** Independent senior tool — Context Map. */
export const contextMapSeniorTool = SeniorToolExtension(
  'ddd-context-map',
  ({ block }) => ({
    name: 'Context Map',
    content: html`<edgeless-ddd-context-map-senior-button
      .edgeless=${block}
    ></edgeless-ddd-context-map-senior-button>`,
  })
);
