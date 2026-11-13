/**
 * A `menu.toggleSwitch` row flips its setting once per click, whether the
 * reader clicks the row or the switch on it.
 *
 * The row's `select` handed `onChange` the value the row was built with, so a
 * click on the row's words changed nothing, and right after a flip it undid
 * it (the export-SVG options menu had to rebuild its rows through
 * `menu.dynamic` to say the current value). A click on the switch bubbled up
 * to the row as well, so the row's `select` answered it a second time.
 *
 * The rows are rebuilt through `menu.dynamic` from a signal, as the export-SVG
 * menu does, and after each click the stored value, the number of writes and
 * the drawn switch are read back. happy-dom does not pass a click on a
 * `<label>` on to its checkbox, so the switch is clicked here on its checkbox;
 * the real mouse on the switch is held in Chromium by
 * `integration-test/src/__tests__/page/menu-toggle-row.spec.ts`.
 */
import { signal } from '@preact/signals-core';
import { beforeAll, beforeEach, describe, expect, test } from 'vitest';

import { effects } from '../context-menu/index.js';
import { Menu } from '../context-menu/menu.js';
import { menu } from '../context-menu/menu-all.js';
import { ToggleSwitch } from '../toggle-switch/index.js';

beforeAll(() => {
  effects();
  if (!customElements.get('toggle-switch')) {
    customElements.define('toggle-switch', ToggleSwitch);
  }
});

beforeEach(() => {
  document.body.replaceChildren();
});

/** Every element matching `selector`, through every open shadow root. */
function deepQueryAll(root: ParentNode, selector: string): HTMLElement[] {
  const found = Array.from(root.querySelectorAll<HTMLElement>(selector));
  for (const element of root.querySelectorAll('*')) {
    if (element.shadowRoot)
      found.push(...deepQueryAll(element.shadowRoot, selector));
  }
  return found;
}

const settle = async () => {
  for (let i = 0; i < 5; i++) await new Promise(r => setTimeout(r, 0));
};

async function openToggleMenu() {
  const on = signal(true);
  const writes: boolean[] = [];
  const m = new Menu({
    items: [
      menu.dynamic(() => [
        menu.toggleSwitch({
          name: 'Option',
          on: on.value,
          onChange: value => {
            writes.push(value);
            on.value = value;
          },
          testId: 'option',
        }),
      ]),
    ],
  });
  document.body.append(m.menuElement);
  await settle();
  const toggle = () =>
    deepQueryAll(document.body, 'toggle-switch')[0] as ToggleSwitch;
  const row = () =>
    deepQueryAll(document.body, '[data-testid="option"]')[0] as HTMLElement;
  const drawn = async () => {
    await toggle().updateComplete;
    return {
      on: toggle().on,
      checked: toggle().shadowRoot!.querySelector('input')!.checked,
    };
  };
  return { on, writes, toggle, row, drawn };
}

describe('menu.toggleSwitch', () => {
  test('a click on the row flips the setting once', async () => {
    const { on, writes, row, drawn } = await openToggleMenu();

    for (const expected of [false, true, false]) {
      writes.length = 0;
      row().click();
      await settle();
      expect(writes).toEqual([expected]);
      expect(on.value).toBe(expected);
      expect(await drawn()).toEqual({ on: expected, checked: expected });
    }
  });

  test('a click on the switch flips the setting once', async () => {
    const { on, writes, toggle, drawn } = await openToggleMenu();

    for (const expected of [false, true, false]) {
      writes.length = 0;
      toggle().shadowRoot!.querySelector('input')!.click();
      await settle();
      expect(writes).toEqual([expected]);
      expect(on.value).toBe(expected);
      expect(await drawn()).toEqual({ on: expected, checked: expected });
    }
  });
});
