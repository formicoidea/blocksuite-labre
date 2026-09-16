import { surfaceText } from '@labre/affine-gfx-template';
import { TranslationProvider } from '@labre/affine-shared/services';
import type { BlockStdScope } from '@labre/std';
import { describe, expect, it } from 'vitest';

import { aggregateTemplateCategory } from '../templates';

describe('aggregate template category', () => {
  it('exposes a single Aggregate Design Canvas template', () => {
    expect(aggregateTemplateCategory.name).toBe('Aggregate Design Canvas');
    const names = (
      aggregateTemplateCategory.templates as { name?: string }[]
    ).map(t => t.name);
    expect(names).toEqual(['Aggregate Design Canvas']);
  });
});

describe('the Aggregate Design Canvas speaks the inserting editor’s language', () => {
  const template = (
    aggregateTemplateCategory.templates as {
      content: unknown;
      localize?: (std: BlockStdScope) => unknown;
    }[]
  )[0];

  type Snapshot = {
    blocks: { children: [{ props: { elements: Record<string, unknown> } }] };
  };

  const elementsOf = (content: unknown) =>
    (content as Snapshot).blocks.children[0].props.elements as Record<
      string,
      { text?: unknown }
    >;

  const hostWith = (t?: (key: string) => string | undefined) =>
    ({
      getOptional: (id: unknown) =>
        id === TranslationProvider && t ? { t } : null,
    }) as unknown as BlockStdScope;

  it('without a provider, localize returns exactly the English content', () => {
    expect(JSON.stringify(template.localize!(hostWith()))).toBe(
      JSON.stringify(template.content)
    );
  });

  it('localizes the header and every section title through the host provider', () => {
    const fr: Record<string, string> = {
      'com.labre.ddd-aggregate.seed.header': 'Canevas de conception d’agrégat',
      'com.labre.ddd-aggregate.seed.name': '1. Nom',
      'com.labre.ddd-aggregate.seed.description': '2. Description',
      'com.labre.ddd-aggregate.seed.state-transitions': '3. Transitions d’état',
      'com.labre.ddd-aggregate.seed.enforced-invariants':
        '4. Invariants appliqués',
      'com.labre.ddd-aggregate.seed.corrective-policies':
        '5. Politiques correctives',
      'com.labre.ddd-aggregate.seed.handled-commands': '6. Commandes traitées',
      'com.labre.ddd-aggregate.seed.created-events': '7. Événements créés',
      'com.labre.ddd-aggregate.seed.throughput': '8. Débit',
      'com.labre.ddd-aggregate.seed.size': '9. Taille',
    };
    const localized = elementsOf(template.localize!(hostWith(key => fr[key])));

    expect(localized['headerTitle']!.text).toEqual(
      surfaceText(fr['com.labre.ddd-aggregate.seed.header']!)
    );
    expect(localized['nameTitle']!.text).toEqual(
      surfaceText(fr['com.labre.ddd-aggregate.seed.name']!)
    );
    expect(localized['sizeTitle']!.text).toEqual(
      surfaceText(fr['com.labre.ddd-aggregate.seed.size']!)
    );

    // Untranslated content is exactly the English build.
    const english = elementsOf(template.content);
    expect(english['headerTitle']!.text).toEqual(
      surfaceText('Aggregate Design Canvas')
    );
    expect(english['nameTitle']!.text).toEqual(surfaceText('1. Name'));
  });
});
