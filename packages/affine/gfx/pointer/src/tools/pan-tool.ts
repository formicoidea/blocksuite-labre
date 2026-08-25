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

export type PanToolOption = {
  panning: boolean;
};

export class PanTool extends BaseTool<PanToolOption> {
  static override toolName = 'pan';

  private _lastPoint: [number, number] | null = null;

  readonly panning$ = new Signal<boolean>(false);

  override get allowDragWithRightButton(): boolean {
    return true;
  }

  override dragEnd(_: PointerEventState): void {
    this._lastPoint = null;
    this.panning$.value = false;
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

      const { toolType, options: originalToolOptions } =
        this.controller.currentToolOption$.peek();

      // Already panning — the pan tool is the user's own choice, not a
      // temporary borrow. There is nothing to switch to and nothing to
      // restore, so stay out of the way and let the gesture through.
      if (toolType?.toolName === PanTool.toolName) {
        return;
      }

      evt.raw.preventDefault();

      // Snapshot the selection NOW. Activating the pan tool below goes through
      // `ToolController.setTool`, which clears the selection, so reading it
      // back when the wheel is released would only ever restore an empty one.
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
  }
}
