import type { ViewMeta } from '@labre/affine-database-engine';
import {
  viewConverts,
  viewPresets,
} from '@labre/affine-database-engine/view-presets';

/**
 * Every preset a stored `affine:database` view can be drawn with (ADR 0035
 * §6). A mode that leaves this list falls back to a table on every document
 * that stores it, so shrinking it is a major and an ADR decision: calendar
 * left it in 2.0 (ADR 0035 amendment of 2026-10-29), and a stored calendar
 * now draws as a table through `databaseBlockViewMetaGet`.
 */
export const databaseBlockRenderableViews: ViewMeta[] = [
  viewPresets.tableViewMeta,
  viewPresets.kanbanViewMeta,
  viewPresets.galleryViewMeta,
  viewPresets.listViewMeta,
];

/**
 * The presets a user can CREATE, a subset of the renderable ones: what the
 * data source answers as `viewMetas`, so the views bar ("+", "Create …") and
 * the Layout switch list only these.
 */
export const databaseBlockViews: ViewMeta[] = [
  viewPresets.tableViewMeta,
  viewPresets.kanbanViewMeta,
  viewPresets.galleryViewMeta,
  viewPresets.listViewMeta,
];

/** The preset a mode with none of its own is drawn with. */
export const databaseBlockFallbackView: ViewMeta = viewPresets.tableViewMeta;

// No prototype: a stored mode is any string, and `'constructor'` or
// `'__proto__'` must find no preset rather than Object's own members.
export const databaseBlockViewMap: Record<string, ViewMeta | undefined> =
  Object.assign(
    Object.create(null) as Record<string, ViewMeta | undefined>,
    Object.fromEntries(databaseBlockRenderableViews.map(v => [v.type, v]))
  );

/**
 * The preset that draws a stored `mode`. Never throws: a mode this client has
 * no preset for (a `timeline`, a newer client's view, an import) is drawn as a
 * table over the source's properties, and its stored data stays as it is
 * (`SingleView.shownAsFallback$`). Up to 0.48 it threw `Unknown view type`
 * and the whole database rendered nothing.
 */
export function databaseBlockViewMetaGet(mode: string): ViewMeta {
  return databaseBlockViewMap[mode] ?? databaseBlockFallbackView;
}

const creatableModes = new Set(databaseBlockViews.map(view => view.type));

/**
 * Conversions INTO a creatable preset only: a layout switch never creates a
 * view a user could not have added.
 */
export const databaseBlockViewConverts = viewConverts.filter(convert =>
  creatableModes.has(convert.to)
);
