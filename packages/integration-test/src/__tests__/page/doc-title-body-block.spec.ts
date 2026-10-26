import { DatabaseBlockDataSource } from '@labre/affine/blocks/database';
import type { DatabaseBlockModel, RootBlockModel } from '@labre/affine/model';
import type { EditorHost } from '@labre/std';
import type { InlineEditor } from '@labre/std/inline';
import type { ExtensionType, Store } from '@labre/store';
import { Text } from '@labre/store';
import { userEvent } from '@vitest/browser/context';
import { afterEach, describe, expect, test } from 'vitest';

import { wait } from '../utils/common.js';
import { setupEditor } from '../utils/setup.js';

/**
 * **The page title of a database's full page writes nothing to the note**
 * (`<doc-title .bodyBlockId>`, ADR 0035 amendment of 2026-10-14, B13; labre
 * ADR-0046).
 *
 * The full page draws the database block alone; the document's note also
 * holds the schema blocks (`labre:sources`). The title's Enter split the
 * title into a first paragraph of that note and its ArrowDown created one,
 * paragraphs the page never draws, in front of what carries the sources:
 * the host had to swallow both keys in capture.
 *
 * What it would have caught:
 * - Enter or ArrowDown in the title adding a block (or writing anything)
 *   once the title names its body block;
 * - ArrowDown not handing the caret to that block (its first cell);
 * - the default title losing its 0.48 behaviour: Enter adds a first
 *   paragraph, ArrowDown creates one when the note has no text block.
 */

type DatabasePage = HTMLElement & {
  store: Store;
  extensions: ExtensionType[];
  hostBlockId: string;
  heading: HTMLElement | null;
};

type Title = HTMLElement & {
  doc: Store;
  bodyBlockId: string | undefined;
  inlineEditor: InlineEditor | null;
};

let cleanup: (() => void) | undefined;

afterEach(() => {
  document.getSelection()?.removeAllRanges();
  cleanup?.();
  cleanup = undefined;
});

/** A note holding a database with a table and a row, as a base's document. */
function writeDatabaseNote() {
  const noteId = doc.addBlock('affine:note', {}, doc.root!.id);
  const hostId = doc.addBlock(
    'affine:database',
    { title: new Text('Portfolio') },
    noteId
  );
  const writer = new DatabaseBlockDataSource(
    doc.getModelById(hostId) as DatabaseBlockModel
  );
  writer.viewManager.viewAdd('table');
  writer.rowAdd('end');
  writer.dispose();
  doc.resetHistory();
  return { noteId, hostId };
}

const titleText = () => (doc.root as RootBlockModel).props.title.toString();

const noteChildren = (noteId: string) =>
  doc.getModelById(noteId)!.children.map(child => child.id);

async function press(title: Title, key: string) {
  title.inlineEditor!.focusEnd();
  await wait(50);
  await userEvent.keyboard(key);
  await wait(100);
}

describe('<doc-title> on a database full page (bodyBlockId)', () => {
  let page: DatabasePage;
  let title: Title;
  let noteId = '';
  let hostId = '';
  let writes = 0;

  async function mount() {
    cleanup = await setupEditor('page');
    ({ noteId, hostId } = writeDatabaseNote());

    // As a host mounts it: the title as the page's heading, in its viewport.
    const app = window.editor.parentElement!;
    const extensions = window.editor.pageSpecs;
    window.editor.remove();
    title = document.createElement('doc-title') as Title;
    title.doc = doc;
    title.bodyBlockId = hostId;
    page = document.createElement('affine-database-page') as DatabasePage;
    page.style.height = '600px';
    page.store = doc;
    page.extensions = extensions;
    page.hostBlockId = hostId;
    page.heading = title;
    app.append(page);
    await wait(200);
    writes = 0;
    const watch = doc.slots.blockUpdated.subscribe(() => writes++);
    const previous = cleanup;
    cleanup = () => {
      watch.unsubscribe();
      page.remove();
      previous();
    };
  }

  test('Enter and ArrowDown add nothing and write nothing', async () => {
    await mount();
    const before = {
      root: doc.root!.children.map(child => child.id),
      note: noteChildren(noteId),
      title: titleText(),
    };
    for (const key of ['{Enter}', '{ArrowDown}', '{Enter}{Enter}']) {
      await press(title, key);
      expect(
        {
          root: doc.root!.children.map(child => child.id),
          note: noteChildren(noteId),
          title: titleText(),
        },
        key
      ).toEqual(before);
    }
    expect(writes, 'nothing written').toBe(0);
  });

  test('ArrowDown hands the caret to the body block', async () => {
    await mount();
    await press(title, '{ArrowDown}');
    const std = page.querySelector<EditorHost>('editor-host')!.std;
    const held = std.selection.value.find(
      selection => selection.type === 'database'
    );
    expect(held?.blockId, 'a selection in the database').toBe(hostId);
    expect(title.inlineEditor!.getInlineRange()).toBe(null);
  });
});

describe('<doc-title> without bodyBlockId (0.48)', () => {
  test('Enter adds a first paragraph to the note', async () => {
    cleanup = await setupEditor('page');
    const { noteId } = writeDatabaseNote();
    await wait(200);
    const title = window.editor.querySelector<Title>('doc-title')!;
    const before = noteChildren(noteId);
    await press(title, '{Enter}');
    const after = noteChildren(noteId);
    expect(after).toHaveLength(before.length + 1);
    expect(doc.getModelById(after[0]!)?.flavour).toBe('affine:paragraph');
  });

  test('ArrowDown creates a paragraph when the note has no text block', async () => {
    cleanup = await setupEditor('page');
    const { noteId } = writeDatabaseNote();
    await wait(200);
    const title = window.editor.querySelector<Title>('doc-title')!;
    const before = noteChildren(noteId);
    await press(title, '{ArrowDown}');
    const after = noteChildren(noteId);
    expect(after).toHaveLength(before.length + 1);
    expect(doc.getModelById(after[0]!)?.flavour).toBe('affine:paragraph');
  });
});
