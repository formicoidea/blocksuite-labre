import type { SerializedElementProps } from '@labre/affine-block-surface/interchange';
import { ConnectorMode, FontWeight } from '@labre/affine-model/headless';
import { Bound } from '@labre/global/gfx';
import { describe, expect, it } from 'vitest';

import { WARDLEY_BACKGROUND } from '../background';
import { wardleyCommandsManifest } from '../commands-manifest';
import { importWardleyOwm } from '../import';
import { INERTIA_SIZE, PORTER_DEFAULT_LETTER } from '../node/consts';
import {
  wardleyCanonicalBox,
  WARDLEY_EDGE_STYLE,
  wardleyHandleBox,
  wardleyHandleProps,
  wardleyInertiaProps,
  wardleyLabelBoxFor,
  wardleyLabelProps,
  wardleyMarketDotBoxes,
  wardleyMarketDotProps,
  wardleyMarketLinkProps,
  WARDLEY_NODE_LABEL,
  WARDLEY_NODE_SIZE,
  wardleyNodeProps,
  wardleyPorterArrowProps,
  wardleyPorterArrows,
  wardleyPorterLetterProps,
} from '../presets';
import { WARDLEY_ROLE } from '../roles';
import {
  WARDLEY_TOOLBOX,
  wardleyAreaElement,
  wardleyChangeArrowElement,
  wardleyDependencyElement,
  wardleyInertiaElement,
  wardleyMapElement,
  wardleyMarketElements,
  wardleyNodeElements,
  wardleyPipelineElements,
  wardleyPorterElements,
} from '../toolbox';

/**
 * Wardley's toolbar as pure builders (`docs/adr/0045`). What it would have
 * caught: an artefact built for a host that differs from the toolbar's (a
 * node without the preset's props, a name without `wardley:label`, a group
 * that is not last or misses a member, a market whose triangle names no dot,
 * a pipeline whose groups are not nested), a link drawn in another style than
 * its tool's, a toolbar item a host cannot name the way the toolbar does, and
 * a builder that drifts from what the OWM reader writes for the same artefact.
 */

const without = (
  element: SerializedElementProps | undefined,
  ...keys: string[]
) => {
  const copy: Record<string, unknown> = { ...element };
  for (const key of keys) delete copy[key];
  return copy;
};

const centre = (xywh: unknown) => {
  const b = Bound.deserialize(xywh as string);
  return { cx: b.x + b.w / 2, cy: b.y + b.h / 2 };
};

describe('wardley toolbox', () => {
  it('builds a component as the toolbar does: node, name, group last', () => {
    const elements = wardleyNodeElements(
      'component',
      { x: 91, y: 41 },
      'Kettle',
      'k'
    );
    const [node, label, group] = elements;
    expect(elements).toHaveLength(3);
    expect(node).toEqual({
      ...wardleyNodeProps('component', {
        xywh: wardleyCanonicalBox('component', 100, 50),
      }),
      id: 'k:node',
    });
    const box = wardleyLabelBoxFor('component', 100, 50);
    expect(label).toEqual({
      ...wardleyLabelProps('Kettle', box.x, box.y, box.textAlign),
      id: 'k:label',
    });
    expect(label?.role).toBe(WARDLEY_ROLE.label);
    expect(group).toEqual({
      type: 'group',
      id: 'k:group',
      children: { 'k:node': true, 'k:label': true },
    });
  });

  it('seeds an unnamed node with the English prompt, a climate arrow in SemiBold', () => {
    for (const kind of ['method', 'ecosystem', 'anchor'] as const) {
      const [node, label] = wardleyNodeElements(kind, { x: 0, y: 0 });
      expect(node?.role).toBe(WARDLEY_ROLE[kind]);
      expect(label?.text).toBe(WARDLEY_NODE_LABEL[kind]);
      expect(label?.fontWeight).toBe(FontWeight.Regular);
    }
    const [arrow, words] = wardleyNodeElements('decelerator', { x: 0, y: 0 });
    expect(arrow?.shapeType).toBe('polygon');
    expect(words).toMatchObject({
      text: WARDLEY_NODE_LABEL.decelerator,
      fontWeight: FontWeight.SemiBold,
      textAlign: 'right',
    });
  });

  it('builds a market: circle, three dots, the triangle between them, name, group', () => {
    const elements = wardleyMarketElements({ x: 85, y: 35 }, 'Shops', 'm');
    const group = elements.at(-1);
    const members = elements.slice(0, -1);
    expect(members.map(e => e.id)).toEqual([
      'm:node',
      'm:dot-1',
      'm:dot-2',
      'm:dot-3',
      'm:link-1',
      'm:link-2',
      'm:link-3',
      'm:label',
    ]);
    expect(without(members[0], 'id')).toEqual(
      wardleyNodeProps('market', {
        xywh: wardleyCanonicalBox('market', 100, 50),
      })
    );
    wardleyMarketDotBoxes(100, 50).forEach((xywh, index) => {
      expect(without(members[1 + index], 'id')).toEqual(
        wardleyMarketDotProps({ xywh })
      );
    });
    expect(without(members[4], 'id')).toEqual(
      wardleyMarketLinkProps('m:dot-1', 'm:dot-2')
    );
    expect(without(members[6], 'id')).toEqual(
      wardleyMarketLinkProps('m:dot-3', 'm:dot-1')
    );
    expect(members[7]?.text).toBe('Shops');
    expect(group).toEqual({
      type: 'group',
      id: 'm:group',
      children: Object.fromEntries(members.map(m => [m.id, true])),
    });
  });

  it('builds a pipeline with its handle and two nested groups, the outer last', () => {
    const { w, h } = WARDLEY_NODE_SIZE.pipeline;
    const elements = wardleyPipelineElements({ x: 0, y: 0 }, 'Kettles', 'p');
    const [body, handle, label, inner, outer] = elements;
    expect(elements).toHaveLength(5);
    expect(without(body, 'id')).toEqual(
      wardleyNodeProps('pipeline', {
        xywh: wardleyCanonicalBox('pipeline', w / 2, h / 2),
      })
    );
    expect(without(handle, 'id')).toEqual(
      wardleyHandleProps({ xywh: wardleyHandleBox(w / 2, h / 2) })
    );
    expect(label).toMatchObject({ text: 'Kettles', textAlign: 'center' });
    expect(inner?.children).toEqual({ 'p:handle': true, 'p:label': true });
    expect(outer).toEqual({
      type: 'group',
      id: 'p:group',
      children: { 'p:node': true, 'p:handle-group': true },
    });
  });

  it("builds Porter's forces: a lettered circle and four arrows, grouped", () => {
    const elements = wardleyPorterElements({ x: 70, y: 20 }, undefined, 'f');
    const [circle, ...rest] = elements;
    expect(without(circle, 'id')).toEqual({
      ...wardleyNodeProps('porter', {
        xywh: wardleyCanonicalBox('porter', 100, 50),
      }),
      ...wardleyPorterLetterProps(PORTER_DEFAULT_LETTER),
    });
    const arrows = rest.slice(0, -1);
    expect(arrows.map(a => without(a, 'id'))).toEqual(
      wardleyPorterArrows(100, 50).map(wardleyPorterArrowProps)
    );
    expect(Object.keys(rest.at(-1)?.children as object)).toHaveLength(5);
    expect(wardleyPorterElements({ x: 0, y: 0 }, 'E')[0]?.text).toBe('E');
  });

  it('builds the single artefacts: inertia, area, the four maps', () => {
    expect(wardleyInertiaElement({ x: 1, y: 2 })).toEqual({
      ...wardleyInertiaProps({
        xywh: `[1,2,${INERTIA_SIZE.w},${INERTIA_SIZE.h}]`,
      }),
      id: 'inertia',
    });
    expect(wardleyAreaElement({ x: 0, y: 0 })).toMatchObject({
      type: 'wardleyNode',
      kind: 'area',
      role: WARDLEY_ROLE.area,
      shapeType: 'rect',
      xywh: '[0,0,240,160]',
    });
    expect(wardleyAreaElement({ x: 0, y: 0 })).not.toHaveProperty('text');
    expect(wardleyAreaElement({ x: 0, y: 0 }, 'Build').text).toBe('Build');

    const { width, height } = WARDLEY_BACKGROUND.geometry;
    expect(wardleyMapElement('classic', { x: 0, y: 0 })).toEqual({
      type: 'wardley',
      id: 'map',
      role: 'wardley:map',
      resizeEnabled: false,
      variant: 'classic',
      xywh: `[0,0,${width},${height}]`,
    });
    expect(wardleyMapElement('opportunity', { x: 0, y: 0 })).toMatchObject({
      variant: 'opportunity',
      yAxisTitle: 'Opportunity',
      showVisibilityLabels: false,
      showCornerLabels: false,
    });
    expect(
      wardleyMapElement('benefit', { x: 0, y: 0 }, { benefit: 'Bénéfice' })
    ).toMatchObject({
      yAxisTitle: '',
      visibilityHigh: 'Bénéfice',
      visibilityLow: 'Investment',
    });
  });

  it('draws the two links in their tool style', () => {
    expect(wardleyDependencyElement('a', 'b')).toEqual({
      type: 'connector',
      mode: ConnectorMode.Straight,
      role: WARDLEY_ROLE.dependency,
      ...WARDLEY_EDGE_STYLE.link,
      source: { id: 'a' },
      target: { id: 'b' },
    });
    expect(wardleyChangeArrowElement('a', 'b', 'evolves')).toMatchObject({
      role: WARDLEY_ROLE.changeArrow,
      ...WARDLEY_EDGE_STYLE.arrow,
      text: 'evolves',
    });
  });

  it('lists every toolbar artefact, named by its toolbar command', () => {
    // The toolbar's own order (`wardleyCommandsManifest`). The polygon area
    // is a drawing tool and is not here.
    expect(WARDLEY_TOOLBOX.items.map(i => i.id)).toEqual([
      'map',
      'opportunity-map',
      'benefit-map',
      'evolution-map',
      'component',
      'method',
      'market',
      'ecosystem',
      'anchor',
      'pipeline',
      'inertia',
      'porter',
      'accelerator',
      'decelerator',
      'area',
    ]);
    expect(WARDLEY_TOOLBOX.links.map(l => l.id)).toEqual([
      'dependency',
      'change-arrow',
    ]);
    const labels = new Set(wardleyCommandsManifest.map(r => r.labelKey));
    for (const item of [...WARDLEY_TOOLBOX.items, ...WARDLEY_TOOLBOX.links]) {
      expect(labels.has(item.labelKey), item.id).toBe(true);
    }
  });

  it('builds every item with unique local ids, each group after its members', () => {
    for (const item of WARDLEY_TOOLBOX.items) {
      const elements = item.build({ x: 0, y: 0 }, {}, 'x');
      const ids = elements.map(e => e.id);
      expect(new Set(ids).size, item.id).toBe(ids.length);
      const seen = new Set<unknown>();
      for (const element of elements) {
        for (const child of Object.keys(
          (element.children as object | undefined) ?? {}
        )) {
          expect(seen.has(child), `${item.id} ${child}`).toBe(true);
        }
        seen.add(element.id);
      }
      if (elements.length > 1) {
        // The last group holds, directly or through a nested group, every
        // element before it.
        const held = new Set<unknown>();
        const hold = (id: unknown) => {
          held.add(id);
          const element = elements.find(e => e.id === id);
          Object.keys((element?.children as object | undefined) ?? {}).forEach(
            hold
          );
        };
        hold(elements.at(-1)?.id);
        expect(held.size, item.id).toBe(elements.length);
        expect(elements.at(-1)?.type).toBe('group');
      }
    }
  });
});

/**
 * The OWM reader and the toolbar write the same artefact. The reader lays a
 * whole file out with geometry of its own (a 200-wide label box, a 24-unit
 * anchor, a pipeline as long as its span, no group), so the comparison is on
 * every prop that is NOT geometry: kind, role, shape, fill, rim, words, weight.
 */
describe('wardley toolbox and the OWM reader', () => {
  const { elements } = importWardleyOwm(`title Parity
anchor User [0.95, 0.20]
component Kettle [0.60, 0.40]
market Suppliers [0.30, 0.70]
ecosystem Partners [0.25, 0.55]
accelerator Faster [0.30, 0.50]
deaccelerator Slower [0.20, 0.50]
pipeline Kettle [0.30, 0.70]
evolve Kettle -> Electric kettle 0.75
User->Kettle
`);
  const owmId = (element: SerializedElementProps) =>
    (element.interchange as { owm?: { id?: string } } | undefined)?.owm?.id;
  const read = (id: string) => {
    const found = elements.find(e => owmId(e) === id);
    if (!found) throw new Error(`no ${id}`);
    return found;
  };
  const nameOf = (text: string) =>
    elements.find(e => e.role === WARDLEY_ROLE.label && e.text === text);

  it('writes the same map', () => {
    expect(without(elements[0], 'interchange', 'xywh')).toEqual(
      without(wardleyMapElement('classic', { x: 0, y: 0 }), 'id', 'xywh')
    );
  });

  it.each([
    ['component', 'Kettle'],
    ['anchor', 'User'],
    ['ecosystem', 'Partners'],
    ['accelerator', 'Faster'],
    ['decelerator', 'Slower'],
  ] as const)('writes the same %s and the same name', (kind, name) => {
    const owm = read(name);
    const { cx, cy } = centre(owm.xywh);
    const { w, h } = WARDLEY_NODE_SIZE[kind];
    const [node, label] = wardleyNodeElements(
      kind,
      { x: cx - w / 2, y: cy - h / 2 },
      name
    );
    expect(without(owm, 'interchange', 'xywh')).toEqual(
      without(node, 'id', 'xywh')
    );
    expect(without(nameOf(name), 'xywh')).toEqual(without(label, 'id', 'xywh'));
  });

  it('writes the same market, dots and triangle', () => {
    const owm = read('Suppliers');
    const { cx, cy } = centre(owm.xywh);
    const built = wardleyMarketElements(
      { x: cx - 15, y: cy - 15 },
      'Suppliers'
    );
    const index = elements.indexOf(owm);
    const owmParts = elements.slice(index, index + 8);
    const strip = (e: SerializedElementProps | undefined) =>
      without(e, 'id', 'interchange', 'xywh', 'source', 'target');
    expect(owmParts.map(strip)).toEqual(built.slice(0, 8).map(strip));
  });

  it('writes the same pipeline body and handle', () => {
    const [body, handle] = wardleyPipelineElements({ x: 0, y: 0 });
    const owmBody = elements.find(e => e.kind === 'pipeline');
    const owmHandle = elements.find(e => e.kind === 'handle');
    expect(without(owmBody, 'interchange', 'xywh')).toEqual(
      without(body, 'id', 'xywh')
    );
    expect(without(owmHandle, 'interchange', 'xywh')).toEqual(
      without(handle, 'id', 'xywh')
    );
  });

  it('writes its links with the toolbox links', () => {
    const dependency = elements.find(e => e.role === WARDLEY_ROLE.dependency);
    const arrow = elements.find(e => e.role === WARDLEY_ROLE.changeArrow);
    expect(dependency).toEqual(wardleyDependencyElement('User', 'Kettle'));
    expect(arrow).toEqual(
      wardleyChangeArrowElement('Kettle', (arrow?.target as { id: string }).id)
    );
  });
});
