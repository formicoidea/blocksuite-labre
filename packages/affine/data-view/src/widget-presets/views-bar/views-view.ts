import {
  menu,
  popFilterableSimpleMenu,
  popMenu,
  type PopupTarget,
  popupTargetFromElement,
} from '@labre/affine-components/context-menu';
import {
  type ChromeWording,
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
import { consume } from '@lit/context';
import { css, html, nothing } from 'lit';
import { property } from 'lit/decorators.js';
import { classMap } from 'lit/directives/class-map.js';

import { modeShownAsFallback } from '../../core/view-manager/single-view.js';
import {
  duplicateAsShownPreset,
  ViewCreationOffKey,
} from '../../core/view-manager/view-creation.js';
import { WidgetBase } from '../../core/widget/widget-base.js';
import {
  VIEW_DUPLICATE_AS_TABLE,
  VIEW_SHOWN_AS_TABLE,
} from '../../translations.js';

export class DataViewHeaderViews extends WidgetBase {
  static override styles = css`
    data-view-header-views {
      height: 28px;
      display: flex;
      user-select: none;
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

  private addView(type: string) {
    const id = this.viewManager.viewAdd(type);
    this.viewManager.setCurrentView(id);
    this.dataViewLogic.root.config.eventTrace('AddDatabaseView', {
      type: type,
    });
  }

  _addViewMenu = (event: MouseEvent) => {
    popFilterableSimpleMenu(
      popupTargetFromElement(event.currentTarget as HTMLElement),
      this.dataSource.viewMetas.map(v => {
        return menu.action({
          name: v.model.defaultName,
          prefix: html`<uni-lit .uni=${v.renderer.icon}></uni-lit>`,
          select: () => {
            this.addView(v.type);
          },
        });
      })
    );
  };

  _showMore = (event: MouseEvent) => {
    const views = this.viewManager.views$.value;
    popFilterableSimpleMenu(
      popupTargetFromElement(event.currentTarget as HTMLElement),
      [
        menu.group({
          items: views.flatMap(id => {
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
              select: () => {
                this.viewManager.setCurrentView(id);
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
        menu.group({
          items: this.dataSource.viewMetas.map(v => {
            return menu.action({
              name: `Create ${v.model.defaultName}`,
              hide: () => this.readonly || this.creationOff,
              prefix: PlusIcon(),
              select: () => {
                this.addView(v.type);
              },
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
                  placeholder: 'View name',
                  onChange: text => {
                    view.nameSet(text);
                  },
                }),
              ]),
          menu.group({
            items: [
              menu.action({
                name: 'Edit View',
                hide: () => fallback,
                prefix: InfoIcon(),
                select: () => {
                  this.closest('affine-data-view-renderer')
                    ?.querySelector('data-view-header-tools-view-options')
                    ?.openMoreAction(target);
                },
              }),
              menu.action({
                name: 'Move Left',
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
                name: 'Move Right',
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

  renderMore = (count: number) => {
    const views = this.viewManager.views$.value;
    if (count === views.length) {
      if (this.readonly || this.creationOff) {
        return;
      }
      return html`<div
        class="database-view-button dv-icon-16 dv-hover"
        data-testid="database-add-view-button"
        @click="${this._addViewMenu}"
      >
        ${PlusIcon()}
      </div>`;
    }
    return html`
      <div class="database-view-button dv-hover" @click="${this._showMore}">
        ${views.length - count} More
      </div>
    `;
  };

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
          style="margin-right: 4px;"
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

  override render() {
    return html`
      <component-overflow
        .renderItem="${this.renderViews()}"
        .renderMore="${this.renderMore}"
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
