import { DatabaseBlockDataSource } from '@labre/affine/blocks/database';
import { getViewActions, runViewAction } from '@labre/affine/host-panels';
import type { DatabaseBlockModel } from '@labre/affine/model';
import type { BlockStdScope } from '@labre/std';
import type { ExtensionType, Store } from '@labre/store';
import { Text } from '@labre/store';
import { afterEach, beforeEach, describe, expect, test } from 'vitest';

import { wait } from '../utils/common.js';
import { setupEditor } from '../utils/setup.js';

/**
 * **The full page's "This view" is the view settings, opened from a host's
 * menu** (labre PRD REQ-DB-10, ADR 0035 amendment of 2026-10-14).
 *
 * The Labre app lists the page's `'view-menu'` commands in its header ⋯ and
 * runs one with `runViewAction`. This spec mounts `<affine-database-page>`
 * with the suite's page extensions and checks, in a real editor, that:
 * - the page lists the settings its view offers (the commands exist only
 *   on the full page, `view-menu-commands.unit.spec.ts`);
 * - running "Layout" opens the very menu the view settings' "Layout" entry
 *   opens, and a pick there changes the view's layout;
 * - running "Properties" opens the view's properties list (no host panel
 *   here, so the data-view's own popover);
 * - running "Conditional colors" opens the rule editor (ADR 0036), whose
 *   "Add a color rule" goes through the view filter's own condition picker
 *   and stores a rule on the view.
 */

type DatabasePage = HTMLElement & {
  store: Store;
  extensions: ExtensionType[];
  hostBlockId: string;
  std: BlockStdScope | undefined;
};

let hostId = '';
let page: DatabasePage;
let cleanup: () => void;

beforeEach(async () => {
  cleanup = await setupEditor('page');
  const noteId = doc.addBlock('affine:note', {}, doc.root!.id);
  hostId = doc.addBlock(
    'affine:database',
    { title: new Text('Portfolio') },
    noteId
  );
  const model = doc.getModelById(hostId) as DatabaseBlockModel;
  const writer = new DatabaseBlockDataSource(model);
  writer.viewManager.viewAdd('table');
  writer.rowAdd('end');
  writer.dispose();

  const app = window.editor.parentElement!;
  const extensions = window.editor.pageSpecs;
  window.editor.remove();
  page = document.createElement('affine-database-page') as DatabasePage;
  page.style.height = '600px';
  page.store = doc;
  page.extensions = extensions;
  page.hostBlockId = hostId;
  app.append(page);
  await wait(200);
  return () => {
    page.remove();
    cleanup();
  };
});

afterEach(() => {
  document.body.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
});

// Sections every page editor lists whatever its view: not the view's own
// settings, which is what this suite checks.
const EDITOR_WIDE_SECTIONS = new Set(['export', 'display', 'text']);

const menuButtons = () => [
  ...document.querySelectorAll<HTMLElement>('affine-menu-button'),
];

describe('the full page of a database, "This view"', () => {
  test('lists the view settings the view offers, on the page only', () => {
    // The page's own exports (`page.export.*`, section `'export'`) are listed
    // in every page editor, this one included, and so are the special-character
    // actions (sections `display` and `text`): none of them is a view setting.
    const ids = getViewActions(page.std!, 'page')
      .filter(action => !EDITOR_WIDE_SECTIONS.has(action.section))
      .map(action => action.id);
    expect(ids).toEqual([
      'database.view.layout',
      'database.view.group',
      'database.view.properties',
      'database.view.color-rules',
    ]);
    // Rows of a block-backed table are not pages: no "Open pages in"; no
    // picker in the suite: no import, no template.
    expect(ids).not.toContain('database.view.open-in');
  });

  test('"Layout" opens the layout menu, and a pick changes the layout', async () => {
    await runViewAction(page.std!, 'database.view.layout');
    await wait(150);
    const kanban = menuButtons().find(button =>
      button.textContent?.includes('Kanban')
    );
    expect(kanban, 'the layout menu, with its presets').toBeTruthy();
    kanban!.querySelector<HTMLElement>('.affine-menu-button')!.click();
    await wait(150);
    const model = doc.getModelById(hostId) as DatabaseBlockModel;
    expect(model.props.views[0]?.mode).toBe('kanban');
  });

  test('"Properties" opens the view\'s properties list', async () => {
    await runViewAction(page.std!, 'database.view.properties');
    await wait(150);
    expect(document.body.textContent).toContain('Properties');
    expect(
      document.querySelector('affine-menu'),
      'the properties popover'
    ).not.toBe(null);
  });

  test('"Conditional colors" opens the rules, and adding one stores it', async () => {
    await runViewAction(page.std!, 'database.view.color-rules');
    await wait(150);
    const add = document.querySelector<HTMLElement>(
      '[data-testid="dv-color-rule-add"]'
    );
    expect(add, 'the rules menu, with its add entry').not.toBe(null);
    add!.click();
    await wait(150);
    // The view filter's "New filter" menu: its first entry is a property.
    menuButtons()[0]!.click();
    await wait(150);
    const model = doc.getModelById(hostId) as DatabaseBlockModel;
    const rules = model.props.views[0]?.colorRules;
    expect(rules).toHaveLength(1);
    expect(rules?.[0]?.filter.conditions).toHaveLength(1);
    expect(
      document.querySelector('[data-testid="dv-color-rule-conditions"]'),
      'the rule menu, with the filter editor'
    ).not.toBe(null);
  });
});
