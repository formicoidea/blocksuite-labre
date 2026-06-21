import {
  addBubble,
  addCloud,
  addLegend,
  addRelationship,
  CLOUD,
  CM_BUBBLE,
  CM_RELATIONSHIPS,
  DddMenuBase,
  type LegendRow,
  type LegendSection,
} from '@labre/affine-gfx-ddd-shared';
import { html, svg } from 'lit';

const bubbleSwatch = svg`<svg viewBox="0 0 24 24" fill="none"><rect x="2" y="7" width="20" height="10" rx="5" fill="#e6f0fa" stroke="#2f6fb0" stroke-width="1.6"/></svg>`;
const cloudSwatch = svg`<svg viewBox="0 0 24 24" fill="none"><path d="M6 17 C3 17 2 14 4.5 12.5 C4 9 8 8 9.5 10 C11 6.5 16 7.5 16 11 C19 10.5 20.5 14 18 16 C18 17 16.5 17 15 17 Z" fill="#f0eef6" stroke="#6d6e71" stroke-width="1.4"/></svg>`;
const legendSwatch = svg`<svg viewBox="0 0 24 24" fill="none"><rect x="3" y="4" width="18" height="16" rx="2" stroke="currentColor" stroke-width="1.6"/><circle cx="7" cy="9" r="1.6" fill="currentColor"/><circle cx="7" cy="14" r="1.6" fill="currentColor"/><path d="M11 9 H18 M11 14 H18" stroke="currentColor" stroke-width="1.4"/></svg>`;
const relationSwatch = (dashed: boolean, arrow: boolean) =>
  svg`<svg viewBox="0 0 24 24" fill="none"><path d="M3 12 H${arrow ? 17 : 21}" stroke="currentColor" stroke-width="2" stroke-dasharray="${dashed ? '3 3' : '0'}"/>${arrow ? svg`<path d="M15 8 L21 12 L15 16" stroke="currentColor" stroke-width="2" fill="none"/>` : ''}</svg>`;

/** Context Map palette: bounded-context bubble, the cloud, the nine relationship patterns. */
export class EdgelessDddContextMapMenu extends DddMenuBase {
  protected override framework = 'context-map' as const;

  private _createBubble() {
    const surface = this.surface;
    if (!surface) return;
    const { cx, cy } = this.center;
    const id = addBubble(surface, this.edgeless.std, cx, cy, 'Bounded Context');
    this.track('FrameworkElementAdded', 'bounded-context');
    this.finish(id);
  }

  private _createCloud() {
    const surface = this.surface;
    if (!surface) return;
    const { cx, cy } = this.center;
    const id = addCloud(surface, this.edgeless.std, cx, cy, 'System');
    this.track('FrameworkElementAdded', 'cloud');
    this.finish(id);
  }

  private _createRelationship(preset: (typeof CM_RELATIONSHIPS)[number]) {
    const surface = this.surface;
    if (!surface) return;
    const { cx, cy } = this.center;
    const id = addRelationship(surface, this.edgeless.std, cx, cy, preset);
    this.track('FrameworkElementAdded', `relationship:${preset.kind}`);
    this.finish(id);
  }

  private _createLegend() {
    const surface = this.surface;
    if (!surface) return;
    const { cx, cy } = this.center;
    const patRows = (kinds: string[]): LegendRow[] =>
      CM_RELATIONSHIPS.filter(r => kinds.includes(r.kind)).map(
        (r): LegendRow => ({
          swatch: 'line',
          color: '#1f2328',
          label: `${r.abbrev} — ${r.label}`,
        })
      );
    const sections: LegendSection[] = [
      {
        title: 'Boundaries',
        rows: [
          { swatch: 'square', color: CM_BUBBLE.fill, label: 'Bounded Context' },
          { swatch: 'square', color: CLOUD.fill, label: 'System / Big Ball of Mud' },
        ],
      },
      { title: 'Mutually dependent', rows: patRows(['partnership', 'sharedKernel']) },
      {
        title: 'Upstream → Downstream (U/D)',
        rows: patRows(['customerSupplier', 'conformist', 'acl', 'ohs', 'publishedLanguage']),
      },
      { title: 'Separate / no integration', rows: patRows(['separateWays', 'bbom']) },
    ];
    const id = addLegend(surface, this.edgeless.std, cx - 140, cy - 210, {
      title: 'Légende',
      sections,
      width: 290,
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
              .tooltip=${'Bounded Context'}
              @click=${() => this._createBubble()}
            >
              ${bubbleSwatch}
            </edgeless-tool-icon-button>
            <edgeless-tool-icon-button
              .tooltip=${'Cloud / System (Big Ball of Mud)'}
              @click=${() => this._createCloud()}
            >
              ${cloudSwatch}
            </edgeless-tool-icon-button>
            ${CM_RELATIONSHIPS.map(
              preset => html`<edgeless-tool-icon-button
                .tooltip=${preset.label}
                @click=${() => this._createRelationship(preset)}
              >
                ${relationSwatch(preset.dashed, preset.upDown)}
              </edgeless-tool-icon-button>`
            )}
            <edgeless-tool-icon-button
              .tooltip=${'Legend'}
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
