import { Container } from '@labre/global/di';
import { describe, expect, it, vi } from 'vitest';

import {
  DatabaseNewRowMenuExtension,
  DatabaseNewRowMenuProvider,
  type DatabaseNewRowMenuService,
  type DatabaseNewRowMenuTarget,
} from '../service/new-row-menu.js';
import {
  DATABASE_NEW_RECORD_MORE,
  DATABASE_WORDINGS,
} from '../translations.js';

/**
 * The menu beside "New" (ADR 0035 amendment of 2026-10-14, labre PRD
 * REQ-DB-6, 14 and 15): the seam a host fills to offer its templates.
 *
 * What it would have caught:
 * - the seam answering when the host registered nothing or `null`, which
 *   would draw a chevron opening nothing in every host that never heard of
 *   it (`di.addImpl`, or a library default slipped in);
 * - a second registration throwing at boot instead of winning;
 * - the chevron's wording losing its key;
 * - `canOpen` made required, or its request changed shape: a host built on
 *   the seam's first release (`{ open }` alone) would stop compiling, and
 *   one that answers per block would stop being asked by block and view.
 *
 * The block's wiring (no chevron without the seam, the chevron's request,
 * the main part still adding a row) is held in a real editor by
 * `integration-test/…/page/database-seams.spec.ts`; the header button by
 * `data-view/src/__tests__/new-row-menu.unit.spec.ts`.
 */

function resolve(extensions: { setup: (di: Container) => void }[]) {
  const container = new Container();
  for (const extension of extensions) extension.setup(container);
  return container.provider().getOptional(DatabaseNewRowMenuProvider);
}

describe('DatabaseNewRowMenuExtension', () => {
  it('answers nothing without a provider, or with null', () => {
    expect(resolve([])).toBeFalsy();
    expect(resolve([DatabaseNewRowMenuExtension(null)])).toBeFalsy();
  });

  it("answers the host's menu, and a later registration wins", () => {
    const first = { open: vi.fn() };
    const second = { open: vi.fn() };
    expect(resolve([DatabaseNewRowMenuExtension(first)])).toBe(first);
    expect(
      resolve([
        DatabaseNewRowMenuExtension(first),
        DatabaseNewRowMenuExtension(second),
      ])
    ).toBe(second);
  });

  it('only widens: open alone still types, canOpen takes the block and the view', () => {
    const firstRelease: DatabaseNewRowMenuService = { open: () => {} };
    const target: DatabaseNewRowMenuTarget = { blockId: 'b', viewId: 'v' };
    const perBlock: DatabaseNewRowMenuService = {
      open: () => {},
      canOpen: ({ blockId, viewId }) => blockId === 'b' && viewId === 'v',
    };
    expect(firstRelease.canOpen).toBeUndefined();
    expect(perBlock.canOpen?.(target)).toBe(true);
    expect(resolve([DatabaseNewRowMenuExtension(perBlock)])).toBe(perBlock);
  });

  it('labels the chevron with a key', () => {
    expect(DATABASE_NEW_RECORD_MORE).toEqual([
      'com.labre.database.new-record.more',
      'Templates and options',
    ]);
    expect(DATABASE_WORDINGS).toContain(DATABASE_NEW_RECORD_MORE);
  });
});
