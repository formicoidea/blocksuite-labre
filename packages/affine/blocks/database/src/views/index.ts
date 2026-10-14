import type { ViewMeta } from '@labre/data-view';
import { viewConverts, viewPresets } from '@labre/data-view/view-presets';

/**
 * Every preset a stored `affine:database` view can be drawn with (ADR 0035
 * §6). Calendar stays here: calendar views were creatable until 0.48, so
 * documents hold them, and a stored calendar keeps rendering and editing as a
 * calendar. Never shrink this list: a mode that leaves it falls back to a
 * table on every document that stores it.
 */
export const databaseBlockRenderableViews: ViewMeta[] = [
  viewPresets.tableViewMeta,
  viewPresets.kanbanViewMeta,
  viewPresets.calendarViewMeta,
  viewPresets.galleryViewMeta,
  viewPresets.listViewMeta,
];

/**
 * The presets a user can CREATE, a subset of the renderable ones: what the
 * data source answers as `viewMetas`, so the views bar ("+", "Create …") and
 * the Layout switch list only these. Calendar left it after 0.48 (ADR 0035 §6,
 * labre ADR-0046 §8): no new calendar, the stored ones still render.
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
 * Conversions INTO a creatable preset only: switching a view's layout to
 * calendar would create a calendar. The conversions out of calendar stay, so a
 * stored calendar can still become a table or a board.
 */
export const databaseBlockViewConverts = viewConverts.filter(convert =>
  creatableModes.has(convert.to)
);
