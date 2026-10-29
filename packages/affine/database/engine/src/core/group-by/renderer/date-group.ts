import { SignalWatcher, WithDisposable } from '@labre/global/lit';
import { ShadowlessElement } from '@labre/std';
import { css, html } from 'lit';
import { property } from 'lit/decorators.js';

import type { Group } from '../trait.js';
import {
  DATA_VIEW_GROUP_NO_VALUE,
  DATA_VIEW_UNGROUPED,
} from '../../../translations.js';
import { wordingFrom } from '../../utils/wording.js';

export class DateGroupView extends SignalWatcher(
  WithDisposable(ShadowlessElement)
) {
  static override styles = css`
    .dv-date-group {
      border-radius: 8px;
      padding: 4px 8px;
      width: max-content;
      cursor: default;
      display: flex;
      align-items: center;
      gap: 6px;
    }
    .dv-date-group:hover {
      background-color: var(--affine-hover-color);
    }
    .counter {
      flex-shrink: 0;
      min-width: 22px;
      height: 22px;
      border-radius: 4px;
      background: var(--affine-background-secondary-color);
      color: var(--affine-text-secondary-color);
      font-size: var(--data-view-cell-text-size);
      display: flex;
      align-items: center;
      justify-content: center;
    }
  `;

  @property({ attribute: false })
  accessor group!: Group;

  protected override render() {
    const wording = wordingFrom(this);
    // Read for its signal: a date group renames itself when the day turns.
    this.group.name$.value;
    const name = this.group.nameIn(wording);
    // Use contextual name based on the property when value is null
    const displayName =
      name ||
      (this.group.value === null
        ? wording(DATA_VIEW_GROUP_NO_VALUE, {
            name: this.group.property.name$.value,
          })
        : wording(DATA_VIEW_UNGROUPED));
    return html`<div class="dv-date-group">
      <span>${displayName}</span>
    </div>`;
  }
}
