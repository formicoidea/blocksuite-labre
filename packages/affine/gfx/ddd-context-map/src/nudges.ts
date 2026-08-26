import type { QualityNudge } from '@labre/affine-block-surface';

/**
 * Context Mapping **map quality** — the checklist (WS2, level 2).
 *
 * `./rules.ts` is level 1: deterministic, decidable, real time. This file is
 * everything a context map needs that no algorithm can decide. The split is the
 * taxonomy's whole point — ticking is assuming, never verifying.
 *
 * Every one of the four is about whether a PATTERN WAS CHOSEN rather than
 * defaulted to. That is the failure mode of context mapping in practice: the
 * team draws nine links because there are nine integrations, picks the arrow
 * that looks right, and ships a map that records the current wiring instead of
 * the relationships. Nothing on the canvas can tell those two maps apart.
 *
 * Registered from the flag-gated `DddContextMapViewExtension`: a checklist is
 * tooling. Switching the flag off takes it away and leaves the ticks written on
 * the board, unread, until it comes back.
 */
export const CONTEXT_MAP_NUDGES: readonly QualityNudge[] = [
  {
    id: 'context-map.q1-pattern-discussed',
    framework: 'ddd-context-map',
    labelKey: 'com.labre.ddd-context-map.quality.pattern-discussed',
    fallback:
      'Every relationship carries a justified, discussed pattern — not the one that was easiest to draw.',
    order: 1,
  },
  {
    id: 'context-map.q2-separate-ways-documented',
    framework: 'ddd-context-map',
    labelKey: 'com.labre.ddd-context-map.quality.separate-ways',
    fallback:
      'Separate Ways are documented: it is written down why there is no integration.',
    order: 2,
  },
  {
    /**
     * The rule this nudge replaces. "Every downstream of a Big Ball of Mud is
     * protected" is decidable in principle — walk the edges out of the cloud and
     * look for an ACL — and undecidable in practice on THIS canvas: the cloud
     * carries no role (a v1 cut), so there is nothing for a rule to walk from,
     * and a shape somebody drew a mess with is not a claim that it IS one.
     * Level 2 is the honest home for it until the cloud has a role.
     */
    id: 'context-map.q3-bbom-protected',
    framework: 'ddd-context-map',
    labelKey: 'com.labre.ddd-context-map.quality.bbom-protected',
    fallback:
      'Every downstream of a Big Ball of Mud is protected by an Anticorruption Layer.',
    order: 3,
  },
  {
    id: 'context-map.q4-legend',
    framework: 'ddd-context-map',
    labelKey: 'com.labre.ddd-context-map.quality.legend',
    fallback:
      'The map has a legend: a reader who does not know the notation can read it.',
    order: 4,
  },
];
