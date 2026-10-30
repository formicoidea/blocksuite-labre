/**
 * GUARD — every wording the database packages declare reaches a manifest.
 *
 * `SOURCE_SEARCH_PLACEHOLDER` and `SOURCE_SEARCH_CREATE` (2.1) were drawn
 * by the source lists but left out of `databaseEditorTranslationEntries`:
 * the Labre catalogue test saw their keys as orphans, and a host composing
 * the bundle's manifest could not translate them (labre integration of
 * 2.3.3). What it would have caught: an exported `ChromeWording` of the
 * editor's `translations.ts` missing from its entries, or one of the
 * block's missing from `DATABASE_WORDINGS` (core's manifest).
 */
import * as blockTranslations from '@labre/affine-database-block/translations';
import { describe, expect, test } from 'vitest';

import * as editorTranslations from '../translations.js';

const isWording = (value: unknown): value is readonly [string, string] =>
  Array.isArray(value) &&
  value.length === 2 &&
  typeof value[0] === 'string' &&
  value[0].startsWith('com.labre.') &&
  typeof value[1] === 'string';

const declaredKeys = (module: Record<string, unknown>) =>
  Object.values(module)
    .filter(isWording)
    .map(([key]) => key)
    .sort();

/**
 * Words the editor restates but another package declares (one chrome word,
 * one key: the engine, the catalogue, the frame toolbar), each said so in
 * `translations.ts`. Only these may stay out of the editor's entries; a
 * wording of its own is listed or this spec fails.
 */
const RESTATED = new Set([
  'com.labre.catalogue.close',
  'com.labre.data-view.color-rules',
  'com.labre.data-view.open-in',
  'com.labre.database.properties-panel.title',
  'com.labre.database.view-menu.group',
  'com.labre.database.view-menu.layout',
  'com.labre.database.view-menu.save-template',
]);

describe('database wordings and their manifests', () => {
  test('every wording the editor declares is in databaseEditorTranslationEntries', () => {
    const listed = new Set(
      editorTranslations.databaseEditorTranslationEntries.map(e => e.key)
    );
    expect(
      declaredKeys(editorTranslations).filter(
        key => !listed.has(key) && !RESTATED.has(key)
      )
    ).toEqual([]);
  });

  test('every wording the block declares is in DATABASE_WORDINGS', () => {
    const listed = new Set(
      blockTranslations.DATABASE_WORDINGS.map(([key]) => key)
    );
    expect(
      declaredKeys(blockTranslations).filter(key => !listed.has(key))
    ).toEqual([]);
  });
});
