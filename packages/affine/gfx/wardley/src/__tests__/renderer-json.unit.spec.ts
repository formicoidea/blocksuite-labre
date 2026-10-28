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
import { wardleyMethodOf } from '../method';
import {
  WARDLEY_METHOD,
  WARDLEY_METHOD_TAG_ID,
  WARDLEY_NATURE_TAG_ID,
} from '../natures';
import { INERTIA_SIZE, LINK_GREY, LINK_STROKE_WIDTH } from '../node/consts';
import { WARDLEY_NODE_SIZE } from '../presets';
import {
  CONSTRAINT_COLOUR,
  FLOW_COLOUR,
  jsonDecoratorCentre,
  jsonLabelBox,
  jsonLabelOffset,
  PHASE_LINES,
  RELATION_WIDTH,
  relationLook,
  relationOf,
  rendererCanvasOf,
  rendererPointOf,
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
 * 2026-10-28, and the PO's mapping of the same day).
 *
 * What it would have caught: a map read from JSON made of anything but the
 * toolbar's own artefacts; a second component drawn at an evolution's
 * target (the OWM path's, caught by the connector's bench); a pipeline whose
 * body does not span its geometry; the renderer's visibility read the OWM way
 * up; ANY foreign id or field stored on an element (nothing is carried); a
 * displayed field that does not come back (name offset, nature, method,
 * description, step, range, decorators, evolution type and inertia, relation
 * type and flow, title, context, the map's labels); a writer whose output
 * moves when read and written again; a bad document thrown instead of
 * reported.
 */

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
 * element, a local name resolved to it, a group's children and a connector's
 * ends rewritten. The writer reads stored fields only, so it is handed these
 * props as a host's store would hold them.
 */
function materialize(elements: readonly SerializedElementProps[]): Json[] {
  const byLocal = new Map<string, string>();
  const surface = elements.map((props, index) => {
    const id = `s${index + 1}`;
    if (typeof props.id === 'string' && !byLocal.has(props.id)) {
      byLocal.set(props.id, id);
    }
    return { ...props, id } as Json;
  });
  const resolve = (name: string) => byLocal.get(name) ?? name;
  for (const element of surface) {
    if (element.type === 'group') {
      element.children = Object.fromEntries(
        Object.keys(element.children).map(child => [resolve(child), true])
      );
    }
    for (const side of ['source', 'target'] as const) {
      const end = element[side];
      if (end?.id !== undefined)
        element[side] = { ...end, id: resolve(end.id) };
    }
  }
  return surface;
}

const write = (elements: readonly Json[], name?: string) =>
  exportWardleyRendererJson(elements, name === undefined ? {} : { name });

const cycle = (source: string) =>
  write(materialize(importWardleyRendererJson(source).elements));

const plot = owmDefaultPlot();

/** An offset on the épargne map's 1800 × 1000 canvas, on the default one. */
const onDefaultCanvas = (offset: { dx: number; dy: number }) => {
  const round2 = (value: number) => Math.round(value * 100) / 100;
  return {
    dx: round2(((offset.dx - 9) * (1600 - 48)) / (1800 - 48) + 9),
    dy: round2(((offset.dy - 4) * (800 - 56)) / (1000 - 56) + 4),
  };
};

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

const byId = (elements: readonly SerializedElementProps[], id: string) =>
  elements.find(e => e.id === id);

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

  it('names the file after the page, and the title after the text above the map', () => {
    const result = WARDLEY_JSON_EXPORT.run(
      materialize(read(QUICK_START).elements) as never,
      { name: 'Tea/shop' }
    );
    expect(result.filename).toBe('Tea-shop.json');
    expect(result.mime).toBe('application/json');
    expect(JSON.parse(result.text).title).toBe('Tea shop');
    // No title text: the page's name is the title.
    const untitled = read({ ...QUICK_START, title: '' }).elements;
    expect(JSON.parse(write(materialize(untitled), 'Kitchen').text).title).toBe(
      'Kitchen'
    );
  });
});

describe('nothing foreign is stored', () => {
  it('writes no interchange payload on any element', () => {
    for (const source of [JSON.stringify(QUICK_START), EPARGNE, PIPELINE]) {
      const { elements, report } = read(source);
      expect(elements.filter(e => 'interchange' in e)).toEqual([]);
      expect(report.carried).toBe(0);
    }
  });
});

describe('the README quick start', () => {
  const { elements, report } = read(QUICK_START);

  it('lays the toolbar’s map down first, the title above it', () => {
    expect(elements[0]).toEqual(wardleyMapElement('classic', { x: 0, y: 0 }));
    const title = byId(elements, 'title');
    expect(title?.text).toBe('Tea shop');
    expect(title?.role).toBeUndefined();
    expect(Bound.deserialize(title?.xywh as string).maxY).toBeLessThan(0);
  });

  it('draws each component exactly as the toolbar does', () => {
    const expected = [
      ...wardleyNodeElements(
        'anchor',
        atOf('anchor', 0.5, 0.05),
        'Customer',
        'customer'
      ),
      ...wardleyNodeElements(
        'component',
        atOf('component', 0.85, 0.25),
        'Cup of tea',
        'cup-of-tea'
      ),
    ];
    for (const piece of expected) {
      expect(byId(elements, piece.id as string)).toEqual(piece);
    }
  });

  it('reads visibility the renderer’s way up: 0 is the top', () => {
    const customer = centre(byId(elements, 'customer:node')?.xywh);
    const cup = centre(byId(elements, 'cup-of-tea:node')?.xywh);
    expect(customer.y).toBeLessThan(cup.y);
    expect(customer.y - plot.y0).toBeCloseTo(0.05 * plot.height, 6);
  });

  it('draws the relation as the Link tool does, consumer first', () => {
    const link = elements.find(e => e.role === WARDLEY_ROLE.dependency);
    expect(link).toEqual({
      ...wardleyDependencyElement('customer:node', 'cup-of-tea:node'),
      ...relationLook('DependsOn', undefined),
    });
    expect(link?.stroke).toBe(LINK_GREY);
    expect(link?.strokeWidth).toBe(LINK_STROKE_WIDTH);
  });

  it('reports what it drew', () => {
    expect(report).toMatchObject({ mapped: 4, carried: 0, quarantined: 0 });
    expect(report.notes).toEqual([]);
  });

  it('comes back as the same map, ids minted from the names', () => {
    expect(JSON.parse(cycle(JSON.stringify(QUICK_START)).text)).toEqual({
      ...QUICK_START,
      relations: [{ ...QUICK_START.relations[0], type: 'DependsOn' }],
    });
  });
});

describe('a rich map (épargne salariale, from the renderer’s data/)', () => {
  const source = JSON.parse(EPARGNE) as Json;
  const { elements, report } = read(EPARGNE);
  const component = (id: string) =>
    (source.components as Json[]).find(c => c.id === id)!;

  it('draws every node with the toolbar’s builder for its kind', () => {
    const without = (element: Json | undefined, ...keys: string[]) => {
      const copy: Json = { ...element };
      for (const key of keys) delete copy[key];
      return copy;
    };
    for (const c of source.components as Json[]) {
      const kind =
        c.type === 'anchor'
          ? 'anchor'
          : c.subtype === 'market'
            ? 'market'
            : c.method
              ? 'method'
              : 'component';
      const at = atOf(
        kind,
        c.position.evolution.scalar,
        c.position.visibility.scalar
      );
      const built =
        kind === 'market'
          ? wardleyMarketElements(at, c.label.name, c.id)
          : wardleyNodeElements(kind, at, c.label.name, c.id);
      for (const piece of built) {
        const actual = byId(elements, piece.id as string);
        // The node's parameters (nature, method colours), the name's offset
        // and the group's extra members are the file's; the rest is the
        // toolbar's, to the last prop.
        const own = [
          'tags',
          'fillColor',
          'strokeColor',
          'xywh',
          'textAlign',
          'children',
        ];
        expect(without(actual, ...own), String(piece.id)).toEqual(
          without(piece, ...own)
        );
      }
      expect(centre(byId(elements, `${c.id}:node`)?.xywh)).toEqual(
        centre(built[0]?.xywh)
      );
    }
  });

  it('sets the nature tag, and drops the natures Labre has no value for', () => {
    expect(byId(elements, 'portail-salarie:node')?.tags).toEqual({
      [WARDLEY_NATURE_TAG_ID]: [`${WARDLEY_NATURE_TAG_ID}/activity`],
    });
    // A method carries its nature too.
    expect(byId(elements, 'fiscalite-social:node')?.tags).toEqual({
      [WARDLEY_NATURE_TAG_ID]: [`${WARDLEY_NATURE_TAG_ID}/knowledge`],
    });
    // `generic` on an anchor, `natural` on a user need: no value here.
    expect(byId(elements, 'salarie:node')?.tags).toBeUndefined();
    expect(byId(elements, 'besoin-epargner:node')?.tags).toBeUndefined();
    expect(report.notes.find(n => n.element === 'nature')?.messageKey).toBe(
      WARDLEY_JSON_IMPORT_REMARKS.droppedField[0]
    );
  });

  it('leaves a method of a category the map made up untagged', () => {
    // `sourcing` is declared in this map's renderConfig; Labre has no custom
    // category, so the node is a method with no method tag (it paints as
    // Make), nothing of its look is written, and the report says the method
    // was dropped.
    const toolbar = wardleyNodeElements('method', { x: 0, y: 0 })[0]!;
    const node = byId(elements, 'tenue-compte:node');
    expect(node?.kind).toBe('method');
    expect((node?.tags as Json)[WARDLEY_METHOD_TAG_ID]).toBeUndefined();
    expect(node?.fillColor).toBe(toolbar.fillColor);
    expect(node?.strokeColor).toBe(toolbar.strokeColor);
    expect(report.notes.map(n => n.element)).toContain('method');
    expect(component('tenue-compte').method.category).toBe('sourcing');
  });

  it('replays the name’s offset on the canvas the map declares', () => {
    const c = component('salarie');
    const [cx, cy] = rendererPointOf(
      plot,
      c.position.evolution.scalar,
      c.position.visibility.scalar
    );
    // This map declares an 1800 × 1000 canvas.
    expect(rendererCanvasOf(source.renderConfig)).toEqual({ w: 1800, h: 1000 });
    const placed = jsonLabelBox(
      plot,
      WARDLEY_NODE_SIZE.anchor.w,
      cx,
      cy,
      c.label.position,
      { w: 1800, h: 1000 }
    );
    const box = Bound.deserialize(
      byId(elements, 'salarie:label')?.xywh as string
    );
    expect([box.x, box.y]).toEqual([placed.x, placed.y]);
  });

  it('draws an evolution as an arrow to a point labelled with its type', () => {
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
    const [tx, ty] = rendererPointOf(plot, 0.78, 0.5);
    expect(
      arrows.find(a => (a.source as Json).id === 'conformite:node')
    ).toEqual({
      ...wardleyChangeArrowElement(
        'conformite:node',
        'conformite:node',
        'forced'
      ),
      target: { position: [tx, ty] },
    });
  });

  it('puts an evolution’s inertia on each phase line it crosses', () => {
    // 0.37 → 0.58 crosses the line at 0.4.
    const bars = elements.filter(e =>
      String(e.id).startsWith('fiscalite-social:evolve-1:inertia')
    );
    expect(bars).toHaveLength(1);
    const [x] = rendererPointOf(plot, PHASE_LINES[1]!, 0);
    const [, y] = rendererPointOf(plot, 0, 0.48);
    expect(centre(bars[0]?.xywh)).toEqual({ x, y });
    expect(bars[0]?.role).toBe(WARDLEY_ROLE.inertia);
    expect(Bound.deserialize(bars[0]?.xywh as string).w).toBe(INERTIA_SIZE.w);
  });

  it('puts a climate arrow where the renderer does: beside the node', () => {
    const [cx, cy] = rendererPointOf(plot, 0.63, 0.22);
    const slot = jsonDecoratorCentre('component', 'accelerator', cx, cy);
    expect(
      centre(byId(elements, 'portail-salarie:accelerator:node')?.xywh)
    ).toEqual({ x: slot.cx, y: slot.cy });
    const [dx] = rendererPointOf(plot, 0.5, 0.58);
    expect(
      centre(byId(elements, 'connecteur-paie:decelerator:node')?.xywh).x
    ).toBeLessThan(dx);
  });

  it('draws the step dot in the component’s group', () => {
    const dot = byId(elements, 'simulateur:step');
    expect(dot).toMatchObject({
      type: 'shape',
      shapeType: 'ellipse',
      text: '1',
    });
    expect(dot?.role).toBeUndefined();
    expect(
      Object.keys(byId(elements, 'simulateur:group')?.children as Json)
    ).toContain('simulateur:step');
  });

  it('draws Flow blue and thick, Constraint black and as thick', () => {
    const links = elements.filter(e => e.role === WARDLEY_ROLE.dependency);
    const flow = links.find(l => l.text === 'valeurs liquidatives');
    expect(flow).toMatchObject({
      stroke: FLOW_COLOUR,
      strokeWidth: RELATION_WIDTH,
      strokeStyle: 'dash',
    });
    const constraint = links.find(
      l =>
        (l.source as Json).id === 'conformite:node' &&
        l.stroke === CONSTRAINT_COLOUR
    );
    expect(constraint?.strokeWidth).toBe(RELATION_WIDTH);
    expect(RELATION_WIDTH).toBeGreaterThan(LINK_STROKE_WIDTH);
  });

  it('applies the map’s own labels and drops the rest of renderConfig', () => {
    expect(elements[0]).toMatchObject({
      xAxisTitle: 'Évolution',
      yAxisTitle: 'Chaîne de valeur',
      phase0: 'Genèse',
    });
    expect(report.notes.map(n => n.element)).toContain('renderConfig');
  });

  it('gives back every field the canvas shows', () => {
    const back = JSON.parse(cycle(EPARGNE).text) as Json;
    const slugOf = new Map(
      (source.components as Json[]).map(c => [
        c.id,
        c.label.name
          .normalize('NFD')
          .replace(/[̀-ͯ]/g, '')
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/^-+|-+$/g, ''),
      ])
    );
    expect(back.components).toHaveLength(source.components.length);
    for (const c of source.components as Json[]) {
      const out = (back.components as Json[]).find(
        o => o.id === slugOf.get(c.id)
      )!;
      expect(out, c.id).toBeDefined();
      // An offset comes back in the pixels of the renderer's default canvas,
      // which is the one the written file is drawn on: same place on the plot.
      expect(out.label).toEqual(
        c.label.position
          ? { ...c.label, position: onDefaultCanvas(c.label.position) }
          : c.label
      );
      expect(out.position).toEqual(c.position);
      expect(out.type).toBe(c.type);
      if (['activity', 'data', 'practice', 'knowledge'].includes(c.nature)) {
        expect(out.nature).toBe(c.nature);
        expect(out.subtype).toBe('functional');
      } else expect(out.nature).toBeUndefined();
      expect(out.step).toEqual(c.step);
      expect(out.accelerator).toEqual(c.accelerator);
      expect(out.deaccelerator).toEqual(c.deaccelerator);
      expect(out.evolvesTo).toEqual(c.evolvesTo);
      // A category the map declared comes back under the default category of
      // its colour, until the method node has real parameters.
      expect(Boolean(out.method)).toBe(Boolean(c.method));
    }
    const pairs = (rels: Json[], map: (id: string) => string | undefined) =>
      rels.map(r => [map(r.consumer), map(r.supplier), r.type, r.flow]);
    expect(pairs(back.relations, id => id)).toEqual(
      pairs(source.relations, id => slugOf.get(id))
    );
    expect(back.relations.map((r: Json) => r.id)).toEqual(
      source.relations.map((_: Json, i: number) => `r${i + 1}`)
    );
    expect(back.renderConfig).toEqual({
      style: {
        background: {
          axisEvolution: { default: { label: { text: 'Évolution' } } },
          axisValueChain: { default: { label: { text: 'Chaîne de valeur' } } },
          phases: source.renderConfig.style.background.phases,
        },
      },
    });
  });

  it('is a fixed point after one cycle', () => {
    const once = cycle(EPARGNE).text;
    expect(cycle(once).text).toBe(once);
  });
});

describe('a pipeline (the renderer’s own API map, from data/)', () => {
  const source = JSON.parse(PIPELINE) as Json;
  const { elements, report } = read(PIPELINE);
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
      const actual = byId(elements, piece.id as string);
      if (piece.type === 'group') continue;
      if (piece.id === `${pipeline.id}:node`) {
        expect(Bound.deserialize(actual?.xywh as string).toXYWH()).toEqual([
          left,
          top,
          right - left,
          bottom - top,
        ]);
        expect({ ...actual, xywh: piece.xywh }).toEqual(piece);
      } else expect(actual).toEqual(piece);
    }
    // A pipeline has no method item: its method is dropped.
    expect(report.notes.map(n => n.element)).toContain('pipeline method');
  });

  it('writes a description as a free text in the component’s group', () => {
    const description = byId(elements, `${pipeline.id}:description`);
    expect(description).toMatchObject({
      type: 'text',
      text: pipeline.description,
    });
    expect(description?.role).toBeUndefined();
    expect(
      Object.keys(byId(elements, `${pipeline.id}:group`)?.children as Json)
    ).toContain(`${pipeline.id}:description`);
  });

  it('draws the context under the map', () => {
    const context = byId(elements, 'context');
    expect(context?.text).toBe(source.context);
    expect(Bound.deserialize(context?.xywh as string).y).toBeGreaterThan(
      Bound.deserialize(elements[0]?.xywh as string).maxY
    );
  });

  it('gives back its geometry, descriptions and context, and holds still', () => {
    const once = cycle(PIPELINE).text;
    const back = JSON.parse(once) as Json;
    const out = (back.components as Json[]).find(c => c.type === 'pipeline')!;
    expect(out.pipelineGeometry).toEqual(g);
    expect(out.description).toBe(pipeline.description);
    expect(back.context).toBe(source.context);
    const described = (source.components as Json[]).filter(c => c.description);
    expect((back.components as Json[]).filter(c => c.description)).toHaveLength(
      described.length
    );
    // Its component methods use the renderer's own categories: each
    // comes back through the method tag as the file wrote it.
    const methods = (list: Json[]) =>
      list
        .filter(c => c.type === 'component' && c.method)
        .map(c => [c.label.name, c.method])
        .sort((a, b) => String(a[0]).localeCompare(String(b[0])));
    expect(methods(back.components).length).toBeGreaterThan(0);
    expect(methods(back.components)).toEqual(methods(source.components));
    expect(cycle(once).text).toBe(once);
  });
});

describe('the shared look tables invert', () => {
  it('reads a relation’s type and style back from its colour and width', () => {
    for (const type of ['DependsOn', 'Flow', 'Constraint'] as const) {
      for (const style of [undefined, 'dashed', 'bold'] as const) {
        expect(relationOf(relationLook(type, style))).toEqual(
          style === undefined ? { type } : { type, style }
        );
      }
    }
  });

  it('puts a name at an offset and reads the offset back', () => {
    for (const offset of [
      { dx: 9, dy: 4 },
      { dx: 30, dy: -12 },
      { dx: -15, dy: 8 },
      { dx: 0, dy: -20 },
    ]) {
      const placed = jsonLabelBox(plot, 18, 400, 300, offset);
      expect(
        jsonLabelOffset(
          plot,
          18,
          400,
          300,
          { x: placed.x, y: placed.y, w: 120, h: 26 },
          placed.textAlign
        )
      ).toEqual(offset);
    }
  });
});

describe('a method is the method node’s tag (ADR 0046)', () => {
  const PAIRS = [
    ['buying-policy', 'Uncharted', WARDLEY_METHOD.make],
    ['buying-policy', 'Transitional', WARDLEY_METHOD.buy],
    ['buying-policy', 'Industrialized', WARDLEY_METHOD.outsource],
    ['project-management', 'Uncharted', WARDLEY_METHOD.agile],
    ['project-management', 'Transitional', WARDLEY_METHOD.lean],
    ['project-management', 'Industrialized', WARDLEY_METHOD.sixSigma],
    ['attitudes', 'Uncharted', WARDLEY_METHOD.pioneers],
    ['attitudes', 'Transitional', WARDLEY_METHOD.settlers],
    ['attitudes', 'Industrialized', WARDLEY_METHOD.townPlanners],
  ] as const;
  const mapWith = (method: unknown, nature?: string) => ({
    title: 'Methods',
    components: [
      {
        id: 'm',
        label: { name: 'Billing' },
        type: 'component',
        ...(nature ? { subtype: 'functional', nature } : {}),
        position: { evolution: { scalar: 0.5 }, visibility: { scalar: 0.5 } },
        method,
      },
    ],
    relations: [],
  });
  const toolbar = wardleyNodeElements('method', { x: 0, y: 0 })[0]!;

  it('round-trips each of the nine through the tag, writing no colour', () => {
    for (const [category, recommendation, value] of PAIRS) {
      const map = mapWith({ category, recommendation }, 'activity');
      const node = byId(read(map).elements, 'm:node');
      expect(wardleyMethodOf(category, recommendation)).toBe(value);
      expect(node?.tags).toEqual({
        [WARDLEY_NATURE_TAG_ID]: [`${WARDLEY_NATURE_TAG_ID}/activity`],
        [WARDLEY_METHOD_TAG_ID]: [value],
      });
      // The ring is derived from the tag when painted: nothing written.
      expect(node?.fillColor).toBe(toolbar.fillColor);
      expect(node?.strokeColor).toBe(toolbar.strokeColor);
      const back = JSON.parse(cycle(JSON.stringify(map)).text) as Json;
      expect(back.components[0].method).toEqual({ category, recommendation });
      expect(back.components[0].nature).toBe('activity');
    }
  });

  it('leaves an unknown pair untagged and writes it back as buying-policy', () => {
    for (const method of [
      { category: 'sourcing', recommendation: 'Acheter' },
      { category: 'buying-policy', recommendation: 'Someday' },
    ]) {
      const map = mapWith(method);
      const { elements, report } = read(map);
      const node = byId(elements, 'm:node');
      expect(node?.kind).toBe('method');
      expect(node?.tags).toBeUndefined();
      expect(report.notes.map(n => n.element)).toContain('method');
      const back = JSON.parse(cycle(JSON.stringify(map)).text) as Json;
      expect(back.components[0].method).toEqual({
        category: 'buying-policy',
        recommendation: '',
      });
    }
  });
});

describe('a name offset is measured on the canvas the map declares', () => {
  const mapOn = (canvas: { width: number; height: number } | undefined) => ({
    title: 'Offsets',
    components: [
      {
        id: 'right',
        label: { name: 'Right', position: { dx: 40, dy: -20 } },
        type: 'component',
        position: { evolution: { scalar: 0.3 }, visibility: { scalar: 0.4 } },
      },
      {
        id: 'left',
        label: { name: 'Left', position: { dx: -40, dy: 16 } },
        type: 'component',
        position: { evolution: { scalar: 0.7 }, visibility: { scalar: 0.6 } },
      },
    ],
    relations: [],
    ...(canvas
      ? {
          renderConfig: {
            style: { background: { canvas: { default: canvas } } },
          },
        }
      : {}),
  });
  const labelOf = (map: unknown, id: string) =>
    Bound.deserialize(
      read(map).elements.find(e => e.id === `${id}:label`)?.xywh as string
    );

  it('places the same offset differently on two canvases, as the renderer does', () => {
    for (const [id, evolution, visibility, offset] of [
      ['right', 0.3, 0.4, { dx: 40, dy: -20 }],
      ['left', 0.7, 0.6, { dx: -40, dy: 16 }],
    ] as const) {
      const [cx, cy] = rendererPointOf(plot, evolution, visibility);
      for (const canvas of [
        { w: 1600, h: 800 },
        { w: 3200, h: 1600 },
      ]) {
        const declared =
          canvas.w === 1600 ? undefined : { width: canvas.w, height: canvas.h };
        const placed = jsonLabelBox(plot, 18, cx, cy, offset, canvas);
        const box = labelOf(mapOn(declared), id);
        expect([box.x, box.y], `${id} on ${canvas.w}`).toEqual([
          placed.x,
          placed.y,
        ]);
      }
      // Twice the canvas, the same pixels are half as far on the plot.
      const small = labelOf(mapOn(undefined), id);
      const large = labelOf(mapOn({ width: 3200, height: 1600 }), id);
      expect(small.y).not.toBe(large.y);
    }
  });

  it('reads the canvas the renderer reads: view, then canvas, then default', () => {
    expect(rendererCanvasOf(undefined)).toEqual({ w: 1600, h: 800 });
    expect(
      rendererCanvasOf({
        style: {
          background: {
            canvas: { default: { width: 1800 }, override: { height: 900 } },
          },
        },
      })
    ).toEqual({ w: 1800, h: 900 });
    expect(
      rendererCanvasOf({
        style: {
          view: { default: { width: 1200 } },
          background: { canvas: { default: { width: 1800, height: 1000 } } },
        },
      })
    ).toEqual({ w: 1200, h: 1000 });
  });

  it('writes the offset back on the default canvas', () => {
    const back = JSON.parse(
      cycle(JSON.stringify(mapOn({ width: 3200, height: 1600 }))).text
    ) as Json;
    const right = (back.components as Json[]).find(c => c.id === 'right')!;
    // (40 − 9) px on a 3152-wide plot is (40 − 9) × 1552 / 3152 on 1552.
    expect(right.label.position.dx).toBeCloseTo(
      ((40 - 9) * 1552) / 3152 + 9,
      1
    );
  });
});

describe('an evolution that crosses no phase line', () => {
  it('still gets its inertia bar, at its middle', () => {
    const map = {
      title: 'Short move',
      components: [
        {
          id: 'k',
          label: { name: 'Kettle' },
          type: 'component',
          position: {
            evolution: { scalar: 0.45 },
            visibility: { scalar: 0.3 },
          },
          evolvesTo: [
            {
              position: {
                evolution: { scalar: 0.6 },
                visibility: { scalar: 0.3 },
              },
              inertia: true,
            },
          ],
          inertia: true,
        },
      ],
      relations: [],
    };
    const { elements, report } = read(map);
    const bars = elements.filter(e => e.role === WARDLEY_ROLE.inertia);
    expect(bars).toHaveLength(1);
    const [x1, y] = rendererPointOf(plot, 0.45, 0.3);
    const [x2] = rendererPointOf(plot, 0.6, 0.3);
    expect(centre(bars[0]?.xywh)).toEqual({ x: (x1 + x2) / 2, y });
    // A component's own `inertia` is dropped (formicoidea/wardley-map-renderer#5).
    expect(report.notes.map(n => n.element)).toContain('inertia');
    expect(JSON.parse(cycle(JSON.stringify(map)).text).components[0]).toEqual({
      ...map.components[0],
      id: 'kettle',
      inertia: undefined,
    });
  });
});

describe('a bad document is a report, never a throw', () => {
  const keys = (r: ReturnType<typeof read>) =>
    r.report.notes.map(note => note.messageKey);

  it('refuses text that is not JSON', () => {
    const result = read('{ not json');
    expect(result.elements).toEqual([]);
    expect(keys(result)).toEqual([WARDLEY_JSON_IMPORT_REMARKS.notJson[0]]);
  });

  it('refuses JSON that is not a map', () => {
    for (const text of ['[1, 2]', '{"title": "x"}', 'null', '42']) {
      const result = read(text);
      expect(result.elements).toEqual([]);
      expect(keys(result)).toEqual([WARDLEY_JSON_IMPORT_REMARKS.notAMap[0]]);
    }
  });

  it('drops an undrawable component and a dangling relation, and says so', () => {
    const map = {
      ...QUICK_START,
      components: [
        ...QUICK_START.components,
        { id: 'ghost', label: { name: 'Ghost' }, type: 'component' },
      ],
      relations: [
        ...QUICK_START.relations,
        { id: 'r9', consumer: 'customer', supplier: 'nobody' },
      ],
      extra: 1,
    };
    const result = read(map);
    expect(keys(result)).toEqual(
      expect.arrayContaining([
        WARDLEY_JSON_IMPORT_REMARKS.invalidComponent[0],
        WARDLEY_JSON_IMPORT_REMARKS.undeclaredEnd[0],
        WARDLEY_JSON_IMPORT_REMARKS.droppedField[0],
      ])
    );
    const back = JSON.parse(cycle(JSON.stringify(map)).text) as Json;
    expect(back.components).toHaveLength(2);
    expect(back.relations).toHaveLength(1);
    expect(back.extra).toBeUndefined();
  });
});

describe('a board drawn from the toolbar', () => {
  const item = (id: string) => WARDLEY_TOOLBOX.items.find(i => i.id === id)!;
  const [tx, ty] = rendererPointOf(plot, 0.6, 0.7);
  const props = [
    ...item('map').build({ x: 0, y: 0 }, {}, 'map'),
    ...item('component').build(
      atOf('component', 0.3, 0.4),
      { name: 'Paiement' },
      'a'
    ),
    ...item('component').build(
      atOf('component', 0.6, 0.7),
      { name: 'Paiement' },
      'b'
    ),
    {
      ...wardleyDependencyElement('a:node', 'b:node', 'argent'),
      ...relationLook('Flow', undefined),
    },
    {
      ...wardleyChangeArrowElement('a:node', 'a:node', 'late'),
      target: { position: [tx, ty] },
    },
  ];

  it('mints ids from the names and reads the link’s type off its look', () => {
    const board = materialize(props);
    // The user drags the second name above its node: an offset to write.
    const label = board.find(e => e.text === 'Paiement' && e.id === 's6')!;
    const box = Bound.deserialize(label.xywh);
    label.xywh = `[${box.x},${box.y - 40},${box.w},${box.h}]`;
    const { text, warnings } = write(board, 'Kitchen');
    const map = JSON.parse(text) as Json;
    expect(map.components.map((c: Json) => c.id)).toEqual([
      'paiement',
      'paiement-2',
    ]);
    expect(map.components[0].evolvesTo).toEqual([
      {
        position: { evolution: { scalar: 0.6 }, visibility: { scalar: 0.7 } },
        evolveType: 'late',
      },
    ]);
    expect(map.components[1].label.position.dy).toBeLessThan(0);
    expect(map.relations).toEqual([
      {
        id: 'r1',
        consumer: 'paiement',
        supplier: 'paiement-2',
        type: 'Flow',
        flow: { label: 'argent' },
      },
    ]);
    expect(map.title).toBe('Kitchen');
    expect(warnings).toEqual([]);
  });

  it('warns about a free text on the map that belongs to no component', () => {
    const board = materialize([
      ...props,
      {
        type: 'text',
        id: 'stray',
        text: 'remember the milk',
        xywh: '[700,400,200,20]',
      },
    ]);
    const { warnings } = write(board);
    expect(warnings.join('\n')).toContain('belong to no component');
  });
});
