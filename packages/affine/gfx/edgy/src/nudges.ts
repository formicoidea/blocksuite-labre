import type { QualityNudge } from '@labre/affine-block-surface';

/**
 * EDGY **work quality** — the checklist (WS1).
 *
 * Level 1 is `./rules.ts`: deterministic, decidable, real time. This file is
 * level 2, and the split is the whole point of the taxonomy — a rule only
 * enters the deterministic engine if an algorithm can decide it on persisted
 * data inside the ~16 ms budget. Everything else is a NUDGE: an expectation
 * offered as a checklist, never evaluated, never blocking anything. Ticking is
 * assuming.
 *
 * ## Why q1 and q2 are here and not in `rules.ts` (PO arbitration, 26/08/2026)
 *
 * They read like rules, and they are not. "Each intersection element is linked
 * to both of its parent facets" would need the tool to know which circle an
 * element belongs to — and nothing says so except where somebody dropped it,
 * which is the layout answering a question about meaning. "Each element wears
 * its facet's colour" would indict every board whose author uses their own
 * palette, which is most of them after the first workshop. Both are judgements
 * a modeller makes; the tool can put them on screen and cannot answer them.
 *
 * Registered from the flag-gated `EdgyViewExtension`, beside the rules and the
 * profiles: a checklist is tooling. Switching the flag off takes it away and
 * leaves the ticks written on the board, unread, until it comes back (PF7.10).
 */
export const EDGY_NUDGES: readonly QualityNudge[] = [
  {
    id: 'edgy.q1-intersection-links',
    framework: 'edgy',
    labelKey: 'com.labre.edgy.quality.intersection-links',
    fallback:
      'Each intersection element is linked to both of its parent facets.',
    order: 1,
  },
  {
    id: 'edgy.q2-facet-colour',
    framework: 'edgy',
    labelKey: 'com.labre.edgy.quality.facet-colour',
    fallback: "Each element wears its facet's colour.",
    order: 2,
  },
  {
    id: 'edgy.q3-readable-relations',
    framework: 'edgy',
    labelKey: 'com.labre.edgy.quality.readable-relations',
    fallback:
      'Relations read correctly (the source is the subject of the verb).',
    order: 3,
  },
  {
    id: 'edgy.q4-three-facets',
    framework: 'edgy',
    labelKey: 'com.labre.edgy.quality.three-facets',
    fallback: 'All three facets have been explored.',
    order: 4,
  },
];
