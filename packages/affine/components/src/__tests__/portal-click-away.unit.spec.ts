/**
 * `closeOnClickAway` must tell a click inside the portal from one outside it
 * when the portal lives inside a shadow tree.
 *
 * What it would have caught: the document listener read `e.target`, which
 * the browser retargets to the outermost shadow host a document-level
 * listener can see. A portal appended inside a widget's shadow root (the
 * zoom bar's vertical menu, the adapter panel's menu) therefore saw every
 * click on its own content as a click away and closed. The listener now
 * reads `composedPath()`, which still holds the portal; a click that is
 * really outside closes the portal as before.
 *
 * happy-dom does not retarget the way a browser does (on the old code even
 * the plain document case failed here), so this spec holds the contract and
 * `integration-test/.../edgeless/zoom-menu-click-away.spec.ts` holds the
 * symptom in Chromium.
 */
import { html } from 'lit';
import { afterEach, describe, expect, test } from 'vitest';

import { createLitPortal } from '../portal/index.js';

// The listener is armed on the next task so the opening click does not close
// the portal it just opened.
const nextTask = () => new Promise(resolve => setTimeout(resolve));

const openPortal = async (container: Element) => {
  const abortController = new AbortController();
  createLitPortal({
    template: html`<button class="inside">Inside</button>`,
    container,
    abortController,
    closeOnClickAway: true,
  });
  await nextTask();
  const portalRoot = container.querySelector('.blocksuite-portal');
  const inside = portalRoot?.shadowRoot?.querySelector('button');
  if (!inside) throw new Error('the portal rendered no button');
  return { abortController, inside };
};

/** A host whose shadow root holds the container, the way a widget does. */
const shadowContainer = () => {
  const host = document.createElement('div');
  document.body.append(host);
  const container = document.createElement('div');
  host.attachShadow({ mode: 'open' }).append(container);
  return { host, container };
};

afterEach(() => {
  document.body.replaceChildren();
});

describe('createLitPortal closeOnClickAway', () => {
  test('a click inside a portal held by a shadow tree keeps it open', async () => {
    const { container } = shadowContainer();
    const { abortController, inside } = await openPortal(container);
    inside.click();
    expect(abortController.signal.aborted).toBe(false);
  });

  test('a click outside a portal held by a shadow tree closes it', async () => {
    const { host, container } = shadowContainer();
    const { abortController } = await openPortal(container);
    const sibling = document.createElement('span');
    host.shadowRoot?.append(sibling);
    sibling.click();
    expect(abortController.signal.aborted).toBe(true);
  });

  test('in the document: inside keeps it open, outside closes it', async () => {
    const { abortController, inside } = await openPortal(document.body);
    inside.click();
    expect(abortController.signal.aborted).toBe(false);
    const outside = document.createElement('span');
    document.body.append(outside);
    outside.click();
    expect(abortController.signal.aborted).toBe(true);
  });
});
