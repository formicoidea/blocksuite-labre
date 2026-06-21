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
