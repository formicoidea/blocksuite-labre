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
  backgroundInstanceZoneBand,
  backgroundInstanceZones,
  backgroundPlot,
  backgroundPoint,
  BROKEN_BACKGROUND_COLOR,
  DEFAULT_BACKGROUND_SURFACE,
  warnBrokenBackgroundColor,
} from './def.js';
import type { BackgroundModelLike } from './labels.js';
import {
  backgroundInVariant,
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
 * 1. the card — the element rectangle, and the side bands that dress it: the
 *    fill, then the bands over it, then the border over both, so the frame
 *    keeps outlining the whole element;
 * 2. the washes, over the plot;
 * 3. the zone tints, then the dividers between the zones THIS INSTANCE
 *    declares;
 * 4. the graduations of every axis;
 * 5. the axis lines and their arrowheads;
 * 6. every text — the band labels, the zone names, then per axis its title and
 *    its end labels, and last the names of the instance's own zones.
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

const HEX6 = /^#[0-9a-fA-F]{6}$/;

/**
 * A wash stop, as `rgba(...)`.
 *
 * Only `#rrggbb` can carry an alpha this way. Anything else — a named CSS
 * colour, a short hex, a palette entry that did not resolve — used to reach
 * `parseInt` and produce `rgba(NaN,NaN,NaN,0.4)`, which paints nothing at all
 * and says nothing about why. It now warns and paints
 * {@link BROKEN_BACKGROUND_COLOR}.
 */
function rgba(hex: string, alpha: number) {
  if (!HEX6.test(hex)) {
    warnBrokenBackgroundColor(
      `wash colour "${hex}" is not a #rrggbb literal, so it cannot take an alpha`
    );
    hex = BROKEN_BACKGROUND_COLOR;
  }
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
 * Where an instance zone's name sits in its band when the declaration states no
 * offset: 8 model units in from the leading edge, 18 down from the top of the
 * band.
 *
 * The two are not the same number, and that is not an oversight. The anchor is
 * a BASELINE by default ({@link BackgroundTextStyle.baseline}), so the words
 * hang ABOVE it: `dy` has to clear a cap height before it is an inset at all,
 * and 18 leaves a name of the usual 12–15 units sitting just inside the top of
 * its band. A declaration whose style anchors `middle` wants its own.
 */
const DEFAULT_INSTANCE_ZONE_LABEL_DX = 8;
const DEFAULT_INSTANCE_ZONE_LABEL_DY = 18;

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
  // The DECLARATION of the instance partition — how it stacks, how it is drawn.
  // What it contains is the model's business and is read on every paint.
  const instanceZonesDef = def.instanceZones;

  return (model, ctx, matrix, renderer) => {
    const props = model as unknown as BackgroundModelLike;
    const visible = (prop: string | undefined) =>
      backgroundVisible(prop, props);
    // Which READING of the frame this instance is showing. Washes, zones and
    // texts all name the variants they belong to, and a declaration that names
    // none belongs to every one of them.
    const inVariant = (variants: readonly string[] | undefined) =>
      backgroundInVariant(def, variants, props);

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
        ctx.textBaseline = style.baseline ?? 'alphabetic';
        ctx.fillText(words, 0, 0);
        ctx.restore();
        return;
      }
      ctx.font = fontOf(style, family);
      ctx.fillStyle = color(style.color);
      ctx.textAlign = align ?? 'left';
      ctx.textBaseline = style.baseline ?? 'alphabetic';
      ctx.fillText(words, ax, ay);
    };

    // ── 1. The card, and the bands that dress it ────────────────────────
    const border = surface.border;
    const inset = border ? border.width / 2 : 0;
    const cardPath = () =>
      roundRectPath(
        ctx,
        inset,
        inset,
        w - inset * 2,
        h - inset * 2,
        border?.radius ?? 0
      );

    cardPath();
    if (surface.fill) {
      ctx.fillStyle = color(surface.fill);
      ctx.fill();
    }

    // The side bands sit BETWEEN the fill and the border: a band is part of the
    // card, and one painted over the frame would erase the edge it runs along,
    // which reads as a broken card rather than as a band. Drawing a divider
    // resets the current path, hence the second trace before the stroke — a
    // declaration with no band never reaches it, so its picture is unchanged
    // down to the operation.
    const bands = def.chrome?.sideBands;
    if (bands?.length) {
      // The band IS the margin strip, clamped to an element narrower than its
      // own margin — the one case where the two can disagree.
      const bandWidth = Math.min(x0, w);
      for (const band of bands) {
        if (bandWidth <= 0) continue;
        if (band.fill) {
          ctx.fillStyle = color(band.fill);
          ctx.fillRect(0, 0, bandWidth, h);
        }
        const divider = band.divider;
        if (divider) {
          ctx.strokeStyle = color(divider.color);
          ctx.lineWidth = divider.width;
          if (divider.dash?.length) ctx.setLineDash([...divider.dash]);
          // Full height: the strip a margin gives up runs the whole side.
          line(bandWidth, 0, bandWidth, h);
          if (divider.dash?.length) ctx.setLineDash([]);
        }
      }
      if (border) cardPath();
    }

    if (border) {
      ctx.strokeStyle = color(border.color);
      ctx.lineWidth = border.width;
      if (border.dash?.length) ctx.setLineDash([...border.dash]);
      ctx.stroke();
      if (border.dash?.length) ctx.setLineDash([]);
    }

    // ── 2. Washes over the plot ─────────────────────────────────────────
    const washes = def.chrome?.washes;
    if (washes?.length) {
      for (const wash of washes) {
        if (!inVariant(wash.variants)) continue;
        if (!visible(wash.visibleProp)) continue;

        const gradient = ctx.createLinearGradient(x0, 0, x1, 0);
        const hex = color(wash.color);
        for (const [offset, alpha] of wash.stops) {
          gradient.addColorStop(offset, rgba(hex, alpha));
        }
        ctx.fillStyle = gradient;
        ctx.fillRect(x0, y0, pw, ph);
      }
    }

    // ── 3. Zone tints ───────────────────────────────────────────────────
    for (const zone of def.zones ?? []) {
      if (!zone.fill) continue;
      if (!inVariant(zone.variants)) continue;
      if (!visible(zone.fillVisibleProp)) continue;
      ctx.fillStyle = color(zone.fill);
      ctx.fillRect(
        x0 + zone.rect.x * pw,
        y0 + zone.rect.y * ph,
        zone.rect.w * pw,
        zone.rect.h * ph
      );
    }

    // The partition THIS element carries, resolved once per paint: alone on
    // this pipeline it is a function of the model rather than of the
    // declaration. A framework that declares none never reads the model and
    // never allocates.
    const instanceZones = instanceZonesDef
      ? backgroundInstanceZones(def, props)
      : [];

    // Dividers between adjacent instance zones: N zones, N−1 lines, on the
    // INTERNAL boundaries only — the outer edges belong to the plot, and a line
    // there would double the frame that is already drawn round it.
    //
    // Painted here, at the end of stage 3, rather than with the axis lines: a
    // divider is part of what the zones ARE, so it belongs with the zones, and
    // it must lie UNDER the graduations and the axes, which describe the frame
    // of reference the user cannot move. After the tints, for the ordinary
    // reason a fill goes under a line.
    const zoneDivider = instanceZonesDef?.divider;
    if (zoneDivider && instanceZones.length > 1) {
      ctx.strokeStyle = color(zoneDivider.color);
      ctx.lineWidth = zoneDivider.width;
      if (zoneDivider.dash?.length) ctx.setLineDash([...zoneDivider.dash]);
      // Every zone but the first opens on a boundary with the one before it.
      for (let i = 1; i < instanceZones.length; i++) {
        const { x, y } = instanceZones[i].rect;
        if (instanceZonesDef?.stack === 'y') {
          const ty = y0 + y * ph;
          line(x0, ty, x1, ty);
        } else {
          const tx = x0 + x * pw;
          line(tx, y0, tx, y1);
        }
      }
      if (zoneDivider.dash?.length) ctx.setLineDash([]);
    }

    // ── 4. Graduations ──────────────────────────────────────────────────
    for (const axis of def.axes ?? []) {
      const graduations = axis.ticks;
      if (!graduations || !visible(graduations.visibleProp)) continue;

      ctx.strokeStyle = color(graduations.stroke.color);
      ctx.lineWidth = graduations.stroke.width;
      ctx.setLineDash(
        graduations.stroke.dash ? [...graduations.stroke.dash] : []
      );
      for (const tick of graduations.ticks) {
        if (axis.orientation === 'horizontal') {
          const tx = x0 + tick.at * pw;
          line(tx, y0, tx, y1);
        } else {
          // A vertical axis is graduated from the BOTTOM up: `at: 0` is the
          // origin of the value it measures, not the top of the screen.
          const ty = y1 - tick.at * ph;
          line(x0, ty, x1, ty);
        }
      }
      ctx.setLineDash([]);
    }

    // ── 5. Axis lines and arrowheads ────────────────────────────────────
    for (const axis of def.axes ?? []) {
      if (!visible(axis.visibleProp)) continue;
      drawAxis(ctx, axis, plot, color, line);
    }

    // ── 6. Every text, in declaration order ─────────────────────────────
    for (const text of texts) {
      if (!inVariant(text.variants)) continue;
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

    // The instance's own zone names, after the declared texts — the same order
    // the audit reports them in, and the same reason: what the framework says
    // comes first, what this element adds comes after.
    //
    // Deliberately NOT routed through `backgroundTexts` (see `labels.ts`): that
    // walk is a function of the DECLARATION alone, and these names are a
    // function of the MODEL. A zone name is therefore not in the declaration's
    // hit-test walk, and the two cannot disagree. Under the BAND placement the
    // framework's own view hit-tests `backgroundInstanceZoneBand` instead —
    // the very rectangle painted below — so the words a user aims at and the
    // words they get are one shape rather than two constants that must agree.
    const zoneLabel = instanceZonesDef?.label;
    if (zoneLabel) {
      const labelBand = zoneLabel.band;
      const dx = zoneLabel.dx ?? DEFAULT_INSTANCE_ZONE_LABEL_DX;
      const dy = zoneLabel.dy ?? DEFAULT_INSTANCE_ZONE_LABEL_DY;
      const stackY = instanceZonesDef?.stack === 'y';

      for (const zone of instanceZones) {
        // The strip is drawn for EVERY zone, named or not: it is the lane's
        // title band, and a lane whose name has been cleared still has one —
        // an empty band that reads as a lane waiting to be named, rather than
        // a lane that silently loses its structure. The NAME is what is
        // conditional, exactly as under the corner placement.
        const strip = labelBand
          ? backgroundInstanceZoneBand(def, zone, plot)
          : null;

        if (strip && labelBand?.divider) {
          const divider = labelBand.divider;
          ctx.strokeStyle = color(divider.color);
          ctx.lineWidth = divider.width;
          if (divider.dash?.length) ctx.setLineDash([...divider.dash]);
          // The far edge of the strip, along the zone: the near edge is the
          // plot boundary, already drawn by the frame or by the side band.
          if (stackY) {
            line(
              strip.x + strip.w,
              strip.y,
              strip.x + strip.w,
              strip.y + strip.h
            );
          } else {
            line(
              strip.x,
              strip.y + strip.h,
              strip.x + strip.w,
              strip.y + strip.h
            );
          }
          if (divider.dash?.length) ctx.setLineDash([]);
        }

        // An unnamed zone is a band and nothing else; it is not an empty label.
        if (zone.name === undefined || zone.name === '') continue;

        if (strip) {
          // Centred ACROSS the strip and ALONG it, the way the participant name
          // is centred in its own band one level up. `middle` regardless of
          // what the style says: the room the text is given is the width of the
          // strip, and a baseline anchor there would push the words against the
          // divider.
          const style = { ...zoneLabel.style, baseline: 'middle' as const };
          drawText(
            zone.name,
            strip.x + strip.w / 2,
            strip.y + strip.h / 2,
            style,
            'center',
            stackY
          );
          continue;
        }

        drawText(
          zone.name,
          x0 + zone.rect.x * pw + dx,
          y0 + zone.rect.y * ph + dy,
          zoneLabel.style,
          'left',
          false
        );
      }
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
