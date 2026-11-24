/**
 * GUARD — "Linked view of a database" asks the host's `placeView` before it
 * inserts the block (issue #701, ADR 0035 amendment of 2026-11-22).
 *
 * What it would have caught: the linked view inserted before the host
 * answered, or inserted when the host never places it; a source the host
 * just created for this pick (`source: 'new'`) asked about; without the
 * seam, the block no longer inserted at once (the 4.1 gesture).
 */
import {
  DataSourcePickerProvider,
  type DataSourcePickerService,
} from '@labre/affine-shared/services';
import type { BlockStdScope } from '@labre/std';
import { signal } from '@preact/signals-core';
import { afterEach, describe, expect, test, vi } from 'vitest';

const insert = vi.hoisted(() => vi.fn(() => 'new-block'));
const picked = vi.hoisted(() => ({ onPick: undefined as unknown }));

vi.mock('@labre/affine-database-block', async importOriginal => ({
  ...(await importOriginal<typeof import('@labre/affine-database-block')>()),
  insertLinkedDatabaseView: insert,
}));
vi.mock('../data-source-picker.js', () => ({
  popDataSourcePicker: (
    _std: unknown,
    _picker: unknown,
    _target: unknown,
    options: { onPick: unknown }
  ) => {
    picked.onPick = options.onPick;
  },
}));

import { linkedViewSlashMenuConfig } from '../linked-view-slash-menu.js';

const PLAN = { id: 'db-plan', title: 'Plan', sources: [] };
const AFTER = { id: 'p-1' };

afterEach(() => {
  insert.mockClear();
  picked.onPick = undefined;
});

function run(placeView?: DataSourcePickerService['placeView']) {
  const picker: DataSourcePickerService = {
    list: () => signal([]),
    placeView,
  };
  const std = {
    store: { id: 'doc-1', readonly: false },
    getOptional: (id: unknown) =>
      id === DataSourcePickerProvider ? picker : null,
    command: { exec: () => [null, { selectedModels: [AFTER] }] },
    view: { getBlock: () => document.createElement('div') },
  } as unknown as BlockStdScope;
  const item = linkedViewSlashMenuConfig.items as unknown as {
    action: (ctx: { std: BlockStdScope }) => void;
  }[];
  item[0]!.action({ std });
  return picked.onPick as (choice: {
    database: typeof PLAN;
    sourceId: string;
    source: 'existing' | 'new';
  }) => void;
}

describe('"Linked view of a database" and placeView', () => {
  test('without the seam, the block is inserted at once', () => {
    run()({ database: PLAN, sourceId: 's-1', source: 'existing' });
    expect(insert).toHaveBeenCalledOnce();
  });

  test('an existing source is inserted only once the host places it', () => {
    const placeView = vi.fn();
    run(placeView)({ database: PLAN, sourceId: 's-1', source: 'existing' });
    expect(insert).not.toHaveBeenCalled();
    const request = placeView.mock.calls[0]![0];
    expect(request).toMatchObject({
      gesture: 'linked-view',
      databaseId: 'db-plan',
      sourceId: 's-1',
      docId: 'doc-1',
    });
    expect(request.blockId).toBeUndefined();
    expect(request.place()).toBe(true);
    expect(insert).toHaveBeenCalledOnce();
  });

  test('a source the host just created is not asked about', () => {
    const placeView = vi.fn();
    run(placeView)({ database: PLAN, sourceId: 's-9', source: 'new' });
    expect(placeView).not.toHaveBeenCalled();
    expect(insert).toHaveBeenCalledOnce();
  });
});
