import {
  groupCollapsed$,
  groupCollapsedSet,
} from '../../core/group-by/collapsed-state.js';

/**
 * The table's two entry points into the shared, per-device group fold
 * (`core/group-by/collapsed-state.ts`, ADR 0035 B8), kept so the pc and
 * mobile table groups read and write it as before.
 */
export function getCollapsedState(viewId: string, groupKey: string): boolean {
  return groupCollapsed$(viewId, groupKey).peek();
}

export function setCollapsedState(
  viewId: string,
  groupKey: string,
  collapsed: boolean
): void {
  groupCollapsedSet(viewId, groupKey, collapsed);
}
