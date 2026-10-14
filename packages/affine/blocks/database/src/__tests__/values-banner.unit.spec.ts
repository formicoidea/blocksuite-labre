import { Button, type ValuesState } from '@labre/data-view';
import type { BlockStdScope } from '@labre/std';
import { signal } from '@preact/signals-core';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

import { DatabaseValuesBanner } from '../components/values-banner.js';

/**
 * The hydration banner of a database (ADR 0035 §9e, issue B2, REQ-DB-12).
 *
 * What it would have caught:
 * - a banner shown for a source that says nothing about hydration (every
 *   0.48 source), or before the 3 s mark;
 * - the slow banner never appearing because nothing re-renders once 3 s have
 *   passed (the timer, not a toggle, drives it);
 * - an error banner without Retry for a source that can retry, or with a
 *   Retry that does nothing;
 * - a hard-coded wording: both banners go through the translation seam and
 *   fall back to English without a provider.
 */

beforeAll(() => {
  if (!customElements.get('affine-database-values-banner')) {
    customElements.define(
      'affine-database-values-banner',
      DatabaseValuesBanner
    );
  }
  if (!customElements.get('data-view-component-button')) {
    customElements.define('data-view-component-button', Button);
  }
});

const std = { getOptional: () => null } as unknown as BlockStdScope;

async function mount(source: DatabaseValuesBanner['dataSource']) {
  const banner = document.createElement('affine-database-values-banner');
  banner.dataSource = source;
  banner.std = std;
  document.body.append(banner);
  await banner.updateComplete;
  return banner;
}

afterEach(() => {
  document.body.innerHTML = '';
  vi.useRealTimers();
});

describe('affine-database-values-banner', () => {
  it('shows nothing for a source that says nothing', async () => {
    const banner = await mount({});
    expect(banner.textContent?.trim()).toBe('');
  });

  it('says values are loading once 3 s have passed, not before', async () => {
    vi.useFakeTimers();
    const state$ = signal<ValuesState>({
      status: 'loading',
      since: Date.now(),
    });
    const banner = await mount({ valuesState$: state$ });
    expect(
      banner.querySelector('[data-testid="database-values-loading"]')
    ).toBe(null);

    vi.advanceTimersByTime(3000);
    await banner.updateComplete;
    expect(
      banner.querySelector('[data-testid="database-values-loading"]')
        ?.textContent
    ).toContain('Values are still loading');

    state$.value = { status: 'ready', since: Date.now() };
    await banner.updateComplete;
    expect(banner.textContent?.trim()).toBe('');
  });

  it('offers Retry on error when the source can retry', async () => {
    const retryValues = vi.fn();
    const banner = await mount({
      valuesState$: signal<ValuesState>({ status: 'error', since: 0 }),
      retryValues,
    });
    expect(
      banner.querySelector('[data-testid="database-values-error"]')?.textContent
    ).toContain('Values could not be loaded');
    const retry = banner.querySelector<HTMLElement>(
      '[data-testid="database-values-retry"]'
    );
    expect(retry).not.toBe(null);
    retry?.click();
    expect(retryValues).toHaveBeenCalledTimes(1);
  });

  it('shows the error without Retry when the source cannot retry', async () => {
    const banner = await mount({
      valuesState$: signal<ValuesState>({ status: 'error', since: 0 }),
    });
    expect(
      banner.querySelector('[data-testid="database-values-error"]')
    ).not.toBe(null);
    expect(banner.querySelector('[data-testid="database-values-retry"]')).toBe(
      null
    );
  });
});
