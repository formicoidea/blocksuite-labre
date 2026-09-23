import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, test } from 'vitest';

import { getTranslationKeyManifest } from '../../translations.js';
import { allSourceFiles, HERE, toRepoRelative } from './source-files.js';

/**
 * The literal ratchet: a ceiling on user-facing string literals that carry no
 * i18n key, next to `manifest.unit.spec.ts` (the ceiling on keys the manifest
 * doesn't know about). Where the manifest spec asks "is every USED key
 * declared?", this spec asks the opposite question: "is every user-facing
 * STRING keyed?" — and answers it with a HEURISTIC, not a parser.
 *
 * ## This is a regex over file text, not an AST walk
 *
 * Six shapes catch most of what a reviewer would flag by eye (a lit text
 * node, a template attribute, a prose-shaped object property, a toast
 * message, a seed table keyed by kind, a fallback literal) — see the `P1`-`P6`
 * patterns below. It
 * will always miss some real
 * prose (a string built by concatenation, a tuple `['some prose', x, y]` with
 * no property name in front of it) and it will always let through some
 * near-misses the classification below has to correct for (an identifier
 * that happens to read as a sentence). That is why the baseline has three
 * buckets instead of one: `pending` is "needs a key", `deferred` is "the PO
 * postponed this whole surface", and `kept` is "the PO decided this literal
 * is never getting a key" — and it is a RATCHET: `pending` can only shrink
 * (see `UPDATE_I18N_BASELINE` below), never grow silently.
 *
 * ponytail: known false-negatives the patterns do not attempt —
 * string-literal ARRAY ELEMENTS with no property name in front of them
 * (`SMALL_LABELS` in `gfx/cynefin-estuarine/src/cynefin/consts.ts` is exactly
 * this shape: `['dispositional exaptation', 257, 239]`), string
 * CONCATENATION (`'Frame: ' + frameModel.props.title`), and a literal passed
 * as a bare function ARGUMENT with no distinguishing property/attribute name
 * around it. Widening the patterns to catch these would also catch a lot more
 * of TypeScript itself (tuple types, generic argument lists); the patterns
 * below were chosen because they are the shapes that stay narrow.
 *
 * The bare-ARGUMENT case is the one #390 asked about, in the specific shape of
 * `new Error('a sentence a user reads')`. It was MEASURED before being
 * rejected: 248 hits across the repo, of which the overwhelming majority are
 * internal invariants that no catch site ever renders ("Note block is not
 * found after creation", "Never reach here"). Classifying 248 entries is a lot
 * of judgement for a pattern whose real target is much smaller — the errors
 * that ARE displayed, which in this repo is a closed set of two classes that
 * carry a `messageKey`. So the minimal form ships instead, as a claim rather
 * than a ratchet entry: see "a displayed error names its own sentence" at the
 * bottom of this file (10 construction sites today, 1 deliberate exception).
 */

// ---------------------------------------------------------------------------
// Patterns
// ---------------------------------------------------------------------------

/**
 * P1 — lit text nodes: the prose sitting directly between a closing `>` and
 * the next `<`, but ONLY inside an `` html`…` `` / `` svg`…` `` tagged
 * template. Restricted to files that actually tag such a template, and to the
 * template's own text, rather than scanning `>`…`<` over the WHOLE file:
 * TypeScript generics chain the very same characters (`Map<K, V>, Set<K>`
 * reads as `>`, then `, Set`, then `<` — "Set" would pass every other filter
 * below), so the only way to keep this pattern narrow is to look only inside
 * an actual template.
 *
 * ponytail: a `${…}` expression is treated as OPAQUE up to its first `}`, so
 * a NESTED `` html`…` `` sitting inside a property binding
 * (`` .button=${html`…`} ``, seen in `configs/toolbar.ts` throughout the
 * `blocks` packages) closes the outer template a little early, at the nested
 * template's own closing backtick. Nothing scanned this way is a false
 * POSITIVE — the lost text is whatever followed the nested template inside
 * the same outer one, which the next matched template (if any) does not
 * re-cover. A real gap, and a false NEGATIVE, not a false positive.
 */
const TAGGED_TEMPLATE =
  /\b(?:html|svg)`((?:\\.|\$\{[^}]*\}|\$(?!\{)|[^`\\$])*)`/g;
const TEXT_NODE = />([^<>]*)</g;

/**
 * P2 — template attributes with a literal value, two shapes for the same
 * short list of "this is prose, not styling" names: the plain
 * `aria-label="…"` form, and the lit property-binding form
 * `` .tooltip=${'…'} `` (sometimes additionally quoted:
 * `` .tooltip="${'Turn into'}" ``, seen in `configs/toolbar.ts`).
 */
const CHROME_ATTR_NAMES =
  'aria-label|title|alt|placeholder|tooltip|data-hover-text|label|text';
const ATTR_LITERAL = new RegExp(`\\b(?:${CHROME_ATTR_NAMES})="([^"]*)"`, 'g');
const PROP_BINDING = new RegExp(
  `\\.(?:${CHROME_ATTR_NAMES})="?\\$\\{\\s*(['"])((?:(?!\\1)[^\\\\]|\\\\.)*)\\1\\s*\\}"?`,
  'g'
);

/**
 * P3 — object properties that READ as prose: `` label: '…' ``,
 * `` name: "…" ``, `` message: `…` ``. The property names are just as often a
 * flavour id (`flavour: 'affine:paragraph'`), a CSS value
 * (`color: '#fff'`), or a single lowercase word (`color: 'red'`) — see
 * `looksLikeObjectProse` for the exclusions the brief calls for.
 */
const PROP_NAMES =
  'label|name|tooltip|description|caption|placeholder|title|text|message|content';
const OBJECT_PROP = new RegExp(
  `\\b(?:${PROP_NAMES})\\s*:\\s*(['"\`])((?:(?!\\1)[^\\\\]|\\\\.)*)\\1`,
  'g'
);

/**
 * P5 — the values of a SEED or LABEL table: `` class: 'Class' ``,
 * `` container: 'Container' ``. P3 cannot see them, because it keys on the
 * PROPERTY NAME and these tables are keyed by KIND — which is how 23 UML seeds
 * were written into documents in English under a guard that was already
 * running over the file (#XXX). The text such a table holds is the worst kind
 * to leave unkeyed: a creation site persists it, so it can never be translated
 * afterwards.
 *
 * Narrow on purpose. The declaration is matched by its NAME (the repo's
 * `…_SEED` / `…_LABEL` convention) and its body is taken up to the closing
 * `\n};` of a top-level const, because a `${…}` inside a value would stop a
 * brace-counting scan on its own closing brace. A value that interpolates is
 * skipped for the same reason C4's type line is not compared letter for
 * letter: what the source states is not what the table holds, so this scan can
 * check the KEY's existence for it no better than P3 can.
 */
const SEED_TABLE = /const\s+\w*(?:SEED|LABEL)\w*[^=\n]*=\s*\{([\s\S]*?)\n\};/g;
const TABLE_VALUE =
  /^\s*(?:'[^']+'|"[^"]+"|\[[^\]]+\]|[\w-]+)\s*:\s*(['"`])((?:(?!\1)[^\\]|\\.)*)\1\s*,?\s*$/gm;

/**
 * P6 — a FALLBACK literal: `` x || 'Untitled' ``, `` y ?? 'Imported diagram' ``.
 *
 * Added after #390, where the embed error card rendered
 * `` ${this.error?.message || 'Failed to load embedded content'} `` — a
 * user-facing sentence sitting in the one place none of P1-P5 could reach.
 * P1 treats a `${…}` span as opaque, so a fallback written inside a lit
 * interpolation is invisible to it; P2/P3 key on a name to the LEFT of the
 * literal, and `||` is not a name. The same blind spot had already left two
 * `'Untitled'` fallbacks in the embed-doc blocks.
 *
 * It stays cheap because the default of a nullish value is almost always
 * either prose (a title, a message) or an identifier the `looksLikeObjectProse`
 * filter already rejects: the whole repo yields under 40 hits.
 *
 * Deliberately NOT matching a backtick literal, and never across a line
 * break. Both were measured: a `` ` `` branch turns every `??` inside a doc
 * comment (this repo writes plenty, e.g. "a property NAMED `???`") into an
 * opening quote that swallows the rest of the file, and the capture that
 * comes back is a page of TypeScript rather than a sentence. A fallback
 * written as a template literal interpolates, and an interpolated fallback is
 * skipped below anyway.
 */
const FALLBACK_LITERAL = /(?:\|\||\?\?)\s*(['"])((?:(?!\1)[^\\\n]|\\.)*)\1/g;

/**
 * P4 — the message argument of a toast: the two-argument
 * `toast(host, '…')` and the one-argument `notification.toast('…')` forms
 * both used in this codebase.
 */
const TOAST_MESSAGE =
  /\btoast\(\s*(?:[^,()]+,\s*)?(?:`((?:[^`\\]|\\.)*)`|'((?:[^'\\]|\\.)*)'|"((?:[^"\\]|\\.)*)")\s*[,)]/g;

// ---------------------------------------------------------------------------
// Normalisation and covered-by-manifest
// ---------------------------------------------------------------------------

/** A file that resolves wordings: a `translateKey` call, a wording, a key. */
const SEAM_USE = /translateKey|Wording|com\.labre\./;

/** Undo the one level of backslash-escaping a quoted literal can carry. */
function unescapeQuoted(raw: string): string {
  return raw.replace(/\\(.)/g, '$1');
}

/**
 * Trim, collapse whitespace runs to one space, and replace every `${…}`
 * interpolation by `${}` — so `'Frame: ' + title` and `` `Frame: ${title}` ``
 * would normalise the same way if both were ever caught, and so a hit can be
 * compared against a manifest fallback whose own placeholders are `{{name}}`.
 */
function normalizeLiteral(text: string): string {
  return unescapeQuoted(text)
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/\$\{[^{}]*\}/g, '${}');
}

/** Same normalisation for a manifest fallback (`{{name}}` placeholders). */
function normalizeFallback(fallback: string): string {
  return fallback
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/\{\{\s*\w+\s*\}\}/g, '${}');
}

/** A lit text node's content, or `null` if it is not a translatable hit. */
function textNodeHit(between: string): string | null {
  const trimmed = between.trim();
  if (trimmed.length === 0) return null;

  // No stray `{`/`}` outside `${…}` — excludes CSS-in-template blocks and
  // malformed captures.
  const withoutInterpolation = trimmed.replace(/\$\{[^{}]*\}/g, '');
  if (/[{}]/.test(withoutInterpolation)) return null;

  // Ignore content that is PURE interpolation (`${a} ${b}`, no prose of its
  // own alongside it).
  if (withoutInterpolation.trim().length === 0) return null;

  // Needs two consecutive letters somewhere outside the placeholders — filters
  // bare glyphs/punctuation/whitespace (`→`, `·`, `…`).
  if (!/[A-Za-z]{2}/.test(withoutInterpolation)) return null;

  // The fallout of the nested-template limitation documented above: a
  // `${…}` opaque span that closes on an INNER `}` (an arrow function's
  // body, a helper call's own closing brace) can leave raw JS sitting in
  // the captured template text — a bare `` html` `` fragment, or a whole
  // expression ending in `return html\``. Real prose never contains a
  // backtick, an arrow, a `this.foo(` call or the `return` keyword, so
  // rejecting on those catches the artefact without touching real hits (P3's
  // own backtick-quoted messages go through `looksLikeObjectProse`, not this
  // function, so a legitimate `` `${x}` line kept verbatim` `` is untouched).
  if (/`|=>|\bthis\.\w|\breturn\b|\bfunction\b/.test(withoutInterpolation)) {
    return null;
  }

  return normalizeLiteral(trimmed);
}

/** A plain `attr="value"` value: needs a letter, and no interpolation. */
function isPlainAttrValue(value: string): boolean {
  return value.length > 0 && !value.includes('${') && /[A-Za-z]/.test(value);
}

/**
 * The P3 exclusions the brief calls for: a value that starts uppercase or
 * contains a space is kept UNLESS it also looks like a key, a flavour/id, a
 * CSS value, a URL, or a single lowercase identifier.
 */
function looksLikeObjectProse(value: string): boolean {
  if (value.length === 0) return false;
  const startsUpper = /^[A-Z]/.test(value);
  const hasSpace = / /.test(value);
  if (!startsUpper && !hasSpace) return false;

  if (value.startsWith('com.labre.')) return false;
  // A flavour or id (`affine:paragraph`, `wardley:component`): a colon with
  // no space anywhere in the value.
  if (value.includes(':') && !hasSpace) return false;
  // CSS-shaped: a length, a hex colour, or a `var(...)` reference.
  if (/^-?\d+(\.\d+)?(px|em|rem|%|vh|vw|deg|s|ms)$/.test(value)) return false;
  if (/^#[0-9a-fA-F]{3,8}$/.test(value)) return false;
  if (value.startsWith('var(')) return false;
  // A URL or a displayed domain.
  if (/^(https?:|www\.)/i.test(value)) return false;
  // A single lowercase identifier (`red`, `top-left`) — already excluded by
  // the inclusion rule above in every case that matters, kept explicit for
  // documentation.
  if (/^[a-z][\w-]*$/.test(value)) return false;

  return true;
}

// ---------------------------------------------------------------------------
// Scanning one file
// ---------------------------------------------------------------------------

/** Every (unnormalised) hit text in `src`, one entry per occurrence. */
function findHits(src: string): string[] {
  const hits: string[] = [];

  if (/\b(?:html|svg)`/.test(src)) {
    for (const [, template] of src.matchAll(TAGGED_TEMPLATE)) {
      for (const [, between] of template.matchAll(TEXT_NODE)) {
        const hit = textNodeHit(between);
        if (hit !== null) hits.push(hit);
      }
    }
  }

  for (const [, value] of src.matchAll(ATTR_LITERAL)) {
    if (isPlainAttrValue(value)) hits.push(normalizeLiteral(value));
  }

  for (const match of src.matchAll(PROP_BINDING)) {
    const value = match[2];
    if (value.length > 0 && /[A-Za-z]/.test(value)) {
      hits.push(normalizeLiteral(value));
    }
  }

  for (const match of src.matchAll(OBJECT_PROP)) {
    const value = match[2];
    if (looksLikeObjectProse(value)) hits.push(normalizeLiteral(value));
  }

  for (const [, body] of src.matchAll(SEED_TABLE)) {
    for (const match of body.matchAll(TABLE_VALUE)) {
      const value = match[2];
      if (value.includes('${')) continue;
      if (looksLikeObjectProse(value)) hits.push(normalizeLiteral(value));
    }
  }

  for (const match of src.matchAll(FALLBACK_LITERAL)) {
    const value = match[2];
    if (value.includes('${')) continue;
    if (looksLikeObjectProse(value)) hits.push(normalizeLiteral(value));
  }

  for (const match of src.matchAll(TOAST_MESSAGE)) {
    const value = match[1] ?? match[2] ?? match[3];
    if (value !== undefined && /[A-Za-z]/.test(value)) {
      hits.push(normalizeLiteral(value));
    }
  }

  return hits.filter(hit => !hit.startsWith('com.labre.'));
}

// ---------------------------------------------------------------------------
// Baseline shape and multiset helpers
// ---------------------------------------------------------------------------

type Section = 'kept' | 'deferred' | 'pending';
const SECTIONS: readonly Section[] = ['kept', 'deferred', 'pending'];
type Baseline = Record<Section, Record<string, string[]>>;

const BASELINE_PATH = join(HERE, 'literals.baseline.json');

function readBaseline(): Baseline {
  const raw = JSON.parse(readFileSync(BASELINE_PATH, 'utf8'));
  return {
    kept: raw.kept ?? {},
    deferred: raw.deferred ?? {},
    pending: raw.pending ?? {},
  };
}

function writeBaseline(baseline: Baseline): void {
  const sorted: Baseline = { kept: {}, deferred: {}, pending: {} };
  for (const section of SECTIONS) {
    for (const file of Object.keys(baseline[section]).sort()) {
      const texts = baseline[section][file];
      if (texts.length > 0) sorted[section][file] = [...texts].sort();
    }
  }
  writeFileSync(BASELINE_PATH, JSON.stringify(sorted, null, 2) + '\n');
}

/** `Map<file, Map<text, count>>` — a multiset keyed by file then text. */
type CountsByFile = Map<string, Map<string, number>>;

function addTo(counts: CountsByFile, file: string, text: string): void {
  const perFile = counts.get(file) ?? new Map<string, number>();
  perFile.set(text, (perFile.get(text) ?? 0) + 1);
  counts.set(file, perFile);
}

function countsFromHits(hitsByFile: Map<string, string[]>): CountsByFile {
  const counts: CountsByFile = new Map();
  for (const [file, texts] of hitsByFile) {
    for (const text of texts) addTo(counts, file, text);
  }
  return counts;
}

/** The three sections merged into one multiset (a hit is in exactly one). */
function mergedBaselineCounts(baseline: Baseline): CountsByFile {
  const counts: CountsByFile = new Map();
  for (const section of SECTIONS) {
    for (const [file, texts] of Object.entries(baseline[section])) {
      for (const text of texts) addTo(counts, file, text);
    }
  }
  return counts;
}

function countOf(counts: CountsByFile, file: string, text: string): number {
  return counts.get(file)?.get(text) ?? 0;
}

function allFileTextPairs(counts: CountsByFile): [string, string][] {
  const pairs: [string, string][] = [];
  for (const [file, perFile] of counts) {
    for (const text of perFile.keys()) pairs.push([file, text]);
  }
  return pairs;
}

// ---------------------------------------------------------------------------
// Classification (init only): deferred surface, then explicit "kept", else pending
// ---------------------------------------------------------------------------

/**
 * Surfaces the PO postponed wholesale (decision of 2026-09-11): every hit
 * under these directories is `deferred`, whatever it says, because the
 * SURFACE itself — not any one string on it — is out of scope for now.
 */
const DEFERRED_DIRS = [
  'packages/affine/data-view/',
  'packages/affine/blocks/database/',
  'packages/affine/blocks/table/',
  'packages/affine/blocks/data-view/',
  'packages/affine/blocks/embed/src/embed-youtube-block/',
  'packages/affine/blocks/embed/src/embed-loom-block/',
  'packages/affine/blocks/embed/src/embed-figma-block/',
  'packages/affine/blocks/embed/src/embed-github-block/',
  'packages/affine/widgets/keyboard-toolbar/',
];

function isDeferred(file: string): boolean {
  return DEFERRED_DIRS.some(dir => file.startsWith(dir));
}

/**
 * Literals the PO decided will never get a key, derived (file + text, best
 * effort) from the `K-gardé` rows of the i18n inventory, filtered down to the
 * ones the detector actually produces a hit for (most `K-gardé` rows —
 * `letter: 'A'` glyphs, `title = 'Template'` default parameters, an
 * `aria-label=${handle}` bound to a variable — are not hits at all under P1-P4,
 * so they need no entry here; see the comments below for why each one is
 * absent). Rows already covered by `DEFERRED_DIRS` above (the displayed
 * embed domains, the mobile keyboard toolbar) are not repeated here — the
 * directory check runs first.
 */
const KEPT_HITS: readonly { file: string; text: string }[] = [
  // "Aa" — the font-menu button's example glyph, not a word to translate.
  { file: 'packages/affine/gfx/text/src/toolbar/actions.ts', text: 'Aa' },

  // `[data-v-text="true"]` — a CSS attribute SELECTOR in a query string, not
  // prose. P2's plain-attribute pattern matches "text=" inside "data-v-text="
  // and captures the selector's own value ("true") as if it were a rendered
  // attribute. Same shape in both the list and paragraph turbo painters.
  {
    file: 'packages/affine/blocks/list/src/turbo/list-layout-handler.ts',
    text: 'true',
  },
  {
    file: 'packages/affine/blocks/paragraph/src/turbo/paragraph-layout-handler.ts',
    text: 'true',
  },
  // Same false positive: a `…text="true"` data-attribute selector.
  {
    file: 'packages/affine/fragments/doc-title/src/doc-title.ts',
    text: 'true',
  },
  {
    file: 'packages/framework/std/src/inline/components/v-text.ts',
    text: 'true',
  },
  { file: 'packages/framework/std/src/inline/utils/text.ts', text: 'true' },

  // Code fragments captured across a nested template or a string
  // concatenation, not prose: the linked-doc export adapters' `'untitled'`
  // fallback expression (headless, no editor to ask — lot L2b's decision) and
  // the key-name normaliser of the keymap.
  ...['html.ts', 'markdown.ts', 'plain-text.ts'].map(adapter => ({
    file: `packages/affine/blocks/embed-doc/src/embed-linked-doc-block/adapters/${adapter}`,
    text: '+ o.node.props.pageId) ??',
  })),
  {
    file: 'packages/framework/std/src/event/keymap.ts',
    text: '+ name ); } return normalized; } function modifiers(name: string, event: KeyboardEvent, shift = true) { if (event.altKey) name =',
  },

  // "Pen" — the brush tool's own senior-tool name: a core tool with no
  // framework descriptor, hence no labelKey, by the design every core tool
  // follows (lot L5b); its toolbar tooltip is keyed.
  { file: 'packages/affine/gfx/brush/src/toolbar/senior-tool.ts', text: 'Pen' },

  // The `.bpmn` writer's XML PROLOG — `<?xml version="1.0" encoding="UTF-8"?>`
  // — matched by P3 because it sits after `text: `. It is markup, not prose:
  // no host ever shows it, and no translator could do anything with it.
  {
    file: 'packages/affine/gfx/bpmn/src/export.ts',
    text: '<?xml version="1.0" encoding="UTF-8"?>n${}n',
  },

  // `TemplateCategory.name` reused as the fallback of an EXISTING senior-button
  // key (`com.labre.framework.wardley` / `.c4`) whose OWN registered manifest
  // fallback is longer ("Wardley map" / "C4 model") — the templates-panel tab
  // deliberately shows the SHORTER form (`nameKey` resolves with `name`, not
  // the manifest's fallback, as its own fallback: `TemplateCategory.nameKey`).
  // Already keyed and functionally translated; not a hit this spec's
  // fallback-matching can see, because the two call sites of one key state two
  // different English strings on purpose.
  {
    file: 'packages/affine/gfx/wardley/src/templates/index.ts',
    text: 'Wardley',
  },
  { file: 'packages/affine/gfx/c4/src/templates.ts', text: 'C4' },

  // PO decision (2026-09-12): the native file-picker's type descriptions
  // stay English (`ImageProxyService` and the rest of `filesys.ts` name a
  // FILE TYPE, not editor chrome — the same reasoning that already kept
  // "Aa" and the notation letters out of the catalogue). See
  // `packages/affine/shared/src/utils/file/filesys.ts`'s `description`
  // fields and the `FileType` union they back.
  {
    file: 'packages/affine/shared/src/utils/file/filesys.ts',
    text: 'Images',
  },
  {
    file: 'packages/affine/shared/src/utils/file/filesys.ts',
    text: 'Videos',
  },
  {
    file: 'packages/affine/shared/src/utils/file/filesys.ts',
    text: 'Audios',
  },
  {
    file: 'packages/affine/shared/src/utils/file/filesys.ts',
    text: 'Markdown',
  },
  { file: 'packages/affine/shared/src/utils/file/filesys.ts', text: 'Html' },
  { file: 'packages/affine/shared/src/utils/file/filesys.ts', text: 'Zip' },
  {
    file: 'packages/affine/shared/src/utils/file/filesys.ts',
    text: 'MindMap',
  },

  // `${notes.length} ${translateKey(...)}` (interchange-import.ts) — PURE
  // interpolation with a space between the two holes and no static prose of
  // its own; P3 matches it because it sits after `message:`, but there is no
  // English here to translate, only two already-translated values glued
  // together with a space.
  {
    file: 'packages/affine/blocks/surface/src/extensions/interchange-import.ts',
    text: '${} ${}',
  },

  // `GROUP_ORDER[].name` (icon-picker/emoji-data.ts) — already translated at
  // the render site: `emoji-picker-panel.ts` looks the group up by this very
  // `name` and resolves `EMOJI_GROUP_WORDINGS[group.id]` (declared in this
  // package's own `translations.ts`, which IS covered by the manifest). This
  // pure-data file calls no `translateKey`, imports no `Wording` and writes
  // no `com.labre.*` literal of its own, so the per-file seam gate
  // (`SEAM_USE`) can never see that the render site already resolves it.
  {
    file: 'packages/affine/components/src/icon-picker/emoji-data.ts',
    text: 'Smileys & People',
  },
  {
    file: 'packages/affine/components/src/icon-picker/emoji-data.ts',
    text: 'Animals & Nature',
  },
  {
    file: 'packages/affine/components/src/icon-picker/emoji-data.ts',
    text: 'Food & Drink',
  },
  {
    file: 'packages/affine/components/src/icon-picker/emoji-data.ts',
    text: 'Activity',
  },
  {
    file: 'packages/affine/components/src/icon-picker/emoji-data.ts',
    text: 'Travel & Places',
  },
  {
    file: 'packages/affine/components/src/icon-picker/emoji-data.ts',
    text: 'Objects',
  },
  {
    file: 'packages/affine/components/src/icon-picker/emoji-data.ts',
    text: 'Symbols',
  },
  {
    file: 'packages/affine/components/src/icon-picker/emoji-data.ts',
    text: 'Flags',
  },

  // `BracketPair.name` (`shared/src/consts/bracket-pairs.ts`) — an internal
  // identifier, never displayed: both consumers (`blocks/code`'s auto-close
  // and `inlines/preset`'s bracket keymap) read only `.left` / `.right`, never
  // `.name`. Verified by searching every import of `BRACKET_PAIRS`.
  {
    file: 'packages/affine/shared/src/consts/bracket-pairs.ts',
    text: 'corner bracket',
  },
  {
    file: 'packages/affine/shared/src/consts/bracket-pairs.ts',
    text: 'curly bracket',
  },
  {
    file: 'packages/affine/shared/src/consts/bracket-pairs.ts',
    text: 'double quote',
  },
  {
    file: 'packages/affine/shared/src/consts/bracket-pairs.ts',
    text: 'fullwidth angle bracket',
  },
  {
    file: 'packages/affine/shared/src/consts/bracket-pairs.ts',
    text: 'fullwidth double quote',
  },
  {
    file: 'packages/affine/shared/src/consts/bracket-pairs.ts',
    text: 'fullwidth parenthesis',
  },
  {
    file: 'packages/affine/shared/src/consts/bracket-pairs.ts',
    text: 'fullwidth single quote',
  },
  {
    file: 'packages/affine/shared/src/consts/bracket-pairs.ts',
    text: 'fullwidth square bracket',
  },
  {
    file: 'packages/affine/shared/src/consts/bracket-pairs.ts',
    text: 'single quote',
  },
  {
    file: 'packages/affine/shared/src/consts/bracket-pairs.ts',
    text: 'square bracket',
  },
  {
    file: 'packages/affine/shared/src/consts/bracket-pairs.ts',
    text: 'white corner bracket',
  },

  // `PHASE_LABELS` / `AXIS_LABELS` (`gfx/wardley/src/consts.ts`) — already
  // keyed at the declaration that DRAWS them: `background.ts` states every one
  // of these ten as the `fallback` of a `com.labre.wardley.*` key, and the
  // bands and axes are painted from there. The same shape as `emoji-data.ts`
  // above, and the reason P5 needs an entry here at all: the WORDING sits in a
  // pure-data file that names no key, so the per-file seam gate cannot see
  // that the render site resolves it.
  ...[
    'Genesis',
    'Custom-Built',
    'Product (+Rental)',
    'Commodity (+Utility)',
    'Evolution',
    'Value Chain',
    'Uncharted',
    'Industrialized',
    'Visible',
    'Invisible',
  ].map(text => ({ file: 'packages/affine/gfx/wardley/src/consts.ts', text })),

  // The senior-tool button's OWN generic name for a framework-less canvas
  // primitive (a shape with no notation drawn on it) — kept English by design
  // like the brush's "Pen" and the template button's "Template" (a different
  // lot's packages; named here only for the cross-reference): a core tool
  // with no framework descriptor is chrome so generic a wording key would
  // buy nothing.
  {
    file: 'packages/affine/gfx/shape/src/toolbar/senior-tool.ts',
    text: 'Shape',
  },

  // Named here for the paper trail, but NOT above, because the detector
  // never turns them into a hit in the first place:
  // - `name: 'Cynefin / Estuarine'` (gfx/cynefin-estuarine/toolbar/senior-tool.ts)
  //   IS a hit under P3, but it is COVERED, not kept: `FRAMEWORK_DESCRIPTORS`
  //   (`all/src/frameworks.ts`) declares the very same string as
  //   `labelFallback` for `com.labre.framework.cynefin-estuarine`, which the
  //   manifest walks in — so this literal matches an existing fallback and
  //   is filtered out before classification ever sees it.
  // - `letter: 'A'` / `letter: 'C'` (cynefin/consts.ts) and the `text: 'e'` /
  //   `text: 't'` axis glyphs (estuarine/consts.ts) — single-character
  //   notation, filtered out by `looksLikeObjectProse`'s base inclusion rule
  //   (no uppercase start, no space) before the exclusion list even runs.
  // - `title = 'Template'` (gfx/template/src/make-snapshot.ts) — a function
  //   DEFAULT PARAMETER, not a `title: '…'` object property, so P3 does not
  //   match it at all.
  // - `aria-label=${handle}` (widgets/edgeless-selected-rect/resize-handles.ts)
  //   — bound to a variable, not a quoted literal, so P2's property-binding
  //   pattern does not match it.
  // - the diagnostic-panel messages built in universe-tag-defs-service.ts —
  //   the `message` argument of a local `issue(...)` HELPER call, not a
  //   `message: '…'` object property, so P3 does not match it.
];

const keptLookup = new Set(KEPT_HITS.map(({ file, text }) => `${file} ${text}`));

function isExplicitlyKept(file: string, text: string): boolean {
  return keptLookup.has(`${file} ${text}`);
}

function classifyFresh(hitsByFile: Map<string, string[]>): Baseline {
  const baseline: Baseline = { kept: {}, deferred: {}, pending: {} };
  for (const [file, texts] of hitsByFile) {
    for (const text of texts) {
      const section: Section = isDeferred(file)
        ? 'deferred'
        : isExplicitlyKept(file, text)
          ? 'kept'
          : 'pending';
      (baseline[section][file] ??= []).push(text);
    }
  }
  return baseline;
}

// ---------------------------------------------------------------------------
// `UPDATE_I18N_BASELINE=1`: remove stale entries only, never add
// ---------------------------------------------------------------------------

function removeStaleOnly(
  baseline: Baseline,
  currentCounts: CountsByFile
): Baseline {
  // A working copy we decrement as sections claim occurrences, so a
  // file+text present in more than one section (should not happen, but the
  // diff must not double-allocate if it ever does) is split rather than
  // double-counted.
  const remaining: CountsByFile = new Map(
    [...currentCounts].map(([file, perFile]) => [file, new Map(perFile)])
  );

  const updated: Baseline = { kept: {}, deferred: {}, pending: {} };
  for (const section of SECTIONS) {
    for (const [file, texts] of Object.entries(baseline[section])) {
      const wanted = new Map<string, number>();
      for (const text of texts) wanted.set(text, (wanted.get(text) ?? 0) + 1);

      const kept: string[] = [];
      for (const [text, wantedCount] of wanted) {
        const available = remaining.get(file)?.get(text) ?? 0;
        const keepCount = Math.min(wantedCount, available);
        for (let i = 0; i < keepCount; i++) kept.push(text);
        if (available > 0) {
          remaining.get(file)!.set(text, available - keepCount);
        }
      }
      if (kept.length > 0) updated[section][file] = kept;
    }
  }
  return updated;
}

function sectionCounts(baseline: Baseline): Record<Section, number> {
  const counts = { kept: 0, deferred: 0, pending: 0 } as Record<
    Section,
    number
  >;
  for (const section of SECTIONS) {
    for (const texts of Object.values(baseline[section])) {
      counts[section] += texts.length;
    }
  }
  return counts;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('literal translation guard', () => {
  test('detector self-test: one inline sample per pattern, plus a covered case and an excluded identifier', () => {
    // P1 — lit text node.
    expect(findHits('const t = html`<span>Card view</span>`;')).toContain(
      'Card view'
    );
    // P2a — plain attribute.
    expect(findHits('html`<button aria-label="Rename"></button>`')).toContain(
      'Rename'
    );
    // P2b — property binding.
    expect(
      findHits(`html\`<x-btn .tooltip="\${'Turn into'}"></x-btn>\``)
    ).toContain('Turn into');
    // P3 — object property.
    expect(findHits(`const cfg = { label: 'Insert into Page' };`)).toContain(
      'Insert into Page'
    );
    // P4 — toast.
    expect(findHits(`toast(host, 'Copied image to clipboard');`)).toContain(
      'Copied image to clipboard'
    );
    // P5 — a seed table keyed by KIND, which P3's property names cannot see.
    expect(
      findHits(`const UML_NAME_SEED = {\n  class: 'Class',\n};`)
    ).toContain('Class');

    // Covered case: a P3 hit whose normalised text equals a manifest
    // fallback is not a "new" concern for THIS spec (the manifest spec is
    // what guards it) — `findHits` itself does not filter by the manifest
    // (that happens once, against the whole file's hits), so this just pins
    // that the literal is at least detected and would normalise identically
    // to the manifest's own fallback.
    const covered = findHits(`const cfg = { label: 'Copy' };`);
    expect(covered).toContain('Copy');
    expect(normalizeLiteral('Copy')).toBe(normalizeFallback('Copy'));

    // Excluded identifier: a single lowercase word with no space is a CSS
    // colour name here (`color: 'red'`), not prose.
    expect(findHits(`const style = { color: 'red' };`)).not.toContain('red');
    // A flavour id: a colon with no space.
    expect(
      findHits(`const cfg = { flavour: 'affine:paragraph' };`)
    ).not.toEqual(expect.arrayContaining(['affine:paragraph']));
    // A pure interpolation text node carries no prose of its own.
    expect(findHits('html`<div>${a} ${b}</div>`')).not.toEqual(
      expect.arrayContaining([expect.stringContaining('a')])
    );
  });

  test('no new untranslated literal, no stale baseline entry', () => {
    const manifest = getTranslationKeyManifest();
    const coveredFallbacks = new Set(
      manifest
        .map(entry => entry.fallback)
        .filter((fallback): fallback is string => typeof fallback === 'string')
        .map(normalizeFallback)
    );

    const files = allSourceFiles();
    expect(files.length).toBeGreaterThan(100);

    const hitsByFile = new Map<string, string[]>();
    for (const file of files) {
      const src = readFileSync(file, 'utf8');
      // A literal equal to a fallback is covered only in a file that goes
      // through the seam itself: the English identity kept beside its
      // `…Wording` (`name: 'Today'` + `nameWording`). Matching fallbacks
      // repo-wide would let the key minted for the slash menu's "Today"
      // silently cover the untranslated "Today" of every other surface.
      // ponytail: per file, not per literal — an unkeyed "Copy" in a file that
      // also keys one passes. Upgrade path: pair each literal with its sibling
      // wording once an AST walk is worth it.
      const usesSeam = SEAM_USE.test(src);
      const hits = findHits(src).filter(
        hit => !(usesSeam && coveredFallbacks.has(hit))
      );
      if (hits.length > 0) {
        hitsByFile.set(toRepoRelative(file), hits);
      }
    }
    const currentCounts = countsFromHits(hitsByFile);

    const mode = process.env.UPDATE_I18N_BASELINE;
    if (mode === 'init') {
      // Used ONCE, to seed the file from scratch. Using it again later is
      // a review red flag: it means someone regenerated the classification
      // rather than moving individual entries between sections by hand.
      writeBaseline(classifyFresh(hitsByFile));
    } else if (mode) {
      writeBaseline(removeStaleOnly(readBaseline(), currentCounts));
    }

    const baseline = readBaseline();
    const baselineCounts = mergedBaselineCounts(baseline);

    const newHits: string[] = [];
    for (const [file, text] of allFileTextPairs(currentCounts)) {
      const surplus =
        countOf(currentCounts, file, text) -
        countOf(baselineCounts, file, text);
      for (let i = 0; i < surplus; i++) newHits.push(`${file}: ${text}`);
    }

    const staleEntries: string[] = [];
    for (const [file, text] of allFileTextPairs(baselineCounts)) {
      const surplus =
        countOf(baselineCounts, file, text) -
        countOf(currentCounts, file, text);
      for (let i = 0; i < surplus; i++) staleEntries.push(`${file}: ${text}`);
    }

    const counts = sectionCounts(baseline);
    console.info(
      `[literals] kept=${counts.kept} deferred=${counts.deferred} pending=${counts.pending}`
    );

    expect(
      newHits.sort(),
      'A string literal with no i18n key appeared. Give it a key ' +
        '(see packages/affine/shared/src/services/translation-service/README.md), ' +
        'or — only on a PO decision — add it to `KEPT_HITS` in this spec.'
    ).toEqual([]);
    expect(
      staleEntries.sort(),
      'A baseline entry no longer matches any literal (translated or ' +
        'removed). Run `UPDATE_I18N_BASELINE=1 yarn vitest run literals` ' +
        'from packages/affine/all to drop it.'
    ).toEqual([]);
  }, 90_000);

  /**
   * **Would have caught #390 (4) and S3-S6.** The minimal form of the "bare
   * function argument" pattern, restricted to the shape that actually matters.
   *
   * An `Error`'s `message` is written for a developer. Two classes in this
   * repo are different: their instances are CAUGHT AND RENDERED — the
   * interchange import's failure notification and the embed iframe's error
   * card — and both therefore carry a `messageKey` the catch site resolves.
   * A construction of one of them that declares no key is a sentence that
   * will be drawn in English under a translated heading, which is exactly
   * what #390 reported and what `svg-sketch.ts` did with three sentences.
   *
   * Narrow by construction, so it needs no baseline: 10 construction sites
   * across the repo today, one deliberate exception.
   */
  const DISPLAYED_ERROR_CLASSES = [
    'InterchangeImportError',
    'EmbedIframeError',
  ];

  /**
   * The one displayed error that deliberately declares no key: a DI wiring
   * failure is not a fact about the user's file, so the card shows its own
   * generic sentence (`EMBED_IFRAME_ERROR_FALLBACK`) and this technical one
   * stays for the console.
   */
  const ERRORS_WITHOUT_A_KEY_ON_PURPOSE = [
    'packages/affine/blocks/embed/src/embed-iframe-block/embed-iframe-block.ts: ' +
      'EmbedIframeService or LinkPreviewService not found',
  ];

  test('a displayed error names its own sentence (#390)', () => {
    const offenders: string[] = [];
    let constructions = 0;

    for (const file of allSourceFiles()) {
      const src = readFileSync(file, 'utf8');
      for (const className of DISPLAYED_ERROR_CLASSES) {
        const opening = new RegExp(`new\\s+${className}\\s*\\(`, 'g');
        for (const match of src.matchAll(opening)) {
          constructions++;
          // The whole call, by balanced parentheses — the message and the
          // options object both sit inside it, however they are formatted.
          let index = match.index + match[0].length;
          let depth = 1;
          while (index < src.length && depth > 0) {
            const char = src[index];
            if (char === '(') depth++;
            else if (char === ')') depth--;
            index++;
          }
          const call = src.slice(match.index, index);
          if (/\bmessageKey\s*:/.test(call)) continue;

          const message = /['"`]((?:[^'"`\\]|\\.)*)['"`]/.exec(call)?.[1] ?? '';
          offenders.push(`${toRepoRelative(file)}: ${message}`);
        }
      }
    }

    // The inventory is load-bearing: if the classes are renamed and this drops
    // to zero the test would pass while proving nothing.
    expect(constructions, 'displayed-error construction sites').toBeGreaterThan(
      5
    );
    expect(
      offenders.sort(),
      'a displayed error with no messageKey: its message will be drawn in ' +
        'English under a translated heading. Declare a wording in the ' +
        "package's translations.ts and pass its key, or — if the sentence is " +
        'for a developer and the catch site should show its generic one — ' +
        'list it in ERRORS_WITHOUT_A_KEY_ON_PURPOSE with the reason.'
    ).toEqual(ERRORS_WITHOUT_A_KEY_ON_PURPOSE.sort());
  }, 90_000);
});
