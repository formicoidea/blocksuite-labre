/**
 * The full-page database host, `<affine-database-page>` (ADR 0035 §1, B13).
 *
 * The full page is the inline table view moved to a page: the host mounts
 * the element on the database document's editor, and the element only
 * scopes what that editor shows. What it would have caught:
 * - a second drawing of the database (anything but the host's own editor
 *   inside the element);
 * - the schema blocks of a multi-source database drawn under the views, or
 *   the views' block drawn twice as its own title and the page title;
 * - a block id breaking out of the selector it is placed in;
 * - `std.render()` called on every update (a new editor host each time);
 * - a missing views' block drawn as a blank page with no word, or staying
 *   "missing" once it arrives through sync;
 * - anything written to the document on mount.
 */
import { Subject } from 'rxjs';
import { afterEach, describe, expect, test, vi } from 'vitest';

import {
  DatabasePageHost,
  databasePageRules,
} from '../database-page/database-page.js';

if (!customElements.get('affine-database-page')) {
  customElements.define('affine-database-page', DatabasePageHost);
}

function fakeStd(blocks: Record<string, string>) {
  const blockUpdated = new Subject<{ type: 'add' | 'delete' | 'update' }>();
  const editor = document.createElement('div');
  editor.dataset.testid = 'the-host-editor';
  const transact = vi.fn();
  const std = {
    render: vi.fn(() => editor),
    getOptional: () => null,
    store: {
      transact,
      getBlock: (id: string) =>
        blocks[id] ? { model: { flavour: blocks[id] } } : null,
      slots: { blockUpdated },
    },
  };
  return { std, blocks, blockUpdated, editor, transact };
}

async function mount(std: unknown, hostBlockId: string) {
  const element = document.createElement('affine-database-page');
  element.std = std as never;
  element.hostBlockId = hostBlockId;
  document.body.append(element);
  await element.updateComplete;
  return element;
}

afterEach(() => {
  document.body.replaceChildren();
});

describe('databasePageRules', () => {
  test('hides every other database block and the host title row', () => {
    const rules = databasePageRules('host-1');
    expect(rules).toContain(
      'affine-database-page affine-database:not(affine-database[data-block-id="host-1"]) { display: none; }'
    );
    expect(rules).toContain(
      'affine-database[data-block-id="host-1"] div:has(> affine-database-title)'
    );
  });

  test('a hostile id stays inside its attribute selector', () => {
    const rules = databasePageRules('x"] , body { display:none } [a="');
    expect(rules).not.toContain('"] , body');
  });
});

describe('<affine-database-page>', () => {
  test("draws the host's own editor, once, under the scoping rules", async () => {
    const { std, editor, transact } = fakeStd({ 'host-1': 'affine:database' });
    const element = await mount(std, 'host-1');
    expect(element.contains(editor)).toBe(true);
    expect(element.querySelector('style')?.textContent).toContain('host-1');
    expect(
      element.querySelector('[data-testid="database-page-host-missing"]')
    ).toBeNull();
    element.requestUpdate();
    await element.updateComplete;
    expect(std.render).toHaveBeenCalledTimes(1);
    expect(transact).not.toHaveBeenCalled();
  });

  test('a missing views block says so, then follows its arrival', async () => {
    const { std, blocks, blockUpdated } = fakeStd({});
    const element = await mount(std, 'host-1');
    const notice = () =>
      element.querySelector('[data-testid="database-page-host-missing"]');
    expect(notice()?.textContent?.trim()).toBe(
      'This database has no views to show.'
    );
    blocks['host-1'] = 'affine:database';
    blockUpdated.next({ type: 'add' });
    await element.updateComplete;
    expect(notice()).toBeNull();
  });

  test('a block of another flavour is not a views block', async () => {
    const { std } = fakeStd({ 'host-1': 'affine:paragraph' });
    const element = await mount(std, 'host-1');
    expect(
      element.querySelector('[data-testid="database-page-host-missing"]')
    ).not.toBeNull();
  });
});
