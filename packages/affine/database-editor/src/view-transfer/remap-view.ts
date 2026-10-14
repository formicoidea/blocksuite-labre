import type { DataSourcePickerProperty } from '@labre/affine-shared/services';

/**
 * What a copied view lost on the way (labre PRD REQ-DB-2: "the dialog says
 * so"): conditions of its filter and keys of its sort that pointed at an
 * ignored property, the grouping by one, and the columns of the ignored
 * properties.
 */
export interface RemapDropped {
  filters: number;
  sorts: number;
  group: boolean;
  properties: number;
}

export interface RemappedView {
  /** The view's data for this database, without `id`, `name` or `sourceId`. */
  data: Record<string, unknown>;
  dropped: RemapDropped;
}

type Json = Record<string, unknown>;

const OPTION_TYPES = new Set(['select', 'multi-select']);

/** The `header` keys of the presets that name a property. */
const HEADER_KEYS = ['titleColumn', 'iconColumn', 'imageColumn', 'coverColumn'];

function isRecord(value: unknown): value is Json {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * The copy of a stored view (`props.views[i]` of another database, or a view
 * template) for a source whose properties are `to` (ADR 0035 amendment of
 * 2026-10-14, labre PRD REQ-DB-2). Pure: it reads the view's data as the
 * presets store it (table, kanban, gallery, list: `columns`, `filter`,
 * `sort`, `groupBy`, `groupProperties`, `header`, `openIn`) and rewrites
 * every property id through `mapping`:
 *
 * - a column of an ignored property leaves, two columns landing on one
 *   property keep the first;
 * - a filter condition or a sort key on an ignored property is removed and
 *   counted; a select condition keeps the options this database has under
 *   the same name, and leaves when none is left;
 * - a grouping by an ignored property is undone; its hidden groups and their
 *   order (keyed by the source's option ids) are kept only when the property
 *   kept its id;
 * - a manual order of rows (`sort.manuallySort`, a group's
 *   `manuallyCardSort`) names rows of the other database: emptied;
 * - `id`, `name` and `sourceId` are left to the caller; any other key is
 *   copied as is.
 *
 * A mapping onto a property that `to` does not have counts as ignored.
 */
export function remapView(
  view: Readonly<Json>,
  from: readonly DataSourcePickerProperty[],
  to: readonly DataSourcePickerProperty[],
  mapping: Readonly<Record<string, string | null>>
): RemappedView {
  const data = structuredClone(view) as Json;
  delete data.id;
  delete data.name;
  delete data.sourceId;
  const dropped: RemapDropped = {
    filters: 0,
    sorts: 0,
    group: false,
    properties: 0,
  };
  const fromById = new Map(from.map(p => [p.id, p]));
  const toById = new Map(to.map(p => [p.id, p]));
  const target = (id: unknown): string | null => {
    if (typeof id !== 'string') return null;
    const mapped = mapping[id];
    return typeof mapped === 'string' && toById.has(mapped) ? mapped : null;
  };

  if (Array.isArray(data.columns)) {
    const seen = new Set<string>();
    const columns: Json[] = [];
    for (const column of data.columns) {
      if (!isRecord(column)) continue;
      const id = target(column.id);
      if (!id) {
        dropped.properties += 1;
        continue;
      }
      if (seen.has(id)) continue;
      seen.add(id);
      columns.push({ ...column, id });
    }
    data.columns = columns;
  }

  if (isRecord(data.header)) {
    const header = data.header;
    for (const key of HEADER_KEYS) {
      const value = header[key];
      // `iconColumn: 'type'` names no property: a pseudo column, kept.
      if (typeof value !== 'string' || !fromById.has(value)) continue;
      const id = target(value);
      if (id) header[key] = id;
      else delete header[key];
    }
  }

  const translateOptions = (
    sourceId: string,
    targetId: string,
    value: unknown
  ): { value: unknown; empty: boolean } => {
    const source = fromById.get(sourceId);
    const dest = toById.get(targetId);
    if (!source?.options || !dest?.options || !OPTION_TYPES.has(source.type))
      return { value, empty: false };
    const nameOf = new Map(source.options.map(o => [o.id, o.value]));
    const idOf = new Map(dest.options.map(o => [o.value, o.id]));
    const one = (id: unknown) => {
      const name = typeof id === 'string' ? nameOf.get(id) : undefined;
      return name === undefined ? undefined : idOf.get(name);
    };
    if (Array.isArray(value)) {
      const ids = value.map(one).filter((id): id is string => !!id);
      return { value: ids, empty: value.length > 0 && ids.length === 0 };
    }
    if (typeof value === 'string') {
      const id = one(value);
      return { value: id ?? value, empty: id === undefined };
    }
    return { value, empty: false };
  };

  const remapFilter = (filter: Json): Json | null => {
    if (filter.type === 'group') {
      const conditions = Array.isArray(filter.conditions)
        ? filter.conditions
        : [];
      const kept: Json[] = [];
      for (const condition of conditions) {
        if (!isRecord(condition)) continue;
        const next = remapFilter(condition);
        if (next) kept.push(next);
      }
      return { ...filter, conditions: kept };
    }
    const left = isRecord(filter.left) ? filter.left : undefined;
    const sourceId = typeof left?.name === 'string' ? left.name : undefined;
    const id = target(sourceId);
    if (!sourceId || !id) {
      dropped.filters += 1;
      return null;
    }
    let empty = false;
    const args = Array.isArray(filter.args)
      ? filter.args.map(arg => {
          if (!isRecord(arg) || arg.type !== 'literal') return arg;
          const translated = translateOptions(sourceId, id, arg.value);
          empty ||= translated.empty;
          return { ...arg, value: translated.value };
        })
      : filter.args;
    if (empty) {
      dropped.filters += 1;
      return null;
    }
    return { ...filter, left: { ...left, name: id }, args };
  };

  if (isRecord(data.filter)) {
    const root = remapFilter(data.filter);
    // A nested group left empty is dropped with its conditions; the root
    // stays, an empty group being "no filter".
    const prune = (group: Json): Json => ({
      ...group,
      conditions: (group.conditions as Json[])
        .map(c => (c.type === 'group' ? prune(c) : c))
        .filter(
          c => c.type !== 'group' || (c.conditions as unknown[]).length > 0
        ),
    });
    if (root) data.filter = prune(root);
  }

  if (isRecord(data.sort)) {
    const sortBy = Array.isArray(data.sort.sortBy) ? data.sort.sortBy : [];
    const kept: Json[] = [];
    for (const key of sortBy) {
      if (!isRecord(key)) continue;
      const ref = isRecord(key.ref) ? key.ref : undefined;
      const id = target(ref?.name);
      if (!id) {
        dropped.sorts += 1;
        continue;
      }
      kept.push({ ...key, ref: { ...ref, name: id } });
    }
    data.sort = { ...data.sort, sortBy: kept, manuallySort: [] };
  }

  if (isRecord(data.groupBy)) {
    const sourceId = data.groupBy.columnId;
    const id = target(sourceId);
    if (!id) {
      dropped.group = true;
      delete data.groupBy;
      delete data.groupProperties;
    } else {
      data.groupBy = { ...data.groupBy, columnId: id };
      if (id !== sourceId) delete data.groupProperties;
    }
  }
  if (Array.isArray(data.groupProperties)) {
    data.groupProperties = data.groupProperties
      .filter(isRecord)
      .map(group => ({ ...group, manuallyCardSort: [] }));
  }

  return { data, dropped };
}

/**
 * The correspondence a dialog starts from: the same id, else the same name
 * and type (case and spacing aside), else ignored. Only a property of the
 * same type is ever proposed, and each target once.
 */
export function defaultMapping(
  from: readonly DataSourcePickerProperty[],
  to: readonly DataSourcePickerProperty[]
): Record<string, string | null> {
  const norm = (name: string) => name.trim().toLowerCase();
  const taken = new Set<string>();
  const out: Record<string, string | null> = {};
  for (const property of from) {
    const sameId = to.find(
      p => p.id === property.id && p.type === property.type
    );
    const match =
      (sameId && !taken.has(sameId.id) ? sameId : undefined) ??
      to.find(
        p =>
          !taken.has(p.id) &&
          p.type === property.type &&
          norm(p.name) === norm(property.name)
      );
    out[property.id] = match ? match.id : null;
    if (match) taken.add(match.id);
  }
  return out;
}

/**
 * What a view template keeps of a view (labre PRD REQ-DB-4): everything but
 * its filters, its sorts and its manual orders, which belong to one view.
 */
export function viewTemplateData(view: Readonly<Json>): Json {
  const data = structuredClone(view) as Json;
  delete data.id;
  delete data.sourceId;
  delete data.sort;
  if (isRecord(data.filter)) data.filter = { ...data.filter, conditions: [] };
  if (Array.isArray(data.groupProperties)) {
    data.groupProperties = data.groupProperties
      .filter(isRecord)
      .map(group => ({ ...group, manuallyCardSort: [] }));
  }
  return data;
}
