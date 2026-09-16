import {
  makeTemplateSnapshot,
  type SurfaceElementsJSON,
  surfaceText,
  surfaceYMap,
  type Template,
} from '@labre/affine-gfx-template';
import {
  ConnectorMode,
  FontFamily,
  PointStyle,
  ShapeStyle,
  StrokeStyle,
  TextAlign,
} from '@labre/affine-model';
import {
  type ChromeWording,
  translateKey,
} from '@labre/affine-shared/services';
import type { BlockStdScope } from '@labre/std';

import { COLORS } from '../consts';
import {
  INERTIA_COLOR,
  LINK_GREY,
  LINK_STROKE_WIDTH,
  NODE_FILL,
  NODE_SIZE,
  NODE_STROKE,
  WARDLEY_RED,
} from '../node/consts';
import {
  backgroundPlot,
  backgroundZoneBoundaries,
} from '@labre/affine-block-surface';

import { WARDLEY_BACKGROUND } from '../background';
import {
  WARDLEY_LABEL_H,
  wardleyInertiaProps,
  wardleyLabelProps,
  wardleyNodeProps,
} from '../presets';
import { WARDLEY_ROLE } from '../roles';

/**
 * Authoring kit for canonical Wardley maps. Positions are given as
 * (evolution 0..1, value 0..1) and mapped into the plot interior of a fixed
 * 1600x900 background. Per the composition principle, every glyph reuses an
 * existing shape: stakeholders/users are anchor (person) nodes, "needs" are
 * thick-stroked component nodes, capabilities are component nodes, notes are
 * native rects + text, inertia is the inertia bar, and the future / evolution
 * arrow is the red dashed connector. Legends are produced by the editor's
 * auto-legend action rather than baked into the template.
 */
const W = WARDLEY_BACKGROUND.geometry.width;
const H = WARDLEY_BACKGROUND.geometry.height;

/**
 * The plot these templates lay their nodes out in — THE DECLARATION'S, read off
 * `geometry.margin` rather than copied.
 *
 * It used to be a hand-written `{x:70, y:56, w:1470, h:786}`, inset further than
 * the drawn plot (`x 40 → 1570, y 30 → 862`), with a comment calling the drift
 * "harmless (everything lands inside the map) but not the same number".
 *
 * It stopped being harmless the moment a RULE measured against the plot. W2
 * asks whether an inertia bar sits on a declared phase transition, and a
 * transition is a ratio OF THE PLOT: two plots means an evolution of `0.7` in a
 * template lands 25 units away from the `0.7` the background draws. The
 * templates were laid out in one frame of reference and judged in another.
 *
 * Deriving it removes the possibility. The nodes of every preset move by a few
 * units, which is a visual change to FACTORY CONTENT — acceptable, and the
 * reason this could be fixed at the source rather than worked around: no user
 * document is touched, because a template is data we ship, not data they wrote.
 */
const PLOT = backgroundPlot(WARDLEY_BACKGROUND, W, H);
const PL = { x: PLOT.x0, y: PLOT.y0, w: PLOT.width, h: PLOT.height };
const ex = (e: number) => PL.x + e * PL.w;
const vy = (v: number) => PL.y + (1 - v) * PL.h;
const D = NODE_SIZE; // 18

/** The evolution transitions, as plot ratios, straight from the declaration. */
const PHASES = backgroundZoneBoundaries(WARDLEY_BACKGROUND).x;

/**
 * Where the segment `from → to` crosses the evolution transition at `PHASES[i]`,
 * in (evolution, value) coordinates.
 *
 * This is where an inertia bar belongs: astride the boundary the thing refuses
 * to cross — which is all W2 asks since the PO spelled it out (02/08/2026) — and
 * on the dependency that would have to move, which the rule no longer demands
 * and a well-drawn map still shows. Computed rather than eyeballed, so the
 * symbol stays on both whatever the declaration says either of them is.
 */
function crossing(
  from: readonly [number, number],
  to: readonly [number, number],
  i: number
): [number, number] {
  const at = PHASES[i];
  const t = (at - from[0]) / (to[0] - from[0]);
  return [at, from[1] + t * (to[1] - from[1])];
}

// The map carries `wardley:map`: rules position artefacts against the ROLE, so
// a templated map is a first-class frame like a hand-drawn one — and since
// PF13.4 every artefact these presets lay on it (nodes, labels, links, change
// arrows, inertia bars) carries the same role the toolbox writes.
const bg = (variant = 'classic') => ({
  type: WARDLEY_BACKGROUND.type,
  role: WARDLEY_BACKGROUND.role,
  resizeEnabled: WARDLEY_BACKGROUND.geometry.resizable,
  variant,
  xywh: `[0,0,${W},${H}]`,
});

/**
 * A component of a shipped map, at (evolution, value).
 *
 * {@link wardleyNodeProps} says what a component IS; the two overrides are
 * NOTATION and stay: a thick rim marks a user "need", and a red one marks the
 * future position of a capability that has not moved yet.
 */
function dot(
  e: number,
  v: number,
  sw: number,
  stroke = NODE_STROKE,
  fill = NODE_FILL
) {
  const cx = ex(e);
  const cy = vy(v);
  return {
    ...wardleyNodeProps('component', {
      xywh: `[${cx - D / 2},${cy - D / 2},${D},${D}]`,
    }),
    fillColor: fill,
    strokeColor: stroke,
    strokeWidth: sw,
  };
}
const comp = (e: number, v: number) => dot(e, v, 1);
const future = (e: number, v: number) => dot(e, v, 2, WARDLEY_RED);
/** A stakeholder: an anchor, drawn a third bigger than a component. */
function stake(e: number, v: number) {
  const cx = ex(e);
  const cy = vy(v);
  const d = 24;
  return wardleyNodeProps('anchor', {
    xywh: `[${cx - d / 2},${cy - d / 2},${d},${d}]`,
  });
}

type LblOpts = {
  dx?: number;
  dy?: number;
  align?: 'left' | 'right' | 'center';
  color?: string;
  size?: number;
  w?: number;
  /**
   * Drop the label role — for a text that names no artefact.
   *
   * The same call `connect`'s `typed: false` makes in the palette: W3 is
   * written about the NAME of a thing, and "limited by" is a remark about a
   * LINK. A role there would put the annotation in the same conversation as
   * the components it sits between.
   */
  neutral?: boolean;
};
function lbl(e: number, v: number, text: string, o: LblOpts = {}) {
  const cx = ex(e);
  const cy = vy(v);
  // 200 rather than the toolbox's `WARDLEY_LABEL_W`: a shipped map names
  // things like "Capture a moment", and a box narrower than its words wraps
  // them onto two lines. The width is layout, not notation — what the preset
  // owns is everything else about the label.
  const w = o.w ?? 200;
  const dx = o.dx ?? 12;
  const dy = o.dy ?? -10;
  const align = o.align ?? 'left';
  const x =
    align === 'right' ? cx - w - dx : align === 'center' ? cx - w / 2 : cx + dx;
  return {
    // The NAME of an artefact — {@link wardleyLabelProps} says what that is.
    // The free texts these presets also use for notes and legends stay neutral:
    // they name nothing and nothing measures them.
    ...wardleyLabelProps(text, x, cy + dy, align),
    // A snapshot stores the words as a serialized `Y.Text`, where
    // `addElement` takes a plain string.
    text: surfaceText(text),
    // A wider box for a long name; the deliberate departures a shipped map
    // makes on top of the preset.
    xywh: `[${x},${cy + dy},${w},${WARDLEY_LABEL_H}]`,
    ...(o.size === undefined ? {} : { fontSize: o.size }),
    ...(o.color === undefined ? {} : { color: o.color }),
    ...(o.neutral ? { role: undefined } : {}),
  };
}

/**
 * The group a node and its name travel as — what the toolbox has written since
 * #51 and what these maps had never carried, so dragging a component out of a
 * shipped map left its name behind.
 */
const pair = (node: string, label: string) => ({
  type: 'group',
  children: surfaceYMap({ [node]: true, [label]: true }),
});

/**
 * A link between two nodes of a shipped map.
 *
 * `evolution` is the ONE predicate that decides what the stroke MEANS — the
 * same flag `templates/index.ts` reads, aligned by `docs/adr/0010`
 * § Compatibility. It used to be `arrow` here and `red` there, so a red SOLID
 * Kodak link was a typed dependency while a red sample in the palette was not:
 * two answers to "is this a dependency?" in one framework, in neighbouring
 * files. Harmless as a style inconsistency, semantic the moment W4 reads these
 * edges.
 *
 * `red` stays, and stays orthogonal: it colours a DEPENDENCY red (Kodak's
 * future chain) without changing what it is. Colour is never what decides a
 * relation's type.
 *
 * The direction is meaning, not decoration: `a` is the consumer, `b` is what it
 * needs, and every one of the twelve links these presets ship respects it
 * (a corpus test walks them and fails loudly the day one does not).
 */
function link(
  a: string,
  b: string,
  o: { red?: boolean; evolution?: boolean } = {}
) {
  return {
    type: 'connector',
    mode: ConnectorMode.Straight,
    // An evolution arrow is a movement annotation, not a dependency — same
    // split as the two Wardley connector tools, and since PF13.4 both sides of
    // that split carry a role.
    role: o.evolution ? WARDLEY_ROLE.changeArrow : WARDLEY_ROLE.dependency,
    stroke: o.red || o.evolution ? WARDLEY_RED : LINK_GREY,
    strokeStyle: o.evolution ? StrokeStyle.Dash : StrokeStyle.Solid,
    strokeWidth: LINK_STROKE_WIDTH,
    frontEndpointStyle: PointStyle.None,
    rearEndpointStyle: o.evolution ? PointStyle.Triangle : PointStyle.None,
    source: { id: a },
    target: { id: b },
  };
}

function inertia(e: number, v: number) {
  const cx = ex(e);
  const cy = vy(v);
  return wardleyInertiaProps({ xywh: `[${cx - 4},${cy - 22},8,44]` });
}

function panel(x: number, y: number, w: number, h: number) {
  return {
    type: 'shape',
    shapeType: 'rect',
    filled: true,
    fillColor: NODE_FILL,
    strokeColor: NODE_STROKE,
    strokeWidth: 1.2,
    shapeStyle: ShapeStyle.General,
    roughness: 0,
    radius: 0,
    xywh: `[${x},${y},${w},${h}]`,
  };
}
function freeText(
  x: number,
  y: number,
  w: number,
  str: string,
  size = 16,
  color = NODE_STROKE
) {
  return {
    type: 'text',
    text: surfaceText(str),
    color,
    fontFamily: FontFamily.Inter,
    fontSize: size,
    textAlign: TextAlign.Left,
    xywh: `[${x},${y},${w},26]`,
  };
}
/** Centred, enlarged map title spanning the plot width. */
function title(str: string) {
  return {
    type: 'text',
    text: surfaceText(str),
    color: NODE_STROKE,
    fontFamily: FontFamily.Inter,
    fontSize: 28,
    textAlign: TextAlign.Center,
    xywh: `[${W / 2 - 500},12,1000,40]`,
  };
}

const ATTRS =
  'width="100%" height="100%" viewBox="0 0 135 80" xmlns="http://www.w3.org/2000/svg"';
const mapPreview = (extra: string) =>
  `<svg ${ATTRS} fill="none"><path d="M22 12 V64 H120" stroke="${COLORS.axis}" stroke-width="2"/>${extra}</svg>`;

/**
 * The seeds the two worked maps write — declared once so the builders below
 * and the manifest (`../translations.ts`) read the very same fallback, never
 * a restated literal. `com.labre.wardley.example.<map>.<slug>`, per
 * `docs/adr/0023`.
 */
export const TEA_SHOP_SEED = {
  title: {
    key: 'com.labre.wardley.example.tea-shop.title',
    fallback: 'Tea Shop',
  },
  annotations: {
    key: 'com.labre.wardley.example.tea-shop.annotations',
    fallback:
      'Annotations:\n1. Standardising power lets kettles evolve faster\n2. Hot water is obvious and well known',
  },
  business: {
    key: 'com.labre.wardley.example.tea-shop.business',
    fallback: 'Business',
  },
  public: {
    key: 'com.labre.wardley.example.tea-shop.public',
    fallback: 'Public',
  },
  cupOfTea: {
    key: 'com.labre.wardley.example.tea-shop.cup-of-tea',
    fallback: 'Cup of Tea',
  },
  cup: { key: 'com.labre.wardley.example.tea-shop.cup', fallback: 'Cup' },
  tea: { key: 'com.labre.wardley.example.tea-shop.tea', fallback: 'Tea' },
  hotWater: {
    key: 'com.labre.wardley.example.tea-shop.hot-water',
    fallback: 'Hot Water',
  },
  water: { key: 'com.labre.wardley.example.tea-shop.water', fallback: 'Water' },
  kettle: {
    key: 'com.labre.wardley.example.tea-shop.kettle',
    fallback: 'Kettle',
  },
  electricKettle: {
    key: 'com.labre.wardley.example.tea-shop.electric-kettle',
    fallback: 'Electric Kettle',
  },
  power: { key: 'com.labre.wardley.example.tea-shop.power', fallback: 'Power' },
  limitedBy: {
    key: 'com.labre.wardley.example.tea-shop.limited-by',
    fallback: 'limited by',
  },
} as const;

export const KODAK_INERTIA_SEED = {
  title: {
    key: 'com.labre.wardley.example.kodak-inertia.title',
    fallback: "Wardley map of Kodak's 2005 inertia to digital",
  },
  user: {
    key: 'com.labre.wardley.example.kodak-inertia.user',
    fallback: 'User',
  },
  captureAMoment: {
    key: 'com.labre.wardley.example.kodak-inertia.capture-a-moment',
    fallback: 'Capture a moment',
  },
  filmCamera: {
    key: 'com.labre.wardley.example.kodak-inertia.film-camera',
    fallback: 'Film camera',
  },
  digitalCamera: {
    key: 'com.labre.wardley.example.kodak-inertia.digital-camera',
    fallback: 'Digital camera',
  },
  photographicFilm: {
    key: 'com.labre.wardley.example.kodak-inertia.photographic-film',
    fallback: 'Photographic film',
  },
  digitalStorage: {
    key: 'com.labre.wardley.example.kodak-inertia.digital-storage',
    fallback: 'Digital storage',
  },
} as const;

/**
 * One seed's resolved text — the host's catalogue when `std` is a real
 * inserting editor, the English fallback when building the module's own
 * `content` (no editor exists yet at that point).
 */
function seedText(
  std: BlockStdScope | undefined,
  def: { key: string; fallback: string }
): string {
  return std ? translateKey(std, def.key, def.fallback) : def.fallback;
}

/**
 * A shipped map — what is left once the artefacts are derived.
 *
 * `build` takes the OPTIONAL inserting editor: called with none, at module
 * load, for the English `content`; called again with the real `std` as
 * {@link Template.localize}, so the two builds read the very same layout and
 * differ only in the words a seed resolves to (`docs/adr/0023`).
 */
function tpl(
  name: string,
  preview: string,
  build: (std?: BlockStdScope) => SurfaceElementsJSON,
  nameKey?: string
): Template {
  return {
    name,
    type: 'template',
    preview,
    nameKey,
    content: makeTemplateSnapshot(build(), name),
    localize: std => makeTemplateSnapshot(build(std), name),
  };
}

/** The two worked maps' own tile names (`Template.nameKey`). */
export const WARDLEY_TEMPLATE_NAME_TEA_SHOP: ChromeWording = [
  'com.labre.wardley.template.tea-shop',
  'Tea Shop',
];
export const WARDLEY_TEMPLATE_NAME_KODAK_INERTIA: ChromeWording = [
  'com.labre.wardley.template.kodak-inertia',
  'Kodak inertia',
];

function ann(e: number, v: number) {
  const cx = ex(e);
  const cy = vy(v);
  return {
    type: 'shape',
    shapeType: 'ellipse',
    filled: true,
    fillColor: NODE_FILL,
    strokeColor: NODE_STROKE,
    strokeWidth: 1.5,
    shapeStyle: ShapeStyle.General,
    roughness: 0,
    xywh: `[${cx - 14},${cy - 14},28,28]`,
  };
}
function annTxt(e: number, v: number, n: string) {
  const cx = ex(e);
  const cy = vy(v);
  return {
    type: 'text',
    text: surfaceText(n),
    color: NODE_STROKE,
    fontFamily: FontFamily.Inter,
    fontSize: 14,
    textAlign: TextAlign.Center,
    xywh: `[${cx - 14},${cy - 9},28,20]`,
  };
}

// ── Tea Shop (the canonical map) ──────────────────────────────────────
function teaShop(std?: BlockStdScope): SurfaceElementsJSON {
  const s = (def: (typeof TEA_SHOP_SEED)[keyof typeof TEA_SHOP_SEED]) =>
    seedText(std, def);
  return {
    bg: bg(),
    title: title(s(TEA_SHOP_SEED.title)),
    annBox: panel(120, 200, 420, 64),
    annText: freeText(132, 208, 400, s(TEA_SHOP_SEED.annotations), 13),
    business: stake(0.62, 0.93),
    businessL: lbl(0.62, 0.93, s(TEA_SHOP_SEED.business), {
      align: 'center',
      dy: -28,
      w: 120,
    }),
    businessG: pair('business', 'businessL'),
    public: stake(0.78, 0.93),
    publicL: lbl(0.78, 0.93, s(TEA_SHOP_SEED.public), {
      align: 'center',
      dy: -28,
      w: 120,
    }),
    publicG: pair('public', 'publicL'),
    cupOfTea: comp(0.62, 0.74),
    cupOfTeaL: lbl(0.62, 0.74, s(TEA_SHOP_SEED.cupOfTea), { align: 'right' }),
    cupOfTeaG: pair('cupOfTea', 'cupOfTeaL'),
    cup: comp(0.8, 0.7),
    cupL: lbl(0.8, 0.7, s(TEA_SHOP_SEED.cup)),
    cupG: pair('cup', 'cupL'),
    tea: comp(0.83, 0.6),
    teaL: lbl(0.83, 0.6, s(TEA_SHOP_SEED.tea)),
    teaG: pair('tea', 'teaL'),
    hotWater: comp(0.8, 0.47),
    hotWaterL: lbl(0.8, 0.47, s(TEA_SHOP_SEED.hotWater)),
    hotWaterG: pair('hotWater', 'hotWaterL'),
    water: comp(0.81, 0.34),
    waterL: lbl(0.81, 0.34, s(TEA_SHOP_SEED.water)),
    waterG: pair('water', 'waterL'),
    kettle: comp(0.36, 0.38),
    kettleL: lbl(0.36, 0.38, s(TEA_SHOP_SEED.kettle), {
      align: 'right',
      dy: 6,
    }),
    kettleG: pair('kettle', 'kettleL'),
    electric: future(0.56, 0.38),
    electricL: lbl(0.56, 0.38, s(TEA_SHOP_SEED.electricKettle)),
    electricG: pair('electric', 'electricL'),
    power: comp(0.7, 0.1),
    powerL: lbl(0.7, 0.1, s(TEA_SHOP_SEED.power), { align: 'right', dy: 6 }),
    powerG: pair('power', 'powerL'),
    powerFut: future(0.88, 0.1),
    powerFutL: lbl(0.88, 0.1, s(TEA_SHOP_SEED.power)),
    powerFutG: pair('powerFut', 'powerFutL'),
    // ABOVE the link it annotates, not across it. Written on the line it reads
    // as a label nobody can read — which is the finding W3 raises, and it was
    // raising it on the map that ships as the canonical example.
    //
    // NEUTRAL: it is a remark about a LINK, not the name of an artefact, so it
    // travels with nothing and nothing measures it (see `LblOpts.neutral`).
    limitedBy: lbl(0.56, 0.43, s(TEA_SHOP_SEED.limitedBy), {
      align: 'center',
      w: 120,
      size: 13,
      dy: -34,
      neutral: true,
    }),
    ann1a: ann(0.5, 0.385),
    ann1t: annTxt(0.5, 0.385, '1'),
    ann2a: ann(0.84, 0.45),
    ann2t: annTxt(0.84, 0.45, '2'),
    l1: link('business', 'cupOfTea'),
    l2: link('public', 'cupOfTea'),
    l3: link('cupOfTea', 'cup'),
    l4: link('cupOfTea', 'tea'),
    l5: link('cupOfTea', 'hotWater'),
    l6: link('hotWater', 'water'),
    l7: link('hotWater', 'kettle'),
    l8: link('kettle', 'power'),
    a1: link('kettle', 'electric', { evolution: true }),
    a2: link('power', 'powerFut', { evolution: true }),
  };
}

// ── Kodak inertia (2005) ──────────────────────────────────────────────
function kodak(std?: BlockStdScope): SurfaceElementsJSON {
  const s = (
    def: (typeof KODAK_INERTIA_SEED)[keyof typeof KODAK_INERTIA_SEED]
  ) => seedText(std, def);
  // The future dependency `capture → storage` is the movement Kodak resisted,
  // and the inertia bar belongs where that dependency crosses into commodity —
  // the boundary the capability refused to cross. It used to sit 105 units away
  // from any transition: the template named after inertia was the
  // counter-example to the inertia rule. Computed from the two node positions
  // and the declared transitions, so it cannot drift again — and the bar comes
  // out centred on the divider, which is exactly what W2 asks of it now that
  // "astride the transition" is the whole of the rule.
  const CAPTURE = [0.53, 0.8] as const;
  const STORAGE = [0.84, 0.4] as const;
  const [barE, barV] = crossing(CAPTURE, STORAGE, 2);

  return {
    bg: bg(),
    title: title(s(KODAK_INERTIA_SEED.title)),
    user: stake(0.54, 0.92),
    userL: lbl(0.54, 0.92, s(KODAK_INERTIA_SEED.user)),
    userG: pair('user', 'userL'),
    capture: dot(CAPTURE[0], CAPTURE[1], 3),
    // To the LEFT, like the other two capability names: to the right of this
    // node runs the future dependency towards digital storage, and a name
    // written across the line that carries the whole argument is exactly the
    // case W3 exists for.
    captureL: lbl(
      CAPTURE[0],
      CAPTURE[1],
      s(KODAK_INERTIA_SEED.captureAMoment),
      {
        align: 'right',
      }
    ),
    captureG: pair('capture', 'captureL'),
    film: comp(0.52, 0.62),
    filmL: lbl(0.52, 0.62, s(KODAK_INERTIA_SEED.filmCamera), {
      align: 'right',
    }),
    filmG: pair('film', 'filmL'),
    digital: future(0.74, 0.62),
    digitalL: lbl(0.74, 0.62, s(KODAK_INERTIA_SEED.digitalCamera), {
      color: WARDLEY_RED,
    }),
    digitalG: pair('digital', 'digitalL'),
    roll: comp(0.52, 0.4),
    rollL: lbl(0.52, 0.4, s(KODAK_INERTIA_SEED.photographicFilm), {
      align: 'right',
    }),
    rollG: pair('roll', 'rollL'),
    storage: future(STORAGE[0], STORAGE[1]),
    storageL: lbl(
      STORAGE[0],
      STORAGE[1],
      s(KODAK_INERTIA_SEED.digitalStorage),
      {
        color: WARDLEY_RED,
      }
    ),
    storageG: pair('storage', 'storageL'),
    inertiaBar: inertia(barE, barV),
    l1: link('user', 'capture'),
    l2: link('capture', 'film'),
    l3: link('film', 'roll'),
    r1: link('capture', 'storage', { red: true }),
    a1: link('film', 'digital', { evolution: true }),
    a2: link('roll', 'storage', { evolution: true }),
  };
}

export const wardleyMaps: Template[] = [
  tpl(
    'Tea Shop',
    mapPreview(
      `<circle cx="78" cy="24" r="3" fill="${NODE_FILL}" stroke="${NODE_STROKE}"/><circle cx="50" cy="44" r="3" fill="${NODE_FILL}" stroke="${NODE_STROKE}"/><circle cx="86" cy="40" r="3" fill="${NODE_FILL}" stroke="${NODE_STROKE}"/><circle cx="92" cy="58" r="3" fill="${NODE_FILL}" stroke="${NODE_STROKE}"/><path d="M78 24 L50 44 M78 24 L86 40 L92 58" stroke="${LINK_GREY}"/><path d="M50 44 h22" stroke="${WARDLEY_RED}" stroke-dasharray="3 2"/>`
    ),
    teaShop,
    WARDLEY_TEMPLATE_NAME_TEA_SHOP[0]
  ),
  tpl(
    'Kodak inertia',
    mapPreview(
      `<circle cx="56" cy="22" r="3" fill="${NODE_FILL}" stroke="${NODE_STROKE}"/><circle cx="54" cy="40" r="3" fill="${NODE_FILL}" stroke="${NODE_STROKE}"/><circle cx="86" cy="40" r="3" fill="${NODE_FILL}" stroke="${WARDLEY_RED}"/><rect x="76" y="35" width="2.5" height="11" fill="${INERTIA_COLOR}"/><path d="M57 40 h17" stroke="${WARDLEY_RED}" stroke-dasharray="3 2"/>`
    ),
    kodak,
    WARDLEY_TEMPLATE_NAME_KODAK_INERTIA[0]
  ),
];
