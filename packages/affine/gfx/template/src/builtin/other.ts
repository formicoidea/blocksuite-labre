import {
  ConnectorMode,
  FontFamily,
  FontWeight,
  PointStyle,
  ShapeStyle,
  StrokeStyle,
  TextAlign,
} from '@labre/affine-model';
import { NOTATION_NEUTRALS } from '@labre/affine-shared/consts';
import {
  type ChromeWording,
  fillPlaceholders,
  translateKey,
  type TranslationParams,
} from '@labre/affine-shared/services';
import type { BlockStdScope } from '@labre/std';

import {
  makeTemplateSnapshot,
  type SurfaceElementsJSON,
  surfaceText,
} from '../make-snapshot.js';
import type { Template, TemplateCategory } from '../toolbar/template-type.js';
import {
  BMC_SEED_CHANNELS,
  BMC_SEED_COST_STRUCTURE,
  BMC_SEED_CUSTOMER_RELATIONSHIPS,
  BMC_SEED_CUSTOMER_SEGMENTS,
  BMC_SEED_DATE,
  BMC_SEED_DESIGNED_BY,
  BMC_SEED_DESIGNED_FOR,
  BMC_SEED_KEY_ACTIVITIES,
  BMC_SEED_KEY_PARTNERSHIPS,
  BMC_SEED_KEY_RESOURCES,
  BMC_SEED_REVENUE_STREAMS,
  BMC_SEED_TITLE,
  BMC_SEED_VALUE_PROPOSITIONS,
  BMC_SEED_VERSION,
  FISHBONE_SEED_CATEGORY,
  FISHBONE_SEED_EFFECT,
  FISHBONE_SEED_ITEM_1,
  FISHBONE_SEED_ITEM_2,
  GANTT_SEED_BUILD,
  GANTT_SEED_DESIGN,
  GANTT_SEED_DISCOVERY,
  GANTT_SEED_LAUNCH,
  GANTT_SEED_WEEK,
  KANBAN_SEED_CARD,
  KANBAN_SEED_DOING,
  KANBAN_SEED_DONE,
  KANBAN_SEED_TODO,
  SWOT_SEED_OPPORTUNITIES,
  SWOT_SEED_STRENGTHS,
  SWOT_SEED_THREATS,
  SWOT_SEED_WEAKNESSES,
  TEMPLATE_NAME_BUSINESS_MODEL_CANVAS,
  TEMPLATE_NAME_FISHBONE,
  TEMPLATE_NAME_GANTT_CHART,
  TEMPLATE_NAME_KANBAN_BOARD,
  TEMPLATE_NAME_SWOT,
  TEMPLATE_PANEL_CATEGORY_OTHER,
} from '../translations.js';

/**
 * The generic ("Other") diagrams: built ONLY from general BlockSuite shapes
 * (`shape` rect/polygon, `text`, `connector`) per the composition principle —
 * they belong to no framework, so they ship from the template package itself.
 */

/**
 * Their neutrals are the shared notation scale's, like every framework's:
 * the ink, the divider grey, the label grey and the card white. Only
 * the hues (kanban cards, gantt bars) are the diagrams' own.
 */
const DARK = NOTATION_NEUTRALS.ink;
const MUTED = NOTATION_NEUTRALS.divider;

type RectOpts = {
  fill?: string;
  stroke?: string;
  sw?: number;
  radius?: number;
  dash?: boolean;
  shapeType?: 'rect' | 'ellipse' | 'diamond' | 'polygon';
  vertices?: number[][];
  text?: string;
  textColor?: string;
  fontSize?: number;
};

function rect(x: number, y: number, w: number, h: number, opts: RectOpts = {}) {
  const el: Record<string, unknown> = {
    type: 'shape',
    shapeType: opts.shapeType ?? 'rect',
    filled: true,
    fillColor: opts.fill ?? NOTATION_NEUTRALS.cardFill,
    strokeColor: opts.stroke ?? DARK,
    strokeWidth: opts.sw ?? 2,
    strokeStyle: opts.dash ? StrokeStyle.Dash : StrokeStyle.Solid,
    shapeStyle: ShapeStyle.General,
    roughness: 0,
    radius: opts.radius ?? 0,
    xywh: `[${x},${y},${w},${h}]`,
  };
  if (opts.vertices) el.vertices = opts.vertices;
  if (opts.text != null) {
    el.text = surfaceText(opts.text);
    el.color = opts.textColor ?? DARK;
    el.fontFamily = FontFamily.Inter;
    el.fontSize = opts.fontSize ?? 14;
    el.textAlign = TextAlign.Center;
  }
  return el;
}

type LabelOpts = {
  color?: string;
  fontSize?: number;
  align?: TextAlign;
  weight?: FontWeight;
};

function label(
  x: number,
  y: number,
  w: number,
  h: number,
  str: string,
  opts: LabelOpts = {}
) {
  return {
    type: 'text',
    text: surfaceText(str),
    color: opts.color ?? DARK,
    fontFamily: FontFamily.Inter,
    fontSize: opts.fontSize ?? 16,
    fontWeight: opts.weight ?? FontWeight.Regular,
    textAlign: opts.align ?? TextAlign.Left,
    xywh: `[${x},${y},${w},${h}]`,
  };
}

type LineOpts = {
  stroke?: string;
  sw?: number;
  dash?: boolean;
  arrow?: boolean;
  mode?: ConnectorMode;
};

function line(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  opts: LineOpts = {}
) {
  return {
    type: 'connector',
    mode: opts.mode ?? ConnectorMode.Straight,
    stroke: opts.stroke ?? DARK,
    strokeWidth: opts.sw ?? 2,
    strokeStyle: opts.dash ? StrokeStyle.Dash : StrokeStyle.Solid,
    frontEndpointStyle: PointStyle.None,
    rearEndpointStyle: opts.arrow ? PointStyle.Triangle : PointStyle.None,
    source: { position: [x1, y1] },
    target: { position: [x2, y2] },
  };
}

/** Resolve a wording through the host, or its English fallback with no host. */
function tr(
  std: BlockStdScope | undefined,
  wording: ChromeWording,
  params?: TranslationParams
): string {
  return std
    ? translateKey(std, ...wording, params)
    : fillPlaceholders(wording[1], params);
}

// ── SWOT (window-mullion quadrant, black labels) ──────────────────────
function swot(std?: BlockStdScope): SurfaceElementsJSON {
  const M = { fontSize: 22, weight: FontWeight.Medium } as const;
  return {
    box: rect(0, 0, 520, 340),
    v: line(260, 0, 260, 340),
    h: line(0, 170, 520, 170),
    s: label(24, 24, 220, 30, tr(std, SWOT_SEED_STRENGTHS), M),
    w: label(284, 24, 220, 30, tr(std, SWOT_SEED_WEAKNESSES), M),
    o: label(24, 194, 220, 30, tr(std, SWOT_SEED_OPPORTUNITIES), M),
    t: label(284, 194, 220, 30, tr(std, SWOT_SEED_THREATS), M),
  };
}

// ── Kanban (To do / Doing / Done) ─────────────────────────────────────
function kanban(std?: BlockStdScope): SurfaceElementsJSON {
  const colOpts = {
    fill: NOTATION_NEUTRALS.cardFill,
    stroke: MUTED,
    sw: 1.5,
    radius: 10,
  };
  const head = {
    fontSize: 18,
    weight: FontWeight.Medium,
    align: TextAlign.Center,
  } as const;
  const cardText = tr(std, KANBAN_SEED_CARD);
  const card = (x: number, y: number, fill: string, stroke: string) =>
    rect(x, y, 188, 60, {
      fill,
      stroke,
      sw: 1.5,
      radius: 8,
      text: cardText,
      fontSize: 14,
    });
  return {
    c1: rect(0, 0, 220, 420, colOpts),
    c2: rect(244, 0, 220, 420, colOpts),
    c3: rect(488, 0, 220, 420, colOpts),
    h1: label(0, 16, 220, 24, tr(std, KANBAN_SEED_TODO), head),
    h2: label(244, 16, 220, 24, tr(std, KANBAN_SEED_DOING), head),
    h3: label(488, 16, 220, 24, tr(std, KANBAN_SEED_DONE), head),
    a1: card(16, 56, '#fde6c8', '#e0a23a'),
    a2: card(16, 128, '#fde6c8', '#e0a23a'),
    b1: card(260, 56, '#d6e4fb', '#4574c4'),
    d1: card(504, 56, '#d5efd9', '#43a06b'),
    d2: card(504, 128, '#d5efd9', '#43a06b'),
  };
}

// ── Business Model Canvas (Strategyzer 9-block layout) ────────────────
function bmc(std?: BlockStdScope): SurfaceElementsJSON {
  const blk = { stroke: DARK, sw: 1.5 } as const;
  const t = (x: number, y: number, s: string) =>
    label(x + 12, y + 12, 180, 22, s, {
      fontSize: 14,
      weight: FontWeight.Medium,
    });
  const hdr = (x: number, s: string) => ({
    box: rect(x, 8, 128, 34, { stroke: MUTED, sw: 1 }),
    txt: label(x + 8, 16, 120, 18, s, {
      fontSize: 11,
      color: NOTATION_NEUTRALS.label,
    }),
  });
  const h1 = hdr(470, tr(std, BMC_SEED_DESIGNED_FOR));
  const h2 = hdr(602, tr(std, BMC_SEED_DESIGNED_BY));
  const h3 = hdr(734, tr(std, BMC_SEED_DATE));
  const h4 = hdr(866, tr(std, BMC_SEED_VERSION));
  return {
    title: label(0, 8, 440, 32, tr(std, BMC_SEED_TITLE), {
      fontSize: 24,
      weight: FontWeight.Medium,
    }),
    h1b: h1.box,
    h1t: h1.txt,
    h2b: h2.box,
    h2t: h2.txt,
    h3b: h3.box,
    h3t: h3.txt,
    h4b: h4.box,
    h4t: h4.txt,
    kp: rect(0, 56, 196, 300, blk),
    ka: rect(200, 56, 196, 146, blk),
    kr: rect(200, 206, 196, 150, blk),
    vp: rect(400, 56, 196, 300, blk),
    cr: rect(600, 56, 196, 146, blk),
    ch: rect(600, 206, 196, 150, blk),
    cs: rect(800, 56, 196, 300, blk),
    cost: rect(0, 360, 496, 84, blk),
    rev: rect(500, 360, 496, 84, blk),
    tkp: t(0, 56, tr(std, BMC_SEED_KEY_PARTNERSHIPS)),
    tka: t(200, 56, tr(std, BMC_SEED_KEY_ACTIVITIES)),
    tkr: t(200, 206, tr(std, BMC_SEED_KEY_RESOURCES)),
    tvp: t(400, 56, tr(std, BMC_SEED_VALUE_PROPOSITIONS)),
    tcr: t(600, 56, tr(std, BMC_SEED_CUSTOMER_RELATIONSHIPS)),
    tch: t(600, 206, tr(std, BMC_SEED_CHANNELS)),
    tcs: t(800, 56, tr(std, BMC_SEED_CUSTOMER_SEGMENTS)),
    tcost: t(0, 360, tr(std, BMC_SEED_COST_STRUCTURE)),
    trev: t(500, 360, tr(std, BMC_SEED_REVENUE_STREAMS)),
  };
}

// ── Fishbone / Ishikawa (spine + arrowhead bones + CATEGORY/ITEM) ─────
function fishbone(std?: BlockStdScope): SurfaceElementsJSON {
  const categoryText = tr(std, FISHBONE_SEED_CATEGORY);
  const item1Text = tr(std, FISHBONE_SEED_ITEM_1);
  const item2Text = tr(std, FISHBONE_SEED_ITEM_2);
  const cat = (x: number, y: number) =>
    rect(x, y, 150, 44, { text: categoryText, fontSize: 13 });
  const item = (x: number, y: number, n: string) =>
    rect(x, y, 130, 40, {
      stroke: MUTED,
      sw: 1.4,
      dash: true,
      text: n,
      textColor: NOTATION_NEUTRALS.label,
      fontSize: 13,
    });
  const out: SurfaceElementsJSON = {
    spine: line(80, 360, 1120, 360, { sw: 6 }),
    head: rect(1124, 332, 130, 56, {
      text: tr(std, FISHBONE_SEED_EFFECT),
      fontSize: 16,
    }),
  };
  // two rib-groups (junctions at x = 360 and 760)
  [360, 760].forEach((jx, g) => {
    const ox = jx - 360;
    out[`ub${g}`] = line(ox + 200, 250, jx, 358, { sw: 3, arrow: true });
    out[`lb${g}`] = line(ox + 200, 470, jx, 362, { sw: 3, arrow: true });
    out[`uc${g}`] = cat(ox + 150, 224);
    out[`lc${g}`] = cat(ox + 150, 452);
    out[`ui1${g}`] = item(ox + 130, 286, item1Text);
    out[`ui2${g}`] = item(ox + 170, 326, item2Text);
    out[`li1${g}`] = item(ox + 130, 396, item1Text);
    out[`li2${g}`] = item(ox + 170, 356, item2Text);
  });
  return out;
}

// ── Gantt chart ───────────────────────────────────────────────────────
function gantt(std?: BlockStdScope): SurfaceElementsJSON {
  const rows = [
    tr(std, GANTT_SEED_DISCOVERY),
    tr(std, GANTT_SEED_DESIGN),
    tr(std, GANTT_SEED_BUILD),
    tr(std, GANTT_SEED_LAUNCH),
  ];
  const bars: [number, number, string][] = [
    [220, 280, '#4574c4'],
    [340, 360, '#2f9e95'],
    [520, 420, '#d99a2b'],
    [760, 240, '#43a06b'],
  ];
  const out: SurfaceElementsJSON = {};
  // week gridlines + labels
  for (let i = 0; i < 6; i++) {
    const x = 220 + i * 130;
    out[`g${i}`] = line(x, 40, x, 268, {
      stroke: NOTATION_NEUTRALS.cardBorder,
      sw: 1,
    });
    out[`w${i}`] = label(
      x - 16,
      12,
      40,
      20,
      tr(std, GANTT_SEED_WEEK, { n: i + 1 }),
      {
        fontSize: 12,
        color: NOTATION_NEUTRALS.label,
        align: TextAlign.Center,
      }
    );
  }
  rows.forEach((name, r) => {
    const y = 56 + r * 52;
    out[`t${r}`] = label(0, y + 6, 180, 24, name, { fontSize: 14 });
    const [bx, bw, fill] = bars[r];
    out[`b${r}`] = rect(bx, y, bw, 28, {
      fill,
      stroke: fill,
      sw: 0,
      radius: 6,
    });
  });
  return out;
}

const ATTRS =
  'width="100%" height="100%" viewBox="0 0 135 80" xmlns="http://www.w3.org/2000/svg"';
const previews = {
  swot: `<svg ${ATTRS} fill="none"><rect x="20" y="12" width="95" height="56" stroke="${DARK}" stroke-width="2"/><path d="M67.5 12 V68 M20 40 H115" stroke="${DARK}" stroke-width="1.6"/></svg>`,
  kanban: `<svg ${ATTRS} fill="none"><rect x="10" y="12" width="35" height="56" rx="4" stroke="${MUTED}"/><rect x="50" y="12" width="35" height="56" rx="4" stroke="${MUTED}"/><rect x="90" y="12" width="35" height="56" rx="4" stroke="${MUTED}"/><rect x="15" y="22" width="25" height="11" rx="2" fill="#fde6c8"/><rect x="55" y="22" width="25" height="11" rx="2" fill="#d6e4fb"/><rect x="95" y="22" width="25" height="11" rx="2" fill="#d5efd9"/></svg>`,
  bmc: `<svg ${ATTRS} fill="none"><g stroke="${DARK}" stroke-width="1.2"><rect x="8" y="14" width="22" height="40"/><rect x="32" y="14" width="22" height="20"/><rect x="32" y="35" width="22" height="19"/><rect x="56" y="14" width="22" height="40"/><rect x="80" y="14" width="22" height="20"/><rect x="80" y="35" width="22" height="19"/><rect x="104" y="14" width="22" height="40"/><rect x="8" y="56" width="57" height="14"/><rect x="68" y="56" width="58" height="14"/></g></svg>`,
  fishbone: `<svg ${ATTRS} fill="none"><path d="M14 40 H112" stroke="${DARK}" stroke-width="3"/><rect x="112" y="33" width="20" height="14" stroke="${DARK}" stroke-width="1.4"/><path d="M40 18 L52 40 M40 62 L52 40 M84 18 L96 40 M84 62 L96 40" stroke="${DARK}" stroke-width="1.4"/></svg>`,
  gantt: `<svg ${ATTRS} fill="none"><path d="M40 14 V70 M62 14 V70 M84 14 V70 M106 14 V70" stroke="${NOTATION_NEUTRALS.cardBorder}"/><rect x="40" y="22" width="34" height="8" rx="2" fill="#4574c4"/><rect x="52" y="36" width="44" height="8" rx="2" fill="#2f9e95"/><rect x="62" y="50" width="50" height="8" rx="2" fill="#d99a2b"/><rect x="84" y="64" width="28" height="8" rx="2" fill="#43a06b"/></svg>`,
};

/**
 * A hand-composed template — what is left once the artefacts are derived. The
 * seeds a template writes into the document go through the translation seam
 * at placement (ADR 0023); `content` stays the English build, and `localize`
 * rebuilds the same snapshot with translated seeds.
 */
function t(
  nameWording: ChromeWording,
  preview: string,
  build: (std?: BlockStdScope) => SurfaceElementsJSON
): Template {
  const [nameKey, name] = nameWording;
  return {
    name,
    // `resolveTemplateName` reads this FIRST: nothing here derives from a
    // command, so the tile's own key is the only way a host translates it
    // (#390). `name` stays the stable English identity (drag payload, cache
    // key) and doubles as the fallback.
    nameKey,
    type: 'template',
    preview,
    content: makeTemplateSnapshot(build(), name),
    localize: std => makeTemplateSnapshot(build(std), name),
  };
}

export const otherTemplateCategory: TemplateCategory = {
  name: 'Other',
  nameKey: TEMPLATE_PANEL_CATEGORY_OTHER[0],
  templates: [
    t(TEMPLATE_NAME_SWOT, previews.swot, swot),
    t(TEMPLATE_NAME_KANBAN_BOARD, previews.kanban, kanban),
    t(TEMPLATE_NAME_BUSINESS_MODEL_CANVAS, previews.bmc, bmc),
    t(TEMPLATE_NAME_FISHBONE, previews.fishbone, fishbone),
    t(TEMPLATE_NAME_GANTT_CHART, previews.gantt, gantt),
  ],
};
