import { translateKey } from '@labre/affine-shared/services';
import {
  EdgelessToolbarToolMixin,
  QuickToolMixin,
} from '@labre/affine-widget-edgeless-toolbar';
import { PresentationIcon } from '@blocksuite/icons/lit';
import { css, html, LitElement } from 'lit';

import { PresentTool } from '../present-tool';
import { FRAME_PRESENT_TOOL_TOOLTIP } from '../translations';

export class EdgelessPresentButton extends QuickToolMixin(
  EdgelessToolbarToolMixin(LitElement)
) {
  static override styles = css`
    :host {
      display: flex;
    }
    .edgeless-note-button {
      display: flex;
      position: relative;
    }
  `;

  override type = PresentTool;

  override render() {
    return html`<edgeless-tool-icon-button
    class="edgeless-frame-navigator-button"
    .tooltip=${translateKey(this.edgeless.std, ...FRAME_PRESENT_TOOL_TOOLTIP)}
    .tooltipOffset=${17}
    .iconContainerPadding=${6}
    .iconSize=${'24px'}
    @click=${() => {
      this.setEdgelessTool(PresentTool);
    }}
  >
    ${PresentationIcon()}
    </edgeless-tool-icon-button>
  </div>`;
  }
}
