import { HostedDataSourceBase } from '@labre/affine-database-block';
import {
  menu,
  type MenuHandler,
  popMenu,
  type PopupTarget,
} from '@labre/affine-components/context-menu';
import {
  DataSourcePickerProvider,
  type DataSourcePickerService,
  translateKey,
} from '@labre/affine-shared/services';
import type {
  DataSource,
  ViewSettingsMenu,
} from '@labre/affine-database-engine';
import {
  ArrowRightSmallIcon,
  DatabaseTableViewIcon,
} from '@blocksuite/icons/lit';
import type { BlockStdScope } from '@labre/std';
import type { ReadonlySignal } from '@preact/signals-core';
import { html } from 'lit';

import { named, sourceSearch, typedSourceEntry } from '../new-source-entry.js';
import {
  DATABASE_ADD_VIEW_UNTITLED_SOURCE,
  PICKER_TITLE,
  VIEW_SETTINGS_SOURCE,
} from '../translations.js';
import { changeViewSource } from '../view-transfer/change-source.js';
import { databaseIdOf } from '../view-transfer/import-view.js';

/**
 * "Source" in a view's settings (ADR 0035 amendment of 2026-10-28): which
 * source of its database the view reads, and the list to point it at
 * another or at one created from its search (`createSource`). One
 * predicate and one opener for the two places that offer it, the view
 * settings menu (`databaseViewSettingsMenu`) and the full page's
 * `database.view.source` command, so they cannot disagree.
 */

/** The view as the predicate reads it: `SingleView` of `@labre/affine-database-engine`, by shape. */
interface SourceView {
  id: string;
  readonly$: ReadonlySignal<boolean>;
  shownAsFallback$: ReadonlySignal<boolean>;
}

/** Everything the entry needs, or nothing when the view offers no source choice. */
export interface ChangeSourceTarget {
  dataSource: HostedDataSourceBase;
  databaseId: string;
  picker: DataSourcePickerService;
  viewId: string;
}

/**
 * Whether `view` offers "Source" now: a database whose views name their
 * source (`resolvesSources`), the picker naming it (`databaseIdOf`, the
 * block's `externalSourceId`), the host's picker registered, and a view that
 * takes settings (not read-only, not drawn through a fallback preset). An
 * inline database has one implicit source and nothing to choose.
 */
export function changeSourceTarget(
  std: BlockStdScope,
  dataSource: DataSource,
  view: SourceView
): ChangeSourceTarget | undefined {
  if (!(dataSource instanceof HostedDataSourceBase)) return;
  if (!dataSource.resolvesSources) return;
  if (view.readonly$.value || view.shownAsFallback$.value) return;
  const picker = std.getOptional(DataSourcePickerProvider);
  if (!picker) return;
  const databaseId = databaseIdOf(dataSource);
  if (databaseId === undefined) return;
  return { dataSource, databaseId, picker, viewId: view.id };
}

/** The current source's title, or "Untitled source". */
export function currentSourceTitle(
  std: BlockStdScope,
  dataSource: HostedDataSourceBase
): string {
  return (
    dataSource.schema$.value?.props.title.toString() ||
    translateKey(std, ...DATABASE_ADD_VIEW_UNTITLED_SOURCE)
  );
}

/**
 * Pop the list of this database's sources at `target`, its "back" reopening
 * the view settings (`reopen`); a pick points the view at it. One source list
 * with "+ view" (ADR 0035 amendment of 2026-10-30): the search field shown
 * from the start, the view's current source checked (picking it again only
 * closes), and "Create source “typed”" last, which creates the typed name
 * through `createSource` and points the view at it. The search is the naming
 * step: no "New source" sub-step here.
 */
export function popChangeSourcePicker(
  std: BlockStdScope,
  target: PopupTarget,
  change: ChangeSourceTarget,
  reopen: () => void
): MenuHandler {
  const { dataSource, databaseId, picker, viewId } = change;
  const list = picker.list();
  const createSource = picker.createSource;
  const current = (
    dataSource.viewDataGet(viewId) as { sourceId?: unknown } | undefined
  )?.sourceId;
  return popMenu(target, {
    options: {
      title: { text: translateKey(std, ...PICKER_TITLE), onBack: reopen },
      testId: 'data-source-picker',
      search: sourceSearch(std),
      items: [
        menu.dynamic(() => {
          const sources =
            list.value.find(database => database.id === databaseId)?.sources ??
            [];
          const items = sources.map(source =>
            menu.action({
              name:
                source.title ||
                translateKey(std, ...DATABASE_ADD_VIEW_UNTITLED_SOURCE),
              prefix: DatabaseTableViewIcon(),
              isSelected: source.id === current,
              testId: `data-source-picker-source-${source.id}`,
              select: () => {
                if (source.id === current) return;
                changeViewSource(dataSource, viewId, source.id, 'existing');
              },
            })
          );
          if (!createSource || std.store.readonly) return items;
          return [
            ...items,
            typedSourceEntry(
              std,
              picker.sourceName,
              sources.map(source => source.title),
              {
                testId: 'data-source-picker-new-source',
                create: sourceName => {
                  createSource
                    .call(picker, databaseId, ...named(sourceName))
                    .then(created => {
                      if (created) {
                        changeViewSource(dataSource, viewId, created.id, 'new');
                      }
                    })
                    .catch(console.error);
                },
              }
            ),
          ];
        }),
      ],
    },
  });
}

/**
 * The view settings' "Source" (`ViewSettingsMenuIdentifier`, registered by
 * the tooling extension): one entry after "Layout", its postfix the current
 * source's title. `undefined` where {@link changeSourceTarget} says no, so an
 * inline database's settings stay the 0.61 menu.
 */
export function databaseViewSettingsMenu(): ViewSettingsMenu {
  return {
    items: ({ std, dataViewLogic, target, reopen, wording }) => {
      const view = dataViewLogic.view;
      const change = changeSourceTarget(std, view.manager.dataSource, view);
      if (!change) return;
      return [
        menu.action({
          name: wording(VIEW_SETTINGS_SOURCE),
          prefix: DatabaseTableViewIcon(),
          postfix: html` <div style="font-size: 14px;">
              ${currentSourceTitle(std, change.dataSource)}
            </div>
            ${ArrowRightSmallIcon()}`,
          testId: 'dv-view-setting-source',
          select: () => {
            popChangeSourcePicker(std, target, change, reopen);
          },
        }),
      ];
    },
  };
}
