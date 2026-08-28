import type { C4NodeKind } from '@labre/affine-model';
import { roleIsA } from '@labre/std/gfx';
import { describe, expect, it } from 'vitest';

import { NODE_SIZE } from '../consts';
import { C4_BOUNDARY_ROLE, C4_ROLE, C4_ROLE_OF_KIND, C4_ROLES } from '../roles';

/**
 * The C4 vocabulary, checked the way the other frameworks' are: the shape of
 * every declaration, the hierarchy read through `roleIsA` rather than restated,
 * and the bridge that has to hold — the `kind` discriminant and the role it
 * means.
 */

/** Every kind the model declares, restated so the tables can be walked. */
const ALL_KINDS = Object.keys(NODE_SIZE) as C4NodeKind[];

describe('C4 role vocabulary', () => {
  it('declares the five levels, the three tiers, the four frames and the one relationship', () => {
    // 9 node roles + 3 text + 1 edge.
    expect(Object.keys(C4_ROLES)).toHaveLength(13);
    for (const id of [
      C4_ROLE.person,
      C4_ROLE.system,
      C4_ROLE.container,
      C4_ROLE.database,
      C4_ROLE.component,
      C4_ROLE.board,
      C4_ROLE.boundary,
      C4_ROLE['system-boundary'],
      C4_ROLE['container-boundary'],
    ]) {
      expect(C4_ROLES[id]?.kind, id).toBe('node');
    }
    expect(C4_ROLES[C4_ROLE.relationship].kind).toBe('edge');
  });

  /**
   * The two written tiers of a component's label, as canvas TEXT elements.
   *
   * `kind: 'text'` and not `'node'`, which is the same call `wardley:label`
   * makes: a tier's BOX is a creation-time default 88% of the node wide whatever
   * it reads, so a rule measuring one has to measure its INK. Filing them as
   * nodes would let a geometric rule judge an element by a rectangle nobody drew.
   */
  it('declares all three written tiers as text, and none as an artefact', () => {
    const tiers = [C4_ROLE.title, C4_ROLE['type-line'], C4_ROLE.description];
    for (const id of tiers) {
      expect(C4_ROLES[id]?.kind, id).toBe('text');
      // Parent-less: a tier is one line of one element's label, not a level of
      // the model, so nothing written about containers may fall on it.
      expect(C4_ROLES[id]?.parent, id).toBeUndefined();
      // …and no `kind` maps to any of them: the nine artefacts are the nine
      // artefacts, and the role of a component stays on its SHAPE alone.
      expect(Object.values(C4_ROLE_OF_KIND), id).not.toContain(id);
    }
  });

  /**
   * `c4:title` is where an element's NAME lives, and the role a naming rule
   * has to read (see the note in `roles.ts`).
   *
   * Pinned on its own because it is the youngest role in the pack and the one
   * with a consumer outside it: the label-presence rules collapse onto it.
   */
  it('gives the name a role of its own, distinct from the other two tiers', () => {
    expect(C4_ROLE.title).toBe('c4:title');
    expect(C4_ROLES[C4_ROLE.title]).toBeDefined();
    expect(C4_ROLES[C4_ROLE.title].labelFallback).toBe('Name');
    expect(
      new Set([C4_ROLE.title, C4_ROLE['type-line'], C4_ROLE.description]).size
    ).toBe(3);
  });

  it('namespaces every role, keys it by its own id and kebab-cases it', () => {
    for (const [id, def] of Object.entries(C4_ROLES)) {
      expect(id).toBe(def.id);
      expect(id.startsWith('c4:')).toBe(true);
      expect(id).toBe(id.toLowerCase());
      expect(def.labelFallback, id).toBeTruthy();
    }
  });

  /**
   * The reverse of what the model slice pinned.
   *
   * That slice shipped the vocabulary with NO i18n keys, on purpose: a key the
   * translation manifest cannot name is a key a host meets and cannot
   * translate, and the manifest could not name one until C4 had a framework
   * identity to contribute under. The tooling slice gives it one, so every def
   * now carries its key — and `c4TranslationEntries` is what puts them in the
   * manifest, which
   * `packages/affine/all/src/__tests__/translations/manifest.unit.spec.ts`
   * checks in both directions.
   */
  it('names every role through the translation seam', () => {
    for (const [id, def] of Object.entries(C4_ROLES)) {
      expect(def.labelKey, id).toBe(
        `com.labre.c4.role.${id.slice('c4:'.length)}`
      );
    }
  });

  /**
   * The relationship's `direction` block — tier 2 of `docs/adr/0010`, and the
   * other half of what the model slice deferred for want of a key to declare.
   * The verb is what the hover reveal reads back on a drawn arrow, with the
   * `c4` flag on or off.
   */
  it('gives the relationship a verb, and gives one to nothing else', () => {
    const direction = C4_ROLES[C4_ROLE.relationship].direction;
    expect(direction?.verbFallback).toBe('uses');
    expect(direction?.verbKey).toBe('com.labre.c4.role.relationship.verb');
    expect(direction?.gestureHintFallback).toBeTruthy();
    for (const [id, def] of Object.entries(C4_ROLES)) {
      if (id === C4_ROLE.relationship) continue;
      // A node role names no relation, so it has no direction to declare.
      expect(def.direction, id).toBeUndefined();
    }
  });

  it('files the database under the container, and reads only that way', () => {
    expect(C4_ROLES[C4_ROLE.database].parent).toBe(C4_ROLE.container);
    expect(roleIsA(C4_ROLE.database, C4_ROLE.container, C4_ROLES)).toBe(true);
    // A specialisation reads one way only: not every container is a database.
    expect(roleIsA(C4_ROLE.container, C4_ROLE.database, C4_ROLES)).toBe(false);
  });

  it('keeps the four LEVELS flat — composition is not specialisation', () => {
    // "A container is part of a system" is not "a container is a kind of
    // system": a chain here would make every rule about systems fall on every
    // container, which is the opposite of what C4 says.
    const levels = [
      C4_ROLE.person,
      C4_ROLE.system,
      C4_ROLE.container,
      C4_ROLE.component,
    ] as const;
    for (const level of levels) {
      expect(C4_ROLES[level].parent, level).toBeUndefined();
      for (const other of levels) {
        if (other === level) continue;
        expect(roleIsA(level, other, C4_ROLES), `${level} → ${other}`).toBe(
          false
        );
      }
    }
  });

  it('keeps the frames out of every element role', () => {
    // A rule written on the artefacts must never fall on the sheet they are
    // drawn on, nor on the lasso drawn round them — nor, since the split, on
    // either of the two levels that lasso can be drawn at.
    for (const frame of [
      C4_ROLE.board,
      C4_ROLE.boundary,
      C4_ROLE['system-boundary'],
      C4_ROLE['container-boundary'],
    ] as const) {
      for (const level of [
        C4_ROLE.person,
        C4_ROLE.system,
        C4_ROLE.container,
        C4_ROLE.database,
        C4_ROLE.component,
      ]) {
        expect(roleIsA(frame, level, C4_ROLES), `${frame} → ${level}`).toBe(
          false
        );
        expect(roleIsA(level, frame, C4_ROLES), `${level} → ${frame}`).toBe(
          false
        );
      }
    }
  });

  /**
   * The boundary split, which is the whole of the zoom slice on the vocabulary
   * side: `c4:system-boundary` and `c4:container-boundary` under `c4:boundary`.
   *
   * The relation matters more than the two ids. Everything already written on
   * the parent — the two membership rules, the legend's "Boundary" row, the
   * frame gate that decides where a profile may be chosen — has to keep reaching
   * a boundary drawn today, and it does so through `roleIsA` alone.
   */
  it('files both levels of boundary under the boundary itself', () => {
    // The two roots stay parent-less: a board is not a boundary and a boundary
    // is not a level of the model.
    expect(C4_ROLES[C4_ROLE.board].parent).toBeUndefined();
    expect(C4_ROLES[C4_ROLE.boundary].parent).toBeUndefined();

    for (const child of [
      C4_ROLE['system-boundary'],
      C4_ROLE['container-boundary'],
    ] as const) {
      expect(C4_ROLES[child].parent, child).toBe(C4_ROLE.boundary);
      // The children MIRROR the parent's kind: they are the same dashed
      // rectangle, and a rule measuring one measures its bounds.
      expect(C4_ROLES[child].kind, child).toBe(C4_ROLES[C4_ROLE.boundary].kind);
      // What a rule framed on the parent gets for free, and the reason the two
      // membership rules did not have to be rewritten.
      expect(roleIsA(child, C4_ROLE.boundary, C4_ROLES), child).toBe(true);
      // ...and the asymmetry that makes the compatibility argument: descent runs
      // child → ancestor and never back, so a boundary stamped with the PARENT
      // role — every boundary drawn before this split — is NOT a child, and a
      // rule framed on a child does not reach it.
      expect(roleIsA(C4_ROLE.boundary, child, C4_ROLES), child).toBe(false);
    }
    // The two children are siblings, not a chain: a system boundary is not a
    // container boundary, in either direction.
    expect(
      roleIsA(
        C4_ROLE['system-boundary'],
        C4_ROLE['container-boundary'],
        C4_ROLES
      )
    ).toBe(false);
    expect(
      roleIsA(
        C4_ROLE['container-boundary'],
        C4_ROLE['system-boundary'],
        C4_ROLES
      )
    ).toBe(false);
  });

  it('names both levels of boundary in the words a legend can print', () => {
    expect(C4_ROLES[C4_ROLE['system-boundary']].labelFallback).toBe(
      'System boundary'
    );
    expect(C4_ROLES[C4_ROLE['container-boundary']].labelFallback).toBe(
      'Container boundary'
    );
  });

  it('has exactly one connecting object, and it is an edge role', () => {
    // One kind of line on this canvas — its LABEL is where the author says
    // which kind of using it is — so one edge role, where BPMN needs three.
    const edges = Object.values(C4_ROLES).filter(def => def.kind === 'edge');
    expect(edges.map(def => def.id)).toEqual([C4_ROLE.relationship]);
  });
});

describe('C4_BOUNDARY_ROLE', () => {
  it('gives every variant a role, and both are boundaries', () => {
    // The frame's twin of `C4_ROLE_OF_KIND`: the renderer and the exporter read
    // `variant`, the zoom rules read the role, and this table is the single
    // place saying the two are one statement.
    expect(Object.keys(C4_BOUNDARY_ROLE).sort()).toEqual([
      'container',
      'system',
    ]);
    for (const [variant, role] of Object.entries(C4_BOUNDARY_ROLE)) {
      expect(C4_ROLES[role], `${variant} → ${role}`).toBeDefined();
      expect(roleIsA(role, C4_ROLE.boundary, C4_ROLES), variant).toBe(true);
    }
  });

  it('maps each variant onto its OWN level, never the other', () => {
    expect(C4_BOUNDARY_ROLE.system).toBe(C4_ROLE['system-boundary']);
    expect(C4_BOUNDARY_ROLE.container).toBe(C4_ROLE['container-boundary']);
    // The pin that matters for `c4.container-in-container-boundary`: a system
    // boundary must not answer to the rule written on the container one, or
    // every correct container diagram becomes a finding.
    expect(
      roleIsA(C4_BOUNDARY_ROLE.system, C4_ROLE['container-boundary'], C4_ROLES)
    ).toBe(false);
  });
});

describe('C4_ROLE_OF_KIND', () => {
  it('gives every kind a role, and only declared ones', () => {
    expect(Object.keys(C4_ROLE_OF_KIND).sort()).toEqual([...ALL_KINDS].sort());
    for (const kind of ALL_KINDS) {
      const role = C4_ROLE_OF_KIND[kind];
      expect(role, kind).toBeDefined();
      expect(C4_ROLES[role], `${kind} → ${role}`).toBeDefined();
    }
  });

  it('collapses the drawn flavours onto the level they belong to', () => {
    // The grey says "out of scope", not "a different sort of thing"...
    expect(C4_ROLE_OF_KIND['person-ext']).toBe(C4_ROLE.person);
    expect(C4_ROLE_OF_KIND['system-ext']).toBe(C4_ROLE.system);
    // ...and a phone app and a single-page app are containers with a picture.
    expect(C4_ROLE_OF_KIND.mobile).toBe(C4_ROLE.container);
    expect(C4_ROLE_OF_KIND.browser).toBe(C4_ROLE.container);
    // The database is the one flavour with a role of its own — and a rule about
    // containers still reaches it.
    expect(C4_ROLE_OF_KIND.database).toBe(C4_ROLE.database);
    expect(roleIsA(C4_ROLE_OF_KIND.database, C4_ROLE.container, C4_ROLES)).toBe(
      true
    );
  });
});
