import {
  menu,
  type MenuButtonData,
  type MenuConfig,
  type MenuOptions,
  popMenu,
  type PopupTarget,
} from '@labre/affine-components/context-menu';
import {
  CenterPeekIcon,
  ExpandFullIcon,
  RightSidebarIcon,
} from '@blocksuite/icons/lit';
import type { DatabaseViewOpenIn } from '@labre/affine-model';
import type { ChromeWording } from '@labre/affine-shared/services';
import { html, type TemplateResult } from 'lit';
import { styleMap } from 'lit/directives/style-map.js';

import { popPropertiesSetting } from '../../../../core/common/properties.js';
import { filterTraitKey } from '../../../../core/filter/trait.js';
import {
  popGroupSetting,
  popSelectGroupByProperty,
} from '../../../../core/group-by/setting.js';
import { groupTraitKey } from '../../../../core/group-by/trait.js';
import {
  type DataViewUILogicBase,
  renderUniLit,
} from '../../../../core/index.js';
import type { Wording } from '../../../../core/utils/wording.js';
import {
  rowsArePages,
  viewOpenIn,
  viewOpenInSet,
} from '../../../../core/view/open-in.js';
import { PropertiesPanelOpenerKey } from '../../../../core/view-manager/properties-panel-opener.js';
import {
  DATA_VIEW_OPEN_IN,
  DATA_VIEW_OPEN_IN_CENTER,
  DATA_VIEW_OPEN_IN_FULL,
  DATA_VIEW_OPEN_IN_SIDE,
} from '../../../../translations.js';
import { popColorRules } from './color-rules-menu.js';

/**
 * The settings of a view that a menu entry opens on its own (labre PRD
 * REQ-DB-10: the "This view" section of a host's header menu lists them for
 * the full page of a database). The view settings menu (`popViewOptions`)
 * opens the very same functions from its entries, so a host's entry and the
 * library's own menu are one code path: same menus, same writes, same
 * "back" to the view settings. Open: a later minor may add a key.
 */
export type ViewSettingKey =
  | 'layout'
  | 'properties'
  | 'group'
  | 'open-in'
  | 'color-rules';

/** The three places a row's page opens, in the stored order (ADR 0035 §8). */
const OPEN_IN_CHOICES: readonly {
  mode: DatabaseViewOpenIn;
  wording: ChromeWording;
  icon: () => TemplateResult;
}[] = [
  { mode: 'side', wording: DATA_VIEW_OPEN_IN_SIDE, icon: RightSidebarIcon },
  { mode: 'center', wording: DATA_VIEW_OPEN_IN_CENTER, icon: CenterPeekIcon },
  { mode: 'full', wording: DATA_VIEW_OPEN_IN_FULL, icon: ExpandFullIcon },
];

/**
 * Whether the current view offers `key`: grouping needs the group trait,
 * "Open pages in" a source whose rows are pages (B8), conditional colours
 * the filter trait, whose conditions a rule is made of (ADR 0036; the
 * calendar has none, and paints no rule). A read-only or
 * fallback view offers nothing: its settings menu is not drawn either.
 */
export function viewSettingAvailable(
  dataViewLogic: DataViewUILogicBase,
  key: ViewSettingKey
): boolean {
  const view = dataViewLogic.view;
  if (view.readonly$.value || view.shownAsFallback$.value) return false;
  switch (key) {
    case 'group':
      return !!view.traitGet(groupTraitKey);
    case 'open-in':
      return rowsArePages(view.manager.dataSource);
    case 'color-rules':
      return !!view.traitGet(filterTraitKey);
    case 'layout':
    case 'properties':
      return true;
  }
}

/** The current "Open pages in" choice, with its wording, for a postfix. */
export function openInCurrent(dataViewLogic: DataViewUILogicBase) {
  const view = dataViewLogic.view;
  const current = viewOpenIn(view.manager.dataSource.viewDataGet(view.id));
  return OPEN_IN_CHOICES.find(choice => choice.mode === current);
}

/**
 * "Open pages in" (B8, PRD REQ-DB-11) as menu options: a view setting shared
 * by everyone, written on the pick alone.
 */
export function openInOptions(
  dataViewLogic: DataViewUILogicBase,
  reopen: () => void,
  wording: Wording
): MenuOptions {
  const view = dataViewLogic.view;
  const current = openInCurrent(dataViewLogic)?.mode;
  return {
    title: { text: wording(DATA_VIEW_OPEN_IN) },
    items: OPEN_IN_CHOICES.map(choice =>
      menu.action({
        name: wording(choice.wording),
        prefix: choice.icon(),
        isSelected: choice.mode === current,
        select: () => {
          viewOpenInSet(view, choice.mode);
          reopen();
        },
      })
    ),
  };
}

function popLayout(
  target: PopupTarget,
  dataViewLogic: DataViewUILogicBase,
  reopen: () => void
) {
  const view = dataViewLogic.view;
  const viewTypes = view.manager.viewMetas.map<MenuConfig>(meta => {
    return menu => {
      if (!menu.search(meta.model.defaultName)) {
        return;
      }
      const isSelected = meta.type === view.manager.currentView$.value?.type;
      const iconStyle = styleMap({
        fontSize: '24px',
        color: isSelected
          ? 'var(--affine-text-emphasis-color)'
          : 'var(--affine-icon-secondary)',
      });
      const textStyle = styleMap({
        fontSize: '14px',
        lineHeight: '22px',
        color: isSelected
          ? 'var(--affine-text-emphasis-color)'
          : 'var(--affine-text-secondary-color)',
      });
      const data: MenuButtonData = {
        content: () => html`
          <div
            style="color:var(--affine-text-emphasis-color);width:100%;display: flex;flex-direction: column;align-items: center;justify-content: center;padding: 6px 16px;white-space: nowrap"
          >
            <div style="${iconStyle}">${renderUniLit(meta.renderer.icon)}</div>
            <div style="${textStyle}">${meta.model.defaultName}</div>
          </div>
        `,
        select: () => {
          const id = view.manager.currentViewId$.value;
          // Re-picking the current layout would reset the view to the
          // defaults of its own type, dropping widths and filters.
          if (!id || meta.type === view.type) {
            return;
          }
          dataViewLogic.eventTrace('DatabaseViewTypeChanged', {
            fromViewType: view.type,
            toViewType: meta.type,
          });
          view.manager.viewChangeType(id, meta.type);
          dataViewLogic.clearSelection();
        },
        class: {},
      };
      const containerStyle = styleMap({
        flex: '1',
      });
      return html` <affine-menu-button
        style="${containerStyle}"
        .data="${data}"
        .menu="${menu}"
      ></affine-menu-button>`;
    };
  });
  popMenu(target, {
    options: {
      title: {
        onBack: reopen,
        text: 'Layout',
      },
      items: [
        menu => {
          const result = menu.renderItems(viewTypes);
          if (result.length) {
            return html` <div style="display: flex">${result}</div>`;
          }
          return html``;
        },
      ],
    },
  });
}

/**
 * Open the menu of one view setting, anchored on `target`. `reopen` is the
 * menus' "back" (the view settings menu). A setting the view does not offer
 * opens nothing.
 */
export function popViewSetting(
  target: PopupTarget,
  dataViewLogic: DataViewUILogicBase,
  key: ViewSettingKey,
  reopen: () => void,
  wording: Wording
): void {
  if (!viewSettingAvailable(dataViewLogic, key)) return;
  openViewSetting(target, dataViewLogic, key, reopen, wording);
}

/**
 * The entries of the view settings menu: the same openers, without the
 * availability check, since that menu decides itself which entries it draws.
 */
export function openViewSetting(
  target: PopupTarget,
  dataViewLogic: DataViewUILogicBase,
  key: ViewSettingKey,
  reopen: () => void,
  wording: Wording
): void {
  const view = dataViewLogic.view;
  switch (key) {
    case 'layout':
      popLayout(target, dataViewLogic, reopen);
      return;
    case 'properties': {
      const openPanel = view.serviceGet(PropertiesPanelOpenerKey);
      if (openPanel) {
        openPanel(view.id);
        return;
      }
      popPropertiesSetting(target, { view, onBack: reopen });
      return;
    }
    case 'group': {
      const groupTrait = view.traitGet(groupTraitKey);
      if (!groupTrait) return;
      if (!groupTrait.property$.value) {
        popSelectGroupByProperty(target, groupTrait, {
          onSelect: () => popGroupSetting(target, groupTrait, reopen, wording),
          onBack: reopen,
        });
      } else {
        popGroupSetting(target, groupTrait, reopen, wording);
      }
      return;
    }
    case 'open-in':
      popMenu(target, {
        options: openInOptions(dataViewLogic, reopen, wording),
      });
      return;
    case 'color-rules':
      popColorRules(target, dataViewLogic, reopen, wording);
      return;
  }
}
