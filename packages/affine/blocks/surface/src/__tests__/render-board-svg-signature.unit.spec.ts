import { FrameworkBackgroundElementModel } from '@labre/affine-model';
import type { BlockStdScope } from '@labre/std';
import { GfxPrimitiveElementModel } from '@labre/std/gfx';
import { describe, expect, expectTypeOf, test } from 'vitest';

import {
  DEFAULT_BOARD_SVG_EXPORT_OPTIONS,
  selectBoardSvgParts,
} from '../extensions/export-svg/parts.js';
import {
  type BoardSvgExport,
  renderBoardSvg,
  selectBoardElements,
} from '../extensions/export-svg/render.js';

/**
 * `renderBoardSvg(std, board)` keeps its 0.43 signature: it returns an export,
 * never `null`.
 *
 * 0.44.0 (#438) added the export options and widened the return type to
 * `BoardSvgExport | null`, for the case where the options switch off every
 * part. A host calling the 0.43 shape — `renderBoardSvg(std, board).svg` — no
 * longer compiled under `strictNullChecks` on a minor bump, which the release
 * rule forbids. This spec would have caught it: `svgOf` below is that literal
 * call, typechecked by `yarn build` (tests included) and never run.
 *
 * The no-options overload is only honest if it is TRUE at run time, so the
 * rest pins the reason: with every part on, the board is always among what
 * is drawn — `selectBoardElements` puts it back when the query missed it, and
 * the board answers to "Framework elements" — so there is always something to
 * draw. Only the overload that takes options can return `null`.
 */

/** The 0.43 call, verbatim. Compiles or the build fails; never invoked. */
const svgOf = (
  std: BlockStdScope,
  board: FrameworkBackgroundElementModel
): string => renderBoardSvg(std, board).svg;

function fakeBackground(xywh: string, role?: string) {
  const model = Object.create(FrameworkBackgroundElementModel.prototype);
  Object.defineProperty(model, 'xywh', { value: xywh });
  Object.defineProperty(model, 'role', { value: role });
  return model as FrameworkBackgroundElementModel;
}

function fakeElement(xywh: string, type: string, role?: string) {
  const model = Object.create(GfxPrimitiveElementModel.prototype);
  Object.defineProperty(model, 'xywh', { value: xywh });
  Object.defineProperty(model, 'type', { value: type });
  Object.defineProperty(model, 'role', { value: role });
  return model as GfxPrimitiveElementModel;
}

/** What `renderBoardSvg` draws with no options, minus the painting. */
const drawnWithDefaults = (
  board: FrameworkBackgroundElementModel,
  candidates: GfxPrimitiveElementModel[]
) => {
  const { elements, textBlocks } = selectBoardSvgParts(
    board,
    selectBoardElements(board, candidates),
    [],
    DEFAULT_BOARD_SVG_EXPORT_OPTIONS,
    () => []
  );
  return [...elements, ...textBlocks];
};

describe('renderBoardSvg keeps its 0.43 signature', () => {
  test('with no options it returns an export, not a maybe', () => {
    expectTypeOf(svgOf).returns.toEqualTypeOf<string>();
    expectTypeOf<
      ReturnType<typeof renderBoardSvg>
    >().toEqualTypeOf<BoardSvgExport | null>();
  });

  test('with no options the board itself is always drawn', () => {
    const board = fakeBackground('[0,0,100,100]', 'wardley:map');
    // The query found nothing at all — an empty bound, a stub.
    expect(drawnWithDefaults(board, [])).toEqual([board]);
    // The query found only what is not the board's.
    const shape = fakeElement('[10,10,5,5]', 'shape');
    expect(drawnWithDefaults(board, [shape])).toContain(board);
    // A board with no role (Cynefin) owns itself all the same.
    const roleless = fakeBackground('[0,0,100,100]');
    expect(drawnWithDefaults(roleless, [roleless])).toEqual([roleless]);
  });
});
