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
 * A nature qualifies a component. `market`, `ecosystem` and `method`
 * specialise `wardley:component`, so they get it for free through `roleIsA` — that is the
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

/**
 * The **method** tag — how a component + method is sourced, run or staffed.
 *
 * The third tag of this pack, written on `wardley:method` alone. Since that
 * role specialises `wardley:component` (ADR 0046), a method node is offered
 * the nature AND this tag in the same dropdown, while a plain component — the
 * parent, which a child's tag never reaches — is offered the nature only.
 *
 * ## Nine values in one tag, not a category tag and a recommendation tag
 *
 * Simon Wardley's three method families each say one thing per evolution
 * phase: a buying policy builds, buys or outsources; project management runs
 * agile, lean or six sigma; attitudes are pioneers, settlers or town planners.
 * The wardley-map-renderer JSON spells the same thing as a pair —
 * `method: { category, recommendation }`, recommendation one of Uncharted /
 * Transitional / Industrialized — and the two encodings are the same nine
 * facts. One value per fact is the shape that admits nothing else: two tags
 * would let a board say "Transitional" with no family, which nothing can paint
 * (the ring's hue IS the family) and no reader can name. The pair stays one
 * pure lookup away in `method.ts`, both directions.
 *
 * `cardinality: 'single'` because the renderer gives a component ONE method,
 * and because the drawing has one ring to show it with.
 *
 * Labels are the practitioners' own words, short on purpose: the trigger of
 * the dropdown prints the values in force ("Activity, Buy"), and the family
 * shows on the map the moment one is picked, in the ring's colour.
 */
export const WARDLEY_METHOD_TAG_ID = 'wardley:method';

/** The nine methods, as value ids. Ids are forever; a def is only deprecated. */
export const WARDLEY_METHOD = {
  build: `${WARDLEY_METHOD_TAG_ID}/build`,
  buy: `${WARDLEY_METHOD_TAG_ID}/buy`,
  outsource: `${WARDLEY_METHOD_TAG_ID}/outsource`,
  agile: `${WARDLEY_METHOD_TAG_ID}/agile`,
  lean: `${WARDLEY_METHOD_TAG_ID}/lean`,
  sixSigma: `${WARDLEY_METHOD_TAG_ID}/six-sigma`,
  pioneers: `${WARDLEY_METHOD_TAG_ID}/pioneers`,
  settlers: `${WARDLEY_METHOD_TAG_ID}/settlers`,
  townPlanners: `${WARDLEY_METHOD_TAG_ID}/town-planners`,
} as const;

export const WARDLEY_TAG_DEFS: UniverseTagDefs = {
  formatVersion: 1,
  // The id of this PACK, not of the framework: several packs may extend
  // Wardley, and re-registering this one replaces it rather than duplicating
  // it.
  packId: 'wardley-core',
  framework: 'wardley',
  label: 'Wardley',
  labelKey: 'com.labre.wardley.tag-pack.label',
  tags: [
    {
      id: WARDLEY_NATURE_TAG_ID,
      label: 'Nature',
      labelKey: 'com.labre.wardley.tag.nature',
      description:
        'What kind of thing this component is: an activity, data, a practice or knowledge.',
      descriptionKey: 'com.labre.wardley.tag.nature.description',
      cardinality: 'single',
      appliesTo: [WARDLEY_ROLE.component],
      // No `order`, on any tag of this pack: an absent order sorts by SEED
      // order, which is what puts the library's pack ahead of a client's
      // extension without either having to know about the other. A number here
      // would be a claim about packs that do not exist yet. Seed order is also
      // the one dropdown that holds two of them — a method node's — right:
      // what the component IS (this tag) reads before how it is sourced
      // (`wardley:method`, last).
      values: [
        {
          id: WARDLEY_NATURE.activity,
          label: 'Activity',
          labelKey: 'com.labre.wardley.tag.nature.activity',
          description: 'Something that is DONE — a step, a service, a process.',
          descriptionKey: 'com.labre.wardley.tag.nature.activity.description',
        },
        {
          id: WARDLEY_NATURE.data,
          label: 'Data',
          labelKey: 'com.labre.wardley.tag.nature.data',
          description: 'Something that is RECORDED — a dataset, a register.',
          descriptionKey: 'com.labre.wardley.tag.nature.data.description',
        },
        {
          id: WARDLEY_NATURE.practice,
          label: 'Practice',
          labelKey: 'com.labre.wardley.tag.nature.practice',
          description:
            'A way of doing — a method, a convention, an operating model.',
          descriptionKey: 'com.labre.wardley.tag.nature.practice.description',
        },
        {
          id: WARDLEY_NATURE.knowledge,
          label: 'Knowledge',
          labelKey: 'com.labre.wardley.tag.nature.knowledge',
          description: 'Something that is KNOWN — a model, a theory, a rule.',
          descriptionKey: 'com.labre.wardley.tag.nature.knowledge.description',
        },
      ],
    },
    {
      id: WARDLEY_COMPETITION_TAG_ID,
      label: 'Competition',
      labelKey: 'com.labre.wardley.tag.competition',
      description:
        "Which of Porter's forces this glyph marks: relative competition, a struggle for survival, or a struggle to establish.",
      descriptionKey: 'com.labre.wardley.tag.competition.description',
      cardinality: 'single',
      appliesTo: [WARDLEY_ROLE.porter],
      values: [
        {
          id: WARDLEY_COMPETITION.relative,
          // The label carries the letter, because the letter is what the map
          // shows: a reader picking a value here is choosing what the circle
          // will say, not filling in a form about it.
          label: 'Relative competition (R)',
          labelKey: 'com.labre.wardley.tag.competition.relative',
          description:
            'Established players competing against one another on a market that exists.',
          descriptionKey:
            'com.labre.wardley.tag.competition.relative.description',
        },
        {
          id: WARDLEY_COMPETITION.struggle,
          label: 'Struggle for survival (L)',
          labelKey: 'com.labre.wardley.tag.competition.struggle',
          description:
            'Pressure on a player to stay in a market it is already in.',
          descriptionKey:
            'com.labre.wardley.tag.competition.struggle.description',
        },
        {
          id: WARDLEY_COMPETITION.establish,
          label: 'Struggle to establish (E)',
          labelKey: 'com.labre.wardley.tag.competition.establish',
          description: 'Pressure on a newcomer trying to get into a market.',
          descriptionKey:
            'com.labre.wardley.tag.competition.establish.description',
        },
      ],
    },
    {
      id: WARDLEY_METHOD_TAG_ID,
      label: 'Method',
      labelKey: 'com.labre.wardley.tag.method',
      description:
        'How this component is sourced, run or staffed: a buying policy, a project management method or an attitude, at the phase it suits.',
      descriptionKey: 'com.labre.wardley.tag.method.description',
      cardinality: 'single',
      appliesTo: [WARDLEY_ROLE.method],
      // Family by family, and within one family in evolution order: the
      // dropdown reads as the three rows of Wardley's own table.
      values: [
        {
          id: WARDLEY_METHOD.build,
          label: 'Build',
          labelKey: 'com.labre.wardley.tag.method.build',
          description: 'Buying policy, uncharted: build it yourself.',
          descriptionKey: 'com.labre.wardley.tag.method.build.description',
        },
        {
          id: WARDLEY_METHOD.buy,
          label: 'Buy',
          labelKey: 'com.labre.wardley.tag.method.buy',
          description: 'Buying policy, transitional: buy a product.',
          descriptionKey: 'com.labre.wardley.tag.method.buy.description',
        },
        {
          id: WARDLEY_METHOD.outsource,
          label: 'Outsource',
          labelKey: 'com.labre.wardley.tag.method.outsource',
          description:
            'Buying policy, industrialized: rent it as a commodity or a utility.',
          descriptionKey: 'com.labre.wardley.tag.method.outsource.description',
        },
        {
          id: WARDLEY_METHOD.agile,
          label: 'Agile',
          labelKey: 'com.labre.wardley.tag.method.agile',
          description: 'Project management, uncharted: explore and adapt.',
          descriptionKey: 'com.labre.wardley.tag.method.agile.description',
        },
        {
          id: WARDLEY_METHOD.lean,
          label: 'Lean',
          labelKey: 'com.labre.wardley.tag.method.lean',
          description: 'Project management, transitional: remove waste.',
          descriptionKey: 'com.labre.wardley.tag.method.lean.description',
        },
        {
          id: WARDLEY_METHOD.sixSigma,
          label: 'Six Sigma',
          labelKey: 'com.labre.wardley.tag.method.six-sigma',
          description: 'Project management, industrialized: remove deviation.',
          descriptionKey: 'com.labre.wardley.tag.method.six-sigma.description',
        },
        {
          id: WARDLEY_METHOD.pioneers,
          label: 'Pioneers',
          labelKey: 'com.labre.wardley.tag.method.pioneers',
          description: 'Attitude, uncharted: people who explore the unknown.',
          descriptionKey: 'com.labre.wardley.tag.method.pioneers.description',
        },
        {
          id: WARDLEY_METHOD.settlers,
          label: 'Settlers',
          labelKey: 'com.labre.wardley.tag.method.settlers',
          description:
            'Attitude, transitional: people who turn a prototype into a product.',
          descriptionKey: 'com.labre.wardley.tag.method.settlers.description',
        },
        {
          id: WARDLEY_METHOD.townPlanners,
          label: 'Town planners',
          labelKey: 'com.labre.wardley.tag.method.town-planners',
          description:
            'Attitude, industrialized: people who industrialise into a commodity.',
          descriptionKey:
            'com.labre.wardley.tag.method.town-planners.description',
        },
      ],
    },
  ],
};
