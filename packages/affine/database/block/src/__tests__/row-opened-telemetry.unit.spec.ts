import { describe, expect, it } from 'vitest';

import {
  databaseOpenRowRequest,
  rowOpenedParams,
} from '../service/open-row.js';

/**
 * `DatabaseRowOpened` (ADR 0035 §12, B17; telemetry README, "Databases"),
 * built in the database block from B9's row-open request, the one path
 * every preset's row open goes through.
 *
 * What it would have caught:
 * - the row's id, which on a hosted source is a document id, crossing the
 *   bus;
 * - a mode other than the host was asked for, or a library-drawn open
 *   (no opener, a block-backed row) reported as `center` or `full`.
 */

const BASE = {
  hasOpener: true,
  rowsAreDocuments: true,
  rowId: 'doc-secret',
  viewId: 'view-1',
  blockId: 'block-1',
};

describe('rowOpenedParams', () => {
  it("says the host's mode and never the row", () => {
    const request = databaseOpenRowRequest({ ...BASE, openIn: 'center' });
    const params = rowOpenedParams(request, true, false);
    expect(params).toEqual({
      mode: 'center',
      newTab: false,
      rowKind: 'document',
    });
    expect(JSON.stringify(params)).not.toContain('doc-secret');
    const tab = databaseOpenRowRequest({
      ...BASE,
      openIn: 'side',
      newTab: true,
    });
    expect(rowOpenedParams(tab, true, true)).toEqual({
      mode: 'full',
      newTab: true,
      rowKind: 'document',
    });
  });

  it('says side when the library opens the row itself', () => {
    const blockRow = databaseOpenRowRequest({
      ...BASE,
      rowsAreDocuments: false,
      openIn: 'center',
    });
    expect(rowOpenedParams(blockRow, false, undefined)).toEqual({
      mode: 'side',
      newTab: false,
      rowKind: 'block',
    });
    const noOpener = databaseOpenRowRequest({
      ...BASE,
      hasOpener: false,
      openIn: 'full',
    });
    expect(rowOpenedParams(noOpener, true, false).mode).toBe('side');
  });
});
