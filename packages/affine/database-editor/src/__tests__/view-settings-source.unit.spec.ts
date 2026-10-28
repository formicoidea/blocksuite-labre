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
 * - the tooling extension no longer registering the entry.
 */
import { HostedDataSourceBase } from '@labre/affine-block-database';
import {
  effects as contextMenuEffects,
  type MenuConfig,
  popMenu,
  popupTargetFromElement,
} from '@labre/affine-components/context-menu';
import {
  type DataSourcePickerDatabase,
  DataSourcePickerProvider,
} from '@labre/affine-shared/services';
import {
  type DataViewUILogicBase,
  type ViewSettingsMenuContext,
  ViewSettingsMenuIdentifier,
} from '@labre/data-view';
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

function hosted(
  opts: { resolves?: boolean; title?: string; database?: string } = {}
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
    }
  );
}

function context(
  opts: {
    dataSource?: unknown;
    picker?: boolean;
    readonly?: boolean;
    fallback?: boolean;
  } = {}
) {
  const picker = { list: () => signal([PLAN, PEOPLE]) };
  const std = {
    store: { readonly: false },
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
