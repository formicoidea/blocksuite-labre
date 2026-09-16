import { ArtefactCatalogueProvider } from '@labre/affine-shared/services';
import type {
  AnyCommandDescriptor,
  BlockComponent,
  BlockStdScope,
  CommandOwner,
} from '@labre/std';
import type { ToolType } from '@labre/std/gfx';
import { beforeAll, describe, expect, test, vi } from 'vitest';

import { EdgelessCommandMenu } from '../menu/command-menu.js';

/**
 * Keyboard cycling of an open framework senior menu: Shift+S and the arrows
 * move a HIGHLIGHT along the row, Enter runs what it points at.
 *
 * The keystrokes themselves are bound in `@labre/affine-block-root`
 * (`edgeless-keyboard.ts`) and need a whole editor to press; what lives here is
 * the menu's half of the contract — where the highlight lands, what it marks,
 * and what Enter runs — which needs no editor at all.
 */

class TestCommandMenu extends EdgelessCommandMenu {
  // Only ever read through the mixin's `active` getter, which compares it to
  // the armed tool; this menu is never armed as a tool in these tests.
  override type = 'test-senior-menu' as unknown as ToolType;

  protected override owner: CommandOwner = 'wardley';
}

beforeAll(() => {
  if (!customElements.get('test-command-menu')) {
    customElements.define('test-command-menu', TestCommandMenu);
  }
});

const command = (id: string, run = () => {}): AnyCommandDescriptor =>
  ({
    id,
    owner: 'wardley',
    kind: 'artefact',
    labelKey: `com.labre.commands.${id}`,
    labelFallback: id,
    surfaces: ['senior-menu'],
    scope: 'edgeless',
    defaultKeys: { mac: [], other: [] },
    run,
  }) as unknown as AnyCommandDescriptor;

/**
 * Enough of a `std` for the menu to render: it resolves no translation, no
 * icon table and no usage measure, and answers the catalogue seam only when a
 * test hands one in.
 */
const stubEdgeless = (catalogue?: { open: (owner: string) => void }) => {
  const std = {
    get: () => ({ tool: { currentToolOption$: { value: null } } }),
    getOptional: (identifier: unknown) =>
      identifier === ArtefactCatalogueProvider ? catalogue : undefined,
    provider: { getAll: () => new Map() },
  };
  return { std } as unknown as BlockComponent & { std: BlockStdScope };
};

const mount = async (
  commands: AnyCommandDescriptor[],
  options: {
    overflow?: boolean;
    catalogue?: { open: (owner: string) => void };
  } = {}
) => {
  const menu = new TestCommandMenu();
  menu.edgeless = stubEdgeless(options.catalogue);
  // The real `_selection` reads the command registry through the DI container;
  // what the cycling cares about is only its shape.
  Object.defineProperty(menu, '_selection', {
    configurable: true,
    get: () => ({ commands, overflow: options.overflow ?? false }),
  });
  document.body.append(menu);
  await menu.updateComplete;
  return menu;
};

const marks = (menu: EdgelessCommandMenu) =>
  [...menu.shadowRoot!.querySelectorAll('edgeless-tool-icon-button')].map(
    button => (button as unknown as { active: boolean }).active === true
  );

describe('EdgelessCommandMenu keyboard cycling', () => {
  test('a menu opens with nothing highlighted', async () => {
    const menu = await mount([command('a'), command('b')]);
    expect(marks(menu)).toEqual([false, false]);
  });

  test('a backwards step from nothing lands on the last command', async () => {
    const menu = await mount([command('a'), command('b'), command('c')]);

    menu.cycle(-1);
    await menu.updateComplete;

    expect(marks(menu)).toEqual([false, false, true]);
  });

  test('a forwards step from nothing lands on the first, and wraps past the last', async () => {
    const menu = await mount([command('a'), command('b')]);

    menu.cycle(1);
    await menu.updateComplete;
    expect(marks(menu)).toEqual([true, false]);

    menu.cycle(1);
    menu.cycle(1);
    await menu.updateComplete;
    expect(marks(menu)).toEqual([true, false]);
  });

  test('backwards wraps past the first', async () => {
    const menu = await mount([command('a'), command('b')]);

    menu.cycle(1);
    menu.cycle(-1);
    await menu.updateComplete;

    expect(marks(menu)).toEqual([false, true]);
  });

  test('the overflow button is one more slot', async () => {
    const open = vi.fn();
    const menu = await mount([command('a'), command('b')], {
      overflow: true,
      catalogue: { open },
    });

    menu.cycle(-1);
    await menu.updateComplete;

    // Three buttons on screen, and the highlight is on the trailing one.
    expect(marks(menu)).toEqual([false, false, true]);
    expect(menu.activate()).toBe(true);
    expect(open).toHaveBeenCalledWith('wardley');
  });

  test('an overflow the host switched off is not a slot', async () => {
    const menu = await mount([command('a'), command('b')], { overflow: true });

    menu.cycle(-1);
    await menu.updateComplete;

    expect(marks(menu)).toEqual([false, true]);
  });

  test('Enter runs the highlighted command, and nothing when none is', async () => {
    const run = vi.fn();
    const menu = await mount([command('a'), command('b', run)]);

    expect(menu.activate()).toBe(false);
    expect(run).not.toHaveBeenCalled();

    menu.cycle(-1);
    expect(menu.activate()).toBe(true);
    expect(run).toHaveBeenCalledTimes(1);
  });

  test('an empty menu has nothing to highlight', async () => {
    const menu = await mount([]);

    menu.cycle(-1);
    menu.cycle(1);
    await menu.updateComplete;

    expect(marks(menu)).toEqual([]);
    expect(menu.activate()).toBe(false);
  });
});
