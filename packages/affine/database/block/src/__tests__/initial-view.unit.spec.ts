import { Container } from '@labre/global/di';
import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  DatabaseInitialViewExtension,
  DatabaseInitialViewProvider,
  type DatabaseInitialViewService,
} from '../service/initial-view.js';
import { currentViewStorage, initialViewId } from '../utils/current-view.js';

/**
 * The view a database opens on, chosen by the host (labre recette 3, P2-3:
 * the sidebar lists a base's views, a click opens the base on one).
 *
 * What it would have caught:
 * - the seam answering when the host registered nothing or `null`, which
 *   would change the opening view of every database in a host that never
 *   heard of it;
 * - a second registration throwing at boot instead of winning;
 * - a host's choice the block does not have (a deleted view, a stale link)
 *   opening nothing instead of the view this tab last showed, then the first;
 * - the tab's last view winning over the host's explicit choice.
 *
 * Nothing is written: `initialViewId` only reads, and the block sets the
 * view manager's local signal (`database-block.ts`, `_buildDataSource`).
 */

function resolve(extensions: { setup: (di: Container) => void }[]) {
  const container = new Container();
  for (const extension of extensions) extension.setup(container);
  return container.provider().getOptional(DatabaseInitialViewProvider);
}

const VIEWS = new Set(['v1', 'v2', 'v3']);
const exists = (id: string) => VIEWS.has(id);

// `currentViewStorage` keeps its list in memory for the whole run: each
// case uses its own block ids.
afterEach(() => {
  sessionStorage.clear();
});

describe('DatabaseInitialViewExtension', () => {
  it('answers nothing without a provider, or with null', () => {
    expect(resolve([])).toBeFalsy();
    expect(resolve([DatabaseInitialViewExtension(null)])).toBeFalsy();
  });

  it("answers the host's service, and a later registration wins", () => {
    const first = { initialView: () => 'v1' };
    const second = { initialView: () => 'v2' };
    expect(resolve([DatabaseInitialViewExtension(first)])).toBe(first);
    expect(
      resolve([
        DatabaseInitialViewExtension(first),
        DatabaseInitialViewExtension(second),
      ])
    ).toBe(second);
  });
});

describe('initialViewId', () => {
  it('without a host: the view this tab last showed, else none', () => {
    expect(initialViewId('block-a', exists)).toBeUndefined();
    expect(initialViewId('block-a', exists, null)).toBeUndefined();
    currentViewStorage.setCurrentView('block-a', 'v2');
    expect(initialViewId('block-a', exists)).toBe('v2');
    expect(initialViewId('block-b', exists)).toBeUndefined();
  });

  it("the host's choice wins, asked with the block id", () => {
    currentViewStorage.setCurrentView('block-a', 'v2');
    const host: DatabaseInitialViewService = {
      initialView: vi.fn(({ blockId }) =>
        blockId === 'block-a' ? 'v3' : undefined
      ),
    };
    expect(initialViewId('block-a', exists, host)).toBe('v3');
    expect(host.initialView).toHaveBeenCalledWith({ blockId: 'block-a' });
    expect(initialViewId('block-b', exists, host)).toBeUndefined();
  });

  it('a host view the block does not have falls back to the tab, then none', () => {
    const host = { initialView: () => 'gone' };
    expect(initialViewId('block-c', exists, host)).toBeUndefined();
    currentViewStorage.setCurrentView('block-c', 'v1');
    expect(initialViewId('block-c', exists, host)).toBe('v1');
  });
});
