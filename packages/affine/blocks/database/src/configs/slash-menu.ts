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
import { viewPresets } from '@labre/data-view/view-presets';
import {
  DatabaseKanbanViewIcon,
  DatabaseTableViewIcon,
} from '@blocksuite/icons/lit';
import type { BlockStdScope } from '@labre/std';

import { insertDatabaseBlockCommand } from '../commands';
import { createHostedDatabaseView } from '../linked-view.js';
import { KanbanViewTooltip, TableViewTooltip } from './tooltips';

/**
 * With a data-source picker the host owns database creation (ADR 0035 §5):
 * its `createDatabase` is the only way in, and without it no entry creates
 * one. Without a picker, a native inline database, as in 0.48.
 */
function canCreateDatabase(std: BlockStdScope): boolean {
  const picker = std.getOptional(DataSourcePickerProvider);
  return !picker || !!picker.createDatabase;
}

function createDatabaseAction(viewType: string): SlashMenuActionItem['action'] {
  return ({ std }) => {
    const picker = std.getOptional(DataSourcePickerProvider);
    if (picker) {
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
    std.command
      .chain()
      .pipe(getSelectedModelsCommand)
      .pipe(insertDatabaseBlockCommand, {
        viewType,
        place: 'after',
        removeEmptyLine: true,
      })
      .pipe(({ insertedDatabaseBlockId }) => {
        if (insertedDatabaseBlockId) {
          const telemetry = std.getOptional(TelemetryProvider);
          telemetry?.track('BlockCreated', {
            blockType: 'affine:database',
          });
        }
      })
      .run();
  };
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
      name: 'Table View',
      description: 'Display items in a table format.',
      searchAlias: ['database'],
      icon: DatabaseTableViewIcon(),
      tooltip: {
        figure: TableViewTooltip,
        caption: 'Table View',
      },
      group: '7_Database@0',
      when: ({ model, std }) =>
        !isInsideBlockByFlavour(model.store, model, 'affine:edgeless-text') &&
        canCreateDatabase(std),
      action: createDatabaseAction(viewPresets.tableViewMeta.type),
    },

    {
      name: 'Kanban View',
      description: 'Visualize data in a dashboard.',
      searchAlias: ['database'],
      icon: DatabaseKanbanViewIcon(),
      tooltip: {
        figure: KanbanViewTooltip,
        caption: 'Kanban View',
      },
      group: '7_Database@2',
      when: ({ model, std }) =>
        !isInsideBlockByFlavour(model.store, model, 'affine:edgeless-text') &&
        canCreateDatabase(std),
      action: createDatabaseAction(viewPresets.kanbanViewMeta.type),
    },
  ],
};
