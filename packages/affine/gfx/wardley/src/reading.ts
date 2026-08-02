import type {
  ReadingNamingConvention,
  ReadingProfile,
} from '@labre/affine-block-surface';

import { WARDLEY_BACKGROUND } from './background';
import { WARDLEY_NATURE, WARDLEY_NATURE_TAG_ID } from './natures';
import { WARDLEY_ROLE, WARDLEY_ROLES } from './roles';

/**
 * What Wardley lets the tool read of a component (MF3, the reversed reading).
 *
 * DATA, like the rules and the profiles beside it: the engine
 * (`@labre/affine-block-surface`) knows how to read a role, a tag, a typed edge
 * and a declared background — it knows nothing about Wardley. Everything below
 * is already stated somewhere else in this framework and is merely POINTED AT
 * here: the role vocabulary (`roles.ts`), the nature tag (`natures.ts`), the
 * dependency edge (ADR 0010 § 2 tier 2) and the map's own zones
 * (`background.ts`).
 *
 * Registered from the FLAG-GATED view extension: reading a map is tooling, so a
 * board whose Wardley flag is off keeps every element it has and simply stops
 * being read (ADR 0009).
 */

/**
 * ## The naming convention, and why it is one motif rather than a grammar
 *
 * Wardley's four natures answer "what KIND of thing is this?", and two of the
 * four answers are visible in the NAME long before anyone opens a picker: an
 * activity is something that is DONE, and the other three are things that
 * ARE — something recorded, a way of doing, something known.
 *
 * So the convention retained is exactly one motif — **does the name read as an
 * action?** — expressed as the English gerund (`…ing`), applied POSITIVELY to
 * `activity` and NEGATIVELY to the three others:
 *
 * | nature    | expected                          | example              |
 * | --------- | --------------------------------- | -------------------- |
 * | activity  | reads as an action                | "Brewing tea"        |
 * | data      | does NOT read as an action        | "Customer register"  |
 * | practice  | does NOT read as an action        | "Agile method"       |
 * | knowledge | does NOT read as an action        | "Thermodynamics"     |
 *
 * One motif, four entries, no word list. A vocabulary of "practice-ish nouns"
 * would be a dictionary the library would then own, in one language, and would
 * be wrong for the first client who names things in their own — whereas the
 * gerund is a single, checkable shape a user can predict from the sentence they
 * are shown.
 *
 * It is a SUGGESTION and never a verdict: it produces no violation, blocks no
 * gesture, and the panel prints the wording below rather than a red mark. A
 * component named "Tea" whose nature is `activity` is very often correct — the
 * architect writing shorthand — and the reading's job is to ask, not to insist.
 *
 * The wording travels as an i18n key with an English fallback, like every other
 * declaration in this framework: the host localises it, and a host with no
 * catalogue still reads a real sentence.
 */
const ACTION_MOTIF = String.raw`\b\p{L}+ing\b`;

const naming = (
  valueId: string,
  expectsAction: boolean,
  key: string,
  fallback: string
): ReadingNamingConvention => ({
  valueId,
  // The negative form is the same motif under a lookahead, so the two can never
  // drift apart: change what "reads as an action" means and both sides move.
  pattern: expectsAction ? ACTION_MOTIF : `^(?!.*${ACTION_MOTIF}).+$`,
  hintKey: key,
  hintFallback: fallback,
});

export const WARDLEY_NAMING_CONVENTIONS: readonly ReadingNamingConvention[] = [
  naming(
    WARDLEY_NATURE.activity,
    true,
    'com.labre.wardley.reading.naming.activity',
    'An activity is something that is done — name it with a verb ("Brewing tea"), not with a thing.'
  ),
  naming(
    WARDLEY_NATURE.data,
    false,
    'com.labre.wardley.reading.naming.data',
    'Data is something recorded — name it as a thing ("Customer register"), not as an action.'
  ),
  naming(
    WARDLEY_NATURE.practice,
    false,
    'com.labre.wardley.reading.naming.practice',
    'A practice is a way of doing — name the practice ("Agile method"), not the doing.'
  ),
  naming(
    WARDLEY_NATURE.knowledge,
    false,
    'com.labre.wardley.reading.naming.knowledge',
    'Knowledge is something known — name what is known ("Thermodynamics"), not an activity.'
  ),
];

export const WARDLEY_READING: ReadingProfile = {
  id: 'wardley',
  framework: 'wardley',
  roles: WARDLEY_ROLES,
  // The subject is a component. `market` and `ecosystem` specialise it and are
  // read for free through `roleIsA` — that is the entire reason role hierarchy
  // is data. The `anchor` (a user / need) is deliberately NOT a child of
  // `component` and is deliberately not read: a need has no nature and no
  // phase, it has a demand.
  appliesTo: WARDLEY_ROLE.component,
  // On this canvas a name IS a separate free text element grouped with the
  // node — the same fact W3 measures overlaps against.
  labelRole: WARDLEY_ROLE.label,
  nature: {
    tagId: WARDLEY_NATURE_TAG_ID,
    conventions: WARDLEY_NAMING_CONVENTIONS,
  },
  // The value-chain link. ADR 0010 § 2: `source` is the subject of the role's
  // verb, and this role's verb is "depends on" — so the source is the consumer
  // and the target is what it needs.
  relation: { edgeRole: WARDLEY_ROLE.dependency },
  frame: {
    backgroundRole: WARDLEY_ROLE.map,
    background: WARDLEY_BACKGROUND,
    // Evolution runs along the plot's x axis; its four zones ARE the phases.
    axis: 'x',
  },
  /**
   * The two record properties a reading may compare itself against.
   *
   * Host keys, and plain ones on purpose: the library does not name a property
   * of somebody else's document, it states which two it would read IF the host
   * ships them (and lists them in `hoverFields`). A host whose record spells
   * them differently gets no comparison and no drift — silence, which is the
   * correct answer to "I cannot see the record's nature".
   */
  recordKeys: { nature: 'nature', phase: 'phase' },
};
