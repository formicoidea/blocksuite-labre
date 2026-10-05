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
    // Decided before anything is created too, so that a canvas element is
    // born with its final index: written afterwards, each index moved an
    // element already on the board, through the layer manager, one by one.
    const newIndexes = pastedIndexes(
      std,
      elementsRawData,
      oldParents,
      context.originalIndexes
    );
    const blockIndexes = new Map<GfxBlockElementModel, string>();

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
        data.index = newIndexes.get(data.id) ?? data.index;
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
      }
      pendingCanvasElements.length = 0;
    };

    // One gesture, one undo step: close whatever the previous gesture left
    // open in the undo manager's capture window.
    // ponytail: the paste's own transactions then merge only while each ends
    // within that window (500 ms) of the one before, so a block whose creation
    // takes longer splits the step; the two-phase contract above removes the
    // ceiling (the budget spec measures it on 406 elements).
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
      const index = newIndexes.get(oldId);
      if (index) blockIndexes.set(block.model, index);
    }

    std.store.transact(() => {
      createPendingCanvasElements();

      const parents = new Map<string, string>();
      oldParents.forEach((oldParent, oldChild) => {
        const child = context.oldToNewIdMap.get(oldChild);
        const parent = context.oldToNewIdMap.get(oldParent);
        if (child && parent) parents.set(child, parent);
      });

      releaseChildrenFromAdoptingFrames(std, allElements, parents);

      // A block config chooses its own index (a frame takes the top of the
      // board, a note the transformer's): set the planned one afterwards.
      const crud = std.get(EdgelessCRUDIdentifier);
      blockIndexes.forEach((index, block) => {
        if (block.index !== index) crud.updateElement(block.id, { index });
      });
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
 * The fresh indexes of the pasted elements, by their id in the pasted data: on
 * top of the board, in the order they had where they were copied from — a
 * container before its children, and otherwise by the original index of the
 * topmost pasted ancestor (then of the next one down, then of the element
 * itself). The original indexes are recorded in `originalIndexes`.
 */
function pastedIndexes(
  std: BlockStdScope,
  elementsRawData: (SerializedElement | BlockSnapshot)[],
  parents: Map<string, string>,
  originalIndexes: Map<string, string>
) {
  for (const data of elementsRawData) {
    const index = 'flavour' in data ? data.props.index : data.index;
    if (typeof index === 'string' && !originalIndexes.has(data.id)) {
      originalIndexes.set(data.id, index);
    }
  }

  // Pasted ancestors, nearest first — the order `GfxModel.groups` uses.
  const ancestors = new Map<string, string[]>();
  for (const id of originalIndexes.keys()) {
    const chain: string[] = [];
    for (
      let parent = parents.get(id);
      parent && !chain.includes(parent);
      parent = parents.get(parent)
    ) {
      chain.push(parent);
    }
    ancestors.set(id, chain);
  }

  function compare(a: string, b: string) {
    const aGroups = ancestors.get(a) ?? [];
    const bGroups = ancestors.get(b) ?? [];

    if (bGroups.includes(a)) {
      return SortOrder.BEFORE;
    } else if (aGroups.includes(b)) {
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

    const aIndex = originalIndexes.get(aGroup ?? a);
    const bIndex = originalIndexes.get(bGroup ?? b);

    return aIndex === bIndex
      ? SortOrder.SAME
      : aIndex! < bIndex!
        ? SortOrder.BEFORE
        : SortOrder.AFTER;
  }

  const nextIndex = std
    .get(GfxControllerIdentifier)
    .layer.createIndexGenerator();
  const newIndexes = new Map<string, string>();
  [...originalIndexes.keys()].sort(compare).forEach(id => {
    newIndexes.set(id, nextIndex());
  });
  return newIndexes;
}
