/**
 * A table selection lives in the `note` group, beside the canvas selection
 * (`gfx` group) of the note being edited. `setSelected` once wrote it with
 * `selection.set([...])` and cleared it with `selection.clear()`, which
 * replace every group: in edgeless, focusing a cell or selecting then
 * clearing a column dropped the canvas selection, so the note left edit mode
 * under the user's caret (issue #659, upstream toeverything/AFFiNE#15791).
 *
 * The spec drives the real `StoreSelectionExtension` and reads the `gfx`
 * group back after each write. The canvas side of the same path is held by
 * `integration-test/src/__tests__/edgeless/table-selection-keeps-canvas.spec.ts`.
 */
import { SurfaceSelection } from '@labre/std';
import { type Store, StoreSelectionExtension } from '@labre/store';
import { describe, expect, it } from 'vitest';

import { SelectionController } from '../selection-controller.js';
import type { TableBlockComponent } from '../table-block.js';

function createController() {
  const store = {
    id: 'doc',
    awarenessStore: { setLocalSelection: () => {} },
  } as unknown as Store;
  const selection = new StoreSelectionExtension(store);
  const host = {
    model: { id: 'table' },
    selection,
    addController: () => {},
  } as unknown as TableBlockComponent;
  return { controller: new SelectionController(host), selection };
}

describe('table selection group', () => {
  it('keeps the canvas selection when a column is selected then cleared', () => {
    const { controller, selection } = createController();
    const canvas = new SurfaceSelection('surface', ['note'], true);
    selection.setGroup('gfx', [canvas]);

    controller.setSelected({ type: 'column', columnId: 'column' });

    expect(controller.getSelected()).toEqual({
      type: 'column',
      columnId: 'column',
    });
    expect(selection.getGroup('gfx')).toEqual([canvas]);

    controller.setSelected(undefined);

    expect(controller.getSelected()).toBeUndefined();
    expect(selection.getGroup('gfx')).toEqual([canvas]);
  });
});
