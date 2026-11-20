import { IS_MOBILE } from '@labre/global/env';
import { css, html } from 'lit';
import { property, state } from 'lit/decorators.js';
import { classMap } from 'lit/directives/class-map.js';
import { repeat } from 'lit/directives/repeat.js';

import { type DataViewInstance, renderUniLit } from '../../core/index.js';
import { PageLayoutKey } from '../../core/view-manager/page-layout.js';
import type { SingleView } from '../../core/view-manager/single-view.js';
import type { ViewManager } from '../../core/view-manager/view-manager.js';
import type { DataViewWidget } from '../../core/widget/types.js';
import { WidgetBase } from '../../core/widget/widget-base.js';
import { hasKeyboardFocus } from './keyboard.js';

const styles = css`
  .affine-database-toolbar {
    display: flex;
    align-items: center;
    gap: 6px;
    opacity: 0;
    transition: opacity 150ms cubic-bezier(0.42, 0, 1, 1);
  }

  .toolbar-hover-container:hover .affine-database-toolbar {
    visibility: visible;
    opacity: 1;
  }
  .toolbar-hover-container:has(.active) .affine-database-toolbar {
    visibility: visible;
    opacity: 1;
  }
  /* Never invisible while one of its controls holds the focus (#678). */
  .affine-database-toolbar:focus-within {
    visibility: visible;
    opacity: 1;
  }

  .show-toolbar {
    visibility: visible;
    opacity: 1;
  }

  /* The keyboard focus of every control (#678): the opaque 2px ring of the
     library's keyboard highlight (edgeless toolbar), drawn inside the box so
     the search field's clipping container never cuts it. */
  .affine-database-toolbar [role='button']:focus-visible,
  .affine-database-toolbar button:focus-visible {
    outline: 2px solid var(--affine-primary-color);
    outline-offset: -2px;
  }
  /* On a phone with a keyboard, "+" is filled with the same blue: the ring
     goes around it, on the toolbar's background. */
  .affine-database-toolbar .new-record-phone:focus-visible {
    outline-offset: 2px;
  }

  @media print {
    .affine-database-toolbar {
      display: none;
    }
  }
`;

export class DataViewHeaderTools extends WidgetBase {
  static override styles = styles;

  /**
   * The view's own keys listen on the document for its selection: with a
   * cell still selected, Tab on a control moved to the next cell instead of
   * the next control, and a letter or Backspace edited the cell (#678).
   * The toolbar takes the keys of its own model, and only in keyboard mode
   * (the product owner's rule, `hasKeyboardFocus`):
   * - Tab and Shift+Tab on a control always move the focus (the browser's);
   * - in the search field, every key but Escape is the field's;
   * - on a control the user tabbed to, every unmodified key but Escape is
   *   the toolbar's;
   * - Escape is never stopped here: a control gives it no meaning, and a
   *   document listener (the open popups' Escape, a host's menu) needs it;
   *   the search field decides for itself (`DataViewHeaderToolsSearch`).
   * Shortcuts with Ctrl, Meta or Alt (undo, a host's) always go through.
   */
  private readonly _keepKeysInToolbar = (event: KeyboardEvent) => {
    if (event.ctrlKey || event.metaKey || event.altKey) return;
    if (event.key === 'Escape') return;
    const target = event.target as HTMLElement;
    if (
      event.key === 'Tab' ||
      target instanceof HTMLInputElement ||
      hasKeyboardFocus(target)
    ) {
      event.stopPropagation();
    }
  };

  /**
   * A pointer press on a control moves the focus exactly as on 4.0.0, when
   * the controls had no `tabindex` (the product owner's rule, #678: after a
   * mouse gesture the content behaves as before). The press blurred the
   * focused element, so an editing cell committed, and the browser focused
   * the nearest focusable ancestor; the menu the click opened then took the
   * focus. A `tabindex` control would take that focus itself instead, and a
   * cell left in editing took it back later (a typed letter then erased a
   * number cell). For the length of the press the control has no
   * `tabindex`, so the browser does what it did; the attribute comes back
   * when the press ends, after a mouse's mousedown has moved the focus.
   * ponytail: a touch tap's compatibility mousedown comes after
   * `pointerup`, so a tap still focuses the control (no `:focus-visible`,
   * so the toolbar takes no key there); hold the attribute until `click` if
   * a phone with a keyboard ever needs the 4.0.0 focus.
   */
  private readonly _focusAsBeforeOnPress = (event: PointerEvent) => {
    const control = (event.target as Element).closest<HTMLElement>(
      '[tabindex]'
    );
    if (!control || control === this || !this.contains(control)) return;
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
  };

  override render() {
    // Shown at rest on a phone, and where the views are the page itself (a
    // database's full page, `PageLayoutKey`), as Notion shows a full-page
    // database (#678); inline in a text, it waits for the pointer or focus.
    const pageLayout = !!this.view.serviceGet(PageLayoutKey)?.value;
    const classList = classMap({
      'show-toolbar': IS_MOBILE || pageLayout,
      'affine-database-toolbar': true,
    });
    const tools = this.toolsMap[this.view.type];
    return html` <div
      class="${classList}"
      @keydown="${this._keepKeysInToolbar}"
      @pointerdown="${this._focusAsBeforeOnPress}"
    >
      ${repeat(tools ?? [], uni => {
        return renderUniLit(uni, {
          dataViewLogic: this.dataViewLogic,
        });
      })}
    </div>`;
  }

  @state()
  accessor showToolBar = false;

  @property({ attribute: false })
  accessor toolsMap!: Record<string, DataViewWidget[]>;
}

declare global {
  interface HTMLElementTagNameMap {
    'data-view-header-tools': DataViewHeaderTools;
  }
}
export const renderTools = (
  view: SingleView,
  viewMethods: DataViewInstance,
  viewSource: ViewManager
) => {
  return html` <data-view-header-tools
    .viewMethods="${viewMethods}"
    .view="${view}"
    .viewSource="${viewSource}"
  ></data-view-header-tools>`;
};
