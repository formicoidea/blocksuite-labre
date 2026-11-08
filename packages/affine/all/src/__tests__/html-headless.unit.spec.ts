// @vitest-environment node
import {
  docLinkBaseURLMiddleware,
  HtmlAdapter,
  titleMiddleware,
} from '@labre/affine-shared/adapters';
import { type Store, Text } from '@labre/store';
import rehypeParse from 'rehype-parse';
import rehypeStringify from 'rehype-stringify';
import { unified } from 'unified';
import { describe, expect, test } from 'vitest';
import * as Y from 'yjs';

import { openHeadless } from './utils/open-headless';

/**
 * GUARD — `HtmlAdapter` renders a stored page in plain Node.
 *
 * A host renders pages to static HTML on a server: the store opened as
 * `openHeadless` opens it, the adapter instantiated by hand, no DOM. Every
 * other adapter spec runs under happy-dom, where a stray `document` or `window`
 * read goes unnoticed; here it is a `ReferenceError`. The directive on the first
 * line of this file is what makes the spec worth having: keep it.
 *
 * **What it would catch**: an adapter, a middleware or an inline matcher reading
 * a DOM global unguarded (`middlewares/doc-link.ts` shows the guard), and any
 * HTML a parser has to repair. The todo list printed `<input><label></input>`
 * until this spec parsed the output: `input` is void, so a label inside it
 * prints a stray end tag. The document title reached the page unescaped.
 */

/** A 1×1 PNG, bytes only: the blob a store gets back from object storage. */
const PNG = Uint8Array.from(
  atob(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII='
  ),
  c => c.charCodeAt(0)
);

/** A stored page holding one of each block a static site renders. */
function storedPage(): Uint8Array {
  const { doc, store } = openHeadless(null);
  store.transact(() => {
    const page = store.addBlock('affine:page', {
      title: new Text('The title'),
    });
    store.addBlock('affine:surface', {}, page);
    const note = store.addBlock('affine:note', {}, page);
    const add = (flavour: string, props: Record<string, unknown>) =>
      store.addBlock(flavour, props, note);

    add('affine:paragraph', { type: 'h1', text: new Text('Heading one') });
    add('affine:paragraph', { type: 'h3', text: new Text('Heading three') });
    add('affine:paragraph', {
      text: new Text([
        { insert: 'plain ' },
        { insert: 'bold', attributes: { bold: true } },
        { insert: ' ' },
        { insert: 'a link', attributes: { link: 'https://example.com/a' } },
        { insert: ' ' },
        {
          insert: ' ',
          attributes: { reference: { type: 'LinkedPage', pageId: 'other' } },
        },
      ]),
    });
    add('affine:list', { type: 'bulleted', text: new Text('A bullet') });
    add('affine:list', { type: 'numbered', text: new Text('A number') });
    add('affine:list', {
      type: 'todo',
      checked: true,
      text: new Text('A todo'),
    });
    add('affine:code', { language: 'ts', text: new Text('const a = 1;') });
    add('affine:divider', {});
    add('affine:image', { sourceId: 'blob-image', caption: 'A picture' });
    add('affine:table', {
      rows: { r1: { rowId: 'r1', order: 'a0' } },
      columns: { c1: { columnId: 'c1', order: 'a0' } },
      cells: { 'r1:c1': { text: new Text('A cell') } },
    });
    const database = add('affine:database', {
      title: new Text('A database'),
      views: [],
      columns: [
        { type: 'title', id: 'title', name: 'Name', data: {} },
        { type: 'rich-text', id: 'notes', name: 'Notes', data: {} },
      ],
      cells: {
        'row-1': { notes: { columnId: 'notes', value: new Text('A note') } },
      },
    });
    store.addBlock(
      'affine:paragraph',
      { id: 'row-1', text: new Text('A row') },
      database
    );
    add('affine:bookmark', {
      url: 'https://example.com/b',
      title: 'A bookmark',
    });
    add('affine:embed-youtube', {
      url: 'https://www.youtube.com/watch?v=abc',
      title: 'A video',
    });
    add('affine:embed-linked-doc', { pageId: 'other' });
  });
  return Y.encodeStateAsUpdate(doc);
}

/** The call a host makes: the same two middlewares as a Markdown read. */
async function render(store: Store, title = 'The title') {
  const job = store.getTransformer([
    docLinkBaseURLMiddleware(store.workspace.id),
    titleMiddleware([
      { id: 'page', title, tags: [], createDate: 0 },
      { id: 'other', title: 'The other page', tags: [], createDate: 0 },
    ]),
  ]);
  const snapshot = job.docToSnapshot(store);
  if (!snapshot) throw new Error('the store gave no snapshot');
  return new HtmlAdapter(job, store.provider).fromDocSnapshot({
    snapshot: { ...snapshot, meta: { ...snapshot.meta, title } },
    assets: job.assetsManager,
  });
}

/**
 * What an HTML parser makes of `html`, printed back. A parser repairs what is
 * not well formed (a stray end tag, a block inside a `p`), so anything but the
 * input means it had to. The table adapter's bare `border` is the one spelling
 * the printer normalises and no repair.
 */
const reparsed = (html: string) =>
  String(unified().use(rehypeParse).use(rehypeStringify).processSync(html));
const wellFormed = (html: string) =>
  html.replaceAll('<table border ', '<table border="" ');

async function openStoredPage() {
  const { store, workspace } = openHeadless(storedPage());
  await workspace.blobSync.set('blob-image', new Blob([PNG]));
  return store;
}

describe('HtmlAdapter in plain Node', () => {
  test('the spec really runs with no DOM', () => {
    expect(typeof document).toBe('undefined');
    expect(typeof window).toBe('undefined');
    expect(typeof location).toBe('undefined');
  });

  test('renders every block of a stored page', async () => {
    const { file, assetsIds } = await render(await openStoredPage());

    const fragments = [
      '<h1>The title</h1>',
      '<h1>Heading one</h1>',
      '<h3>Heading three</h3>',
      '<strong>bold</strong>',
      '<a href="https://example.com/a">a link</a>',
      '<a href="./workspace/ws-1/other">The other page</a>',
      '<ul class="bulleted-list"><li class="affine-list-block-container">A bullet</li></ul>',
      '<ol class="numbered-list"><li class="affine-list-block-container">A number</li></ol>',
      '<input type="checkbox" checked><label style="margin-right: 3px;"></label>A todo',
      '<pre><code class="code-ts">const a = 1;</code></pre>',
      '<hr>',
      '<img src="assets/blob-image.png" alt="blob-image.png" title="A picture">',
      'A cell',
      '<th>Name</th><th>Notes</th>',
      '<td>A row</td><td>A note</td>',
      '<a class="affine-bookmark" rel="noopener" href="https://example.com/b"><span class="affine-bookmark-title">A bookmark</span>',
      '<a href="https://www.youtube.com/watch?v=abc">A video</a>',
    ];
    expect(fragments.filter(fragment => !file.includes(fragment))).toEqual([]);
    expect(assetsIds).toEqual(['blob-image']);
  });

  test('prints HTML no parser has to repair', async () => {
    const { file } = await render(await openStoredPage());
    expect(reparsed(file)).toBe(wellFormed(file));
  });

  test('a hostile page stays inert', async () => {
    const { doc, store } = openHeadless(null);
    store.transact(() => {
      const page = store.addBlock('affine:page', { title: new Text('t') });
      const note = store.addBlock('affine:note', {}, page);
      store.addBlock(
        'affine:paragraph',
        {
          text: new Text([
            { insert: '<script>alert(1)</script>' },
            { insert: 'x', attributes: { link: 'javascript:alert(1)' } },
          ]),
        },
        note
      );
      store.addBlock(
        'affine:bookmark',
        { url: 'javascript:alert(1)', title: 'y' },
        note
      );
    });
    const title = '</h1><img src=x onerror=alert(1)>$&';
    const { file } = await render(
      openHeadless(Y.encodeStateAsUpdate(doc)).store,
      title
    );
    expect(file).not.toContain('javascript:');
    expect(file).not.toContain('<script>');
    expect(file).not.toContain('<img');
    expect(file).toContain('&#x3C;/h1>&#x3C;img src=x onerror=alert(1)>$&');
    expect(reparsed(file)).toBe(wellFormed(file));
  });
});
