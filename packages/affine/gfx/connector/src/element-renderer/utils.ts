import type { RoughCanvas } from '@labre/affine-block-surface';
import {
  type ConnectorElementModel,
  ConnectorMode,
  type LocalConnectorElementModel,
} from '@labre/affine-model';
import { NOTATION_NEUTRALS } from '@labre/affine-shared/consts';
import type {
  BezierCurveParameters,
  IVec,
  PointLocation,
} from '@labre/global/gfx';
import { getBezierParameters, getBezierTangent, Vec } from '@labre/global/gfx';

type ConnectorEnd = 'Front' | 'Rear';

export const DEFAULT_ARROW_SIZE = 15;

/**
 * The interior of a hollow endpoint head (`TriangleHollow`, `DiamondHollow`).
 *
 * The notation card fill (R33), NOT a theme-resolved token and NOT
 * `transparent`: a UML hollow head reads as a white shape sitting on top of the
 * line it terminates, exactly like the class box it points at — which is itself
 * painted `NOTATION_NEUTRALS.cardFill` in every theme. `transparent` would let
 * the connector's own line show through the head; a theme token would turn the
 * head black-on-black next to a card-white box in a dark host.
 */
export const HOLLOW_HEAD_FILL = NOTATION_NEUTRALS.cardFill;

export function getArrowPoints(
  points: PointLocation[],
  size = 10,
  mode: ConnectorMode,
  bezierParameters: BezierCurveParameters,
  endPoint: ConnectorEnd = 'Rear',
  radians: number = Math.PI / 4
) {
  const anchorPoint = getPointWithTangent(
    points,
    mode,
    endPoint,
    bezierParameters
  );
  const unit = Vec.mul(anchorPoint.tangent, -1);
  const angle = endPoint === 'Front' ? Math.PI : 0;

  return {
    points: [
      Vec.add(Vec.mul(Vec.rot(unit, angle + radians), size), anchorPoint),
      anchorPoint,
      Vec.add(Vec.mul(Vec.rot(unit, angle - radians), size), anchorPoint),
    ],
  };
}

export function getCircleCenterPoint(
  points: PointLocation[],
  radius = 5,
  mode: ConnectorMode,
  bezierParameters: BezierCurveParameters,
  endPoint: ConnectorEnd = 'Rear'
) {
  const anchorPoint = getPointWithTangent(
    points,
    mode,
    endPoint,
    bezierParameters
  );

  const unit = Vec.mul(anchorPoint.tangent, -1);
  const angle = endPoint === 'Front' ? Math.PI : 0;

  return Vec.add(Vec.mul(Vec.rot(unit, angle), radius), anchorPoint);
}

export function getPointWithTangent(
  points: PointLocation[],
  mode: ConnectorMode,
  endPoint: ConnectorEnd,
  bezierParameters: BezierCurveParameters
) {
  const anchorIndex = endPoint === 'Rear' ? points.length - 1 : 0;
  const pointToAnchorIndex =
    endPoint === 'Rear' ? anchorIndex - 1 : anchorIndex + 1;
  const anchorPoint = points[anchorIndex];
  const pointToAnchor = points[pointToAnchorIndex];

  const clone = anchorPoint.clone();
  let tangent;
  if (mode !== ConnectorMode.Curve) {
    tangent =
      endPoint === 'Rear'
        ? Vec.tangent(anchorPoint, pointToAnchor)
        : Vec.tangent(pointToAnchor, anchorPoint);
  } else {
    // Preserve shape-provided edge tangent for arrow direction rather than
    // deriving it from the Bezier curve.  For shapes whose vertices follow
    // clockwise winding (rect, diamond, triangle, ellipse, polygon), the
    // edge tangent's perpendicular gives the correct inward / outward normal
    // that matches the connector's approach or departure direction.
    const shapeTangent = anchorPoint.tangent;
    if (shapeTangent[0] !== 0 || shapeTangent[1] !== 0) {
      // CW winding: CCW 90° rotation → inward normal (Rear / approach),
      //             CW  90° rotation → outward normal (Front / departure).
      tangent =
        endPoint === 'Rear'
          ? ([-shapeTangent[1], shapeTangent[0]] as IVec)
          : ([shapeTangent[1], -shapeTangent[0]] as IVec);
    } else {
      tangent =
        endPoint === 'Rear'
          ? getBezierTangent(bezierParameters, 1)
          : getBezierTangent(bezierParameters, 0);
    }
  }
  clone.tangent = tangent ?? [0, 0];

  return clone;
}

export function getDiamondPoints(
  point: PointLocation,
  size = 10,
  endPoint: ConnectorEnd = 'Rear'
) {
  const unit = Vec.mul(point.tangent, -1);
  const angle = endPoint === 'Front' ? Math.PI : 0;

  const diamondPoints = [
    Vec.add(Vec.mul(Vec.rot(unit, angle + Math.PI * 0.25), size), point),
    point,
    Vec.add(Vec.mul(Vec.rot(unit, angle - Math.PI * 0.25), size), point),
    Vec.add(Vec.mul(Vec.rot(unit, angle), size * Math.sqrt(2)), point),
  ];

  return {
    points: diamondPoints,
  };
}

export type ArrowOptions = ReturnType<typeof getArrowOptions>;

/**
 * @param fillColor the interior of a closed head. Defaults to `strokeColor`, so
 *   a `Triangle` or a `Diamond` stays the solid head it has always been; the
 *   hollow UML heads pass `HOLLOW_HEAD_FILL` instead.
 */
export function getArrowOptions(
  end: ConnectorEnd,
  model: ConnectorElementModel | LocalConnectorElementModel,
  strokeColor: string,
  fillColor: string = strokeColor
) {
  const { seed, mode, rough, roughness, strokeWidth, path } = model;

  return {
    end,
    seed,
    mode,
    rough,
    roughness,
    strokeWidth,
    strokeColor,
    fillColor,
    fillStyle: 'solid',
    bezierParameters: getBezierParameters(path),
  };
}

export function getRcOptions(options: ArrowOptions) {
  const { seed, roughness, strokeWidth, strokeColor, fillColor } = options;
  return {
    seed,
    roughness,
    stroke: strokeColor,
    strokeWidth,
    fill: fillColor,
    fillStyle: 'solid',
  };
}

/**
 * @param color the outline colour.
 * @param fillColor the interior colour. Defaults to `color` — the solid head.
 *   A hollow head passes the notation card fill, so the outline stays the
 *   connector's colour while the inside reads as empty.
 */
export function renderRoundedPolygon(
  ctx: CanvasRenderingContext2D,
  points: IVec[],
  color: string,
  strokeWidth: number,
  fill: boolean = true,
  fillColor: string = color
) {
  ctx.fillStyle = fillColor;
  ctx.strokeStyle = color;
  ctx.lineWidth = strokeWidth;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  ctx.save();
  ctx.beginPath();

  for (let i = 0; i < points.length; i++) {
    if (i === 0) {
      ctx.moveTo(points[i][0], points[i][1]);
    } else {
      ctx.lineTo(points[i][0], points[i][1]);
    }
  }

  if (fill) {
    ctx.closePath();
    ctx.fill();
  }

  ctx.stroke();
  ctx.restore();
}

export function renderArrow(
  points: PointLocation[],
  ctx: CanvasRenderingContext2D,
  rc: RoughCanvas,
  options: ArrowOptions
) {
  const { mode, end, bezierParameters, rough, strokeColor, strokeWidth } =
    options;
  const radians = Math.PI / 4;
  const size = DEFAULT_ARROW_SIZE * (strokeWidth / 2);
  const { points: arrowPoints } = getArrowPoints(
    points,
    size,
    mode,
    bezierParameters,
    end,
    radians
  );

  if (rough) {
    rc.linearPath(arrowPoints as [number, number][], getRcOptions(options));
  } else {
    renderRoundedPolygon(ctx, arrowPoints, strokeColor, strokeWidth, false);
  }
}

export function renderTriangle(
  points: PointLocation[],
  ctx: CanvasRenderingContext2D,
  rc: RoughCanvas,
  options: ArrowOptions
) {
  const {
    mode,
    end,
    bezierParameters,
    rough,
    fillColor,
    strokeColor,
    strokeWidth,
  } = options;
  const radians = Math.PI / 6;
  const size = DEFAULT_ARROW_SIZE * (strokeWidth / 2);
  const { points: trianglePoints } = getArrowPoints(
    points,
    size,
    mode,
    bezierParameters,
    end,
    radians
  );

  if (rough) {
    rc.polygon(
      [
        [trianglePoints[0][0], trianglePoints[0][1]],
        [trianglePoints[1][0], trianglePoints[1][1]],
        [trianglePoints[2][0], trianglePoints[2][1]],
      ],
      getRcOptions(options)
    );
  } else {
    renderRoundedPolygon(
      ctx,
      trianglePoints,
      strokeColor,
      strokeWidth,
      true,
      fillColor
    );
  }
}

export function renderDiamond(
  points: PointLocation[],
  ctx: CanvasRenderingContext2D,
  rc: RoughCanvas,
  options: ArrowOptions
) {
  const {
    mode,
    end,
    rough,
    bezierParameters,
    fillColor,
    strokeColor,
    strokeWidth,
  } = options;
  const anchorPoint = getPointWithTangent(points, mode, end, bezierParameters);
  const size = 10 * (strokeWidth / 2);
  const { points: diamondPoints } = getDiamondPoints(anchorPoint, size, end);

  if (rough) {
    rc.polygon(
      [
        [diamondPoints[0][0], diamondPoints[0][1]],
        [diamondPoints[1][0], diamondPoints[1][1]],
        [diamondPoints[2][0], diamondPoints[2][1]],
        [diamondPoints[3][0], diamondPoints[3][1]],
      ],
      getRcOptions(options)
    );
  } else {
    renderRoundedPolygon(
      ctx,
      diamondPoints,
      strokeColor,
      strokeWidth,
      true,
      fillColor
    );
  }
}

export function renderCircle(
  points: PointLocation[],
  ctx: CanvasRenderingContext2D,
  rc: RoughCanvas,
  options: ArrowOptions
) {
  const {
    bezierParameters,
    mode,
    end,
    fillColor,
    strokeColor,
    strokeWidth,
    rough,
  } = options;
  const radius = 5 * (strokeWidth / 2);
  const centerPoint = getCircleCenterPoint(
    points,
    radius,
    mode,
    bezierParameters,
    end
  );
  const cx = centerPoint[0];
  const cy = centerPoint[1];

  if (rough) {
    // radius + 2 when render rough circle to avoid connector line cross the circle and make it looks bad
    rc.circle(cx, cy, radius + 2, getRcOptions(options));
  } else {
    ctx.fillStyle = fillColor;
    ctx.strokeStyle = strokeColor;
    ctx.lineWidth = strokeWidth;
    ctx.save();
    ctx.beginPath();
    ctx.ellipse(cx, cy, radius, radius, 0, 0, 2 * Math.PI);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }
}
