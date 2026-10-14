import { DatabaseBlockDataSource } from '@labre/affine/blocks/database';
import type { DatabaseBlockModel } from '@labre/affine/model';
import { BlockSelection, type EditorHost } from '@labre/std';
import type { ExtensionType, Store } from '@labre/store';
import { Text } from '@labre/store';
import { userEvent } from '@vitest/browser/context';
import { afterEach, beforeEach, describe, expect, test } from 'vitest';

import { wait } from '../utils/common.js';
import { setupEditor } from '../utils/setup.js';

/**
 * **Nothing on the full-page database can delete, move or insert beside the
 * database it shows** (ADR 0035 §1, B13; labre ADR-0046).
 *
 * A database document holds the views' block and one schema block per
 * source in one note; the schema blocks carry the sources (`labre:sources`),
 * so losing one loses the database. A first B13 drew the whole page editor
 * and hid the schema blocks in CSS: ⌘A then Backspace, ⌘X, the drag handle,
 * the block menu, "Turn into", Delete at the start of the note and a file
 * drop all still reached them, and a click below the database appended a
 * paragraph. This spec mounts `<affine-database-page>` on such a document
 * with the suite's real page extensions, replays each gesture, and checks
 * that the note keeps exactly its blocks, the schema blocks their props and
 * the host its place; and that mounting wrote nothing.
 */

type DatabasePage = HTMLElement & {
  store: Store;
  extensions: ExtensionType[];
  hostBlockId: string;
};

let noteId = '';
let hostId = '';
let schemaIds: string[] = [];
let page: DatabasePage;
let cleanup: () => void;
let writes = 0;

function writeDatabase(title: string, note: string) {
  const id = doc.addBlock('affine:database', { title: new Text(title) }, note);
  const model = doc.getModelById(id) as DatabaseBlockModel;
  const writer = new DatabaseBlockDataSource(model);
  writer.viewManager.viewAdd('table');
  writer.rowAdd('end');
  writer.dispose();
  return id;
}

/**
 * What must survive every gesture: the blocks of the root and of the note,
 * the schema blocks. The host's own rows may change: deleting a row is an
 * edit of the database, inline as on its page.
 */
function fingerprint() {
  return {
    root: doc.root!.children.map(child => child.id),
    note: doc.getModelById(noteId)!.children.map(child => child.id),
    hostParent: doc.getParent(hostId)?.id,
    schemas: schemaIds.map(id => {
      const model = doc.getModelById(id) as DatabaseBlockModel | null;
      return model && JSON.stringify(model.props.views);
    }),
  };
}

/** Deleting the selected row is the database's own edit: put one back. */
async function keepARow() {
  const host = doc.getModelById(hostId) as DatabaseBlockModel;
  if (host.children.length) return;
  const writer = new DatabaseBlockDataSource(host);
  writer.rowAdd('end');
  writer.dispose();
  await wait(100);
}

const editorHost = () => {
  const element = page.querySelector<EditorHost>('editor-host');
  expect(element, 'the page editor').not.toBe(null);
  return element!;
};

const hostBlock = () => {
  const element = page.querySelector<HTMLElement>('affine-database');
  expect(element, 'the host database block').not.toBe(null);
  return element!;
};

async function focusEditor() {
  editorHost().focus();
  await wait();
}

beforeEach(async () => {
  cleanup = await setupEditor('page');
  noteId = doc.addBlock('affine:note', {}, doc.root!.id);
  schemaIds = [writeDatabase('Source A', noteId)];
  hostId = writeDatabase('Portfolio', noteId);
  schemaIds.push(writeDatabase('Source B', noteId));
  doc.resetHistory();

  // One store, one selection: the page is the only editor on it.
  const app = window.editor.parentElement!;
  const extensions = window.editor.pageSpecs;
  window.editor.remove();
  page = document.createElement('affine-database-page') as DatabasePage;
  page.style.height = '600px';
  page.store = doc;
  page.extensions = extensions;
  page.hostBlockId = hostId;
  writes = 0;
  const watch = doc.slots.blockUpdated.subscribe(() => writes++);
  app.append(page);
  await wait(200);
  return () => {
    watch.unsubscribe();
    page.remove();
    cleanup();
  };
});

afterEach(() => {
  document.getSelection()?.removeAllRanges();
});

describe('<affine-database-page>', () => {
  test('draws the host database alone, with no page root chrome, writing nothing', () => {
    expect(page.querySelectorAll('affine-database')).toHaveLength(1);
    expect(hostBlock().dataset.blockId).toBe(hostId);
    expect(page.querySelector('affine-page-root')).toBe(null);
    expect(page.querySelector('affine-note')).toBe(null);
    for (const widget of [
      'affine-drag-handle-widget',
      'affine-slash-menu-widget',
      'affine-toolbar-widget',
      'affine-page-dragging-area-widget',
    ]) {
      expect(page.querySelector(widget), widget).toBe(null);
    }
    expect(writes, 'nothing written on mount').toBe(0);
  });

  test('a block selection on the host, a schema block or the note never stands', async () => {
    const { selection } = editorHost().std;
    for (const blockId of [hostId, ...schemaIds, noteId]) {
      selection.setGroup('note', [
        selection.create(BlockSelection, { blockId }),
      ]);
      expect(selection.filter(BlockSelection), blockId).toHaveLength(0);
    }
  });

  test('Escape out of a cell, then ⌘A, Backspace, Delete or ⌘X, deletes nothing', async () => {
    const before = fingerprint();
    for (const keys of [
      '{Backspace}',
      '{Delete}',
      '{Control>}x{/Control}',
      '{Control>}a{/Control}{Backspace}',
      '{Control>}a{/Control}{Control>}x{/Control}',
    ]) {
      await keepARow();
      const cell = hostBlock().querySelector<HTMLElement>(
        'dv-table-view-cell-container, affine-database-virtual-cell-container'
      );
      expect(cell, 'a cell of the row').not.toBe(null);
      await userEvent.click(cell!);
      await wait();
      await userEvent.keyboard('{Escape}{Escape}');
      await wait();
      await userEvent.keyboard(keys);
      await wait();
      expect(fingerprint(), keys).toEqual(before);
    }
  });

  test('the selection a page ⌘A or an Escape would leave deletes nothing', async () => {
    const before = fingerprint();
    const { selection } = editorHost().std;
    await focusEditor();
    for (const keys of [
      '{Backspace}',
      '{Delete}',
      '{Control>}x{/Control}',
      '{Control>}{Alt>}1{/Alt}{/Control}',
      '{Control>}{Alt>}{ArrowUp}{/Alt}{/Control}',
      '{Control>}{Shift>}{ArrowDown}{/Shift}{/Control}',
      '{Tab}',
      '{Control>}{Backspace}{/Control}',
    ]) {
      // What the page root's ⌘A selected: every block of the note.
      selection.setGroup(
        'note',
        doc
          .getModelById(noteId)!
          .children.map(child =>
            selection.create(BlockSelection, { blockId: child.id })
          )
      );
      await userEvent.keyboard(keys);
      await wait();
      expect(fingerprint(), keys).toEqual(before);
    }
    expect(doc.getModelById(hostId)?.flavour).toBe('affine:database');
  });

  test('a dropped file inserts no block', async () => {
    const before = fingerprint();
    const box = hostBlock().getBoundingClientRect();
    const transfer = new DataTransfer();
    // An attachment: an image the drop could not decode would insert nothing.
    transfer.items.add(
      new File(['notes'], 'notes.txt', { type: 'text/plain' })
    );
    const at = {
      bubbles: true,
      cancelable: true,
      composed: true,
      clientX: box.left + box.width / 2,
      clientY: box.bottom - 4,
      dataTransfer: transfer,
    };
    await userEvent.hover(hostBlock());
    await focusEditor();
    // The file drop picks its target from a throttled pointer (144ms).
    hostBlock().dispatchEvent(new DragEvent('dragover', at));
    await wait(200);
    hostBlock().dispatchEvent(new DragEvent('dragover', at));
    await wait(200);
    let reached = false;
    const editor = editorHost();
    const listen = () => (reached = true);
    editor.addEventListener('drop', listen);
    const drop = new DragEvent('drop', at);
    hostBlock().dispatchEvent(drop);
    editor.removeEventListener('drop', listen);
    await wait(500);
    expect(fingerprint()).toEqual(before);
    expect(reached, 'the editor never sees a file drop').toBe(false);
    expect(drop.defaultPrevented, 'the browser does not open it').toBe(true);
  });

  test('a click below the database adds no block', async () => {
    const before = fingerprint();
    // The root fills the page: a click below the database lands on it.
    const root = page.querySelector<HTMLElement>(
      `[data-block-id="${doc.root!.id}"]`
    )!;
    const box = root.getBoundingClientRect();
    const database = hostBlock().getBoundingClientRect();
    expect(box.bottom - database.bottom, 'room below').toBeGreaterThan(40);
    const below = document.elementFromPoint(
      box.left + box.width / 2,
      box.bottom - 20
    );
    expect(below && root.contains(below), 'the click lands on the root').toBe(
      true
    );
    expect(below?.closest('affine-database')).toBe(null);
    await userEvent.click(root, {
      position: { x: box.width / 2, y: box.height - 20 },
    });
    await wait(100);
    expect(fingerprint()).toEqual(before);
    expect(writes).toBe(0);
  });
});
