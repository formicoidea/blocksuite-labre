import {
  TOOLBAR_MOVE_DOWN,
  TOOLBAR_MOVE_UP,
} from '@labre/affine-shared/services';
import { BlockSelection, type BlockStdScope, TextSelection } from '@labre/std';

const getSelection = (std: BlockStdScope) => std.selection;

function getBlockSelectionBySide(std: BlockStdScope, tail: boolean) {
  const selection = getSelection(std);
  const selections = selection.filter(BlockSelection);
  const sel = selections.at(tail ? -1 : 0) as BlockSelection | undefined;
  return sel ?? null;
}

function getTextSelection(std: BlockStdScope) {
  const selection = getSelection(std);
  return selection.find(TextSelection);
}

const pathToBlock = (std: BlockStdScope, blockId: string) =>
  std.view.getBlock(blockId);

interface MoveBlockConfig {
  name: string;
  hotkey: string[];
  action: (std: BlockStdScope) => void;
}

// `name` is an internal label — read by nobody, never rendered (only
// `hotkey` and `action` below are), which is why it borrows the shared
// wording's own English fallback (`TOOLBAR_MOVE_UP[1]` / `_DOWN[1]`, said by
// the slash menu's "Actions" group too) rather than restating the word as an
// unkeyed literal that would drift the day either wording's fallback changes.
export const moveBlockConfigs: MoveBlockConfig[] = [
  {
    name: TOOLBAR_MOVE_UP[1],
    hotkey: ['Mod-Alt-ArrowUp', 'Mod-Shift-ArrowUp'],
    action: std => {
      const doc = std.store;
      const textSelection = getTextSelection(std);
      if (textSelection) {
        const currentModel = pathToBlock(
          std,
          textSelection.from.blockId
        )?.model;
        if (!currentModel) return;

        const previousSiblingModel = doc.getPrev(currentModel);
        if (!previousSiblingModel) return;

        const parentModel = std.store.getParent(previousSiblingModel);
        if (!parentModel) return;

        std.store.moveBlocks(
          [currentModel],
          parentModel,
          previousSiblingModel,
          true
        );
        std.host.updateComplete
          .then(() => {
            std.range.syncTextSelectionToRange(textSelection);
          })
          .catch(console.error);
        return true;
      }
      const blockSelection = getBlockSelectionBySide(std, true);
      if (blockSelection) {
        const currentModel = pathToBlock(std, blockSelection.blockId)?.model;
        if (!currentModel) return;

        const previousSiblingModel = doc.getPrev(currentModel);
        if (!previousSiblingModel) return;

        const parentModel = doc.getParent(previousSiblingModel);
        if (!parentModel) return;

        doc.moveBlocks(
          [currentModel],
          parentModel,
          previousSiblingModel,
          false
        );
        return true;
      }
      return;
    },
  },
  {
    name: TOOLBAR_MOVE_DOWN[1],
    hotkey: ['Mod-Alt-ArrowDown', 'Mod-Shift-ArrowDown'],
    action: std => {
      const doc = std.store;
      const textSelection = getTextSelection(std);
      if (textSelection) {
        const currentModel = pathToBlock(
          std,
          textSelection.from.blockId
        )?.model;
        if (!currentModel) return;

        const nextSiblingModel = doc.getNext(currentModel);
        if (!nextSiblingModel) return;

        const parentModel = doc.getParent(nextSiblingModel);
        if (!parentModel) return;

        doc.moveBlocks([currentModel], parentModel, nextSiblingModel, false);
        std.host.updateComplete
          .then(() => {
            std.range.syncTextSelectionToRange(textSelection);
          })
          .catch(console.error);
        return true;
      }
      const blockSelection = getBlockSelectionBySide(std, true);
      if (blockSelection) {
        const currentModel = pathToBlock(std, blockSelection.blockId)?.model;
        if (!currentModel) return;

        const nextSiblingModel = doc.getNext(currentModel);
        if (!nextSiblingModel) return;

        const parentModel = doc.getParent(nextSiblingModel);
        if (!parentModel) return;

        doc.moveBlocks([currentModel], parentModel, nextSiblingModel, false);
        return true;
      }
      return;
    },
  },
];
