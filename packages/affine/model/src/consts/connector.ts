import { createEnumMap } from '../utils/enum.js';

export enum ConnectorEndpoint {
  Front = 'Front',
  Rear = 'Rear',
}

/**
 * The endpoint head painted at each end of a connector.
 *
 * **These string values are PERSISTED.** Every connector stores two of them
 * (`frontEndpointStyle` / `rearEndpointStyle`, see
 * `../elements/connector/connector.ts`), so the enum is **append-only**: a
 * member may be added, never renamed, never removed, and never given a
 * different string value. Renaming one would silently turn every stored
 * connector that carries it into an unknown style.
 *
 * **Adding a member is safe in both directions.** The canvas `renderEndpoint`
 * switch (`@labre/affine-gfx-connector`) and the DOM renderer's
 * `createArrowMarker` both have **no `default` branch** on purpose: a client
 * built before a member was added simply paints no head for it. The connector
 * itself, its geometry, its label and its bindings all still load and still
 * round-trip — degraded, never broken. The reverse is free: an older document
 * only ever carries members that already existed.
 *
 * `TriangleHollow` and `DiamondHollow` are the UML 2.5.1 heads — a hollow
 * closed triangle for generalization and realization, a hollow diamond for
 * shared aggregation. They are the same geometry as `Triangle` / `Diamond`,
 * filled with the notation card fill instead of the stroke colour; see
 * `docs/adr/0016-hollow-endpoint-styles.md`.
 */
export enum PointStyle {
  Arrow = 'Arrow',
  Circle = 'Circle',
  Diamond = 'Diamond',
  None = 'None',
  Triangle = 'Triangle',
  TriangleHollow = 'TriangleHollow',
  DiamondHollow = 'DiamondHollow',
}

export const PointStyleMap = createEnumMap(PointStyle);

export const DEFAULT_FRONT_ENDPOINT_STYLE = PointStyle.None;

export const DEFAULT_REAR_ENDPOINT_STYLE = PointStyle.Arrow;

export const CONNECTOR_LABEL_MAX_WIDTH = 280;

export enum ConnectorLabelOffsetAnchor {
  Bottom = 'bottom',
  Center = 'center',
  Top = 'top',
}

export enum ConnectorMode {
  Straight,
  Orthogonal,
  Curve,
}

export const DEFAULT_CONNECTOR_MODE = ConnectorMode.Curve;
