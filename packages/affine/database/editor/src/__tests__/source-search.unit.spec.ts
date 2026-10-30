/**
 * GUARD — a list of sources is searched, and the search names a new one.
 *
 * What it would have caught (labre recette of 2.1, 2026-10-30): the picker's
 * list of sources showed no search field (the menu's search only appeared
 * once something was typed), and a name typed there that no source bears
 * could not be created from the list. At the recette of 2.2: a name another
 * database's source bears hid the entry, leaving "No results" and no reason;
 * "SOURCÉ" did not find "Source". At the recette of 2.2.1: "+ view" kept
 * its "On an existing source" / "With a new source" entries beside the
 * search, and a host without naming got no creation from the search.
 */
import { HostedDataSourceBase } from '@labre/affine-database-block';
import {
  effects as contextMenuEffects,
  popMenu,
  popupTargetFromElement,
} from '@labre/affine-components/context-menu';
import type { AddViewMenuContext } from '@labre/affine-database-engine';
import type {
  DataSourcePickerDatabase,
  DataSourcePickerService,
  DataSourcePickerSourceNaming,
} from '@labre/affine-shared/services';
import type { BlockStdScope } from '@labre/std';
import { signal } from '@preact/signals-core';
import { afterEach, beforeAll, describe, expect, test, vi } from 'vitest';

vi.mock('../view-bar/add-view-on-source.js', () => ({
  addViewOnSource: vi.fn(() => 'v-new'),
}));

import {
  type DataSourceChoice,
  popDataSourcePicker,
} from '../data-source-picker.js';
import { databaseAddViewMenu } from '../view-bar/add-view-menu.js';
import { addViewOnSource } from '../view-bar/add-view-on-source.js';

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

const std = {
  store: { readonly: false },
  getOptional: () => null,
} as unknown as BlockStdScope;

const frame = () =>
  new Promise<void>(resolve => requestAnimationFrame(() => resolve()));

const byTestId = (id: string) =>
  document.querySelector<HTMLElement>(`[data-testid="${id}"]`);

/** `check` answers against the names `suggest` read, as labre's does. */
function hostNaming(names: string[]): DataSourcePickerSourceNaming {
  let read: string[] = [];
  return {
    suggest: async () => {
      read = names;
      return 'Source 3';
    },
    check: name => {
      const key = name.trim().toLowerCase();
      if (!key) return 'empty';
      return read.some(n => n.toLowerCase() === key) ? 'taken' : 'ok';
    },
  };
}

async function open(picker: DataSourcePickerService) {
  const anchor = document.createElement('div');
  document.body.append(anchor);
  const onPick = vi.fn<(choice: DataSourceChoice) => void>();
  popDataSourcePicker(std, picker, popupTargetFromElement(anchor), {
    databaseId: PLAN.id,
    onPick,
  });
  await frame();
  const menu = byTestId('data-source-picker')!;
  const search = (menu.shadowRoot ?? menu).querySelector<HTMLInputElement>(
    'input.affine-menu-search'
  )!;
  return { onPick, search };
}

async function type(input: HTMLInputElement, value: string) {
  input.value = value;
  input.dispatchEvent(new InputEvent('input', { bubbles: true }));
  await frame();
}

const sources = () =>
  [
    ...document.querySelectorAll<HTMLElement>(
      '[data-testid^="data-source-picker-source-"]'
    ),
  ].map(el => el.dataset.testid);

const typed = () => byTestId('data-source-picker-new-source-typed');

describe('searching a list of sources', () => {
  test('shows its search field before anything is typed', async () => {
    const { search } = await open({ list: () => signal([PLAN]) });
    expect(search.placeholder).toBe('Search or create a source');
    expect(search.closest('.affine-menu-search-container')).toHaveProperty(
      'style.opacity',
      '1'
    );
  });

  test('typing filters the sources', async () => {
    const { search } = await open({ list: () => signal([PLAN]) });
    await type(search, 'ris');
    expect(sources()).toEqual(['data-source-picker-source-s-2']);
  });

  test('the filter and the exact match ignore case and accents', async () => {
    const createSource = vi.fn(async () => ({ id: 's-3', title: 'x' }));
    const { search } = await open({
      list: () => signal([PLAN]),
      createSource,
      sourceName: hostNaming(['Projects', 'Risks']),
    });
    await type(search, 'RÏSKS');
    await frame();
    expect(sources()).toEqual(['data-source-picker-source-s-2']);
    expect(typed()).toBeNull();
  });

  test('a name no source bears is created as typed, trimmed', async () => {
    const createSource = vi.fn(async () => ({ id: 's-3', title: 'Budget' }));
    const { onPick, search } = await open({
      list: () => signal([PLAN]),
      createSource,
      sourceName: hostNaming(['Projects', 'Risks']),
    });
    await type(search, ' Budget ');
    await vi.waitFor(() => expect(typed()).not.toBeNull());
    expect(typed()!.textContent).toContain('Create source “ Budget ”');
    typed()!.click();
    await vi.waitFor(() => expect(onPick).toHaveBeenCalledTimes(1));
    expect(createSource.mock.calls[0]).toEqual(['db-plan', 'Budget']);
    expect(onPick.mock.calls[0]![0]).toMatchObject({ source: 'new' });
  });

  test('a name the host has taken stays, disabled, with its verdict', async () => {
    const createSource = vi.fn(async () => ({ id: 's-3', title: 'x' }));
    const { search } = await open({
      list: () => signal([PLAN]),
      createSource,
      sourceName: hostNaming(['Projects', 'Risks', 'Archive']),
    });
    await type(search, 'archive');
    await vi.waitFor(() => expect(typed()).not.toBeNull());
    expect(typed()!.dataset.verdict).toBe('taken');
    expect(typed()!.getAttribute('aria-disabled')).toBe('true');
    expect(typed()!.textContent).toContain(
      'Another source already has this name.'
    );
    expect(document.body.textContent).not.toContain('No results');
    typed()!.click();
    await frame();
    expect(createSource).not.toHaveBeenCalled();
  });

  test('a listed name or no name offers no creation', async () => {
    const createSource = vi.fn(async () => ({ id: 's-3', title: 'x' }));
    const { search } = await open({
      list: () => signal([PLAN]),
      createSource,
      sourceName: hostNaming(['Projects', 'Risks', 'Archive']),
    });
    await type(search, 'risks');
    await frame();
    expect(typed()).toBeNull();
    await type(search, '   ');
    await frame();
    expect(typed()).toBeNull();
    expect(createSource).not.toHaveBeenCalled();
  });

  test('without the host naming, the typed name is created as is', async () => {
    const createSource = vi.fn(async () => ({ id: 's-3', title: 'Budget' }));
    const { onPick, search } = await open({
      list: () => signal([PLAN]),
      createSource,
    });
    await type(search, 'Budget');
    typed()!.click();
    await vi.waitFor(() => expect(onPick).toHaveBeenCalledTimes(1));
    expect(createSource.mock.calls[0]).toEqual(['db-plan', 'Budget']);
  });
});

/** A hosted data source reading two sources, as "+ view" reads it. */
function hostedPlan() {
  const titles: Record<string, string> = { s1: 'Projects', s2: 'Risks' };
  return Object.defineProperties(
    Object.create(HostedDataSourceBase.prototype) as HostedDataSourceBase,
    {
      _resolveSource: { value: () => null },
      viewDataList$: {
        value: signal([
          { id: 'v1', sourceId: 's1' },
          { id: 'v2', sourceId: 's2' },
        ]),
      },
      sourceOf: {
        value: (id: string) =>
          id in titles
            ? { schema: { id: `b-${id}`, props: { title: titles[id] } } }
            : null,
      },
      viewMetas: { value: [] },
      readonly$: { value: signal(false) },
    }
  );
}

describe('"+ view", one list of sources', () => {
  async function openAddView(
    createSource?: (
      dataSource: HostedDataSourceBase,
      name?: string
    ) => Promise<string | undefined>
  ) {
    const dataSource = hostedPlan();
    const context = {
      std: undefined,
      dataSource,
      viewManager: {},
      addView: () => '',
    } as unknown as AddViewMenuContext;
    const addView = databaseAddViewMenu(() => ({ createSource }));
    const items = addView.items(context)!;
    const placeholder = addView.searchPlaceholder?.(context);
    const anchor = document.createElement('div');
    document.body.append(anchor);
    popMenu(popupTargetFromElement(anchor), {
      options: {
        testId: 'add-view',
        items,
        search: placeholder ? { placeholder } : undefined,
      },
    });
    await frame();
    const menu = byTestId('add-view')!;
    const search = menu.querySelector<HTMLInputElement>(
      'input.affine-menu-search'
    )!;
    return { dataSource, context, menu, search };
  }

  test('lists the sources under its search field, no other entry', async () => {
    const { menu, search } = await openAddView(async () => 's3');
    expect(search.placeholder).toBe('Search or create a source');
    const ids = [...menu.querySelectorAll<HTMLElement>('[data-testid]')].map(
      el => el.dataset.testid
    );
    expect(ids).toEqual([
      'database-add-view-source-s1',
      'database-add-view-source-s2',
    ]);
    expect(menu.textContent).not.toContain('On an existing source');
    expect(menu.textContent).not.toContain('With a new source');
  });

  test('a typed name is created, then a table is added on it', async () => {
    const createSource = vi.fn(async () => 's3');
    const { dataSource, context, search } = await openAddView(createSource);
    await type(search, ' Budget ');
    byTestId('database-add-view-new-source-typed')!.click();
    await vi.waitFor(() => expect(addViewOnSource).toHaveBeenCalledTimes(1));
    expect(createSource).toHaveBeenCalledWith(dataSource, 'Budget');
    expect(addViewOnSource).toHaveBeenCalledWith(
      context,
      dataSource,
      'table',
      's3',
      'new'
    );
  });

  test('without createSource, the search only filters', async () => {
    const { search } = await openAddView();
    await type(search, 'Budget');
    expect(byTestId('database-add-view-new-source-typed')).toBeNull();
  });
});
