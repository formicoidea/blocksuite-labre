import type { TranslationService } from '@labre/affine-shared/services';

import type {
  BackgroundInset,
  BackgroundTextDef,
  BackgroundTextStyle,
  FrameworkBackgroundDef,
} from './def.js';
import {
  backgroundInstanceZones,
  backgroundPlot,
  backgroundPoint,
  DEFAULT_BACKGROUND_WRAP_MAX_LINES,
} from './def.js';
import { BACKGROUND_TEXT_FIT_PADDING, wrapToWidth } from './ellipsis.js';
import type { BackgroundModelLike } from './labels.js';
import {
  backgroundInVariant,
  backgroundLabelText,
  backgroundVisible,
} from './labels.js';

/**
 * How thick a background's bands are, once their labels have been measured.
 *
 * A band whose label declares `fit: 'wrap'` is as thick as its declaration says
 * OR as thick as its wrapped words need, whichever is more (PO, 2026-10-27: a
 * BPMN pool's title band grows with its name instead of cutting it). That is a
 * function of measured text, so it cannot live in the declaration, and it must
 * not be computed twice: the renderer paints the band, the label hit boxes
 * (`labels.ts`) and a framework's own hit tests (`gfx/bpmn/src/pool-hit.ts`)
 * aim at it, and the three disagreeing by a unit is a double-click that lands
 * on the flow area beside the name it was aimed at. {@link backgroundBandWidths}
 * is the one resolver they all read.
 *
 * Nothing is written to the document. The stored geometry is the declared one,
 * and so is the plot the SEMANTIC readers use (facts, audit, rules, exports):
 * where an artefact sits in a frame must not move because a title was renamed.
 * Only the chrome — what is painted and what is aimed at — reads the grown
 * widths.
 *
 * Kept beside `def.ts` rather than in it because it needs the label resolution
 * of `labels.ts`, which itself reads `def.ts`.
 */

/** Width of `text` in model units when drawn in the CSS `font`. */
export type BackgroundTextMeasure = (text: string, font: string) => number;

/**
 * The line height of a wrapped label, as a multiple of its font size: the CSS
 * `normal` line height. Not the 1.25 the slides use — at 1.25 a single 13-unit
 * lane name would need 24.25 units and widen the BPMN pool's 24-unit lane strip
 * by a quarter unit for a name that fits it; a band only grows for a SECOND
 * line.
 */
export const BACKGROUND_WRAP_LINE_HEIGHT = 1.2;

/** The family a declaration that names none falls back to. */
export const DEFAULT_BACKGROUND_FONT_FAMILY = 'Inter, sans-serif';

/** The CSS font a background text is drawn in. */
export function backgroundFont(
  style: BackgroundTextStyle,
  fallbackFamily: string = DEFAULT_BACKGROUND_FONT_FAMILY
): string {
  const italic = style.italic ? 'italic ' : '';
  const weight = style.weight ? `${style.weight} ` : '';
  return `${italic}${weight}${style.size}px ${style.family ?? fallbackFamily}`;
}

/** Distance between two wrapped lines of this style, in model units. */
export function backgroundWrapLineHeight(style: BackgroundTextStyle): number {
  return style.size * BACKGROUND_WRAP_LINE_HEIGHT;
}

/**
 * The room a fitted declared text has: from its anchor to the card's edges
 * along the direction it reads, on the side(s) its alignment grows towards,
 * less {@link BACKGROUND_TEXT_FIT_PADDING} at each end. A vertical text reads
 * bottom-to-top, so `left` grows UP from its anchor.
 */
export function backgroundTextRoom(
  ax: number,
  ay: number,
  align: BackgroundTextDef['align'],
  vertical: boolean,
  w: number,
  h: number
): number {
  const pad = BACKGROUND_TEXT_FIT_PADDING;
  if (vertical) {
    const up = ay - pad;
    const down = h - ay - pad;
    const side = align ?? 'center';
    if (side === 'left') return up;
    if (side === 'right') return down;
    return 2 * Math.min(up, down);
  }
  const leftward = ax - pad;
  const rightward = w - ax - pad;
  const side = align ?? 'left';
  if (side === 'left') return rightward;
  if (side === 'right') return leftward;
  return 2 * Math.min(leftward, rightward);
}

/** Rough advance per code point, as a fraction of the font size. */
const ESTIMATED_ADVANCE = 0.55;

/**
 * A rough width with no canvas at all: 0.55 × the font size per code point, the
 * ratio `svg-sketch.ts` estimates with. The default of every headless caller
 * (this file is reachable from the `./interchange` entry, which loads no DOM);
 * a caller with a document passes `measureBackgroundText` (`measure-text.ts`),
 * which measures with the canvas's own metrics.
 */
export function estimateBackgroundText(text: string, font: string): number {
  const size = Number(/(\d+(?:\.\d+)?)px/.exec(font)?.[1]) || 12;
  return Array.from(text).length * size * ESTIMATED_ADVANCE;
}

/** A side band's label once wrapped: what to draw and where. */
export interface BackgroundWrappedLabel {
  lines: readonly string[];
  /**
   * Model units to add to the label's anchor, resolved against the GROWN plot,
   * so it keeps its offset from the middle of its band: half the growth, back
   * towards the card edge.
   */
  shift: readonly [number, number];
}

/** The bands of one instance, sized by what they hold. */
export interface BackgroundBandLayout {
  /** The margins, each side band grown to what its wrapped label needs. */
  margin: BackgroundInset;
  /**
   * Thickness of every instance-zone strip — the declared width or the one the
   * most demanding wrapped name needs. `undefined` without a strip.
   */
  zoneBandWidth: number | undefined;
  /** Each wrapped side-band label, by its declaration. */
  labels: ReadonlyMap<BackgroundTextDef, BackgroundWrappedLabel>;
  /** Each wrapped instance-zone name, by reported zone id. */
  zoneLines: ReadonlyMap<string, readonly string[]>;
}

const NO_LABELS: ReadonlyMap<BackgroundTextDef, BackgroundWrappedLabel> =
  new Map();
const NO_ZONE_LINES: ReadonlyMap<string, readonly string[]> = new Map();

/**
 * THE resolver of band thickness. Pure in its inputs: the declaration, the
 * instance's props, its size, and how to measure text — the renderer passes its
 * context, a hit test outside a paint `measureBackgroundText` (the same metrics
 * from an offscreen canvas), and a caller with no DOM gets the estimate.
 *
 * - a SIDE band whose label wraps is `max(declared margin, lines × line height
 *   + 2 × padding)` thick, the lines broken over the room the label has along
 *   the band (`backgroundTextRoom`, from its anchor in the declared plot);
 * - every INSTANCE-ZONE strip is one thickness: the declared width, or the
 *   most any zone's wrapped name needs, each name broken over its own zone's
 *   length less the padding. A lane with a long name widens every lane's strip,
 *   so the leading edges stay aligned.
 *
 * A declaration with no `'wrap'` anywhere gets its declared numbers back
 * without a single measurement, so the frameworks that never asked for this
 * pay nothing for it.
 *
 * ponytail: a text's room is measured against the DECLARED plot, so a
 * declaration wrapping both a left and a top band would size each without the
 * other's growth. Nothing declares two; upgrade by resolving the sides in turn
 * against the plot resolved so far, the day one does.
 */
export function backgroundBandWidths(
  def: FrameworkBackgroundDef,
  model: BackgroundModelLike,
  w: number,
  h: number,
  measure: BackgroundTextMeasure = estimateBackgroundText,
  translation?: TranslationService | null
): BackgroundBandLayout {
  const declared = def.geometry.margin;
  const zoneLabel = def.instanceZones?.label;
  const wrapsBand = (def.chrome?.sideBands ?? []).some(
    band => band.label?.fit === 'wrap'
  );
  const wrapsZones = zoneLabel?.band !== undefined && zoneLabel.fit === 'wrap';
  if (!wrapsBand && !wrapsZones) {
    return {
      margin: declared,
      zoneBandWidth: zoneLabel?.band?.width,
      labels: NO_LABELS,
      zoneLines: NO_ZONE_LINES,
    };
  }

  const family = def.chrome?.fontFamily ?? DEFAULT_BACKGROUND_FONT_FAMILY;
  const pad = BACKGROUND_TEXT_FIT_PADDING;
  const measurer = (font: string) => ({
    measureText: (text: string) =>
      ({ width: measure(text, font) }) as TextMetrics,
  });
  const thicknessFor = (lines: number, style: BackgroundTextStyle) =>
    lines > 0 ? lines * backgroundWrapLineHeight(style) + 2 * pad : 0;

  const margin: BackgroundInset = { ...declared };
  const wrapped: { label: BackgroundTextDef; side: 'left' | 'top' }[] = [];
  const lines = new Map<BackgroundTextDef, readonly string[]>();
  if (wrapsBand) {
    const plot = backgroundPlot(def, w, h);
    for (const band of def.chrome?.sideBands ?? []) {
      const label = band.label;
      if (label?.fit !== 'wrap') continue;
      // A label the instance does not paint holds nothing open.
      if (!backgroundInVariant(def, label.variants, model)) continue;
      if (!backgroundVisible(label.visibleProp, model)) continue;

      const vertical = label.vertical === true;
      const [ax, ay] = backgroundPoint(label.anchor, plot);
      const shown = wrapToWidth(
        measurer(backgroundFont(label.style, family)),
        backgroundLabelText(label, model, translation),
        backgroundTextRoom(ax, ay, label.align, vertical, w, h),
        label.maxLines ?? DEFAULT_BACKGROUND_WRAP_MAX_LINES
      );
      lines.set(label, shown);
      wrapped.push({ label, side: band.side });
      margin[band.side] = Math.max(
        margin[band.side],
        thicknessFor(shown.length, label.style)
      );
    }
  }

  const labels = new Map<BackgroundTextDef, BackgroundWrappedLabel>();
  for (const { label, side } of wrapped) {
    const back = (declared[side] - margin[side]) / 2;
    labels.set(label, {
      lines: lines.get(label) ?? [],
      shift: side === 'left' ? [back, 0] : [0, back],
    });
  }

  let zoneBandWidth = zoneLabel?.band?.width;
  const zoneLines = new Map<string, readonly string[]>();
  if (wrapsZones && zoneLabel && zoneBandWidth !== undefined) {
    const plot = backgroundPlot(def, w, h, margin);
    const stackY = def.instanceZones?.stack === 'y';
    const ctx = measurer(backgroundFont(zoneLabel.style, family));
    for (const zone of backgroundInstanceZones(def, model)) {
      if (zone.name === undefined || zone.name === '') continue;
      const length = stackY
        ? zone.rect.h * plot.height
        : zone.rect.w * plot.width;
      const shown = wrapToWidth(
        ctx,
        zone.name,
        length - 2 * pad,
        zoneLabel.maxLines ?? DEFAULT_BACKGROUND_WRAP_MAX_LINES
      );
      zoneLines.set(zone.id, shown);
      zoneBandWidth = Math.max(
        zoneBandWidth,
        thicknessFor(shown.length, zoneLabel.style)
      );
    }
  }

  return { margin, zoneBandWidth, labels, zoneLines };
}
