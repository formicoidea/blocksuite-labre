import type { AnyCommandDescriptor, CommandInvocation } from '@labre/std';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

import {
  COMMAND_USAGE_KEY,
  createLocalCommandUsageStore,
} from '../../services/command-usage-service.js';

/**
 * The measurement half of PF6's ranking: `runCommand` records every invocation,
 * and the sub-menu will later ask for "most-used" and "most-recent". What is
 * tested here is therefore the pair of numbers — and the fact that a browser
 * refusing `localStorage` costs a measure, never a command.
 */
const command = (id: string) => ({ id }) as AnyCommandDescriptor;

const invocation: CommandInvocation = {
  surface: 'senior-menu',
  source: 'toolbar:general',
};

describe('local command usage store', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  test('an unknown command has no stats', () => {
    expect(createLocalCommandUsageStore().statsOf('wardley.addMap')).toBe(
      undefined
    );
  });

  test('a recorded invocation round-trips through storage', () => {
    vi.spyOn(Date, 'now').mockReturnValue(1_700_000_000_000);
    createLocalCommandUsageStore().record(
      command('wardley.addComponent'),
      invocation
    );

    // A second store instance reads the same numbers: the measure lives in
    // storage, not in a closure that dies with the editor.
    expect(
      createLocalCommandUsageStore().statsOf('wardley.addComponent')
    ).toEqual({ count: 1, lastUsedAt: 1_700_000_000_000 });
  });

  test('count accumulates and lastUsedAt moves to the latest run', () => {
    const store = createLocalCommandUsageStore();
    const now = vi.spyOn(Date, 'now').mockReturnValue(1_000);
    store.record(command('bpmn.addPool'), invocation);
    now.mockReturnValue(9_000);
    store.record(command('bpmn.addPool'), invocation);
    store.record(command('bpmn.addTask'), invocation);

    expect(store.statsOf('bpmn.addPool')).toEqual({
      count: 2,
      lastUsedAt: 9_000,
    });
    expect(store.statsOf('bpmn.addTask')).toEqual({
      count: 1,
      lastUsedAt: 9_000,
    });
  });

  test('overflow evicts the least recently used entry, keeping 200', () => {
    const store = createLocalCommandUsageStore();
    const now = vi.spyOn(Date, 'now');
    for (let i = 0; i < 201; i++) {
      now.mockReturnValue(1_000 + i);
      store.record(command(`cmd.${i}`), invocation);
    }

    const stored = JSON.parse(localStorage.getItem(COMMAND_USAGE_KEY) ?? '{}');
    expect(Object.keys(stored)).toHaveLength(200);
    expect(store.statsOf('cmd.0')).toBe(undefined);
    expect(store.statsOf('cmd.1')).toBeTruthy();
    expect(store.statsOf('cmd.200')).toEqual({ count: 1, lastUsedAt: 1_200 });
  });

  test('a corrupted table loses only the entries it corrupted', () => {
    localStorage.setItem(
      COMMAND_USAGE_KEY,
      JSON.stringify({ 'a.one': { c: 3, t: 42 }, 'a.two': 'nonsense' })
    );
    const store = createLocalCommandUsageStore();

    expect(store.statsOf('a.one')).toEqual({ count: 3, lastUsedAt: 42 });
    expect(store.statsOf('a.two')).toBe(undefined);
  });

  test('unparseable storage reads as empty rather than throwing', () => {
    localStorage.setItem(COMMAND_USAGE_KEY, '{not json');
    expect(createLocalCommandUsageStore().statsOf('a.one')).toBe(undefined);
  });

  describe('when the storage getter itself throws', () => {
    const descriptor = Object.getOwnPropertyDescriptor(
      globalThis,
      'localStorage'
    );

    beforeEach(() => {
      Object.defineProperty(globalThis, 'localStorage', {
        configurable: true,
        get() {
          throw new Error('storage disabled');
        },
      });
    });

    afterEach(() => {
      if (descriptor) {
        Object.defineProperty(globalThis, 'localStorage', descriptor);
      }
    });

    test('recording and reading are silent no-ops', () => {
      const store = createLocalCommandUsageStore();
      expect(() =>
        store.record(command('wardley.addMap'), invocation)
      ).not.toThrow();
      expect(store.statsOf('wardley.addMap')).toBe(undefined);
    });
  });
});
