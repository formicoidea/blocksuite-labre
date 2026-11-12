import { effects as iconPickerEffects } from '@labre/affine-components/icon-picker';

import { CalloutBlockComponent } from './callout-block';

export function effects() {
  customElements.define('affine-callout', CalloutBlockComponent);
  // The callout's icon opens the library's one emoji picker; registering it
  // is idempotent, a host may have done it already for `openIconPicker`.
  iconPickerEffects();
}

declare global {
  interface HTMLElementTagNameMap {
    'affine-callout': CalloutBlockComponent;
  }
}
