/**
 * GUARD — the creation popover (ADR 0035 §5, amendment of 2026-10-28): what
 * "Table View" / "Kanban View" open over the native database they just
 * inserted, when the host fills the data-source picker.
 *
 * What it would have caught:
 * - "New empty source" offered by a host that creates no database (the
 *   host's kill switch), or "Link an existing source" offered over an empty
 *   list (a sub-menu with nothing in it);
 * - the link sub-menu offering "New database" or "New source": creating is
 *   the popover's own first entry, linking only links;
 * - a cancelled creation (`createDatabase` answering `null`, or a database
 *   with no source) still connecting the block, or a pick connecting
 *   another block, another database or another source;
 * - the tooling extension no longer registering the menu core's entries
 *   read (`DatabaseCreationMenuIdentifier`);
 * - a hosted block whose source is gone (ADR 0035 amendment of 2026-10-29)
 *   connected with `connectDatabaseToSource`, which refuses it, instead of
 *   re-pointing the asked view (`reconnectDatabaseView`);
 * - the entries without the stable test ids a host's end-to-end suite
 *   selects them by (`database-creation-new-source`,
 *   `database-creation-link-existing-entry`).
 */
import { DatabaseCreationMenuIdentifier } from '@labre/affine-database-block';
import {
  effects as contextMenuEffects,
  popMenu,
  popupTargetFromElement,
} from '@labre/affine-components/context-menu';
import type {
  DataSourcePickerDatabase,
  DataSourcePickerService,
} from '@labre/affine-shared/services';
import type { BlockStdScope } from '@labre/std';
import { signal } from '@preact/signals-core';
import { afterEach, beforeAll, describe, expect, test, vi } from 'vitest';

import { databaseCreationItems } from '../creation-popover.js';
import { DatabaseEditorToolingViewExtension } from '../view.js';

const connect = vi.hoisted(() => vi.fn(() => true));
const reconnect = vi.hoisted(() => vi.fn(() => true));
vi.mock('@labre/affine-database-block', async importOriginal => ({
  ...(await importOriginal<typeof import('@labre/affine-database-block')>()),
  connectDatabaseToSource: connect,
  reconnectDatabaseView: reconnect,
}));

beforeAll(() => {
  if (!customElements.get('affine-menu')) contextMenuEffects();
});

afterEach(() => {
  document.body.innerHTML = '';
  connect.mockClear();
  reconnect.mockClear();
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

const BLOCK = {
  id: 'block-1',
  flavour: 'affine:database',
  props: { views: [{ id: 'v-1' }] } as {
    externalSourceId?: string;
    views: { id: string }[];
  },
};

function fakeStd(block: typeof BLOCK = BLOCK): BlockStdScope {
  return {
    store: {
      readonly: false,
      getModelById: (id: string) => (id === BLOCK.id ? block : null),
    },
    getOptional: () => null,
  } as unknown as BlockStdScope;
}

const frame = () =>
  new Promise<void>(resolve => requestAnimationFrame(() => resolve()));

async function open(
  picker: DataSourcePickerService,
  std = fakeStd(),
  viewId?: string
) {
  const anchor = document.createElement('div');
  document.body.append(anchor);
  popMenu(popupTargetFromElement(anchor), {
    options: {
      testId: 'database-creation-popover',
      items: databaseCreationItems(std, picker, BLOCK.id, viewId),
    },
  });
  await frame();
  return std;
}

const byTestId = (id: string) =>
  document.querySelector<HTMLElement>(`[data-testid="${id}"]`);
const linkEntry = () =>
  document.querySelector<HTMLElement>('.database-creation-link-existing');

describe('the creation popover', () => {
  test('offers both entries to a host that lists and creates', async () => {
    await open({
      list: () => signal([PLAN]),
      createDatabase: vi.fn(async () => PEOPLE),
    });
    expect(byTestId('database-creation-new-source')).not.toBeNull();
    expect(linkEntry()).not.toBeNull();
    expect(linkEntry()!.dataset.testid).toBe(
      'database-creation-link-existing-entry'
    );
  });

  test('no "Link an existing source" over an empty list', async () => {
    await open({
      list: () => signal([]),
      createDatabase: vi.fn(async () => PEOPLE),
    });
    expect(byTestId('database-creation-new-source')).not.toBeNull();
    expect(linkEntry()).toBeNull();
  });

  test('no "New empty source" without createDatabase', async () => {
    await open({ list: () => signal([PLAN]) });
    expect(byTestId('database-creation-new-source')).toBeNull();
    expect(linkEntry()).not.toBeNull();
  });

  test('the link sub-menu lists the databases and creates nothing', async () => {
    const std = await open({
      list: () => signal([PLAN, PEOPLE]),
      createDatabase: vi.fn(async () => null),
      createSource: vi.fn(async () => null),
    });
    linkEntry()!.click();
    await frame();
    const sub = byTestId('database-creation-link-existing')!;
    expect(sub).not.toBeNull();
    expect(sub.textContent).toContain('Plan');
    expect(sub.textContent).toContain('People');
    expect(byTestId('data-source-picker-new-database')).toBeNull();

    const plan = [
      ...sub.querySelectorAll<HTMLElement>('affine-menu-sub-menu'),
    ].find(item => item.textContent?.includes('Plan'))!;
    plan.click();
    await frame();
    expect(byTestId('data-source-picker-source-s-2')).not.toBeNull();
    expect(byTestId('data-source-picker-new-source')).toBeNull();

    byTestId('data-source-picker-source-s-2')!.click();
    expect(connect).toHaveBeenCalledTimes(1);
    expect(connect).toHaveBeenCalledWith(std, BLOCK, {
      database: PLAN,
      sourceId: 's-2',
    });
  });

  test('"New empty source" connects the first source of the new database', async () => {
    const createDatabase = vi.fn(async () => PEOPLE);
    const std = await open({ list: () => signal([]), createDatabase });
    byTestId('database-creation-new-source')!.click();
    await vi.waitFor(() => expect(connect).toHaveBeenCalledTimes(1));
    expect(createDatabase).toHaveBeenCalledTimes(1);
    expect(connect).toHaveBeenCalledWith(std, BLOCK, {
      database: PEOPLE,
      sourceId: 's-3',
    });
  });

  test('a cancelled creation connects nothing', async () => {
    const createDatabase = vi
      .fn<() => Promise<DataSourcePickerDatabase | null>>()
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ id: 'db-empty', title: 'Empty', sources: [] });
    for (let i = 0; i < 2; i++) {
      document.body.innerHTML = '';
      await open({ list: () => signal([]), createDatabase });
      byTestId('database-creation-new-source')!.click();
      await new Promise(resolve => setTimeout(resolve, 0));
    }
    expect(createDatabase).toHaveBeenCalledTimes(2);
    expect(connect).not.toHaveBeenCalled();
  });
});

describe('a hosted block whose source is gone', () => {
  const hosted = () =>
    fakeStd({
      ...BLOCK,
      props: { externalSourceId: 'db-gone', views: [{ id: 'v-1' }] },
    });

  test('"New empty source" re-points the asked view', async () => {
    const std = await open(
      { list: () => signal([]), createDatabase: vi.fn(async () => PEOPLE) },
      hosted(),
      'v-2'
    );
    byTestId('database-creation-new-source')!.click();
    await vi.waitFor(() => expect(reconnect).toHaveBeenCalledTimes(1));
    expect(connect).not.toHaveBeenCalled();
    expect(reconnect).toHaveBeenCalledWith(std, expect.anything(), {
      database: PEOPLE,
      sourceId: 's-3',
      viewId: 'v-2',
    });
  });

  test('a linked source re-points the first view when none is asked', async () => {
    const std = await open({ list: () => signal([PLAN]) }, hosted());
    linkEntry()!.click();
    await frame();
    [
      ...byTestId(
        'database-creation-link-existing'
      )!.querySelectorAll<HTMLElement>('affine-menu-sub-menu'),
    ]
      .find(item => item.textContent?.includes('Plan'))!
      .click();
    await frame();
    byTestId('data-source-picker-source-s-1')!.click();
    expect(connect).not.toHaveBeenCalled();
    expect(reconnect).toHaveBeenCalledWith(std, expect.anything(), {
      database: PLAN,
      sourceId: 's-1',
      viewId: 'v-1',
    });
  });
});

describe('the creation menu registration', () => {
  test('the tooling extension registers the menu core reads', () => {
    const registered: { setup: (di: unknown) => void }[] = [];
    const context = {
      scope: 'page',
      register: (ext: unknown) => {
        registered.push(...(Array.isArray(ext) ? ext : [ext]));
        return context;
      },
    };
    new DatabaseEditorToolingViewExtension().setup(context as never);
    const override = vi.fn();
    registered.forEach(ext => ext.setup({ override, addImpl: vi.fn() }));
    expect(override).toHaveBeenCalledWith(
      DatabaseCreationMenuIdentifier,
      expect.any(Function)
    );
  });
});
