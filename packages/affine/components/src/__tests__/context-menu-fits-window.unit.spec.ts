/**
 * What this would have caught: the product owner's acceptance of the
 * database work. "The menu is in overflow-hidden mode when the number of rows
 * in the base is not large enough": a column menu on a base of three rows,
 * on its full page, ran past the bottom of the window and "Duplicate" and
 * "Delete" could not be reached; then, once capped, every menu scrolled
 * (even one that fit, by 4px), and a capped one scrolled back to its top
 * under the pointer.
 *
 * The rules of `fit-window.ts`, held on their effect over a panel whose
 * content height is given (no layout engine here):
 * - a panel taller than the room is capped there and scrolls, sideways shut;
 * - a panel that fits carries no cap and no scroll, and loses them once it
 *   fits again (a larger window); a new placement keeps its scroll position;
 * - the keyboard's highlight scrolls the panel just enough to show the
 *   entry, and not at all when it shows; what the panel shows starts below
 *   a header stuck at its top (ArrowUp left the highlight under the name
 *   field row), a header not laid out does not count.
 *
 * The geometry (a real short window, a real click on the last entry, a real
 * pointer over a sub-menu) is `database-menu-fits-viewport.spec.ts`.
 */
import { describe, expect, test } from 'vitest';

import {
  capToRoom,
  scrollDeltaToShow,
  scrollViewOf,
} from '../context-menu/fit-window.js';

/** Content height of the panel under test. */
const CONTENT = 460;
/** Room shorter than the content, with a fraction to round down. */
const SHORT_ROOM = 312.6;
/** Room taller than the content. */
const TALL_ROOM = 600;
/** How far the reader had scrolled the panel. */
const SCROLLED = 120;

/** A panel whose content measures `CONTENT`, whatever its cap. */
function panelOf() {
  const panel = document.createElement('div');
  Object.defineProperty(panel, 'scrollHeight', { get: () => CONTENT });
  document.body.append(panel);
  return panel;
}

describe('a panel and the room on its side', () => {
  test('taller than the room: capped there, scrolling, sideways shut', () => {
    const panel = panelOf();
    capToRoom(panel, SHORT_ROOM);
    expect(panel.style.maxHeight).toBe('312px');
    expect(panel.style.overflowY).toBe('auto');
    expect(panel.style.overflowX).toBe('hidden');
  });

  test('fitting: no cap and no scroll, and none left from before', () => {
    const panel = panelOf();
    capToRoom(panel, SHORT_ROOM);
    capToRoom(panel, TALL_ROOM);
    expect(panel.style.maxHeight).toBe('');
    expect(panel.style.overflowY).toBe('');
    expect(panel.style.overflowX).toBe('');
  });

  test('a new placement keeps where the reader scrolled', () => {
    const panel = panelOf();
    capToRoom(panel, SHORT_ROOM);
    panel.scrollTop = SCROLLED;
    capToRoom(panel, SHORT_ROOM);
    expect(panel.scrollTop).toBe(SCROLLED);
  });
});

/** A panel shown from y 100 to 300, and entries around it. */
const PANEL = { top: 100, bottom: 300 };
/** Where a name field row stuck at the panel's top ends. */
const STUCK_HEADER_BOTTOM = 140;
const HIGHLIGHTS = [
  { where: 'shown', entry: { top: 120, bottom: 150 }, delta: 0 },
  { where: 'below the panel', entry: { top: 310, bottom: 340 }, delta: 40 },
  { where: 'above the panel', entry: { top: 80, bottom: 110 }, delta: -20 },
];

describe('the keyboard highlight and the panel', () => {
  test.each(HIGHLIGHTS)(
    'an entry $where scrolls it by just enough',
    ({ entry, delta }) => {
      expect(scrollDeltaToShow(PANEL, entry)).toBe(delta);
    }
  );
});

/** A box whose client rect and height are given (no layout engine here). */
function boxOf(top: number, bottom: number, laidOut = true) {
  const element = document.createElement('div');
  element.getBoundingClientRect = () =>
    ({
      top,
      bottom,
      left: 0,
      right: 0,
      width: 0,
      height: bottom - top,
    }) as DOMRect;
  Object.defineProperty(element, 'offsetHeight', {
    get: () => (laidOut ? bottom - top : 0),
  });
  Object.defineProperty(element, 'clientHeight', { get: () => bottom - top });
  return element;
}

describe('what a scrolling panel shows', () => {
  test('starts below the header stuck at its top', () => {
    const panel = boxOf(PANEL.top, PANEL.bottom);
    const header = boxOf(PANEL.top, STUCK_HEADER_BOTTOM);
    expect(scrollViewOf(panel, [header])).toEqual({
      top: STUCK_HEADER_BOTTOM,
      bottom: PANEL.bottom,
    });
  });

  test('ignores a header that is not laid out', () => {
    const panel = boxOf(PANEL.top, PANEL.bottom);
    const hidden = boxOf(PANEL.top, STUCK_HEADER_BOTTOM, false);
    expect(scrollViewOf(panel, [hidden]).top).toBe(PANEL.top);
  });
});
