import { popupTargetFromElement } from '@labre/affine-components/context-menu';
import { OPEN_LABEL } from '@labre/affine-components/translations';
import { SignalWatcher, WithDisposable } from '@labre/global/lit';
import { type BlockStdScope, ShadowlessElement, stdContext } from '@labre/std';
import { consume } from '@lit/context';
import { cssVarV2 } from '@toeverything/theme/v2';
import { css, nothing, unsafeCSS } from 'lit';
import { property } from 'lit/decorators.js';
import { repeat } from 'lit/directives/repeat.js';
import { styleMap } from 'lit/directives/style-map.js';
import { html } from 'lit/static-html.js';

import { wordingOf } from '../../../core/utils/wording.js';
import {
  paintRowColor,
  ROW_COLOR_PROPERTY,
  viewRowColor,
} from '../../../core/view/color-rules.js';
import { cellDivider } from '../styles.js';
import { popMobileRowMenu } from './menu.js';
import { mobileStickyTitle } from './table-view-style.js';
import type { MobileTableViewUILogic } from './table-view-ui-logic.js';

/** The "Open" chip's widest drawing, its 8px inset and 4px of air. */
export const ROW_OPEN_WIDTH = 60 + 8 + 4;

/** How long a finger rests on a row before its menu opens. */
export const ROW_LONG_PRESS_MS = 500;

/** A finger that travels further is scrolling, not pressing. */
const LONG_PRESS_SLOP = 8;

/**
 * A row of the phone table (P7, "Bases éditables sur mobile", after Notion's
 * phone table). A tap on a cell edits it; the title column carries an "Open"
 * chip that opens the row through the root's detail panel, the path of the
 * desktop row's open button; a long press opens the row menu (open, delete).
 *
 * Up to 0.54 the title cell carried two floating ops (open and "...") drawn
 * over the end of the title. The chip reserves its room instead, and the
 * "..." moved to the long press so deleting a row stays possible on a phone.
 */
export class MobileTableRow extends SignalWatcher(
  WithDisposable(ShadowlessElement)
) {
  // Touch targets are 44px tall (B5, ADR 0035 §1): the row, and the chip
  // through an invisible hit area, so it keeps its drawn size.
  static override styles = css`
    .mobile-table-row {
      width: 100%;
      display: flex;
      flex-direction: row;
      border-bottom: 1px solid ${unsafeCSS(cssVarV2.layer.insideBorder.border)};
      position: relative;
      min-height: 44px;
      background-color: var(${unsafeCSS(ROW_COLOR_PROPERTY)}, transparent);
      -webkit-touch-callout: none;
    }

    /* A long press opens the row menu, not a text selection; an edited cell
       keeps its own. */
    .mobile-table-row mobile-table-cell:not([data-editing='true']) {
      -webkit-user-select: none;
      user-select: none;
    }

    .mobile-row-open {
      position: absolute;
      top: 10px;
      right: 8px;
      display: flex;
      align-items: center;
      height: 24px;
      max-width: 60px;
      padding: 0 6px;
      box-sizing: border-box;
      border: 1px solid ${unsafeCSS(cssVarV2.layer.insideBorder.border)};
      border-radius: 4px;
      background-color: var(--affine-background-primary-color);
      color: ${unsafeCSS(cssVarV2.text.secondary)};
      font-size: 12px;
      font-weight: 500;
      line-height: 20px;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      cursor: pointer;
    }

    .mobile-row-open::after {
      content: '';
      position: absolute;
      inset: -10px -4px;
    }

    .mobile-row-title:has(mobile-table-cell[data-editing='true'])
      .mobile-row-open {
      display: none;
    }
  `;

  /** Absent outside an editor host: the wordings read English. */
  @consume({ context: stdContext })
  accessor std!: BlockStdScope;

  private pressTimer: ReturnType<typeof setTimeout> | undefined;

  private pressOrigin: { x: number; y: number } | undefined;

  /** A long press fired: the click the finger's release makes is eaten. */
  private pressFired = false;

  private readonly cancelPress = () => {
    clearTimeout(this.pressTimer);
    this.pressTimer = undefined;
    this.pressOrigin = undefined;
  };

  private readonly openRow = (e: MouseEvent) => {
    e.stopPropagation();
    this.tableViewLogic.root.openDetailPanel({
      view: this.view,
      rowId: this.rowId,
    });
  };

  get groupKey() {
    return this.closest('affine-data-view-table-group')?.group?.key;
  }

  override connectedCallback() {
    super.connectedCallback();
    this.classList.add('mobile-table-row');
    this.disposables.add(this.cancelPress);
    this.disposables.addFromEvent(this, 'pointerdown', (e: PointerEvent) => {
      this.pressFired = false;
      this.cancelPress();
      if (this.view.readonly$.value) return;
      this.pressOrigin = { x: e.clientX, y: e.clientY };
      this.pressTimer = setTimeout(() => {
        this.cancelPress();
        this.pressFired = true;
        popMobileRowMenu(
          popupTargetFromElement(this),
          this.rowId,
          this.tableViewLogic,
          this.view,
          wordingOf(this.std)
        );
      }, ROW_LONG_PRESS_MS);
    });
    this.disposables.addFromEvent(this, 'pointermove', (e: PointerEvent) => {
      const origin = this.pressOrigin;
      if (!origin) return;
      const moved = Math.hypot(e.clientX - origin.x, e.clientY - origin.y);
      if (moved > LONG_PRESS_SLOP) this.cancelPress();
    });
    this.disposables.addFromEvent(this, 'pointerup', this.cancelPress);
    this.disposables.addFromEvent(this, 'pointercancel', this.cancelPress);
    // Android opens its own menu on a long press; the row's is the one.
    this.disposables.addFromEvent(this, 'contextmenu', (e: Event) => {
      e.preventDefault();
    });
    this.disposables.addFromEvent(
      this,
      'click',
      (e: MouseEvent) => {
        if (!this.pressFired) return;
        this.pressFired = false;
        e.stopPropagation();
        e.preventDefault();
      },
      { capture: true }
    );
  }

  protected override render(): unknown {
    const view = this.view;
    paintRowColor(this, viewRowColor(view, this.rowId));
    const openLabel = wordingOf(this.std)(OPEN_LABEL);
    return html`
      ${repeat(
        view.properties$.value,
        v => v.id,
        (column, i) => {
          const isTitle =
            column.view.mainProperties$.value.titleColumn === column.id;
          return html`
            <div
              class="${isTitle ? `${mobileStickyTitle} mobile-row-title` : ''}"
              style="display: flex;"
            >
              <mobile-table-cell
                class="mobile-table-cell"
                style=${styleMap({
                  width: `${column.width$.value}px`,
                  border: i === 0 ? 'none' : undefined,
                  // Room for the "Open" chip drawn over its right end.
                  paddingRight: isTitle ? `${ROW_OPEN_WIDTH}px` : undefined,
                })}
                .tableViewLogic="${this.tableViewLogic}"
                .column="${column}"
                .rowId="${this.rowId}"
                data-row-id="${this.rowId}"
                .rowIndex="${this.rowIndex}"
                data-row-index="${this.rowIndex}"
                .columnId="${column.id}"
                data-column-id="${column.id}"
                .columnIndex="${i}"
                data-column-index="${i}"
              >
              </mobile-table-cell>
              <div class="${cellDivider}"></div>
              ${isTitle
                ? html`<div
                    class="mobile-row-open"
                    data-testid="dv-row-open"
                    role="button"
                    aria-label="${openLabel}"
                    @click="${this.openRow}"
                  >
                    ${openLabel}
                  </div>`
                : nothing}
            </div>
          `;
        }
      )}
      <div class="database-cell add-column-button"></div>
    `;
  }

  @property({ attribute: false })
  accessor tableViewLogic!: MobileTableViewUILogic;

  @property({ attribute: false })
  accessor rowId!: string;

  @property({ attribute: false })
  accessor rowIndex!: number;

  get view() {
    return this.tableViewLogic.view;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'mobile-table-row': MobileTableRow;
  }
}
