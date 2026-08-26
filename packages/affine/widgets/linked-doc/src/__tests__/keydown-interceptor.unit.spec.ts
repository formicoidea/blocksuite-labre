/**
 * The `@` popover used to vanish when the user switched keyboard layout —
 * upstream #13867. On Windows and Linux, Alt+Shift arrives as a keydown whose
 * `key` is `GroupNext` / `GroupPrevious`; the shared keydown observer reads
 * "modifier plus another key" as a reason to abort, and the popover closed
 * mid-search, taking the typed query with it.
 *
 * The interceptor is what stands between that keydown and the observer, so it
 * is what these tests exercise: `next` is the observer, and calling it is
 * exactly what must NOT happen for a layout switch.
 */
import { describe, expect, it, vi } from 'vitest';

import { createLinkedDocKeydownInterceptor } from '../utils.js';

/** The interceptor plus the two witnesses that say what it decided. */
function interceptorUnderTest() {
  const close = vi.fn();
  const next = vi.fn();
  const intercept = createLinkedDocKeydownInterceptor(close);

  const press = (init: KeyboardEventInit) => {
    const event = new KeyboardEvent('keydown', {
      cancelable: true,
      ...init,
    });
    const stopPropagation = vi.spyOn(event, 'stopPropagation');
    intercept(event, next);
    return { event, stopPropagation };
  };

  return { close, next, press };
}

describe('linked doc popover keydown interceptor', () => {
  it.each(['GroupNext', 'GroupPrevious'])(
    'swallows %s, the keyboard layout switch, without closing',
    key => {
      const { close, next, press } = interceptorUnderTest();
      const { stopPropagation } = press({ key, altKey: true, shiftKey: true });

      // Reaching `next` is what aborted the observer and closed the popover.
      expect(next).not.toHaveBeenCalled();
      expect(close).not.toHaveBeenCalled();
      expect(stopPropagation).toHaveBeenCalled();
    }
  );

  it('closes on Escape', () => {
    const { close, next, press } = interceptorUnderTest();
    const { event } = press({ key: 'Escape' });

    expect(close).toHaveBeenCalledOnce();
    expect(next).not.toHaveBeenCalled();
    expect(event.defaultPrevented).toBe(true);
  });

  it.each(['ArrowLeft', 'ArrowRight'])('keeps the caret still on %s', key => {
    const { close, next, press } = interceptorUnderTest();
    const { event } = press({ key });

    expect(event.defaultPrevented).toBe(true);
    expect(next).not.toHaveBeenCalled();
    expect(close).not.toHaveBeenCalled();
  });

  it('hands every other key to the observer', () => {
    const { close, next, press } = interceptorUnderTest();
    press({ key: 'a' });

    expect(next).toHaveBeenCalledOnce();
    expect(close).not.toHaveBeenCalled();
  });
});
