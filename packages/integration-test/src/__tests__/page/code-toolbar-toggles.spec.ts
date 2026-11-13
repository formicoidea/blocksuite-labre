/**
 * The Wrap and Line number rows of the code block's "more" menu, clicked with
 * the real mouse (issue #660, upstream toeverything/AFFiNE#15782).
 *
 * Each row is an `editor-menu-action` holding a `<toggle-switch>`. In a
 * browser, a click on the switch is a click on its `<label>`, which the
 * browser then sends on to the hidden checkbox: both clicks bubbled up to the
 * row, which flipped the setting again, and the switch was bound through the
 * `checked` attribute, which a checkbox stops reading once clicked. The
 * setting flipped twice (so not at all) and the switch stopped saying what the
 * model said.
 *
 * happy-dom does not forward a label click to its checkbox, so this path is
 * held here, in Chromium, through the real toolbar: hover the block, open
 * "more", click the switch, then the row's words, and after each click read
 * the model and the drawn switch back. The checkbox and readonly paths are
 * held by `affine/blocks/code/src/__tests__/toolbar-toggles.unit.spec.ts`.
 */
import type { CodeBlockModel } from '@labre/affine-model';
import { Text } from '@labre/store';
import { page, userEvent } from '@vitest/browser/context';
import { beforeEach, describe, expect, test } from 'vitest';

import { wait } from '../utils/common.js';
import { addNote } from '../utils/edgeless.js';
import { pointerMoveTo } from '../utils/pointer.js';
import { setupEditor } from '../utils/setup.js';

type ToggleSwitchElement = HTMLElement & {
  on: boolean;
  updateComplete: Promise<boolean>;
};

const settle = async () => {
  await wait(100);
  for (let i = 0; i < 3; i++) {
    await new Promise(resolve => requestAnimationFrame(resolve));
  }
};

/** Every element matching `selector`, through every open shadow root. */
function deepQueryAll(root: ParentNode, selector: string): HTMLElement[] {
  const found = Array.from(root.querySelectorAll<HTMLElement>(selector));
  for (const element of root.querySelectorAll('*')) {
    if (element.shadowRoot)
      found.push(...deepQueryAll(element.shadowRoot, selector));
  }
  return found;
}

const click = (element: Element | null | undefined) => {
  expect(element, 'the click target is drawn').toBeTruthy();
  return userEvent.click(page.elementLocator(element as HTMLElement));
};

describe('code block toolbar toggles, clicked with the mouse', () => {
  let model!: CodeBlockModel;

  beforeEach(async () => {
    const cleanup = await setupEditor('page');
    const noteId = addNote(doc);
    const codeId = doc.addBlock(
      'affine:code',
      { text: new Text('const a = 1;') },
      noteId
    );
    await settle();
    model = doc.getBlock(codeId)!.model as CodeBlockModel;
    const block = editor.host!.view.getBlock(codeId)!;
    block.dataset.toggleSpec = 'current';
    return async () => {
      await userEvent.keyboard('{Escape}');
      cleanup();
    };
  });

  /** The row whose name matches `name`: the name says the next action. */
  const rowOf = (name: RegExp) =>
    deepQueryAll(
      document.body,
      'affine-code-more-menu editor-menu-action'
    ).find(row => name.test(row.getAttribute('aria-label') ?? '')) ?? null;

  /** Hovers the block and opens its "more" menu. */
  const openMore = async () => {
    await pointerMoveTo('[data-toggle-spec="current"]', 0.5, 0.5, 3);
    await settle();
    const toolbar = deepQueryAll(document.body, 'affine-code-toolbar')[0];
    expect(toolbar, 'hovering the block shows its toolbar').toBeTruthy();
    await click(toolbar?.shadowRoot?.querySelector('[data-testid="more"]'));
    await settle();
  };

  const drawn = async (row: HTMLElement | null) => {
    const toggle = row?.querySelector<ToggleSwitchElement>('toggle-switch');
    await toggle?.updateComplete;
    return {
      on: toggle?.on,
      checked: toggle?.shadowRoot?.querySelector('input')?.checked,
    };
  };

  const STEPS = ['switch', 'words', 'switch', 'switch', 'words'] as const;

  test.each([
    { setting: 'wrap', name: /wrap/i, initial: false },
    { setting: 'lineNumber', name: /line number/i, initial: true },
  ] as const)(
    'the $setting switch and its row each flip the setting once',
    async ({ setting, name, initial }) => {
      await openMore();
      expect(rowOf(name), 'the more menu lists the row').toBeTruthy();
      const stored = () => model.props[setting] ?? true;
      expect(stored()).toBe(initial);

      let expected: boolean = initial;
      for (const where of STEPS) {
        expected = !expected;
        const row = rowOf(name);
        await click(
          where === 'switch'
            ? row?.querySelector('toggle-switch')
            : row?.querySelector('.label')
        );
        await settle();
        expect(stored(), `stored after a click on the ${where}`).toBe(expected);
        expect(await drawn(rowOf(name)), `drawn after the ${where}`).toEqual({
          on: expected,
          checked: expected,
        });
      }
    }
  );
});
