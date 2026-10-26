import {
  type ClipboardConfigCreationContext,
  EdgelessClipboardConfig,
  type PreparedClipboardBlock,
} from '@labre/affine-block-surface';
import { type BlockSnapshot } from '@labre/store';

export class EdgelessClipboardImageConfig extends EdgelessClipboardConfig {
  static override readonly key = 'affine:image';

  override async prepare(
    image: BlockSnapshot
  ): Promise<PreparedClipboardBlock | null> {
    const { xywh, rotate, sourceId, size, width, height, caption, crop } =
      image.props;

    if (!this.surface) return null;

    if (!(await this.std.workspace.blobSync.get(sourceId as string))) {
      return null;
    }
    const surfaceId = this.surface.model.id;
    return {
      write: () =>
        this.crud.addBlock(
          'affine:image',
          {
            caption,
            sourceId,
            xywh,
            rotate,
            size,
            width,
            height,
            // The box above is the cropped one: without its crop the copy
            // would stretch the whole picture into it (ADR 0037).
            crop,
          },
          surfaceId
        ),
    };
  }

  override createBlock(
    image: BlockSnapshot,
    context: ClipboardConfigCreationContext
  ) {
    return this.createPreparedBlock(image, context);
  }
}
