/**
 * The link editor's edit is saved when it closes, not one frame later
 * (#746, ADR 0057, "As implemented").
 *
 * The link cell hands its URL over from `beforeExitEditingMode` through the
 * base cell's `valueSetNextTick`, deferred to the next frame. An editor
 * closed in the exit's task (a host closing the document, its store
 * released) left that frame behind: the write threw `store … is disposed`
 * and the URL was lost. The base cell now flushes the pending write as the
 * cell leaves the DOM; the engine's spec (`cell-write-at-teardown`) holds the
 * other four editors.
 */
import {
  createStandaloneCell,
  type PropertyMetaConfig,
  type StandaloneCellSource,
} from '@labre/affine-database-engine';
import { effects as engineEffects } from '@labre/affine-database-engine/effects';
import type { Store } from '@labre/store';
import {
  createAutoIncrementIdGenerator,
  TestWorkspace,
} from '@labre/store/test';
import { signal } from '@preact/signals-core';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

import {
  LinkCell,
  linkColumnConfig,
} from '../properties/link/cell-renderer.js';

const TAG = 'affine-database-link-cell';
const LINK_URL = 'https://example.com/a';

const frame = () =>
  new Promise<void>(resolve => requestAnimationFrame(() => resolve()));

beforeAll(() => {
  if (!customElements.get('uni-lit')) engineEffects();
  if (!customElements.get(TAG)) customElements.define(TAG, LinkCell);
});

afterEach(() => {
  document.body.innerHTML = '';
});

function openStore() {
  const workspace = new TestWorkspace({
    id: 'link-cell-write-at-teardown',
    idGenerator: createAutoIncrementIdGenerator(),
  });
  workspace.meta.initialize();
  const doc = workspace.createDoc('doc');
  const store = doc.getStore();
  store.load();
  return { workspace, doc, store };
}

async function mountEditing(store: Store) {
  const value$ = signal<unknown>(undefined);
  const writes: unknown[] = [];
  const src = {
    propertyId: 'p',
    name$: signal('Link'),
    data$: signal({}),
    value$,
    readonly$: signal(false),
    valueSet: vi.fn((next: unknown) => {
      store.transact(() => store.spaceDoc.getMap('cells').set('p', next));
      writes.push(next);
      value$.value = next;
    }),
  } as unknown as StandaloneCellSource;
  const el = document.createElement(TAG) as LinkCell;
  el.cell = createStandaloneCell(
    linkColumnConfig as unknown as PropertyMetaConfig,
    src
  ) as never;
  const isEditing$ = signal(true);
  el.isEditing$ = isEditing$;
  el.selectCurrentCell = vi.fn();
  document.body.append(el);
  await el.updateComplete;
  const input = el.querySelector('input');
  if (!input) throw new Error('no input');
  return { el, input, isEditing$, writes };
}

describe('the link editor closed in the exit task', () => {
  it('writes the URL once, and survives the store released right after', async () => {
    const { workspace, doc, store } = openStore();
    try {
      const { el, input, isEditing$, writes } = await mountEditing(store);
      input.value = LINK_URL;
      el.beforeExitEditingMode();
      isEditing$.value = false;
      el.remove();
      store.dispose();
      await frame();
      await frame();

      expect(writes).toEqual([LINK_URL]);
      const reopened = doc.getStore();
      reopened.load();
      expect(reopened.spaceDoc.getMap('cells').get('p')).toBe(LINK_URL);
      reopened.dispose();
    } finally {
      workspace.dispose();
    }
  });
});
