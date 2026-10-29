import {
  menu,
  popFilterableSimpleMenu,
  popupTargetFromElement,
} from '@labre/affine-components/context-menu';
import { SignalWatcher, WithDisposable } from '@labre/global/lit';
import { AddCursorIcon } from '@blocksuite/icons/lit';
import { type BlockStdScope, ShadowlessElement, stdContext } from '@labre/std';
import { consume } from '@lit/context';
import { css, nothing } from 'lit';
import { property } from 'lit/decorators.js';
import { repeat } from 'lit/directives/repeat.js';
import { html } from 'lit/static-html.js';

import { GroupTitle } from '../../../core/group-by/group-title.js';
import {
  groupToggleStyles,
  hideGroupAction,
  renderGroupToggle,
} from '../../../core/group-by/group-visibility.js';
import type { Group } from '../../../core/group-by/trait.js';
import { dragHandler } from '../../../core/utils/wc-dnd/dnd-context.js';
import { wordingOf, wordingFrom } from '../../../core/utils/wording.js';
import type { MobileKanbanViewUILogic } from './kanban-view-ui-logic.js';
import {
  DATA_VIEW_GROUP_DELETE_CARDS,
  DATA_VIEW_GROUP_ADD,
} from '../../../translations.js';
import { TOOLBAR_UNGROUP } from '@labre/affine-shared/services';

const styles = css`
  mobile-kanban-group {
    width: 260px;
    flex-shrink: 0;
    border-radius: 8px;
    display: flex;
    flex-direction: column;
  }

  .mobile-group-header {
    height: 32px;
    padding: 6px 4px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    overflow: hidden;
  }

  .mobile-group-body {
    margin-top: 4px;
    display: flex;
    flex-direction: column;
    padding: 0 4px;
    gap: 12px;
  }

  .mobile-group-body[hidden] {
    display: none;
  }

  @media (pointer: coarse) {
    .mobile-group-header {
      height: auto;
      min-height: 44px;
    }
  }

  .mobile-group-header-main {
    flex: 1 1 auto;
    min-width: 0;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    overflow: hidden;
  }

  .dv-kanban-hidden-groups {
    width: 260px;
    flex-shrink: 0;
  }

  .mobile-add-card {
    display: flex;
    align-items: center;
    min-height: 44px;
    padding: 4px;
    border-radius: 4px;
    font-size: var(--data-view-cell-text-size);
    line-height: var(--data-view-cell-text-line-height);
    color: var(--affine-text-secondary-color);
  }
`;

export class MobileKanbanGroup extends SignalWatcher(
  WithDisposable(ShadowlessElement)
) {
  static override styles = [styles, groupToggleStyles];

  /** Absent outside an editor host: the wordings read English. */
  @consume({ context: stdContext })
  accessor std!: BlockStdScope;

  private readonly clickAddCard = () => {
    this.view.addCard('end', this.group.key);
    this.requestUpdate();
  };

  private readonly clickAddCardInStart = () => {
    this.view.addCard('start', this.group.key);
    this.requestUpdate();
  };

  private readonly clickGroupOptions = (e: MouseEvent) => {
    const ele = e.currentTarget as HTMLElement;
    popFilterableSimpleMenu(popupTargetFromElement(ele), [
      menu.group({
        items: [
          menu.action({
            name: wordingFrom(this)(TOOLBAR_UNGROUP),
            hide: () => this.group.value == null,
            select: () => {
              this.group.rows.forEach(row => {
                this.group.manager.removeFromGroup(row.rowId, this.group.key);
              });
              this.requestUpdate();
            },
          }),
          hideGroupAction(this.group, wordingOf(this.std)),
          menu.action({
            name: wordingFrom(this)(DATA_VIEW_GROUP_DELETE_CARDS),
            select: () => {
              this.view.rowsDelete(this.group.rows.map(row => row.rowId));
              this.requestUpdate();
            },
          }),
        ],
      }),
    ]);
  };

  override render() {
    const cards = this.group.rows;
    // Folded (personal, B8): the header and its count stay, the cards go.
    const collapsed = this.group.manager.collapsed$(this.group.key).value;
    return html`
      <div class="mobile-group-header" ${dragHandler(this.group.key)}>
        ${renderGroupToggle(this.group, wordingOf(this.std))}
        <div class="mobile-group-header-main">
          ${GroupTitle(this.group, {
            readonly: this.view.readonly$.value,
            clickAdd: this.clickAddCardInStart,
            clickOps: this.clickGroupOptions,
          })}
        </div>
      </div>
      <div class="mobile-group-body" ?hidden="${collapsed}">
        ${repeat(
          cards,
          row => row.rowId,
          row => {
            return html`
              <mobile-kanban-card
                data-card-id="${row.rowId}"
                .groupKey="${this.group.key}"
                .cardId="${row.rowId}"
                .kanbanViewLogic="${this.kanbanViewLogic}"
              ></mobile-kanban-card>
            `;
          }
        )}
        ${this.view.readonly$.value
          ? nothing
          : html` <div class="mobile-add-card" @click="${this.clickAddCard}">
              <div
                style="margin-right: 4px;width: 16px;height: 16px;display:flex;align-items:center;"
              >
                ${AddCursorIcon()}
              </div>
              ${wordingFrom(this)(DATA_VIEW_GROUP_ADD)}
            </div>`}
      </div>
    `;
  }

  @property({ attribute: false })
  accessor group!: Group;

  @property({ attribute: false })
  accessor kanbanViewLogic!: MobileKanbanViewUILogic;

  get view() {
    return this.kanbanViewLogic.view;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'mobile-kanban-group': MobileKanbanGroup;
  }
}
