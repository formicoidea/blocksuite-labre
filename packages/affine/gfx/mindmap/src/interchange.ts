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

/** Nodes in one map, and characters in one node: guards against a runaway
 *  tree (a server builds what a model sent), not design limits. Wrapping
 *  measures the line it is filling once per word, so a node costs up to its
 *  length squared: the text is bounded too. The error names the limits, never
 *  the tree's text. */
export const MINDMAP_MAX_NODES = 500;
export const MINDMAP_MAX_TEXT = 2_000;

export class MindmapTooLargeError extends Error {
  constructor() {
    super(
      `a mind map holds at most ${MINDMAP_MAX_NODES} nodes of ${MINDMAP_MAX_TEXT} characters`
    );
    this.name = 'MindmapTooLargeError';
  }
}

/** The injected measure answered something that is not a size (`NaN`, a
 *  negative or an infinite number, as a width table that misses a character
 *  may): the wrap could not progress on it, and a box built from it would be
 *  stored wrong. */
export class MindmapMeasureError extends Error {
  constructor() {
    super(
      'the injected text measure returned a width or a line height that is not a finite, non-negative number'
    );
    this.name = 'MindmapMeasureError';
  }
}

const size = (value: number) => {
  if (!Number.isFinite(value) || value < 0) throw new MindmapMeasureError();
  return value;
};

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
 * The lines `fitContent` sets a node's text in: `wrapText` of
 * `affine-gfx-text`, line for line, with the injected width in place of the
 * canvas. A copy and not an import, because `wrapText` measures with the
 * browser's canvas, which a server has not got.
 *
 * Its quirks are kept on purpose, because each one changes a node's box:
 *
 * - a line broken before a word that does not fit keeps its trailing space,
 *   and `fitContent` measures it, space included;
 * - a hyphen ends a token (`non-profit` wraps as `non-` / `profit`);
 * - a word wider than the line is cut character by character, each character
 *   measured alone, and a line holds strictly less than `maxWidth`;
 * - blank lines produced by the wrapping are dropped, the paragraph's own are
 *   kept.
 *
 * Held to the real `wrapText` by `mindmap-headless.spec.ts` (integration
 * suite), on a corpus of the cases above. The cut of a long word measures one
 * character at a time, so wrapping stays linear in the word's length.
 */
export function wrapMindmapText(
  text: string,
  font: MindmapFont,
  maxWidth: number,
  measure: MindmapTextMeasure
): string[] {
  if (!Number.isFinite(maxWidth) || maxWidth < 0) return text.split('\n');
  const width = (s: string) => size(measure.width(s, font));
  const chars = new Map<string, number>();
  const charWidth = (char: string) => {
    let w = chars.get(char);
    if (w === undefined) {
      w = width(char);
      chars.set(char, w);
    }
    return w;
  };
  const spaceWidth = width(' ');
  const lines: string[] = [];
  let currentLine = '';
  let widthTillNow = 0;
  const push = (line: string) => {
    if (line.trim()) lines.push(line);
  };
  const reset = () => {
    currentLine = '';
    widthTillNow = 0;
  };

  for (const paragraph of text.split('\n')) {
    if (width(paragraph) <= maxWidth) {
      lines.push(paragraph);
      continue;
    }
    const words = tokensOf(paragraph);
    reset();
    let index = 0;
    while (index < words.length) {
      const word = words[index]!;
      const wordWidth = width(word);
      if (wordWidth === maxWidth) {
        push(word);
        index++;
      } else if (wordWidth > maxWidth) {
        push(currentLine);
        reset();
        let rest = word;
        while (rest.length > 0) {
          const char = String.fromCodePoint(rest.codePointAt(0)!);
          const w = charWidth(char);
          widthTillNow += w;
          rest = rest.slice(char.length);
          if (widthTillNow >= maxWidth) {
            push(currentLine);
            currentLine = char;
            widthTillNow = w;
          } else {
            currentLine += char;
          }
        }
        if (widthTillNow + spaceWidth >= maxWidth) {
          push(currentLine);
          reset();
        } else if (!currentLine.endsWith('-')) {
          currentLine += ' ';
          widthTillNow += spaceWidth;
        }
        index++;
      } else {
        while (widthTillNow < maxWidth && index < words.length) {
          const next = words[index]!;
          widthTillNow = width(currentLine + next);
          if (widthTillNow > maxWidth) {
            push(currentLine);
            reset();
            break;
          }
          index++;
          const appendSpace = !next.endsWith('-');
          currentLine += next;
          if (appendSpace) currentLine += ' ';
          if (widthTillNow + spaceWidth >= maxWidth) {
            lines.push(appendSpace ? currentLine.slice(0, -1) : currentLine);
            reset();
            break;
          }
        }
      }
    }
    if (currentLine.endsWith(' ')) {
      currentLine = currentLine.slice(0, -1);
      push(currentLine);
    }
  }
  return lines;
}

/** `parseTokens` of `affine-gfx-text`: words, a hyphen ending its token. */
function tokensOf(line: string): string[] {
  const parts = line.split('-');
  return parts
    .map((part, i) => (i < parts.length - 1 ? `${part}-` : part))
    .join(' ')
    .split(' ');
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
  const widest = lines.reduce(
    (max, line) => Math.max(max, size(measure.width(line, font))),
    0
  );
  const lineHeight = size(measure.lineHeight(font));
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
    if (
      nodes.length >= MINDMAP_MAX_NODES ||
      input.text.length > MINDMAP_MAX_TEXT
    ) {
      throw new MindmapTooLargeError();
    }
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
