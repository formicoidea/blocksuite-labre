/**
 * A database cell edit survives the document being closed in the same task
 * (#746, ADR 0057, "As implemented").
 *
 * The number editor (with the text, date, progress and link ones) hands its
 * value over on exit through `valueSetNextTick`, one animation frame later.
 * A host that leaves editing and closes the document at once (unmount the
 * editor, `store.dispose()`) left that frame behind: it wrote through the
 * released store, which threw `store … is disposed`, and the edit was lost.
 * `database-toolbar-pointer.spec.ts` met it eight times as unhandled
 * errors. The cell now flushes its pending write as it leaves the DOM.
 *
 * Held here end to end: type in a number cell, leave editing with Escape,
 * remove the editor and dispose of the store in that same task; no error,
 * and a store opened again on the document reads the typed value.
 */
import { DatabaseBlockDataSource } from '@labre/affine/blocks/database';
import type { DatabaseBlockModel } from '@labre/affine/model';
import type { EditorHost } from '@labre/std';
import { Text } from '@labre/store';
import { userEvent } from '@vitest/browser/context';
import { afterEach, describe, expect, test, vi } from 'vitest';

import { setupEditor } from '../utils/setup.js';

const PATIENCE_MS = 5000;
const SETTLE_FRAMES = 4;
const TYPED = '42';

const until = <T>(check: () => T) =>
  vi.waitFor(check, { timeout: PATIENCE_MS });

const frame = () =>
  new Promise<void>(resolve => requestAnimationFrame(() => resolve()));

const settle = () =>
  Array.from({ length: SETTLE_FRAMES }).reduce<Promise<void>>(
    async previous => {
      await previous;
      await frame();
    },
    Promise.resolve()
  );

let cleanup: (() => void) | undefined;

afterEach(() => {
  cleanup?.();
  cleanup = undefined;
});

function viewSelection() {
  const host = window.editor.host as EditorHost;
  const held = host.std.selection.value.find(
    selection => selection.type === 'database'
  ) as
    | { viewSelection?: { selectionType?: string; isEditing?: boolean } }
    | undefined;
  return held?.viewSelection;
}

describe('a database cell edit when the document closes', () => {
  test('a number typed, Escape, then the editor removed and the store disposed in one task: the value is stored', async () => {
    cleanup = await setupEditor('page');
    const store = window.doc;
    const workspace = window.collection;
    const noteId = store.addBlock('affine:note', {}, store.root!.id);
    const databaseId = store.addBlock(
      'affine:database',
      { title: new Text('Portfolio') },
      noteId
    );
    const model = store.getModelById(databaseId) as DatabaseBlockModel;
    const source = new DatabaseBlockDataSource(model);
    source.viewManager.viewAdd('table');
    const numberId = source.propertyAdd('end', { type: 'number' })!;
    const rowId = source.rowAdd('end');

    const cell = await until(() => {
      const element = window.editor.host!.querySelector<HTMLElement>(
        `dv-table-view-cell-container[data-row-id="${rowId}"][data-column-id="${numberId}"]`
      );
      expect(element, 'the number cell, drawn').toBeTruthy();
      return element!;
    });
    await userEvent.click(cell);
    await until(() => expect(viewSelection()?.selectionType).toBe('area'));
    if (!viewSelection()?.isEditing) await userEvent.keyboard('{Enter}');
    await until(() => expect(viewSelection()?.isEditing).toBe(true));
    await settle();
    const input = cell.querySelector('input')!;
    input.value = TYPED;

    // One task: leave editing (the editor defers its write to the next
    // frame), unmount the editor, release the store.
    input.dispatchEvent(
      new KeyboardEvent('keydown', {
        key: 'Escape',
        bubbles: true,
        cancelable: true,
      })
    );
    expect(viewSelection()?.isEditing, 'Escape left editing').toBe(false);
    window.editor.remove();
    store.dispose();
    // A frame left behind would throw `store … is disposed` here.
    await settle();

    const reopened = workspace.getDoc(store.id)!.getStore();
    expect(reopened).not.toBe(store);
    reopened.load();
    const stored = reopened.getModelById(databaseId) as DatabaseBlockModel;
    expect(stored.props.cells[rowId]?.[numberId]?.value).toBe(Number(TYPED));
  });
});
