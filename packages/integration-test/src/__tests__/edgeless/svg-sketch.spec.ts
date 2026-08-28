import type { EdgelessRootBlockComponent } from '@labre/affine/blocks/root';
import {
  importInterchangeFile,
  parseSvgSketch,
} from '@labre/affine/blocks/surface';
// Straight off the framework packages, as the BPMN spec already reaches for
// theirs: `@labre/affine` re-exports the blocks, not the framework modules.
import { BPMN_SVG_IMPORT } from '@labre/affine-gfx-bpmn';
import { WARDLEY_SVG_IMPORT } from '@labre/affine-gfx-wardley';
import {
  BrushElementModel,
  ShapeElementModel,
  TextElementModel,
} from '@labre/affine/model';
import { beforeEach, describe, expect, test } from 'vitest';

import { wait } from '../utils/common.js';
import { getDocRootBlock, getSurface } from '../utils/edgeless.js';
import { setupEditor } from '../utils/setup.js';

/**
 * The SVG sketch import, in a real browser (`docs/adr/0012`, P2).
 *
 * Three things can only be proved here, and each of them is a claim the unit
 * spec is structurally unable to make.
 *
 * **The brush geometry.** `BrushElementModel` declares `points` with a
 * `@convert` that re-bases them onto a bound INFLATED BY `lineWidth`, and a
 * `@derive` that writes `xywh` from the same arithmetic. `surface.addElement`
 * copies props onto the model in `Object.keys` order, so the reader's literal
 * has to assign `lineWidth` BEFORE `points` or every stroke lands with a box
 * computed against the model's default width of 4. A unit test over plain props
 * cannot see that — the props are correct either way, and only the model
 * disagrees — so this is the test that pins the key order the reader's own
 * documentation names.
 *
 * **That a label is really editable.** The tier's one unqualified promise is
 * that `<text>` arrives as free text somebody can put a caret in. A plain
 * string in a props bag is not that; a `TextElementModel` carrying a `Y.Text`
 * is, and only the store can produce one.
 *
 * **That the shipped path is the tested path.** This drives
 * `importInterchangeFile` — the picker-free half of the seam — over a real
 * `File`, which is the exact code the catalogue entry runs once the dialog has
 * closed. What chromium proves and what a user reaches are the same lines.
 */
describe('the SVG sketch import, end to end', () => {
  let edgeless!: EdgelessRootBlockComponent;

  beforeEach(async () => {
    const cleanup = await setupEditor('edgeless');
    edgeless = getDocRootBlock(window.doc, window.editor, 'edgeless');
    return cleanup;
  });

  /**
   * A fragment with one of everything the geometry assertions need: a stroke
   * whose box is arithmetic rather than a guess, a filled rounded box, and a
   * label.
   */
  const FIXTURE = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 300">
    <rect x="180" y="80" width="100" height="80" rx="10" fill="#ffffff" stroke="#22242a" stroke-width="2"/>
    <text x="230" y="125" font-size="12" text-anchor="middle">Check order</text>
    <line x1="100" y1="100" x2="200" y2="100" stroke="#22242a" stroke-width="2"/>
  </svg>`;

  const importFixture = async (source = FIXTURE) => {
    const file = new File([source], 'sketch.svg', { type: 'image/svg+xml' });
    await importInterchangeFile(edgeless.std, BPMN_SVG_IMPORT, file);
    await wait();
    return getSurface(window.doc, window.editor).model;
  };

  test('a stroke keeps its line width AND the box derived from it', async () => {
    const surface = await importFixture();

    const brushes = surface.elementModels.filter(
      (element): element is BrushElementModel =>
        element instanceof BrushElementModel
    );
    expect(brushes).toHaveLength(1);
    const [brush] = brushes;

    // The width the file declared, not the model's default of 4.
    expect(brush.lineWidth).toBe(2);
    // …and therefore this box: the points span (100, 100) → (200, 100), so the
    // bound is 100 wide and zero high, inflated by the line width to
    // (99, 99, 102, 2). Assigned in the other order it would be (98, 98, 104,
    // 4), which is the silent three-pixel drift this test exists to catch.
    expect(brush.xywh).toBe('[99,99,102,2]');
    expect(brush.color).toBe('#22242a');
  });

  test('a label arrives as free text a caret can go into', async () => {
    const surface = await importFixture();

    const texts = surface.elementModels.filter(
      (element): element is TextElementModel =>
        element instanceof TextElementModel
    );
    expect(texts).toHaveLength(1);
    // A real `Y.Text` in the store, not the plain string the reader handed
    // over: `propsToY` did its half, which is what makes the label editable.
    expect(texts[0].text.toString()).toBe('Check order');
    expect(texts[0].text.length).toBe('Check order'.length);
  });

  test('a rounded box arrives as a shape with its radius and its colours', async () => {
    const surface = await importFixture();

    const shapes = surface.elementModels.filter(
      (element): element is ShapeElementModel =>
        element instanceof ShapeElementModel
    );
    expect(shapes).toHaveLength(1);
    const [shape] = shapes;
    expect(shape.shapeType).toBe('rect');
    expect(shape.radius).toBe(10);
    expect(shape.filled).toBe(true);
    expect(shape.xywh).toBe('[180,80,100,80]');
  });

  test('the visual tier writes no `interchange` payload through the store', async () => {
    const surface = await importFixture();

    // P2's hard rule, proved where it actually matters: not on the props the
    // reader returned, but on what the Y.Map holds after `addElement` — which
    // is the thing that would still be there in six months.
    for (const element of surface.elementModels) {
      expect(element.interchange, element.type).toBeUndefined();
      expect(element.serialize()).not.toHaveProperty('interchange');
    }
  });

  test('a file neither framework can read fails without touching the board', async () => {
    // A reader THROWS on a file it cannot read, and the pipeline turns the
    // sentence into a toast. What must not happen is a half-written board.
    const before = getSurface(window.doc, window.editor).model.elementModels
      .length;
    await importFixture('<svg><rect width="1"</svg>');
    expect(
      getSurface(window.doc, window.editor).model.elementModels.length
    ).toBe(before);
  });

  test('both frameworks read one `.svg` through one function', async () => {
    // ADR 0012 refuses to infer a framework from a `.svg`, so there are two
    // capabilities — and they wrap the SAME parser, which is what keeps them
    // from drifting into recognising different pictures.
    expect(BPMN_SVG_IMPORT.run).toBe(parseSvgSketch);
    expect(WARDLEY_SVG_IMPORT.run).toBe(parseSvgSketch);

    const surface = await importFixture();
    const drawn = surface.elementModels.length;

    const file = new File([FIXTURE], 'sketch.svg', { type: 'image/svg+xml' });
    await importInterchangeFile(edgeless.std, WARDLEY_SVG_IMPORT, file);
    await wait();

    // The same picture again, beside the first: an import is an import and
    // never a merge, and Wardley drew exactly what BPMN drew.
    expect(
      getSurface(window.doc, window.editor).model.elementModels.length
    ).toBe(drawn * 2);
  });
});
