import { afterEach, describe, expect, test } from 'vitest';

import { UIEventDispatcher } from '../event/dispatcher.js';
import type { BlockStdScope } from '../scope/index.js';

const cleanups: (() => void)[] = [];

afterEach(() => {
  while (cleanups.length) cleanups.pop()?.();
  document.getSelection()?.removeAllRanges();
});

/**
 * A mounted dispatcher over a bare host element. `mounted()` only reaches the
 * store through `std.dnd` and `std.provider`, so a stub is enough here — the
 * tests exercise the activation listeners, not event scoping.
 */
function mountDispatcher() {
  const host = document.createElement('div');
  host.textContent = 'inside the editor';
  const outside = document.createElement('div');
  outside.textContent = 'outside the editor';
  document.body.append(host, outside);

  const std = {
    host,
    dnd: { monitor: () => () => {} },
    provider: { getAll: () => [] },
  } as unknown as BlockStdScope;
  // PointerControl reaches the scope back through the host element.
  Object.assign(host, { std });

  const dispatcher = new UIEventDispatcher(std);
  dispatcher.mounted();
  dispatcher.active = true;

  cleanups.push(() => {
    dispatcher.unmounted();
    dispatcher.active = false;
    host.remove();
    outside.remove();
  });

  return { dispatcher, host, outside };
}

/** Select the contents of `node` and wait for `selectionchange` to be delivered. */
async function selectContentsOf(node: Node) {
  const selection = document.getSelection();
  if (!selection) throw new Error('no selection');
  const range = document.createRange();
  range.selectNodeContents(node);
  selection.removeAllRanges();
  selection.addRange(range);
  // `selectionchange` is queued, not dispatched synchronously.
  await new Promise(resolve => setTimeout(resolve, 0));
}

describe('UIEventDispatcher activation', () => {
  test('deactivates when the selection moves outside the host', async () => {
    const { dispatcher, outside } = mountDispatcher();

    await selectContentsOf(outside);

    expect(dispatcher.active).toBe(false);
  });

  test('stays active while the selection is inside the host', async () => {
    const { dispatcher, host } = mountDispatcher();

    await selectContentsOf(host);

    expect(dispatcher.active).toBe(true);
  });

  test('stays active when there is no selection range', async () => {
    const { dispatcher } = mountDispatcher();

    document.getSelection()?.removeAllRanges();
    await new Promise(resolve => setTimeout(resolve, 0));

    expect(dispatcher.active).toBe(true);
  });
});
