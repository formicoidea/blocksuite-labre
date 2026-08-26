import type { QualityNudge } from '@labre/affine-block-surface';

/**
 * Event Storming **board quality** — the checklist (WS5, level 2).
 *
 * `./rules.ts` is level 1: deterministic, decidable, real time. This file is
 * everything a board needs that no algorithm can decide. The split is the
 * taxonomy's whole point — ticking is assuming, never verifying.
 *
 * ## The past tense lives HERE, and that was an arbitration
 *
 * "Order placed" is a domain event; "Place order" is a command. It is the first
 * thing a facilitator corrects and the most tempting rule in the whole plan —
 * and it is a nudge, by PO arbitration of 26/08/2026, because deciding it means
 * parsing a human sentence. In whatever language the room speaks. Written in
 * marker pen. By somebody who abbreviates. A regular expression over `Y.Text`
 * would be wrong every fifth sticky, and a validation platform gets exactly one
 * chance to be wrong about something the user can see is right.
 *
 * So it is a tick, and the tick is honest: it says the room LOOKED, which is
 * what the facilitator wanted anyway.
 *
 * Registered from the flag-gated `DddEventStormingViewExtension`: a checklist
 * is tooling. Switching the flag off takes it away and leaves the ticks written
 * on the board, unread, until it comes back.
 */
export const EVENT_STORMING_NUDGES: readonly QualityNudge[] = [
  {
    /** See the header: the rule that is deliberately not a rule. */
    id: 'es.q1-events-past-tense',
    framework: 'ddd-event-storming',
    labelKey: 'com.labre.event-storming.quality.events-past-tense',
    fallback:
      'Domain events are named in the past tense — something that happened, not something to do.',
    order: 1,
  },
  {
    /**
     * `es.against-timeline` judges each arc against the axis; nothing can judge
     * whether the frieze as a whole tells the story the room means. Reading it
     * out loud, left to right, is the move that finds the missing half of it.
     */
    id: 'es.q2-timeline-read',
    framework: 'ddd-event-storming',
    labelKey: 'com.labre.event-storming.quality.timeline-read',
    fallback:
      'The timeline has been read out loud left to right, and reordered where it did not hold.',
    order: 2,
  },
  {
    id: 'es.q3-hotspots-discussed',
    framework: 'ddd-event-storming',
    labelKey: 'com.labre.event-storming.quality.hotspots-discussed',
    fallback:
      'Every hotspot has been discussed — resolved, or assumed on purpose with a name against it.',
    order: 3,
  },
  {
    id: 'es.q4-actors-and-systems',
    framework: 'ddd-event-storming',
    labelKey: 'com.labre.event-storming.quality.actors-and-systems',
    fallback:
      'The actors and the external systems are identified: every command has someone who issues it.',
    order: 4,
  },
  {
    /**
     * A pivotal event is a marking CONVENTION — a vertical bar, a bigger
     * sticky, a line drawn on the paper — and the canvas cannot tell one from a
     * sticky somebody happened to enlarge. What matters is that the room agreed
     * which moments split the story, which is a conversation and not a shape.
     */
    id: 'es.q5-pivotal-events',
    framework: 'ddd-event-storming',
    labelKey: 'com.labre.event-storming.quality.pivotal-events',
    fallback:
      'The pivotal events are marked: the board says where the story changes phase.',
    order: 5,
  },
];
