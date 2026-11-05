import type { Viewport } from '@labre/std/gfx';

/**
 * What a panel docked over the left of the canvas tells the viewport while it
 * is on screen (issue #433): the selection pane and the artefact catalogue are
 * overlays, they cover the canvas without shrinking the editor, so without a
 * declaration the auto-pan band, fit to screen and the element toolbar all
 * work as if the canvas under them were visible.
 *
 * The inset is measured, not restated from the CSS width (`min(320px, 85vw)`):
 * from the container's left edge to the panel's right edge, so a host that
 * offsets the editor or scales it still gets the pixels the panel covers.
 * Runtime only, nothing is stored.
 *
 * ponytail: measured on each render of the widget; a window resize that
 * changes 85vw while the panel stays open keeps the previous width until the
 * next render. Observe the panel with a `ResizeObserver` if a phone layout
 * needs it exact.
 */
export class DockedPanelInset {
  private _withdraw: (() => void) | null = null;

  private _left = 0;

  constructor(private readonly _owner: string) {}

  /** Declare `panel`'s width while it is rendered, withdraw it when it is not. */
  sync(viewport: Viewport, panel: HTMLElement | null) {
    const left = panel
      ? Math.max(0, panel.getBoundingClientRect().right - viewport.left)
      : 0;
    if (left === this._left) return;
    this.withdraw();
    if (left === 0) return;
    this._left = left;
    this._withdraw = viewport.setOccupiedInset(this._owner, { left });
  }

  withdraw() {
    this._withdraw?.();
    this._withdraw = null;
    this._left = 0;
  }
}
