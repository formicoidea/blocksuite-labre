import { insertLinkedDatabaseView } from '@labre/affine-database-block';
import { popupTargetFromElement } from '@labre/affine-components/context-menu';
import { getSelectedModelsCommand } from '@labre/affine-shared/commands';
import { DataSourcePickerProvider } from '@labre/affine-shared/services';
import { isInsideBlockByFlavour } from '@labre/affine-shared/utils';
import type { SlashMenuConfig } from '@labre/affine-widget-slash-menu';
import { LinkIcon } from '@blocksuite/icons/lit';

import { popDataSourcePicker } from './data-source-picker.js';
import {
  SLASH_LINKED_VIEW,
  SLASH_LINKED_VIEW_DESCRIPTION,
} from './translations.js';

/**
 * "Linked view of a database" (ADR 0035 §9c, issue B12): pick a source of a
 * database the host lists, or a new one, and insert a table view of it after
 * the line. Registered by the gated `DatabaseEditorToolingViewExtension` only,
 * and drawn only when the host fills the picker: without it the library
 * knows no database to link to.
 */
export const linkedViewSlashMenuConfig: SlashMenuConfig = {
  disableWhen: ({ model }) => model.flavour === 'affine:database',
  items: [
    {
      name: SLASH_LINKED_VIEW[1],
      nameWording: SLASH_LINKED_VIEW,
      description: SLASH_LINKED_VIEW_DESCRIPTION[1],
      descriptionWording: SLASH_LINKED_VIEW_DESCRIPTION,
      searchAlias: ['database', 'linked view'],
      icon: LinkIcon(),
      group: '7_Database@3',
      when: ({ model, std }) =>
        !!std.getOptional(DataSourcePickerProvider) &&
        !isInsideBlockByFlavour(model.store, model, 'affine:edgeless-text'),
      action: ({ std }) => {
        const picker = std.getOptional(DataSourcePickerProvider);
        if (!picker) return;
        const [, { selectedModels }] = std.command.exec(
          getSelectedModelsCommand
        );
        const after = selectedModels?.at(-1);
        const anchor = after ? std.view.getBlock(after.id) : null;
        if (!after || !anchor) return;
        popDataSourcePicker(std, picker, popupTargetFromElement(anchor), {
          onPick: ({ database, sourceId }) => {
            insertLinkedDatabaseView(std, {
              after,
              database,
              sourceId,
              viewType: 'table',
              removeEmptyLine: true,
            });
          },
        });
      },
    },
  ],
};
