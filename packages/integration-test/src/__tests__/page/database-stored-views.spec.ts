import type { DatabaseBlockComponent } from '@labre/affine/blocks/database';
import { DatabaseBlockDataSource } from '@labre/affine/blocks/database';
import type { BlockFlags } from '@labre/affine/flags';
import type { DatabaseBlockModel } from '@labre/affine/model';
import { Text } from '@labre/store';
import { afterEach, describe, expect, test } from 'vitest';

import { wait } from '../utils/common.js';
import { setupEditor } from '../utils/setup.js';

/**
 * **A stored database is DRAWN whatever its views and the flags say**
 * (ADR 0035 §5 and §6, issues B3 and B4).
 *
 * The unit guards pin the pieces: `unknown-view-fallback.unit.spec.ts`
 * (`database/block`) that an unknown mode resolves to the table preset and
 * writes nothing, `database-render-gating.unit.spec.ts` (`affine/all`) that
 * the block view stays registered with `{ database: false, 'data-view': false }`.
 * Neither renders the block in an editor. This one does: a database written
 * the way a 0.48 client wrote it (a table, a calendar) plus two views no
 * preset here knows (`timeline`, an invented mode) is mounted in a real page
 * editor, each view is opened in turn and must paint (the calendar as a
 * calendar, the other two as a table tagged "Shown as a table"), and the
 * stored `props.views` must come out deep-equal. With both flags off the
 * same document still paints, minus the views bar's "+".
 */

const TIMELINE = {
  id: 'v-timeline',
  name: 'Roadmap',
  mode: 'timeline',
  range: { start: 'start', end: 'end' },
};
const INVENTED = { id: 'v-invented', name: 'Later', mode: 'swimlane-2031' };

function writeDatabase() {
  const note = doc.addBlock('affine:note', {}, doc.root!.id);
  const id = doc.addBlock('affine:database', { title: new Text('Plan') }, note);
  const model = doc.getModelById(id) as DatabaseBlockModel;
  const writer = new DatabaseBlockDataSource(model);
  writer.rowAdd('end');
  writer.rowAdd('end');
  const tableId = writer.viewManager.viewAdd('table');
  const calendarId = writer.viewManager.viewAdd('calendar');
  doc.updateBlock(model, {
    views: [...model.props.views, TIMELINE, INVENTED] as never,
  });
  writer.dispose();
  return { id, model, tableId, calendarId };
}

const snapshot = (model: DatabaseBlockModel) =>
  JSON.parse(JSON.stringify(model.props.views)) as unknown;

async function mountDatabase(flags?: BlockFlags) {
  const cleanup = await setupEditor('page', [], flags ? { flags } : {});
  const written = writeDatabase();
  await wait(150);
  const block = editor.host?.querySelector<DatabaseBlockComponent>(
    `affine-database[data-block-id="${written.id}"]`
  );
  return { cleanup, block: block ?? null, ...written };
}

async function open(block: DatabaseBlockComponent, viewId: string) {
  block.dataSource.viewManager.setCurrentView(viewId);
  await wait(100);
}

function expectEveryViewPaints(
  block: DatabaseBlockComponent,
  ids: { tableId: string; calendarId: string }
) {
  return async () => {
    for (const [viewId, tag, shownAs] of [
      [ids.tableId, 'dv-table-view-ui', false],
      [ids.calendarId, 'affine-data-view-calendar', false],
      [TIMELINE.id, 'dv-table-view-ui', true],
      [INVENTED.id, 'dv-table-view-ui', true],
    ] as const) {
      await open(block, viewId);
      expect(block.querySelector(tag), `${viewId} paints ${tag}`).not.toBe(
        null
      );
      const hint = block.querySelector(
        '[data-testid="database-view-shown-as"]'
      );
      if (shownAs) {
        expect(hint?.textContent?.trim()).toBe('Shown as a table');
      }
    }
    // Two views fall back, so two tabs carry the hint.
    expect(
      block.querySelectorAll('[data-testid="database-view-shown-as"]').length
    ).toBe(2);
  };
}

describe('stored database views, default flags', () => {
  let cleanup: (() => void) | undefined;
  afterEach(() => {
    cleanup?.();
    cleanup = undefined;
  });

  test('every view paints and nothing is written', async () => {
    const mounted = await mountDatabase();
    cleanup = mounted.cleanup;
    expect(mounted.block).not.toBe(null);
    const before = snapshot(mounted.model);

    await expectEveryViewPaints(mounted.block!, mounted)();

    expect(snapshot(mounted.model)).toEqual(before);
    expect(
      mounted.block!.querySelector('[data-testid="database-add-view-button"]')
    ).not.toBe(null);
  });
});

describe('stored database views, database and data-view off', () => {
  let cleanup: (() => void) | undefined;
  afterEach(() => {
    cleanup?.();
    cleanup = undefined;
  });

  test('the database still paints, without "+ view"', async () => {
    const mounted = await mountDatabase({
      database: false,
      'data-view': false,
    });
    cleanup = mounted.cleanup;
    expect(mounted.block).not.toBe(null);
    const before = snapshot(mounted.model);

    await expectEveryViewPaints(mounted.block!, mounted)();

    expect(snapshot(mounted.model)).toEqual(before);
    expect(
      mounted.block!.querySelector('[data-testid="database-add-view-button"]')
    ).toBe(null);
  });
});
