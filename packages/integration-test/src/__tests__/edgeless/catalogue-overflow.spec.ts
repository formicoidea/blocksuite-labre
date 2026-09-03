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
 * for real (26 commands), and `bpmn.spec.ts` checks the same behaviour on it —
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

  /** Mount a second menu on the same editor, for another framework's owner. */
  const mountMenuFor = async (owner: string) => {
    const menu = document.createElement(
      'test-overflow-menu'
    ) as TestOverflowMenu;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (menu as any).owner = owner;
    menu.edgeless = edgeless;
    const host = mountWithToolbarContext(menu);
    await menu.updateComplete;
    await wait(0);
    const buttonCount =
      menu.shadowRoot?.querySelectorAll('edgeless-tool-icon-button').length ??
      0;
    return { menu, host, buttonCount };
  };

  test('an under-cap owner still shows everything and no button', async () => {
    // The below-cap path, and it USED to be demonstrated with wardley. It no
    // longer can be: `wardley.importOwm` and `wardley.exportOwm` took that
    // framework's catalogue to fifteen, and the trigger reads the CATALOGUE.
    // The context map is the nearest owner still under the cap (twelve), so the
    // property this test exists for is asserted where it still holds.
    const { menu, host, buttonCount } = await mountMenuFor('ddd-context-map');

    try {
      // No "More artefacts…" button: every button IS a command, so the two
      // counts agree exactly.
      expect(buttonCount).toBe(menu.commands.length);
      expect(menu.commands.length).toBeLessThanOrEqual(SENIOR_MENU_CAP);
    } finally {
      host.remove();
    }
  });

  test('wardley tipped past the cap when it learned to read a file', async () => {
    // The other side of the same rule, pinned because it is a PRODUCT change a
    // reader of the diff would not predict from "two new commands": Wardley's
    // catalogue reached fifteen with the OWM pair, sixteen with the SVG
    // fallback beside it and seventeen with Porter's forces, so its row is
    // now thirteen ranked buttons plus
    // the catalogue button rather than its whole nominated surface. Nothing is
    // unreachable — that is what the fourteenth button is for — but which
    // thirteen a cold user meets is now an arbitration rather than the author's
    // order in full.
    const { menu, host, buttonCount } = await mountMenuFor('wardley');

    try {
      expect(menu.commands).toHaveLength(SENIOR_MENU_RANKED_SLOTS);
      // Thirteen commands plus the one that opens the catalogue: an overflowed
      // row is exactly as wide as the cap.
      expect(buttonCount).toBe(SENIOR_MENU_CAP);
    } finally {
      host.remove();
    }
  });
});
