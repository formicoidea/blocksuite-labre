import { toast } from '@labre/affine-components/toast';
import {
  type ImageBlockModel,
  type ImageBlockProps,
  ImageBlockSchema,
} from '@labre/affine-model';
import {
  AssetPickerProvider,
  type AssetPickerRequest,
  type AssetRef,
  translateKey,
} from '@labre/affine-shared/services';
import {
  getImageFilesFromLocal,
  readImageSize,
} from '@labre/affine-shared/utils';
import { Bound, type IVec } from '@labre/global/gfx';
import type { BlockStdScope } from '@labre/std';
import type { BlockModel, Store } from '@labre/store';

import { IMAGE_TOAST_READ_SIZE_FAILED } from './translations.js';
import {
  addImages,
  addSiblingImageBlocks,
  type ImageBlockSource,
  placeImagesOnCanvas,
} from './utils.js';

/**
 * Images from the host's asset library (`AssetPickerProvider`, labre P4): the
 * block references a blob the host already stores, by its `sourceId`. Nothing
 * here calls `BlobSource.set`; the bytes are read once, through the store's
 * blob sources, only to measure an image whose ref carries no size.
 *
 * Without a host every entry point keeps the system file chooser and the
 * upload path of `utils.ts`. Pasting and dropping never come here.
 */

type Size = { width: number; height: number };

function isSize(width = 0, height = 0) {
  return width > 0 && height > 0;
}

async function naturalSize(
  store: Store,
  asset: AssetRef
): Promise<Size | null> {
  const { width = 0, height = 0 } = asset;
  if (isSize(width, height)) return { width, height };
  const blob = await store.blobSync.get(asset.sourceId);
  if (!blob) return null;
  // `readImageSize` trusts the MIME type; a blob source may not keep it.
  const typed = blob.type ? blob : new Blob([blob], { type: asset.type });
  const size = await readImageSize(typed);
  return isSize(size.width, size.height) ? size : null;
}

export async function imagePropsFrom(
  std: BlockStdScope,
  assets: readonly AssetRef[]
): Promise<ImageBlockSource[]> {
  const images = assets.filter(asset => asset.type.startsWith('image/'));
  const sized = await Promise.all(
    images.map(async asset => {
      const size = await naturalSize(std.store, asset);
      return size
        ? { sourceId: asset.sourceId, size: asset.size, ...size }
        : null;
    })
  );
  const props = sized.filter((p): p is ImageBlockSource => p !== null);
  if (props.length < images.length) {
    toast(std.host, translateKey(std, ...IMAGE_TOAST_READ_SIZE_FAILED));
  }
  return props;
}

/**
 * Adds one image block per image ref next to `targetModel`, as one undo
 * step. Refs that are not `image/*`, or whose size cannot be read, are
 * skipped. Nothing is written on a read-only document.
 */
export async function addSiblingImageBlocksFromAssets(
  std: BlockStdScope,
  assets: readonly AssetRef[],
  targetModel: BlockModel,
  placement: 'after' | 'before' = 'after'
): Promise<string[]> {
  if (std.store.readonly) return [];
  const props = await imagePropsFrom(std, assets);
  // Re-checked: the document may have turned read-only while measuring.
  if (!props.length || std.store.readonly) return [];
  const flavour = ImageBlockSchema.model.flavour;
  std.store.captureSync();
  return std.store.addSiblingBlocks(
    targetModel,
    props.map(p => ({ ...p, flavour })),
    placement
  );
}

/**
 * The canvas counterpart of {@link addSiblingImageBlocksFromAssets}: places
 * the images like `addImages` does (around `point`, active layer, selected).
 */
export async function addImagesFromAssets(
  std: BlockStdScope,
  assets: readonly AssetRef[],
  options: { point?: IVec; maxWidth?: number; shouldTransformPoint?: boolean }
): Promise<string[]> {
  if (std.store.readonly) return [];
  const props = await imagePropsFrom(std, assets);
  if (!props.length || std.store.readonly) return [];
  std.store.captureSync();
  return placeImagesOnCanvas(std, props, options);
}

/**
 * The props that swap `model`'s picture for one of `natural` size while it
 * keeps its displayed width and follows the new ratio. On the canvas the
 * frame keeps its top-left corner and width; in a page the block keeps its
 * `width` (an image still at its natural size, `width` unset, stays so).
 */
export function replacementProps(
  model: ImageBlockModel,
  asset: Pick<AssetRef, 'sourceId' | 'size'>,
  natural: Size
): Partial<ImageBlockProps> {
  const ratio = natural.height / natural.width;
  const props: Partial<ImageBlockProps> = {
    sourceId: asset.sourceId,
    size: asset.size,
  };
  if (model.parent?.flavour === 'affine:surface') {
    const bound = Bound.deserialize(model.props.xywh);
    bound.h = bound.w * ratio;
    props.xywh = bound.serialize();
    props.width = natural.width;
    props.height = natural.height;
    return props;
  }
  const width = model.props.width ?? 0;
  if (width > 0) {
    props.width = width;
    props.height = width * ratio;
  }
  return props;
}

/**
 * Swaps the picture of one image block for `asset`, keeping its displayed
 * width and its caption, in one undo step. `false` when nothing was written:
 * a read-only document, the same blob, a ref that is not an image, a size
 * that cannot be read, or a block deleted meanwhile.
 */
export async function replaceImage(
  std: BlockStdScope,
  model: ImageBlockModel,
  asset: AssetRef
): Promise<boolean> {
  const { store } = model;
  if (store.readonly) return false;
  if (!asset.type.startsWith('image/')) return false;
  if (asset.sourceId === model.props.sourceId$.peek()) return false;
  const natural = await naturalSize(store, asset);
  if (!natural) {
    toast(std.host, translateKey(std, ...IMAGE_TOAST_READ_SIZE_FAILED));
    return false;
  }
  if (store.readonly || !store.getBlock(model.id)) return false;
  store.captureSync();
  store.transact(() => {
    store.updateBlock(model, replacementProps(model, asset, natural));
    // A crop is a window on the picture it was drawn on (ADR 0037).
    if (model.props.crop) delete (model.props as { crop?: unknown }).crop;
  });
  return true;
}

function pickRequest(
  std: BlockStdScope,
  request: Omit<AssetPickerRequest, 'docId'>
): Promise<AssetRef[] | null> | null {
  const picker = std.getOptional(AssetPickerProvider);
  if (!picker) return null;
  return picker.pick({ ...request, docId: std.store.id });
}

/**
 * The image entries of the slash menu and of the mobile keyboard toolbar:
 * the host's asset dialog when there is one, the system file chooser
 * otherwise (the upload path, unchanged).
 */
export async function pickAndAddSiblingImageBlocks(
  std: BlockStdScope,
  targetModel: BlockModel,
  placement: 'after' | 'before' = 'after'
): Promise<string[]> {
  const picked = pickRequest(std, {
    kind: 'image',
    mode: 'insert',
    multiple: true,
  });
  if (!picked) {
    const files = await getImageFilesFromLocal();
    return addSiblingImageBlocks(std, files, targetModel, placement);
  }
  const assets = await picked;
  if (!assets?.length) return [];
  return addSiblingImageBlocksFromAssets(std, assets, targetModel, placement);
}

/** The canvas's image button: the host's asset dialog, or the file chooser. */
export async function pickAndAddImages(
  std: BlockStdScope,
  options: { maxWidth?: number }
): Promise<string[]> {
  const picked = pickRequest(std, {
    kind: 'image',
    mode: 'insert',
    multiple: true,
  });
  if (!picked) {
    const files = await getImageFilesFromLocal();
    return addImages(std, files, options);
  }
  const assets = await picked;
  if (!assets?.length) return [];
  return addImagesFromAssets(std, assets, options);
}

/**
 * The image toolbar's "Replace": only with a host (`false` otherwise, and
 * the toolbar does not offer it), one ref, `mode: 'replace'`.
 */
export async function pickAndReplaceImage(
  std: BlockStdScope,
  model: ImageBlockModel
): Promise<boolean> {
  if (model.store.readonly) return false;
  const picked = pickRequest(std, {
    kind: 'image',
    mode: 'replace',
    multiple: false,
  });
  if (!picked) return false;
  const [asset] = (await picked) ?? [];
  if (!asset) return false;
  return replaceImage(std, model, asset);
}
