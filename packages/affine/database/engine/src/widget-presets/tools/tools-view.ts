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
   * - in the search field, every key is the field's;
   * - on a control the user tabbed to, every unmodified key is the toolbar's;
   * - on a control focused by a mouse click, keys go on to the view, as they
   *   did before.
   * Shortcuts with Ctrl, Meta or Alt (undo, a host's) always go through.
   */
  private readonly _keepKeysInToolbar = (event: KeyboardEvent) => {
    if (event.ctrlKey || event.metaKey || event.altKey) return;
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
   * A click on a control leaves the focus where it was (the product owner's
   * rule, #678): a `tabindex="0"` control would take it on mousedown, away
   * from the table's own focus, which reads the keys of its selected cell,
   * so a letter typed after a click on "New"'s arrow no longer edited the
   * cell, as it did before the controls were focusable. The search field
   * keeps its mousedown, which places its caret.
   */
  private readonly _keepFocusOnClick = (event: MouseEvent) => {
    if (event.target instanceof HTMLInputElement) return;
    event.preventDefault();
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
      @mousedown="${this._keepFocusOnClick}"
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
