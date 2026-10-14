import type { DatabaseViewColorRule } from '@labre/affine-model';
import { nanoid } from '@labre/store';

import { selectOptionColors } from '../component/tags/colors.js';
import { evalFilter } from '../filter/eval.js';
import type { Filter, FilterGroup } from '../filter/types.js';
import type { SingleView } from '../view-manager/single-view.js';
import type { DataViewDataType } from './data-view.js';

/**
 * Conditional colours of a view (ADR 0036; labre PRD REQ-DB-4, REQ-DB-10):
 * the stored `colorRules` of a view, read, evaluated and written here, in
 * core, so every stored rule paints whatever bundle or flag the host has;
 * the editor is a view setting like the filter (`color-rules-menu.ts`).
 *
 * A rule is `{ id, color, filter }`: `filter` is a view filter's own shape
 * (`FilterGroup`, same functions, same editor), `color` a colour of the
 * select options' palette, stored as an option stores it.
 */
export type ViewColorRule = {
  id: string;
  color: string;
  filter: FilterGroup;
};

/**
 * The custom property a coloured row or card carries; each layout's
 * stylesheet reads it as its background in place of its own, and a
 * selection or a hover still paints over it.
 *
 * ponytail: the virtual table (`enable_table_virtual_scroll`, off by
 * default) paints no rule, its rows being grid cells; upgrade: paint each
 * `DatabaseCellContainer` of `table/pc-virtual/row/cell.ts` from
 * `viewRowColor`.
 */
export const ROW_COLOR_PROPERTY = '--data-view-row-color';

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/**
 * The stored rules of a view, in order, keeping only what reads as a rule
 * (an id, a colour string, a filter group): a value a newer client wrote in
 * another shape is skipped, never thrown on. Absent, no rule.
 */
export function viewColorRules(data: object | undefined): ViewColorRule[] {
  const stored = (data as { colorRules?: unknown } | undefined)?.colorRules;
  if (!Array.isArray(stored)) return [];
  return stored.filter(
    (rule): rule is ViewColorRule =>
      isRecord(rule) &&
      typeof rule.id === 'string' &&
      typeof rule.color === 'string' &&
      isRecord(rule.filter) &&
      rule.filter.type === 'group' &&
      Array.isArray(rule.filter.conditions)
  );
}

/**
 * The palette colour a stored value names, or `undefined` for a value this
 * build does not know. Only a palette colour is ever painted: a stored
 * string is never put into a style as is.
 */
export function colorRulePaint(color: string): string | undefined {
  return selectOptionColors.find(
    item => item.color === color || item.oldColor === color
  )?.color;
}

/** The property ids a filter reads, nested groups included. */
function referencedProperties(filter: Filter, into: Set<string>): Set<string> {
  if (filter.type === 'filter') into.add(filter.left.name);
  else
    filter.conditions.forEach(condition =>
      referencedProperties(condition, into)
    );
  return into;
}

/**
 * The colour of a row, given what `cellOf` reads for a property: the first
 * rule whose filter matches wins. A rule with no condition matches no row,
 * and a condition that cannot decide (a value not picked yet) does not
 * match: a rule being written colours nothing until it says something. A
 * matching rule whose colour this build does not know still wins, and
 * paints nothing, as the newer client that wrote it would paint its own
 * colour there and not a later rule's.
 */
export function colorRulesMatch(
  rules: readonly ViewColorRule[],
  cellOf: (propertyId: string) => unknown
): string | undefined {
  for (const rule of rules) {
    if (!rule.filter.conditions.length) continue;
    const row: Record<string, unknown> = {};
    referencedProperties(rule.filter, new Set()).forEach(id => {
      row[id] = cellOf(id);
    });
    if (evalFilter(rule.filter, row, false)) return colorRulePaint(rule.color);
  }
  return undefined;
}

/**
 * The colour of `rowId` in `view`, read inside a render so the row repaints
 * when a rule or a value it reads changes. A fallback view (ADR 0035 §6)
 * trusts none of its stored settings, rules included.
 */
export function viewRowColor(
  view: SingleView,
  rowId: string
): string | undefined {
  if (view.shownAsFallback$.value) return undefined;
  const rules = viewColorRules(view.manager.dataSource.viewDataGet(view.id));
  if (!rules.length) return undefined;
  const known = new Set(view.propertiesRaw$.value.map(property => property.id));
  return colorRulesMatch(rules, id =>
    known.has(id) ? view.cellGetOrCreate(rowId, id).jsonValue$.value : undefined
  );
}

/** Set or clear the colour a row or card element paints. */
export function paintRowColor(
  element: HTMLElement,
  color: string | undefined
): void {
  if (color) element.style.setProperty(ROW_COLOR_PROPERTY, color);
  else element.style.removeProperty(ROW_COLOR_PROPERTY);
}

/** The same, for a template's `styleMap`. */
export function rowColorStyle(color: string | undefined) {
  return color ? { [ROW_COLOR_PROPERTY]: color } : {};
}

/**
 * Write the rules of `view`. Written on a gesture alone, and not when it
 * changes nothing; a read-only view and a fallback view are never written.
 * Returns whether it wrote.
 */
export function viewColorRulesSet(
  view: SingleView,
  rules: readonly ViewColorRule[]
): boolean {
  if (view.readonly$.peek() || view.shownAsFallback$.peek()) return false;
  const dataSource = view.manager.dataSource;
  const current = viewColorRules(dataSource.viewDataGet(view.id));
  if (JSON.stringify(current) === JSON.stringify(rules)) return false;
  // The model's type, so the stored shape is the one ADR 0036 declares.
  const colorRules: DatabaseViewColorRule[] = rules.map(rule => ({
    id: rule.id,
    color: rule.color,
    filter: rule.filter,
  }));
  dataSource.viewDataUpdate<
    DataViewDataType & { colorRules?: DatabaseViewColorRule[] }
  >(view.id, () => ({ colorRules }));
  return true;
}

const rulesOf = (view: SingleView) =>
  viewColorRules(view.manager.dataSource.viewDataGet(view.id));

/**
 * Add a rule at the end, on `condition`, in the next palette colour no rule
 * uses yet (the first one when every colour is taken). Its id, or `null`
 * when nothing was written.
 */
export function colorRuleAdd(
  view: SingleView,
  condition: Filter
): string | null {
  const rules = rulesOf(view);
  const used = new Set(rules.map(rule => colorRulePaint(rule.color)));
  const color = (
    selectOptionColors.find(item => !used.has(item.color)) ??
    selectOptionColors[0]
  )?.color;
  if (!color) return null;
  const rule: ViewColorRule = {
    id: nanoid(),
    color,
    filter: { type: 'group', op: 'and', conditions: [condition] },
  };
  return viewColorRulesSet(view, [...rules, rule]) ? rule.id : null;
}

/** Change a rule's colour or condition. */
export function colorRuleUpdate(
  view: SingleView,
  id: string,
  patch: Partial<Pick<ViewColorRule, 'color' | 'filter'>>
): boolean {
  const rules = rulesOf(view);
  if (!rules.some(rule => rule.id === id)) return false;
  return viewColorRulesSet(
    view,
    rules.map(rule => (rule.id === id ? { ...rule, ...patch } : rule))
  );
}

export function colorRuleDelete(view: SingleView, id: string): boolean {
  const rules = rulesOf(view);
  return viewColorRulesSet(
    view,
    rules.filter(rule => rule.id !== id)
  );
}

/** Move a rule one place earlier (`-1`) or later (`1`): order decides. */
export function colorRuleMove(
  view: SingleView,
  id: string,
  delta: -1 | 1
): boolean {
  const rules = [...rulesOf(view)];
  const from = rules.findIndex(rule => rule.id === id);
  const to = from + delta;
  const rule = rules[from];
  if (from < 0 || !rule || to < 0 || to >= rules.length) return false;
  rules.splice(from, 1);
  rules.splice(to, 0, rule);
  return viewColorRulesSet(view, rules);
}
