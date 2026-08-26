import { signal } from '@preact/signals-core';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { MobileKanbanCell } from '../view-presets/kanban/mobile/cell.js';
import { MobileTableCell } from '../view-presets/table/mobile/cell.js';

/**
 * Both mobile cells watch the selection through an `effect`. That effect also
 * reads `_cell`, the signal holding the currently rendered cell component, so
 * every re-render of the cell used to re-run the branch and fire
 * `afterEnterEditingMode` / `beforeExitEditingMode` again although the editing
 * state had not moved at all.
 */

const define = (name: string, ctor: CustomElementConstructor) => {
  if (!customElements.get(name)) {
    customElements.define(name, ctor);
  }
};

define('test-mobile-table-cell', MobileTableCell);
define('test-mobile-kanban-cell', MobileKanbanCell);

type Counters = {
  afterEnterEditingMode: ReturnType<typeof vi.fn>;
  beforeExitEditingMode: ReturnType<typeof vi.fn>;
};

const makeCellLifeCycle = (counters: Counters) => ({
  beforeEnterEditMode: () => true,
  beforeExitEditingMode: counters.beforeExitEditingMode,
  afterEnterEditingMode: counters.afterEnterEditingMode,
  focusCell: () => true,
  blurCell: () => true,
  forceUpdate: () => {},
});

const makeColumn = () => ({
  id: 'column-id',
  readonly$: signal(false),
  // No renderer: `render()` bails out early, we only exercise the effect.
  renderer$: signal(undefined),
  cellGetOrCreate: () => ({}),
  icon: undefined,
});

const makeViewLogic = () => ({
  selection$: signal(undefined),
  setSelection: () => {},
  view: { id: 'view-id', readonly$: signal(false), lockRows: () => {} },
});

type Harness = {
  isEditing: () => boolean;
  setCell: (value: unknown) => void;
  counters: Counters;
};

const mount = (
  tag: string,
  props: Record<string, unknown>,
  isSelectionEditing$: ReturnType<typeof signal<boolean>>
): Harness => {
  const element = document.createElement(tag) as unknown as Record<
    string,
    unknown
  >;
  Object.assign(element, props);
  element['isSelectionEditing$'] = isSelectionEditing$;

  const counters: Counters = {
    afterEnterEditingMode: vi.fn(),
    beforeExitEditingMode: vi.fn(),
  };

  document.body.append(element as unknown as HTMLElement);

  const cellSignal = element['_cell'] as { value: unknown };
  cellSignal.value = makeCellLifeCycle(counters);

  return {
    counters,
    isEditing: () => (element['isEditing$'] as { value: boolean }).value,
    setCell: value => {
      cellSignal.value = value;
    },
  };
};

const factories = [
  [
    'mobile table cell',
    (isSelectionEditing$: ReturnType<typeof signal<boolean>>) =>
      mount(
        'test-mobile-table-cell',
        {
          column: makeColumn(),
          rowId: 'row-id',
          columnIndex: 0,
          rowIndex: 0,
          tableViewLogic: makeViewLogic(),
        },
        isSelectionEditing$
      ),
  ],
  [
    'mobile kanban cell',
    (isSelectionEditing$: ReturnType<typeof signal<boolean>>) =>
      mount(
        'test-mobile-kanban-cell',
        {
          column: makeColumn(),
          cardId: 'card-id',
          groupKey: 'group-key',
          kanbanViewLogic: makeViewLogic(),
        },
        isSelectionEditing$
      ),
  ],
] as const;

describe.each(factories)('%s editing mode', (_name, factory) => {
  let isSelectionEditing$: ReturnType<typeof signal<boolean>>;
  let harness: Harness;

  beforeEach(() => {
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
      cb(0);
      return 0;
    });
    document.body.innerHTML = '';
    isSelectionEditing$ = signal(false);
    harness = factory(isSelectionEditing$);
  });

  it('does not leave editing mode again on every re-render', () => {
    // The cell component is recreated on each render of the host element.
    harness.setCell(makeCellLifeCycle(harness.counters));
    harness.setCell(makeCellLifeCycle(harness.counters));
    harness.setCell(makeCellLifeCycle(harness.counters));

    expect(harness.counters.beforeExitEditingMode).toHaveBeenCalledTimes(0);
    expect(harness.isEditing()).toBe(false);
  });

  it('does not re-enter editing mode on every re-render', () => {
    isSelectionEditing$.value = true;
    expect(harness.counters.afterEnterEditingMode).toHaveBeenCalledTimes(1);

    harness.setCell(makeCellLifeCycle(harness.counters));
    harness.setCell(makeCellLifeCycle(harness.counters));

    expect(harness.counters.afterEnterEditingMode).toHaveBeenCalledTimes(1);
    expect(harness.isEditing()).toBe(true);
  });

  it('still runs each hook once per editing transition', () => {
    isSelectionEditing$.value = true;
    expect(harness.counters.afterEnterEditingMode).toHaveBeenCalledTimes(1);

    isSelectionEditing$.value = false;
    expect(harness.counters.beforeExitEditingMode).toHaveBeenCalledTimes(1);
    expect(harness.isEditing()).toBe(false);

    isSelectionEditing$.value = true;
    expect(harness.counters.afterEnterEditingMode).toHaveBeenCalledTimes(2);
  });
});
