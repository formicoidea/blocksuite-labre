import { AffineIconPickerPanel } from './affine-icon-picker-panel.js';
import { AffineEmojiPickerPanel } from './emoji-picker-panel.js';
import { AffineIconPicker } from './icon-picker.js';

export * from './affine-icon-picker-panel.js';
export * from './emoji-data.js';
export * from './emoji-picker-panel.js';
export * from './icon-data.js';
export * from './icon-picker.js';
export * from './open-icon-picker.js';
export * from './recent-store.js';
export * from './types.js';

/**
 * Registers the three elements. Idempotent: a host that mounts the picker on
 * its own (issue #636) calls it at boot, and a later caller (an editor feature
 * registering the picker too, a hot reload) must not throw.
 */
export function effects() {
  define('affine-icon-picker', AffineIconPicker);
  define('affine-emoji-picker-panel', AffineEmojiPickerPanel);
  define('affine-icon-picker-panel', AffineIconPickerPanel);
}

function define(tag: string, ctor: CustomElementConstructor) {
  if (!customElements.get(tag)) customElements.define(tag, ctor);
}
