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
 * Enter or Space on such a control: the click a native button would get, so
 * one click handler serves the mouse and the keyboard. That click's `detail`
 * is 0, as for a native button activated from the keyboard, which is how
 * `keyboardOpener` tells them apart. Stopped here, so the editor's own Enter
 * (a new row under a selected cell) never sees it.
 */
export function activateOnEnterOrSpace(event: KeyboardEvent) {
  if (event.key !== 'Enter' && event.key !== ' ') return;
  if (event.target !== event.currentTarget) return;
  if (event.isComposing || event.ctrlKey || event.metaKey || event.altKey) {
    return;
  }
  event.preventDefault();
  event.stopPropagation();
  (event.currentTarget as HTMLElement).click();
}

/** The control a click came from, when Enter or Space sent it. */
export function keyboardOpener(event: MouseEvent): HTMLElement | undefined {
  if (event.detail !== 0) return;
  return event.currentTarget as HTMLElement;
}

/**
 * `popupTargetFromElement(anchor)`, whose menus give the focus back to
 * `opener` when they close (Escape included), so a keyboard user carries on
 * from the control that opened them. Only when the focus fell to the body
 * with the menu's own field: whatever took it meanwhile (a host's panel, the
 * next menu of the same gesture) keeps it. Without an opener (a mouse
 * click), the plain target: focusing the control would paint its ring under
 * a pointer.
 */
export function popupTargetReturningFocus(
  anchor: HTMLElement,
  opener: HTMLElement | undefined
): PopupTarget {
  const target = popupTargetFromElement(anchor);
  if (!opener) return target;
  return {
    ...target,
    popupStart: () => {
      const end = target.popupStart();
      return () => {
        end();
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
