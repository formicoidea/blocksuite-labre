import type { QualityNudge } from '@labre/affine-block-surface';

/**
 * Estuarine **map quality** — the checklist, and this framework's ENTIRE
 * contribution to validation (WS4).
 *
 * ## No rules, and therefore no profiles (PO arbitration, 26/08/2026)
 *
 * The 26/08 study looked for deterministic rules on an Estuarine map and found
 * none worth shipping. Everything an Estuarine session decides — where the
 * counter-factual line falls, which constraints are volatile, whether a
 * constraint is a constructor or an actor — is a judgement the group makes out
 * loud; an algorithm that claimed to check any of it would be lying about the
 * one thing the method exists to produce.
 *
 * A severity profile is a dial over rules. With no rule to dial, a profile
 * picker is a control that decides nothing: three entries, no observable
 * effect, and a user reasonably concluding that the tool checks something it
 * does not. So this framework ships **no `profiles.ts`** — deliberately, not
 * by omission. The profiles will be born WITH the first rule, if one is ever
 * born; until then the file's absence is the honest statement.
 *
 * What does reach the user is this checklist, offered on the map because
 * `ValidationFrameworkExtension` declares `estuarine:map` a root instance
 * (WS0.3) — the gate no longer needs a rule to exist.
 *
 * Registered from the flag-gated `CynefinEstuarineViewExtension`, beside the
 * framework declaration: a checklist is tooling. Switching the flag off takes
 * it away and leaves the ticks written on the map, unread, until it comes back.
 */

/**
 * **Q1–Q4** — the four things an Estuarine map needs in order to do its job,
 * and that no algorithm can check.
 *
 * Q1 and Q2 are about the two lines that make the map a map: a counter-factual
 * line nobody argued over is a curve, not a boundary, and an undelimited
 * volatile zone leaves every constraint equally urgent. Q3 is the method's own
 * discipline — above the counter-factual line you do not act, you Monitor,
 * Research or Request. Q4 is the typing the hexagons carry in the group's head
 * and nowhere in the document.
 */
export const ESTUARINE_NUDGES: readonly QualityNudge[] = [
  {
    id: 'estuarine.q1-counterfactual',
    framework: 'estuarine',
    labelKey: 'com.labre.estuarine.quality.counterfactual',
    fallback:
      'The counter-factual line has been negotiated and drawn by the group',
    order: 1,
  },
  {
    id: 'estuarine.q2-volatile-zone',
    framework: 'estuarine',
    labelKey: 'com.labre.estuarine.quality.volatile-zone',
    fallback: 'The volatile zone has been delimited',
    order: 2,
  },
  {
    id: 'estuarine.q3-strategies',
    framework: 'estuarine',
    labelKey: 'com.labre.estuarine.quality.strategies',
    fallback:
      'Every element above the counter-factual line has a Monitor, Research or Request strategy',
    order: 3,
  },
  {
    id: 'estuarine.q4-hexagon-types',
    framework: 'estuarine',
    labelKey: 'com.labre.estuarine.quality.hexagon-types',
    fallback: 'Every hexagon is typed: constraint, constructor or actor',
    order: 4,
  },
];
