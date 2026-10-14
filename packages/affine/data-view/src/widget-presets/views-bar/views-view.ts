import {
  menu,
  popFilterableSimpleMenu,
  popMenu,
  type PopupTarget,
  popupTargetFromElement,
} from '@labre/affine-components/context-menu';
import {
  type ChromeWording,
  fillPlaceholders,
  TOOLBAR_DELETE,
  TOOLBAR_DUPLICATE,
  translateKey,
} from '@labre/affine-shared/services';
import { type BlockStdScope, stdContext } from '@labre/std';
import {
  DeleteIcon,
  DuplicateIcon,
  InfoIcon,
  MoreHorizontalIcon,
  MoveLeftIcon,
  MoveRightIcon,
  PlusIcon,
} from '@blocksuite/icons/lit';
import { IS_MOBILE } from '@labre/global/env';
import { consume } from '@lit/context';
import { css, html, nothing } from 'lit';
import { property } from 'lit/decorators.js';
import { classMap } from 'lit/directives/class-map.js';

import { modeShownAsFallback } from '../../core/view-manager/single-view.js';
import {
  AddViewMenuIdentifier,
  duplicateAsShownPreset,
  ViewCreationOffKey,
} from '../../core/view-manager/view-creation.js';
import { WidgetBase } from '../../core/widget/widget-base.js';
import {
  VIEW_DUPLICATE_AS_TABLE,
  VIEW_SHOWN_AS_TABLE,
  VIEWS_BAR_ADD_VIEW,
  VIEWS_BAR_EDIT_VIEW,
  VIEWS_BAR_MORE,
  VIEWS_BAR_MOVE_LEFT,
  VIEWS_BAR_MOVE_RIGHT,
  VIEWS_BAR_VIEW_NAME,
} from '../../translations.js';

/** A finger-sized tab, "N more" and "+" on a phone (ADR 0035 §1, B5, B11). */
export const VIEWS_BAR_TOUCH_TARGET = 44;

/**
 * The views bar of a database (ADR 0035 B11, labre PRD REQ-DB-7): one tab per
 * view while the width allows, the rest under "N more", then "+".
 *
 * - The tabs are measured by `component-overflow` (`fitOverflow`): views keep
 *   their order, and the current view's tab is always drawn, in place of the
 *   last one that would have fitted, so the view you look at never hides.
 * - "N more" lists the views without a tab; picking one draws it.
 * - "+" is the bar's only creation entry. It pops the `AddViewMenu` the
 *   `core-database` bundle registers (sources) when there is one, the
 *   creatable presets otherwise. Readonly, or with creation switched off for
 *   the source (`ViewCreationOffKey`, ADR 0035 §5), there is no "+".
 * - On a phone the tabs, "N more" and "+" are 44px tall, nothing else changes.
 *
 * Stays in core: a core-only host must reach every stored view (ADR 0035 §1).
 */
export class DataViewHeaderViews extends WidgetBase {
  static override styles = css`
    data-view-header-views {
      height: 28px;
      display: flex;
      user-select: none;
      gap: 4px;
      min-width: 0;
    }
    data-view-header-views.mobile {
      height: ${VIEWS_BAR_TOUCH_TARGET}px;
    }
    data-view-header-views.mobile .database-view-button {
      min-height: ${VIEWS_BAR_TOUCH_TARGET}px;
      min-width: ${VIEWS_BAR_TOUCH_TARGET}px;
    }
    data-view-header-views .component-overflow-item {
      padding-right: 4px;
    }
    data-view-header-views .component-overflow-more {
      gap: 4px;
    }
    data-view-header-views::-webkit-scrollbar-thumb {
      width: 1px;
    }

    .database-view-button {
      height: 100%;
      cursor: pointer;
      padding: 2px 4px;
      border-radius: 4px;
      font-size: 14px;
      display: flex;
      align-items: center;
      justify-content: center;
      color: var(--affine-text-secondary-color);
      white-space: nowrap;
      max-width: 200px;
      min-width: 28px;
    }

    .database-view-button .name {
      align-items: center;
      font-size: 15px;
      line-height: 24px;
      overflow: hidden;
      text-overflow: ellipsis;
      font-weight: 500;
      padding-right: 2px;
    }

    .database-view-button .icon {
      margin-right: 6px;
      display: block;
      flex-shrink: 0;
    }

    .database-view-button .icon svg {
      width: 16px;
      height: 16px;
    }

    .database-view-button.selected {
      color: var(--affine-text-primary-color);
      background-color: var(--affine-hover-color-filled);
    }

    .database-view-button .shown-as {
      font-size: 12px;
      color: var(--affine-text-secondary-color);
      padding-right: 2px;
    }
  `;

  // Absent outside an editor host (a standalone mount): wordings fall back.
  @consume({ context: stdContext })
  accessor std!: BlockStdScope;

  /** A popup renders outside the host, so wordings are resolved here. */
  private wording(wording: ChromeWording) {
    return this.std ? translateKey(this.std, ...wording) : wording[1];
  }

  /** The host switched view creation off for this source (ADR 0035 §5). */
  private get creationOff() {
    return this.dataSource.serviceGet(ViewCreationOffKey) === true;
  }

  private readonly addView = (type: string) => {
    const id = this.viewManager.viewAdd(type);
    this.viewManager.setCurrentView(id);
    this.onChangeView?.(id);
    this.dataViewLogic.root.config.eventTrace('AddDatabaseView', {
      type: type,
    });
    return id;
  };

  private presetItems() {
    return this.dataSource.viewMetas.map(v => {
      return menu.action({
        name: v.model.defaultName,
        testId: 'database-add-view-preset',
        prefix: html`<uni-lit .uni=${v.renderer.icon}></uni-lit>`,
        select: () => {
          this.addView(v.type);
        },
      });
    });
  }

  _addViewMenu = (event: MouseEvent) => {
    const items =
      this.std?.getOptional(AddViewMenuIdentifier)?.items({
        std: this.std,
        dataSource: this.dataSource,
        viewManager: this.viewManager,
        addView: this.addView,
      }) ?? this.presetItems();
    popFilterableSimpleMenu(
      popupTargetFromElement(event.currentTarget as HTMLElement),
      items
    );
  };

  _showMore = (event: MouseEvent, hidden: readonly string[]) => {
    popFilterableSimpleMenu(
      popupTargetFromElement(event.currentTarget as HTMLElement),
      [
        menu.group({
          items: hidden.flatMap(id => {
            const openViewOption = (event: MouseEvent) => {
              event.stopPropagation();
              this.openViewOption(
                popupTargetFromElement(event.currentTarget as HTMLElement),
                id
              );
            };
            const view = this.viewManager.viewGet(id);
            if (!view) {
              return [];
            }
            return menu.action({
              prefix: html`<uni-lit
                .uni=${this.getRenderer(id)?.icon}
              ></uni-lit>`,
              name: view.name$.value ?? '',
              label: () => html`${view.name$.value}`,
              isSelected: this.viewManager.currentViewId$.value === id,
              testId: 'database-views-more-item',
              select: () => {
                this.viewManager.setCurrentView(id);
                this.onChangeView?.(id);
              },
              postfix: html`<div
                class="dv-hover dv-round-4"
                @click="${openViewOption}"
                style="display:flex;align-items:center;"
              >
                ${MoreHorizontalIcon()}
              </div>`,
            });
          }),
        }),
      ]
    );
  };

  openViewOption = (target: PopupTarget, id: string) => {
    if (this.readonly) {
      return;
    }
    const views = this.viewManager.views$.value;
    const index = views.findIndex(v => v === id);
    const viewId = views[index];
    if (!viewId) {
      return;
    }
    const view = this.viewManager.viewGet(viewId);
    if (!view) {
      return;
    }
    // A view drawn through a fallback preset has read-only settings and data
    // that is never rewritten (ADR 0035 §6): no rename, no settings, and
    // "Duplicate as table" in place of a duplicate of a mode we cannot draw.
    const fallback = view.shownAsFallback$.value;
    popMenu(target, {
      options: {
        items: [
          ...(fallback
            ? []
            : [
                menu.input({
                  initialValue: view.name$.value,
                  placeholder: this.wording(VIEWS_BAR_VIEW_NAME),
                  onChange: text => {
                    view.nameSet(text);
                  },
                }),
              ]),
          menu.group({
            items: [
              menu.action({
                name: this.wording(VIEWS_BAR_EDIT_VIEW),
                hide: () => fallback,
                prefix: InfoIcon(),
                select: () => {
                  this.closest('affine-data-view-renderer')
                    ?.querySelector('data-view-header-tools-view-options')
                    ?.openMoreAction(target);
                },
              }),
              menu.action({
                name: this.wording(VIEWS_BAR_MOVE_LEFT),
                hide: () => index === 0,
                prefix: MoveLeftIcon(),
                select: () => {
                  const targetId = views[index - 1];
                  this.viewManager.moveTo(
                    id,
                    targetId ? { before: true, id: targetId } : 'start'
                  );
                },
              }),
              menu.action({
                name: this.wording(VIEWS_BAR_MOVE_RIGHT),
                prefix: MoveRightIcon(),
                hide: () => index === views.length - 1,
                select: () => {
                  const targetId = views[index + 1];
                  this.viewManager.moveTo(
                    id,
                    targetId ? { before: false, id: targetId } : 'end'
                  );
                },
              }),
            ],
          }),
          menu.group({
            items: [
              menu.action({
                name: this.wording(TOOLBAR_DUPLICATE),
                hide: () => fallback,
                prefix: DuplicateIcon(),
                select: () => {
                  this.viewManager.viewDuplicate(id);
                },
              }),
              menu.action({
                name: this.wording(VIEW_DUPLICATE_AS_TABLE),
                hide: () => !fallback,
                prefix: DuplicateIcon(),
                testId: 'database-view-duplicate-as-table',
                select: () => {
                  duplicateAsShownPreset(this.viewManager, id);
                },
              }),
              menu.action({
                name: this.wording(TOOLBAR_DELETE),
                prefix: DeleteIcon(),
                select: () => {
                  view.delete();
                },
                class: { 'delete-item': true },
              }),
            ],
          }),
        ],
      },
    });
  };

  renderMore = (_count: number, hiddenIndices: readonly number[]) => {
    const views = this.viewManager.views$.value;
    const hidden = hiddenIndices.flatMap(index => {
      const id = views[index];
      return id ? [id] : [];
    });
    const addLabel = this.wording(VIEWS_BAR_ADD_VIEW);
    return html`
      ${hidden.length
        ? html`<div
            class="database-view-button dv-hover"
            data-overflow-more
            data-testid="database-views-more"
            @click="${(event: MouseEvent) => this._showMore(event, hidden)}"
          >
            ${this.moreLabel(hidden.length)}
          </div>`
        : nothing}
      ${this.readonly || this.creationOff
        ? nothing
        : html`<div
            class="database-view-button dv-icon-16 dv-hover"
            data-testid="database-add-view-button"
            role="button"
            aria-label="${addLabel}"
            title="${addLabel}"
            @click="${this._addViewMenu}"
          >
            ${PlusIcon()}
          </div>`}
    `;
  };

  private moreLabel(count: number) {
    const [key, fallback] = VIEWS_BAR_MORE;
    return this.std
      ? translateKey(this.std, key, fallback, { count })
      : fillPlaceholders(fallback, { count });
  }

  renderViews = () => {
    const views = this.viewManager.views$.value;
    return views.map(id => () => {
      const classList = classMap({
        'database-view-button': true,
        'dv-hover': true,
        selected: this.viewManager.currentViewId$.value === id,
      });
      const view = this.viewManager.viewDataGet(id);
      const shownAs =
        view && modeShownAsFallback(this.dataSource, view.mode)
          ? this.wording(VIEW_SHOWN_AS_TABLE)
          : undefined;
      return html`
        <div
          class="${classList}"
          data-testid="database-view-tab"
          data-view-id="${id}"
          title="${shownAs ?? nothing}"
          @click="${(event: MouseEvent) => this.clickView(event, id)}"
        >
          <uni-lit class="icon" .uni="${this.getRenderer(id)?.icon}"></uni-lit>
          <div class="name">${view?.name}</div>
          ${shownAs
            ? html`<span class="shown-as" data-testid="database-view-shown-as"
                >${shownAs}</span
              >`
            : nothing}
        </div>
      `;
    });
  };

  get readonly() {
    return this.viewManager.readonly$.value;
  }

  private getRenderer(viewId: string) {
    return this.dataSource.viewMetaGetById(viewId)?.renderer;
  }

  private clickView(event: MouseEvent, id: string) {
    if (this.viewManager.currentViewId$.value !== id) {
      this.viewManager.setCurrentView(id);
      this.onChangeView?.(id);
      return;
    }
    this.openViewOption(
      popupTargetFromElement(event.currentTarget as HTMLElement),
      id
    );
  }

  override connectedCallback() {
    super.connectedCallback();
    this.classList.toggle('mobile', IS_MOBILE);
  }

  override render() {
    const views = this.viewManager.views$.value;
    const current = this.viewManager.currentViewId$.value;
    return html`
      <component-overflow
        .renderItem="${this.renderViews()}"
        .renderMore="${this.renderMore}"
        .pinned="${current ? views.indexOf(current) : -1}"
      ></component-overflow>
    `;
  }

  @property({ attribute: false })
  accessor onChangeView: ((id: string) => void) | undefined;
}

declare global {
  interface HTMLElementTagNameMap {
    'data-view-header-views': DataViewHeaderViews;
  }
}
