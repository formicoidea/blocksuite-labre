import { TranslationProvider } from '@labre/affine-shared/services';
import type { BlockStdScope } from '@labre/std';
import { describe, expect, it } from 'vitest';

import { mindmapTemplateCategory } from '../templates';

/**
 * The four starter mindmap templates speak the inserting editor's language:
 * their seeds (the root "Mind Map" caption, the three "Topic N" children) go
 * through the translation seam at placement (ADR 0016), like a derived
 * template's.
 */
describe('the mindmap starter templates localize their seeds', () => {
  type Snapshot = {
    blocks: { children: [{ props: { elements: Record<string, unknown> } }] };
  };
  const elementsOf = (content: unknown) =>
    (content as Snapshot).blocks.children[0].props.elements as Record<
      string,
      { text?: { delta?: { insert?: string }[] } }
    >;

  const hostWith = (t?: (key: string) => string | undefined) =>
    ({
      getOptional: (id: unknown) =>
        id === TranslationProvider && t ? { t } : null,
    }) as unknown as BlockStdScope;

  const { templates } = mindmapTemplateCategory;
  if (!Array.isArray(templates)) throw new Error('expected eager templates');

  for (const template of templates) {
    it(`${template.name}: without a provider, localize returns exactly the content`, () => {
      expect(JSON.stringify(template.localize!(hostWith()))).toBe(
        JSON.stringify(template.content)
      );
    });
  }

  it('Style 1: a fake provider changes the root and all three topics', () => {
    const fr: Record<string, string> = {
      'com.labre.mindmap.seed.root': 'Carte mentale',
      'com.labre.mindmap.seed.topic-1': 'Sujet 1',
      'com.labre.mindmap.seed.topic-2': 'Sujet 2',
      'com.labre.mindmap.seed.topic-3': 'Sujet 3',
    };
    const style1 = templates.find(t => t.name === 'Mind Map — Style 1')!;
    const localized = elementsOf(style1.localize!(hostWith(k => fr[k])));
    const texts = Object.values(localized)
      .map(el => el.text?.delta?.[0]?.insert)
      .filter((text): text is string => typeof text === 'string');
    expect(texts.sort()).toEqual(Object.values(fr).sort());
  });
});
