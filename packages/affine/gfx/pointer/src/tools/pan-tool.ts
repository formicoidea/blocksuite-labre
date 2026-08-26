import { EdgelessLegacySlotIdentifier } from '@labre/affine-block-surface';
import { on } from '@labre/affine-shared/utils';
import type { PointerEventState } from '@labre/std';
import { BaseTool, MouseButton, type ToolOptions } from '@labre/std/gfx';
import { Signal } from '@preact/signals-core';

interface RestorablePresentToolOptions {
  mode?: string; // 'fit' | 'fill', simplified to string for local use
  restoredAfterPan?: boolean;
}

/** The presentation tool, named here because it is not importable from gfx. */
const PRESENT_TOOL_NAME = 'frameNavigator';

/** The selection tool, named here because it is not importable from gfx. */
const DEFAULT_TOOL_NAME = 'default';

export type PanToolOption = {
  panning: boolean;
};

export class PanTool extends BaseTool<PanToolOption> {
  static override toolName = 'pan';

  private _lastPoint: [number, number] | null = null;

  /**
   * Set while a finger drag has borrowed the pan tool; calling it gives the
   * previous tool — and the selection it was holding — back.
   */
  private _fingerPanRestore: (() => void) | null = null;

  readonly panning$ = new Signal<boolean>(false);

  override get allowDragWithRightButton(): boolean {
    return true;
  }

  override dragEnd(_: PointerEventState): void {
    this._lastPoint = null;
    this.panning$.value = false;
    this._releaseFingerPan();
  }

  override dragMove(e: PointerEventState): void {
    if (!this._lastPoint) return;

    const { viewport } = this.gfx;
    const { zoom } = viewport;

    const [lastX, lastY] = this._lastPoint;
    const deltaX = lastX - e.x;
    const deltaY = lastY - e.y;

    this._lastPoint = [e.x, e.y];

    viewport.applyDeltaCenter(deltaX / zoom, deltaY / zoom);
  }

  override dragStart(e: PointerEventState): void {
    this._lastPoint = [e.x, e.y];
    this.panning$.value = true;
  }

  override mounted(): void {
    this.addHook('pointerDown', evt => {
      const shouldPanWithMiddle = evt.raw.button === MouseButton.MIDDLE;

      if (!shouldPanWithMiddle) {
        return;
      }

      const restoreToPrevious = this._borrowPanTool();

      // Already panning — the pan tool is the user's own choice, not a
      // temporary borrow. There is nothing to switch to and nothing to
      // restore, so stay out of the way and let the gesture through.
      if (!restoreToPrevious) {
        return;
      }

      evt.raw.preventDefault();

      const dispose = on(document, 'pointerup', evt => {
        if (evt.button === MouseButton.MIDDLE) {
          restoreToPrevious();
        }
        // Whatever button ended the gesture, this listener has done its job:
        // release it, or a right-click after a middle-click would leave it
        // hanging on `document` and restore a stale tool later on.
        dispose();
      });

      return false;
    });

    // A finger dragging bare canvas slides the canvas, the way every touch
    // surface behaves. Borrowing happens on `dragStart`, not on `pointerDown`:
    // a tap must stay a tap, and the selection tool is still the one that has
    // to answer it. The `dragStart` hook runs BEFORE the controller resolves
    // which tool receives the event, so the pan tool below gets the whole
    // gesture — moves and end alike.
    this.addHook('dragStart', evt => {
      if (!this._shouldPanWithFinger(evt)) return;

      this._fingerPanRestore = this._borrowPanTool();
    });
  }

  /**
   * Activate the pan tool for the duration of a gesture.
   *
   * @returns a function restoring the previous tool and the selection it was
   * holding, or `null` when the pan tool is already the user's own choice —
   * there is then nothing to restore.
   */
  private _borrowPanTool(): (() => void) | null {
    const { toolType, options: originalToolOptions } =
      this.controller.currentToolOption$.peek();

    if (toolType?.toolName === PanTool.toolName) {
      return null;
    }

    // Snapshot the selection NOW. Activating the pan tool below goes through
    // `ToolController.setTool`, which clears the selection, so reading it
    // back at the end of the gesture would only ever restore an empty one.
    const selectionToRestore = this.gfx.selection.surfaceSelections.slice();

    const restoreToPrevious = () => {
      if (!toolType) return;

      let finalOptions: ToolOptions<BaseTool<any>> | undefined =
        originalToolOptions;

      if (toolType.toolName === PRESENT_TOOL_NAME) {
        // When restoring PresentTool (frameNavigator) after a temporary pan (e.g., via middle mouse button),
        // set 'restoredAfterPan' to true. This allows PresentTool to avoid an unwanted viewport reset
        // and maintain the panned position.
        const currentPresentOptions = originalToolOptions as
          | RestorablePresentToolOptions
          | undefined;
        finalOptions = {
          ...currentPresentOptions,
          restoredAfterPan: true,
        } as RestorablePresentToolOptions;
      }
      this.controller.setTool(toolType, finalOptions);
      // AFTER the switch, never before: `setTool` clears the selection.
      this.gfx.selection.set(selectionToRestore);
    };

    // If in presentation mode, disable black background after middle mouse drag
    if (toolType?.toolName === PRESENT_TOOL_NAME) {
      const slots = this.std.get(EdgelessLegacySlotIdentifier);
      slots.navigatorSettingUpdated.next({
        blackBackground: false,
      });
    }

    this.controller.setTool(PanTool, {
      panning: true,
    });

    return restoreToPrevious;
  }

  private _releaseFingerPan(): void {
    const restore = this._fingerPanRestore;
    this._fingerPanRestore = null;
    restore?.();
  }

  /** Whether this drag is a bare finger sliding over empty canvas. */
  private _shouldPanWithFinger(e: PointerEventState): boolean {
    // A second finger is a two-finger gesture — pan or pinch — and the
    // edgeless root answers those itself. It never reaches here anyway: the
    // drag controller ends the drag as soon as a non-primary pointer lands.
    if (e.raw.pointerType !== 'touch' || !e.raw.isPrimary) return false;

    // Only the selection tool lends its gesture away. Every other tool —
    // brush, shape, connector, the framework tools — draws on empty canvas,
    // and a finger is precisely how it is meant to draw.
    const { toolType } = this.controller.currentToolOption$.peek();
    if (toolType?.toolName !== DEFAULT_TOOL_NAME) return false;

    // A finger landing on something moves that something; only bare canvas
    // slides. This is what keeps dragging a Wardley or EDGY element by hand
    // working.
    const [modelX, modelY] = this.gfx.viewport.toModelCoord(e.x, e.y);
    return !this.gfx.getElementByPoint(modelX, modelY);
  }
}
