import { createIdentifier } from '@labre/global/di';
import type { ExtensionType } from '@labre/store';

/**
 * A blob the host ALREADY stores, as the editor references it: the block it
 * lands in stores `sourceId` and nothing else of the bytes. The library never
 * sends the bytes again (`BlobSource.set` is not called); it may read them
 * once through the store's blob sources to measure an image when `width` or
 * `height` is missing.
 */
export interface AssetRef {
  /** The blob's key in the store's blob sources (the Labre app: its sha256). */
  sourceId: string;
  /** The file name, kept by an attachment card. */
  name: string;
  /** The MIME type. An image request ignores a ref that is not `image/*`. */
  type: string;
  /** In bytes. */
  size: number;
  /** An image's natural size; measured from the blob when either is absent. */
  width?: number;
  height?: number;
}

/**
 * What the editor asks for.
 *
 * - `kind`: `image` for an image block, `file` for an attachment card.
 * - `mode`: `insert` adds new blocks; `replace` swaps the picture of one
 *   existing image (one ref is used, the first).
 * - `multiple`: whether more than one ref is welcome (the image insertions).
 * - `docId`: the document the result lands in, so the host can attach the
 *   asset to that page (a guest of the page must be able to read it).
 */
export interface AssetPickerRequest {
  kind: 'image' | 'file';
  mode: 'insert' | 'replace';
  multiple?: boolean;
  docId: string;
}

/**
 * Pick an asset from the host's own library (labre P4: the asset dialog of
 * the shell), instead of the system file chooser.
 *
 * `pick` resolves with the refs to use, or `null` when the viewer cancelled:
 * then nothing is written. An empty array is a cancellation too. A rejection
 * is logged and nothing is written: show your own error before rejecting.
 * Upload a new file into your library inside the dialog, then resolve with
 * its ref: the editor never receives a `File` through this seam.
 */
export interface AssetPickerService {
  pick(request: AssetPickerRequest): Promise<AssetRef[] | null>;
}

export const AssetPickerProvider =
  createIdentifier<AssetPickerService>('AffineAssetPicker');

/**
 * Host seam: the asset dialog. Present, the slash menu's Image, Attachment
 * and PDF, the mobile keyboard toolbar's Image and Attachment, the canvas's
 * image and file buttons and its "Add file" tool open it, and the image
 * toolbar gains "Replace". Absent, every one of those opens the system file
 * chooser as before, and there is no "Replace". Pasting and dropping files
 * never go through it.
 *
 * `di.override`, like `FrameTemplateExtension`, so a later registration
 * always wins and registering twice never throws at boot.
 */
export function AssetPickerExtension(
  service: AssetPickerService
): ExtensionType {
  return {
    setup: di => {
      di.override(AssetPickerProvider, () => service);
    },
  };
}
