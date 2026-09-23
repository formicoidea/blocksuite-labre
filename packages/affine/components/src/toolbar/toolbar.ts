import { panelBaseStyle } from '@labre/affine-shared/styles';
import { stopPropagation } from '@labre/affine-shared/utils';
import { WithDisposable } from '@labre/global/lit';
import { css, html, LitElement } from 'lit';

import { EDITOR_MENU_TOGGLE } from './menu-button.js';

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
       syncOpenMenus below, which is what raises this attribute. */
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

  /** The panels open in this row right now, whatever opened them. */
  readonly #openMenus = new Set<Element>();

  /**
   * Says, on the row itself, whether one of its panels is open.
   *
   * Why an attribute at all: the row cannot ask the question in CSS. `:host()`
   * takes a COMPOUND selector and `:has()` is not one, so
   * `:host(:has([data-open]))` is not a rule browsers honour (Chromium
   * 2026-09: it matches from the document, never from inside the shadow root).
   *
   * Why not a `querySelector` for `data-open`, which the buttons do raise:
   * because it answers only for the buttons the row holds DIRECTLY. A colour
   * picker keeps its menu button inside its own shadow root, where neither a
   * `querySelector` nor a `MutationObserver` of this row can see it — and that
   * is the row whose panel the clip was cutting in half
   * (`framework-palette-carousel.spec.ts`). {@link EDITOR_MENU_TOGGLE} is
   * composed, so it crosses every boundary, and it is raised before the panel
   * is ever positioned.
   *
   * A panel whose button is taken off the row by a re-render never says it
   * closed, so the set is swept of anything no longer in a document.
   */
  #syncOpenMenus() {
    for (const menu of this.#openMenus) {
      if (!menu.isConnected) this.#openMenus.delete(menu);
    }

    if (this.#openMenus.size > 0) this.dataset.menuOpen = 'true';
    else delete this.dataset.menuOpen;
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
    this._disposables.addFromEvent(this, EDITOR_MENU_TOGGLE, (e: Event) => {
      // The deepest element of the path, not `target`: a composed event that
      // crosses a shadow boundary is retargeted to the host it came out of,
      // and one host may hold more than one panel.
      const menu = e.composedPath()[0];
      if (!(menu instanceof Element)) return;

      if ((e as CustomEvent<boolean>).detail) this.#openMenus.add(menu);
      else this.#openMenus.delete(menu);

      this.#syncOpenMenus();
    });
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
