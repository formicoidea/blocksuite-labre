import { Container } from '@labre/global/di';
import { describe, expect, it, vi } from 'vitest';

import {
  DatabaseOpenRowExtension,
  DatabaseOpenRowProvider,
  databaseOpenRowRequest,
  openInOf,
} from '../service/open-row.js';

/**
 * The row-open seam (ADR 0035 §9a, issue B9) and the one rule every view's
 * row opening goes through (`DataViewRootUILogic.openDetailPanel` lands in
 * the database block, which asks `databaseOpenRowRequest`).
 *
 * What it would have caught:
 * - the seam answering when the host registered nothing or `null`, which
 *   would take the 0.48 peek view away from every host that never heard of
 *   it (`di.addImpl`, or a library default slipped in);
 * - a block-backed row (an inline database) sent to the host as if it were
 *   a document;
 * - a view's stored `openIn` ignored, an absent one not reading `side`, or a
 *   value appended by a later client passed through as a mode this host's
 *   type does not have;
 * - a Ctrl/Cmd click not forcing `full` in a new tab.
 */

function resolve(extensions: { setup: (di: Container) => void }[]) {
  const container = new Container();
  for (const extension of extensions) extension.setup(container);
  return container.provider().getOptional(DatabaseOpenRowProvider);
}

const BASE = {
  hasOpener: true,
  rowsAreDocuments: true,
  rowId: 'doc-1',
  viewId: 'view-1',
  blockId: 'block-1',
};

describe('DatabaseOpenRowExtension', () => {
  it('answers nothing without a provider, or with null', () => {
    expect(resolve([])).toBeFalsy();
    expect(resolve([DatabaseOpenRowExtension(null)])).toBeFalsy();
  });

  it("answers the host's opener, and a later registration wins", () => {
    const first = { open: vi.fn() };
    const second = { open: vi.fn() };
    expect(resolve([DatabaseOpenRowExtension(first)])).toBe(first);
    expect(
      resolve([
        DatabaseOpenRowExtension(first),
        DatabaseOpenRowExtension(second),
      ])
    ).toBe(second);
  });
});

describe('databaseOpenRowRequest', () => {
  it('keeps the library path without an opener or for block rows', () => {
    expect(
      databaseOpenRowRequest({ ...BASE, hasOpener: false, openIn: 'center' })
    ).toBeNull();
    expect(
      databaseOpenRowRequest({
        ...BASE,
        rowsAreDocuments: false,
        openIn: 'center',
      })
    ).toBeNull();
  });

  it("sends the view's stored openIn, side when absent", () => {
    expect(databaseOpenRowRequest({ ...BASE, openIn: undefined })).toEqual({
      docId: 'doc-1',
      mode: 'side',
      newTab: false,
      viewId: 'view-1',
      blockId: 'block-1',
    });
    expect(databaseOpenRowRequest({ ...BASE, openIn: 'center' })?.mode).toBe(
      'center'
    );
    expect(databaseOpenRowRequest({ ...BASE, openIn: 'full' })?.mode).toBe(
      'full'
    );
  });

  it('opens a Ctrl/Cmd click full, in a new tab, whatever the view says', () => {
    expect(
      databaseOpenRowRequest({ ...BASE, openIn: 'side', newTab: true })
    ).toMatchObject({ mode: 'full', newTab: true });
  });

  it('reads an openIn appended by a later client as side', () => {
    expect(openInOf('popover-2031')).toBe('side');
    expect(openInOf(42)).toBe('side');
    expect(openInOf('center')).toBe('center');
  });
});
