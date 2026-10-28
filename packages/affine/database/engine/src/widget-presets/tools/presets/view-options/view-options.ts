import {
  menu,
  type MenuConfig,
  popMenu,
  type PopupTarget,
  popupTargetFromElement,
} from '@labre/affine-components/context-menu';
import {
  TOOLBAR_DELETE,
  TOOLBAR_DUPLICATE,
} from '@labre/affine-shared/services';
import { unsafeCSSVarV2 } from '@labre/affine-shared/theme';
import {
  ArrowRightSmallIcon,
  DeleteIcon,
  DuplicateIcon,
  FilterIcon,
  GroupingIcon,
  InfoIcon,
  LayoutIcon,
  MoreHorizontalIcon,
  OpenInNewIcon,
  PaletteIcon,
  SortIcon,
} from '@blocksuite/icons/lit';
import { type BlockStdScope, stdContext } from '@labre/std';
import { consume } from '@lit/context';
import { css, html } from 'lit';

import { filterTraitKey } from '../../../../core/filter/trait.js';
import { groupTraitKey } from '../../../../core/group-by/trait.js';
import {
  type DataViewUILogicBase,
  emptyFilterGroup,
  popCreateFilter,
} from '../../../../core/index.js';
import { popCreateSort } from '../../../../core/sort/add-sort.js';
import { sortTraitKey } from '../../../../core/sort/manager.js';
import { createSortUtils } from '../../../../core/sort/utils.js';
import {
  englishWording,
  type Wording,
  wordingOf,
} from '../../../../core/utils/wording.js';
import { ViewSettingsMenuIdentifier } from '../../../../core/view-manager/view-settings-menu.js';
import { WidgetBase } from '../../../../core/widget/widget-base.js';
import { popFilterRoot } from '../../../quick-setting-bar/filter/root-panel-view.js';
import { popSortRoot } from '../../../quick-setting-bar/sort/root-panel.js';
import {
  DATA_VIEW_COLOR_RULES,
  DATA_VIEW_FILTER,
  DATA_VIEW_FILTER_COUNT,
  DATA_VIEW_GROUP,
  DATA_VIEW_LAYOUT,
  DATA_VIEW_OPEN_IN,
  DATA_VIEW_PROPERTIES,
  DATA_VIEW_PROPERTIES_SHOWN,
  DATA_VIEW_SORT,
  DATA_VIEW_SORT_COUNT,
  DATA_VIEW_VIEW_SETTINGS,
  VIEWS_BAR_VIEW_NAME,
} from '../../../../translations.js';
import { viewColorRules } from '../../../../core/view/color-rules.js';
import { viewPresetName } from '../../../../core/view/default-name.js';
import {
  openInCurrent,
  openInOptions,
  openViewSetting,
  popViewSetting,
  type ViewSettingKey,
  viewSettingAvailable,
} from './view-settings.js';

const styles = css`
  .affine-database-toolbar-item.more-action {
    padding: 2px;
    border-radius: 4px;
    display: flex;
    align-items: center;
    cursor: pointer;
  }

  .affine-database-toolbar-item.more-action:hover {
    background: var(--affine-hover-color);
  }

  .affine-database-toolbar-item.more-action {
    font-size: 20px;
    color: ${unsafeCSSVarV2('icon/primary')};
  }

  .more-action.active {
    background: var(--affine-hover-color);
  }

  /* A finger needs 44px: the host's touch-target floor (P7). */
  @media (pointer: coarse) {
    .affine-database-toolbar-item.more-action {
      min-width: 44px;
      min-height: 44px;
      justify-content: center;
    }
  }
`;

export class DataViewHeaderToolsViewOptions extends WidgetBase {
  static override styles = styles;

  /** Absent outside an editor host: the wordings read English. */
  @consume({ context: stdContext })
  accessor std!: BlockStdScope;

  clickMoreAction = (e: MouseEvent) => {
    e.stopPropagation();
    this.openMoreAction(popupTargetFromElement(e.currentTarget as HTMLElement));
  };

  openMoreAction = (target: PopupTarget) => {
    popViewOptions(
      target,
      this.dataViewLogic,
      undefined,
      wordingOf(this.std),
      this.std
    );
  };

  /**
   * Whether the current view offers setting `key` now (labre PRD REQ-DB-10:
   * what a host's "This view" menu lists for the full page of a database).
   */
  settingAvailable(key: ViewSettingKey): boolean {
    return viewSettingAvailable(this.dataViewLogic, key);
  }

  /**
   * Open the menu of one setting of the current view, anchored on this
   * button, its "back" leading to the view settings: the entry the view
   * settings menu would open, for a caller outside it (a host's menu, through
   * the database page's view-menu commands). Nothing when not offered.
   */
  openSetting(key: ViewSettingKey): void {
    const target = popupTargetFromElement(this);
    popViewSetting(
      target,
      this.dataViewLogic,
      key,
      () => this.openMoreAction(target),
      wordingOf(this.std)
    );
  }

  override render() {
    if (this.view.readonly$.value) {
      return;
    }
    return html` <div
      class="affine-database-toolbar-item more-action"
      @click="${this.clickMoreAction}"
    >
      ${MoreHorizontalIcon()}
    </div>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'data-view-header-tools-view-options': DataViewHeaderToolsViewOptions;
  }
}
/**
 * "Open pages in" (B8, PRD REQ-DB-11): a view setting shared by everyone,
 * offered only where rows are pages, written on the pick alone.
 */
const openInMenu = (
  dataViewLogic: DataViewUILogicBase,
  reopen: () => void,
  wording: Wording
): MenuConfig | undefined => {
  if (!viewSettingAvailable(dataViewLogic, 'open-in')) return;
  const currentChoice = openInCurrent(dataViewLogic);
  return menu.subMenu({
    name: wording(DATA_VIEW_OPEN_IN),
    prefix: OpenInNewIcon(),
    postfix: html` <div style="font-size: 14px;">
      ${currentChoice ? wording(currentChoice.wording) : ''}
    </div>`,
    options: openInOptions(dataViewLogic, reopen, wording),
  });
};

const createSettingMenus = (
  target: PopupTarget,
  dataViewLogic: DataViewUILogicBase,
  reopen: () => void,
  wording: Wording
) => {
  const view = dataViewLogic.view;
  const settingItems: MenuConfig[] = [];
  settingItems.push(
    menu.action({
      name: wording(DATA_VIEW_PROPERTIES),
      prefix: InfoIcon(),
      postfix: html` <div style="font-size: 14px;">
          ${wording(DATA_VIEW_PROPERTIES_SHOWN, {
            count: view.properties$.value.length,
          })}
        </div>
        ${ArrowRightSmallIcon()}`,
      select: () => {
        openViewSetting(target, dataViewLogic, 'properties', reopen, wording);
      },
    })
  );
  const filterTrait = view.traitGet(filterTraitKey);
  if (filterTrait) {
    const filterCount = filterTrait.filter$.value.conditions.length;
    settingItems.push(
      menu.action({
        name: wording(DATA_VIEW_FILTER),
        prefix: FilterIcon(),
        postfix: html` <div style="font-size: 14px;">
            ${filterCount === 0
              ? ''
              : wording(DATA_VIEW_FILTER_COUNT, { count: filterCount })}
          </div>
          ${ArrowRightSmallIcon()}`,
        select: () => {
          if (!filterTrait.filter$.value.conditions.length) {
            popCreateFilter(target, {
              vars: view.vars$,
              onBack: reopen,
              onSelect: filter => {
                filterTrait.filterSet({
                  ...(filterTrait.filter$.value ?? emptyFilterGroup),
                  conditions: [...filterTrait.filter$.value.conditions, filter],
                });
                popFilterRoot(target, {
                  filterTrait: filterTrait,
                  onBack: reopen,
                  dataViewLogic: dataViewLogic,
                });
                dataViewLogic.eventTrace('CreateDatabaseFilter', {});
              },
            });
          } else {
            popFilterRoot(target, {
              filterTrait: filterTrait,
              onBack: reopen,
              dataViewLogic: dataViewLogic,
            });
          }
        },
      })
    );
  }
  const sortTrait = view.traitGet(sortTraitKey);
  if (sortTrait) {
    const sortCount = sortTrait.sortList$.value.length;
    settingItems.push(
      menu.action({
        name: wording(DATA_VIEW_SORT),
        prefix: SortIcon(),
        postfix: html` <div style="font-size: 14px;">
            ${sortCount === 0
              ? ''
              : wording(DATA_VIEW_SORT_COUNT, { count: sortCount })}
          </div>
          ${ArrowRightSmallIcon()}`,
        select: () => {
          const sortList = sortTrait.sortList$.value;
          const sortUtils = createSortUtils(
            sortTrait,
            dataViewLogic.eventTrace
          );
          if (!sortList.length) {
            popCreateSort(target, {
              sortUtils: sortUtils,
              onBack: reopen,
            });
          } else {
            popSortRoot(target, {
              sortUtils: sortUtils,
              title: {
                text: wording(DATA_VIEW_SORT),
                onBack: reopen,
              },
            });
          }
        },
      })
    );
  }
  const groupTrait = view.traitGet(groupTraitKey);
  if (groupTrait) {
    settingItems.push(
      menu.action({
        name: wording(DATA_VIEW_GROUP),
        prefix: GroupingIcon(),
        postfix: html` <div style="font-size: 14px;">
            ${groupTrait.property$.value?.name$.value ?? ''}
          </div>
          ${ArrowRightSmallIcon()}`,
        select: () => {
          openViewSetting(target, dataViewLogic, 'group', reopen, wording);
        },
      })
    );
  }
  if (viewSettingAvailable(dataViewLogic, 'color-rules')) {
    const ruleCount = viewColorRules(
      view.manager.dataSource.viewDataGet(view.id)
    ).length;
    settingItems.push(
      menu.action({
        name: wording(DATA_VIEW_COLOR_RULES),
        prefix: PaletteIcon(),
        postfix: html` <div style="font-size: 14px;">${ruleCount || ''}</div>
          ${ArrowRightSmallIcon()}`,
        testId: 'dv-view-setting-color-rules',
        select: () => {
          openViewSetting(
            target,
            dataViewLogic,
            'color-rules',
            reopen,
            wording
          );
        },
      })
    );
  }
  const openIn = openInMenu(dataViewLogic, reopen, wording);
  if (openIn) settingItems.push(openIn);
  return settingItems;
};
/**
 * The view settings menu. `std` (optional and last, so a 0.61 caller
 * compiles unchanged) is the editor the view is drawn in: with it, the
 * entries a {@link ViewSettingsMenuIdentifier} offers join the Layout group,
 * after "Layout" (the `core-database` bundle's "Source"); without it, the
 * 0.61 menu.
 */
export const popViewOptions = (
  target: PopupTarget,
  dataViewLogic: DataViewUILogicBase,
  onClose?: () => void,
  wording: Wording = englishWording,
  std?: BlockStdScope
) => {
  const view = dataViewLogic.view;
  const reopen = () => {
    popViewOptions(target, dataViewLogic, undefined, wording, std);
  };
  const currentLayout = view.manager.viewMetas.find(
    meta => meta.type === view.type
  );
  const items: MenuConfig[] = [];
  items.push(
    menu.input({
      initialValue: view.name$.value,
      placeholder: wording(VIEWS_BAR_VIEW_NAME),
      onChange: text => {
        view.nameSet(text);
      },
    })
  );
  items.push(
    menu.group({
      items: [
        menu.action({
          name: wording(DATA_VIEW_LAYOUT),
          postfix: html` <div style="font-size: 14px;">
              ${currentLayout ? viewPresetName(currentLayout, wording) : ''}
            </div>
            ${ArrowRightSmallIcon()}`,
          select: () => {
            openViewSetting(target, dataViewLogic, 'layout', reopen, wording);
          },
          prefix: LayoutIcon(),
        }),
        ...(std?.getOptional(ViewSettingsMenuIdentifier)?.items({
          std,
          dataViewLogic,
          target,
          reopen,
          wording,
        }) ?? []),
      ],
    })
  );

  items.push(
    menu.group({
      items: createSettingMenus(target, dataViewLogic, reopen, wording),
    })
  );
  items.push(
    menu.group({
      items: [
        menu.action({
          name: wording(TOOLBAR_DUPLICATE),
          prefix: DuplicateIcon(),
          select: () => {
            view.duplicate();
          },
        }),
        menu.action({
          name: wording(TOOLBAR_DELETE),
          prefix: DeleteIcon(),
          select: () => {
            view.delete();
          },
          class: { 'delete-item': true },
        }),
      ],
    })
  );
  popMenu(target, {
    options: {
      title: {
        text: wording(DATA_VIEW_VIEW_SETTINGS),
      },
      items,
      onClose: onClose,
    },
  });
};
