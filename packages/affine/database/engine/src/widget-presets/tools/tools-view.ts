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

  @media print {
    .affine-database-toolbar {
      display: none;
    }
  }
`;

export class DataViewHeaderTools extends WidgetBase {
  static override styles = styles;

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
    return html` <div class="${classList}">
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
