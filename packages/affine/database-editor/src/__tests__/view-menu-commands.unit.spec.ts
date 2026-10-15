/**
 * The full page's "This view" commands (labre PRD REQ-DB-10, ADR 0035
 * amendment of 2026-10-14): a host lists them with `getViewActions` and runs
 * them with `runViewAction`, so what it shows is the page's `'view-menu'`
 * commands and nothing else.
 *
 * What it would have caught:
 * - a command registered beside an inline database (the header's ⋯ would
 *   list the settings of a table inside a page, ui-principles §1 of the
 *   Labre app): they come with `databasePageRootExtension` only;
 * - a command that binds a chord, or that a host's other surfaces list;
 * - an entry listed where its setting is not offered (grouping on a layout
 *   with no group trait, "Open pages in" on rows that are blocks), or on a
 *   read-only page, where the view settings button is not drawn;
 * - a run that draws its own menu instead of the view settings' entry
 *   (`openSetting` of the view's options button), conditional colours
 *   (ADR 0036) included;
 * - "Import a view" or "Save as template" offered with no host verb, or
 *   offered on an inline database.
 */
import { DataSourcePickerProvider } from '@labre/affine-shared/services';
import { Container } from '@labre/global/di';
import {
  type AnyCommandDescriptor,
  BlockViewIdentifier,
  type BlockStdScope,
  CommandDescriptorIdentifier,
} from '@labre/std';
import { signal } from '@preact/signals-core';
import { literal } from 'lit/static-html.js';
import { describe, expect, test, vi } from 'vitest';

import { databasePageRootExtension } from '../database-page/database-page-root.js';
import { databasePageViewCommands } from '../database-page/view-menu-commands.js';

function registered(): AnyCommandDescriptor[] {
  const container = new Container();
  container.addImpl(
    BlockViewIdentifier('affine:page'),
    () => literal`affine-page-root`
  );
  databasePageRootExtension('host').setup(container);
  return [...container.provider().getAll(CommandDescriptorIdentifier).values()];
}

function fakePage(opts: {
  offered?: (key: string) => boolean;
  readonly?: boolean;
  picker?: object | null;
  hosted?: boolean;
}) {
  const readonly$ = signal(opts.readonly ?? false);
  const openSetting = vi.fn();
  const dataSource = {
    readonly$,
    properties$: signal([]),
    viewMetas: [{ type: 'table' }],
    viewManager: { currentViewId$: signal('v1') },
    viewDataGet: () => ({ id: 'v1', name: 'Table', mode: 'table' }),
  };
  const options = {
    settingAvailable: (key: string) =>
      !readonly$.value && (opts.offered?.(key) ?? true),
    openSetting,
    dataViewLogic: { view: { manager: { dataSource } } },
  };
  const block = { querySelector: () => options };
  const std = {
    view: { getBlock: (id: string) => (id === 'host' ? block : null) },
    getOptional: (id: unknown) =>
      id === DataSourcePickerProvider ? (opts.picker ?? null) : null,
  } as unknown as BlockStdScope;
  return { std, openSetting, readonly$ };
}

const byId = (id: string) =>
  databasePageViewCommands('host').find(command => command.id === id)!;

describe('the full page registers its view-menu commands', () => {
  test('seven commands, on the view menu only, no chord, page scope', () => {
    const commands = registered();
    expect(commands.map(command => command.id)).toEqual([
      'database.view.layout',
      'database.view.group',
      'database.view.open-in',
      'database.view.properties',
      'database.view.color-rules',
      'database.view.save-template',
      'database.view.import',
    ]);
    for (const command of commands) {
      expect(command.surfaces).toEqual(['view-menu']);
      expect(command.scope).toBe('page');
      expect(command.defaultKeys).toEqual({ mac: [], other: [] });
      expect(command.labelKey).toMatch(/^com\.labre\./);
      expect(command.labelFallback).toBeTruthy();
    }
  });
});

describe('a setting', () => {
  test('is listed where the view settings offer it, and opens their entry', () => {
    const page = fakePage({ offered: key => key !== 'group' });
    expect(byId('database.view.layout').when?.(page.std)).toBe(true);
    expect(byId('database.view.open-in').when?.(page.std)).toBe(true);
    expect(byId('database.view.group').when?.(page.std)).toBe(false);
    expect(byId('database.view.color-rules').when?.(page.std)).toBe(true);

    void byId('database.view.open-in').run(page.std, {
      surface: 'view-menu',
      source: 'context-menu',
    });
    expect(page.openSetting).toHaveBeenCalledWith('open-in');
    void byId('database.view.color-rules').run(page.std, {
      surface: 'view-menu',
      source: 'context-menu',
    });
    expect(page.openSetting).toHaveBeenCalledWith('color-rules');
  });

  test('is not listed on a read-only page, and follows it back', () => {
    const page = fakePage({ readonly: true });
    expect(byId('database.view.layout').when?.(page.std)).toBe(false);
    page.readonly$.value = false;
    expect(byId('database.view.layout').when?.(page.std)).toBe(true);
  });

  test('is not listed when the page shows no view', () => {
    const page = fakePage({});
    const empty = {
      ...page.std,
      view: { getBlock: () => null },
    } as unknown as BlockStdScope;
    expect(byId('database.view.properties').when?.(empty)).toBe(false);
  });
});

describe('the transfers', () => {
  test('need the picker verbs and a database the picker names', () => {
    const none = fakePage({ picker: {} });
    expect(byId('database.view.import').when?.(none.std)).toBe(false);
    expect(byId('database.view.save-template').when?.(none.std)).toBe(false);

    // A data source that is not hosted (an inline database) names none.
    const inline = fakePage({
      picker: { importView: vi.fn(), saveViewTemplate: vi.fn() },
    });
    expect(byId('database.view.import').when?.(inline.std)).toBe(false);
    expect(byId('database.view.save-template').when?.(inline.std)).toBe(false);
  });
});
