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

import { dataSourcePickerItems } from '../data-source-picker.js';
import {
  DATABASE_ADD_VIEW_UNTITLED_SOURCE,
  PICKER_TITLE,
  VIEW_SETTINGS_SOURCE,
} from '../translations.js';
import { changeViewSource } from '../view-transfer/change-source.js';
import { databaseIdOf } from '../view-transfer/import-view.js';

/**
 * "Source" in a view's settings (ADR 0035 amendment of 2026-10-28): which
 * source of its database the view reads, and the picker to point it at
 * another, "New source" included when the host gives `createSource`. One
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
 * Pop the picker on this database's sources at `target`, its "back" reopening
 * the view settings (`reopen`); a pick points the view at it. The picker's
 * own items (`dataSourcePickerItems`, "New source" through `createSource`)
 * under its own title, so it reads as the "+ view" picker does.
 */
export function popChangeSourcePicker(
  std: BlockStdScope,
  target: PopupTarget,
  change: ChangeSourceTarget,
  reopen: () => void
): MenuHandler {
  const { dataSource, databaseId, picker, viewId } = change;
  return popMenu(target, {
    options: {
      title: { text: translateKey(std, ...PICKER_TITLE), onBack: reopen },
      testId: 'data-source-picker',
      items: dataSourcePickerItems(std, picker, {
        databaseId,
        onPick: ({ sourceId, source }) => {
          changeViewSource(dataSource, viewId, sourceId, source);
        },
      }),
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
