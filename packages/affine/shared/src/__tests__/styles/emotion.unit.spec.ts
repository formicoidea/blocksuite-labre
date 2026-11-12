/**
 * The library's emotion instance is its own, and inserts synchronously until
 * a page adopts its rules (ADR 0050, ADR 0051).
 *
 * A first version patched the sheet of `@emotion/css`'s DEFAULT instance and
 * deferred every insertion to a microtask, in every editor: a host sharing
 * `@emotion/css` (a deduplicated install) had its own rules deferred too,
 * broke on a measure taken right after `css()`, and could see its cascade
 * order flip.
 *
 * What it would catch:
 * - the default instance's `sheet.insert` replaced by the library;
 * - a library rule that is not in the page right after `css()` returns;
 * - library classes no longer under the library's own `labre` key.
 */
import { cache as defaultCache } from '@emotion/css';
import { describe, expect, test } from 'vitest';

import { css } from '../../styles/emotion';

describe("the library's emotion instance", () => {
  test('inserts a rule synchronously, under its own key', () => {
    const className = css({ color: 'rgb(1, 2, 3)' });
    expect(className.startsWith('labre-')).toBe(true);
    const written = [...document.querySelectorAll('style')].some(style =>
      style.textContent?.includes('rgb(1, 2, 3)')
    );
    expect(written).toBe(true);
  });

  test("leaves emotion's default instance alone", () => {
    expect(
      Object.prototype.hasOwnProperty.call(defaultCache.sheet, 'insert')
    ).toBe(false);
  });
});
