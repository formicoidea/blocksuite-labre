import type { Command } from '@labre/std';
import { GfxControllerIdentifier } from '@labre/std/gfx';

import type { SurfaceBlockModel } from '../surface-model';

/**
 * Re-point every connector end bound to `oldId` at `newId`, keeping the rest
 * of the endpoint (its `position`). The caller owns the transaction and the
 * undo step: a model converted into another (a bookmark into an embed, a
 * shape into an image, ADR 0044) re-points its connectors before the old one
 * is deleted.
 */
export function reassociateConnectors(
  surface: Pick<SurfaceBlockModel, 'getConnectors' | 'updateElement'>,
  oldId: string,
  newId: string
) {
  const connectors = surface.getConnectors(oldId);
  for (const { id, source, target } of connectors) {
    if (source.id === oldId) {
      surface.updateElement(id, {
        source: {
          ...source,
          id: newId,
        },
      });
    }
    if (target.id === oldId) {
      surface.updateElement(id, {
        target: {
          ...target,
          id: newId,
        },
      });
    }
  }
}

/**
 * Re-associate bindings for block that have been converted.
 *
 * @param oldId - the old block id
 * @param newId - the new block id
 */
export const reassociateConnectorsCommand: Command<{
  oldId: string;
  newId: string;
}> = (ctx, next) => {
  const { oldId, newId } = ctx;
  const gfx = ctx.std.get(GfxControllerIdentifier);
  if (!oldId || !newId || !gfx.surface) {
    next();
    return;
  }

  reassociateConnectors(gfx.surface as SurfaceBlockModel, oldId, newId);

  next();
};
