import type {
  SerializedElementProps,
  ToolboxPoint,
} from '@labre/affine-block-surface/interchange';
import {
  FontStyle,
  LayoutType,
  MindmapStyle,
  mindmapStyleGetters,
  type NodeStyle,
} from '@labre/affine-model/headless';
import type { SerializedXYWH } from '@labre/global/gfx';
import { Bound } from '@labre/global/gfx';

import { layout, type LayoutNode, type LayoutRoot } from './view/layout.js';

/**
 * `@labre/affine-gfx-mindmap/interchange` — a mind map with no editor behind it
 * (ADR 0045, amendment of 2026-11-10): what a host with no editor (the Labre
 * workspace connector, labre-mcp) needs to place the mind map the toolbar
 * places, never shapes and connectors that imitate one.
 *
 * ## Why the text measurement is the caller's
 *
 * A mind map is laid out from its nodes' sizes, and the editor sizes a node from
 * the browser: `fitContent` measures its text with a canvas and a hidden
 * element. A server has neither, and the library ships no font metrics, so the
 * caller hands them in ({@link MindmapTextMeasure}). An estimate made here would
 * store wrong sizes without saying so; a host that measures badly sees it in its
 * own preview.
 *
 * ## The same mind map as the editor's
 *
 * Each node is a `shape` with the style getter's node props (the root style for
 * the root, `getNodeStyle` by path below it), sized as `fitContent` sizes it,
 * placed by the very `layout` the view installs. The mind map element comes
 * last, its `children` naming the nodes by LOCAL id: the materializer rewrites
 * them as it rewrites a group's (ADR 0012, D3). The branches are not elements:
 * the editor draws them as local connectors from the tree, so a host that
 * previews the map draws them itself.
 *
 * Held by `interchange-headless.unit.spec.ts` in `packages/affine/all`: this
 * entry loads no editor, no Lit and no DOM.
 */

/** One node of the tree to draw: its text and its children, in order. */
export interface MindmapTreeInput {
  text: string;
  children?: readonly MindmapTreeInput[];
}

/** The font a node's text is set in, as its style gives it. */
export interface MindmapFont {
  fontFamily: string;
  fontSize: number;
  fontWeight: string;
  fontStyle: string;
}

/** Text metrics, in canvas units: the caller's, for the fonts the styles name
 *  (Poppins, Inter, Kalam… see `mindmapStyleGetters`). */
export interface MindmapTextMeasure {
  /** The advance width of one line of `text`, as canvas `measureText` gives it. */
  width(text: string, font: MindmapFont): number;
  /** What one line adds to a node's height: the line height plus its gap, as
   *  `measureTextInDOM` gives them to `fitContent`. */
  lineHeight(font: MindmapFont): number;
}

export interface BuildMindmapOptions {
  measure: MindmapTextMeasure;
  /** The top-left of the whole map; the origin when absent. */
  at?: ToolboxPoint;
  /** The toolbar's style; `MindmapStyle.ONE`, the toolbar's first, when absent. */
  style?: MindmapStyle;
  /** `LayoutType.RIGHT`, the model's default, when absent. */
  layoutType?: LayoutType;
  /** Prefixes the local ids, so two maps built for one batch share no name. */
  local?: string;
}

/** Nodes in one map: a guard against a runaway tree, not a design limit. */
export const MINDMAP_MAX_NODES = 500;

export class MindmapTooLargeError extends Error {
  constructor() {
    super(`a mind map holds at most ${MINDMAP_MAX_NODES} nodes`);
    this.name = 'MindmapTooLargeError';
  }
}

const DIGITS = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';

/**
 * The `n`th key `fractional-indexing` hands out from `a0` onward
 * (`generateKeyBetween(previous, null)`): `a0`…`az`, then `b00`…`bzz`. Written
 * out because a server's graph loads `zod` only; the spec holds it to the
 * package.
 */
export function mindmapChildIndex(n: number): string {
  if (n < DIGITS.length) return `a${DIGITS[n]}`;
  const m = n - DIGITS.length;
  return `b${DIGITS[Math.floor(m / DIGITS.length)]}${DIGITS[m % DIGITS.length]}`;
}

/**
 * The lines `fitContent` sets a node's text in: each paragraph whole when it
 * fits `maxWidth`, else word by word, a word wider than the line cut where it
 * stops fitting (the rule of `wrapText` in `affine-gfx-text`).
 */
export function wrapMindmapText(
  text: string,
  font: MindmapFont,
  maxWidth: number,
  measure: MindmapTextMeasure
): string[] {
  const width = (s: string) => measure.width(s, font);
  const lines: string[] = [];
  for (const paragraph of text.split('\n')) {
    if (width(paragraph) <= maxWidth) {
      lines.push(paragraph);
      continue;
    }
    let line = '';
    for (const word of paragraph.split(' ').filter(Boolean)) {
      const joined = line ? `${line} ${word}` : word;
      if (width(joined) <= maxWidth) {
        line = joined;
        continue;
      }
      if (line) lines.push(line);
      line = '';
      let rest = word;
      while (width(rest) > maxWidth && rest.length > 1) {
        let cut = rest.length - 1;
        while (cut > 1 && width(rest.slice(0, cut)) > maxWidth) cut--;
        lines.push(rest.slice(0, cut));
        rest = rest.slice(cut);
      }
      line = rest;
    }
    if (line) lines.push(line);
  }
  return lines;
}

const fontOf = (style: NodeStyle): MindmapFont => ({
  fontFamily: style.fontFamily,
  fontSize: style.fontSize,
  fontWeight: style.fontWeight,
  fontStyle: FontStyle.Normal,
});

/** A node's box as `fitContent` gives it: the widest line and every line's
 *  height, plus the style's padding. */
function nodeSize(text: string, style: NodeStyle, measure: MindmapTextMeasure) {
  const font = fontOf(style);
  const [verticalPadding, horizontalPadding] = style.padding;
  const lines = wrapMindmapText(
    text,
    font,
    style.maxWidth || Number.MAX_SAFE_INTEGER,
    measure
  );
  const widest = Math.max(0, ...lines.map(l => measure.width(l, font)));
  const lineHeight = measure.lineHeight(font);
  return {
    w: widest + horizontalPadding * 2,
    h: Math.max(1, lines.length) * lineHeight + verticalPadding * 2,
  };
}

/** A node the layout moves: its box lives in `xywh`, as on a model. */
class PlainElement {
  constructor(public xywh: SerializedXYWH) {}

  private get _box() {
    return Bound.deserialize(this.xywh);
  }

  get x() {
    return this._box.x;
  }

  get y() {
    return this._box.y;
  }

  get w() {
    return this._box.w;
  }

  get h() {
    return this._box.h;
  }

  get elementBound() {
    return this._box;
  }
}

interface BuiltNode extends LayoutNode {
  id: string;
  text: string;
  style: NodeStyle;
  index: string;
  parent?: string;
  element: PlainElement;
  children: BuiltNode[];
}

/**
 * The elements of one mind map, in painting order: every node's `shape` in
 * tree order, then the `mindmap` element that holds them. Local ids
 * (`<local>:n0` for the root); nothing is persisted.
 */
export function buildMindmap(
  tree: MindmapTreeInput,
  options: BuildMindmapOptions
): SerializedElementProps[] {
  const {
    measure,
    at = { x: 0, y: 0 },
    style = MindmapStyle.ONE,
    layoutType = LayoutType.RIGHT,
    local = 'mindmap',
  } = options;
  const getter = mindmapStyleGetters[style];
  const nodes: BuiltNode[] = [];

  const build = (
    input: MindmapTreeInput,
    path: number[],
    parent?: BuiltNode
  ): BuiltNode => {
    if (nodes.length >= MINDMAP_MAX_NODES) throw new MindmapTooLargeError();
    const nodeStyle = parent
      ? getter.getNodeStyle(null, path).node
      : getter.root;
    const { w, h } = nodeSize(input.text, nodeStyle, measure);
    const node: BuiltNode = {
      id: `${local}:n${nodes.length}`,
      text: input.text,
      style: nodeStyle,
      index: mindmapChildIndex(path[path.length - 1] ?? 0),
      ...(parent ? { parent: parent.id } : {}),
      detail: {},
      element: new PlainElement(`[0,0,${w},${h}]`),
      children: [],
    };
    nodes.push(node);
    (input.children ?? []).forEach((child, i) => {
      node.children.push(build(child, [...path, i], node));
    });
    return node;
  };

  const root = build(tree, [0]) as BuiltNode & LayoutRoot;
  // The model's `buildTree`: one side, or the first half right and the rest
  // left, reversed (`_cfgBalanceLayoutDir`).
  if (layoutType === LayoutType.BALANCE) {
    const split = Math.ceil(root.children.length / 2);
    root.right = root.children.slice(0, split);
    root.left = root.children.slice(split).reverse();
  } else {
    root.right = layoutType === LayoutType.RIGHT ? root.children : [];
    root.left = layoutType === LayoutType.LEFT ? root.children : [];
  }
  layout(root, { layoutType }, layoutType, [0]);

  const boxes = nodes.map(n => n.element.elementBound);
  const dx = at.x - Math.min(...boxes.map(b => b.x));
  const dy = at.y - Math.min(...boxes.map(b => b.y));

  const shapes: SerializedElementProps[] = nodes.map((node, i) => {
    const box = boxes[i]!;
    return {
      type: 'shape',
      id: node.id,
      xywh: `[${box.x + dx},${box.y + dy},${box.w},${box.h}]`,
      text: node.text,
      ...node.style,
    };
  });
  return [
    ...shapes,
    {
      type: 'mindmap',
      id: local,
      layoutType,
      style,
      children: Object.fromEntries(
        nodes.map(n => [
          n.id,
          n.parent === undefined
            ? { index: n.index }
            : { index: n.index, parent: n.parent },
        ])
      ),
    },
  ];
}
