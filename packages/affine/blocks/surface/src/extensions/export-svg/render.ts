import { FrameworkBackgroundElementModel } from '@labre/affine-model';
import { Bound } from '@labre/global/gfx';
import type { BlockStdScope } from '@labre/std';
import {
  GfxControllerIdentifier,
  type GfxPrimitiveElementModel,
} from '@labre/std/gfx';

import type { SurfaceElementModel } from '../../element-model/base.js';
import { CanvasRenderer } from '../../renderer/canvas-renderer.js';
import { RoughCanvas } from '../../utils/rough/canvas.js';
import { createSvgContext, runWithRecordingPath2D } from './svg-context.js';

export interface BoardSvgExport {
  /** A standalone SVG document. */
  svg: string;
  /** The world-space rectangle the document covers. */
  bound: Bound;
}

/**
 * The canvas elements that make up `board`'s picture, in paint order.
 *
 * `candidates` comes from a bound query, so it also holds whatever a NEIGHBOUR
 * board happens to overlap with. Another framework background is kept only
 * when its frame lies ENTIRELY inside the exported one (edges may touch): that
 * is a nested frame — a UML subject, partition, region or fragment inside its
 * diagram frame, a C4 boundary inside a C4 board — and it is part of the
 * picture. One that merely overlaps is a neighbour and is dropped: without
 * that, a map sitting next to this one would paint its whole frame into this
 * file. So is one that ENCLOSES the board, the diagram frame around an
 * exported partition. Non-background elements are kept whoever owns them — an
 * element inside the exported frame belongs to the picture.
 *
 * Containment is read on the stored `xywh`, the same rectangle
 * {@link exportBoundOf} starts from; a background at exactly the board's own
 * rectangle therefore counts as nested.
 */
export function selectBoardElements<T extends GfxPrimitiveElementModel>(
  board: FrameworkBackgroundElementModel,
  candidates: readonly T[]
): (FrameworkBackgroundElementModel | T)[] {
  const frame = Bound.deserialize(board.xywh);
  const kept = candidates.filter(
    element =>
      element === (board as unknown as T) ||
      !(element instanceof FrameworkBackgroundElementModel) ||
      frame.contains(Bound.deserialize(element.xywh))
  );
  // A background paints under everything, so a board missing from the query
  // (an empty bound, a stub) goes in front of the list, not at the end.
  return kept.some(element => element === (board as unknown as T))
    ? kept
    : [board, ...kept];
}

/**
 * The board's frame, widened to the union of what is painted on it: a Wardley
 * label overhanging the right edge, or a connector ending just outside, is part
 * of the picture and must not be cut off.
 */
export function exportBoundOf(
  board: FrameworkBackgroundElementModel,
  elements: readonly GfxPrimitiveElementModel[]
): Bound {
  let bound = Bound.deserialize(board.xywh);
  for (const element of elements) {
    bound = bound.unite(Bound.deserialize(element.xywh));
  }
  return bound;
}

/**
 * The selected board and everything painted within its frame, as an SVG
 * document — a true vector export, produced by replaying the very element
 * renderers the canvas uses into an SVG-emitting 2D context.
 */
export function renderBoardSvg(
  std: BlockStdScope,
  board: FrameworkBackgroundElementModel
): BoardSvgExport {
  const gfx = std.get(GfxControllerIdentifier);
  const renderer = (
    gfx.surfaceComponent as { renderer?: unknown } | null | undefined
  )?.renderer;

  if (!(renderer instanceof CanvasRenderer)) {
    throw new Error(
      'SVG export needs the surface to be painted by a CanvasRenderer.'
    );
  }

  // Already sorted by `layer.compare`, which is the canvas' own z-order.
  const candidates = gfx.getElementsByBound(Bound.deserialize(board.xywh), {
    type: 'canvas',
  });
  const elements = selectBoardElements(board, candidates);
  const bound = exportBoundOf(board, elements);

  return runWithRecordingPath2D(() => {
    const { ctx, canvas, serialize } = createSvgContext(bound.w, bound.h);
    renderer.renderBoundTo(
      ctx,
      new RoughCanvas(canvas),
      bound,
      elements as SurfaceElementModel[]
    );
    return { svg: serialize(), bound };
  });
}
