import {
  C4BoardElementModel,
  C4NodeElementModel,
  type C4NodeKind,
  GroupElementModel,
  ShapeElementModel,
  StrokeStyle,
} from '@labre/affine-model';
import type { GfxPrimitiveElementModel } from '@labre/std/gfx';
import { describe, expect, it } from 'vitest';

import { c4TierBoxes } from '../component';
import {
  NODE_PALETTE,
  NODE_RADIUS,
  NODE_SIZE,
  NODE_STROKE_WIDTH,
} from '../consts';
import { C4_MORPH_FAMILIES, C4_MORPH_SPEC, c4NodeOfComponent } from '../morph';
import { c4MorphClears, c4MorphProps, c4NodeProps } from '../presets';
import { C4_ROLE_OF_KIND } from '../roles';
import { C4_TYPE_TAKES_TECHNOLOGY, C4_TYPE_WORD } from '../type-line';

/**
 * What a C4 component may BECOME — the framework's half of the morph.
 *
 * The generic half (when the dropdown stands up, what one pick writes, that the
 * two hooks are honoured) is the surface package's; this file is about the
 * DATA: which kinds are reachable from which, that the reachable set is
 * geometry-preserving by construction, that the patch is the palette's own and
 * not a second table, and that a selected group resolves to the one shape the
 * kind lives on.
 */

const EVERY_KIND = Object.keys(NODE_PALETTE) as C4NodeKind[];
const FAMILY_MEMBERS = C4_MORPH_FAMILIES.flat();

describe('the declared families', () => {
  it('names only real kinds, each in at most one family', () => {
    for (const kind of FAMILY_MEMBERS) expect(EVERY_KIND).toContain(kind);
    expect(new Set(FAMILY_MEMBERS).size).toBe(FAMILY_MEMBERS.length);
  });

  it('leaves the component and the two frames out of every family', () => {
    // A component is a PART of a container, not another drawing of one:
    // offering the swap would invite a diagram mixing two levels of the model,
    // which is the one thing C4 exists to stop. The board and the boundary are
    // frames and are not `C4NodeKind`s at all.
    expect(FAMILY_MEMBERS).not.toContain('component');
    expect(FAMILY_MEMBERS.sort()).toEqual(
      EVERY_KIND.filter(kind => kind !== 'component').sort()
    );
  });

  it('opens each family on its plain, internal member', () => {
    // Declaration order is menu order: the undecorated artefact is the honest
    // first draft, the variant is the refinement.
    expect(C4_MORPH_FAMILIES.map(family => family[0])).toEqual([
      'person',
      'system',
      'container',
    ]);
  });
});

/**
 * The architect's claim, stated as a test: a morph inside a family needs no
 * re-layout, so the geometry the module promises not to touch is genuinely
 * untouched — the three tiers stay where they are and the group's derived box
 * stays what it was.
 */
describe('a family is geometry-preserving by construction', () => {
  it.each(C4_MORPH_FAMILIES.map(family => [family[0], family] as const))(
    'the %s family shares one footprint and one tier layout',
    (_lead, family) => {
      const [first, ...rest] = family;
      for (const kind of rest) {
        expect(NODE_SIZE[kind]).toEqual(NODE_SIZE[first]);
        // Laid out against the SAME box, because the box is the same box: the
        // person's head clearance is the only asymmetry `c4TierBoxes` has, and
        // both people are in one family.
        const { w, h } = NODE_SIZE[first];
        expect(c4TierBoxes(kind, 10, 20, w, h)).toEqual(
          c4TierBoxes(first, 10, 20, w, h)
        );
      }
    }
  );

  it('keeps the three tiers legible without restyling them', () => {
    // The tiers are painted in the node's text colour, and a family that
    // changed it would need every tier rewritten as well as the shape. None
    // does — which is why the morph writes the shape and nothing else.
    for (const family of C4_MORPH_FAMILIES) {
      const colours = new Set(family.map(kind => NODE_PALETTE[kind].text));
      expect(colours.size).toBe(1);
    }
  });

  it('keeps the caption saying the same word inside a family', () => {
    // Which is why the type-line rewrite is INERT on today's table — see
    // `c4MorphedTypeLine`. Asserted rather than assumed, so the day a family
    // gains a member that announces itself differently, this case is the one
    // that says the rewrite has started to matter.
    for (const family of C4_MORPH_FAMILIES) {
      expect(new Set(family.map(kind => C4_TYPE_WORD[kind])).size).toBe(1);
      expect(
        new Set(family.map(kind => C4_TYPE_TAKES_TECHNOLOGY[kind])).size
      ).toBe(1);
    }
  });
});

describe('the patch one kind is worth', () => {
  it('is the creation builder, minus identity, geometry and words', () => {
    for (const kind of EVERY_KIND) {
      const created: Record<string, unknown> = {
        ...c4NodeProps(kind, { xywh: '[1,2,3,4]' }),
      };
      delete created.type;
      delete created.xywh;
      // Derived, not restated: the palette and the morph cannot drift.
      expect(c4MorphProps(kind)).toEqual(created);
    }
  });

  it('never carries type, xywh or text', () => {
    for (const kind of EVERY_KIND) {
      const props = c4MorphProps(kind);
      expect(props).not.toHaveProperty('type');
      expect(props).not.toHaveProperty('xywh');
      expect(props).not.toHaveProperty('text');
      expect(props).toMatchObject({
        kind,
        role: C4_ROLE_OF_KIND[kind],
        strokeWidth: NODE_STROKE_WIDTH,
      });
    }
  });

  it('differs on the hazard keys across the container family', () => {
    const container = c4MorphProps('container');
    const database = c4MorphProps('database');

    // The whole reason a `{kind, role}` patch is not enough here: a container
    // paints its body natively and a cylinder does not, so morphing between
    // them with two keys leaves the rectangle painted behind the cylinder.
    expect(container.filled).toBe(true);
    expect(database.filled).toBe(false);
    expect(container.strokeStyle).toBe(StrokeStyle.Solid);
    expect(database.strokeStyle).toBe(StrokeStyle.None);
    // …and the two devices round their corners where the plain box does not.
    expect(c4MorphProps('mobile').radius).toBe(NODE_RADIUS.mobile);
    expect(c4MorphProps('browser').radius).toBe(NODE_RADIUS.browser);
    expect(container.radius).toBe(0);
    // The one thing that does NOT move inside this family: all four are
    // containers, and the level is the colour.
    expect(database.fillColor).toBe(container.fillColor);
  });

  it('carries the grey that means "somebody else owns this"', () => {
    // The `-ext` families are the same argument in colour: external is not a
    // different level, it is a different ownership, and it lives in the paint.
    expect(c4MorphProps('person-ext').fillColor).not.toBe(
      c4MorphProps('person').fillColor
    );
    expect(c4MorphProps('system-ext').strokeColor).not.toBe(
      c4MorphProps('system').strokeColor
    );
    // …and the role does not move with it: an external system IS a system.
    expect(c4MorphProps('system-ext').role).toBe(c4MorphProps('system').role);
  });

  it('has nothing to clear on this table, and says so by deriving it', () => {
    // No C4 preset spreads a key conditionally: all nine write the same key
    // set with different values. The day one stops, this stops being empty.
    for (const kind of EVERY_KIND) expect(c4MorphClears(kind)).toEqual([]);
  });
});

/* ── Resolving the composite ───────────────────────────────────────────── */

/**
 * A model built detached, the way `models.unit.spec.ts` builds one: the
 * `instanceof` gates the resolution runs are the shipped ones, and the two
 * accessors it reads are defined as plain values rather than driven through a
 * Yjs document that no unit test has.
 */
function detached<T>(
  Ctor: abstract new (...args: never[]) => T,
  props: Record<string, unknown>
): T {
  const element = Object.create(Ctor.prototype) as object;
  for (const [key, value] of Object.entries(props)) {
    Object.defineProperty(element, key, { value, configurable: true });
  }
  return element as T;
}

const shape = (kind: C4NodeKind) =>
  detached(C4NodeElementModel, { kind }) as unknown as GfxPrimitiveElementModel;

const group = (children: unknown[]) =>
  detached(GroupElementModel, {
    childElements: children,
  }) as unknown as GfxPrimitiveElementModel;

describe('resolving a selected group to its shape', () => {
  it('finds the one c4Node a component is built round', () => {
    const node = shape('container');
    // The three text tiers ride along and are ignored: what the resolution is
    // after is the element the kind lives on.
    const resolved = c4NodeOfComponent(group([{}, node, {}]));
    expect(resolved).toBe(node);
    expect(C4_MORPH_SPEC.kindOf(resolved!)).toBe('container');
  });

  it('refuses anything that is not a group', () => {
    expect(c4NodeOfComponent(shape('container'))).toBeUndefined();
    expect(
      c4NodeOfComponent(
        detached(C4BoardElementModel, {}) as unknown as GfxPrimitiveElementModel
      )
    ).toBeUndefined();
  });

  it('refuses a group holding no C4 shape at all', () => {
    // A plain lasso round three rectangles, and another framework's component
    // — a Wardley one is a group of a circle and its label.
    const alien = detached(ShapeElementModel, {}) as unknown;
    expect(c4NodeOfComponent(group([alien, {}]))).toBeUndefined();
    expect(c4NodeOfComponent(group([]))).toBeUndefined();
  });

  it('refuses a group holding two of them', () => {
    // Two components grouped together: morphing "it" would mean picking one by
    // document order, and the honest answer to an ambiguous selection is none.
    expect(
      c4NodeOfComponent(group([shape('container'), shape('database')]))
    ).toBeUndefined();
  });
});

describe('the spec handed to the generic module', () => {
  it('is declared on the GROUP, because that is what a click selects', () => {
    expect(C4_MORPH_SPEC.modelType).toBe(GroupElementModel);
    expect(C4_MORPH_SPEC.resolveTarget).toBe(c4NodeOfComponent);
    expect(C4_MORPH_SPEC.framework).toBe('c4');
  });

  it('reports the SHAPE roles, collapsing the ones the notation collapses', () => {
    for (const kind of FAMILY_MEMBERS) {
      expect(C4_MORPH_SPEC.roleOf(kind)).toBe(C4_ROLE_OF_KIND[kind]);
    }
    // An external person is a person: the ownership changed, the meaning did
    // not, and the telemetry says exactly that.
    expect(C4_MORPH_SPEC.roleOf('person-ext')).toBe(
      C4_MORPH_SPEC.roleOf('person')
    );
    // The one family member with a role of its own.
    expect(C4_MORPH_SPEC.roleOf('database')).not.toBe(
      C4_MORPH_SPEC.roleOf('container')
    );
  });

  it('names and draws every kind from its own creation command', () => {
    // Reused rather than redrawn, so the dropdown says what the sub-menu entry
    // that draws one says.
    expect(C4_MORPH_SPEC.labelOf('database')).toEqual({
      key: 'com.labre.commands.c4.addDatabase',
      fallback: 'Database',
    });
    expect(C4_MORPH_SPEC.labelOf('person-ext').fallback).toBe(
      'Person (external)'
    );
    for (const kind of FAMILY_MEMBERS) {
      expect(C4_MORPH_SPEC.iconOf(kind)).toBeTruthy();
    }
  });
});
