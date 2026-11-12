import { materializeInterchangeImport } from '@labre/affine/blocks/surface';
import {
  buildMindmap,
  type MindmapFont,
  type MindmapTextMeasure,
  wrapMindmapText,
} from '@labre/affine/gfx/mindmap/interchange';
import {
  getFontString,
  getLineWidth,
  measureTextInDOM,
  wrapText,
} from '@labre/affine/gfx/text';
import {
  LayoutType,
  type MindmapElementModel,
  type MindmapNode,
  MindmapStyle,
  mindmapStyleGetters,
} from '@labre/affine-model';
import { Bound } from '@labre/global/gfx';
import type { GfxController } from '@labre/std/gfx';
import { beforeEach, describe, expect, test } from 'vitest';

import { wait } from '../utils/common.js';
import { getDocRootBlock } from '../utils/edgeless.js';
import { setupEditor } from '../utils/setup.js';

/**
 * PARITY — a mind map built with no editor is the mind map the editor writes
 * and lays out (ADR 0045, amendment of 2026-11-10).
 *
 * The builder is handed the browser's own measure (the canvas and the DOM, as
 * `fitContent` measures), and its elements are written by the materializer.
 * Three things are then held, each against the editor itself:
 *
 * 1. the editor, made to lay the built map out again from scratch, puts every
 *    node where and as large as the builder put it;
 * 2. the same tree created the toolbar's way (`addElement('mindmap', { style,
 *    children })`) reads, node for node, the same props and the same boxes.
 *    Read, not stored: the builder stores every key of the node style, as the
 *    editor's own `addNode` does (`...style.node`), where the toolbar's first
 *    creation leaves a key unwritten when its value is the model's default
 *    (`applyNodeStyle` writes only what differs). Same values either way;
 * 3. the builder's copy of `wrapText` cuts every text of a corpus into the
 *    lines the real one cuts, quirks included.
 *
 * What would be caught: a builder that styles, sizes or places a node
 * differently from the view, which a host would store and the editor would
 * silently move on first open; and a wrap that drifts from `wrapText`, which
 * only shows on a node long enough to break (the first version of the builder
 * dropped the trailing space `wrapText` keeps, and cut long words one
 * character later). Every map below has such a node.
 *
 * Not a passing-by-default check: the built map's root is squashed before the
 * editor lays it out again, and the toolbar's map starts from `[0,0,100,30]`
 * boxes, so a layout that did not run fails on both.
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

const LONG =
  'Coordinate the launch webinar with the partner network, the non-profit ' +
  'foundations and the regional sales teams before the end of the quarter';

const tree = {
  text: 'Product launch',
  children: [
    {
      text: 'Marketing',
      children: [{ text: 'Press kit' }, { text: LONG }],
    },
    { text: 'Product', children: [{ text: 'Beta' }, { text: 'Docs' }] },
    { text: 'Sales', children: [{ text: 'Pricing' }, { text: 'Demo' }] },
  ],
};

/** The wrapping cases: hyphens, long words, double spaces, paragraphs. */
const WRAP_CORPUS = [
  '',
  'Beta',
  LONG,
  'A non-profit, cross-functional go-to-market plan for the twenty-first century',
  'Supercalifragilisticexpialidocious'.repeat(4),
  'short then Pneumonoultramicroscopicsilicovolcanoconiosis-and-more then short',
  'two  spaces  between  words  that  must  wrap  somewhere  along  the  line',
  'first line\nsecond line, long enough to wrap at the narrow widths below it',
  'trailing hyphen- words- here- and- there- until- the- line- breaks- again-',
];

/** What a stored node carries that is its own, not its look. */
const IDENTITY = new Set(['id', 'index', 'seed', 'xywh', 'layer']);

type Node = { serialize(): object };

/** Every prop either node stores, as the model reads it back. */
const looks = (a: Node, b: Node) => {
  const keys = [
    ...new Set([...Object.keys(a.serialize()), ...Object.keys(b.serialize())]),
  ]
    .filter(key => !IDENTITY.has(key))
    .sort();
  const read = (node: Node) =>
    keys.map(key => {
      const value = (node as unknown as Record<string, unknown>)[key];
      return [key, key === 'text' ? String(value) : value];
    });
  return [read(a), read(b)];
};

/** Boxes relative to the first one: the two maps sit in different places. */
const relative = (boxes: Bound[]) =>
  boxes.map(b => [b.x - boxes[0]!.x, b.y - boxes[0]!.y, b.w, b.h]);

const expectBoxes = (actual: number[][], expected: number[][]) => {
  expect(actual.length).toBe(expected.length);
  actual.forEach((box, i) =>
    box.forEach((v, k) => expect(v).toBeCloseTo(expected[i]![k]!, 0))
  );
};

/** The editor's nodes in tree order, the order the builder emits them in. */
const inTreeOrder = (mindmap: MindmapElementModel) => {
  const nodes: MindmapNode[] = [];
  const walk = (node: MindmapNode) => {
    nodes.push(node);
    node.children.forEach(walk);
  };
  walk(mindmap.tree);
  return nodes;
};

/** Each node's sibling index and its parent's rank in tree order. */
const shapeOf = (mindmap: MindmapElementModel) => {
  const nodes = inTreeOrder(mindmap);
  const ids = nodes.map(n => n.id);
  return nodes.map(n => [
    n.detail.index,
    n.detail.parent === undefined ? -1 : ids.indexOf(n.detail.parent),
  ]);
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
    [MindmapStyle.TWO, LayoutType.LEFT],
    [MindmapStyle.THREE, LayoutType.BALANCE],
    [MindmapStyle.FOUR, LayoutType.RIGHT],
  ])('style %s, layout %s: the editor keeps every node', async (style, dir) => {
    // Fonts first: a measure taken before they load is a fallback font's.
    await document.fonts.ready;
    const built = buildMindmap(tree, {
      measure: browserMeasure,
      style,
      layoutType: dir,
    });
    const builtShapes = built.filter(e => e.type === 'shape');
    const expected = relative(
      builtShapes.map(e => Bound.deserialize(e.xywh as string))
    );
    // The long node does break, or this spec would not hold the wrap.
    const { node: longStyle } = mindmapStyleGetters[style].getNodeStyle(
      null,
      [0, 0, 1]
    );
    const oneLine =
      browserMeasure.lineHeight({ ...longStyle, fontStyle: 'normal' }) +
      longStyle.padding[0] * 2;
    const longShape = builtShapes.find(e => e.text === LONG)!;
    expect(Bound.deserialize(longShape.xywh as string).h).toBeGreaterThan(
      oneLine * 1.5
    );

    const created = materializeInterchangeImport(
      window.editor.std,
      'labre:toolbox',
      built
    );
    await wait();
    const mindmap = gfx.getElementById(created.at(-1)!) as MindmapElementModel;
    expect(mindmap.nodeMap.size).toBe(10);
    expect(inTreeOrder(mindmap).map(n => n.id)).toEqual(created.slice(0, -1));

    // 1. Squash the root first: only the view's layout (style, fitContent,
    //    then placement) can give it its size back.
    gfx.surface!.getElementById(created[0]!)!.xywh = '[0,0,1,1]';
    mindmap.layout();
    await wait();
    const relaidOut = created
      .slice(0, -1)
      .map(id => gfx.surface!.getElementById(id)!);
    expectBoxes(
      relative(relaidOut.map(e => Bound.deserialize(e.xywh))),
      expected
    );

    // 2. The toolbar's way, from the same tree.
    const toolbarId = gfx.surface!.addElement({
      type: 'mindmap',
      style,
      layoutType: dir,
      children: tree,
    });
    await wait();
    const toolbar = gfx.getElementById(toolbarId) as MindmapElementModel;
    const toolbarNodes = inTreeOrder(toolbar);
    expectBoxes(
      relative(toolbarNodes.map(n => Bound.deserialize(n.element.xywh))),
      expected
    );
    toolbarNodes.forEach((node, i) => {
      const [builder, editor] = looks(relaidOut[i]!, node.element);
      expect(builder).toEqual(editor);
    });
    expect(shapeOf(mindmap)).toEqual(shapeOf(toolbar));
    expect(mindmap.layoutType).toBe(toolbar.layoutType);
    expect(mindmap.style).toBe(toolbar.style);
  });

  // The widths: the node cap, then narrower ones that break every corpus text.
  test.each([512, 200, 97, 40])(
    'at %spx the builder wraps every text into the lines wrapText cuts',
    async maxWidth => {
      await document.fonts.ready;
      const { root } = mindmapStyleGetters[MindmapStyle.ONE];
      const font: MindmapFont = { ...root, fontStyle: 'normal' };
      WRAP_CORPUS.forEach(text =>
        expect(
          wrapMindmapText(text, font, maxWidth, browserMeasure),
          text
        ).toEqual(wrapText(text, getFontString(font), maxWidth).split('\n'))
      );
    }
  );
});
