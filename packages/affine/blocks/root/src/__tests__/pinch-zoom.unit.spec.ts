/**
 * Ctrl+wheel and trackpad pinch must zoom the CANVAS, never the browser page.
 *
 * What stops the browser from page-zooming is `preventDefault()`, and the
 * edgeless handler that calls it hangs off the event dispatcher — a
 * bubble-phase listener on the editor host. Popups portalled out to
 * `document.body` never reach that host, and in-host overlays (the element
 * toolbar, the validation bubble, the artefact catalogue) stop the wheel on
 * purpose so they scroll instead of the board. Under either one the page
 * zoomed, which is issue #328.
 *
 * `pinchZoomAction` is the decision the capture-phase listener on `document`
 * takes before any of them: these tests dispatch real wheel events through a
 * real DOM so the composed path is the browser's, not a fixture's.
 */
import { beforeEach, describe, expect, test } from 'vitest';

import {
  type PinchZoomAction,
  pinchZoomAction,
  PORTAL_CLASS,
} from '../edgeless/utils/pinch-zoom.js';

let host: HTMLElement;
let insideHost: HTMLElement;
let insidePortal: HTMLElement;
let elsewhere: HTMLElement;

beforeEach(() => {
  document.body.innerHTML = '';

  host = document.createElement('div');
  insideHost = document.createElement('div');
  host.append(insideHost);

  const portal = document.createElement('div');
  portal.classList.add(PORTAL_CLASS);
  insidePortal = document.createElement('div');
  portal.append(insidePortal);

  elsewhere = document.createElement('div');

  document.body.append(host, portal, elsewhere);
});

/**
 * Dispatches a wheel as a real one composes — up through the tree, cancelable —
 * and reads the decision from a capture listener on `document`, where the fix
 * reads it. A composed path only exists while the event is in flight.
 */
const decide = (target: EventTarget, pinch = false) => {
  const event = new WheelEvent('wheel', {
    deltaY: -120,
    bubbles: true,
    composed: true,
    cancelable: true,
  });
  // happy-dom's `WheelEvent` extends `UIEvent`, not `MouseEvent`, so it carries
  // no modifier keys: the pinch flag has to be pinned on by hand.
  Object.defineProperty(event, 'ctrlKey', { value: pinch });

  let action: PinchZoomAction | undefined;
  const listener = (e: Event) => {
    action = pinchZoomAction(e as WheelEvent, host);
  };
  document.addEventListener('wheel', listener, true);
  target.dispatchEvent(event);
  document.removeEventListener('wheel', listener, true);
  return action;
};

const PINCH = true;

describe('pinch zoom never reaches the browser', () => {
  test('a pinch over a portalled popup is swallowed', () => {
    // The bug: the event never reaches the editor host, so nothing cancelled
    // the default action and the whole window zoomed.
    expect(decide(insidePortal, PINCH)).toBe('swallow');
  });

  test('a pinch inside the editor zooms the canvas', () => {
    // True wherever the pointer is inside the host — including over an overlay
    // that will stop the event before the dispatcher ever sees it.
    expect(decide(insideHost, PINCH)).toBe('zoom');
  });

  test('a plain wheel is left to whatever is under the pointer', () => {
    // Scrolling a bubble, a toolbar or a panel is the behaviour those overlays
    // were built for; claiming it here would put the bug back the other way up.
    expect(decide(insidePortal)).toBe('ignore');
    expect(decide(insideHost)).toBe('ignore');
  });

  test('a pinch outside the editor belongs to the page', () => {
    // A library does not take the browser zoom away from somebody else's page.
    expect(decide(elsewhere, PINCH)).toBe('ignore');
  });
});
