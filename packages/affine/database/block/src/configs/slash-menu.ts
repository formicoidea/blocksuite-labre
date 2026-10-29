import { getSelectedModelsCommand } from '@labre/affine-shared/commands';
import {
  DataSourcePickerProvider,
  TelemetryProvider,
} from '@labre/affine-shared/services';
import { isInsideBlockByFlavour } from '@labre/affine-shared/utils';
import type {
  SlashMenuActionItem,
  SlashMenuConfig,
} from '@labre/affine-widget-slash-menu';
import { viewPresets } from '@labre/affine-database-engine/view-presets';
import {
  DatabaseKanbanViewIcon,
  DatabaseTableViewIcon,
} from '@blocksuite/icons/lit';
import type { BlockStdScope } from '@labre/std';

import { insertDatabaseBlockCommand } from '../commands';
import { DatabaseCreationMenuIdentifier } from '../creation-menu.js';
import { createHostedDatabaseView } from '../linked-view.js';
import { KanbanViewTooltip, TableViewTooltip } from './tooltips';
import {
  DATABASE_SLASH_KANBAN_DESCRIPTION,
  DATABASE_SLASH_TABLE_DESCRIPTION,
} from '../translations.js';
import {
  VIEW_NAME_TABLE,
  VIEW_NAME_KANBAN,
} from '@labre/affine-database-engine/translations';

/**
 * With a data-source picker the host owns database creation (ADR 0035 §5):
 * its `createDatabase` is the only way in, and without it no entry creates
 * one. Without a picker, a native inline database, as in 0.48.
 */
export function canCreateDatabase(std: BlockStdScope): boolean {
  const picker = std.getOptional(DataSourcePickerProvider);
  return !picker || !!picker.createDatabase;
}

/**
 * A native database after the selection, replacing the slash entry's empty
 * line, reported once as `BlockCreated`. Returns its id, or `undefined` when
 * nothing was inserted.
 */
function insertNativeDatabase(
  std: BlockStdScope,
  viewType: string,
  initialRows?: number
): string | undefined {
  let inserted: string | undefined;
  std.command
    .chain()
    .pipe(getSelectedModelsCommand)
    .pipe(insertDatabaseBlockCommand, {
      viewType,
      place: 'after',
      removeEmptyLine: true,
      initialRows,
    })
    .pipe(({ insertedDatabaseBlockId }) => {
      if (insertedDatabaseBlockId) {
        inserted = insertedDatabaseBlockId;
        const telemetry = std.getOptional(TelemetryProvider);
        telemetry?.track('BlockCreated', {
          blockType: 'affine:database',
        });
      }
    })
    .run();
  return inserted;
}

/**
 * Three ways in, by what is registered (ADR 0035 §5, amendment of
 * 2026-10-28):
 *
 * - a picker and the bundle's creation menu: the database lands at once,
 *   native and with no row, and the menu opens over it to connect it to a
 *   source (`connectDatabaseToSource`). Dismissed, the native database stays
 *   and renders: nothing is lost by closing the popover;
 * - a picker alone (a core-only host): the host's `createDatabase` first,
 *   then a view of its first source, as in 0.61;
 * - no picker: a native inline database with 3 rows, as in 0.48.
 *
 * The one creation gesture: the slash entries and the mobile keyboard
 * toolbar's "Table view" / "Kanban view" both run it (ADR 0035 amendment of
 * 2026-10-29), so neither inserts native rows a host's picker would not see.
 */
export function createDatabaseByGesture(
  std: BlockStdScope,
  viewType: string
): void {
  if (!canCreateDatabase(std)) return;
  const picker = std.getOptional(DataSourcePickerProvider);
  if (!picker) {
    insertNativeDatabase(std, viewType);
    return;
  }
  const menu = std.getOptional(DatabaseCreationMenuIdentifier);
  if (!menu) {
    const [, { selectedModels }] = std.command.exec(getSelectedModelsCommand);
    const after = selectedModels?.at(-1);
    if (!after) return;
    createHostedDatabaseView(std, picker, {
      after,
      viewType,
      removeEmptyLine: true,
    }).catch(console.error);
    return;
  }
  const blockId = insertNativeDatabase(std, viewType, 0);
  if (!blockId) return;
  std.host.updateComplete
    .then(() => {
      const anchor = std.view.getBlock(blockId);
      if (anchor) menu.open({ std, blockId, anchor });
    })
    .catch(console.error);
}

function createDatabaseAction(viewType: string): SlashMenuActionItem['action'] {
  return ({ std }) => createDatabaseByGesture(std, viewType);
}

/**
 * The slash entries that CREATE a database, registered by the gated
 * `DatabaseViewExtension` only. No Calendar entry after 0.48 (ADR 0035 §6):
 * a calendar is no longer created anywhere, a stored one still renders.
 */
export const databaseSlashMenuConfig: SlashMenuConfig = {
  disableWhen: ({ model }) => model.flavour === 'affine:database',
  items: [
    {
      name: VIEW_NAME_TABLE[1],
      nameWording: VIEW_NAME_TABLE,
      description: DATABASE_SLASH_TABLE_DESCRIPTION[1],
      descriptionWording: DATABASE_SLASH_TABLE_DESCRIPTION,
      searchAlias: ['database'],
      icon: DatabaseTableViewIcon(),
      tooltip: {
        figure: TableViewTooltip,
        caption: VIEW_NAME_TABLE[1],
        captionWording: VIEW_NAME_TABLE,
      },
      group: '7_Database@0',
      when: ({ model, std }) =>
        !isInsideBlockByFlavour(model.store, model, 'affine:edgeless-text') &&
        canCreateDatabase(std),
      action: createDatabaseAction(viewPresets.tableViewMeta.type),
    },

    {
      name: VIEW_NAME_KANBAN[1],
      nameWording: VIEW_NAME_KANBAN,
      description: DATABASE_SLASH_KANBAN_DESCRIPTION[1],
      descriptionWording: DATABASE_SLASH_KANBAN_DESCRIPTION,
      searchAlias: ['database'],
      icon: DatabaseKanbanViewIcon(),
      tooltip: {
        figure: KanbanViewTooltip,
        caption: VIEW_NAME_KANBAN[1],
        captionWording: VIEW_NAME_KANBAN,
      },
      group: '7_Database@2',
      when: ({ model, std }) =>
        !isInsideBlockByFlavour(model.store, model, 'affine:edgeless-text') &&
        canCreateDatabase(std),
      action: createDatabaseAction(viewPresets.kanbanViewMeta.type),
    },
  ],
};
