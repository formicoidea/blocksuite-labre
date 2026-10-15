import {
  menu,
  popMenu,
  popupTargetFromElement,
} from '@labre/affine-components/context-menu';
import { type BlockStdScope, stdContext } from '@labre/std';
import { consume } from '@lit/context';
import { css, html } from 'lit';
import { classMap } from 'lit/directives/class-map.js';
import { styleMap } from 'lit/directives/style-map.js';

import { selectOptionColorGrid } from '../../component/tags/color-menu.js';
import type { SelectTag } from '../../logical/index.js';
import { wordingOf } from '../../utils/wording.js';
import { BaseGroup } from './base.js';

export class SelectGroupView extends BaseGroup<
  string,
  {
    options: SelectTag[];
  }
> {
  static override styles = css`
    data-view-group-title-select-view {
      overflow: hidden;
    }

    .data-view-group-title-select-view {
      width: 100%;
      cursor: pointer;
    }

    .data-view-group-title-select-view.readonly {
      cursor: inherit;
    }

    .tag {
      padding: 0 8px;
      border-radius: 4px;
      font-size: var(--data-view-cell-text-size);
      line-height: var(--data-view-cell-text-line-height);
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
  `;

  private readonly _click = (e: MouseEvent) => {
    if (this.readonly) {
      return;
    }
    e.stopPropagation();
    popMenu(popupTargetFromElement(this), {
      options: {
        items: [
          menu.input({
            initialValue: this.tag?.value ?? '',
            onChange: text => {
              this.updateTag({ value: text });
            },
          }),
          ...selectOptionColorGrid({
            current: this.tag?.color,
            say: wordingOf(this.std),
            std: this.std,
            select: color => {
              this.updateTag({ color });
            },
          }),
        ],
      },
    });
  };

  /** Absent outside an editor host: the colour names read English. */
  @consume({ context: stdContext })
  accessor std!: BlockStdScope;

  get tag() {
    return this.data.options?.find(v => v.id === this.value);
  }

  protected override render(): unknown {
    const tag = this.tag;
    if (!tag) {
      return html` <div
        style="font-size: 14px;color: var(--affine-text-primary-color);line-height: 22px;"
      >
        Ungroups
      </div>`;
    }
    const style = styleMap({
      backgroundColor: tag.color,
    });
    const classList = classMap({
      'data-view-group-title-select-view': true,
      readonly: this.readonly,
    });
    return html` <div @click="${this._click}" class="${classList}">
      <div class="tag" style="${style}">${tag.value}</div>
    </div>`;
  }

  updateTag(tag: Partial<SelectTag>) {
    this.updateData?.({
      ...this.data,
      options: this.data.options.map(v => {
        if (v.id === this.value) {
          return {
            ...v,
            ...tag,
          };
        }
        return v;
      }),
    });
  }
}
