import type { EdgelessRootBlockComponent } from '@labre/affine/blocks/root';
import { EmptyTool } from '@labre/affine/gfx/pointer';
import { COMMAND_USAGE_KEY } from '@labre/affine/shared/services';
import {
  type AnyCommandDescriptor,
  CommandExtension,
  SENIOR_MENU_CAP,
  SENIOR_MENU_RANKED_SLOTS,
} from '@labre/affine/std';
import {
  EdgelessCommandMenu,
  edgelessToolbarSlotsContext,
} from '@labre/affine/widgets/edgeless-toolbar';
import { ContextProvider } from '@lit/context';
import { Subject } from 'rxjs';
import { beforeEach, describe, expect, test } from 'vitest';

import { wait } from '../utils/common.js';
import { getDocRootBlock } from '../utils/edgeless.js';
import { setupEditor } from '../utils/setup.js';

/**
 * PF6's whole promise, end to end on a real editor: the moment a framework's
 * CATALOGUE outgrows the fourteen senior slots, its sub-menu collapses to the
 * thirteen ranked commands PLUS a permanent "More artefacts…" button — fourteen
 * buttons, exactly the cap — and that button opens the catalogue sidepanel on
 * that framework, with no code in the framework beyond declaring its commands.
 *
 * The overflow lives here under a seventeen-command test owner so the MECHANISM
 * is tested on its own terms, independent of any framework's inventory. BPMN's
 * descriptive-profile pack is now the first shipped framework to cross the cap
 * for real (25 commands), and `bpmn.spec.ts` checks the same behaviour on it —
 * this spec is what proved the button was waiting.
 */

const OWNER = 'test-overflow' as AnyCommandDescriptor['owner'];

const COMMANDS: AnyCommandDescriptor[] = Array.from({ length: 16 }, (_, i) => ({
  id: `test-overflow.cmd${i}`,
  owner: OWNER,
  kind: 'artefact',
  labelKey: `test.overflow.cmd${i}`,
  labelFallback: `Fake artefact ${i}`,
  category: i < 8 ? 'alpha' : 'beta',
  surfaces: ['senior-menu', 'catalogue'],
  order: i,
  scope: 'edgeless',
  defaultKeys: { mac: [], other: [] },
  availability: 'always',
  run: () => {},
}));

/**
 * The seventeenth, and the one that is not like the others: it declines
 * `'senior-menu'` the way `bpmn.exportXml` does — a board action, not something
 * you draw. It exists here to be INVOKED, hard, and still stay out of the row
 * (PO ruling of 2026-08-28).
 */
const BOARD_ACTION: AnyCommandDescriptor = {
  id: 'test-overflow.export',
  owner: OWNER,
  kind: 'action',
  labelKey: 'test.overflow.export',
  labelFallback: 'Export everything',
  category: 'beta',
  surfaces: ['catalogue'],
  order: 16,
  scope: 'edgeless',
  defaultKeys: { mac: [], other: [] },
  availability: 'always',
  run: () => {},
};

class TestOverflowMenu extends EdgelessCommandMenu {
  protected override owner = OWNER;

  override type = EmptyTool;
}

/**
 * The inner slide menu consumes the toolbar's resize slot through Lit context;
 * mounted standalone (the way this spec mounts the popover, without a real
 * toolbar around it) there is no provider, so the spec mounts the menu inside
 * a host that PROVIDES the context — a resize subject nobody ever fires,
 * because the popover under test does not resize.
 */
const mountWithToolbarContext = (menu: TestOverflowMenu) => {
  const hostElement = document.createElement('div');
  new ContextProvider(hostElement, {
    context: edgelessToolbarSlotsContext,
    initialValue: { resize: new Subject<{ w: number; h: number }>() },
  });
  hostElement.append(menu);
  document.body.append(hostElement);
  return hostElement;
};

if (!customElements.get('test-overflow-menu')) {
  customElements.define('test-overflow-menu', TestOverflowMenu);
}

describe('the senior sub-menu past fourteen commands', () => {
  let edgeless!: EdgelessRootBlockComponent;
  let menu!: TestOverflowMenu;

  beforeEach(async () => {
    // The usage measure persists across tests in this file, so start from
    // silence: the ranked thirteen must be the COLD-START thirteen unless a
    // test says otherwise.
    localStorage.removeItem(COMMAND_USAGE_KEY);
    const cleanup = await setupEditor('edgeless', [
      CommandExtension([...COMMANDS, BOARD_ACTION]),
    ]);
    edgeless = getDocRootBlock(window.doc, window.editor, 'edgeless');

    // The menu popover, mounted the way a senior button mounts it. The button
    // itself is hand-written chrome per framework and not what overflows —
    // the base class every framework menu extends is.
    menu = document.createElement('test-overflow-menu') as TestOverflowMenu;
    menu.edgeless = edgeless;
    const hostElement = mountWithToolbarContext(menu);
    await menu.updateComplete;
    await wait(0);

    return () => {
      hostElement.remove();
      cleanup();
    };
  });

  const buttons = () =>
    Array.from(
      menu.shadowRoot?.querySelectorAll('edgeless-tool-icon-button') ?? []
    );

  const catalogueWidget = () =>
    edgeless.widgetComponents['edgeless-artefact-catalogue-widget'];

  test('renders the thirteen ranked slots plus the More-artefacts button', () => {
    // 17 declared, 14 rendered: the ranked slots and one way to the rest —
    // and fourteen IS the cap, so the overflowed row is as wide as a row that
    // never overflowed.
    expect(buttons()).toHaveLength(SENIOR_MENU_RANKED_SLOTS + 1);
    expect(buttons()).toHaveLength(SENIOR_MENU_CAP);
  });

  /**
   * Cold start, spelled out: no usage recorded, so the row is the authored head
   * of the NOMINATED list — no reordering, no gaps, and the board action that
   * declines `'senior-menu'` nowhere near it.
   */
  test('with no usage the row is the authored head, in author order', () => {
    expect(menu.commands.map(command => command.id)).toEqual(
      COMMANDS.slice(0, SENIOR_MENU_RANKED_SLOTS).map(command => command.id)
    );
  });

  /**
   * The PO ruling of 2026-08-28, end to end. The board action is the most-used
   * and most-recent command this owner has by a mile, and it still never
   * reaches the row: the ranking pool is the `'senior-menu'` surface, which it
   * declined. This is `bpmn.exportXml` in miniature — "Export BPMN" in a row of
   * things you draw answers no question a user asked.
   */
  test('a heavily used board action never reaches the row', async () => {
    localStorage.setItem(
      COMMAND_USAGE_KEY,
      JSON.stringify({ [BOARD_ACTION.id]: { c: 9999, t: Date.now() } })
    );

    const fresh = document.createElement(
      'test-overflow-menu'
    ) as TestOverflowMenu;
    fresh.edgeless = edgeless;
    const host = mountWithToolbarContext(fresh);
    await fresh.updateComplete;
    await wait(0);

    try {
      const ids = fresh.commands.map(command => command.id);
      expect(ids).not.toContain(BOARD_ACTION.id);
      // …and its usage moved nothing else either: still the cold-start row.
      expect(ids).toEqual(
        COMMANDS.slice(0, SENIOR_MENU_RANKED_SLOTS).map(command => command.id)
      );
      expect(
        fresh.shadowRoot?.querySelectorAll('edgeless-tool-icon-button')
      ).toHaveLength(SENIOR_MENU_CAP);
    } finally {
      host.remove();
    }
  });

  test('the last button opens the catalogue on this very framework', async () => {
    const more = buttons().at(-1)!;
    (more as HTMLElement).click();
    await wait(0);
    const widget = catalogueWidget();
    await widget?.updateComplete;

    const panel = widget?.shadowRoot?.querySelector<HTMLElement>(
      '[data-testid="artefact-catalogue-panel"]'
    );
    expect(panel).not.toBeNull();
    expect(panel!.dataset.owner).toBe(OWNER);
    // 17: the sixteen nominated plus the board action that declined the
    // sub-menu — the panel is the surface where everything is reachable.
    expect(
      widget?.shadowRoot?.querySelectorAll(
        '[data-testid="artefact-catalogue-entry"]'
      ).length
    ).toBe(17);
  });

  test('a fourteen-command owner still shows everything and no button', async () => {
    // The same editor, a second menu for wardley (13 declared): under the cap
    // the sub-menu IS the declared surface, and no More button is rendered.
    const wardleyMenu = document.createElement(
      'test-overflow-menu'
    ) as TestOverflowMenu;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (wardleyMenu as any).owner = 'wardley';
    wardleyMenu.edgeless = edgeless;
    const wardleyHost = mountWithToolbarContext(wardleyMenu);
    await wardleyMenu.updateComplete;
    await wait(0);

    try {
      const count =
        wardleyMenu.shadowRoot?.querySelectorAll('edgeless-tool-icon-button')
          .length ?? 0;
      expect(count).toBe(wardleyMenu.commands.length);
      expect(wardleyMenu.commands.length).toBeLessThanOrEqual(14);
    } finally {
      wardleyHost.remove();
    }
  });
});
