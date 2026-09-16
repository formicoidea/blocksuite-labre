import { NOTATION_NEUTRALS } from '@labre/affine-shared/consts';
import { TranslationProvider } from '@labre/affine-shared/services';
import type { BlockStdScope } from '@labre/std';
import { describe, expect, it } from 'vitest';

import { otherTemplateCategory } from '../builtin/other.js';

const COLOUR_KEYS = new Set(['fillColor', 'strokeColor', 'color', 'stroke']);

/** Every hex colour a template writes, whatever depth the snapshot nests it at. */
function coloursOf(value: unknown, out = new Set<string>()): Set<string> {
  if (Array.isArray(value)) {
    for (const item of value) coloursOf(item, out);
  } else if (value !== null && typeof value === 'object') {
    for (const [key, child] of Object.entries(value)) {
      if (
        COLOUR_KEYS.has(key) &&
        typeof child === 'string' &&
        child.startsWith('#')
      ) {
        out.add(child.toLowerCase());
      } else {
        coloursOf(child, out);
      }
    }
  }
  return out;
}

/**
 * The generic diagrams belong to no framework, and their greys are therefore
 * nobody's but the shared notation scale's. What is left once the scale is
 * taken out is the diagrams' own HUES — the kanban cards and the gantt bars —
 * and nothing else: a stray near-black or near-white here is a neutral that
 * escaped the scale.
 */
describe('the generic ("Other") templates', () => {
  it('draw every neutral from the shared notation scale', () => {
    const scale = new Set<string>(Object.values(NOTATION_NEUTRALS));
    const hues = new Set([
      // Kanban cards: fill and border per column.
      '#fde6c8',
      '#e0a23a',
      '#d6e4fb',
      '#4574c4',
      '#d5efd9',
      '#43a06b',
      // Gantt bars.
      '#2f9e95',
      '#d99a2b',
    ]);

    const { templates } = otherTemplateCategory;
    // The built-in category is authored eagerly; a lazy loader would be a
    // change of shape this test should hear about.
    if (!Array.isArray(templates)) throw new Error('expected eager templates');
    const found = coloursOf(templates.map(t => t.content));
    // The walk does reach the elements: the ink, the kanban column's card white and
    // the gantt's label grey are all in there.
    expect(found).toContain(NOTATION_NEUTRALS.ink);
    expect(found).toContain(NOTATION_NEUTRALS.cardFill);
    expect(found).toContain(NOTATION_NEUTRALS.label);

    const outside = [...found].filter(
      colour => !scale.has(colour) && !hues.has(colour)
    );
    expect(outside).toEqual([]);
  });
});

/**
 * The five generic templates speak the inserting editor's language: their
 * seeds (SWOT's four quadrant labels, Kanban's column headers, BMC's nine
 * section titles, Fishbone's category/item words, Gantt's phase names and
 * week header) go through the translation seam at placement (ADR 0016), like
 * a derived template's.
 */
describe('the generic templates localize their seeds', () => {
  type Snapshot = {
    blocks: { children: [{ props: { elements: Record<string, unknown> } }] };
  };
  const elementsOf = (content: unknown) =>
    (content as Snapshot).blocks.children[0].props.elements as Record<
      string,
      { text?: unknown }
    >;

  const hostWith = (
    t?: (
      key: string,
      params?: Record<string, string | number>
    ) => string | undefined
  ) =>
    ({
      getOptional: (id: unknown) =>
        id === TranslationProvider && t ? { t } : null,
    }) as unknown as BlockStdScope;

  const byName = (name: string) => {
    const { templates } = otherTemplateCategory;
    if (!Array.isArray(templates)) throw new Error('expected eager templates');
    const found = templates.find(t => t.name === name);
    if (!found) throw new Error(`no template named "${name}"`);
    return found;
  };

  for (const name of [
    'SWOT',
    'Kanban board',
    'Business model canvas',
    'Fishbone (Ishikawa)',
    'Gantt chart',
  ]) {
    it(`${name}: without a provider, localize returns exactly the content`, () => {
      const template = byName(name);
      expect(JSON.stringify(template.localize!(hostWith()))).toBe(
        JSON.stringify(template.content)
      );
    });
  }

  const insertOf = (el: unknown) =>
    (el as { text?: { delta?: { insert?: string }[] } }).text?.delta?.[0]
      ?.insert;

  it('SWOT: a fake provider changes every quadrant label', () => {
    const fr: Record<string, string> = {
      'com.labre.template.seed.swot-strengths': 'Forces',
      'com.labre.template.seed.swot-weaknesses': 'Faiblesses',
      'com.labre.template.seed.swot-opportunities': 'Opportunités',
      'com.labre.template.seed.swot-threats': 'Menaces',
    };
    const localized = elementsOf(
      byName('SWOT').localize!(hostWith(k => fr[k]))
    );
    const texts = Object.values(localized)
      .map(insertOf)
      .filter((text): text is string => typeof text === 'string');
    expect(texts.sort()).toEqual(Object.values(fr).sort());
  });

  it('Gantt chart: a fake provider translates the week header with its param', () => {
    const localized = elementsOf(
      byName('Gantt chart').localize!(
        hostWith((key, params) =>
          key === 'com.labre.template.seed.gantt-week'
            ? `S${params?.['n']}`
            : undefined
        )
      )
    );
    const weeks = Object.entries(localized)
      .filter(([id]) => id.startsWith('w'))
      .map(([, el]) => insertOf(el));
    expect(weeks).toEqual(['S1', 'S2', 'S3', 'S4', 'S5', 'S6']);
  });
});
