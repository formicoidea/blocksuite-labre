import { TranslationProvider } from '@labre/affine-shared/services';
import type { BlockStdScope } from '@labre/std';
import { describe, expect, it } from 'vitest';

import { c4TemplateCategory } from '../templates';

/**
 * Every C4 template is DERIVED (`templateFromCommand`), so `Template.localize`
 * comes for free the moment the command's own action resolves its seeds
 * through `translateKey` — which `createC4Node` and `createC4Boundary` now do
 * for the title, description and boundary-name tiers (#278). This file proves
 * the wiring actually reaches the shipped palette, the same way BPMN's
 * `templates-localize.unit.spec.ts` proves it for its two hand-composed
 * scenes.
 */
const hostWith = (t?: (key: string, params?: unknown) => string | undefined) =>
  ({
    getOptional: (id: unknown) =>
      id === TranslationProvider && t ? { t } : undefined,
  }) as unknown as BlockStdScope;

const templates = c4TemplateCategory.templates;
if (typeof templates === 'function') {
  throw new Error('the C4 template category is expected to be eager');
}

const named = (name: string) => {
  const found = templates.find(template => template.name === name);
  if (!found) throw new Error(`no template named "${name}"`);
  return found;
};

/** The words one `text` element of a snapshot carries. */
function textOf(content: unknown, roleId: string): string | undefined {
  const elements = (
    content as {
      blocks: { children: { props: { elements: Record<string, unknown> } }[] };
    }
  ).blocks.children[0].props.elements as Record<
    string,
    { role?: string; text?: { delta: { insert: string }[] } }
  >;
  const element = Object.values(elements).find(el => el.role === roleId);
  return element?.text?.delta.map(op => op.insert).join('');
}

describe('every C4 template is derived, so localize comes for free', () => {
  it('every shipped template carries a localize rebuild', () => {
    expect(templates.length).toBeGreaterThan(0);
    for (const template of templates) {
      expect(template.localize, template.name).toBeDefined();
    }
  });

  it('without a provider, every localize rebuild equals the shipped content', () => {
    for (const template of templates) {
      expect(
        JSON.stringify(template.localize!(hostWith())),
        template.name
      ).toBe(JSON.stringify(template.content));
    }
  });
});

describe('a placed component speaks the inserting editor’s language', () => {
  const shout = (key: string) => `[${key}]`.toUpperCase();

  it('"Person" resolves its title through the host catalogue', () => {
    const localized = named('Person').localize!(hostWith(shout));
    expect(textOf(localized, 'c4:title')).toBe(
      shout('com.labre.c4.seed.person')
    );
    // The description tier resolves too — same mechanism, different key.
    expect(textOf(localized, 'c4:description')).toBe(
      shout('com.labre.c4.seed.description-placeholder')
    );
  });

  it('"System boundary" resolves its name through the host catalogue', () => {
    const localized = named('System boundary').localize!(hostWith(shout));
    const elements = (
      localized as {
        blocks: {
          children: {
            props: { elements: Record<string, { name?: string }> };
          }[];
        };
      }
    ).blocks.children[0].props.elements;
    const boundary = Object.values(elements).find(el => el.name !== undefined);
    expect(boundary?.name).toBe(shout('com.labre.c4.seed.boundary-system'));
  });

  /**
   * The type line is SEMI-derived (`type-line.ts`): the bracketed word comes
   * from `kind`, the technology slot is a prompt. Both halves go through
   * `c4TypePlaceholder`, which is `translateKey` under the hood — so a
   * "Container" dropped in a translated host starts with a type line in that
   * language, exactly like the title and description tiers above (#3 of this
   * lot: the type line no longer stays English-only at placement).
   */
  it('"Container" resolves its type line through the host catalogue', () => {
    const localized = named('Container').localize!(hostWith(shout));
    expect(textOf(localized, 'c4:type-line')).toBe(
      `[${shout('com.labre.c4.type.container')}: ${shout('com.labre.c4.type.technology-placeholder')}]`
    );
  });

  it('"Person" — which states no technology — resolves only the bracketed word', () => {
    const localized = named('Person').localize!(hostWith(shout));
    expect(textOf(localized, 'c4:type-line')).toBe(
      `[${shout('com.labre.c4.type.person')}]`
    );
  });
});
