/**
 * The "@" menu's "Link to Doc" group counts the docs it cannot show inline
 * ("1,234 more docs"). The count is locale-sensitive (thousands separator),
 * so it goes through `Intl.NumberFormat(formatLocale(std))` rather than
 * template-literal concatenation.
 */
import {
  DocModeProvider,
  type TranslationService,
} from '@labre/affine-shared/services';
import type { AffineInlineEditor } from '@labre/affine-shared/types';
import type { BlockStdScope, EditorHost } from '@labre/std';
import { describe, expect, test } from 'vitest';

import { createLinkedDocMenuGroup } from '../config.js';

const DOC_COUNT = 1240; // MAX_DOCS (6) below it, leaving a count of 1234.

function fakeEditorHost(translation?: TranslationService): EditorHost {
  const docMetas = Array.from({ length: DOC_COUNT }, (_, i) => ({
    id: `doc-${i}`,
    title: `Doc ${i}`,
  }));

  const std = {
    get: (id: unknown) => {
      if (id === DocModeProvider) {
        return { getPrimaryMode: () => 'page' as const };
      }
      throw new Error('unexpected std.get in test fake');
    },
    getOptional: () => translation,
  } as unknown as BlockStdScope;

  return {
    store: {
      id: 'current-doc',
      workspace: { meta: { docMetas } },
    },
    std,
  } as unknown as EditorHost;
}

describe('createLinkedDocMenuGroup overflowText', () => {
  test('no host: formats the count in English', () => {
    const group = createLinkedDocMenuGroup(
      '',
      () => {},
      fakeEditorHost(),
      {} as AffineInlineEditor
    );
    expect(group.overflowText).toBe('1,234 more docs');
  });

  test('a host that says fr-FR formats the count in French', () => {
    const group = createLinkedDocMenuGroup(
      '',
      () => {},
      fakeEditorHost({ t: () => undefined, language: 'fr-FR' }),
      {} as AffineInlineEditor
    );
    expect(group.overflowText).toBe(
      `${new Intl.NumberFormat('fr-FR').format(1234)} more docs`
    );
  });
});
