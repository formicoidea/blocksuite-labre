import { Bound } from '@labre/global/gfx';
import type { GfxPrimitiveElementModel, RoleDefs } from '@labre/std/gfx';
import { describe, expect, it } from 'vitest';

import {
  evaluateRules,
  type ValidationRule,
  verdictPropsOf,
} from '../extensions/validation.js';

/**
 * The `view-admissibility` family: does this artefact belong on THIS view?
 *
 * The first family whose subject is the SHEET. Every other one starts from an
 * artefact and asks something about where it is or what touches it; this one
 * starts from a frame that has DECLARED what kind of view it is, and judges what
 * has been drawn on it against that declaration.
 *
 * Two things carry the suite: the SILENCES — a frame that declares no level, a
 * level the rule's table does not name, an artefact off every view — and the
 * fact that the level is read off a prop the RULE names, so the engine learns
 * which views exist from the document and never from a name of its own.
 */

const ROLES: RoleDefs = {
  'test:sheet': { id: 'test:sheet', kind: 'node', labelKey: 'test.sheet' },
  'test:actor': { id: 'test:actor', kind: 'node', labelKey: 'test.actor' },
  'test:part': { id: 'test:part', kind: 'node', labelKey: 'test.part' },
  // A specialisation, so a rule forbidding the parent covers it for free.
  'test:sub-part': {
    id: 'test:sub-part',
    parent: 'test:part',
    kind: 'node',
    labelKey: 'test.sub-part',
  },
  'test:frame': { id: 'test:frame', kind: 'node', labelKey: 'test.frame' },
};

/** "An overview shows actors, never parts; a detail shows no frames." */
const ADMISSIBLE: ValidationRule = {
  id: 'test.off-level',
  framework: 'test',
  family: 'view-admissibility',
  severity: 'warning',
  // No `appliesTo`: the subjects are declared per LEVEL.
  roles: ROLES,
  messageKey: 'com.labre.test.off-level',
  suggestionKey: 'com.labre.test.off-level.suggestion',
  version: 1,
  backgroundRole: 'test:sheet',
  admissibility: {
    levelProp: 'zoom',
    forbidden: {
      overview: ['test:part'],
      detail: ['test:frame'],
    },
  },
};

function element(
  id: string,
  xywh: [number, number, number, number],
  props: Record<string, unknown> = {}
): GfxPrimitiveElementModel {
  const stub = {
    id,
    type: 'test',
    ...props,
    get elementBound() {
      return new Bound(...xywh);
    },
  };
  return stub as unknown as GfxPrimitiveElementModel;
}

/** The view. `zoom` omitted is a sheet whose author declared no level. */
const sheet = (zoom?: unknown, id = 'sheet') =>
  element(id, [0, 0, 1000, 1000], {
    role: 'test:sheet',
    ...(zoom === undefined ? {} : { zoom }),
  });

const node = (id: string, role: string, x = 100, y = 100) =>
  element(id, [x, y, 100, 60], { role });

const run = (rule: ValidationRule, elements: GfxPrimitiveElementModel[]) =>
  evaluateRules([rule], elements);

const ids = (rule: ValidationRule, elements: GfxPrimitiveElementModel[]) =>
  run(rule, elements).map(violation => violation.elementIds.join('+'));

describe('judging what is drawn on a view that declares its level', () => {
  it('indicts an artefact the declared level does not admit', () => {
    const found = run(ADMISSIBLE, [sheet('overview'), node('p', 'test:part')]);

    expect(found.map(violation => violation.elementIds)).toEqual([['p']]);
    expect(found[0].messageKey).toBe('com.labre.test.off-level');
    expect(found[0].suggestion).toBe('com.labre.test.off-level.suggestion');
  });

  it('says nothing about an artefact the level admits', () => {
    // The deny-list is the whole rule: everything it does not name is left
    // alone, which is what lets a view show its neighbours.
    expect(
      ids(ADMISSIBLE, [sheet('overview'), node('a', 'test:actor')])
    ).toEqual([]);
  });

  it('reads the OTHER level off the same table', () => {
    // Both polarities of the same rule: a part is fine on a detail sheet, a
    // frame is not — and the reverse one level up.
    expect(
      ids(ADMISSIBLE, [
        sheet('detail'),
        node('p', 'test:part'),
        node('f', 'test:frame'),
      ])
    ).toEqual(['f']);
  });

  it('covers a specialisation of a forbidden role', () => {
    expect(
      ids(ADMISSIBLE, [sheet('overview'), node('s', 'test:sub-part')])
    ).toEqual(['s']);
  });

  it('attributes the finding to the view it was measured against', () => {
    const found = run(ADMISSIBLE, [
      sheet('overview', 'board-a'),
      node('p', 'test:part'),
    ]);

    expect(found[0].backgroundId).toBe('board-a');
  });

  it('raises ONE finding per artefact, whichever forbidden role matched', () => {
    // A rule whose table names both a role and its parent must still say one
    // thing about one box: the author drew it on the wrong sheet, once.
    const both: ValidationRule = {
      ...ADMISSIBLE,
      admissibility: {
        levelProp: 'zoom',
        forbidden: { overview: ['test:part', 'test:sub-part'] },
      },
    };

    expect(ids(both, [sheet('overview'), node('s', 'test:sub-part')])).toEqual([
      's',
    ]);
  });

  it('names every offender on the sheet', () => {
    expect(
      ids(ADMISSIBLE, [
        sheet('overview'),
        node('a', 'test:actor'),
        node('p1', 'test:part', 100),
        node('p2', 'test:part', 300),
      ])
    ).toEqual(['p1', 'p2']);
  });
});

describe('which view judges an artefact', () => {
  it('judges an artefact by the view whose plot contains its CENTRE', () => {
    // Straddling the right edge (the box runs to x = 1030, the sheet stops at
    // 1000) with its centre at 980, still inside: the eye puts the box on this
    // sheet, and so does the rule.
    expect(
      ids(ADMISSIBLE, [
        sheet('overview'),
        element('p', [930, 100, 100, 60], { role: 'test:part' }),
      ])
    ).toEqual(['p']);
  });

  it('says nothing about an artefact drawn BESIDE the view', () => {
    // Centre outside: there is no nearest-frame fallback here, deliberately —
    // "this artefact is on that view" has to mean it.
    expect(
      ids(ADMISSIBLE, [
        sheet('overview'),
        element('p', [1200, 100, 100, 60], { role: 'test:part' }),
      ])
    ).toEqual([]);
  });

  it('judges an artefact against ONE of two views that both contain it', () => {
    // Ties go to the smaller id, never to the order a Y.Map was rebuilt in —
    // the invariant every attribution in the engine holds.
    const found = run(ADMISSIBLE, [
      sheet('overview', 'b-outer'),
      element('a-inner', [0, 0, 900, 900], {
        role: 'test:sheet',
        zoom: 'overview',
      }),
      node('p', 'test:part'),
    ]);

    expect(found.map(violation => violation.elementIds)).toEqual([['p']]);
    expect(found[0].backgroundId).toBe('a-inner');
  });

  it('never indicts a view for being drawn on itself', () => {
    // A view's own centre is inside its own plot, so a rule forbidding the
    // frame's own role would otherwise indict every sheet that declared a level.
    const reflexive: ValidationRule = {
      ...ADMISSIBLE,
      admissibility: {
        levelProp: 'zoom',
        forbidden: { overview: ['test:sheet'] },
      },
    };

    expect(ids(reflexive, [sheet('overview')])).toEqual([]);
  });
});

describe('when a view-admissibility rule stays silent', () => {
  it('says nothing about a view that declares NO level', () => {
    // The overwhelming majority, and every frame in every document written
    // before the prop existed. No fact, no rule.
    expect(ids(ADMISSIBLE, [sheet(), node('p', 'test:part')])).toEqual([]);
  });

  it('says nothing about a level the rule’s table does not name', () => {
    // A framework that ships the two levels forbidding something and stays
    // quiet on the one that forbids nothing — rather than a rule that can never
    // fire.
    expect(
      ids(ADMISSIBLE, [sheet('anecdote'), node('p', 'test:part')])
    ).toEqual([]);
  });

  it('says nothing when the level names an EMPTY forbidden list', () => {
    const permissive: ValidationRule = {
      ...ADMISSIBLE,
      admissibility: { levelProp: 'zoom', forbidden: { overview: [] } },
    };

    expect(
      ids(permissive, [sheet('overview'), node('p', 'test:part')])
    ).toEqual([]);
  });

  it('treats a non-string level as no level at all', () => {
    // The value comes off a Y.Map, so it is whatever a peer, an importer or an
    // older client wrote. `String(42)` must not become a level.
    for (const written of [42, true, null, {}, ['overview'], '']) {
      expect(
        ids(ADMISSIBLE, [sheet(written), node('p', 'test:part')]),
        JSON.stringify(written)
      ).toEqual([]);
    }
  });

  it('never resolves a level off the prototype', () => {
    // `forbidden` is an object literal shipped by a framework, so a frame whose
    // level happened to say `constructor` must resolve to nothing.
    for (const written of ['constructor', 'toString', '__proto__']) {
      expect(
        ids(ADMISSIBLE, [sheet(written), node('p', 'test:part')]),
        written
      ).toEqual([]);
    }
  });

  it('says nothing about an element carrying no role', () => {
    // A rectangle somebody dropped on the sheet to think with belongs to no
    // notation, so no view can refuse it.
    expect(
      ids(ADMISSIBLE, [sheet('overview'), element('free', [100, 100, 40, 40])])
    ).toEqual([]);
  });

  it('says nothing on a board carrying no view at all', () => {
    expect(ids(ADMISSIBLE, [node('p', 'test:part')])).toEqual([]);
  });

  it('evaluates nothing for a rule that names no frame role', () => {
    const frameless: ValidationRule = {
      ...ADMISSIBLE,
      id: 'test.off-level-frameless',
      backgroundRole: undefined,
    };

    expect(ids(frameless, [sheet('overview'), node('p', 'test:part')])).toEqual(
      []
    );
  });

  it('evaluates nothing for a rule carrying no admissibility block', () => {
    const empty: ValidationRule = { ...ADMISSIBLE, admissibility: undefined };

    expect(ids(empty, [sheet('overview'), node('p', 'test:part')])).toEqual([]);
  });
});

/**
 * What makes a VIEW's own declaration verdict-bearing.
 *
 * Changing the level — or clearing it back to "no level", which DELETES the key
 * — re-judges everything drawn on that frame. Without this, the picker would be
 * as inert as a colour and the marks would stay on screen until some unrelated
 * drag happened to wake the engine.
 */
describe('what the level prop costs the drawing path', () => {
  it('watches the prop the rule names', () => {
    expect(verdictPropsOf([ADMISSIBLE]).has('zoom')).toBe(true);
  });

  it('watches nothing extra by default', () => {
    expect(verdictPropsOf([]).has('zoom')).toBe(false);
  });

  it('derives the prop from the DECLARATION, never from a name it knows', () => {
    const elsewhere: ValidationRule = {
      ...ADMISSIBLE,
      admissibility: {
        levelProp: 'sheetKind',
        forbidden: { a: ['test:part'] },
      },
    };

    expect(verdictPropsOf([elsewhere]).has('sheetKind')).toBe(true);
    expect(verdictPropsOf([elsewhere]).has('zoom')).toBe(false);
  });
});
