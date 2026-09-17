import { DefaultTool } from '@labre/affine-block-surface';
import { EmptyTool } from '@labre/affine-gfx-pointer';
import { translateKey } from '@labre/affine-shared/services';
import {
  armedArtefact,
  EdgelessToolbarToolMixin,
} from '@labre/affine-widget-edgeless-toolbar';
import { SignalWatcher } from '@labre/global/lit';
import { css, html, LitElement } from 'lit';

import { edgyToolbarIcon } from './icons';

/**
 * Main toolbar button (colored facets glyph) that opens the EDGY toolbox
 * sub-menu above the toolbar. Mirrors the Wardley senior button.
 */
export class EdgelessEdgySeniorButton extends EdgelessToolbarToolMixin(
  SignalWatcher(LitElement)
) {
  static override styles = css`
    :host,
    .edgy-button {
      display: block;
      width: 100%;
      height: 100%;
    }
    .edgy-root {
      width: 100%;
      height: 64px;
      position: relative;
      overflow: hidden;
      cursor: pointer;
      /* no double-tap-zoom / 300ms tap delay on touch screens */
      touch-action: manipulation;
      display: flex;
      align-items: flex-end;
      justify-content: center;
    }
    .edgy-card {
      --y: -4px;
      --s: 1;
      position: absolute;
      bottom: 0;
      width: 54px;
      height: 54px;
      transform: translateY(var(--y)) scale(var(--s));
      translate: var(--active-x, 0) var(--active-y, 0);
      rotate: var(--active-r, -2deg);
      scale: var(--active-s, 1);
      transition:
        transform 0.3s ease,
        translate 0.3s ease,
        rotate 0.3s ease,
        scale 0.3s ease;
    }
    .edgy-card svg {
      display: block;
      width: 100%;
      height: 100%;
    }
    .edgy-root:hover .edgy-card,
    .edgy-root:active .edgy-card {
      --y: -10px;
      --s: 1.07;
    }
  `;

  override enableActiveBackground = true;

  override type = EmptyTool;

  private _toggleMenu() {
    if (this.popper) {
      this.popper.dispose();
      this.popper = null;
      return;
    }
    this.setEdgelessTool(DefaultTool);
    const menu = this.createPopper('edgeless-edgy-menu', this);
    menu.element.edgeless = this.edgeless;
  }

  /** Lit while one of THIS framework's artefacts is armed. See the Wardley one. */
  private get _armed() {
    return armedArtefact(this.gfx)?.owner === 'edgy';
  }

  override render() {
    return html`<edgeless-toolbar-button
      class="edgy-button"
      .tooltip=${this.popper
        ? ''
        : translateKey(this.edgeless.std, 'com.labre.framework.edgy', 'EDGY')}
      .tooltipOffset=${4}
      .active=${!!this.popper || this._armed}
      @click=${this._toggleMenu}
    >
      <div class="edgy-root">
        <div class="edgy-card">${edgyToolbarIcon}</div>
      </div>
    </edgeless-toolbar-button>`;
  }
}
