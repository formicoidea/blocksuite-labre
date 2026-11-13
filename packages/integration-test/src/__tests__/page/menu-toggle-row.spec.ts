/**
 * A `menu.toggleSwitch` row, clicked with the real mouse: a click on the
 * switch and a click on the row each flip the setting ONCE, and the switch
 * says what is stored.
 *
 * In a browser a click on the switch is a click on its `<label>`, which the
 * browser sends on to the hidden checkbox; both clicks bubbled up to the row,
 * whose `select` answered them with the value the row was built with, beside
 * the switch's own `onChange`. A click on the row's words changed nothing.
 * happy-dom does not forward a label click to its checkbox, so the switch path
 * is held here, in Chromium; the row and checkbox paths are also held by
 * `affine/components/src/__tests__/context-menu-toggle-switch.unit.spec.ts`.
 *
 * The menu is built the way its one caller, the export-SVG options menu,
 * builds it: rows rebuilt through `menu.dynamic` from a signal.
 *
 * The switch keeps its click from the row, so the menu container that gives
 * the focus back to the menu's hidden search field never sees it; the last
 * case holds that the arrows and Enter, heard only on that field, still drive
 * the menu after a click on the switch.
 */
import {
  menu,
  popMenu,
  popupTargetFromElement,
} from '@labre/affine/components/context-menu';
import { signal } from '@preact/signals-core';
import { page, userEvent } from '@vitest/browser/context';
import { beforeEach, describe, expect, test } from 'vitest';

import { wait } from '../utils/common.js';
import { deepQueryAll } from '../utils/deep-query.js';
import { setupEditor } from '../utils/setup.js';

type ToggleSwitchElement = HTMLElement & {
  on: boolean;
  updateComplete: Promise<boolean>;
};

const settle = async () => {
  await wait(50);
  for (let i = 0; i < 3; i++) {
    await new Promise(resolve => requestAnimationFrame(resolve));
  }
};

describe('a menu.toggleSwitch row, clicked with the mouse', () => {
  let close!: () => void;
  let anchor!: HTMLElement;

  beforeEach(async () => {
    const cleanup = await setupEditor('page');
    anchor = document.createElement('div');
    anchor.style.cssText =
      'position:fixed;left:40px;top:40px;width:1px;height:1px';
    document.body.append(anchor);
    return () => {
      close?.();
      anchor.remove();
      cleanup();
    };
  });

  const open = async () => {
    const on = signal(true);
    const writes: boolean[] = [];
    ({ close } = popMenu(popupTargetFromElement(anchor), {
      options: {
        items: [
          menu.dynamic(() => [
            menu.toggleSwitch({
              name: 'Option',
              on: on.value,
              onChange: value => {
                writes.push(value);
                on.value = value;
              },
              testId: 'menu-toggle-row-option',
            }),
          ]),
        ],
      },
    }));
    await settle();
    const row = () =>
      deepQueryAll(document.body, '[data-testid="menu-toggle-row-option"]')[0];
    const toggle = () =>
      row()?.querySelector<ToggleSwitchElement>('toggle-switch') ?? null;
    const drawn = async () => {
      await toggle()?.updateComplete;
      return {
        on: toggle()?.on,
        checked: toggle()?.shadowRoot?.querySelector('input')?.checked,
      };
    };
    return { on, writes, row, toggle, drawn };
  };

  test.each(['switch', 'words'] as const)(
    'each click on the %s flips the setting once',
    async where => {
      const { on, writes, row, toggle, drawn } = await open();
      expect(row(), 'the menu draws the row').toBeTruthy();

      for (const expected of [false, true, false]) {
        writes.length = 0;
        const target =
          where === 'switch'
            ? toggle()
            : row()?.querySelector<HTMLElement>('.affine-menu-action-text');
        await userEvent.click(page.elementLocator(target!));
        await settle();
        expect(writes, `writes after a click on the ${where}`).toEqual([
          expected,
        ]);
        expect(on.value).toBe(expected);
        expect(await drawn(), `drawn after the ${where}`).toEqual({
          on: expected,
          checked: expected,
        });
      }
    }
  );

  test('the keyboard still drives the menu after a click on the switch', async () => {
    const { on, writes, toggle } = await open();

    await userEvent.click(page.elementLocator(toggle()!));
    await settle();
    expect(writes).toEqual([false]);

    // ArrowDown highlights the row, Enter presses it: one more flip.
    await userEvent.keyboard('{ArrowDown}');
    await userEvent.keyboard('{Enter}');
    await settle();
    expect(writes, 'the keys reached the menu').toEqual([false, true]);
    expect(on.value).toBe(true);
  });
});
