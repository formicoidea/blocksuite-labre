import { AffineIconPickerPanel } from './affine-icon-picker-panel.js';
import { AffineEmojiPickerPanel } from './emoji-picker-panel.js';
import { AffineIconPicker } from './icon-picker.js';

export * from './affine-icon-picker-panel.js';
export * from './emoji-data.js';
export * from './emoji-picker-panel.js';
export * from './icon-data.js';
export * from './icon-picker.js';
export * from './recent-store.js';
export * from './types.js';

export function effects() {
  customElements.define('affine-icon-picker', AffineIconPicker);
  customElements.define('affine-emoji-picker-panel', AffineEmojiPickerPanel);
  customElements.define('affine-icon-picker-panel', AffineIconPickerPanel);
}
