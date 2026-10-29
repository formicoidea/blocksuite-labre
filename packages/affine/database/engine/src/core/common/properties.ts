import {
  menu,
  popMenu,
  type PopupTarget,
  popupTargetFromElement,
} from '@labre/affine-components/context-menu';
import { SignalWatcher, WithDisposable } from '@labre/global/lit';
import { InvisibleIcon, PlusIcon, ViewIcon } from '@blocksuite/icons/lit';
import { ShadowlessElement } from '@labre/std';
import { computed } from '@preact/signals-core';
import { cssVarV2 } from '@toeverything/theme/v2';
import { css, html, nothing, unsafeCSS } from 'lit';
import { property, query } from 'lit/decorators.js';
import { classMap } from 'lit/directives/class-map.js';
import { repeat } from 'lit/directives/repeat.js';

import {
  DATA_VIEW_NEW_PROPERTY,
  DATA_VIEW_PROPERTIES,
  DATA_VIEW_PROPERTY_TYPE,
  DATA_VIEW_HIDE_ALL,
  DATA_VIEW_SHOW_ALL,
} from '../../translations.js';
import { dragHandler } from '../utils/wc-dnd/dnd-context.js';
import { defaultActivators } from '../utils/wc-dnd/sensors/index.js';
import {
  createSortContext,
  sortable,
} from '../utils/wc-dnd/sort/sort-context.js';
import { verticalListSortingStrategy } from '../utils/wc-dnd/sort/strategies/index.js';
import type { Property } from '../view-manager/property.js';
import type { SingleView } from '../view-manager/single-view.js';
import { englishWording, type Wording } from '../utils/wording.js';
import { popNewPropertyMenu, popPropertyMenu } from './property-menu.js';

/**
 * The properties of a view, as the view options' "Properties" and the
 * database's side panel (`affine-database-properties-panel`) both draw
 * them: one row per property of the source, in this view's order.
 *
 * - The eye hides or shows the property in this view only, the drag bar
 *   reorders it in this view only.
 * - A click on the row opens the property's own menu, the one the table's
 *   column header opens (`propertyMenuItems`): rename, type, duplicate
 *   and delete write the data source, so every view sees them. Kanban,
 *   gallery and list have no column header; this row is their way in.
 * - "New property" adds one at the end of the source through the type
 *   picker of the virtual table header and the record detail, then opens
 *   its menu for the rename.
 *
 * Read-only (the view or its source), a click opens nothing and "New
 * property" is not drawn, as the header does. The title follows the menu's
 * own rules (no type change, no hide, no delete).
 */
export class DataViewPropertiesSettingView extends SignalWatcher(
  WithDisposable(ShadowlessElement)
) {
  static override styles = css`
    .properties-group-header {
      user-select: none;
      padding: 4px 12px 12px 12px;
      margin-bottom: 12px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      border-bottom: 1px solid ${unsafeCSS(cssVarV2.layer.insideBorder.border)};
    }

    .properties-group-title {
      font-size: 12px;
      line-height: 20px;
      color: var(--affine-text-secondary-color);
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .properties-group-op {
      padding: 4px 8px;
      font-size: 12px;
      line-height: 20px;
      font-weight: 500;
      border-radius: 4px;
      cursor: pointer;
      color: ${unsafeCSS(cssVarV2.button.primary)};
    }

    .properties-group-op:hover {
      background-color: var(--affine-hover-color);
    }

    .properties-group {
      min-height: 40px;
    }

    .property-item {
      padding: 4px;
      display: flex;
      align-items: center;
      gap: 8px;
      user-select: none;
      cursor: pointer;
      border-radius: 4px;
    }

    .property-item-drag-bar {
      width: 4px;
      height: 12px;
      border-radius: 1px;
      background-color: var(--affine-border-color);
    }

    .property-item:hover .property-item-drag-bar {
      background-color: var(--affine-placeholder-color);
    }

    .property-item-icon {
      display: flex;
      align-items: center;
    }

    .property-item-icon svg {
      color: var(--affine-icon-color);
      fill: var(--affine-icon-color);
      width: 20px;
      height: 20px;
    }

    .property-item-op-icon {
      display: flex;
      align-items: center;
      border-radius: 4px;
    }

    .property-item-op-icon:hover {
      background-color: var(--affine-hover-color);
    }

    .property-item-op-icon.disabled:hover {
      background-color: transparent;
    }

    .property-item-op-icon svg {
      fill: var(--affine-icon-color);
      color: var(--affine-icon-color);
      width: 20px;
      height: 20px;
    }

    .property-item-op-icon.disabled svg {
      fill: var(--affine-text-disable-color);
      color: var(--affine-text-disable-color);
    }

    .property-item-name {
      font-size: 14px;
      line-height: 22px;
      flex: 1;
    }

    .property-item:hover {
      background-color: var(--affine-hover-color);
    }

    .property-item-new {
      color: var(--affine-text-secondary-color);
    }

    .property-item-new .property-item-icon {
      padding-left: 12px;
    }
  `;

  @property({ attribute: false })
  accessor view!: SingleView;

  items$ = computed(() => {
    return this.view.propertiesRaw$.value.map(property => property.id);
  });

  private readonly _openMenu = (property: Property, row: HTMLElement) => {
    if (this.view.readonly$.value) return;
    popPropertyMenu(
      popupTargetFromElement(row),
      property,
      { wording: this.wording },
      { beside: true }
    );
  };

  private readonly _newProperty = (event: MouseEvent) => {
    if (this.view.readonly$.value) return;
    const button = event.currentTarget as HTMLElement;
    popNewPropertyMenu(popupTargetFromElement(button), this.view, {
      title: this.wording(DATA_VIEW_PROPERTY_TYPE),
      wording: this.wording,
      onAdd: id => {
        this.updateComplete
          .then(() => {
            const row = this.querySelector<HTMLElement>(
              `.property-item[data-property-id="${CSS.escape(id)}"]`
            );
            row?.scrollIntoView({ block: 'nearest' });
            this._openMenu(this.view.propertyGetOrCreate(id), row ?? button);
          })
          .catch(console.error);
      },
    });
  };

  renderProperty = (property: Property) => {
    const icon = property.hide$.value ? InvisibleIcon() : ViewIcon();
    // The eye and the drag bar keep their own gesture: the row's click is
    // the property's menu, so they stop it.
    const changeVisible = (event: MouseEvent) => {
      event.stopPropagation();
      if (property.hideCanSet) {
        property.hideSet(!property.hide$.value);
      }
    };
    const classList = classMap({
      'property-item-op-icon': true,
      disabled: !property.hideCanSet,
    });
    return html` <div
      ${dragHandler(property.id)}
      ${sortable(property.id)}
      class="property-item"
      data-testid="data-view-property-item"
      data-property-id="${property.id}"
      @click="${(event: MouseEvent) =>
        this._openMenu(property, event.currentTarget as HTMLElement)}"
    >
      <div
        class="property-item-drag-bar"
        @click="${(event: MouseEvent) => event.stopPropagation()}"
      ></div>
      <uni-lit class="property-item-icon" .uni="${property.icon}"></uni-lit>
      <div class="property-item-name">${property.name$.value}</div>
      <div
        class="${classList}"
        data-testid="data-view-property-visibility"
        @click="${changeVisible}"
      >
        ${icon}
      </div>
    </div>`;
  };

  private _renderNewProperty() {
    if (this.view.readonly$.value) return nothing;
    return html`<div
      class="property-item property-item-new"
      data-testid="data-view-properties-new"
      @click="${this._newProperty}"
    >
      <div class="property-item-icon">${PlusIcon()}</div>
      <div class="property-item-name">
        ${this.wording(DATA_VIEW_NEW_PROPERTY)}
      </div>
    </div>`;
  }

  sortContext = createSortContext({
    activators: defaultActivators,
    container: this,
    onDragEnd: evt => {
      const over = evt.over;
      const activeId = evt.active.id;
      if (over && over.id !== activeId) {
        const properties = this.items$.value;
        const activeIndex = properties.findIndex(id => id === activeId);
        const overIndex = properties.findIndex(id => id === over.id);

        this.view.propertyGetOrCreate(activeId).move(
          activeIndex > overIndex
            ? {
                before: true,
                id: over.id,
              }
            : {
                before: false,
                id: over.id,
              }
        );
      }
    },
    modifiers: [
      ({ transform }) => {
        return {
          ...transform,
          x: 0,
        };
      },
    ],
    items: this.items$,
    strategy: verticalListSortingStrategy,
  });

  private itemsGroup() {
    return this.view.propertiesRaw$.value;
  }

  override connectedCallback() {
    super.connectedCallback();
    this._disposables.addFromEvent(this, 'pointerdown', e => {
      e.stopPropagation();
    });
  }

  override render() {
    const items = this.itemsGroup();
    return html`
      <div class="properties-group">
        ${repeat(items, v => v.id, this.renderProperty)}
      </div>
      ${this._renderNewProperty()}
    `;
  }

  @query('.properties-group')
  accessor groupContainer!: HTMLElement;

  @property({ attribute: false })
  accessor onBack: (() => void) | undefined = undefined;

  /**
   * The list draws inside a popup or a host's panel, outside the editor's
   * context: its opener resolves the words (`wordingOf(std)`).
   */
  @property({ attribute: false })
  accessor wording: Wording = englishWording;
}

declare global {
  interface HTMLElementTagNameMap {
    'data-view-properties-setting': DataViewPropertiesSettingView;
  }
}

export const popPropertiesSetting = (
  target: PopupTarget,
  props: {
    view: SingleView;
    onClose?: () => void;
    onBack?: () => void;
    wording?: Wording;
  }
) => {
  popMenu(target, {
    options: {
      title: {
        text: (props.wording ?? englishWording)(DATA_VIEW_PROPERTIES),
        onBack: props.onBack,
        postfix: () => {
          const items = props.view.propertiesRaw$.value;
          const isAllShowed = items.every(property => !property.hide$.value);
          const clickChangeAll = () => {
            items.forEach(property => {
              if (property.hideCanSet) {
                property.hideSet(isAllShowed);
              }
            });
          };
          return html` <div
            class="properties-group-op"
            @click="${clickChangeAll}"
          >
            ${(props.wording ?? englishWording)(
              isAllShowed ? DATA_VIEW_HIDE_ALL : DATA_VIEW_SHOW_ALL
            )}
          </div>`;
        },
      },
      items: [
        menu.group({
          items: [
            () =>
              html` <data-view-properties-setting
                .view="${props.view}"
                .wording="${props.wording ?? englishWording}"
              ></data-view-properties-setting>`,
          ],
        }),
      ],
    },
  });

  // const view = new DataViewPropertiesSettingView();
  // view.view = props.view;
  // view.onBack = () => {
  //   close();
  //   props.onBack?.();
  // };
  // const close = createPopup(target, view, { onClose: props.onClose });
};
