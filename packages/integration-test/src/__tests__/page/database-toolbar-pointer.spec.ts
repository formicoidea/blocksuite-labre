import {
  DatabaseBlockDataSource,
  DatabaseNewRowMenuExtension,
  type DatabaseNewRowMenuRequest,
} from '@labre/affine/blocks/database';
import type { DatabaseBlockModel, RootBlockModel } from '@labre/affine/model';
import type { EditorHost } from '@labre/std';
import { Text } from '@labre/store';
import { userEvent } from '@vitest/browser/context';
import { afterEach, describe, expect, test, vi } from 'vitest';

import { pointerMoveTo } from '../utils/pointer.js';
import { setupEditor } from '../utils/setup.js';
import { BASE_OUTCOMES } from './database-toolbar-pointer.base.js';

/**
 * **After any gesture made with the mouse on the view toolbar, the content
 * behaves exactly as on 4.0.0** (#678, the product owner's rule: the
 * toolbar takes the keys of its own model, and only in keyboard mode).
 *
 * Making the toolbar's controls focusable changed what a mouse press does:
 * a prevented mousedown left a number cell in editing to take the focus
 * back after Filter's menu opened, and the next letters erased its value;
 * Search opened with the mouse gave the focus back to its button on
 * Escape, which then swallowed the arrows meant for the selected cell.
 *
 * Each case starts from one state of the page (a number cell editing a
 * typed value, the title cell editing, the page title editing, a text
 * selection in a paragraph above the base, a selected cell), makes one
 * mouse gesture on one of the six controls (a click then typing, a click
 * then Escape then typing, a click then a click elsewhere then typing, a
 * double click then typing), and compares the outcome with what 4.0.0 did
 * (`database-toolbar-pointer.base.ts`, recorded on the base source): the
 * stored values (no cell erased), where the typed text went, the focus,
 * the cell selection and the editor's selections.
 */

const STARTS = [
  'numberEditing',
  'titleEditing',
  'pageTitle',
  'paragraphSelection',
  'cellSelected',
] as const;

const CONTROLS = [
  'filter',
  'sort',
  'search',
  'viewOptions',
  'newRecord',
  'newRecordMenu',
] as const;

const GESTURES = [
  'clickType',
  'clickEscape',
  'clickElsewhere',
  'doubleClick',
] as const;

type Start = (typeof STARTS)[number];
type Control = (typeof CONTROLS)[number];
type Gesture = (typeof GESTURES)[number];

const CASES = STARTS.flatMap(start =>
  CONTROLS.flatMap(control =>
    GESTURES.map(gesture => ({ start, control, gesture }))
  )
);

/** Where a control is, by what 4.0.0 already drew. */
const CONTROL_SELECTORS: Record<Control, string> = {
  filter: '[data-testid="dv-tools-filter"]',
  sort: '[data-testid="dv-tools-sort"]',
  search: '.affine-database-search-input-icon',
  viewOptions: '.affine-database-toolbar-item.more-action',
  newRecord: 'data-view-component-button.new-record',
  newRecordMenu: '[data-testid="database-new-record-more"]',
};

/** A loaded machine may take seconds to lay out a page. */
const PATIENCE_MS = 5000;
/** Frames given to a gesture's effects (a menu focuses on the next one). */
const SETTLE_FRAMES = 6;
/** The middle of a box, for the pointer. */
const CENTRE = 0.5;
/** At most this many popups to close before the next case. */
const STALE_POPUPS = 4;

const until = <T>(check: () => T) =>
  vi.waitFor(check, { timeout: PATIENCE_MS });

const frame = () =>
  new Promise<void>(resolve => requestAnimationFrame(() => resolve()));

const settle = () =>
  Array.from({ length: SETTLE_FRAMES }).reduce<Promise<void>>(
    async previous => {
      await previous;
      await frame();
    },
    Promise.resolve()
  );

let cleanup: (() => void) | undefined;
let pointerRest: HTMLElement | undefined;

const openMenus = () => [...document.querySelectorAll('affine-menu')];

afterEach(() => {
  // A popup left open keeps its Escape on the document (`openPopups`):
  // close it here, or the next case's Escape closes it instead.
  Array.from({ length: STALE_POPUPS }).forEach(() => {
    if (!openMenus().length) return;
    document.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Escape', cancelable: true })
    );
  });
  pointerRest?.remove();
  pointerRest = undefined;
  cleanup?.();
  cleanup = undefined;
});

async function mount() {
  const open = vi.fn<(request: DatabaseNewRowMenuRequest) => void>();
  cleanup = await setupEditor('page', [DatabaseNewRowMenuExtension({ open })]);
  const noteId = doc.addBlock('affine:note', {}, doc.root!.id);
  const paragraphId = doc.addBlock(
    'affine:paragraph',
    { text: new Text('Intro text') },
    noteId
  );
  const id = doc.addBlock(
    'affine:database',
    { title: new Text('Portfolio') },
    noteId
  );
  const model = doc.getModelById(id) as DatabaseBlockModel;
  const source = new DatabaseBlockDataSource(model);
  source.viewManager.viewAdd('table');
  const numberId = source.propertyAdd('end', { type: 'number' })!;
  ['Alpha', 'Beta'].forEach(name => {
    const rowId = source.rowAdd('end');
    (
      doc.getModelById(rowId) as unknown as { props: { text: Text } }
    ).props.text.insert(name, 0);
  });
  doc.resetHistory();
  const block = await until(() => {
    const element = window.editor.host!.querySelector<HTMLElement>(
      `affine-database[data-block-id="${id}"]`
    );
    expect(
      element?.querySelector(CONTROL_SELECTORS.newRecordMenu),
      'the toolbar, drawn'
    ).toBeTruthy();
    expect(
      element?.querySelector(
        `dv-table-view-cell-container[data-column-id="${numberId}"]`
      ),
      'the number cells, drawn'
    ).toBeTruthy();
    return element!;
  });
  pointerRest = document.createElement('div');
  pointerRest.id = 'dv-toolbar-pointer-elsewhere';
  Object.assign(pointerRest.style, {
    position: 'fixed',
    right: '0',
    bottom: '0',
    width: '24px',
    height: '24px',
    zIndex: '100000',
  });
  document.body.append(pointerRest);
  await pointerMoveTo('#dv-toolbar-pointer-elsewhere', CENTRE, CENTRE);
  return { open, block, model, source, numberId, paragraphId };
}

type Mounted = Awaited<ReturnType<typeof mount>>;

function cellOf(mounted: Mounted, columnId: string | 'title') {
  const rowId = mounted.model.children[0]!.id;
  const cells = [
    ...mounted.block.querySelectorAll<HTMLElement>(
      `dv-table-view-cell-container[data-row-id="${rowId}"]`
    ),
  ];
  return columnId === 'title'
    ? cells[0]!
    : cells.find(cell => cell.dataset.columnId === columnId)!;
}

function cellSelection() {
  const host = window.editor.host as EditorHost;
  const held = host.std.selection.value.find(
    selection => selection.type === 'database'
  ) as
    | {
        viewSelection?: {
          selectionType?: string;
          isEditing?: boolean;
          focus?: { rowIndex: number; columnIndex: number };
        };
      }
    | undefined;
  return held?.viewSelection;
}

async function editCell(cell: HTMLElement, typed: string) {
  await userEvent.click(cell);
  await until(() => expect(cellSelection()?.selectionType).toBe('area'));
  if (!cellSelection()?.isEditing) await userEvent.keyboard('{Enter}');
  await until(() => expect(cellSelection()?.isEditing).toBe(true));
  await settle();
  await userEvent.keyboard(typed);
  await settle();
}

const STARTERS: Record<Start, (mounted: Mounted) => Promise<void>> = {
  numberEditing: mounted => editCell(cellOf(mounted, mounted.numberId), '42'),
  titleEditing: mounted => editCell(cellOf(mounted, 'title'), 'X'),
  pageTitle: async () => {
    const title = window.editor.querySelector<
      HTMLElement & { inlineEditor: { focusEnd(): void } | null }
    >('doc-title')!;
    await until(() => expect(title.inlineEditor).toBeTruthy());
    title.inlineEditor!.focusEnd();
    await settle();
    await userEvent.keyboard('T');
    await settle();
  },
  paragraphSelection: async mounted => {
    const text = window.editor.host!.querySelector<HTMLElement>(
      `[data-block-id="${mounted.paragraphId}"] [contenteditable="true"]`
    )!;
    await userEvent.click(text);
    await userEvent.keyboard('{End}{Shift>}{Home}{/Shift}');
    await settle();
  },
  cellSelected: async mounted => {
    await userEvent.click(cellOf(mounted, mounted.numberId));
    await until(() => expect(cellSelection()?.selectionType).toBe('area'));
    if (cellSelection()?.isEditing) await userEvent.keyboard('{Escape}');
    await until(() => expect(cellSelection()?.isEditing).toBe(false));
    await settle();
  },
};

const GESTURE_RUNS: Record<Gesture, (control: HTMLElement) => Promise<void>> = {
  clickType: async control => {
    await userEvent.click(control);
    await settle();
    await userEvent.keyboard('st');
  },
  clickEscape: async control => {
    await userEvent.click(control);
    await settle();
    await userEvent.keyboard('{Escape}');
    await settle();
    await userEvent.keyboard('q');
  },
  clickElsewhere: async control => {
    await userEvent.click(control);
    await settle();
    await userEvent.click(pointerRest!);
    await settle();
    await userEvent.keyboard('q');
  },
  doubleClick: async control => {
    await userEvent.dblClick(control);
    await settle();
    await userEvent.keyboard('q');
  },
};

/** Where the focus is, named by the part of the page that holds it. */
function focusName(toolbar: HTMLElement) {
  const active = document.activeElement;
  if (!active || active === document.body) return 'body';
  if (active.closest('affine-menu')) return 'menu';
  if (toolbar.contains(active)) return 'toolbar';
  if (active.closest('doc-title')) return 'page-title';
  if (active.closest('dv-table-view-cell-container')) return 'cell';
  if (active.closest('affine-paragraph')) return 'paragraph';
  return active.tagName.toLowerCase();
}

function outcome(mounted: Mounted) {
  const toolbar = mounted.block.querySelector<HTMLElement>(
    '.affine-database-toolbar'
  )!;
  const rows = mounted.model.children.map(row => row.id);
  const held = cellSelection();
  const text = (id: string) =>
    (
      doc.getModelById(id) as unknown as { props: { text: Text } }
    ).props.text.toString();
  return {
    rows: rows.length,
    numbers: rows.map(
      rowId => mounted.source.cellValueGet(rowId, mounted.numberId) ?? null
    ),
    titles: rows.map(text),
    paragraph: text(mounted.paragraphId),
    pageTitle: (doc.root as RootBlockModel).props.title.toString(),
    menus: openMenus().length,
    menuText: openMenus()
      .map(menu =>
        [...menu.querySelectorAll('input')].map(input => input.value).join('|')
      )
      .join('/'),
    search:
      toolbar.querySelector<HTMLInputElement>('.affine-database-search-input')
        ?.value ?? null,
    focus: focusName(toolbar),
    cell: held
      ? `${held.selectionType}:${held.focus?.rowIndex},${held.focus?.columnIndex},${held.isEditing}`
      : null,
    selections: (window.editor.host as EditorHost).std.selection.value
      .map(selection => selection.type)
      .sort()
      .join('+'),
    hostCalls: mounted.open.mock.calls.length,
  };
}

/**
 * Where the branch differs from 4.0.0 on purpose, with the reason. Each one
 * is a defect of 4.0.0 that #678 fixes, never a convenience.
 */
const DELIBERATE: Record<
  string,
  { outcome: Record<string, unknown>; reason: string }
> = {
  'pageTitle/search/clickEscape': {
    outcome: { focus: 'body', search: '' },
    reason:
      'The folded search field is inert (review of #678, B2). In 4.0.0 the ' +
      'focus stayed in the folded field after Escape, and the next letter ' +
      'filtered the rows with the field still folded: an active, invisible ' +
      'search. Here the letter is typed nowhere.',
  },
};

describe('a mouse gesture on the view toolbar, compared with 4.0.0', () => {
  test.each(CASES)(
    '$start, $control, $gesture',
    async ({ start, control, gesture }) => {
      const mounted = await mount();
      await STARTERS[start](mounted);
      const element = mounted.block.querySelector<HTMLElement>(
        CONTROL_SELECTORS[control]
      )!;
      await GESTURE_RUNS[gesture](element);
      await settle();

      const key = `${start}/${control}/${gesture}`;
      const seen = outcome(mounted);
      const recorded = BASE_OUTCOMES[key];
      if (recorded === undefined) {
        console.log(`RECORD ${key} ${JSON.stringify(seen)}`);
        return;
      }
      expect(seen).toEqual({
        ...(recorded as object),
        ...DELIBERATE[key]?.outcome,
      });
    }
  );

  test('every case has its outcome recorded on 4.0.0', () => {
    expect(
      CASES.map(
        ({ start, control, gesture }) => `${start}/${control}/${gesture}`
      ).filter(key => BASE_OUTCOMES[key] === undefined)
    ).toEqual([]);
  });
});
