import type { UniverseTagDefs } from '@labre/affine-shared/services';
import type { TemplateResult } from 'lit';

import { WARDLEY_ROLE } from './roles';
import {
  wardleyNatureActivityIcon,
  wardleyNatureDataIcon,
  wardleyNatureKnowledgeIcon,
  wardleyNaturePracticeIcon,
} from './toolbar/icons';

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
 * Icon keys, one per nature — the same split as a command's, for the same
 * reason.
 *
 * The pack below is DATA and stays data: it names a key, never a template. The
 * drawings are registered separately ({@link wardleyNatureIcons}, seeded with
 * `IconTableExtension`) and the dropdown resolves the key at render time. A
 * client's private pack that re-declares one of these values keeps its icon by
 * repeating the key; one that declares a key of its own registers its own
 * table, and one that declares neither simply renders labels — the format has
 * no opinion about which.
 */
export const WARDLEY_NATURE_ICON_KEY = {
  activity: 'wardley.nature.activity',
  data: 'wardley.nature.data',
  practice: 'wardley.nature.practice',
  knowledge: 'wardley.nature.knowledge',
} as const;

/** `iconKey` → drawing, for `IconTableExtension`. Mirrors `wardleyCommandIcons`. */
export const wardleyNatureIcons: Record<string, TemplateResult> = {
  [WARDLEY_NATURE_ICON_KEY.activity]: wardleyNatureActivityIcon,
  [WARDLEY_NATURE_ICON_KEY.data]: wardleyNatureDataIcon,
  [WARDLEY_NATURE_ICON_KEY.practice]: wardleyNaturePracticeIcon,
  [WARDLEY_NATURE_ICON_KEY.knowledge]: wardleyNatureKnowledgeIcon,
};

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
      // No `order`: it is the only tag this pack declares, and an absent order
      // sorts by SEED order, which is what puts the library's pack ahead of a
      // client's extension without either having to know about the other. A
      // number here would be a claim about packs that do not exist yet.
      values: [
        {
          id: WARDLEY_NATURE.activity,
          label: 'Activity',
          description: 'Something that is DONE — a step, a service, a process.',
          iconKey: WARDLEY_NATURE_ICON_KEY.activity,
        },
        {
          id: WARDLEY_NATURE.data,
          label: 'Data',
          description: 'Something that is RECORDED — a dataset, a register.',
          iconKey: WARDLEY_NATURE_ICON_KEY.data,
        },
        {
          id: WARDLEY_NATURE.practice,
          label: 'Practice',
          description:
            'A way of doing — a method, a convention, an operating model.',
          iconKey: WARDLEY_NATURE_ICON_KEY.practice,
        },
        {
          id: WARDLEY_NATURE.knowledge,
          label: 'Knowledge',
          description: 'Something that is KNOWN — a model, a theory, a rule.',
          iconKey: WARDLEY_NATURE_ICON_KEY.knowledge,
        },
      ],
    },
  ],
};
