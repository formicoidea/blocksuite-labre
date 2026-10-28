/**
 * GUARD — a database knows it is drawn as the page from two facts it
 * measures, and from nothing stored (ADR 0035 amendment of 2026-10-28,
 * `isStandaloneDatabase`): its parent block element is the root component,
 * and its scroll container holds a `<doc-title>` whose `body-block-id`
 * names it.
 *
 * What it would have caught: the database's own title row drawn under the
 * page title that already names it (P7, 2026-10-16), and the page's two
 * scrollbars and jumping column header (labre recette, 2026-10-26), each
 * time the page layout was keyed on something other than those two facts:
 * an inline database at the top of a note taken for a page, a heading of
 * another block, or no heading at all, which must keep the inline look.
 */
import { afterEach, describe, expect, test } from 'vitest';

import {
  isStandaloneDatabase,
  type StandaloneCandidate,
} from '../standalone-layout.js';

afterEach(() => {
  document.body.innerHTML = '';
});

function block(id: string, tag = 'div') {
  const element = document.createElement(tag);
  element.dataset.blockId = id;
  return element;
}

function database(id: string, root: Element | null) {
  const element = block(id, 'section') as unknown as StandaloneCandidate;
  Object.defineProperty(element, 'rootComponent', {
    value: root,
    configurable: true,
  });
  return element;
}

function title(bodyBlockId?: string) {
  const element = document.createElement('doc-title');
  if (bodyBlockId !== undefined) {
    element.setAttribute('body-block-id', bodyBlockId);
  }
  return element;
}

/**
 * The full page: a scroller holding the heading, then the editor host whose
 * root renders the database directly.
 */
function fullPage(options: { heading?: Element | null; inNote?: boolean }) {
  const viewport = document.createElement('div');
  viewport.style.overflowY = 'auto';
  if (options.heading) viewport.append(options.heading);
  const host = document.createElement('editor-host');
  const root = block('root');
  const db = database('db-1', root);
  if (options.inNote) {
    const note = block('note');
    note.append(db);
    root.append(note);
  } else {
    root.append(db);
  }
  host.append(root);
  viewport.append(host);
  document.body.append(viewport);
  return { viewport, root, db };
}

describe('isStandaloneDatabase', () => {
  test('a database the root renders, under the heading naming it, is the page', () => {
    const { db } = fullPage({ heading: title('db-1') });
    expect(isStandaloneDatabase(db, 'db-1')).toBe(true);
  });

  test('a heading above the editor host still counts, inside the scroller', () => {
    const { db, viewport } = fullPage({ heading: null });
    const header = document.createElement('header');
    header.append(title('db-1'));
    viewport.prepend(header);
    expect(isStandaloneDatabase(db, 'db-1')).toBe(true);
  });

  test('a heading outside the scroller does not count', () => {
    const { db } = fullPage({ heading: null });
    document.body.prepend(title('db-1'));
    expect(isStandaloneDatabase(db, 'db-1')).toBe(false);
  });

  test('a sibling database at the top level, not named by the heading, is not the page', () => {
    const { root } = fullPage({ heading: title('db-1') });
    const sibling = database('db-2', root);
    root.append(sibling);
    expect(isStandaloneDatabase(sibling, 'db-2')).toBe(false);
  });

  test('a heading naming another block keeps the inline look', () => {
    const { db } = fullPage({ heading: title('other') });
    expect(isStandaloneDatabase(db, 'db-1')).toBe(false);
  });

  test('a heading with no body block keeps the inline look', () => {
    const { db } = fullPage({ heading: title() });
    expect(isStandaloneDatabase(db, 'db-1')).toBe(false);
  });

  test('a page with no heading keeps the inline look', () => {
    const { db } = fullPage({ heading: null });
    expect(isStandaloneDatabase(db, 'db-1')).toBe(false);
  });

  test('a database in a note is inline, whatever the heading says', () => {
    const { db } = fullPage({ heading: title('db-1'), inNote: true });
    expect(isStandaloneDatabase(db, 'db-1')).toBe(false);
  });

  test('a database with no root component mounted is inline', () => {
    const { db } = fullPage({ heading: title('db-1') });
    Object.defineProperty(db, 'rootComponent', { value: null });
    expect(isStandaloneDatabase(db, 'db-1')).toBe(false);
  });

  test('an id with selector characters is matched as an id', () => {
    const id = 'a"b]c';
    const viewport = document.createElement('div');
    viewport.style.overflowY = 'auto';
    viewport.append(title(id));
    const root = block('root');
    const db = database(id, root);
    root.append(db);
    viewport.append(root);
    document.body.append(viewport);
    expect(isStandaloneDatabase(db, id)).toBe(true);
  });
});
