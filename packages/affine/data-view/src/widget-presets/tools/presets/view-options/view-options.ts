import {
  menu,
  type MenuConfig,
  popMenu,
  type PopupTarget,
  popupTargetFromElement,
} from '@labre/affine-components/context-menu';
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
import { WidgetBase } from '../../../../core/widget/widget-base.js';
import { popFilterRoot } from '../../../quick-setting-bar/filter/root-panel-view.js';
import { popSortRoot } from '../../../quick-setting-bar/sort/root-panel.js';
import {
  DATA_VIEW_COLOR_RULES,
  DATA_VIEW_OPEN_IN,
} from '../../../../translations.js';
import { viewColorRules } from '../../../../core/view/color-rules.js';
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
    popViewOptions(target, this.dataViewLogic, undefined, wordingOf(this.std));
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
      name: 'Properties',
      prefix: InfoIcon(),
      postfix: html` <div style="font-size: 14px;">
          ${view.properties$.value.length} shown
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
        name: 'Filter',
        prefix: FilterIcon(),
        postfix: html` <div style="font-size: 14px;">
            ${filterCount === 0
              ? ''
              : filterCount === 1
                ? '1 filter'
                : `${filterCount} filters`}
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
        name: 'Sort',
        prefix: SortIcon(),
        postfix: html` <div style="font-size: 14px;">
            ${sortCount === 0
              ? ''
              : sortCount === 1
                ? '1 sort'
                : `${sortCount} sorts`}
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
                text: 'Sort',
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
        name: 'Group',
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
export const popViewOptions = (
  target: PopupTarget,
  dataViewLogic: DataViewUILogicBase,
  onClose?: () => void,
  wording: Wording = englishWording
) => {
  const view = dataViewLogic.view;
  const reopen = () => {
    popViewOptions(target, dataViewLogic, undefined, wording);
  };
  const items: MenuConfig[] = [];
  items.push(
    menu.input({
      initialValue: view.name$.value,
      placeholder: 'View name',
      onChange: text => {
        view.nameSet(text);
      },
    })
  );
  items.push(
    menu.group({
      items: [
        menu.action({
          name: 'Layout',
          postfix: html` <div
              style="font-size: 14px;text-transform: capitalize;"
            >
              ${view.type}
            </div>
            ${ArrowRightSmallIcon()}`,
          select: () => {
            openViewSetting(target, dataViewLogic, 'layout', reopen, wording);
          },
          prefix: LayoutIcon(),
        }),
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
          name: 'Duplicate',
          prefix: DuplicateIcon(),
          select: () => {
            view.duplicate();
          },
        }),
        menu.action({
          name: 'Delete',
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
        text: 'View settings',
      },
      items,
      onClose: onClose,
    },
  });
};
