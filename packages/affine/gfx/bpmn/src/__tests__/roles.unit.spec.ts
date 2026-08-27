import { asTypedEdge, edgeVerbOf } from '@labre/affine-gfx-connector';
import { type BpmnNodeKind, ConnectorElementModel } from '@labre/affine-model';
import { findRoleDef, isTypedEdgeRole, roleIsA } from '@labre/std/gfx';
import { describe, expect, it } from 'vitest';

import { BPMN_ROLE, BPMN_ROLE_OF_KIND, BPMN_ROLES } from '../roles';

/**
 * The BPMN vocabulary, checked the way the other frameworks' are: the shape of
 * every declaration, the hierarchy read through `roleIsA` rather than restated,
 * and the one bridge that still has to hold — the legacy `kind` discriminant and
 * the role it means.
 */

const vocabularies = [BPMN_ROLES];

/** The parents nothing is ever stamped with. */
const FAMILIES = [
  BPMN_ROLE.event,
  BPMN_ROLE.activity,
  BPMN_ROLE.gateway,
  BPMN_ROLE.data,
] as const;

describe('BPMN role vocabulary', () => {
  it('declares the four families, their leaves, the pool and the three flows', () => {
    // 21 node roles + 3 edges.
    expect(Object.keys(BPMN_ROLES)).toHaveLength(24);
    for (const id of [
      ...FAMILIES,
      BPMN_ROLE.startEvent,
      BPMN_ROLE.startEventMessage,
      BPMN_ROLE.startEventTimer,
      BPMN_ROLE.endEvent,
      BPMN_ROLE.endEventMessage,
      BPMN_ROLE.endEventTerminate,
      BPMN_ROLE.task,
      BPMN_ROLE.taskUser,
      BPMN_ROLE.taskService,
      BPMN_ROLE.subProcess,
      BPMN_ROLE.callActivity,
      BPMN_ROLE.gatewayExclusive,
      BPMN_ROLE.gatewayParallel,
      BPMN_ROLE.dataObject,
      BPMN_ROLE.dataStore,
      BPMN_ROLE.textAnnotation,
      BPMN_ROLE.pool,
    ]) {
      expect(BPMN_ROLES[id]?.kind, id).toBe('node');
    }
    expect(BPMN_ROLES[BPMN_ROLE.sequenceFlow].kind).toBe('edge');
    expect(BPMN_ROLES[BPMN_ROLE.messageFlow].kind).toBe('edge');
    expect(BPMN_ROLES[BPMN_ROLE.association].kind).toBe('edge');
  });

  it('namespaces every role, keys it by its own id and kebab-cases it', () => {
    for (const [id, def] of Object.entries(BPMN_ROLES)) {
      expect(id).toBe(def.id);
      expect(id.startsWith('bpmn:')).toBe(true);
      expect(id).toBe(id.toLowerCase());
      expect(def.labelKey).toMatch(/^com\.labre\.bpmn\.role\./);
      expect(def.labelFallback, id).toBeTruthy();
    }
  });

  it('walks each leaf up to its family, and to nothing else', () => {
    const chains = [
      [BPMN_ROLE.startEvent, BPMN_ROLE.event],
      [BPMN_ROLE.endEvent, BPMN_ROLE.event],
      [BPMN_ROLE.task, BPMN_ROLE.activity],
      [BPMN_ROLE.subProcess, BPMN_ROLE.activity],
      [BPMN_ROLE.callActivity, BPMN_ROLE.activity],
      [BPMN_ROLE.gatewayExclusive, BPMN_ROLE.gateway],
      [BPMN_ROLE.gatewayParallel, BPMN_ROLE.gateway],
      [BPMN_ROLE.dataObject, BPMN_ROLE.data],
      [BPMN_ROLE.dataStore, BPMN_ROLE.data],
    ] as const;

    for (const [leaf, family] of chains) {
      expect(BPMN_ROLES[leaf].parent).toBe(family);
      expect(roleIsA(leaf, family, BPMN_ROLES), leaf).toBe(true);
      // A rule written on one family must never fall on another's leaves.
      for (const other of FAMILIES) {
        if (other === family) continue;
        expect(roleIsA(leaf, other, BPMN_ROLES), `${leaf} → ${other}`).toBe(
          false
        );
      }
      // ...and the specialisation only reads one way.
      expect(roleIsA(family, leaf, BPMN_ROLES)).toBe(false);
    }

    // The four families are roots: BPMN's own taxonomy stops there.
    for (const family of FAMILIES) {
      expect(BPMN_ROLES[family].parent, family).toBeUndefined();
    }
  });

  /**
   * The descriptive profile is what made the tree three deep on two branches.
   * Walking it here rather than restating the `parent` fields is the point: a
   * rule written about "an event" has to keep catching a message start, and the
   * only thing that proves it is `roleIsA` saying so through two hops.
   */
  it('walks a specialised leaf through its middle to its family', () => {
    const chains = [
      [BPMN_ROLE.startEventMessage, BPMN_ROLE.startEvent, BPMN_ROLE.event],
      [BPMN_ROLE.startEventTimer, BPMN_ROLE.startEvent, BPMN_ROLE.event],
      [BPMN_ROLE.endEventMessage, BPMN_ROLE.endEvent, BPMN_ROLE.event],
      [BPMN_ROLE.endEventTerminate, BPMN_ROLE.endEvent, BPMN_ROLE.event],
      [BPMN_ROLE.taskUser, BPMN_ROLE.task, BPMN_ROLE.activity],
      [BPMN_ROLE.taskService, BPMN_ROLE.task, BPMN_ROLE.activity],
    ] as const;

    for (const [leaf, middle, family] of chains) {
      expect(BPMN_ROLES[leaf].parent, leaf).toBe(middle);
      expect(roleIsA(leaf, middle, BPMN_ROLES), `${leaf} → ${middle}`).toBe(
        true
      );
      expect(roleIsA(leaf, family, BPMN_ROLES), `${leaf} → ${family}`).toBe(
        true
      );
      // Only its own family, and never the other way round.
      for (const other of FAMILIES) {
        if (other === family) continue;
        expect(roleIsA(leaf, other, BPMN_ROLES), `${leaf} → ${other}`).toBe(
          false
        );
      }
      expect(roleIsA(middle, leaf, BPMN_ROLES)).toBe(false);
      expect(roleIsA(family, leaf, BPMN_ROLES)).toBe(false);
    }

    // A message start is NOT a message end, and a user task is not a service
    // one: siblings share a parent and nothing else.
    expect(
      roleIsA(BPMN_ROLE.startEventMessage, BPMN_ROLE.endEvent, BPMN_ROLES)
    ).toBe(false);
    expect(roleIsA(BPMN_ROLE.taskUser, BPMN_ROLE.taskService, BPMN_ROLES)).toBe(
      false
    );
    // ...and a sub-process is an activity without being a task: it stands for a
    // whole process, so "every task is one unit of work" stays true.
    expect(roleIsA(BPMN_ROLE.subProcess, BPMN_ROLE.task, BPMN_ROLES)).toBe(
      false
    );
    expect(roleIsA(BPMN_ROLE.callActivity, BPMN_ROLE.task, BPMN_ROLES)).toBe(
      false
    );
  });

  it('keeps the pool and the annotation OUT of every artefact subtree', () => {
    // The frame, not an artefact — the same call `wardley:map` makes. And the
    // annotation: commentary, which no rule about the work may fall on.
    for (const outsider of [BPMN_ROLE.pool, BPMN_ROLE.textAnnotation]) {
      expect(BPMN_ROLES[outsider].parent, outsider).toBeUndefined();
      for (const family of FAMILIES) {
        expect(roleIsA(outsider, family, BPMN_ROLES), family).toBe(false);
        expect(roleIsA(family, outsider, BPMN_ROLES), family).toBe(false);
      }
    }
    // The two are not each other either.
    expect(roleIsA(BPMN_ROLE.textAnnotation, BPMN_ROLE.pool, BPMN_ROLES)).toBe(
      false
    );
  });

  it('keeps data OUT of the flow objects, in both directions', () => {
    // The paperwork is not the work: a rule about what a process DOES must
    // never reach a data object, and a rule about data must never reach a task.
    for (const datum of [
      BPMN_ROLE.data,
      BPMN_ROLE.dataObject,
      BPMN_ROLE.dataStore,
    ]) {
      for (const family of [
        BPMN_ROLE.event,
        BPMN_ROLE.activity,
        BPMN_ROLE.gateway,
      ]) {
        expect(roleIsA(datum, family, BPMN_ROLES), `${datum} → ${family}`).toBe(
          false
        );
      }
    }
    expect(roleIsA(BPMN_ROLE.task, BPMN_ROLE.data, BPMN_ROLES)).toBe(false);
  });

  it('gives every DIRECTED edge role a verb and a gesture, and every node role none', () => {
    for (const def of Object.values(BPMN_ROLES)) {
      if (def.kind !== 'edge') {
        expect(def.direction, def.id).toBeUndefined();
        continue;
      }
      // The association names no relation and therefore has no verb — see
      // below. Every other edge role is tier 1 of `docs/adr/0010`: a relation
      // with a verb, `source` its subject and `target` its object.
      if (def.id === BPMN_ROLE.association) continue;
      expect(def.direction?.verbKey, def.id).toMatch(/^com\.labre\./);
      expect(def.direction?.verbFallback, def.id).toBeTruthy();
      expect(def.direction?.gestureHintKey, def.id).toMatch(/^com\.labre\./);
      expect(def.direction?.gestureHintFallback, def.id).toBeTruthy();
    }
  });

  /**
   * The association is the one edge in this vocabulary with NO direction, and
   * that absence is a declaration rather than an oversight — "this note is
   * about that task" reads identically from either end.
   */
  it('declares the association as an edge with no verb at all', () => {
    const association = BPMN_ROLES[BPMN_ROLE.association];
    expect(association.kind).toBe('edge');
    expect(association.direction).toBeUndefined();
    expect(association.parent).toBeUndefined();
    // It is still a typed edge — the predicate reads `kind`, so a stored
    // association is recognised as one — it simply has no sentence to reveal
    // and no direction to be wrong about.
    expect(isTypedEdgeRole(vocabularies, BPMN_ROLE.association)).toBe(true);
    expect(
      roleIsA(BPMN_ROLE.association, BPMN_ROLE.sequenceFlow, BPMN_ROLES)
    ).toBe(false);
  });

  it('says the sequence flow is followed, and the message flow is sent', () => {
    // Two verbs, two roles, and neither is the parent of the other: a sequence
    // flow orders the work inside a pool, a message flow crosses between them
    // and says nothing about order at all.
    expect(BPMN_ROLES[BPMN_ROLE.sequenceFlow].direction?.verbFallback).toBe(
      'is followed by'
    );
    expect(BPMN_ROLES[BPMN_ROLE.messageFlow].direction?.verbFallback).toBe(
      'sends a message to'
    );
    expect(BPMN_ROLES[BPMN_ROLE.sequenceFlow].parent).toBeUndefined();
    expect(BPMN_ROLES[BPMN_ROLE.messageFlow].parent).toBeUndefined();
    expect(
      roleIsA(BPMN_ROLE.messageFlow, BPMN_ROLE.sequenceFlow, BPMN_ROLES)
    ).toBe(false);
  });

  it('is a null-prototype lookup table', () => {
    expect(Object.getPrototypeOf(BPMN_ROLES)).toBeNull();
    expect((BPMN_ROLES as Record<string, unknown>)['toString']).toBeUndefined();
  });
});

describe('the kind → role bridge', () => {
  /** Every kind the model declares, in the order the notation groups them. */
  const KINDS = [
    'startEvent',
    'startEventMessage',
    'startEventTimer',
    'endEvent',
    'endEventMessage',
    'endEventTerminate',
    'task',
    'taskUser',
    'taskService',
    'subProcess',
    'callActivity',
    'gatewayExclusive',
    'gatewayParallel',
    'dataObject',
    'dataStore',
    'textAnnotation',
  ] as const satisfies readonly BpmnNodeKind[];

  it('gives each of the sixteen kinds a declared role', () => {
    // Total, and total over EXACTLY those sixteen: `kind` keeps driving the
    // renderer, so one arriving without a meaning would paint something the
    // tool could not read.
    expect(Object.keys(BPMN_ROLE_OF_KIND).sort()).toEqual([...KINDS].sort());
    for (const kind of KINDS) {
      const id = BPMN_ROLE_OF_KIND[kind];
      expect(BPMN_ROLES[id], `${kind} → ${id}`).toBeDefined();
      expect(BPMN_ROLES[id].kind).toBe('node');
    }
  });

  it('maps each kind to a distinct role, and the four originals to the ones they always meant', () => {
    // The bytes already in documents. These four mappings are frozen: changing
    // one would silently re-mean every process drawn before today.
    expect(BPMN_ROLE_OF_KIND.startEvent).toBe(BPMN_ROLE.startEvent);
    expect(BPMN_ROLE_OF_KIND.endEvent).toBe(BPMN_ROLE.endEvent);
    expect(BPMN_ROLE_OF_KIND.task).toBe(BPMN_ROLE.task);
    expect(BPMN_ROLE_OF_KIND.gatewayExclusive).toBe(BPMN_ROLE.gatewayExclusive);
    // No two kinds share a role: the palette entry a user picked is always
    // recoverable from what was written down.
    const ids = Object.values(BPMN_ROLE_OF_KIND);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('never stamps a family role, nor the pool, nor an edge', () => {
    // The palette always says WHICH event, which activity, which gateway, which
    // datum — the families exist to be written about, never to be written down.
    for (const id of Object.values(BPMN_ROLE_OF_KIND)) {
      expect(FAMILIES, id).not.toContain(id);
      expect(id).not.toBe(BPMN_ROLE.pool);
      expect(BPMN_ROLES[id].kind, id).toBe('node');
    }
    // A stamped role is not necessarily a LEAF — `bpmn:start-event` is stamped
    // by the plain start event and specialised by the message and timer ones,
    // which is exactly the shape the descriptive profile needed. What must hold
    // is that each stamped role means one artefact and no wider set: only
    // `bpmn:text-annotation` is both a root and a leaf, and it is a family of
    // one on purpose.
    expect(BPMN_ROLES[BPMN_ROLE.startEvent].parent).toBe(BPMN_ROLE.event);
    expect(BPMN_ROLES[BPMN_ROLE.textAnnotation].parent).toBeUndefined();
  });
});

describe('the sequence flow answers as a typed edge', () => {
  /** A connector model, minus the store: `asTypedEdge` reads `role` and nothing else. */
  const connectorWith = (role: string | undefined) => {
    const model = Object.create(ConnectorElementModel.prototype) as object;
    // An own property shadowing the accessor — no store, no Yjs document.
    Object.defineProperty(model, 'role', { value: role });
    return model;
  };

  it('reads a stored bpmn:sequence-flow connector as a typed edge', () => {
    const edge = asTypedEdge(
      vocabularies,
      connectorWith(BPMN_ROLE.sequenceFlow)
    );
    expect(edge).not.toBeNull();
    expect(edge!.role.id).toBe(BPMN_ROLE.sequenceFlow);
    // What the hover reveal writes on the link: the VERB, never the role label.
    expect(edgeVerbOf(edge!)).toEqual({
      key: 'com.labre.bpmn.role.sequence-flow.verb',
      fallback: 'is followed by',
    });
  });

  it('says nothing about a pool, or about a connector with no role', () => {
    expect(isTypedEdgeRole(vocabularies, BPMN_ROLE.sequenceFlow)).toBe(true);
    expect(isTypedEdgeRole(vocabularies, BPMN_ROLE.messageFlow)).toBe(true);
    expect(isTypedEdgeRole(vocabularies, BPMN_ROLE.pool)).toBe(false);
    // A process drawn before B1: no role, no claim, and nothing is backfilled.
    expect(asTypedEdge(vocabularies, connectorWith(undefined))).toBeNull();
    expect(findRoleDef(vocabularies, undefined)).toBeUndefined();
  });
});
