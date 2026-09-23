import { panelBaseStyle } from '@labre/affine-shared/styles';
import { stopPropagation } from '@labre/affine-shared/utils';
import { WithDisposable } from '@labre/global/lit';
import { css, html, LitElement } from 'lit';

export class EditorToolbar extends WithDisposable(LitElement) {
  static override styles = css`
    ${panelBaseStyle(':host')}
    :host {
      /* ONE line, always: the toolbar's height never depends on the selection,
         so it never moves under the cursor. When the row runs out of room the
         widget spends its entries — icon only first, then into the "⋮" menu —
         rather than growing a second row (PO arbitration of 02/08/2026). */
      height: 36px;
      box-sizing: content-box;
      flex-wrap: nowrap;
      /* And never outside its own background. The row's width is a max-width
         the positioner writes; entries keep their natural width (below), so a
         row that has nothing left to give up would otherwise paint its last
         icons over the document, past the border and the shadow — which is
         what a 420px window used to show.

         Clipped on the X axis alone: overflow-x hidden would make the row a
         scroll container on BOTH axes (a visible paired with a hidden computes
         to auto) and swallow the dropdown panels, which are positioned inside
         the row and hang above and below it. */
      overflow-x: clip;
      overflow-y: visible;
    }

    /* ...except while one of those panels is open. A clipping box is also what
       floating-ui fits a panel into, so left in place the rule above would
       squeeze a 176px menu into the width of the row that opened it — or, for
       a dropdown at one end of the row, cut half of it off. See
       watchOpenMenus below, which is what raises this attribute. */
    :host([data-menu-open]) {
      overflow: visible;
    }

    :host([data-without-bg]) {
      border-color: transparent;
      background: transparent;
      box-shadow: none;
    }

    ::slotted(*) {
      display: flex;
      height: 100%;
      /* Entries keep their natural width: squashing them into the row would
         hide the overflow the widget has to measure, and a button squeezed to
         half a word is worse than the same button in the "⋮" menu. */
      flex-shrink: 0;
      justify-content: center;
      align-items: center;
      gap: 8px;
      color: var(--affine-text-primary-color);
      fill: currentColor;
    }
  `;

  /**
   * Says, on the row itself, whether one of its menus is open.
   *
   * `data-open` is raised by {@link EditorMenuButton} on the button, before the
   * panel is ever positioned, and is already the toolbar widget's own handle on
   * an open menu — so the state exists; it is only in the wrong place. The row
   * cannot read it where it is: `:host()` takes a COMPOUND selector and `:has()`
   * is not one, so `:host(:has([data-open]))` is not a rule browsers honour
   * (Chromium 2026-09: it matches from the document, never from inside the
   * shadow root). Hence an attribute on the host, mirrored here.
   *
   * A MutationObserver rather than an event: `toggle` does not bubble, and this
   * has to be right for every way a menu can close — including the widget
   * hiding one from the outside, and a re-render taking an open button off the
   * row.
   */
  #watchOpenMenus() {
    const sync = () => {
      if (this.querySelector('[data-open]')) this.dataset.menuOpen = 'true';
      else delete this.dataset.menuOpen;
    };

    // Microtask-timed, so the attribute is on the host before the panel's own
    // positioning reads the clipping boxes — and re-read every frame after
    // that by the panel's `autoUpdate` in any case.
    const observer = new MutationObserver(sync);
    observer.observe(this, {
      subtree: true,
      childList: true,
      attributes: true,
      // Not `data-menu-open`, which this very callback writes.
      attributeFilter: ['data-open'],
    });

    sync();

    return () => observer.disconnect();
  }

  override connectedCallback() {
    super.connectedCallback();

    this._disposables.addFromEvent(this, 'pointerdown', (e: PointerEvent) => {
      e.stopPropagation();
      e.preventDefault();
    });
    this._disposables.addFromEvent(this, 'wheel', stopPropagation, {
      passive: false,
    });
    this._disposables.add(this.#watchOpenMenus());
  }

  override render() {
    return html`<slot></slot>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'editor-toolbar': EditorToolbar;
  }
}
