import {
  type SurfaceBlockModel,
  type SurfaceMiddleware,
  surfaceMiddlewareExtension,
} from '@labre/affine-block-surface';
import {
  type ConnectorElementModel,
  ShapeElementModel,
  ShapeType,
} from '@labre/affine-model';
import { Bound, Vec } from '@labre/global/gfx';
import type { IVec } from '@labre/global/gfx';
import type { GfxModel } from '@labre/std/gfx';

import { ConnectorPathGenerator, getAnchors } from './connector-manager';

/**
 * Re-anchor connector endpoints that are attached to the given polygon element.
 *
 * When polygon vertices are edited (moved, added, or deleted), the normalized
 * bounding-box positions stored in `connector.source.position` /
 * `connector.target.position` may no longer correspond to any vertex or edge
 * midpoint of the updated polygon.  This function projects each stored
 * position into absolute model space, finds the nearest valid anchor on the
 * updated polygon boundary (vertex or edge midpoint), and writes the new
 * normalized coordinate back to the connector, persisting it in the CRDT.
 *
 * Must be called BEFORE `addToUpdateList` so that the path generator uses
 * the freshly re-anchored positions when it runs in the next microtask.
 */
function reanchorConnectorsForPolygon(
  surface: SurfaceBlockModel,
  polygonId: string,
  elementGetter: (id: string) => GfxModel | null
): void {
  const element = elementGetter(polygonId);
  if (
    !(element instanceof ShapeElementModel) ||
    element.shapeType !== ShapeType.Polygon
  ) {
    return;
  }

  // Compute the polygon's current anchor points (vertices + edge midpoints).
  const anchors = getAnchors(element);
  if (anchors.length === 0) return;

  const bound = Bound.deserialize(element.xywh);
  const connectors = surface.getConnectors(polygonId);

  for (const connector of connectors) {
    for (const endpointType of ['source', 'target'] as const) {
      const connection = connector[endpointType];

      // Only process endpoints that are explicitly anchored to this polygon
      // at a specific normalized position.
      if (connection?.id !== polygonId) continue;
      if (!connection.position) continue;

      // Convert the stored normalized [0-1] position to absolute model coords.
      const [nx, ny] = connection.position;
      const absPos: IVec = [bound.x + nx * bound.w, bound.y + ny * bound.h];

      // Find the nearest anchor on the updated polygon boundary.
      let nearestCoord: [number, number] = connection.position as [
        number,
        number,
      ];
      let minDist = Infinity;
      for (const anchor of anchors) {
        const d = Vec.dist(absPos, anchor.point as IVec);
        if (d < minDist) {
          minDist = d;
          nearestCoord = anchor.coord as [number, number];
        }
      }

      // Persist the new anchor position only if it actually changed.
      const [oldNx, oldNy] = connection.position;
      const [newNx, newNy] = nearestCoord;
      if (Math.abs(oldNx - newNx) > 1e-6 || Math.abs(oldNy - newNy) > 1e-6) {
        connector[endpointType] = { ...connection, position: nearestCoord };
      }
    }
  }
}

export const connectorWatcher: SurfaceMiddleware = (
  surface: SurfaceBlockModel
) => {
  const hasElementById = (id: string) =>
    surface.hasElementById(id) || surface.store.hasBlock(id);
  const elementGetter = (id: string) =>
    surface.getElementById(id) ?? (surface.store.getModelById(id) as GfxModel);
  const updateConnectorPath = (
    connector: ConnectorElementModel,
    local: boolean
  ) => {
    if (
      ((connector.source?.id && hasElementById(connector.source.id)) ||
        (!connector.source?.id && connector.source?.position)) &&
      ((connector.target?.id && hasElementById(connector.target.id)) ||
        (!connector.target?.id && connector.target?.position))
    ) {
      // The path itself is `@local()` — every peer recomputes it to repaint.
      // The label box is not: only the peer that authored the change persists
      // it, the others read the value that arrives with the sync.
      ConnectorPathGenerator.updatePath(connector, null, elementGetter, {
        persistLabelXYWH: local,
      });
    }
  };
  /**
   * Routes one connector, and never throws (ADR 0056). A connector whose
   * routing throws used to stop the loop it was in: the connectors after it
   * went unrouted, at mount and in every batch it was part of, and a throw in
   * the microtask left `pendingFlag` up for the session. It is reported once,
   * the others are routed.
   */
  const reported = new WeakSet<ConnectorElementModel>();
  const routeConnector = (connector: ConnectorElementModel, local: boolean) => {
    try {
      updateConnectorPath(connector, local);
    } catch (error) {
      if (reported.has(connector)) return;
      reported.add(connector);
      console.error('[labre] a connector cannot be routed', error);
    }
  };
  /**
   * Connectors whose path must be recomputed in the next microtask, mapped to
   * whether ANY of the changes that queued them was local — a single local
   * gesture is enough to let the peer persist the derived label box.
   */
  const pendingList = new Map<ConnectorElementModel, boolean>();
  let pendingFlag = false;
  const addToUpdateList = (
    connector: ConnectorElementModel,
    local: boolean
  ) => {
    pendingList.set(connector, (pendingList.get(connector) ?? false) || local);

    if (!pendingFlag) {
      pendingFlag = true;
      queueMicrotask(() => {
        pendingList.forEach((isLocal, connector) =>
          routeConnector(connector, isLocal)
        );
        pendingList.clear();
        pendingFlag = false;
      });
    }
  };

  const disposables = [
    surface.elementAdded.subscribe(({ id, local }) => {
      const element = elementGetter(id);

      if (!element) return;

      if ('type' in element && element.type === 'connector') {
        addToUpdateList(element as ConnectorElementModel, local);
      } else {
        surface
          .getConnectors(id)
          .forEach(connector => addToUpdateList(connector, local));
      }
    }),
    surface.elementUpdated.subscribe(({ id, props, local }) => {
      const element = elementGetter(id);

      // The element may already be gone by the time the update is delivered
      // (a remote peer that moved and then deleted it, an undo…).
      if (!element) return;

      if (local && props['vertices']) {
        // When polygon vertices change, re-anchor connected connectors to the
        // nearest valid boundary point BEFORE scheduling the path update, so
        // the path generator uses the corrected anchor positions.
        //
        // LOCAL ONLY: re-anchoring writes `source`/`target`, both persisted
        // `@field()`s. The peer that edited the vertices re-anchors and syncs
        // the result, so doing it again on a receiving peer is a duplicate
        // write — and an illegal one on a readonly viewer (see #242).
        reanchorConnectorsForPolygon(surface, id, elementGetter);
      }

      if (props['xywh'] || props['rotate'] || props['vertices']) {
        // Not gated on `local`: `path`, `absolutePath` and the connector's own
        // `xywh` are `@local()`, so every peer must recompute them to repaint.
        surface
          .getConnectors(id)
          .forEach(connector => addToUpdateList(connector, local));
      }

      if (
        'type' in element &&
        element.type === 'connector' &&
        (props['mode'] !== undefined ||
          props['target'] ||
          props['source'] ||
          props['curveControlPoint'] !== undefined)
      ) {
        const connector = element as ConnectorElementModel;

        // Clear custom handle data when connector mode changes. `local` only:
        // `curveControlPoint` is persisted, and the peer that changed the mode
        // cleared it in the same gesture.
        if (local && props['mode'] !== undefined) {
          if (connector.curveControlPoint !== null) {
            connector.curveControlPoint = null;
          }
        }

        addToUpdateList(connector, local);
      }
    }),
    surface.store.slots.blockUpdated.subscribe(payload => {
      if (
        payload.type === 'add' ||
        (payload.type === 'update' && payload.props.key === 'xywh')
      ) {
        surface
          .getConnectors(payload.id)
          .forEach(connector => addToUpdateList(connector, payload.isLocal));
      }
    }),
  ];

  // Mount-time recompute of the `@local()` geometry. Not a local gesture:
  // merely OPENING a document must not rewrite every connector's label box.
  surface
    .getElementsByType('connector')
    .forEach(connector =>
      routeConnector(connector as ConnectorElementModel, false)
    );

  return () => {
    disposables.forEach(d => d.unsubscribe());
  };
};

export const connectorWatcherExtension = surfaceMiddlewareExtension(
  'connector-watcher',
  connectorWatcher
);
