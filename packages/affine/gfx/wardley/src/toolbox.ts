import type {
  FrameworkToolbox,
  SerializedElementProps,
  ToolboxItem,
  ToolboxLink,
  ToolboxPoint,
} from '@labre/affine-block-surface/interchange';
import type { WardleyBgVariant } from '@labre/affine-model';
import { ConnectorMode, FontWeight } from '@labre/affine-model/headless';
import { Bound } from '@labre/global/gfx';

import { WARDLEY_BACKGROUND } from './background';
import { wardleyCommandsManifest } from './commands-manifest';
import {
  INERTIA_SIZE,
  PORTER_DEFAULT_LETTER,
  PORTER_SIZE,
} from './node/consts';
import {
  WARDLEY_AREA_SIZE,
  wardleyAreaProps,
  wardleyCanonicalBox,
  WARDLEY_EDGE_STYLE,
  wardleyHandleBox,
  wardleyHandleProps,
  wardleyInertiaProps,
  wardleyLabelBoxFor,
  type WardleyLabelledKind,
  wardleyLabelProps,
  wardleyMarketDotBoxes,
  wardleyMarketDotProps,
  wardleyMarketLinkPairs,
  wardleyMarketLinkProps,
  WARDLEY_NODE_LABEL,
  WARDLEY_NODE_SIZE,
  wardleyNodeProps,
  wardleyPorterArrowProps,
  wardleyPorterArrows,
  wardleyPorterLetterProps,
} from './presets';
import { WARDLEY_ROLE } from './roles';

/**
 * Wardley's toolbar as pure builders (`docs/adr/0045`): what the sub-menu's
 * creation actions (`actions.ts`) place, with no editor behind them. The
 * actions call these, so an artefact a host builds and one a user places from
 * the toolbar are the same elements.
 *
 * Each builder is the TOOLBAR's artefact, not the OWM reader's: the reader
 * (`import.ts`) lays a whole file out with a wider label box and a larger
 * anchor, and draws no group. Every prop that is not geometry is the same on
 * both paths (`toolbox.unit.spec.ts` holds the two to it).
 */

/**
 * The three axis words a translated variant's background is seeded with —
 * declared once, so the builder below, the editor action that resolves them
 * and the manifest (`translations.ts`) read the very same fallback. Moved here
 * from `actions.ts`, which re-exports it unchanged.
 */
export const WARDLEY_AXIS_SEED = {
  opportunity: {
    key: 'com.labre.wardley.seed.axis-opportunity',
    fallback: 'Opportunity',
  },
  benefit: {
    key: 'com.labre.wardley.seed.axis-benefit',
    fallback: 'Benefit',
  },
  investment: {
    key: 'com.labre.wardley.seed.axis-investment',
    fallback: 'Investment',
  },
} as const;

/** The axis words a map variant writes, by seed name; English when absent. */
export type WardleyMapTexts = Partial<
  Record<keyof typeof WARDLEY_AXIS_SEED, string>
>;

const given = (text: string | undefined, fallback: string) =>
  text?.trim() || fallback;

/**
 * Per-variant default labels written at creation (all remain editable
 * afterwards). `opportunity` and `benefit` are the two variants whose Y axis
 * is PROSE baked into the document; `classic` and `evolution-gradient` keep
 * the declaration's own labels, which are `labelKey`s and need no seed.
 */
function mapVariantProps(
  variant: WardleyBgVariant,
  texts: WardleyMapTexts
): Record<string, unknown> {
  const axis = (seed: keyof typeof WARDLEY_AXIS_SEED) =>
    given(texts[seed], WARDLEY_AXIS_SEED[seed].fallback);
  switch (variant) {
    case 'opportunity':
      // The Y axis becomes "Opportunity"; phase labels keep the classic ones.
      return {
        yAxisTitle: axis('opportunity'),
        showVisibilityLabels: false,
        showCornerLabels: false,
      };
    case 'benefit':
      // The Y axis splits into Benefit (top) / Investment (bottom) around a
      // zero line drawn by the renderer.
      return {
        yAxisTitle: '',
        visibilityHigh: axis('benefit'),
        visibilityLow: axis('investment'),
        showCornerLabels: false,
      };
    default:
      return {};
  }
}

/**
 * A map background of one variant at `at`, at the declaration's reference
 * size unless `size` says otherwise (the editor passes the size of the
 * biggest map already on the board, which only an editor can read).
 */
export function wardleyMapElement(
  variant: WardleyBgVariant,
  at: ToolboxPoint,
  texts: WardleyMapTexts = {},
  local = 'map',
  size: { width: number; height: number } = WARDLEY_BACKGROUND.geometry
): SerializedElementProps {
  return {
    type: WARDLEY_BACKGROUND.type,
    id: local,
    // The map is a first-class role: validation rules position artefacts
    // against `wardley:map`, never against the `wardley` element type.
    role: WARDLEY_BACKGROUND.role,
    // A map is a frame you place things on, not a shape you nudge.
    resizeEnabled: WARDLEY_BACKGROUND.geometry.resizable,
    variant,
    ...mapVariantProps(variant, texts),
    xywh: new Bound(at.x, at.y, size.width, size.height).serialize(),
  };
}

/** The centre of a box of size `w`×`h` whose top-left is `at`. */
const centreOf = (at: ToolboxPoint, w: number, h: number) => ({
  cx: at.x + w / 2,
  cy: at.y + h / 2,
});

/** The name beside a labelled kind centred on (cx, cy). */
function labelOf(
  kind: WardleyLabelledKind,
  name: string | undefined,
  cx: number,
  cy: number,
  id: string
): SerializedElementProps {
  const { x, y, textAlign } = wardleyLabelBoxFor(kind, cx, cy);
  return {
    ...wardleyLabelProps(
      given(name, WARDLEY_NODE_LABEL[kind]),
      x,
      y,
      textAlign,
      // The two climate arrows are the only SemiBold names: an annotation laid
      // over a map already full of names (`createWardleyAccelerator`).
      kind === 'accelerator' || kind === 'decelerator'
        ? FontWeight.SemiBold
        : FontWeight.Regular
    ),
    id,
  };
}

const groupOf = (
  id: string,
  members: readonly SerializedElementProps[]
): SerializedElementProps => ({
  type: 'group',
  id,
  children: Object.fromEntries(members.map(m => [m.id, true])),
});

/** The kinds drawn as one node and the name beside it, grouped. */
export type WardleyNodeItemKind =
  | 'component'
  | 'method'
  | 'ecosystem'
  | 'anchor'
  | 'accelerator'
  | 'decelerator';

/**
 * A single node at `at` (the top-left of the node's own box) and its name
 * beside it, grouped: a component, a method, an ecosystem, an anchor, or one
 * of the two climate arrows, whose name sits on the side their shaft is on.
 */
export function wardleyNodeElements(
  kind: WardleyNodeItemKind,
  at: ToolboxPoint,
  name?: string,
  local: string = kind
): SerializedElementProps[] {
  const { w, h } = WARDLEY_NODE_SIZE[kind];
  const { cx, cy } = centreOf(at, w, h);
  const members = [
    {
      ...wardleyNodeProps(kind, { xywh: wardleyCanonicalBox(kind, cx, cy) }),
      id: `${local}:node`,
    },
    labelOf(kind, name, cx, cy, `${local}:label`),
  ];
  return [...members, groupOf(`${local}:group`, members)];
}

/**
 * A market at `at` (the top-left of its 30-unit circle): the circle, its
 * three role-less dots wired into a triangle by three attached connectors,
 * and its name, all in one group.
 */
export function wardleyMarketElements(
  at: ToolboxPoint,
  name?: string,
  local = 'market'
): SerializedElementProps[] {
  const { w, h } = WARDLEY_NODE_SIZE.market;
  const { cx, cy } = centreOf(at, w, h);
  const circle = {
    ...wardleyNodeProps('market', {
      xywh: wardleyCanonicalBox('market', cx, cy),
    }),
    id: `${local}:node`,
  };
  const dots = wardleyMarketDotBoxes(cx, cy).map((xywh, index) => ({
    ...wardleyMarketDotProps({ xywh }),
    id: `${local}:dot-${index + 1}`,
  }));
  const links = wardleyMarketLinkPairs(dots.map(dot => dot.id)).map(
    ([a, b], index) => ({
      ...wardleyMarketLinkProps(a, b),
      id: `${local}:link-${index + 1}`,
    })
  );
  const members = [
    circle,
    ...dots,
    ...links,
    labelOf('market', name, cx, cy, `${local}:label`),
  ];
  return [...members, groupOf(`${local}:group`, members)];
}

/**
 * A pipeline at `at` (the top-left of its 120×25 body): the body, the
 * `handle` square astride its top edge (the only place a connector lands),
 * the name above it, and two nested groups — (handle + name), then (body +
 * that group) — as `createWardleyPipeline` has always built it.
 */
export function wardleyPipelineElements(
  at: ToolboxPoint,
  name?: string,
  local = 'pipeline'
): SerializedElementProps[] {
  const { w, h } = WARDLEY_NODE_SIZE.pipeline;
  const { cx, cy } = centreOf(at, w, h);
  const body = {
    ...wardleyNodeProps('pipeline', {
      xywh: wardleyCanonicalBox('pipeline', cx, cy),
    }),
    id: `${local}:node`,
  };
  const handle = {
    ...wardleyHandleProps({ xywh: wardleyHandleBox(cx, cy) }),
    id: `${local}:handle`,
  };
  const label = labelOf('pipeline', name, cx, cy, `${local}:label`);
  const inner = groupOf(`${local}:handle-group`, [handle, label]);
  return [body, handle, label, inner, groupOf(`${local}:group`, [body, inner])];
}

/**
 * A Porter's-forces glyph at `at` (the top-left of its 60-unit circle): the
 * circle carrying ONE letter as its own inner text (R, L or E; R when
 * absent) and the four role-less red arrows pushing on it, grouped.
 */
export function wardleyPorterElements(
  at: ToolboxPoint,
  letter?: string,
  local = 'porter'
): SerializedElementProps[] {
  const { cx, cy } = centreOf(at, PORTER_SIZE, PORTER_SIZE);
  const members = [
    {
      ...wardleyNodeProps('porter', {
        xywh: wardleyCanonicalBox('porter', cx, cy),
      }),
      ...wardleyPorterLetterProps(given(letter, PORTER_DEFAULT_LETTER)),
      id: `${local}:node`,
    },
    ...wardleyPorterArrows(cx, cy).map((arrow, index) => ({
      ...wardleyPorterArrowProps(arrow),
      id: `${local}:arrow-${index + 1}`,
    })),
  ];
  return [...members, groupOf(`${local}:group`, members)];
}

/** An inertia bar at `at`: a plain filled rect whose role is its meaning. */
export function wardleyInertiaElement(
  at: ToolboxPoint,
  local = 'inertia'
): SerializedElementProps {
  const { w, h } = INERTIA_SIZE;
  return {
    ...wardleyInertiaProps({
      xywh: new Bound(at.x, at.y, w, h).serialize(),
    }),
    id: local,
  };
}

/**
 * A rectangular AREA at `at`, its name its own inner text (the toolbar
 * creates it empty). The editor then lowers it under the components it
 * covers (`lowerWardleyArea`), a depth relative to what is already on the
 * board: a host that writes one sets that depth itself.
 */
export function wardleyAreaElement(
  at: ToolboxPoint,
  name?: string,
  local = 'area'
): SerializedElementProps {
  const { w, h } = WARDLEY_AREA_SIZE.rect;
  const trimmed = name?.trim();
  return {
    ...wardleyAreaProps('rect', {
      xywh: new Bound(at.x, at.y, w, h).serialize(),
    }),
    ...(trimmed ? { text: trimmed } : {}),
    id: local,
  };
}

function edge(
  kind: keyof typeof WARDLEY_EDGE_STYLE,
  from: string,
  to: string,
  label?: string
): SerializedElementProps {
  return {
    type: 'connector',
    mode: ConnectorMode.Straight,
    // Two roles, never one specialising the other: W1 is about where an
    // arrow points and must never fall on a dependency.
    role: kind === 'link' ? WARDLEY_ROLE.dependency : WARDLEY_ROLE.changeArrow,
    ...WARDLEY_EDGE_STYLE[kind],
    source: { id: from },
    target: { id: to },
    ...(label?.trim() ? { text: label.trim() } : {}),
  };
}

/**
 * The value-chain link the Link tool draws: `from` is the CONSUMER and `to`
 * what it needs (ADR 0010), never inverted.
 */
export function wardleyDependencyElement(
  from: string,
  to: string,
  label?: string
): SerializedElementProps {
  return edge('link', from, to, label);
}

/** The evolution arrow the Arrow tool draws, from a component to its twin. */
export function wardleyChangeArrowElement(
  from: string,
  to: string,
  label?: string
): SerializedElementProps {
  return edge('arrow', from, to, label);
}

/** The toolbar command's label, so a host names an item as the toolbar does. */
function label(commandId: string) {
  const row = wardleyCommandsManifest.find(r => r.id === commandId);
  return {
    labelKey: row?.labelKey ?? commandId,
    labelFallback: row?.labelFallback ?? commandId,
  };
}

const mapItem = (
  id: string,
  commandId: string,
  variant: WardleyBgVariant,
  texts: readonly (keyof typeof WARDLEY_AXIS_SEED)[]
): ToolboxItem => ({
  id,
  ...label(commandId),
  texts,
  size: {
    w: WARDLEY_BACKGROUND.geometry.width,
    h: WARDLEY_BACKGROUND.geometry.height,
  },
  build: (at, slots, local) => [wardleyMapElement(variant, at, slots, local)],
});

const nodeItem = (
  kind: WardleyNodeItemKind,
  commandId: string
): ToolboxItem => ({
  id: kind,
  ...label(commandId),
  texts: ['name'],
  size: WARDLEY_NODE_SIZE[kind],
  build: (at, texts, local) =>
    wardleyNodeElements(kind, at, texts?.name, local),
});

const dependency: ToolboxLink = {
  id: 'dependency',
  ...label('wardley.linkTool'),
  build: wardleyDependencyElement,
};

const changeArrow: ToolboxLink = {
  id: 'change-arrow',
  ...label('wardley.evolutionArrow'),
  build: wardleyChangeArrowElement,
};

/**
 * Every item of the Wardley toolbar, in the toolbar's order. The polygon
 * AREA is not here: it is a drawing tool, the author clicks its corners, and
 * a prefabricated outline is precisely what the toolbar refuses to place
 * (`activateWardleyAreaPolygon`).
 */
export const WARDLEY_TOOLBOX: FrameworkToolbox = {
  framework: 'wardley',
  items: [
    mapItem('map', 'wardley.addBackground', 'classic', []),
    mapItem(
      'opportunity-map',
      'wardley.addOpportunityBackground',
      'opportunity',
      ['opportunity']
    ),
    mapItem('benefit-map', 'wardley.addBenefitBackground', 'benefit', [
      'benefit',
      'investment',
    ]),
    mapItem(
      'evolution-map',
      'wardley.addEvolutionBackground',
      'evolution-gradient',
      []
    ),
    nodeItem('component', 'wardley.addComponent'),
    nodeItem('method', 'wardley.addMethod'),
    {
      id: 'market',
      ...label('wardley.addMarket'),
      texts: ['name'],
      size: WARDLEY_NODE_SIZE.market,
      build: (at, texts, local) =>
        wardleyMarketElements(at, texts?.name, local),
    },
    nodeItem('ecosystem', 'wardley.addEcosystem'),
    nodeItem('anchor', 'wardley.addAnchor'),
    {
      id: 'pipeline',
      ...label('wardley.addPipeline'),
      texts: ['name'],
      size: WARDLEY_NODE_SIZE.pipeline,
      build: (at, texts, local) =>
        wardleyPipelineElements(at, texts?.name, local),
    },
    {
      id: 'inertia',
      ...label('wardley.addInertia'),
      texts: [],
      size: INERTIA_SIZE,
      build: (at, _texts, local) => [wardleyInertiaElement(at, local)],
    },
    {
      id: 'porter',
      ...label('wardley.addPorter'),
      texts: ['letter'],
      size: WARDLEY_NODE_SIZE.porter,
      build: (at, texts, local) =>
        wardleyPorterElements(at, texts?.letter, local),
    },
    nodeItem('accelerator', 'wardley.addAccelerator'),
    nodeItem('decelerator', 'wardley.addDecelerator'),
    {
      id: 'area',
      ...label('wardley.addAreaRect'),
      texts: ['name'],
      size: WARDLEY_AREA_SIZE.rect,
      build: (at, texts, local) => [wardleyAreaElement(at, texts?.name, local)],
    },
  ],
  links: [dependency, changeArrow],
};
