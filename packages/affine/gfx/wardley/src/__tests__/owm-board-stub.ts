import {
  ConnectorElementModel,
  TextElementModel,
  WardleyBackgroundElementModel,
  type WardleyNodeKind,
  WardleyNodeElementModel,
} from '@labre/affine-model';
import { Bound } from '@labre/global/gfx';
import type { ForeignInterchange } from '@labre/std/gfx';

import {
  OWM_DEFAULT_MAP_HEIGHT,
  OWM_DEFAULT_MAP_WIDTH,
  OWM_LABEL_HEIGHT,
  OWM_LABEL_WIDTH,
  type OwmPlot,
  owmPlotOf,
  owmPointOf,
  WARDLEY_OWM_FORMAT_ID,
  type WardleyExportBoard,
} from '../export';
import { LABEL_GAP, NODE_SIZE } from '../node/consts';
import { WARDLEY_ROLE } from '../roles';

/**
 * Plain stubs for a Wardley board, shared by every spec that needs one.
 *
 * Prototype-grafted objects rather than real element models, because the
 * serializer and the interchange capability are pure functions over a handful
 * of accessors: nothing here needs a surface, a store or a canvas, and the day
 * one of them does, this file is where that stops being true. It is the same
 * arrangement `gfx/bpmn/src/__tests__/board-stub.ts` uses, for the same reason.
 *
 * Shared rather than copied so that the export spec, the import spec and the
 * interchange spec cannot silently drift onto three different boards and all
 * three keep passing.
 */

type Props = Record<string, unknown> & { type: string };

/* ── The pieces ───────────────────────────────────────────────────────── */

export function fakeMap(
  bound: [number, number, number, number] = [
    0,
    0,
    OWM_DEFAULT_MAP_WIDTH,
    OWM_DEFAULT_MAP_HEIGHT,
  ],
  interchange?: Record<string, ForeignInterchange>
): WardleyBackgroundElementModel {
  const map = Object.create(WardleyBackgroundElementModel.prototype) as Record<
    string,
    unknown
  >;
  Object.defineProperties(map, {
    id: { value: 'map-1', enumerable: true },
    role: { value: WARDLEY_ROLE.map, enumerable: true },
    elementBound: { value: new Bound(...bound) },
    interchange: { value: interchange, writable: true, enumerable: true },
  });
  return map as unknown as WardleyBackgroundElementModel;
}

export function fakeNode(
  id: string,
  kind: WardleyNodeKind,
  bound: [number, number, number, number],
  options: {
    role?: string | undefined;
    interchange?: Record<string, ForeignInterchange>;
  } = {}
): WardleyNodeElementModel {
  const node = Object.create(WardleyNodeElementModel.prototype) as Record<
    string,
    unknown
  >;
  Object.defineProperties(node, {
    id: { value: id, enumerable: true },
    kind: { value: kind, enumerable: true },
    role: {
      value: 'role' in options ? options.role : WARDLEY_ROLE[kind],
      enumerable: true,
    },
    elementBound: { value: new Bound(...bound) },
    interchange: {
      value: options.interchange,
      writable: true,
      enumerable: true,
    },
  });
  return node as unknown as WardleyNodeElementModel;
}

export function fakeText(
  id: string,
  text: string,
  bound: [number, number, number, number],
  options: {
    role?: string;
    interchange?: Record<string, ForeignInterchange>;
  } = {}
): TextElementModel {
  const element = Object.create(TextElementModel.prototype) as Record<
    string,
    unknown
  >;
  Object.defineProperties(element, {
    id: { value: id, enumerable: true },
    text: { value: text, enumerable: true },
    role: { value: options.role, enumerable: true },
    elementBound: { value: new Bound(...bound) },
    interchange: {
      value: options.interchange,
      writable: true,
      enumerable: true,
    },
  });
  return element as unknown as TextElementModel;
}

export function fakeConnector(
  id: string,
  role: string | undefined,
  ends: { source?: string; target?: string } = {}
): ConnectorElementModel {
  const connector = Object.create(ConnectorElementModel.prototype) as Record<
    string,
    unknown
  >;
  Object.defineProperties(connector, {
    id: { value: id, enumerable: true },
    role: { value: role, enumerable: true },
    elementBound: { value: new Bound(0, 0, 0, 0) },
    source: {
      value: ends.source === undefined ? {} : { id: ends.source },
      enumerable: true,
    },
    target: {
      value: ends.target === undefined ? {} : { id: ends.target },
      enumerable: true,
    },
    interchange: { value: undefined, writable: true, enumerable: true },
  });
  return connector as unknown as ConnectorElementModel;
}

export const board = (
  partial: Partial<WardleyExportBoard>
): WardleyExportBoard => ({
  maps: [],
  nodes: [],
  labels: [],
  notes: [],
  connectors: [],
  ...partial,
});

/** The elements of a board, flat and in document order, as a surface holds them. */
export function flatten(parts: WardleyExportBoard) {
  return [
    ...parts.maps,
    ...parts.nodes,
    ...parts.labels,
    ...parts.notes,
    ...parts.connectors,
  ];
}

/* ── A hand-drawn map, the way the toolbox draws one ──────────────────── */

/** The plot of the reference map, which is where these fixtures lay out. */
export const PLOT: OwmPlot = owmPlotOf({
  x: 0,
  y: 0,
  w: OWM_DEFAULT_MAP_WIDTH,
  h: OWM_DEFAULT_MAP_HEIGHT,
});

/** A named circle plus the free text beside it — one artefact, two elements. */
export function drawNode(
  id: string,
  kind: WardleyNodeKind,
  name: string,
  visibility: number,
  evolution: number,
  diameter = NODE_SIZE
): { node: WardleyNodeElementModel; label: TextElementModel } {
  const [cx, cy] = owmPointOf(PLOT, visibility, evolution);
  return {
    node: fakeNode(id, kind, [
      cx - diameter / 2,
      cy - diameter / 2,
      diameter,
      diameter,
    ]),
    label: fakeText(
      `${id}-label`,
      name,
      [
        cx + diameter / 2 + LABEL_GAP,
        cy - OWM_LABEL_HEIGHT / 2,
        OWM_LABEL_WIDTH,
        OWM_LABEL_HEIGHT,
      ],
      { role: WARDLEY_ROLE.label }
    ),
  };
}

/**
 * The Tea Shop, drawn by hand: a user, a need, three capabilities and the
 * dependencies between them.
 *
 * Built fresh on each call and read by several specs, because it is the case
 * the export exists for — anything simpler would leave a whole half of the
 * format unexercised.
 */
export function teaShopBoard(): WardleyExportBoard {
  const business = drawNode('n-business', 'anchor', 'Business', 0.93, 0.62, 24);
  const cupOfTea = drawNode(
    'n-cup-of-tea',
    'component',
    'Cup of Tea',
    0.74,
    0.62
  );
  const cup = drawNode('n-cup', 'component', 'Cup', 0.7, 0.8);
  const tea = drawNode('n-tea', 'component', 'Tea', 0.6, 0.83);
  const kettle = drawNode('n-kettle', 'component', 'Kettle', 0.38, 0.36);

  return board({
    maps: [fakeMap()],
    nodes: [business, cupOfTea, cup, tea, kettle].map(pair => pair.node),
    labels: [business, cupOfTea, cup, tea, kettle].map(pair => pair.label),
    connectors: [
      // `source` is the CONSUMER, `target` is what it needs (ADR 0010).
      fakeConnector('c-1', WARDLEY_ROLE.dependency, {
        source: 'n-business',
        target: 'n-cup-of-tea',
      }),
      fakeConnector('c-2', WARDLEY_ROLE.dependency, {
        source: 'n-cup-of-tea',
        target: 'n-cup',
      }),
      fakeConnector('c-3', WARDLEY_ROLE.dependency, {
        source: 'n-cup-of-tea',
        target: 'n-tea',
      }),
      fakeConnector('c-4', WARDLEY_ROLE.dependency, {
        source: 'n-cup-of-tea',
        target: 'n-kettle',
      }),
    ],
  });
}

/* ── What the CALLER of an importer does ──────────────────────────────── */

/**
 * The half of the round trip that is nobody's pure function, in thirty lines.
 *
 * The importer returns PROPS, never models: it has no surface, and
 * `surface.addElement` mints its own nanoid and ignores any id handed to it
 * (`docs/adr/0012`, D3 — surface identity is Labre's and never the file's). So
 * a connector's endpoints come back naming the SOURCE FILE's names, and the
 * caller is what turns them into surface ids, through the one map the returned
 * array already contains: `interchange.owm.id` → the id the surface just
 * minted, FIRST occurrence winning.
 *
 * Stubbed here rather than mocked: this is exactly what
 * `materializeInterchangeImport` does and what a labre-mcp tool owes, so a test
 * that skipped it would be proving the round trip of something nobody can call.
 */
export function boardFromProps(elements: readonly Props[]): WardleyExportBoard {
  const surfaceIds = elements.map((_, index) => `imported-${index + 1}`);
  const sourceOf = (props: Props) =>
    (props.interchange as Record<string, ForeignInterchange> | undefined)?.[
      WARDLEY_OWM_FORMAT_ID
    ]?.id;

  const bySource = new Map<string, string>();
  elements.forEach((props, index) => {
    const source = sourceOf(props);
    if (source !== undefined && !bySource.has(source)) {
      bySource.set(source, surfaceIds[index]);
    }
  });

  const built = board({});
  elements.forEach((props, index) => {
    const id = surfaceIds[index];
    const carried = props.interchange as
      | Record<string, ForeignInterchange>
      | undefined;
    const bound = Bound.deserialize(String(props.xywh ?? '[0,0,0,0]')).toXYWH();

    if (props.type === 'wardley') {
      built.maps.push(fakeMap(bound, carried));
    } else if (props.type === 'wardleyNode') {
      built.nodes.push(
        fakeNode(id, props.kind as WardleyNodeKind, bound, {
          role: props.role as string | undefined,
          interchange: carried,
        })
      );
    } else if (props.type === 'text') {
      const text = fakeText(id, String(props.text ?? ''), bound, {
        role: props.role as string | undefined,
        interchange: carried,
      });
      if (props.role === WARDLEY_ROLE.label) built.labels.push(text);
      else built.notes.push(text);
    } else if (props.type === 'connector') {
      const end = (side: 'source' | 'target') => {
        const named = (props[side] as { id?: string } | undefined)?.id;
        return named === undefined ? undefined : (bySource.get(named) ?? named);
      };
      built.connectors.push(
        fakeConnector(id, props.role as string | undefined, {
          source: end('source'),
          target: end('target'),
        })
      );
    }
  });

  return built;
}
