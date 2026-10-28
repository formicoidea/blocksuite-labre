/**
 * The canvas's "Add file" (`mediaRender`: the promoted senior tool and the
 * media item of the mind map basket) asks the host's asset dialog
 * (`AssetPickerProvider`) when there is one, and the system file chooser
 * otherwise.
 *
 * What it would have caught: labre recette of 2026-10-28, "Add file" still
 * opened the system file chooser with the seam registered, while the note
 * menu's Image and File buttons opened the dialog. `mediaRender` called
 * `openSingleFileWith` unconditionally.
 */
import {
  addAttachments,
  addAttachmentsFromAssets,
} from '@labre/affine-block-attachment';
import { addImages, addImagesFromAssets } from '@labre/affine-block-image';
import {
  AssetPickerProvider,
  type AssetPickerService,
  type AssetRef,
} from '@labre/affine-shared/services';
import { openSingleFileWith } from '@labre/affine-shared/utils';
import { Bound } from '@labre/global/gfx';
import type { BlockComponent, BlockStdScope } from '@labre/std';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { mediaRender } from '../toolbar/basket-elements';

vi.mock('@labre/affine-shared/utils', async importOriginal => ({
  ...(await importOriginal<typeof import('@labre/affine-shared/utils')>()),
  openSingleFileWith: vi.fn(async () => null),
}));
vi.mock('@labre/affine-block-image', async importOriginal => ({
  ...(await importOriginal<typeof import('@labre/affine-block-image')>()),
  addImages: vi.fn(async () => ['image-file']),
  addImagesFromAssets: vi.fn(async () => ['image-asset']),
}));
vi.mock('@labre/affine-block-attachment', async importOriginal => ({
  ...(await importOriginal<typeof import('@labre/affine-block-attachment')>()),
  addAttachments: vi.fn(async () => ['card-file']),
  addAttachmentsFromAssets: vi.fn(() => ['card-asset']),
}));

function edgelessWith(picker?: AssetPickerService) {
  const std = {
    store: { id: 'doc-1', readonly: false },
    getOptional: (id: unknown) =>
      id === AssetPickerProvider ? (picker ?? null) : null,
  } as unknown as BlockStdScope;
  return { edgeless: { std } as unknown as BlockComponent, std };
}

const bound = new Bound(10, 20, 100, 100);
const png: AssetRef = {
  sourceId: 'sha-png',
  name: 'plan.png',
  type: 'image/png',
  size: 10,
  width: 40,
  height: 30,
};
const pdf: AssetRef = {
  sourceId: 'sha-pdf',
  name: 'plan.pdf',
  type: 'application/pdf',
  size: 20,
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe('"Add file" with the asset dialog', () => {
  it('asks the host for one file to insert in this document, never the file chooser', async () => {
    const pick = vi.fn(async () => null);
    const { edgeless } = edgelessWith({ pick });

    expect(await mediaRender(bound, edgeless)).toBeNull();

    expect(pick).toHaveBeenCalledWith({
      kind: 'file',
      mode: 'insert',
      multiple: false,
      docId: 'doc-1',
    });
    expect(openSingleFileWith).not.toHaveBeenCalled();
    expect(addImagesFromAssets).not.toHaveBeenCalled();
    expect(addAttachmentsFromAssets).not.toHaveBeenCalled();
  });

  it('places a picked image as an image block at the corner of the bound', async () => {
    const { edgeless, std } = edgelessWith({ pick: async () => [png] });

    expect(await mediaRender(bound, edgeless)).toBe('image-asset');
    expect(addImagesFromAssets).toHaveBeenCalledWith(std, [png], {
      point: [10, 20],
      maxWidth: expect.any(Number),
      shouldTransformPoint: false,
    });
    expect(addAttachmentsFromAssets).not.toHaveBeenCalled();
  });

  it('places any other picked file as an attachment card', async () => {
    const { edgeless, std } = edgelessWith({ pick: async () => [pdf] });

    expect(await mediaRender(bound, edgeless)).toBe('card-asset');
    expect(addAttachmentsFromAssets).toHaveBeenCalledWith(
      std,
      [pdf],
      [10, 20],
      false
    );
    expect(addImagesFromAssets).not.toHaveBeenCalled();
  });

  it('writes nothing when the dialog rejects', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    const { edgeless } = edgelessWith({
      pick: async () => {
        throw new Error('refused');
      },
    });

    expect(await mediaRender(bound, edgeless)).toBeNull();
    expect(addImagesFromAssets).not.toHaveBeenCalled();
    expect(addAttachmentsFromAssets).not.toHaveBeenCalled();
    error.mockRestore();
  });
});

describe('"Add file" without the asset dialog', () => {
  it('opens the system file chooser and uploads what it returns', async () => {
    const file = new File(['x'], 'plan.pdf', { type: 'application/pdf' });
    vi.mocked(openSingleFileWith).mockResolvedValueOnce(file);
    const { edgeless, std } = edgelessWith();

    expect(await mediaRender(bound, edgeless)).toBe('card-file');
    expect(openSingleFileWith).toHaveBeenCalledTimes(1);
    expect(addAttachments).toHaveBeenCalledWith(std, [file], [10, 20], false);
    expect(addImages).not.toHaveBeenCalled();
    expect(addAttachmentsFromAssets).not.toHaveBeenCalled();
  });
});
