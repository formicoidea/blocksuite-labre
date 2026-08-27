import { Bound } from '@labre/global/gfx';
import type { GfxPrimitiveElementModel, RoleDefs } from '@labre/std/gfx';
import { describe, expect, it } from 'vitest';
import * as Y from 'yjs';

import {
  evaluateCheckup,
  evaluateRules,
  type ValidationRule,
  VERDICT_PROPS,
  verdictPropsOf,
} from '../extensions/validation.js';

/**
 * The `label-presence` family: does this artefact say what it is?
 *
 * The first family that reads an element's WORDS. Every other one asks about
 * geometry, roles or relations, all of which a reader can partly infer from the
 * drawing — a box with nothing written in it is the one defect nothing recovers.
 *
 * Two things carry the suite: what counts as ABSENT (nothing, empty, whitespace,
 * invisible code points), and the fact that `text` becomes verdict-bearing only
 * for a framework that asks the question while the user is drawing.
 */

const ROLES: RoleDefs = {
  'test:frame': { id: 'test:frame', kind: 'node', labelKey: 'test.frame' },
  'test:activity': {
    id: 'test:activity',
    kind: 'node',
    labelKey: 'test.activity',
  },
  // A specialisation, so a rule written on the parent covers it for free.
  'test:sub-process': {
    id: 'test:sub-process',
    parent: 'test:activity',
    kind: 'node',
    labelKey: 'test.sub-process',
  },
  'test:event': { id: 'test:event', kind: 'node', labelKey: 'test.event' },
};

/** "Every step says what it is." */
const NAMED: ValidationRule = {
  id: 'test.unnamed-step',
  framework: 'test',
  family: 'label-presence',
  severity: 'warning',
  appliesTo: 'test:activity',
  roles: ROLES,
  messageKey: 'com.labre.test.unnamed-step',
  suggestionKey: 'com.labre.test.unnamed-step.suggestion',
  version: 1,
  backgroundRole: 'test:frame',
  label: { present: true },
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

const frame = (id = 'frame') =>
  element(id, [0, 0, 1000, 1000], { role: 'test:frame' });

/**
 * An artefact. `text` omitted is an element that carries none at all; a string
 * is the plain property a fixture writes; see {@link yText} for the shape a real
 * canvas holds.
 */
const node = (id: string, role: string, text?: string) =>
  element(id, [50, 50, 100, 40], {
    role,
    ...(text === undefined ? {} : { text }),
  });

/** The artefact as a live canvas holds it: a `Y.Text` attached to a document. */
const yText = (id: string, role: string, text: string) => {
  const doc = new Y.Doc();
  const value = doc.getText(id);
  value.insert(0, text);
  return element(id, [50, 50, 100, 40], { role, text: value });
};

const run = (rule: ValidationRule, elements: GfxPrimitiveElementModel[]) =>
  evaluateRules([rule], elements);

const ids = (rule: ValidationRule, elements: GfxPrimitiveElementModel[]) =>
  run(rule, elements).map(violation => violation.elementIds.join('+'));

describe('reading the words an artefact carries', () => {
  it('says nothing about a named artefact', () => {
    expect(ids(NAMED, [frame(), node('a', 'test:activity', 'Review')])).toEqual(
      []
    );
  });

  it('indicts an artefact carrying no text at all', () => {
    const found = run(NAMED, [frame(), node('a', 'test:activity')]);

    expect(found.map(violation => violation.elementIds)).toEqual([['a']]);
    expect(found[0].messageKey).toBe('com.labre.test.unnamed-step');
    expect(found[0].suggestion).toBe('com.labre.test.unnamed-step.suggestion');
  });

  it('indicts an artefact whose text is empty', () => {
    expect(ids(NAMED, [frame(), node('a', 'test:activity', '')])).toEqual([
      'a',
    ]);
  });

  it('indicts an artefact whose text is only whitespace', () => {
    expect(
      ids(NAMED, [frame(), node('a', 'test:activity', '  \n\t ')])
    ).toEqual(['a']);
  });

  it('indicts an artefact named with invisible characters alone', () => {
    // Present in the string, absent from the page. Left alone this artefact
    // LOOKS unnamed and validates as named — the worst of both, and impossible
    // to debug from the canvas. `trim()` does not remove these.
    expect(ids(NAMED, [frame(), node('a', 'test:activity', '​﻿')])).toEqual([
      'a',
    ]);
  });

  it('accepts a name a reader can see, however short', () => {
    // Judging the QUALITY of a name is not this family's business, and probably
    // nobody's.
    expect(ids(NAMED, [frame(), node('a', 'test:activity', 'x')])).toEqual([]);
  });

  it('reads a live Y.Text the way the canvas holds one', () => {
    // The duck-typed read is `String(el.text)`, which is what the renderer and
    // `textInkBound` have always relied on.
    expect(
      ids(NAMED, [frame(), yText('a', 'test:activity', 'Review')])
    ).toEqual([]);
    expect(ids(NAMED, [frame(), yText('b', 'test:activity', '   ')])).toEqual([
      'b',
    ]);
  });

  it('names only the unnamed artefact', () => {
    expect(
      ids(NAMED, [
        frame(),
        node('named', 'test:activity', 'Review'),
        node('bare', 'test:activity'),
      ])
    ).toEqual(['bare']);
  });

  it('attributes the finding to the frame it was drawn on', () => {
    expect(
      run(NAMED, [frame('board'), node('a', 'test:activity')])[0].backgroundId
    ).toBe('board');
  });

  it('covers a specialisation of the subject role', () => {
    expect(ids(NAMED, [frame(), node('s', 'test:sub-process')])).toEqual(['s']);
  });
});

describe('when a label-presence rule stays silent', () => {
  it('says nothing about an element carrying no role', () => {
    // A rectangle somebody dropped on the board to think with is not an
    // artefact of any framework, named or otherwise.
    expect(ids(NAMED, [frame(), element('free', [0, 0, 40, 40])])).toEqual([]);
  });

  it('says nothing about an artefact of another role', () => {
    expect(ids(NAMED, [frame(), node('e', 'test:event')])).toEqual([]);
  });

  it('says nothing on a board carrying no subject at all', () => {
    expect(ids(NAMED, [frame()])).toEqual([]);
  });

  it('needs no frame on the board', () => {
    // `backgroundRole` buys attribution only — the `no-overlap` pattern. An
    // unnamed artefact is unnamed wherever it is drawn.
    const found = run(NAMED, [node('a', 'test:activity')]);

    expect(found.map(violation => violation.elementIds)).toEqual([['a']]);
    expect(found[0].backgroundId).toBeUndefined();
  });
});

/**
 * The moment, and what it costs the drawing path.
 *
 * Naming is the one property a user changes by TYPING, one character at a time.
 * `text` is therefore verdict-bearing only for a framework that registers a
 * REAL-TIME rule of this family — otherwise every keystroke in every shape on
 * every board would wake the debounced evaluation for a question most documents
 * never ask.
 */
describe('what makes an element’s words verdict-bearing', () => {
  it('does not watch text by default', () => {
    expect(VERDICT_PROPS).not.toContain('text');
    expect(verdictPropsOf([]).has('text')).toBe(false);
  });

  it('watches text once a real-time rule asks the question', () => {
    expect(verdictPropsOf([NAMED]).has('text')).toBe(true);
  });

  it('does NOT watch text for an on-demand rule', () => {
    // The moment filter is the point: an on-demand rule is never evaluated on
    // the gesture path, so waking that path for it would hand back exactly what
    // declaring the second moment bought.
    const later: ValidationRule = { ...NAMED, moment: 'on-demand' };

    expect(verdictPropsOf([later]).has('text')).toBe(false);
  });

  it('is unaffected by the rules of other families', () => {
    const other: ValidationRule = {
      ...NAMED,
      id: 'test.other-family',
      family: 'element-in-background',
      label: undefined,
    };

    expect(verdictPropsOf([other]).has('text')).toBe(false);
  });

  it('answers the same question at either moment', () => {
    const later: ValidationRule = { ...NAMED, moment: 'on-demand' };
    const board = [frame(), node('a', 'test:activity')];

    expect(evaluateRules([later], board)).toEqual([]);
    expect(
      evaluateCheckup([later], board).map(v => v.elementIds.join('+'))
    ).toEqual(['a']);
  });
});
