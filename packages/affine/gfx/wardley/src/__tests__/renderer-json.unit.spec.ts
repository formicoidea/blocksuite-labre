import type { SerializedElementProps } from '@labre/affine-block-surface/interchange';
import { Bound } from '@labre/global/gfx';
import { describe, expect, it } from 'vitest';

import { owmDefaultPlot } from '../export';
import { WARDLEY_INTERCHANGE } from '../interchange';
import {
  WARDLEY_JSON_EXPORT,
  WARDLEY_JSON_FORMAT,
  WARDLEY_JSON_IMPORT,
} from '../interchange-headless';
import { INERTIA_SIZE } from '../node/consts';
import { WARDLEY_NODE_SIZE } from '../presets';
import {
  jsonDecoratorCentre,
  rendererPointOf,
  round3,
  WARDLEY_JSON_FORMAT_ID,
} from '../renderer-json';
import { exportWardleyRendererJson } from '../renderer-json-export';
import {
  importWardleyRendererJson,
  WARDLEY_JSON_IMPORT_REMARKS,
} from '../renderer-json-import';
import { WARDLEY_ROLE } from '../roles';
import {
  WARDLEY_TOOLBOX,
  wardleyChangeArrowElement,
  wardleyDependencyElement,
  wardleyMapElement,
  wardleyMarketElements,
  wardleyNodeElements,
  wardleyPipelineElements,
} from '../toolbox';
import EPARGNE from './corpus/renderer-json/epargne-salariale.json?raw';
import PIPELINE from './corpus/renderer-json/wardleyapi-pipeline.json?raw';

/**
 * The wardley-map-renderer JSON, both ways (ADR 0012, amendment of
 * 2026-10-28).
 *
 * What it would have caught: a map read from JSON made of anything but the
 * toolbar's own artefacts (the OWM reader's wider labels, larger anchor, no
 * group); a second component drawn at the target of an evolution, which the
 * OWM path did and the connector's bench caught; a pipeline whose body is
 * centred instead of spanning its geometry; the renderer's visibility read
 * the OWM way up; a field of the file dropped on the way back
 * (`export(import(x))` is the file); a bad document thrown from inside the
 * reader instead of reported.
 */

type Props = SerializedElementProps & Record<string, unknown>;
type Json = Record<string, any>;

/** The renderer README's quick start, verbatim. */
const QUICK_START = {
  title: 'Tea shop',
  components: [
    {
      id: 'customer',
      label: { name: 'Customer' },
      type: 'anchor',
      position: { evolution: { scalar: 0.5 }, visibility: { scalar: 0.05 } },
    },
    {
      id: 'cup-of-tea',
      label: { name: 'Cup of tea' },
      type: 'component',
      position: { evolution: { scalar: 0.85 }, visibility: { scalar: 0.25 } },
    },
  ],
  relations: [{ id: 'r1', consumer: 'customer', supplier: 'cup-of-tea' }],
};

const read = (map: unknown) =>
  importWardleyRendererJson(
    typeof map === 'string' ? map : JSON.stringify(map)
  );

/**
 * What `materializeInterchangeImport` does, on plain props: a surface id per
 * element, a local name or a source id resolved to it (the source id first,
 * as there), a group's children and a connector's ends rewritten. The writer
 * reads stored fields only, so it is handed these props as a host's store
 * would hold them.
 */
function materialize(elements: readonly SerializedElementProps[]): Props[] {
  const bySource = new Map<string, string>();
  const byLocal = new Map<string, string>();
  const surface = elements.map((props, index) => {
    const id = `s${index + 1}`;
    const source = (props.interchange as Json | undefined)?.[
      WARDLEY_JSON_FORMAT_ID
    ]?.id as string | undefined;
    if (source !== undefined && !bySource.has(source)) bySource.set(source, id);
    if (typeof props.id === 'string' && !byLocal.has(props.id)) {
      byLocal.set(props.id, id);
    }
    return { ...props, id } as Props;
  });
  const resolve = (name: string) => bySource.get(name) ?? byLocal.get(name);
  for (const element of surface) {
    if (element.type === 'group') {
      element.children = Object.fromEntries(
        Object.keys(element.children as Json).map(child => [
          resolve(child) ?? child,
          true,
        ])
      );
    }
    for (const side of ['source', 'target'] as const) {
      const end = element[side] as { id?: string } | undefined;
      if (end?.id !== undefined) {
        element[side] = { ...end, id: resolve(end.id) ?? end.id };
      }
    }
  }
  return surface;
}

const roundTrip = (source: string) =>
  JSON.parse(
    exportWardleyRendererJson(
      materialize(importWardleyRendererJson(source).elements)
    ).text
  ) as Json;

/** An element without the keys a test does not compare. */
const without = (element: Json | undefined, ...keys: string[]) => {
  const copy: Json = { ...element };
  for (const key of keys) delete copy[key];
  return copy;
};

const plot = owmDefaultPlot();

/** Where the toolbar places an item of `kind` centred on a renderer position. */
function atOf(
  kind: keyof typeof WARDLEY_NODE_SIZE,
  evolution: number,
  visibility: number
) {
  const [cx, cy] = rendererPointOf(plot, evolution, visibility);
  const { w, h } = WARDLEY_NODE_SIZE[kind];
  return { x: cx - w / 2, y: cy - h / 2 };
}

const centre = (xywh: unknown) => {
  const b = Bound.deserialize(xywh as string);
  return { x: b.x + b.w / 2, y: b.y + b.h / 2 };
};

/** The kind a renderer component is drawn as. */
const kindOf = (c: Json) =>
  c.type === 'anchor'
    ? 'anchor'
    : c.type === 'pipeline'
      ? 'pipeline'
      : c.subtype === 'market' || c.subtype === 'ecosystem'
        ? c.subtype
        : c.method
          ? 'method'
          : 'component';

describe('the declaration', () => {
  it('is the triple, semantic, one format object for both directions', () => {
    expect(WARDLEY_JSON_IMPORT.id).toBe('wardley:json:import');
    expect(WARDLEY_JSON_EXPORT.id).toBe('wardley:json:export');
    expect(WARDLEY_JSON_IMPORT.format).toBe(WARDLEY_JSON_EXPORT.format);
    expect(WARDLEY_JSON_FORMAT).toEqual({
      id: 'json',
      tier: 'semantic',
      extensions: ['.json'],
      mime: 'application/json',
    });
    // The connector lists exporters by id from this list.
    expect(WARDLEY_INTERCHANGE).toContain(WARDLEY_JSON_EXPORT);
    expect(WARDLEY_INTERCHANGE).toContain(WARDLEY_JSON_IMPORT);
  });

  it('names the file after the board and runs on stored props', () => {
    const result = WARDLEY_JSON_EXPORT.run(
      materialize(read(QUICK_START).elements) as never,
      { name: 'Tea/shop' }
    );
    expect(result.filename).toBe('Tea-shop.json');
    expect(result.mime).toBe('application/json');
    // The file's own title wins over the page's name, and that is said.
    expect(JSON.parse(result.text).title).toBe('Tea shop');
    expect(result.warnings?.join('\n')).toContain('Tea shop');
  });
});

describe('the README quick start', () => {
  const { elements, report } = read(QUICK_START);

  it('lays the toolbar’s map down first', () => {
    expect(without(elements[0], 'interchange')).toEqual(
      wardleyMapElement('classic', { x: 0, y: 0 })
    );
  });

  it('draws each component with the toolbar’s own builder', () => {
    const customer = wardleyNodeElements(
      'anchor',
      atOf('anchor', 0.5, 0.05),
      'Customer',
      'customer'
    );
    const cup = wardleyNodeElements(
      'component',
      atOf('component', 0.85, 0.25),
      'Cup of tea',
      'cup-of-tea'
    );
    for (const expected of [...customer, ...cup]) {
      const actual = elements.find(e => e.id === expected.id);
      expect(without(actual, 'interchange')).toEqual(expected);
    }
    expect(elements.find(e => e.id === 'customer:node')?.interchange).toEqual({
      json: { id: 'customer' },
    });
  });

  it('reads visibility the renderer’s way up: 0 is the top', () => {
    const customer = centre(elements.find(e => e.id === 'customer:node')?.xywh);
    const cup = centre(elements.find(e => e.id === 'cup-of-tea:node')?.xywh);
    expect(customer.y).toBeLessThan(cup.y);
    // 0.05 is near the TOP of the plot, OWM's 0.95.
    expect(customer.y - plot.y0).toBeCloseTo(0.05 * plot.height, 6);
  });

  it('draws the relation as the Link tool does, consumer first', () => {
    const link = elements.find(e => e.role === WARDLEY_ROLE.dependency);
    expect(without(link, 'interchange')).toEqual(
      wardleyDependencyElement('customer:node', 'cup-of-tea:node')
    );
    expect(link?.interchange).toEqual({ json: { id: 'r1' } });
  });

  it('reports what it drew', () => {
    // The title, two components and one relation.
    expect(report).toMatchObject({ mapped: 4, carried: 0, quarantined: 0 });
    expect(report.notes).toEqual([]);
  });

  it('comes back as the same map, the default relation type written out', () => {
    expect(roundTrip(JSON.stringify(QUICK_START))).toEqual({
      ...QUICK_START,
      relations: [{ ...QUICK_START.relations[0], type: 'DependsOn' }],
    });
  });
});

describe('a rich map (épargne salariale, from the renderer’s data/)', () => {
  const source = JSON.parse(EPARGNE) as Json;
  const { elements, report } = read(EPARGNE);

  it('draws every component with the toolbar’s builder for its kind', () => {
    for (const c of source.components as Json[]) {
      const kind = kindOf(c);
      const at = atOf(
        kind,
        c.position.evolution.scalar,
        c.position.visibility.scalar
      );
      const expected =
        kind === 'market'
          ? wardleyMarketElements(at, c.label.name, c.id)
          : wardleyNodeElements(kind, at, c.label.name, c.id);
      for (const piece of expected) {
        const actual = elements.find(e => e.id === piece.id);
        expect(without(actual, 'interchange'), piece.id as string).toEqual(
          piece
        );
      }
      expect(
        (elements.find(e => e.id === `${c.id}:node`)?.interchange as Json).json
          .id
      ).toBe(c.id);
    }
  });

  it('draws an evolution as an arrow to a point, never a second component', () => {
    const nodes = elements.filter(
      e => e.type === 'wardleyNode' && e.role !== undefined
    );
    const climate = nodes.filter(
      e => e.kind === 'accelerator' || e.kind === 'decelerator'
    );
    // One node per component, plus the two climate arrows: no twin.
    expect(nodes.length - climate.length).toBe(source.components.length);

    const arrows = elements.filter(e => e.role === WARDLEY_ROLE.changeArrow);
    expect(arrows).toHaveLength(3);
    const simulateur = arrows.find(
      a => (a.source as Json).id === 'simulateur:node'
    );
    const [tx, ty] = rendererPointOf(plot, 0.66, 0.34);
    expect(simulateur).toEqual({
      ...wardleyChangeArrowElement('simulateur:node', 'simulateur:node'),
      target: { position: [tx, ty] },
      interchange: {
        json: { attrs: { '@self': { rest: '{"evolveType":"natural"}' } } },
      },
    });
  });

  it('puts an evolution’s inertia on its arrow, a decorator in its slot', () => {
    const bar = elements.find(
      e => e.id === 'fiscalite-social:evolve-1:inertia'
    );
    const from = rendererPointOf(plot, 0.37, 0.48);
    const to = rendererPointOf(plot, 0.58, 0.48);
    expect(centre(bar?.xywh)).toEqual({
      x: (from[0] + to[0]) / 2,
      y: (from[1] + to[1]) / 2,
    });
    expect(bar?.role).toBe(WARDLEY_ROLE.inertia);
    expect(Bound.deserialize(bar?.xywh as string).w).toBe(INERTIA_SIZE.w);

    const [cx, cy] = rendererPointOf(plot, 0.63, 0.22);
    const slot = jsonDecoratorCentre('component', 'accelerator', cx, cy);
    const size = WARDLEY_NODE_SIZE.accelerator;
    expect(
      elements.filter(e =>
        e.id?.toString().startsWith('portail-salarie:accelerator')
      )
    ).toEqual(
      wardleyNodeElements(
        'accelerator',
        { x: slot.cx - size.w / 2, y: slot.cy - size.h / 2 },
        undefined,
        'portail-salarie:accelerator'
      )
    );
    expect(
      elements.some(e => e.id === 'connecteur-paie:decelerator:node')
    ).toBe(true);
  });

  it('carries what the board does not draw, by name', () => {
    const carried = report.notes
      .filter(note => note.kind === 'carried')
      .map(note => note.element);
    expect(carried).toEqual(
      expect.arrayContaining([
        'label.position',
        'nature',
        'step',
        'subtype',
        'method',
        'renderConfig',
        'evolvesTo.evolveType',
        'relation.type',
        'relation.flow',
      ])
    );
    expect(report.notes.every(n => n.messageKey !== undefined)).toBe(true);
    expect(report.quarantined).toBe(0);
  });

  it('comes back whole: export(import(x)) is x', () => {
    expect(roundTrip(EPARGNE)).toEqual(source);
  });
});

describe('a pipeline (the renderer’s own API map, from data/)', () => {
  const source = JSON.parse(PIPELINE) as Json;
  const { elements } = read(PIPELINE);
  const pipeline = (source.components as Json[]).find(
    c => c.type === 'pipeline'
  )!;
  const g = pipeline.pipelineGeometry;

  it('spans its geometry, its handle and name where the toolbar puts them', () => {
    const [left, top] = rendererPointOf(plot, g.evoStart, g.visStart);
    const [right, bottom] = rendererPointOf(plot, g.evoEnd, g.visEnd);
    const [hx] = rendererPointOf(plot, (g.evoStart + g.evoEnd) / 2, 0);
    const built = wardleyPipelineElements(
      { x: hx - WARDLEY_NODE_SIZE.pipeline.w / 2, y: top },
      pipeline.label.name,
      pipeline.id
    );
    for (const piece of built) {
      const actual = elements.find(e => e.id === piece.id);
      expect(without(actual, 'interchange', 'xywh')).toEqual(
        without(piece, 'xywh')
      );
      if (piece.id !== `${pipeline.id}:node`) {
        expect(actual?.xywh).toEqual(piece.xywh);
      }
    }
    const body = elements.find(e => e.id === `${pipeline.id}:node`);
    expect(Bound.deserialize(body?.xywh as string).toXYWH()).toEqual([
      left,
      top,
      right - left,
      bottom - top,
    ]);
    // The name is drawn once, above the handle.
    expect(
      elements.filter(e => e.type === 'text' && e.text === pipeline.label.name)
    ).toHaveLength(1);
  });

  it('comes back whole but for the pipeline’s own position and place', () => {
    const back = roundTrip(PIPELINE);
    const byId = (a: Json, b: Json) => String(a.id).localeCompare(String(b.id));
    const expected = (source.components as Json[]).map(c =>
      c.id === pipeline.id
        ? {
            ...c,
            // The renderer does not draw it; the body's centre comes back.
            position: {
              evolution: { scalar: round3((g.evoStart + g.evoEnd) / 2) },
              visibility: { scalar: round3((g.visStart + g.visEnd) / 2) },
            },
          }
        : c
    );
    // A body is laid under the components it holds, so pipelines come back
    // first; nothing in the format reads the order.
    expect(back.components[0].id).toBe(pipeline.id);
    expect({ ...back, components: [...back.components].sort(byId) }).toEqual({
      ...source,
      components: expected.sort(byId),
    });
  });
});

describe('colours and a component’s own decorators', () => {
  const map = {
    title: 'Decorated',
    components: [
      {
        id: 'k',
        label: { name: 'Kettle' },
        type: 'component',
        position: { evolution: { scalar: 0.4 }, visibility: { scalar: 0.3 } },
        color: 'red-600',
        inertia: true,
        accelerator: true,
        deaccelerator: true,
      },
      {
        id: 't',
        label: { name: 'Tea' },
        type: 'component',
        position: { evolution: { scalar: 0.7 }, visibility: { scalar: 0.6 } },
        color: 'teal-500',
      },
    ],
    relations: [],
  };
  const { elements, report } = read(map);

  it('paints a colour the renderer can name, and carries one it cannot', () => {
    expect(elements.find(e => e.id === 'k:node')?.strokeColor).toBe('#dc2626');
    expect(elements.find(e => e.id === 't:node')?.strokeColor).toBe(
      wardleyNodeElements('component', { x: 0, y: 0 })[0].strokeColor
    );
    expect(report.notes.map(n => n.element)).toContain('color');
  });

  it('draws the inertia bar and both climate arrows from the toolbar', () => {
    expect(elements.find(e => e.id === 'k:inertia')?.role).toBe(
      WARDLEY_ROLE.inertia
    );
    expect(elements.find(e => e.id === 'k:accelerator:node')?.kind).toBe(
      'accelerator'
    );
    expect(elements.find(e => e.id === 'k:decelerator:node')?.kind).toBe(
      'decelerator'
    );
  });

  it('comes back whole', () => {
    expect(roundTrip(JSON.stringify(map))).toEqual(map);
  });

  it('writes a stroke somebody changed as its hex', () => {
    const board = materialize(elements).map(e =>
      (e.interchange as Json | undefined)?.json?.id === 't'
        ? { ...e, strokeColor: '#123456' }
        : e
    );
    const back = JSON.parse(exportWardleyRendererJson(board).text) as Json;
    expect(back.components[1].color).toBe('#123456');
  });
});

describe('a bad document is a report, never a throw', () => {
  const key = (r: ReturnType<typeof read>) =>
    r.report.notes.map(note => note.messageKey);

  it('refuses text that is not JSON', () => {
    const result = read('{ not json');
    expect(result.elements).toEqual([]);
    expect(key(result)).toEqual([WARDLEY_JSON_IMPORT_REMARKS.notJson[0]]);
  });

  it('refuses JSON that is not a map', () => {
    for (const text of ['[1, 2]', '{"title": "x"}', 'null', '42']) {
      const result = read(text);
      expect(result.elements).toEqual([]);
      expect(key(result)).toEqual([WARDLEY_JSON_IMPORT_REMARKS.notAMap[0]]);
    }
  });

  it('keeps an undrawable component and a dangling relation, and says so', () => {
    const broken = { id: 'ghost', label: { name: 'Ghost' }, type: 'component' };
    const dangling = { id: 'r9', consumer: 'customer', supplier: 'nobody' };
    const map = {
      ...QUICK_START,
      components: [...QUICK_START.components, broken],
      relations: [...QUICK_START.relations, dangling],
    };
    const result = read(map);
    expect(key(result)).toEqual(
      expect.arrayContaining([
        WARDLEY_JSON_IMPORT_REMARKS.invalidComponent[0],
        WARDLEY_JSON_IMPORT_REMARKS.undeclaredEnd[0],
      ])
    );
    expect(result.report.carried).toBe(2);
    // Not drawn, and written back as they were.
    expect(result.elements.some(e => e.id === 'ghost:node')).toBe(false);
    const back = roundTrip(JSON.stringify(map));
    expect(back.components).toContainEqual(broken);
    expect(back.relations).toContainEqual(dangling);
  });
});

describe('a board drawn from the toolbar', () => {
  const item = (id: string) => WARDLEY_TOOLBOX.items.find(i => i.id === id)!;
  const [kx, ky] = rendererPointOf(plot, 0.3, 0.4);
  const size = WARDLEY_NODE_SIZE.component;
  const slot = jsonDecoratorCentre('component', 'accelerator', kx, ky);
  const acc = WARDLEY_NODE_SIZE.accelerator;
  const [tx, ty] = rendererPointOf(plot, 0.6, 0.7);
  const board = materialize([
    ...item('map').build({ x: 0, y: 0 }, {}, 'map'),
    ...item('component').build(
      { x: kx - size.w / 2, y: ky - size.h / 2 },
      { name: 'Kettle' },
      'kettle'
    ),
    ...item('component').build(
      atOf('component', 0.6, 0.7),
      { name: 'Tea' },
      'tea'
    ),
    ...item('accelerator').build(
      { x: slot.cx - acc.w / 2, y: slot.cy - acc.h / 2 },
      { name: 'Faster' },
      'faster'
    ),
    wardleyDependencyElement('kettle:node', 'tea:node', 'water'),
    {
      ...wardleyChangeArrowElement('kettle:node', 'kettle:node'),
      target: { position: [tx, ty] },
    },
  ]);

  it('writes ids, names, positions, the link, the arrow and the decorator', () => {
    const { text, warnings } = exportWardleyRendererJson(board, {
      name: 'Kitchen',
    });
    const map = JSON.parse(text) as Json;
    const kettle = board.find(e => e.id === 's2')!;
    expect(kettle.kind).toBe('component');
    expect(map).toEqual({
      title: 'Kitchen',
      components: [
        {
          id: 's2',
          label: { name: 'Kettle' },
          type: 'component',
          position: { evolution: { scalar: 0.3 }, visibility: { scalar: 0.4 } },
          evolvesTo: [
            {
              position: {
                evolution: { scalar: 0.6 },
                visibility: { scalar: 0.7 },
              },
            },
          ],
          accelerator: true,
        },
        {
          id: 's5',
          label: { name: 'Tea' },
          type: 'component',
          position: { evolution: { scalar: 0.6 }, visibility: { scalar: 0.7 } },
        },
      ],
      relations: [
        {
          id: 's11',
          consumer: 's2',
          supplier: 's5',
          type: 'DependsOn',
          flow: { label: 'water' },
        },
      ],
    });
    expect(warnings).toEqual([]);
  });
});
