import { menu, type MenuConfig } from '@labre/affine-components/context-menu';
import { SignalWatcher, WithDisposable } from '@labre/global/lit';
import {
  InvisibleIcon,
  ToggleDownIcon,
  ToggleRightIcon,
  ViewIcon,
} from '@blocksuite/icons/lit';
import { type BlockStdScope, ShadowlessElement, stdContext } from '@labre/std';
import { consume } from '@lit/context';
import { cssVarV2 } from '@toeverything/theme/v2';
import { css, html, nothing, unsafeCSS } from 'lit';
import { property } from 'lit/decorators.js';
import { repeat } from 'lit/directives/repeat.js';

import {
  DATA_VIEW_GROUP_COLLAPSE,
  DATA_VIEW_GROUP_EXPAND,
  DATA_VIEW_GROUP_HIDE,
  DATA_VIEW_GROUP_SHOW,
  DATA_VIEW_HIDDEN_GROUPS,
} from '../../translations.js';
import { VALUES_PENDING_MARK, valuesReady } from '../data-source/hydration.js';
import { renderUniLit } from '../utils/uni-component/uni-component.js';
import { type Wording, wordingOf } from '../utils/wording.js';
import type { Group, GroupTrait } from './trait.js';
import type { GroupRenderProps } from './types.js';

/**
 * The group chrome every grouped preset shares (ADR 0035 §8, B8, PRD
 * REQ-DB-16): "Hide group" in a group's menu, the fold toggle of a group
 * header, and the list of hidden groups drawn at the end of the view. Hiding
 * is a view setting, shared by everyone; folding is personal
 * (`collapsed-state.ts`).
 */

/** "Hide group", for a group's own menu. Absent where the view hides none. */
export const hideGroupAction = (group: Group, wording: Wording): MenuConfig =>
  menu.action({
    name: wording(DATA_VIEW_GROUP_HIDE),
    prefix: InvisibleIcon(),
    hide: () => !group.manager.groupsCanHide,
    select: () => {
      group.manager.groupHideSet(group.key, true);
    },
  });

const groupCount = (group: Group) =>
  valuesReady(group.property.view.manager.dataSource)
    ? group.rows.length
    : VALUES_PENDING_MARK;

/**
 * A group header's fold button. Folding is never a write, so a read-only
 * view folds too.
 */
export const renderGroupToggle = (group: Group, wording: Wording) => {
  const collapsed = group.manager.collapsed$(group.key).value;
  const label = wording(
    collapsed ? DATA_VIEW_GROUP_EXPAND : DATA_VIEW_GROUP_COLLAPSE
  );
  return html`<button
    class="dv-group-toggle"
    data-testid="dv-group-toggle"
    aria-expanded="${collapsed ? 'false' : 'true'}"
    aria-label="${label}"
    title="${label}"
    @click="${(event: MouseEvent) => {
      event.stopPropagation();
      group.manager.collapsedSet(group.key, !collapsed);
    }}"
  >
    ${collapsed ? ToggleRightIcon() : ToggleDownIcon()}
  </button>`;
};

export const groupToggleStyles = css`
  .dv-group-toggle {
    display: flex;
    flex-shrink: 0;
    align-items: center;
    justify-content: center;
    width: 24px;
    height: 24px;
    padding: 0;
    border: none;
    border-radius: 4px;
    background: transparent;
    color: var(--affine-icon-color);
    cursor: pointer;
  }

  .dv-group-toggle svg {
    width: 16px;
    height: 16px;
  }

  .dv-group-toggle:focus-visible {
    outline: 2px solid var(--affine-primary-color);
    outline-offset: 1px;
  }

  @media (hover: hover) {
    .dv-group-toggle:hover {
      background-color: var(--affine-hover-color);
    }
  }

  @media (pointer: coarse) {
    .dv-group-toggle {
      width: 44px;
      height: 44px;
    }
  }
`;

/**
 * The hidden groups of a view, at its end, each with a button that shows it
 * again (PRD REQ-DB-16). Nothing when the view hides no group. A read-only
 * view lists them without the button.
 */
export class DataViewHiddenGroups extends SignalWatcher(
  WithDisposable(ShadowlessElement)
) {
  static override styles = css`
    dv-hidden-groups {
      display: block;
    }

    .dv-hidden-groups {
      display: flex;
      flex-direction: column;
      gap: 2px;
      padding: 8px 0;
    }

    .dv-hidden-groups-title {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 0 4px 4px;
      font-size: 12px;
      line-height: 20px;
      color: var(--affine-text-secondary-color);
    }

    .dv-hidden-group {
      display: flex;
      align-items: center;
      gap: 8px;
      min-height: 32px;
      padding: 0 4px;
      border-radius: 4px;
    }

    .dv-hidden-group-title {
      flex: 1 1 auto;
      min-width: 0;
      overflow: hidden;
      opacity: 0.7;
    }

    .dv-hidden-group-count {
      flex-shrink: 0;
      font-size: 12px;
      color: var(--affine-text-secondary-color);
    }

    .dv-hidden-group-show {
      display: flex;
      flex-shrink: 0;
      align-items: center;
      justify-content: center;
      width: 28px;
      height: 28px;
      padding: 0;
      border: 1px solid ${unsafeCSS(cssVarV2.layer.insideBorder.border)};
      border-radius: 4px;
      background: transparent;
      color: var(--affine-icon-color);
      cursor: pointer;
    }

    .dv-hidden-group-show svg {
      width: 16px;
      height: 16px;
    }

    .dv-hidden-group-show:focus-visible {
      outline: 2px solid var(--affine-primary-color);
      outline-offset: 1px;
    }

    @media (hover: hover) {
      .dv-hidden-group-show:hover {
        background-color: var(--affine-hover-color);
      }
    }

    @media (pointer: coarse) {
      .dv-hidden-group {
        min-height: 44px;
      }

      .dv-hidden-group-show {
        width: 44px;
        height: 44px;
      }
    }
  `;

  /** Absent outside an editor (a unit test): the wordings read English. */
  @consume({ context: stdContext })
  accessor std!: BlockStdScope;

  @property({ attribute: false })
  accessor groupTrait: GroupTrait | undefined = undefined;

  override connectedCallback() {
    super.connectedCallback();
    this.dataset.testid = 'dv-hidden-groups';
  }

  override render() {
    const trait = this.groupTrait;
    const groups = trait?.hiddenGroups$.value ?? [];
    if (!trait || !groups.length) return nothing;
    const wording = wordingOf(this.std);
    const readonly = trait.view.readonly$.value;
    const show = wording(DATA_VIEW_GROUP_SHOW);
    return html`<div class="dv-hidden-groups">
      <div class="dv-hidden-groups-title">
        <span>${wording(DATA_VIEW_HIDDEN_GROUPS)}</span>
        <span>${groups.length}</span>
      </div>
      ${repeat(
        groups,
        group => group.key,
        group => {
          const props: GroupRenderProps = { group, readonly: true };
          return html`<div
            class="dv-hidden-group"
            data-testid="dv-hidden-group"
            data-group-key="${group.key}"
          >
            <div class="dv-hidden-group-title">
              ${renderUniLit(group.view, props)}
            </div>
            <span class="dv-hidden-group-count">${groupCount(group)}</span>
            ${readonly
              ? nothing
              : html`<button
                  class="dv-hidden-group-show"
                  data-testid="dv-group-show"
                  aria-label="${show}"
                  title="${show}"
                  @click="${() => trait.groupHideSet(group.key, false)}"
                >
                  ${ViewIcon()}
                </button>`}
          </div>`;
        }
      )}
    </div>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'dv-hidden-groups': DataViewHiddenGroups;
  }
}
