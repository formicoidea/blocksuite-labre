/**
 * Why this spec exists: the HTML import numbers the items of an
 * `<ol start="N">` as `N + index of the item`, and the index counted every
 * child of the `<ol>`, whitespace text nodes included. Indented HTML (what
 * most editors and pages copy) has one between two `<li>`, so
 * `<ol start="3">` imported as 4, 6, 8, and the list block displays a stored
 * integer `order` as is. What it would have caught: that doubling, on a flat
 * and on a nested list.
 *
 * An `<ol>` without `start` keeps `order: null` on purpose: the list block
 * numbers a numbered item with no integer order from its previous sibling
 * when it connects (`correctNumberedListsOrderToPrev`), so it shows 1, 2, 3.
 */
import { HtmlAdapter } from '@labre/affine-shared/adapters';
import type { BlockSnapshot } from '@labre/store';
import { describe, expect, test } from 'vitest';

import { createJob } from '../utils/create-job.js';
import { getProvider } from '../utils/get-provider.js';

/** `text → order` of every list item, depth first. */
async function importedOrders(html: string) {
  const adapter = new HtmlAdapter(createJob(), getProvider());
  const snapshot = await adapter.toBlockSnapshot({
    file: `<html><body>${html}</body></html>`,
  });
  const orders: Record<string, unknown> = {};
  const walk = (node: BlockSnapshot) => {
    if (node.flavour === 'affine:list') {
      const { delta } = node.props.text as { delta: { insert: string }[] };
      orders[
        delta
          .map(op => op.insert)
          .join('')
          .trim()
      ] = node.props.order;
    }
    node.children.forEach(walk);
  };
  walk(snapshot);
  return orders;
}

describe('HTML import of a numbered list', () => {
  test('indented items count from start, one by one', async () => {
    const orders = await importedOrders(
      `<ol start="3">\n  <li>a</li>\n  <li>b</li>\n  <li>c</li>\n</ol>`
    );
    expect(orders).toEqual({ a: 3, b: 4, c: 5 });
  });

  test('compact items keep counting from start', async () => {
    const orders = await importedOrders(
      `<ol start="3"><li>a</li><li>b</li><li>c</li></ol>`
    );
    expect(orders).toEqual({ a: 3, b: 4, c: 5 });
  });

  test('a nested list counts from its own start', async () => {
    const orders = await importedOrders(
      [
        `<ol start="2">`,
        `  <li>a`,
        `    <ol start="5">`,
        `      <li>x</li>`,
        `      <li>y</li>`,
        `    </ol>`,
        `  </li>`,
        `  <li>b</li>`,
        `</ol>`,
      ].join('\n')
    );
    expect(orders).toEqual({ a: 2, x: 5, y: 6, b: 3 });
  });

  test('a list without start leaves the numbering to the list block', async () => {
    const orders = await importedOrders(
      `<ol>\n  <li>a</li>\n  <li>b</li>\n</ol>`
    );
    expect(orders).toEqual({ a: null, b: null });
  });
});
