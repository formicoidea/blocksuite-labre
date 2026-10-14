/**
 * The full-page database (ADR 0035 §1, B13): its root draws the host block
 * alone, and the selection of its store stays on the host.
 *
 * What it would have caught:
 * - the page root (`affine-page-root`, with its drag handle, block menu,
 *   slash menu, Backspace and ⌘A handlers, its click below that appends a
 *   paragraph) still drawing the database document;
 * - a block or text selection on a schema block or on the note beside the
 *   host (they carry `labre:sources`, labre ADR-0046): a flavour keymap
 *   follows the model ancestors of the selected block, drawn or not, so a
 *   note's ⌘A then Backspace, a cut or a "Turn into" would reach them;
 * - a block selection on the host itself (⌘X or Backspace deletes it);
 * - the database's own view selection on the host refused (no cell could be
 *   selected).
 * The gestures themselves are replayed in the integration suite
 * (`database-page-guards.spec.ts`).
 */
import { Container } from '@labre/global/di';
import {
  BlockSelection,
  BlockViewIdentifier,
  SurfaceSelection,
  TextSelection,
} from '@labre/std';
import { literal } from 'lit/static-html.js';
import { describe, expect, test } from 'vitest';

import {
  DatabasePageHostBlockIdentifier,
  databasePageRootExtension,
  selectionStaysInHost,
} from '../database-page/database-page-root.js';

type Node = { id: string; parent: Node | null };

function tree() {
  const nodes = new Map<string, Node>();
  const add = (id: string, parent: Node | null) => {
    const node = { id, parent };
    nodes.set(id, node);
    return node;
  };
  const page = add('page', null);
  const note = add('note', page);
  add('schema', note);
  const host = add('host', note);
  const row = add('row', host);
  add('cell', row);
  add('paragraph', note);
  return { getModelById: (id: string) => nodes.get(id) ?? null };
}

const text = (from: string, to?: string) =>
  new TextSelection({
    from: { blockId: from, index: 0, length: 0 },
    to: to ? { blockId: to, index: 0, length: 0 } : null,
  });

describe('selectionStaysInHost', () => {
  const store = tree();
  const keeps = (selection: Parameters<typeof selectionStaysInHost>[2]) =>
    selectionStaysInHost(store, 'host', selection);

  test('refuses a block selection outside the host, or on the host', () => {
    for (const blockId of ['schema', 'note', 'paragraph', 'page', 'host']) {
      expect(keeps(new BlockSelection({ blockId })), blockId).toBe(false);
    }
  });

  test('keeps a block selection inside the host', () => {
    expect(keeps(new BlockSelection({ blockId: 'row' }))).toBe(true);
    expect(keeps(new BlockSelection({ blockId: 'cell' }))).toBe(true);
  });

  test('refuses a text selection that leaves the host at either end', () => {
    expect(keeps(text('paragraph'))).toBe(false);
    expect(keeps(text('row', 'paragraph'))).toBe(false);
    expect(keeps(text('schema', 'row'))).toBe(false);
    expect(keeps(text('host'))).toBe(false);
    expect(keeps(text('row', 'cell'))).toBe(true);
  });

  test("keeps any other selection on the host: the database's own", () => {
    expect(keeps(new SurfaceSelection('host', [], false))).toBe(true);
    expect(keeps(new SurfaceSelection('schema', [], false))).toBe(false);
    expect(keeps(new SurfaceSelection('gone', [], false))).toBe(false);
  });
});

describe('databasePageRootExtension', () => {
  test('replaces the page root and names the host block', () => {
    const container = new Container();
    container.addImpl(
      BlockViewIdentifier('affine:page'),
      () => literal`affine-page-root`
    );
    databasePageRootExtension('host-1').setup(container);
    const provider = container.provider();
    expect(provider.get(BlockViewIdentifier('affine:page'))).toEqual(
      literal`affine-database-page-root`
    );
    expect(provider.get(DatabasePageHostBlockIdentifier).hostBlockId).toBe(
      'host-1'
    );
  });
});
