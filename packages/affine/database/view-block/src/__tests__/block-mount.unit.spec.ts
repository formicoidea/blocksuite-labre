/**
 * GUARD — a stored `affine:data-view` block mounts, draws its placeholder and
 * writes nothing (issue #745, product owner decision of 2026-11-24, ADR 0035
 * amendment of 2026-11-24).
 *
 * Only documents imported from AFFiNE hold this block; Labre offers no way to
 * create one. Its data source, `BlockQueryDataSource`, was never ported to the
 * signal-based view engine (the `ponytail:` line on it): `viewManager`,
 * `rows$`, `viewDataList$` and the other abstract members are absent, so the
 * engine's root renderer threw on the block's first render. The block now
 * draws its title row ("⋯" included, absent on a read-only document) above a
 * status, and never builds the engine nor reads `dataSource`.
 *
 * What it would have caught:
 *
 * - the constructor reading anything that only exists once the block is
 *   connected (the std, the host, the model): the element is constructed
 *   BEFORE the `std` context reaches it, and a class field that built the
 *   engine threw "Cannot read properties of undefined (reading 'host')"
 *   (#718);
 * - the first render throwing on the unported data source (#745);
 * - a render that writes to the document (a default, a view, a migration):
 *   the persisted format is forever, nothing is written on load;
 * - a snapshot round-trip (copy, duplicate, resave) dropping the block or its
 *   children.
 *
 * "Mounted" here is the element constructed by its tag and its `renderBlock()`
 * drawn into the document, under the std the editor host gives it; the full
 * editor (connection, selection, the caption) is not mounted in a unit spec.
 */
import {
  NoteBlockSchema,
  NoteBlockSchemaExtension,
  ParagraphBlockSchema,
  ParagraphBlockSchemaExtension,
  RootBlockSchema,
  RootBlockSchemaExtension,
} from '@labre/affine-model';
import type { EditorHost } from '@labre/std';
import {
  type DocSnapshot,
  Schema,
  type Store,
  Text,
  Transformer,
} from '@labre/store';
import {
  createAutoIncrementIdGenerator,
  TestWorkspace,
} from '@labre/store/test';
import { render } from 'lit';
import { afterEach, beforeAll, describe, expect, test, vi } from 'vitest';

import { DataViewBlockComponent } from '../data-view-block.js';
import {
  type DataViewBlockModel,
  DataViewBlockSchema,
  DataViewBlockSchemaExtension,
} from '../data-view-model.js';
import {
  DATA_VIEW_BLOCK_OPTIONS,
  DATA_VIEW_BLOCK_UNAVAILABLE,
  DATA_VIEW_BLOCK_UNAVAILABLE_HINT,
} from '../translations.js';
import { DataViewRenderViewExtension } from '../view.js';

const TITLE = 'Imported from AFFiNE';
/** A view as AFFiNE stores it; this build never reads it. */
const STORED_VIEWS = [{ id: 'v1', name: 'Table', mode: 'table' }];

function createWorkspace(id: string) {
  const workspace = new TestWorkspace({
    id,
    idGenerator: createAutoIncrementIdGenerator(),
  });
  workspace.meta.initialize();
  return workspace;
}

const EXTENSIONS = [
  RootBlockSchemaExtension,
  NoteBlockSchemaExtension,
  ParagraphBlockSchemaExtension,
  DataViewBlockSchemaExtension,
];

/**
 * A document holding a data-view block as AFFiNE stores it, between two
 * paragraphs of its note. The block itself has no child: its schema names
 * `affine:paragraph` and `affine:list` as children, but neither names
 * `affine:data-view` as a parent, so the store refuses one (upstream's schema
 * too). The round-trip below compares the whole tree, so a child would be
 * held the day the schema admits one.
 */
function storedDataView() {
  const workspace = createWorkspace('stored-data-view');
  const store = workspace.createDoc('doc0').getStore({
    id: 'doc0',
    extensions: EXTENSIONS,
  });
  let id = '';
  store.load(() => {
    const root = store.addBlock('affine:page', {});
    const note = store.addBlock('affine:note', {}, root);
    store.addBlock('affine:paragraph', { text: new Text('before') }, note);
    id = store.addBlock(
      'affine:data-view',
      { title: TITLE, views: STORED_VIEWS as never },
      note
    );
    store.addBlock('affine:paragraph', { text: new Text('after') }, note);
  });
  const model = store.getModelById(id) as DataViewBlockModel;
  return { workspace, store, model };
}

/** The stored Yjs map of a block, as a peer or a reload would read it. */
function storedBlock(store: Store, id: string) {
  return store.spaceDoc.getMap('blocks').get(id) as {
    toJSON(): Record<string, unknown>;
  };
}

/** Constructs the element by its tag and draws it, as the host does. */
function mount(store: Store, model: DataViewBlockModel) {
  const host = { store } as unknown as EditorHost;
  const block = document.createElement('affine-data-view');
  // What the editor host gives the block once it is connected; no
  // translation provider, so the English fallbacks are drawn.
  const std = {
    host,
    store,
    clipboard: {},
    dnd: {},
    getOptional: () => null,
  };
  Object.defineProperty(block, 'std', { value: std });
  Object.defineProperty(block, 'host', { value: host });
  Object.defineProperty(block, 'model', { value: model });
  Object.defineProperty(block, 'store', { value: store });

  const container = document.createElement('div');
  document.body.append(container);
  render(block.renderBlock(), container);
  return container;
}

beforeAll(() => {
  // The always-on provider, the one every editor mounts (ADR 0009, ADR 0035
  // amendment of 2026-10-14): its `effect()` defines the element.
  if (!customElements.get('affine-data-view')) {
    new DataViewRenderViewExtension().effect();
  }
});

afterEach(() => {
  vi.restoreAllMocks();
  document.body.replaceChildren();
});

describe('the data-view block element', () => {
  test('is constructed before it has a std, as the host renders it', () => {
    expect(customElements.get('affine-data-view')).toBeDefined();

    expect(() => document.createElement('affine-data-view')).not.toThrow();
  });
});

describe('a stored affine:data-view block (#745)', () => {
  test('mounts and draws its title and the placeholder', () => {
    const { store, model } = storedDataView();

    const container = mount(store, model);

    const status = container.querySelector('[role="status"]');
    expect(status?.getAttribute('data-testid')).toBe(
      'data-view-block-unavailable'
    );
    const lines = [...(status?.children ?? [])].map(line =>
      line.textContent?.trim()
    );
    expect(lines).toEqual([
      DATA_VIEW_BLOCK_UNAVAILABLE[1],
      DATA_VIEW_BLOCK_UNAVAILABLE_HINT[1],
    ]);
    expect(container.textContent).toContain(TITLE);
    // Writable: the block menu (rename, copy, delete) is there.
    expect(container.querySelector('.database-ops')).not.toBeNull();
  });

  test('its block menu is a named button in the tab order', () => {
    const { store, model } = storedDataView();

    const container = mount(store, model);

    const options = container.querySelector<HTMLButtonElement>(
      '[data-testid="data-view-block-options"]'
    );
    expect(options?.tagName).toBe('BUTTON');
    expect(options?.type).toBe('button');
    expect(options?.tabIndex).toBe(0);
    expect(options?.getAttribute('aria-label')).toBe(
      DATA_VIEW_BLOCK_OPTIONS[1]
    );
    expect(options?.getAttribute('aria-haspopup')).toBe('menu');
  });

  test('on a read-only document, the block menu is not drawn', () => {
    const { store, model } = storedDataView();
    store.readonly = true;

    const container = mount(store, model);

    expect(container.querySelector('[role="status"]')).not.toBeNull();
    expect(container.querySelector('.database-ops')).toBeNull();
  });

  test('never reads its data source', () => {
    const { store, model } = storedDataView();
    const dataSource = vi.spyOn(
      DataViewBlockComponent.prototype,
      'dataSource',
      'get'
    );

    mount(store, model);

    expect(dataSource).not.toHaveBeenCalled();
  });

  test('writes nothing: no Yjs update, the stored props unchanged', () => {
    const { store, model } = storedDataView();
    const before = storedBlock(store, model.id).toJSON();
    const updates: Uint8Array[] = [];
    store.spaceDoc.on('update', (update: Uint8Array) => updates.push(update));

    mount(store, model);

    expect(updates).toEqual([]);
    expect(storedBlock(store, model.id).toJSON()).toEqual(before);
    expect(model.props.views).toEqual(STORED_VIEWS);
    expect(model.props.title).toBe(TITLE);
  });

  test('a snapshot round-trip keeps the block and its children', async () => {
    const { workspace, store, model } = storedDataView();
    mount(store, model);
    const transformer = new Transformer({
      schema: new Schema().register([
        RootBlockSchema,
        NoteBlockSchema,
        ParagraphBlockSchema,
        DataViewBlockSchema,
      ]),
      blobCRUD: workspace.blobSync,
      middlewares: [],
      docCRUD: {
        create: (id: string) =>
          workspace.createDoc(id).getStore({ id, extensions: EXTENSIONS }),
        get: (id: string) =>
          workspace.getDoc(id)?.getStore({ id, extensions: EXTENSIONS }) ??
          null,
        delete: (id: string) => workspace.removeDoc(id),
      },
    });

    const snapshot = transformer.docToSnapshot(store) as DocSnapshot;
    const reloaded = await transformer.snapshotToDoc({
      ...snapshot,
      meta: { ...snapshot.meta, id: 'doc0-reloaded' },
    });

    const [copy] = reloaded?.getModelsByFlavour('affine:data-view') ?? [];
    const block = copy as DataViewBlockModel | undefined;
    expect(block?.props.title).toBe(TITLE);
    expect(block?.props.views).toEqual(STORED_VIEWS);
    expect(block?.children.length).toBe(model.children.length);
    // Its place among its note's paragraphs, and the whole tree.
    expect(
      block?.parent?.children.map(
        child => child.text?.toString() ?? child.flavour
      )
    ).toEqual(['before', 'affine:data-view', 'after']);
    expect(
      (transformer.docToSnapshot(reloaded!) as DocSnapshot).blocks
    ).toEqual(snapshot.blocks);
  });
});
