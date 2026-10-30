import type { DatabaseBlockModel } from '@labre/affine-model';
import {
  type PropertiesPanelRequest,
  PropertiesPanelProvider,
} from '@labre/affine-shared/services';
import type { BlockStdScope } from '@labre/std';

import { viewDatabaseId } from '../view-database.js';

export type DatabasePropertiesPanelRequest = Extract<
  PropertiesPanelRequest,
  { scope: 'source' }
>;

/**
 * The properties panel's request for one view of a database (ADR 0035 §9b,
 * issue B10): the document and the block that host the view, the view, and
 * the source it reads. A view with no stored `sourceId` reads the block's
 * implicit source, named here by the block's own id: the host that resolves
 * sources reads it as "the view's default source", any other host as the
 * block itself. A view reading a source of another database names it
 * (`databaseId`, ADR 0035 amendment of 2026-10-30); absent, the block's.
 */
export function databasePropertiesPanelRequest(
  model: DatabaseBlockModel,
  viewId: string
): DatabasePropertiesPanelRequest {
  const view = model.props.views.find(v => v.id === viewId);
  const databaseId = viewDatabaseId(view);
  return {
    scope: 'source',
    docId: model.store.id,
    blockId: model.id,
    sourceId: view?.sourceId ?? model.id,
    ...(databaseId === undefined ? {} : { databaseId }),
    viewId,
  };
}

/**
 * Open the host's properties panel on a view of `model`: the call the view
 * options' "Properties" makes, and the one the view bar and the view settings
 * of `@labre/affine-database-editor` make. `false` when the host has no panel
 * (`PropertiesPanelExtension` absent or `null`): the caller then keeps the
 * data-view's own properties popover.
 */
export function openDatabasePropertiesPanel(
  std: BlockStdScope,
  model: DatabaseBlockModel,
  viewId: string
): boolean {
  const panel = std.getOptional(PropertiesPanelProvider);
  if (!panel) return false;
  panel.open(databasePropertiesPanelRequest(model, viewId));
  return true;
}
