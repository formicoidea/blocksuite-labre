import {
  addProperty,
  DatabaseBlockDataSource,
} from '@labre/affine-block-database';
import {
  type DatabaseBlockModel,
  DatabaseBlockSchemaExtension,
  NoteBlockSchemaExtension,
  ParagraphBlockSchemaExtension,
  RootBlockSchemaExtension,
} from '@labre/affine-model';
import {
  groupTraitKey,
  rowsArePages,
  viewOpenIn,
  viewOpenInSet,
} from '@labre/data-view';
import { propertyModelPresets } from '@labre/data-view/property-pure-presets';
import { Text } from '@labre/store';
import {
  createAutoIncrementIdGenerator,
  TestWorkspace,
} from '@labre/store/test';
import { describe, expect, test } from 'vitest';

/**
 * Grouping on every layout and "Open pages in" (ADR 0035 §8, B8; PRD
 * REQ-DB-5, 11, 13 and 16) inside the `affine:database` block, over the real
 * inline source and a real store. No stored field is new: a group's hide is
 * the `groupProperties[].hide` table and kanban have always stored, `openIn`
 * is the optional view field of 0.49.
 *
 * What it would have caught:
 * - a layout of the block without the group trait (grouping on table and
 *   kanban only);
 * - a grouped view with a hidden group rewritten by being read: the Y.Doc
 *   emits no update while its groups are resolved;
 * - a hide written in another shape, or dropping the other groups' manual
 *   order;
 * - a fold written into the document;
 * - `openIn` written on load or by a pick that changes nothing, or lost by a
 *   layout switch;
 * - "Open pages in" offered over block rows, which keep the detail panel.
 */

const extensions = [
  RootBlockSchemaExtension,
  NoteBlockSchemaExtension,
  ParagraphBlockSchemaExtension,
  DatabaseBlockSchemaExtension,
];

function createDatabase() {
  const collection = new TestWorkspace({
    id: 'test-collection',
    idGenerator: createAutoIncrementIdGenerator(),
  });
  collection.meta.initialize();
  const yDoc = collection.createDoc('doc-grouping');
  yDoc.load();
  const doc = yDoc.getStore({ extensions });
  const rootId = doc.addBlock('affine:page', { title: new Text('groups') });
  const noteId = doc.addBlock('affine:note', {}, rootId);
  const databaseId = doc.addBlock(
    'affine:database',
    { columns: [], titleColumn: 'Title' },
    noteId
  );
  const model = doc.getModelById(databaseId) as DatabaseBlockModel;
  const status = addProperty(
    model,
    'end',
    propertyModelPresets.selectPropertyModelConfig.create('Status', {
      options: [
        { id: 'todo', value: 'Todo', color: 'var(--affine-tag-blue)' },
        { id: 'done', value: 'Done', color: 'var(--affine-tag-green)' },
      ],
    })
  );
  doc.addBlock('affine:paragraph', { text: new Text('Alpha') }, databaseId);
  return { doc, yDoc, model, status };
}

const stored = (model: DatabaseBlockModel) =>
  JSON.parse(JSON.stringify(model.props.views));

describe('grouping in the database block', () => {
  test.each(['table', 'kanban', 'gallery', 'list'])(
    'a %s groups, and a stored hidden group loads without a write',
    mode => {
      const { model, yDoc, status } = createDatabase();
      const dataSource = new DatabaseBlockDataSource(model);
      const id = dataSource.viewManager.viewAdd(mode);
      const view = dataSource.viewManager.viewGet(id);
      const trait = view?.traitGet(groupTraitKey);
      expect(trait, `${mode} has the group trait`).toBeDefined();
      if (!trait) return;
      if (!trait.property$.value) trait.changeGroup(status);
      trait.groupHideSet('done', true);
      expect(trait.hiddenGroups$.value.map(group => group.key)).toEqual([
        'done',
      ]);
      expect(trait.visibleGroups$.value?.map(group => group.key)).not.toContain(
        'done'
      );

      const before = stored(model);
      let updates = 0;
      const onUpdate = () => updates++;
      yDoc.spaceDoc.on('update', onUpdate);
      try {
        const reader = new DatabaseBlockDataSource(model);
        const readTrait = reader.viewManager
          .viewGet(id)
          ?.traitGet(groupTraitKey);
        expect(readTrait?.hiddenGroups$.value.map(group => group.key)).toEqual([
          'done',
        ]);
        void readTrait?.visibleGroups$.value?.map(group => group.rows.length);
        // A fold is personal: never a document write.
        readTrait?.collapsedSet('todo', true);
        expect(readTrait?.collapsed$('todo').value).toBe(true);
        readTrait?.collapsedSet('todo', false);
      } finally {
        yDoc.spaceDoc.off('update', onUpdate);
      }
      expect(updates).toBe(0);
      expect(stored(model)).toEqual(before);
    }
  );

  test('a hide keeps the other groups and their manual order', () => {
    const { model, status } = createDatabase();
    const dataSource = new DatabaseBlockDataSource(model);
    const id = dataSource.viewManager.viewAdd('list');
    const trait = dataSource.viewManager.viewGet(id)?.traitGet(groupTraitKey);
    trait?.changeGroup(status);
    const rowId = model.children[0]?.id ?? '';
    trait?.changeCardSort('todo', [rowId]);
    trait?.groupHideSet('done', true);
    const data = dataSource.viewDataGet(id) as {
      groupProperties?: { key: string; hide?: boolean }[];
    };
    expect(data.groupProperties).toContainEqual({
      key: 'todo',
      hide: false,
      manuallyCardSort: [rowId],
    });
    expect(data.groupProperties).toContainEqual({
      key: 'done',
      hide: true,
      manuallyCardSort: [],
    });
  });
});

describe('"Open pages in" in the database block', () => {
  test('absent reads side; written on a pick that changes it; kept by a layout switch', () => {
    const { model } = createDatabase();
    const dataSource = new DatabaseBlockDataSource(model);
    const id = dataSource.viewManager.viewAdd('table');
    const view = dataSource.viewManager.viewGet(id);
    if (!view) throw new Error('view not resolved');
    expect(viewOpenIn(dataSource.viewDataGet(id))).toBe('side');

    const before = stored(model);
    expect(viewOpenInSet(view, 'side')).toBe(false);
    expect(stored(model)).toEqual(before);
    expect('openIn' in (dataSource.viewDataGet(id) ?? {})).toBe(false);

    expect(viewOpenInSet(view, 'full')).toBe(true);
    expect(viewOpenIn(dataSource.viewDataGet(id))).toBe('full');

    for (const mode of ['gallery', 'kanban', 'list', 'table']) {
      dataSource.viewManager.viewChangeType(id, mode);
      expect(viewOpenIn(dataSource.viewDataGet(id)), mode).toBe('full');
    }
  });

  test('is not offered over block rows', () => {
    const { model } = createDatabase();
    expect(rowsArePages(new DatabaseBlockDataSource(model))).toBe(false);
  });
});
