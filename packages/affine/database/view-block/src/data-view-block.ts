import { DatabaseSelection } from '@labre/affine-database-block';
import { CaptionedBlockComponent } from '@labre/affine-components/caption';
import {
  menu,
  popMenu,
  popupTargetFromElement,
} from '@labre/affine-components/context-menu';
import { CopyIcon, DeleteIcon } from '@labre/affine-components/icons';
import { EDGELESS_TOP_CONTENTEDITABLE_SELECTOR } from '@labre/affine-shared/consts';
import {
  DocModeProvider,
  DOC_UNTITLED,
  TOOLBAR_COPY,
  translateKey,
} from '@labre/affine-shared/services';
import {
  type DataSource,
  dataViewCommonStyle,
  type DataViewProps,
  type DataViewSelection,
  type DataViewWidget,
  type DataViewWidgetProps,
  defineUniComponent,
  renderUniLit,
} from '@labre/affine-database-engine';
import { widgetPresets } from '@labre/affine-database-engine/widget-presets';
import { MoreHorizontalIcon } from '@blocksuite/icons/lit';
import { type BlockComponent } from '@labre/std';
import { RANGE_SYNC_EXCLUDE_ATTR } from '@labre/std/inline';
import { Slice } from '@labre/store';
import { computed } from '@preact/signals-core';
import { css, nothing, unsafeCSS } from 'lit';
import { html } from 'lit/static-html.js';

import { BlockQueryDataSource } from './data-source.js';
import type { DataViewBlockModel } from './data-view-model.js';
import { DATABASE_DELETE } from '@labre/affine-database-block/translations';
import {
  DATA_VIEW_BLOCK_OPTIONS,
  DATA_VIEW_BLOCK_UNAVAILABLE,
  DATA_VIEW_BLOCK_UNAVAILABLE_HINT,
} from './translations.js';

export class DataViewBlockComponent extends CaptionedBlockComponent<DataViewBlockModel> {
  // A light-DOM sheet scoped on this block's own tag. Upstream scoped it on
  // the database block's tag, so it was this sheet that painted the database
  // block's `--affine-background-primary-color` card, a second colour on a
  // page whose background is another token (the playground in dark mode).
  // Neither block paints a background: the page's shows through
  // (`block-styles-scope.unit.spec.ts`).
  static override styles = css`
    ${unsafeCSS(dataViewCommonStyle('affine-data-view'))}
    affine-data-view {
      display: block;
      border-radius: 8px;
      padding: 8px;
      margin: 8px -8px -8px;
    }

    .database-block-selected {
      background-color: var(--affine-hover-color);
      border-radius: 4px;
    }

    .database-ops {
      padding: 2px;
      border-radius: 4px;
      display: flex;
      cursor: pointer;
    }

    .database-ops svg {
      width: 16px;
      height: 16px;
      color: var(--affine-icon-color);
    }

    .database-ops:hover {
      background-color: var(--affine-hover-color);
    }

    affine-data-view button.database-ops {
      border: none;
      background: none;
      color: inherit;
      font: inherit;
    }

    affine-data-view button.database-ops:focus-visible {
      outline: 2px solid
        var(--affine-focus-ring-color, var(--affine-primary-color));
      outline-offset: 1px;
    }

    affine-data-view .data-view-block-unavailable {
      display: flex;
      flex-direction: column;
      gap: 4px;
      margin: 8px 0;
      padding: 12px;
      border-radius: 8px;
      font-size: 14px;
      line-height: 22px;
      color: var(--affine-text-primary-color);
      background-color: var(--affine-hover-color);
    }

    affine-data-view .data-view-block-unavailable-hint {
      color: var(--affine-text-secondary-color);
    }

    @media print {
      .database-ops {
        display: none;
      }

      .database-header-bar {
        display: none !important;
      }
    }
  `;

  private readonly _clickDatabaseOps = (e: MouseEvent) => {
    popMenu(popupTargetFromElement(e.currentTarget as HTMLElement), {
      options: {
        items: [
          menu.input({
            initialValue: this.model.props.title,
            placeholder: translateKey(this.std, ...DOC_UNTITLED),
            onChange: text => {
              this.model.props.title = text;
            },
          }),
          menu.action({
            prefix: CopyIcon,
            name: translateKey(this.std, ...TOOLBAR_COPY),
            select: () => {
              const slice = Slice.fromModels(this.store, [this.model]);
              this.std.clipboard.copySlice(slice).catch(console.error);
            },
          }),
          menu.group({
            name: '',
            items: [
              menu.action({
                prefix: DeleteIcon,
                class: {
                  'delete-item': true,
                },
                name: translateKey(this.std, ...DATABASE_DELETE),
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
      },
    });
  };

  private _dataSource?: DataSource;

  /** @deprecated Unread since #745 (the block draws a placeholder); kept as public API until a major. */
  _bindHotkey: DataViewProps['bindHotkey'] = hotkeys => {
    return {
      dispose: this.host.event.bindHotkey(hotkeys, {
        blockId: this.topContenteditableElement?.blockId ?? this.blockId,
      }),
    };
  };

  /** @deprecated Unread since #745 (the block draws a placeholder); kept as public API until a major. */
  _handleEvent: DataViewProps['handleEvent'] = (name, handler) => {
    return {
      dispose: this.host.event.add(name, handler, {
        blockId: this.blockId,
      }),
    };
  };

  /** @deprecated Unread since #745 (the block draws a placeholder); kept as public API until a major. */
  headerWidget: DataViewWidget = defineUniComponent(
    (props: DataViewWidgetProps) => {
      return html`
        <div style="margin-bottom: 16px;display:flex;flex-direction: column">
          <div style="display:flex;gap:8px;padding: 0 6px;margin-bottom: 8px;">
            <div>${this.model.props.title}</div>
            ${this.renderDatabaseOps()}
          </div>
          <div
            style="display:flex;align-items:center;justify-content: space-between;gap: 12px"
            class="database-header-bar"
          >
            <div style="flex:1;min-width:0">
              ${renderUniLit(widgetPresets.viewBar, props)}
            </div>
            ${renderUniLit(this.toolsWidget, props)}
          </div>
          ${renderUniLit(widgetPresets.quickSettingBar, props)}
        </div>
      `;
    }
  );

  /** @deprecated Unread since #745 (the block draws a placeholder); kept as public API until a major. */
  selection$ = computed(() => {
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

  /** @deprecated Unread since #745 (the block draws a placeholder); kept as public API until a major. */
  setSelection = (selection: DataViewSelection | undefined) => {
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

  /** @deprecated Unread since #745 (the block draws a placeholder); kept as public API until a major. */
  toolsWidget: DataViewWidget = widgetPresets.createTools({
    table: [
      widgetPresets.tools.filter,
      widgetPresets.tools.search,
      widgetPresets.tools.viewOptions,
      widgetPresets.tools.tableAddRow,
    ],
    kanban: [
      widgetPresets.tools.filter,
      widgetPresets.tools.search,
      widgetPresets.tools.viewOptions,
    ],
  });

  /** @deprecated The block stopped reading it in #745; only the never-registered slash-menu entry does. Kept as public API until a major. */
  get dataSource(): DataSource {
    if (!this._dataSource) {
      this._dataSource = new BlockQueryDataSource(this.host, this.model, {
        type: 'todo',
      });
    }
    return this._dataSource;
  }

  override get topContenteditableElement() {
    if (this.std.get(DocModeProvider).getEditorMode() === 'edgeless') {
      return this.closest<BlockComponent>(
        EDGELESS_TOP_CONTENTEDITABLE_SELECTOR
      );
    }
    return this.rootComponent;
  }

  /**
   * The block's "⋯" (rename, copy, delete). Under the placeholder it is the
   * block's only control (#745), so a real button: in the tab order, pressed
   * by Enter and Space, named, with the house focus ring.
   */
  private renderDatabaseOps() {
    if (this.store.readonly) {
      return nothing;
    }
    const label = translateKey(this.std, ...DATA_VIEW_BLOCK_OPTIONS);
    return html`<button
      type="button"
      class="database-ops"
      data-testid="data-view-block-options"
      aria-label=${label}
      aria-haspopup="menu"
      title=${label}
      @click=${this._clickDatabaseOps}
    >
      ${MoreHorizontalIcon()}
    </button>`;
  }

  override connectedCallback() {
    super.connectedCallback();

    this.setAttribute(RANGE_SYNC_EXCLUDE_ATTR, 'true');
  }

  /**
   * The title row and its "⋯" (rename, copy, delete; none on a read-only
   * document), then a status in place of the views (issue #745, product owner
   * decision of 2026-11-24, ADR 0035 amendment of 2026-11-24). The block's
   * data source was never ported to the view engine (`BlockQueryDataSource`,
   * its `ponytail:` line), so the engine is never built here and
   * `dataSource` is never read: a stored block draws, and writes nothing.
   * Modelled on the database's `sourceUnavailableNotice`: a status, no
   * button, its sheet (`databaseSourceMissingStyles`) restated here scoped
   * under the block's tag.
   */
  override renderBlock() {
    return html`
      <div contenteditable="false" style="position: relative">
        <div style="display:flex;gap:8px;padding: 0 6px;margin-bottom: 8px;">
          <div>${this.model.props.title}</div>
          ${this.renderDatabaseOps()}
        </div>
        <div
          class="data-view-block-unavailable"
          data-testid="data-view-block-unavailable"
          role="status"
        >
          <div>${translateKey(this.std, ...DATA_VIEW_BLOCK_UNAVAILABLE)}</div>
          <div class="data-view-block-unavailable-hint">
            ${translateKey(this.std, ...DATA_VIEW_BLOCK_UNAVAILABLE_HINT)}
          </div>
        </div>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'affine-data-view': DataViewBlockComponent;
  }
}
