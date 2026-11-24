import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { signal } from '@preact/signals-core';

import { coreEffects } from '../core/effect.js';
import type { DataViewUILogicBase } from '../core/view/data-view-base.js';
import { widgetPresetsEffects } from '../widget-presets/effect.js';
import { ShowQuickSettingBarKey } from '../widget-presets/quick-setting-bar/context.js';
import { toolsWidgetPresets } from '../widget-presets/tools/index.js';

/**
 * Guard for issue #730 (upstream toeverything/AFFiNE#15900, de46641):
 * "keys typed in the view search field reach the table hotkeys (Backspace
 * clears the selected cell)".
 *
 * The table's keys (`TableHotkeysController`) listen on the document through
 * the std keyboard dispatcher, so a keydown in the search field that bubbles
 * to the document edits the selected cell. Upstream stops every keydown in
 * the field. Labre stops them one level up, in the toolbar's
 * `keepKeysInBar` (#678): "in a text field, every key but Escape is the
 * field's". This spec pins it:
 *
 * - unmodified keys (Backspace, Delete, arrows, Enter, a letter) never reach
 *   the document;
 * - Escape from a field opened with the mouse still reaches the document
 *   (the #678 arbitration, product owner's rule);
 * - a shortcut typed in the field (Ctrl/Cmd+A to select the search text,
 *   Ctrl/Cmd+Z to undo the typing) never reaches the document either. It
 *   did before #730: `keepKeysInBar` returned on a modifier before it looked
 *   at the target, so the table's `Mod-a` turned a selected cell into
 *   "every row selected" and the editor's `Mod-z` undid the document.
 */

const TABLE_TOOLS = [
  toolsWidgetPresets.filter,
  toolsWidgetPresets.sort,
  toolsWidgetPresets.search,
  toolsWidgetPresets.viewOptions,
  toolsWidgetPresets.tableAddRow,
];

beforeAll(() => {
  if (!customElements.get('uni-lit')) coreEffects();
  if (!customElements.get('data-view-header-tools')) widgetPresetsEffects();
});

afterEach(() => {
  document.body.innerHTML = '';
  vi.restoreAllMocks();
});

function logic() {
  const view = {
    id: 'view-1',
    type: 'table',
    readonly$: signal(false),
    rowsLocked$: signal(false),
    vars$: signal([]),
    // No filter trait, no page layout: the toolbar's inline defaults.
    traitGet: () => undefined,
    setSearch: vi.fn(),
    serviceGet: () => null,
    serviceGetOrCreate: (key: unknown) =>
      key === ShowQuickSettingBarKey ? signal({}) : null,
  };
  return {
    view,
    addRow: vi.fn(),
    eventTrace: vi.fn(),
  } as unknown as DataViewUILogicBase;
}

/** Lit renders a level of nested elements per pass: the toolbar has three. */
const SETTLE_PASSES = 4;

const updatesOfAll = () =>
  Promise.all(
    [...document.body.querySelectorAll('*')]
      .map(
        el =>
          (el as Partial<{ updateComplete: Promise<boolean> }>).updateComplete
      )
      .filter(Boolean)
  );

const settle = () =>
  Array.from({ length: SETTLE_PASSES }).reduce<Promise<unknown>>(
    async previous => {
      await previous;
      return updatesOfAll();
    },
    Promise.resolve()
  );

/** The toolbar with its search field opened by a mouse click. */
async function openSearchWithMouse() {
  const tools = document.createElement('data-view-header-tools');
  tools.dataViewLogic = logic();
  tools.toolsMap = { table: TABLE_TOOLS };
  document.body.append(tools);
  await settle();
  const button = tools.querySelector<HTMLElement>(
    '[data-testid="dv-tools-search"]'
  )!;
  button.dispatchEvent(new MouseEvent('click', { bubbles: true, detail: 1 }));
  await settle();
  return tools.querySelector<HTMLInputElement>(
    '.affine-database-search-input'
  )!;
}

/** What the std keyboard dispatcher would see: a document listener. */
function documentKeys() {
  const seen: string[] = [];
  const listener = (event: KeyboardEvent) =>
    seen.push(
      `${event.ctrlKey ? 'Ctrl-' : ''}${event.metaKey ? 'Meta-' : ''}${event.key}`
    );
  document.addEventListener('keydown', listener);
  return {
    seen,
    stop: () => document.removeEventListener('keydown', listener),
  };
}

const type = (field: HTMLElement, init: KeyboardEventInit) =>
  field.dispatchEvent(
    new KeyboardEvent('keydown', { bubbles: true, cancelable: true, ...init })
  );

describe('keys typed in the view search field (#730)', () => {
  it('keeps unmodified keys from the table hotkeys', async () => {
    const field = await openSearchWithMouse();
    const doc = documentKeys();
    ['Backspace', 'Delete', 'ArrowLeft', 'Enter', 'a'].forEach(key =>
      type(field, { key })
    );
    doc.stop();
    expect(doc.seen).toEqual([]);
  });

  it('lets Escape through when the field was opened with the mouse (#678)', async () => {
    const field = await openSearchWithMouse();
    const doc = documentKeys();
    type(field, { key: 'Escape' });
    doc.stop();
    expect(doc.seen).toEqual(['Escape']);
  });

  it('keeps a select-all typed in the field from the table hotkeys', async () => {
    const field = await openSearchWithMouse();
    const doc = documentKeys();
    type(field, { key: 'a', ctrlKey: true });
    type(field, { key: 'a', metaKey: true });
    doc.stop();
    // The table binds `Mod-a` (select every row, preventDefault).
    expect(doc.seen).toEqual([]);
  });

  it('keeps an undo typed in the field from the editor', async () => {
    const field = await openSearchWithMouse();
    const doc = documentKeys();
    type(field, { key: 'z', ctrlKey: true });
    type(field, { key: 'z', metaKey: true });
    type(field, { key: 'z', metaKey: true, shiftKey: true });
    doc.stop();
    // The editor binds `Mod-z` and `Mod-Shift-z` (undo and redo the document).
    expect(doc.seen).toEqual([]);
  });
});
