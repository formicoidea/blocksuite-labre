import { CalloutBlockModel, ParagraphBlockModel } from '@labre/affine-model';
import { matchModels } from '@labre/affine-shared/utils';
import { BlockSelection, KeymapExtension, TextSelection } from '@labre/std';

import { calloutToParagraphCommand } from './commands/callout-to-paragraph.js';
import { splitCalloutCommand } from './commands/split-callout.js';

export const CalloutKeymapExtension = KeymapExtension(std => {
  return {
    Enter: ctx => {
      const text = std.selection.find(TextSelection);
      if (!text) return false;

      const currentBlock = std.store.getBlock(text.from.blockId);
      if (!currentBlock) return false;

      // The caret is either on the callout itself (an empty one) or on one of
      // its children.
      let calloutId = currentBlock.model.id;
      if (!matchModels(currentBlock.model, [CalloutBlockModel])) {
        const parent = std.store.getParent(currentBlock.model);
        if (!parent || !matchModels(parent, [CalloutBlockModel])) return false;
        calloutId = parent.id;
      }

      ctx.get('keyboardState').raw.preventDefault();
      std.command
        .chain()
        .pipe(splitCalloutCommand, {
          calloutId,
          currentBlockId: text.from.blockId,
          inlineIndex: text.from.index,
        })
        .run();
      return true;
    },
    Backspace: ctx => {
      const text = std.selection.find(TextSelection);
      if (!text || !text.isCollapsed() || text.from.index !== 0) return false;

      const block = std.store.getBlock(text.from.blockId);
      if (!block) return false;
      const parent = std.store.getParent(block.model);
      if (!parent) return false;
      if (!matchModels(parent, [CalloutBlockModel])) return false;

      // Nothing above was a callout, so nothing above was ours to swallow: the
      // event is only default-prevented once the callout is what we are in.
      const event = ctx.get('defaultState').event;
      event.preventDefault();

      // A paragraph merges into the previous paragraph of the same callout,
      // the way it would anywhere else in the document.
      if (matchModels(block.model, [ParagraphBlockModel])) {
        std.command
          .chain()
          .pipe(calloutToParagraphCommand, { id: block.model.id })
          .run();
        return true;
      }

      // Anything else hands the user the callout itself.
      std.selection.setGroup('note', [
        std.selection.create(BlockSelection, {
          blockId: parent.id,
        }),
      ]);

      return true;
    },
  };
});
