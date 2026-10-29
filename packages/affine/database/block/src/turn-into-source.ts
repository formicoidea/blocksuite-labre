import { toast } from '@labre/affine-components/toast';
import type { DatabaseBlockModel } from '@labre/affine-model';
import {
  type ChromeWording,
  type DataSourcePickerContent,
  type DataSourcePickerDatabase,
  DataSourcePickerProvider,
  type DataSourcePickerProperty,
  type DataSourcePickerRow,
  NotificationProvider,
  translateKey,
} from '@labre/affine-shared/services';
import type { BlockStdScope } from '@labre/std';
import type { BlockModel, DeltaInsert } from '@labre/store';

import {
  insertLinkedDatabaseView,
  moveDatabaseIntoSource,
} from './linked-view.js';
import {
  DATABASE_TURN_INTO_FAILED,
  DATABASE_TURN_INTO_NESTED,
} from './translations.js';

/**
 * "Turn into a source" (ADR 0035 amendment of 2026-10-29): under a host that
 * requires a source (`requireSource`), "Create Table" on selected paragraphs
 * and "Move into a database" on a database with native rows hand their
 * content to the host's `createDatabaseFrom`, then connect the block to the
 * database it answers, in one undo step. Nothing is written until the host
 * answers; a refusal, a rejection, a read-only document or content changed
 * in the meantime writes nothing and says so with a fixed message.
 */

/** The id of the title property a conversion of paragraphs sends. */
export const TURN_INTO_TITLE_PROPERTY = 'title';

function notify(std: BlockStdScope, wording: ChromeWording) {
  const message = translateKey(std, ...wording);
  const notification = std.getOptional(NotificationProvider);
  if (notification) notification.toast(message);
  else toast(std.host, message);
}

function rowOf(
  std: BlockStdScope,
  block: BlockModel,
  values: DataSourcePickerRow['values'] = {}
): DataSourcePickerRow {
  const transformer = std.store.getTransformer();
  return {
    // A Y.Text delta holds inserts only; the guard narrows its type.
    title: (block.text?.toDelta() ?? []).filter(
      (op): op is DeltaInsert => typeof op.insert === 'string'
    ),
    values,
    body: block.children.flatMap(child => {
      const snapshot = transformer.blockToSnapshot(child);
      return snapshot ? [snapshot] : [];
    }),
  };
}

/** The blocks, less those nested in another of them: they ride in its body. */
export function outermostBlocks(blocks: readonly BlockModel[]): BlockModel[] {
  const ids = new Set(blocks.map(block => block.id));
  return blocks.filter(block => {
    for (let parent = block.parent; parent; parent = parent.parent) {
      if (ids.has(parent.id)) return false;
    }
    return true;
  });
}

/** One row per block, its title the block's text, its body its children. */
export function blocksContent(
  std: BlockStdScope,
  blocks: readonly BlockModel[]
): DataSourcePickerContent {
  return {
    title: '',
    properties: [{ id: TURN_INTO_TITLE_PROPERTY, name: '', type: 'title' }],
    rows: blocks.map(block => rowOf(std, block)),
  };
}

/**
 * A native database's columns and rows. A value is sent as stored, a rich
 * text as its delta; the title column is the row's own text.
 */
export function databaseContent(
  std: BlockStdScope,
  model: DatabaseBlockModel
): DataSourcePickerContent {
  const columns = model.props.columns;
  const title = columns.find(column => column.type === 'title');
  const properties: DataSourcePickerProperty[] = [
    title
      ? { id: title.id, name: title.name, type: 'title' }
      : { id: TURN_INTO_TITLE_PROPERTY, name: '', type: 'title' },
    ...columns
      .filter(column => column.type !== 'title')
      .map(column => {
        const options = (column.data as { options?: unknown }).options;
        return {
          id: column.id,
          name: column.name,
          type: column.type,
          ...(Array.isArray(options)
            ? {
                options: options.map(
                  (option: { id: string; value: string }) => ({
                    id: option.id,
                    value: option.value,
                  })
                ),
              }
            : {}),
        };
      }),
  ];
  const rows = model.children.map(row => {
    const values: Record<string, unknown> = {};
    for (const column of columns) {
      if (column.type === 'title') continue;
      const value = model.props.cells[row.id]?.[column.id]?.value;
      if (value === undefined) continue;
      values[column.id] =
        value && typeof value === 'object' && 'toDelta' in value
          ? (value as { toDelta(): unknown }).toDelta()
          : value;
    }
    return rowOf(std, row, values);
  });
  return { title: model.props.title.toString(), properties, rows };
}

/** Whether the host turns content into a source where one is required. */
export function canTurnIntoSource(std: BlockStdScope): boolean {
  const picker = std.getOptional(DataSourcePickerProvider);
  return picker?.requireSource === true && !!picker.createDatabaseFrom;
}

/** The host's database for `content`, or `null` once the reader was told why. */
async function createFrom(
  std: BlockStdScope,
  content: DataSourcePickerContent
): Promise<DataSourcePickerDatabase | null> {
  const picker = std.getOptional(DataSourcePickerProvider);
  const createDatabaseFrom = picker?.createDatabaseFrom;
  if (!picker || !createDatabaseFrom || std.store.readonly) return null;
  if (!picker.rowBodies && content.rows.some(row => row.body.length > 0)) {
    notify(std, DATABASE_TURN_INTO_NESTED);
    return null;
  }
  try {
    const database = await createDatabaseFrom.call(picker, content);
    if (database?.sources[0]) return database;
  } catch (error) {
    console.error(error);
  }
  notify(std, DATABASE_TURN_INTO_FAILED);
  return null;
}

/**
 * "Create Table" under a host that requires a source: the selected blocks
 * become the rows of a new host database, and a view of its first source
 * takes their place. Returns whether it was written.
 */
export async function turnBlocksIntoSource(
  std: BlockStdScope,
  selected: readonly BlockModel[],
  viewType: string
): Promise<boolean> {
  const blocks = outermostBlocks(selected);
  const first = blocks[0];
  if (!first || std.store.readonly) return false;
  const content = blocksContent(std, blocks);
  const database = await createFrom(std, content);
  const source = database?.sources[0];
  if (!database || !source) return false;
  const unchanged =
    !std.store.readonly &&
    blocks.every(block => std.store.getBlock(block.id)) &&
    JSON.stringify(blocksContent(std, blocks)) === JSON.stringify(content);
  if (!unchanged) {
    notify(std, DATABASE_TURN_INTO_FAILED);
    return false;
  }
  // `insertLinkedDatabaseView` opens the undo step; the deletions join it.
  const id = insertLinkedDatabaseView(std, {
    after: first,
    database,
    sourceId: source.id,
    viewType,
  });
  if (!id) {
    notify(std, DATABASE_TURN_INTO_FAILED);
    return false;
  }
  for (const block of blocks) std.store.deleteBlock(block);
  return true;
}

/**
 * "Move into a database" over native rows shown read-only: the database's
 * columns and rows become a new host database, and the block reads its
 * first source (`moveDatabaseIntoSource`). Returns whether it was written.
 */
export async function moveDatabaseRowsIntoSource(
  std: BlockStdScope,
  model: DatabaseBlockModel
): Promise<boolean> {
  if (std.store.readonly || model.props.externalSourceId !== undefined) {
    return false;
  }
  const content = databaseContent(std, model);
  const database = await createFrom(std, content);
  const source = database?.sources[0];
  if (!database || !source) return false;
  const unchanged =
    !!std.store.getBlock(model.id) &&
    JSON.stringify(databaseContent(std, model)) === JSON.stringify(content);
  if (
    !unchanged ||
    !moveDatabaseIntoSource(std, model, { database, sourceId: source.id })
  ) {
    notify(std, DATABASE_TURN_INTO_FAILED);
    return false;
  }
  return true;
}
