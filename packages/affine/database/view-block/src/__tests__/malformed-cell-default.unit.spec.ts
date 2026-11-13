/**
 * A data-view cell whose stored value fails its column's schema reads as the
 * column's default, and the read writes nothing. Same family as #656, which
 * fixed the `affine:database` source (`DatabaseBlockDataSource.getCellValue`).
 *
 * `BlockQueryDataSource.cellValueGet` returned `cells[rowId][propertyId]` raw,
 * with no schema at all. A stored value can disagree with its column (the
 * column's type changed, a snapshot was imported, a peer on another version
 * wrote a shape this client does not know), and the engine trusts what the
 * source returns: a malformed `date` made `stringValue$` throw (`format` of an
 * object), a malformed `multi-select` threw on `value.map`, a malformed
 * `checkbox` object rendered as ticked, a malformed `progress` printed
 * `[object Object]`.
 *
 * What it would have caught:
 * - a malformed cell reaching the views raw instead of as the default;
 * - the fix "healing" the cell by writing the default back: nothing is
 *   written on load, and a newer peer may understand the value this client
 *   rejects, so the stored value stays and the Y.Doc sees no update;
 * - the fix swallowing a valid value (a rich-text `Text` must come back as
 *   itself) or turning an absent cell into a default, which `propertyTypeSet`
 *   would then write for every row on a type change;
 * - a rich-text cell stored as a string read as the default, its text then
 *   lost on the first edit or type change (below).
 */
import {
  NoteBlockSchemaExtension,
  RootBlockSchemaExtension,
} from '@labre/affine-model';
import {
  databasePropertyConverts,
  RichTextCell,
} from '@labre/affine-database-block';
import type { EditorHost } from '@labre/std';
import { Text } from '@labre/store';
import { TestWorkspace } from '@labre/store/test';
import { computed, signal } from '@preact/signals-core';
import { describe, expect, test } from 'vitest';

import { queryBlockAllColumnMap } from '../columns/index.js';
import { BlockQueryDataSource } from '../data-source.js';
import {
  type DataViewBlockModel,
  DataViewBlockSchemaExtension,
} from '../data-view-model.js';

const MALFORMED = { legacy: 'invalid' };

// The column types a data-view resolves a meta for (`propertyMetaGet`).
const TYPES = Object.keys(queryBlockAllColumnMap);

const VALID: Record<string, unknown> = {
  date: 1_700_000_000_000,
  number: 42,
  progress: 30,
  select: 'opt',
  'multi-select': ['opt'],
  checkbox: true,
};

function dataViewWith(cells: Record<string, unknown>) {
  const workspace = new TestWorkspace({ id: 'data-view-malformed-cell' });
  workspace.meta.initialize();
  const store = workspace.createDoc('doc0').getStore({
    extensions: [
      RootBlockSchemaExtension,
      NoteBlockSchemaExtension,
      DataViewBlockSchemaExtension,
    ],
  });
  let id = '';
  store.load(() => {
    const root = store.addBlock('affine:page', {});
    const note = store.addBlock('affine:note', {}, root);
    id = store.addBlock(
      'affine:data-view',
      {
        columns: TYPES.map(type => ({ id: type, type, name: type, data: {} })),
        cells: { row: cells },
      },
      note
    );
  });
  const model = store.getModelById(id) as DataViewBlockModel;
  // The constructor reads nothing of the host but its store.
  const host = { store } as unknown as EditorHost;
  const source = new BlockQueryDataSource(host, model, { type: 'todo' });
  return { store, model, source };
}

function malformedDataView() {
  return dataViewWith(Object.fromEntries(TYPES.map(type => [type, MALFORMED])));
}

describe('a malformed stored data-view cell', () => {
  test.each(TYPES)('a malformed %s cell reads as the column default', type => {
    const { source } = malformedDataView();
    const rawValue = queryBlockAllColumnMap[type].config.rawValue;

    const value = source.cellValueGet('row', type);

    expect(value).toEqual(rawValue.default());
    expect(() =>
      rawValue.toString({ value, data: { options: [] } } as never)
    ).not.toThrow();
  });

  test('reading every malformed cell writes nothing and keeps the stored values', () => {
    const { store, model, source } = malformedDataView();
    const updates: Uint8Array[] = [];
    const record = (update: Uint8Array) => updates.push(update);
    store.doc.spaceDoc.on('update', record);
    try {
      TYPES.forEach(type => {
        source.cellValueGet('row', type);
        void source.cellValueGet$('row', type).value;
      });
    } finally {
      store.doc.spaceDoc.off('update', record);
    }

    expect(updates).toEqual([]);
    expect(TYPES.map(type => model.props.cells.row[type])).toEqual(
      TYPES.map(() => MALFORMED)
    );
  });

  test('a valid value reads back as itself', () => {
    const { source } = dataViewWith(VALID);
    for (const [type, value] of Object.entries(VALID)) {
      expect(source.cellValueGet('row', type)).toEqual(value);
    }
  });

  test('a rich-text cell keeps its text', () => {
    const { source } = dataViewWith({});
    source.cellValueChange('row', 'rich-text', new Text('kept'));

    expect(source.cellValueGet('row', 'rich-text')?.toString()).toBe('kept');
  });

  test('an absent cell still reads as undefined', () => {
    const { source } = dataViewWith({});
    for (const type of TYPES) {
      expect(source.cellValueGet('row', type)).toBeUndefined();
    }
  });
});

/**
 * A rich-text cell stored as a plain string (an older document, a snapshot
 * or an import writing plain text) fails the rich-text schema, which takes a
 * `Text` only, yet its readers read it: the cell's editor turns it into a
 * `Text` keeping its content, `toString` and the conversions read it too.
 * Read as the default (`undefined`), its first edit wrote an empty `Text`
 * over it and a type change converted nothing: the text was lost.
 */
describe('a rich-text cell stored as a string', () => {
  test('reads as itself, and so does its text', () => {
    const { source } = dataViewWith({ 'rich-text': 'note' });

    const value = source.cellValueGet('row', 'rich-text');

    expect(value).toBe('note');
    expect(
      queryBlockAllColumnMap['rich-text'].config.rawValue.toString({
        value,
        data: {},
      } as never)
    ).toBe('note');
  });

  test('keeps its text when the cell enters editing', () => {
    const { source, model } = dataViewWith({ 'rich-text': 'note' });
    if (!customElements.get('test-dv-rich-text-cell')) {
      customElements.define('test-dv-rich-text-cell', RichTextCell);
    }
    const renderer = document.createElement(
      'test-dv-rich-text-cell'
    ) as RichTextCell;
    renderer.cell = {
      value$: computed(() => source.cellValueGet('row', 'rich-text')),
      valueSet: (value: unknown) =>
        source.cellValueChange('row', 'rich-text', value),
      property: { readonly$: signal(false) },
    } as never;

    renderer.beforeEnterEditMode();

    expect(model.props.cells.row['rich-text']?.toString()).toBe('note');
  });

  test('converts its text on a type change', () => {
    const { source } = dataViewWith({ 'rich-text': 'note' });
    const toSelect = databasePropertyConverts.find(
      convert => convert.from === 'rich-text' && convert.to === 'select'
    )!;

    const result = toSelect.convert(
      {} as never,
      [source.cellValueGet('row', 'rich-text')] as never
    ) as {
      property: { options: { id: string; value: string }[] };
      cells: unknown[];
    };

    expect(result.property.options.map(option => option.value)).toEqual([
      'note',
    ]);
    expect(result.cells).toEqual([result.property.options[0]?.id]);
  });
});
