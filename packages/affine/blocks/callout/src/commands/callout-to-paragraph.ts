import { CalloutBlockModel, ParagraphBlockModel } from '@labre/affine-model';
import { focusTextModel } from '@labre/affine-rich-text';
import { matchModels } from '@labre/affine-shared/utils';
import type { Command } from '@labre/std';
import { BlockSelection } from '@labre/std';

/**
 * Backspace at the very start of a paragraph inside a callout.
 *
 * Outside a callout that keystroke merges the paragraph into the one above.
 * Inside one it used to do nothing but select the whole callout, so a line
 * broken by mistake could not be joined back — the text had to be cut and
 * pasted by hand.
 *
 * The paragraph now merges into the previous paragraph of the SAME callout,
 * keeping its formatting, and the caret lands at the seam. With no previous
 * paragraph to merge into, the callout itself is selected — the old behaviour,
 * and the way one deletes a callout without losing what it holds.
 */
export const calloutToParagraphCommand: Command<
  {
    id: string;
    stopCapturing?: boolean;
  },
  {
    success: boolean;
  }
> = (ctx, next) => {
  const { id, stopCapturing = true } = ctx;
  const std = ctx.std;
  const doc = std.store;
  const model = doc.getBlock(id)?.model;

  if (!model || !matchModels(model, [ParagraphBlockModel])) return;

  const parent = doc.getParent(model);
  if (!parent || !matchModels(parent, [CalloutBlockModel])) return;

  // The previous paragraph of this callout, skipping siblings that hold no
  // text of their own.
  const currentIndex = parent.children.indexOf(model);
  let previous: ParagraphBlockModel | null = null;
  for (let i = currentIndex - 1; i >= 0; i--) {
    const sibling = parent.children[i];
    if (matchModels(sibling, [ParagraphBlockModel])) {
      previous = sibling;
      break;
    }
  }

  if (!previous) {
    // Nothing to merge into. Select the callout rather than delete anything:
    // a second Backspace then removes it, text included, in one undo step.
    std.selection.setGroup('note', [
      std.selection.create(BlockSelection, {
        blockId: parent.id,
      }),
    ]);
    next({ success: true });
    return;
  }

  if (stopCapturing) doc.captureSync();

  const previousText = previous.props.text;
  // Read the seam BEFORE joining: that is where the caret must land.
  const mergeIndex = previousText.length;

  // `join` replays the deltas, so bold, links and the rest survive the merge.
  previousText.join(model.props.text);
  doc.deleteBlock(model, { deleteChildren: false });

  focusTextModel(std, previous.id, mergeIndex);

  next({ success: true });
};
