import type { UmlNodeKind } from '@labre/affine-model';

/**
 * UML keywords, the guillemets they are written in, and the words a fresh
 * artefact arrives carrying.
 *
 * ## Why keywords are a module and not a string literal
 *
 * A keyword is not decoration: UML 2.5.1 Annex C (normative) makes it the thing
 * that tells two artefacts apart when the notation draws them the same way. A
 * compartmented rectangle is a Class; the SAME rectangle with `«interface»` in
 * its header box is an Interface. So the keyword carries the author's statement,
 * the exporters read it back out of the name compartment
 * ({@link stereotypesOf}), and the seeds below are what puts it there in the
 * first place.
 *
 * Annex C is also explicit about the punctuation: keywords are "always enclosed
 * in guillemets", and the note under the table warns that `<<` and `>>` are a
 * fallback for character sets that lack `«»`, not a spelling. Labre writes the
 * real characters ({@link guillemets}) and READS both, because a diagram pasted
 * in from a tool that only had ASCII still means what it says.
 */

/* ── Writing one ──────────────────────────────────────────────────────── */

/**
 * A keyword as it is written on a diagram — `interface` → `«interface»`.
 *
 * The real guillemets, per the Annex C note. Nothing is validated: Annex C's
 * table is the list of keywords UML defines, not the list of labels an author
 * may write between guillemets — a stereotype name goes in the same brackets
 * (Annex C, "Not all words appearing between guillemets are necessarily
 * keywords"), and refusing one here would be this module inventing a rule the
 * spec declines to make.
 */
export function guillemets(keyword: string): string {
  return `«${keyword}»`;
}

/** The opening and closing guillemet, named so no call site types a raw glyph. */
export const GUILLEMET_OPEN = '«';
export const GUILLEMET_CLOSE = '»';

/* ── Where one is written ─────────────────────────────────────────────── */

/**
 * The places Annex C says a keyword may appear, verbatim from its own legend
 * (the eight conventions listed under "Notation Placement").
 *
 * Phase 1 only ever writes in three of them, and the union carries the rest
 * anyway because it is a transcription of a normative list: narrowing it to
 * what we happen to draw today would turn a quotation into an opinion.
 */
export type UmlKeywordPlacement =
  | 'box header'
  | 'dashed-line label'
  | 'line label'
  | 'inline label'
  | 'swimlane header'
  | 'note label'
  | 'top left corner'
  | 'after name';

/**
 * The Annex C keywords phase 1 can draw, each with the placement Table C.1
 * gives it.
 *
 * A SUBSET, declared as one: UML defines some eighty keywords and phase 1 draws
 * four structural diagram families, so the table below is the twelve words that
 * can honestly appear on a class, package, object or use case diagram. Phase 2
 * appends to it; nothing here is rewritten.
 *
 * Read the placements straight off Table C.1 (pp. 746-748):
 *
 *  - `interface`, `enumeration`, `dataType` — **box header**: they sit in the
 *    name compartment of a classifier rectangle, which is what makes the same
 *    rectangle mean three different metaclasses;
 *  - `use`, `call`, `create` — **dashed-line label**: a Usage is a Dependency,
 *    and every Dependency is one dashed arrow among many, so the keyword is the
 *    only thing on the picture that says which one it is;
 *  - `import`, `access` — **dashed-line label**: the same PackageImport drawn
 *    twice, public and private (Table C.1 keys them on `visibility`);
 *  - `merge` — **dashed-line label**, a PackageMerge;
 *  - `include`, `extend` — **dashed-line label**, the two relationships between
 *    UseCases (§18.1.4).
 *
 * `abstract` is the one entry that is NOT in Table C.1, and it is here because
 * the parser has to recognise it: §9.2.4 writes an abstract Classifier's name in
 * italics, and a canvas with no italic name compartment writes the alternative
 * the same clause allows — `{abstract}` after the name. It is a MODIFIER, not a
 * keyword, so it takes no guillemets, and {@link stereotypesOf} reports it in
 * its own field rather than in the keyword list.
 *
 * `create` appears TWICE in Table C.1 — as a dashed-line label on a Usage and as
 * an inline label on a constructor BehavioralFeature. The dependency reading is
 * the one phase 1 draws, and it is the one recorded.
 */
export const UML_KEYWORD_PLACEMENT: Readonly<
  Record<string, UmlKeywordPlacement>
> = {
  interface: 'box header',
  enumeration: 'box header',
  dataType: 'box header',
  use: 'dashed-line label',
  create: 'dashed-line label',
  call: 'dashed-line label',
  import: 'dashed-line label',
  access: 'dashed-line label',
  merge: 'dashed-line label',
  include: 'dashed-line label',
  extend: 'dashed-line label',
  // Not Annex C: the `{abstract}` modifier of §9.2.4. See the docblock.
  abstract: 'after name',
  // ── Appended by phase 2 (components and deployments) ──────────────────
  // Table C.1, all six, with the placements it gives them:
  //  - `component`, `artifact`, `device` and `executionEnvironment` are **box
  //    header** keywords — the word written above the name of the rectangle or
  //    the cube, which is what makes one cube a Device and the next a plain Node
  //    (§19.4.4). `component` is the one of the four an author may drop: §11.6.4
  //    lets the corner ICON stand in for the keyword, and this pack draws the
  //    icon — so the seed does not write it, and the parser still reads it off a
  //    component pasted in from a tool that does;
  //  - `deploy` and `manifest` are **dashed-line labels**, the keyword being the
  //    only thing on the picture that says which dependency a dashed arrow is
  //    (§19.2.4, §19.3.4).
  component: 'box header',
  artifact: 'box header',
  device: 'box header',
  executionEnvironment: 'box header',
  deploy: 'dashed-line label',
  manifest: 'dashed-line label',
};

/* ── What a fresh artefact says ───────────────────────────────────────── */

/**
 * The text a node arrives with in its NAME compartment, per kind.
 *
 * Every seed is a true statement about the box that carries it — which is the
 * rule the C4 pack settled on and the reason its title seed is `Container`
 * rather than a bracketed prompt: an unnamed class IS a class, and exporting
 * `Class` says something, where exporting an invented placeholder would say
 * something false. So a diagram the author has not typed on yet still exports,
 * still round-trips, and still reads.
 *
 * Three of them carry more than a word, and each is the notation asking for it:
 *
 *  - `interface` and `enumeration` open with their Annex C keyword above the
 *    name — that keyword is what distinguishes the metaclass, so a fresh
 *    interface that did not carry it would be a class;
 *  - `object` seeds `object : Class`, the underlined `name : Type` of §11.6. The
 *    UNDERLINE is drawn by the renderer and is not in the text: it is notation,
 *    not a character, and an author who retyped the line would otherwise have to
 *    reproduce it.
 */
export const UML_NAME_SEED: Record<UmlNodeKind, string> = {
  class: 'Class',
  interface: `${guillemets('interface')}\nInterface`,
  enumeration: `${guillemets('enumeration')}\nEnumeration`,
  object: 'object : Class',
  package: 'Package',
  note: 'Note',
  actor: 'Actor',
  'use-case': 'Use case',
  // ── Phase 2 ──────────────────────────────────────────────────────────────
  // A component carries NO keyword: §11.6.4 offers the corner icon or the word
  // `«component»`, and this pack draws the icon, so writing both would say the
  // same thing twice on one box.
  component: 'Component',
  // Lower case, and that is §11.3.4: a port is named like the property it is —
  // `port`, not `Port` — and the name is written BESIDE the little square,
  // which is the only place it fits.
  port: 'port',
  // §10.4.4 names an interface point after the interface it stands for, and the
  // `I` prefix is what every tool and every architect writes. Two different
  // seeds because the two glyphs make two different statements: one offers a
  // service, the other needs one.
  'provided-interface': 'IProvided',
  'required-interface': 'IRequired',
  // §19.3.4: an artifact is a FILE, so its seed is a file name — the keyword
  // above it is what the notation puts there, and the extension is what tells a
  // reader this box is a deployable thing rather than a design one.
  artifact: `${guillemets('artifact')}\nartifact.jar`,
  // §19.4.4 names deployment targets as INSTANCES — `:AppServer`, the colon
  // saying "an unnamed instance of". The cubes are the one place in the pack
  // that convention applies, and a seed that read `Node` would teach the wrong
  // one.
  node: ':Node',
  device: `${guillemets('device')}\n:Device`,
  'execution-environment': `${guillemets('executionEnvironment')}\n:Runtime`,
};

/**
 * The attribute compartment of a fresh classifier — one property in the §9.5.4
 * syntax the parser reads back.
 *
 * A worked example rather than a prompt: it parses, it exports, and an author
 * editing it has the grammar in front of them instead of in a manual.
 */
export const UML_ATTRIBUTES_SEED = '+ attribute : Type';

/** The operation compartment of a fresh classifier — §9.6.4, same argument. */
export const UML_OPERATIONS_SEED = '+ operation() : Type';

/**
 * The one written tier of a fresh object — a SLOT, not a property.
 *
 * An InstanceSpecification's compartment holds `name = value` (§11.6.4): no
 * visibility, no type, no multiplicity, because an instance does not redeclare
 * its classifier's features, it gives them values.
 */
export const UML_SLOTS_SEED = 'attribute = value';

/* ── Reading one back ─────────────────────────────────────────────────── */

/** What a name compartment states, once its notation has been read off it. */
export interface UmlStereotypes {
  /**
   * The labels between guillemets, in the order they were written, commas
   * inside one pair split into separate entries per Annex C's
   * `"«" <label> ["," <label>]* "»"`.
   */
  keywords: string[];
  /** Everything else, lines joined by `\n` and trimmed. */
  name: string;
  /** Whether `{abstract}` was written on it (§9.2.4). */
  isAbstract: boolean;
}

/**
 * Both spellings of a guillemet pair — the real characters and the ASCII
 * fallback Annex C's note tolerates.
 *
 * Reading both is not symmetry for its own sake: `<<interface>>` is what every
 * tool that predates a unicode-safe pipeline writes, and a class pasted in from
 * one would otherwise export as a class named `<<interface>> Foo`.
 */
const GUILLEMET_GROUP = /«([^»]*)»|<<([^>]*)>>/g;

/** `{abstract}`, with whatever spacing and case the author used (§9.2.4). */
const ABSTRACT_MARKER = /\{\s*abstract\s*\}/i;

/**
 * A name compartment, split into what the notation says and what the author
 * named the thing.
 *
 * ## Why this is one function and not three
 *
 * The three facts live in the same string and are read by the same pass: a
 * classifier's header box is `«keyword»` lines, then the name, with `{abstract}`
 * anywhere on it. Reading them separately would mean three scans that can
 * disagree about where the name starts.
 *
 * ## Guillemets above the name, and beside it
 *
 * §9.2.4 draws the keyword on its own line above the name, which is what the
 * seeds write. Tools routinely write it INLINE — `«interface» Payable` — and
 * both are accepted here: a group is lifted out wherever it appears, and a line
 * that held nothing else disappears with it. What is left, in order, is the
 * name. Nothing is re-ordered and nothing is folded: a two-line name stays two
 * lines, because a name compartment that wraps is a name that wraps.
 *
 * A compartment with no guillemets and no marker comes back as
 * `{ keywords: [], name: <the text>, isAbstract: false }` — the common case, and
 * it costs the caller no special handling.
 */
export function stereotypesOf(text: string | undefined | null): UmlStereotypes {
  const raw = text === null || text === undefined ? '' : String(text);
  const keywords: string[] = [];
  const kept: string[] = [];

  for (const line of raw.split('\n')) {
    const remainder = line
      .replaceAll(GUILLEMET_GROUP, (_match, spelled, ascii) => {
        const labels = String(spelled ?? ascii ?? '');
        for (const label of labels.split(',')) {
          const trimmed = label.trim();
          if (trimmed) keywords.push(trimmed);
        }
        return ' ';
      })
      .trim();
    // A line that held keywords ALONE is notation, not a name: dropping it is
    // what makes `«interface»\nInterface` read as the interface `Interface`.
    if (remainder) kept.push(remainder);
  }

  let name = kept.join('\n');
  const isAbstract = ABSTRACT_MARKER.test(name);
  if (isAbstract) name = name.replace(ABSTRACT_MARKER, ' ');

  return {
    keywords,
    name: name
      .split('\n')
      .map(line => line.replaceAll(/\s+/g, ' ').trim())
      .filter(line => line.length > 0)
      .join('\n'),
    isAbstract,
  };
}
