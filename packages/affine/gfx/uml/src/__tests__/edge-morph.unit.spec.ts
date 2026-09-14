import {
  ConnectorElementModel,
  PointStyle,
  StrokeStyle,
} from '@labre/affine-model';
import type { GfxPrimitiveElementModel } from '@labre/std/gfx';
import { describe, expect, it } from 'vitest';

import { UML_EDGE_WIDTH, UML_INK } from '../consts.js';
import {
  UML_EDGE_FAMILIES,
  UML_EDGE_KIND_OF_ROLE,
  UML_EDGE_KINDS,
  UML_EDGE_MORPH_SPEC,
  type UmlEdgeKind,
  umlEdgeProps,
} from '../edge-morph.js';
import { UML_EDGE_STYLE } from '../edge-styles.js';
import { UML_ROLE } from '../roles.js';

/**
 * What a UML relationship may BECOME.
 *
 * The same shape as the node morph's suite and the same division of labour: the
 * generic module's behaviour is the surface package's to prove, and this file is
 * about the DATA — which relationships are reachable from which, that one pick
 * rewrites the DRAWING as well as the meaning, and that a connector this pack
 * never armed is refused before a menu is ever offered.
 */

const FAMILY_MEMBERS = UML_EDGE_FAMILIES.flat();

describe('the declared families', () => {
  it('names only real edges, each in at most one family', () => {
    for (const kind of FAMILY_MEMBERS) expect(UML_EDGE_KINDS).toContain(kind);
    expect(new Set(FAMILY_MEMBERS).size).toBe(FAMILY_MEMBERS.length);
  });

  it('leaves the anchor out of every family, and nothing else', () => {
    // An anchor joins a note to what it comments on (Annex A): it is not a
    // relationship between classifiers, it carries no semantics, and offering
    // to turn one into a composition would invite a diagram claiming that a
    // comment owns a class. Every other edge is reachable from its siblings.
    expect(FAMILY_MEMBERS).not.toContain('anchor');
    expect([...FAMILY_MEMBERS].sort()).toEqual(
      UML_EDGE_KINDS.filter(kind => kind !== 'anchor').sort()
    );
  });

  it('opens each family on its plain, undecorated member', () => {
    expect(UML_EDGE_FAMILIES.map(family => family[0])).toEqual([
      'association',
      'generalization',
      'dependency',
    ]);
  });

  it('groups the three that a reader cannot tell apart', () => {
    // §7.8 and §18.1.4: a dependency, an include and an extend are one dashed
    // arrow told apart by their keyword alone. Asserted off the style table
    // rather than restated, so the day one of them gains a drawing of its own
    // this case is what says the grouping needs re-arguing.
    const [dependency, ...rest] = UML_EDGE_FAMILIES[2];
    for (const kind of rest) {
      expect(UML_EDGE_STYLE[kind]).toEqual(UML_EDGE_STYLE[dependency]);
    }
  });
});

describe('the patch one relationship is worth', () => {
  it('is the very table the connector tool arms, plus the ink', () => {
    for (const kind of UML_EDGE_KINDS) {
      expect(umlEdgeProps(kind)).toEqual({
        role: UML_ROLE[kind],
        stroke: UML_INK,
        strokeWidth: UML_EDGE_WIDTH,
        ...UML_EDGE_STYLE[kind],
      });
    }
  });

  it('never carries type, xywh, text, source or target', () => {
    // The last two are the ones that matter here and the whole reason an edge
    // morph is worth having: the endpoints are what a delete-and-redraw
    // destroys, so the patch must not so much as name them. `mode` is absent
    // too — the router is a layout decision the author made about the drawing.
    for (const kind of UML_EDGE_KINDS) {
      const props = umlEdgeProps(kind);
      for (const forbidden of [
        'type',
        'xywh',
        'text',
        'source',
        'target',
        'mode',
      ]) {
        expect(props).not.toHaveProperty(forbidden);
      }
    }
  });

  it('rewrites the DRAWING, not just the meaning', () => {
    // The case the whole spec exists for: a composition and an association
    // differ by one filled diamond, so a `{role}` patch would write the meaning
    // and leave the picture stating the previous one.
    const composition = umlEdgeProps('composition');
    expect(composition.role).toBe(UML_ROLE.composition);
    expect(composition.frontEndpointStyle).toBe(PointStyle.Diamond);
    expect(composition.frontEndpointStyle).toBe('Diamond');
    expect(umlEdgeProps('association').frontEndpointStyle).toBe(
      PointStyle.None
    );
    // Hollow for shared aggregation, filled for composite — §11.5.4's one
    // visual difference, and the one everybody misdraws.
    expect(umlEdgeProps('aggregation').frontEndpointStyle).toBe(
      PointStyle.DiamondHollow
    );
    // …and the second family's difference is the dashes and nothing else.
    expect(umlEdgeProps('realization').strokeStyle).toBe(StrokeStyle.Dash);
    expect(umlEdgeProps('generalization').strokeStyle).toBe(StrokeStyle.Solid);
    expect(umlEdgeProps('realization').rearEndpointStyle).toBe(
      umlEdgeProps('generalization').rearEndpointStyle
    );
  });
});

/* ── Which connectors are ours ─────────────────────────────────────────── */

/**
 * A connector built detached, as the node suite builds its shapes: the
 * `instanceof` gate and the `role` accessor are the shipped ones, without a Yjs
 * document to drive them.
 */
function connector(role?: string): GfxPrimitiveElementModel {
  const element = Object.create(ConnectorElementModel.prototype) as object;
  Object.defineProperty(element, 'role', { value: role, configurable: true });
  return element as GfxPrimitiveElementModel;
}

describe('kindOf — the only gate an edge morph has', () => {
  it('reads every UML relationship back off its role', () => {
    for (const kind of UML_EDGE_KINDS) {
      expect(UML_EDGE_MORPH_SPEC.kindOf(connector(UML_ROLE[kind]))).toBe(kind);
      expect(UML_EDGE_KIND_OF_ROLE[UML_ROLE[kind]]).toBe(kind);
    }
  });

  it('refuses a plain connector', () => {
    // The line a user drew with the ordinary connector tool carries no role at
    // all, so there is nothing for this menu to be about — and the generic
    // module turns an `undefined` kind into no dropdown, not a default one.
    expect(UML_EDGE_MORPH_SPEC.kindOf(connector())).toBeUndefined();
    expect(UML_EDGE_MORPH_SPEC.kindOf(connector(''))).toBeUndefined();
  });

  it('refuses another framework relationship, and our own nodes', () => {
    for (const foreign of [
      'bpmn:sequence-flow',
      'c4:relationship',
      'wardley:link',
      // A UML role, and still not an edge: the node morph answers for these.
      UML_ROLE.class,
      UML_ROLE.name,
      UML_ROLE.diagram,
    ]) {
      expect(UML_EDGE_MORPH_SPEC.kindOf(connector(foreign))).toBeUndefined();
    }
  });
});

describe('the spec handed to the generic module', () => {
  it('is declared on the connector, with no composite to resolve', () => {
    // Unlike a classifier, a relationship is ONE element: what the user selects,
    // what carries the role and what the patch lands on are the same object.
    expect(UML_EDGE_MORPH_SPEC.modelType).toBe(ConnectorElementModel);
    expect(UML_EDGE_MORPH_SPEC.resolveTarget).toBeUndefined();
    expect(UML_EDGE_MORPH_SPEC.afterMorph).toBeUndefined();
    expect(UML_EDGE_MORPH_SPEC.framework).toBe('uml');
    expect(UML_EDGE_MORPH_SPEC.clearOf?.('composition')).toEqual([]);
  });

  it('reports one role per kind, because that is what an edge is', () => {
    for (const kind of UML_EDGE_KINDS) {
      expect(UML_EDGE_MORPH_SPEC.roleOf(kind)).toBe(UML_ROLE[kind]);
    }
    const roles = UML_EDGE_KINDS.map(kind => UML_EDGE_MORPH_SPEC.roleOf(kind));
    expect(new Set(roles).size).toBe(UML_EDGE_KINDS.length);
  });

  it('names and draws every kind from its own tool command', () => {
    expect(UML_EDGE_MORPH_SPEC.labelOf('composition')).toEqual({
      key: 'com.labre.commands.uml.compositionTool',
      fallback: 'Composition',
    });
    for (const kind of FAMILY_MEMBERS as UmlEdgeKind[]) {
      expect(UML_EDGE_MORPH_SPEC.labelOf(kind).key).toBeTruthy();
      expect(UML_EDGE_MORPH_SPEC.iconOf(kind)).toBeTruthy();
    }
  });
});
