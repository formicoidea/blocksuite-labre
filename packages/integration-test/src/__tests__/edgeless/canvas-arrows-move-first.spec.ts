import type { EdgelessRootBlockComponent } from '@labre/affine/blocks/root';
import type { ShapeElementModel } from '@labre/affine/model';
import {
  armedArtefact,
  EDGELESS_TOOLBAR_WIDGET,
  EdgelessCommandMenu,
  type EdgelessToolbarWidget,
} from '@labre/affine/widgets/edgeless-toolbar';
import { afterEach, beforeEach, describe, expect, test } from 'vitest';

import { wait } from '../utils/common.js';
import { getDocRootBlock } from '../utils/edgeless.js';
import { setupEditor } from '../utils/setup.js';

/**
 * On the canvas the arrows move what is selected, sub-menu open or not; Alt+←/→
 * walks the open sub-menu, or the toolbar when none is open.
 *
 * Would have caught recette P7-17 (PO, 2026-11-02), both halves of it:
 * - with the Wardley sub-menu open, ← / → stepped the menu's highlight and the
 *   selected component stayed put;
 * - after closing that sub-menu with its own button, ← / → still did nothing:
 *   the button disposed its popper without telling the toolbar, whose
 *   `activePopper` kept pointing at the dead menu, so the arrows kept walking
 *   a row nobody could see.
 *
 * Keys go through the real dispatcher (a keydown on `document`), the way
 * `readonly-guards.spec.ts` presses them; the routing table itself is
 * `arrow-key-routing.unit.spec.ts` in `blocks/root`.
 */

const press = (
  key: string,
  modifiers: { alt?: boolean; shift?: boolean } = {}
) => {
  const event = new KeyboardEvent('keydown', {
    key,
    altKey: modifiers.alt ?? false,
    shiftKey: modifiers.shift ?? false,
    bubbles: true,
    cancelable: true,
  });
  document.dispatchEvent(event);
  return event;
};

/** Long enough for a senior button to mount its popper. */
const POPPER_MOUNT_MS = 50;

describe('canvas arrows move first, Alt reaches the toolbar', () => {
  let edgeless!: EdgelessRootBlockComponent;
  let shape!: ShapeElementModel;

  beforeEach(async () => {
    const cleanup = await setupEditor('edgeless');
    edgeless = getDocRootBlock(window.doc, window.editor, 'edgeless');
    // The dispatcher only runs while active; a pointer entering the host turns
    // it on, and nothing here moves one before the first keystroke.
    edgeless.std.event.active = true;
    const id = edgeless.service.crud.addElement('shape', {
      shapeType: 'rect',
      xywh: '[0,0,100,100]',
    })!;
    shape = edgeless.service.crud.getElementById(id) as ShapeElementModel;
    select();
    await wait();
    return cleanup;
  });

  afterEach(() => {
    const popper = toolbar().activePopper;
    popper?.dispose();
    toolbar().activePopper = null;
  });

  const toolbar = () =>
    edgeless.widgetComponents[
      EDGELESS_TOOLBAR_WIDGET
    ] as unknown as EdgelessToolbarWidget;

  const x = () => shape.elementBound.x;

  const select = () =>
    edgeless.service.selection.set({ elements: [shape.id], editing: false });

  /**
   * Page the senior window until the Wardley button is drawn: at the suite's
   * 1024px the toolbar shows a few senior tools at a time.
   */
  const revealWardley = async () => {
    const bar = toolbar();
    const find = () =>
      bar.shadowRoot!.querySelector('edgeless-wardley-senior-button');
    for (let scroll = 0; scroll < 32 && !find(); scroll++) {
      bar.scrollSeniorToolIndex = scroll;
      await bar.updateComplete;
    }
    expect(find(), 'the Wardley senior button is on the toolbar').toBeTruthy();
  };

  /** The Wardley senior button's own clickable, inside its shadow tree. */
  const wardleyButton = () => {
    const senior = toolbar().shadowRoot!.querySelector(
      'edgeless-wardley-senior-button'
    );
    expect(senior, 'the Wardley senior button is on the toolbar').toBeTruthy();
    return senior!.shadowRoot!.querySelector<HTMLElement>(
      'edgeless-toolbar-button'
    )!;
  };

  const openWardleyMenu = async () => {
    await revealWardley();
    wardleyButton().click();
    await wait(POPPER_MOUNT_MS);
    const menu = toolbar().activePopper?.element;
    expect(menu).toBeInstanceOf(EdgelessCommandMenu);
    // The senior button arms the default tool, which empties the selection;
    // the menu stays open while the user picks the component on the canvas.
    select();
    return menu as EdgelessCommandMenu;
  };

  test('with the sub-menu open, → and Shift+→ move the selection', async () => {
    await openWardleyMenu();
    const before = x();

    press('ArrowRight');
    expect(x()).toBe(before + 1);
    press('ArrowRight', { shift: true });
    expect(x()).toBe(before + 11);
    press('ArrowLeft');
    expect(x()).toBe(before + 10);

    // Nothing was highlighted by the plain arrows: Enter arms nothing.
    press('Enter');
    expect(armedArtefact(edgeless.gfx)).toBeFalsy();
  });

  test('with the sub-menu open, Alt+→ walks it and the selection stays', async () => {
    await openWardleyMenu();
    const before = x();

    const event = press('ArrowRight', { alt: true });
    expect(x()).toBe(before);
    // Alt+← / Alt+→ is the browser's Back / Forward outside macOS.
    expect(event.defaultPrevented).toBe(true);

    press('Enter');
    expect(armedArtefact(edgeless.gfx)?.owner).toBe('wardley');
  });

  test('closing the sub-menu with its own button gives the arrows back', async () => {
    await openWardleyMenu();
    wardleyButton().click();
    // Before the leave transition is over: the toolbar must already know.
    expect(toolbar().activePopper).toBeNull();

    const before = x();
    press('ArrowRight');
    expect(x()).toBe(before + 1);
  });

  test('with no sub-menu open, Alt+→ walks the toolbar and Enter presses it', async () => {
    const bar = toolbar();
    const before = x();

    press('ArrowRight', { alt: true });
    expect(x()).toBe(before);
    expect(bar.keyboardHighlight).toBe(0);
    await bar.updateComplete;
    expect(
      bar.shadowRoot!.querySelectorAll('[data-keyboard-highlight]')
    ).toHaveLength(1);

    // Walk onto the Wardley senior button, paging the senior window as the
    // walk goes (it is paged out at this width), then Enter opens its sub-menu.
    const highlighted = () =>
      bar.shadowRoot!.querySelector('[data-keyboard-highlight]');
    const onWardley = () =>
      !!highlighted()?.querySelector('edgeless-wardley-senior-button');
    for (let step = 0; step < 64 && !onWardley(); step++) {
      press('ArrowRight', { alt: true });
      await bar.updateComplete;
    }
    expect(onWardley()).toBe(true);
    press('Enter');
    await wait(POPPER_MOUNT_MS);
    expect(bar.activePopper?.element).toBeInstanceOf(EdgelessCommandMenu);
    expect(bar.keyboardHighlight).toBe(-1);
    expect(x()).toBe(before);
  });

  test('Escape drops the toolbar highlight', async () => {
    const bar = toolbar();
    press('ArrowLeft', { alt: true });
    expect(bar.keyboardHighlight).toBeGreaterThanOrEqual(0);
    press('Escape');
    expect(bar.keyboardHighlight).toBe(-1);
  });
});
