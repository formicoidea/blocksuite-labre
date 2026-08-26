import { CalloutBlockModel, ParagraphBlockModel } from '@labre/affine-model';
import { focusTextModel } from '@labre/affine-rich-text';
import { matchModels } from '@labre/affine-shared/utils';
import type { Command } from '@labre/std';

/**
 * Enter inside a callout: break the line WITHOUT leaving the callout.
 *
 * The paragraph keymap deliberately steps aside for a paragraph whose parent is
 * a callout, so this command is the only thing standing between the user and a
 * dead Enter key. The new paragraph is a sibling INSIDE the callout, never
 * after it — leaving a callout is what the down arrow is for.
 */
export const splitCalloutCommand: Command<{
  /** The callout the caret is in — the fallback target for an empty one. */
  calloutId: string;
  /** The block the caret is in; a paragraph in every ordinary case. */
  currentBlockId: string;
  /** Where the caret sits inside that block's text. */
  inlineIndex: number;
}> = (ctx, next) => {
  const { calloutId, currentBlockId, inlineIndex, std } = ctx;
  const store = std.store;

  const callout = store.getBlock(calloutId)?.model;
  if (!callout || !matchModels(callout, [CalloutBlockModel])) return;

  const current = store.getBlock(currentBlockId)?.model;

  store.captureSync();

  if (!current || !matchModels(current, [ParagraphBlockModel])) {
    // No paragraph under the caret — an empty callout. Give it one.
    focusTextModel(std, store.addBlock('affine:paragraph', {}, callout));
    next();
    return;
  }

  const parent = store.getParent(current);
  if (!parent) return;
  const index = parent.children.indexOf(current);
  if (index < 0) return;

  // `split` truncates the current text and hands back the tail.
  const right = current.props.text.split(inlineIndex);
  const newId = store.addBlock(
    'affine:paragraph',
    {
      text: right,
      // Breaking a heading in two keeps two headings; pressing Enter at its end
      // starts an ordinary line, as it does everywhere else in the editor.
      type: right.length === 0 ? 'text' : current.props.type,
    },
    parent,
    index + 1
  );

  focusTextModel(std, newId);
  next();
};
