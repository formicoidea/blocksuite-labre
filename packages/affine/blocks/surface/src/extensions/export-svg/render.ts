import { FrameworkBackgroundElementModel } from '@labre/affine-model';
import { createIdentifier } from '@labre/global/di';
import { Bound } from '@labre/global/gfx';
import type { BlockStdScope } from '@labre/std';
import {
  type GfxBlockElementModel,
  GfxControllerIdentifier,
  type GfxPrimitiveElementModel,
} from '@labre/std/gfx';
import type { ExtensionType } from '@labre/store';

import type { SurfaceElementModel } from '../../element-model/base.js';
import { CanvasRenderer } from '../../renderer/canvas-renderer.js';
import { RoughCanvas } from '../../utils/rough/canvas.js';
import {
  type BoardSvgExportOptions,
  DEFAULT_BOARD_SVG_EXPORT_OPTIONS,
  selectBoardSvgParts,
} from './parts.js';
import { createSvgContext, runWithRecordingPath2D } from './svg-context.js';

export interface BoardSvgExport {
  /** A standalone SVG document. */
  svg: string;
  /** The world-space rectangle the document covers. */
  bound: Bound;
}

/**
 * How a BLOCK paints itself into the export's 2D context, in model units, the
 * block's top-left at the origin of `matrix`.
 *
 * Blocks are DOM, so the canvas renderer never sees them (ADR 0025,
 * Consequences). The one block the export draws anyway is the edgeless text —
 * what the text tool creates by default — and its painter lives with it, in
 * `@labre/affine-block-edgeless-text`, because the text metrics it needs
 * (`@labre/affine-gfx-text`) sit ABOVE this package. Keyed by flavour; a block
 * with no painter registered is simply not drawn.
 */
export type BlockSvgPainter<
  T extends GfxBlockElementModel = GfxBlockElementModel,
> = (
  model: T,
  ctx: CanvasRenderingContext2D,
  matrix: DOMMatrix,
  renderer: CanvasRenderer
) => void;

export const BlockSvgPainterIdentifier =
  createIdentifier<BlockSvgPainter>('block-svg-painter');

export function BlockSvgPainterExtension<T extends GfxBlockElementModel>(
  flavour: string,
  painter: BlockSvgPainter<T>
): ExtensionType {
  return {
    setup: di => {
      di.addImpl(
        BlockSvgPainterIdentifier(flavour),
        () => painter as BlockSvgPainter
      );
    },
  };
}

/** The blocks the export redraws, all of them "other texts" (`parts.ts`). */
const SVG_TEXT_BLOCK_FLAVOURS: readonly string[] = ['affine:edgeless-text'];

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
 * The frame, widened to the union of what is painted: a Wardley label
 * overhanging the right edge, or a connector ending just outside, is part of
 * the picture and must not be cut off. The frame is the board's — or, with
 * "Framework elements" switched off, the first thing still drawn.
 */
export function exportBoundOf(
  frame: { readonly xywh: string },
  elements: readonly { readonly xywh: string }[]
): Bound {
  let bound = Bound.deserialize(frame.xywh);
  for (const element of elements) {
    bound = bound.unite(Bound.deserialize(element.xywh));
  }
  return bound;
}

/**
 * The selected board and everything painted within its frame, as an SVG
 * document — a true vector export, produced by replaying the very element
 * renderers the canvas uses into an SVG-emitting 2D context.
 *
 * `options` says which parts are drawn (`parts.ts`). `null` when they leave
 * nothing to draw: an empty file is not a picture of anything.
 *
 * Without `options` every part is drawn, the board among them, so the 0.43
 * call shape `renderBoardSvg(std, board).svg` keeps its non-null return
 * (`render-board-svg-signature.unit.spec.ts`). Only the overload that takes
 * options can answer `null`.
 */
export function renderBoardSvg(
  std: BlockStdScope,
  board: FrameworkBackgroundElementModel
): BoardSvgExport;
export function renderBoardSvg(
  std: BlockStdScope,
  board: FrameworkBackgroundElementModel,
  options: Readonly<BoardSvgExportOptions>
): BoardSvgExport | null;
export function renderBoardSvg(
  std: BlockStdScope,
  board: FrameworkBackgroundElementModel,
  given?: Readonly<BoardSvgExportOptions>
): BoardSvgExport | null {
  const options = given ?? DEFAULT_BOARD_SVG_EXPORT_OPTIONS;
  const gfx = std.get(GfxControllerIdentifier);
  const renderer = (
    gfx.surfaceComponent as { renderer?: unknown } | null | undefined
  )?.renderer;

  if (!(renderer instanceof CanvasRenderer)) {
    throw new Error(
      'SVG export needs the surface to be painted by a CanvasRenderer.'
    );
  }

  const frame = Bound.deserialize(board.xywh);
  // Already sorted by `layer.compare`, which is the canvas' own z-order.
  // What you see is what you export (ADR 0031): what this viewer hid is
  // neither painted nor allowed to widen the picture. The board itself stays,
  // it is the sheet being exported.
  const candidates = gfx
    .getElementsByBound(frame, { type: 'canvas' })
    .filter(
      element =>
        element === (board as unknown) || !gfx.localVisibility.isHidden(element)
    );
  const textBlocks = gfx
    .getElementsByBound(frame, { type: 'block' })
    .filter(
      block =>
        SVG_TEXT_BLOCK_FLAVOURS.includes(block.flavour) &&
        !gfx.localVisibility.isHidden(block)
    );
  const { elements, textBlocks: texts } = selectBoardSvgParts(
    board,
    selectBoardElements(board, candidates),
    textBlocks,
    options,
    element => element.groups
  );

  const drawn = [...elements, ...texts];
  if (!drawn.length) {
    // Unreachable without options: the board is always selected and answers
    // to "Framework elements". Thrown rather than returned, so the overload
    // that promises an export never hands back `null`.
    if (given === undefined) {
      throw new Error(
        'SVG export drew nothing with every part on: the board itself was not selected.'
      );
    }
    return null;
  }
  const bound = exportBoundOf(options.framework ? board : drawn[0], drawn);

  return runWithRecordingPath2D(() => {
    const { ctx, canvas, serialize, markRoot, markedGroup } = createSvgContext(
      bound.w,
      bound.h
    );
    const rc = new RoughCanvas(canvas);
    markRoot();
    // One model per pass, each inside a group carrying its markers (ADR 0032
    // §6), in the canvas' own z-order: a text block is painted at its layer
    // index, between the elements it sits between on screen.
    const blocks = new Set<unknown>(texts);
    for (const model of [...elements, ...texts].sort(gfx.layer.compare)) {
      if (!blocks.has(model)) {
        const element = model as SurfaceElementModel;
        markedGroup(boardSvgMarkers(element, bound), () =>
          renderer.renderBoundTo(ctx, rc, bound, [element])
        );
        continue;
      }
      const block = model as GfxBlockElementModel;
      const paint = std.getOptional(BlockSvgPainterIdentifier(block.flavour));
      if (!paint) continue;
      markedGroup(boardSvgMarkers(block, bound), () => {
        ctx.save();
        paint(
          block,
          ctx,
          new DOMMatrix().translate(block.x - bound.x, block.y - bound.y),
          renderer
        );
        ctx.restore();
      });
    }
    return { svg: serialize(), bound };
  });
}

/**
 * What an element's group says about it in the file (ADR 0032 §6): its id, its
 * type, its role, its stored bound in the FILE's coordinates, the two ends of
 * a connector and the group it belongs to — base-class fields only, so every
 * board's SVG carries them and no framework is named here.
 *
 * Ids and vocabulary, never prose: no `pivotDocId` (its contract forbids an
 * exporter to read it), no `interchange`, no tag, no link, no text — a name is
 * read back from the `<text>` the renderer already drew.
 */
export function boardSvgMarkers(
  element: {
    id: string;
    xywh: string;
    type?: string;
    flavour?: string;
    role?: string;
    group?: { id: string } | null;
    source?: { id?: string } | null;
    target?: { id?: string } | null;
  },
  bound: Bound
): Record<string, string> {
  const own = Bound.deserialize(element.xywh);
  const markers: Record<string, string> = {
    'data-labre-id': element.id,
    'data-labre-type': element.type ?? element.flavour ?? '',
    'data-labre-xywh': JSON.stringify([
      own.x - bound.x,
      own.y - bound.y,
      own.w,
      own.h,
    ]),
  };
  if (element.role) markers['data-labre-role'] = element.role;
  if (element.source?.id) markers['data-labre-source'] = element.source.id;
  if (element.target?.id) markers['data-labre-target'] = element.target.id;
  if (element.group?.id) markers['data-labre-group'] = element.group.id;
  return markers;
}
