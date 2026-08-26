import { evaluateRules, type Violation } from '@labre/affine-block-surface';
import { Bound } from '@labre/global/gfx';
import type { GfxPrimitiveElementModel } from '@labre/std/gfx';
import { describe, expect, it } from 'vitest';

import { ES_ROLE, ES_STICKY_ROLE } from '../roles';
import { ES_FLOW_MATRIX, EVENT_STORMING_RULES } from '../rules';

/**
 * The three Event Storming rules, rule by rule — and above all what each of
 * them stays SILENT about. Silence is the expensive half: a rule that fires on
 * a Big Picture is a rule the workshop switches off before the coffee break.
 */

const ES1 = 'es.against-timeline';
const ES2 = 'es.forbidden-arc';
const ES3 = 'es.overlapping-stickies';

/** The engine reads `id`, `role`, `elementBound` and an edge's `source`/`target`. */
function element(
  id: string,
  xywh: [number, number, number, number],
  role?: string,
  ends?: { source: string; target: string }
): GfxPrimitiveElementModel {
  return {
    id,
    role,
    ...(ends
      ? { source: { id: ends.source }, target: { id: ends.target } }
      : {}),
    get elementBound() {
      return new Bound(...xywh);
    },
  } as unknown as GfxPrimitiveElementModel;
}

/** The board: 3200×1400 at the origin, carrying its role. */
const board = () => element('bg', [0, 0, 3200, 1400], ES_ROLE.board);

/** A board drawn before `es:board` existed: same roll, no role. */
const legacyBoard = () => element('bg', [0, 0, 3200, 1400]);

/** A 120-unit sticky. `y` separates rows so nothing overlaps by accident. */
const sticky = (id: string, role: string, x: number, y = 200) =>
  element(id, [x, y, 120, 120], role);

/** A neutral drawing — a note, a rectangle somebody thought with. */
const scribble = (id: string, x = 300, y = 900) =>
  element(id, [x, y, 180, 120]);

const flow = (id: string, source: string, target: string) =>
  element(id, [400, 260, 400, 1], ES_ROLE.flow, { source, target });

const evaluate = (elements: GfxPrimitiveElementModel[]) =>
  evaluateRules(EVENT_STORMING_RULES, elements);

const idsOf = (violations: readonly Violation[]) =>
  violations.map(violation => violation.ruleId).sort();

describe('what the framework ships', () => {
  it('ships exactly the three rules of the pack', () => {
    expect(EVENT_STORMING_RULES.map(rule => rule.id)).toEqual([ES1, ES2, ES3]);
  });

  it('namespaces every rule and holds no prose in the engine', () => {
    for (const rule of EVENT_STORMING_RULES) {
      expect(rule.framework).toBe('ddd-event-storming');
      expect(rule.id.startsWith('es.')).toBe(true);
      expect(rule.messageKey).toMatch(/^com\.labre\./);
      expect(rule.messageFallback).toBeTruthy();
      expect(rule.backgroundRole).toBe(ES_ROLE.board);
    }
  });

  it('never declares a level the pipework cannot honour', () => {
    for (const rule of EVENT_STORMING_RULES) {
      expect(rule.severity).toBe('warning');
    }
  });

  it('ships no linguistic rule — the past tense is a nudge', () => {
    // PO arbitration, 26/08/2026. Deciding "Order placed" from "Place order"
    // means parsing a human sentence in whatever language the room speaks.
    for (const rule of EVENT_STORMING_RULES) {
      expect(['relative-order-along-axis', 'relation-endpoints', 'no-overlap'])
        .toContain(rule.family);
    }
  });
});

describe('ES1 · a flow runs forwards in time', () => {
  it('says nothing about a flow drawn left to right', () => {
    expect(
      evaluate([
        board(),
        sticky('agg', ES_STICKY_ROLE.aggregate, 400),
        sticky('evt', ES_STICKY_ROLE.domainEvent, 1200, 600),
        flow('f1', 'agg', 'evt'),
      ])
    ).toEqual([]);
  });

  it('flags a domain event drawn to the LEFT of the aggregate that raises it', () => {
    const violations = evaluate([
      board(),
      sticky('agg', ES_STICKY_ROLE.aggregate, 1200),
      sticky('evt', ES_STICKY_ROLE.domainEvent, 300, 600),
      flow('f1', 'agg', 'evt'),
    ]);
    expect(idsOf(violations)).toEqual([ES1]);
    expect(violations[0].elementIds).toEqual(['agg', 'evt', 'f1']);
    expect(violations[0].backgroundId).toBe('bg');
  });

  it('tolerates two stickies drawn level, to 1% of the roll', () => {
    // 0.01 × 3200 = 32 units, about a quarter of a sticky: enough for a hand,
    // not enough for a habit.
    expect(
      evaluate([
        board(),
        sticky('agg', ES_STICKY_ROLE.aggregate, 1000),
        sticky('evt', ES_STICKY_ROLE.domainEvent, 980, 600),
        flow('f1', 'agg', 'evt'),
      ])
    ).toEqual([]);
    // ...and stops tolerating just past it.
    expect(
      idsOf(
        evaluate([
          board(),
          sticky('agg', ES_STICKY_ROLE.aggregate, 1000),
          sticky('evt', ES_STICKY_ROLE.domainEvent, 960, 600),
          flow('f1', 'agg', 'evt'),
        ])
      )
    ).toEqual([ES1]);
  });

  it('says nothing when there is no board to have a timeline', () => {
    // A frieze stormed on the bare canvas, and one drawn before the role
    // existed, are the same case: no frame, no verdict.
    const frieze = [
      sticky('agg', ES_STICKY_ROLE.aggregate, 1200),
      sticky('evt', ES_STICKY_ROLE.domainEvent, 300, 600),
      flow('f1', 'agg', 'evt'),
    ];
    expect(evaluate(frieze)).toEqual([]);
    expect(evaluate([legacyBoard(), ...frieze])).toEqual([]);
  });

  it('says nothing about a flow with a free end, or none at all', () => {
    expect(
      evaluate([
        board(),
        sticky('agg', ES_STICKY_ROLE.aggregate, 1200),
        flow('f1', 'agg', 'gone'),
      ])
    ).toEqual([]);
    expect(
      evaluate([
        board(),
        sticky('agg', ES_STICKY_ROLE.aggregate, 1200),
        sticky('evt', ES_STICKY_ROLE.domainEvent, 300, 600),
        // Every flow drawn before WS5 — proportionality, promesse #71.
        element('f1', [400, 260, 400, 1], undefined, {
          source: 'agg',
          target: 'evt',
        }),
      ])
    ).toEqual([]);
  });
});

describe('ES2 · the grammar of a flow', () => {
  it('says nothing about any of the nine canonical sentences', () => {
    for (const triplet of ES_FLOW_MATRIX) {
      const violations = evaluate([
        board(),
        sticky('a', triplet.source, 400),
        sticky('b', triplet.target, 1200, 600),
        flow('f1', 'a', 'b'),
      ]);
      expect(violations, `${triplet.source} → ${triplet.target}`).toEqual([]);
    }
  });

  it('holds the whole grammar and nothing else', () => {
    expect(
      ES_FLOW_MATRIX.map(t => `${t.source} → ${t.target}`)
    ).toEqual([
      'es:actor → es:command',
      'es:command → es:aggregate',
      'es:command → es:external-system',
      'es:aggregate → es:domain-event',
      'es:external-system → es:domain-event',
      'es:domain-event → es:policy',
      'es:domain-event → es:read-model',
      'es:policy → es:command',
      'es:read-model → es:actor',
    ]);
    expect(ES_FLOW_MATRIX.every(t => t.edge === ES_ROLE.flow)).toBe(true);
  });

  it('flags a command wired straight to a domain event', () => {
    // The skipped aggregate — the whole modelling question the workshop is run
    // to answer.
    const violations = evaluate([
      board(),
      sticky('cmd', ES_STICKY_ROLE.command, 400),
      sticky('evt', ES_STICKY_ROLE.domainEvent, 1200, 600),
      flow('f1', 'cmd', 'evt'),
    ]);
    expect(idsOf(violations)).toEqual([ES2]);
    expect(violations[0].elementIds).toEqual(['cmd', 'evt', 'f1']);
  });

  it('flags a canonical sentence drawn backwards', () => {
    // `aggregate → command` is not `command → aggregate`: the source is the
    // subject of the verb (ADR 0010).
    expect(
      idsOf(
        evaluate([
          board(),
          sticky('agg', ES_STICKY_ROLE.aggregate, 400),
          sticky('cmd', ES_STICKY_ROLE.command, 1200, 600),
          flow('f1', 'agg', 'cmd'),
        ])
      )
    ).toEqual([ES2]);
  });

  it('says nothing about a flow onto a HOTSPOT', () => {
    // The hard requirement of the family, and the reason the hotspot is
    // outside the alphabet: an arrow at a hotspot is somebody parking a
    // question. Neither the matrix nor the self-loop check runs.
    expect(
      evaluate([
        board(),
        sticky('cmd', ES_STICKY_ROLE.command, 400),
        sticky('hot', ES_STICKY_ROLE.hotspot, 1200, 600),
        flow('f1', 'cmd', 'hot'),
      ])
    ).toEqual([]);
  });

  it('says nothing about a flow onto a CONSTRAINT', () => {
    expect(
      evaluate([
        board(),
        sticky('con', ES_STICKY_ROLE.constraint, 400),
        sticky('evt', ES_STICKY_ROLE.domainEvent, 1200, 600),
        flow('f1', 'con', 'evt'),
      ])
    ).toEqual([]);
  });

  it('says nothing about a flow onto a neutral drawing', () => {
    expect(
      evaluate([
        board(),
        sticky('cmd', ES_STICKY_ROLE.command, 400),
        scribble('note', 1200, 600),
        flow('f1', 'cmd', 'note'),
      ])
    ).toEqual([]);
  });

  it('flags a flow looping back onto its own sticky', () => {
    const violations = evaluate([
      board(),
      sticky('evt', ES_STICKY_ROLE.domainEvent, 400),
      flow('f1', 'evt', 'evt'),
    ]);
    expect(idsOf(violations)).toEqual([ES2]);
    expect(violations[0].elementIds).toEqual(['evt', 'f1']);
  });

  it('says nothing about the same flow drawn twice', () => {
    // `forbidDuplicate` is deliberately off: a wall gets a line drawn twice
    // while three people talk over each other, and a frieze is read by
    // following arcs, not by counting them.
    expect(
      evaluate([
        board(),
        sticky('agg', ES_STICKY_ROLE.aggregate, 400),
        sticky('evt', ES_STICKY_ROLE.domainEvent, 1200, 600),
        flow('f1', 'agg', 'evt'),
        flow('f2', 'agg', 'evt'),
      ])
    ).toEqual([]);
  });
});

describe('ES3 · two stickies must not cover each other', () => {
  it('flags one sticky sitting on another, whatever the kinds', () => {
    const violations = evaluate([
      board(),
      sticky('a', ES_STICKY_ROLE.domainEvent, 400),
      sticky('b', ES_STICKY_ROLE.policy, 460),
      sticky('c', ES_STICKY_ROLE.hotspot, 1400),
      sticky('d', ES_STICKY_ROLE.hotspot, 1460),
    ]);
    expect(idsOf(violations)).toEqual([ES3, ES3]);
  });

  it('says nothing about the corner tuck a workshop draws on purpose', () => {
    // 10 units of overlap, under the 12-unit threshold: a run of events
    // shingled to say they belong together.
    expect(
      evaluate([
        board(),
        sticky('a', ES_STICKY_ROLE.domainEvent, 400),
        sticky('b', ES_STICKY_ROLE.domainEvent, 510),
      ])
    ).toEqual([]);
  });

  it('says nothing about a sticky over a neutral drawing', () => {
    expect(
      evaluate([
        board(),
        sticky('a', ES_STICKY_ROLE.domainEvent, 400, 900),
        scribble('note', 420, 900),
      ])
    ).toEqual([]);
  });

  it('says nothing about a sticky over the board it is stuck to', () => {
    // The board is not a sticky: `roleIsA` must never walk `es:board` up to
    // `es:sticky`, or every artefact on the roll would collide with the roll.
    expect(evaluate([board(), sticky('a', ES_STICKY_ROLE.actor, 400)])).toEqual(
      []
    );
  });
});
