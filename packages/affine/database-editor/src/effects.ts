import { DatabasePageHost } from './database-page/database-page.js';
import { DatabasePageRoot } from './database-page/database-page-root.js';

/**
 * The custom elements this package defines, called from
 * `DatabaseEditorViewExtension.effect()`, never at import time.
 *
 * ponytail: the properties panel element (B10) defines its element here too
 * when it lands in this package.
 */
export function effects() {
  customElements.define('affine-database-page', DatabasePageHost);
  customElements.define('affine-database-page-root', DatabasePageRoot);
}
