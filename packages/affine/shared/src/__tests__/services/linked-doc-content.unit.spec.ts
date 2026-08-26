import type { BlockStdScope } from '@labre/std';
import { describe, expect, test, vi } from 'vitest';

import {
  type LinkedDocContentResolver,
  LinkedDocContentResolverIdentifier,
  whenLinkedDocContentReady,
} from '../../services/linked-doc-content-service.js';

const makeDoc = (hasRoot: boolean) => {
  let cb: (() => void) | null = null;
  const doc = {
    root: hasRoot ? ({} as object) : null,
    slots: {
      rootAdded: {
        subscribe: (fn: () => void) => {
          cb = fn;
          return { unsubscribe: () => (cb = null) };
        },
      },
    },
    fireRootAdded() {
      doc.root = {};
      cb?.();
    },
  };
  return doc;
};

const makeStd = (resolver?: LinkedDocContentResolver) =>
  ({
    getOptional: (id: unknown) =>
      id === LinkedDocContentResolverIdentifier ? resolver : undefined,
  }) as unknown as BlockStdScope;

describe('whenLinkedDocContentReady', () => {
  test('returns true immediately when the doc already has content', async () => {
    const resolve = vi.fn();
    const ready = await whenLinkedDocContentReady(
      makeStd({ resolve }),
      makeDoc(true),
      'd1'
    );
    expect(ready).toBe(true);
    expect(resolve).not.toHaveBeenCalled();
  });

  test('asks the host resolver to hydrate, by doc id', async () => {
    const doc = makeDoc(false);
    const resolve = vi.fn(async () => {
      doc.root = {};
    });
    const ready = await whenLinkedDocContentReady(
      makeStd({ resolve }),
      doc,
      'd2'
    );
    expect(resolve).toHaveBeenCalledWith('d2');
    expect(ready).toBe(true);
  });

  test('resolves true when rootAdded fires before the timeout', async () => {
    const doc = makeDoc(false);
    const p = whenLinkedDocContentReady(makeStd(), doc, 'd3');
    doc.fireRootAdded();
    expect(await p).toBe(true);
  });

  test('degrades to false on timeout when content never arrives', async () => {
    const doc = makeDoc(false);
    const ready = await whenLinkedDocContentReady(
      makeStd({ resolve: async () => {}, timeoutMs: 20 }),
      doc,
      'd4'
    );
    expect(ready).toBe(false);
  });

  test('a throwing resolver does not reject (still degrades)', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const doc = makeDoc(false);
    const ready = await whenLinkedDocContentReady(
      makeStd({
        resolve: () => {
          throw new Error('boom');
        },
        timeoutMs: 20,
      }),
      doc,
      'd5'
    );
    expect(ready).toBe(false);
    spy.mockRestore();
  });
});
