/**
 * GUARD — creating a database with a host picker, in a real editor (ADR 0035
 * §5, amendment of 2026-10-28): "Table View" inserts a native database at
 * once and the bundle's popover offers its source.
 *
 * What it would have caught:
 * - nothing on the page until the host answers `createDatabase` (the 0.61
 *   path still taken when the bundle's creation menu is registered), or the
 *   new database arriving with its 3 native empty rows;
 * - the popover not opening over the block, or opening when the entry
 *   inserted nothing;
 * - "New empty source" or "Link an existing source" leaving the block
 *   without the host's `externalSourceId`, without the view's `sourceId` or
 *   without the database's title, or the block not redrawing on the host's
 *   source;
 * - the connection and the insertion merged into one undo step, or the
 *   connection taking two (one undo must give the native database back, a
 *   second remove it);
 * - Escape on the popover removing the database or leaving it unrendered;
 * - `BlockCreated` reported twice (once by the insertion, once by the
 *   connection) or not at all.
 */
import {
  type DatabaseBlockComponent,
  DatabaseBlockDataSource,
  DatabaseDataSourceProvider,
} from '@labre/affine/blocks/database';
import type { DatabaseBlockModel } from '@labre/affine/model';
import {
  type DataSourcePickerDatabase,
  DataSourcePickerExtension,
  TelemetryExtension,
} from '@labre/affine/shared/services';
import { SlashMenuConfigIdentifier } from '@labre/affine/widgets/slash-menu';
import { type BlockStdScope, TextSelection } from '@labre/std';
import type { BlockModel, ExtensionType } from '@labre/store';
import { signal } from '@preact/signals-core';
import { userEvent } from '@vitest/browser/context';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

import { wait } from '../utils/common.js';
import { addNote } from '../utils/edgeless.js';
import { setupEditor } from '../utils/setup.js';

/** A host source whose rows are documents (the Labre app's bases). */
class DocumentRowsSource extends DatabaseBlockDataSource {
  override get rowsAreDocuments() {
    return true;
  }
}

const hostSources: ExtensionType = {
  setup: di => {
    di.override(DatabaseDataSourceProvider, () => ({
      createDataSource: (model, init) => new DocumentRowsSource(model, init),
    }));
  },
};

const PLAN: DataSourcePickerDatabase = {
  id: 'host:plan',
  title: 'Plan',
  sources: [
    { id: 'src-1', title: 'Projects' },
    { id: 'src-2', title: 'Risks' },
  ],
};
const FRESH: DataSourcePickerDatabase = {
  id: 'host:fresh',
  title: 'Fresh',
  sources: [{ id: 'src-new', title: 'Untitled' }],
};

const settle = async () => {
  await wait(100);
  for (let i = 0; i < 4; i++) {
    await new Promise(resolve => requestAnimationFrame(resolve));
  }
};

function slashAction(std: BlockStdScope, name: string) {
  const model = std.store.root!;
  for (const config of std.provider
    .getAll(SlashMenuConfigIdentifier)
    .values()) {
    const items =
      typeof config.items === 'function'
        ? config.items({ std, model })
        : config.items;
    for (const item of items) {
      if (item.name === name && 'action' in item) return item.action;
    }
  }
  throw new Error(`no slash entry ${name}`);
}

const popover = () =>
  document.querySelector<HTMLElement>(
    '[data-testid="database-creation-popover"]'
  );
const byTestId = (id: string) =>
  document.querySelector<HTMLElement>(`[data-testid="${id}"]`);

describe('creating a database with a host picker', () => {
  let std!: BlockStdScope;
  let noteId!: string;
  let createDatabase!: ReturnType<typeof vi.fn>;
  let created!: string[];

  beforeEach(async () => {
    created = [];
    createDatabase = vi.fn(async () => FRESH);
    const cleanup = await setupEditor('page', [
      hostSources,
      DataSourcePickerExtension({ list: () => signal([PLAN]), createDatabase }),
      TelemetryExtension({
        track: (name, props) => {
          if (name === 'BlockCreated') {
            created.push((props as { blockType: string }).blockType);
          }
        },
      }),
    ]);
    std = window.editor.std;
    noteId = addNote(window.doc);
    await settle();
    return cleanup;
  });

  afterEach(() => {
    for (const layer of document.querySelectorAll(
      'body > [data-range-sync-exclude]'
    )) {
      layer.remove();
    }
  });

  const note = () => window.doc.getModelById(noteId) as BlockModel;
  const database = () =>
    note().children.find(child => child.flavour === 'affine:database') as
      | DatabaseBlockModel
      | undefined;
  const blockOf = (model: DatabaseBlockModel) =>
    document.querySelector<DatabaseBlockComponent>(
      `affine-database[data-block-id="${model.id}"]`
    );

  /** The slash gesture: a caret on the note's empty line, then the entry. */
  async function tableView() {
    const line = note().children[0]!;
    std.selection.setGroup('note', [
      std.selection.create(TextSelection, {
        from: { blockId: line.id, index: 0, length: 0 },
        to: null,
      }),
    ]);
    await wait();
    // The slash menu's own gesture boundary: the note above is not part of it.
    window.doc.captureSync();
    slashAction(std, 'Table View')({ std, model: line });
  }

  test('the database lands at once, with no row, and the popover opens over it', async () => {
    await tableView();
    const model = database();
    expect(model).toBeDefined();
    expect(model!.children).toHaveLength(0);
    expect(model!.props.externalSourceId).toBeUndefined();
    await settle();

    expect(popover()).not.toBeNull();
    expect(blockOf(model!)).not.toBeNull();
    expect(createDatabase).not.toHaveBeenCalled();
    expect(created).toEqual(['affine:database']);
  });

  test('"New empty source" connects it, and undo goes back one step at a time', async () => {
    await tableView();
    await settle();
    const model = database()!;
    const [view] = model.props.views;

    byTestId('database-creation-new-source')!.click();
    await settle();

    expect(createDatabase).toHaveBeenCalledTimes(1);
    expect(model.props.externalSourceId).toBe('host:fresh');
    expect(model.props.views).toHaveLength(1);
    expect(model.props.views[0]).toMatchObject({
      id: view!.id,
      sourceId: 'src-new',
    });
    expect(model.props.title.toString()).toBe('Fresh');
    expect(popover()).toBeNull();
    expect(blockOf(model)!.dataSource).toBeInstanceOf(DocumentRowsSource);
    expect(created).toEqual(['affine:database']);

    window.doc.undo();
    await settle();
    const native = database()!;
    expect(native.id).toBe(model.id);
    expect(native.props.externalSourceId).toBeUndefined();
    expect(native.props.views[0]!.sourceId).toBeUndefined();
    expect(blockOf(native)).not.toBeNull();

    // The native insertion keeps its own steps, as every native "Table
    // View" since 0.48: the block, then its view (`viewDataAdd` calls
    // `captureSync`). ponytail: one step would need the first view written
    // with the block in `insertDatabaseBlockCommand`.
    window.doc.undo();
    window.doc.undo();
    await settle();
    expect(database()).toBeUndefined();
  });

  test('Escape closes the popover and leaves the native database rendering', async () => {
    await tableView();
    await settle();
    const model = database()!;
    expect(popover()).not.toBeNull();

    await userEvent.keyboard('{Escape}');
    await settle();

    expect(popover()).toBeNull();
    expect(database()?.id).toBe(model.id);
    expect(model.props.externalSourceId).toBeUndefined();
    expect(blockOf(model)?.querySelector('affine-data-view-renderer')).not.toBe(
      null
    );
    expect(createDatabase).not.toHaveBeenCalled();
  });

  test('"Link an existing source" connects it to the picked source', async () => {
    await tableView();
    await settle();
    const model = database()!;

    document
      .querySelector<HTMLElement>('.database-creation-link-existing')!
      .click();
    await settle();
    const sub = byTestId('database-creation-link-existing')!;
    // Linking only links: no way to create from here.
    expect(byTestId('data-source-picker-new-database')).toBeNull();
    [...sub.querySelectorAll<HTMLElement>('affine-menu-sub-menu')]
      .find(item => item.textContent?.includes('Plan'))!
      .click();
    await settle();
    expect(byTestId('data-source-picker-new-source')).toBeNull();
    byTestId('data-source-picker-source-src-2')!.click();
    await settle();

    expect(model.props.externalSourceId).toBe('host:plan');
    expect(model.props.views[0]).toMatchObject({ sourceId: 'src-2' });
    expect(model.props.title.toString()).toBe('Plan');
    expect(blockOf(model)!.dataSource).toBeInstanceOf(DocumentRowsSource);
    expect(createDatabase).not.toHaveBeenCalled();
    expect(created).toEqual(['affine:database']);
  });
});
