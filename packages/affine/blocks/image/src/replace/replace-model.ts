import {
  applyCreationLayer,
  reassociateConnectors,
  sourceLayerOf,
  type SurfaceBlockModel,
} from '@labre/affine-block-surface';
import {
  AttachmentBlockModel,
  AttachmentBlockSchema,
  ImageBlockModel,
  ImageBlockSchema,
  MindmapElementModel,
  ShapeElementModel,
  ShapeType,
} from '@labre/affine-model';
import { withHtmlDefaultView } from '@labre/affine-shared/services';
import { Bound } from '@labre/global/gfx';
import { BlockSelection, type BlockStdScope } from '@labre/std';
import { GfxControllerIdentifier, type GfxModel } from '@labre/std/gfx';

import {
  pickReplacement,
  type ReplacementAnswer,
  replaceImageSource,
} from '../asset-picker.js';
import type { ImageBlockSource } from '../utils.js';
import {
  type Box,
  cardStyleFor,
  cropToBox,
  displayedBox,
  pageImageProps,
} from './frame.js';

export { cropToBox } from './frame.js';

/** A block « Replace » may swap for something else. */
export type ReplaceableBlock = ImageBlockModel | AttachmentBlockModel;

/**
 * « Replace » across kinds (ADR 0044 and its amendments): a model of the other
 * kind at the old one's place, then the old one deleted. A shape is a surface
 * ELEMENT, an image and an attachment are BLOCKS of two flavours, so this is not a
 * morph: the id changes, on purpose. One way in, whatever the pair:
 * {@link replaceWithAnswer} for what a person chose, {@link replaceBlockWithShape}
 * for a shape.
 *
 * What crosses over, in ONE undo step (one `captureSync`): `xywh`,
 * `rotate`, `index`, the user layer (`sourceLayerOf`, ADR 0031 §6), every
 * connector end bound to the old id, and the old model's place in its group
 * or frame. Nothing is written when the gesture is refused, so a refusal
 * never leaves an empty undo step.
 */

function surfaceOf(std: BlockStdScope): SurfaceBlockModel | null {
  return (std.get(GfxControllerIdentifier).surface ??
    null) as SurfaceBlockModel | null;
}

/**
 * Whether a shape may be replaced by an image. Refused: a read-only store, a
 * locked shape, a NOTATION shape (it carries a role its framework reads), a
 * shape with text (v1 never drops what the author typed) and a mind-map node
 * (the mind map owns its tree).
 */
export function canReplaceShapeWithImage(
  std: BlockStdScope,
  shape: unknown
): shape is ShapeElementModel {
  if (std.store.readonly) return false;
  if (!(shape instanceof ShapeElementModel)) return false;
  if (shape.isLocked()) return false;
  if (shape.role !== undefined) return false;
  if ((shape.text?.length ?? 0) > 0) return false;
  if (shape.group instanceof MindmapElementModel) return false;
  return true;
}

/**
 * Whether a canvas block may be replaced by a shape. Refused: a read-only store, a
 * block that is not on the canvas, a locked one, and one with a caption or comments
 * (a shape holds neither, and the gesture never drops what the author wrote).
 */
export function canReplaceBlockWithShape(
  std: BlockStdScope,
  block: ReplaceableBlock | null | undefined
): block is ReplaceableBlock {
  if (std.store.readonly || !block) return false;
  if (block.parent?.flavour !== 'affine:surface') return false;
  if (block.isLocked()) return false;
  if (block.props.caption) return false;
  if (Object.keys(block.props.comments ?? {}).length > 0) return false;
  return true;
}

export function canReplaceImageWithShape(
  std: BlockStdScope,
  image: ImageBlockModel | null | undefined
): image is ImageBlockModel {
  return (
    image?.flavour === ImageBlockSchema.model.flavour &&
    canReplaceBlockWithShape(std, image)
  );
}

/**
 * Move `oldModel`'s connectors and container membership onto `newModel`,
 * then delete `oldModel`. Runs inside the caller's transaction. The new
 * model joins the container BEFORE the old one leaves it, so a group is never
 * seen empty.
 */
function handOver(
  std: BlockStdScope,
  surface: SurfaceBlockModel,
  oldModel: GfxModel,
  newModel: GfxModel
) {
  reassociateConnectors(surface, oldModel.id, newModel.id);
  const container = oldModel.group;
  if (container) {
    container.addChild(newModel);
    // oxlint-disable-next-line unicorn/prefer-dom-node-remove
    container.removeChild(oldModel);
  }
  if (surface.hasElementById(oldModel.id)) {
    surface.deleteElement(oldModel.id);
  } else {
    std.store.deleteBlock(oldModel as ReplaceableBlock);
  }
}

/** What a block of another kind inherits: a shape holds neither. */
function carriedOver(old: GfxModel | ReplaceableBlock) {
  if (old instanceof ShapeElementModel) return {};
  const { caption, comments } = (old as ReplaceableBlock).props;
  return {
    ...(caption ? { caption } : {}),
    ...(Object.keys(comments ?? {}).length > 0
      ? { comments: { ...comments } }
      : {}),
  };
}

/** A block of the answer's flavour, on a canvas: a picture cut to the box. */
function canvasProps(
  std: BlockStdScope,
  answer: ReplacementAnswer,
  box: Box
): { flavour: string; props: Record<string, unknown> } {
  if (answer.kind === 'image') {
    const { sourceId, size, width, height } = answer.source;
    return {
      flavour: ImageBlockSchema.model.flavour,
      // On the canvas `width`/`height` are the WHOLE picture's natural size
      // and `xywh` the visible box (ADR 0037).
      props: {
        sourceId,
        size,
        width,
        height,
        ...cropToBox(box, answer.source),
      },
    };
  }
  return {
    flavour: AttachmentBlockSchema.model.flavour,
    props: {
      style: cardStyleFor(box),
      ...withHtmlDefaultView(std, answer.source),
    },
  };
}

/**
 * The same, in a page. A picture takes the frame; a file takes the column, its card
 * having no width of its own, and an html view takes the frame's height.
 */
function pageProps(
  std: BlockStdScope,
  answer: ReplacementAnswer,
  box: Box | null
): { flavour: string; props: Record<string, unknown> } {
  if (answer.kind === 'image') {
    const { sourceId, size } = answer.source;
    return {
      flavour: ImageBlockSchema.model.flavour,
      props: {
        sourceId,
        size,
        ...(box ? pageImageProps(box, answer.source) : {}),
      },
    };
  }
  const viewed = withHtmlDefaultView(std, answer.source);
  return {
    flavour: AttachmentBlockSchema.model.flavour,
    props: {
      ...viewed,
      ...('embed' in viewed && box
        ? { xywh: new Bound(0, 0, box.w, box.h).serialize() }
        : {}),
    },
  };
}

/** At the old model's place on the canvas: `xywh`, `rotate`, `index`, layer. */
function placeOnCanvas(
  std: BlockStdScope,
  surface: SurfaceBlockModel,
  old: GfxModel,
  { flavour, props }: { flavour: string; props: Record<string, unknown> }
): string | null {
  const placed: Record<string, unknown> = {
    ...props,
    ...carriedOver(old),
    xywh: old.xywh,
    rotate: old.rotate ?? 0,
    index: old.index,
    layer: sourceLayerOf(old),
  };
  applyCreationLayer(std, placed);

  const { store } = std;
  store.captureSync();
  // The block is created OUTSIDE the hand-over's transaction: a block added
  // inside one has no model until it ends, and the container needs the
  // model. Both writes land in the undo step `captureSync` just opened.
  const id = store.addBlock(flavour, placed, surface);
  const created = store.getModelById(id) as GfxModel | null;
  if (created) store.transact(() => handOver(std, surface, old, created));
  return id;
}

/** At the old block's place in its note, and selected in its stead. */
function placeInPage(
  std: BlockStdScope,
  old: ReplaceableBlock,
  { flavour, props }: { flavour: string; props: Record<string, unknown> }
): string | null {
  const { store } = std;
  const { parent } = old;
  if (!parent) return null;
  let id = '';
  store.captureSync();
  store.transact(() => {
    id = store.addBlock(
      flavour,
      { ...props, ...carriedOver(old) },
      parent,
      parent.children.indexOf(old)
    );
    store.deleteBlock(old);
  });
  const { selection } = std;
  selection.setGroup('note', [
    selection.create(BlockSelection, { blockId: id }),
  ]);
  return id;
}

/**
 * THE way to put what a person chose in place of an element (ADR 0044, amendment of
 * 2026-11-04). The frame stays: `xywh` on the canvas, the displayed size in a page.
 * Another picture stays in the same image block; another file in the same attachment
 * is the attachment package's (`replaceAttachmentFile`), which knows how a file is
 * shown. Answers the id of what now stands there, or `null` when nothing was written.
 */
export function replaceWithAnswer(
  std: BlockStdScope,
  old: ShapeElementModel | ReplaceableBlock,
  answer: ReplacementAnswer
): string | null {
  if (std.store.readonly) return null;
  if (old instanceof ShapeElementModel) {
    const surface = surfaceOf(std);
    if (!surface || !canReplaceShapeWithImage(std, old)) return null;
    if (!surface.hasElementById(old.id)) return null;
    return placeOnCanvas(
      std,
      surface,
      old,
      canvasProps(std, answer, Bound.deserialize(old.xywh))
    );
  }
  if (!std.store.getBlock(old.id)) return null;
  const onCanvas = old.parent?.flavour === 'affine:surface';
  if (onCanvas && old.isLocked()) return null;
  if (answer.kind === 'image' && old instanceof ImageBlockModel) {
    return replaceImageSource(old, answer.source, displayedBox(std, old))
      ? old.id
      : null;
  }
  if (answer.kind === 'file' && old instanceof AttachmentBlockModel) {
    return null;
  }
  if (!onCanvas) {
    return placeInPage(
      std,
      old,
      pageProps(std, answer, displayedBox(std, old))
    );
  }
  const surface = surfaceOf(std);
  return surface
    ? placeOnCanvas(
        std,
        surface,
        old,
        canvasProps(std, answer, Bound.deserialize(old.xywh))
      )
    : null;
}

/**
 * Put `image` in place of `shape`, cut to the shape's box. Answers the new
 * image block's id, or `null` when the gesture is refused (nothing written).
 */
export function replaceShapeWithImage(
  std: BlockStdScope,
  shape: ShapeElementModel,
  image: ImageBlockSource
): string | null {
  if (!image.sourceId || !(image.width > 0 && image.height > 0)) return null;
  return replaceWithAnswer(std, shape, { kind: 'image', source: image });
}

/**
 * The page toolbar's "Replace" on an image: the dialog, then the block as it is AFTER
 * it (it may be gone, or the document read-only, by then).
 */
export async function pickAndReplaceImage(
  std: BlockStdScope,
  model: ImageBlockModel
): Promise<boolean> {
  if (model.store.readonly) return false;
  const answer = await pickReplacement(std, 'image');
  if (!answer) return false;
  return replaceWithAnswer(std, model, answer) !== null;
}

/** Which shape takes the image's place: a rectangle unless told otherwise. */
export type ReplacementShape = {
  shapeType?: ShapeType;
  /** The corner radius, a fraction of the box (the rounded rectangle's 0.1). */
  radius?: number;
};

/**
 * Put a shape in place of a canvas block — a rectangle by default, or the
 * `shapeType` and `radius` picked in « Replace with shape » (ADR 0044,
 * amendment of 2026-10-27) — at its box, rotation, depth and layer.
 * The blob stays in the asset store (undo brings the block back, and other
 * pages may show it). Answers the new shape's id, or `null` when refused.
 */
export function replaceBlockWithShape(
  std: BlockStdScope,
  image: ReplaceableBlock,
  shape: ReplacementShape = {}
): string | null {
  const surface = surfaceOf(std);
  if (!surface || !canReplaceBlockWithShape(std, image)) return null;
  if (!std.store.getBlock(image.id)) return null;

  const props: Record<string, unknown> = {
    type: 'shape',
    shapeType: shape.shapeType ?? ShapeType.Rect,
    radius: shape.radius ?? 0,
    xywh: image.xywh,
    rotate: image.props.rotate ?? 0,
    index: image.index,
    layer: sourceLayerOf(image),
  };
  // The surface's `beforeAdd` middleware stamps the layer too; resolving it
  // here keeps the rule when no middleware is mounted.
  applyCreationLayer(std, props);

  const { store } = std;
  let id: string | null = null;
  store.captureSync();
  store.transact(() => {
    id = surface.addElement(props as { type: string });
    const created = surface.getElementById(id);
    if (created) handOver(std, surface, image, created);
  });
  return id;
}

export const replaceImageWithShape = replaceBlockWithShape;
