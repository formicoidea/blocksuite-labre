import { EdgelessClipboardConfig } from '@labre/affine-block-surface';
import { type BlockSnapshot } from '@labre/store';

export class EdgelessClipboardImageConfig extends EdgelessClipboardConfig {
  static override readonly key = 'affine:image';

  override async createBlock(image: BlockSnapshot) {
    const { xywh, rotate, sourceId, size, width, height, caption, crop } =
      image.props;

    if (!this.surface) return null;

    if (!(await this.std.workspace.blobSync.get(sourceId as string))) {
      return null;
    }
    return this.crud.addBlock(
      'affine:image',
      {
        caption,
        sourceId,
        xywh,
        rotate,
        size,
        width,
        height,
        // The box above is the cropped one: without its crop the copy would
        // stretch the whole picture into it (ADR 0036).
        crop,
      },
      this.surface.model.id
    );
  }
}
