import type { Store } from '@labre/store';
import { describe, expect, test, vi } from 'vitest';

import { shouldRefreshOnPropsUpdate } from '../../utils/link-preview-refresh.js';

const storeWith = (readonly: boolean) => ({ readonly }) as Store;

/**
 * Reproduces what a bookmark or embed card does in its `propsUpdated`
 * subscription, so the test reads like the call sites it protects.
 */
const onPropsUpdated = (store: Store, key: string, refreshData: () => void) => {
  if (shouldRefreshOnPropsUpdate(store, key)) {
    refreshData();
  }
};

describe('shouldRefreshOnPropsUpdate', () => {
  test('the author refetches the preview when the url changes', () => {
    const refreshData = vi.fn();

    onPropsUpdated(storeWith(false), 'url', refreshData);

    expect(refreshData).toHaveBeenCalledTimes(1);
  });

  test('a readonly peer never refetches when another peer changes the url', () => {
    const refreshData = vi.fn();

    onPropsUpdated(storeWith(true), 'url', refreshData);

    expect(refreshData).not.toHaveBeenCalled();
  });

  test('no peer refetches when another prop changes', () => {
    const refreshData = vi.fn();

    onPropsUpdated(storeWith(false), 'title', refreshData);
    onPropsUpdated(storeWith(true), 'title', refreshData);

    expect(refreshData).not.toHaveBeenCalled();
  });
});
