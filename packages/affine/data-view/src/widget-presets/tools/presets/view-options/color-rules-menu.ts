import {
  menu,
  popMenu,
  type PopupTarget,
  popupTargetFromElement,
  subMenuMiddleware,
} from '@labre/affine-components/context-menu';
import { TOOLBAR_DELETE } from '@labre/affine-shared/services';
import {
  ArrowDownSmallIcon,
  ArrowRightSmallIcon,
  ArrowUpSmallIcon,
  DeleteIcon,
  PlusIcon,
} from '@blocksuite/icons/lit';
import { computed } from '@preact/signals-core';
import { html } from 'lit';
import { styleMap } from 'lit/directives/style-map.js';

import { selectOptionColorGrid } from '../../../../core/component/tags/color-menu.js';
import { selectOptionColors } from '../../../../core/component/tags/colors.js';
import type { Variable } from '../../../../core/expression/types.js';
import { popCreateFilter } from '../../../../core/filter/add-filter.js';
import type { Filter, FilterGroup } from '../../../../core/filter/types.js';
import { emptyFilterGroup } from '../../../../core/filter/utils.js';
import type { DataViewUILogicBase } from '../../../../core/index.js';
import type { Wording } from '../../../../core/utils/wording.js';
import {
  colorRuleAdd,
  colorRuleDelete,
  colorRuleMove,
  colorRulePaint,
  colorRuleUpdate,
  type ViewColorRule,
  viewColorRules,
} from '../../../../core/view/color-rules.js';
import {
  DATA_VIEW_COLOR_RULE,
  DATA_VIEW_COLOR_RULE_ADD_CONDITION,
  DATA_VIEW_COLOR_RULE_MOVE_DOWN,
  DATA_VIEW_COLOR_RULE_MOVE_UP,
  DATA_VIEW_COLOR_RULE_NO_CONDITION,
  DATA_VIEW_COLOR_RULES,
  DATA_VIEW_COLOR_RULES_ADD,
} from '../../../../translations.js';

/**
 * The editor of a view's conditional colours (ADR 0036, labre PRD
 * REQ-DB-10): a view setting, opened from the view settings menu and from
 * the full page's "This view" (`openViewSetting(…, 'color-rules')`). Made of
 * what the view's filter and an option's colour already use, nothing drawn
 * anew: the rule list is a menu, a rule's condition is edited by the view
 * filter's own `<filter-root-view>` and `popCreateFilter`, its colour picked
 * from the select options' swatch grid (`selectOptionColorGrid`).
 */

function swatch(color: string) {
  const paint = colorRulePaint(color);
  return html` <div
    style=${styleMap({
      backgroundColor: paint ?? 'transparent',
      border: paint ? 'none' : '1px dashed var(--affine-border-color)',
      boxSizing: 'border-box',
      borderRadius: '50%',
      width: '20px',
      height: '20px',
      flexShrink: '0',
    })}
  ></div>`;
}

/** The property names a rule reads, in the order its conditions name them. */
function ruleSummary(
  filter: FilterGroup,
  vars: readonly Variable[],
  wording: Wording
): string {
  const names: string[] = [];
  const walk = (condition: Filter) => {
    if (condition.type === 'group') {
      condition.conditions.forEach(walk);
      return;
    }
    const name = vars.find(v => v.id === condition.left.name)?.name;
    if (name && !names.includes(name)) names.push(name);
  };
  filter.conditions.forEach(walk);
  return names.length
    ? names.join(', ')
    : wording(DATA_VIEW_COLOR_RULE_NO_CONDITION);
}

function colorName(color: string, wording: Wording): string {
  const item = selectOptionColors.find(
    entry => entry.color === colorRulePaint(color)
  );
  if (!item) return '';
  return item.wording ? wording(item.wording) : item.name;
}

/** The list of a view's rules, in order, and "Add a color rule". */
export function popColorRules(
  target: PopupTarget,
  dataViewLogic: DataViewUILogicBase,
  reopen: () => void,
  wording: Wording
): void {
  const view = dataViewLogic.view;
  const rules = viewColorRules(view.manager.dataSource.viewDataGet(view.id));
  const self = () => popColorRules(target, dataViewLogic, reopen, wording);
  popMenu(target, {
    options: {
      title: { text: wording(DATA_VIEW_COLOR_RULES), onBack: reopen },
      items: [
        menu.group({
          items: rules.map(rule =>
            menu.action({
              name: ruleSummary(rule.filter, view.vars$.value, wording),
              prefix: swatch(rule.color),
              postfix: html`<div style="font-size: 14px;">
                  ${colorName(rule.color, wording)}
                </div>
                ${ArrowRightSmallIcon()}`,
              testId: 'dv-color-rule',
              select: () => {
                popColorRule(target, dataViewLogic, rule.id, self, wording);
              },
            })
          ),
        }),
        menu.group({
          items: [
            menu.action({
              name: wording(DATA_VIEW_COLOR_RULES_ADD),
              prefix: PlusIcon(),
              testId: 'dv-color-rule-add',
              select: () => {
                popCreateFilter(target, {
                  vars: view.vars$,
                  onBack: self,
                  onSelect: filter => {
                    const id = colorRuleAdd(view, filter);
                    if (id)
                      popColorRule(target, dataViewLogic, id, self, wording);
                  },
                });
              },
            }),
          ],
        }),
      ],
    },
  });
}

/**
 * One rule: its conditions (the view filter's editor), its colour (the
 * options' palette), its place in the order, its removal. `back` is the
 * rule list. A rule a peer removed meanwhile shows an empty condition and
 * writes nothing (`colorRuleUpdate` finds no rule by that id).
 */
export function popColorRule(
  target: PopupTarget,
  dataViewLogic: DataViewUILogicBase,
  ruleId: string,
  back: () => void,
  wording: Wording
): void {
  const view = dataViewLogic.view;
  const dataSource = view.manager.dataSource;
  const rule$ = computed((): ViewColorRule | undefined =>
    viewColorRules(dataSource.viewDataGet(view.id)).find(
      rule => rule.id === ruleId
    )
  );
  const filter$ = computed(() => rule$.value?.filter ?? emptyFilterGroup);
  const setFilter = (filter: FilterGroup) => {
    colorRuleUpdate(view, ruleId, { filter });
  };
  const self = () => popColorRule(target, dataViewLogic, ruleId, back, wording);
  const rules = viewColorRules(dataSource.viewDataGet(view.id));
  const index = rules.findIndex(rule => rule.id === ruleId);
  popMenu(target, {
    options: {
      title: { text: wording(DATA_VIEW_COLOR_RULE), onBack: back },
      items: [
        menu.group({
          items: [
            () =>
              html`<filter-root-view
                data-testid="dv-color-rule-conditions"
                .onBack="${back}"
                .vars="${view.vars$}"
                .filterGroup="${filter$}"
                .onChange="${setFilter}"
              ></filter-root-view>`,
          ],
        }),
        menu.group({
          items: [
            menu.action({
              name: wording(DATA_VIEW_COLOR_RULE_ADD_CONDITION),
              prefix: PlusIcon(),
              select: ele => {
                popCreateFilter(
                  popupTargetFromElement(ele),
                  {
                    vars: view.vars$,
                    onSelect: filter => {
                      const value = filter$.peek();
                      setFilter({
                        ...value,
                        conditions: [...value.conditions, filter],
                      });
                    },
                  },
                  { middleware: subMenuMiddleware }
                );
                return false;
              },
            }),
          ],
        }),
        menu.group({
          name: 'color',
          items: selectOptionColorGrid({
            current: colorRulePaint(rule$.peek()?.color ?? ''),
            say: wording,
            select: color => {
              colorRuleUpdate(view, ruleId, { color });
              self();
            },
          }),
        }),
        menu.group({
          items: [
            menu.action({
              name: wording(DATA_VIEW_COLOR_RULE_MOVE_UP),
              prefix: ArrowUpSmallIcon(),
              hide: () => index <= 0,
              select: () => {
                colorRuleMove(view, ruleId, -1);
                self();
              },
            }),
            menu.action({
              name: wording(DATA_VIEW_COLOR_RULE_MOVE_DOWN),
              prefix: ArrowDownSmallIcon(),
              hide: () => index < 0 || index >= rules.length - 1,
              select: () => {
                colorRuleMove(view, ruleId, 1);
                self();
              },
            }),
            menu.action({
              name: wording(TOOLBAR_DELETE),
              prefix: DeleteIcon(),
              class: { 'delete-item': true },
              testId: 'dv-color-rule-delete',
              select: () => {
                colorRuleDelete(view, ruleId);
                back();
              },
            }),
          ],
        }),
      ],
    },
  });
}
