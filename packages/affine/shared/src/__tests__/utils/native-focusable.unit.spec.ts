import { describe, expect, test } from 'vitest';

import { isNativeFocusableTarget } from '../../utils/event.js';

/**
 * The keymaps read this to tell a keystroke aimed at one of the controls the
 * editor renders — the collapse chevron of a heading, for instance — from a
 * keystroke aimed at the text or at a block selection.
 */
describe('isNativeFocusableTarget', () => {
  const render = (html: string) => {
    const root = document.createElement('div');
    root.innerHTML = html;
    document.body.append(root);
    return root;
  };

  test('a button is a control', () => {
    const root = render('<button class="toggle"><span>x</span></button>');
    const button = root.querySelector('button')!;

    expect(isNativeFocusableTarget(button)).toBe(true);
    // The keystroke may be reported on a child of the control.
    expect(isNativeFocusableTarget(button.querySelector('span'))).toBe(true);
  });

  test('editable text is not a control, even inside one', () => {
    const root = render(
      '<div contenteditable="true"></div><button><div contenteditable="true"></div></button>'
    );

    for (const editable of root.querySelectorAll('[contenteditable]')) {
      expect(isNativeFocusableTarget(editable)).toBe(false);
    }
  });

  test('the editor host is a surface, not a control', () => {
    // It carries `tabindex="0"` so that it can receive the keystrokes of a
    // block selection: mistaking it for a control would hand Tab and Enter
    // back to the browser every time a block is selected.
    const root = render('<editor-host tabindex="0"><div></div></editor-host>');

    expect(isNativeFocusableTarget(root.firstElementChild)).toBe(false);
    expect(isNativeFocusableTarget(root.querySelector('div'))).toBe(false);
  });

  test('a plain element and a non-element target are not controls', () => {
    const root = render('<div><p>text</p></div>');

    expect(isNativeFocusableTarget(root.querySelector('p'))).toBe(false);
    expect(isNativeFocusableTarget(null)).toBe(false);
    expect(isNativeFocusableTarget(new EventTarget())).toBe(false);
  });
});
