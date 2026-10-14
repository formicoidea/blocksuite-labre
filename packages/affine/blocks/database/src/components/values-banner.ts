import { RESOURCE_STATUS_RETRY } from '@labre/affine-components/translations';
import {
  type DatabaseAllEvents,
  type EventTraceFn,
  translateKey,
} from '@labre/affine-shared/services';
import {
  type DataSourceHydration,
  valuesBannerOf,
  valuesStateOf,
  VALUES_SLOW_AFTER_MS,
} from '@labre/data-view';
import { SignalWatcher, WithDisposable } from '@labre/global/lit';
import { type BlockStdScope, ShadowlessElement } from '@labre/std';
import { effect, signal } from '@preact/signals-core';
import { css, html, nothing } from 'lit';
import { property } from 'lit/decorators.js';

import {
  DATABASE_VALUES_ERROR,
  DATABASE_VALUES_LOADING,
} from '../translations.js';

/**
 * The hydration banner of a database (ADR 0035 §9e, issue B2): nothing while
 * values load for less than 3 s, "still loading" after, "could not be
 * loaded" with Retry on `error` (Retry only when the source offers
 * `retryValues`). It reads the source's `valuesState$` and writes nothing; a
 * source that says nothing about hydration never shows it.
 */
const reportedFailures = new WeakMap<DataSourceHydration, number>();

export class DatabaseValuesBanner extends SignalWatcher(
  WithDisposable(ShadowlessElement)
) {
  static override styles = css`
    affine-database-values-banner {
      display: block;
    }

    .affine-database-values-banner {
      display: flex;
      align-items: center;
      gap: 8px;
      margin: 4px 0;
      padding: 4px 8px;
      min-height: 32px;
      border-radius: 8px;
      font-size: 14px;
      line-height: 22px;
      color: var(--affine-text-secondary-color);
      background-color: var(--affine-hover-color);
    }

    .affine-database-values-banner[data-kind='error'] {
      color: var(--affine-error-color);
    }

    .affine-database-values-banner-text {
      flex: 1;
      min-width: 0;
    }
  `;

  @property({ attribute: false })
  accessor dataSource!: DataSourceHydration;

  @property({ attribute: false })
  accessor std!: BlockStdScope;

  /** Where `DatabaseValuesLoadFailed` goes (the block's tracer); absent, nowhere. */
  @property({ attribute: false })
  accessor trace: EventTraceFn<DatabaseAllEvents> | undefined = undefined;

  /** Re-evaluated when the 3 s mark passes; never toggled. */
  private readonly _now$ = signal(Date.now());

  override connectedCallback() {
    super.connectedCallback();
    let timer: ReturnType<typeof setTimeout> | undefined;
    const clear = () => {
      if (timer !== undefined) clearTimeout(timer);
      timer = undefined;
    };
    this.disposables.add(
      effect(() => {
        const state = valuesStateOf(this.dataSource);
        clear();
        this._now$.value = Date.now();
        if (state.status === 'error') this.reportFailure(state.since);
        if (state.status !== 'loading') return;
        const wait = state.since + VALUES_SLOW_AFTER_MS - Date.now();
        if (wait <= 0) return;
        timer = setTimeout(() => {
          this._now$.value = Date.now();
        }, wait);
      })
    );
    this.disposables.add(clear);
  }

  /**
   * Once per failure of a source (its `since`), not per banner: a block
   * re-rendered, or two views of one source, report it once.
   */
  private reportFailure(since: number) {
    const source = this.dataSource;
    if (reportedFailures.get(source) === since) return;
    reportedFailures.set(source, since);
    this.trace?.('DatabaseValuesLoadFailed', {
      retryable: !!source.retryValues,
    });
  }

  private readonly _retry = () => {
    this.dataSource.retryValues?.();
  };

  override render() {
    const kind = valuesBannerOf(
      valuesStateOf(this.dataSource),
      this._now$.value
    );
    if (kind === 'none') return nothing;
    if (kind === 'slow') {
      return html`<div
        class="affine-database-values-banner"
        data-kind="slow"
        data-testid="database-values-loading"
        role="status"
      >
        <span class="affine-database-values-banner-text"
          >${translateKey(this.std, ...DATABASE_VALUES_LOADING)}</span
        >
      </div>`;
    }
    const canRetry = !!this.dataSource.retryValues;
    return html`<div
      class="affine-database-values-banner"
      data-kind="error"
      data-testid="database-values-error"
      role="alert"
    >
      <span class="affine-database-values-banner-text"
        >${translateKey(this.std, ...DATABASE_VALUES_ERROR)}</span
      >
      ${canRetry
        ? html`<data-view-component-button
            data-testid="database-values-retry"
            hoverType="border"
            .onClick="${this._retry}"
            .text="${translateKey(this.std, ...RESOURCE_STATUS_RETRY)}"
          ></data-view-component-button>`
        : nothing}
    </div>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'affine-database-values-banner': DatabaseValuesBanner;
  }
}
