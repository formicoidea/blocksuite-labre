import type {
  InterchangeImportResult,
  SerializedElementProps,
} from '@labre/affine-block-surface';
import {
  importInterchangeFile,
  sanitizeSvg,
  SvgSketchNotebook,
} from '@labre/affine-block-surface';
import { ConnectorElementModel } from '@labre/affine-model';
import { NotificationProvider } from '@labre/affine-shared/services';
import { Bound } from '@labre/global/gfx';
import type { BlockStdScope } from '@labre/std';
import { describe, expect, it, vi } from 'vitest';

import { owmCoordsOf, owmDefaultPlot } from '../export';
import { importWardleyOwm } from '../import';
import { WARDLEY_SVG_IMPORT } from '../interchange';
import { WARDLEY_ROLE } from '../roles';
import { importWardleySvg } from '../svg-import';
import { HEURISTIC_OWM, SVG_CORPUS } from './svg-corpus';

/**
 * The Wardley SVG import against real producers' files (ADR 0032 §9).
 *
 * Browser mode, because the reader sanitises with DOMPurify and DOMPurify
 * supports a real DOM only. The corpus is described file by file in
 * `svg-corpus.ts`.
 *
 * The property every certain producer is held to: **the SVG of a map imports
 * to the same map as its OWM text** — the same roles, the same names, the same
 * links, and every `[visibility, evolution]` within {@link TOLERANCE}. That is
 * the test that keeps "recognised" from drifting into "looks about right".
 */

/**
 * ADR 0032 open point 5, settled here: `0.005`, half the last digit the OWM
 * DSL writes (`owmNumber`, two decimals). A position within it EXPORTS to the
 * very number the source `.owm` holds, so "the same map" means the same file
 * on the way out — a property a reader of the DSL can check, rather than a
 * distance somebody liked. The ADR's proposed `0.01` would let a component
 * come back one hundredth off and still pass. Measured on this corpus, the
 * OnlineWardleyMaps files land within 1e-12 of their text: the producer draws
 * `[v, e]` to the pixel and the plot is read off `#fillArea` exactly, so the
 * margin is for producers that round, not for this one.
 */
const TOLERANCE = 0.005;

type Props = SerializedElementProps;

const NODE_ROLES = new Set<string>([
  WARDLEY_ROLE.component,
  WARDLEY_ROLE.anchor,
  WARDLEY_ROLE.market,
  WARDLEY_ROLE.ecosystem,
  WARDLEY_ROLE.accelerator,
  WARDLEY_ROLE.decelerator,
]);

const centreOf = (props: Props) => {
  const [x, y, w, h] = JSON.parse(props.xywh as string) as number[];
  return owmCoordsOf(owmDefaultPlot(), x + w / 2, y + h / 2);
};

/** The identity a connector end names: the OWM reader's payload, or the SVG reader's provisional id. */
const identityOf = (props: Props): string | undefined =>
  (props.interchange as { owm?: { id?: string } } | undefined)?.owm?.id ??
  (typeof props.id === 'string' ? props.id : undefined);

interface MapSummary {
  nodes: {
    role: string;
    name: string;
    visibility: number;
    evolution: number;
  }[];
  links: string[];
  evolutions: string[];
  pipelines: { name: string; from: number; to: number }[];
  notes: { text: string; visibility: number; evolution: number }[];
  inertias: { visibility: number; evolution: number }[];
}

/** A result as the map it draws: what a reader of the map would compare. */
function summarise(elements: readonly Props[]): MapSummary {
  const names = new Map<string, string>();
  const nodes: MapSummary['nodes'] = [];
  elements.forEach((props, index) => {
    const role = props.role as string | undefined;
    if (props.type !== 'wardleyNode' || role === undefined) return;
    if (!NODE_ROLES.has(role)) return;
    let name = '';
    for (const next of elements.slice(index + 1)) {
      if (next.type === 'wardleyNode' && next.role !== undefined) break;
      if (next.role === WARDLEY_ROLE.label) {
        name = next.text as string;
        break;
      }
    }
    const id = identityOf(props);
    if (id !== undefined && !names.has(id)) names.set(id, name);
    nodes.push({ role, name, ...centreOf(props) });
  });
  const nameOf = (end: unknown) =>
    names.get((end as { id: string }).id) ?? `?${(end as { id: string }).id}`;
  const links = elements
    .filter(props => props.role === WARDLEY_ROLE.dependency)
    .map(props => `${nameOf(props.source)} -> ${nameOf(props.target)}`)
    .sort();
  const evolutions = elements
    .filter(props => props.role === WARDLEY_ROLE.changeArrow)
    .map(props => `${nameOf(props.source)} -> ${nameOf(props.target)}`)
    .sort();
  // A pipeline's name is the label laid after its body and its handle.
  const pipelines = elements
    .map((props, index) => ({ props, index }))
    .filter(({ props }) => props.role === WARDLEY_ROLE.pipeline)
    .map(({ props, index }) => {
      const [x, y, w] = JSON.parse(props.xywh as string) as number[];
      const plot = owmDefaultPlot();
      const label = elements
        .slice(index + 1)
        .find(next => next.role === WARDLEY_ROLE.label);
      return {
        name: (label?.text as string | undefined) ?? '',
        from: owmCoordsOf(plot, x, y).evolution,
        to: owmCoordsOf(plot, x + w, y).evolution,
      };
    });
  // A note the layout drew names its font; a text the sketch read does not,
  // and the title is the one drawn at 28.
  const notes = elements
    .filter(props => props.type === 'text' && props.role === undefined)
    .filter(props => props.fontFamily !== undefined && props.fontSize !== 28)
    .map(props => ({ text: props.text as string, ...centreOf(props) }));
  const inertias = elements
    .filter(props => props.role === WARDLEY_ROLE.inertia)
    .map(centreOf);
  const byName = <T extends { name?: string; text?: string }>(a: T, b: T) =>
    (a.name ?? a.text ?? '').localeCompare(b.name ?? b.text ?? '');
  return {
    nodes: nodes.sort(
      (a, b) =>
        a.role.localeCompare(b.role) ||
        byName(a, b) ||
        a.evolution - b.evolution
    ),
    links,
    evolutions,
    pipelines: pipelines.sort(byName),
    notes: notes.sort(byName),
    inertias,
  };
}

/** Two summaries are the same map: equal words, positions within tolerance. */
function expectSameMap(actual: MapSummary, expected: MapSummary) {
  const words = (summary: MapSummary) => ({
    nodes: summary.nodes.map(({ role, name }) => [role, name]),
    links: summary.links,
    evolutions: summary.evolutions,
    pipelines: summary.pipelines.map(({ name }) => name),
    notes: summary.notes.map(({ text }) => text),
  });
  expect(words(actual)).toEqual(words(expected));
  const close = (a: number, b: number, what: string) =>
    expect(Math.abs(a - b), `${what}: ${a} vs ${b}`).toBeLessThanOrEqual(
      TOLERANCE
    );
  actual.nodes.forEach((node, index) => {
    const reference = expected.nodes[index];
    close(node.visibility, reference.visibility, `${node.name} visibility`);
    close(node.evolution, reference.evolution, `${node.name} evolution`);
  });
  actual.pipelines.forEach((pipeline, index) => {
    close(
      pipeline.from,
      expected.pipelines[index].from,
      `${pipeline.name} from`
    );
    close(pipeline.to, expected.pipelines[index].to, `${pipeline.name} to`);
  });
  actual.notes.forEach((note, index) => {
    const reference = expected.notes[index];
    close(note.visibility, reference.visibility, `${note.text} visibility`);
    close(note.evolution, reference.evolution, `${note.text} evolution`);
  });
}

const hasInterchange = (value: unknown): boolean => {
  if (Array.isArray(value)) return value.some(hasInterchange);
  if (value && typeof value === 'object') {
    return Object.entries(value as Record<string, unknown>).some(
      ([key, nested]) => key === 'interchange' || hasInterchange(nested)
    );
  }
  return false;
};

const read = (source: string): InterchangeImportResult =>
  importWardleySvg(source, { name: 'map.svg' });

const nativeOf = (result: InterchangeImportResult) =>
  result.elements.filter(
    props => props.role !== undefined || props.type === 'wardley'
  );

/* ── OnlineWardleyMaps ────────────────────────────────────────────────── */

describe('an OnlineWardleyMaps export', () => {
  it('imports to the same map as its OWM text — the small map', () => {
    const result = read(SVG_CORPUS.smallOwm);
    expect(result.report.sourceVersion).toBe('OnlineWardleyMaps SVG');
    expectSameMap(
      summarise(result.elements),
      summarise(importWardleyOwm(SVG_CORPUS.smallOwmText).elements)
    );
  });

  it('imports to the same map as its OWM text — the tea shop', async () => {
    const { TEA_SHOP_OWM } = await import('./owm-corpus');
    expectSameMap(
      summarise(read(SVG_CORPUS.teaShopOwm).elements),
      summarise(importWardleyOwm(TEA_SHOP_OWM).elements)
    );
  });

  it('imports to the same map as its OWM text — every kind it draws', () => {
    // Accelerators are drawn with no name by this producer, so the two
    // summaries differ there and only there: compared by role and place.
    //
    // OnlineWardleyMaps draws `component X (market)` AS a market, and so does
    // this reader; Labre's DSL reader keeps the decorator in the line's tail
    // and draws a component (the interoperable spelling, `import.ts`). The
    // reference is therefore spelled with the keyword Labre's reader draws.
    const reference = SVG_CORPUS.fullOwmText.replace(
      /^component (\w+) (\[[^\]]+\]) \((market|ecosystem)\)$/gm,
      '$3 $1 $2'
    );
    const svg = summarise(read(SVG_CORPUS.fullOwm).elements);
    const text = summarise(importWardleyOwm(reference).elements);
    const climate = (summary: MapSummary) =>
      summary.nodes.filter(
        node =>
          node.role === WARDLEY_ROLE.accelerator ||
          node.role === WARDLEY_ROLE.decelerator
      );
    expect(climate(svg).map(node => [node.role, node.name])).toEqual([
      [WARDLEY_ROLE.accelerator, ''],
      [WARDLEY_ROLE.decelerator, ''],
    ]);
    climate(svg).forEach((node, index) => {
      const reference = climate(text)[index];
      expect(node.role).toBe(reference.role);
      expect(
        Math.abs(node.evolution - reference.evolution)
      ).toBeLessThanOrEqual(TOLERANCE);
      expect(
        Math.abs(node.visibility - reference.visibility)
      ).toBeLessThanOrEqual(TOLERANCE);
    });
    const rest = (summary: MapSummary) => ({
      ...summary,
      nodes: summary.nodes.filter(node => !climate(summary).includes(node)),
    });
    expectSameMap(rest(svg), rest(text));
  });

  it('counts every artefact by its role', () => {
    const roles = nativeOf(read(SVG_CORPUS.fullOwm)).reduce<
      Record<string, number>
    >((count, props) => {
      const key = (props.role as string) ?? 'map';
      count[key] = (count[key] ?? 0) + 1;
      return count;
    }, {});
    expect(roles).toMatchObject({
      'wardley:map': 1,
      // 7 components and 2 evolved twins; a market's three dots carry no role.
      'wardley:component': 9,
      'wardley:anchor': 2,
      'wardley:market': 1,
      'wardley:ecosystem': 1,
      'wardley:accelerator': 1,
      'wardley:decelerator': 1,
      'wardley:pipeline': 1,
      'wardley:handle': 1,
      'wardley:dependency': 10,
      'wardley:change-arrow': 2,
      'wardley:inertia': 1,
    });
  });

  it('draws the inertia bar the picture drew, where it drew it', () => {
    const { inertias } = summarise(read(SVG_CORPUS.smallOwm).elements);
    expect(inertias).toHaveLength(1);
    // Astride the Kettle's line of the value chain, between it and its twin.
    expect(Math.abs(inertias[0].visibility - 0.43)).toBeLessThanOrEqual(
      TOLERANCE
    );
    expect(inertias[0].evolution).toBeGreaterThan(0.35);
    expect(inertias[0].evolution).toBeLessThan(0.62);
  });

  it('attaches every dependency to the nodes its id names', () => {
    const result = read(SVG_CORPUS.smallOwm);
    const ids = new Set(
      result.elements
        .map(props => props.id)
        .filter((id): id is string => typeof id === 'string')
    );
    const links = result.elements.filter(
      props => props.role === WARDLEY_ROLE.dependency
    );
    expect(links).toHaveLength(6);
    for (const link of links) {
      expect(ids.has((link.source as { id: string }).id)).toBe(true);
      expect(ids.has((link.target as { id: string }).id)).toBe(true);
    }
  });

  it('draws the title above the board, as a free text', () => {
    const titles = read(SVG_CORPUS.smallOwm).elements.filter(
      props => props.type === 'text' && props.fontSize === 28
    );
    expect(titles.map(props => props.text)).toEqual(['Tea delivery']);
  });

  it('sketches what has no native artefact, and says how much', () => {
    // Methods and annotations: OnlineWardleyMaps draws them, Labre has no
    // native artefact for either.
    const result = read(SVG_CORPUS.fullOwm);
    // The native map, then its title, then whatever the sketch read.
    const titleAt = result.elements.findIndex(props => props.fontSize === 28);
    const sketched = result.elements.slice(titleAt + 1);
    expect(sketched.length).toBeGreaterThan(0);
    for (const props of sketched) expect(props.role).toBeUndefined();
    const remark = result.report.notes.find(
      note =>
        note.messageKey ===
        'com.labre.wardley.import.svg.remark.sketched-remainder'
    );
    expect(remark?.kind).toBe('warning');
    expect(remark?.messageParams?.count).toBe(sketched.length);
  });

  it('sketches NOTHING of a plain export: every node is recognised or chrome', () => {
    const result = read(SVG_CORPUS.smallOwm);
    expect(
      result.report.notes.find(
        note =>
          note.messageKey ===
          'com.labre.wardley.import.svg.remark.sketched-remainder'
      )
    ).toBeUndefined();
  });
});

/* ── Labre's own export ───────────────────────────────────────────────── */

describe('Labre’s own board SVG', () => {
  it.each([
    ['the small map', SVG_CORPUS.smallLabre, SVG_CORPUS.smallOwmText],
    ['the tea shop', SVG_CORPUS.teaShopLabre, SVG_CORPUS.teaShopOwmText],
    ['every kind the pack draws', SVG_CORPUS.fullLabre, SVG_CORPUS.fullOwmText],
  ])('imports %s to the same map as its OWM text', (_name, svg, owm) => {
    const result = read(svg);
    expect(result.report.sourceVersion).toBe('Labre SVG 1');
    expectSameMap(
      summarise(result.elements),
      summarise(importWardleyOwm(owm).elements)
    );
  });

  it('draws back what the markers state, and sketches nothing of a plain export', () => {
    const result = read(SVG_CORPUS.fullLabre);
    // Not a sketched shape, and not even a remark about the clip paths the
    // export hoists to its root: a plain export reads back silent.
    expect(result.report.notes).toEqual([]);
  });

  /** A Labre-marked file, written by hand, with markers a hostile file forges. */
  const forged = (version: string, body: string) =>
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1600 900" data-labre-svg="${version}">
      <g data-labre-id="map" data-labre-type="wardley" data-labre-role="wardley:map" data-labre-xywh="[0,0,1600,900]"><rect width="1600" height="900" fill="#fff"/></g>
      ${body}
    </svg>`;

  it('refuses a role no Wardley table declares, and numbers that are not numbers', () => {
    const result = read(
      forged(
        '1',
        `<g data-labre-id="__proto__" data-labre-type="wardleyNode" data-labre-role="wardley:component" data-labre-xywh="[788,438,24,24]"><circle cx="800" cy="450" r="12"/></g>
         <g data-labre-id="evil" data-labre-type="wardleyNode" data-labre-role="wardley:root-kit" data-labre-xywh="[100,100,24,24]"><circle cx="112" cy="112" r="12"/></g>
         <g data-labre-id="nan" data-labre-type="wardleyNode" data-labre-role="wardley:component" data-labre-xywh="[NaN,1,2,3]"><circle cx="5" cy="5" r="2"/></g>
         <g data-labre-id="short" data-labre-type="wardleyNode" data-labre-role="wardley:component" data-labre-xywh="[1,2]"><circle cx="9" cy="9" r="2"/></g>
         <g data-labre-id="link" data-labre-type="connector" data-labre-role="wardley:dependency" data-labre-source="__proto__" data-labre-target="constructor" data-labre-xywh="[0,0,0,0]"><path d="M 0 0 L 9 9"/></g>`
      )
    );
    expect(result.report.sourceVersion).toBe('Labre SVG 1');
    // One native component — the forged id is a provisional name, nothing more.
    expect(
      result.elements
        .filter(props => props.role === WARDLEY_ROLE.component)
        .map(props => props.id)
    ).toEqual(['__proto__']);
    expect(Object.getPrototypeOf({})).toBe(Object.prototype);
    // The unknown role is not a new role: no element carries it.
    expect(
      result.elements.some(props => props.role === 'wardley:root-kit')
    ).toBe(false);
    const byKey = (key: string) =>
      result.report.notes.filter(
        note => note.messageKey === `com.labre.wardley.import.svg.remark.${key}`
      );
    expect(byKey('unreadable-coordinates').map(note => note.sourceId)).toEqual([
      'nan',
      'short',
    ]);
    // A link to an id the file does not hold is not drawn as a dependency.
    expect(byKey('dangling-link')).toHaveLength(1);
    expect(
      result.elements.filter(props => props.role === WARDLEY_ROLE.dependency)
    ).toEqual([]);
  });

  it('reads only a marker version it knows', () => {
    // A future version is not this reader's to interpret: the file falls
    // through to the next producer, here the shapes, which find no axes.
    const result = read(
      forged(
        '2',
        '<g data-labre-id="a" data-labre-type="wardleyNode" data-labre-role="wardley:component" data-labre-xywh="[788,438,24,24]"><circle cx="800" cy="450" r="12"/></g>'
      )
    );
    expect(result.report.sourceVersion).toBeUndefined();
    expect(result.elements.some(props => props.role !== undefined)).toBe(false);
  });
});

/* ── wardley-map-renderer ─────────────────────────────────────────────── */

describe('a wardley-map-renderer SVG', () => {
  /**
   * The renderer draws no notes, and draws a pipeline as an artefact of its
   * own (its own name, its own handle) rather than under a component, so the
   * small map is compared with its OWM text on everything else, and its
   * pipeline on its own.
   */
  const withoutNotesAndPipelines = (summary: MapSummary): MapSummary => ({
    ...summary,
    notes: [],
    pipelines: [],
    // The DSL's `pipeline Kettle` labels its body "Kettle"; that label hangs
    // under no node, so it does not enter `nodes` — nothing to strip there.
  });

  it.each([
    ['static', SVG_CORPUS.teaShopRenderer, 'wardley-map-renderer SVG'],
    [
      'interactive',
      SVG_CORPUS.teaShopRendererLive,
      'wardley-map-renderer SVG (interactive)',
    ],
  ])(
    'imports the tea shop to the same map as its OWM text (%s)',
    async (_mode, source, version) => {
      const { TEA_SHOP_OWM } = await import('./owm-corpus');
      const result = read(source);
      expect(result.report.sourceVersion).toBe(version);
      expectSameMap(
        summarise(result.elements),
        summarise(importWardleyOwm(TEA_SHOP_OWM).elements)
      );
    }
  );

  it.each([
    ['static', SVG_CORPUS.smallRenderer],
    ['interactive', SVG_CORPUS.smallRendererLive],
  ])(
    'imports the small map, pipeline and inertia included (%s)',
    (_mode, source) => {
      const result = read(source);
      const summary = summarise(result.elements);
      expectSameMap(
        withoutNotesAndPipelines(summary),
        withoutNotesAndPipelines(
          summarise(importWardleyOwm(SVG_CORPUS.smallOwmText).elements)
        )
      );
      // The pipeline stands alone, under its own name, across its own span.
      expect(summary.pipelines.map(pipeline => pipeline.name)).toEqual([
        'Kettle pipeline',
      ]);
      expect(Math.abs(summary.pipelines[0].from - 0.3)).toBeLessThanOrEqual(
        TOLERANCE
      );
      expect(Math.abs(summary.pipelines[0].to - 0.6)).toBeLessThanOrEqual(
        TOLERANCE
      );
      expect(summary.inertias).toHaveLength(1);
      // The axes, the title and the renderer's own legend are chrome: nothing
      // of a plain render is left for the sketch.
      expect(
        result.report.notes.find(
          note =>
            note.messageKey ===
            'com.labre.wardley.import.svg.remark.sketched-remainder'
        )
      ).toBeUndefined();
    }
  );

  it('binds by `data-id` in interactive mode, and an id is only a name', () => {
    // The interactive contract, with ids a hostile file would pick. They are
    // `data-*` attributes, which DOMPurify keeps whatever their value, so they
    // DO reach the reader — as provisional names and `Map` keys, nothing more.
    const source = `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="300" viewBox="0 0 400 300">
      <g data-layer="axes"><line x1="20" y1="280" x2="380" y2="280"/><line x1="20" y1="280" x2="20" y2="20"/></g>
      <g data-layer="edges"><g data-id="r1" data-kind="relation"><line class="hit-area" x1="100" y1="50" x2="300" y2="200" stroke="transparent"/><line x1="100" y1="50" x2="300" y2="200"/></g></g>
      <g data-layer="nodes">
        <g data-id="__proto__" data-kind="component"><circle cx="100" cy="50" r="5"/></g>
        <g data-id="constructor" data-kind="component"><circle cx="300" cy="200" r="5"/></g>
      </g>
      <g data-layer="labels">
        <text x="300" y="20" data-id="__proto__" data-kind="label">Far from its node</text>
        <text x="309" y="204" data-id="constructor" data-kind="label">Builder</text>
      </g>
    </svg>`;
    const result = read(source);
    const summary = summarise(result.elements);
    expect(summary.nodes.map(node => node.name).sort()).toEqual([
      'Builder',
      'Far from its node',
    ]);
    expect(summary.links).toEqual(['Far from its node -> Builder']);
    expect(Object.getPrototypeOf({})).toBe(Object.prototype);
  });

  it('names a static node by the label beside it, closest pairs first', () => {
    // No ids at all: the label is matched to the node it was drawn beside,
    // and a label nobody's node is near stays for the sketch.
    const source = `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="300" viewBox="0 0 400 300">
      <g data-layer="axes"><line x1="20" y1="280" x2="380" y2="280"/><line x1="20" y1="280" x2="20" y2="20"/></g>
      <g data-layer="nodes"><circle cx="100" cy="50" r="5"/><circle cx="130" cy="60" r="5"/></g>
      <g data-layer="labels">
        <text x="139" y="64">Right one</text>
        <text x="91" y="54" text-anchor="end">Left one</text>
      </g>
    </svg>`;
    const names = summarise(read(source).elements)
      .nodes.map(node => [node.name, Math.round(node.evolution * 100)])
      .sort();
    expect(names).toEqual([
      ['Left one', 22],
      ['Right one', 31],
    ]);
  });
});

/* ── No marker: the heuristic ─────────────────────────────────────────── */

describe('an SVG no producer marked', () => {
  const NO_AXES = 'com.labre.wardley.import.svg.remark.no-axes';

  it('promotes components and dependencies when it finds the plot', () => {
    const result = read(SVG_CORPUS.heuristic);
    expect(result.report.sourceVersion).toBe('SVG (recognised by shape)');
    expectSameMap(
      summarise(result.elements),
      summarise(importWardleyOwm(HEURISTIC_OWM).elements)
    );
  });

  it('promotes NOTHING else: no pipeline, inertia, evolution or anchor', () => {
    // ADR 0032 §4.4, confirmed at acceptance: bare geometry never becomes a
    // pipeline, an inertia bar or an evolve arrow — the curved link, the
    // dashed red arrow, the thick bar, the pipeline-like rect, the unnamed
    // circle and the legend outside the plot all arrive as a sketch.
    const result = read(SVG_CORPUS.heuristic);
    const roles = new Set(
      result.elements.map(props => props.role).filter(Boolean)
    );
    expect([...roles].sort()).toEqual([
      WARDLEY_ROLE.component,
      WARDLEY_ROLE.dependency,
      WARDLEY_ROLE.label,
      WARDLEY_ROLE.map,
    ]);
    const remark = result.report.notes.find(
      note =>
        note.messageKey ===
        'com.labre.wardley.import.svg.remark.sketched-remainder'
    );
    expect(remark?.messageParams?.count).toBeGreaterThanOrEqual(8);
  });

  it('draws nothing native from a picture that is not a map, and says so', () => {
    const result = read(SVG_CORPUS.notAMap);
    expect(result.elements.length).toBeGreaterThan(0);
    for (const props of result.elements) {
      expect(props.role, JSON.stringify(props)).toBeUndefined();
      expect(props.type).not.toBe('wardley');
      expect(props.type).not.toBe('wardleyNode');
    }
    expect(result.report.sourceVersion).toBeUndefined();
    const warning = result.report.notes.filter(
      note => note.messageKey === NO_AXES
    );
    expect(warning).toHaveLength(1);
    expect(warning[0].kind).toBe('warning');
  });

  it('never guesses a plot: no axes, nothing promoted, however map-like', () => {
    // Circles with names beside them and a line between, and no axes: the
    // invented axis ADR 0012 forbids is exactly what promoting these would be.
    const result = read(
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 400">' +
        '<circle cx="180" cy="90" r="6"/><text x="192" y="94">Customer</text>' +
        '<circle cx="300" cy="200" r="6"/><text x="312" y="204">Checkout</text>' +
        '<line x1="180" y1="90" x2="300" y2="200" stroke="#999"/>' +
        '</svg>'
    );
    expect(result.elements.map(props => props.type)).toEqual([
      'shape',
      'text',
      'shape',
      'text',
      'brush',
    ]);
    expect(
      result.report.notes.filter(note => note.messageKey === NO_AXES)
    ).toHaveLength(1);
  });
});

/* ── The mixed case ───────────────────────────────────────────────────── */

describe('a map with a logo and a hand-drawn remark added', () => {
  it('is ONE result: the native map, then the additions as a sketch', () => {
    const result = read(SVG_CORPUS.mixedOwm);
    const plain = read(SVG_CORPUS.smallOwm);
    // The map is untouched by what was added around it…
    expectSameMap(summarise(result.elements), summarise(plain.elements));
    // …and the four additions arrive after it: the logo's rect and text, the
    // stroke and the remark.
    const added = result.elements.slice(plain.elements.length);
    expect(added.map(props => props.type)).toEqual([
      'shape',
      'text',
      'brush',
      'text',
    ]);
    expect(added.map(props => props.text).filter(Boolean)).toEqual([
      'ACME',
      'ask finance',
    ]);
    expect(
      result.report.notes.find(
        note =>
          note.messageKey ===
          'com.labre.wardley.import.svg.remark.sketched-remainder'
      )?.messageParams
    ).toEqual({ count: 4 });
  });

  it('lands the additions where the picture had them, relative to its plot', () => {
    // The file's plot (800 × 600 at (35, 45)) is landed on the board's plot
    // with ONE scale, centred — the sketch has no independent axes. So the
    // additions keep their place around the picture: the logo, drawn right of
    // the plot and above it, lands right of the board's centre and above its
    // plot; the remark, drawn below the plot, lands below the board's.
    const result = read(SVG_CORPUS.mixedOwm);
    const plot = owmDefaultPlot();
    const boxOf = (text: string) =>
      JSON.parse(
        result.elements.find(props => props.text === text)!.xywh as string
      ) as number[];
    const [logoX, logoY] = boxOf('ACME');
    expect(logoX).toBeGreaterThan(plot.x0 + plot.width / 2);
    expect(logoY).toBeLessThan(plot.y0);
    const [, remarkY] = boxOf('ask finance');
    expect(remarkY).toBeGreaterThan(plot.y0 + plot.height);
  });
});

/* ── The tier's promises ──────────────────────────────────────────────── */

describe('still the visual tier', () => {
  const FILES = Object.entries(SVG_CORPUS).filter(([name]) =>
    name.endsWith('Text') ? false : true
  );

  it('writes no `interchange` key on any element of any corpus file', () => {
    // ADR 0012's anti-decay test, run against the reader that replaced the
    // shared one for Wardley (ADR 0032 §1).
    for (const [name, source] of FILES) {
      for (const props of read(source).elements) {
        expect(hasInterchange(props), `${name}: ${JSON.stringify(props)}`).toBe(
          false
        );
      }
    }
  });

  it('carries and quarantines nothing, and counts what it wrote', () => {
    for (const [name, source] of FILES) {
      const { report, elements } = read(source);
      expect([report.carried, report.quarantined], name).toEqual([0, 0]);
      expect(report.mapped, name).toBe(elements.length);
    }
  });
});

/* ── Hostile input ────────────────────────────────────────────────────── */

describe('a hostile file in the shape of an export', () => {
  it('runs nothing, and reads names as text', () => {
    const before = (window as { __hostile?: string }).__hostile;
    const result = read(SVG_CORPUS.hostile);
    expect((window as { __hostile?: string }).__hostile).toBe(before);
    const texts = result.elements
      .map(props => props.text)
      .filter((text): text is string => typeof text === 'string');
    // The markup in a name is the name: characters, never an element.
    expect(texts).toContain('<script>alert(1)</script>');
    for (const props of result.elements) {
      for (const value of Object.values(props)) {
        if (typeof value === 'string')
          expect(value).not.toMatch(/^javascript:/i);
      }
    }
  });

  it('uses a forged id as a local name and nothing more', () => {
    const result = read(SVG_CORPUS.hostile);
    const ids = result.elements
      .map(props => props.id)
      .filter((id): id is string => typeof id === 'string');
    expect(ids).toEqual(expect.arrayContaining(['1', '__proto__', '<script>']));
    // Nothing reached a prototype.
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
    expect(Object.getPrototypeOf({})).toBe(Object.prototype);
    // The link between two real ids is drawn; the one naming nothing is not.
    const links = result.elements.filter(
      props => props.role === WARDLEY_ROLE.dependency
    );
    expect(
      links.map(link => [
        (link.source as { id: string }).id,
        (link.target as { id: string }).id,
      ])
    ).toEqual([['1', '<script>']]);
    expect(
      result.report.notes.filter(
        note =>
          note.messageKey ===
          'com.labre.wardley.import.svg.remark.dangling-link'
      )
    ).toHaveLength(1);
  });

  it('sends an element whose coordinates are not finite numbers to the sketch', () => {
    const result = read(SVG_CORPUS.hostile);
    const unreadable = result.report.notes.filter(
      note =>
        note.messageKey ===
        'com.labre.wardley.import.svg.remark.unreadable-coordinates'
    );
    expect(unreadable.map(note => note.sourceId).sort()).toEqual(['10', '9']);
    for (const props of result.elements) {
      if (typeof props.xywh !== 'string') continue;
      for (const value of JSON.parse(props.xywh) as number[]) {
        expect(Number.isFinite(value)).toBe(true);
      }
    }
  });
});

/* ── The markers survive the sanitiser ────────────────────────────────── */

describe('every producer marker survives sanitising', () => {
  /**
   * GUARD for ADR 0032 §7: the recognisers read the SANITISED tree, so a
   * DOMPurify upgrade that dropped an `id` or a `data-*` attribute would turn
   * every recognised import into a plain sketch with no other test failing.
   * Would have caught: that, file by file, marker by marker.
   */
  const MARKED =
    /^(element_circle_|element_square_|market_circle_|ecosystem_circle_|pipeline_box_|modern_link_|modern_movable_|modern_note_text_|accelerator_circle_|fillArea$|mapTitle$|\d+-text$)/;

  it.each(
    Object.entries(SVG_CORPUS).filter(
      ([name]) => !name.endsWith('Text') && name !== 'hostile'
    )
  )('%s', (_name, source) => {
    const raw = new DOMParser().parseFromString(source, 'image/svg+xml');
    const clean = sanitizeSvg(source, new SvgSketchNotebook());
    const ids = (root: ParentNode) =>
      Array.from(root.querySelectorAll('[id]'))
        .map(element => element.getAttribute('id')!)
        .filter(id => MARKED.test(id))
        .sort();
    // The root's own attributes too: Labre's marker version rides on it.
    const data = (root: Element) =>
      [root, ...Array.from(root.querySelectorAll('*'))]
        .flatMap(element =>
          element
            .getAttributeNames()
            .filter(name => name.startsWith('data-'))
            .map(name => `${name}=${element.getAttribute(name)}`)
        )
        .sort();
    expect(ids(clean)).toEqual(ids(raw));
    expect(data(clean)).toEqual(data(raw.documentElement));
  });
});

/* ── Through the import pipeline ──────────────────────────────────────── */

describe('one import, through the pipeline every framework uses', () => {
  /** The two halves of a surface the pipeline depends on, and nothing else. */
  function stubEditor() {
    const added: Props[] = [];
    const models = new Map<string, unknown>();
    const order: string[] = [];
    const surface = {
      addElement(props: Props) {
        const id = `minted-${added.length + 1}`;
        added.push(props);
        order.push('add');
        if (props.type === 'connector') {
          const connector = Object.create(ConnectorElementModel.prototype);
          Object.defineProperties(connector, {
            id: { value: id },
            elementBound: { value: new Bound(0, 0, 0, 0) },
            source: { value: props.source, writable: true },
            target: { value: props.target, writable: true },
          });
          models.set(id, connector);
        } else {
          models.set(id, {
            id,
            elementBound: Bound.deserialize(
              String(props.xywh ?? '[0,0,10,10]')
            ),
          });
        }
        return id;
      },
      getElementById: (id: string) => models.get(id),
      get elementModels() {
        return [];
      },
    };
    const notify = vi.fn();
    const store = {
      readonly: false,
      captureSync: vi.fn(() => order.push('capture')),
    };
    const std = {
      get: () => ({
        surface,
        viewport: { zoom: 1, setViewportByBound: vi.fn() },
        tool: { setTool: vi.fn() },
      }),
      getOptional: (identifier: unknown) =>
        identifier === NotificationProvider ? { notify } : undefined,
      store,
    } as unknown as BlockStdScope;
    return { std, added, models, order, store, notify };
  }

  const fileOf = (text: string) =>
    ({ name: 'map.svg', text: () => Promise.resolve(text) }) as unknown as File;

  it('writes the native map and the sketch inside ONE undo step', async () => {
    const { std, added, order } = stubEditor();
    await importInterchangeFile(
      std,
      WARDLEY_SVG_IMPORT,
      fileOf(SVG_CORPUS.mixedOwm)
    );
    expect(added.length).toBe(read(SVG_CORPUS.mixedOwm).elements.length);
    // capture · every write · capture — and nothing else between them.
    expect(order[0]).toBe('capture');
    expect(order.at(-1)).toBe('capture');
    expect(order.filter(step => step === 'capture')).toHaveLength(2);
  });

  it('wires every dependency onto the surface ids, not the file’s', async () => {
    const { std, models } = stubEditor();
    await importInterchangeFile(
      std,
      WARDLEY_SVG_IMPORT,
      fileOf(SVG_CORPUS.smallOwm)
    );
    const connectors = [...models.values()].filter(
      (model): model is ConnectorElementModel =>
        model instanceof ConnectorElementModel
    );
    expect(connectors.length).toBeGreaterThan(0);
    for (const connector of connectors) {
      expect(models.has(connector.source.id!)).toBe(true);
      expect(models.has(connector.target.id!)).toBe(true);
    }
    // No provisional id reached a document: every one was replaced.
    expect([...models.keys()].every(id => id.startsWith('minted-'))).toBe(true);
  });

  it('writes nothing when the document turns read-only while reading', async () => {
    const { std, added, store, notify } = stubEditor();
    await importInterchangeFile(
      std,
      WARDLEY_SVG_IMPORT,
      fileOf(SVG_CORPUS.smallOwm),
      {
        decode: text => {
          store.readonly = true;
          return text;
        },
      }
    );
    expect(added).toEqual([]);
    expect(store.captureSync).not.toHaveBeenCalled();
    expect(notify.mock.calls[0][0].accent).toBe('error');
  });
});
