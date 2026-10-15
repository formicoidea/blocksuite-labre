/**
 * Attachments from the host's asset library (`AssetPickerProvider`, labre
 * P4): the slash menu's Attachment and PDF and the mobile keyboard toolbar
 * go through `pickAndAddSiblingAttachmentBlocks`.
 *
 * What it would have caught:
 * - a card that re-sends the bytes (`blobSync.set`) instead of referencing
 *   the blob the host already stores, or loses the ref's name, type or size;
 * - a write on a read-only document, or a cancelled dialog that still
 *   removes the line the gesture was typed on;
 * - an editor without a host losing its file chooser.
 */
import {
  AttachmentBlockSchemaExtension,
  NoteBlockSchemaExtension,
  ParagraphBlockSchemaExtension,
  RootBlockSchemaExtension,
} from '@labre/affine-model';
import {
  AssetPickerProvider,
  type AssetPickerService,
  type AssetRef,
} from '@labre/affine-shared/services';
import { openSingleFileWith } from '@labre/affine-shared/utils';
import type { BlockStdScope } from '@labre/std';
import { type Store, Text } from '@labre/store';
import { TestWorkspace } from '@labre/store/test';
import { describe, expect, it, vi } from 'vitest';

import {
  addSiblingAttachmentBlocksFromAssets,
  pickAndAddSiblingAttachmentBlocks,
} from '../asset-picker';

vi.mock('@labre/affine-shared/utils', async importOriginal => ({
  ...(await importOriginal<typeof import('@labre/affine-shared/utils')>()),
  openSingleFileWith: vi.fn(async () => null),
}));

let seq = 0;

function pageStore() {
  const workspace = new TestWorkspace({ id: `attachment-assets-${seq++}` });
  workspace.storeExtensions = [
    RootBlockSchemaExtension,
    NoteBlockSchemaExtension,
    ParagraphBlockSchemaExtension,
    AttachmentBlockSchemaExtension,
  ];
  workspace.meta.initialize();
  const store = workspace.createDoc('doc').getStore();
  const ids = { note: '', typed: '', empty: '' };
  store.load(() => {
    const root = store.addBlock('affine:page', { title: new Text('') });
    ids.note = store.addBlock('affine:note', {}, root);
    ids.typed = store.addBlock(
      'affine:paragraph',
      { text: new Text('a') },
      ids.note
    );
    ids.empty = store.addBlock('affine:paragraph', {}, ids.note);
  });
  store.resetHistory();
  const set = vi.spyOn(store.blobSync, 'set');
  const model = (id: string) => {
    const block = store.getBlock(id);
    if (!block) throw new Error(`no block ${id}`);
    return block.model;
  };
  const flavours = () => model(ids.note).children.map(c => c.flavour);
  return { store, ids, model, flavours, set };
}

function stdFor(store: Store, picker?: AssetPickerService) {
  return {
    store,
    host: {},
    getOptional: (id: unknown) =>
      id === AssetPickerProvider ? (picker ?? null) : null,
  } as unknown as BlockStdScope;
}

const pdf: AssetRef = {
  sourceId: 'sha',
  name: 'plan.pdf',
  type: 'application/pdf',
  size: 1234,
};

describe('attachments from assets', () => {
  it('reference the stored blob with its name, type and size, one undo step', () => {
    const { store, ids, model, set } = pageStore();
    const capture = vi.spyOn(store, 'captureSync');

    const [id] = addSiblingAttachmentBlocksFromAssets(
      stdFor(store),
      [pdf],
      model(ids.typed)
    );

    const props = model(id as string).props as Record<string, unknown>;
    expect([props.sourceId, props.name, props.type, props.size]).toEqual([
      'sha',
      'plan.pdf',
      'application/pdf',
      1234,
    ]);
    expect(set).not.toHaveBeenCalled();
    expect(capture).toHaveBeenCalledTimes(1);
    store.undo();
    expect(store.getBlock(id as string)).toBeUndefined();
  });

  it('write nothing on a read-only document', () => {
    const { store, ids, model, flavours } = pageStore();
    Object.defineProperty(store, 'readonly', { get: () => true });

    expect(
      addSiblingAttachmentBlocksFromAssets(
        stdFor(store),
        [pdf],
        model(ids.typed)
      )
    ).toEqual([]);
    expect(flavours()).toEqual(['affine:paragraph', 'affine:paragraph']);
  });
});

describe('the attachment entries, with and without a host', () => {
  it('open the system file chooser without a host', async () => {
    const { store, ids, model, flavours } = pageStore();
    vi.mocked(openSingleFileWith).mockClear();

    await pickAndAddSiblingAttachmentBlocks(stdFor(store), model(ids.empty));

    expect(openSingleFileWith).toHaveBeenCalledTimes(1);
    expect(flavours()).toEqual(['affine:paragraph', 'affine:paragraph']);
  });

  it('take the card from the host in place of the emptied line', async () => {
    const { store, ids, model, flavours } = pageStore();
    vi.mocked(openSingleFileWith).mockClear();
    const pick = vi.fn(async () => [pdf]);

    await pickAndAddSiblingAttachmentBlocks(
      stdFor(store, { pick }),
      model(ids.empty)
    );

    expect(pick).toHaveBeenCalledWith({
      kind: 'file',
      mode: 'insert',
      multiple: false,
      docId: store.id,
    });
    expect(openSingleFileWith).not.toHaveBeenCalled();
    expect(flavours()).toEqual(['affine:paragraph', 'affine:attachment']);
  });

  it('keep the line and write nothing when the viewer cancels', async () => {
    const { store, ids, model, flavours } = pageStore();

    await pickAndAddSiblingAttachmentBlocks(
      stdFor(store, { pick: async () => null }),
      model(ids.empty)
    );

    expect(flavours()).toEqual(['affine:paragraph', 'affine:paragraph']);
    expect(store.canUndo).toBe(false);
  });
});
