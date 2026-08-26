import { DefaultTool } from '@labre/affine-block-surface';
import { EmptyTool } from '@labre/affine-gfx-pointer';
import { translateKey } from '@labre/affine-shared/services';
import { EdgelessToolbarToolMixin } from '@labre/affine-widget-edgeless-toolbar';
import { SignalWatcher } from '@labre/global/lit';
import { css, html, LitElement, type TemplateResult } from 'lit';

/**
 * Shared base for the three DDD senior buttons. Each subclass only differs by
 * the popover menu it opens, its tooltip and its glyph — the toggle / popper
 * wiring is identical (mirrors the Cynefin senior button). The concrete
 * subclasses live in their respective tool packages.
 */
export abstract class DddSeniorButtonBase extends EdgelessToolbarToolMixin(
  SignalWatcher(LitElement)
) {
  static override styles = css`
    :host,
    .ddd-button {
      display: block;
      width: 100%;
      height: 100%;
    }
    .ddd-root {
      width: 100%;
      height: 64px;
      cursor: pointer;
      /* no double-tap-zoom / 300ms tap delay on touch screens */
      touch-action: manipulation;
      display: flex;
      align-items: flex-end;
      justify-content: center;
    }
    .ddd-card {
      --y: -4px;
      --s: 1;
      width: 50px;
      height: 50px;
      margin-bottom: 4px;
      transform: translateY(var(--y)) scale(var(--s));
      transition: transform 0.3s ease;
    }
    .ddd-card svg {
      display: block;
      width: 100%;
      height: 100%;
    }
    .ddd-root:hover .ddd-card,
    .ddd-root:active .ddd-card {
      --y: -10px;
      --s: 1.07;
    }
  `;

  override enableActiveBackground = true;

  override type = EmptyTool;

  protected abstract menuTag: keyof HTMLElementTagNameMap;

  protected abstract label: string;

  /** i18n key resolved through the host catalogue; `label` is the fallback. */
  protected abstract labelKey: string;

  protected abstract icon: TemplateResult;

  private _toggleMenu() {
    if (this.popper) {
      this.popper.dispose();
      this.popper = null;
      return;
    }
    this.setEdgelessTool(DefaultTool);
    const menu = this.createPopper(this.menuTag, this);
    (menu.element as unknown as { edgeless: unknown }).edgeless = this.edgeless;

  }

  override render() {
    return html`<edgeless-toolbar-button
      class="ddd-button"
      .tooltip=${this.popper
        ? ''
        : translateKey(this.edgeless.std, this.labelKey, this.label)}
      .tooltipOffset=${4}
      .active=${!!this.popper}
      @click=${this._toggleMenu}
    >
      <div class="ddd-root">
        <div class="ddd-card">${this.icon}</div>
      </div>
    </edgeless-toolbar-button>`;
  }
}
