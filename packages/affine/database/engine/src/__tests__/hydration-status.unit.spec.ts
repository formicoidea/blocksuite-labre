import { signal } from '@preact/signals-core';
import { render } from 'lit';
import { describe, expect, it, vi } from 'vitest';

import {
  type CellStatus,
  cellStatusOf,
  renderCellStatus,
  VALUES_PENDING_MARK,
  VALUES_READY,
  VALUES_SLOW_AFTER_MS,
  valuesBannerOf,
  valuesReady,
  valuesStateOf,
} from '../core/index.js';
import type { Cell } from '../core/view-manager/cell.js';
import { CellBase } from '../core/view-manager/cell.js';
import type { SingleView } from '../core/view-manager/single-view.js';

/**
 * Cell hydration (ADR 0035 §9e, issue B2, REQ-DB-12): a host source whose
 * values arrive after its rows says so per cell and for the whole source.
 *
 * What it would have caught:
 * - a source that says NOTHING about hydration (the inline source, every 0.48
 *   host source) drawing a spinner, an ellipsis or a banner: it must stay
 *   `ready`, the 0.48 behaviour, with no member to implement;
 * - the 3 s rule drifting (a banner at once, or never);
 * - a pending or failed cell being written over by `valueSet` /
 *   `jsonValueSet`, the entry points a paste, a drag-to-fill, a kanban drop
 *   and every cell editor go through: "nothing is written in any state";
 * - a cell container mounting its renderer (hence its editor) over a value
 *   the source has not delivered.
 */

function fakeCell(status?: CellStatus): Cell {
  return (status === undefined
    ? {}
    : { status$: signal(status) }) as unknown as Cell;
}

function cellOver(status: CellStatus) {
  const cellValueChange = vi.fn();
  const dataSource = {
    cellStatus: () => status,
    cellValueGet: () => undefined,
    cellValueChange,
  };
  const view = { manager: { dataSource } } as unknown as SingleView;
  return { cell: new CellBase(view, 'p1', 'r1'), cellValueChange };
}

describe('a source that says nothing is ready (the 0.48 behaviour)', () => {
  it('reads every cell and the whole source as ready', () => {
    expect(cellStatusOf({}, 'r1', 'p1')).toBe('ready');
    expect(valuesStateOf({})).toBe(VALUES_READY);
    expect(valuesReady({})).toBe(true);
    expect(valuesBannerOf(valuesStateOf({}), Date.now())).toBe('none');
  });

  it('draws no spinner for a ready cell or a cell with no status', () => {
    expect(renderCellStatus(fakeCell('ready'))).toBeUndefined();
    expect(renderCellStatus(fakeCell())).toBeUndefined();
    expect(renderCellStatus(undefined)).toBeUndefined();
  });
});

describe('cell status', () => {
  it('draws a spinner, never a skeleton, while pending and an empty cell on error', () => {
    const host = document.createElement('div');
    render(renderCellStatus(fakeCell('pending')), host);
    expect(host.querySelector('[data-testid="dv-cell-loading"]')).not.toBe(
      null
    );
    expect(host.querySelector('svg .spinner')).not.toBe(null);

    render(renderCellStatus(fakeCell('error')), host);
    expect(host.querySelector('[data-cell-status="error"]')).not.toBe(null);
    expect(host.querySelector('[data-testid="dv-cell-loading"]')).toBe(null);
    expect(host.textContent?.trim()).toBe('');
  });

  it('CellBase reads the status from its source', () => {
    expect(cellOver('pending').cell.status$.value).toBe('pending');
    expect(cellOver('ready').cell.status$.value).toBe('ready');
  });

  it.each<CellStatus>(['pending', 'error'])(
    'never writes over a %s cell',
    status => {
      const { cell, cellValueChange } = cellOver(status);
      cell.valueSet('typed over');
      cell.jsonValueSet('typed over');
      expect(cellValueChange).not.toHaveBeenCalled();
    }
  );

  it('writes a ready cell as before', () => {
    const { cell, cellValueChange } = cellOver('ready');
    cell.valueSet('a value');
    expect(cellValueChange).toHaveBeenCalledWith('r1', 'p1', 'a value');
  });
});

describe('values state and banner', () => {
  const since = 1_000_000;

  it('shows nothing before 3 s of loading, then the slow banner', () => {
    const loading = { status: 'loading', since } as const;
    expect(valuesBannerOf(loading, since)).toBe('none');
    expect(valuesBannerOf(loading, since + VALUES_SLOW_AFTER_MS - 1)).toBe(
      'none'
    );
    expect(valuesBannerOf(loading, since + VALUES_SLOW_AFTER_MS)).toBe('slow');
  });

  it('shows the error banner at once', () => {
    expect(valuesBannerOf({ status: 'error', since }, since)).toBe('error');
  });

  it('counts wait for ready, with an ellipsis', () => {
    const state$ = signal({ status: 'loading' as const, since });
    expect(valuesReady({ valuesState$: state$ })).toBe(false);
    expect(VALUES_PENDING_MARK).toBe('…');
  });
});
