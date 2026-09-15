import {
  type CanvasRenderer,
  type ElementRenderer,
  ElementRendererExtension,
  type RoughCanvas,
} from '@labre/affine-block-surface';
import {
  getFontString,
  getLineHeight,
  getTextWidth,
  isRTL,
  type TextDelta,
  wrapTextDeltas,
} from '@labre/affine-gfx-text';
import {
  type ConnectorElementModel,
  type ConnectorLabelConstraintsProps,
  ConnectorMode,
  DefaultTheme,
  type LocalConnectorElementModel,
  type PointStyle,
  type TextStyleProps,
} from '@labre/affine-model';
import {
  getBezierParameters,
  type PointLocation,
  type XYWH,
} from '@labre/global/gfx';
import { deltaInsertsToChunks } from '@labre/std/inline';
import type * as Y from 'yjs';

import {
  isConnectorWithEndLabel,
  isConnectorWithLabel,
} from '../connector-manager.js';
import {
  DEFAULT_ARROW_SIZE,
  getArrowOptions,
  HOLLOW_HEAD_FILL,
  renderArrow,
  renderCircle,
  renderDiamond,
  renderTriangle,
} from './utils.js';

/**
 * One painted caption: the centre label, or either end label.
 *
 * The renderer does not care which it is holding — a label is a text, a box,
 * a style and a width constraint, and the three boxes on a connector differ
 * only in where they sit. End labels deliberately reuse the connector's
 * `labelStyle`: one font, one colour, one size per connector, so no new
 * persisted style fields (ADR 0020).
 */
type PaintedLabel = {
  text: Y.Text;
  xywh: XYWH;
  style: TextStyleProps;
  constraints: ConnectorLabelConstraintsProps;
};

/** The captions this connector paints, in the order they are drawn. */
function paintedLabels(
  model: ConnectorElementModel | LocalConnectorElementModel
): PaintedLabel[] {
  const labels: PaintedLabel[] = [];

  if (isConnectorWithLabel(model)) {
    const { text, labelXYWH, labelStyle, labelConstraints } =
      model as ConnectorElementModel;
    labels.push({
      text: text!,
      xywh: labelXYWH!,
      style: labelStyle,
      constraints: labelConstraints,
    });
  }

  for (const end of ['source', 'target'] as const) {
    if (!isConnectorWithEndLabel(model, end)) continue;
    const connectorModel = model as ConnectorElementModel;
    labels.push({
      text: connectorModel.endLabelText(end)!,
      xywh: connectorModel.endLabelXYWH(end)!,
      style: connectorModel.labelStyle,
      constraints: connectorModel.labelConstraints,
    });
  }

  return labels;
}

export const connector: ElementRenderer<
  ConnectorElementModel | LocalConnectorElementModel
> = (model, ctx, matrix, renderer, rc) => {
  const {
    mode,
    path: points,
    strokeStyle,
    frontEndpointStyle,
    rearEndpointStyle,
    strokeWidth,
  } = model;

  // points might not be build yet in some senarios
  // eg. undo/redo, copy/paste
  if (!points.length || points.length < 2) {
    return;
  }

  ctx.setTransform(matrix);

  const labels = paintedLabels(model);
  // Each label's box, expressed relative to the element's own origin — the
  // frame both the clip rects and the per-label transforms are written in.
  let offsets: Array<[number, number]> = [];

  if (labels.length) {
    ctx.save();

    const { deserializedXYWH } = model as ConnectorElementModel;
    const [x, y, w, h] = deserializedXYWH;
    const offset = DEFAULT_ARROW_SIZE * strokeWidth;

    offsets = labels.map(label => [label.xywh[0] - x, label.xywh[1] - y]);

    // One subtracted rect PER label: `evenodd` over the element rect and the
    // caption rects leaves the stroke everywhere except under a caption, so a
    // multiplicity beside an end punches the line exactly as the centre name
    // always has.
    const path = new Path2D();
    path.rect(-offset / 2, -offset / 2, w + offset, h + offset);
    labels.forEach((label, index) => {
      const [dx, dy] = offsets[index];
      const [, , lw, lh] = label.xywh;
      path.rect(dx - 3 - 0.5, dy - 3 - 0.5, lw + 6 + 1, lh + 6 + 1);
    });
    ctx.clip(path, 'evenodd');
  }

  const strokeColor = renderer.getColorValue(
    model.stroke,
    DefaultTheme.connectorColor,
    true
  );

  renderPoints(
    model,
    ctx,
    rc,
    points,
    strokeStyle === 'dash',
    mode === ConnectorMode.Curve,
    strokeColor
  );
  renderEndpoint(
    model,
    points,
    ctx,
    rc,
    'Front',
    frontEndpointStyle,
    strokeColor
  );
  renderEndpoint(
    model,
    points,
    ctx,
    rc,
    'Rear',
    rearEndpointStyle,
    strokeColor
  );

  if (labels.length) {
    ctx.restore();

    labels.forEach((label, index) => {
      const [dx, dy] = offsets[index];
      renderLabel(label, ctx, matrix.translate(dx, dy), renderer);
    });
  }
};

export const ConnectorElementRendererExtension = ElementRendererExtension(
  'connector',
  connector
);

function renderPoints(
  model: ConnectorElementModel | LocalConnectorElementModel,
  ctx: CanvasRenderingContext2D,
  rc: RoughCanvas,
  points: PointLocation[],
  dash: boolean,
  curve: boolean,
  stroke: string
) {
  const { seed, strokeWidth, roughness, rough } = model;

  if (rough) {
    const options = {
      seed,
      roughness,
      stroke,
      strokeLineDash: dash ? [12, 12] : undefined,
      strokeWidth,
    };
    if (curve) {
      const b = getBezierParameters(points);
      rc.path(
        `M${b[0][0]},${b[0][1]} C${b[1][0]},${b[1][1]} ${b[2][0]},${b[2][1]} ${b[3][0]},${b[3][1]}`,
        options
      );
    } else {
      rc.linearPath(points as unknown as [number, number][], options);
    }
  } else {
    ctx.save();
    ctx.strokeStyle = stroke;
    ctx.lineWidth = strokeWidth;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    dash && ctx.setLineDash([12, 12]);
    ctx.beginPath();
    if (curve) {
      points.forEach((point, index) => {
        if (index === 0) {
          ctx.moveTo(point[0], point[1]);
        } else {
          const last = points[index - 1];
          ctx.bezierCurveTo(
            last.absOut[0],
            last.absOut[1],
            point.absIn[0],
            point.absIn[1],
            point[0],
            point[1]
          );
        }
      });
    } else {
      points.forEach((point, index) => {
        if (index === 0) {
          ctx.moveTo(point[0], point[1]);
        } else {
          ctx.lineTo(point[0], point[1]);
        }
      });
    }
    ctx.stroke();
    ctx.closePath();
    ctx.restore();
  }
}

function renderEndpoint(
  model: ConnectorElementModel | LocalConnectorElementModel,
  location: PointLocation[],
  ctx: CanvasRenderingContext2D,
  rc: RoughCanvas,
  end: 'Front' | 'Rear',
  style: PointStyle,
  stroke: string
) {
  const arrowOptions = getArrowOptions(end, model, stroke);

  // No `default` on purpose: `PointStyle` is a persisted, append-only enum, so
  // a build older than a member paints no head rather than throwing or drawing
  // a wrong one. See the enum's docblock in `@labre/affine-model`.
  //
  // The hollow spread lives inside its own case: this runs once per endpoint
  // per frame, and a solid head — or `None`, the default on the front of every
  // connector — should not allocate an options object it never reads.
  switch (style) {
    case 'Arrow':
      renderArrow(location, ctx, rc, arrowOptions);
      break;
    case 'Triangle':
      renderTriangle(location, ctx, rc, arrowOptions);
      break;
    case 'TriangleHollow':
      renderTriangle(location, ctx, rc, {
        ...arrowOptions,
        fillColor: HOLLOW_HEAD_FILL,
      });
      break;
    case 'Circle':
      renderCircle(location, ctx, rc, arrowOptions);
      break;
    case 'Diamond':
      renderDiamond(location, ctx, rc, arrowOptions);
      break;
    case 'DiamondHollow':
      renderDiamond(location, ctx, rc, {
        ...arrowOptions,
        fillColor: HOLLOW_HEAD_FILL,
      });
      break;
  }
}

/**
 * Paints ONE caption at the origin of `matrix`.
 *
 * Takes a label rather than the connector: the centre name and the two end
 * labels are the same drawing, and the only thing that told them apart was
 * which pair of fields the function reached into.
 */
function renderLabel(
  label: PaintedLabel,
  ctx: CanvasRenderingContext2D,
  matrix: DOMMatrix,
  renderer: CanvasRenderer
) {
  const {
    text,
    xywh,
    style: { color, fontSize, fontWeight, fontStyle, fontFamily, textAlign },
    constraints: { hasMaxWidth, maxWidth },
  } = label;
  const font = getFontString({
    fontStyle,
    fontWeight,
    fontSize,
    fontFamily,
  });
  const [, , w, h] = xywh;
  const cx = w / 2;
  const cy = h / 2;

  ctx.setTransform(matrix);

  if (renderer.usePlaceholder) {
    ctx.fillStyle = 'rgba(200, 200, 200, 0.5)';
    ctx.fillRect(0, 0, w, h);
    return; // Skip actual label rendering
  }

  const deltas = wrapTextDeltas(text, font, w);
  const lines = deltaInsertsToChunks(deltas);
  const lineHeight = getLineHeight(fontFamily, fontSize, fontWeight);
  const textHeight = (lines.length - 1) * lineHeight * 0.5;

  ctx.font = font;
  ctx.textAlign = textAlign;
  ctx.textBaseline = 'middle';
  ctx.fillStyle = renderer.getColorValue(color, DefaultTheme.black, true);

  let textMaxWidth = textAlign === 'center' ? 0 : getMaxTextWidth(lines, font);
  if (hasMaxWidth && maxWidth > 0) {
    textMaxWidth = Math.min(textMaxWidth, textMaxWidth);
  }

  for (const [index, line] of lines.entries()) {
    for (const delta of line) {
      const str = delta.insert;
      const rtl = isRTL(str);
      const shouldTemporarilyAttach = rtl && !ctx.canvas.isConnected;
      if (shouldTemporarilyAttach) {
        // to correctly render RTL text mixed with LTR, we have to append it
        // to the DOM
        document.body.append(ctx.canvas);
      }

      ctx.canvas.setAttribute('dir', rtl ? 'rtl' : 'ltr');

      const x =
        textMaxWidth *
        (textAlign === 'center'
          ? 1
          : textAlign === 'right'
            ? rtl
              ? -0.5
              : 0.5
            : rtl
              ? 0.5
              : -0.5);
      ctx.fillText(str, x + cx, index * lineHeight - textHeight + cy);

      if (shouldTemporarilyAttach) {
        ctx.canvas.remove();
      }
    }
  }
}

function getMaxTextWidth(lines: TextDelta[][], font: string) {
  return Math.max(
    ...lines.flatMap(line =>
      line.map(delta => getTextWidth(delta.insert, font))
    )
  );
}
