import { describe, expect, test, vi } from 'vitest';

import { createPopper } from '../create-popper.js';
import { stepToolbarHighlight } from '../toolbar-highlight.js';

/**
 * The toolbar half of recette P7-17 (2026-11-02): Alt+←/→ walks the toolbar
 * when no sub-menu is open, and closing a sub-menu says so at once.
 *
 * Would have caught: a senior button closing its own menu (re-click) disposed
 * the popper without telling the toolbar, so `activePopper` still pointed at
 * the dead menu and the canvas arrows kept stepping a row nobody could see —
 * "with no sub-menu open, the side arrows do nothing". `onClose` is what the
 * mixin now clears the toolbar's reference from, and it must fire before the
 * leave transition, not on `transitionend`.
 */

describe('stepToolbarHighlight', () => {
  const row = { quick: 3, senior: 5, scroll: 0, size: 2 };

  test('enters on the first button forwards, on the last backwards', () => {
    expect(stepToolbarHighlight(-1, 1, row)).toEqual({ index: 0, scroll: 0 });
    expect(stepToolbarHighlight(-1, -1, row)).toEqual({ index: 7, scroll: 3 });
  });

  test('wraps at both ends', () => {
    expect(stepToolbarHighlight(7, 1, { ...row, scroll: 3 })).toEqual({
      index: 0,
      scroll: 3,
    });
    expect(stepToolbarHighlight(0, -1, row)).toEqual({ index: 7, scroll: 3 });
  });

  test('pages a senior tool in when the walk reaches it', () => {
    // index 5 is the third senior tool; the window shows the first two.
    expect(stepToolbarHighlight(4, 1, row)).toEqual({ index: 5, scroll: 1 });
    // and walking back past the window's start pages it back.
    expect(stepToolbarHighlight(5, -1, { ...row, scroll: 2 })).toEqual({
      index: 4,
      scroll: 1,
    });
  });

  test('a walk inside the quick tools leaves the senior window alone', () => {
    expect(stepToolbarHighlight(0, 1, { ...row, scroll: 2 })).toEqual({
      index: 1,
      scroll: 2,
    });
  });

  test('an empty toolbar highlights nothing', () => {
    expect(
      stepToolbarHighlight(-1, 1, { quick: 0, senior: 0, scroll: 0, size: 0 })
    ).toEqual({ index: -1, scroll: 0 });
  });
});

describe('createPopper', () => {
  test('onClose fires when dispose starts, onDispose after the transition', () => {
    const reference = document.createElement('div');
    reference.attachShadow({ mode: 'open' });
    document.body.append(reference);
    const onClose = vi.fn();
    const onDispose = vi.fn();

    const popper = createPopper('div', reference, { onClose, onDispose });
    popper.dispose();

    expect(onClose).toHaveBeenCalledTimes(1);
    expect(onDispose).not.toHaveBeenCalled();
    popper.element.dispatchEvent(new Event('transitionend'));
    expect(onDispose).toHaveBeenCalledTimes(1);
    reference.remove();
  });
});
