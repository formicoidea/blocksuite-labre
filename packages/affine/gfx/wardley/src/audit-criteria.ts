import type { AuditCriterion } from '@labre/affine-shared/services';

/**
 * The three Wardley audit criteria, A1–A3, as DATA (PF14.1).
 *
 * ## Why these three are criteria and not rules
 *
 * A validation rule is decided by geometry: an element is inside a frame or it
 * is not, an arrow runs with an axis or against it. The engine can settle it in
 * microseconds and be right every time, so it does — that is levels 1 and 2.
 *
 * These three cannot be settled that way, and no amount of engineering will
 * change that. "Is this component positioned for the right reason" is a
 * question about the author's argument; "does this map do its job" is a question
 * about a conversation. They are the questions a Wardley coach asks in a review,
 * and they are exactly what an assistant with the map's facts in hand can have
 * an opinion about — an OPINION, hence `audit` severity, hence invisible on the
 * canvas and never a wall.
 *
 * They are versioned like a rule and shipped like one, because the day a
 * criterion's wording changes is a day the answers before and after are no
 * longer comparable, and a host pinning behaviour needs to be able to say so.
 *
 * ## The prompts
 *
 * The prompt is the criterion, in words, addressed to the assistant and never
 * rendered — see {@link AuditCriterion.prompt}. They are written as review
 * instructions: what to look at, and what would make the map fail. They name no
 * model, no vendor and no output format: the assistant owns how it answers, the
 * library owns what is asked.
 */
export const WARDLEY_AUDIT_CRITERIA: readonly AuditCriterion[] = [
  {
    id: 'wardley.A1',
    framework: 'wardley',
    labelKey: 'com.labre.wardley.audit.A1',
    fallback: 'Positioning is justified',
    version: 1,
    prompt: [
      'Assess whether each component is placed on the evolution axis for the',
      'right reason. Evolution measures how CONTEXTUALLY UBIQUITOUS and',
      'well-understood a component is to the users of THIS value chain — not',
      'how modern, sophisticated or technically mature the technology behind',
      'it is. A component built on cutting-edge technology can be a commodity',
      'to its users; a component built on decades-old technology can still be',
      'in genesis for this organisation. Flag components whose position looks',
      'argued from technical maturity, vendor age, or how recently the team',
      'adopted them, rather than from how their users perceive and consume',
      'them. Use the zone each component sits in, the roles it carries and the',
      'components it depends on. Say which component, in which zone, and what',
      'about its position does not follow from the value chain around it.',
    ].join(' '),
  },
  {
    id: 'wardley.A2',
    framework: 'wardley',
    labelKey: 'com.labre.wardley.audit.A2',
    fallback: 'The value chain is legible',
    version: 1,
    prompt: [
      'Assess whether the value chain can actually be read. The map exists to',
      'be discussed, agreed on and decided from, by people who did not draw',
      'it. Follow the dependency edges from the anchor (the user and their',
      'need) down through the chain: does every component have a reason to be',
      'there that the chain itself states? Look for anchors that are missing or',
      'that name a system rather than a user need, components that hang off no',
      'chain, chains that fork into detail nobody would decide from, and',
      'dependencies whose direction says the opposite of what the layout',
      'implies. Say what a reader would fail to understand, and where.',
    ].join(' '),
  },
  {
    id: 'wardley.A3',
    framework: 'wardley',
    labelKey: 'com.labre.wardley.audit.A3',
    fallback: 'The model applies here',
    version: 1,
    prompt: [
      'Assess whether Wardley mapping is the right instrument for what this map',
      'describes. The model assumes a COMPETITIVE landscape: evolution is',
      'driven by supply and demand competition, and the strategic play is',
      'against other actors who could serve the same need. It says little about',
      'a domain with no competitive pressure — an internal process nobody else',
      'could supply, a regulatory obligation with a single possible',
      'implementation, an organisational chart. Judge from the anchor, the user',
      'need it names, and the nature of the components in the chain. If the',
      'subject is not a competitive landscape, say so plainly and say which',
      'other instrument would fit — that is more useful than three careful',
      'observations about a map that should not exist.',
    ].join(' '),
  },
];
