import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { bpmnTranslationEntries } from '@labre/affine-gfx-bpmn';
import { DefaultTheme } from '@labre/affine-model';
import { PALETTE_NAME_WORDINGS } from '@labre/affine-shared/services';
import { slashMenuGroupWording } from '@labre/affine-widget-slash-menu/translations';
import { describe, expect, test } from 'vitest';

import { getTranslationKeyManifest } from '../../translations.js';
import { allSourceFiles } from './source-files.js';

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

/**
 * The manifest itself is NOT a use site. Scanning it would let `CHROME_KEYS`
 * justify its own entries, and the dead-entry check below would never fire.
 */
const SKIP_FILES = new Set([join('affine', 'all', 'src', 'translations.ts')]);

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
];

/**
 * The residue: chrome wordings whose call site pairs no two literals, so the
 * scan can check the KEY but not the WORDING. Each one is a deliberate shape,
 * and the list is pinned so a new unpairable call site has to be looked at
 * rather than silently joining them.
 */
/**
 * "One chrome word, one key" (L7 dedupe, `.claude/i18n-chantier/dedupe-plan.json`):
 * two or more packages used to declare the SAME English chrome word under
 * DIFFERENT keys (e.g. "Reload" as both `com.labre.toolbar.reload` and
 * `com.labre.root.toolbar.reload`). The closing pass merged every duplicate
 * onto one canonical key and turned the others into aliases (same constant
 * NAME, same value) — see `chrome.ts`'s own "L7 dedupe" section. This is the
 * list of chrome words that GENUINELY need more than one key, each with the
 * reason a merge would be wrong; copied from the dedupe plan's own
 * `keepSeparateWords`, plus the four words whose merge GROUP kept a
 * `keepSeparate` key alongside its canonical ("Confirm", "Equation", "Link",
 * "Document", formerly "Page").
 */
const KEPT_SEPARATE_CHROME_WORDS: Readonly<Record<string, string>> = {
  Background: 'frame fill vs text highlight background',
  Close: 'two keys already shipped on main',
  Code: 'view toggle vs inline code format',
  Custom: 'custom colour tab vs custom frame preset (gender differs in French)',
  Elements: 'catalogue category header (derived table) vs C4 legend section',
  Frames: 'catalogue category header (derived table) vs C4 legend section',
  // UML's catalogue section for what several diagram kinds share (PO ruling of
  // 2026-09-16), beside the sketch/general toggle every canvas style panel
  // offers. A merge is impossible either way round: the header's key is DERIVED
  // from the category id by `commandCategoryTranslationEntries`, so it cannot
  // be pointed at `com.labre.style.general`, and the two are not the same word
  // in a language that inflects — a section of a list against the plain
  // rendering of a stroke.
  General: 'UML catalogue section (derived table) vs canvas style toggle',
  Group: 'verb (group the selection) vs noun (a group)',
  Left: 'mind-map layout direction vs text alignment',
  Light: 'light colour mode vs light font weight',
  Relations:
    'catalogue category header vs framework legend sections (framework-owned keys)',
  Right: 'mind-map layout direction vs text alignment',
  Shape: "a connector's shape vs the shape tool",
  Text: 'text block type vs link text field vs text tool',
  'What this export could not write down':
    'one key per writer, both shipped on main',
  // The four merge groups (L7 dedupe) that kept a `keepSeparate` key beside
  // their canonical: "Confirm" (the reading panel's own
  // `com.labre.reading.action.confirm-nature`, a different sentence-in-context
  // from the generic confirm button), "Equation" (the LaTeX slash menu's own
  // block-item NAME, distinct from the inline/block empty-placeholder),
  // "Link" (Wardley's own template-link wording — a framework never imports
  // another package's key), "Document" (formerly "Page"; the slash menu's own group header,
  // distinct from the note's display-mode word).
  Confirm:
    "the reading panel's own confirm-nature wording, not the generic verb",
  Equation: "the LaTeX slash-menu block item's own name, not the placeholder",
  Link: "Wardley's own framework-owned template wording",
  Document: "the slash menu's own group header, not the note's display mode",
};

/**
 * Every manifest entry of source `chrome`, grouped by its exact English
 * fallback: barring the deliberate homonyms above, a fallback the manifest
 * ships should be reachable through exactly one key. A NEW duplicate here
 * means a lot declared a second key for a word `chrome.ts` (or another
 * package's `translations.ts`) already has — reuse the existing wording
 * instead of minting a new one, or, for a genuine homonym, add it to
 * {@link KEPT_SEPARATE_CHROME_WORDS} with a reason.
 */
const UNPAIRABLE_CHROME_KEYS: string[] = [
  // `BPMN_QUARANTINE_REASON` (`gfx/bpmn/src/import.ts`) and its own
  // `BPMN_QUARANTINE_REASON_KEY` are TWO separate `Record`s rather than one
  // table of `[key, text]` pairs: the reason's plain string is ALSO written
  // verbatim into `ForeignInterchange.quarantined[].reason` (a data field,
  // pinned as English in `import.unit.spec.ts`), so it cannot become a tuple
  // without breaking that contract — see the long comment on
  // `BPMN_QUARANTINE_REASON_KEY`. The two tables are matched by PROPERTY
  // NAME (`colour`, `expanded`, …), not by textual adjacency, so this scan
  // cannot pair them.
  'com.labre.bpmn.import.quarantine.colour',
  'com.labre.bpmn.import.quarantine.expanded',
  'com.labre.bpmn.import.quarantine.imported',
  'com.labre.bpmn.import.quarantine.nested-lanes',
];

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
      'Note removed from Document Mode'
    );
    pinned(
      'com.labre.toast.frame-inserted-into-page',
      'Frame inserted into Document.'
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
    // Every BPMN kind is seeded since R38 — an event's seed lands in the
    // gravitating label grouped under it rather than inside the ring.
    pinned('com.labre.bpmn.seed.startEvent', 'Start event', 'seed');
    pinned('com.labre.bpmn.seed.dataStore', 'Data store', 'seed');
    // UML's own: one key per kind the notation gives words to (23 of the 38),
    // plus the three compartment lines a fresh classifier carries.
    pinned('com.labre.uml.seed.class', 'Class', 'seed');
    pinned('com.labre.uml.seed.attributes', '+ attribute : Type', 'seed');
    expect(
      manifest.filter(entry => entry.key.startsWith('com.labre.uml.seed.'))
    ).toHaveLength(26);
    // …and a kind it draws as a MARK asks for none, because there is no word:
    // `UML_NAME_SEED.decision` is the empty string, so there is no word.
    expect(byKey.get('com.labre.uml.seed.decision')).toBeUndefined();
    // The C4 board's name reuses the board ROLE's key rather than minting a
    // second one for the same noun.
    expect(byKey.get('com.labre.c4.role.board')?.fallback).toBe('C4 diagram');
  });

  test('the manifest and the library source agree, in both directions', () => {
    const files = allSourceFiles(SKIP_FILES);
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

  /**
   * **Would have caught #390 (1, 2).**
   *
   * The two guards beside this one both ask about KEYS: is every key used
   * declared, is every key declared used. Neither can see the shape #390 was
   * made of — a `Record<string, ChromeWording>` keyed by a DOMAIN (a palette
   * key, a slash-menu group name) that is missing an entry its caller can
   * present. The missing entry is not a key anywhere, so there is nothing to
   * be absent from the manifest; the lookup simply misses and the raw domain
   * value is drawn next to translated neighbours.
   *
   * So this test compares each such table with the domain itself, read from
   * the SAME place the caller reads it from — never from a copy in the spec:
   *
   * - `PALETTE_NAME_WORDINGS` against every `Palette.key` the default theme
   *   produces. The `Heavy` row was absent from the table (7 swatches drawn
   *   as `HeavyRed`…`HeavyMagenta`) because the table had been written by
   *   copying the `Light` and `Medium` arrays by hand.
   * - the slash menu's group table against every `group:` string the repo
   *   writes, matched in BOTH spellings — the first inventory was a grep for
   *   `group: '` and so never saw `` `1_List@${i}` `` or `` `2_Style@${i}` ``,
   *   which is exactly the two headers that shipped untranslated.
   */
  describe('a table keyed by a domain covers its domain (#390)', () => {
    test('every palette the default theme draws has a name wording', () => {
      const domain = new Set(
        [
          ...DefaultTheme.Palettes,
          ...DefaultTheme.ShapeTextColorPalettes,
          ...DefaultTheme.StrokeColorShortPalettes,
          ...DefaultTheme.FillColorShortPalettes,
          ...DefaultTheme.ShapeTextColorShortPalettes,
          ...DefaultTheme.NoteBackgroundColorPalettes,
        ].map(palette => palette.key)
      );
      expect(domain.size).toBeGreaterThan(20);

      const uncovered = [...domain]
        .filter(key => !(key in PALETTE_NAME_WORDINGS))
        .sort();
      expect(
        uncovered,
        'a palette key the colour picker can draw with no wording to render: ' +
          'add one to PALETTE_NAME_WORDINGS (shared/…/translation-service/chrome.ts)'
      ).toEqual([]);

      // …and the wordings the table declares are all reachable: an entry for a
      // palette no theme produces is a key a host would translate for nothing.
      const orphans = Object.keys(PALETTE_NAME_WORDINGS)
        .filter(key => !domain.has(key))
        .sort();
      expect(
        orphans,
        'PALETTE_NAME_WORDINGS entries no theme produces'
      ).toEqual([]);
    });

    /**
     * `Database` is the only group deliberately left out: it belongs to the
     * postponed `blocks/database` / `blocks/data-view` surfaces (ADR 0023,
     * "Consequences"), whose English is pinned in `literals.baseline.json`
     * under `deferred`. It renders its raw name, exactly as every group did
     * before the table existed.
     */
    const SLASH_GROUPS_WITHOUT_A_WORDING: Readonly<Record<string, string>> = {
      Database: 'postponed surface (blocks/database, blocks/data-view)',
    };

    /**
     * A group id, `'<order>_<Name>@<index>'`, wherever it is written — the
     * `<Name>` between the `_` and the `@` is what `parseGroup` extracts and
     * what `slashMenuGroupWording` is asked for.
     *
     * Anchored on the LITERAL and not on `group:`, which is the second half of
     * #390's lesson: `blocks/note` does not write the property at all, it
     * passes the id positionally
     * (`` createConversionItem(config, `1_List@${index++}`) ``). An inventory
     * anchored on the property name misses those two exactly as the original
     * grep for `group: '` did. The shape `<digits>_<text>@` is distinctive
     * enough on its own.
     */
    const GROUP_DECLARATION = /['"`]\d+_([^'"`@\n]+)@/g;

    test('every slash-menu group header has a wording', () => {
      const declared = new Set<string>();
      for (const file of allSourceFiles()) {
        for (const [, name] of readFileSync(file, 'utf8').matchAll(
          GROUP_DECLARATION
        )) {
          declared.add(name);
        }
      }
      // The inventory itself is load-bearing: if this ever collapses the test
      // stops proving anything.
      expect(declared.size).toBeGreaterThanOrEqual(9);
      // The two #390 headers, whose ids are TEMPLATE literals passed
      // positionally — the shape the first inventory could not see.
      expect(declared.has('List')).toBe(true);
      expect(declared.has('Style')).toBe(true);

      const uncovered = [...declared]
        .filter(
          name =>
            !slashMenuGroupWording(name) &&
            !(name in SLASH_GROUPS_WITHOUT_A_WORDING)
        )
        .sort();
      expect(
        uncovered,
        'a slash-menu group header with no wording: add one to ' +
          'SLASH_MENU_GROUP_WORDINGS (widgets/slash-menu/src/translations.ts), ' +
          'or, for a postponed surface, to SLASH_GROUPS_WITHOUT_A_WORDING here'
      ).toEqual([]);
      // Same budget as the both-directions scan above: ~2.8k files read
      // synchronously, seconds warm and far more on a cold NTFS cache.
    }, 90_000);
  });

  test('one chrome word, one key (L7 dedupe)', () => {
    const byFallback = new Map<string, Set<string>>();
    for (const entry of manifest) {
      if (entry.source !== 'chrome' || entry.fallback === undefined) continue;
      const keys = byFallback.get(entry.fallback) ?? new Set<string>();
      keys.add(entry.key);
      byFallback.set(entry.fallback, keys);
    }

    const newDuplicates = [...byFallback.entries()]
      .filter(
        ([fallback, keys]) =>
          keys.size > 1 && !(fallback in KEPT_SEPARATE_CHROME_WORDS)
      )
      .map(
        ([fallback, keys]) =>
          `${JSON.stringify(fallback)}: ${[...keys].sort().join(', ')}`
      )
      .sort();

    expect(
      newDuplicates,
      'a new chrome word duplicate: reuse the existing wording from ' +
        'chrome.ts (or, for a real homonym, add it to ' +
        'KEPT_SEPARATE_CHROME_WORDS with a reason)'
    ).toEqual([]);
  });
});
