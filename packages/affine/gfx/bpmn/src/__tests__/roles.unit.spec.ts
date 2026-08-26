import { asTypedEdge, edgeVerbOf } from '@labre/affine-gfx-connector';
import { ConnectorElementModel } from '@labre/affine-model';
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

describe('BPMN role vocabulary', () => {
  it('declares the three families, their leaves, the pool and the two flows', () => {
    // 3 parents + 4 leaves + 1 pool + 2 flows.
    expect(Object.keys(BPMN_ROLES)).toHaveLength(10);
    for (const id of [
      BPMN_ROLE.event,
      BPMN_ROLE.startEvent,
      BPMN_ROLE.endEvent,
      BPMN_ROLE.activity,
      BPMN_ROLE.task,
      BPMN_ROLE.gateway,
      BPMN_ROLE.gatewayExclusive,
      BPMN_ROLE.pool,
    ]) {
      expect(BPMN_ROLES[id]?.kind, id).toBe('node');
    }
    expect(BPMN_ROLES[BPMN_ROLE.sequenceFlow].kind).toBe('edge');
    expect(BPMN_ROLES[BPMN_ROLE.messageFlow].kind).toBe('edge');
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
      [BPMN_ROLE.gatewayExclusive, BPMN_ROLE.gateway],
    ] as const;

    for (const [leaf, family] of chains) {
      expect(BPMN_ROLES[leaf].parent).toBe(family);
      expect(roleIsA(leaf, family, BPMN_ROLES), leaf).toBe(true);
      // A rule written on one family must never fall on another's leaves.
      for (const other of [
        BPMN_ROLE.event,
        BPMN_ROLE.activity,
        BPMN_ROLE.gateway,
      ]) {
        if (other === family) continue;
        expect(roleIsA(leaf, other, BPMN_ROLES), `${leaf} → ${other}`).toBe(
          false
        );
      }
      // ...and the specialisation only reads one way.
      expect(roleIsA(family, leaf, BPMN_ROLES)).toBe(false);
    }

    // The three families are roots: BPMN's own taxonomy stops there.
    for (const family of [
      BPMN_ROLE.event,
      BPMN_ROLE.activity,
      BPMN_ROLE.gateway,
    ]) {
      expect(BPMN_ROLES[family].parent, family).toBeUndefined();
    }
  });

  it('keeps the pool OUT of every flow-object subtree', () => {
    // The frame, not an artefact — the same call `wardley:map` makes.
    expect(BPMN_ROLES[BPMN_ROLE.pool].parent).toBeUndefined();
    for (const family of [
      BPMN_ROLE.event,
      BPMN_ROLE.activity,
      BPMN_ROLE.gateway,
    ]) {
      expect(roleIsA(BPMN_ROLE.pool, family, BPMN_ROLES), family).toBe(false);
      expect(roleIsA(family, BPMN_ROLE.pool, BPMN_ROLES), family).toBe(false);
    }
  });

  it('gives every EDGE role a verb and a gesture, and every node role none', () => {
    for (const def of Object.values(BPMN_ROLES)) {
      if (def.kind === 'edge') {
        // Tier 1 of `docs/adr/0010`: an edge role names a relation with a verb,
        // `source` is its subject and `target` its object.
        expect(def.direction?.verbKey, def.id).toMatch(/^com\.labre\./);
        expect(def.direction?.verbFallback, def.id).toBeTruthy();
        expect(def.direction?.gestureHintKey, def.id).toMatch(/^com\.labre\./);
        expect(def.direction?.gestureHintFallback, def.id).toBeTruthy();
      } else {
        expect(def.direction, def.id).toBeUndefined();
      }
    }
  });

  it('says the sequence flow is followed, and the message flow is sent', () => {
    // Two verbs, two roles, and neither is the parent of the other: a sequence
    // flow orders the work inside a pool, a message flow crosses between them
    // and says nothing about order at all.
    expect(
      BPMN_ROLES[BPMN_ROLE.sequenceFlow].direction?.verbFallback
    ).toBe('is followed by');
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
    expect(
      (BPMN_ROLES as Record<string, unknown>)['toString']
    ).toBeUndefined();
  });
});

describe('the kind → role bridge', () => {
  it('gives each of the four legacy kinds a declared role', () => {
    const kinds = [
      'startEvent',
      'endEvent',
      'task',
      'gatewayExclusive',
    ] as const;
    // Total, and total over EXACTLY those four: `kind` keeps driving the
    // renderer, so a fifth one arriving without a meaning would paint something
    // the tool could not read.
    expect(Object.keys(BPMN_ROLE_OF_KIND).sort()).toEqual([...kinds].sort());
    for (const kind of kinds) {
      const id = BPMN_ROLE_OF_KIND[kind];
      expect(BPMN_ROLES[id], `${kind} → ${id}`).toBeDefined();
      expect(BPMN_ROLES[id].kind).toBe('node');
    }
  });

  it('maps each kind to its own leaf, never to a family', () => {
    expect(BPMN_ROLE_OF_KIND.startEvent).toBe(BPMN_ROLE.startEvent);
    expect(BPMN_ROLE_OF_KIND.endEvent).toBe(BPMN_ROLE.endEvent);
    expect(BPMN_ROLE_OF_KIND.task).toBe(BPMN_ROLE.task);
    expect(BPMN_ROLE_OF_KIND.gatewayExclusive).toBe(
      BPMN_ROLE.gatewayExclusive
    );
    // Nothing is ever stamped with a family role: the palette always says which
    // event, which activity, which gateway.
    for (const id of Object.values(BPMN_ROLE_OF_KIND)) {
      expect(BPMN_ROLES[id].parent, id).toBeDefined();
    }
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
    const edge = asTypedEdge(vocabularies, connectorWith(BPMN_ROLE.sequenceFlow));
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
