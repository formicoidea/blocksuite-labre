import {
  addConnector,
  addDot,
  addLegend,
  addMarker,
  CD_SUBDOMAINS,
  DddMenuBase,
  MOVEMENT_COLOR,
  TEAM_TOPOLOGIES,
} from '@labre/affine-gfx-ddd-shared';
import { Bound } from '@labre/global/gfx';
import { html, svg } from 'lit';

import { REF_H, REF_W } from '../core-domain/consts';
import { coreDomainLegendSections } from '../core-domain/legend';

const chartSwatch = svg`<svg viewBox="0 0 24 24" fill="none"><rect x="4" y="3" width="17" height="17" fill="#4d9900" fill-opacity="0.5"/><rect x="4" y="3" width="6" height="17" fill="#9933ff" fill-opacity="0.5"/><path d="M4 20 V3 M4 20 H21" stroke="currentColor" stroke-width="1.8"/></svg>`;
const dotSwatch = (color: string) =>
  svg`<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="7" fill="${color}" stroke="#1f2328" stroke-width="1.2"/></svg>`;
const movementSwatch = svg`<svg viewBox="0 0 24 24" fill="none"><path d="M3 18 L16 7" stroke="${MOVEMENT_COLOR}" stroke-width="2" stroke-dasharray="3 3"/><path d="M12 6 L18 5 L17 11" stroke="${MOVEMENT_COLOR}" stroke-width="2" fill="none"/></svg>`;
const legendSwatch = svg`<svg viewBox="0 0 24 24" fill="none"><rect x="3" y="4" width="18" height="16" rx="2" stroke="currentColor" stroke-width="1.6"/><circle cx="7" cy="9" r="1.6" fill="currentColor"/><circle cx="7" cy="14" r="1.6" fill="currentColor"/><path d="M11 9 H18 M11 14 H18" stroke="currentColor" stroke-width="1.4"/></svg>`;
const markerSwatch = (fill: string, letter: string) =>
  svg`<svg viewBox="0 0 24 24"><rect x="4" y="4" width="16" height="16" rx="3" fill="${fill}" stroke="#1f2328" stroke-width="1.2"/><text x="12" y="16" text-anchor="middle" font-size="11" font-family="sans-serif" fill="#1f2328">${letter}</text></svg>`;

/** Core Domain Chart palette: the background, sub-domain dots, movement arrow, Notation legend. */
export class EdgelessDddCoreDomainMenu extends DddMenuBase {
  protected override framework = 'core-domain' as const;

  private _createBackground() {
    const surface = this.surface;
    if (!surface) return;
    const { cx, cy } = this.center;
    const id = surface.addElement({
      type: 'coreDomain',
      xywh: new Bound(cx - REF_W / 2, cy - REF_H / 2, REF_W, REF_H).serialize(),
    });
    this.track('FrameworkElementAdded', 'background');
    this.finish(id);
  }

  private _createDot(preset: (typeof CD_SUBDOMAINS)[number]) {
    const surface = this.surface;
    if (!surface) return;
    const { cx, cy } = this.center;
    const id = addDot(surface, this.edgeless.std, cx, cy, preset.fill, preset.label);
    this.track('FrameworkElementAdded', `subdomain:${preset.kind}`);
    this.finish(id);
  }

  private _createMarker(preset: (typeof TEAM_TOPOLOGIES)[number]) {
    const surface = this.surface;
    if (!surface) return;
    const { cx, cy } = this.center;
    const id = addMarker(surface, this.edgeless.std, cx, cy, {
      fill: preset.fill,
      letter: preset.letter,
      label: preset.label,
    });
    this.track('FrameworkElementAdded', `team-topology:${preset.kind}`);
    this.finish(id);
  }

  private _createMovement() {
    const surface = this.surface;
    if (!surface) return;
    const { cx, cy } = this.center;
    const id = addConnector(surface, cx - 80, cy + 60, cx + 80, cy - 60, {
      rearArrow: true,
      dashed: true,
      stroke: MOVEMENT_COLOR,
    });
    this.track('FrameworkElementAdded', 'movement');
    this.finish(id);
  }

  private _createLegend() {
    const surface = this.surface;
    if (!surface) return;
    const { cx, cy } = this.center;
    const id = addLegend(surface, this.edgeless.std, cx - 130, cy - 170, {
      title: 'Légende',
      sections: coreDomainLegendSections(),
    });
    this.track('FrameworkElementAdded', 'legend');
    this.finish(id);
  }

  override render() {
    return html`
      <edgeless-slide-menu>
        <div class="menu-content">
          <div class="button-group-container">
            <edgeless-tool-icon-button
              .tooltip=${'Core Domain Chart'}
              @click=${() => this._createBackground()}
            >
              ${chartSwatch}
            </edgeless-tool-icon-button>
            ${CD_SUBDOMAINS.map(
              preset => html`<edgeless-tool-icon-button
                .tooltip=${preset.label}
                @click=${() => this._createDot(preset)}
              >
                ${dotSwatch(preset.fill)}
              </edgeless-tool-icon-button>`
            )}
            ${TEAM_TOPOLOGIES.map(
              preset => html`<edgeless-tool-icon-button
                .tooltip=${preset.label}
                @click=${() => this._createMarker(preset)}
              >
                ${markerSwatch(preset.fill, preset.letter)}
              </edgeless-tool-icon-button>`
            )}
            <edgeless-tool-icon-button
              .tooltip=${'Movement over time'}
              @click=${() => this._createMovement()}
            >
              ${movementSwatch}
            </edgeless-tool-icon-button>
            <edgeless-tool-icon-button
              .tooltip=${'Notation legend'}
              @click=${() => this._createLegend()}
            >
              ${legendSwatch}
            </edgeless-tool-icon-button>
          </div>
        </div>
      </edgeless-slide-menu>
    `;
  }
}
