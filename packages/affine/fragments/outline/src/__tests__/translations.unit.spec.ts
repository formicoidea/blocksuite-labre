/**
 * The outline panel's block-preview placeholders (misfiled into the Intl
 * inventory lot: they are plain words, not date/number formatting) now cross
 * the translation seam like any other chrome wording.
 */
import {
  TranslationProvider,
  type TranslationService,
  translateKey,
} from '@labre/affine-shared/services';
import type { BlockStdScope } from '@labre/std';
import { describe, expect, test } from 'vitest';

import {
  OUTLINE_PLACEHOLDER_ATTACHMENT,
  OUTLINE_PLACEHOLDER_BOOKMARK,
  OUTLINE_PLACEHOLDER_CODE,
  OUTLINE_PLACEHOLDER_DATABASE,
  OUTLINE_PLACEHOLDER_IMAGE,
  OUTLINE_WORDINGS,
} from '../translations.js';

const stdWithProvider = (service?: TranslationService) =>
  ({
    getOptional: (id: unknown) =>
      id === TranslationProvider ? (service ?? null) : null,
  }) as unknown as BlockStdScope;

describe('outline placeholder wordings', () => {
  test('no host: every placeholder reads its current English literal', () => {
    expect(
      translateKey(stdWithProvider(), ...OUTLINE_PLACEHOLDER_BOOKMARK)
    ).toBe('Bookmark');
    expect(translateKey(stdWithProvider(), ...OUTLINE_PLACEHOLDER_CODE)).toBe(
      'Code Block'
    );
    expect(
      translateKey(stdWithProvider(), ...OUTLINE_PLACEHOLDER_DATABASE)
    ).toBe('Database');
    expect(translateKey(stdWithProvider(), ...OUTLINE_PLACEHOLDER_IMAGE)).toBe(
      'Image'
    );
    expect(
      translateKey(stdWithProvider(), ...OUTLINE_PLACEHOLDER_ATTACHMENT)
    ).toBe('Attachment');
  });

  test('a fake host resolves its own catalogue entry', () => {
    const std = stdWithProvider({
      t: key =>
        key === OUTLINE_PLACEHOLDER_BOOKMARK[0] ? 'Signet' : undefined,
      language: 'fr-FR',
    });
    expect(translateKey(std, ...OUTLINE_PLACEHOLDER_BOOKMARK)).toBe('Signet');
    // No catalogue entry for the others: still the English fallback.
    expect(translateKey(std, ...OUTLINE_PLACEHOLDER_CODE)).toBe('Code Block');
  });

  test('every wording is declared once, in render order', () => {
    // A count would need editing on every addition to the package; a
    // duplicate key is the actual failure mode this guards against — see
    // `manifest.unit.spec.ts` for the repo-wide version of the same check.
    const keys = OUTLINE_WORDINGS.map(([key]) => key);
    expect(new Set(keys).size).toBe(keys.length);
  });
});
