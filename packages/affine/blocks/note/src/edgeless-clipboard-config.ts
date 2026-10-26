import {
  type ClipboardConfigCreationContext,
  EdgelessClipboardConfig,
  type PreparedClipboardBlock,
} from '@labre/affine-block-surface';
import { type BlockSnapshot } from '@labre/store';

export class EdgelessClipboardNoteConfig extends EdgelessClipboardConfig {
  static override readonly key = 'affine:note';

  override async prepare(
    note: BlockSnapshot
  ): Promise<PreparedClipboardBlock | null> {
    const oldId = note.id;

    delete note.props.index;
    if (!note.props.xywh) {
      console.error(`Note block(id: ${oldId}) does not have xywh property`);
      return null;
    }

    const prepared = await this.prepareBlockSnapshotPaste(
      note,
      this.std.store,
      this.std.store.root!.id
    );
    if (!prepared) {
      console.error(`Failed to paste note block(id: ${oldId})`);
      return null;
    }

    return prepared;
  }

  override createBlock(
    note: BlockSnapshot,
    context: ClipboardConfigCreationContext
  ): Promise<null | string> {
    return this.createPreparedBlock(note, context);
  }
}
