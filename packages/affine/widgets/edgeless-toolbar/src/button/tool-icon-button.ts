import { translateKey } from '@labre/affine-shared/services';
import type { BlockStdScope } from '@labre/std';
import type { Placement } from '@floating-ui/dom';
import type { PropertyValues, TemplateResult } from 'lit';
import { css, html, LitElement, nothing } from 'lit';
import { property } from 'lit/decorators.js';
import { cache } from 'lit/directives/cache.js';
import { styleMap } from '@labre/global/lit';

import { EDGELESS_TOOLBAR_COMING_SOON } from '../translations.js';

/**
 * Fired by a button of the toolbar's row when its `active` changes, so the
 * row can keep its Tab stop on the active tool (ADR 0054). The toolbar listens
 * for it by this name on its render root.
 */
export const TOOLBAR_ROW_STATE_EVENT = 'toolbar-row-state';

/**
 * The keyboard's ring on a toolbar button (#679, ADR 0054): the opaque 2px
 * ring of the toolbar's `[data-keyboard-highlight]`. The host is the focus
 * target and carries the name, the state and the `tabindex`; the ring is drawn
 * on its visible box, inside it.
 *
 * Drawn as the box's positioned `::after`, above what the button holds: an
 * outline paints under positioned or transformed children, and the senior
 * tools' artwork (the note's paper, the file's card, the text) covered it in
 * part or whole. `--edgeless-toolbar-focus-ring-inset` moves it further in
 * where the box fills the bar: the toolbar sets it on its senior tools,
 * whose buttons are as tall as the bar, so the ring clears the bar's border
 * instead of sitting on it (product owner, acceptance of #691; ADR 0054,
 * amendment of 2026-11-21).
 */
export const toolButtonFocusRing = css`
  :host(:focus-visible) {
    outline: none;
  }
  :host(:focus-visible) .icon-container::after {
    content: '';
    position: absolute;
    inset: var(--edgeless-toolbar-focus-ring-inset, 0px);
    border: 2px solid var(--affine-primary-color);
    border-radius: 8px;
    pointer-events: none;
    z-index: 1;
  }
`;

export class EdgelessToolIconButton extends LitElement {
  static override styles = css`
    ${toolButtonFocusRing}
    .icon-container {
      position: relative;
      display: flex;
      align-items: center;
      padding: var(--icon-container-padding);
      color: var(--affine-icon-color);
      border-radius: 4px;
      cursor: pointer;
      white-space: nowrap;
      box-sizing: border-box;
      width: var(--icon-container-width, unset);
      justify-content: var(--justify, unset);
    }

    .icon-container.active-mode-color[active] {
      color: var(--affine-primary-color);
    }

    .icon-container.active-mode-background[active] {
      background: var(--affine-hover-color);
    }

    .icon-container[disabled] {
      pointer-events: none;
      cursor: not-allowed;
      color: var(--affine-text-disable-color);
    }

    .icon-container[coming] {
      cursor: not-allowed;
      color: var(--affine-text-disable-color);
    }

    ::slotted(svg) {
      flex-shrink: 0;
      width: var(--icon-size, unset);
      height: var(--icon-size, unset);
    }

    ::slotted(.label) {
      flex: 1;
      padding: 0 4px;
      overflow: hidden;
      white-space: nowrap;
      line-height: var(--label-height, inherit);
    }
    ::slotted(.label.padding0) {
      padding: 0;
    }
    ::slotted(.label.ellipsis) {
      text-overflow: ellipsis;
    }
    ::slotted(.label.medium) {
      font-weight: 500;
    }

    .icon-container[with-hover]::before {
      content: '';
      display: block;
      background: var(--affine-hover-color);
      position: absolute;
      width: 100%;
      height: 100%;
      top: 0;
      left: 0;
      border-radius: 4px;
    }
  `;

  constructor() {
    super();

    this.addEventListener(
      'click',
      event => {
        if (this.disabled) {
          event.stopPropagation();
          event.preventDefault();
        }
      },
      { capture: true }
    );
  }

  override connectedCallback() {
    super.connectedCallback();
    this.role = 'button';
  }

  /**
   * The accessible name and state live on the host, the node that carries
   * `role="button"` (#679).
   *
   * The name is the translated wording the pointer reads: `label` when the
   * owner passes one, else a tooltip that is plain text. A tooltip drawn as a
   * template (a wording beside its shortcut) cannot name the button, and one
   * emptied while the button's menu is open must not unname it: those owners
   * pass `label`.
   *
   * Only on the canvas toolbar's row, in the menus its buttons open (the
   * items of an `edgeless-slide-menu`, which the keyboard walks since the
   * acceptance of #679), or for an owner that passes `label`. Elsewhere — a
   * panel, the element toolbar, the auto-complete — a visible text is the
   * name and the tooltip only describes it (WCAG 2.5.3): those buttons keep
   * exactly the attributes their owner gives them. `pressed`, like `label`,
   * is outside that scope: it is announced wherever an owner binds it, and
   * only the toolbar's menus bind it.
   */
  override updated(changed: PropertyValues<this>) {
    // An option the owner says is chosen (a shape type, a connector mode):
    // announced wherever the owner binds it, as it does its `label`.
    if (this.pressed !== undefined) {
      this.setAttribute('aria-pressed', String(this.pressed));
    } else if (changed.has('pressed')) {
      this.removeAttribute('aria-pressed');
    }
    const inToolbarMenu = this.closest('edgeless-slide-menu') !== null;
    if (!this.onToolbarRow && !inToolbarMenu && !this.label) return;
    const name =
      this.label || (typeof this.tooltip === 'string' ? this.tooltip : '');
    if (name) this.setAttribute('aria-label', name);
    else this.removeAttribute('aria-label');

    if (!this.onToolbarRow) return;
    if (this.active === undefined) this.removeAttribute('aria-pressed');
    else this.setAttribute('aria-pressed', String(this.active));
    // The row keeps its one Tab stop on the active tool (ADR 0054).
    if (changed.has('active')) {
      this.dispatchEvent(
        new Event(TOOLBAR_ROW_STATE_EVENT, { bubbles: true, composed: true })
      );
    }
  }

  override render() {
    const tooltip = this.coming
      ? this.std
        ? translateKey(this.std, ...EDGELESS_TOOLBAR_COMING_SOON)
        : EDGELESS_TOOLBAR_COMING_SOON[1]
      : this.tooltip;
    const classnames = `icon-container active-mode-${this.activeMode} ${this.hoverState ? 'hovered' : ''}`;
    const padding = this.iconContainerPadding;
    const iconContainerStyles = styleMap({
      '--icon-container-width': this.iconContainerWidth,
      '--icon-container-padding': Array.isArray(padding)
        ? padding.map(v => `${v}px`).join(' ')
        : `${padding}px`,
      '--icon-size': this.iconSize,
      '--justify': this.justify,
      '--label-height': this.labelHeight,
    });

    return html`
      <style>
        .icon-container:hover,
        .icon-container.hovered {
          background: ${this.hover ? `var(--affine-hover-color)` : 'inherit'};
        }
      </style>
      <div
        class=${classnames}
        style=${iconContainerStyles}
        ?with-hover=${this.withHover}
        ?disabled=${this.disabled}
        ?active=${this.active}
      >
        <slot></slot>
        ${cache(
          this.showTooltip && tooltip
            ? html`<affine-tooltip
                tip-position=${this.tipPosition}
                .arrow=${this.arrow}
                .offset=${this.tooltipOffset}
                >${tooltip}</affine-tooltip
              >`
            : nothing
        )}
      </div>
    `;
  }

  /**
   * `undefined` while the owner binds nothing: an action (undo, insert a text)
   * has no state, and only a bound value is announced (`onToolbarRow`).
   */
  @property({ attribute: false })
  accessor active: boolean | undefined = undefined;

  @property({ attribute: false })
  accessor activeMode: 'color' | 'background' = 'color';

  @property({ attribute: false })
  accessor arrow = true;

  @property({ attribute: false })
  accessor coming = false;

  @property({ attribute: false })
  accessor disabled = false;

  @property({ attribute: false })
  accessor hover = true;

  @property({ attribute: false })
  accessor hoverState = false;

  @property({ attribute: false })
  accessor iconContainerPadding: number | number[] = 2;

  @property({ attribute: false })
  accessor iconContainerWidth: string | undefined = undefined;

  @property({ attribute: false })
  accessor iconSize: string | undefined = undefined;

  @property({ attribute: false })
  accessor justify: string | undefined = undefined;

  /**
   * Whether this option is the chosen one, announced as `aria-pressed`. An
   * owner binds it where `active` means the choice — a menu's shape types,
   * connector modes, pens, note types — and not where `active` is a
   * keyboard highlight (a framework's sub-menu). `undefined`: no state.
   */
  @property({ attribute: false })
  accessor pressed: boolean | undefined = undefined;

  /** The accessible name, for an owner whose tooltip cannot be one. */
  @property({ attribute: false })
  accessor label: string | undefined = undefined;

  @property({ attribute: false })
  accessor labelHeight: string | undefined = undefined;

  /**
   * Set by the edgeless toolbar on the buttons of its own row: there a bound
   * `active` is the tool's state, announced as `aria-pressed`. The same button
   * in a sub-menu stays silent, because there `active` can be a keyboard
   * highlight (`EdgelessCommandMenu`).
   */
  @property({ attribute: false })
  accessor onToolbarRow = false;

  @property({ type: Boolean })
  accessor showTooltip = true;

  @property({ attribute: false })
  accessor tipPosition: Placement = 'top';

  @property({ attribute: false })
  accessor tooltip!: string | TemplateResult<1>;

  @property({ attribute: false })
  accessor tooltipOffset = 8;

  @property({ attribute: false })
  accessor withHover: boolean | undefined = undefined;

  /** Set by a caller that has one — optional so this button still renders
   * (in English) when created with none, as it does today. */
  @property({ attribute: false })
  accessor std: BlockStdScope | undefined = undefined;
}
