import { getCommonBoundWithRotation } from '@labre/global/gfx';
import { Signal } from '@preact/signals-core';

import type { GfxController } from './controller.js';
import { GfxExtension, GfxExtensionIdentifier } from './extension.js';
import { GfxBlockElementModel } from './model/gfx-block-model.js';
import type { GfxModel } from './model/model.js';
import { GfxPrimitiveElementModel } from './model/surface/element-model.js';

/**
 * How long a highlight stays visible when no `duration` is given.
 */
export const DEFAULT_HIGHLIGHT_DURATION = 2000;

/**
 * Viewport padding used when `reframe` is requested without an explicit one.
 * Expressed in percentage of the viewport (see `Viewport.setViewportByBound`).
 */
export const DEFAULT_HIGHLIGHT_PADDING: [number, number, number, number] = [
  0.15, 0.15, 0.15, 0.15,
];

export interface HighlightElementsOptions {
  /**
   * Reframe the viewport on the union of the target bounds before emphasizing
   * them. Defaults to `false`, the highlight is then purely visual.
   */
  reframe?: boolean;

  /**
   * How long the emphasis stays visible, in milliseconds.
   * Defaults to {@link DEFAULT_HIGHLIGHT_DURATION}.
   * Pass `0` to keep it until the next `highlightElements` or `clear` call.
   */
  duration?: number;

  /**
   * Padding applied by the reframe, only used when `reframe` is `true`.
   * Defaults to {@link DEFAULT_HIGHLIGHT_PADDING}.
   */
  padding?: [number, number, number, number];

  /**
   * Animate the reframe, only used when `reframe` is `true`. Defaults to `true`.
   */
  smooth?: boolean;
}

/**
 * Only models that live on the canvas can carry an emphasis ring.
 * Anything else queried by id (plain blocks, unknown ids) is ignored.
 */
function isRenderableGfxModel(model: unknown): model is GfxModel {
  return (
    model instanceof GfxPrimitiveElementModel ||
    model instanceof GfxBlockElementModel
  );
}

/**
 * Transient, read-only emphasis on a set of graphic elements.
 *
 * The manager owns the state only: it never writes to the store and never
 * touches the selection model, so it is safe on a read-only or non-interactive
 * editor (an embedded preview window, for instance). The actual ring is drawn
 * by a renderer subscribing to {@link ElementHighlightManager.highlighted$},
 * which keeps this extension free of any rendering concern.
 */
export class ElementHighlightManager extends GfxExtension {
  static override key = 'elementHighlight';

  private _timer: ReturnType<typeof setTimeout> | null = null;

  /**
   * Ids of the elements currently emphasized. Empty when nothing is
   * highlighted. Only ids that resolved to an actual graphic element at call
   * time are kept.
   */
  readonly highlighted$ = new Signal<readonly string[]>([]);

  /**
   * The models behind {@link highlighted$}, resolved on read so that elements
   * deleted meanwhile simply drop out of the highlight.
   */
  get highlightedElements(): GfxModel[] {
    return this.highlighted$.value
      .map(id => this.gfx.getElementById(id))
      .filter(isRenderableGfxModel);
  }

  static override extendGfx(gfx: GfxController): void {
    Object.defineProperty(gfx, 'highlight', {
      get(this: GfxController) {
        return this.std.get(GfxExtensionIdentifier('elementHighlight'));
      },
    });

    Object.defineProperty(gfx, 'highlightElements', {
      value: (ids: string[], opts?: HighlightElementsOptions) =>
        gfx.highlight.highlightElements(ids, opts),
    });
  }

  private _clearTimer() {
    if (this._timer !== null) {
      clearTimeout(this._timer);
      this._timer = null;
    }
  }

  /**
   * Drop the current emphasis immediately.
   */
  clear(): void {
    this._clearTimer();
    if (this.highlighted$.peek().length === 0) return;
    this.highlighted$.value = [];
  }

  /**
   * Emphasize the given elements for a while.
   *
   * Unknown ids and non-graphic blocks are ignored; if none of the ids
   * resolves, any running highlight is cleared and nothing else happens.
   * Calling it again replaces the previous highlight and restarts the timer.
   */
  highlightElements(ids: string[], opts: HighlightElementsOptions = {}): void {
    this._clearTimer();

    const elements = ids
      .map(id => this.gfx.getElementById(id))
      .filter(isRenderableGfxModel);

    if (elements.length === 0) {
      this.highlighted$.value = [];
      return;
    }

    if (opts.reframe) {
      this.gfx.viewport.setViewportByBound(
        getCommonBoundWithRotation(elements),
        opts.padding ?? DEFAULT_HIGHLIGHT_PADDING,
        opts.smooth ?? true
      );
    }

    this.highlighted$.value = elements.map(element => element.id);

    const duration = opts.duration ?? DEFAULT_HIGHLIGHT_DURATION;
    if (duration > 0) {
      this._timer = setTimeout(() => {
        this._timer = null;
        this.clear();
      }, duration);
    }
  }

  override unmounted() {
    this._clearTimer();
    this.highlighted$.value = [];
  }
}

declare module './controller.js' {
  interface GfxController {
    readonly highlight: ElementHighlightManager;

    /**
     * Transiently emphasize a set of elements without mutating the document
     * nor the selection. Shorthand for `gfx.highlight.highlightElements`.
     */
    highlightElements(ids: string[], opts?: HighlightElementsOptions): void;
  }
}
