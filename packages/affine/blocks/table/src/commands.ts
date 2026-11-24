import { type TableBlockModel, TableModelFlavour } from '@labre/affine-model';
import type { Command } from '@labre/std';
import type { BlockModel, Store } from '@labre/store';

import { TableDataManager } from './table-data-manager';

/**
 * The block the table is inserted beside: the selected block when its parent
 * accepts a table, else its closest ancestor whose parent does. A sibling of
 * a nested list item or of a paragraph inside a callout is refused by the
 * schema, and the slash menu swallows that `SchemaValidateError`, so nothing
 * happened (#729). The schema decides, not a hard-coded `affine:note`.
 */
function tableAnchor(store: Store, model: BlockModel): BlockModel | undefined {
  const parent = store.getParent(model);
  if (!parent) return undefined;
  return store.schema.safeValidate(TableModelFlavour, parent.flavour)
    ? model
    : tableAnchor(store, parent);
}

export const insertTableBlockCommand: Command<
  {
    place?: 'after' | 'before';
    removeEmptyLine?: boolean;
    selectedModels?: BlockModel[];
  },
  {
    insertedTableBlockId: string;
  }
> = (ctx, next) => {
  const { selectedModels, place, removeEmptyLine, std } = ctx;
  if (std.store.readonly) return;
  if (!selectedModels?.length) return;

  const targetModel =
    place === 'before'
      ? selectedModels[0]
      : selectedModels[selectedModels.length - 1];

  if (!targetModel) return;

  const anchor = tableAnchor(std.store, targetModel);
  if (!anchor) return;

  const result = std.store.addSiblingBlocks(
    anchor,
    [{ flavour: TableModelFlavour }],
    place
  );
  const blockId = result[0];

  if (blockId == null) return;

  const model = std.store.getBlock(blockId)?.model as TableBlockModel;
  if (model == null) return;

  const dataManager = new TableDataManager(model);

  dataManager.addNRow(2);
  dataManager.addNColumn(2);

  if (removeEmptyLine && targetModel.text?.length === 0) {
    std.store.deleteBlock(targetModel);
  }

  next({ insertedTableBlockId: blockId });
};
