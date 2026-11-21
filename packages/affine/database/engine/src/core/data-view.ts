import type {
  DatabaseAllEvents,
  EventTraceFn,
} from '@labre/affine-shared/services';
import type { DisposableMember } from '@labre/global/disposable';
import { IS_MOBILE } from '@labre/global/env';
import { BlockSuiteError } from '@labre/global/exceptions';
import { SignalWatcher, WithDisposable } from '@labre/global/lit';
import {
  type BlockStdScope,
  type Clipboard,
  type DndController,
  type EventName,
  ShadowlessElement,
  stdContext,
  type UIEventHandler,
} from '@labre/std';
import { consume } from '@lit/context';
import { computed, type ReadonlySignal, signal } from '@preact/signals-core';
import { css, type TemplateResult, unsafeCSS } from 'lit';
import { property, state } from 'lit/decorators.js';
import { classMap } from 'lit/directives/class-map.js';
import { ref } from 'lit/directives/ref.js';
import { html } from 'lit/static-html.js';

import { dataViewCommonStyle } from './common/css-variable.js';
import type { DataSource } from './data-source/index.js';
import type { DataViewSelection } from './types.js';
import { renderUniLit } from './utils/uni-component/index.js';
import type { DataViewUILogicBase } from './view/data-view-base.js';
import type { SingleView } from './view-manager/single-view.js';
import type { DataViewWidget } from './widget/index.js';

/** Render passes `restoreFocus` waits for at most: a view is ~6 deep. */
const FOCUS_SETTLE_PASSES = 8;

export type DataViewRendererConfig = {
  clipboard: Clipboard;
  dnd?: DndController;
  onDrag?: (evt: MouseEvent, id: string) => () => void;
  notification: {
    toast: (message: string) => void;
  };
  virtualPadding$: ReadonlySignal<number>;
  headerWidget: DataViewWidget | undefined;
  handleEvent: (name: EventName, handler: UIEventHandler) => DisposableMember;
  bindHotkey: (hotkeys: Record<string, UIEventHandler>) => DisposableMember;
  dataSource: DataSource;
  selection$: ReadonlySignal<DataViewSelection | undefined>;
  setSelection: (selection: DataViewSelection | undefined) => void;
  eventTrace: EventTraceFn<DatabaseAllEvents>;
  /**
   * Drawn instead of the current view, header widget included, when it
   * returns something (a source the view names that the host cannot resolve,
   * ADR 0035 §7): the caller draws what of its header still makes sense.
   * Absent: every view draws as in 0.48.
   */
  viewPlaceholder?: (logic: DataViewUILogicBase) => TemplateResult | undefined;
  /**
   * What of the caller's header still makes sense when the source holds no
   * view at all (every view deleted, or a block stored with `views: []`,
   * its schema default; ADR 0035 amendment of 2026-11-20): drawn above the
   * engine's empty state (`<data-view-no-view>`, which offers "+"'s
   * gesture). Absent: the empty state alone. Derived at each render, never
   * written.
   */
  noViewHeader?: (root: DataViewRootUILogic) => TemplateResult;
  /**
   * A view was added from that empty state and made current: the caller
   * remembers it, as the views bar's `onChangeView` does for "+". Absent:
   * nothing is remembered beyond the view manager.
   */
  onChangeView?: (viewId: string) => void;
  detailPanelConfig: {
    openDetailPanel: (
      target: HTMLElement,
      data: {
        view: SingleView;
        rowId: string;
        /**
         * A Ctrl/Cmd click: the host may open the row in a new tab (ADR 0035
         * §9a). Absent for a gesture with no such modifier.
         */
        newTab?: boolean;
      }
    ) => Promise<void>;
  };
};

export class DataViewRootUILogic {
  private get dataSource() {
    return this.config.dataSource;
  }
  private get viewManager() {
    return this.dataSource.viewManager;
  }
  private createDataViewUILogic(viewId: string): DataViewUILogicBase {
    const view = this.viewManager.viewGet(viewId);
    if (!view) {
      throw new BlockSuiteError(
        BlockSuiteError.ErrorCode.DatabaseBlockError,
        `View ${viewId} not found`
      );
    }

    const pcLogic = view.meta.renderer.pcLogic;
    const mobileLogic = view.meta.renderer.mobileLogic;
    const logic = (IS_MOBILE ? mobileLogic : pcLogic) ?? pcLogic;

    return new (logic(view))(this, view);
  }
  private readonly _viewsCache = new Map<
    string,
    { mode: string; logic: DataViewUILogicBase }
  >();

  private readonly views$ = computed(() => {
    const viewDataList = this.dataSource.viewDataList$.value;
    const validIds = new Set(viewDataList.map(viewData => viewData.id));

    for (const cachedId of this._viewsCache.keys()) {
      if (!validIds.has(cachedId)) {
        this._viewsCache.delete(cachedId);
      }
    }

    return viewDataList.map(viewData => {
      const cached = this._viewsCache.get(viewData.id);
      // The id survives a layout change, the mode does not: a view switched
      // from table to kanban needs a fresh UI logic.
      if (cached && cached.mode === viewData.mode) {
        return cached.logic;
      }
      const logic = this.createDataViewUILogic(viewData.id);
      this._viewsCache.set(viewData.id, {
        mode: viewData.mode,
        logic,
      });
      return logic;
    });
  });

  private readonly viewsMap$ = computed(() => {
    return Object.fromEntries(
      this.views$.value.map(logic => [logic.view.id, logic])
    );
  });
  private readonly _uiRef = signal<DataViewRootUI>();

  get selection$() {
    return this.config.selection$;
  }

  setSelection(selection?: DataViewSelection) {
    this.config.setSelection(selection);
  }

  constructor(public readonly config: DataViewRendererConfig) {}

  get dataViewRenderer() {
    return this._uiRef.value;
  }

  readonly currentViewId$ = computed(() => {
    return this.dataSource.viewManager.currentViewId$.value;
  });

  readonly currentView$ = computed(() => {
    const currentViewId = this.currentViewId$.value;
    if (!currentViewId) {
      return;
    }
    return this.viewsMap$.value[currentViewId];
  });

  focusFirstCell = () => {
    this.currentView$.value?.focusFirstCell();
  };

  /**
   * The one way a view opens a row, whatever its preset (the database block
   * routes it to the host's opener or to its own detail panel, ADR 0035 §9a).
   * `newTab` says the gesture asked for a new tab (`isNewTabClick`).
   */
  openDetailPanel = (ops: {
    view: SingleView;
    rowId: string;
    newTab?: boolean;
    onClose?: () => void;
  }) => {
    const openDetailPanel = this.config.detailPanelConfig.openDetailPanel;
    const target = this.dataViewRenderer;
    if (openDetailPanel && target) {
      openDetailPanel(target, {
        view: ops.view,
        rowId: ops.rowId,
        ...(ops.newTab ? { newTab: true } : {}),
      })
        .catch(console.error)
        .finally(ops.onClose);
    }
  };

  setupViewChangeListener() {
    let preId: string | undefined = undefined;
    return this.currentViewId$.subscribe(current => {
      if (current !== preId) {
        this.config.setSelection(undefined);
      }
      preId = current;
    });
  }

  render() {
    return html` <affine-data-view-renderer
      ${ref(this._uiRef)}
      .logic="${this}"
    ></affine-data-view-renderer>`;
  }
}

export class DataViewRootUI extends SignalWatcher(
  WithDisposable(ShadowlessElement)
) {
  static override styles = css`
    ${unsafeCSS(dataViewCommonStyle('affine-data-view-renderer'))}
    affine-data-view-renderer {
      background-color: var(--affine-background-primary-color);
      display: contents;
    }
  `;

  @property({ attribute: false })
  accessor logic!: DataViewRootUILogic;

  /**
   * The editor this view renders in, absent outside one. Read by the menus a
   * view opens, which render outside it (the colour grid's framework pages,
   * ADR 0036 amendment of 2026-10-14). Typed as the context provides it,
   * like the cells' `chromeStd`; it is still absent outside an editor.
   */
  @consume({ context: stdContext })
  accessor std!: BlockStdScope;

  @state()
  accessor currentView: string | undefined = undefined;

  focusFirstCell = () => {
    this.logic.focusFirstCell();
  };

  openDetailPanel = (ops: {
    view: SingleView;
    rowId: string;
    newTab?: boolean;
    onClose?: () => void;
  }) => {
    this.logic.openDetailPanel(ops);
  };

  /**
   * Where the focus goes when nobody holds it after the view changed under
   * it (WCAG 2.4.3, ADR 0035 amendment of 2026-11-20): the first element
   * marked `data-view-focus-fallback` once this renderer has drawn: the
   * empty state's button (else its status) with no view, the view options'
   * "⋯" with one. Two callers: a menu opened from the keyboard whose opener
   * left with what it did (`popupTargetReturningFocus`), and a local removal
   * of the last view (the database block, `focusAfterLastViewRemoved`).
   * Nothing while another element holds the focus (a mouse click leaves it
   * on the editor host, a host's dialog keeps its own). A target that is not
   * focusable (the status) gets `tabindex="-1"` until it loses the focus, so
   * a click never focuses it.
   */
  async restoreFocus(): Promise<void> {
    await this.updateComplete;
    // The placeholder's elements draw one level per pass, after this one.
    // A view's "⋯" sits several elements down (the view, its header, its
    // toolbar), each drawing one pass after its parent: settle pass by pass
    // until a target is drawn, a bounded number of times.
    const find = () =>
      this.querySelector<HTMLElement>('[data-view-focus-fallback]');
    const settleOnce = () =>
      Promise.all(
        [...this.querySelectorAll('*')].map(
          element =>
            (element as Partial<{ updateComplete: Promise<unknown> }>)
              .updateComplete
        )
      );
    const target = await Array.from({ length: FOCUS_SETTLE_PASSES }).reduce<
      Promise<HTMLElement | null>
    >(async previous => {
      const found = await previous;
      if (found) return found;
      await settleOnce();
      return find();
    }, Promise.resolve(find()));
    const active = document.activeElement;
    if (!target || (active && active !== document.body)) return;
    if (!target.hasAttribute('tabindex')) {
      target.setAttribute('tabindex', '-1');
      target.addEventListener(
        'blur',
        () => target.removeAttribute('tabindex'),
        {
          once: true,
        }
      );
    }
    // Never scrolled to: the removal may come from a host's dialog or a redo
    // while the block is off-screen, and the page must not jump to it.
    target.focus({ preventScroll: true });
  }

  override connectedCallback() {
    super.connectedCallback();
    this.disposables.add(this.logic.setupViewChangeListener());
  }

  override render() {
    const containerClass = classMap({
      'toolbar-hover-container': true,
      'data-view-root': true,
      'prevent-reference-popup': true,
    });
    const currentView = this.logic.currentView$.value;
    if (!currentView) {
      // `currentViewId$` falls back to the first view: no current view is
      // no view at all. Up to 4.0 this drew nothing, header included.
      return html`
        <div style="display: contents" class="${containerClass}">
          ${this.logic.config.noViewHeader?.(this.logic)}
          <data-view-no-view .root="${this.logic}"></data-view-no-view>
        </div>
      `;
    }
    const placeholder = this.logic.config.viewPlaceholder?.(currentView);
    if (placeholder) {
      return html`
        <div style="display: contents" class="${containerClass}">
          ${placeholder}
        </div>
      `;
    }
    return html`
      <div style="display: contents" class="${containerClass}">
        ${renderUniLit(currentView.renderer, {
          logic: currentView,
        })}
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'affine-data-view-renderer': DataViewRootUI;
  }
}
