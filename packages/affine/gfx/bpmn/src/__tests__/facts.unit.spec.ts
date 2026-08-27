import { backgroundInstanceZones } from '@labre/affine-block-surface';
import {
  asTypedEdge,
  edgeIsBound,
  edgeVerbOf,
} from '@labre/affine-gfx-connector';
import {
  type BpmnLane,
  BpmnPoolElementModel,
  ConnectorElementModel,
} from '@labre/affine-model';
import { Bound } from '@labre/global/gfx';
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import { BPMN_POOL_BACKGROUND } from '../background';
import { bpmnLaneOf, bpmnPoolOf } from '../facts';
import { BPMN_ROLE, BPMN_ROLE_OF_KIND, BPMN_ROLES } from '../roles';

/**
 * The BPMN facts — B5, and the CONTRACT LOCK for the validation-rules session.
 *
 * Every assertion here is a promise made to code that does not exist yet. A rule
 * asking "is this task in the right lane" must get the answer the audit would
 * have given, and must keep getting it after somebody refactors either side; the
 * tests below are what make the two impossible to drift apart, because they pin
 * the CONVENTIONS rather than the results — the centre and not the box, the plot
 * and not the element, the first zone in order and not the nearest one.
 *
 * Plain stubs throughout, no editor and no DI: if any of this needed a
 * `BlockStdScope` to answer, the tranche would have failed at its own premise.
 */

const POOL_W = 560;
const POOL_H = 200;
/** `margin.left` — the participant name band, which is NOT part of the plot. */
const BAND = BPMN_POOL_BACKGROUND.geometry.margin.left;

/**
 * The package source, `src/__tests__` → `src`.
 *
 * Joined rather than resolved through `new URL('..', import.meta.url)`: the
 * tests run under happy-dom, whose global `URL` resolves a relative reference
 * against the DOM's own `about:`/`http:` base instead of the base it was handed,
 * so the file URL comes back as `http://localhost:3000/…`.
 */
const SRC = dirname(dirname(fileURLToPath(import.meta.url)));

/**
 * A stand-in for a pool: the real prototype so `instanceof` answers truthfully,
 * with own data properties shadowing the `@field()` accessors and the
 * `elementBound` getter, so nothing reaches for a Y.Map that is not there.
 */
function fakePool(
  id: string,
  bound: [number, number, number, number],
  lanes?: BpmnLane[]
): BpmnPoolElementModel {
  const pool = Object.create(BpmnPoolElementModel.prototype) as Record<
    string,
    unknown
  >;
  Object.defineProperties(pool, {
    id: { value: id, enumerable: true },
    lanes: { value: lanes, enumerable: true },
    elementBound: { value: new Bound(...bound) },
  });
  return pool as unknown as BpmnPoolElementModel;
}

/** An element bound centred on `(cx, cy)`. */
function centredAt(cx: number, cy: number, w = 120, h = 72): Bound {
  return new Bound(cx - w / 2, cy - h / 2, w, h);
}

const lane = (id: string, size: number, name?: string): BpmnLane =>
  name === undefined ? { id, size } : { id, name, size };

describe('bpmnPoolOf', () => {
  it('answers the pool whose plot the centre falls in', () => {
    const pool = fakePool('pool-a', [0, 0, POOL_W, POOL_H]);
    expect(bpmnPoolOf([pool], centredAt(300, 100))).toBe(pool);
  });

  it('answers null for a centre outside every pool', () => {
    const pool = fakePool('pool-a', [0, 0, POOL_W, POOL_H]);
    expect(bpmnPoolOf([pool], centredAt(1000, 100))).toBeNull();
    expect(bpmnPoolOf([], centredAt(300, 100))).toBeNull();
  });

  it('answers null for a centre over the name band, not in the flow area', () => {
    // The band is the left margin: inside the ELEMENT box, outside the PLOT.
    // Locked because this is the one place where "in the pool" as a reader sees
    // it and "in the pool" as the geometry means it come apart — and the plot is
    // the half the lanes and the rules are expressed in.
    const pool = fakePool('pool-a', [0, 0, POOL_W, POOL_H]);
    expect(bpmnPoolOf([pool], centredAt(BAND / 2, 100))).toBeNull();
    expect(bpmnPoolOf([pool], centredAt(BAND + 1, 100))).toBe(pool);
  });

  it('answers null for a pool with no flow area left to be inside', () => {
    // Dragged narrower than its own name band: a degenerate plot, and there is
    // no honest answer other than none.
    const pool = fakePool('pool-a', [0, 0, BAND - 4, POOL_H]);
    expect(bpmnPoolOf([pool], centredAt(2, 100))).toBeNull();
  });

  it('attributes each element to the pool it is drawn on', () => {
    const top = fakePool('pool-top', [0, 0, POOL_W, POOL_H]);
    const bottom = fakePool('pool-bottom', [0, POOL_H, POOL_W, POOL_H]);
    const pools = [top, bottom];

    expect(bpmnPoolOf(pools, centredAt(300, 50))).toBe(top);
    expect(bpmnPoolOf(pools, centredAt(300, 250))).toBe(bottom);
  });

  it('lets the CENTRE decide for an element straddling two pools', () => {
    // Contained by neither — which is exactly the case the audit's containment
    // half cannot answer on its own, and where a fact query must still be right.
    const top = fakePool('pool-top', [0, 0, POOL_W, POOL_H]);
    const bottom = fakePool('pool-bottom', [0, POOL_H, POOL_W, POOL_H]);
    const pools = [top, bottom];

    // Spans y 120 → 320, so it overlaps both; its centre is at 220.
    expect(bpmnPoolOf(pools, centredAt(300, 220, 120, 200))).toBe(bottom);
    // Same element slid up: centre 180, still overlapping both.
    expect(bpmnPoolOf(pools, centredAt(300, 180, 120, 200))).toBe(top);
  });

  it('gives a centre exactly on the seam to the FIRST pool in order', () => {
    // Both plots contain y = 200 inclusively. The audit's `attribute()` returns
    // on its first containing frame, so this does too: document order, and the
    // same first-match convention `zoneAt` uses one level down.
    const top = fakePool('pool-top', [0, 0, POOL_W, POOL_H]);
    const bottom = fakePool('pool-bottom', [0, POOL_H, POOL_W, POOL_H]);

    expect(bpmnPoolOf([top, bottom], centredAt(300, 200))).toBe(top);
    expect(bpmnPoolOf([bottom, top], centredAt(300, 200))).toBe(bottom);
  });

  it('does not fall back to the nearest pool the way the audit does', () => {
    // `attribute()` / `attributeBackground()` answer "the nearest map" when
    // nothing contains the element, because an audit must say something about
    // everything it reports. A fact query must not: a task dropped beside a pool
    // is not in it, and inventing a pool here would put a rule's finding on a
    // participant the author never drew it on.
    const pool = fakePool('pool-a', [0, 0, POOL_W, POOL_H]);
    // Overlaps the pool, but its centre is well past the right edge.
    expect(bpmnPoolOf([pool], centredAt(600, 100, 200, 72))).toBeNull();
  });
});

describe('bpmnLaneOf', () => {
  it('answers null for a pool that carries no lane', () => {
    const pool = fakePool('pool-a', [0, 0, POOL_W, POOL_H]);
    expect(bpmnLaneOf(pool, centredAt(300, 100))).toBeNull();
    // And for the empty list, which `removeBpmnLane` never writes but a
    // hand-edited document can carry.
    const empty = fakePool('pool-b', [0, 0, POOL_W, POOL_H], []);
    expect(bpmnLaneOf(empty, centredAt(300, 100))).toBeNull();
  });

  it('places a centre in the right band of a weighted partition', () => {
    // Weights 1 / 2 / 1 over a 200-unit plot: bands 0→50, 50→150, 150→200.
    const lanes = [
      lane('a', 1, 'Front office'),
      lane('b', 2, 'Back office'),
      lane('c', 1),
    ];
    const pool = fakePool('pool-a', [0, 0, POOL_W, POOL_H], lanes);

    expect(bpmnLaneOf(pool, centredAt(300, 25))?.id).toBe('a');
    expect(bpmnLaneOf(pool, centredAt(300, 100))?.id).toBe('b');
    expect(bpmnLaneOf(pool, centredAt(300, 175))?.id).toBe('c');
    // The model's OWN row comes back, not a copy of the zone: a caller holding
    // this can rename it or reweigh it.
    expect(bpmnLaneOf(pool, centredAt(300, 25))).toBe(lanes[0]);
  });

  it('gives a centre exactly on a divider to the FIRST band in order', () => {
    // `zoneAt` tests containment inclusively on both edges and returns the first
    // zone that matches, so a divider belongs to the band ABOVE it. Arbitrary on
    // its own, load-bearing together: the audit breaks this tie the same way,
    // and a rule reading one and a badge painted from the other would put a
    // finding on a task the user can see is in the other lane.
    const pool = fakePool(
      'pool-a',
      [0, 0, POOL_W, POOL_H],
      [lane('a', 1), lane('b', 2), lane('c', 1)]
    );

    expect(bpmnLaneOf(pool, centredAt(300, 50))?.id).toBe('a');
    expect(bpmnLaneOf(pool, centredAt(300, 150))?.id).toBe('b');
  });

  it('answers null for a centre outside the pool it is asked about', () => {
    const pool = fakePool('pool-a', [0, 0, POOL_W, POOL_H], [lane('a', 1)]);
    expect(bpmnLaneOf(pool, centredAt(1000, 100))).toBeNull();
    // Over the name band: in the element, out of the plot, out of every lane.
    expect(bpmnLaneOf(pool, centredAt(BAND / 2, 100))).toBeNull();
  });

  it('is congruent with the pool answer for a partition covering the plot', () => {
    const pool = fakePool(
      'pool-a',
      [0, 0, POOL_W, POOL_H],
      [lane('a', 1), lane('b', 1)]
    );
    for (const y of [1, 50, 100, 150, 199]) {
      const bound = centredAt(300, y);
      expect(bpmnPoolOf([pool], bound)).toBe(pool);
      expect(bpmnLaneOf(pool, bound)).not.toBeNull();
    }
  });
});

describe('BPMN typed-flow facts', () => {
  const vocabularies = [BPMN_ROLES];

  /** A stand-in for a connector, with whatever ends the case needs. */
  function fakeConnector(
    role: string | undefined,
    ends: { source?: string; target?: string } = {}
  ): ConnectorElementModel {
    const connector = Object.create(ConnectorElementModel.prototype) as Record<
      string,
      unknown
    >;
    Object.defineProperties(connector, {
      id: { value: 'connector-1', enumerable: true },
      role: { value: role, enumerable: true },
      source: {
        value: ends.source === undefined ? {} : { id: ends.source },
        enumerable: true,
      },
      target: {
        value: ends.target === undefined ? {} : { id: ends.target },
        enumerable: true,
      },
    });
    return connector as unknown as ConnectorElementModel;
  }

  it('reads a bound sequence flow as a typed edge that says "is followed by"', () => {
    const connector = fakeConnector(BPMN_ROLE.sequenceFlow, {
      source: 'task-1',
      target: 'task-2',
    });

    const edge = asTypedEdge(vocabularies, connector);
    expect(edge).not.toBeNull();
    expect(edge!.role.id).toBe(BPMN_ROLE.sequenceFlow);
    expect(edge!.role.kind).toBe('edge');
    expect(edgeIsBound(connector)).toBe(true);
    expect(edgeVerbOf(edge!)).toEqual({
      key: 'com.labre.bpmn.role.sequence-flow.verb',
      fallback: 'is followed by',
    });
  });

  it('reports a half-attached flow as unbound', () => {
    // The `docs/adr/0010` guard: an arrow with a free endpoint relates nothing
    // to nothing, and the rules session must read the same silence.
    const dangling = fakeConnector(BPMN_ROLE.sequenceFlow, {
      source: 'task-1',
    });
    expect(asTypedEdge(vocabularies, dangling)).not.toBeNull();
    expect(edgeIsBound(dangling)).toBe(false);
  });

  it('reads a role-less connector as no edge at all', () => {
    const plain = fakeConnector(undefined, {
      source: 'task-1',
      target: 'task-2',
    });
    expect(asTypedEdge(vocabularies, plain)).toBeNull();
  });

  /**
   * Every shipped file that WRITES one edge role.
   *
   * Pinned as a set rather than left open: `docs/adr/0010` says the role on a
   * connector is the statement its author made, so the list of places that can
   * put one there is part of the contract. A file joining this list is a new
   * layer deciding what an author meant, and that is a review, not a diff.
   *
   * ## Both spellings, because a stamp site can use either
   *
   * The named constant AND the literal id. Matching only `BPMN_ROLE.messageFlow`
   * would let a serializer, an import path or a host adapter that writes
   * `'bpmn:message-flow'` straight past a pin whose doc comment claims to be
   * exhaustive — a hole an adversarial review proved with a one-line probe.
   *
   * ## Two files are excluded, and neither of them stamps
   *
   * `roles.ts` DECLARES the vocabulary — it is where the id is minted, so it
   * necessarily names it. `rules.ts` SPEAKS it: a rule says something ABOUT
   * edges carrying a role, which means naming the role to select on it, and
   * selecting is the opposite of stamping. Every other file that types the id
   * is putting it on an element, which is exactly what this pin is for.
   *
   * ## `export.ts` is in the list, and the doc comment above says why
   *
   * The pin was written spelling out both forms of the id precisely so that a
   * SERIALIZER could not slip past it — and one arrived. It reads the role to
   * choose an XML element name and writes nothing back to any model, which is
   * the same "selecting, not stamping" `rules.ts` does; the difference is that
   * a serializer is exactly the shape of thing the pin's author was worried
   * about, so it is listed rather than excluded. A reviewer looking at this
   * line is being told: an interchange file now speaks these two roles, and a
   * rename would change what leaves the product, not just what it draws.
   */
  const stampSites = (roleId: string, roleExpression: string) =>
    tsFilesUnder(SRC)
      .filter(file => !file.endsWith('roles.ts') && !file.endsWith('rules.ts'))
      .filter(file => {
        const src = readFileSync(file, 'utf8');
        return src.includes(roleExpression) || src.includes(roleId);
      })
      .map(file => file.slice(SRC.length + 1).replaceAll('\\', '/'))
      .sort();

  it('declares the message flow with its own verb, and stamps it from the tool', () => {
    // Reserved by the lean pack and CLAIMED by the descriptive-profile one: the
    // vocabulary carried this id before anything wrote it, precisely so the day
    // a tool started writing it — today — the id would already be the right
    // one. Its verb is its own, so a second flow sentence is now in play and
    // the rules session has to account for it.
    const def = BPMN_ROLES[BPMN_ROLE.messageFlow];
    expect(def.kind).toBe('edge');
    expect(def.direction?.verbFallback).toBe('sends a message to');
    expect(def.parent).toBeUndefined();

    // It is still not a NODE role: the kind → role bridge every node creation
    // site goes through must never answer with a connecting object.
    expect(Object.values(BPMN_ROLE_OF_KIND)).not.toContain(
      BPMN_ROLE.messageFlow
    );

    expect(stampSites(BPMN_ROLE.messageFlow, 'BPMN_ROLE.messageFlow')).toEqual([
      // `activateBpmnMessageFlow` arms the connector tool with the role, so the
      // edge is born with it rather than acquiring one afterwards.
      'actions.ts',
      // The XML export READS it, to decide that this arrow is a
      // `bpmn:messageFlow` and belongs under the collaboration.
      'export.ts',
      // …and the "Message exchange" card, which ships one already stamped.
      'templates/index.ts',
    ]);
  });

  it('declares the association WITHOUT a direction, and stamps it from the tool', () => {
    // The one edge role in this vocabulary that names no relation: "this note
    // is about that task" reads identically from either end, so there is no
    // verb, no gesture hint and nothing for "reverse direction" to offer. That
    // absence is the declaration, which is why it is asserted rather than
    // assumed (`docs/adr/0010` tier 2, and the role's own doc comment).
    const def = BPMN_ROLES[BPMN_ROLE.association];
    expect(def.kind).toBe('edge');
    expect(def.direction).toBeUndefined();
    expect(def.parent).toBeUndefined();

    expect(Object.values(BPMN_ROLE_OF_KIND)).not.toContain(
      BPMN_ROLE.association
    );

    // No template card draws one yet — an association is what an author adds to
    // a picture they have already made, not something a preset can guess.
    expect(stampSites(BPMN_ROLE.association, 'BPMN_ROLE.association')).toEqual([
      'actions.ts',
      // Read, not written: the export turns it into a `bpmn:association` with
      // `associationDirection="None"` — the absence of a verb, in the file.
      'export.ts',
    ]);
  });
});

describe('audit congruence', () => {
  it('answers the id the audit zone math yields for the same element', () => {
    // The whole point of the tranche in one assertion: a composed scenario —
    // pool, two lanes, one task — read twice. Once through `bpmnLaneOf`, once
    // through the arithmetic `plotRatios` + `zoneAt` run inside
    // `collectAuditFacts`. If a refactor ever moves one of them, this fails.
    const lanes = [lane('front', 1, 'Front office'), lane('back', 3)];
    const pool = fakePool('pool-a', [40, 60, POOL_W, POOL_H], lanes);
    const bound = centredAt(300, 200);

    const zones = backgroundInstanceZones(
      BPMN_POOL_BACKGROUND,
      pool as unknown as Readonly<Record<string, unknown>>
    );
    expect(zones.map(zone => zone.id)).toEqual(['lane:front', 'lane:back']);

    // `plotRatios`, spelled out exactly as `audit.ts` spells it.
    const frame = pool.elementBound;
    const at = [
      (bound.x + bound.w / 2 - frame.x - BAND) / (frame.w - BAND),
      (bound.y + bound.h / 2 - frame.y) / frame.h,
    ] as const;
    // `zoneAt`, likewise: first zone containing the point, inclusive edges.
    const zoneId = zones.find(
      zone =>
        at[0] >= zone.rect.x &&
        at[0] <= zone.rect.x + zone.rect.w &&
        at[1] >= zone.rect.y &&
        at[1] <= zone.rect.y + zone.rect.h
    )?.id;

    expect(zoneId).toBe('lane:back');
    expect(`lane:${bpmnLaneOf(pool, bound)?.id}`).toBe(zoneId);
  });
});

/** Every `.ts` file under `dir`, tests excluded — the source a tool ships. */
function tsFilesUnder(dir: string): string[] {
  const files: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === '__tests__') continue;
    const path = join(dir, entry.name);
    if (entry.isDirectory()) files.push(...tsFilesUnder(path));
    else if (entry.name.endsWith('.ts')) files.push(path);
  }
  return files;
}
