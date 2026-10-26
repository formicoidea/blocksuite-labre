import {
  type ClipboardConfigCreationContext,
  EdgelessClipboardConfig,
  type PreparedClipboardBlock,
} from '@labre/affine-block-surface';
import { type BlockSnapshot } from '@labre/store';

export class EdgelessClipboardAttachmentConfig extends EdgelessClipboardConfig {
  static override readonly key = 'affine:attachment';

  override async prepare(
    attachment: BlockSnapshot
  ): Promise<PreparedClipboardBlock | null> {
    if (!this.surface) return null;

    const { xywh, rotate, sourceId, name, size, type, embed, style } =
      attachment.props;

    if (!(await this.std.workspace.blobSync.get(sourceId as string))) {
      return null;
    }
    const surfaceId = this.surface.model.id;
    return {
      write: () =>
        this.crud.addBlock(
          'affine:attachment',
          {
            xywh,
            rotate,
            sourceId,
            name,
            size,
            type,
            embed,
            style,
          },
          surfaceId
        ),
    };
  }

  override createBlock(
    attachment: BlockSnapshot,
    context: ClipboardConfigCreationContext
  ): Promise<string | null> {
    return this.createPreparedBlock(attachment, context);
  }
}
