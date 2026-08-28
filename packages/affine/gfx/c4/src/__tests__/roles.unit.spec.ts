import type { C4NodeKind } from '@labre/affine-model';
import { roleIsA } from '@labre/std/gfx';
import { describe, expect, it } from 'vitest';

import { NODE_SIZE } from '../consts';
import { C4_ROLE, C4_ROLE_OF_KIND, C4_ROLES } from '../roles';

/**
 * The C4 vocabulary, checked the way the other frameworks' are: the shape of
 * every declaration, the hierarchy read through `roleIsA` rather than restated,
 * and the bridge that has to hold — the `kind` discriminant and the role it
 * means.
 */

/** Every kind the model declares, restated so the tables can be walked. */
const ALL_KINDS = Object.keys(NODE_SIZE) as C4NodeKind[];

describe('C4 role vocabulary', () => {
  it('declares the five levels, the two frames and the one relationship', () => {
    // 7 node roles + 1 edge.
    expect(Object.keys(C4_ROLES)).toHaveLength(8);
    for (const id of [
      C4_ROLE.person,
      C4_ROLE.system,
      C4_ROLE.container,
      C4_ROLE.database,
      C4_ROLE.component,
      C4_ROLE.board,
      C4_ROLE.boundary,
    ]) {
      expect(C4_ROLES[id]?.kind, id).toBe('node');
    }
    expect(C4_ROLES[C4_ROLE.relationship].kind).toBe('edge');
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
   * The i18n keys are DELIBERATELY absent until C4 has a framework identity —
   * see the note in `roles.ts`. Pinned rather than left implicit, because the
   * day the tooling slice adds them this test is what has to be updated, and
   * updating it means putting the entries in the manifest at the same time.
   */
  it('declares no i18n key while no manifest can name one', () => {
    for (const [id, def] of Object.entries(C4_ROLES)) {
      expect(def.labelKey, id).toBeUndefined();
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

  it('keeps the two frames out of every element role', () => {
    // A rule written on the artefacts must never fall on the sheet they are
    // drawn on, nor on the lasso drawn round them.
    for (const frame of [C4_ROLE.board, C4_ROLE.boundary] as const) {
      expect(C4_ROLES[frame].parent, frame).toBeUndefined();
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

  it('has exactly one connecting object, and it is an edge role', () => {
    // One kind of line on this canvas — its LABEL is where the author says
    // which kind of using it is — so one edge role, where BPMN needs three.
    const edges = Object.values(C4_ROLES).filter(def => def.kind === 'edge');
    expect(edges.map(def => def.id)).toEqual([C4_ROLE.relationship]);
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
