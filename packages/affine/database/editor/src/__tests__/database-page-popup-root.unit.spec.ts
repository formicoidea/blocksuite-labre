/**
 * GUARD — the popups of a database's full page hang beside its viewport, not
 * inside it (labre recette of 2.4, 2026-10-31).
 *
 * What it would have caught: on a narrow window, the view settings' "Source"
 * list and the sub-menu of "+ view" opened partly under the host's left
 * sidebar. They hung in the editor host, inside `.affine-page-viewport`,
 * which scrolls, masks its gutters (`mask`) and contains its editor
 * (`container-type`): even a `fixed` menu took the viewport as its
 * containing block and was cut at its left edge, where the sidebar begins.
 * The page now names itself the popup root (`POPUP_ROOT_ATTR`); the context
 * menu gives such a popup the editor's `std` (`context-menu-fixed-strategy`
 * in the components package).
 */
import {
  getDefaultModalRoot,
  POPUP_ROOT_ATTR,
} from '@labre/affine-components/context-menu';
import { expect, test } from 'vitest';

import { DatabasePageHost } from '../database-page/database-page.js';

test('a popup opened in the page hangs from the page, outside its viewport', async () => {
  if (!customElements.get('affine-database-page')) {
    customElements.define('affine-database-page', DatabasePageHost);
  }
  const page = document.createElement('affine-database-page');
  const heading = document.createElement('doc-title');
  page.heading = heading;
  document.body.append(page);
  await page.updateComplete;

  expect(page.hasAttribute(POPUP_ROOT_ATTR)).toBe(true);
  const viewport = page.querySelector(':scope > .affine-page-viewport');
  expect(viewport?.contains(heading)).toBe(true);
  expect(getDefaultModalRoot(heading)).toBe(page);

  page.remove();
});
