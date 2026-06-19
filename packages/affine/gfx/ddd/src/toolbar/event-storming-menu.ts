import { html, svg } from 'lit';

import { ES_HOTSPOT, ES_STICKIES } from '../shared/consts';
import { addConnector, addSticky } from '../shared/prefabs';
import { DddMenuBase } from './menu-base';

const squareSwatch = (color: string) =>
  svg`<svg viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="18" rx="3" fill="${color}"/></svg>`;
const diamondSwatch = (color: string) =>
  svg`<svg viewBox="0 0 24 24"><rect x="6" y="6" width="12" height="12" transform="rotate(45 12 12)" fill="${color}"/></svg>`;
const flowSwatch = svg`<svg viewBox="0 0 24 24" fill="none"><path d="M4 12 H18" stroke="currentColor" stroke-width="2"/><path d="M16 8 L20 12 L16 16" stroke="currentColor" stroke-width="2" fill="none"/></svg>`;

/** Event Storming palette: the colour-coded stickies, the hotspot, a flow arrow. */
export class EdgelessDddEventStormingMenu extends DddMenuBase {
  protected override framework = 'event-storming' as const;

  private _createSticky(preset: (typeof ES_STICKIES)[number]) {
    const surface = this.surface;
    if (!surface) return;
    const { cx, cy } = this.center;
    const id = addSticky(surface, this.edgeless.std, cx, cy, {
      fill: preset.fill,
      text: preset.text,
      label: preset.label,
    });
    this.track('FrameworkElementAdded', `sticky:${preset.kind}`);
    this.finish(id);
  }

  private _createHotspot() {
    const surface = this.surface;
    if (!surface) return;
    const { cx, cy } = this.center;
    const id = addSticky(surface, this.edgeless.std, cx, cy, {
      fill: ES_HOTSPOT.fill,
      text: ES_HOTSPOT.text,
      label: ES_HOTSPOT.label,
      shapeType: 'diamond',
    });
    this.track('FrameworkElementAdded', 'sticky:hotspot');
    this.finish(id);
  }

  private _createFlow() {
    const surface = this.surface;
    if (!surface) return;
    const { cx, cy } = this.center;
    const id = addConnector(surface, cx - 110, cy, cx + 110, cy, { rearArrow: true });
    this.track('FrameworkElementAdded', 'flow');
    this.finish(id);
  }

  override render() {
    return html`
      <edgeless-slide-menu>
        <div class="menu-content">
          <div class="button-group-container">
            ${ES_STICKIES.map(
              preset => html`<edgeless-tool-icon-button
                .tooltip=${preset.label}
                @click=${() => this._createSticky(preset)}
              >
                ${squareSwatch(preset.fill)}
              </edgeless-tool-icon-button>`
            )}
            <edgeless-tool-icon-button
              .tooltip=${ES_HOTSPOT.label}
              @click=${() => this._createHotspot()}
            >
              ${diamondSwatch(ES_HOTSPOT.fill)}
            </edgeless-tool-icon-button>
            <edgeless-tool-icon-button
              .tooltip=${'Flow'}
              @click=${() => this._createFlow()}
            >
              ${flowSwatch}
            </edgeless-tool-icon-button>
          </div>
        </div>
      </edgeless-slide-menu>
    `;
  }
}
