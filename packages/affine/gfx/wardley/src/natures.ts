import type { UniverseTagDefs } from '@labre/affine-shared/services';

import { WARDLEY_ROLE } from './roles';

/**
 * The Wardley **nature** tag — the framework's type-3 contextual qualification
 * (PRD level 3, ADR 0007).
 *
 * A component's nature answers "what KIND of thing is this?", which is a
 * different question from its role ("what is it, on a map?") and from its
 * position ("how evolved is it?"). Simon Wardley's four are activity, data,
 * practice and knowledge, and mapping practitioners routinely draw all four on
 * one map — the same circle, the same axes, four different things.
 *
 * ## Why this ships as DATA, on the host's own mechanism
 *
 * The library fixes the FORMAT of tag definitions; the application seeds them.
 * Nothing here is privileged: this pack is registered through the same
 * `UniverseTagDefsExtension` a host uses for its own taxonomy, and a client's
 * private extension of Wardley — say a `criticality` tag — is a second pack
 * with a different `packId` that merges with this one, with no library release.
 * Shipping one real pack is what keeps that mechanism honest.
 *
 * ## Why it applies to `wardley:component` and not to `'*'`
 *
 * A nature qualifies a component. `market` and `ecosystem` specialise
 * `wardley:component`, so they get it for free through `roleIsA` — that is the
 * entire reason role hierarchy is data. The `anchor` (a user / need) is
 * deliberately NOT a child of `component` and is deliberately NOT qualified
 * here: a need has no nature, it has a demand. The map itself, the change
 * arrow, the inertia bar and the labels are chrome or annotations and are not
 * candidates either.
 *
 * ## Why `cardinality: 'single'`
 *
 * A component is one of the four, not several. Where practitioners disagree —
 * "is a data pipeline data or an activity?" — the disagreement is the finding,
 * and forcing one answer is what makes the finding visible. A multi-valued
 * nature would let the ambiguity hide inside the element.
 *
 * Labels are English fallbacks: the host localizes them. The library never
 * pretends a def's `label` is already translated for someone else's locale, and
 * a pack shipped as a `.json` asset carries whatever the host put in it.
 */
export const WARDLEY_NATURE_TAG_ID = 'wardley:nature';

/** The four natures, as value ids. Ids are forever; a def is only deprecated. */
export const WARDLEY_NATURE = {
  activity: `${WARDLEY_NATURE_TAG_ID}/activity`,
  data: `${WARDLEY_NATURE_TAG_ID}/data`,
  practice: `${WARDLEY_NATURE_TAG_ID}/practice`,
  knowledge: `${WARDLEY_NATURE_TAG_ID}/knowledge`,
} as const;

/**
 * The Porter's-forces **competition** tag — which of the forces a glyph marks.
 *
 * The second tag of this pack, and the one that shows the mechanism was worth
 * building: it is declared beside the nature, on the SAME pack, and it applies
 * to a role the nature deliberately never reaches. A force is not a link in the
 * value chain (`roles.ts` says why `wardley:porter` has no parent), so nothing
 * written on `wardley:component` touches it — and this tag, written on
 * `wardley:porter` alone, touches nothing else.
 *
 * ## Why it duplicates the letter, and why that is not a duplication
 *
 * The letter in the circle IS the notation: an architect reads `L` off the map
 * and knows what it says. But a letter is not a FACT anything can query — no
 * rule, no reading, no host report can ask "which forces does this map name?"
 * of a `Y.Text` holding one character. The tag is the queryable half, and
 * `WardleyPorterWatcher` keeps the two saying the same thing in both
 * directions, so neither is the master and the author can work in whichever
 * one is in front of them.
 *
 * `cardinality: 'single'` for the reason the nature gives, and one the drawing
 * gives too: there is exactly one letter in the circle, so a second value would
 * be a qualification the map could not show.
 */
export const WARDLEY_COMPETITION_TAG_ID = 'wardley:competition';

/** The three forces, as value ids. Ids are forever; a def is only deprecated. */
export const WARDLEY_COMPETITION = {
  relative: `${WARDLEY_COMPETITION_TAG_ID}/relative`,
  struggle: `${WARDLEY_COMPETITION_TAG_ID}/struggle`,
  establish: `${WARDLEY_COMPETITION_TAG_ID}/establish`,
} as const;

export const WARDLEY_TAG_DEFS: UniverseTagDefs = {
  formatVersion: 1,
  // The id of this PACK, not of the framework: several packs may extend
  // Wardley, and re-registering this one replaces it rather than duplicating
  // it.
  packId: 'wardley-core',
  framework: 'wardley',
  label: 'Wardley',
  tags: [
    {
      id: WARDLEY_NATURE_TAG_ID,
      label: 'Nature',
      description:
        'What kind of thing this component is: an activity, data, a practice or knowledge.',
      cardinality: 'single',
      appliesTo: [WARDLEY_ROLE.component],
      // No `order`, on either tag of this pack: an absent order sorts by SEED
      // order, which is what puts the library's pack ahead of a client's
      // extension without either having to know about the other. A number here
      // would be a claim about packs that do not exist yet — and it would say
      // nothing anyway, since the two tags below apply to disjoint roles and
      // are therefore never offered in the same dropdown.
      values: [
        {
          id: WARDLEY_NATURE.activity,
          label: 'Activity',
          description: 'Something that is DONE — a step, a service, a process.',
        },
        {
          id: WARDLEY_NATURE.data,
          label: 'Data',
          description: 'Something that is RECORDED — a dataset, a register.',
        },
        {
          id: WARDLEY_NATURE.practice,
          label: 'Practice',
          description:
            'A way of doing — a method, a convention, an operating model.',
        },
        {
          id: WARDLEY_NATURE.knowledge,
          label: 'Knowledge',
          description: 'Something that is KNOWN — a model, a theory, a rule.',
        },
      ],
    },
    {
      id: WARDLEY_COMPETITION_TAG_ID,
      label: 'Competition',
      description:
        "Which of Porter's forces this glyph marks: relative competition, a struggle for survival, or a struggle to establish.",
      cardinality: 'single',
      appliesTo: [WARDLEY_ROLE.porter],
      values: [
        {
          id: WARDLEY_COMPETITION.relative,
          // The label carries the letter, because the letter is what the map
          // shows: a reader picking a value here is choosing what the circle
          // will say, not filling in a form about it.
          label: 'Relative competition (R)',
          description:
            'Established players competing against one another on a market that exists.',
        },
        {
          id: WARDLEY_COMPETITION.struggle,
          label: 'Struggle for survival (L)',
          description:
            'Pressure on a player to stay in a market it is already in.',
        },
        {
          id: WARDLEY_COMPETITION.establish,
          label: 'Struggle to establish (E)',
          description: 'Pressure on a newcomer trying to get into a market.',
        },
      ],
    },
  ],
};
