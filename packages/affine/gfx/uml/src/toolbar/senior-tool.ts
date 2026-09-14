import { SeniorToolExtension } from '@labre/affine-widget-edgeless-toolbar';
import { html } from 'lit';

/**
 * UML's seat on the edgeless senior row.
 *
 * No `order:` — like every other framework. The row IS the registration order
 * of the flag-gated view extensions in `packages/affine/all/src/extensions/
 * view.ts`, which follows `FRAMEWORK_DESCRIPTORS`; declaring an order here
 * would make the stable sort start mattering and break that premise. Pinned by
 * `all/src/__tests__/toolbar/senior-row-order.unit.spec.ts`, which reads this
 * very file.
 */
export const umlSeniorTool = SeniorToolExtension('uml', ({ block }) => {
  return {
    name: 'UML',
    labelKey: 'com.labre.framework.uml',
    content: html`<edgeless-uml-senior-button
      .edgeless=${block}
    ></edgeless-uml-senior-button>`,
  };
});
