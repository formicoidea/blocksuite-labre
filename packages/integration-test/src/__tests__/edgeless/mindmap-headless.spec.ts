import { materializeInterchangeImport } from '@labre/affine/blocks/surface';
import {
  buildMindmap,
  type MindmapFont,
  type MindmapTextMeasure,
} from '@labre/affine/gfx/mindmap/interchange';
import {
  getFontString,
  getLineWidth,
  measureTextInDOM,
} from '@labre/affine/gfx/text';
import {
  LayoutType,
  type MindmapElementModel,
  MindmapStyle,
} from '@labre/affine-model';
import { Bound } from '@labre/global/gfx';
import type { GfxController } from '@labre/std/gfx';
import { beforeEach, describe, expect, test } from 'vitest';

import { wait } from '../utils/common.js';
import { getDocRootBlock } from '../utils/edgeless.js';
import { setupEditor } from '../utils/setup.js';

/**
 * PARITY — a mind map built with no editor is the mind map the editor lays out
 * (ADR 0045, amendment of 2026-11-10).
 *
 * The builder is handed the browser's own measure (the canvas and the DOM, as
 * `fitContent` measures), its elements are written by the materializer, and the
 * editor then lays the map out itself (the model asks for a layout when its
 * children land). Every node must be where and as large as the builder put it:
 * what would be caught is a builder that styles, sizes or places a node
 * differently from the view, which a host would store and the editor would
 * silently move on first open.
 */
const browserMeasure: MindmapTextMeasure = {
  width: (text: string, font: MindmapFont) =>
    getLineWidth(text, getFontString(font)),
  lineHeight: (font: MindmapFont) => {
    const { lineHeight, lineGap } = measureTextInDOM(
      font.fontFamily,
      font.fontSize,
      font.fontWeight
    );
    return lineHeight + lineGap;
  },
};

const tree = {
  text: 'Product launch',
  children: [
    {
      text: 'Marketing',
      children: [{ text: 'Press kit' }, { text: 'Launch webinar' }],
    },
    { text: 'Product', children: [{ text: 'Beta' }, { text: 'Docs' }] },
    { text: 'Sales', children: [{ text: 'Pricing' }, { text: 'Demo' }] },
  ],
};

describe('a mind map built with no editor', () => {
  let gfx: GfxController;

  beforeEach(async () => {
    const cleanup = await setupEditor('edgeless');
    gfx = getDocRootBlock(window.doc, window.editor, 'edgeless').gfx;
    return cleanup;
  });

  test.each([
    [MindmapStyle.ONE, LayoutType.RIGHT],
    [MindmapStyle.THREE, LayoutType.BALANCE],
  ])('style %s, layout %s: the editor keeps every node', async (style, dir) => {
    // Fonts first: a measure taken before they load is a fallback font's.
    await document.fonts.ready;
    const built = buildMindmap(tree, {
      measure: browserMeasure,
      style,
      layoutType: dir,
    });
    const created = materializeInterchangeImport(
      window.editor.std,
      'labre:toolbox',
      built
    );
    await wait();

    const mindmap = gfx.getElementById(created.at(-1)!) as MindmapElementModel;
    expect(mindmap.nodeMap.size).toBe(10);

    // Relative to the root: the materializer may shift the whole map.
    const relative = (boxes: Bound[]) =>
      boxes.map(b => [b.x - boxes[0]!.x, b.y - boxes[0]!.y, b.w, b.h]);
    const expected = relative(
      built
        .filter(e => e.type === 'shape')
        .map(e => Bound.deserialize(e.xywh as string))
    );

    // Squash the root first: only the view's layout (style, fitContent, then
    // placement) can give it its size back, so a layout that did not run fails
    // here instead of passing on the builder's own numbers.
    gfx.getElementById(created[0]!)!.xywh = '[0,0,1,1]';
    mindmap.layout();
    await wait();
    const actual = relative(
      created
        .slice(0, -1)
        .map(id => Bound.deserialize(gfx.getElementById(id)!.xywh))
    );

    actual.forEach((box, i) =>
      box.forEach((v, k) => expect(v).toBeCloseTo(expected[i]![k]!, 0))
    );
  });
});
