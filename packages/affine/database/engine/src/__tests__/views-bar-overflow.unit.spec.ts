import { describe, expect, test } from 'vitest';

import { fitOverflow } from '../core/component/overflow/fit.js';
import {
  DATA_VIEW_WORDINGS,
  VIEWS_BAR_ADD_VIEW,
  VIEWS_BAR_MORE,
} from '../translations.js';

/**
 * The view bar's layout (ADR 0035 B11, labre PRD REQ-DB-7): as many tabs as
 * the width allows, the rest under "N more", and the current view always
 * drawn.
 *
 * What it would have caught:
 * - the 0.48 bar, which drew a prefix of the tabs and hid the current view
 *   under "N More" when it came after them (open the fifth view of a narrow
 *   database: no tab says which view you are on);
 * - a pinned view reordered in front of the others, or pushed beside a
 *   lone "N more" with no room reserved for it;
 * - "+" only drawn when every tab fits (0.48), so a database with many views
 *   could only create one through "N More";
 * - the bar's wording losing its key.
 *
 * The bar itself is held by `integration-test/…/database/views-bar.spec.ts`
 * at 1024px and at a narrow width.
 */
describe('fitOverflow', () => {
  const widths = [100, 100, 100, 100, 100];

  test('every item when they all fit beside the trailing slot', () => {
    expect(
      fitOverflow({ widths, container: 540, trailing: 40, moreExtra: 80 })
    ).toEqual([0, 1, 2, 3, 4]);
  });

  test('a prefix in order, room kept for "+" and "N more"', () => {
    // 400 - 40 - 80 = 280: two tabs.
    expect(
      fitOverflow({ widths, container: 400, trailing: 40, moreExtra: 80 })
    ).toEqual([0, 1]);
  });

  test('stops at the first tab that does not fit, never packs a later one', () => {
    expect(
      fitOverflow({
        widths: [100, 200, 50],
        container: 290,
        trailing: 40,
        moreExtra: 80,
      })
    ).toEqual([0]);
  });

  test('the pinned item takes the place of the last one that would fit', () => {
    expect(
      fitOverflow({
        widths,
        container: 400,
        trailing: 40,
        moreExtra: 80,
        pinned: 4,
      })
    ).toEqual([0, 4]);
  });

  test('a pinned item already in the prefix changes nothing', () => {
    expect(
      fitOverflow({
        widths,
        container: 400,
        trailing: 40,
        moreExtra: 80,
        pinned: 1,
      })
    ).toEqual([0, 1]);
  });

  test('the pinned item is drawn even alone and wider than the room', () => {
    expect(
      fitOverflow({
        widths: [100, 600, 100],
        container: 300,
        trailing: 40,
        moreExtra: 80,
        pinned: 1,
      })
    ).toEqual([1]);
  });

  test('an out-of-range pin is no pin', () => {
    expect(
      fitOverflow({
        widths,
        container: 400,
        trailing: 40,
        moreExtra: 80,
        pinned: 9,
      })
    ).toEqual([0, 1]);
  });

  test('no item, nothing drawn', () => {
    expect(
      fitOverflow({ widths: [], container: 400, trailing: 40, moreExtra: 80 })
    ).toEqual([]);
  });
});

describe('the views bar wording', () => {
  test('"N more" and "+" are keys with an English fallback', () => {
    expect(VIEWS_BAR_MORE).toEqual([
      'com.labre.data-view.views-bar.more',
      '{{count}} more',
    ]);
    expect(VIEWS_BAR_ADD_VIEW[0]).toBe(
      'com.labre.data-view.views-bar.add-view'
    );
    expect(DATA_VIEW_WORDINGS).toContain(VIEWS_BAR_MORE);
    expect(DATA_VIEW_WORDINGS).toContain(VIEWS_BAR_ADD_VIEW);
  });
});
