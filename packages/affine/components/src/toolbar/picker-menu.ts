import { html, type TemplateResult } from 'lit';
import { ifDefined } from 'lit/directives/if-defined.js';
import { repeat } from 'lit/directives/repeat.js';

import { EditorChevronDown } from './chevron-down.js';

/**
 * The **one-of-many picker** every toolbar in this editor uses: a chevron
 * button that opens a row of icons, one of which is lit because it is what the
 * selection currently is.
 *
 * "Switch shape type" is the one everybody knows; the framework morph dropdown
 * is the same object. It lives HERE, in the shared component package, and not
 * where it was first written (`@labre/affine-widget-edgeless-toolbar`) for a
 * dependency reason that is not going away: that widget package depends on
 * `@labre/affine-block-surface`, so nothing in the surface package — which is
 * where the generic, framework-parameterized toolbar modules live — can import
 * from it without closing a cycle. This package is below both, which is why the
 * toolbar's buttons, its menu shells and its chevron already live here.
 *
 * The edgeless-toolbar copy is deliberately untouched by the change that added
 * this file: it is what the shape toolbar and its neighbours already call, and
 * collapsing the two is a follow-up whose blast radius is every shape entry in
 * the editor rather than one new dropdown. Until then the two are the same
 * markup twice — knowingly, and named here so the follow-up is findable.
 *
 * ## Names
 *
 * `PickerMenu` / `PickerMenuItem` rather than `Menu` / `MenuItem`: this package
 * already exports a `MenuItem`, and it is a different thing entirely (a line in
 * the "⋮" overflow menu, with a label and an action). Two types called
 * `MenuItem` in one entry point is a trap, not a convenience.
 */

/** One option: what it is worth, what it looks like, what it is called. */
export type PickerMenuItem<T> = {
  /** Tooltip and accessible name. */
  key?: string;
  value: T;
  icon?: TemplateResult;
  disabled?: boolean;
};

export type PickerMenu<T> = {
  label: string;
  icon?: TemplateResult;
  tooltip?: string;
  items: PickerMenuItem<T>[];
  currentValue: T;
  onPick: (value: T) => void;
  /**
   * `data-testid` for the host element and, suffixed with `-option`, for each
   * line. Optional: the shape toolbar's picker has never needed one, and a
   * framework module that wants to be reachable from an integration spec says
   * so rather than making every caller carry an attribute it does not use.
   */
  testId?: string;
};

/** The field of the item that currently matches — its icon, usually. */
export function renderCurrentPickerItemWith<
  T,
  F extends keyof PickerMenuItem<T>,
>(items: PickerMenuItem<T>[], currentValue: T, field: F) {
  return items.find(({ value }) => value === currentValue)?.[field];
}

export function renderPickerMenu<T>({
  label,
  tooltip,
  icon,
  items,
  currentValue,
  onPick,
  testId,
}: PickerMenu<T>) {
  return html`
    <editor-menu-button
      data-testid=${ifDefined(testId)}
      aria-label="${`${label.toLowerCase()}-menu`}"
      .button=${html`
        <editor-icon-button
          data-testid=${ifDefined(testId ? `${testId}-button` : undefined)}
          aria-label="${label}"
          .tooltip="${tooltip ?? label}"
        >
          ${icon ?? renderCurrentPickerItemWith(items, currentValue, 'icon')}
          ${EditorChevronDown}
        </editor-icon-button>
      `}
    >
      ${renderPickerMenuItems(items, currentValue, onPick, testId)}
    </editor-menu-button>
  `;
}

export function renderPickerMenuItems<T>(
  items: PickerMenuItem<T>[],
  currentValue: T,
  onPick: (value: T) => void,
  testId?: string
) {
  // Keyed by `value`: the option list is rebuilt on every selection change, and
  // an unkeyed repeat would recycle one kind's button into another's rather
  // than moving it — which is what makes an icon and its tooltip disagree.
  return repeat(
    items,
    item => item.value,
    ({ key, value, icon, disabled }) => html`
      <editor-icon-button
        data-testid=${ifDefined(testId ? `${testId}-option` : undefined)}
        data-value=${ifDefined(typeof value === 'string' ? value : undefined)}
        aria-label="${ifDefined(key)}"
        .disabled=${ifDefined(disabled)}
        .tooltip="${ifDefined(key)}"
        .active="${currentValue === value}"
        .activeMode="${'background'}"
        @click=${() => onPick(value)}
      >
        ${icon}
      </editor-icon-button>
    `
  );
}
