/**
 * The built-in "Slides" category: 16:9 masks a deck starts from, each one
 * frame holding its texts, fill zones and rules (`builtin/slides/`).
 *
 * Why it exists, and what it would catch:
 * - a mask whose frame does not own every element it inserts (a text left on
 *   the canvas when the slide is moved or presented);
 * - an element painted outside its slide;
 * - a word written into the document without a key (ADR 0023), or a seed
 *   the host's catalogue cannot reach;
 * - a raw hex: a mask's elements carry no role and sit on no framework
 *   board, so they are painted as stored on a dark canvas (ADR 0039, point
 *   6) — only the base palette's `{ light, dark }` pairs follow the theme;
 * - a tile a search cannot find by its keywords, or a category that drops
 *   out of the built-in half of the panel;
 * - a slide number written into a read-only store, or counted wrongly.
 */
import { type Color, DefaultTheme } from '@labre/affine-model';
import { TranslationProvider } from '@labre/affine-shared/services';
import { darkThemeV2, lightThemeV2 } from '@toeverything/theme/v2';
import type { BlockStdScope } from '@labre/std';
import { GfxControllerIdentifier } from '@labre/std/gfx';
import { describe, expect, it } from 'vitest';

import {
  numberSlide,
  SLIDE_NUMBER_KEY,
  slideNumberOf,
} from '../builtin/slides/build.js';
import { SLIDE_HEIGHT, SLIDE_WIDTH } from '../builtin/slides/consts.js';
import { slidesTemplateCategory } from '../builtin/slides/index.js';
import { SLIDE_MASKS } from '../builtin/slides/masks.js';
import { builtInTemplates } from '../toolbar/builtin-templates.js';
import type { Template } from '../toolbar/template-type.js';
import {
  SLIDE_NAME_WORDINGS,
  SLIDE_SEED_WORDINGS,
  TEMPLATE_PACKAGE_WORDINGS,
  TEMPLATE_SEED_WORDINGS,
} from '../translations.js';

type Element = Record<string, unknown>;
type Block = {
  flavour: string;
  props: Record<string, unknown>;
  children: Block[];
};
type Snapshot = { blocks: { children: [Block] } };

const templates = (() => {
  const { templates } = slidesTemplateCategory;
  if (!Array.isArray(templates)) throw new Error('expected eager templates');
  return templates;
})();

function surfaceOf(content: unknown) {
  return (content as Snapshot).blocks.children[0];
}
function elementsOf(content: unknown) {
  return surfaceOf(content).props['elements'] as Record<string, Element>;
}
function framesOf(content: unknown) {
  return surfaceOf(content).children.filter(b => b.flavour === 'affine:frame');
}
const bound = (xywh: unknown) => JSON.parse(xywh as string) as number[];
const insertOf = (value: unknown) =>
  (value as { delta?: { insert?: string }[] } | undefined)?.delta?.[0]?.insert;

const hostWith = (
  t?: (key: string, params?: Record<string, string | number>) => string
) =>
  ({
    getOptional: (id: unknown) =>
      id === TranslationProvider && t ? { t } : null,
  }) as unknown as BlockStdScope;

describe('the Slides category', () => {
  it('is built in, after Other, and lists one tile per mask', async () => {
    expect(await builtInTemplates.categories()).toEqual(['Other', 'Slides']);
    expect(builtInTemplates.categoryLabel('Slides')).toBe(
      'com.labre.template.slides.category'
    );
    expect((await builtInTemplates.list('Slides')).map(t => t.name)).toEqual(
      SLIDE_MASKS.map(mask => mask.name[1])
    );
    expect(templates.length).toBeGreaterThanOrEqual(15);
    expect(templates.length).toBeLessThanOrEqual(25);
  });

  it('names every tile through its own key, and gives it keywords', () => {
    expect(templates.map(t => t.nameKey)).toEqual(
      SLIDE_MASKS.map(mask => mask.name[0])
    );
    // Every name is a slide key of this package, but the quote slide's: the
    // quote block's own word, one key (L7 dedupe).
    expect(new Set(templates.map(t => t.nameKey))).toEqual(
      new Set([
        ...SLIDE_NAME_WORDINGS.map(([key]) => key),
        'com.labre.block-type.quote',
      ])
    );
    for (const template of templates) {
      expect(template.commandId, template.name).toBeUndefined();
      expect(template.keywords?.length, template.name).toBeGreaterThan(2);
      for (const keyword of template.keywords ?? []) {
        expect(keyword, template.name).toMatch(/^[a-z0-9][a-z0-9 ]*$/);
      }
      expect(template.afterInsert, template.name).toBeTypeOf('function');
      expect(template.preview, template.name).toMatch(/^<svg /);
    }
  });

  it('declares its keys in the package manifest lists', () => {
    for (const wording of SLIDE_NAME_WORDINGS) {
      expect(TEMPLATE_PACKAGE_WORDINGS).toContain(wording);
    }
    for (const wording of SLIDE_SEED_WORDINGS) {
      expect(TEMPLATE_SEED_WORDINGS).toContain(wording);
    }
  });
});

describe.each(templates.map(t => [t.name!, t] as [string, Template]))(
  'the "%s" mask',
  (_, template) => {
    const elements = elementsOf(template.content);
    const frames = framesOf(template.content);

    it('is exactly one 16:9 frame of 1600 x 900 owning every element', () => {
      expect(frames).toHaveLength(1);
      const frame = frames[0]!;
      expect(bound(frame.props['xywh'])).toEqual([
        0,
        0,
        SLIDE_WIDTH,
        SLIDE_HEIGHT,
      ]);
      expect(insertOf(frame.props['title'])).toBe(template.name);
      expect(
        Object.keys(frame.props['childElementIds'] as Record<string, boolean>)
      ).toEqual(Object.keys(elements));
      // The slide number is the last element: `numberSlide` finds it there.
      expect(Object.keys(elements).at(-1)).toBe(SLIDE_NUMBER_KEY);
    });

    it('paints every element inside its slide', () => {
      for (const [id, element] of Object.entries(elements)) {
        const points: number[][] = [];
        if (element['type'] === 'connector') {
          for (const end of ['source', 'target'] as const) {
            points.push((element[end] as { position: number[] }).position);
          }
        } else {
          const [x, y, w, h] = bound(element['xywh']);
          points.push([x!, y!], [x! + w!, y! + h!]);
        }
        for (const [x, y] of points) {
          expect(x, id).toBeGreaterThanOrEqual(0);
          expect(y, id).toBeGreaterThanOrEqual(0);
          expect(x, id).toBeLessThanOrEqual(SLIDE_WIDTH);
          expect(y, id).toBeLessThanOrEqual(SLIDE_HEIGHT);
        }
      }
    });

    it('writes every word through a key, and localizes to the content without a host', () => {
      expect(JSON.stringify(template.localize!(hostWith()))).toBe(
        JSON.stringify(template.content)
      );
      const marked = template.localize!(hostWith(key => `<${key}>`));
      const texts = [
        ...Object.values(elementsOf(marked)).map(e => insertOf(e['text'])),
        insertOf(framesOf(marked)[0]!.props['title']),
      ].filter((t): t is string => t !== undefined);
      expect(texts.length).toBeGreaterThan(2);
      for (const text of texts) {
        // Digits are no wording: an agenda's "01", the slide number.
        expect(text).toMatch(
          /^(<com\.labre\.(template\.slides\.[^>]+|block-type\.quote)>|\d+)$/
        );
      }
    });

    it('paints only with the base palette, its paper and ink as pairs', () => {
      // The base palette, and the theme's own canvas tokens as the pairs
      // `getColorByKey` would build from them.
      const themeTokens = (
        Object.keys(lightThemeV2) as (keyof typeof lightThemeV2)[]
      )
        .filter(key => key.startsWith('edgeless/'))
        .map(key =>
          lightThemeV2[key] === darkThemeV2[key]
            ? lightThemeV2[key]
            : { dark: darkThemeV2[key], light: lightThemeV2[key] }
        );
      const palette: Color[] = [
        ...DefaultTheme.Palettes.map(p => p.value),
        ...Object.values(DefaultTheme.NoteBackgroundColorMap),
        ...themeTokens,
      ];
      const known = new Set(palette.map(c => JSON.stringify(c)));
      const frame = frames[0]!;
      const background = frame.props['background'] as Color;
      expect(typeof background, 'paper is a pair').toBe('object');
      expect(known.has(JSON.stringify(background))).toBe(true);
      for (const [id, element] of Object.entries(elements)) {
        for (const key of ['color', 'fillColor', 'strokeColor', 'stroke']) {
          if (!(key in element)) continue;
          expect(known.has(JSON.stringify(element[key])), `${id}.${key}`).toBe(
            true
          );
        }
        if (element['type'] === 'text' && element['color']) {
          // Words sit straight on the paper: they must flip with it.
          const ink = element['color'] as Color;
          if (typeof ink === 'string') {
            expect(ink, `${id} muted ink`).toBe(
              DefaultTheme.StrokeColorShortMap['Grey']
            );
          }
        }
      }
    });
  }
);

describe('numberSlide', () => {
  type FakeFrame = {
    childIds: string[];
    props: { presentationIndex?: string };
  };
  function stdWith(frames: FakeFrame[], readonly = false) {
    const writes: [string, string][] = [];
    const std = {
      store: {
        readonly,
        getModelsByFlavour: (flavour: string) =>
          flavour === 'affine:frame' ? frames : [],
      },
      get: (id: unknown) => {
        if (id !== GfxControllerIdentifier) throw new Error('unexpected');
        return {
          updateElement: (elementId: string, props: { text: unknown }) =>
            writes.push([elementId, String(props.text)]),
        };
      },
    } as unknown as BlockStdScope;
    return { std, writes };
  }

  it('ranks a frame in presentation order, legacy frames last', () => {
    const own = { props: { presentationIndex: 'a2' } };
    const frames = [
      { props: { presentationIndex: 'a0' } },
      own,
      { props: { presentationIndex: 'a1' } },
      // A legacy frame without a key comes after every keyed one.
      { props: {} },
    ];
    expect(slideNumberOf(own, frames)).toBe(3);
    // A tie (the schema default, no presentationIndex middleware) counts as
    // before the new slide: an insertion lands last among its equals.
    const tied = { props: { presentationIndex: 'a0' } };
    expect(slideNumberOf(tied, [...frames, tied])).toBe(2);
  });

  it('writes the number into the element the frame owns', () => {
    const { std, writes } = stdWith([
      { childIds: [], props: { presentationIndex: 'a0' } },
      { childIds: ['t', 'n'], props: { presentationIndex: 'a1' } },
    ]);
    numberSlide(std, ['t', 'n']);
    expect(writes.map(([id]) => id)).toEqual(['n']);
  });

  it('writes nothing into a read-only store', () => {
    const { std, writes } = stdWith(
      [{ childIds: ['n'], props: { presentationIndex: 'a0' } }],
      true
    );
    numberSlide(std, ['n']);
    expect(writes).toEqual([]);
  });

  it('writes nothing when no frame owns the inserted number', () => {
    const { std, writes } = stdWith([
      { childIds: [], props: { presentationIndex: 'a0' } },
    ]);
    numberSlide(std, ['n']);
    expect(writes).toEqual([]);
  });
});
