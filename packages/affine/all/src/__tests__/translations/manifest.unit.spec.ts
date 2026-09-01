import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { bpmnTranslationEntries } from '@labre/affine-gfx-bpmn';
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
 * The same pair with a DOUBLE-quoted wording, which is not a style choice: a
 * sentence containing an apostrophe ("a pool of Labre's own") is written with
 * double quotes by prettier, and a drift check that only read single quotes
 * would quietly stop covering exactly the wordings that are hardest to
 * translate.
 */
const PAIR_DQ = /'(com\.labre\.[^']+)',\s*"((?:[^"\\]|\\.)*)"/gs;
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
  'com.labre.validation.provenance.',
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

  /**
   * The six families of #182 / #183, pinned key by key.
   *
   * Two claims per entry, and both matter to a host: the KEY is in the manifest
   * (so the catalogue's non-drift test picks it up at the next bump), and the
   * FALLBACK is letter for letter the English the editor used to hard-code (so
   * registering no `TranslationProvider` changes nothing on screen).
   */
  const pinned = (key: string, fallback: string, source = 'chrome') =>
    expect(byKey.get(key), key).toEqual({ key, fallback, source });

  test('the core toasts crossed the seam (#182)', () => {
    pinned('com.labre.toast.copied-to-clipboard', 'Copied to clipboard');
    pinned('com.labre.toast.linked-doc-created', 'Linked doc created');
    pinned(
      'com.labre.toast.note-removed-from-page-mode',
      'Note removed from Page Mode'
    );
    pinned(
      'com.labre.toast.frame-inserted-into-page',
      'Frame inserted into Page.'
    );
    pinned('com.labre.toast.no-link-found', 'No link found');
  });

  test('the board toolbars and the editor chrome crossed it (#183)', () => {
    // One tooltip for every framework board, and the two legend wordings.
    pinned('com.labre.board.toolbar.resize-toggle', 'Enable / lock resizing');
    pinned(
      'com.labre.board.toolbar.legend',
      'Generate the legend (notation present)'
    );
    pinned(
      'com.labre.board.toolbar.legend.components',
      'Generate the legend (components present)'
    );

    // The editor's own verbs, shared by every block toolbar that offers them.
    pinned('com.labre.toolbar.bring-to-front', 'Bring to Front');
    pinned('com.labre.toolbar.send-to-back', 'Send to Back');
    pinned('com.labre.toolbar.copy', 'Copy');
    pinned('com.labre.toolbar.duplicate', 'Duplicate');
    pinned('com.labre.toolbar.delete', 'Delete');
    pinned('com.labre.toolbar.lock', 'Lock');
    pinned('com.labre.toolbar.more', 'More');
    pinned('com.labre.toolbar.link', 'Link');
    pinned('com.labre.toolbar.create-linked-doc', 'Create linked doc');
    pinned('com.labre.toolbar.draw-connector', 'Draw connector');
    pinned('com.labre.toolbar.switch-view', 'Switch view');
    pinned('com.labre.toolbar.inline-view', 'Inline view');
    pinned('com.labre.toolbar.card-view', 'Card view');
    pinned('com.labre.toolbar.embed-view', 'Embed view');

    // …and what a linked-doc card says when there is nothing to preview.
    pinned('com.labre.embed.linked-doc.deleted', 'This linked doc is deleted.');
    pinned(
      'com.labre.embed.linked-doc.empty-preview',
      'Preview of the doc will be displayed here.'
    );
  });

  test('the BPMN import remarks with a fixed wording carry a key', () => {
    pinned(
      'com.labre.bpmn.import.remark.invented-pool',
      'This file names no participant, so its process was drawn in a pool of ' +
        "Labre's own. The pool is not the file's: exporting writes the process " +
        'back without one.'
    );
    expect(
      byKey.get('com.labre.bpmn.import.remark.lane-gap')?.fallback
    ).toContain('Labre lays its bands end to end');
    expect(
      byKey.get('com.labre.bpmn.import.remark.must-understand')?.fallback
    ).toContain('MUST be understood');
  });

  test('a framework carries its own catalogue headers (#183)', () => {
    // BPMN's categories, which core's registry knows nothing about once the
    // bundler has stripped the framework groups out of it. The fallback is the
    // panel's own `humanizeCategory`, so a bundled host with no catalogue
    // reads a word rather than a raw key.
    for (const [category, header] of [
      ['events', 'Events'],
      ['activities', 'Activities'],
      ['gateways', 'Gateways'],
      ['flows', 'Flows'],
      ['swimlanes', 'Swimlanes'],
      ['data', 'Data'],
      ['annotations', 'Annotations'],
      ['interchange', 'Interchange'],
    ] as const) {
      pinned(`com.labre.catalogue.category.${category}`, header);
    }
    // The composed BUNDLE gets them too — the point of the whole change: they
    // are in the framework's own contribution, not only in core's walk of
    // `getCommands()`.
    const bpmnKeys = new Set(bpmnTranslationEntries.map(entry => entry.key));
    expect(bpmnKeys.has('com.labre.catalogue.category.events')).toBe(true);
    expect(bpmnKeys.has('com.labre.catalogue.category.gateways')).toBe(true);
  });

  test('a placed artefact is seeded through the seam, not from a literal', () => {
    // Resolved at PLACEMENT: the fallback is the very word the canvas used to
    // be given, so an English host draws exactly what it drew before.
    pinned('com.labre.bpmn.seed.task', 'Task', 'seed');
    pinned('com.labre.bpmn.seed.subProcess', 'Sub-process', 'seed');
    pinned('com.labre.bpmn.seed.group', 'Group', 'seed');
    pinned('com.labre.edgy.seed.people', 'People', 'seed');
    pinned('com.labre.edgy.seed.activity', 'Activity', 'seed');
    // A kind BPMN deliberately draws with no caption asks for no key.
    expect(byKey.get('com.labre.bpmn.seed.startEvent')).toBeUndefined();
    // The C4 board's name reuses the board ROLE's key rather than minting a
    // second one for the same noun.
    expect(byKey.get('com.labre.c4.role.board')?.fallback).toBe('C4 diagram');
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
        ...[...src.matchAll(PAIR_DQ)].map(m => [m[1], m[2]] as const),
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
