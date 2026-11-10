import {
  LayoutType,
  MindmapStyle,
  mindmapStyleGetters,
} from '@labre/affine-model';
import { Bound } from '@labre/global/gfx';
import { generateKeyBetween } from 'fractional-indexing';
import { describe, expect, test } from 'vitest';

import {
  buildMindmap,
  type MindmapFont,
  mindmapChildIndex,
  type MindmapTextMeasure,
  MindmapTooLargeError,
  wrapMindmapText,
} from '../interchange.js';
import {
  NODE_FIRST_LEVEL_HORIZONTAL_SPACING,
  NODE_HORIZONTAL_SPACING,
  NODE_VERTICAL_SPACING,
} from '../view/layout.js';

/**
 * The mind map a host with no editor builds (ADR 0045, amendment of
 * 2026-11-10): the toolbar's styles, `fitContent`'s sizes from the injected
 * measure, the view's layout, and the mind map element last naming its nodes
 * by local id.
 *
 * The measure is a monospace one (half an em per character, a line of 1.5 em)
 * so every size below is arithmetic a reader can check by hand.
 */
const mono: MindmapTextMeasure = {
  width: (text: string, font: MindmapFont) => text.length * font.fontSize * 0.5,
  lineHeight: (font: MindmapFont) => font.fontSize * 1.5,
};

const launch = {
  text: 'Launch',
  children: [
    { text: 'Marketing', children: [{ text: 'Ads' }, { text: 'Press' }] },
    { text: 'Product', children: [{ text: 'Beta' }, { text: 'Docs' }] },
    { text: 'Sales', children: [{ text: 'Deals' }, { text: 'CRM' }] },
  ],
};

type Built = ReturnType<typeof buildMindmap>;
const shapes = (built: Built) => built.filter(e => e.type === 'shape');
const boxOf = (e: Built[number]) => Bound.deserialize(e.xywh as string);
const byText = (built: Built, text: string) =>
  shapes(built).find(e => e.text === text)!;

describe('buildMindmap', () => {
  test('one shape per node in tree order, then the mind map naming them', () => {
    const built = buildMindmap(launch, { measure: mono, local: 'm' });

    expect(built.map(e => e.type)).toEqual([
      ...Array(10).fill('shape'),
      'mindmap',
    ]);
    expect(shapes(built).map(e => e.text)).toEqual([
      'Launch',
      'Marketing',
      'Ads',
      'Press',
      'Product',
      'Beta',
      'Docs',
      'Sales',
      'Deals',
      'CRM',
    ]);
    const mindmap = built.at(-1)!;
    expect(mindmap).toMatchObject({
      id: 'm',
      style: MindmapStyle.ONE,
      layoutType: LayoutType.RIGHT,
    });
    const children = mindmap.children as Record<
      string,
      { index: string; parent?: string }
    >;
    expect(Object.keys(children)).toEqual(shapes(built).map(e => e.id));
    expect(children['m:n0']).toEqual({ index: 'a0' });
    expect(children['m:n1']).toEqual({ index: 'a0', parent: 'm:n0' });
    expect(children['m:n4']).toEqual({ index: 'a1', parent: 'm:n0' });
    expect(children['m:n3']).toEqual({ index: 'a1', parent: 'm:n1' });
  });

  test('styles each node as the toolbar does: the root, then by path', () => {
    const built = buildMindmap(launch, {
      measure: mono,
      style: MindmapStyle.TWO,
    });
    const getter = mindmapStyleGetters[MindmapStyle.TWO];

    expect(byText(built, 'Launch')).toMatchObject(getter.root);
    expect(byText(built, 'Product')).toMatchObject(
      getter.getNodeStyle(null, [0, 1]).node
    );
    expect(byText(built, 'Deals')).toMatchObject(
      getter.getNodeStyle(null, [0, 2, 0]).node
    );
  });

  test('sizes a node as fitContent does: widest line plus padding', () => {
    const built = buildMindmap(launch, { measure: mono });
    const { root } = mindmapStyleGetters[MindmapStyle.ONE];
    const [vertical, horizontal] = root.padding;

    const box = boxOf(byText(built, 'Launch'));
    expect(box.w).toBe('Launch'.length * root.fontSize * 0.5 + horizontal * 2);
    expect(box.h).toBe(root.fontSize * 1.5 + vertical * 2);
  });

  test('lays the branches out to the right with the view’s spacings', () => {
    const built = buildMindmap(launch, {
      measure: mono,
      at: { x: 100, y: 50 },
    });
    const root = boxOf(byText(built, 'Launch'));
    const branches = ['Marketing', 'Product', 'Sales'].map(t =>
      boxOf(byText(built, t))
    );
    const ideas = boxOf(byText(built, 'Ads'));

    for (const branch of branches) {
      expect(branch.x).toBe(
        root.x + root.w + NODE_FIRST_LEVEL_HORIZONTAL_SPACING
      );
    }
    const marketing = branches[0]!;
    expect(ideas.x).toBe(marketing.x + marketing.w + NODE_HORIZONTAL_SPACING);
    // Siblings stacked top to bottom in their order, never overlapping.
    for (const [upper, lower] of [
      [branches[0]!, branches[1]!],
      [branches[1]!, branches[2]!],
    ]) {
      expect(lower.y).toBeGreaterThanOrEqual(
        upper.y + upper.h + NODE_VERTICAL_SPACING
      );
    }
    // The whole map's top-left is `at`.
    const all = shapes(built).map(boxOf);
    expect(Math.min(...all.map(b => b.x))).toBe(100);
    expect(Math.min(...all.map(b => b.y))).toBe(50);
  });

  test('balances the first half right and the rest left, as the model does', () => {
    const built = buildMindmap(launch, {
      measure: mono,
      layoutType: LayoutType.BALANCE,
    });
    const root = boxOf(byText(built, 'Launch'));

    expect(boxOf(byText(built, 'Marketing')).x).toBeGreaterThan(root.x);
    expect(boxOf(byText(built, 'Product')).x).toBeGreaterThan(root.x);
    expect(boxOf(byText(built, 'Sales')).x).toBeLessThan(root.x);
    expect(built.at(-1)!.layoutType).toBe(LayoutType.BALANCE);
  });

  test('lays to the left when asked', () => {
    const built = buildMindmap(launch, {
      measure: mono,
      layoutType: LayoutType.LEFT,
    });
    const root = boxOf(byText(built, 'Launch'));

    for (const t of ['Marketing', 'Product', 'Sales', 'CRM']) {
      expect(boxOf(byText(built, t)).x).toBeLessThan(root.x);
    }
  });

  test('refuses a runaway tree rather than building it', () => {
    const wide = {
      text: 'root',
      children: Array.from({ length: 600 }, (_, i) => ({ text: `${i}` })),
    };
    expect(() => buildMindmap(wide, { measure: mono })).toThrow(
      MindmapTooLargeError
    );
  });
});

describe('wrapMindmapText', () => {
  const font = {
    fontFamily: 'x',
    fontSize: 10,
    fontWeight: '400',
    fontStyle: 'normal',
  };

  test('keeps a paragraph that fits, wraps one that does not word by word', () => {
    expect(wrapMindmapText('a b c', font, 100, mono)).toEqual(['a b c']);
    // 5 px a character: 40 px holds eight.
    expect(wrapMindmapText('alpha beta gamma', font, 40, mono)).toEqual([
      'alpha',
      'beta',
      'gamma',
    ]);
    expect(wrapMindmapText('one\ntwo', font, 100, mono)).toEqual([
      'one',
      'two',
    ]);
  });

  test('cuts a word wider than the line', () => {
    expect(wrapMindmapText('abcdefghijkl', font, 40, mono)).toEqual([
      'abcdefgh',
      'ijkl',
    ]);
  });
});

describe('mindmapChildIndex', () => {
  test('hands out the keys fractional-indexing hands out from a0', () => {
    let key: string | null = null;
    for (let n = 0; n < 200; n++) {
      key = generateKeyBetween(key, null);
      expect(mindmapChildIndex(n)).toBe(key);
    }
  });
});
