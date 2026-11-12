/**
 * A cell whose stored value fails its property's schema reads as the
 * property's default, and the read writes nothing (issue #656, ported from
 * toeverything/AFFiNE#15809).
 *
 * A stored value can disagree with its column: the column's type changed, a
 * snapshot was imported, or a peer on another version wrote a shape this
 * client does not know. `DatabaseBlockDataSource.getCellValue` parsed the
 * value with the property's `rawValue.schema` and returned `undefined` on
 * failure, so the cell rendered empty and every reader downstream received
 * `undefined` where its type promises a value (`progress` a number,
 * `multi-select` an array).
 *
 * What it would have caught:
 * - a malformed cell reading as `undefined` instead of the default;
 * - the fix "healing" the cell by writing the default back: the stored
 *   format is forever and nothing is written on load, and a newer peer may
 *   understand the value this client rejects, so the stored value must stay
 *   as it was and the Y.Doc must see no update at all.
 */
import {
  DatabaseBlockSchemaExtension,
  type DatabaseBlockModel,
  NoteBlockSchemaExtension,
  ParagraphBlockSchemaExtension,
  RootBlockSchemaExtension,
} from '@labre/affine-model';
import { FeatureFlagService } from '@labre/affine-shared/services';
import { Text } from '@labre/store';
import { TestWorkspace } from '@labre/store/test';
import { describe, expect, test } from 'vitest';

import { DatabaseBlockDataSource } from '../data-source.js';
import { databaseBlockProperties } from '../properties/index.js';

const MALFORMED = { legacy: 'invalid' };

// Every property whose value lives in `cells`: `title` reads the row's
// text and `created-time` the row's metadata, neither has a stored cell.
const CELL_PROPERTIES = Object.values(databaseBlockProperties).filter(
  property => !['title', 'created-time'].includes(property.type)
);

function databaseWithMalformedCells() {
  const collection = new TestWorkspace({ id: 'malformed-cell-default' });
  collection.meta.initialize();
  const doc = collection.createDoc('doc0');
  doc.load();
  const store = doc.getStore({
    extensions: [
      RootBlockSchemaExtension,
      NoteBlockSchemaExtension,
      ParagraphBlockSchemaExtension,
      DatabaseBlockSchemaExtension,
      FeatureFlagService,
    ],
  });
  const rootId = store.addBlock('affine:page', { title: new Text('page') });
  const noteId = store.addBlock('affine:note', {}, rootId);
  const databaseId = store.addBlock(
    'affine:database',
    {
      title: new Text('Plan'),
      columns: CELL_PROPERTIES.map(property => ({
        id: property.type,
        type: property.type,
        name: property.type,
        data: {},
      })) as never,
    },
    noteId
  );
  const rowId = store.addBlock(
    'affine:paragraph',
    { text: new Text('row') },
    databaseId
  );
  const model = store.getModelById(databaseId) as DatabaseBlockModel;
  store.updateBlock(model, {
    cells: {
      [rowId]: Object.fromEntries(
        CELL_PROPERTIES.map(property => [
          property.type,
          { columnId: property.type, value: MALFORMED },
        ])
      ),
    },
  });
  return { store, model, rowId };
}

describe('a malformed stored cell', () => {
  test.each(CELL_PROPERTIES.map(property => [property.type, property]))(
    'a malformed %s cell reads as the property default',
    (_type, property) => {
      const { model, rowId } = databaseWithMalformedCells();
      const source = new DatabaseBlockDataSource(model);

      expect(source.cellValueGet(rowId, property.type)).toEqual(
        property.config.rawValue.default()
      );
    }
  );

  test('reading every malformed cell writes nothing and keeps the stored values', () => {
    const { store, model, rowId } = databaseWithMalformedCells();
    const source = new DatabaseBlockDataSource(model);
    const updates: Uint8Array[] = [];
    const record = (update: Uint8Array) => updates.push(update);
    store.doc.spaceDoc.on('update', record);
    try {
      CELL_PROPERTIES.forEach(property => {
        source.cellValueGet(rowId, property.type);
        void source.cellValueGet$(rowId, property.type).value;
      });
    } finally {
      store.doc.spaceDoc.off('update', record);
    }

    expect(updates).toEqual([]);
    expect(
      CELL_PROPERTIES.map(
        property => model.props.cells[rowId]?.[property.type]?.value
      )
    ).toEqual(CELL_PROPERTIES.map(() => MALFORMED));
  });
});
