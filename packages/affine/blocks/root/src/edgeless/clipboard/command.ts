import { isFrameBlock } from '@labre/affine-block-frame';
import {
  type ClipboardConfigCreationContext,
  EdgelessClipboardConfigIdentifier,
  EdgelessCRUDIdentifier,
  type PreparedClipboardBlock,
  resolveCreationLayer,
  writeModelLayer,
} from '@labre/affine-block-surface';
import { Bound, type IVec, type SerializedXYWH } from '@labre/global/gfx';
import { assertType } from '@labre/global/utils';
import type { BlockStdScope, Command } from '@labre/std';
import {
  DEFAULT_LAYER_ID,
  type GfxBlockElementModel,
  type GfxCompatibleProps,
  GfxControllerIdentifier,
  type GfxModel,
  type GfxPrimitiveElementModel,
  ownLayerOf,
  type SerializedElement,
} from '@labre/std/gfx';
import { type BlockSnapshot, BlockSnapshotSchema } from '@labre/store';

import { createCanvasElement } from './canvas';
import { pastedIndexes, pastedParentage } from './paste-order.js';
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
    // The paste prepares first and writes afterwards (ADR 0042). Phase A
    // awaits every block config's `prepare` (blob fetches, snapshot
    // conversions) and writes nothing. Then two synchronous transactions back
    // to back, after one `captureSync`: the first writes every canvas element
    // and every block in the pasted order (a frame's `childElementIds` and a
    // group's `children` name copies written before them), the second runs
    // what needs the models, which the store creates only when the first
    // ends — import middlewares, final indexes, layers, frame release. One
    // undo step whatever the blob fetch took, and two updates for a peer.
    // ponytail: a host config still on an async `createBlock` (the default
    // `prepare`) writes after both and may cost its own undo step, and a
    // container pasted with it misses that child; the writes run on the main
    // thread in one go, so a note of thousands of blocks blocks it while it
    // is written — split it into its own transactions if that ever shows.
    type PastedBlock = {
      oldId: string;
      prepared: PreparedClipboardBlock;
      requested: BlockRequest;
    };
    type Written = PastedBlock & { newId: string };
    const items: ({ element: SerializedElement } | PastedBlock)[] = [];
    const seen = new Set<string>();

    // Phase A: prepare, write nothing.
    for (const data of elementsRawData) {
      // Clipboard data written before `sortEdgelessElements` deduplicated can
      // list one element twice; the first copy is the one its container maps.
      if (seen.has(data.id)) continue;
      seen.add(data.id);

      const { data: blockSnapshot } = BlockSnapshotSchema.safeParse(data);
      if (!blockSnapshot) {
        assertType<SerializedElement>(data);
        items.push({ element: data });
        continue;
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

      const requested: BlockRequest = {
        layer: blockSnapshot.props.layer,
        hiddenForEveryone: blockSnapshot.props.hiddenForEveryone,
      };
      const prepared = await config.prepare(blockSnapshot, context);
      if (!prepared) continue;
      items.push({ oldId, prepared, requested });
    }

    // The preparation awaited: the document may have turned readonly since.
    if (std.store.readonly) return { canvasElements, blockModels };

    const written: Written[] = [];
    const legacy: { block: PastedBlock; id: Promise<string | null> }[] = [];

    // One gesture, one undo step: close whatever the previous gesture left
    // open in the undo manager's capture window. Taken after the preparation,
    // so its duration no longer matters.
    std.store.captureSync();

    std.store.transact(() => {
      for (const item of items) {
        if ('element' in item) {
          const data = item.element;
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
          continue;
        }

        let newId: string | null | Promise<string | null> = null;
        try {
          newId = item.prepared.write();
        } catch (error) {
          console.error(`Failed to paste block(id: ${item.oldId})`, error);
          continue;
        }
        if (newId instanceof Promise) {
          legacy.push({ block: item, id: newId });
          continue;
        }
        if (!newId) continue;
        context.oldToNewIdMap.set(item.oldId, newId);
        written.push({ ...item, newId });
      }
    });

    const parents = new Map<string, string>();
    const finish = (blocks: Written[]) => {
      blocks.forEach(({ prepared }) => prepared.afterWrite?.());

      const crud = std.get(EdgelessCRUDIdentifier);
      for (const { oldId, newId, requested } of blocks) {
        const block = std.store.getBlock(newId);
        if (!block) continue;

        assertType<GfxBlockElementModel>(block.model);
        blockModels.push(block.model);
        allElements.push(block.model);

        // A block config chooses its own index (a frame takes the top of the
        // board, a note the transformer's): set the planned one afterwards.
        const index = newIndexes.get(oldId);
        if (index && block.model.index !== index) {
          crud.updateElement(block.model.id, { index });
        }
        keepSourceLayerAndHide(std, block.model, requested);
      }

      oldParents.forEach((oldParent, oldChild) => {
        const child = context.oldToNewIdMap.get(oldChild);
        const parent = context.oldToNewIdMap.get(oldParent);
        if (child && parent) parents.set(child, parent);
      });
      releaseChildrenFromAdoptingFrames(std, allElements, parents);
    };

    std.store.transact(() => finish(written));

    if (legacy.length > 0) {
      console.warn(
        'EdgelessClipboardConfig: an async createBlock wrote after the paste; implement prepare() to keep the paste one undo step (ADR 0042).'
      );
      const late: Written[] = [];
      for (const { block, id } of legacy) {
        const newId = await id;
        if (!newId) continue;
        context.oldToNewIdMap.set(block.oldId, newId);
        late.push({ ...block, newId });
      }
      if (!std.store.readonly) std.store.transact(() => finish(late));
    }

    return {
      canvasElements: canvasElements,
      blockModels: blockModels,
    };
  };

  return next({
    createdElementsPromise: runner(),
  });
};

type BlockRequest = { layer: unknown; hiddenForEveryone: unknown };

/**
 * A pasted or duplicated block gets what a pasted element gets from
 * `crud.addElement`, which forwards every serialized prop (ADR 0031 §6 and
 * "What stays loadable"): its `layer` when it names a layer of this surface,
 * else the active one, and its `hiddenForEveryone`. Most
 * `EdgelessClipboardConfig.prepare` rebuild the block from a handful of
 * the snapshot's props (frame, image, attachment, bookmark, the embeds…), so
 * a duplicate fell in the active layer and came back visible. The rule is
 * applied once here, for every config, rather than in each of them; nothing
 * is written when the config already carried both.
 *
 * `requested` is read BEFORE `prepare`: the snapshot-pasting configs
 * stamp `snapshot.props` in place, and an explicit default-layer request from
 * a clone gesture (`prepareCloneData`) is gone from it afterwards. Called
 * inside the paste's second transaction, beside the index fix-ups, so it adds
 * no update of its own.
 */
function keepSourceLayerAndHide(
  std: BlockStdScope,
  model: GfxBlockElementModel,
  requested: BlockRequest
) {
  const layer = resolveCreationLayer(std, requested.layer) ?? DEFAULT_LAYER_ID;
  if (layer !== (ownLayerOf(model) ?? DEFAULT_LAYER_ID)) {
    writeModelLayer(std, model, layer);
  }
  if (
    requested.hiddenForEveryone === true &&
    (model.props as { hiddenForEveryone?: true }).hiddenForEveryone !== true
  ) {
    std.store.updateBlock(model, { hiddenForEveryone: true });
  }
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
