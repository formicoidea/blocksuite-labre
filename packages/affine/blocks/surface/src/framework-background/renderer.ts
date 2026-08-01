import type { TranslationService } from '@labre/affine-shared/services';
import { TranslationProvider } from '@labre/affine-shared/services';
import type { GfxPrimitiveElementModel } from '@labre/std/gfx';

import type { CanvasRenderer } from '../renderer/canvas-renderer.js';
import type { ElementRenderer } from '../renderer/elements/index.js';
import type {
  BackgroundAxisDef,
  BackgroundColor,
  BackgroundTextDef,
  BackgroundTextStyle,
  FrameworkBackgroundDef,
} from './def.js';
import {
  backgroundColor,
  backgroundPlot,
  backgroundPoint,
  DEFAULT_BACKGROUND_SURFACE,
} from './def.js';
import type { BackgroundModelLike } from './labels.js';
import {
  backgroundLabelText,
  backgroundTexts,
  backgroundVisible,
} from './labels.js';

/**
 * The framework-background PRIMITIVE (PF2.1): one renderer, driven entirely by
 * a {@link FrameworkBackgroundDef}. A framework gets its background by
 * declaring it — not one line of drawing code per framework.
 *
 * ## The painting pipeline
 *
 * Fixed, and the whole of it. Order is the only thing a declaration cannot
 * change, because order is what makes two backgrounds look like the same
 * product rather than two drawings:
 *
 * 1. the card — the element rectangle;
 * 2. the washes, over the plot;
 * 3. the grid;
 * 4. the zone tints;
 * 5. the graduations of every axis;
 * 6. the axis lines and their arrowheads;
 * 7. the legend box;
 * 8. every text — zone names, then per axis its title and its end labels,
 *    then the free annotations.
 *
 * A declaration that says nothing but its size therefore paints a plain white
 * rectangle: no axis, no zone, no decoration.
 *
 * ## Units
 *
 * Ratios scale with the element; everything beside them — margins, font sizes,
 * stroke widths, label offsets — is FIXED model units, so the furniture stays
 * legible however large the background is stretched. Only the plot interior
 * moves.
 */

function roundRectPath(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
) {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

function rgba(hex: string, alpha: number) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

function fontOf(style: BackgroundTextStyle, fallbackFamily: string) {
  const italic = style.italic ? 'italic ' : '';
  const weight = style.weight ? `${style.weight} ` : '';
  return `${italic}${weight}${style.size}px ${style.family ?? fallbackFamily}`;
}

/** The family a declaration that names none falls back to. */
const DEFAULT_FONT_FAMILY = 'Inter, sans-serif';

/**
 * Build the canvas renderer of one declaration. Pure: the same declaration
 * always paints the same picture for the same model and size.
 */
export function createFrameworkBackgroundRenderer<
  T extends GfxPrimitiveElementModel,
>(def: FrameworkBackgroundDef): ElementRenderer<T> {
  const palette = def.chrome?.palette;
  const family = def.chrome?.fontFamily ?? DEFAULT_FONT_FAMILY;
  const surface = def.chrome?.surface ?? DEFAULT_BACKGROUND_SURFACE;
  const color = (c: BackgroundColor | undefined) => backgroundColor(c, palette);
  const texts = backgroundTexts(def);

  return (model, ctx, matrix, renderer) => {
    const props = model as unknown as BackgroundModelLike;
    const visible = (prop: string | undefined) =>
      backgroundVisible(prop, props);

    // The host's catalogue, resolved once per paint. Absent in a bare unit
    // test (the renderer is called with three arguments) and absent in a host
    // that ships no locale pack — both fall back to the declared wording.
    const translation: TranslationService | null =
      (renderer as CanvasRenderer | undefined)?.std.getOptional(
        TranslationProvider
      ) ?? null;

    const [, , w, h] = model.deserializedXYWH;
    const cx = w / 2;
    const cy = h / 2;
    ctx.setTransform(
      matrix
        .translateSelf(cx, cy)
        .rotateSelf(model.rotate)
        .translateSelf(-cx, -cy)
    );

    const plot = backgroundPlot(def, w, h);
    const { x0, y0, x1, y1 } = plot;
    const pw = plot.width;
    const ph = plot.height;

    const line = (ax: number, ay: number, bx: number, by: number) => {
      ctx.beginPath();
      ctx.moveTo(ax, ay);
      ctx.lineTo(bx, by);
      ctx.stroke();
    };

    const drawText = (
      words: string,
      ax: number,
      ay: number,
      style: BackgroundTextStyle,
      align: BackgroundTextDef['align'],
      vertical: boolean
    ) => {
      if (!words) return;
      if (vertical) {
        ctx.save();
        ctx.translate(ax, ay);
        ctx.rotate(-Math.PI / 2);
        ctx.font = fontOf(style, family);
        ctx.fillStyle = color(style.color);
        ctx.textAlign = align ?? 'center';
        ctx.textBaseline = 'alphabetic';
        ctx.fillText(words, 0, 0);
        ctx.restore();
        return;
      }
      ctx.font = fontOf(style, family);
      ctx.fillStyle = color(style.color);
      ctx.textAlign = align ?? 'left';
      ctx.textBaseline = 'alphabetic';
      ctx.fillText(words, ax, ay);
    };

    // ── 1. The card ─────────────────────────────────────────────────────
    const border = surface.border;
    const inset = border ? border.width / 2 : 0;
    roundRectPath(
      ctx,
      inset,
      inset,
      w - inset * 2,
      h - inset * 2,
      border?.radius ?? 0
    );
    if (surface.fill) {
      ctx.fillStyle = color(surface.fill);
      ctx.fill();
    }
    if (border) {
      ctx.strokeStyle = color(border.color);
      ctx.lineWidth = border.width;
      ctx.stroke();
    }

    // ── 2. Washes over the plot ─────────────────────────────────────────
    const washes = def.chrome?.washes;
    if (washes?.length) {
      const variant =
        def.variantProp === undefined ? undefined : props[def.variantProp];
      for (const wash of washes) {
        if (wash.variants && !wash.variants.includes(String(variant))) continue;
        if (!visible(wash.visibleProp)) continue;

        const gradient =
          wash.direction === 'horizontal'
            ? ctx.createLinearGradient(x0, 0, x1, 0)
            : ctx.createLinearGradient(0, y0, 0, y1);
        const hex = color(wash.color);
        for (const [offset, alpha] of wash.stops) {
          gradient.addColorStop(offset, rgba(hex, alpha));
        }
        ctx.fillStyle = gradient;
        ctx.fillRect(x0, y0, pw, ph);
      }
    }

    // ── 3. Grid ─────────────────────────────────────────────────────────
    const grid = def.chrome?.grid;
    if (grid && visible(grid.visibleProp)) {
      ctx.strokeStyle = color(grid.stroke.color);
      ctx.lineWidth = grid.stroke.width;
      ctx.setLineDash(grid.stroke.dash ? [...grid.stroke.dash] : []);
      if (grid.stepX) {
        const n = Math.round(1 / grid.stepX);
        for (let i = 1; i < n; i++) {
          const gx = x0 + (i / n) * pw;
          line(gx, y0, gx, y1);
        }
      }
      if (grid.stepY) {
        const n = Math.round(1 / grid.stepY);
        for (let i = 1; i < n; i++) {
          const gy = y0 + (i / n) * ph;
          line(x0, gy, x1, gy);
        }
      }
      ctx.setLineDash([]);
    }

    // ── 4. Zone tints ───────────────────────────────────────────────────
    for (const zone of def.zones ?? []) {
      if (!zone.fill) continue;
      if (!visible(zone.fillVisibleProp)) continue;
      ctx.fillStyle = color(zone.fill);
      ctx.fillRect(
        x0 + zone.rect.x * pw,
        y0 + zone.rect.y * ph,
        zone.rect.w * pw,
        zone.rect.h * ph
      );
    }

    // ── 5. Graduations ──────────────────────────────────────────────────
    for (const axis of def.axes ?? []) {
      const graduations = axis.ticks;
      if (!graduations || !visible(graduations.visibleProp)) continue;

      const horizontal = axis.orientation === 'horizontal';
      ctx.strokeStyle = color(graduations.stroke.color);
      ctx.lineWidth = graduations.stroke.width;
      ctx.setLineDash(
        graduations.stroke.dash ? [...graduations.stroke.dash] : []
      );
      const length = graduations.length ?? 6;
      const seat = horizontal ? y0 + axis.at * ph : x0 + axis.at * pw;
      for (const tick of graduations.ticks) {
        if (horizontal) {
          const tx = x0 + tick.at * pw;
          if (graduations.style === 'grid') line(tx, y0, tx, y1);
          else line(tx, seat - length / 2, tx, seat + length / 2);
        } else {
          // A vertical axis is graduated from the BOTTOM up: `at: 0` is the
          // origin of the value it measures, not the top of the screen.
          const ty = y1 - tick.at * ph;
          if (graduations.style === 'grid') line(x0, ty, x1, ty);
          else line(seat - length / 2, ty, seat + length / 2, ty);
        }
      }
      ctx.setLineDash([]);

      const labelStyle = graduations.labelStyle;
      if (labelStyle && visible(graduations.labelVisibleProp)) {
        const dx = graduations.labelOffset?.dx ?? 0;
        const dy = graduations.labelOffset?.dy ?? 0;
        for (const tick of graduations.ticks) {
          const words = backgroundLabelText(tick, props, translation);
          const tx = horizontal ? x0 + tick.at * pw : seat;
          const ty = horizontal ? seat : y1 - tick.at * ph;
          drawText(
            words,
            tx + dx,
            ty + dy,
            labelStyle,
            graduations.labelAlign ?? 'center',
            false
          );
        }
      }
    }

    // ── 6. Axis lines and arrowheads ────────────────────────────────────
    for (const axis of def.axes ?? []) {
      if (!visible(axis.visibleProp)) continue;
      drawAxis(ctx, axis, plot, color, line);
    }

    // ── 7. Legend ───────────────────────────────────────────────────────
    const legend = def.chrome?.legend;
    if (legend && visible(legend.visibleProp)) {
      const [lx, ly] = backgroundPoint(legend.anchor, plot);
      const rowCount = legend.rows.length + (legend.title ? 1 : 0);
      const boxH = legend.padding * 2 + rowCount * legend.rowHeight;
      const legendSurface = legend.surface ?? DEFAULT_BACKGROUND_SURFACE;
      const legendBorder = legendSurface.border;
      const li = legendBorder ? legendBorder.width / 2 : 0;
      roundRectPath(
        ctx,
        lx + li,
        ly + li,
        legend.width - li * 2,
        boxH - li * 2,
        legendBorder?.radius ?? 0
      );
      if (legendSurface.fill) {
        ctx.fillStyle = color(legendSurface.fill);
        ctx.fill();
      }
      if (legendBorder) {
        ctx.strokeStyle = color(legendBorder.color);
        ctx.lineWidth = legendBorder.width;
        ctx.stroke();
      }

      const swatch = legend.swatchSize ?? 12;
      let ry = ly + legend.padding;
      if (legend.title) {
        drawText(
          backgroundLabelText(legend.title, props, translation),
          lx + legend.padding,
          ry + legend.rowHeight * 0.7,
          legend.titleStyle ?? legend.rowStyle,
          'left',
          false
        );
        ry += legend.rowHeight;
      }
      for (const row of legend.rows) {
        if (row.swatch) {
          ctx.fillStyle = color(row.swatch);
          ctx.fillRect(
            lx + legend.padding,
            ry + (legend.rowHeight - swatch) / 2,
            swatch,
            swatch
          );
        }
        drawText(
          backgroundLabelText(row, props, translation),
          lx + legend.padding + (row.swatch ? swatch + 8 : 0),
          ry + legend.rowHeight * 0.7,
          legend.rowStyle,
          'left',
          false
        );
        ry += legend.rowHeight;
      }
    }

    // ── 8. Every text, in declaration order ─────────────────────────────
    for (const text of texts) {
      if (!visible(text.visibleProp)) continue;
      const [tx, ty] = backgroundPoint(text.anchor, plot);
      drawText(
        backgroundLabelText(text, props, translation),
        tx,
        ty,
        text.style,
        text.align,
        text.vertical === true
      );
    }
  };
}

/**
 * One axis: its line, stopping one unit inside the base of each arrowhead so
 * the stroke never pokes past the tip at any zoom, then the filled triangles.
 */
function drawAxis(
  ctx: CanvasRenderingContext2D,
  axis: BackgroundAxisDef,
  plot: ReturnType<typeof backgroundPlot>,
  color: (c: BackgroundColor | undefined) => string,
  line: (ax: number, ay: number, bx: number, by: number) => void
) {
  const { x0, y0, x1, y1 } = plot;
  const arrow = axis.arrow ?? 'none';
  const a = axis.arrowSize ?? 10;
  const forward = arrow === 'forward' || arrow === 'both';
  const backward = arrow === 'backward' || arrow === 'both';

  ctx.strokeStyle = color(axis.stroke.color);
  ctx.lineWidth = axis.stroke.width;
  ctx.fillStyle = color(axis.stroke.color);

  const triangle = (
    tipX: number,
    tipY: number,
    baseX: number,
    baseY: number,
    spreadX: number,
    spreadY: number
  ) => {
    ctx.beginPath();
    ctx.moveTo(tipX, tipY);
    ctx.lineTo(baseX - spreadX, baseY - spreadY);
    ctx.lineTo(baseX + spreadX, baseY + spreadY);
    ctx.closePath();
    ctx.fill();
  };

  if (axis.orientation === 'horizontal') {
    const y = y0 + axis.at * plot.height;
    line(backward ? x0 + a - 1 : x0, y, forward ? x1 - a + 1 : x1, y);
    if (forward) triangle(x1, y, x1 - a, y, 0, a / 2);
    if (backward) triangle(x0, y, x0 + a, y, 0, a / 2);
    return;
  }

  // Vertical: `forward` points UP — where a reader expects "more" to be.
  const x = x0 + axis.at * plot.width;
  line(x, backward ? y1 - a + 1 : y1, x, forward ? y0 + a - 1 : y0);
  if (forward) triangle(x, y0, x, y0 + a, a / 2, 0);
  if (backward) triangle(x, y1, x, y1 - a, a / 2, 0);
}
