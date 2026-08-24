import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, test } from 'vitest';

import { getTranslationKeyManifest } from '../../translations.js';

/**
 * The exhaustiveness contract of `getTranslationKeyManifest`: every
 * `com.labre.*` key the LIBRARY SOURCE uses must be in the manifest, so a host
 * building its catalogue from the manifest can never meet a key the manifest
 * never named. The data-declared keys are in by construction (the manifest
 * walks the declarations themselves); this spec is what keeps the restated
 * CHROME table honest — both its keys and its fallback wordings.
 */

const HERE = dirname(fileURLToPath(import.meta.url));
// …/packages/affine/all/src/__tests__/translations → repo root is 6 levels up.
const ROOT = join(HERE, '..', '..', '..', '..', '..', '..');

/** The library source: everything a host can import. Tests excluded. */
const SCAN_DIRS = ['packages/affine', 'packages/framework'];
const SKIP_DIRS = new Set(['node_modules', 'dist', '__tests__']);

function sourceFiles(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (!SKIP_DIRS.has(entry.name)) sourceFiles(path, out);
    } else if (entry.name.endsWith('.ts') && !entry.name.includes('.spec.')) {
      out.push(path);
    }
  }
  return out;
}

/** `'com.labre.…'` string literals. Keys reserved to specs are not keys. */
const LITERAL = /'(com\.labre\.[^']+)'/g;
/** The static prefix of a `` `com.labre.…${…}` `` template key. */
const TEMPLATE = /`(com\.labre\.[^`$]*)\$\{/g;
/**
 * A whole `translateKey(std, 'key', 'fallback')` call whose key AND fallback
 * are single-quoted literals in the same call — the pairs whose wording the
 * manifest restates and must not let drift.
 */
const PAIR = /translateKey\(\s*[\w.$]+,\s*'(com\.labre\.[^']+)',\s*'((?:[^'\\]|\\.)*)'/gs;

describe('getTranslationKeyManifest', () => {
  const manifest = getTranslationKeyManifest();
  const byKey = new Map(manifest.map(entry => [entry.key, entry]));

  test('keys are unique, namespaced and sorted', () => {
    expect(manifest.length).toBeGreaterThan(100);
    expect(byKey.size).toBe(manifest.length);
    for (const { key } of manifest) {
      expect(key).toMatch(/^com\.labre\./);
    }
  });

  test('declared data flows in with its fallback', () => {
    // One entry per kind, pinned end to end.
    expect(byKey.get('com.labre.framework.wardley')?.source).toBe('framework');
    expect(byKey.get('com.labre.wardley.role.dependency')).toEqual({
      key: 'com.labre.wardley.role.dependency',
      fallback: 'Dependency',
      source: 'role',
    });
    expect(
      byKey.get('com.labre.wardley.validation.provider-above-consumer')?.source
    ).toBe('rule');
    expect(byKey.get('com.labre.wardley.profile.sketch')?.fallback).toBe(
      'Sketch'
    );
    expect(
      byKey.get('com.labre.wardley.reading.naming.activity')?.source
    ).toBe('reading');
    expect(byKey.get('com.labre.command.tag.set')?.source).toBe('command');
    // The capability-gated command is enumerated too: a catalogue is built for
    // the whole library, not for one flag set.
    expect(byKey.get('com.labre.command.map.audit')).toBeDefined();
  });

  test(
    'every com.labre.* key used in the library source is in the manifest',
    () => {
      const files = SCAN_DIRS.flatMap(dir => sourceFiles(join(ROOT, dir)));
      expect(files.length).toBeGreaterThan(100);

      const missing: string[] = [];
      const drifted: string[] = [];

      for (const file of files) {
        const src = readFileSync(file, 'utf8');

        for (const [, key] of src.matchAll(LITERAL)) {
          if (key.startsWith('com.labre.test.')) continue;
          const covered = key.endsWith('.')
            ? manifest.some(entry => entry.key.startsWith(key))
            : byKey.has(key);
          if (!covered) missing.push(`${key} (${file})`);
        }

        for (const [, prefix] of src.matchAll(TEMPLATE)) {
          if (!manifest.some(entry => entry.key.startsWith(prefix))) {
            missing.push(`${prefix}* (${file})`);
          }
        }

        for (const [, key, fallback] of src.matchAll(PAIR)) {
          const declared = byKey.get(key)?.fallback;
          if (declared !== fallback.replaceAll("\\'", "'")) {
            drifted.push(
              `${key}: source says ${JSON.stringify(fallback)}, ` +
                `manifest says ${JSON.stringify(declared)} (${file})`
            );
          }
        }
      }

      expect(missing, 'keys used but absent from the manifest').toEqual([]);
      expect(drifted, 'fallbacks restated by the manifest that drifted').toEqual(
        []
      );
    },
    15_000
  );
});
