/**
 * The gaps the product owner found with the keyboard in the 4.1.0 canvas
 * toolbar (ADR 0054, amendment of 2026-11-22), each held where it was seen,
 * with real Playwright keys and mouse on one mounted editor:
 *
 * 1. the templates panel's cards could not be reached: Tab stopped at its
 *    search field — now the search field, the categories and the cards are
 *    the groups of the menu model, and Enter on a card places it;
 * 2. a mind map style could be picked up but not placed — Enter now places
 *    it at the centre of the view;
 * 3. at a 380px-wide bar, → from Text left the focus on the same button,
 *    retitled "Add file" (the reused senior cell kept its button): a walk
 *    waiting for the focus to move, or a screen reader, saw it stall there;
 * 4. the Shape tool taken from the keyboard drew its ghost in the canvas's
 *    top-left corner until the mouse moved — now hidden until it does;
 * 5. reported, not reproduced: a tooltip the resting mouse raised over a
 *    menu control took the keyboard's press — held as it is.
 *
 * One mount, the tests short: the full keyboard model is held by
 * `edgeless-toolbar-keyboard.spec.ts`, which takes minutes.
 */
import type { EdgelessRootBlockComponent } from '@labre/affine/blocks/root';
import { DefaultTool } from '@labre/affine/blocks/surface';
import {
  EDGELESS_TOOLBAR_WIDGET,
  type EdgelessToolbarWidget,
} from '@labre/affine/widgets/edgeless-toolbar';
import { userEvent } from '@vitest/browser/context';
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  onTestFinished,
  test,
  vi,
} from 'vitest';

import { deepQueryAll } from '../utils/deep-query.js';
import { getDocRootBlock } from '../utils/edgeless.js';
import { snapshotPageState } from '../utils/page-state.js';
import { pointerMoveTo } from '../utils/pointer.js';
import { setupEditor } from '../utils/setup.js';

/** Where the focus really is, through every shadow root. */
function deepActive(): Element | null {
  let active = document.activeElement;
  while (active?.shadowRoot?.activeElement) {
    active = active.shadowRoot.activeElement;
  }
  return active;
}

/** Whether `node` lies inside `root`, crossing shadow boundaries upwards. */
function within(node: Node | null, root: Node): boolean {
  for (let current = node; current; ) {
    if (current === root) return true;
    current = current.parentNode ?? (current as ShadowRoot).host ?? null;
  }
  return false;
}

const frames = async (count = 2) => {
  for (let i = 0; i < count; i++) {
    await new Promise(resolve => requestAnimationFrame(resolve));
  }
};

const until = (condition: () => boolean, message: string) =>
  vi.waitFor(() => {
    if (!condition()) throw new Error(message);
  });

const press = async (keys: string) => {
  await userEvent.keyboard(keys);
  await frames();
};

describe('edgeless toolbar keyboard: the gaps of the 4.1.0 acceptance', () => {
  let edgeless!: EdgelessRootBlockComponent;
  let teardown: () => void = () => {};
  let restorePage: () => void = () => {};

  const toolbar = () =>
    edgeless.widgetComponents[
      EDGELESS_TOOLBAR_WIDGET
    ] as unknown as EdgelessToolbarWidget;

  const rowButtons = () =>
    Array.from(
      toolbar().shadowRoot!.querySelectorAll<HTMLElement>(
        '.quick-tool-item, .senior-tool-item'
      )
    )
      .flatMap(item => deepQueryAll(item, '[role="button"]'))
      .filter(button => (button as { onToolbarRow?: boolean }).onToolbarRow);

  const rowReady = () =>
    until(() => {
      const drawn = toolbar().shadowRoot!.querySelectorAll(
        '.quick-tool-item, .senior-tool-item'
      ).length;
      const buttons = rowButtons();
      return (
        drawn > 0 &&
        buttons.length >= drawn &&
        buttons.every(button => button.hasAttribute('tabindex'))
      );
    }, 'the row is not ready');

  /** The row's button named `name`, its page of the senior row turned to. */
  const buttonNamed = async (name: string) => {
    const bar = toolbar();
    const seniors = (bar as unknown as { _seniorTools: unknown[] })._seniorTools
      .length;
    for (let scroll = 0; scroll < seniors; scroll++) {
      bar.scrollSeniorToolIndex = scroll;
      await bar.updateComplete;
      await rowReady();
      const found = rowButtons().find(
        button => button.getAttribute('aria-label') === name
      );
      if (found) return found;
    }
    throw new Error(`no row button named ${name}`);
  };

  const focusedButton = () => {
    const active = deepActive();
    const container = toolbar().shadowRoot!.querySelector(
      '.edgeless-toolbar-container'
    )!;
    if (!active || active.getAttribute('role') !== 'button') return null;
    return within(active, container) ? (active as HTMLElement) : null;
  };

  const tool = () => edgeless.gfx.tool.currentToolName$.peek();
  const elementCount = () => edgeless.gfx.surface!.elementModels.length;
  const modelCount = () => edgeless.store.getAllModels().length;
  const panel = () =>
    deepQueryAll(toolbar().shadowRoot!, 'edgeless-templates-panel')[0] as
      | HTMLElement
      | undefined;

  beforeAll(async () => {
    restorePage = snapshotPageState();
    teardown = await setupEditor('edgeless');
    edgeless = getDocRootBlock(window.doc, window.editor, 'edgeless');
    edgeless.std.event.active = true;
    await rowReady();
  });

  afterAll(async () => {
    teardown();
    restorePage();
    await pointerMoveTo('html', 0, 0, 1);
  });

  /** A quiet canvas: nothing open, the select tool, the canvas focused. */
  beforeEach(async () => {
    const bar = toolbar();
    const menu = bar.activePopper?.element;
    bar.activePopper?.dispose();
    bar.activePopper = null;
    if (menu) await until(() => !menu.isConnected, 'the menu has left');
    const open = panel();
    if (open) {
      document.body.click();
      await until(() => !open.isConnected, 'the templates panel has left');
    }
    edgeless.service.selection.clear();
    edgeless.gfx.tool.setTool(DefaultTool);
    window.editor.host!.focus();
    await frames(3);
  });

  test('the templates panel: its search field, its categories, its cards; Enter places a card', async () => {
    const button = await buttonNamed('Template');
    button.focus();
    await press('{Enter}');
    await until(() => !!panel(), 'the panel opens');
    const search = () =>
      panel()!.shadowRoot!.querySelector<HTMLInputElement>('.search-input');
    await until(
      () => deepActive() === search(),
      'the keyboard enters the panel on its search field'
    );
    // Typing stays in the field (ADR 0055): a canvas shortcut letter is text.
    await press('x');
    expect(search()!.value).toBe('x');
    expect(tool()).not.toBe('pen');
    await press('{Backspace}');
    const cards = () =>
      Array.from(
        panel()!.shadowRoot!.querySelectorAll<HTMLElement>('.template-item')
      );
    await until(() => cards().length > 1, 'the cards are drawn');
    await press('{Tab}');
    const category = deepActive();
    expect(category?.classList.contains('category-entry')).toBe(true);
    expect(category?.getAttribute('role')).toBe('button');
    await press('{Tab}');
    await until(
      () => deepActive() === cards()[0],
      'Tab from the categories reaches the first card'
    );
    expect(cards()[0].getAttribute('aria-label')).toBeTruthy();
    await press('{ArrowRight}');
    expect(deepActive()).toBe(cards()[1]);
    await press('{ArrowLeft}');
    expect(deepActive()).toBe(cards()[0]);

    const before = { elements: elementCount(), models: modelCount() };
    await press('{Enter}');
    await until(
      () => elementCount() > before.elements || modelCount() > before.models,
      'Enter on a card places the template'
    );
    await until(() => tool() === 'default', 'the select tool is back');
    // The menu model's one rule: the panel still open, the keyboard stays on
    // the card, for another; gone, the canvas has the keys.
    await until(
      () =>
        panel()?.isConnected
          ? deepActive() === cards()[0]
          : deepActive() === window.editor.host,
      'the keyboard stays on the card, or is on the canvas'
    );
    // Nothing is left carried.
    const open = panel();
    if (open) {
      expect(
        (
          open as unknown as {
            draggableController: { states: { draggingElement: unknown } };
          }
        ).draggableController.states.draggingElement
      ).toBeNull();
    }
  });

  test('a mind map style: Enter places it at the centre of the view', async () => {
    const button = await buttonNamed('Mind Map');
    button.focus();
    await press('{Enter}');
    const menu = toolbar().activePopper?.element;
    expect(menu).toBeTruthy();
    await until(
      () => within(deepActive(), menu!),
      'the keyboard enters the menu'
    );
    const mindmaps = () =>
      edgeless.gfx.surface!.elementModels.filter(
        element => element.type === 'mindmap'
      );
    const before = new Set(mindmaps());
    await press('{Enter}');
    await until(
      () => mindmaps().length === before.size + 1,
      'Enter on a style places a mind map'
    );
    const placed = mindmaps().find(element => !before.has(element))!;
    await until(() => tool() === 'default', 'the select tool is back');
    await until(
      () => edgeless.gfx.selection.selectedIds.length > 0,
      'the new mind map is selected'
    );
    const { centerX, centerY } = edgeless.gfx.viewport;
    const { x, y, w, h } = placed.elementBound;
    expect(centerX).toBeGreaterThan(x);
    expect(centerX).toBeLessThan(x + w);
    expect(centerY).toBeGreaterThan(y);
    expect(centerY).toBeLessThan(y + h);
    // Nothing is left carried: the canvas has the keyboard, no ghost.
    expect(
      (
        menu as unknown as {
          draggableController: { states: { draggingElement: unknown } };
        }
      ).draggableController.states.draggingElement
    ).toBeNull();
  });

  test('at 380px, → walks every button, each a focus of its own, past Add file', async () => {
    const column = window.editor.parentElement as HTMLElement;
    onTestFinished(async () => {
      column.style.width = '';
      window.dispatchEvent(new Event('resize'));
      await until(
        () => toolbar().scrollSeniorToolSize > 1,
        'the bar is wide again'
      );
    });
    column.style.width = '380px';
    window.dispatchEvent(new Event('resize'));
    await until(
      () => toolbar().scrollSeniorToolSize === 1,
      'one senior tool a page'
    );
    await rowReady();
    window.editor.host!.focus();
    await press('{Tab}');
    await until(() => focusedButton() !== null, 'Tab reaches the toolbar');
    await press('{Home}');
    await until(
      () => focusedButton()?.getAttribute('aria-label') === 'Select',
      'Home goes to the first button'
    );
    const first = focusedButton()!;
    const seen: string[] = [];
    for (let step = 0; step < 40; step++) {
      const here = focusedButton()!;
      seen.push(here.getAttribute('aria-label') ?? '?');
      await userEvent.keyboard('{ArrowRight}');
      await until(
        () => focusedButton() !== null && focusedButton() !== here,
        `→ moves the focus on from ${seen.at(-1)} (seen: ${seen.join(', ')})`
      );
      if (focusedButton() === first) break;
    }
    expect(seen).toEqual(
      expect.arrayContaining(['More Tools', 'Text', 'Add file', 'Shape'])
    );
    expect(seen.indexOf('Shape')).toBe(seen.indexOf('Add file') + 1);
    expect(seen.at(-1)).toBe('Template');
  });

  test('the Shape tool hides its ghost while no pointer is over the editor, and keeps it under a resting one', async () => {
    type Ghost = {
      _shapeOverlay: { globalAlpha: number; x: number; y: number } | null;
    };
    const ghost = () =>
      (edgeless.gfx.tool.currentTool$.peek() as unknown as Ghost)._shapeOverlay;
    // The real mouse to a point of the canvas inside the window, through a
    // mark that takes no pointer: the editor's box may reach past the window
    // after an earlier test resized its column.
    const pointerOverCanvas = async (fx: number, fy: number) => {
      const mark = document.createElement('div');
      mark.setAttribute('data-gaps-canvas', '');
      Object.assign(mark.style, {
        position: 'fixed',
        left: `${Math.round(window.innerWidth * fx)}px`,
        top: `${Math.round(window.innerHeight * fy)}px`,
        width: '1px',
        height: '1px',
        pointerEvents: 'none',
      });
      document.body.append(mark);
      await pointerMoveTo('[data-gaps-canvas]', 0.5, 0.5);
      mark.remove();
    };
    // `s` is bound by the toolbar's Shape button once it is drawn: at this
    // width the senior row is paged, and the test may run first.
    await buttonNamed('Shape');
    // The mouse away from the canvas, where a keyboard user leaves it.
    await pointerMoveTo('html', 0, 0, 1);
    window.editor.host!.focus();
    await press('s');
    await until(() => tool() === 'shape', '`s` takes the Shape tool');
    expect(ghost()?.globalAlpha).toBe(0);
    // The first move over the canvas shows it, under the pointer.
    await pointerOverCanvas(0.4, 0.4);
    await until(() => ghost()?.globalAlpha === 1, 'a move shows the ghost');
    // `s` again cycles the shape, taking the tool again under a resting
    // pointer: the ghost it draws anew stays shown.
    await press('s');
    await until(() => tool() === 'shape', 'still the Shape tool');
    expect(ghost()?.globalAlpha).toBe(1);
    await press('{Escape}');
    await until(() => tool() === 'default', 'Escape gives the select tool');

    // The mouse moved over the canvas under the select tool, then at rest:
    // `s` draws the ghost where it rests, as before the amendment (review of
    // its first version, which hid it until the next move).
    await pointerOverCanvas(0.3, 0.35);
    // The real mouse's moves can land late on a loaded machine: wait for
    // the editor to have seen one, longer than `until` does.
    await vi.waitFor(
      () => {
        if (!edgeless.gfx.tool.pointerOnHost$.peek()) {
          throw new Error('the pointer is over the editor');
        }
      },
      { timeout: 5000 }
    );
    await press('s');
    await until(() => tool() === 'shape', '`s` takes the Shape tool');
    expect(ghost()?.globalAlpha, 'a resting pointer keeps its ghost').toBe(1);
    const under = edgeless.gfx.tool.lastMousePos$.peek();
    expect(ghost()?.x).toBeCloseTo(under.x);
    expect(ghost()?.y).toBeCloseTo(under.y);
    await press('{Escape}');
    await until(() => tool() === 'default', 'Escape gives the select tool');

    // Enter on the toolbar's Shape, the mouse away: hidden again.
    await pointerMoveTo('html', 0, 0, 1);
    const shape = await buttonNamed('Shape');
    shape.focus();
    await press('{Enter}');
    await until(() => tool() === 'shape', 'Enter on Shape takes the tool');
    expect(ghost()?.globalAlpha).toBe(0);
  });

  /**
   * Reported, not reproduced: a tooltip the resting mouse raised over a menu
   * control was said to take the keyboard's Enter. The tooltips are
   * `pointer-events: none`, and the press lands on the focused control
   * whether the mouse rests on it or on its neighbour. Held here so that a
   * tooltip that starts taking the press is seen.
   */
  test('a tooltip raised by the resting mouse does not take the keyboard press', async () => {
    const button = await buttonNamed('Shape');
    button.focus();
    await press('{Enter}');
    const menu = toolbar().activePopper!.element;
    await until(() => within(deepActive(), menu), 'the keyboard is in');
    const chosen = () =>
      (
        edgeless.gfx.tool.currentToolOption$.peek().options as
          | { shapeName?: string }
          | undefined
      )?.shapeName;
    const controls = () =>
      [menu, menu.shadowRoot!]
        .flatMap(root => deepQueryAll(root, '[role="button"]'))
        .filter(control => control.getClientRects().length > 0);
    const tooltips = () =>
      deepQueryAll(document, '[role="tooltip"]').filter(
        tip => tip.getClientRects().length > 0
      );
    const restOn = async (control: Element) => {
      control.setAttribute('data-gaps-rest', '');
      onTestFinished(() => control.removeAttribute('data-gaps-rest'));
      await pointerMoveTo('[data-gaps-rest]', 0.5, 0.5);
      control.removeAttribute('data-gaps-rest');
      await until(() => tooltips().length > 0, 'the tooltip shows');
    };
    // The mouse on the third control, the keyboard brought onto it.
    await restOn(controls()[2]);
    await press('{ArrowRight}{ArrowRight}');
    expect(deepActive()).toBe(controls()[2]);
    let start = chosen();
    await press('{Enter}');
    await until(() => chosen() !== start, 'Enter presses the hovered control');
    // The mouse on the fourth, the keyboard on the second.
    await restOn(controls()[3]);
    await press('{ArrowLeft}');
    expect(deepActive()).toBe(controls()[1]);
    start = chosen();
    await press('{Enter}');
    await until(() => chosen() !== start, 'Enter presses the focused control');
    await pointerMoveTo('html', 0, 0, 1);
  });
});
