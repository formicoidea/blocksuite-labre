import type { ViewMeta } from '@labre/affine-database-engine';
import { viewPresets } from '@labre/affine-database-engine/view-presets';

export const blockQueryViews: ViewMeta[] = [
  viewPresets.tableViewMeta,
  viewPresets.kanbanViewMeta,
];

export const blockQueryViewMap = Object.fromEntries(
  blockQueryViews.map(view => [view.type, view])
);
