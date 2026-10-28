import type { DatabaseBlockModel } from '@labre/affine-model';
import type { BlockStdScope, Command } from '@labre/std';
import type { BlockModel, Store } from '@labre/store';

import {
  DatabaseBlockDataSource,
  databaseViewInitTemplate,
} from './data-source';

export const insertDatabaseBlockCommand: Command<
  {
    selectedModels?: BlockModel[];
    viewType: string;
    place?: 'after' | 'before';
    removeEmptyLine?: boolean;
    /**
     * Empty rows the new database starts with, 3 when absent (0.48). The
     * creation popover inserts none: the rows come with the source the
     * reader picks (ADR 0035 amendment of 2026-10-28).
     */
    initialRows?: number;
  },
  {
    insertedDatabaseBlockId: string;
  }
> = (ctx, next) => {
  const { selectedModels, viewType, place, removeEmptyLine, initialRows, std } =
    ctx;
  if (!selectedModels?.length) return;

  const targetModel =
    place === 'before'
      ? selectedModels[0]
      : selectedModels[selectedModels.length - 1];

  if (!targetModel) return;

  const result = std.store.addSiblingBlocks(
    targetModel,
    [{ flavour: 'affine:database' }],
    place
  );
  const string = result[0];

  if (string == null) return;

  initDatabaseBlock(
    std.store,
    targetModel,
    string,
    viewType,
    false,
    std,
    initialRows
  );

  if (removeEmptyLine && targetModel.text?.length === 0) {
    std.store.deleteBlock(targetModel);
  }

  next({ insertedDatabaseBlockId: string });
};

export const initDatabaseBlock = (
  doc: Store,
  model: BlockModel,
  databaseId: string,
  viewType: string,
  isAppendNewRow = true,
  std?: BlockStdScope,
  initialRows?: number
) => {
  const blockModel = doc.getBlock(databaseId)?.model as
    | DatabaseBlockModel
    | undefined;
  if (!blockModel) {
    return;
  }
  const datasource = new DatabaseBlockDataSource(blockModel);
  databaseViewInitTemplate(datasource, viewType, std, initialRows);
  if (isAppendNewRow) {
    const parent = doc.getParent(model);
    if (!parent) return;
    doc.addBlock('affine:paragraph', {}, parent.id);
  }
};
