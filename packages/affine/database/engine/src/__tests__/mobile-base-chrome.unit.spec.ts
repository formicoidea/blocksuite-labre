import { describe, expect, test, vi } from 'vitest';

/**
 * A base's chrome on a phone (P7, "Vues de base sur mobile", 390px).
 *
 * What it would have caught:
 * - the table clipped at the phone's width (upstream's `overflowX: hidden`),
 *   every column past the first out of reach;
 * - the title column scrolling away, or see-through over the cells passing
 *   under it;
 * - "N more" and "+" wrapping under the current view's tab and over
 *   "+ Add filter", the views bar being of fixed height;
 * - the overflow measuring a tab that had shrunk with its item, which reads
 *   as room that is not there and draws every tab squashed to its icon;
 * - the view menu (24px), the search (24px), "+ New" (32px) and
 *   "+ Add filter" (30px) under a finger's 44px;
 * - search hidden on a phone with no other way in (filter and sort have the
 *   view menu);
 * - "New Record", "New", "Ungroups", "Add filter" and the search box drawn
 *   in English whatever the host's language.
 */
vi.mock('@labre/global/env', async importOriginal => ({
  ...(await importOriginal<typeof import('@labre/global/env')>()),
  IS_MOBILE: true,
}));

import { ROW_COLOR_PROPERTY } from '../core/view/color-rules.js';
import {
  mobileStickyTitle,
  mobileTableViewWrapper,
} from '../view-presets/table/mobile/table-view-style.js';
import { FilterBar } from '../widget-presets/quick-setting-bar/filter/list-view.js';
import { DataViewHeaderToolsSearch } from '../widget-presets/tools/presets/search/search.js';
import { DataViewHeaderToolsAddRow } from '../widget-presets/tools/presets/table-add-row/add-row.js';
import { DataViewHeaderToolsViewOptions } from '../widget-presets/tools/presets/view-options/view-options.js';
import { DataViewHeaderViews } from '../widget-presets/views-bar/views-view.js';
import {
  DATA_VIEW_ADD_FILTER,
  DATA_VIEW_NEW_RECORD,
  DATA_VIEW_SEARCH_CLEAR_HINT,
  DATA_VIEW_SEARCH_PLACEHOLDER,
  DATA_VIEW_UNGROUPED,
  DATA_VIEW_WORDINGS,
} from '../translations.js';

const cssOf = (styles: unknown) =>
  [styles].flat(Infinity).join('\n').replace(/\s+/g, ' ');

const coarse = (styles: unknown) =>
  cssOf(styles).match(/@media \(pointer: coarse\) \{(.*?)\} \}/)?.[1] ?? '';

/** The rules emotion injected for a class name, as text. */
const emotionRule = (className: string) =>
  Array.from(document.styleSheets)
    .flatMap(sheet => Array.from(sheet.cssRules))
    .map(rule => rule.cssText)
    .filter(text => text.startsWith(`.${className}`))
    .join(' ')
    .concat(
      Array.from(document.querySelectorAll('style'))
        .map(style => style.textContent ?? '')
        .filter(text => text.includes(`.${className}{`))
        .join(' ')
    );

describe('mobile table', () => {
  test('scrolls sideways inside its wrapper', () => {
    expect(emotionRule(mobileTableViewWrapper)).toMatch(/overflow-x: ?auto/);
  });

  test('keeps an opaque title column in view', () => {
    const rule = emotionRule(mobileStickyTitle);
    expect(rule).toMatch(/position: ?sticky/);
    expect(rule).toMatch(/left: ?0/);
    expect(rule).toMatch(
      /background-color: ?var\(--affine-background-primary-color\)/
    );
    expect(rule).toContain(ROW_COLOR_PROPERTY);
  });
});

describe('views bar', () => {
  const css = cssOf(DataViewHeaderViews.styles);

  test('never wraps "N more" and "+" under the tabs', () => {
    expect(css).toContain(
      'data-view-header-views component-overflow { flex-wrap: nowrap; }'
    );
    expect(css).toMatch(
      /data-view-header-views \.component-overflow-more \{[^}]*flex-shrink: 0/
    );
  });

  test('a tab keeps its own width, so the overflow measures it whole', () => {
    expect(css).toMatch(
      /\.component-overflow-item \{[^}]*min-width: 44px;[^}]*overflow: hidden/
    );
    expect(css).toContain(
      '.component-overflow-item > * { width: max-content; }'
    );
  });
});

describe('touch targets', () => {
  test.each([
    [
      'view menu',
      DataViewHeaderToolsViewOptions.styles,
      /more-action \{[^}]*min-width: 44px;[^}]*min-height: 44px/,
    ],
    [
      'search',
      DataViewHeaderToolsSearch.styles,
      /search-container \{[^}]*width: 44px;[^}]*height: 44px/,
    ],
    [
      'new row',
      DataViewHeaderToolsAddRow.styles,
      /new-record \{[^}]*min-height: 44px/,
    ],
    [
      'add filter',
      FilterBar.styles,
      /filter-bar-add-filter \{[^}]*min-height: 44px/,
    ],
  ])('%s is 44px under a finger', (_, styles, rule) => {
    expect(coarse(styles)).toMatch(rule);
  });
});

test('search stays in the toolbar on a phone', () => {
  if (!customElements.get('test-dv-search')) {
    customElements.define('test-dv-search', DataViewHeaderToolsSearch);
  }
  const search = document.createElement('test-dv-search');
  document.body.append(search);
  expect(search.style.display).toBe('flex');
  search.remove();
});

test('the table chrome words are keys with an English fallback', () => {
  const words = [
    DATA_VIEW_NEW_RECORD,
    DATA_VIEW_UNGROUPED,
    DATA_VIEW_ADD_FILTER,
    DATA_VIEW_SEARCH_PLACEHOLDER,
    DATA_VIEW_SEARCH_CLEAR_HINT,
  ];
  for (const word of words) {
    expect(word[0]).toMatch(/^com\.labre\.data-view\./);
    expect(word[1]).not.toBe('');
    expect(DATA_VIEW_WORDINGS).toContain(word);
  }
});
