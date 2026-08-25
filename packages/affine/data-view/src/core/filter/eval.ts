import type { Value, VariableRef } from '../expression/types.js';
import type { FilterConfig } from './filter-fn/create.js';
import { filterMatcher } from './filter-fn/matcher.js';
import type { Filter, SingleFilter } from './types.js';

const evalRef = (ref: VariableRef, row: Record<string, unknown>): unknown => {
  return row[ref.name];
};

const evalValue = (value?: Value): unknown => {
  return value?.value;
};

/**
 * Runs one filter function against one cell, or answers `undefined` when the
 * function does not apply: a missing or ill-typed argument, or an
 * implementation that threw. `undefined` is not "no match" — it means this
 * candidate could not decide, so another one may.
 */
const applyFilter = (
  func: FilterConfig,
  value: unknown,
  filter: SingleFilter
): boolean | undefined => {
  const args: unknown[] = [];
  for (let i = 0; i < func.args.length; i++) {
    const argValue = evalValue(filter.args[i]);
    const argType = func.args[i];
    if (argValue == null || argType == null) {
      return undefined;
    }
    if (!argType.valueValidate(argValue)) {
      return undefined;
    }
    args.push(argValue);
  }
  try {
    return func.impl(value ?? undefined, ...args);
  } catch (e) {
    console.error(e);
    return undefined;
  }
};

export const evalFilter = (
  filterGroup: Filter,
  row: Record<string, unknown>
): boolean => {
  const evalF = (filter: Filter): boolean => {
    if (filter.type === 'filter') {
      const value = evalRef(filter.left, row);
      // A filter is stored by function name alone. Two types can declare the
      // same name, so try every candidate and keep the first one that can
      // actually decide; a filter nothing can apply lets the row through
      // rather than hiding it.
      for (const func of filterMatcher.getFiltersByName(filter.function)) {
        const result = applyFilter(func, value, filter);
        if (result != null) {
          return result;
        }
      }
      return true;
    } else if (filter.type === 'group') {
      if (filter.op === 'and') {
        return filter.conditions.every(f => evalF(f));
      } else if (filter.op === 'or') {
        return filter.conditions.some(f => evalF(f));
      }
    }
    return true;
  };
  return evalF(filterGroup);
};
