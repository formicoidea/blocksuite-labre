import { CM_RELATIONSHIPS } from '@labre/affine-gfx-ddd-shared';
import { roleIsA } from '@labre/std/gfx';
import { describe, expect, it } from 'vitest';

import {
  CM_PATTERN_ROLE,
  CONTEXT_MAP_ROLE,
  CONTEXT_MAP_ROLES,
} from '../roles';

describe('context map role vocabulary', () => {
  it('declares a role for each of the nine patterns, plus board / context / parent', () => {
    expect(Object.keys(CONTEXT_MAP_ROLES)).toHaveLength(3 + 9);
    expect(CONTEXT_MAP_ROLES[CONTEXT_MAP_ROLE.board].kind).toBe('node');
    expect(CONTEXT_MAP_ROLES[CONTEXT_MAP_ROLE.context].kind).toBe('node');
    expect(CONTEXT_MAP_ROLES[CONTEXT_MAP_ROLE.relationship].kind).toBe('edge');
  });

  it('namespaces every role and kebab-cases the pattern ids', () => {
    for (const def of Object.values(CONTEXT_MAP_ROLES)) {
      expect(def.id.startsWith('context-map:')).toBe(true);
      expect(def.id).toBe(def.id.toLowerCase());
      expect(def.labelKey).toMatch(/^com\.labre\./);
      expect(def.labelFallback).toBeTruthy();
    }
    expect(CM_PATTERN_ROLE.sharedKernel).toBe('context-map:shared-kernel');
    expect(CM_PATTERN_ROLE.customerSupplier).toBe(
      'context-map:customer-supplier'
    );
    expect(CM_PATTERN_ROLE.acl).toBe('context-map:acl');
  });

  it('makes every pattern a specialisation of the relationship parent', () => {
    for (const preset of CM_RELATIONSHIPS) {
      const id = CM_PATTERN_ROLE[preset.kind];
      expect(
        roleIsA(id, CONTEXT_MAP_ROLE.relationship, CONTEXT_MAP_ROLES),
        id
      ).toBe(true);
    }
    // ...and nothing else is. A rule written on the parent must never fall on
    // the board it is drawn over or on a context it connects.
    expect(
      roleIsA(
        CONTEXT_MAP_ROLE.context,
        CONTEXT_MAP_ROLE.relationship,
        CONTEXT_MAP_ROLES
      )
    ).toBe(false);
    expect(
      roleIsA(
        CONTEXT_MAP_ROLE.board,
        CONTEXT_MAP_ROLE.context,
        CONTEXT_MAP_ROLES
      )
    ).toBe(false);
  });

  it('declares a verb only on the upstream/downstream patterns', () => {
    for (const preset of CM_RELATIONSHIPS) {
      const def = CONTEXT_MAP_ROLES[CM_PATTERN_ROLE[preset.kind]];
      if (preset.upDown) {
        expect(def.direction?.verbFallback, preset.kind).toBe('is upstream of');
        expect(def.direction?.gestureHintFallback, preset.kind).toMatch(
          /upstream/
        );
      } else {
        // Partnership, Shared Kernel, Separate Ways, Big Ball of Mud relate two
        // contexts as EQUALS: announcing "drag from the upstream one" would be
        // announcing a gesture the notation does not have.
        expect(def.direction, preset.kind).toBeUndefined();
      }
    }
    // The parent stays verbless for the same reason: four of its nine children
    // would inherit a sentence they deny saying.
    expect(
      CONTEXT_MAP_ROLES[CONTEXT_MAP_ROLE.relationship].direction
    ).toBeUndefined();
  });

  it('is a null-prototype lookup table', () => {
    expect(Object.getPrototypeOf(CONTEXT_MAP_ROLES)).toBeNull();
    expect(
      (CONTEXT_MAP_ROLES as Record<string, unknown>)['toString']
    ).toBeUndefined();
  });
});
