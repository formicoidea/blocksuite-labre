import { EdgelessLegacySlotIdentifier } from '@labre/affine-block-surface';
import { getSelectedRect, toOverlayCoord } from '@labre/affine-shared/utils';
import { type IVec, Rect } from '@labre/global/gfx';
import {
  GfxControllerIdentifier,
  type ToolOptionWithType,
} from '@labre/std/gfx';
import { effect } from '@preact/signals-core';

import {
  DRAG_HANDLE_CONTAINER_OFFSET_LEFT_TOP_LEVEL,
  DRAG_HANDLE_CONTAINER_WIDTH_TOP_LEVEL,
  HOVER_AREA_RECT_PADDING_TOP_LEVEL,
} from '../config.js';
import type { AffineDragHandleWidget } from '../drag-handle.js';

/**
 * Used to control the drag handle visibility in edgeless mode
 *
 * 1. Show drag handle on every block and gfx element
 * 2. Multiple selection is not supported
 */
export class EdgelessWatcher {
  private readonly _handleEdgelessToolUpdated = (
    newTool: ToolOptionWithType
  ) => {
    if (newTool.toolType?.toolName === 'default') {
      this.updateAnchorElement();
    } else {
      this.widget.hide();
    }
  };

  private readonly _handleEdgelessViewPortUpdated = ({
    zoom,
    center,
  }: {
    zoom: number;
    center: IVec;
  }) => {
    if (this.widget.scale.peek() !== zoom) {
      this.widget.scale.value = zoom;
    }

    if (
      this.widget.center[0] !== center[0] &&
      this.widget.center[1] !== center[1]
    ) {
      this.widget.center = [...center];
    }

    if (this.widget.isGfxDragHandleVisible) {
      this._showDragHandle();
      this._updateDragHoverRectTopLevelBlock();
    } else if (this.widget.activeDragHandle) {
      this.widget.hide();
    }
  };

  private readonly _showDragHandle = () => {
    if (!this.widget.anchorBlockId) return;

    const container = this.widget.dragHandleContainer;
    const grabber = this.widget.dragHandleGrabber;
    if (!container || !grabber) return;

    const area = this.hoveredElemArea;
    if (!area) return;

    container.style.transition = 'none';
    container.style.paddingTop = `0px`;
    container.style.paddingBottom = `0px`;
    container.style.left = `${area.left}px`;
    container.style.top = `${area.top}px`;
    container.style.display = 'flex';

    this.widget.handleAnchorModelDisposables();

    this.widget.activeDragHandle = 'gfx';
  };

  private readonly _updateDragHoverRectTopLevelBlock = () => {
    if (!this.widget.dragHoverRect) return;

    this.widget.dragHoverRect = this.hoveredElemAreaRect;
  };

  get gfx() {
    return this.widget.std.get(GfxControllerIdentifier);
  }

  updateAnchorElement = () => {
    if (!this.widget.isConnected) return;
    if (this.widget.store.readonly || this.widget.mode === 'page') {
      this.widget.hide();
      return;
    }

    const { selection } = this.gfx;
    const editing = selection.editing;
    const selectedElements = selection.selectedElements;

    if (
      editing ||
      selectedElements.length !== 1 ||
      this.widget.store.readonly
    ) {
      this.widget.hide();
      return;
    }

    const selectedElement = selectedElements[0];

    this.widget.anchorBlockId.value = selectedElement.id;

    this._showDragHandle();
  };

  get hoveredElemAreaRect() {
    const area = this.hoveredElemArea;
    if (!area) return null;

    return new Rect(area.left, area.top, area.right, area.bottom);
  }

  get hoveredElemArea() {
    const edgelessElement = this.widget.anchorEdgelessElement.peek();

    if (!edgelessElement) return null;

    const { viewport } = this.gfx;
    const rect = getSelectedRect([edgelessElement]);
    // The handle is drawn inside the container the host may have scaled, so
    // the area it hugs is stated in that container's space, the way a gfx
    // block states its own placement.
    const { viewScale } = viewport;
    let [left, top] = toOverlayCoord(viewport, rect.left, rect.top);
    // The widget's scale tracks the viewport zoom
    // (see `_handleEdgelessViewPortUpdated`); dividing it by `viewScale` is
    // what `overlayScale` does for every other overlay.
    const scale = this.widget.scale.peek() / viewScale;
    const width = rect.width * scale;
    const height = rect.height * scale;

    let [right, bottom] = [left + width, top + height];

    const padding = HOVER_AREA_RECT_PADDING_TOP_LEVEL * scale;

    const containerWidth = DRAG_HANDLE_CONTAINER_WIDTH_TOP_LEVEL * scale;
    const offsetLeft = DRAG_HANDLE_CONTAINER_OFFSET_LEFT_TOP_LEVEL / viewScale;

    left -= containerWidth + offsetLeft;
    right += padding;
    bottom += padding;

    return {
      left,
      top,
      right,
      bottom,
      width,
      height,
      padding,
      containerWidth,
    };
  }

  constructor(readonly widget: AffineDragHandleWidget) {}

  watch() {
    if (this.widget.mode === 'page') {
      return;
    }

    const { disposables, std } = this.widget;
    const gfx = std.get(GfxControllerIdentifier);
    const { viewport, selection, tool, surface } = gfx;
    const edgelessSlots = std.get(EdgelessLegacySlotIdentifier);

    disposables.add(
      viewport.viewportUpdated.subscribe(this._handleEdgelessViewPortUpdated)
    );

    disposables.add(
      selection.slots.updated.subscribe(() => {
        this.updateAnchorElement();
      })
    );

    disposables.add(
      edgelessSlots.readonlyUpdated.subscribe(() => {
        this.updateAnchorElement();
      })
    );

    disposables.add(
      edgelessSlots.elementResizeEnd.subscribe(() => {
        this.updateAnchorElement();
      })
    );

    disposables.add(
      effect(() => {
        const value = tool.currentToolOption$.value;

        value && this._handleEdgelessToolUpdated(value);
      })
    );

    disposables.add(
      edgelessSlots.elementResizeStart.subscribe(() => {
        this.widget.hide();
      })
    );

    disposables.add(
      std.store.slots.blockUpdated.subscribe(payload => {
        if (
          this.widget.isGfxDragHandleVisible &&
          payload.id === this.widget.anchorBlockId.peek()
        ) {
          if (payload.type === 'delete') {
            this.widget.hide();
          }
          if (payload.type === 'update') {
            this._showDragHandle();
          }
        }
      })
    );

    if (surface) {
      disposables.add(
        surface.elementUpdated.subscribe(() => {
          if (this.widget.isGfxDragHandleVisible) {
            this._showDragHandle();
          }
        })
      );
    }
  }
}
