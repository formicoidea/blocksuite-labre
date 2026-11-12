/**
 * The zoom bar's vertical menu stays open while it is used, and still closes
 * on a click away.
 *
 * What it would have caught: `createLitPortal`'s `closeOnClickAway` read
 * `e.target` in a document listener. The zoom menu's portal is appended
 * inside the toggle button's shadow root, so a real click on "Zoom in" in
 * that menu reached the listener retargeted to a shadow host outside the
 * portal, read as a click away, and closed the menu after every step. The
 * listener now reads the event's composed path.
 *
 * The viewport is 1024px wide: under 1200px the zoom bar is the toggle button
 * and its menu, not the horizontal bar.
 */
import type { EdgelessRootBlockComponent } from '@labre/affine/blocks/root';
import { page, userEvent } from '@vitest/browser/context';
import { beforeEach, describe, expect, test } from 'vitest';

import { wait } from '../utils/common.js';
import { getDocRootBlock } from '../utils/edgeless.js';
import { setupEditor } from '../utils/setup.js';

describe('zoom bar menu, click away', () => {
  let edgeless!: EdgelessRootBlockComponent;

  beforeEach(async () => {
    const cleanup = await setupEditor('edgeless');
    edgeless = getDocRootBlock(window.doc, window.editor, 'edgeless');
    return cleanup;
  });

  const toggleButton = () => {
    const widget = document.querySelector(
      'affine-edgeless-zoom-toolbar-widget'
    );
    const toggle = widget?.shadowRoot?.querySelector('zoom-bar-toggle-button');
    const button = toggle?.shadowRoot?.querySelector(
      '.toggle-button edgeless-tool-icon-button'
    );
    if (!toggle || !button) throw new Error('no zoom bar toggle button');
    return { toggle, button: button as HTMLElement };
  };

  /** The open menu's portal, or `null` once it is closed. */
  const menuPortal = () =>
    toggleButton().toggle.shadowRoot?.querySelector('.blocksuite-portal') ??
    null;

  const openMenu = async () => {
    await userEvent.click(page.elementLocator(toggleButton().button));
    // The click-away listener is armed on the next task.
    await wait(50);
    const portal = menuPortal();
    expect(portal, 'the toggle button opened its menu').not.toBeNull();
    const bar = portal?.shadowRoot?.querySelector('edgeless-zoom-toolbar');
    const buttons = bar?.shadowRoot?.querySelectorAll(
      'edgeless-tool-icon-button'
    );
    // Fit to screen, zoom out, zoom in, in render order.
    const zoomIn = buttons?.[2] as HTMLElement | undefined;
    if (!zoomIn) throw new Error('the menu rendered no zoom in button');
    return zoomIn;
  };

  test('a click on "Zoom in" zooms and keeps the menu open', async () => {
    const zoomIn = await openMenu();
    const before = edgeless.gfx.viewport.zoom;
    await userEvent.click(page.elementLocator(zoomIn));
    await wait(300);
    expect(edgeless.gfx.viewport.zoom).toBeGreaterThan(before);
    expect(menuPortal(), 'the menu is still open').not.toBeNull();
  });

  test('a click on the canvas closes the menu', async () => {
    await openMenu();
    await userEvent.click(page.elementLocator(edgeless), {
      position: { x: 300, y: 300 },
    });
    await wait(50);
    expect(menuPortal(), 'the menu closed').toBeNull();
  });
});
