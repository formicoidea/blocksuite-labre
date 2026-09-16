import { EditorChevronDown } from '@labre/affine-components/toolbar';
import { translateKey } from '@labre/affine-shared/services';
import type { ToolbarContext } from '@labre/affine-shared/services';
import type { BlockComponent, BlockStdScope } from '@labre/std';
import { html } from 'lit';
import { ifDefined } from 'lit/directives/if-defined.js';
import { repeat } from 'lit/directives/repeat.js';

import type { Menu, MenuItem } from './types';

export function renderCurrentMenuItemWith<T, F extends keyof MenuItem<T>>(
  items: MenuItem<T>[],
  currentValue: T,
  field: F
) {
  return items.find(({ value }) => value === currentValue)?.[field];
}

/**
 * The currently selected item's display text — {@link MenuItem.keyWording}
 * resolved through `std` when the caller has one, else its `key` literal.
 */
export function resolveMenuItemLabel<T>(
  items: MenuItem<T>[],
  currentValue: T,
  std?: BlockStdScope
): string | undefined {
  const item = items.find(({ value }) => value === currentValue);
  if (!item) return undefined;
  return item.keyWording && std
    ? translateKey(std, ...item.keyWording)
    : item.key;
}

export function renderMenu<T>({
  label,
  labelWording,
  tooltip,
  tooltipWording,
  icon,
  items,
  currentValue,
  onPick,
  std,
}: Menu<T>) {
  const resolvedLabel =
    labelWording && std ? translateKey(std, ...labelWording) : label;
  const resolvedTooltip =
    tooltipWording && std
      ? translateKey(std, ...tooltipWording)
      : (tooltip ?? resolvedLabel);

  return html`
    <editor-menu-button
      aria-label="${`${resolvedLabel.toLowerCase()}-menu`}"
      .button=${html`
        <editor-icon-button
          aria-label="${resolvedLabel}"
          .tooltip="${resolvedTooltip}"
        >
          ${icon ?? renderCurrentMenuItemWith(items, currentValue, 'icon')}
          ${EditorChevronDown}
        </editor-icon-button>
      `}
    >
      ${renderMenuItems(items, currentValue, onPick, std)}
    </editor-menu-button>
  `;
}

export function renderMenuItems<T>(
  items: MenuItem<T>[],
  currentValue: T,
  onPick: (value: T) => void,
  std?: BlockStdScope
) {
  return repeat(
    items,
    item => item.value,
    ({ key, keyWording, value, icon, disabled }) => {
      const resolvedKey =
        keyWording && std ? translateKey(std, ...keyWording) : key;
      return html`
        <editor-icon-button
          aria-label="${ifDefined(resolvedKey)}"
          .disabled=${ifDefined(disabled)}
          .tooltip="${ifDefined(resolvedKey)}"
          .active="${currentValue === value}"
          .activeMode="${'background'}"
          @click=${() => onPick(value)}
        >
          ${icon}
        </editor-icon-button>
      `;
    }
  );
}

export function getRootBlock(ctx: ToolbarContext): BlockComponent | null {
  const rootModel = ctx.store.root;
  if (!rootModel) return null;

  return ctx.view.getBlock(rootModel.id);
}
