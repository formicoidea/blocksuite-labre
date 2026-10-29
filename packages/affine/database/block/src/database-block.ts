import { CaptionedBlockComponent } from '@labre/affine-components/caption';
import {
  menu,
  popMenu,
  popupTargetFromElement,
} from '@labre/affine-components/context-menu';
import { DropIndicator } from '@labre/affine-components/drop-indicator';
import { PeekViewProvider } from '@labre/affine-components/peek';
import { toast } from '@labre/affine-components/toast';
import type { DatabaseBlockModel } from '@labre/affine-model';
import { EDGELESS_TOP_CONTENTEDITABLE_SELECTOR } from '@labre/affine-shared/consts';
import { getScrollContainer } from '@labre/affine-shared/utils';
import {
  BlockCommentManager,
  CommentProviderIdentifier,
  type DatabaseAllEvents,
  DocModeProvider,
  type EventTraceFn,
  NotificationProvider,
  PropertiesPanelProvider,
  type TelemetryEventMap,
  TelemetryProvider,
  TOAST_COPIED_TO_CLIPBOARD,
  translateKey,
} from '@labre/affine-shared/services';
import { getDropResult } from '@labre/affine-widget-drag-handle';
import {
  createRecordDetail,
  createUniComponentFromWebComponent,
  type DataSourceBase,
  DataViewRootUILogic,
  DataViewEventTraceKey,
  type DataViewSelection,
  type DataViewUILogicBase,
  type DataViewWidget,
  type DataViewWidgetProps,
  defineUniComponent,
  ExternalGroupByConfigProvider,
  NewRowMenuOpenerKey,
  PageLayoutKey,
  PropertiesPanelOpenerKey,
  renderUniLit,
  type SingleView,
  traceViewEvent,
  uniMap,
  ViewCreationOffKey,
} from '@labre/affine-database-engine';
import { CalendarExternalSourceProvider } from '@labre/affine-database-engine/view-presets';
import { widgetPresets } from '@labre/affine-database-engine/widget-presets';
import { Rect } from '@labre/global/gfx';
import {
  CommentIcon,
  CopyIcon,
  DeleteIcon,
  MoreHorizontalIcon,
} from '@blocksuite/icons/lit';
import { type BlockComponent, BlockSelection } from '@labre/std';
import { RANGE_SYNC_EXCLUDE_ATTR } from '@labre/std/inline';
import { Slice } from '@labre/store';
import { autoUpdate } from '@floating-ui/dom';
import { computed, signal } from '@preact/signals-core';
import { html, nothing } from 'lit';
import { keyed } from 'lit/directives/keyed.js';

import { popSideDetail } from './components/layout.js';
import { DatabaseConfigExtension } from './config.js';
import { DatabaseCreationMenuIdentifier } from './creation-menu.js';
import { EditorHostKey } from './context/host-context.js';
import { DatabaseBlockDataSource } from './data-source.js';
import { HostedDataSourceBase } from './external-data-source.js';
import {
  databaseBlockStyles,
  databaseContentStyles,
  databaseHeaderBarStyles,
  databaseHeaderContainerStyles,
  databaseOpsStyles,
  databaseSourceMissingHintStyles,
  databaseSourceMissingStyles,
  databaseTitleRowStyles,
  databaseTitleStyles,
  databaseToolbarRowStyles,
  databaseViewBarContainerStyles,
} from './database-block-styles.js';
import { BlockRenderer } from './detail-panel/block-renderer.js';
import { NoteRenderer } from './detail-panel/note-renderer.js';
import { sourceRequirement } from './linked-view.js';
import { DatabaseSelection } from './selection.js';
import { isStandaloneDatabase } from './standalone-layout.js';
import {
  databaseOpenRowRequest,
  DatabaseDataSourceProvider,
  DatabaseInitialViewProvider,
  DatabaseNewRowMenuProvider,
  DatabaseOpenRowProvider,
  openDatabasePropertiesPanel,
  rowOpenedParams,
} from './service/index.js';
import {
  DATABASE_CREATION_TITLE,
  DATABASE_NEW_RECORD_MORE,
  DATABASE_SOURCE_MISSING,
  DATABASE_SOURCE_MISSING_HINT,
  DATABASE_SOURCE_REQUIRED,
  DATABASE_SOURCE_REQUIRED_HINT,
  DATABASE_SOURCE_REQUIRED_READ_ONLY,
} from './translations.js';
import { currentViewStorage, initialViewId } from './utils/current-view.js';
import { getSingleDocIdFromText } from './utils/title-doc.js';
import { DatabaseViewCreationIdentifier } from './view-creation.js';
import type { DatabaseViewExtensionOptions } from './view';

export class DatabaseBlockComponent extends CaptionedBlockComponent<DatabaseBlockModel> {
  private readonly clickDatabaseOps = (e: MouseEvent) => {
    const options = this.optionsConfig.configure(this.model, {
      items: [
        menu.input({
          initialValue: this.model.props.title.toString(),
          placeholder: 'Database title',
          onChange: text => {
            this.model.props.title.replace(
              0,
              this.model.props.title.length,
              text
            );
          },
        }),
        menu.action({
          prefix: CommentIcon(),
          name: 'Comment',
          hide: () => !this.std.getOptional(CommentProviderIdentifier),
          select: () => {
            this.std.getOptional(CommentProviderIdentifier)?.addComment([
              new BlockSelection({
                blockId: this.blockId,
              }),
            ]);
          },
        }),
        menu.action({
          prefix: CopyIcon(),
          name: 'Copy',
          select: () => {
            const slice = Slice.fromModels(this.store, [this.model]);
            this.std.clipboard
              .copySlice(slice)
              .then(() => {
                toast(
                  this.host,
                  translateKey(this.std, ...TOAST_COPIED_TO_CLIPBOARD)
                );
              })
              .catch(console.error);
          },
        }),
        menu.group({
          items: [
            menu.action({
              prefix: DeleteIcon(),
              class: {
                'delete-item': true,
              },
              name: 'Delete Database',
              select: () => {
                this.model.children.slice().forEach(block => {
                  this.store.deleteBlock(block);
                });
                this.store.deleteBlock(this.model);
              },
            }),
          ],
        }),
      ],
    });

    popMenu(popupTargetFromElement(e.currentTarget as HTMLElement), {
      options,
    });
  };

  // The block holds a *reference* to its source, rebuilt whenever
  // `externalSourceId` flips (promote-swap / detach / import / re-point) and
  // disposed on disconnect. It never owns the external collection's lifecycle
  // (a single source may be embedded in several blocks).
  private _dataSource?: DataSourceBase;

  private _dataViewRootLogic?: DataViewRootUILogic;

  // Bumps on every rebuild so `renderBlock` can `keyed()` the renderer element,
  // forcing Lit to tear the old one down (disposing its listeners) and mount a
  // fresh one bound to the new source.
  private _sourceVersion = 0;

  /**
   * Every database event leaves here, with the block's id and nothing about
   * its rows (telemetry README, "Databases"): the root's `eventTrace`, and
   * the source's `DataViewEventTraceKey` for code that holds only a view.
   */
  private readonly traceDatabaseEvent: EventTraceFn<DatabaseAllEvents> = (
    key,
    params
  ) => {
    const telemetryService = this.std.getOptional(TelemetryProvider);
    telemetryService?.track(key, {
      ...(params as TelemetryEventMap[typeof key]),
      blockId: this.blockId,
    });
  };

  private _buildDataSource(): DataSourceBase {
    const initFn = (dataSource: DataSourceBase) => {
      dataSource.serviceSet(EditorHostKey, this.host);
      dataSource.serviceSet(DataViewEventTraceKey, this.traceDatabaseEvent);
      dataSource.serviceSet(PageLayoutKey, this.standalone$);
      // With a host properties panel, the view options' "Properties" opens
      // it (ADR 0035 §9b); without, the data-view's popover stays.
      if (this.std.getOptional(PropertiesPanelProvider)) {
        dataSource.serviceSet(PropertiesPanelOpenerKey, viewId => {
          openDatabasePropertiesPanel(this.std, this.model, viewId);
        });
      }
      // With a host menu beside "New" (its templates), the header draws a
      // chevron that opens it; the main part still adds a row (`rowAdd`).
      const newRowMenu = this.std.getOptional(DatabaseNewRowMenuProvider);
      if (newRowMenu) {
        dataSource.serviceSet(NewRowMenuOpenerKey, {
          label: () => translateKey(this.std, ...DATABASE_NEW_RECORD_MORE),
          canOpen: viewId =>
            newRowMenu.canOpen?.({ blockId: this.model.id, viewId }) ?? true,
          open: (anchor, viewId) => {
            newRowMenu.open({ anchor, blockId: this.model.id, viewId });
          },
        });
      }
      // `{ database: false }` takes view creation away, never the views.
      if (!this.std.getOptional(DatabaseViewCreationIdentifier)) {
        dataSource.serviceSet(ViewCreationOffKey, true);
      }
      this.std.provider
        .getAll(ExternalGroupByConfigProvider)
        .forEach(config => {
          dataSource.serviceSet(
            ExternalGroupByConfigProvider(config.name),
            config
          );
        });
      this.std.provider
        .getAll(CalendarExternalSourceProvider)
        .forEach(source => {
          dataSource.serviceSet(
            CalendarExternalSourceProvider(source.id),
            source
          );
        });
    };
    const provider = this.std.getOptional(DatabaseDataSourceProvider);
    const dataSource =
      provider && this.model.props.externalSourceId
        ? provider.createDataSource(this.model, initFn)
        : new DatabaseBlockDataSource(this.model, initFn);
    const id = initialViewId(
      this.model.id,
      viewId => dataSource.viewManager.viewGet(viewId) != null,
      this.std.getOptional(DatabaseInitialViewProvider)
    );
    if (id) dataSource.viewManager.setCurrentView(id);
    // A native database under a host that requires a source is never edited
    // natively, whatever its row count (`sourceRequirement`).
    if (
      dataSource instanceof DatabaseBlockDataSource &&
      sourceRequirement(this.std, this.model) !== 'none'
    ) {
      dataSource.locked$.value = true;
    }
    return dataSource;
  }

  get dataSource(): DataSourceBase {
    if (!this._dataSource) {
      this._dataSource = this._buildDataSource();
    }
    return this._dataSource;
  }

  private rebuildDataSource() {
    this._dataSource?.dispose();
    this._dataSource = undefined;
    this._dataViewRootLogic = undefined;
    this._sourceVersion++;
    this.requestUpdate();
  }

  /**
   * A row that is a document opens where the host says, in the view's
   * `openIn` mode (ADR 0035 §9a, B9); without an opener, or for a row that is
   * a block, the caller keeps the peek view and the side detail of 0.48.
   * Every row open passes here once, so `DatabaseRowOpened` leaves from here
   * (B17), whichever path then opens the row.
   */
  private openRowThroughHost(data: {
    view: SingleView;
    rowId: string;
    newTab?: boolean;
  }): boolean {
    const opener = this.std.getOptional(DatabaseOpenRowProvider);
    const source = this.dataSource;
    const viewData = source.viewDataGet(data.view.id) as
      | { openIn?: unknown }
      | undefined;
    const rowsAreDocuments =
      source instanceof HostedDataSourceBase && source.rowsAreDocuments;
    const request = databaseOpenRowRequest({
      hasOpener: !!opener,
      rowsAreDocuments,
      rowId: data.rowId,
      viewId: data.view.id,
      blockId: this.blockId,
      openIn: viewData?.openIn,
      newTab: data.newTab,
    });
    traceViewEvent(
      data.view,
      'DatabaseRowOpened',
      rowOpenedParams(request, rowsAreDocuments, data.newTab)
    );
    if (!opener || !request) return false;
    opener.open(request);
    return true;
  }

  private readonly renderTitle = (dataViewLogic: DataViewUILogicBase) => {
    return html` <affine-database-title
      class="${databaseTitleStyles}"
      .titleText="${this.model.props.title}"
      .dataViewLogic="${dataViewLogic}"
    ></affine-database-title>`;
  };

  createTemplate = (
    data: {
      view: SingleView;
      rowId: string;
    },
    openDoc: (docId: string) => void
  ) => {
    return createRecordDetail({
      ...data,
      openDoc,
      detail: {
        header: uniMap(
          createUniComponentFromWebComponent(BlockRenderer),
          props => ({
            ...props,
            host: this.host,
          })
        ),
        note: uniMap(
          createUniComponentFromWebComponent(NoteRenderer),
          props => ({
            ...props,
            model: this.model,
            host: this.host,
          })
        ),
      },
    });
  };

  private renderViewBar(props: DataViewWidgetProps) {
    return html`<div class="${databaseViewBarContainerStyles}">
      ${renderUniLit(widgetPresets.viewBar, {
        ...props,
        onChangeView: id => {
          currentViewStorage.setCurrentView(this.blockId, id);
        },
      })}
    </div>`;
  }

  headerWidget: DataViewWidget = defineUniComponent(
    (props: DataViewWidgetProps) => {
      return html`
        <div class="${databaseHeaderContainerStyles}">
          <div class="${databaseTitleRowStyles}">
            ${this.renderTitle(props.dataViewLogic)} ${this.renderDatabaseOps()}
          </div>
          <div class="${databaseToolbarRowStyles} ${databaseHeaderBarStyles}">
            ${this.renderViewBar(props)}
            ${renderUniLit(this.toolsWidget, props)}
          </div>
          ${renderUniLit(widgetPresets.quickSettingBar, props)}
          ${this.renderReadOnlyNotice()}
          <affine-database-values-banner
            .dataSource="${this.dataSource}"
            .std="${this.std}"
            .trace="${this.traceDatabaseEvent}"
          ></affine-database-values-banner>
        </div>
      `;
    }
  );

  indicator = new DropIndicator();

  onDrag = (evt: MouseEvent, id: string): (() => void) => {
    const result = getDropResult(evt);
    if (result && result.rect) {
      document.body.append(this.indicator);
      this.indicator.rect = Rect.fromLWTH(
        result.rect.left,
        result.rect.width,
        result.rect.top,
        result.rect.height
      );
      return () => {
        this.indicator.remove();
        const model = this.store.getBlock(id)?.model;
        const target = result.modelState.model;
        let parent = this.store.getParent(target.id);
        const shouldInsertIn = result.placement === 'in';
        if (shouldInsertIn) {
          parent = target;
        }
        if (model && target && parent) {
          if (shouldInsertIn) {
            this.store.moveBlocks([model], parent);
          } else {
            this.store.moveBlocks(
              [model],
              parent,
              target,
              result.placement === 'before'
            );
          }
        }
      };
    }
    this.indicator.remove();
    return () => {};
  };

  private readonly setSelection = (
    selection: DataViewSelection | undefined
  ) => {
    if (selection) {
      getSelection()?.removeAllRanges();
    }
    this.selection.setGroup(
      'note',
      selection
        ? [
            new DatabaseSelection({
              blockId: this.blockId,
              viewSelection: selection,
            }),
          ]
        : []
    );
  };

  private readonly toolsWidget: DataViewWidget = widgetPresets.createTools({
    table: [
      widgetPresets.tools.filter,
      widgetPresets.tools.sort,
      widgetPresets.tools.search,
      widgetPresets.tools.viewOptions,
      widgetPresets.tools.tableAddRow,
    ],
    kanban: [
      widgetPresets.tools.filter,
      widgetPresets.tools.sort,
      widgetPresets.tools.search,
      widgetPresets.tools.viewOptions,
      widgetPresets.tools.tableAddRow,
    ],
    calendar: [
      widgetPresets.tools.filter,
      widgetPresets.tools.search,
      widgetPresets.tools.viewOptions,
      widgetPresets.tools.tableAddRow,
    ],
    gallery: [
      widgetPresets.tools.filter,
      widgetPresets.tools.sort,
      widgetPresets.tools.search,
      widgetPresets.tools.viewOptions,
      widgetPresets.tools.tableAddRow,
    ],
    list: [
      widgetPresets.tools.filter,
      widgetPresets.tools.sort,
      widgetPresets.tools.search,
      widgetPresets.tools.viewOptions,
      widgetPresets.tools.tableAddRow,
    ],
  });

  private readonly viewSelection$ = computed(() => {
    const databaseSelection = this.selection.value.find(
      (selection): selection is DatabaseSelection => {
        if (selection.blockId !== this.blockId) {
          return false;
        }
        return selection instanceof DatabaseSelection;
      }
    );
    return databaseSelection?.viewSelection;
  });

  private readonly virtualPadding$ = signal(0);

  /**
   * Whether this block is drawn as the page itself (`isStandaloneDatabase`,
   * ADR 0035 amendment of 2026-10-28): handed to data-view as
   * `PageLayoutKey` and reflected as `data-standalone` for the block's own
   * styles. Measured from the DOM, never stored: nothing is written when it
   * changes.
   */
  readonly standalone$ = signal(false);

  refreshStandalone() {
    const standalone = isStandaloneDatabase(this, this.blockId);
    this.toggleAttribute('data-standalone', standalone);
    this.standalone$.value = standalone;
  }

  /**
   * Re-measures when a block mounts or leaves (the parent test), and when a
   * page heading arrives in the scroll container, leaves it or names
   * another body block (the title test). Every `<doc-title>` of the
   * container is watched, so a title whose `body-block-id` is set after it
   * mounted is seen too.
   */
  private watchStandalone() {
    const observer = new MutationObserver(() => {
      this.refreshStandalone();
      observe();
    });
    const observe = () => {
      observer.disconnect();
      const container = getScrollContainer(this);
      observer.observe(container, { childList: true });
      container.querySelectorAll('doc-title').forEach(title => {
        observer.observe(title, {
          attributes: true,
          attributeFilter: ['body-block-id'],
        });
      });
    };
    observe();
    this.disposables.add(() => observer.disconnect());
    this.disposables.add(
      this.std.view.viewUpdated.subscribe(({ type }) => {
        if (type === 'block') this.refreshStandalone();
      })
    );
  }

  get optionsConfig(): DatabaseViewExtensionOptions {
    return {
      configure: (_model, options) => options,
      ...this.std.getOptional(DatabaseConfigExtension.identifier),
    };
  }

  get isCommentHighlighted() {
    return (
      this.std
        .getOptional(BlockCommentManager)
        ?.isBlockCommentHighlighted(this.model) ?? false
    );
  }

  override get topContenteditableElement() {
    if (this.std.get(DocModeProvider).getEditorMode() === 'edgeless') {
      return this.closest<BlockComponent>(
        EDGELESS_TOP_CONTENTEDITABLE_SELECTOR
      );
    }
    return this.rootComponent;
  }

  // ADR 0035 §7: a view whose source the host cannot resolve keeps the title
  // and the view bar, so another view can be picked, and draws this instead of
  // its tools and body: nothing to filter, add or edit, and nothing rewritten.
  private readonly renderSourceMissing = (
    dataViewLogic: DataViewUILogicBase
  ) => {
    const dataSource = this.dataSource;
    if (!(dataSource instanceof HostedDataSourceBase)) return undefined;
    if (!dataSource.sourceMissing$.value) return undefined;
    return html`<div class="${databaseHeaderContainerStyles}">
        <div class="${databaseTitleRowStyles}">
          ${this.renderTitle(dataViewLogic)}
        </div>
        <div class="${databaseToolbarRowStyles} ${databaseHeaderBarStyles}">
          ${this.renderViewBar({ dataViewLogic })}
        </div>
      </div>
      <div
        class="${databaseSourceMissingStyles}"
        data-testid="database-source-missing"
        role="status"
      >
        <div>${translateKey(this.std, ...DATABASE_SOURCE_MISSING)}</div>
        <div class="${databaseSourceMissingHintStyles}">
          ${translateKey(this.std, ...DATABASE_SOURCE_MISSING_HINT)}
        </div>
      </div>`;
  };

  /**
   * A database a host that requires a source must connect first
   * (`sourceRequirement` is `'connect'`, ADR 0035 amendment of 2026-10-29):
   * no source and no row, or a hosted source the host no longer resolves.
   * Drawn in place of the tools and the body: no row, no "New", no cell to
   * type or paste into, so nothing is written. A hosted block keeps its view
   * bar, since another of its views may still read a source. The button
   * reopens the creation popover over the block, for the current view; a
   * read-only document, or a host without the bundle's creation menu, gets
   * the notice alone. Takes precedence over "Source not found" (§7).
   */
  private readonly renderSourceRequired = (
    dataViewLogic: DataViewUILogicBase
  ) => {
    const dataSource = this.dataSource;
    const sourceMissing =
      dataSource instanceof HostedDataSourceBase &&
      dataSource.sourceMissing$.value;
    if (sourceRequirement(this.std, this.model, sourceMissing) !== 'connect') {
      return undefined;
    }
    const hosted = this.model.props.externalSourceId !== undefined;
    const creationMenu = this.std.getOptional(DatabaseCreationMenuIdentifier);
    const connect =
      creationMenu && !this.store.readonly$.value
        ? () =>
            creationMenu.open({
              std: this.std,
              blockId: this.blockId,
              anchor: this,
              viewId: dataViewLogic.view.id,
            })
        : undefined;
    return html`<div class="${databaseHeaderContainerStyles}">
        <div class="${databaseTitleRowStyles}">
          ${this.renderTitle(dataViewLogic)}
        </div>
        ${hosted
          ? html`<div
              class="${databaseToolbarRowStyles} ${databaseHeaderBarStyles}"
            >
              ${this.renderViewBar({ dataViewLogic })}
            </div>`
          : nothing}
      </div>
      <div
        class="${databaseSourceMissingStyles}"
        data-testid="database-source-required"
        role="status"
      >
        <div>${translateKey(this.std, ...DATABASE_SOURCE_REQUIRED)}</div>
        <div class="${databaseSourceMissingHintStyles}">
          ${translateKey(this.std, ...DATABASE_SOURCE_REQUIRED_HINT)}
        </div>
        ${connect
          ? html`<data-view-component-button
              data-testid="database-source-required-connect"
              hoverType="border"
              .onClick="${connect}"
              .text="${translateKey(this.std, ...DATABASE_CREATION_TITLE)}"
            ></data-view-component-button>`
          : nothing}
      </div>`;
  };

  /**
   * Native rows under a host that requires a source (`sourceRequirement` is
   * `'read-only'`): the rows render, locked (`locked$`), with this notice.
   */
  private renderReadOnlyNotice() {
    if (sourceRequirement(this.std, this.model) !== 'read-only') {
      return nothing;
    }
    return html`<div
      class="${databaseSourceMissingStyles}"
      data-testid="database-source-required-read-only"
      role="status"
    >
      <div>${translateKey(this.std, ...DATABASE_SOURCE_REQUIRED)}</div>
      <div class="${databaseSourceMissingHintStyles}">
        ${translateKey(this.std, ...DATABASE_SOURCE_REQUIRED_READ_ONLY)}
      </div>
    </div>`;
  }

  private renderDatabaseOps() {
    if (this.dataSource.readonly$.value) {
      return nothing;
    }
    return html` <div
      data-testid="database-ops"
      class="${databaseOpsStyles}"
      @click="${this.clickDatabaseOps}"
    >
      ${MoreHorizontalIcon()}
    </div>`;
  }

  override connectedCallback() {
    super.connectedCallback();

    this.setAttribute(RANGE_SYNC_EXCLUDE_ATTR, 'true');
    this.classList.add(databaseBlockStyles);
    this.listenFullWidthChange();
    this.refreshStandalone();
    this.watchStandalone();

    // Rebuild the source whenever the block is re-pointed at (or detached from)
    // an external collection. The first (synchronous) emission is skipped: the
    // source is still lazy at this point, so there is nothing to rebuild.
    this.disposables.add(
      this.model.props.externalSourceId$.subscribe(() => {
        if (this._dataSource) {
          this.rebuildDataSource();
        }
      })
    );
  }

  override disconnectedCallback() {
    this._dataSource?.dispose();
    this._dataSource = undefined;
    this._dataViewRootLogic = undefined;
    super.disconnectedCallback();
  }

  listenFullWidthChange() {
    if (this.std.get(DocModeProvider).getEditorMode() === 'edgeless') {
      return;
    }
    this.disposables.add(
      autoUpdate(this.host, this, () => {
        const padding =
          this.getBoundingClientRect().left -
          this.host.getBoundingClientRect().left;
        this.virtualPadding$.value = Math.max(0, padding - 72);
      })
    );
  }

  /**
   * Puts the caret on the current view's first cell, where the view has one
   * (table, kanban; the other presets ignore it): what the page title's
   * Enter and ArrowDown reach when this block is the page's body
   * (`<doc-title .bodyBlockId>`, a database's full page, ADR 0035 B13).
   */
  focusFirstCell() {
    this._dataViewRootLogic?.focusFirstCell();
  }

  private get dataViewRootLogic(): DataViewRootUILogic {
    if (!this._dataViewRootLogic) {
      this._dataViewRootLogic = this._buildDataViewRootLogic();
    }
    return this._dataViewRootLogic;
  }

  private _buildDataViewRootLogic(): DataViewRootUILogic {
    return new DataViewRootUILogic({
      virtualPadding$: this.virtualPadding$,
      bindHotkey: hotkeys => {
        return {
          dispose: this.host.event.bindHotkey(hotkeys, {
            blockId: this.topContenteditableElement?.blockId ?? this.blockId,
          }),
        };
      },
      handleEvent: (name, handler) => {
        return {
          dispose: this.host.event.add(name, handler, {
            blockId: this.blockId,
          }),
        };
      },
      selection$: this.viewSelection$,
      setSelection: this.setSelection,
      dataSource: this.dataSource,
      headerWidget: this.headerWidget,
      viewPlaceholder: logic =>
        this.renderSourceRequired(logic) ?? this.renderSourceMissing(logic),
      onDrag: this.onDrag,
      clipboard: this.std.clipboard,
      dnd: this.std.dnd,
      notification: {
        toast: message => {
          const notification = this.std.getOptional(NotificationProvider);
          if (notification) {
            notification.toast(message);
          } else {
            toast(this.host, message);
          }
        },
      },
      eventTrace: this.traceDatabaseEvent,
      detailPanelConfig: {
        openDetailPanel: (target, data) => {
          if (this.openRowThroughHost(data)) return Promise.resolve();
          const peekViewService = this.std.getOptional(PeekViewProvider);
          if (peekViewService) {
            const openDoc = (docId: string) => {
              return peekViewService.peek({
                docId,
                databaseId: this.blockId,
                databaseDocId: this.model.store.id,
                databaseRowId: data.rowId,
                target: this,
              });
            };
            const doc = getSingleDocIdFromText(
              this.model.store.getBlock(data.rowId)?.model?.text
            );
            if (doc) {
              return openDoc(doc);
            }
            const abort = new AbortController();
            return new Promise<void>(focusBack => {
              peekViewService
                .peek(
                  {
                    target,
                    template: this.createTemplate(data, docId => {
                      // abort.abort();
                      openDoc(docId).then(focusBack).catch(focusBack);
                    }),
                  },
                  { abortSignal: abort.signal }
                )
                .then(focusBack)
                .catch(focusBack);
            });
          } else {
            return popSideDetail(
              this.createTemplate(data, () => {
                //
              })
            );
          }
        },
      },
    });
  }

  override renderBlock() {
    return html`
      <div contenteditable="false" class="${databaseContentStyles}">
        ${keyed(this._sourceVersion, this.dataViewRootLogic.render())}
      </div>
    `;
  }

  override accessor useZeroWidth = true;
}

declare global {
  interface HTMLElementTagNameMap {
    'affine-database': DatabaseBlockComponent;
  }
}
