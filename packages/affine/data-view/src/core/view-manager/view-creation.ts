import { createIdentifier } from '@labre/global/di';
import { nanoid } from '@labre/store';

import type { ViewManager } from './view-manager.js';

/**
 * Set to `true` on a data source (`serviceSet`) whose host switched off the
 * tooling that CREATES views: the views bar then offers no "+" and no
 * "Create …" (ADR 0035 §5, ADR 0009). Absent means offered, so every source
 * that never sets it keeps its 0.48 views bar. The stored views keep
 * rendering, switching layout and being deleted: only creation is tooling.
 */
export const ViewCreationOffKey = createIdentifier<true>(
  'data-view-view-creation-off'
);

/**
 * "Duplicate as table": the way out of a view shown through a fallback
 * preset (`SingleView.shownAsFallback$`). Adds a view of the preset that drew
 * it, under the same name, with that preset's default data, and selects it;
 * the stored view is left exactly as it was, so a client that knows its mode
 * still reads it. Returns the new view's id, or `undefined` when there is no
 * such view or it is not a fallback.
 */
export function duplicateAsShownPreset(
  manager: ViewManager,
  viewId: string
): string | undefined {
  const view = manager.viewGet(viewId);
  if (!view || !view.shownAsFallback$.peek()) return;
  const meta = view.meta;
  const id = manager.dataSource.viewDataAdd({
    ...meta.model.defaultData(manager),
    id: nanoid(),
    name: view.name$.peek(),
    mode: meta.type,
  });
  manager.setCurrentView(id);
  return id;
}
