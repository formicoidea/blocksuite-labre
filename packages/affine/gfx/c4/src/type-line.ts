import type { C4NodeKind } from '@labre/affine-model';
import {
  type ChromeWording,
  translateKey,
} from '@labre/affine-shared/services';
import type { BlockStdScope } from '@labre/std';

/**
 * The middle tier of a C4 element's label — `[Person]`, `[Software System]`,
 * `[Container: Java]` — SEMI-DERIVED: the word comes from the kind, the
 * technology from the author.
 *
 * ## Semi-derived, and where the line actually lives
 *
 * The line is a real canvas TEXT element now (PO recette, 28/08/2026): a C4
 * component is the shape and its own words, grouped, and every tier is edited in
 * place like any other text on the canvas rather than typed into a form. So the
 * string IS stored — but only half of it is the author's. The bracketed word is
 * the notation's and comes from `kind`, which is what the renderer paints and
 * what the exporter maps; letting an author retype it would be letting the words
 * disagree with the picture.
 *
 * {@link normalizeC4TypeLine} is what keeps the halves apart. It runs when an
 * edit COMMITS, reads whatever was typed for the one thing the notation leaves
 * to the author — the technology — and writes the canonical line back. Type
 * `Java` and the line becomes `[Container: Java]`; type `[Database: Java]` on a
 * cylinder and it becomes `[Container: Java]`, because a database IS a container
 * and the stencil says so.
 */

/**
 * The base word each kind is announced by, verbatim from the stencil's own
 * `<desc>` strings (`C4Model_default.svg`, the PO's reference model).
 *
 * Two readings are worth spelling out, because both look like mistakes:
 *
 * - `database` says **Container**, not "Database". The stencil labels the
 *   cylinder `[Container: technology]` exactly as it labels the plain box: a
 *   database is a CONTAINER, and the cylinder is a picture of one, not a fourth
 *   level. (The mermaid export still emits `ContainerDb` — that is the one
 *   specialisation mermaid's own grammar draws, and it is a different question
 *   from what the box says on the canvas.)
 * - an `-ext` variant says the same word as the kind it is external to. What
 *   "external" changes is the COLOUR — grey — and the stencil's gray sheet
 *   carries the identical `[Person]` / `[Software System]` wording.
 *
 * `Record<C4NodeKind, …>` and therefore compile-total: a kind added to the model
 * without a word to announce it fails the build here.
 */
export const C4_TYPE_WORD: Record<C4NodeKind, string> = {
  person: 'Person',
  'person-ext': 'Person',
  system: 'Software System',
  'system-ext': 'Software System',
  container: 'Container',
  database: 'Container',
  mobile: 'Container',
  browser: 'Container',
  component: 'Component',
};

/**
 * {@link C4_TYPE_WORD}'s own i18n key, one per DISTINCT word (four kinds
 * share `Container`, two share `Person`, two share `Software System`, one
 * word each carries one key).
 *
 * The PO's own glossary (`brief-i18n.md`) names "Software System",
 * "Container" and "Component" franglais — the French proposal IS the English
 * word — and this lot extends the same choice to "Person" and to
 * {@link TYPE_TECHNOLOGY_PLACEHOLDER}, for a reason beyond consistency: this
 * whole file's comparisons (`technologyOfTypeLine`, `C4_TYPE_PLACEHOLDER`,
 * `c4StatedTechnology` in `component.ts`) read the STORED text back against
 * these very words, and `c4StatedTechnology` runs from the `std`-free exporter
 * (`export.ts`, ADR 0012 P3) — it cannot ask a host's catalogue at all. Keeping
 * the shipped French wording IDENTICAL to English is what keeps that
 * comparison correct on a document seeded in French. A host that overrides
 * the catalogue with a genuinely different word regains the risk the
 * `DESCRIPTION_PLACEHOLDER_KEY` comment in `consts.ts` already names for the
 * description tier.
 */
// Named constants rather than the key literals inline: `manifest.unit.spec.ts`
// reads two adjacent single-quoted literals in one argument list as a
// key/fallback PAIR, with no anchor on `translateKey(` — and a `Record`
// spelling each key out beside the NEXT (quoted, hyphenated) property name
// below it reads exactly like one. Referencing an identifier instead of
// repeating the literal sidesteps the false pairing.
const PERSON_KEY = 'com.labre.c4.type.person';
const SYSTEM_KEY = 'com.labre.c4.type.system';
const CONTAINER_KEY = 'com.labre.c4.type.container';
const COMPONENT_KEY = 'com.labre.c4.type.component';

export const C4_TYPE_WORD_KEY: Record<C4NodeKind, string> = {
  person: PERSON_KEY,
  'person-ext': PERSON_KEY,
  system: SYSTEM_KEY,
  'system-ext': SYSTEM_KEY,
  container: CONTAINER_KEY,
  database: CONTAINER_KEY,
  mobile: CONTAINER_KEY,
  browser: CONTAINER_KEY,
  component: COMPONENT_KEY,
};

/** The word an `std` (when given) resolves {@link kind}'s bracket to. */
function typeWord(kind: C4NodeKind, std?: BlockStdScope): string {
  const english = C4_TYPE_WORD[kind];
  return std ? translateKey(std, C4_TYPE_WORD_KEY[kind], english) : english;
}

/**
 * The type line as it is drawn, brackets included.
 *
 * The technology is appended only when the author actually set one — an empty
 * box, or one holding nothing but spaces, is not a technology and must not
 * produce a dangling `[Container: ]`. Whitespace runs collapse for the same
 * reason they do in the mermaid sanitizer: the line is one line.
 *
 * Pure and total; `std` is OPTIONAL and, when given, resolves the bracketed
 * word through the host's catalogue ({@link typeWord}) — the renderer, the
 * exporter and a test can all still ask the same question with no `std` at
 * all and get the same English answer they always have.
 */
export function c4TypeLine(
  kind: C4NodeKind,
  technology?: string,
  std?: BlockStdScope
): string {
  const word = typeWord(kind, std);
  const techn = (technology ?? '').replaceAll(/\s+/g, ' ').trim();
  return techn ? `[${word}: ${techn}]` : `[${word}]`;
}

/* ── Reading the line back ─────────────────────────────────────────────── */

/**
 * The type words, lowercased — the vocabulary a `<word>:` prefix is recognised
 * against, and the whole reason {@link technologyOfTypeLine} does not simply cut
 * at the first colon.
 *
 * Derived from {@link C4_TYPE_WORD} rather than restated, so a word added to the
 * notation is understood on the way back in the moment it can be written out.
 *
 * Cutting at the first colon unconditionally was the obvious implementation and
 * it is wrong on the one input an architect is most likely to paste: a URL. `an
 * author typing "https://internal/docs" as their technology would have it read
 * as the prefix `https` and keep `//internal/docs`. Matching the VOCABULARY
 * instead can only ever strip a word the notation itself writes.
 */
const KNOWN_TYPE_WORDS: ReadonlySet<string> = new Set(
  Object.values(C4_TYPE_WORD).map(word => word.toLowerCase())
);

/**
 * {@link KNOWN_TYPE_WORDS}, plus the host-resolved word of every kind when
 * `std` is given — so a line seeded in a translated host (`c4TypeLine(kind,
 * …, std)` at placement, or after a commit the watcher rebuilt) is still
 * recognised as carrying THE NOTATION'S word and not a technology typed on
 * its own. With no `std` this is exactly {@link KNOWN_TYPE_WORDS}.
 */
function knownTypeWords(std?: BlockStdScope): ReadonlySet<string> {
  if (!std) return KNOWN_TYPE_WORDS;
  const words = new Set(KNOWN_TYPE_WORDS);
  for (const kind of Object.keys(C4_TYPE_WORD) as C4NodeKind[]) {
    words.add(typeWord(kind, std).toLowerCase());
  }
  return words;
}

/**
 * The technology an author stated in a type line, whatever shape they left it
 * in — `''` when they stated none.
 *
 * Total over every string, which is what it has to be: this reads a canvas TEXT
 * element somebody edited in place, so its input is not a field with a grammar,
 * it is whatever was typed. Every one of these is a line this has met:
 *
 * ```
 * [Container: Java]  →  Java      the canonical form
 * Container: Java    →  Java      brackets deleted while editing
 * Java               →  Java      the whole line selected and retyped
 * [Container]        →  ''        the word alone: no technology stated
 * [Container: ]      →  ''        the technology deleted, brackets kept
 * https://x/docs     →  https://x/docs   a colon that is NOT a prefix
 * ```
 *
 * Pure and total; `std` is OPTIONAL, exactly like {@link c4TypeLine} —
 * without it this reads a line the same way it always has, and with it the
 * vocabulary the `<word>:` prefix is matched against ALSO recognises the
 * host's own resolved word ({@link knownTypeWords}), so a line seeded or
 * normalized in a translated host still gives back the right technology
 * rather than the whole line.
 *
 * It deliberately does NOT know about the creation placeholder: a node created
 * and never touched carries `[Container: technology]`, and reading that as "no
 * technology" here would make a focus-and-blur silently rewrite it to
 * `[Container]` — the normalizer would eat the stencil's own prompt. The
 * placeholder is a question for whoever asks what the element STATES, which is
 * the exporter, and it is answered there.
 */
export function technologyOfTypeLine(
  text: string | null | undefined,
  std?: BlockStdScope
): string {
  const flat = (text ?? '')
    .replaceAll(/[[\]]/g, ' ')
    .replaceAll(/\s+/g, ' ')
    .trim();
  const colon = flat.indexOf(':');
  const words = knownTypeWords(std);
  // No colon at all: the line is either the bare notation word — which states no
  // technology — or it is the technology, typed on its own.
  if (colon < 0) return words.has(flat.toLowerCase()) ? '' : flat;
  const head = flat.slice(0, colon).trim().toLowerCase();
  if (!words.has(head)) return flat;
  return flat.slice(colon + 1).trim();
}

/**
 * A type line as it must be STORED, whatever was typed into it.
 *
 * The semi-derived rule of the PO's recette, in one function: read the one half
 * the author owns, write the whole line back from the kind. `[Person: Java]`
 * typed on a container becomes `[Container: Java]`, a bare `Java` becomes
 * `[Container: Java]`, and an emptied line becomes `[Container]`.
 *
 * Idempotent by construction — `normalize(normalize(x)) === normalize(x)` —
 * which is what lets it run on every commit without a guard.
 *
 * `std` is OPTIONAL and, when given, is threaded to both halves: the
 * technology is read back recognising the host's own word
 * ({@link technologyOfTypeLine}) and the line is rebuilt with it
 * ({@link c4TypeLine}) — see `C4TypeLineWatcher`, the one real caller that
 * has an `std` to give it.
 */
export function normalizeC4TypeLine(
  kind: C4NodeKind,
  rawText: string | null | undefined,
  std?: BlockStdScope
): string {
  return c4TypeLine(kind, technologyOfTypeLine(rawText, std), std);
}

/* ── What a fresh element says before anybody writes on it ─────────────── */

/**
 * The word a fresh type line prompts the author with, in the technology's slot.
 *
 * The stencil's own: its container reads `[Container: technology]` before
 * anybody fills it in. A prompt rather than a value — see
 * {@link C4_TYPE_PLACEHOLDER}.
 */
export const TYPE_TECHNOLOGY_PLACEHOLDER = 'technology';

/**
 * {@link TYPE_TECHNOLOGY_PLACEHOLDER}'s own key — see the long comment on
 * {@link C4_TYPE_WORD_KEY} for why this lot's shipped French proposal keeps
 * it identical to English.
 */
export const C4_TECHNOLOGY_PLACEHOLDER_KEY =
  'com.labre.c4.type.technology-placeholder';

/** The word an `std` (when given) resolves the technology prompt to. */
function technologyPlaceholderWord(std?: BlockStdScope): string {
  return std
    ? translateKey(
        std,
        C4_TECHNOLOGY_PLACEHOLDER_KEY,
        TYPE_TECHNOLOGY_PLACEHOLDER
      )
    : TYPE_TECHNOLOGY_PLACEHOLDER;
}

/**
 * Every wording this file writes onto the canvas, for `translations.ts`'s
 * manifest contribution — the four distinct type words plus the technology
 * prompt, all `seed` (written into the document once, at placement or at a
 * commit the watcher normalizes).
 */
export const C4_TYPE_LINE_WORDINGS: readonly ChromeWording[] = [
  [C4_TYPE_WORD_KEY.person, C4_TYPE_WORD.person],
  [C4_TYPE_WORD_KEY.system, C4_TYPE_WORD.system],
  [C4_TYPE_WORD_KEY.container, C4_TYPE_WORD.container],
  [C4_TYPE_WORD_KEY.component, C4_TYPE_WORD.component],
  [C4_TECHNOLOGY_PLACEHOLDER_KEY, TYPE_TECHNOLOGY_PLACEHOLDER],
];

/**
 * Which kinds announce a technology in their type line AT ALL.
 *
 * The notation's own division and not mermaid's, though the two agree: a person
 * is not built with a technology and a software system's is a level down, so
 * both are written `[Person]` / `[Software System]` full stop. Every container
 * — the cylinder, the phone and the browser window included — and every
 * component carries `[Word: technology]`, because at those two levels "what is
 * it built with" is the question the diagram exists to answer.
 *
 * This decides the PLACEHOLDER only. An author who types a technology onto a
 * person gets it drawn, exactly as `c4TypeLine` has always drawn it: the
 * notation is a prompt here, not a validator.
 */
export const C4_TYPE_TAKES_TECHNOLOGY: Record<C4NodeKind, boolean> = {
  person: false,
  'person-ext': false,
  system: false,
  'system-ext': false,
  container: true,
  database: true,
  mobile: true,
  browser: true,
  component: true,
};

/**
 * The type line a freshly created element is born carrying, per kind.
 *
 * Every tier of a C4 component exists from the moment it is drawn (PO
 * arbitration, 28/08/2026), so the author meets three lines of stencil rather
 * than a box and two invisible slots they have to be told about. What they meet
 * is what the official stencil shows: `[Person]`, `[Software System]`,
 * `[Container: technology]`, `[Component: technology]`.
 *
 * A PROMPT, not a value: {@link C4_TYPE_PLACEHOLDER} is what the exporter
 * compares against to decide the author has stated nothing yet, so an untouched
 * element exports as `Container(alias, "Container")` rather than as one built
 * with a technology literally called "technology".
 */
export const C4_TYPE_PLACEHOLDER = Object.fromEntries(
  (Object.keys(C4_TYPE_WORD) as C4NodeKind[]).map(kind => [
    kind,
    c4TypeLine(
      kind,
      C4_TYPE_TAKES_TECHNOLOGY[kind] ? TYPE_TECHNOLOGY_PLACEHOLDER : undefined
    ),
  ])
) as Record<C4NodeKind, string>;

/**
 * {@link C4_TYPE_PLACEHOLDER}, resolved through `std` when given — the
 * placement site (`createC4Node`, `actions.ts`) seeds a fresh element with
 * this rather than the English-only constant, so a component drawn in a
 * translated host starts in that language, like every other seed
 * (`docs/adr/0016`). With no `std` this returns exactly
 * `C4_TYPE_PLACEHOLDER[kind]`.
 */
export function c4TypePlaceholder(
  kind: C4NodeKind,
  std?: BlockStdScope
): string {
  return c4TypeLine(
    kind,
    C4_TYPE_TAKES_TECHNOLOGY[kind] ? technologyPlaceholderWord(std) : undefined,
    std
  );
}

/* ── What the line becomes when the shape becomes something else ───────── */

/**
 * The type line a component should carry once its shape has morphed from `from`
 * to `to` — or `null` when the line is the AUTHOR's and must not be touched.
 *
 * ## Why a morph has to ask this at all
 *
 * The bracketed word is derived from `kind` (see the head of this file), so a
 * shape that becomes a component while its caption still reads `[Container]` is
 * a picture contradicting its own words. But the caption is a canvas TEXT
 * element an architect may have typed anything into, and rewriting that would
 * be the morph taking away something nobody asked it to touch. So the rule is
 * the narrowest one that fixes the contradiction:
 *
 * - the SOURCE kind's untouched prompt (`[Container: technology]`) becomes the
 *   TARGET's own prompt — `[Person]` on the way to a person, not `[Person:
 *   technology]`, because a person is not built with a technology
 *   ({@link C4_TYPE_TAKES_TECHNOLOGY});
 * - a line that is exactly what the source kind DERIVES — `[Container: React]`,
 *   the form {@link normalizeC4TypeLine} leaves behind after every edit — is
 *   re-derived for the target, technology and all: `[Component: React]`;
 * - anything else is the author's and comes back `null`. A line reading
 *   `see ADR 0042`, or one mid-edit, survives the morph verbatim.
 *
 * The placeholder is tested FIRST and not folded into the second branch, which
 * would find it too: `technologyOfTypeLine('[Container: technology]')` is the
 * literal word `technology`, and carrying it across would hand a person the
 * `[Person: technology]` no stencil ever draws.
 *
 * ## Inert on today's families, and kept anyway
 *
 * Every family declared in `./morph.ts` shares one {@link C4_TYPE_WORD} — all
 * four containers say `Container`, both people say `Person`, both systems say
 * `Software System` — and shares its {@link C4_TYPE_TAKES_TECHNOLOGY} answer
 * too, so on the shipped table this function returns the line it was given and
 * nothing visibly happens. That is a property of the FAMILIES, which are data
 * and grow by declaration, not of the notation: the moment a family gains a
 * member that announces itself differently, the caption follows the shape
 * without anyone being prompted to remember it should.
 *
 * Pure, total and `std`-free, like everything else in this file.
 */
export function c4MorphedTypeLine(
  from: C4NodeKind,
  to: C4NodeKind,
  rawText: string | null | undefined,
  std?: BlockStdScope
): string | null {
  const text = (rawText ?? '').trim();
  if (!text) return null;
  // The untouched prompt, in EITHER language: the English literal (a document
  // seeded before these keys existed, or with no host) or the host's own
  // resolved wording (`c4TypePlaceholder`, which equals the English constant
  // when `std` is absent) — see the module docstring.
  if (
    text === C4_TYPE_PLACEHOLDER[from] ||
    text === c4TypePlaceholder(from, std)
  ) {
    return c4TypePlaceholder(to, std);
  }
  if (text !== normalizeC4TypeLine(from, text, std)) return null;
  return c4TypeLine(to, technologyOfTypeLine(text, std), std);
}
