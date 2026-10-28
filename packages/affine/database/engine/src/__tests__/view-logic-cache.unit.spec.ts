import { signal } from '@preact/signals-core';
import { describe, expect, it } from 'vitest';

import { DataViewRootUILogic } from '../core/data-view.js';

class FakeViewUILogic {
  constructor(
    public readonly root: unknown,
    public readonly view: unknown
  ) {}
}

const makeRoot = () => {
  const viewDataList$ = signal([
    { id: 'view-1', mode: 'table', name: 'Table' },
  ]);
  const currentViewId$ = signal<string | undefined>('view-1');
  let created = 0;

  const viewGet = (id: string) => {
    const data = viewDataList$.value.find(item => item.id === id);
    return {
      id,
      type: data?.mode,
      meta: {
        renderer: {
          pcLogic: () => {
            created += 1;
            return FakeViewUILogic;
          },
          mobileLogic: () => {
            created += 1;
            return FakeViewUILogic;
          },
        },
      },
    };
  };

  const dataSource = {
    viewDataList$,
    viewManager: { viewGet, currentViewId$ },
  };

  const logic = new DataViewRootUILogic({
    dataSource,
  } as never);

  return {
    logic,
    viewDataList$,
    createdCount: () => created,
  };
};

describe('data view UI logic cache', () => {
  it('keeps the same UI logic while the view keeps its layout', () => {
    const { logic, viewDataList$ } = makeRoot();

    const first = logic.currentView$.value;
    expect(first).toBeInstanceOf(FakeViewUILogic);

    // An unrelated change to the view data (a rename) must not rebuild it.
    viewDataList$.value = [{ id: 'view-1', mode: 'table', name: 'Renamed' }];
    expect(logic.currentView$.value).toBe(first);
  });

  it('rebuilds the UI logic when the view changes layout', () => {
    const { logic, viewDataList$ } = makeRoot();

    const asTable = logic.currentView$.value;

    // `viewChangeType` keeps the id and swaps the mode.
    viewDataList$.value = [{ id: 'view-1', mode: 'kanban', name: 'Table' }];

    const asKanban = logic.currentView$.value;
    expect(asKanban).toBeInstanceOf(FakeViewUILogic);
    expect(asKanban).not.toBe(asTable);
    expect((asKanban?.view as { type: string }).type).toBe('kanban');
  });

  it('forgets the UI logic of a deleted view', () => {
    const { logic, viewDataList$, createdCount } = makeRoot();

    logic.currentView$.value;
    const afterFirst = createdCount();

    viewDataList$.value = [{ id: 'view-2', mode: 'table', name: 'Other' }];
    logic.currentView$.value;

    viewDataList$.value = [{ id: 'view-1', mode: 'table', name: 'Table' }];
    logic.currentView$.value;

    // The entry for `view-1` was evicted, so it had to be built again.
    expect(createdCount()).toBe(afterFirst + 2);
  });
});
