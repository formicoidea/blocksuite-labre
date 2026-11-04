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
  openSingleFileWith,
  readImageSize,
} from '@labre/affine-shared/utils';
import { Bound, type IVec } from '@labre/global/gfx';
import type { BlockStdScope } from '@labre/std';
import type { BlockModel, Store } from '@labre/store';

import {
  type Box,
  cropToBox,
  pageImageProps,
  storedImageBox,
} from './replace/frame.js';
import { IMAGE_TOAST_READ_SIZE_FAILED } from './translations.js';
import {
  addImages,
  addSiblingImageBlocks,
  type FileReplacement,
  fileSourceFromFile,
  type ImageBlockSource,
  imageSourceFromFile,
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
 * The props that put a picture of `natural` size in `model`'s frame (ADR 0044,
 * amendment of 2026-11-04): the frame does not move, the picture is cut to it. On
 * the canvas the frame is `xywh`; in a page it is `box`, the displayed size, and
 * without one (never laid out, no stored size) the image stays at its natural size.
 */
export function replacementProps(
  model: ImageBlockModel,
  asset: Pick<AssetRef, 'sourceId' | 'size'>,
  natural: Size,
  box: Box | null = storedImageBox(model.props)
): Partial<ImageBlockProps> {
  const props: Partial<ImageBlockProps> = {
    sourceId: asset.sourceId,
    size: asset.size,
  };
  if (model.parent?.flavour === 'affine:surface') {
    return {
      ...props,
      width: natural.width,
      height: natural.height,
      ...cropToBox(Bound.deserialize(model.props.xywh), natural),
    };
  }
  return box ? { ...props, ...pageImageProps(box, natural) } : props;
}

/**
 * Swaps the picture of one image block for `asset`, in its frame and with its
 * caption, in one undo step. `false` when nothing was written: a read-only
 * document, the same blob, a ref that is not an image, a size that cannot be read,
 * or a block deleted meanwhile.
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
  return replaceImageSource(model, {
    sourceId: asset.sourceId,
    size: asset.size,
    ...natural,
  });
}

/**
 * The write half of {@link replaceImage}, for a picture already measured
 * ({@link pickReplacement}): same refusals, same one undo step, synchronous,
 * so a caller re-reads its target after a dialog and writes at once.
 */
export function replaceImageSource(
  model: ImageBlockModel,
  source: ImageBlockSource,
  box?: Box | null
): boolean {
  const { store } = model;
  if (store.readonly || !store.getBlock(model.id)) return false;
  if (!source.sourceId || !isSize(source.width, source.height)) return false;
  if (source.sourceId === model.props.sourceId$.peek()) return false;
  const natural = { width: source.width, height: source.height };
  const asset = { sourceId: source.sourceId, size: source.size };
  const next = replacementProps(model, asset, natural, box);
  store.captureSync();
  store.transact(() => {
    store.updateBlock(model, next);
    // A crop is a window on the picture it was drawn on (ADR 0037): the old one
    // goes, and the whole picture is the absent key.
    if (!next.crop && model.props.crop) {
      delete (model.props as { crop?: unknown }).crop;
    }
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

/** What a person chose to put in place of an element, sorted by what it is. */
export type ReplacementAnswer =
  | { kind: 'image'; source: ImageBlockSource }
  | { kind: 'file'; source: FileReplacement };

/**
 * What to put in place of an element: the host's asset dialog when there is one
 * (`replace` mode, one asset, opened on `kind`, the kind of what is replaced), the
 * system file chooser otherwise (the file goes up through the blob source, like
 * every file-chooser path). Either may answer any type: the caller looks at the
 * answer (ADR 0044, amendment of 2026-11-04). `null` when cancelled, or when the
 * size of a picture cannot be read.
 */
export async function pickReplacement(
  std: BlockStdScope,
  kind: AssetPickerRequest['kind']
): Promise<ReplacementAnswer | null> {
  const picked = pickRequest(std, { kind, mode: 'replace', multiple: false });
  if (picked) {
    const [asset] = (await picked) ?? [];
    if (!asset) return null;
    if (!asset.type.startsWith('image/')) {
      const { sourceId, name, type, size } = asset;
      return { kind: 'file', source: { sourceId, name, type, size } };
    }
    const [source] = await imagePropsFrom(std, [asset]);
    return source ? { kind: 'image', source } : null;
  }
  const file = await openSingleFileWith();
  if (!file) return null;
  if (file.type.startsWith('image/')) {
    const source = await imageSourceFromFile(std, file);
    return source ? { kind: 'image', source } : null;
  }
  const source = await fileSourceFromFile(std, file);
  return source ? { kind: 'file', source } : null;
}
