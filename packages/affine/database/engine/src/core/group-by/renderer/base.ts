import { SignalWatcher, WithDisposable } from '@labre/global/lit';
import { type BlockStdScope, ShadowlessElement, stdContext } from '@labre/std';
import { consume } from '@lit/context';
import { property } from 'lit/decorators.js';

import { DATA_VIEW_UNGROUPED } from '../../../translations.js';
import { wordingOf } from '../../utils/wording.js';

import type { Group } from '../trait.js';
import type { GroupRenderProps } from '../types.js';

export class BaseGroup<JsonValue, Data extends Record<string, unknown>>
  extends SignalWatcher(WithDisposable(ShadowlessElement))
  implements GroupRenderProps<JsonValue, Data>
{
  @property({ attribute: false })
  accessor group!: Group<unknown, JsonValue, Data>;

  @property({ attribute: false })
  accessor readonly!: boolean;

  /** Absent outside an editor host: the wordings read English. */
  @consume({ context: stdContext })
  accessor std!: BlockStdScope;

  get ungrouped() {
    return wordingOf(this.std)(DATA_VIEW_UNGROUPED);
  }

  updateData(data: Data) {
    this.group.manager.updateData(data);
  }

  updateValue(value: JsonValue) {
    this.group.manager.updateValue(
      this.group.rows.map(row => row.rowId),
      value
    );
  }

  get value(): JsonValue {
    return this.group.value as JsonValue;
  }

  get type() {
    return this.group.tType;
  }

  get data() {
    return this.group.property.data$.value;
  }
}
