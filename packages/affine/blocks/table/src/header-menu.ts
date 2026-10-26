import { menu } from '@labre/affine-components/context-menu';
import { translateKey } from '@labre/affine-shared/services';
import type { BlockStdScope } from '@labre/std';
import { HeaderColumnIcon, HeaderRowIcon } from '@blocksuite/icons/lit';

import { TABLE_HEADER_COLUMN, TABLE_HEADER_ROW } from './translations';

/**
 * The "Header row" / "Header column" item of the first row's / first
 * column's menu (ADR 0043): a plain action with the menu's check mark, the
 * toggle-switch row of `menu.toggleSwitch` hands its click the value it was
 * built with.
 *
 * Kept out of `table-cell.ts` on purpose: the literal guard treats every
 * literal of a file that calls `translateKey` as covered when it equals some
 * fallback, and the cell menus' older labels ("Copy", "Delete"…) are still
 * untranslated literals its baseline must keep seeing.
 */
export function headerToggleMenuItem(
  std: BlockStdScope | undefined,
  kind: 'row' | 'column',
  on: boolean,
  toggle: (on: boolean) => void
) {
  const wording = kind === 'row' ? TABLE_HEADER_ROW : TABLE_HEADER_COLUMN;
  return menu.action({
    name: std ? translateKey(std, ...wording) : wording[1],
    prefix: kind === 'row' ? HeaderRowIcon() : HeaderColumnIcon(),
    isSelected: on,
    testId: `table-header-${kind}-toggle`,
    select: () => toggle(!on),
  });
}
