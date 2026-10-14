/**
 * Images from the host's asset library (`AssetPickerProvider`, labre P4).
 *
 * What it would have caught:
 * - an insertion or a replacement that re-sends the bytes (`blobSync.set`)
 *   instead of referencing the blob the host already stores;
 * - "Replace" that changes the displayed width, keeps the old ratio, or
 *   takes two undo steps;
 * - a write on a read-only document, or an empty undo entry when the picked
 *   image is the one already shown;
 * - an editor without a host losing its file chooser, or offered "Replace"
 *   with no library to pick from.
 */
import { SurfaceBlockSchemaExtension } from '@labre/affine-block-surface';
import {
  type ImageBlockModel,
  ImageBlockSchemaExtension,
  NoteBlockSchemaExtension,
  RootBlockSchemaExtension,
} from '@labre/affine-model';
import {
  AssetPickerProvider,
  type AssetPickerService,
  type AssetRef,
  type ToolbarContext,
} from '@labre/affine-shared/services';
import {
  getImageFilesFromLocal,
  readImageSize,
} from '@labre/affine-shared/utils';
import type { BlockStdScope } from '@labre/std';
import { type Store, Text } from '@labre/store';
import { TestWorkspace } from '@labre/store/test';
import { describe, expect, it, vi } from 'vitest';

import {
  addSiblingImageBlocksFromAssets,
  pickAndAddSiblingImageBlocks,
  pickAndReplaceImage,
  replaceImage,
  replacementProps,
} from '../asset-picker';
import { imageReplaceToolbarAction } from '../configs/replace-action';

vi.mock('@labre/affine-components/toast', () => ({ toast: vi.fn() }));
vi.mock('@labre/affine-shared/utils', async importOriginal => ({
  ...(await importOriginal<typeof import('@labre/affine-shared/utils')>()),
  getImageFilesFromLocal: vi.fn(async () => []),
  // happy-dom never decodes an image: the measured size is given here.
  readImageSize: vi.fn(async () => ({ width: 80, height: 20 })),
}));

let seq = 0;

function editorStore() {
  const workspace = new TestWorkspace({ id: `asset-picker-${seq++}` });
  workspace.storeExtensions = [
    RootBlockSchemaExtension,
    SurfaceBlockSchemaExtension,
    NoteBlockSchemaExtension,
    ImageBlockSchemaExtension,
  ];
  workspace.meta.initialize();
  const store = workspace.createDoc('doc').getStore();
  const ids = { note: '', pageImage: '', unsized: '', canvasImage: '' };
  store.load(() => {
    const root = store.addBlock('affine:page', { title: new Text('') });
    const surface = store.addBlock('affine:surface', {}, root);
    ids.note = store.addBlock('affine:note', {}, root);
    ids.pageImage = store.addBlock(
      'affine:image',
      { sourceId: 'old', size: 10, width: 300, height: 150, caption: 'c' },
      ids.note
    );
    ids.unsized = store.addBlock(
      'affine:image',
      { sourceId: 'old', size: 10 },
      ids.note
    );
    ids.canvasImage = store.addBlock(
      'affine:image',
      {
        sourceId: 'old',
        size: 10,
        width: 400,
        height: 200,
        xywh: '[10,20,200,100]',
      },
      surface
    );
  });
  store.resetHistory();
  const set = vi.spyOn(store.blobSync, 'set');
  const image = (id: string) =>
    store.getBlock(id)?.model as unknown as ImageBlockModel;
  return { store, ids, image, set };
}

function stdFor(store: Store, picker?: AssetPickerService) {
  return {
    store,
    host: {},
    getOptional: (id: unknown) =>
      id === AssetPickerProvider ? (picker ?? null) : null,
  } as unknown as BlockStdScope;
}

function readonly(store: Store) {
  Object.defineProperty(store, 'readonly', { get: () => true });
}

const square: AssetRef = {
  sourceId: 'new',
  name: 'square.png',
  type: 'image/png',
  size: 42,
  width: 50,
  height: 50,
};

const natural = { width: 50, height: 50 };

describe('replacementProps', () => {
  it('keeps the width of a page image and follows the new ratio', () => {
    const { ids, image } = editorStore();
    expect(replacementProps(image(ids.pageImage), square, natural)).toEqual({
      sourceId: 'new',
      size: 42,
      width: 300,
      height: 300,
    });
  });

  it('leaves a page image shown at its natural size so', () => {
    const { ids, image } = editorStore();
    expect(replacementProps(image(ids.unsized), square, natural)).toEqual({
      sourceId: 'new',
      size: 42,
    });
  });

  it('keeps the corner and the width of a canvas image', () => {
    const { ids, image } = editorStore();
    expect(replacementProps(image(ids.canvasImage), square, natural)).toEqual({
      sourceId: 'new',
      size: 42,
      xywh: '[10,20,200,200]',
      width: 50,
      height: 50,
    });
  });
});

describe('replaceImage', () => {
  it('swaps the picture in one undo step, without re-sending the bytes', async () => {
    const { store, ids, image, set } = editorStore();
    const capture = vi.spyOn(store, 'captureSync');

    expect(
      await replaceImage(stdFor(store), image(ids.pageImage), square)
    ).toBe(true);

    const { props } = image(ids.pageImage);
    expect([props.sourceId, props.size, props.width, props.height]).toEqual([
      'new',
      42,
      300,
      300,
    ]);
    expect(props.caption).toBe('c');
    expect(capture).toHaveBeenCalledTimes(1);
    expect(set).not.toHaveBeenCalled();

    store.undo();
    expect([props.sourceId, props.size, props.height]).toEqual([
      'old',
      10,
      150,
    ]);
    expect(store.canUndo).toBe(false);
  });

  it('drops the crop of the old picture in the same undo step', async () => {
    const { store, ids, image } = editorStore();
    const crop = { x: 0.5, y: 0, w: 0.5, h: 1 };
    store.updateBlock(image(ids.canvasImage), {
      crop,
      xywh: '[110,20,100,100]',
    });
    store.resetHistory();

    expect(
      await replaceImage(stdFor(store), image(ids.canvasImage), square)
    ).toBe(true);
    const model = image(ids.canvasImage);
    expect(model.props.crop).toBeUndefined();
    expect(model.props.sourceId).toBe('new');
    expect(model.props.xywh).toBe('[110,20,100,100]');

    store.undo();
    expect({ ...model.props.crop }).toEqual(crop);
    expect(model.props.sourceId).toBe('old');
    expect(store.canUndo).toBe(false);
  });

  it('writes nothing for the image already shown', async () => {
    const { store, ids, image } = editorStore();
    const same = { ...square, sourceId: 'old' };

    expect(await replaceImage(stdFor(store), image(ids.pageImage), same)).toBe(
      false
    );
    expect(store.canUndo).toBe(false);
  });

  it('writes nothing for a ref that is not an image', async () => {
    const { store, ids, image } = editorStore();
    const pdf = { ...square, type: 'application/pdf' };

    expect(await replaceImage(stdFor(store), image(ids.pageImage), pdf)).toBe(
      false
    );
    expect(image(ids.pageImage).props.sourceId).toBe('old');
  });

  it('writes nothing on a read-only document', async () => {
    const { store, ids, image } = editorStore();
    readonly(store);

    expect(
      await replaceImage(stdFor(store), image(ids.pageImage), square)
    ).toBe(false);
    expect(image(ids.pageImage).props.sourceId).toBe('old');
  });

  it('measures a ref without a size from the stored blob, read only', async () => {
    const { store, ids, image, set } = editorStore();
    const get = vi
      .spyOn(store.blobSync, 'get')
      .mockResolvedValue(new Blob(['x']));
    const unsized = { ...square, width: undefined, height: undefined };

    await replaceImage(stdFor(store), image(ids.pageImage), unsized);

    expect(get).toHaveBeenCalledWith('new');
    // A blob source may drop the MIME type; the ref's is used to measure.
    expect(vi.mocked(readImageSize).mock.calls.at(-1)?.[0].type).toBe(
      'image/png'
    );
    expect(image(ids.pageImage).props.height).toBe(75);
    expect(set).not.toHaveBeenCalled();
  });
});

describe('addSiblingImageBlocksFromAssets', () => {
  it('references the stored blob, skipping refs that are not images', async () => {
    const { store, ids, image, set } = editorStore();
    const pdf = { ...square, sourceId: 'doc', type: 'application/pdf' };

    const [id, ...rest] = await addSiblingImageBlocksFromAssets(
      stdFor(store),
      [square, pdf],
      image(ids.pageImage)
    );

    expect(rest).toEqual([]);
    const { props } = image(id as string);
    expect([props.sourceId, props.size, props.width, props.height]).toEqual([
      'new',
      42,
      50,
      50,
    ]);
    expect(set).not.toHaveBeenCalled();
  });

  it('writes nothing on a read-only document', async () => {
    const { store, ids, image } = editorStore();
    readonly(store);

    expect(
      await addSiblingImageBlocksFromAssets(
        stdFor(store),
        [square],
        image(ids.pageImage)
      )
    ).toEqual([]);
  });
});

describe('the image entries, with and without a host', () => {
  it('open the system file chooser without a host', async () => {
    const { store, ids, image } = editorStore();
    vi.mocked(getImageFilesFromLocal).mockClear();

    await pickAndAddSiblingImageBlocks(stdFor(store), image(ids.pageImage));

    expect(getImageFilesFromLocal).toHaveBeenCalledTimes(1);
  });

  it('ask the host for images of this document, and nothing else', async () => {
    const { store, ids, image } = editorStore();
    vi.mocked(getImageFilesFromLocal).mockClear();
    const pick = vi.fn(async () => [square]);

    const inserted = await pickAndAddSiblingImageBlocks(
      stdFor(store, { pick }),
      image(ids.pageImage)
    );

    expect(pick).toHaveBeenCalledWith({
      kind: 'image',
      mode: 'insert',
      multiple: true,
      docId: store.id,
    });
    expect(inserted).toHaveLength(1);
    expect(getImageFilesFromLocal).not.toHaveBeenCalled();
  });

  it('write nothing when the viewer cancels the dialog', async () => {
    const { store, ids, image } = editorStore();

    const inserted = await pickAndAddSiblingImageBlocks(
      stdFor(store, { pick: async () => null }),
      image(ids.pageImage)
    );

    expect(inserted).toEqual([]);
    expect(store.canUndo).toBe(false);
  });

  it('replace through the host in replace mode, and not at all without one', async () => {
    const { store, ids, image } = editorStore();
    const pick = vi.fn(async () => [square]);

    expect(await pickAndReplaceImage(stdFor(store), image(ids.pageImage))).toBe(
      false
    );
    expect(
      await pickAndReplaceImage(stdFor(store, { pick }), image(ids.pageImage))
    ).toBe(true);
    expect(pick).toHaveBeenCalledWith({
      kind: 'image',
      mode: 'replace',
      multiple: false,
      docId: store.id,
    });
  });
});

describe('"Replace" on the image toolbar', () => {
  function ctxFor(store: Store, picker?: AssetPickerService) {
    return {
      std: stdFor(store, picker),
      get readonly() {
        return store.readonly;
      },
    } as unknown as ToolbarContext;
  }

  it('is not offered without a host', () => {
    const { store, ids, image } = editorStore();
    const action = imageReplaceToolbarAction(() => image(ids.pageImage));
    const when = action.when as (ctx: ToolbarContext) => boolean;

    expect(when(ctxFor(store))).toBe(false);
  });

  it('is offered with a host, on a writable document only', () => {
    const { store, ids, image } = editorStore();
    const action = imageReplaceToolbarAction(() => image(ids.pageImage));
    const when = action.when as (ctx: ToolbarContext) => boolean;
    const picker = { pick: async () => null };

    expect(when(ctxFor(store, picker))).toBe(true);
    readonly(store);
    expect(when(ctxFor(store, picker))).toBe(false);
  });
});
