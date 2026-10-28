/**
 * A database is editable on mobile (ADR 0035 §1, issue B5).
 *
 * Up to 0.48 `ExternalDataSourceBase.readonly$` was `store.readonly ||
 * IS_MOBILE` (an upstream "use block level readonly" TODO), so on a phone
 * every database, the Labre bases included, was read-only whatever the
 * document allowed. `IS_MOBILE` is a module constant, so this suite cannot
 * flip it; it pins instead that the source's read-only state is the store's
 * and nothing else, and that the presets a database creates ship the touch
 * renderers `DataViewRootUILogic` picks on mobile, the reason no new control
 * was drawn for B5.
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
import { databaseBlockViews } from '../views/index.js';

function createSource() {
  const collection = new TestWorkspace({ id: 'mobile-editing' });
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
  const rootId = store.addBlock('affine:page', { title: new Text('m') });
  const noteId = store.addBlock('affine:note', {}, rootId);
  const id = store.addBlock('affine:database', { columns: [] }, noteId);
  const model = store.getModelById(id) as DatabaseBlockModel;
  return { store, source: new DatabaseBlockDataSource(model) };
}

describe('database editing on mobile', () => {
  test('the source is read-only exactly when the store is', () => {
    const { store, source } = createSource();
    expect(source.readonly$.value).toBe(false);
    expect(source.viewManager.readonly$.value).toBe(false);

    store.readonly = true;
    expect(source.readonly$.value).toBe(true);

    store.readonly = false;
    expect(source.readonly$.value).toBe(false);
  });

  test.each(databaseBlockViews.map(meta => [meta.type, meta] as const))(
    'the creatable %s preset ships a touch renderer',
    (_type, meta) => {
      expect(meta.renderer.mobileLogic).toBeTypeOf('function');
    }
  );
});
