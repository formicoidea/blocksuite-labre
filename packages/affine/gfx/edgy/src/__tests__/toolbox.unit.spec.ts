import { describe, expect, it } from 'vitest';

import { edgyCommandsManifest } from '../commands-manifest';
import { CROP_LABELED } from '../facets-crop';
import { LABEL_GAP, NODE_LABEL, NODE_SIZE, NODE_STROKE } from '../node/consts';
import {
  EDGY_BOARD_SIZE,
  EDGY_LABEL_W,
  edgyLabelProps,
  edgyNodeProps,
  edgyNodeTextProps,
  FACETS_SCALE,
  RELATION_STROKE_WIDTH,
} from '../presets';
import { EDGY_ROLE } from '../roles';
import {
  EDGY_PEOPLE_SIZE,
  EDGY_TOOLBOX,
  edgyBoardElement,
  edgyBoxElement,
  edgyFacetsElement,
  edgyPeopleElements,
  edgyRelationElement,
} from '../toolbox';

/**
 * EDGY's toolbar as pure builders (`docs/adr/0045`). What it would have
 * caught: an element built for a host that differs from the toolbar's (a box
 * without the preset's props or its name, People ungrouped from its name or
 * with the group not last, a facets background with no role or its names left
 * to the model's defaults), a relation drawn in another style than the tool's,
 * and a toolbar item a host cannot name the way the toolbar does.
 */
describe('edgy toolbox', () => {
  it('builds a box as the toolbar does: the preset node carrying its name', () => {
    const { w, h } = NODE_SIZE.activity;
    expect(edgyBoxElement('activity', { x: 10, y: 20 }, 'Livrer', 'a')).toEqual(
      {
        ...edgyNodeProps('activity', { xywh: `[10,20,${w},${h}]` }),
        ...edgyNodeTextProps('Livrer'),
        id: 'a',
      }
    );
    expect(edgyBoxElement('outcome', { x: 0, y: 0 })).toMatchObject({
      role: EDGY_ROLE.outcome,
      text: NODE_LABEL.outcome,
      id: 'outcome',
    });
  });

  it('builds People as the toolbar does: glyph, name under it, group last', () => {
    const [node, label, group] = edgyPeopleElements(
      { x: 0, y: 0 },
      'Clients',
      'p'
    );
    const { w, h } = NODE_SIZE.people;
    const left = (EDGY_PEOPLE_SIZE.w - w) / 2;
    expect(node).toEqual({
      ...edgyNodeProps('people', { xywh: `[${left},0,${w},${h}]` }),
      id: 'p:node',
    });
    expect(label).toEqual({
      ...edgyLabelProps(
        'Clients',
        (EDGY_PEOPLE_SIZE.w - EDGY_LABEL_W) / 2,
        h + LABEL_GAP
      ),
      id: 'p:label',
    });
    expect(group).toEqual({
      type: 'group',
      id: 'p:group',
      children: { 'p:node': true, 'p:label': true },
    });
    // The glyph is centred over its name, as `createEdgyPeople` placed it.
    expect(left + w / 2).toBe(EDGY_PEOPLE_SIZE.w / 2);
  });

  it('writes the facets names and role, and the board at its default size', () => {
    expect(
      edgyFacetsElement({ x: 0, y: 0 }, { identity: 'Identité' })
    ).toMatchObject({
      type: 'edgy',
      role: EDGY_ROLE.facets,
      cropToCircles: true,
      identityLabel: 'Identité',
      architectureLabel: 'Architecture',
      experienceLabel: 'Experience',
      xywh: `[0,0,${CROP_LABELED.w * FACETS_SCALE},${CROP_LABELED.h * FACETS_SCALE}]`,
    });
    expect(edgyBoardElement({ x: 5, y: 5 })).toEqual({
      type: 'edgyBoard',
      id: 'board',
      role: EDGY_ROLE.board,
      xywh: `[5,5,${EDGY_BOARD_SIZE.w},${EDGY_BOARD_SIZE.h}]`,
    });
  });

  it('draws a relation as the tool: generic role, the stencil ink, no head', () => {
    expect(edgyRelationElement('a', 'b', 'expresses')).toMatchObject({
      type: 'connector',
      role: EDGY_ROLE.relation,
      stroke: NODE_STROKE,
      strokeWidth: RELATION_STROKE_WIDTH,
      source: { id: 'a' },
      target: { id: 'b' },
      text: 'expresses',
    });
    expect(edgyRelationElement('a', 'b')).not.toHaveProperty('text');
  });

  it('lists every toolbar artefact, named by its toolbar command', () => {
    // The toolbar's own order (`edgyCommandsManifest`). "EDGY dynamic" is a
    // template insertion, not elements a builder returns.
    expect(EDGY_TOOLBOX.items.map(i => i.id)).toEqual([
      'facets',
      'board',
      'people',
      'outcome',
      'object',
      'activity',
    ]);
    expect(EDGY_TOOLBOX.links.map(l => l.id)).toEqual(['relation']);
    const labels = new Set(edgyCommandsManifest.map(r => r.labelKey));
    for (const item of [...EDGY_TOOLBOX.items, ...EDGY_TOOLBOX.links]) {
      expect(labels.has(item.labelKey), item.id).toBe(true);
    }
    // Every item builds, and a composite holds every member it built.
    for (const item of EDGY_TOOLBOX.items) {
      const elements = item.build({ x: 0, y: 0 });
      const last = elements.at(-1);
      if (last?.type !== 'group') continue;
      expect(Object.keys(last.children as object)).toEqual(
        elements.slice(0, -1).map(e => e.id)
      );
    }
  });
});
