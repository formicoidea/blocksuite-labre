import { TranslationProvider } from '@labre/affine-shared/services';
import type { BlockStdScope } from '@labre/std';
import { describe, expect, it } from 'vitest';

import { wardleyMaps } from '../templates/maps';

/**
 * The two shipped maps rebuild their seeds through {@link Template.localize}
 * (`docs/adr/0016`): without a host catalogue the rebuild must be
 * byte-identical to the shipped `content`, and with one every seed the map
 * writes must come back in the host's words. Mirrors BPMN's
 * `templates-localize.unit.spec.ts` and C4's, one framework over.
 */
const hostWith = (t?: (key: string, params?: unknown) => string | undefined) =>
  ({
    getOptional: (id: unknown) =>
      id === TranslationProvider && t ? { t } : undefined,
  }) as unknown as BlockStdScope;

const named = (name: string) => {
  const found = wardleyMaps.find(template => template.name === name);
  if (!found) throw new Error(`no template named "${name}"`);
  return found;
};

describe('the two shipped Wardley maps rebuild their seeds', () => {
  it('carries a localize rebuild', () => {
    for (const template of wardleyMaps) {
      expect(template.localize, template.name).toBeDefined();
    }
  });

  it('without a provider, the rebuild equals the shipped content', () => {
    for (const template of wardleyMaps) {
      expect(
        JSON.stringify(template.localize!(hostWith())),
        template.name
      ).toBe(JSON.stringify(template.content));
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

describe('"Tea Shop" speaks the inserting editor’s language', () => {
  const shout = (key: string) => `[${key}]`.toUpperCase();

  it('resolves its title and its component names', () => {
    const localized = named('Tea Shop').localize!(hostWith(shout));
    expect(textAt(localized, 'title')).toBe(
      shout('com.labre.wardley.example.tea-shop.title')
    );
    expect(textAt(localized, 'cupOfTeaL')).toBe(
      shout('com.labre.wardley.example.tea-shop.cup-of-tea')
    );
    expect(textAt(localized, 'limitedBy')).toBe(
      shout('com.labre.wardley.example.tea-shop.limited-by')
    );
  });
});

describe('"Kodak inertia" speaks the inserting editor’s language', () => {
  const shout = (key: string) => `[${key}]`.toUpperCase();

  it('resolves its title and its component names', () => {
    const localized = named('Kodak inertia').localize!(hostWith(shout));
    expect(textAt(localized, 'title')).toBe(
      shout('com.labre.wardley.example.kodak-inertia.title')
    );
    expect(textAt(localized, 'digitalL')).toBe(
      shout('com.labre.wardley.example.kodak-inertia.digital-camera')
    );
  });
});
