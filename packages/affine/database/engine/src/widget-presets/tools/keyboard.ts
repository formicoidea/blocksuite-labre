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

/**
 * The keydown listener of a bar of such controls (the view toolbar, the
 * views bar, the quick-setting bar), on the element holding them. The view's
 * own keys listen on the document for its selection: with a cell still
 * selected, Tab on a control moved to the next cell instead of the next
 * control, and a letter or Backspace edited the cell (#678). A bar takes the
 * keys of its own model, and only in keyboard mode (the product owner's
 * rule, `hasKeyboardFocus`):
 * - Tab and Shift+Tab on a control always move the focus (the browser's);
 * - in a text field (the toolbar's search), every key but Escape is the
 *   field's, shortcuts included: Ctrl/Cmd+A selects the search text and
 *   Ctrl/Cmd+Z undoes the typing, where the view would select every row or
 *   undo the document (#730, upstream toeverything/AFFiNE#15900);
 * - on a control the user tabbed to, every unmodified key but Escape is
 *   the bar's;
 * - Escape is never stopped here: a control gives it no meaning, and a
 *   document listener (the open popups' Escape, a host's menu) needs it;
 *   the search field decides for itself (`DataViewHeaderToolsSearch`).
 * Outside a text field, shortcuts with Ctrl, Meta or Alt (undo, redo, a
 * host's) always go through.
 */
export function keepKeysInBar(event: KeyboardEvent) {
  if (event.key === 'Escape') return;
  const target = event.target as HTMLElement;
  if (isTextField(target)) {
    event.stopPropagation();
    return;
  }
  if (event.ctrlKey || event.metaKey || event.altKey) return;
  if (event.key === 'Tab' || hasKeyboardFocus(target)) {
    event.stopPropagation();
  }
}

function isTextField(target: HTMLElement): boolean {
  return (
    target instanceof HTMLInputElement ||
    target instanceof HTMLTextAreaElement ||
    target.isContentEditable
  );
}

/**
 * The pointerdown listener of a bar of such controls, on the element holding
 * them: a pointer press on a control moves the focus exactly as on 4.0.0,
 * when the controls had no `tabindex` (the product owner's rule, #678: after
 * a mouse gesture the content behaves as before). The press blurred the
 * focused element, so an editing cell committed, and the browser focused
 * the nearest focusable ancestor; the menu the click opened then took the
 * focus. A `tabindex` control would take that focus itself instead, and a
 * cell left in editing took it back later (a typed letter then erased a
 * number cell). For the length of the press the control has no `tabindex`,
 * so the browser does what it did; the attribute comes back when the press
 * ends, after a mouse's mousedown has moved the focus.
 * ponytail: a touch tap's compatibility mousedown comes after `pointerup`,
 * so a tap still focuses the control (no `:focus-visible`, so the bar takes
 * no key there); hold the attribute until `click` if a phone with a
 * keyboard ever needs the 4.0.0 focus.
 */
export function focusAsBeforeOnPress(event: PointerEvent) {
  const bar = event.currentTarget as HTMLElement;
  const control = (event.target as Element).closest<HTMLElement>('[tabindex]');
  if (!control || control === bar || !bar.contains(control)) return;
  const tabindex = control.getAttribute('tabindex')!;
  control.removeAttribute('tabindex');
  const pressEnd = new AbortController();
  const restore = () => {
    pressEnd.abort();
    control.setAttribute('tabindex', tabindex);
  };
  const options = { capture: true, signal: pressEnd.signal };
  window.addEventListener('pointerup', restore, options);
  window.addEventListener('pointercancel', restore, options);
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
 * - when the opener itself left with what the menu did (the last view
 *   deleted from its "⋯", or a view added from the empty state's button),
 *   give it to what the renderer draws next (`DataViewRootUI.restoreFocus`:
 *   the empty state's button, or the new view's "⋯"), so the focus never
 *   falls to the body (ADR 0035 amendment of 2026-11-20).
 *
 * Without an opener (a mouse click), no focus is moved: focusing the
 * control would paint its ring under a pointer.
 */
export function popupTargetReturningFocus(
  anchor: HTMLElement,
  opener: HTMLElement | undefined
): PopupTarget {
  const target = popupTargetFromElement(anchor);
  // Found while the opener is in it: once it has left, it has no parent.
  const root = opener?.closest('affine-data-view-renderer');
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
        queueMicrotask(async () => {
          const active = document.activeElement;
          if (active && active !== document.body) return;
          if (opener.isConnected) {
            opener.focus();
            return;
          }
          if (!root?.isConnected) return;
          // A microtask has no caller to reject to: an element of the view
          // whose update threw would surface as an unhandled rejection.
          try {
            await root.restoreFocus();
          } catch (error) {
            console.error(error);
          }
        });
      };
    },
  };
}
