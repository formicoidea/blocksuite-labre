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
  type TranslationParams,
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

import type { DataViewRootUI } from '../../core/data-view.js';
import { modeShownAsFallback } from '../../core/view-manager/single-view.js';
import {
  canAddView,
  popAddViewMenu,
} from '../../core/view-manager/add-view.js';
import { duplicateAsShownPreset } from '../../core/view-manager/view-creation.js';
import { WidgetBase } from '../../core/widget/widget-base.js';
import {
  activateOnEnterOrSpace,
  focusAsBeforeOnPress,
  keepKeysInBar,
  keyboardOpener,
  popupTargetReturningFocus,
} from '../tools/keyboard.js';
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

/**
 * A view picked from the keyboard: the focus stays on its tab, or goes to
 * the one drawn in its place when the view drawn next redraws the bar, never
 * to the body (WCAG 2.4.3).
 */
async function focusTabOnceDrawn(root: DataViewRootUI, id: string) {
  try {
    await root.restoreFocus(
      `[data-testid="database-view-tab"][data-view-id="${CSS.escape(id)}"]`
    );
  } catch (error) {
    console.error(error);
  }
}

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
 * - The keyboard reaches them as it reaches the view toolbar beside it
 *   (#678, `../tools/keyboard.ts`): each drawn tab, "N more" and "+" is a
 *   named `role="button"` in the tab order, in visual order, activated by
 *   Enter and Space and ringed under `:focus-visible`; the current view's tab
 *   says so (`aria-current`) and, writable, that it opens a menu. A tab the
 *   width hides is out of the tab order and of the accessibility tree
 *   (`visibility: hidden`), reached through "N more". Not a `tablist`: "N
 *   more" and "+" share the row's container (`component-overflow`), which a
 *   tablist may not own, and a tab here is a button that also opens a menu.
 *   The bar takes the keys of its own model, and only in keyboard mode.
 *
 * Stays in core: a core-only host must reach every stored view (ADR 0035 §1).
 */
export class DataViewHeaderViews extends WidgetBase {
  static override styles = css`
    /* The bar hangs its first tab's inset into the gutter: the tab keeps
       its 4px padding for its hover background, and its icon lines up with
       the database title and the rows above and below (labre recette of
       1.1: the icon sat 4px right of both). */
    data-view-header-views {
      height: 28px;
      display: flex;
      user-select: none;
      gap: 4px;
      min-width: 0;
      margin-left: -4px;
    }
    data-view-header-views.mobile {
      height: ${VIEWS_BAR_TOUCH_TARGET}px;
    }
    data-view-header-views.mobile .database-view-button {
      min-height: ${VIEWS_BAR_TOUCH_TARGET}px;
      min-width: ${VIEWS_BAR_TOUCH_TARGET}px;
    }
    data-view-header-views component-overflow {
      flex-wrap: nowrap;
    }
    /* The current view's tab is drawn even when it is wider than the room
       (fitOverflow): it gives way, clipped, instead of wrapping "N more" and
       "+" onto the filter bar below a bar of fixed height (P7, 390px). */
    data-view-header-views .component-overflow-item {
      padding-right: 4px;
      min-width: ${VIEWS_BAR_TOUCH_TARGET}px;
      overflow: hidden;
    }
    /* The tab keeps its own width inside a narrowed item: the overflow
       measures scrollWidth, and a tab that shrank with its item would
       report room that is not there. */
    data-view-header-views .component-overflow-item > * {
      width: max-content;
    }
    data-view-header-views .component-overflow-more {
      gap: 4px;
      flex-shrink: 0;
    }
    /* A tab the width hides stays in the DOM to be measured (opacity 0):
       hidden from Tab and from the accessibility tree too. */
    data-view-header-views .component-overflow-item.hidden {
      visibility: hidden;
    }
    data-view-header-views::-webkit-scrollbar-thumb {
      width: 1px;
    }

    /* The view toolbar's keyboard ring (#678), inside the box: the tab's
       item clips what overflows it. */
    data-view-header-views [role='button']:focus-visible {
      outline: 2px solid
        var(--affine-focus-ring-color, var(--affine-primary-color));
      outline-offset: -2px;
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
  private wording(wording: ChromeWording, params?: TranslationParams) {
    return this.std
      ? translateKey(this.std, ...wording, params)
      : fillPlaceholders(wording[1], params);
  }

  /**
   * "+": the one add-a-view gesture (`popAddViewMenu`), shared with the
   * empty state of a database with no view.
   */
  _addViewMenu = (event: MouseEvent) => {
    const target = popupTargetReturningFocus(
      event.currentTarget as HTMLElement,
      keyboardOpener(event)
    );
    popAddViewMenu(target, {
      std: this.std,
      dataSource: this.dataSource,
      eventTrace: this.dataViewLogic.root.config.eventTrace,
      onAdded: id => this.onChangeView?.(id),
    });
  };

  _showMore = (event: MouseEvent, hidden: readonly string[]) => {
    popFilterableSimpleMenu(
      popupTargetReturningFocus(
        event.currentTarget as HTMLElement,
        keyboardOpener(event)
      ),
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
            role="button"
            tabindex="0"
            aria-haspopup="menu"
            aria-expanded="false"
            @click="${(event: MouseEvent) => this._showMore(event, hidden)}"
            @keydown="${activateOnEnterOrSpace}"
          >
            ${this.moreLabel(hidden.length)}
          </div>`
        : nothing}
      ${!canAddView(this.dataSource)
        ? nothing
        : html`<div
            class="database-view-button dv-icon-16 dv-hover"
            data-testid="database-add-view-button"
            role="button"
            tabindex="0"
            aria-haspopup="menu"
            aria-expanded="false"
            aria-label="${addLabel}"
            title="${addLabel}"
            @click="${this._addViewMenu}"
            @keydown="${activateOnEnterOrSpace}"
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
      const selected = this.viewManager.currentViewId$.value === id;
      const classList = classMap({
        'database-view-button': true,
        'dv-hover': true,
        selected,
      });
      // The current tab's click opens its menu, a writable view's only.
      const opensMenu = selected && !this.readonly;
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
          role="button"
          tabindex="0"
          aria-current="${selected ? 'true' : nothing}"
          aria-haspopup="${opensMenu ? 'menu' : nothing}"
          aria-expanded="${opensMenu ? 'false' : nothing}"
          title="${shownAs ?? nothing}"
          @click="${(event: MouseEvent) => this.clickView(event, id)}"
          @keydown="${activateOnEnterOrSpace}"
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
    const opener = keyboardOpener(event);
    if (this.viewManager.currentViewId$.value !== id) {
      // Found while the tab is in it: the view drawn next may redraw the
      // bar, and the focused tab then leaves with the old view.
      const root = this.closest('affine-data-view-renderer');
      this.viewManager.setCurrentView(id);
      this.onChangeView?.(id);
      if (opener && root) void focusTabOnceDrawn(root, id);
      return;
    }
    this.openViewOption(
      popupTargetReturningFocus(event.currentTarget as HTMLElement, opener),
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
        @keydown="${keepKeysInBar}"
        @pointerdown="${focusAsBeforeOnPress}"
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
