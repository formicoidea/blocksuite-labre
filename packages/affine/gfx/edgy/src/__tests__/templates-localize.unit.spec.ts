import { TranslationProvider } from '@labre/affine-shared/services';
import type { BlockStdScope } from '@labre/std';
import { describe, expect, it } from 'vitest';

import { edgyTemplateCategory } from '../templates';

/**
 * The four hand-composed scenes and the "EDGY dynamic" metamodel template
 * rebuild their seeds through {@link Template.localize} (`docs/adr/0016`):
 * without a host catalogue the rebuild must be byte-identical to the shipped
 * `content`, and with one every seed the card writes must come back in the
 * host's words. Mirrors BPMN's, C4's and Wardley's own
 * `templates-localize.unit.spec.ts`.
 */
const hostWith = (t?: (key: string, params?: unknown) => string | undefined) =>
  ({
    getOptional: (id: unknown) =>
      id === TranslationProvider && t ? { t } : undefined,
  }) as unknown as BlockStdScope;

const shipped = edgyTemplateCategory.templates;
if (typeof shipped === 'function') {
  throw new Error('the EDGY template category is expected to be eager');
}
const templates = shipped;

const named = (name: string) => {
  const found = templates.find(template => template.name === name);
  if (!found) throw new Error(`no template named "${name}"`);
  return found;
};

const HAND_COMPOSED = [
  'Facets overview',
  'Customer journey',
  'Service blueprint',
  'Organisation chart',
  'EDGY dynamic',
];

describe('every hand-composed EDGY template carries a localize rebuild', () => {
  it('lists the five', () => {
    for (const name of HAND_COMPOSED) {
      expect(named(name).localize, name).toBeDefined();
    }
  });

  it('without a provider, every localize rebuild equals the shipped content', () => {
    for (const name of HAND_COMPOSED) {
      const template = named(name);
      expect(JSON.stringify(template.localize!(hostWith())), name).toBe(
        JSON.stringify(template.content)
      );
    }
  });
});

/** The words a plain `text`-typed element carries, by its snapshot key. */
function textAt(content: unknown, elementKey: string): string | undefined {
  const elements = (
    content as {
      blocks: { children: { props: { elements: Record<string, unknown> } }[] };
    }
  ).blocks.children[0].props.elements as Record<
    string,
    { text?: { delta: { insert: string }[] } }
  >;
  return elements[elementKey]?.text?.delta.map(op => op.insert).join('');
}

describe('the four scenes speak the inserting editor’s language', () => {
  const shout = (key: string) => `[${key}]`.toUpperCase();

  it('"Facets overview" resolves its facet names and its two titles', () => {
    const localized = named('Facets overview').localize!(hostWith(shout));
    expect(textAt(localized, 'organisationN')).toBe(
      shout('com.labre.edgy.seed.organisation')
    );
    expect(textAt(localized, 'identity1')).toBe(
      shout('com.labre.edgy.seed.purpose')
    );
    expect(textAt(localized, 'fLabel')).toBe(
      shout('com.labre.edgy.seed.facets-title')
    );
    expect(textAt(localized, 'iLabel')).toBe(
      shout('com.labre.edgy.seed.intersections-title')
    );
  });

  it('"Customer journey" resolves its interpolated seeds and its verbs', () => {
    const localized = named('Customer journey').localize!(hostWith(shout));
    expect(textAt(localized, 'custL')).toBe(
      shout('com.labre.edgy.seed.customer')
    );
    expect(textAt(localized, 's1')).toBe(
      shout('com.labre.edgy.seed.journey-step')
    );
    expect(textAt(localized, 'c1')).toBe(
      shout('com.labre.edgy.seed.channel-n')
    );
    expect(textAt(localized, 't1')).toBe(shout('com.labre.edgy.seed.task-n'));
    expect(textAt(localized, 'trav1')).toBe(
      shout('com.labre.edgy.seed.verb-traverses')
    );
    expect(textAt(localized, 'use1')).toBe(
      shout('com.labre.edgy.seed.verb-uses')
    );
  });

  it('"Service blueprint" resolves its lane titles', () => {
    const localized = named('Service blueprint').localize!(hostWith(shout));
    expect(textAt(localized, 'laneL0')).toBe(
      shout('com.labre.edgy.seed.lane-physical-evidence')
    );
  });

  it('"Organisation chart" resolves its interpolated business units', () => {
    const localized = named('Organisation chart').localize!(hostWith(shout));
    expect(textAt(localized, 'org')).toBe(
      shout('com.labre.edgy.seed.organisation')
    );
    expect(textAt(localized, 'a')).toBe(
      shout('com.labre.edgy.seed.business-unit')
    );
    expect(textAt(localized, 'a1')).toBe(shout('com.labre.edgy.seed.group'));
  });

  it('"EDGY dynamic" resolves its twelve element names and its verbs', () => {
    const localized = named('EDGY dynamic').localize!(hostWith(shout));
    expect(textAt(localized, 'content')).toBe(
      shout('com.labre.edgy.seed.content')
    );
    expect(textAt(localized, 'rel0')).toBe(
      shout('com.labre.edgy.seed.verb-expresses')
    );
  });
});
