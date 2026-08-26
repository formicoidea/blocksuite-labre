/**
 * `PivotPropertiesProvider` — the injectable `pivotDocId` → properties seam
 * (MF1, ADR 0006).
 *
 * The spec is written around the three properties that are load-bearing, in
 * the sense that losing any of them silently re-couples the editor to the
 * host's data layer:
 *
 * 1. **Synchronous at the call.** No `Promise` on the read path, so no call
 *    site can `await` one. The signal settles later; the library never waits.
 * 2. **The provider is asked for the configured fields and NOTHING else** — a
 *    hover must not pay for properties it will not draw. `hoverFields: []`
 *    means no call at all, not "call and ignore".
 * 3. **The degraded path is the DEFAULT path**, because no noop is registered.
 *    Standalone playground and unit tests run without a provider, so it is the
 *    configuration that gets exercised most and it must never look broken.
 */
import type { BlockStdScope } from '@labre/std';
import { computed, signal } from '@preact/signals-core';
import { describe, expect, test, vi } from 'vitest';

import {
  PivotPropertiesConfigIdentifier,
  PivotPropertiesProvider,
  peekPivotProperties,
  publishOccurrenceMaterialities,
  queryPivotProperties,
  type OccurrenceMaterialityPatch,
  type PivotPropertiesConfig,
  type PivotPropertiesService,
  type PivotQueryState,
  type PivotSnapshot,
} from '../../services/pivot-properties-service.js';

const RECORD = 'pivot-payments';

const snapshot = (properties: PivotSnapshot['properties']): PivotSnapshot => ({
  docId: RECORD,
  title: 'Payments',
  properties,
});

/**
 * The smallest `std` the seam reads: two optional lookups and nothing else.
 * Anything the provider needs beyond this would be a coupling the ADR forbids.
 */
function stubStd(
  service?: PivotPropertiesService,
  config?: PivotPropertiesConfig
): BlockStdScope {
  return {
    getOptional: (identifier: unknown) => {
      if (identifier === PivotPropertiesProvider) return service;
      if (identifier === PivotPropertiesConfigIdentifier) return config;
      return undefined;
    },
  } as unknown as BlockStdScope;
}

/**
 * A spy provider. Records every call so the test can assert what was asked for,
 * which is the only way to check the "ONLY these fields" contract from the
 * library's side.
 */
function spyProvider(state: PivotQueryState = { status: 'loading' }) {
  const calls: { pivotDocId: string; fields: readonly string[] }[] = [];
  const peeks: { pivotDocId: string; fields: readonly string[] }[] = [];
  const published: OccurrenceMaterialityPatch[] = [];
  const current = signal<PivotQueryState>(state);

  const service: PivotPropertiesService = {
    properties$: (pivotDocId, opts) => {
      calls.push({ pivotDocId, fields: opts.fields });
      return computed(() => current.value);
    },
    peek: (pivotDocId, opts) => {
      peeks.push({ pivotDocId, fields: opts.fields });
      return undefined;
    },
    publishOccurrenceMaterialities: patch => {
      published.push(patch);
    },
  };

  return { service, calls, peeks, published, current };
}

const HOVER_FIELDS = ['owner', 'status'];

describe('properties$ is synchronous, and settles later', () => {
  test('returns a signal at the call, with no await anywhere on the path', () => {
    const { service } = spyProvider();
    const state$ = queryPivotProperties(
      stubStd(service, { hoverFields: HOVER_FIELDS }),
      RECORD
    );

    // The whole point: a value, now. Not a Promise, not undefined-until-ready.
    expect(state$).toBeTruthy();
    expect(state$!.value).toEqual({ status: 'loading' });
    expect(state$!.value).not.toBeInstanceOf(Promise);
  });

  test('loading → ready without the caller re-querying', () => {
    const { service, current } = spyProvider();
    const state$ = queryPivotProperties(
      stubStd(service, { hoverFields: HOVER_FIELDS }),
      RECORD
    )!;

    expect(state$.value.status).toBe('loading');

    current.value = {
      status: 'ready',
      snapshot: snapshot([
        { key: 'owner', label: 'Owner', value: { kind: 'text', value: 'Ada' } },
      ]),
    };

    expect(state$.value).toEqual({
      status: 'ready',
      snapshot: expect.objectContaining({ title: 'Payments' }),
    });
  });

  test('a dangling binding resolves to missing, not to an error', () => {
    const { service } = spyProvider({ status: 'missing' });
    const state$ = queryPivotProperties(
      stubStd(service, { hoverFields: HOVER_FIELDS }),
      RECORD
    )!;

    // The record was deleted, or this user cannot see it. The binding survives
    // on the element either way — the library never deletes host data.
    expect(state$.value).toEqual({ status: 'missing' });
  });
});

describe('the provider is asked for the configured fields and nothing else', () => {
  test('the configured list is passed explicitly, in order', () => {
    const { service, calls } = spyProvider();

    queryPivotProperties(
      stubStd(service, { hoverFields: HOVER_FIELDS }),
      RECORD
    );

    // Explicit rather than implicit so the provider's cache key is complete:
    // `(pivotDocId, fields)`. A config change must not serve a snapshot
    // computed for a different field set.
    expect(calls).toEqual([{ pivotDocId: RECORD, fields: HOVER_FIELDS }]);
  });

  test('hoverFields: [] means NO call — not a call whose answer is ignored', () => {
    const { service, calls, peeks } = spyProvider();
    const std = stubStd(service, { hoverFields: [] });

    expect(queryPivotProperties(std, RECORD)).toBeUndefined();
    expect(peekPivotProperties(std, RECORD)).toBeUndefined();

    // No call, no request, no work. This is the deliberate opt-out for hosts
    // that want the hover to stay purely local, and the only way to prove it
    // is from the provider's side.
    expect(calls).toEqual([]);
    expect(peeks).toEqual([]);
  });

  test('a registered provider with no config degrades to hoverFields: []', () => {
    const { service, calls } = spyProvider();

    // Host wiring error, not a crash: same observable behaviour as no provider.
    expect(
      queryPivotProperties(stubStd(service, undefined), RECORD)
    ).toBeUndefined();
    expect(calls).toEqual([]);
  });

  test('a second surface may ask for a different set later', () => {
    const { service, calls } = spyProvider();

    queryPivotProperties(stubStd(service, { hoverFields: ['owner'] }), RECORD);
    queryPivotProperties(stubStd(service, { hoverFields: ['status'] }), RECORD);

    expect(calls.map(c => c.fields)).toEqual([['owner'], ['status']]);
  });
});

describe('degradation with no provider registered', () => {
  test('the read yields undefined — not missing, not error, not a spinner', () => {
    const std = stubStd(undefined, { hoverFields: HOVER_FIELDS });

    // NO noop default is registered on purpose: absence is a MEANINGFUL state
    // (standalone playground, tests, a host build that failed to register), so
    // making it the tested default keeps this path honest.
    expect(queryPivotProperties(std, RECORD)).toBeUndefined();
    expect(peekPivotProperties(std, RECORD)).toBeUndefined();
  });

  test('undefined is not conflated with missing', () => {
    const { service } = spyProvider({ status: 'missing' });

    // "This editor has no host data layer" and "that record is gone" are
    // different facts. Folding the first into the second would put a discreet
    // error line in front of every standalone user, forever.
    expect(queryPivotProperties(stubStd(undefined), RECORD)).toBeUndefined();
    expect(
      queryPivotProperties(
        stubStd(service, { hoverFields: HOVER_FIELDS }),
        RECORD
      )!.value
    ).toEqual({ status: 'missing' });
  });

  test('the write-back is a silent no-op with no provider', () => {
    expect(() =>
      publishOccurrenceMaterialities(stubStd(undefined), {
        pivotDocId: RECORD,
        elementId: 'el-1',
        framework: 'wardley',
        role: 'wardley:component',
        tags: {},
        present: true,
      })
    ).not.toThrow();
  });

  test('a provider that implements only properties$ is legal', () => {
    // `peek` and `publishOccurrenceMaterialities` are optional members so the
    // interface can grow without breaking an older host.
    const minimal: PivotPropertiesService = {
      properties$: () => computed(() => ({ status: 'missing' })),
    };
    const std = stubStd(minimal, { hoverFields: HOVER_FIELDS });

    expect(peekPivotProperties(std, RECORD)).toBeUndefined();
    expect(() =>
      publishOccurrenceMaterialities(std, {
        pivotDocId: RECORD,
        elementId: 'el-1',
        framework: 'wardley',
        role: undefined,
        tags: {},
        present: false,
      })
    ).not.toThrow();
  });
});

describe('a throwing host never reaches the user', () => {
  test('properties$ throwing becomes an error state, not a crash-on-hover', () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    const service: PivotPropertiesService = {
      properties$: () => {
        throw new Error('host data layer exploded');
      },
    };

    const state$ = queryPivotProperties(
      stubStd(service, { hoverFields: HOVER_FIELDS }),
      RECORD
    )!;

    // `MUST NOT throw` is a contract for hosts, not an assumption the library
    // is entitled to make: this sits on the hover path, one bad host build away
    // from taking the board down.
    expect(state$.value).toEqual({
      status: 'error',
      reason: 'host data layer exploded',
    });
    expect(error).toHaveBeenCalled();
    error.mockRestore();
  });

  test('peek throwing costs nothing but the flash it was meant to avoid', () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    const service: PivotPropertiesService = {
      properties$: () => computed(() => ({ status: 'loading' })),
      peek: () => {
        throw new Error('cache exploded');
      },
    };

    expect(
      peekPivotProperties(
        stubStd(service, { hoverFields: HOVER_FIELDS }),
        RECORD
      )
    ).toBeUndefined();
    expect(error).toHaveBeenCalled();
    error.mockRestore();
  });

  test('publishOccurrenceMaterialities throwing is swallowed', () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    const service: PivotPropertiesService = {
      properties$: () => computed(() => ({ status: 'loading' })),
      publishOccurrenceMaterialities: () => {
        throw new Error('write-back exploded');
      },
    };

    // Fire-and-forget by contract: `void`, so there is nothing a caller could
    // do with the failure. The element remains the source of truth either way.
    expect(() =>
      publishOccurrenceMaterialities(stubStd(service), {
        pivotDocId: RECORD,
        elementId: 'el-1',
        framework: 'wardley',
        role: 'wardley:component',
        tags: { 'wardley:criticality': ['high'] },
        present: true,
      })
    ).not.toThrow();
    expect(error).toHaveBeenCalled();
    error.mockRestore();
  });
});

describe('the write-back channel', () => {
  test('the patch reaches the host verbatim, and returns void', () => {
    const { service, published } = spyProvider();
    const patch: OccurrenceMaterialityPatch = {
      pivotDocId: RECORD,
      elementId: 'el-1',
      framework: 'wardley',
      role: 'wardley:component',
      tags: { 'wardley:criticality': ['high'] },
      present: true,
    };

    const result = publishOccurrenceMaterialities(stubStd(service), patch);

    expect(result).toBeUndefined();
    expect(published).toEqual([patch]);
  });

  test('a retraction carries the occurrence key and nothing else', () => {
    const { service, published } = spyProvider();

    publishOccurrenceMaterialities(stubStd(service), {
      pivotDocId: RECORD,
      elementId: 'el-1',
      framework: 'wardley',
      role: undefined,
      tags: {},
      present: false,
    });

    // Keyed by (pivotDocId, elementId) so ONE occurrence can be retracted
    // without touching what the record's other occurrences contributed.
    expect(published[0]).toMatchObject({
      elementId: 'el-1',
      present: false,
      role: undefined,
      tags: {},
    });
  });
});
