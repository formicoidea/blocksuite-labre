import { createIdentifier } from '@labre/global/di';
import type { DataSourcePickerNoViewAction } from '@labre/affine-shared/services';
import type { ReadonlySignal } from '@preact/signals-core';

/**
 * The action a host draws under "No view" (issue #707, ADR 0035 amendment of
 * 2026-11-24): the seam's own type, `DataSourcePickerNoViewAction`, so a
 * field added there reaches the empty state. `label` and `hint` arrive
 * already in the reader's language; `menu` says that `run` opens a menu.
 */
export type NoViewAction = DataSourcePickerNoViewAction;

/**
 * Set on a data source (`serviceSet`) by the block that hosts its views when
 * its host may supply the empty state's action. The empty state reads the
 * signal while it draws: a host that learns late what to offer flips it and
 * the button follows. `null` keeps the library's own ("New view" where a
 * view may be added, else the status alone). Never read on a read-only
 * document.
 */
export const NoViewActionKey = createIdentifier<
  ReadonlySignal<NoViewAction | null>
>('data-view-no-view-action');
