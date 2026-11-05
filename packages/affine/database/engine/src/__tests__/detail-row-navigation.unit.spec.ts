/**
 * GUARD — the detail panel's arrows walk the whole view.
 *
 * What it would have caught (PO acceptance, 2026-11-05): opened on a row,
 * the panel's up and down arrows reached the neighbouring row and no
 * further. The panel read its row through a `computed` over `rowId`, a Lit
 * property and not a signal, so the computed memoised the row the panel
 * OPENED on and every click stepped from that row again. The row is now read
 * from `rowId` on each call, so three clicks down land three rows down.
 */
import { signal } from '@preact/signals-core';
import { describe, expect, test } from 'vitest';

import { RecordDetail } from '../core/detail/detail.js';

if (!customElements.get('affine-data-view-record-detail')) {
  customElements.define('affine-data-view-record-detail', RecordDetail);
}

/** A view of `ids` in that order: each row knows its two neighbours. */
function viewOf(ids: readonly string[]) {
  type Row = {
    rowId: string;
    prev$: ReturnType<typeof signal<Row | undefined>>;
    next$: ReturnType<typeof signal<Row | undefined>>;
  };
  const rows = new Map<string, Row>(
    ids.map(rowId => [
      rowId,
      {
        rowId,
        prev$: signal<Row | undefined>(undefined),
        next$: signal<Row | undefined>(undefined),
      },
    ])
  );
  ids.forEach((rowId, index) => {
    const row = rows.get(rowId)!;
    row.prev$.value = rows.get(ids[index - 1] ?? '');
    row.next$.value = rows.get(ids[index + 1] ?? '');
  });
  return {
    rowGetOrCreate: (rowId: string) => rows.get(rowId)!,
    detailProperties$: signal([]),
    readonly$: signal(false),
  } as never;
}

function openOn(rowId: string, ids: readonly string[]) {
  const detail = new RecordDetail();
  detail.view = viewOf(ids);
  detail.rowId = rowId;
  return detail;
}

describe('the detail panel arrows', () => {
  test('three clicks down land three rows down, two clicks up come back two', () => {
    const detail = openOn('r1', ['r1', 'r2', 'r3', 'r4', 'r5']);

    detail.nextRow();
    detail.nextRow();
    detail.nextRow();
    expect(detail.rowId).toBe('r4');

    detail.prevRow();
    detail.prevRow();
    expect(detail.rowId).toBe('r2');
  });

  test('the arrows report the neighbours of the row shown, not of the row opened on', () => {
    const detail = openOn('r1', ['r1', 'r2', 'r3']);
    expect(detail.hasPrev()).toBe(false);

    detail.nextRow();
    detail.nextRow();
    expect(detail.rowId).toBe('r3');
    expect(detail.hasNext()).toBe(false);
    expect(detail.hasPrev()).toBe(true);

    detail.nextRow();
    expect(detail.rowId).toBe('r3');
  });
});
