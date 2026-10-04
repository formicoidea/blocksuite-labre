import { isFrameBlock } from '@labre/affine-block-frame';
import {
  type ClipboardConfigCreationContext,
  EdgelessClipboardConfigIdentifier,
  EdgelessCRUDIdentifier,
} from '@labre/affine-block-surface';
import { Bound, type IVec, type SerializedXYWH } from '@labre/global/gfx';
import { assertType } from '@labre/global/utils';
import type { BlockStdScope, Command } from '@labre/std';
import {
  type GfxBlockElementModel,
  type GfxCompatibleProps,
  GfxControllerIdentifier,
  type GfxModel,
  type GfxPrimitiveElementModel,
  type SerializedElement,
  SortOrder,
} from '@labre/std/gfx';
import { type BlockSnapshot, BlockSnapshotSchema } from '@labre/store';

import { createCanvasElement } from './canvas';
import {
  createNewPresentationIndexes,
  edgelessElementsBoundFromRawData,
} from './utils';

interface Input {
  elementsRawData: (SerializedElement | BlockSnapshot)[];
  pasteCenter?: IVec;
}

type CreatedElements = {
  canvasElements: GfxPrimitiveElementModel[];
  blockModels: GfxBlockElementModel[];
};

interface Output {
  createdElementsPromise: Promise<CreatedElements>;
}

export const createElementsFromClipboardDataCommand: Command<Input, Output> = (
  ctx,
  next
) => {
  const { std, elementsRawData } = ctx;
  let { pasteCenter } = ctx;

  const gfx = std.get(GfxControllerIdentifier);
  const toolManager = gfx.tool;

  const runner = async (): Promise<CreatedElements> => {
    let oldCommonBound, pasteX, pasteY;
    {
      const lastMousePos = toolManager.lastMousePos$.peek();
      pasteCenter = pasteCenter ?? [lastMousePos.x, lastMousePos.y];
      const [modelX, modelY] = pasteCenter;
      oldCommonBound = edgelessElementsBoundFromRawData(elementsRawData);

      pasteX = modelX - oldCommonBound.w / 2;
      pasteY = modelY - oldCommonBound.h / 2;
    }

    const getNewXYWH = (oldXYWH: SerializedXYWH) => {
      const oldBound = Bound.deserialize(oldXYWH);
      return new Bound(
        oldBound.x + pasteX - oldCommonBound.x,
        oldBound.y + pasteY - oldCommonBound.y,
        oldBound.w,
        oldBound.h
      ).serialize();
    };

    // create blocks and canvas elements

    const context: ClipboardConfigCreationContext = {
      oldToNewIdMap: new Map<string, string>(),
      originalIndexes: new Map<string, string>(),
      newPresentationIndexes: createNewPresentationIndexes(
        elementsRawData,
        std
      ),
    };

    const blockModels: GfxBlockElementModel[] = [];
    const canvasElements: GfxPrimitiveElementModel[] = [];
    const allElements: GfxModel[] = [];

    // Read before anything is created: `createCanvasElement` rewrites a
    // group's `children` with the new ids.
    const oldParents = pastedParentage(elementsRawData);

    // Canvas elements are written in as few transactions as the blocks allow,
    // so a peer receives one update for a run of them instead of one per
    // element (plus one per index fix-up). A block cannot join: its config's
    // `createBlock` may be async (notes, texts, images and attachments go
    // through the transformer, which awaits), and a Yjs transaction cannot
    // span an `await`. So the run of canvas elements before a block is written
    // first — the block may reference them (a frame's `childElementIds`) —
    // and the last run is written together with the final indexes.
    // ponytail: a block still costs its own transactions; a two-phase config
    // contract (async prepare, then a sync write) is the upgrade path.
    const pendingCanvasElements: SerializedElement[] = [];
    const seen = new Set<string>();

    const createPendingCanvasElements = () => {
      for (const data of pendingCanvasElements) {
        const element = createCanvasElement(
          std,
          data,
          context,
          getNewXYWH(data.xywh)
        );
        if (!element) continue;

        canvasElements.push(element);
        allElements.push(element);
        context.oldToNewIdMap.set(data.id, element.id);
        context.originalIndexes.set(data.id, element.index);
      }
      pendingCanvasElements.length = 0;
    };

    // One gesture, one undo step: close whatever the previous gesture left
    // open in the undo manager's capture window.
    std.store.captureSync();

    for (const data of elementsRawData) {
      // Clipboard data written before `sortEdgelessElements` deduplicated can
      // list one element twice; the first copy is the one its container maps.
      if (seen.has(data.id)) continue;
      seen.add(data.id);

      const { data: blockSnapshot } = BlockSnapshotSchema.safeParse(data);
      if (!blockSnapshot) {
        assertType<SerializedElement>(data);
        pendingCanvasElements.push(data);
        continue;
      }

      if (pendingCanvasElements.length > 0) {
        std.store.transact(createPendingCanvasElements);
      }

      const oldId = blockSnapshot.id;

      const config = std.getOptional(
        EdgelessClipboardConfigIdentifier(blockSnapshot.flavour)
      );
      if (!config) continue;

      if (typeof blockSnapshot.props.index !== 'string') {
        console.error(`Block(id: ${oldId}) does not have index property`);
        continue;
      }
      const originalIndex = (blockSnapshot.props as GfxCompatibleProps).index;

      if (typeof blockSnapshot.props.xywh !== 'string') {
        console.error(`Block(id: ${oldId}) does not have xywh property`);
        continue;
      }

      assertType<GfxCompatibleProps>(blockSnapshot.props);

      blockSnapshot.props.xywh = getNewXYWH(
        blockSnapshot.props.xywh as SerializedXYWH
      );
      blockSnapshot.props.lockedBySelf = false;

      const newId = await config.createBlock(blockSnapshot, context);
      if (!newId) continue;

      const block = std.store.getBlock(newId);
      if (!block) continue;

      assertType<GfxBlockElementModel>(block.model);
      blockModels.push(block.model);
      allElements.push(block.model);
      context.oldToNewIdMap.set(oldId, newId);
      context.originalIndexes.set(oldId, originalIndex);
    }

    std.store.transact(() => {
      createPendingCanvasElements();

      // remap old id to new id for the original index
      const oldIds = [...context.originalIndexes.keys()];
      oldIds.forEach(oldId => {
        const newId = context.oldToNewIdMap.get(oldId);
        const originalIndex = context.originalIndexes.get(oldId);
        if (newId && originalIndex) {
          context.originalIndexes.set(newId, originalIndex);
          context.originalIndexes.delete(oldId);
        }
      });

      const parents = new Map<string, string>();
      oldParents.forEach((oldParent, oldChild) => {
        const child = context.oldToNewIdMap.get(oldChild);
        const parent = context.oldToNewIdMap.get(oldParent);
        if (child && parent) parents.set(child, parent);
      });

      releaseChildrenFromAdoptingFrames(std, allElements, parents);
      updatePastedElementsIndex(
        std,
        allElements,
        context.originalIndexes,
        parents
      );
    });

    return {
      canvasElements: canvasElements,
      blockModels: blockModels,
    };
  };

  return next({
    createdElementsPromise: runner(),
  });
};

/**
 * Child id → container id, as the pasted data spells it: a group's or a mind
 * map's `children`, a frame's `childElementIds`.
 *
 * The paste reads its parentage from here and not from the models: a canvas
 * container written in the final transaction registers its children (its
 * `childIds`, `getGroup`) only when that transaction ends, so inside it a
 * model would answer "no parent".
 */
function pastedParentage(
  elementsRawData: (SerializedElement | BlockSnapshot)[]
) {
  const parents = new Map<string, string>();
  for (const data of elementsRawData) {
    const children =
      'flavour' in data ? data.props.childElementIds : data.children;
    if (!children || typeof children !== 'object') continue;

    for (const childId of Object.keys(children)) {
      parents.set(childId, data.id);
    }
  }
  return parents;
}

/**
 * The paste creates children before their container (post-order), and the
 * frame manager adopts whatever is created inside a frame — a block at once on
 * `blockUpdated`, a canvas element a microtask later, which an `await` between
 * two creations lets run. So a child of a pasted group or frame can already sit
 * in the frame under the paste point when its own container claims it, and a
 * child claimed twice is copied twice by the next duplicate.
 *
 * The paste knows the parentage it is writing; the frame's guess does not
 * survive it. Each pasted container's children leave any other frame. The
 * container itself is untouched, so a pasted group still lands in the frame it
 * was dropped on.
 */
function releaseChildrenFromAdoptingFrames(
  std: BlockStdScope,
  created: GfxModel[],
  parents: Map<string, string>
) {
  if (parents.size === 0) return;
  const frames = std.store
    .getModelsByFlavour('affine:frame')
    .filter(isFrameBlock);
  if (frames.length === 0) return;

  for (const child of created) {
    const container = parents.get(child.id);
    if (!container) continue;

    for (const frame of frames) {
      if (frame.id !== container && frame.hasChild(child)) {
        frame.removeChild(child);
      }
    }
  }
}

/**
 * Give the pasted elements fresh indexes on top of the board, in the order
 * they had where they were copied from: a container before its children, and
 * otherwise by the original index of the topmost pasted ancestor (then of the
 * next one down, then of the element itself).
 */
function updatePastedElementsIndex(
  std: BlockStdScope,
  elements: GfxModel[],
  originalIndexes: Map<string, string>,
  parents: Map<string, string>
) {
  const gfx = std.get(GfxControllerIdentifier);
  const crud = std.get(EdgelessCRUDIdentifier);

  // Pasted ancestors, nearest first — the order `GfxModel.groups` uses.
  const ancestors = new Map<string, string[]>();
  for (const element of elements) {
    const chain: string[] = [];
    for (
      let parent = parents.get(element.id);
      parent && !chain.includes(parent);
      parent = parents.get(parent)
    ) {
      chain.push(parent);
    }
    ancestors.set(element.id, chain);
  }

  function compare(a: GfxModel, b: GfxModel) {
    const aGroups = ancestors.get(a.id) ?? [];
    const bGroups = ancestors.get(b.id) ?? [];

    if (bGroups.includes(a.id)) {
      return SortOrder.BEFORE;
    } else if (aGroups.includes(b.id)) {
      return SortOrder.AFTER;
    }

    let i = 1;
    let aGroup = aGroups.at(-i);
    let bGroup = bGroups.at(-i);

    while (aGroup === bGroup && aGroup) {
      ++i;
      aGroup = aGroups.at(-i);
      bGroup = bGroups.at(-i);
    }

    const aIndex = originalIndexes.get(aGroup ?? a.id);
    const bIndex = originalIndexes.get(bGroup ?? b.id);

    return aIndex === bIndex
      ? SortOrder.SAME
      : aIndex! < bIndex!
        ? SortOrder.BEFORE
        : SortOrder.AFTER;
  }

  const idxGenerator = gfx.layer.createIndexGenerator();
  const sortedElements = elements.sort(compare);
  sortedElements.forEach(ele => {
    const newIndex = idxGenerator();

    crud.updateElement(ele.id, {
      index: newIndex,
    });
  });
}
