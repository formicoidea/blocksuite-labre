import {
  applyCreationLayer,
  reassociateConnectors,
  sourceLayerOf,
  type SurfaceBlockModel,
} from '@labre/affine-block-surface';
import {
  type ImageBlockModel,
  type ImageBlockProps,
  ImageBlockSchema,
  isWholeImage,
  MindmapElementModel,
  ShapeElementModel,
  ShapeType,
} from '@labre/affine-model';
import { Bound } from '@labre/global/gfx';
import type { BlockStdScope } from '@labre/std';
import { GfxControllerIdentifier, type GfxModel } from '@labre/std/gfx';

import { ratioCrop } from '../crop/crop-math.js';
import type { ImageBlockSource } from '../utils.js';

/**
 * « Replace with image » and « Replace with shape » (ADR 0044): a model of
 * the other kind at the old one's place, then the old one deleted. A shape is
 * a surface ELEMENT and an image a BLOCK, so this is not a morph: the id
 * changes, on purpose.
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
 * Whether a canvas image may be replaced by a shape. Refused: a read-only
 * store, an image that is not on the canvas, a locked image, and one with a
 * caption or comments (v1 never drops what the author wrote).
 */
export function canReplaceImageWithShape(
  std: BlockStdScope,
  image: ImageBlockModel | null | undefined
): image is ImageBlockModel {
  if (std.store.readonly || !image) return false;
  if (image.flavour !== ImageBlockSchema.model.flavour) return false;
  if (image.parent?.flavour !== 'affine:surface') return false;
  if (image.isLocked()) return false;
  if (image.props.caption) return false;
  if (Object.keys(image.props.comments ?? {}).length > 0) return false;
  return true;
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
    std.store.deleteBlock(oldModel as ImageBlockModel);
  }
}

/**
 * The crop that cuts `image` to the proportions of `box`, as stored props:
 * nothing when the picture already has them (the whole image is the absent
 * key, ADR 0037).
 */
export function cropToBox(
  box: { w: number; h: number },
  image: Pick<ImageBlockSource, 'width' | 'height'>
): Pick<ImageBlockProps, 'crop'> {
  if (!(box.w > 0 && box.h > 0)) return {};
  const rect = ratioCrop(box.w / box.h, image.width, image.height);
  return isWholeImage(rect) ? {} : { crop: rect };
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
  const surface = surfaceOf(std);
  if (!surface || !canReplaceShapeWithImage(std, shape)) return null;
  if (!surface.hasElementById(shape.id)) return null;
  if (!image.sourceId || !(image.width > 0 && image.height > 0)) return null;

  const bound = Bound.deserialize(shape.xywh);
  const props: Record<string, unknown> = {
    sourceId: image.sourceId,
    size: image.size,
    // On the canvas `width`/`height` are the WHOLE picture's natural size
    // and `xywh` the visible box (ADR 0037).
    width: image.width,
    height: image.height,
    xywh: shape.xywh,
    rotate: shape.rotate ?? 0,
    index: shape.index,
    layer: sourceLayerOf(shape),
    ...cropToBox(bound, image),
  };
  applyCreationLayer(std, props);

  const { store } = std;
  store.captureSync();
  // The block is created OUTSIDE the hand-over's transaction: a block added
  // inside one has no model until it ends, and the container needs the
  // model. Both writes land in the undo step `captureSync` just opened.
  const id = store.addBlock(ImageBlockSchema.model.flavour, props, surface);
  const created = store.getModelById(id) as ImageBlockModel | null;
  if (created) store.transact(() => handOver(std, surface, shape, created));
  return id;
}

/**
 * Put a rectangle in place of `image`, at its box, rotation, depth and layer.
 * The blob stays in the asset store (undo brings the image back, and other
 * pages may show it). Answers the new shape's id, or `null` when refused.
 */
export function replaceImageWithShape(
  std: BlockStdScope,
  image: ImageBlockModel
): string | null {
  const surface = surfaceOf(std);
  if (!surface || !canReplaceImageWithShape(std, image)) return null;
  if (!std.store.getBlock(image.id)) return null;

  const props: Record<string, unknown> = {
    type: 'shape',
    shapeType: ShapeType.Rect,
    radius: 0,
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
