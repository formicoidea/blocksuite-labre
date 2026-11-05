/**
 * GUARD — "Source" in a view's settings (ADR 0035 amendment of 2026-10-28):
 * the bundle's `ViewSettingsMenu`, read by data-view's `popViewOptions`.
 *
 * What it would have caught:
 * - "Source" drawn on an inline database (one implicit source, nothing to
 *   choose), on a hosted source without `resolveSource`, without the host's
 *   picker, on a read-only page or on a view drawn through a fallback
 *   preset, where the 0.61 menu must stay as it was;
 * - its postfix not naming the source the view reads, or an untitled one
 *   showing an empty postfix;
 * - its picker offering another database's sources, a pick not pointing
 *   the view at the source, or no way back to the view settings;
 * - (labre recette of 2.2.1) its list showing no search field, nothing
 *   marking the view's current source, a "New source" sub-step beside the
 *   search, or a name typed there not creating the source the view then
 *   reads;
 * - the tooling extension no longer registering the entry;
 * - (ADR 0035 amendment of 2026-10-30) another database's sources listed
 *   without the host's `crossDatabaseViews`, or with it: not after this
 *   database's, not by name, without their database's label, the check
 *   matching a source id of another database, a pick not naming that
 *   database, or "Create source" creating anywhere but in this database.
 * - (issue #576) "Rename source" offered without the host's `renameSource`,
 *   on a read-only page, or on a view reading another database's source;
 *   Escape (which completes and blurs the context menu's input, the way
 *   the property rename SAVES) calling the host; an unchanged or
 *   untrimmed name reaching the host; a host refusal closing the field or
 *   losing its message; a second Enter while the host answers calling it
 *   twice; an answer arriving after the step closed writing into it.
 */
import { HostedDataSourceBase } from '@labre/affine-database-block';
import {
  effects as contextMenuEffects,
  type MenuConfig,
  popMenu,
  popupTargetFromElement,
} from '@labre/affine-components/context-menu';
import {
  type DataSourcePickerDatabase,
  DataSourcePickerProvider,
  type DataSourcePickerService,
} from '@labre/affine-shared/services';
import {
  type DataViewUILogicBase,
  type ViewSettingsMenuContext,
  ViewSettingsMenuIdentifier,
} from '@labre/affine-database-engine';
import type { BlockStdScope } from '@labre/std';
import { signal } from '@preact/signals-core';
import { afterEach, beforeAll, describe, expect, test, vi } from 'vitest';

vi.mock('../view-transfer/change-source.js', () => ({
  changeViewSource: vi.fn(() => true),
}));

import { changeViewSource } from '../view-transfer/change-source.js';
import { databaseViewSettingsMenu } from '../view-settings/source-entry.js';
import { DatabaseEditorToolingViewExtension } from '../view.js';

beforeAll(() => {
  if (!customElements.get('affine-menu')) contextMenuEffects();
});

afterEach(() => {
  document.body.innerHTML = '';
  vi.mocked(changeViewSource).mockClear();
});

const PLAN: DataSourcePickerDatabase = {
  id: 'host:plan',
  title: 'Plan',
  sources: [
    { id: 's-1', title: 'Projects' },
    { id: 's-2', title: 'Risks' },
  ],
};
const PEOPLE: DataSourcePickerDatabase = {
  id: 'host:people',
  title: 'People',
  sources: [{ id: 's-3', title: 'Team' }],
};
const ARCHIVE: DataSourcePickerDatabase = {
  id: 'host:archive',
  title: 'Archive',
  // The same source id as one of Plan's: another source.
  sources: [
    { id: 's-1', title: 'Alumni' },
    { id: 's-4', title: 'Zeta' },
  ],
};

function hosted(
  opts: {
    resolves?: boolean;
    title?: string;
    database?: string;
    current?: string;
    currentDatabase?: string;
  } = {}
) {
  return Object.assign(
    Object.create(HostedDataSourceBase.prototype) as HostedDataSourceBase,
    {
      _model: {
        props: { externalSourceId: opts.database ?? 'host:plan' },
      },
      _resolveSource: opts.resolves === false ? undefined : () => null,
      schema$: signal({
        props: { title: { toString: () => opts.title ?? 'Projects' } },
      }),
      viewDataGet: () => ({
        id: 'v1',
        sourceId: opts.current ?? 's-1',
        ...(opts.currentDatabase ? { databaseId: opts.currentDatabase } : {}),
      }),
    }
  );
}

function context(
  opts: {
    dataSource?: unknown;
    picker?: boolean;
    readonly?: boolean;
    fallback?: boolean;
    createSource?: DataSourcePickerService['createSource'];
    crossDatabaseViews?: boolean;
    renameSource?: DataSourcePickerService['renameSource'];
    sourceName?: DataSourcePickerService['sourceName'];
    storeReadonly?: boolean;
  } = {}
) {
  const picker: DataSourcePickerService = {
    list: () => signal([PEOPLE, ARCHIVE, PLAN]),
    createSource: opts.createSource,
    crossDatabaseViews: opts.crossDatabaseViews,
    renameSource: opts.renameSource,
    sourceName: opts.sourceName,
  };
  const std = {
    store: { readonly: opts.storeReadonly ?? false },
    getOptional: (id: unknown) =>
      id === DataSourcePickerProvider && opts.picker !== false ? picker : null,
  } as unknown as BlockStdScope;
  const view = {
    id: 'v1',
    readonly$: signal(opts.readonly ?? false),
    shownAsFallback$: signal(opts.fallback ?? false),
    manager: { dataSource: opts.dataSource ?? hosted() },
  };
  const anchor = document.createElement('div');
  document.body.append(anchor);
  const reopen = vi.fn();
  const ctx: ViewSettingsMenuContext = {
    std,
    dataViewLogic: { view } as unknown as DataViewUILogicBase,
    target: popupTargetFromElement(anchor),
    reopen,
    wording: ([, fallback]) => fallback,
  };
  return { ctx, reopen, view };
}

const frame = () =>
  new Promise<void>(resolve => requestAnimationFrame(() => resolve()));

const byTestId = (id: string) =>
  document.querySelector<HTMLElement>(`[data-testid="${id}"]`);

async function draw(ctx: ViewSettingsMenuContext, items: MenuConfig[]) {
  popMenu(ctx.target, { options: { items } });
  await frame();
}

describe('the view settings "Source"', () => {
  test('is not offered where there is no source to choose', () => {
    const items = (opts: Parameters<typeof context>[0]) =>
      databaseViewSettingsMenu().items(context(opts).ctx);
    // An inline database: no hosted source at all.
    expect(items({ dataSource: { readonly$: signal(false) } })).toBeUndefined();
    // Hosted, one implicit source (no resolveSource).
    expect(items({ dataSource: hosted({ resolves: false }) })).toBeUndefined();
    expect(items({ picker: false })).toBeUndefined();
    expect(items({ readonly: true })).toBeUndefined();
    expect(items({ fallback: true })).toBeUndefined();
  });

  test("is one entry naming the view's source", async () => {
    const { ctx } = context();
    const items = databaseViewSettingsMenu().items(ctx);
    expect(items).toHaveLength(1);
    await draw(ctx, items!);
    const entry = byTestId('dv-view-setting-source');
    expect(entry?.textContent).toContain('Source');
    expect(entry?.textContent).toContain('Projects');
  });

  test('an untitled source reads "Untitled source"', async () => {
    const { ctx } = context({ dataSource: hosted({ title: '' }) });
    await draw(ctx, databaseViewSettingsMenu().items(ctx)!);
    expect(byTestId('dv-view-setting-source')?.textContent).toContain(
      'Untitled source'
    );
  });

  test("opens the picker on this database's sources, a pick points the view", async () => {
    const { ctx, view } = context();
    await draw(ctx, databaseViewSettingsMenu().items(ctx)!);
    byTestId('dv-view-setting-source')!.click();
    await frame();
    expect(byTestId('data-source-picker')).not.toBeNull();
    expect(byTestId('data-source-picker-source-s-1')).not.toBeNull();
    expect(byTestId('data-source-picker-source-s-3')).toBeNull();
    byTestId('data-source-picker-source-s-2')!.click();
    expect(changeViewSource).toHaveBeenCalledTimes(1);
    expect(changeViewSource).toHaveBeenCalledWith(
      view.manager.dataSource,
      'v1',
      's-2',
      'existing'
    );
  });

  async function openList(opts: Parameters<typeof context>[0] = {}) {
    const result = context(opts);
    await draw(result.ctx, databaseViewSettingsMenu().items(result.ctx)!);
    byTestId('dv-view-setting-source')!.click();
    await frame();
    const list = byTestId('data-source-picker')!;
    const search = list.querySelector<HTMLInputElement>(
      'input.affine-menu-search'
    )!;
    return { ...result, search };
  }

  const isChecked = (id: string) =>
    byTestId(id)!.classList.contains('selected-item');

  test("checks the view's current source only; picking it again changes nothing", async () => {
    await openList({ dataSource: hosted({ current: 's-2' }) });
    expect(isChecked('data-source-picker-source-s-2')).toBe(true);
    expect(isChecked('data-source-picker-source-s-1')).toBe(false);
    byTestId('data-source-picker-source-s-2')!.click();
    expect(changeViewSource).not.toHaveBeenCalled();
  });

  test('shows its search field with a single source, and no "New source"', async () => {
    const { search } = await openList({
      dataSource: hosted({ database: 'host:people', current: 's-3' }),
      createSource: vi.fn(async () => ({ id: 's-9', title: 'x' })),
    });
    expect(search.placeholder).toBe('Search or create a source');
    expect(search.closest('.affine-menu-search-container')).toHaveProperty(
      'style.opacity',
      '1'
    );
    expect(byTestId('data-source-picker-source-s-3')).not.toBeNull();
    expect(byTestId('data-source-picker-new-source')).toBeNull();
  });

  test('a typed name is created, trimmed, and the view points at it', async () => {
    const createSource = vi.fn(async () => ({ id: 's-9', title: 'Budget' }));
    const { search, view } = await openList({ createSource });
    search.value = ' Budget ';
    search.dispatchEvent(new InputEvent('input', { bubbles: true }));
    await frame();
    byTestId('data-source-picker-new-source-typed')!.click();
    await vi.waitFor(() => expect(changeViewSource).toHaveBeenCalledTimes(1));
    expect(createSource).toHaveBeenCalledWith('host:plan', 'Budget');
    expect(changeViewSource).toHaveBeenCalledWith(
      view.manager.dataSource,
      'v1',
      's-9',
      'new'
    );
  });

  const entries = () =>
    [
      ...byTestId('data-source-picker')!.querySelectorAll<HTMLElement>(
        '[data-testid^="data-source-picker-source-"]'
      ),
    ].map(entry => [
      entry.querySelector('.affine-menu-action-text')?.textContent?.trim(),
      entry
        .querySelector('[data-testid="source-database-label"]')
        ?.textContent?.trim() ?? null,
    ]);

  test("with crossDatabaseViews: this database's sources first, then the others by name, labelled", async () => {
    await openList({ crossDatabaseViews: true });
    expect(entries()).toEqual([
      ['Projects', null],
      ['Risks', null],
      ['Alumni', 'Archive'],
      ['Team', 'People'],
      ['Zeta', 'Archive'],
    ]);
  });

  test("the check matches the view's database and source", async () => {
    await openList({
      crossDatabaseViews: true,
      dataSource: hosted({ current: 's-1', currentDatabase: 'host:archive' }),
    });
    const checked = [
      ...document.querySelectorAll<HTMLElement>('.selected-item'),
    ].map(entry => entry.textContent?.trim());
    expect(checked).toHaveLength(1);
    expect(checked[0]).toContain('Alumni');
  });

  test("a pick of another database's source names that database", async () => {
    const { view } = await openList({ crossDatabaseViews: true });
    const team = [
      ...document.querySelectorAll<HTMLElement>(
        '[data-testid="data-source-picker-source-s-3"]'
      ),
    ];
    expect(team).toHaveLength(1);
    team[0]!.click();
    expect(changeViewSource).toHaveBeenCalledWith(
      view.manager.dataSource,
      'v1',
      's-3',
      'existing',
      'host:people'
    );
  });

  test('the search filters on the source name, not the database', async () => {
    const { search } = await openList({ crossDatabaseViews: true });
    search.value = 'archive';
    search.dispatchEvent(new InputEvent('input', { bubbles: true }));
    await frame();
    expect(entries().filter(([, label]) => label !== null)).toEqual([]);
    search.value = 'tea';
    search.dispatchEvent(new InputEvent('input', { bubbles: true }));
    await frame();
    expect(entries()).toEqual([['Team', 'People']]);
  });

  test('"Create source" still creates in this database', async () => {
    const createSource = vi.fn(async () => ({ id: 's-9', title: 'Budget' }));
    const { search } = await openList({
      crossDatabaseViews: true,
      createSource,
    });
    search.value = 'Budget';
    search.dispatchEvent(new InputEvent('input', { bubbles: true }));
    await frame();
    byTestId('data-source-picker-new-source-typed')!.click();
    await vi.waitFor(() => expect(changeViewSource).toHaveBeenCalledTimes(1));
    expect(createSource).toHaveBeenCalledWith('host:plan', 'Budget');
  });

  test("the picker's back reopens the view settings", async () => {
    const { ctx, reopen } = context();
    await draw(ctx, databaseViewSettingsMenu().items(ctx)!);
    byTestId('dv-view-setting-source')!.click();
    await frame();
    byTestId('data-source-picker')!
      .querySelector<HTMLElement>('.dv-icon-20')!
      .click();
    expect(reopen).toHaveBeenCalledTimes(1);
    expect(changeViewSource).not.toHaveBeenCalled();
  });

  test('the tooling extension registers the entry popViewOptions reads', () => {
    const registered: { setup: (di: unknown) => void }[] = [];
    const extensionContext = {
      scope: 'page',
      register: (ext: unknown) => {
        registered.push(...(Array.isArray(ext) ? ext : [ext]));
        return extensionContext;
      },
    };
    new DatabaseEditorToolingViewExtension().setup(extensionContext as never);
    const override = vi.fn();
    registered.forEach(ext => ext.setup({ override, addImpl: vi.fn() }));
    expect(override).toHaveBeenCalledWith(
      ViewSettingsMenuIdentifier,
      expect.any(Function)
    );
  });
});

describe('"Rename source" in the view\'s "Source" list', () => {
  async function openList(opts: Parameters<typeof context>[0] = {}) {
    const result = context(opts);
    await draw(result.ctx, databaseViewSettingsMenu().items(result.ctx)!);
    byTestId('dv-view-setting-source')!.click();
    await frame();
    return result;
  }

  async function openStep() {
    byTestId('data-source-picker-rename-source')!.click();
    await vi.waitFor(() =>
      expect(step()?.querySelector('affine-menu-input')).not.toBeNull()
    );
    const host = step()!.querySelector('affine-menu-input')!;
    await frame();
    return (host.shadowRoot ?? host).querySelector('input')!;
  }

  function type(input: HTMLInputElement, value: string) {
    Object.assign(input, { value });
    input.dispatchEvent(new InputEvent('input', { bubbles: true }));
  }

  const press = (input: HTMLInputElement, key: string) =>
    input.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }));

  const step = () => byTestId('data-source-picker-rename-source-step');
  const status = () =>
    byTestId('data-source-picker-rename-source-status')?.textContent?.trim();

  /** Leave the step as the pointer does, onto a source of the list. */
  const leaveStep = () =>
    byTestId('data-source-picker-source-s-2')!
      .closest('affine-menu-button')!
      .dispatchEvent(new MouseEvent('mouseenter'));

  test('is absent without the verb, without the picker, read-only, or on another database', async () => {
    const renameSource = vi.fn(async () => ({ ok: true as const }));
    await openList();
    expect(byTestId('data-source-picker')).not.toBeNull();
    expect(byTestId('data-source-picker-rename-source')).toBeNull();
    document.body.innerHTML = '';

    expect(
      databaseViewSettingsMenu().items(
        context({ renameSource, picker: false }).ctx
      )
    ).toBeUndefined();

    await openList({ renameSource, storeReadonly: true });
    expect(byTestId('data-source-picker-rename-source')).toBeNull();
    document.body.innerHTML = '';

    await openList({
      renameSource,
      crossDatabaseViews: true,
      dataSource: hosted({ current: 's-1', currentDatabase: 'host:archive' }),
    });
    expect(byTestId('data-source-picker-rename-source')).toBeNull();
    document.body.innerHTML = '';

    await openList({ renameSource });
    const first = byTestId('data-source-picker')!.querySelector(
      '[data-testid^="data-source-picker-"]'
    );
    expect(first?.getAttribute('data-testid')).toBe(
      'data-source-picker-rename-source'
    );
    expect(renameSource).not.toHaveBeenCalled();
  });

  test('opens on the current name; Enter calls the verb with the trimmed name', async () => {
    const renameSource = vi.fn(async () => ({ ok: true as const }));
    await openList({ renameSource, dataSource: hosted({ current: 's-2' }) });
    const input = await openStep();
    expect(input.value).toBe('Projects');
    type(input, '  Budget ');
    press(input, 'Enter');
    await vi.waitFor(() => expect(renameSource).toHaveBeenCalledTimes(1));
    expect(renameSource).toHaveBeenCalledWith('host:plan', 's-2', 'Budget');
    await vi.waitFor(() => expect(step()).toBeNull());
    // The library writes nothing: the host renames.
    expect(changeViewSource).not.toHaveBeenCalled();
  });

  test("a refusal shows the host's message and keeps the field", async () => {
    const renameSource = vi.fn(async () => ({
      ok: false as const,
      message: 'Name used by "Risks".',
    }));
    await openList({ renameSource });
    const input = await openStep();
    type(input, 'Risks');
    press(input, 'Enter');
    await vi.waitFor(() => expect(status()).toBe('Name used by "Risks".'));
    expect(step()).not.toBeNull();
    expect(renameSource).toHaveBeenCalledTimes(1);
  });

  test('a rejection shows the generic failure and keeps the field', async () => {
    const renameSource = vi.fn(async () => {
      throw new Error('offline');
    });
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    await openList({ renameSource });
    const input = await openStep();
    type(input, 'Budget');
    press(input, 'Enter');
    await vi.waitFor(() =>
      expect(status()).toBe('The source could not be renamed.')
    );
    expect(step()).not.toBeNull();
    error.mockRestore();
  });

  test('Escape, an unchanged name and an empty one call nothing', async () => {
    const renameSource = vi.fn(async () => ({ ok: true as const }));
    await openList({ renameSource });
    let input = await openStep();
    type(input, 'Budget');
    press(input, 'Escape');
    input.dispatchEvent(new FocusEvent('blur'));
    await frame();
    leaveStep();

    input = await openStep();
    type(input, ' Projects ');
    press(input, 'Enter');
    await vi.waitFor(() => expect(step()).toBeNull());

    input = await openStep();
    type(input, '   ');
    press(input, 'Enter');
    await frame();
    expect(status()).toBe('Give the source a name.');
    expect(step()).not.toBeNull();
    expect(renameSource).not.toHaveBeenCalled();
  });

  test('a second Enter while the host answers is ignored, a late answer is dropped', async () => {
    let answer!: (result: { ok: false; message: string }) => void;
    const renameSource = vi.fn(
      () =>
        new Promise<{ ok: false; message: string }>(resolve => {
          answer = resolve;
        })
    );
    await openList({ renameSource });
    let input = await openStep();
    type(input, 'Budget');
    press(input, 'Enter');
    press(input, 'Enter');
    await frame();
    expect(renameSource).toHaveBeenCalledTimes(1);
    leaveStep();
    expect(step()).toBeNull();
    answer({ ok: false, message: 'late' });
    await frame();
    input = await openStep();
    expect(input.value).toBe('Projects');
    expect(status()).toBeUndefined();
  });

  test("the host's naming rule warns while typing, never about the source's own name", async () => {
    const renameSource = vi.fn(async () => ({ ok: true as const }));
    await openList({
      renameSource,
      sourceName: {
        suggest: () => '',
        check: name => {
          const key = name.trim().toLowerCase();
          if (!key) return 'empty';
          return ['projects', 'risks'].includes(key) ? 'taken' : 'ok';
        },
      },
    });
    const input = await openStep();
    type(input, 'PROJECTS');
    await frame();
    await frame();
    expect(status()).toBeUndefined();
    type(input, 'risks');
    await vi.waitFor(() =>
      expect(status()).toBe('Another source already has this name.')
    );
    // A warning only: the host's verb decides.
    press(input, 'Enter');
    await vi.waitFor(() => expect(renameSource).toHaveBeenCalledTimes(1));
  });
});
