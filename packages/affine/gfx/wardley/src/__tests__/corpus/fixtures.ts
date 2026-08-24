import { backgroundBoundaryCoords } from '@labre/affine-block-surface';
import { Bound } from '@labre/global/gfx';
import type { GfxPrimitiveElementModel } from '@labre/std/gfx';

import { WARDLEY_BACKGROUND } from '../../background';
import { WARDLEY_ROLE } from '../../roles';

/**
 * The Wardley CORPUS (first seed).
 *
 * A card of the corpus is a whole map expressed as data, plus the exact set of
 * rule ids it is expected to raise. Valid cards raise nothing; invalid ones
 * raise precisely one thing each, named. That is the recipe the milestone-2
 * acceptance runs on, and the reason it is built HERE, with the pack it
 * checks: a rule whose corpus card arrives six months later is a rule nobody
 * can change safely in the meantime.
 *
 * The maps are built against the DECLARATION, not against copied numbers: the
 * phase transitions a card sits an inertia bar on come out of
 * {@link backgroundBoundaryCoords}, so a card cannot silently drift from the
 * background it is drawn on.
 */

/** The reference map every card is drawn on: 1600 × 900 at the origin. */
export const MAP_BOUND = new Bound(0, 0, 1600, 900);

/** The phase transitions of that map, in model coordinates. */
export const TRANSITIONS = backgroundBoundaryCoords(
  WARDLEY_BACKGROUND,
  MAP_BOUND
).x;

/** A point somewhere on the map, expressed as a fraction of the map box. */
const at = (fx: number, fy: number): [number, number] => [
  MAP_BOUND.x + fx * MAP_BOUND.w,
  MAP_BOUND.y + fy * MAP_BOUND.h,
];

/**
 * One element of a card. `path` is what makes an edge directional; `text` and
 * `fontSize` are what make a label a label — a text element is measured by the
 * ink of its words, and a card built out of bare boxes would be judging a
 * geometry no map has.
 */
export interface CorpusElement {
  id: string;
  role?: string;
  xywh: [number, number, number, number];
  path?: [number, number][];
  /**
   * The elements an edge BINDS, when it binds any. Since `docs/adr/0010` this
   * pair is the relation's orientation and not a routing detail: W4 reads it,
   * and an edge that leaves it out is one that relates nothing and is never
   * evaluated — which is itself a card below.
   */
  source?: string;
  target?: string;
  text?: string;
  fontSize?: number;
  textAlign?: 'left' | 'center' | 'right';
}

/** One card: a whole map, and the rule ids it must raise. Nothing else. */
export interface CorpusCard {
  name: string;
  elements: CorpusElement[];
  /** Rule ids, one entry per expected finding. Sorted by the spec. */
  expected: string[];
  /**
   * `rule:elementIds` for each expected finding, when the card is big enough
   * that the rule id alone would not say WHICH mistake was caught.
   *
   * A two-element card only has one thing it can be reporting; a card with
   * twenty has several, and "three overlaps" is satisfied just as well by the
   * three wrong ones. Present on the cards where that distinction exists.
   */
  expectedIds?: string[];
}

const W1 = 'wardley.change-arrow-against-evolution';
const W2 = 'wardley.inertia-off-transition';
const W3 = 'wardley.overlapping-artefacts';
const W4 = 'wardley.provider-above-consumer';

/** The map background itself, on the strict profile so nothing is silenced. */
const map = (): CorpusElement => ({
  id: 'map',
  role: WARDLEY_ROLE.map,
  xywh: [MAP_BOUND.x, MAP_BOUND.y, MAP_BOUND.w, MAP_BOUND.h],
});

const node = (
  id: string,
  fx: number,
  fy: number,
  role: string = WARDLEY_ROLE.component
): CorpusElement => {
  const [x, y] = at(fx, fy);
  return { id, role, xywh: [x - 9, y - 9, 18, 18] };
};

/**
 * A label, with the CREATION BOX the toolbox gives it — 120 units wide
 * whatever it says — and the words actually in it. The gap between the two is
 * the thing the PO's acceptance caught, so a card must carry both.
 */
const label = (
  id: string,
  fx: number,
  fy: number,
  text = 'Customer'
): CorpusElement => {
  const [x, y] = at(fx, fy);
  return {
    id,
    role: WARDLEY_ROLE.label,
    xywh: [x, y - 13, 120, 26],
    text,
    fontSize: 18,
    textAlign: 'left',
  };
};

/** An edge from one map fraction to another, with a real routed path. */
const edge = (
  id: string,
  role: string,
  from: [number, number],
  to: [number, number]
): CorpusElement => {
  const a = at(from[0], from[1]);
  const b = at(to[0], to[1]);
  return {
    id,
    role,
    xywh: [
      Math.min(a[0], b[0]),
      Math.min(a[1], b[1]),
      Math.abs(b[0] - a[0]) || 1,
      Math.abs(b[1] - a[1]) || 1,
    ],
    path: [a, b],
  };
};

const link = (id: string, from: [number, number], to: [number, number]) =>
  edge(id, WARDLEY_ROLE.dependency, from, to);

const arrow = (id: string, from: [number, number], to: [number, number]) =>
  edge(id, WARDLEY_ROLE.changeArrow, from, to);

/** The centre of an element, from its box. */
const centreOf = (el: CorpusElement): [number, number] => [
  el.xywh[0] + el.xywh[2] / 2,
  el.xywh[1] + el.xywh[3] / 2,
];

/**
 * A dependency BOUND to two nodes: `consumer` needs `provider`.
 *
 * The direction is the whole subject of W4, so it is spelled out at the call
 * site rather than inferred from the geometry — which is exactly the shortcut
 * `docs/adr/0010` § 4 rejects. The routed path is the segment between the two
 * centres, which is what a straight, centre-anchored Wardley link draws.
 */
const needs = (
  id: string,
  consumer: CorpusElement,
  provider: CorpusElement,
  role: string = WARDLEY_ROLE.dependency
): CorpusElement => {
  const a = centreOf(consumer);
  const b = centreOf(provider);
  return {
    id,
    role,
    xywh: [
      Math.min(a[0], b[0]),
      Math.min(a[1], b[1]),
      Math.abs(b[0] - a[0]) || 1,
      Math.abs(b[1] - a[1]) || 1,
    ],
    path: [a, b],
    source: consumer.id,
    target: provider.id,
  };
};

/** An inertia bar centred on an absolute model point. */
const inertia = (id: string, x: number, y: number): CorpusElement => ({
  id,
  role: WARDLEY_ROLE.inertia,
  xywh: [x - 4, y - 22, 8, 44],
});

/**
 * A link running horizontally at `fy`, crossing the transition at `TRANSITIONS[i]`
 * — the situation an inertia bar is drawn for. Returns the link and the exact
 * point where the bar belongs.
 */
function crossing(id: string, fy: number, i: number) {
  const y = at(0, fy)[1];
  const x = TRANSITIONS[i];
  const spread = 200;
  return {
    link: {
      id,
      role: WARDLEY_ROLE.dependency,
      xywh: [x - spread, y - 1, spread * 2, 2] as [
        number,
        number,
        number,
        number,
      ],
      path: [
        [x - spread, y],
        [x + spread, y],
      ] as [number, number][],
    },
    point: [x, y] as [number, number],
  };
}

// ── W1 · a change arrow may not point against evolution ────────────────

const w1Forward: CorpusCard = {
  name: 'W1 valid — a change arrow pointing towards commodity',
  elements: [
    map(),
    node('n1', 0.2, 0.4),
    node('n2', 0.7, 0.4),
    arrow('a1', [0.22, 0.4], [0.68, 0.4]),
  ],
  expected: [],
};

const w1Diagonal: CorpusCard = {
  name: 'W1 valid — an arrow rising as it evolves, and one straight up',
  elements: [
    map(),
    // Forward and upward: still with evolution.
    arrow('a1', [0.2, 0.7], [0.6, 0.3]),
    // Straight up the value chain: perpendicular to evolution, so it says
    // nothing about it. Inside the dead zone, deliberately silent.
    arrow('a2', [0.45, 0.8], [0.45, 0.2]),
  ],
  expected: [],
};

const w1Backwards: CorpusCard = {
  name: 'W1 invalid — a change arrow pointing back towards genesis',
  elements: [
    map(),
    node('n1', 0.7, 0.4),
    node('n2', 0.2, 0.4),
    arrow('a1', [0.68, 0.4], [0.22, 0.4]),
  ],
  expected: [W1],
};

// ── W2 · the inertia bar sits on a dependency, at a transition ─────────

const w2OnTransition: CorpusCard = {
  name: 'W2 valid — a bar across a link, on the phase boundary',
  elements: (() => {
    const { link: l, point } = crossing('l1', 0.45, 1);
    return [map(), l, inertia('i1', point[0], point[1])];
  })(),
  expected: [],
};

const w2SecondTransition: CorpusCard = {
  name: 'W2 valid — the same, on another transition, slightly off centre',
  elements: (() => {
    const { link: l, point } = crossing('l1', 0.6, 2);
    // Within both tolerances: 12 units along the link, 12 off the boundary.
    return [map(), l, inertia('i1', point[0] + 12, point[1] + 12)];
  })(),
  expected: [],
};

const w2FloatingBar: CorpusCard = {
  name: 'W2 invalid — a bar in white space, on no link at all',
  elements: (() => {
    const { link: l } = crossing('l1', 0.45, 1);
    const [x, y] = at(0.5, 0.15);
    return [map(), l, inertia('i1', x, y)];
  })(),
  expected: [W2],
};

const w2MidPhase: CorpusCard = {
  name: 'W2 invalid — a bar on the link but in the middle of a phase',
  elements: (() => {
    const { link: l, point } = crossing('l1', 0.45, 1);
    // On the link, 150 units away from the transition it should mark — 9.8% of
    // a 1530-wide plot, against a band that reaches 5% either side of the
    // divider. Outside, and not marginally so.
    return [map(), l, inertia('i1', point[0] + 150, point[1])];
  })(),
  expected: [W2],
};

/**
 * The PO recette of 01/08/2026: bars dropped squarely on the "Product" and
 * "Commodity" dividers, with no dependency under either. Being on the frontier
 * is not enough — inertia is resistance to a MOVEMENT, and the movement is the
 * link. The card pins the verdict; which of W2's two sentences each bar gets is
 * pinned in `validation.unit.spec.ts`.
 */
const w2OnDividerNoCarrier: CorpusCard = {
  name: 'W2 invalid — two bars on the dividers, on no dependency at all',
  elements: (() => {
    const { link: l } = crossing('l1', 0.85, 0);
    return [
      map(),
      l,
      inertia('i1', TRANSITIONS[1], at(0, 0.5)[1]),
      inertia('i2', TRANSITIONS[2], at(0, 0.35)[1]),
    ];
  })(),
  expected: [W2, W2],
  expectedIds: [`${W2}:i1`, `${W2}:i2`],
};

// ── W3 · nodes and labels must stay readable ───────────────────────────

const w3Clean: CorpusCard = {
  name: 'W3 valid — nodes and their labels, well spread out',
  elements: [
    map(),
    node('n1', 0.2, 0.3),
    label('l1', 0.22, 0.3),
    node('n2', 0.6, 0.7),
    label('l2', 0.62, 0.7),
    link('d1', [0.21, 0.32], [0.59, 0.68]),
  ],
  expected: [],
};

const w3Tight: CorpusCard = {
  name: 'W3 valid — close neighbours that do not actually touch',
  elements: [
    map(),
    node('n1', 0.3, 0.4),
    node('n2', 0.32, 0.4),
    label('l1', 0.5, 0.2),
    label('l2', 0.5, 0.3),
  ],
  expected: [],
};

/**
 * The PO's first acceptance capture (01/08/2026), as a card.
 *
 * A dependency running down the blank right-hand half of a label box. The rule
 * used to report it, because it measured the box the label was created at
 * rather than the three letters written in it.
 */
const w3LinkInTheMargin: CorpusCard = (() => {
  const [x, y] = at(0.4, 0.5);
  return {
    name: 'W3 valid — a link crossing the empty margin of a label box',
    elements: [
      map(),
      // 27 units of ink in a 120-unit box.
      label('l1', 0.4, 0.5, 'ERP'),
      {
        id: 'd1',
        role: WARDLEY_ROLE.dependency,
        xywh: [x + 79, y - 100, 2, 200] as [number, number, number, number],
        path: [
          [x + 80, y - 100],
          [x + 80, y + 100],
        ] as [number, number][],
      },
    ],
    expected: [],
  };
})();

/**
 * The PO's second capture: two labels whose BOXES overlap by half their width
 * and whose words are thirty units apart.
 */
const w3NamesApart: CorpusCard = {
  name: 'W3 valid — two labels whose words never meet',
  elements: [
    map(),
    label('l1', 0.3, 0.5, 'ERP'),
    { ...label('l2', 0.3, 0.5, 'Cloud'), xywh: [at(0.3, 0.5)[0] + 60, at(0.3, 0.5)[1] - 13, 120, 26] },
  ],
  expected: [],
};

const w3NodeOnNode: CorpusCard = {
  name: 'W3 invalid — two nodes on top of each other',
  elements: [map(), node('n1', 0.4, 0.5), node('n2', 0.4025, 0.5)],
  expected: [W3],
};

const w3LabelOnNode: CorpusCard = {
  name: 'W3 invalid — a label written across a node',
  elements: [
    map(),
    node('n1', 0.5, 0.5),
    // Starts 20 units left of the node centre: straight over it.
    { ...label('l1', 0.5, 0.5), xywh: [at(0.5, 0.5)[0] - 20, at(0.5, 0.5)[1] - 13, 120, 26] },
  ],
  expected: [W3],
};

const w3LabelOnLink: CorpusCard = {
  name: 'W3 invalid — a label crossed out by the dependency under it',
  elements: (() => {
    const [x, y] = at(0.5, 0.5);
    return [
      map(),
      {
        id: 'd1',
        role: WARDLEY_ROLE.dependency,
        xywh: [x - 200, y - 1, 400, 2] as [number, number, number, number],
        path: [
          [x - 200, y],
          [x + 200, y],
        ] as [number, number][],
      },
      // The words, not just the box: this is the only invalid label/link card,
      // so it is the one that has to go through the ink geometry.
      { ...label('l1', 0.5, 0.5), xywh: [x - 60, y - 13, 120, 26] as [number, number, number, number] },
    ];
  })(),
  expected: [W3],
};

// ── W4 · a provider may not sit above its consumer ─────────────────────

const w4Descending: CorpusCard = (() => {
  const consumer = node('n1', 0.3, 0.25);
  const provider = node('n2', 0.5, 0.7);
  return {
    name: 'W4 valid — the consumer above what it needs',
    elements: [map(), consumer, provider, needs('d1', consumer, provider)],
    expected: [],
  };
})();

const w4Level: CorpusCard = (() => {
  // 10 units apart on a 900-high map: inside the declared 2% slack. A chain
  // gets lined up before it gets spread out, and that is not a mistake.
  const consumer: CorpusElement = { ...node('n1', 0.3, 0.5) };
  const provider: CorpusElement = {
    ...node('n2', 0.5, 0.5),
    xywh: [at(0.5, 0.5)[0] - 9, at(0.5, 0.5)[1] - 9 + 10, 18, 18],
  };
  return {
    name: 'W4 valid — two components drawn level, inside the tolerance',
    elements: [map(), consumer, provider, needs('d1', consumer, provider)],
    expected: [],
  };
})();

const w4Inverted: CorpusCard = (() => {
  // The consumer is BELOW what it needs: the value chain says the opposite of
  // what the map means.
  const consumer = node('n1', 0.3, 0.7);
  const provider = node('n2', 0.5, 0.25);
  return {
    name: 'W4 invalid — the provider sits above its consumer',
    elements: [map(), consumer, provider, needs('d1', consumer, provider)],
    expected: [W4],
    expectedIds: [`${W4}:d1+n1+n2`],
  };
})();

const w4Cycle: CorpusCard = (() => {
  // A ↔ B: two edges, judged as two edges. One of them necessarily runs against
  // the order, and it is the one reported — no graph closure, no cycle
  // detection, and no verdict on the pair as a whole.
  const high = node('n1', 0.35, 0.7);
  const low = node('n2', 0.6, 0.3);
  return {
    name: 'W4 invalid — a cycle A↔B, whose downhill half is reported',
    elements: [map(), high, low, needs('d1', low, high), needs('d2', high, low)],
    expected: [W4],
    expectedIds: [`${W4}:d2+n1+n2`],
  };
})();

const w4UnboundEnd: CorpusCard = (() => {
  const consumer = node('n1', 0.3, 0.7);
  const provider = node('n2', 0.5, 0.25);
  const floating = needs('d1', consumer, provider);
  // The link tool released over empty canvas, and the palette's own "Link"
  // swatch: an edge bound to nothing relates nothing, whatever its geometry
  // says. Same guard the hover reveal applies.
  delete floating.target;
  return {
    name: 'W4 valid — an edge with a free end is never evaluated',
    elements: [map(), consumer, provider, floating],
    expected: [],
  };
})();

const w4AcrossTwoMaps: CorpusCard = (() => {
  const consumer = node('n1', 0.3, 0.7);
  // On the SECOND map, 2000 units to the right. "Higher than" is a question
  // inside one frame of reference, and two maps have two.
  const provider: CorpusElement = {
    id: 'n2',
    role: WARDLEY_ROLE.component,
    xywh: [2000 + 400, 200, 18, 18],
  };
  const secondMap: CorpusElement = {
    id: 'map2',
    role: WARDLEY_ROLE.map,
    xywh: [2000, 0, 1600, 900],
  };
  return {
    name: 'W4 valid — a pair straddling two maps is not compared',
    elements: [
      map(),
      secondMap,
      consumer,
      provider,
      needs('d1', consumer, provider),
    ],
    expected: [],
  };
})();

const w4ChangeArrow: CorpusCard = (() => {
  // The same inverted geometry, under a CHANGE ARROW. It is oriented too, and
  // its verb is not "depends on" — W4 is written on one role and reads no
  // other. It runs forward along evolution, so W1 stays quiet as well.
  const from = node('n1', 0.3, 0.7);
  const to = node('n2', 0.6, 0.25);
  return {
    name: 'W4 valid — a change arrow says nothing about who depends on whom',
    elements: [
      map(),
      from,
      to,
      needs('a1', from, to, WARDLEY_ROLE.changeArrow),
    ],
    expected: [],
  };
})();

/**
 * The invalid twin of {@link w3NamesApart}: same two names, close enough that
 * the WORDS overlap and not just the boxes.
 */
const w3NamesOnTopOfEachOther: CorpusCard = {
  name: 'W3 invalid — two names written over each other',
  elements: [
    map(),
    label('l1', 0.35, 0.6),
    { ...label('l2', 0.35, 0.6), xywh: [at(0.35, 0.6)[0] + 30, at(0.35, 0.6)[1] - 13, 120, 26] },
  ],
  expected: [W3],
};

/**
 * Cards that say nothing at all, whatever is on them — the proportionality
 * half of the recipe. A rule that fires here is a rule that has escaped its
 * roles.
 */
const neutralBoard: CorpusCard = {
  name: 'neutral — a board of generalist shapes, evaluated by nothing',
  elements: [
    map(),
    { id: 's1', xywh: [400, 400, 40, 40] },
    { id: 's2', xywh: [410, 410, 40, 40] },
    { id: 't1', xywh: [405, 405, 120, 26] },
    {
      id: 'c1',
      xywh: [300, 300, 200, 2],
      path: [
        [500, 300],
        [300, 300],
      ],
    },
  ],
  expected: [],
};

const legacyMap: CorpusCard = {
  name: 'legacy — a map authored before these roles existed stays a sketch',
  elements: [
    // Same element geometry as the invalid cards, with no role anywhere: an
    // old document is never retro-validated.
    { id: 'map', xywh: [0, 0, 1600, 900] },
    { id: 'a1', xywh: [400, 400, 300, 2], path: [[700, 400], [400, 400]] },
    { id: 'i1', xywh: [800, 300, 8, 44] },
    { id: 'n1', xywh: [640, 450, 18, 18] },
    { id: 'n2', xywh: [644, 450, 18, 18] },
  ],
  expected: [],
};

/**
 * A whole map that is wrong in SEVERAL ways at once — the case the micro-cards
 * cannot reach.
 *
 * Each fixture above isolates one rule on a handful of elements, which proves
 * the rule fires and nothing about what happens when a real map is in play: an
 * over-eager rule shows up as a companion finding on a busy card, not on a card
 * with two nodes on it. This one carries every role, twenty-odd elements, and
 * names EXACTLY the five findings it deserves — so anything extra fails just as
 * loudly as anything missing.
 */
const crowdedMap: CorpusCard = (() => {
  const { link: crossingLink, point } = crossing('d-cross', 0.55, 1);
  // A BOUND chain, in its own corner: two links drawn the right way round and
  // one drawn upside-down. The unbound links elsewhere on this card are the
  // control — W4 must walk past them without a word.
  // `fy` is a fraction of the map BOX, so a smaller one is higher on screen and
  // more visible.
  const top = node('chainTop', 0.62, 0.2);
  const middle = node('chainMid', 0.68, 0.55);
  const bottom = node('chainLow', 0.74, 0.9);
  return {
    name: 'a whole map wrong in several ways at once',
    elements: [
      map(),

      // ── conformant half: none of this may raise anything ──────────────
      node('ok1', 0.15, 0.8),
      label('okL1', 0.17, 0.8),
      node('ok2', 0.45, 0.62),
      label('okL2', 0.47, 0.62),
      node('ok3', 0.8, 0.25),
      label('okL3', 0.82, 0.25),
      link('okD1', [0.16, 0.78], [0.44, 0.64]),
      link('okD2', [0.46, 0.6], [0.79, 0.27]),
      arrow('okA1', [0.16, 0.85], [0.5, 0.85]),
      node('anchor1', 0.3, 0.95, WARDLEY_ROLE.anchor),
      crossingLink,
      inertia('okBar', point[0], point[1]),

      // ── W1 ×1: an arrow heading back towards genesis ───────────────────
      arrow('badArrow', [0.85, 0.1], [0.3, 0.1]),

      // ── W2 ×1: a bar on the crossing link, mid-phase ───────────────────
      inertia('badBar', point[0] + 200, point[1]),

      // ── W3 ×3: node/node, label/node, label/link ───────────────────────
      // Each in its own corner of the map, so the card names three findings
      // because three things are wrong — not because one mistake was reported
      // from three angles.
      node('pileA', 0.15, 0.35),
      node('pileB', 0.1525, 0.35),
      node('solo', 0.35, 0.25),
      label('overNode', 0.35, 0.25),
      label('overLink', 0.3, 0.7),

      // ── W4 ×1: one link of a bound chain drawn upside-down ─────────────
      top,
      middle,
      bottom,
      needs('chainOk', top, middle),
      needs('chainBad', bottom, middle),
    ],
    expected: [W1, W2, W3, W3, W3, W4],
    // Named element by element: on a card this size, "three overlaps" would be
    // satisfied just as well by three WRONG ones.
    expectedIds: [
      `${W1}:badArrow`,
      `${W2}:badBar`,
      `${W3}:okD1+overLink`,
      `${W3}:overNode+solo`,
      `${W3}:pileA+pileB`,
      `${W4}:chainBad+chainLow+chainMid`,
    ],
  };
})();

export const WARDLEY_CORPUS: readonly CorpusCard[] = [
  w1Forward,
  w1Diagonal,
  w1Backwards,
  w2OnTransition,
  w2SecondTransition,
  w2FloatingBar,
  w2MidPhase,
  w2OnDividerNoCarrier,
  w3Clean,
  w3Tight,
  w3LinkInTheMargin,
  w3NamesApart,
  w3NodeOnNode,
  w3LabelOnNode,
  w3LabelOnLink,
  w3NamesOnTopOfEachOther,
  w4Descending,
  w4Level,
  w4Inverted,
  w4Cycle,
  w4UnboundEnd,
  w4AcrossTwoMaps,
  w4ChangeArrow,
  crowdedMap,
  neutralBoard,
  legacyMap,
];

/**
 * A card turned into what the engine reads: `id`, `role`, `elementBound`, and
 * for an edge the routed `absolutePath`. `elementBound` is a GETTER that
 * allocates, exactly like the real accessor.
 *
 * `profile` is written on the map element — the only element a level of
 * requirement can be chosen on.
 */
export function cardElements(
  card: CorpusCard,
  profile?: string
): GfxPrimitiveElementModel[] {
  return card.elements.map(
    el =>
      ({
        id: el.id,
        role: el.role,
        ...(el.id === 'map' && profile !== undefined
          ? { validationProfile: profile }
          : {}),
        ...(el.path ? { absolutePath: el.path } : {}),
        // The two ends, shaped exactly like a connector's `Connection`: an id
        // when the edge is bound, nothing at all when it is not.
        ...(el.source ? { source: { id: el.source } } : {}),
        ...(el.target ? { target: { id: el.target } } : {}),
        ...(el.text !== undefined
          ? {
              text: el.text,
              fontSize: el.fontSize,
              textAlign: el.textAlign,
            }
          : {}),
        get elementBound() {
          return new Bound(...el.xywh);
        },
      }) as unknown as GfxPrimitiveElementModel
  );
}
