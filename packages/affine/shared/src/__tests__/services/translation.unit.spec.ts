/**
 * The translation seam's two library-side duties: fall back to the English
 * wording when the host has no entry, and fill that wording's `{{name}}`
 * placeholders — while handing the same `params` to a host that does answer,
 * since interpolating (and pluralising) its own translation is its job.
 */
import type { BlockStdScope } from '@labre/std';
import { describe, expect, test } from 'vitest';

import {
  fillPlaceholders,
  formatLocale,
  hostLanguage,
  hostLocale,
  TranslationProvider,
  type TranslationService,
  translateKey,
} from '../../services/translation-service/index.js';

const stdWith = (service?: TranslationService) =>
  ({
    getOptional: (id: unknown) =>
      id === TranslationProvider ? (service ?? null) : null,
  }) as unknown as BlockStdScope;

describe('fillPlaceholders', () => {
  test('fills every named hole, numbers included', () => {
    expect(
      fillPlaceholders('{{count}} of {{ name }} kept', { count: 3, name: 'a' })
    ).toBe('3 of a kept');
  });

  test('leaves a hole with no value visible rather than empty', () => {
    expect(fillPlaceholders('Upload {{name}}', {})).toBe('Upload {{name}}');
    expect(fillPlaceholders('Upload {{name}}')).toBe('Upload {{name}}');
  });
});

describe('translateKey with params', () => {
  test('no host: the fallback is filled', () => {
    expect(
      translateKey(stdWith(), 'k', 'Failed to upload {{name}}', { name: 'x' })
    ).toBe('Failed to upload x');
  });

  test('a host that answers receives the params and is trusted', () => {
    const seen: unknown[] = [];
    const std = stdWith({
      t: (_key, params) => {
        seen.push(params);
        return `Échec : ${params?.name}`;
      },
    });
    expect(translateKey(std, 'k', 'Failed {{name}}', { name: 'x' })).toBe(
      'Échec : x'
    );
    expect(seen).toEqual([{ name: 'x' }]);
  });

  test('a host with no entry falls back, filled', () => {
    const std = stdWith({ t: () => undefined });
    expect(translateKey(std, 'k', '{{count}} element(s)', { count: 2 })).toBe(
      '2 element(s)'
    );
  });
});

describe('hostLocale', () => {
  test('keeps the region that hostLanguage drops', () => {
    const std = stdWith({ t: () => undefined, language: 'fr-CA' });
    expect(hostLocale(std)).toBe('fr-CA');
    expect(hostLanguage(std)).toBe('fr');
  });

  test('says nothing when the host said nothing', () => {
    expect(hostLocale(stdWith())).toBeUndefined();
    expect(hostLocale(stdWith({ t: () => undefined, language: '' }))).toBe(
      undefined
    );
  });
});

describe('formatLocale', () => {
  test('no host: falls back to en-US, not the runtime default', () => {
    expect(formatLocale(stdWith())).toBe('en-US');
  });

  test('a host that said a language wins', () => {
    const std = stdWith({ t: () => undefined, language: 'fr-FR' });
    expect(formatLocale(std)).toBe('fr-FR');
  });
});
