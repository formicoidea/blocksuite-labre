import type { QualityNudge } from '@labre/affine-block-surface';

/**
 * Core Domain Chart **work quality** — the checklist.
 *
 * Level 1 is `./rules.ts`: deterministic, decidable, real time. This file is
 * level 2, and the split is the whole point of the taxonomy — a rule only enters
 * the deterministic engine if an algorithm can decide it on persisted data
 * inside the ~16 ms budget. Everything else is a NUDGE: an expectation offered
 * as a checklist, never evaluated, never blocking anything. Ticking is assuming.
 *
 * All three below are about whether the chart can be DISCUSSED, and no
 * algorithm can check a single one of them. Whether a movement is justified is
 * a statement about an argument; whether the core was agreed is a statement
 * about a room. A rule claiming to have verified either would be lying.
 *
 * Registered from the flag-gated `DddCoreDomainViewExtension`, beside the rules
 * and the profiles: a checklist is tooling. Switching the flag off takes it away
 * and leaves the ticks written on the chart, unread, until it comes back
 * (PF7.10).
 */
export const CORE_DOMAIN_NUDGES: readonly QualityNudge[] = [
  {
    id: 'core-domain.q1-legend',
    framework: 'core-domain',
    labelKey: 'com.labre.core-domain.quality.legend',
    fallback: 'The chart has a legend.',
    order: 1,
  },
  {
    id: 'core-domain.q2-movements',
    framework: 'core-domain',
    labelKey: 'com.labre.core-domain.quality.movements',
    fallback: 'Movements are dated and justified.',
    order: 2,
  },
  {
    id: 'core-domain.q3-core-agreed',
    framework: 'core-domain',
    labelKey: 'com.labre.core-domain.quality.core-agreed',
    fallback: 'The core has been agreed by the team.',
    order: 3,
  },
];
