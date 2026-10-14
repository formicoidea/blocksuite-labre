import { Button, type ValuesState } from '@labre/data-view';
import type { BlockStdScope } from '@labre/std';
import { signal } from '@preact/signals-core';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

import { DatabaseValuesBanner } from '../components/values-banner.js';

/**
 * `DatabaseValuesLoadFailed` (ADR 0035 §12, B17; telemetry README,
 * "Databases"), a health event the hydration banner reports.
 *
 * What it would have caught:
 * - one event per banner drawn or per re-render instead of one per failure
 *   of a source: a block re-rendered, or two views of one source, would
 *   multiply the series;
 * - a second failure of the same source (a Retry that failed again, a new
 *   `since`) swallowed by the de-duplication;
 * - a loading or ready source reported as failed;
 * - anything but `retryable` crossing the bus.
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

async function mount(
  source: DatabaseValuesBanner['dataSource'],
  trace: DatabaseValuesBanner['trace']
) {
  const banner = document.createElement('affine-database-values-banner');
  banner.dataSource = source;
  banner.std = std;
  banner.trace = trace;
  document.body.append(banner);
  await banner.updateComplete;
  return banner;
}

afterEach(() => {
  document.body.innerHTML = '';
});

describe('DatabaseValuesLoadFailed', () => {
  it('is reported once per failure of a source, not per banner', async () => {
    const trace = vi.fn();
    const state$ = signal<ValuesState>({ status: 'loading', since: 1 });
    const source = { valuesState$: state$, retryValues: vi.fn() };
    await mount(source, trace);
    expect(trace).not.toHaveBeenCalled();

    state$.value = { status: 'error', since: 2 };
    expect(trace).toHaveBeenCalledTimes(1);
    expect(trace).toHaveBeenCalledWith('DatabaseValuesLoadFailed', {
      retryable: true,
    });

    // A second banner over the same source, the same failure: nothing more.
    await mount(source, trace);
    expect(trace).toHaveBeenCalledTimes(1);

    // Retry, then a new failure: reported.
    state$.value = { status: 'loading', since: 3 };
    state$.value = { status: 'error', since: 4 };
    expect(trace).toHaveBeenCalledTimes(2);
  });

  it('says when the source cannot retry, and is silent without a tracer', async () => {
    const trace = vi.fn();
    await mount(
      { valuesState$: signal<ValuesState>({ status: 'error', since: 0 }) },
      trace
    );
    expect(trace).toHaveBeenCalledWith('DatabaseValuesLoadFailed', {
      retryable: false,
    });
    const banner = await mount(
      { valuesState$: signal<ValuesState>({ status: 'error', since: 0 }) },
      undefined
    );
    expect(
      banner.querySelector('[data-testid="database-values-error"]')
    ).not.toBe(null);
  });
});
