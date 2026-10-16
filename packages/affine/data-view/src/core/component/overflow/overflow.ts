import { SignalWatcher, WithDisposable } from '@labre/global/lit';
import { ShadowlessElement } from '@labre/std';
import { css, html, type PropertyValues, type TemplateResult } from 'lit';
import { property, query, queryAll, state } from 'lit/decorators.js';
import { classMap } from 'lit/directives/class-map.js';
import { repeat } from 'lit/directives/repeat.js';

import { fitOverflow } from './fit.js';

/**
 * Until the "N more" button has been drawn once, its width is guessed; the
 * next layout pass measures it and settles.
 */
const MORE_EXTRA_GUESS = 72;

/**
 * Marks the element of the trailing slot that only exists while something is
 * hidden (the "N more" button): the rest of the slot is what stays.
 */
export const OVERFLOW_MORE_ATTR = 'data-overflow-more';

/**
 * A row that draws as many items as its width allows and hands the rest to
 * a trailing slot (`renderMore`). Every item stays in the DOM, a hidden one
 * transparent and out of the flow, so its width is measured on each pass;
 * which ones are drawn is `fitOverflow` (`./fit.ts`), `pinned` included.
 * Until the first measure every item is drawn.
 */
export class Overflow extends SignalWatcher(WithDisposable(ShadowlessElement)) {
  static override styles = css`
    component-overflow {
      display: flex;
      flex-wrap: wrap;
      width: 100%;
      position: relative;
    }

    .component-overflow-item {
    }
    .component-overflow-item.hidden {
      opacity: 0;
      pointer-events: none;
      position: absolute;
    }
    .component-overflow-more {
      display: flex;
    }
  `;

  protected frameId: number | undefined = undefined;

  /** Last measured width of the slot's `OVERFLOW_MORE_ATTR` element. */
  private moreExtraWidth: number | undefined = undefined;

  adjustStyle() {
    if (this.frameId) {
      cancelAnimationFrame(this.frameId);
    }

    this.frameId = requestAnimationFrame(() => {
      this.doAdjustStyle();
    });
  }

  override connectedCallback() {
    super.connectedCallback();
    const resize = new ResizeObserver(() => {
      this.adjustStyle();
    });
    resize.observe(this);
    this.disposables.add(() => {
      resize.unobserve(this);
    });
  }

  protected doAdjustStyle() {
    const slotWidth = this.more.getBoundingClientRect().width;
    const moreButton = this.more.querySelector<HTMLElement>(
      `[${OVERFLOW_MORE_ATTR}]`
    );
    const moreWidth = moreButton?.getBoundingClientRect().width;
    if (moreWidth !== undefined) this.moreExtraWidth = moreWidth;
    // The natural width: a host may let a drawn item give way (the views
    // bar clips its pinned tab), and a shrunk width fed back here would make
    // room that is not there, then take it back, pass after pass.
    const widths = Array.from(
      this.items as Iterable<HTMLDivElement>,
      item => item.scrollWidth
    );
    const drawn = fitOverflow({
      widths,
      container: this.getBoundingClientRect().width,
      trailing: slotWidth - (moreWidth ?? 0),
      moreExtra: this.moreExtraWidth ?? MORE_EXTRA_GUESS,
      pinned: this.pinned,
    });
    // Assigned only on a change: an equal array is a new identity, and a
    // state write would re-render, re-measure and loop.
    if (drawn.join() !== this.drawn?.join()) {
      this.drawn = drawn;
    }
  }

  /** The items `renderMore` holds, in order. */
  get hiddenIndices(): number[] {
    if (!this.drawn) return [];
    const drawn = new Set(this.drawn);
    return this.renderItem.flatMap((_, index) =>
      drawn.has(index) ? [] : [index]
    );
  }

  override render() {
    const drawn = this.drawn ? new Set(this.drawn) : undefined;
    const hidden = this.hiddenIndices;
    return html`
      ${repeat(this.renderItem, (render, index) => {
        const className = classMap({
          'component-overflow-item': true,
          hidden: drawn ? !drawn.has(index) : false,
        });
        return html`<div class="${className}">${render()}</div>`;
      })}
      <div class="component-overflow-more">
        ${this.renderMore(this.renderItem.length - hidden.length, hidden)}
      </div>
    `;
  }

  protected override willUpdate(changed: PropertyValues<this>) {
    super.willUpdate(changed);
    // Another set of items: the drawn indices no longer name the same ones.
    if (
      changed.has('renderItem') &&
      changed.get('renderItem')?.length !== this.renderItem.length
    ) {
      this.drawn = undefined;
    }
  }

  protected override updated(_changedProperties: PropertyValues) {
    super.updated(_changedProperties);
    this.adjustStyle();
  }

  @queryAll(':scope > .component-overflow-item')
  accessor items!: HTMLDivElement[] & NodeList;

  @query(':scope > .component-overflow-more')
  accessor more!: HTMLDivElement;

  /** The drawn items' indices, ascending; `undefined` (all) until measured. */
  @state()
  accessor drawn: readonly number[] | undefined = undefined;

  /** The item that is always drawn (the current view); `-1` for none. */
  @property({ attribute: false })
  accessor pinned = -1;

  @property({ attribute: false })
  accessor renderItem!: Array<() => TemplateResult>;

  /**
   * The trailing slot: `count` items are drawn and `hidden` are the indices
   * it stands for, empty when everything fits.
   */
  @property({ attribute: false })
  accessor renderMore!: (
    count: number,
    hidden: readonly number[]
  ) => TemplateResult | undefined;
}
