import { autoLegendSections, roleLabel } from '@labre/affine-gfx-ddd-shared';
import { PointStyle, StrokeStyle, type UmlNodeKind } from '@labre/affine-model';
import type { RoleId } from '@labre/std/gfx';
import { describe, expect, it } from 'vitest';

import { UML_NODE_BOX } from '../consts.js';
import { UML_EDGE_STYLE, type UmlEdgeRole } from '../edge-styles.js';
import { UML_AUTO_LEGEND } from '../legend.js';
import { umlNodeProps } from '../presets.js';
import { UML_ROLE, UML_ROLE_OF_KIND, UML_ROLES } from '../roles.js';

/**
 * The diagram frame's automatic legend, checked the way the three DDD boards'
 * are: not for its prose — there is none, every row's wording is the role
 * vocabulary's own — but for its COVERAGE and for the two decisions that would
 * otherwise read as oversights.
 *
 * Coverage is what this file is worth, and it is the failure it exists to
 * prevent: phase 2 added twenty-seven artefacts and six relationships to
 * `roles.ts`, and not one of them got a legend row. Nothing broke — an
 * unlisted role simply never appears — so a deployment sheet's legend said
 * "Legend" and listed nothing, and no test anywhere named the absence. The
 * assertions below are DERIVED from the vocabulary, so the next phase's roles
 * fail this file on the day they land rather than on the day somebody clicks.
 */

const entries = UML_AUTO_LEGEND.sections.flatMap(section => section.entries);
const listed = new Set<RoleId>(entries.map(entry => entry.role));

/**
 * The roles that deliberately get NO row, with the reason.
 *
 * Every one of them is an ancestor nothing is ever drawn as: a rule is written
 * on it so one declaration reaches its children (`rules.ts`), and a row naming
 * it would name a shape that exists only in the vocabulary. `uml:diagram` is
 * the other kind of omission — it is the sheet the legend is drawn ON.
 *
 * `uml:operand` is the third: it is an instance ZONE of a fragment's own plot
 * and is never stamped on an element, so nothing can ever light it up.
 */
const UNLISTED: Readonly<Record<string, string>> = {
  'uml:classifier': 'an abstract parent nothing is ever drawn as',
  'uml:control-node': 'an abstract parent nothing is ever drawn as',
  'uml:pseudostate': 'an abstract parent nothing is ever drawn as',
  'uml:message': 'an abstract parent nothing is ever drawn as',
  'uml:diagram': 'the sheet the legend is drawn on',
  'uml:operand': 'a reported zone, never a stamped element',
};

describe('the UML auto-legend covers the vocabulary it documents', () => {
  it('lists every role an element can actually carry', () => {
    const missing = Object.values(UML_ROLES)
      .filter(def => def.kind !== 'text')
      .map(def => def.id)
      .filter(id => !listed.has(id) && UNLISTED[id] === undefined);
    expect(missing).toEqual([]);
  });

  it('lists every node KIND the toolbox can create, through its role', () => {
    // The bridge `roles.ts` declares, walked from the other end: a kind with a
    // creation command and no legend row is a picture the reader cannot look
    // up. Derived from `UML_ROLE_OF_KIND`, which is total over `UmlNodeKind`.
    for (const [kind, role] of Object.entries(UML_ROLE_OF_KIND)) {
      expect(listed.has(role), `${kind} → ${role}`).toBe(true);
    }
  });

  it('names only roles the vocabulary declares, and each of them once', () => {
    for (const entry of entries) {
      expect(UML_ROLES[entry.role], entry.role).toBeDefined();
    }
    expect(listed.size).toBe(entries.length);
  });

  it('never restates a wording the role vocabulary already owns', () => {
    for (const entry of entries) {
      expect(entry.row.label, entry.role).toBe(
        roleLabel(UML_ROLES, entry.role)
      );
    }
  });

  it('writes no text tier into the legend', () => {
    // A tier is one part of one artefact's label, not an artefact: a "Name" row
    // would be the legend describing the legend's own medium.
    for (const entry of entries) {
      expect(UML_ROLES[entry.role]?.kind, entry.role).not.toBe('text');
    }
  });
});

describe('the two `exact` entries, and why only two', () => {
  /**
   * An inclusive entry on a parent lights up for any of its children, which is
   * what a legend usually wants. Twice it is a lie, and both times for the same
   * sentence: the parent's swatch is a drawing that is nowhere on the board.
   */
  it('marks the association and the node exact, and nothing else', () => {
    expect(
      entries.filter(entry => entry.exact).map(entry => entry.role)
    ).toEqual([UML_ROLE.node, UML_ROLE.association]);
  });

  it('keeps a plain "Node" row off a board of devices', () => {
    const rows = autoLegendSections(
      new Set([UML_ROLE.device]),
      UML_AUTO_LEGEND
    ).flatMap(section => section.rows.map(row => row.label));
    expect(rows).toEqual([roleLabel(UML_ROLES, UML_ROLE.device)]);
  });

  it('keeps a plain "Association" row off a board of diamonds', () => {
    const rows = autoLegendSections(
      new Set([UML_ROLE.composition]),
      UML_AUTO_LEGEND
    ).flatMap(section => section.rows.map(row => row.label));
    expect(rows).toEqual([roleLabel(UML_ROLES, UML_ROLE.composition)]);
  });
});

describe('what a drawn sheet puts in its legend', () => {
  it('lists the deployment vocabulary a deployment sheet actually draws', () => {
    // The regression this file exists for, stated as the drawing that produced
    // it: before the phase-2 rows landed, this legend was empty.
    const sections = autoLegendSections(
      new Set([
        UML_ROLE.artifact,
        UML_ROLE.device,
        UML_ROLE.deploy,
        UML_ROLE.manifest,
      ]),
      UML_AUTO_LEGEND
    );
    expect(sections.map(section => section.rows.map(row => row.label))).toEqual(
      [
        [
          roleLabel(UML_ROLES, UML_ROLE.artifact),
          roleLabel(UML_ROLES, UML_ROLE.device),
        ],
        [
          roleLabel(UML_ROLES, UML_ROLE.deploy),
          roleLabel(UML_ROLES, UML_ROLE.manifest),
        ],
      ]
    );
  });

  it('dashes the two keyworded dependencies and nothing else of the three', () => {
    // §19.2.4 and §19.3.4 draw a `«deploy»` and a `«manifest»` with the
    // dependency's broken line; §19.4.4's communication path is a plain solid
    // one, and a legend that dashed it would tell a small lie about the only
    // thing that distinguishes them.
    const dashOf = (role: RoleId) =>
      entries.find(entry => entry.role === role)?.row.dashed ?? false;
    expect(dashOf(UML_ROLE.deploy)).toBe(true);
    expect(dashOf(UML_ROLE.manifest)).toBe(true);
    expect(dashOf(UML_ROLE['communication-path'])).toBe(false);
    expect(dashOf(UML_ROLE['control-flow'])).toBe(false);
    expect(dashOf(UML_ROLE['object-flow'])).toBe(false);
    expect(dashOf(UML_ROLE.transition)).toBe(false);
  });

  it('puts the swimlane and the composite state with the frames', () => {
    const frames = UML_AUTO_LEGEND.sections.find(
      section => section.title === 'Frames'
    )!;
    expect(frames.entries.map(entry => entry.role)).toEqual([
      UML_ROLE.subject,
      UML_ROLE.partition,
      UML_ROLE.region,
      UML_ROLE.fragment,
    ]);
    // None of the four has a body — each is a rectangle drawn ROUND part of the
    // sheet — so none of them may carry a FILLED swatch. An outline is what
    // they are, and what the swatch draws.
    for (const entry of frames.entries) {
      expect(entry.row.swatch, entry.role).toBe('glyph');
      expect(entry.row.props?.filled, entry.role).toBe(false);
    }
  });
});

/**
 * The recette of 2026-09-15: « les pictogrammes de la légende ne sont pas
 * correctement importés. Il n'y a que des rectangles pour class et actors alors
 * qu'ils ont des pictos bien particuliers ».
 *
 * A key of identical white chips documents nothing in a notation that defines no
 * palette: UML tells its artefacts apart by SILHOUETTE, so every row has to draw
 * the artefact. These check that each row carries the pack's OWN declaration
 * rather than a picture of its own — the drawing itself is the node renderer's
 * and the connector renderer's, and `node-glyph-scale.unit.spec.ts` is where it
 * is asserted.
 */
describe('every legend row draws the artefact it names', () => {
  const rowOf = (role: RoleId) =>
    entries.find(entry => entry.role === role)!.row;

  it('draws a node row with the preset the toolbox creates it with', () => {
    const row = rowOf(UML_ROLE.class);
    expect(row.swatch).toBe('glyph');
    expect(row.props?.type).toBe('umlNode');
    expect(row.props?.kind).toBe('class');
    // Same shape family, same colours, same stroke — one declaration
    // (`presets.ts`), so a restyle reaches the legend on its own.
    const preset = umlNodeProps('class', { xywh: '[0,0,0,0]' });
    expect(row.props?.shapeType).toBe(preset.shapeType);
    expect(row.props?.fillColor).toBe(preset.fillColor);
    expect(row.props?.strokeColor).toBe(preset.strokeColor);
  });

  it('never stamps a ROLE on a swatch', () => {
    // A legend is drawn ON the frame it documents and the scan is by role: a
    // swatch carrying one would list itself the next time a legend was made.
    for (const entry of entries) {
      expect(entry.row.props?.role, entry.role).toBeUndefined();
    }
  });

  it('gives each picture the artefact’s own footprint', () => {
    // An actor is drawn portrait, a class landscape, a fork as a bar — the
    // aspect is `UML_NODE_BOX`'s and not a number picked here.
    const aspect = (kind: UmlNodeKind) =>
      UML_NODE_BOX[kind].w / UML_NODE_BOX[kind].h;
    expect(rowOf(UML_ROLE.actor).aspect).toBe(aspect('actor'));
    expect(rowOf(UML_ROLE.class).aspect).toBe(aspect('class'));
    expect(rowOf(UML_ROLE.fork).aspect).toBe(aspect('fork'));
    expect(rowOf(UML_ROLE.actor).aspect!).toBeLessThan(1);
    expect(rowOf(UML_ROLE.class).aspect!).toBeGreaterThan(1);
  });

  it('draws a relation row with the line the toolbox arms', () => {
    // The diamonds, the triangles and the heads §11.5.4 / §9.2.4 / §17.4.4 draw
    // — read off `UML_EDGE_STYLE`, which is the table the tool and the morph
    // already share, so a legend can never show an end the tool does not draw.
    for (const [role, style] of Object.entries(UML_EDGE_STYLE)) {
      const row = rowOf(UML_ROLE[role as UmlEdgeRole]);
      expect(row.swatch, role).toBe('edge');
      expect(row.props, role).toEqual(style);
      expect(row.dashed ?? false, role).toBe(
        style.strokeStyle === StrokeStyle.Dash
      );
    }
    // …and the two that used to be a bare bar now carry their diamond.
    expect(rowOf(UML_ROLE.aggregation).props?.frontEndpointStyle).toBe(
      PointStyle.DiamondHollow
    );
    expect(rowOf(UML_ROLE.composition).props?.frontEndpointStyle).toBe(
      PointStyle.Diamond
    );
    expect(rowOf(UML_ROLE.generalization).props?.rearEndpointStyle).toBe(
      PointStyle.TriangleHollow
    );
  });

  it('leaves no row drawing a plain chip', () => {
    // The regression this file exists for, stated as the PO stated it: not one
    // "rectangle" left standing in for a picture.
    for (const entry of entries) {
      expect(entry.row.swatch, entry.role).not.toBe('square');
      expect(entry.row.swatch, entry.role).not.toBe('dot');
      expect(entry.row.swatch, entry.role).not.toBe('line');
    }
  });
});
