import { TranslationProvider } from '@labre/affine-shared/services';
import { type BlockStdScope, stdContext } from '@labre/std';
import { ContextProvider } from '@lit/context';
import { signal } from '@preact/signals-core';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

import { coreEffects } from '../core/effect.js';
import { PageLayoutKey } from '../core/view-manager/page-layout.js';
import type { DataViewUILogicBase } from '../core/view/data-view-base.js';
import {
  DATA_VIEW_FILTER,
  DATA_VIEW_NEW_RECORD,
  DATA_VIEW_SEARCH,
  DATA_VIEW_SORT,
  DATA_VIEW_VIEW_SETTINGS,
} from '../translations.js';
import { widgetPresetsEffects } from '../widget-presets/effect.js';
import { toolsWidgetPresets } from '../widget-presets/tools/index.js';
import {
  keyboardOpener,
  popupTargetReturningFocus,
} from '../widget-presets/tools/keyboard.js';

/**
 * The view toolbar of a database (filter, sort, search, view options, New)
 * is a row of named controls a keyboard reaches (#678, WCAG 2.1.1, 4.1.2).
 *
 * What it would have caught:
 * - a control out of the tab order (the audit measured `tabIndex = -1` on
 *   every one of them) or without a role;
 * - a control without an accessible name, or one spelled in the code
 *   instead of read through the translation seam: "⋯" was a bare `div`
 *   with no name, search an icon `div` inside a `label`;
 * - Enter or Space not activating a control, or reaching the editor too
 *   (its Enter adds a row under a selected cell);
 * - a read-only view offering filter, sort, view options or New;
 * - the toolbar hidden at rest where the views are the page itself
 *   (`PageLayoutKey`, a database's full page), or shown at rest inline;
 * - a menu opened with the mouse moving the focus back to its opener when
 *   it closes (a ring painted under the pointer), or one opened from the
 *   keyboard leaving the focus on the body.
 *
 * The tab order, the focus ring, the menus and Escape need a real browser
 * and keyboard: `integration-test/.../database-toolbar-keyboard.spec.ts`.
 */

const TABLE_TOOLS = [
  toolsWidgetPresets.filter,
  toolsWidgetPresets.sort,
  toolsWidgetPresets.search,
  toolsWidgetPresets.viewOptions,
  toolsWidgetPresets.tableAddRow,
];

/** A catalogue that answers every key with itself, bracketed. */
const keyStd = {
  getOptional: (id: unknown) =>
    id === TranslationProvider
      ? { t: (key: string) => `[${key}]`, language: 'xx' }
      : null,
} as unknown as BlockStdScope;

beforeAll(() => {
  if (!customElements.get('uni-lit')) coreEffects();
  if (!customElements.get('data-view-header-tools')) widgetPresetsEffects();
});

afterEach(() => {
  document.body.innerHTML = '';
  vi.restoreAllMocks();
});

function logicOf(options: { readonly?: boolean; pageLayout?: boolean }) {
  const pageLayout =
    options.pageLayout === undefined ? null : signal(options.pageLayout);
  const view = {
    id: 'view-1',
    type: 'table',
    readonly$: signal(options.readonly ?? false),
    rowsLocked$: signal(false),
    vars$: signal([]),
    traitGet: () => undefined,
    setSearch: vi.fn(),
    serviceGet: (key: unknown) => (key === PageLayoutKey ? pageLayout : null),
  };
  const addRow = vi.fn();
  const logic = {
    view,
    addRow,
    eventTrace: vi.fn(),
  } as unknown as DataViewUILogicBase;
  return { logic, addRow, pageLayout };
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

async function mountToolbar(
  logic: DataViewUILogicBase,
  std?: BlockStdScope
): Promise<HTMLElement> {
  const editor = document.createElement('div');
  if (std) {
    new ContextProvider(editor, {
      context: stdContext,
      initialValue: std,
    }).hostConnected();
  }
  const tools = document.createElement('data-view-header-tools');
  tools.dataViewLogic = logic;
  tools.toolsMap = { table: TABLE_TOOLS };
  editor.append(tools);
  document.body.append(editor);
  await settle();
  return tools.querySelector<HTMLElement>('.affine-database-toolbar')!;
}

/**
 * What the tab order holds, in DOM order. The search field is out of it
 * while folded: a stop clipped to nothing would hold an invisible focus.
 */
const tabStops = (toolbar: HTMLElement) =>
  [
    ...toolbar.querySelectorAll<HTMLElement>('[tabindex], button, input'),
  ].filter(element => element.tabIndex >= 0);

/** The accessible name the toolbar gives: `aria-label`, else the text. */
const nameOf = (element: HTMLElement) =>
  (element.getAttribute('aria-label') ?? element.textContent ?? '').trim();

describe('the view toolbar of a table', () => {
  it('puts every control in the tab order, in visual order, as a named button', async () => {
    const { logic } = logicOf({});
    const toolbar = await mountToolbar(logic);
    const stops = tabStops(toolbar);

    expect(stops.map(element => element.dataset.testid ?? '')).toEqual([
      'dv-tools-filter',
      'dv-tools-sort',
      'dv-tools-search',
      'dv-tools-view-options',
      '',
    ]);
    expect(
      stops.map(stop => [stop.getAttribute('role'), stop.tabIndex])
    ).toEqual(stops.map(() => ['button', 0]));
    expect(stops.map(nameOf)).toEqual([
      DATA_VIEW_FILTER[1],
      DATA_VIEW_SORT[1],
      DATA_VIEW_SEARCH[1],
      DATA_VIEW_VIEW_SETTINGS[1],
      DATA_VIEW_NEW_RECORD[1],
    ]);
    expect(
      toolbar
        .querySelector('.affine-database-search-input')
        ?.getAttribute('aria-label')
    ).toBe(DATA_VIEW_SEARCH[1]);
  });

  it('reads every name through the translation seam', async () => {
    const { logic } = logicOf({});
    const toolbar = await mountToolbar(logic, keyStd);
    const names = tabStops(toolbar).map(nameOf);

    expect(names).toEqual([
      `[${DATA_VIEW_FILTER[0]}]`,
      `[${DATA_VIEW_SORT[0]}]`,
      `[${DATA_VIEW_SEARCH[0]}]`,
      `[${DATA_VIEW_VIEW_SETTINGS[0]}]`,
      `[${DATA_VIEW_NEW_RECORD[0]}]`,
    ]);
    expect(
      [DATA_VIEW_SEARCH, DATA_VIEW_VIEW_SETTINGS].map(([key]) =>
        key.startsWith('com.labre.')
      )
    ).toEqual([true, true]);
  });

  it('activates a control with Enter and Space, and keeps them from the editor', async () => {
    const { logic, addRow } = logicOf({});
    const toolbar = await mountToolbar(logic);
    const editorKeydown = vi.fn();
    toolbar.parentElement!.addEventListener('keydown', editorKeydown);
    const newRecord = tabStops(toolbar).at(-1)!;
    const clicks: number[] = [];
    newRecord.addEventListener('click', event => clicks.push(event.detail));

    const keys = ['Enter', ' '];
    const prevented = keys.map(key => {
      const event = new KeyboardEvent('keydown', {
        key,
        bubbles: true,
        cancelable: true,
      });
      newRecord.dispatchEvent(event);
      return event.defaultPrevented;
    });

    expect(prevented).toEqual([true, true]);
    expect(addRow).toHaveBeenCalledTimes(keys.length);
    expect(clicks, 'a keyboard click, as a native button sends').toEqual(
      keys.map(() => 0)
    );
    expect(editorKeydown).not.toHaveBeenCalled();

    const other = new KeyboardEvent('keydown', { key: 'a', bubbles: true });
    newRecord.dispatchEvent(other);
    expect(editorKeydown).toHaveBeenCalledTimes(1);
  });

  it('offers only search on a read-only view', async () => {
    const { logic } = logicOf({ readonly: true });
    const toolbar = await mountToolbar(logic);
    const stops = tabStops(toolbar);

    expect(stops.map(element => element.dataset.testid)).toEqual([
      'dv-tools-search',
    ]);
  });
});

describe('the view toolbar at rest', () => {
  it('is shown where the views are the page, and follows the key', async () => {
    const { logic, pageLayout } = logicOf({ pageLayout: true });
    const toolbar = await mountToolbar(logic);
    expect(toolbar.classList.contains('show-toolbar')).toBe(true);

    pageLayout!.value = false;
    await settle();
    expect(toolbar.classList.contains('show-toolbar')).toBe(false);
  });

  it('waits for the pointer or the focus inline, without the key', async () => {
    const { logic } = logicOf({});
    const toolbar = await mountToolbar(logic);
    expect(toolbar.classList.contains('show-toolbar')).toBe(false);
  });
});

describe('the focus after a toolbar menu', () => {
  function control() {
    const button = document.createElement('div');
    button.tabIndex = 0;
    document.body.append(button);
    return button;
  }

  function clickOf(button: HTMLElement, detail: number) {
    let opener: HTMLElement | undefined;
    button.addEventListener(
      'click',
      event => (opener = keyboardOpener(event)),
      {
        once: true,
      }
    );
    button.dispatchEvent(new MouseEvent('click', { detail, bubbles: true }));
    return opener;
  }

  it('returns to the control that opened it from the keyboard', async () => {
    const button = control();
    const target = popupTargetReturningFocus(button, clickOf(button, 0));
    const end = target.popupStart();
    expect(button.classList.contains('active')).toBe(true);

    end();
    await Promise.resolve();
    expect(button.classList.contains('active')).toBe(false);
    expect(document.activeElement).toBe(button);
  });

  it('stays where it is after a mouse click', async () => {
    const button = control();
    expect(clickOf(button, 1)).toBeUndefined();
    const target = popupTargetReturningFocus(button, undefined);
    target.popupStart()();
    await Promise.resolve();
    expect(document.activeElement).not.toBe(button);
  });

  it('leaves the focus to whatever took it meanwhile', async () => {
    const button = control();
    const panel = control();
    const target = popupTargetReturningFocus(button, clickOf(button, 0));
    const end = target.popupStart();
    panel.focus();
    end();
    await Promise.resolve();
    expect(document.activeElement).toBe(panel);
  });
});
