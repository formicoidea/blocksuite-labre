import { TextFitMode } from '@labre/affine-model';
import { describe, expect, it } from 'vitest';

import {
  DOT_SIZE,
  MARKER_SIZE,
  SHADOW_COLOR,
  SHADOW_OFFSET,
  STICKY_SIZE,
} from '../shared/consts';
import {
  bubbleElement,
  cloudElements,
  dddConnectorElement,
  dotElements,
  markerElements,
  stickyElements,
} from '../shared/elements';

/**
 * The DDD artefacts as pure builders (`docs/adr/0045`), the one assembly the
 * prefabs write and the three boards' toolboxes hand a host with no editor.
 * What it would have caught: a composite whose group is not last or misses a
 * member, a role landing on the shadow, a caption or a group instead of the
 * artefact, a label written as anything but the plain string a host can
 * serialize, and an artefact not placed at the point it is given.
 */

const groupLast = (elements: ReturnType<typeof stickyElements>) => {
  const group = elements.at(-1);
  expect(group?.type).toBe('group');
  expect(Object.keys(group?.children as object)).toEqual(
    elements.slice(0, -1).map(e => e.id)
  );
};

describe('ddd element builders', () => {
  it('builds a sticky: shadow, face at the point, group last', () => {
    const elements = stickyElements(
      { x: 10, y: 20 },
      { fill: '#F5963B', text: '#5a3000', label: 'Paid', role: 'es:x' },
      'e1'
    );
    const [shadow, face] = elements;
    expect(shadow).toMatchObject({
      id: 'e1:shadow',
      fillColor: SHADOW_COLOR,
      xywh: `[${10 + SHADOW_OFFSET},${20 + SHADOW_OFFSET},${STICKY_SIZE},${STICKY_SIZE}]`,
    });
    expect(shadow?.role).toBeUndefined();
    expect(face).toMatchObject({
      id: 'e1:face',
      role: 'es:x',
      text: 'Paid',
      textFitMode: TextFitMode.Contained,
      xywh: `[10,20,${STICKY_SIZE},${STICKY_SIZE}]`,
    });
    groupLast(elements);
  });

  it('builds a bubble as one shape owning its words', () => {
    expect(bubbleElement({ x: 0, y: 0 }, 'Billing', 'cm:c', 'b')).toMatchObject(
      { type: 'shape', id: 'b', role: 'cm:c', text: 'Billing' }
    );
  });

  it('builds a dot alone, or with its caption and their group', () => {
    expect(dotElements({ x: 0, y: 0 }, '#9933ff')).toEqual([
      expect.objectContaining({
        id: 'dot:dot',
        shapeType: 'ellipse',
        xywh: `[0,0,${DOT_SIZE},${DOT_SIZE}]`,
      }),
    ]);
    const labelled = dotElements({ x: 0, y: 0 }, '#9933ff', 'Pricing', 'cd:x');
    expect(labelled.map(e => [e.type, e.role])).toEqual([
      ['shape', 'cd:x'],
      ['text', undefined],
      ['group', undefined],
    ]);
    groupLast(labelled);
  });

  it('builds a marker: square with the role, letter, caption, group last', () => {
    const elements = markerElements(
      { x: 0, y: 0 },
      { fill: '#66b2ff', letter: 'X', label: 'X-as-a-Service', role: 'cd:m' }
    );
    expect(elements.map(e => [e.id, e.role, e.text])).toEqual([
      ['marker:square', 'cd:m', undefined],
      ['marker:letter', undefined, 'X'],
      ['marker:caption', undefined, 'X-as-a-Service'],
      ['marker:group', undefined, undefined],
    ]);
    expect(elements[0]?.xywh).toBe(`[0,0,${MARKER_SIZE},${MARKER_SIZE}]`);
    groupLast(elements);
  });

  it('builds a cloud with no role key unless asked', () => {
    const [cloud] = cloudElements({ x: 0, y: 0 });
    expect(cloud).not.toHaveProperty('role');
    groupLast(cloudElements({ x: 0, y: 0 }, 'ERP', 'cm:s'));
  });

  it('binds a connector to the ends it is given', () => {
    expect(
      dddConnectorElement({ id: 'a' }, { id: 'b' }, { role: 'es:flow' })
    ).toMatchObject({
      type: 'connector',
      role: 'es:flow',
      source: { id: 'a' },
      target: { id: 'b' },
    });
  });
});
