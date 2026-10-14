import { DatabasePropertiesPanel } from './properties-panel/properties-panel.js';

/**
 * The custom elements this package defines, called from
 * `DatabaseEditorViewExtension.effect()`, never at import time.
 *
 * ponytail: the view bar (B11) and the full-page host (B13) define theirs
 * here too when they land, and declare them in `HTMLElementTagNameMap`.
 */
export function effects() {
  customElements.define(
    'affine-database-properties-panel',
    DatabasePropertiesPanel
  );
}
