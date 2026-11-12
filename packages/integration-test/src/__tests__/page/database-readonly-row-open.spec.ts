import {
  addProperty,
  type DatabaseBlockComponent,
  databaseBlockProperties,
  DatabaseBlockDataSource,
  DatabaseDataSourceProvider,
  DatabaseOpenRowExtension,
  type DatabaseOpenRowRequest,
  updateCell,
} from '@labre/affine/blocks/database';
import type { DatabaseBlockModel } from '@labre/affine/model';
import { TelemetryExtension } from '@labre/affine/shared/services';
import { type ExtensionType, Text } from '@labre/store';
import { afterEach, describe, expect, test, vi } from 'vitest';

import { wait } from '../utils/common.js';
import { setupEditor } from '../utils/setup.js';

/**
 * A read-only database still opens its rows when they are pages and the host
 * opens them (the Labre app's public share of a base, a base shared for
 * reading, a base opened from the trash). The phone table always drew its
 * "Open" chip; the desktop table drew its open button only on a writable
 * title column, and a desktop kanban card attached no click at all when its
 * view was read-only, so a reader could open nothing.
 *
 * What it would have caught:
 * - a read-only desktop table without its open button, or a read-only
 *   desktop kanban card that a click does not open, when the source says its
 *   rows are documents (`rowsAreDocuments`) and an opener is registered
 *   (`DatabaseOpenRowExtension`);
 * - the opener called with another row, or anything written into the store
 *   by opening a row of a read-only page;
 * - the open button or the card click offered on a read-only view without an
 *   opener (the library's own detail panel stays an editing tool there), or
 *   over rows that are blocks;
 * - the row menu ("...") or any editing chrome coming back with the open
 *   button: only opening is kept;
 * - a read-only kanban card that opens only from its margin: every kanban
 *   cell (the title, each property) stops the click it receives, so the
 *   card listens in the capture phase, and a click is made here on the
 *   cells a reader aims at (the title at its centre, a property value);
 * - a click on a link inside a card (a URL cell) opening the row instead of
 *   being left to the link.
 */

/** A host source whose rows are documents (the Labre app's bases). */
class DocumentRowsSource extends DatabaseBlockDataSource {
  override get rowsAreDocuments() {
    return true;
  }
}

const documentRows: ExtensionType = {
  setup: di => {
    di.override(DatabaseDataSourceProvider, () => ({
      createDataSource: (model, init) => new DocumentRowsSource(model, init),
    }));
  },
};

const SETTLE_MS = 100;
const ESTIMATE = 3;
const SITE = 'https://example.com/';
const SETTLE_FRAMES = 4;

const settle = async () => {
  await wait(SETTLE_MS);
  for (let i = 0; i < SETTLE_FRAMES; i++) {
    await new Promise(resolve => requestAnimationFrame(resolve));
  }
};

let cleanup: (() => void) | undefined;

/**
 * Every row-open gesture leaves `DatabaseRowOpened` from the block, whatever
 * then opens the row: the observable proof that a click asked to open.
 */
let rowsOpened: unknown[] = [];
const telemetry = TelemetryExtension({
  track: (name, props) => {
    if (name === 'DatabaseRowOpened') rowsOpened.push(props);
  },
});

afterEach(() => {
  rowsOpened = [];
  cleanup?.();
  cleanup = undefined;
});

const MODES = ['table', 'kanban'] as const;
type Mode = (typeof MODES)[number];

/**
 * A database of two rows on a page made read-only, then shown as `mode`: a
 * reader's page is read-only before anything is drawn (a card reads it when
 * it connects), so the view is switched to only once the page is read-only.
 * The title column is listed, or the table draws no title and no open button.
 */
async function readonlyDatabase(mode: Mode, hosted: boolean) {
  const doc = window.doc;
  const noteId = doc.addBlock('affine:note', {}, doc.root!.id);
  const databaseId = doc.addBlock(
    'affine:database',
    {
      columns: [],
      title: new Text('Plan'),
      ...(hosted ? { externalSourceId: 'host:plan' } : {}),
    },
    noteId
  );
  const model = doc.getModelById(databaseId) as DatabaseBlockModel;
  const status = addProperty(
    model,
    'end',
    databaseBlockProperties.selectColumnConfig.create('Status', {
      options: [{ id: 'todo', value: 'Todo', color: 'var(--affine-tag-blue)' }],
    })
  );
  const estimate = addProperty(
    model,
    'end',
    databaseBlockProperties.numberColumnConfig.create('Estimate')
  );
  const site = addProperty(
    model,
    'end',
    databaseBlockProperties.linkColumnConfig.create('Site')
  );
  const rowIds = ['Alpha', 'Bravo'].map(title =>
    doc.addBlock('affine:paragraph', { text: new Text(title) }, databaseId)
  );
  rowIds.forEach(rowId => {
    updateCell(model, rowId, { columnId: status, value: 'todo' });
    updateCell(model, rowId, { columnId: estimate, value: ESTIMATE });
    updateCell(model, rowId, { columnId: site, value: SITE });
  });
  const columns = [
    { id: 'title', hide: false },
    ...model.props.columns.map(c => ({ id: c.id, hide: false })),
  ];
  const filter = { type: 'group', op: 'and', conditions: [] };
  doc.updateBlock(model, {
    views: [
      { id: 'parking', name: 'Gallery', mode: 'gallery', columns, filter },
      {
        id: `${mode}-1`,
        name: mode,
        mode,
        columns,
        filter,
        header: { titleColumn: 'title', iconColumn: 'type' },
        ...(mode === 'kanban'
          ? {
              groupBy: { type: 'groupBy', columnId: status, name: 'select' },
              groupProperties: [],
            }
          : {}),
      },
    ],
  } as never);
  await settle();
  doc.readonly = true;
  const block = document.querySelector<DatabaseBlockComponent>(
    `affine-database[data-block-id="${model.id}"]`
  )!;
  // The current view is the reader's own, never written to the document.
  block.dataSource.viewManager.setCurrentView(`${mode}-1`);
  await settle();
  return { doc, model, rowIds, block, estimate };
}

/** What opens row `rowId` in `mode`: the table's button, or the card. */
const opener = (block: Element, mode: Mode, rowId: string) =>
  mode === 'table'
    ? block.querySelector<HTMLElement>(
        `data-view-table-row[data-row-id="${rowId}"] [data-testid="dv-row-open"]`
      )
    : block.querySelector<HTMLElement>(
        `affine-data-view-kanban-card[data-card-id="${rowId}"] .card-header-title affine-data-view-kanban-cell`
      );

const cardOf = (block: Element, rowId: string) =>
  block.querySelector<HTMLElement>(
    `affine-data-view-kanban-card[data-card-id="${rowId}"]`
  )!;

/** The element a reader's click at the centre of `element` lands on. */
const hitAtCentre = (element: Element) => {
  element.scrollIntoView({ block: 'center' });
  const box = element.getBoundingClientRect();
  return document.elementFromPoint(
    box.left + box.width / 2,
    box.top + box.height / 2
  ) as HTMLElement;
};

describe('opening a row of a read-only database', () => {
  test.each(MODES)(
    'a %s opens a document row through the host, and writes nothing',
    async mode => {
      const open = vi.fn<(request: DatabaseOpenRowRequest) => void>();
      cleanup = await setupEditor('page', [
        documentRows,
        DatabaseOpenRowExtension({ open }),
      ]);
      const { doc, rowIds, block, model } = await readonlyDatabase(mode, true);
      expect(doc.readonly).toBe(true);

      const updates: Uint8Array[] = [];
      const record = (update: Uint8Array) => updates.push(update);
      doc.doc.spaceDoc.on('update', record);
      try {
        const target = opener(block, mode, rowIds[1]!);
        expect(target, `${mode} offers to open the row`).not.toBeNull();
        target!.click();
        await settle();
      } finally {
        doc.doc.spaceDoc.off('update', record);
      }

      expect(open).toHaveBeenCalledTimes(1);
      expect(open).toHaveBeenCalledWith(
        expect.objectContaining({
          docId: rowIds[1],
          viewId: `${mode}-1`,
          blockId: model.id,
        })
      );
      expect(updates).toEqual([]);
      // Only opening comes back: the row and card menus stay hidden.
      expect(
        block.querySelector('.row-ops .row-op:not([data-testid])')
      ).toBeNull();
      expect(
        block.querySelector('affine-data-view-kanban-card .card-ops')
      ).toBeNull();
    }
  );

  /**
   * The table has nothing to click; the kanban card is clicked and nothing is
   * asked to open (no `DatabaseRowOpened`, no host call).
   */
  const expectNothingOpens = async (
    block: Element,
    mode: Mode,
    rowId: string,
    open?: ReturnType<typeof vi.fn>
  ) => {
    const target = opener(block, mode, rowId);
    if (mode === 'table') {
      expect(target, 'no open button').toBeNull();
      return;
    }
    expect(target, 'the card is drawn').not.toBeNull();
    target!.click();
    await settle();
    expect(rowsOpened).toEqual([]);
    if (open) expect(open).not.toHaveBeenCalled();
  };

  test.each(MODES)(
    'a read-only %s of document rows without an opener stays closed',
    async mode => {
      cleanup = await setupEditor('page', [documentRows, telemetry]);
      const { rowIds, block } = await readonlyDatabase(mode, true);
      await expectNothingOpens(block, mode, rowIds[0]!);
    }
  );

  test.each(MODES)(
    'a read-only %s of block rows stays closed, even with an opener',
    async mode => {
      const open = vi.fn<(request: DatabaseOpenRowRequest) => void>();
      cleanup = await setupEditor('page', [
        DatabaseOpenRowExtension({ open }),
        telemetry,
      ]);
      const { rowIds, block } = await readonlyDatabase(mode, false);
      await expectNothingOpens(block, mode, rowIds[0]!, open);
    }
  );

  test('a read-only kanban card opens from its title and its values, not from a link', async () => {
    const open = vi.fn<(request: DatabaseOpenRowRequest) => void>();
    cleanup = await setupEditor('page', [
      documentRows,
      DatabaseOpenRowExtension({ open }),
    ]);
    const { rowIds, block, estimate } = await readonlyDatabase('kanban', true);
    const card = cardOf(block, rowIds[0]!);
    // The link opens in a new tab: keep the page where it is.
    const stay = (e: Event) => e.preventDefault();
    window.addEventListener('click', stay);
    try {
      const title = card.querySelector('.card-header-title')!;
      const onTitle = hitAtCentre(title);
      expect(title.contains(onTitle), 'the click lands on the title').toBe(
        true
      );
      onTitle.click();
      await settle();
      expect(open).toHaveBeenCalledTimes(1);

      card
        .querySelector<HTMLElement>(
          `affine-data-view-kanban-cell[data-column-id="${estimate}"]`
        )!
        .click();
      await settle();
      expect(open).toHaveBeenCalledTimes(2);
      expect(open).toHaveBeenLastCalledWith(
        expect.objectContaining({ docId: rowIds[0] })
      );

      const link = card.querySelector<HTMLAnchorElement>(
        '[data-testid="property-link-a"]'
      );
      expect(link?.href).toBe(SITE);
      link!.click();
      await settle();
      expect(open).toHaveBeenCalledTimes(2);
    } finally {
      window.removeEventListener('click', stay);
    }
  });
});
