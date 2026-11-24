/**
 * A cell edit is saved when its editor closes, not one frame later (#746,
 * ADR 0057, "As implemented").
 *
 * The number, text, date, progress and link editors hand their value over
 * from `beforeExitEditingMode` through `valueSetNextTick`, which deferred the
 * write to the next animation frame. An exit followed by the editor's
 * teardown in the same task (a click elsewhere then a navigation, a host
 * closing the document and releasing its store) left that frame behind: the
 * write ran after the editor was gone, and once the store was released it
 * threw `store … is disposed` and the edit was lost
 * (`database-toolbar-pointer.spec.ts`, eight unhandled errors). The cell now
 * flushes the pending write as it leaves the DOM, once, and the frame never
 * runs.
 *
 * What it would have caught: an edit lost when the editor is removed in the
 * exit's task; the same edit written twice (the flush, then the frame); a
 * write after the store was released; a deferred write landing in a store
 * turned readonly meanwhile. The deferral itself is kept while the cell stays
 * mounted (last test). The link editor shares the path; its own spec is in
 * `database/block`.
 */
import { effects as datePickerEffects } from '@labre/affine-components/date-picker';
import { effects as portalEffects } from '@labre/affine-components/portal';
import type { Store } from '@labre/store';
import {
  createAutoIncrementIdGenerator,
  TestWorkspace,
} from '@labre/store/test';
import { signal } from '@preact/signals-core';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import type * as Y from 'yjs';

import { coreEffects } from '../core/effect.js';
import {
  createStandaloneCell,
  type PropertyMetaConfig,
  type StandaloneCellSource,
} from '../core/index.js';
import { propertyPresetsEffects } from '../property-presets/effect.js';
import { propertyPresets } from '../property-presets/index.js';

const frame = () =>
  new Promise<void>(resolve => requestAnimationFrame(() => resolve()));

beforeAll(() => {
  if (!customElements.get('uni-lit')) coreEffects();
  if (!customElements.get('date-picker')) datePickerEffects();
  if (!customElements.get('blocksuite-portal')) portalEffects();
  if (!customElements.get('affine-database-text-cell')) {
    propertyPresetsEffects();
  }
});

afterEach(() => {
  document.body.innerHTML = '';
});

interface Editor extends HTMLElement {
  cell: unknown;
  isEditing$: { value: boolean; peek(): boolean };
  selectCurrentCell: (editing: boolean) => void;
  updateComplete: Promise<boolean>;
  beforeExitEditingMode(): void;
}

/** Values no default and no seed gives these cells. */
const DATE = Date.UTC(2026, 10, 24);
const TYPED_NUMBER = 42;
const DRAGGED_PROGRESS = 40;

/** Each deferring editor of the engine, and how a user stages a value. */
const editors = [
  {
    name: 'number',
    tag: 'affine-database-number-cell',
    config: propertyPresets.numberPropertyConfig,
    stage: (el: Editor) => {
      el.querySelector('input')!.value = String(TYPED_NUMBER);
    },
    expected: TYPED_NUMBER,
  },
  {
    name: 'text',
    tag: 'affine-database-text-cell',
    config: propertyPresets.textPropertyConfig,
    stage: (el: Editor) => {
      el.querySelector('input')!.value = 'Ada';
    },
    expected: 'Ada',
  },
  {
    name: 'date',
    tag: 'affine-database-date-cell',
    config: propertyPresets.datePropertyConfig,
    stage: (el: Editor) => {
      (el as unknown as { tempValue$: { value: Date } }).tempValue$.value =
        new Date(DATE);
    },
    expected: DATE,
  },
  {
    name: 'progress',
    tag: 'affine-database-progress-cell',
    config: propertyPresets.progressPropertyConfig,
    stage: (el: Editor) => {
      (el as unknown as { tempValue: number }).tempValue = DRAGGED_PROGRESS;
    },
    expected: DRAGGED_PROGRESS,
  },
];

function openStore() {
  const workspace = new TestWorkspace({
    id: 'cell-write-at-teardown',
    idGenerator: createAutoIncrementIdGenerator(),
  });
  workspace.meta.initialize();
  const doc = workspace.createDoc('doc');
  const store = doc.getStore();
  store.load();
  return { workspace, doc, store };
}

const cellsOf = (store: Store) => store.spaceDoc.getMap<unknown>('cells');

/**
 * A cell whose source writes to the store's document, the way the database
 * block's source does (`store.transact`, which throws once the store is
 * released). Mounted editing, like the table's cell container mounts it.
 */
async function mountEditing(
  editor: (typeof editors)[number],
  store: Store,
  readonly$ = signal(false)
) {
  const value$ = signal<unknown>(undefined);
  const writes: unknown[] = [];
  const src = {
    propertyId: 'p',
    name$: signal('Prop'),
    data$: signal({}),
    value$,
    readonly$,
    valueSet: vi.fn((next: unknown) => {
      store.transact(() => cellsOf(store).set('p', next));
      writes.push(next);
      value$.value = next;
    }),
  } as unknown as StandaloneCellSource;
  const el = document.createElement(editor.tag) as Editor;
  el.cell = createStandaloneCell(editor.config as PropertyMetaConfig, src);
  el.isEditing$ = signal(true);
  el.selectCurrentCell = vi.fn();
  document.body.append(el);
  await el.updateComplete;
  return { el, writes };
}

/** What a view does as editing ends: the exit hook, then `isEditing$`. */
function exitEditing(el: Editor) {
  const { isEditing$ } = el;
  el.beforeExitEditingMode();
  isEditing$.value = false;
}

describe.each(editors)('the $name editor closed in the exit task', editor => {
  it('writes the value to the document once, as it leaves the DOM', async () => {
    const { workspace, store } = openStore();
    try {
      const { el, writes } = await mountEditing(editor, store);
      editor.stage(el);
      exitEditing(el);
      el.remove();

      expect(cellsOf(store).get('p')).toEqual(editor.expected);
      await frame();
      expect(writes).toEqual([editor.expected]);
    } finally {
      workspace.dispose();
    }
  });

  it('with the store released right after: no throw, nothing lost', async () => {
    const { workspace, doc, store } = openStore();
    try {
      const { el, writes } = await mountEditing(editor, store);
      editor.stage(el);
      exitEditing(el);
      el.remove();
      store.dispose();
      // A frame left behind would throw `store … is disposed` here.
      await frame();
      await frame();

      expect(writes).toEqual([editor.expected]);
      const reopened = doc.getStore();
      expect(reopened).not.toBe(store);
      reopened.load();
      expect(
        (reopened.spaceDoc.getMap('cells') as Y.Map<unknown>).get('p')
      ).toEqual(editor.expected);
      reopened.dispose();
    } finally {
      workspace.dispose();
    }
  });

  it('a store turned readonly before the write gets nothing', async () => {
    const { workspace, store } = openStore();
    try {
      const readonly$ = signal(false);
      const { el, writes } = await mountEditing(editor, store, readonly$);
      editor.stage(el);
      exitEditing(el);
      readonly$.value = true;
      el.remove();
      await frame();

      expect(writes).toEqual([]);
      expect(cellsOf(store).has('p')).toBe(false);
    } finally {
      workspace.dispose();
    }
  });

  it('still mounted, the write waits for the next frame, once', async () => {
    const { workspace, store } = openStore();
    try {
      const { el, writes } = await mountEditing(editor, store);
      editor.stage(el);
      exitEditing(el);

      expect(writes).toEqual([]);
      await frame();
      expect(writes).toEqual([editor.expected]);
      el.remove();
      await frame();
      expect(writes).toEqual([editor.expected]);
    } finally {
      workspace.dispose();
    }
  });
});
