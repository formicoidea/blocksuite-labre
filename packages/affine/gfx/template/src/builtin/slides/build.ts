import {
  type Color,
  ColorScheme,
  ConnectorMode,
  FontFamily,
  type FrameBlockModel,
  PointStyle,
  resolveColor,
  ShapeStyle,
  StrokeStyle,
  TextAlign,
} from '@labre/affine-model';
import type { BlockStdScope } from '@labre/std';
import { GfxControllerIdentifier } from '@labre/std/gfx';
import * as Y from 'yjs';

import {
  makeTemplateSnapshot,
  type SurfaceChildBlockJSON,
  type SurfaceElementsJSON,
  surfaceText,
} from '../../make-snapshot.js';
import { SLIDE_SEED_FOOTER, SLIDE_SEED_IMAGE } from '../../translations.js';
import { tr } from '../other.js';
import {
  SLIDE_FOOTER_Y,
  SLIDE_HAIRLINE_WIDTH,
  SLIDE_HEIGHT,
  SLIDE_LINE_HEIGHT,
  SLIDE_MARGIN,
  SLIDE_PALETTES,
  SLIDE_RADIUS,
  SLIDE_TYPE,
  SLIDE_WIDTH,
  SLIDE_ZONE_STROKE_WIDTH,
  type SlidePalette,
  type SlideTextRole,
} from './consts.js';
import type { SlideMask, SlideTextZone, SlideZone } from './masks.js';

/**
 * The one builder of the slide masks: a mask declaration (`masks.ts`) in, a
 * template snapshot (one 1600 x 900 frame and the elements it holds) and a
 * tile preview out. Nothing here knows a particular mask.
 */

/** The map key of the slide number, the LAST element of every mask. */
export const SLIDE_NUMBER_KEY = 'number';
/** The map key of the footer line. */
export const SLIDE_FOOTER_KEY = 'footer';

const xywh = (x: number, y: number, w: number, h: number) =>
  `[${x},${y},${w},${h}]`;

/** A text box's height for the lines it is sized for. */
export function slideTextHeight(role: SlideTextRole, lines = 1) {
  return Math.ceil(lines * SLIDE_TYPE[role].fontSize * SLIDE_LINE_HEIGHT);
}

const ALIGN = {
  left: TextAlign.Left,
  center: TextAlign.Center,
  right: TextAlign.Right,
} as const;

function textElement(
  zone: SlideTextZone,
  words: string,
  palette: SlidePalette
): Record<string, unknown> {
  const type = SLIDE_TYPE[zone.role];
  return {
    type: 'text',
    text: surfaceText(words),
    color: zone.tone === 'muted' ? palette.muted : palette.ink,
    fontFamily: FontFamily.Inter,
    fontSize: type.fontSize,
    fontWeight: type.fontWeight,
    textAlign: ALIGN[zone.align ?? 'left'],
    hasMaxWidth: true,
    xywh: xywh(zone.x, zone.y, zone.w, slideTextHeight(zone.role, zone.lines)),
  };
}

type ShapeOpts = {
  shapeType: 'rect' | 'ellipse';
  fill: Color | null;
  stroke: Color;
  dash: boolean;
  radius: number;
  label?: string;
  labelRole?: SlideTextRole;
  labelColor?: Color;
};

function shapeElement(
  x: number,
  y: number,
  w: number,
  h: number,
  opts: ShapeOpts
): Record<string, unknown> {
  const element: Record<string, unknown> = {
    type: 'shape',
    shapeType: opts.shapeType,
    filled: opts.fill !== null,
    fillColor: opts.fill ?? SLIDE_PALETTES.paper.paper,
    strokeColor: opts.stroke,
    strokeWidth: opts.dash ? SLIDE_ZONE_STROKE_WIDTH : SLIDE_HAIRLINE_WIDTH,
    strokeStyle: opts.dash ? StrokeStyle.Dash : StrokeStyle.Solid,
    shapeStyle: ShapeStyle.General,
    roughness: 0,
    radius: opts.shapeType === 'rect' ? opts.radius : 0,
    xywh: xywh(x, y, w, h),
  };
  if (opts.label !== undefined) {
    const type = SLIDE_TYPE[opts.labelRole ?? 'caption'];
    element.text = surfaceText(opts.label);
    element.color = opts.labelColor;
    element.fontFamily = FontFamily.Inter;
    element.fontSize = type.fontSize;
    element.fontWeight = type.fontWeight;
    element.textAlign = TextAlign.Center;
  }
  return element;
}

/** A fill zone touching the frame's edge bleeds: no rounded corner there. */
function bleeds(zone: { x: number; y: number; w: number; h: number }) {
  return (
    zone.x <= 0 ||
    zone.y <= 0 ||
    zone.x + zone.w >= SLIDE_WIDTH ||
    zone.y + zone.h >= SLIDE_HEIGHT
  );
}

function zoneElement(
  zone: SlideZone,
  palette: SlidePalette,
  std?: BlockStdScope
): Record<string, unknown> {
  switch (zone.kind) {
    case 'text':
      return textElement(
        zone,
        zone.seed ? tr(std, zone.seed, zone.params) : (zone.digits ?? ''),
        palette
      );
    case 'image':
      return shapeElement(zone.x, zone.y, zone.w, zone.h, {
        shapeType: zone.shape ?? 'rect',
        fill: palette.hairline,
        stroke: palette.zoneStroke,
        dash: true,
        radius: bleeds(zone) ? 0 : SLIDE_RADIUS,
        label: tr(std, zone.label ?? SLIDE_SEED_IMAGE),
        labelRole: 'body',
        labelColor: palette.ink,
      });
    case 'card':
      return shapeElement(zone.x, zone.y, zone.w, zone.h, {
        shapeType: zone.shape ?? 'rect',
        fill: zone.filled ? palette.hairline : null,
        stroke: zone.stroke === 'muted' ? palette.muted : palette.hairline,
        dash: false,
        radius: SLIDE_RADIUS,
        label: zone.label ? tr(std, zone.label, zone.params) : undefined,
        labelRole: 'body',
        labelColor: palette.ink,
      });
    case 'dot':
      return shapeElement(zone.x, zone.y, zone.size, zone.size, {
        shapeType: 'ellipse',
        fill: palette.ink,
        stroke: palette.ink,
        dash: false,
        radius: 0,
      });
    case 'line':
      return {
        type: 'connector',
        mode: ConnectorMode.Straight,
        stroke: palette.muted,
        strokeWidth: SLIDE_HAIRLINE_WIDTH,
        strokeStyle: StrokeStyle.Solid,
        frontEndpointStyle: PointStyle.None,
        rearEndpointStyle: zone.arrow ? PointStyle.Triangle : PointStyle.None,
        source: { position: zone.from },
        target: { position: zone.to },
      };
  }
}

/** The elements of one mask, footer and slide number last, in paint order. */
export function slideElements(
  mask: SlideMask,
  std?: BlockStdScope
): SurfaceElementsJSON {
  const palette = SLIDE_PALETTES[mask.variant];
  const elements: SurfaceElementsJSON = {};
  mask.zones.forEach((zone, i) => {
    elements[`z${i}`] = zoneElement(zone, palette, std);
  });
  const footerWidth = 800;
  const numberWidth = 200;
  elements[SLIDE_FOOTER_KEY] = textElement(
    {
      kind: 'text',
      role: 'caption',
      x: SLIDE_MARGIN,
      y: SLIDE_FOOTER_Y,
      w: footerWidth,
      tone: 'muted',
    },
    tr(std, SLIDE_SEED_FOOTER),
    palette
  );
  // The digits are rewritten at placement by `numberSlide`; "1" is what a
  // copy shows before (and what `content`, the English build, carries).
  elements[SLIDE_NUMBER_KEY] = textElement(
    {
      kind: 'text',
      role: 'caption',
      x: SLIDE_WIDTH - SLIDE_MARGIN - numberWidth,
      y: SLIDE_FOOTER_Y,
      w: numberWidth,
      align: 'right',
      tone: 'muted',
    },
    '1',
    palette
  );
  return elements;
}

/**
 * The mask's frame: the slide itself. Its title is the tile's name, resolved
 * once at placement (a frame title is document content, ADR 0023). No
 * `presentationIndex`: the schema default applies, like a pasted frame.
 */
function slideFrame(
  mask: SlideMask,
  elements: SurfaceElementsJSON,
  std?: BlockStdScope
): SurfaceChildBlockJSON {
  const name = tr(std, mask.name);
  return {
    type: 'block',
    id: `block:slide-${mask.id}`,
    flavour: 'affine:frame',
    props: {
      title: {
        '$blocksuite:internal:text$': true,
        delta: [{ insert: name }],
      },
      background: SLIDE_PALETTES[mask.variant].paper,
      xywh: xywh(0, 0, SLIDE_WIDTH, SLIDE_HEIGHT),
      index: 'a0',
      childElementIds: Object.fromEntries(
        Object.keys(elements).map(id => [id, true])
      ),
    },
    children: [],
  };
}

/** The template content of one mask: a page, its surface, the frame. */
export function slideSnapshot(mask: SlideMask, std?: BlockStdScope) {
  const elements = slideElements(mask, std);
  return makeTemplateSnapshot(elements, mask.name[1], [
    slideFrame(mask, elements, std),
  ]);
}

/* ── Slide number ─────────────────────────────────────────────────────── */

/**
 * Write the slide number once, at placement: the inserted frame's rank among
 * the document's frames in presentation order (`presentationIndex`, the
 * legacy frames without one after the keyed ones, as the frame manager
 * orders them). Later reordering does not renumber: the number is the
 * author's text from then on.
 *
 * ponytail: the template snapshot carries no `presentationIndex`, so the
 * inserted frame takes the schema default, `generateKeyBetweenV2(null,
 * null)`, whose random suffix ranks it anywhere among the frames: the number
 * is the frame's true rank, but that rank is arbitrary until the template
 * job's `presentationIndex` middleware (a key after the last frame) lands,
 * after which the new slide is always last. Nothing here changes then.
 */
export function numberSlide(std: BlockStdScope, insertedIds: string[]) {
  if (std.store.readonly) return;
  const numberId = insertedIds.at(-1);
  if (!numberId) return;
  const frames = std.store.getModelsByFlavour(
    'affine:frame'
  ) as FrameBlockModel[];
  const own = frames.find(frame => frame.childIds.includes(numberId));
  if (!own) return;
  std.get(GfxControllerIdentifier).updateElement(numberId, {
    text: new Y.Text(String(slideNumberOf(own, frames))),
  });
}

/** The fields of a frame the slide number is ranked by. */
type RankedFrame = { props: { presentationIndex?: string } };

/** A frame's 1-based rank among `frames`; ties count as before it. */
export function slideNumberOf<T extends RankedFrame>(own: T, frames: T[]) {
  const rank = (frame: T) => frame.props.presentationIndex || '\uffff';
  const ownRank = rank(own);
  return (
    1 + frames.filter(frame => frame !== own && rank(frame) <= ownRank).length
  );
}

/* ── Preview ──────────────────────────────────────────────────────────── */

const light = (color: Color) => resolveColor(color, ColorScheme.Light);

/** A text line drawn as a bar, the width of its English words (roughly). */
function textBars(zone: SlideTextZone, words: string, palette: SlidePalette) {
  const { fontSize } = SLIDE_TYPE[zone.role];
  const height = Math.max(6, fontSize * 0.55);
  const step = fontSize * SLIDE_LINE_HEIGHT;
  const full = words.length * fontSize * 0.5;
  const lines = Math.max(
    1,
    Math.min(zone.lines ?? 1, Math.ceil(full / zone.w))
  );
  const fill = light(zone.tone === 'muted' ? palette.muted : palette.ink);
  let out = '';
  for (let i = 0; i < lines; i++) {
    const remaining = full - i * zone.w;
    const w = Math.max(fontSize, Math.min(zone.w, remaining));
    const x =
      zone.align === 'center'
        ? zone.x + (zone.w - w) / 2
        : zone.align === 'right'
          ? zone.x + zone.w - w
          : zone.x;
    out += `<rect x="${x}" y="${zone.y + i * step + (step - height) / 2}" width="${w}" height="${height}" rx="${height / 2}" fill="${fill}"/>`;
  }
  return out;
}

function previewZone(zone: SlideZone, palette: SlidePalette): string {
  switch (zone.kind) {
    case 'text':
      return textBars(zone, zone.seed?.[1] ?? zone.digits ?? '', palette);
    case 'image':
    case 'card': {
      const filled =
        zone.kind === 'image' || (zone.kind === 'card' && zone.filled);
      const fill = filled ? light(palette.hairline) : 'none';
      const stroke = light(
        zone.kind === 'card' && zone.stroke === 'muted'
          ? palette.muted
          : zone.kind === 'image'
            ? palette.zoneStroke
            : palette.hairline
      );
      const dash = zone.kind === 'image' ? ' stroke-dasharray="16 12"' : '';
      if (zone.shape === 'ellipse') {
        return `<ellipse cx="${zone.x + zone.w / 2}" cy="${zone.y + zone.h / 2}" rx="${zone.w / 2}" ry="${zone.h / 2}" fill="${fill}" stroke="${stroke}" stroke-width="6"${dash}/>`;
      }
      return `<rect x="${zone.x}" y="${zone.y}" width="${zone.w}" height="${zone.h}" rx="${SLIDE_RADIUS}" fill="${fill}" stroke="${stroke}" stroke-width="6"${dash}/>`;
    }
    case 'dot':
      return `<circle cx="${zone.x + zone.size / 2}" cy="${zone.y + zone.size / 2}" r="${zone.size / 2}" fill="${light(palette.ink)}"/>`;
    case 'line':
      return `<path d="M${zone.from[0]} ${zone.from[1]} L${zone.to[0]} ${zone.to[1]}" stroke="${light(palette.muted)}" stroke-width="6"/>`;
  }
}

/**
 * The tile: the slide itself, drawn from its own declaration at 1/10th, so a
 * preview can never drift from what the mask inserts. Texts are bars, the
 * light side of every colour is used (a tile is chrome on the panel's own
 * paper), and the slide gets a hairline so a white slide shows on a white
 * panel.
 */
export function slidePreview(mask: SlideMask): string {
  const palette = SLIDE_PALETTES[mask.variant];
  const body = mask.zones.map(zone => previewZone(zone, palette)).join('');
  return `<svg width="100%" height="100%" viewBox="-20 -20 ${SLIDE_WIDTH + 40} ${SLIDE_HEIGHT + 40}" xmlns="http://www.w3.org/2000/svg"><rect x="0" y="0" width="${SLIDE_WIDTH}" height="${SLIDE_HEIGHT}" rx="16" fill="${light(palette.paper)}" stroke="${light(SLIDE_PALETTES.paper.hairline)}" stroke-width="8"/>${body}</svg>`;
}
