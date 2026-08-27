/**
 * ⚠️ THROWAWAY — PLAYGROUND ONLY. DELETE AT WILL. ⚠️
 *
 * A fake "Demo overflow" framework whose only purpose is to exercise PF6 with
 * MORE THAN 14 commands while no real framework crosses that line yet: the
 * senior sub-menu must collapse to the 7 ranked slots (4 most-used + 3 most
 * recent) plus the permanent "More artefacts…" button, and the catalogue
 * sidepanel must list the whole set by category.
 *
 * Everything in here is deliberately cheap: sixteen native shapes, no roles,
 * no telemetry, no i18n keys (the manifest spec scans `packages/affine` +
 * `packages/framework` only, so the dummy keys below are invisible to it), and
 * an owner id that is NOT a real `FrameworkId` — the casts are the price of
 * keeping this out of the library, and they are confined to this file.
 */
import { DefaultTool } from '@labre/affine/blocks/surface';
import { EmptyTool } from '@labre/affine/gfx/pointer';
import { SignalWatcher } from '@labre/affine/global/lit';
import { type CommandDescriptor, CommandExtension } from '@labre/affine/std';
import type { ExtensionType } from '@labre/affine/store';
import { GfxControllerIdentifier } from '@labre/affine/std/gfx';
import {
  EdgelessCommandMenu,
  EdgelessToolbarToolMixin,
  SeniorToolExtension,
} from '@labre/affine/widgets/edgeless-toolbar';
import { css, html, LitElement, svg, type TemplateResult } from 'lit';

/** Not a real framework — the cast below is the whole point of the file. */
const DEMO_OWNER = 'demo-overflow';

const SHAPES = ['rect', 'ellipse', 'diamond', 'triangle'] as const;
const TONES = [
  { name: 'plain', filled: false },
  { name: 'filled', filled: true },
  { name: 'wide', filled: false },
  { name: 'tall', filled: true },
] as const;

const glyph = (shape: (typeof SHAPES)[number], filled: boolean) => {
  const fill = filled ? 'currentColor' : 'none';
  switch (shape) {
    case 'rect':
      return svg`<svg viewBox="0 0 24 24"><rect x="4" y="6" width="16" height="12" rx="1.5" fill="${fill}" stroke="currentColor" stroke-width="1.6"/></svg>`;
    case 'ellipse':
      return svg`<svg viewBox="0 0 24 24"><ellipse cx="12" cy="12" rx="8" ry="6" fill="${fill}" stroke="currentColor" stroke-width="1.6"/></svg>`;
    case 'diamond':
      return svg`<svg viewBox="0 0 24 24"><path d="M12 4 L20 12 L12 20 L4 12 Z" fill="${fill}" stroke="currentColor" stroke-width="1.6"/></svg>`;
    case 'triangle':
      return svg`<svg viewBox="0 0 24 24"><path d="M12 5 L20 19 H4 Z" fill="${fill}" stroke="currentColor" stroke-width="1.6"/></svg>`;
  }
};

interface DemoSpec {
  id: string;
  label: string;
  category: string;
  shape: (typeof SHAPES)[number];
  filled: boolean;
  size: [number, number];
}

const SPECS: DemoSpec[] = SHAPES.flatMap((shape, si) =>
  TONES.map((tone): DemoSpec => {
    const wide = tone.name === 'wide';
    const tall = tone.name === 'tall';
    return {
      id: `demo.${shape}-${tone.name}`,
      label: `${shape[0].toUpperCase()}${shape.slice(1)} (${tone.name})`,
      // Two categories so the catalogue shows real group headers.
      category: si < 2 ? 'basics' : 'ornaments',
      shape,
      filled: tone.filled,
      size: [wide ? 220 : 120, tall ? 200 : 90],
    };
  })
);

export const demoOverflowCommands: CommandDescriptor[] = SPECS.map(
  (spec, order) => ({
    id: spec.id,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    owner: DEMO_OWNER as any,
    kind: 'artefact',
    labelKey: `playground.${spec.id}`,
    labelFallback: spec.label,
    category: spec.category,
    iconKey: spec.id,
    surfaces: ['senior-menu', 'catalogue'],
    order,
    scope: 'edgeless',
    defaultKeys: { mac: [], other: [] },
    availability: 'always',
    run: std => {
      const gfx = std.get(GfxControllerIdentifier);
      const surface = gfx.surface;
      if (!surface) return;
      const { centerX, centerY } = gfx.viewport;
      const [w, h] = spec.size;
      // Small deterministic scatter so sixteen inserts do not pile up.
      const dx = ((order % 4) - 1.5) * 40;
      const dy = (Math.floor(order / 4) - 1.5) * 30;
      surface.addElement({
        type: 'shape',
        shapeType: spec.shape,
        filled: spec.filled,
        xywh: `[${centerX - w / 2 + dx},${centerY - h / 2 + dy},${w},${h}]`,
      });
      gfx.doc.captureSync();
      gfx.tool.setTool(DefaultTool);
    },
  })
);

const demoOverflowIcons: Record<string, TemplateResult> = Object.fromEntries(
  SPECS.map(spec => [spec.id, glyph(spec.shape, spec.filled)])
);

class EdgelessDemoOverflowMenu extends EdgelessCommandMenu {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  protected override owner = DEMO_OWNER as any;

  override type = EmptyTool;
}

class EdgelessDemoOverflowSeniorButton extends EdgelessToolbarToolMixin(
  SignalWatcher(LitElement)
) {
  static override styles = css`
    :host {
      display: block;
      width: 100%;
      height: 100%;
    }
    .demo-root {
      width: 100%;
      height: 64px;
      display: flex;
      align-items: flex-end;
      justify-content: center;
      cursor: pointer;
      touch-action: manipulation;
    }
    .demo-card {
      width: 54px;
      height: 54px;
      border-radius: 10px;
      border: 2px dashed var(--affine-icon-color);
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 20px;
      margin-bottom: 4px;
      background: var(--affine-background-overlay-panel-color);
    }
  `;

  override type = EmptyTool;

  private _toggleMenu() {
    if (this.popper) {
      this.popper.dispose();
      this.popper = null;
      return;
    }
    this.setEdgelessTool(DefaultTool);
    const menu = this.createPopper('edgeless-demo-overflow-menu', this);
    (menu.element as EdgelessDemoOverflowMenu).edgeless = this.edgeless;
  }

  override render() {
    return html`<edgeless-toolbar-button
      .tooltip=${this.popper ? '' : 'Demo overflow (16 fake shapes)'}
      .tooltipOffset=${4}
      .active=${!!this.popper}
      @click=${this._toggleMenu}
    >
      <div class="demo-root"><div class="demo-card">16</div></div>
    </edgeless-toolbar-button>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'edgeless-demo-overflow-menu': EdgelessDemoOverflowMenu;
    'edgeless-demo-overflow-senior-button': EdgelessDemoOverflowSeniorButton;
  }
}

// HMR-safe: vite re-evaluates this module on edit.
if (!customElements.get('edgeless-demo-overflow-menu')) {
  customElements.define(
    'edgeless-demo-overflow-menu',
    EdgelessDemoOverflowMenu
  );
  customElements.define(
    'edgeless-demo-overflow-senior-button',
    EdgelessDemoOverflowSeniorButton
  );
}

/** Append to `editor.edgelessSpecs` — playground only, never the library. */
export const demoOverflowSpecs: ExtensionType[] = [
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  SeniorToolExtension(DEMO_OWNER as any, ({ block }) => ({
    name: 'Demo overflow',
    content: html`<edgeless-demo-overflow-senior-button
      .edgeless=${block}
    ></edgeless-demo-overflow-senior-button>`,
  })),
  CommandExtension(demoOverflowCommands, demoOverflowIcons),
];
