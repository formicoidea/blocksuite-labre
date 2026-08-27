import type { EdgelessRootBlockComponent } from '@labre/affine/blocks/root';
import { EmptyTool } from '@labre/affine/gfx/pointer';
import {
  type AnyCommandDescriptor,
  CommandExtension,
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
 * seven ranked commands PLUS a permanent "More artefacts…" button, and that
 * button opens the catalogue sidepanel on that framework — with no code in the
 * framework beyond declaring its commands.
 *
 * The overflow lives here under a sixteen-command test owner so the MECHANISM
 * is tested on its own terms, independent of any framework's inventory. BPMN's
 * descriptive-profile pack is now the first shipped framework to cross the cap
 * for real (24 commands), and `bpmn.spec.ts` checks the same behaviour on it —
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
    const cleanup = await setupEditor('edgeless', [CommandExtension(COMMANDS)]);
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

  test('renders the seven ranked slots plus the More-artefacts button', () => {
    // 16 declared, 8 rendered: the ranked slots and one way to the rest.
    expect(buttons()).toHaveLength(SENIOR_MENU_RANKED_SLOTS + 1);
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
    expect(
      widget?.shadowRoot?.querySelectorAll(
        '[data-testid="artefact-catalogue-entry"]'
      ).length
    ).toBe(16);
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
