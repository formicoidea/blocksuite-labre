import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, test } from 'vitest';

import { getTranslationKeyManifest } from '../../translations.js';

/**
 * The exhaustiveness contract of `getTranslationKeyManifest`, in both
 * directions:
 *
 * - every `com.labre.*` key the LIBRARY SOURCE uses is in the manifest, so a
 *   host building its catalogue from it can never meet a key it never named;
 * - every manifest entry is used by somebody, so a renamed key cannot leave a
 *   ghost behind for a host to translate into nothing.
 *
 * The data-declared keys are in by construction (the manifest walks the
 * declarations themselves); this spec is what keeps the restated CHROME table
 * honest — its keys, its wordings, and its right to exist.
 *
 * It runs on the WHOLE REPO. The bundled distribution splits the manifest —
 * core's share plus one contribution per framework bundle — but the parts are
 * the same objects, so checking the monorepo assembly checks every part.
 */

const HERE = dirname(fileURLToPath(import.meta.url));
// …/packages/affine/all/src/__tests__/translations → repo root is 6 levels up.
const ROOT = join(HERE, '..', '..', '..', '..', '..', '..');

/** The library source: everything a host can import. Tests excluded. */
const SCAN_DIRS = ['packages/affine', 'packages/framework'];
const SKIP_DIRS = new Set(['node_modules', 'dist', '__tests__']);
/**
 * The manifest itself is NOT a use site. Scanning it would let `CHROME_KEYS`
 * justify its own entries, and the dead-entry check below would never fire.
 */
const SKIP_FILES = new Set([join('affine', 'all', 'src', 'translations.ts')]);

function sourceFiles(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (!SKIP_DIRS.has(entry.name)) sourceFiles(path, out);
    } else if (entry.name.endsWith('.ts') && !entry.name.includes('.spec.')) {
      if (![...SKIP_FILES].some(skip => path.endsWith(skip))) out.push(path);
    }
  }
  return out;
}

/** `'com.labre.…'` string literals. */
const LITERAL = /'(com\.labre\.[^']+)'/g;
/** The static prefix of a `` `com.labre.…${…}` `` template key. */
const TEMPLATE = /`(com\.labre\.[^`$]*)\$\{/g;
/**
 * A key and its fallback, adjacent single-quoted literals inside ONE argument
 * list. Deliberately not anchored on `translateKey(`: the wording reaches it
 * through local helpers too (`action(key, fallback, testid, …)`), and those
 * restatements need guarding just as much. A second `com.labre.*` literal is
 * a list of keys, not a wording, so it is excluded.
 */
const PAIR = /'(com\.labre\.[^']+)',\s*'(?!com\.labre\.)((?:[^'\\]|\\.)*)'/gs;
/**
 * The module-const form of the same pair — the repo's `<STEM>_KEY` /
 * `<STEM>_FALLBACK` convention, which is the SCREAMING_CASE of the
 * `<stem>Key` / `<stem>Fallback` convention the manifest walker derives from.
 */
const CONST_PAIR =
  /const\s+(\w+)_KEY\s*=\s*'(com\.labre\.[^']+)';\s*\n\s*const\s+\1_FALLBACK\s*=\s*'((?:[^'\\]|\\.)*)'/g;

const unescape = (literal: string) => literal.replaceAll("\\'", "'");

/** Keys the manifest derives from an exported table — nothing is restated. */
const CHROME_TABLE_PREFIXES = [
  // Walked out of `getCommands()`, with the sidepanel's own `humanizeCategory`
  // as the fallback — nothing is restated, so there is nothing to confirm.
  'com.labre.catalogue.category.',
  'com.labre.validation.severity.',
  'com.labre.validation.state.exempted.',
  'com.labre.reading.relations.consumers',
  'com.labre.reading.relations.suppliers',
];

/**
 * The residue: chrome wordings whose call site pairs no two literals, so the
 * scan can check the KEY but not the WORDING. Each one is a deliberate shape,
 * and the list is pinned so a new unpairable call site has to be looked at
 * rather than silently joining them.
 */
const UNPAIRABLE_CHROME_KEYS: string[] = [];

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
    expect(byKey.get('com.labre.wardley.reading.naming.activity')?.source).toBe(
      'reading'
    );
    expect(byKey.get('com.labre.command.tag.set')?.source).toBe('command');
    // The capability-gated command is enumerated too: a catalogue is built for
    // the whole library, not for one flag set.
    expect(byKey.get('com.labre.command.map.audit')).toBeDefined();
    // A chrome TABLE is walked, not restated: the wording comes from the widget.
    expect(byKey.get('com.labre.validation.severity.warning')).toEqual({
      key: 'com.labre.validation.severity.warning',
      fallback: 'Warning',
      source: 'chrome',
    });
  });

  test('the manifest and the library source agree, in both directions', () => {
    const files = SCAN_DIRS.flatMap(dir => sourceFiles(join(ROOT, dir)));
    expect(files.length).toBeGreaterThan(100);

    /** Full keys seen as literals. */
    const usedKeys = new Set<string>();
    /** Prefixes seen as template keys (or as a literal ending in `.`). */
    const usedPrefixes = new Set<string>();
    const missing: string[] = [];
    const drifted: string[] = [];
    /** Chrome keys whose WORDING the scan could confirm. */
    const confirmed = new Set<string>();

    for (const file of files) {
      const src = readFileSync(file, 'utf8');

      for (const [, key] of src.matchAll(LITERAL)) {
        if (key.endsWith('.')) usedPrefixes.add(key);
        else usedKeys.add(key);
      }
      for (const [, prefix] of src.matchAll(TEMPLATE)) {
        usedPrefixes.add(prefix);
      }

      const pairs = [
        ...[...src.matchAll(PAIR)].map(m => [m[1], m[2]] as const),
        ...[...src.matchAll(CONST_PAIR)].map(m => [m[2], m[3]] as const),
      ];
      for (const [key, fallback] of pairs) {
        confirmed.add(key);
        const declared = byKey.get(key)?.fallback;
        if (declared !== unescape(fallback)) {
          drifted.push(
            `${key}: source says ${JSON.stringify(unescape(fallback))}, ` +
              `manifest says ${JSON.stringify(declared)} (${file})`
          );
        }
      }
    }

    const covered = (key: string) =>
      byKey.has(key) || manifest.some(entry => entry.key.startsWith(key));
    for (const key of usedKeys) if (!covered(key)) missing.push(key);
    for (const prefix of usedPrefixes) {
      if (!manifest.some(entry => entry.key.startsWith(prefix))) {
        missing.push(`${prefix}*`);
      }
    }
    expect(missing.sort(), 'keys used but absent from the manifest').toEqual(
      []
    );

    // The other direction: an entry nobody uses is a key a host would
    // translate for nothing — a rename that left its old name behind.
    const dead = manifest
      .map(entry => entry.key)
      .filter(
        key =>
          !usedKeys.has(key) &&
          ![...usedPrefixes].some(prefix => key.startsWith(prefix))
      );
    expect(dead.sort(), 'manifest entries no source uses').toEqual([]);

    expect(drifted.sort(), 'restated fallbacks that drifted').toEqual([]);

    // What the drift check CANNOT see, pinned so the limit stays known.
    // Every chrome wording restated in `CHROME_KEYS` must be confirmed
    // against the widget that renders it; the table-walked ones are not
    // restated at all, so there is nothing to confirm.
    const chromeLiterals = manifest.filter(
      entry =>
        entry.source === 'chrome' &&
        !CHROME_TABLE_PREFIXES.some(prefix => entry.key.startsWith(prefix))
    );
    expect(
      chromeLiterals
        .map(entry => entry.key)
        .filter(key => !confirmed.has(key))
        .sort(),
      'chrome wordings the scan could not pair with their call site'
    ).toEqual(UNPAIRABLE_CHROME_KEYS);
    // ~2.8k files read synchronously: ~3s warm, but 20s+ on a cold NTFS cache.
  }, 90_000);
});
