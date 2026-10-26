import {
  type ClipboardConfigCreationContext,
  EdgelessClipboardConfig,
  type PreparedClipboardBlock,
} from '@labre/affine-block-surface';
import { type BlockSnapshot } from '@labre/store';

export class EdgelessClipboardEdgelessTextConfig extends EdgelessClipboardConfig {
  static override readonly key = 'affine:edgeless-text';

  override async prepare(
    edgelessText: BlockSnapshot
  ): Promise<PreparedClipboardBlock | null> {
    const oldId = edgelessText.id;
    delete edgelessText.props.index;
    if (!edgelessText.props.xywh) {
      console.error(
        `EdgelessText block(id: ${oldId}) does not have xywh property`
      );
      return null;
    }
    if (!this.surface) {
      return null;
    }
    const prepared = await this.prepareBlockSnapshotPaste(
      edgelessText,
      this.std.store,
      this.surface.model.id
    );
    if (!prepared) {
      console.error(`Failed to paste EdgelessText block(id: ${oldId})`);
      return null;
    }

    return prepared;
  }

  override createBlock(
    edgelessText: BlockSnapshot,
    context: ClipboardConfigCreationContext
  ): Promise<string | null> {
    return this.createPreparedBlock(edgelessText, context);
  }
}
