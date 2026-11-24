import type { DatabaseBlockModel } from '@labre/affine-model';
import type {
  DataSourcePickerNoViewAction,
  DataSourcePickerService,
} from '@labre/affine-shared/services';
import type { ReadonlySignal } from '@preact/signals-core';

/**
 * The host's action under "No view" for `model` (issue #707, ADR 0035
 * amendment of 2026-11-24), or `null`: no picker, no `noViewAction`, a
 * block with no `externalSourceId` (not one of the host's databases), or a
 * host that threw, which keeps the library's own empty state.
 */
export function hostNoViewAction(
  picker: DataSourcePickerService | null | undefined,
  model: DatabaseBlockModel
): ReadonlySignal<DataSourcePickerNoViewAction | null> | null {
  const databaseId = model.props.externalSourceId;
  if (!picker?.noViewAction || !databaseId) return null;
  try {
    return picker.noViewAction({
      databaseId,
      docId: model.store.id,
      blockId: model.id,
    });
  } catch (error) {
    console.error(error);
    return null;
  }
}
