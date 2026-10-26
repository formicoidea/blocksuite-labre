import { TranslationExtension } from '@labre/affine-shared/services';
import { Container } from '@labre/global/di';
import type { BlockStdScope } from '@labre/std';
import { describe, expect, it } from 'vitest';

import {
  TemplateCategoryExtension,
  templateManagerFor,
} from '../contribute.js';
import { builtInTemplates } from '../toolbar/builtin-templates.js';
import type { TemplateCategory } from '../toolbar/template-type.js';

/**
 * The Templates panel's search box over the built-in `Other` category.
 *
 * Until 0.58 `builtInTemplates.search` walked `Object.entries(templates)` of
 * an ARRAY and matched the keyword against the indexes "0", "1", …: SWOT,
 * Kanban, BMC, Fishbone and Gantt never came up, whatever was typed, while a
 * framework's category next to them was found. This spec holds that both
 * halves answer the same predicate, on the English name and on the name the
 * host translated.
 */

const contributed: TemplateCategory = {
  name: 'Lazy',
  templates: () =>
    Promise.resolve([{ name: 'Value stream', content: {}, type: 'template' }]),
};

function stdWith(t?: (key: string) => string | undefined): BlockStdScope {
  const container = new Container();
  TemplateCategoryExtension(contributed).setup(container);
  if (t) TranslationExtension({ t, language: 'fr' }).setup(container);
  const provider = container.provider();
  return {
    provider,
    getOptional: provider.getOptional.bind(provider),
  } as unknown as BlockStdScope;
}

const names = (found: { name?: string }[]) => found.map(t => t.name);

describe('template search', () => {
  it('finds a built-in template by its name, case-insensitively', async () => {
    expect(names(await builtInTemplates.search('swot'))).toEqual(['SWOT']);
    expect(names(await templateManagerFor(stdWith()).search('swot'))).toEqual([
      'SWOT',
    ]);
    expect(names(await builtInTemplates.search('KANBAN', 'Other'))).toEqual([
      'Kanban board',
    ]);
  });

  it('finds a built-in template by its translated name', async () => {
    const std = stdWith(key =>
      key === 'com.labre.template.name.kanban-board'
        ? 'Tableau de tâches'
        : undefined
    );

    expect(names(await templateManagerFor(std).search('tâches'))).toEqual([
      'Kanban board',
    ]);
  });

  it('finds a contributed lazy category template by keyword, beside the built-in ones', async () => {
    const catalogue = templateManagerFor(stdWith());

    expect(names(await catalogue.search('stream'))).toEqual(['Value stream']);
    // One keyword across both halves, built-in first (the tab order).
    expect(names(await catalogue.search('a'))).toEqual(
      expect.arrayContaining(['Kanban board', 'Value stream'])
    );
    expect(names(await catalogue.search('stream', 'Other'))).toEqual([]);
  });
});
