import { EmptyTool } from '@labre/affine-gfx-pointer';
import type { WardleyBgVariant } from '@labre/affine-model';
import { EdgelessToolbarToolMixin } from '@labre/affine-widget-edgeless-toolbar';
import { css, html, LitElement } from 'lit';

import {
  activateWardleyConnector,
  createWardleyBackground,
  createWardleyInertia,
  createWardleyMarket,
  createWardleyNode,
  createWardleyPipeline,
  type WardleyNodePresetKind,
} from '../actions';
import {
  wardleyAnchorIcon,
  wardleyArrowIcon,
  wardleyBackgroundIcon,
  wardleyBenefitIcon,
  wardleyComponentIcon,
  wardleyEcosystemIcon,
  wardleyInertiaIcon,
  wardleyLinkIcon,
  wardleyMarketIcon,
  wardleyMethodIcon,
  wardleyEvolutionGradientIcon,
  wardleyOpportunityIcon,
  wardleyPipelineIcon,
} from './icons';

/**
 * The popover that opens above the toolbar for the Wardley toolbox. Each item
 * creates a pre-formatted Wardley object (see `../actions.ts` — the same
 * actions back the wardley keyboard shortcuts).
 */
export class EdgelessWardleyMenu extends EdgelessToolbarToolMixin(LitElement) {
  static override styles = css`
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
      gap: 14px;
      fill: var(--affine-icon-color);
    }
    .button-group-container svg {
      width: 24px;
      height: 24px;
    }
  `;

  override type = EmptyTool;

  private _createBackground(variant: WardleyBgVariant = 'classic') {
    createWardleyBackground(this.gfx, variant);
  }

  private _createNode(kind: WardleyNodePresetKind) {
    createWardleyNode(this.gfx, kind);
  }

  private readonly _createInertia = () => {
    createWardleyInertia(this.gfx);
  };

  private readonly _createPipeline = () => {
    createWardleyPipeline(this.gfx);
  };

  private readonly _createMarket = () => {
    createWardleyMarket(this.gfx);
  };

  private _activateConnector(kind: 'link' | 'arrow') {
    activateWardleyConnector(this.gfx, kind);
  }

  override render() {
    return html`
      <edgeless-slide-menu>
        <div class="menu-content">
          <div class="button-group-container">
            <edgeless-tool-icon-button
              .tooltip=${'Wardley map background'}
              @click=${() => this._createBackground('classic')}
            >
              ${wardleyBackgroundIcon}
            </edgeless-tool-icon-button>
            <edgeless-tool-icon-button
              .tooltip=${'Opportunity background (gradient)'}
              @click=${() => this._createBackground('opportunity')}
            >
              ${wardleyOpportunityIcon}
            </edgeless-tool-icon-button>
            <edgeless-tool-icon-button
              .tooltip=${'Benefit / Investment background (gradient)'}
              @click=${() => this._createBackground('benefit')}
            >
              ${wardleyBenefitIcon}
            </edgeless-tool-icon-button>
            <edgeless-tool-icon-button
              .tooltip=${'Evolution background (Wardley presentation)'}
              @click=${() => this._createBackground('evolution-gradient')}
            >
              ${wardleyEvolutionGradientIcon}
            </edgeless-tool-icon-button>
            <edgeless-tool-icon-button
              .tooltip=${'Component'}
              @click=${() => this._createNode('component')}
            >
              ${wardleyComponentIcon}
            </edgeless-tool-icon-button>
            <edgeless-tool-icon-button
              .tooltip=${'Component + method'}
              @click=${() => this._createNode('method')}
            >
              ${wardleyMethodIcon}
            </edgeless-tool-icon-button>
            <edgeless-tool-icon-button
              .tooltip=${'Market'}
              @click=${this._createMarket}
            >
              ${wardleyMarketIcon}
            </edgeless-tool-icon-button>
            <edgeless-tool-icon-button
              .tooltip=${'Ecosystem'}
              @click=${() => this._createNode('ecosystem')}
            >
              ${wardleyEcosystemIcon}
            </edgeless-tool-icon-button>
            <edgeless-tool-icon-button
              .tooltip=${'Anchor'}
              @click=${() => this._createNode('anchor')}
            >
              ${wardleyAnchorIcon}
            </edgeless-tool-icon-button>
            <edgeless-tool-icon-button
              .tooltip=${'Pipeline'}
              @click=${this._createPipeline}
            >
              ${wardleyPipelineIcon}
            </edgeless-tool-icon-button>
            <edgeless-tool-icon-button
              .tooltip=${'Link'}
              @click=${() => this._activateConnector('link')}
            >
              ${wardleyLinkIcon}
            </edgeless-tool-icon-button>
            <edgeless-tool-icon-button
              .tooltip=${'Arrow (evolution)'}
              @click=${() => this._activateConnector('arrow')}
            >
              ${wardleyArrowIcon}
            </edgeless-tool-icon-button>
            <edgeless-tool-icon-button
              .tooltip=${'Inertia'}
              @click=${this._createInertia}
            >
              ${wardleyInertiaIcon}
            </edgeless-tool-icon-button>
          </div>
        </div>
      </edgeless-slide-menu>
    `;
  }
}
