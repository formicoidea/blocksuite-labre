import {
  AssetPickerProvider,
  type AssetRef,
} from '@labre/affine-shared/services';
import { openSingleFileWith } from '@labre/affine-shared/utils';
import type { IVec } from '@labre/global/gfx';
import type { BlockStdScope } from '@labre/std';
import type { BlockModel } from '@labre/store';

import {
  addAttachments,
  addSiblingAttachmentBlocks,
  type AttachmentBlockSource,
  getFileType,
  placeAttachmentsOnCanvas,
} from './utils.js';

/**
 * Attachments from the host's asset library (`AssetPickerProvider`, labre
 * P4): the card references a blob the host already stores, by its
 * `sourceId`, with the ref's name, type and size. Nothing here calls
 * `BlobSource.set`. Without a host every entry point keeps the system file
 * chooser and the upload path of `utils.ts`; pasting and dropping never come
 * here.
 */

function attachmentPropsFrom(
  assets: readonly AssetRef[]
): AttachmentBlockSource[] {
  return assets.map(({ sourceId, name, type, size }) => ({
    sourceId,
    name,
    type,
    size,
  }));
}

/**
 * Adds one attachment card per ref next to `targetModel`, as one undo step.
 * Nothing is written on a read-only document.
 */
export function addSiblingAttachmentBlocksFromAssets(
  std: BlockStdScope,
  assets: readonly AssetRef[],
  targetModel: BlockModel,
  placement: 'before' | 'after' = 'after'
): string[] {
  if (!assets.length || std.store.readonly) return [];
  std.store.captureSync();
  return std.store.addSiblingBlocks(
    targetModel,
    attachmentPropsFrom(assets).map(props => ({
      ...props,
      flavour: 'affine:attachment',
    })),
    placement
  );
}

/**
 * The canvas counterpart of {@link addSiblingAttachmentBlocksFromAssets}:
 * places the cards like `addAttachments` does (around `point`, active layer,
 * selected).
 */
export function addAttachmentsFromAssets(
  std: BlockStdScope,
  assets: readonly AssetRef[],
  point?: IVec,
  shouldTransformPoint?: boolean
): string[] {
  if (!assets.length || std.store.readonly) return [];
  std.store.captureSync();
  return placeAttachmentsOnCanvas(
    std,
    attachmentPropsFrom(assets),
    point,
    shouldTransformPoint
  );
}

function pickFiles(std: BlockStdScope) {
  const picker = std.getOptional(AssetPickerProvider);
  if (!picker) return null;
  return picker.pick({
    kind: 'file',
    mode: 'insert',
    multiple: false,
    docId: std.store.id,
  });
}

/**
 * The attachment entries of the slash menu (Attachment, PDF) and of the
 * mobile keyboard toolbar: the host's asset dialog when there is one, the
 * system file chooser otherwise (the upload path, unchanged). An emptied
 * line the gesture was typed on goes away once a card is in.
 */
export async function pickAndAddSiblingAttachmentBlocks(
  std: BlockStdScope,
  targetModel: BlockModel
): Promise<string[]> {
  const picked = pickFiles(std);
  let ids: string[];
  if (picked) {
    ids = addSiblingAttachmentBlocksFromAssets(
      std,
      (await picked) ?? [],
      targetModel
    );
  } else {
    const file = await openSingleFileWith();
    if (!file) return [];
    ids = await addSiblingAttachmentBlocks(std, [file], targetModel);
  }
  if (ids.length && targetModel.text?.length === 0) {
    std.store.deleteBlock(targetModel);
  }
  return ids;
}

/** The canvas's file button: the host's asset dialog, or the file chooser. */
export async function pickAndAddAttachments(
  std: BlockStdScope
): Promise<string[]> {
  const picked = pickFiles(std);
  if (picked) return addAttachmentsFromAssets(std, (await picked) ?? []);
  const file = await openSingleFileWith();
  if (!file) return [];
  return addAttachments(std, [file]);
}

/**
 * What the attachment toolbar's "Replace" puts in the card: the host's asset
 * dialog when there is one (`kind: 'file'`, `mode: 'replace'`, first ref
 * used, by reference), the system file chooser otherwise (the file goes up
 * through the blob source, as before). `null` when cancelled.
 */
export async function pickAttachmentSource(
  std: BlockStdScope
): Promise<AttachmentBlockSource | null> {
  const picker = std.getOptional(AssetPickerProvider);
  if (picker) {
    const [asset] =
      (await picker.pick({
        kind: 'file',
        mode: 'replace',
        multiple: false,
        docId: std.store.id,
      })) ?? [];
    return asset ? (attachmentPropsFrom([asset])[0] ?? null) : null;
  }
  const file = await openSingleFileWith();
  if (!file) return null;
  const sourceId = await std.store.blobSync.set(file);
  const type = await getFileType(file);
  return { sourceId, name: file.name, type, size: file.size };
}
