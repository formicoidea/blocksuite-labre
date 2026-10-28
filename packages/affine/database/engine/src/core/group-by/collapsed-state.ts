import { type ReadonlySignal, type Signal, signal } from '@preact/signals-core';

/**
 * Whether a group of a view is folded, for every preset (ADR 0035 §8, B8,
 * PRD REQ-DB-16). Personal and per device: kept in `localStorage`, never in
 * the document, like the local hide of ADR 0031. A host seam was not chosen:
 * it would be a row in the seams table forever for a device ergonomic, and a
 * fold that follows the user across devices is not asked for.
 *
 * Only a folded group has an entry (`'1'`); unfolding removes it. Any other
 * value, a storage that throws (private mode, blocked site data) or no
 * storage at all reads as unfolded. One signal per key, shared by every
 * element drawing that group, so a fold is seen everywhere at once.
 *
 * Until 0.49 the table kept this in `sessionStorage` under
 * `affine:table-group:*`; those entries were per tab and are not read back.
 */
const PREFIX = 'labre:data-view:group-collapsed:';

const storageKey = (viewId: string, groupKey: string) =>
  `${PREFIX}${viewId}:${groupKey}`;

const states = new Map<string, Signal<boolean>>();

function readStored(key: string): boolean {
  try {
    return globalThis.localStorage?.getItem(key) === '1';
  } catch {
    return false;
  }
}

function writeStored(key: string, collapsed: boolean): void {
  try {
    if (collapsed) {
      globalThis.localStorage?.setItem(key, '1');
    } else {
      globalThis.localStorage?.removeItem(key);
    }
  } catch {
    // A storage that refuses keeps the fold for this session only.
  }
}

function stateOf(viewId: string, groupKey: string): Signal<boolean> {
  const key = storageKey(viewId, groupKey);
  let state = states.get(key);
  if (!state) {
    state = signal(readStored(key));
    states.set(key, state);
  }
  return state;
}

export function groupCollapsed$(
  viewId: string,
  groupKey: string
): ReadonlySignal<boolean> {
  return stateOf(viewId, groupKey);
}

export function groupCollapsedSet(
  viewId: string,
  groupKey: string,
  collapsed: boolean
): void {
  const state = stateOf(viewId, groupKey);
  if (state.peek() === collapsed) return;
  state.value = collapsed;
  writeStored(storageKey(viewId, groupKey), collapsed);
}
