import {
  ConnectorMode,
  FontFamily,
  ShapeStyle,
  type WardleyBackgroundElementModel,
} from '@labre/affine-model';
import { NOTATION_NEUTRALS } from '@labre/affine-shared/consts';
import {
  type ChromeWording,
  translateKey,
} from '@labre/affine-shared/services';
import { Bound } from '@labre/global/gfx';
import type {
  BlockStdScope,
  CommandLegendBox,
  CommandLegendEntry,
  CommandLegendExtra,
  CommandLegendRow,
  CommandLegendSurface,
} from '@labre/std';

import { GRADIENT_GREEN, GRADIENT_RED } from './gradient';
import {
  NODE_FILL,
  NODE_STROKE,
  PIPELINE_FILL,
  PORTER_DEFAULT_LETTER,
} from './node/consts';
import {
  WARDLEY_EDGE_STYLE,
  wardleyHandleProps,
  wardleyInertiaProps,
  wardleyMarketDotProps,
  wardleyMarketLinkPairs,
  wardleyMarketLinkProps,
  wardleyNodeProps,
  wardleyPorterArrowProps,
  wardleyPorterArrows,
  type WardleyArtefactKind,
} from './presets';
import { WARDLEY_ROLE } from './roles';

/**
 * What a Wardley legend ROW is, and the two blocks that are not rows.
 *
 * The scan, the box and the placement all live in the platform
 * (`@labre/affine-block-surface`'s `legend.ts`): a row is SUBSCRIBED by the
 * command that draws the artefact (`CommandDescriptor.legend`, see
 * `commands.ts`), so the notation has one description instead of a table kept
 * in step with the palette by hand. What is left here is what only Wardley can
 * say: the swatch each role is pictured by, the prose each row reads, and the
 * gradient and Porter panels, which document the SHEET rather than anything
 * drawn on it and therefore hang off the board's own `legendBox`.
 */

/* ── The box's own numbers ────────────────────────────────────────────── */

/**
 * The legend box's width, and the inset the extras are drawn at.
 *
 * Wardley's, and the reason the box declares a `legendBox` at all: the rows
 * explain the notation in a sentence, so a 260-unit default box would wrap
 * every one of them. `BOX_PAD` mirrors the platform's own padding — the extras
 * are drawn with the full width in hand and have to line their content up with
 * the rows above them.
 */
const LEGEND_WIDTH = 450;
const BOX_PAD = 16;
/** The swatch column, wide enough for the market and the porter composites. */
const SWATCH_W = 46;
const SWATCH_H = 30;
/** Gap between the swatch column and the text the extras write beside it. */
const EXTRA_GAP = 12;
/** The text column the extras' captions are laid out in. */
const EXTRA_TEXT_W = LEGEND_WIDTH - BOX_PAD * 2 - SWATCH_W - EXTRA_GAP;
const EXTRA_TEXT_FS = 15;

/** The legend box's own title. */
export const WARDLEY_LEGEND_TITLE: ChromeWording = [
  'com.labre.wardley.legend.title',
  'Legend',
];

/**
 * A free text line, as the extras write them: the artefact ink, the notation
 * face, and NO role — a legend documents the map and is not part of it.
 */
function addText(
  surface: CommandLegendSurface,
  std: BlockStdScope,
  wording: ChromeWording | string,
  x: number,
  y: number,
  w: number,
  h: number,
  fontSize: number,
  textAlign: 'left' | 'center' = 'left'
): string {
  return surface.addElement({
    type: 'text',
    text: typeof wording === 'string' ? wording : translateKey(std, ...wording),
    fontFamily: FontFamily.Inter,
    fontSize,
    color: NODE_STROKE,
    textAlign,
    xywh: new Bound(x, y, w, h).serialize(),
  });
}

/* ── The thirteen rows ────────────────────────────────────────────────── */

/**
 * A preset's props with its ROLE taken off, and nothing else changed.
 *
 * Every element of this box goes through here. A legend is drawn ON the map it
 * describes and the scan detects by role, so a swatch carrying one would list
 * itself the next time a legend was generated and would be counted by every
 * validation rule. The platform strips a `glyph` row's; a `custom` swatch draws
 * straight onto the surface, so it strips its own.
 */
function neutral(props: Record<string, unknown>): Record<string, unknown> {
  const { role: _role, ...rest } = props;
  return rest;
}

const NO_BOX = { xywh: '[0,0,0,0]' };
const boxAt = (x: number, y: number, w: number, h: number) =>
  new Bound(x, y, w, h).serialize();

/**
 * The props of a real artefact, at swatch size — geometry and role removed.
 *
 * Derived from {@link wardleyNodeProps} rather than restated, which is the
 * whole point of subscribing: restyling a kind restyles its legend row, and the
 * two can no longer disagree. `xywh` is the layout's to fill in.
 */
function glyphProps(kind: WardleyArtefactKind): Record<string, unknown> {
  const { xywh: _xywh, ...props } = neutral(wardleyNodeProps(kind, NO_BOX));
  return props;
}

/** One real artefact, drawn at an explicit box — the composites' building block. */
function addGlyph(
  surface: CommandLegendSurface,
  kind: WardleyArtefactKind,
  x: number,
  y: number,
  w: number,
  h: number
): string {
  return surface.addElement({ ...glyphProps(kind), xywh: boxAt(x, y, w, h) });
}

/** A box centred on a point, as every composite below places its pieces. */
const centred = (cx: number, cy: number, w: number, h: number) =>
  boxAt(cx - w / 2, cy - h / 2, w, h);

/**
 * A node row at an EXPLICIT size, which short-circuits the platform's
 * fit-to-box.
 *
 * The gradation is notation here rather than decoration — a component is 16
 * across, a method 18, an ecosystem 20 and a market 22 — and a legend that
 * fitted every pastille to the same box would say they were the same thing.
 */
function glyphRow(
  kind: WardleyArtefactKind,
  size: readonly [number, number]
): CommandLegendRow {
  return {
    swatch: 'glyph',
    color: String(glyphProps(kind)['fillColor'] ?? NODE_FILL),
    props: glyphProps(kind),
    size,
  };
}

/**
 * The connector a Wardley tool arms, as a swatch — the very style it arms, at
 * the very endpoints this legend has always drawn it between.
 *
 * `custom` rather than the platform's `edge`, for one reason: that swatch spans
 * the column horizontally, and a dependency has been drawn RISING across its
 * row since the legend shipped — the slope is what tells it apart from the
 * evolution arrow beside it at a glance, before the eye reaches the colour.
 * Six lines to keep the two samples identical, and the style itself is still
 * {@link WARDLEY_EDGE_STYLE}, so the row pictures the line the tool draws.
 */
function edgeRow(
  kind: 'link' | 'arrow',
  from: readonly [number, number],
  to: readonly [number, number]
): CommandLegendRow {
  return {
    swatch: 'custom',
    color: WARDLEY_EDGE_STYLE[kind].stroke,
    draw: (surface, box) => {
      const cx = box.x + box.w / 2;
      const cy = box.y + box.h / 2;
      return [
        surface.addElement({
          type: 'connector',
          mode: ConnectorMode.Straight,
          source: { position: [cx + from[0], cy + from[1]] },
          target: { position: [cx + to[0], cy + to[1]] },
          ...WARDLEY_EDGE_STYLE[kind],
        }),
      ];
    },
  };
}

/**
 * The inertia bar: a plain filled rect, and the whole of its semantics is the
 * role — so the swatch is the preset's own props at the bar's own proportions.
 */
function inertiaRow(): CommandLegendRow {
  const { xywh: _xywh, ...props } = neutral(wardleyInertiaProps(NO_BOX));
  return {
    swatch: 'glyph',
    color: String(props['fillColor']),
    props,
    size: [5, 22],
  };
}

/**
 * The market: a circle, three neutral dots and the triangle wiring them.
 *
 * A `custom` swatch and not a `glyph`, for the reason the pipeline and the
 * porter below give: the drawing is SEVERAL elements, and the three connectors
 * are anchored by id so the triangle follows its dots.
 */
function drawMarket(
  surface: CommandLegendSurface,
  box: { x: number; y: number; w: number; h: number }
): string[] {
  const cx = box.x + box.w / 2;
  const cy = box.y + box.h / 2;
  // The row's own scale: a 22-unit circle carrying three 6-unit dots on a
  // 12-unit ring. Smaller than the map's 30, and a ratio of it rather than a
  // reduction of the canvas geometry, because the dots must stay readable.
  const R = 11;
  const dr = 3;
  const rho = 6;
  const sin60 = Math.sqrt(3) / 2;
  const circle = addGlyph(surface, 'market', cx - R, cy - R, R * 2, R * 2);
  const dots = [
    [0, -rho],
    [rho * sin60, rho / 2],
    [-rho * sin60, rho / 2],
  ].map(([vx, vy]) =>
    surface.addElement(
      neutral(
        wardleyMarketDotProps({
          xywh: centred(cx + vx, cy + vy, dr * 2, dr * 2),
        })
      )
    )
  );
  const links = wardleyMarketLinkPairs(dots).map(([a, b]) =>
    surface.addElement(neutral(wardleyMarketLinkProps(a, b)))
  );
  return [circle, ...dots, ...links];
}

/** The pipeline: the body, and the handle astride its top edge. */
function drawPipeline(
  surface: CommandLegendSurface,
  box: { x: number; y: number; w: number; h: number }
): string[] {
  const cx = box.x + box.w / 2;
  const cy = box.y + box.h / 2;
  const bw = 34;
  const bh = 12;
  const hd = 10;
  const top = cy - bh / 2;
  return [
    addGlyph(surface, 'pipeline', cx - bw / 2, top, bw, bh),
    surface.addElement(
      neutral(wardleyHandleProps({ xywh: centred(cx, top, hd, hd) }))
    ),
  ];
}

/**
 * The Porter rose at the row's scale: the circle, the four DERIVED arrows and
 * the notation letter.
 *
 * Radius 6 and not the 8 the other circles get, because this glyph is the only
 * one wider than its own circle: arrows included it spans
 * `2 * (R + (gap + length) * R / 30)`, which at 8 would overrun a 30-unit row.
 * It is a RATIO, so the PO's doubling of the map glyph left this row where it
 * was.
 *
 * The letter is a SEPARATE text and not the circle's inner text (recette v2): a
 * shape lays its text out inside a padding larger than this 12-unit box, so at
 * font size 8 the character was pushed out under the circle.
 */
function drawPorter(
  surface: CommandLegendSurface,
  box: { x: number; y: number; w: number; h: number },
  std: BlockStdScope
): string[] {
  const cx = box.x + box.w / 2;
  const cy = box.y + box.h / 2;
  const R = 6;
  const FS = 8;
  const circle = addGlyph(surface, 'porter', cx - R, cy - R, R * 2, R * 2);
  const arrows = wardleyPorterArrows(cx, cy, R).map(arrow =>
    surface.addElement(neutral(wardleyPorterArrowProps(arrow)))
  );
  const letter = addText(
    surface,
    std,
    PORTER_DEFAULT_LETTER,
    cx - R,
    cy - FS / 2 - 1,
    R * 2,
    FS + 2,
    FS,
    'center'
  );
  return [circle, ...arrows, letter];
}

/**
 * The swatch each of the thirteen rows is pictured by, keyed by the ROLE it
 * stands for — eight real artefacts at their notation size, and five samples
 * the framework draws itself: the two typed connectors, at the endpoints that
 * tell them apart, and the three composites that are several elements.
 */
export const WARDLEY_LEGEND_ROWS = {
  [WARDLEY_ROLE.component]: glyphRow('component', [16, 16]),
  [WARDLEY_ROLE.anchor]: glyphRow('anchor', [16, 16]),
  [WARDLEY_ROLE.market]: {
    swatch: 'custom',
    color: NODE_FILL,
    draw: drawMarket,
  },
  [WARDLEY_ROLE.ecosystem]: glyphRow('ecosystem', [20, 20]),
  [WARDLEY_ROLE.method]: glyphRow('method', [18, 18]),
  [WARDLEY_ROLE.pipeline]: {
    swatch: 'custom',
    color: PIPELINE_FILL,
    draw: drawPipeline,
  },
  // The dependency RISES across its row, the evolution arrow runs flat: the
  // two endpoint pairs the legend has drawn since it shipped.
  [WARDLEY_ROLE.dependency]: edgeRow('link', [-18, 6], [18, -6]),
  [WARDLEY_ROLE.changeArrow]: edgeRow('arrow', [-18, 0], [16, 0]),
  [WARDLEY_ROLE.inertia]: inertiaRow(),
  [WARDLEY_ROLE.porter]: {
    swatch: 'custom',
    color: NODE_FILL,
    draw: drawPorter,
  },
  [WARDLEY_ROLE.accelerator]: glyphRow('accelerator', [30, 18]),
  [WARDLEY_ROLE.decelerator]: glyphRow('decelerator', [30, 18]),
  // The rect even for a map full of polygons: the row says what a ZONE is, and
  // the number of corners is the author's choice rather than notation.
  [WARDLEY_ROLE.area]: glyphRow('area', [34, 20]),
} satisfies Record<string, CommandLegendRow>;

/** A role Wardley pictures in its legend. */
export type WardleyLegendRole = keyof typeof WARDLEY_LEGEND_ROWS;

/**
 * What each row SAYS — prose rather than the role's bare name.
 *
 * The role vocabulary calls `wardley:component` a "Component"; the legend has
 * to say what one IS to somebody reading their first map. So each row declares
 * its own wording, which the platform reads ahead of the role's, and the
 * thirteen keys the host catalogue already carries are unchanged.
 */
const LEGEND_DESC = {
  [WARDLEY_ROLE.component]: [
    'com.labre.wardley.legend.desc.component',
    'Need / capability (activity, practice, data…)',
  ],
  [WARDLEY_ROLE.anchor]: [
    'com.labre.wardley.legend.desc.anchor',
    'Stakeholder (customer, user…)',
  ],
  [WARDLEY_ROLE.market]: [
    'com.labre.wardley.legend.desc.market',
    'Market (set of actors)',
  ],
  [WARDLEY_ROLE.ecosystem]: [
    'com.labre.wardley.legend.desc.ecosystem',
    'Ecosystem',
  ],
  [WARDLEY_ROLE.method]: [
    'com.labre.wardley.legend.desc.method',
    'Component + method (color = phase)',
  ],
  [WARDLEY_ROLE.pipeline]: [
    'com.labre.wardley.legend.desc.pipeline',
    'Pipeline (possible choices for a capability)',
  ],
  [WARDLEY_ROLE.dependency]: [
    'com.labre.wardley.legend.desc.link',
    'Need relation (parent → child)',
  ],
  [WARDLEY_ROLE.changeArrow]: [
    'com.labre.wardley.legend.desc.arrow',
    'Evolution / movement (red = future)',
  ],
  [WARDLEY_ROLE.inertia]: [
    'com.labre.wardley.legend.desc.inertia',
    'Inertia to change',
  ],
  [WARDLEY_ROLE.porter]: [
    'com.labre.wardley.legend.desc.porter',
    "Porter's forces (external competition: R relative, L survival, E establish)",
  ],
  [WARDLEY_ROLE.accelerator]: [
    'com.labre.wardley.legend.desc.accelerator',
    'Accelerator (speeds evolution up)',
  ],
  [WARDLEY_ROLE.decelerator]: [
    'com.labre.wardley.legend.desc.decelerator',
    'Decelerator (slows evolution down)',
  ],
  [WARDLEY_ROLE.area]: [
    'com.labre.wardley.legend.desc.area',
    'Area (zone of the map)',
  ],
} satisfies Record<WardleyLegendRole, ChromeWording>;

/** Every {@link LEGEND_DESC} wording, for `translations.ts`'s manifest. */
export const WARDLEY_LEGEND_DESC_WORDINGS: readonly ChromeWording[] =
  Object.values(LEGEND_DESC);

/**
 * The legend line one command subscribes — the swatch of the role it stamps,
 * and the sentence that explains it. Its sub-title comes from the command's own
 * catalogue category (Nodes, Connectors, Areas), so a section is declared by
 * filing a command rather than by a second list.
 */
export function wardleyLegendEntry(
  role: WardleyLegendRole
): CommandLegendEntry {
  return {
    role,
    row: WARDLEY_LEGEND_ROWS[role],
    labelWording: LEGEND_DESC[role],
  };
}

/* ── Extra 1: what the gradient means ─────────────────────────────────── */

type GradientVariant = Exclude<
  WardleyBackgroundElementModel['variant'],
  'classic'
>;

/** Gradient-meaning block, keyed by variant (caption + 2-colour swatch). */
const LEGEND_GRADIENT: Record<
  GradientVariant,
  { caption: ChromeWording; swatch: [string, string] }
> = {
  opportunity: {
    caption: [
      'com.labre.wardley.legend.gradient.opportunity',
      'Opportunity gradient: differential value (green) vs operational value (red).',
    ],
    swatch: [GRADIENT_GREEN, GRADIENT_RED],
  },
  benefit: {
    caption: [
      'com.labre.wardley.legend.gradient.benefit',
      'Gradient: investment (red) then benefit (green).',
    ],
    swatch: [GRADIENT_RED, GRADIENT_GREEN],
  },
  'evolution-gradient': {
    caption: [
      'com.labre.wardley.legend.gradient.evolution',
      "Gradient representing the growth of Wardley's evolution function.",
    ],
    swatch: [NOTATION_NEUTRALS.divider, NOTATION_NEUTRALS.legendBorder],
  },
};

/** Every {@link LEGEND_GRADIENT} caption, for `translations.ts`'s manifest. */
export const WARDLEY_LEGEND_GRADIENT_WORDINGS: readonly ChromeWording[] =
  Object.values(LEGEND_GRADIENT).map(g => g.caption);

/** The gradient row's own height — taller than a row, as its caption may wrap. */
const GRAD_ROW_H = 40;

/**
 * The gradient block: a separator, then [2-colour swatch | caption].
 *
 * An EXTRA and not a row, because it says nothing about anything drawn on the
 * map: it is a property of the SHEET, read off the background's variant, so no
 * command could subscribe it.
 */
function gradientExtra(variant: GradientVariant): CommandLegendExtra {
  const grad = LEGEND_GRADIENT[variant];
  return {
    height: 12 + GRAD_ROW_H,
    draw(surface, std, x, y, width) {
      const ids: string[] = [];
      const sepY = y + 4;
      ids.push(
        surface.addElement({
          type: 'shape',
          shapeType: 'rect',
          filled: true,
          fillColor: NOTATION_NEUTRALS.legendBorder,
          strokeColor: NOTATION_NEUTRALS.legendBorder,
          strokeWidth: 0,
          shapeStyle: ShapeStyle.General,
          roughness: 0,
          radius: 0,
          xywh: new Bound(
            x + BOX_PAD,
            sepY,
            width - BOX_PAD * 2,
            1
          ).serialize(),
        })
      );
      const cy = sepY + 8 + GRAD_ROW_H / 2;
      const sw = 14;
      const sgap = 2;
      const sx = x + BOX_PAD + SWATCH_W / 2 - (sw * 2 + sgap) / 2;
      grad.swatch.forEach((col, i) => {
        ids.push(
          surface.addElement({
            type: 'shape',
            shapeType: 'rect',
            filled: true,
            fillColor: col,
            strokeColor: NOTATION_NEUTRALS.legendBorder,
            strokeWidth: 0.5,
            shapeStyle: ShapeStyle.General,
            roughness: 0,
            radius: 1,
            xywh: new Bound(
              sx + i * (sw + sgap),
              cy - sw / 2,
              sw,
              sw
            ).serialize(),
          })
        );
      });
      ids.push(
        addText(
          surface,
          std,
          grad.caption,
          x + BOX_PAD + SWATCH_W + EXTRA_GAP,
          cy - GRAD_ROW_H / 2,
          EXTRA_TEXT_W,
          GRAD_ROW_H,
          EXTRA_TEXT_FS
        )
      );
      return ids;
    },
  };
}

/* ── Extra 2: Porter's five forces ────────────────────────────────────── */

/** The panel's own numbers. Model units, like every other measure here. */
const PORTER_PANEL = {
  pad: 12,
  titleFs: 16,
  titleH: 22,
  /** Between the title and the diagram, and between the diagram and caption. */
  gapAfterTitle: 8,
  gapBeforeCaption: 10,
  /** The glyph's radius — half the map's, so the panel reads as a diagram. */
  radius: 15,
  /** Clearance between the arrow tips and the boxes they point at. */
  clearance: 4,
  /** The three letters, drawn on the glyph's centre as a free text. */
  letterFs: 9,
  boxFs: 12,
  sideW: 150,
  sideH: 34,
  endW: 170,
  endH: 24,
  captionFs: 13,
  captionH: 21,
  backing: '#e5e7eb',
  backingStroke: NOTATION_NEUTRALS.divider,
} as const;

/** The four forces the boxes name, north first and then clockwise. */
const PORTER_FORCES: readonly ChromeWording[] = [
  [
    'com.labre.wardley.legend.porter.force.new-entrants',
    'Threat of new entrants',
  ],
  [
    'com.labre.wardley.legend.porter.force.customers',
    'Bargaining power of customers',
  ],
  [
    'com.labre.wardley.legend.porter.force.substitutes',
    'Threat of substitutes',
  ],
  [
    'com.labre.wardley.legend.porter.force.suppliers',
    'Bargaining power of suppliers',
  ],
];

/** What the panel's own glyph reads: the notation, not one force. */
const PORTER_PANEL_LETTERS = 'R/L/E';

/** What the letters mean, spelled out under the diagram. */
const PORTER_CAPTION: ChromeWording = [
  'com.labre.wardley.legend.porter.caption',
  'R/L/E = Relative competition, or struggLe for survival, or struggle to Establish',
];

/** The five-forces panel's own title. */
export const WARDLEY_LEGEND_PORTER_TITLE: ChromeWording = [
  'com.labre.wardley.legend.porter.title',
  "Porter's five forces",
];

/** Every {@link PORTER_FORCES} wording, plus the caption, for the manifest. */
export const WARDLEY_LEGEND_PORTER_WORDINGS: readonly ChromeWording[] = [
  WARDLEY_LEGEND_PORTER_TITLE,
  ...PORTER_FORCES,
  PORTER_CAPTION,
];

/** A box in the panel, relative to the panel's top-left, plus its wording. */
interface PorterPanelBox {
  xywh: [number, number, number, number];
  label: ChromeWording;
}

interface PorterPanelLayout {
  w: number;
  h: number;
  title: [number, number, number, number];
  /** The glyph's centre. */
  center: [number, number];
  radius: number;
  boxes: PorterPanelBox[];
  caption: [number, number, number, number];
}

/**
 * How far a porter glyph of the given radius reaches, arrow tips included.
 *
 * DERIVED from the shared geometry rather than written down: the boxes must
 * stand clear of the arrows, and the day somebody lengthens `PORTER_ARROW` a
 * hard-coded 38 here would silently let a tip enter a box.
 */
function porterReach(radius: number): number {
  return Math.max(
    ...wardleyPorterArrows(0, 0, radius).flatMap(arrow => {
      const [x, y, w, h] = Bound.deserialize(arrow.xywh).toXYWH();
      return [Math.abs(x), Math.abs(y), Math.abs(x + w), Math.abs(y + h)];
    })
  );
}

/**
 * The panel's geometry for a given width — the PO's reference drawing, as
 * numbers.
 *
 * A pure function so the layout can be asserted without a surface, and so the
 * one thing that must hold — that none of the four boxes overlaps the glyph
 * they surround — is checkable rather than eyeballed.
 */
export function porterPanelLayout(w: number): PorterPanelLayout {
  const p = PORTER_PANEL;
  const inner = w - p.pad * 2;
  // Where a box's near edge sits: past the arrow tips, never on them.
  const clear = porterReach(p.radius) + p.clearance;

  const diagramH = (clear + p.endH) * 2;
  const cx = w / 2;
  const cy = p.pad + p.titleH + p.gapAfterTitle + diagramH / 2;
  const captionY = cy + diagramH / 2 + p.gapBeforeCaption;

  return {
    w,
    h: captionY + p.captionH + p.pad,
    title: [p.pad, p.pad, inner, p.titleH],
    center: [cx, cy],
    radius: p.radius,
    boxes: [
      {
        xywh: [cx - p.endW / 2, cy - clear - p.endH, p.endW, p.endH],
        label: PORTER_FORCES[0],
      },
      {
        xywh: [cx + clear, cy - p.sideH / 2, p.sideW, p.sideH],
        label: PORTER_FORCES[1],
      },
      {
        xywh: [cx - p.endW / 2, cy + clear, p.endW, p.endH],
        label: PORTER_FORCES[2],
      },
      {
        xywh: [cx - clear - p.sideW, cy - p.sideH / 2, p.sideW, p.sideH],
        label: PORTER_FORCES[3],
      },
    ],
    caption: [p.pad, captionY, inner, p.captionH],
  };
}

/** The panel, at the only width this box is ever drawn at. */
const PORTER_PANEL_LAYOUT = porterPanelLayout(LEGEND_WIDTH - BOX_PAD * 2);

/**
 * The five-forces panel, under everything else.
 *
 * It is not a row — a row says what a glyph IS, and this says what the notation
 * MEANS: four named pressures around one circle, and the three letters spelled
 * out. Only present when a force is on the map, so a legend without one is the
 * legend it always was.
 */
const PORTER_EXTRA: CommandLegendExtra = {
  height: 12 + PORTER_PANEL_LAYOUT.h,
  draw(surface, std, x, y) {
    const panel = PORTER_PANEL_LAYOUT;
    const p = PORTER_PANEL;
    const px = x + BOX_PAD;
    const py = y + 12;
    const ids: string[] = [];

    // The backing: square-cornered and grey, so the panel reads as a figure
    // set into the legend rather than as one more entry in it.
    ids.push(
      surface.addElement({
        type: 'shape',
        shapeType: 'rect',
        filled: true,
        fillColor: p.backing,
        strokeColor: p.backingStroke,
        strokeWidth: 1,
        shapeStyle: ShapeStyle.General,
        roughness: 0,
        radius: 0,
        xywh: new Bound(px, py, panel.w, panel.h).serialize(),
      })
    );

    const [tx, ty, tw, th] = panel.title;
    ids.push(
      addText(
        surface,
        std,
        WARDLEY_LEGEND_PORTER_TITLE,
        px + tx,
        py + ty,
        tw,
        th,
        p.titleFs
      )
    );

    const [cx, cy] = panel.center;
    ids.push(
      addGlyph(
        surface,
        'porter',
        px + cx - panel.radius,
        py + cy - panel.radius,
        panel.radius * 2,
        panel.radius * 2
      )
    );
    for (const arrow of wardleyPorterArrows(px + cx, py + cy, panel.radius)) {
      ids.push(surface.addElement(neutral(wardleyPorterArrowProps(arrow))));
    }
    // All three letters at once: this circle stands for the NOTATION rather
    // than for one force, so picking one of them would make the panel say that
    // a Porter is an R. A SEPARATE text element, like the row's own letter and
    // for the same reason (recette v2): a shape's text padding is wider than
    // this 30-unit circle.
    ids.push(
      addText(
        surface,
        std,
        PORTER_PANEL_LETTERS,
        px + cx - panel.radius,
        py + cy - p.letterFs / 2 - 1,
        panel.radius * 2,
        p.letterFs + 2,
        p.letterFs,
        'center'
      )
    );

    for (const box of panel.boxes) {
      const [bx, by, bw, bh] = box.xywh;
      ids.push(
        surface.addElement({
          type: 'shape',
          shapeType: 'rect',
          filled: true,
          fillColor: NODE_FILL,
          strokeColor: NODE_STROKE,
          strokeWidth: 1,
          shapeStyle: ShapeStyle.General,
          roughness: 0,
          radius: 0,
          xywh: new Bound(px + bx, py + by, bw, bh).serialize(),
        })
      );
      ids.push(
        addText(
          surface,
          std,
          box.label,
          px + bx + 4,
          py + by + 3,
          bw - 8,
          bh - 6,
          p.boxFs,
          'center'
        )
      );
    }

    const [capX, capY, capW, capH] = panel.caption;
    ids.push(
      addText(
        surface,
        std,
        PORTER_CAPTION,
        px + capX,
        py + capY,
        capW,
        capH,
        p.captionFs,
        'center'
      )
    );
    return ids;
  },
};

/* ── The box the board's command declares ─────────────────────────────── */

/**
 * How a Wardley map's legend box is laid out, and the two blocks it adds under
 * the rows. Declared on the FIRST background command (`commands.ts`), which is
 * the sheet the legend is drawn on.
 */
export const WARDLEY_LEGEND_BOX: CommandLegendBox = {
  titleWording: WARDLEY_LEGEND_TITLE,
  width: LEGEND_WIDTH,
  rowHeight: SWATCH_H,
  swatchWidth: SWATCH_W,
  swatchHeight: SWATCH_H,
  extras: ({ board, present }) => {
    const extras: CommandLegendExtra[] = [];
    // The variant is a fact about the BOARD, which the platform hands over
    // untyped — it knows a board has a box and nothing else about one.
    const { variant } = board as WardleyBackgroundElementModel;
    if (variant && variant !== 'classic') extras.push(gradientExtra(variant));
    if (present.has(WARDLEY_ROLE.porter)) extras.push(PORTER_EXTRA);
    return extras;
  },
};

/**
 * Every wording this file writes onto the canvas, for `translations.ts`'s
 * manifest contribution — the box's own title, its rows' captions, the gradient
 * blocks and the Porter panel, all as `seed` (written into the document once,
 * at the moment a legend is generated).
 */
export const WARDLEY_LEGEND_WORDINGS: readonly ChromeWording[] = [
  WARDLEY_LEGEND_TITLE,
  ...WARDLEY_LEGEND_DESC_WORDINGS,
  ...WARDLEY_LEGEND_GRADIENT_WORDINGS,
  ...WARDLEY_LEGEND_PORTER_WORDINGS,
];
