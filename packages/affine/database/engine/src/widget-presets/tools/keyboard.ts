import {
  type PopupTarget,
  popupTargetFromElement,
} from '@labre/affine-components/context-menu';

/**
 * The keyboard of the view toolbar's controls (#678, WCAG 2.1.1 and 2.4.3).
 * Its controls are `role="button"` elements with `tabindex="0"`, the way the
 * rest of data-view draws its buttons (a group's chevron), not `<button>`s:
 * "New" is a `data-view-component-button`, and one way for every control.
 */

/**
 * Whether `element` holds the KEYBOARD focus, the user having tabbed to it.
 * The product owner's rule (#678): navigating a toolbar never overrides the
 * keyboard commands of the content, so a toolbar takes the keys of its own
 * model only in keyboard mode. A `tabindex="0"` control also takes the focus
 * on a mouse click; there, the keys stay the view's, as they were before.
 */
export function hasKeyboardFocus(element: Element): boolean {
  return element.matches(':focus-visible');
}

/**
 * Enter or Space on such a control, in keyboard mode (`hasKeyboardFocus`):
 * the click a native button would get, so one click handler serves the
 * mouse and the keyboard. That click's `detail` is 0, as for a native button
 * activated from the keyboard, which is how `keyboardOpener` tells them
 * apart. Stopped here, so the editor's own Enter (a new row under a selected
 * cell) never sees it. A key held down clicks once: its repeats would add a
 * row each on "New".
 */
export function activateOnEnterOrSpace(event: KeyboardEvent) {
  if (event.key !== 'Enter' && event.key !== ' ') return;
  if (event.target !== event.currentTarget) return;
  if (event.isComposing || event.ctrlKey || event.metaKey || event.altKey) {
    return;
  }
  if (!hasKeyboardFocus(event.currentTarget as Element)) return;
  event.preventDefault();
  event.stopPropagation();
  if (event.repeat) return;
  (event.currentTarget as HTMLElement).click();
}

/** The control a click came from, when Enter or Space sent it. */
export function keyboardOpener(event: MouseEvent): HTMLElement | undefined {
  if (event.detail !== 0) return;
  return event.currentTarget as HTMLElement;
}

/** Only on a menu button: `aria-expanded` means nothing on a bare anchor. */
function setExpanded(anchor: HTMLElement, expanded: boolean) {
  if (!anchor.hasAttribute('aria-haspopup')) return;
  anchor.setAttribute('aria-expanded', expanded ? 'true' : 'false');
}

/**
 * `popupTargetFromElement(anchor)`, whose menus:
 * - say they are open on `anchor` (`aria-expanded`, WCAG 4.1.2) while one
 *   is, when `anchor` is a menu button (`aria-haspopup`);
 * - give the focus back to `opener` when they close (Escape included), so a
 *   keyboard user carries on from the control that opened them. Only when
 *   the focus fell to the body with the menu's own field: a host's panel
 *   that took it meanwhile keeps it. The next menu of the same gesture (the
 *   sort panel after a new sort) takes its field's focus a frame later
 *   (`MenuComponent.firstUpdated`), so `opener` holds the focus for that
 *   frame, then the menu has it.
 *
 * Without an opener (a mouse click), no focus is moved: focusing the
 * control would paint its ring under a pointer.
 */
export function popupTargetReturningFocus(
  anchor: HTMLElement,
  opener: HTMLElement | undefined
): PopupTarget {
  const target = popupTargetFromElement(anchor);
  let open = 0;
  return {
    ...target,
    popupStart: () => {
      const end = target.popupStart();
      open++;
      setExpanded(anchor, true);
      let ended = false;
      return () => {
        if (ended) return;
        ended = true;
        end();
        open--;
        if (!open) setExpanded(anchor, false);
        if (!opener) return;
        // The menu is removed right after this callback: look once it is.
        queueMicrotask(() => {
          const active = document.activeElement;
          if (active && active !== document.body) return;
          if (opener.isConnected) opener.focus();
        });
      };
    },
  };
}
