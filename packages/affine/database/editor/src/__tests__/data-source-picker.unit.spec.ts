/**
 * The data-source picker (ADR 0035 §9c, issue B12): an existing source of a
 * database the host lists, or a new one the host creates.
 *
 * What it would have caught:
 * - a list the host fills after the picker opened never showing (the picker
 *   must read `list()` as it draws, not once);
 * - "New source" or "New database" offered by a host that cannot create one
 *   (`createSource` / `createDatabase` absent is the host's kill switch), or
 *   offered on a read-only document;
 * - a pick reported with the wrong source, or a cancelled creation (`null`)
 *   reported as a pick;
 * - the "+ view" case (`databaseId`) offering another database's sources.
 */
import {
  effects as contextMenuEffects,
  popupTargetFromElement,
} from '@labre/affine-components/context-menu';
import type {
  DataSourcePickerDatabase,
  DataSourcePickerService,
} from '@labre/affine-shared/services';
import type { BlockStdScope } from '@labre/std';
import { signal } from '@preact/signals-core';
import { afterEach, beforeAll, describe, expect, test, vi } from 'vitest';

import {
  type DataSourceChoice,
  popDataSourcePicker,
} from '../data-source-picker.js';

beforeAll(() => {
  if (!customElements.get('affine-menu')) contextMenuEffects();
});

afterEach(() => {
  document.body.innerHTML = '';
});

const PLAN: DataSourcePickerDatabase = {
  id: 'db-plan',
  title: 'Plan',
  sources: [
    { id: 's-1', title: 'Projects' },
    { id: 's-2', title: 'Risks' },
  ],
};
const PEOPLE: DataSourcePickerDatabase = {
  id: 'db-people',
  title: 'People',
  sources: [{ id: 's-3', title: 'Team' }],
};

function fakeStd(readonly = false): BlockStdScope {
  return {
    store: { readonly },
    getOptional: () => null,
  } as unknown as BlockStdScope;
}

const frame = () =>
  new Promise<void>(resolve => requestAnimationFrame(() => resolve()));

async function open(
  picker: DataSourcePickerService,
  options: { databaseId?: string; readonly?: boolean } = {}
) {
  const anchor = document.createElement('div');
  document.body.append(anchor);
  const onPick = vi.fn<(choice: DataSourceChoice) => void>();
  popDataSourcePicker(
    fakeStd(options.readonly),
    picker,
    popupTargetFromElement(anchor),
    { databaseId: options.databaseId, onPick }
  );
  await frame();
  return onPick;
}

const byTestId = (id: string) =>
  document.querySelector<HTMLElement>(`[data-testid="${id}"]`);

describe('the data-source picker', () => {
  test('in a database, lists its sources and picks one', async () => {
    const onPick = await open(
      { list: () => signal([PLAN, PEOPLE]) },
      { databaseId: 'db-plan' }
    );
    expect(byTestId('data-source-picker-source-s-1')).not.toBeNull();
    expect(byTestId('data-source-picker-source-s-3')).toBeNull();
    // No createSource: no "New source".
    expect(byTestId('data-source-picker-new-source')).toBeNull();
    byTestId('data-source-picker-source-s-2')!.click();
    expect(onPick).toHaveBeenCalledWith({
      database: PLAN,
      sourceId: 's-2',
      source: 'existing',
    });
  });

  test('draws a list the host fills after it opened', async () => {
    const list = signal<readonly DataSourcePickerDatabase[]>([]);
    await open({ list: () => list }, { databaseId: 'db-plan' });
    expect(byTestId('data-source-picker-source-s-1')).toBeNull();
    list.value = [PLAN];
    await frame();
    expect(byTestId('data-source-picker-source-s-1')).not.toBeNull();
  });

  test('creates a source through the host, and a cancel picks nothing', async () => {
    const createSource = vi
      .fn<DataSourcePickerService['createSource'] & {}>()
      .mockResolvedValueOnce({ id: 's-new', title: 'Ideas' })
      .mockResolvedValueOnce(null);
    const picker = { list: () => signal([PLAN]), createSource };
    const onPick = await open(picker, { databaseId: 'db-plan' });
    byTestId('data-source-picker-new-source')!.click();
    await vi.waitFor(() => expect(onPick).toHaveBeenCalledTimes(1));
    expect(createSource).toHaveBeenCalledWith('db-plan');
    expect(onPick.mock.calls[0]?.[0]).toMatchObject({
      sourceId: 's-new',
      source: 'new',
    });

    document.body.innerHTML = '';
    const onCancel = await open(picker, { databaseId: 'db-plan' });
    byTestId('data-source-picker-new-source')!.click();
    await new Promise(resolve => setTimeout(resolve, 0));
    expect(onCancel).not.toHaveBeenCalled();
  });

  test('offers "New database" only when the host creates one', async () => {
    await open({ list: () => signal([PLAN]) });
    expect(byTestId('data-source-picker-new-database')).toBeNull();

    document.body.innerHTML = '';
    const createDatabase = vi.fn(async () => PEOPLE);
    const onPick = await open({ list: () => signal([PLAN]), createDatabase });
    byTestId('data-source-picker-new-database')!.click();
    await vi.waitFor(() =>
      expect(onPick).toHaveBeenCalledWith({
        database: PEOPLE,
        sourceId: 's-3',
        source: 'new',
      })
    );
  });

  test('says there is nothing to show when the host lists and creates nothing', async () => {
    await open({ list: () => signal([]) });
    expect(byTestId('data-source-picker-empty')).not.toBeNull();
  });

  test('creates nothing on a read-only document', async () => {
    await open(
      {
        list: () => signal([PLAN]),
        createDatabase: vi.fn(async () => null),
        createSource: vi.fn(async () => null),
      },
      { databaseId: 'db-plan', readonly: true }
    );
    expect(byTestId('data-source-picker-new-source')).toBeNull();
    expect(byTestId('data-source-picker-source-s-1')).not.toBeNull();
  });
});
