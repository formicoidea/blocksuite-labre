import { DatabasePageHost } from './database-page/database-page.js';
import { DatabasePageRoot } from './database-page/database-page-root.js';
import { DatabasePropertiesPanel } from './properties-panel/properties-panel.js';

/**
 * The custom elements this package defines, called from
 * `DatabaseEditorViewExtension.effect()`, never at import time.
 */
export function effects() {
  customElements.define('affine-database-page', DatabasePageHost);
  customElements.define('affine-database-page-root', DatabasePageRoot);
  customElements.define(
    'affine-database-properties-panel',
    DatabasePropertiesPanel
  );
}
