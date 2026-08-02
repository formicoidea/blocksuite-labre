import { translateKey } from '@labre/affine-shared/services';
import {
  type CommandDescriptor,
  type CommandOwner,
  getCommandIcon,
  getCommandsForSurface,
  runCommand,
} from '@labre/std';
import { css, type CSSResultGroup, html, LitElement } from 'lit';

import { EdgelessToolbarToolMixin } from '../mixins/tool.mixin.js';

/**
 * The senior button sub-menu, rendered FROM the command registry.
 *
 * Before PF3 each framework hand-wrote this popover with a literal button per
 * artefact, an inline English tooltip and its own `_track()` helper — which is
 * how Wardley's menu drifted to 13 artefacts against 7 in the shortcut
 * manifest, and how cynefin-estuarine ended up emitting no telemetry at all.
 * There is now exactly one renderer, and it enumerates
 * `getCommandsForSurface(std, owner, 'senior-menu')`. A framework subclass
 * declares its owner and its tool type, nothing else. See `docs/adr/0008`.
 */
export abstract class EdgelessCommandMenu extends EdgelessToolbarToolMixin(
  LitElement
) {
  /**
   * Typed as a group so a subclass can extend rather than replace it — the DDD
   * palettes narrow `--labre-command-menu-gap`.
   */
  static override styles: CSSResultGroup = css`
    :host {
      display: flex;
      z-index: -1;
      justify-content: center;
    }
    .menu-content {
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .button-group-container {
      display: flex;
      align-items: center;
      gap: var(--labre-command-menu-gap, 14px);
      fill: var(--affine-icon-color);
    }
    .button-group-container svg {
      width: 24px;
      height: 24px;
    }
  `;

  /** Which framework's commands this popover shows. */
  protected abstract owner: CommandOwner;

  get commands(): CommandDescriptor[] {
    return getCommandsForSurface(this.edgeless.std, this.owner, 'senior-menu');
  }

  private _invoke(command: CommandDescriptor) {
    // The ONE emission point: no `_track()` helper anywhere in the menus.
    runCommand(this.edgeless.std, command, {
      surface: 'senior-menu',
      source: 'toolbar:general',
    });
  }

  /**
   * What the button says on hover: its label, plus — when the command declares
   * one — the sentence that tells the user what its GESTURE means.
   *
   * That second line is M1 of `docs/adr/0010`: a link tool whose drag decides
   * the orientation of a persisted relation has to SAY so, or the direction it
   * writes is a by-product rather than a statement. The library still puts no
   * words in a framework's mouth — both halves are the framework's own keys and
   * fallbacks, resolved through the host's catalogue.
   */
  private _tooltip(command: CommandDescriptor) {
    const label = translateKey(
      this.edgeless.std,
      command.labelKey,
      command.labelFallback
    );
    const { descriptionKey, descriptionFallback } = command;
    if (!descriptionKey && !descriptionFallback) return label;

    const hint = descriptionKey
      ? translateKey(this.edgeless.std, descriptionKey, descriptionFallback)
      : descriptionFallback;
    // A key with no catalogue entry and no fallback resolves to itself — show
    // the label alone rather than a raw i18n key under it.
    if (!hint || hint === descriptionKey) return label;

    // Inline, not a class: the template is rendered inside the icon button's
    // own shadow root, where this component's stylesheet does not reach.
    return html`${label}<span
        style="display:block;max-width:220px;margin-top:2px;opacity:0.75;font-size:11px;line-height:1.35;white-space:normal"
        >${hint}</span
      >`;
  }

  override render() {
    const std = this.edgeless.std;
    return html`
      <edgeless-slide-menu>
        <div class="menu-content">
          <div class="button-group-container">
            ${this.commands.map(
              command => html`<edgeless-tool-icon-button
                .tooltip=${this._tooltip(command)}
                @click=${() => this._invoke(command)}
              >
                ${getCommandIcon(std, command.iconKey)}
              </edgeless-tool-icon-button>`
            )}
          </div>
        </div>
      </edgeless-slide-menu>
    `;
  }
}
