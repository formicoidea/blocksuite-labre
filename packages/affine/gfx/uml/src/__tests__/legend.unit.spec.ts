import { autoLegendSections, roleLabel } from '@labre/affine-gfx-ddd-shared';
import type { RoleId } from '@labre/std/gfx';
import { describe, expect, it } from 'vitest';

import { UML_AUTO_LEGEND } from '../legend.js';
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
    // sheet — so none of them may carry a filled swatch.
    for (const entry of frames.entries) {
      expect(entry.row.swatch, entry.role).toBe('line');
    }
  });
});
