/**
 * A table selection belongs to the `note` group; the canvas selection of the
 * note being edited belongs to the `gfx` group. The table's selection
 * controller once wrote its selection with `selection.set([...])` and cleared
 * it with `selection.clear()`, which replace EVERY group (issue #659, upstream
 * toeverything/AFFiNE#15791). In edgeless that meant:
 *
 * - placing the caret in a cell (the cell answers with an `area` selection)
 *   dropped the note's editing selection, so the note left edit mode under
 *   the user's caret;
 * - selecting then clearing a column (the column menu does both) replaced an
 *   unrelated canvas selection with nothing.
 *
 * Both paths are driven here on a real edgeless editor and the `gfx` group is
 * read back after each one. Page mode runs the same steps to hold that the
 * fix writes no canvas selection where there was none. No pointer gesture:
 * the selection is set through the selection API, as the column menu and the
 * cell focus do, so the spec does not depend on where the shared page left
 * the camera.
 */
import type { TableSelectionData } from '@labre/affine/blocks/table';
import { SurfaceSelection } from '@labre/std';
import { Text } from '@labre/store';
import { userEvent } from '@vitest/browser/context';
import { beforeEach, describe, expect, test } from 'vitest';

import { wait } from '../utils/common.js';
import { addNote } from '../utils/edgeless.js';
import { setupEditor } from '../utils/setup.js';

// The block component is not exported by the table package: the spec only
// needs the controller it hangs off.
type TableHost = HTMLElement & {
  selectionController: {
    setSelected(selection: TableSelectionData | undefined): void;
    getSelected(): TableSelectionData | undefined;
  };
};

type CellHost = HTMLElement & {
  inlineEditor?: { focusEnd(): void };
};

function addTable(noteId: string) {
  return doc.addBlock(
    'affine:table',
    {
      rows: { row: { rowId: 'row', order: 'a0' } },
      columns: { column: { columnId: 'column', order: 'a0' } },
      cells: { 'row:column': { text: new Text('abc') } },
    },
    noteId
  );
}

function cellText(tableId: string) {
  const model = doc.getBlock(tableId)!.model as unknown as {
    props: { cells: Record<string, { text: { toString(): string } }> };
  };
  return model.props.cells['row:column']!.text.toString();
}

describe.each(['page', 'edgeless'] as const)(
  'table selection in %s mode',
  mode => {
    let noteId!: string;
    let tableId!: string;
    let table!: TableHost;
    let canvas!: SurfaceSelection[];

    beforeEach(async () => {
      const cleanup = await setupEditor(mode);
      noteId = addNote(doc);
      tableId = addTable(noteId);
      await wait();
      table = editor.host!.view.getBlock(tableId) as unknown as TableHost;
      const surfaceId = doc.getModelsByFlavour('affine:surface')[0]!.id;
      canvas =
        mode === 'edgeless'
          ? [new SurfaceSelection(surfaceId, [noteId], true)]
          : [];
      if (mode === 'edgeless') {
        editor.std.selection.setGroup('gfx', canvas);
      }
      return cleanup;
    });

    test('typing at the end of a cell keeps the note in edit mode', async () => {
      const cell = table.querySelector('affine-table-cell') as CellHost;
      cell.inlineEditor!.focusEnd();
      await wait(50);

      expect(table.selectionController.getSelected()?.type).toBe('area');
      expect(editor.std.selection.getGroup('gfx')).toEqual(canvas);

      await userEvent.keyboard('xyz');
      await wait(50);

      expect(cellText(tableId)).toBe('abcxyz');
      expect(editor.std.selection.getGroup('gfx')).toEqual(canvas);
    });

    test('selecting then clearing a column keeps the canvas selection', async () => {
      table.selectionController.setSelected({
        type: 'column',
        columnId: 'column',
      });
      expect(table.selectionController.getSelected()?.type).toBe('column');
      expect(editor.std.selection.getGroup('gfx')).toEqual(canvas);

      table.selectionController.setSelected(undefined);
      expect(table.selectionController.getSelected()).toBeUndefined();
      expect(editor.std.selection.getGroup('gfx')).toEqual(canvas);
    });
  }
);
