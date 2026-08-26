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

type HoveredElemArea = {
  left: number;
  top: number;
  right: number;
  bottom: number;
  width: number;
  height: number;
  padding: number;
  containerWidth: number;
};

/**
 * Used to control the drag handle visibility in edgeless mode
 *
 * 1. Show drag handle on every block and gfx element
 * 2. Multiple selection is not supported
 */
export class EdgelessWatcher {
  private _pendingHoveredElemArea: HoveredElemArea | null = null;

  private _lastAppliedHoveredElemArea: HoveredElemArea | null = null;

  private _showDragHandleRafId: number | null = null;

  private _surfaceElementUpdatedRafId: number | null = null;

  private readonly _isAreaEqual = (
    left: HoveredElemArea | null,
    right: HoveredElemArea | null
  ) => {
    if (!left || !right) return false;
    return (
      left.left === right.left &&
      left.top === right.top &&
      left.right === right.right &&
      left.bottom === right.bottom &&
      left.width === right.width &&
      left.height === right.height &&
      left.padding === right.padding &&
      left.containerWidth === right.containerWidth
    );
  };

  private readonly _scheduleShowDragHandleFromSurfaceUpdate = () => {
    if (this._surfaceElementUpdatedRafId !== null) return;

    this._surfaceElementUpdatedRafId = requestAnimationFrame(() => {
      this._surfaceElementUpdatedRafId = null;
      if (!this.widget.isGfxDragHandleVisible) return;
      this._showDragHandle();
    });
  };

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

    // `||`, not `&&`: a pan along a single axis moves the centre just as much
    // as a diagonal one does.
    if (
      this.widget.center[0] !== center[0] ||
      this.widget.center[1] !== center[1]
    ) {
      this.widget.center = [...center];
    }

    if (this.widget.isGfxDragHandleVisible) {
      // Measured once and read twice: this runs on every frame of a pan or a
      // zoom, and measuring means a layout read per selected element.
      const area = this.hoveredElemArea;
      this._showDragHandle(area);
      this._updateDragHoverRectTopLevelBlock(area);
    } else if (this.widget.activeDragHandle) {
      this.widget.hide();
    }
  };

  private readonly _flushShowDragHandle = () => {
    this._showDragHandleRafId = null;

    // `anchorBlockId` is a signal, so the object itself is always truthy: its
    // value is what says whether anything is anchored.
    if (!this.widget.anchorBlockId.peek()) return;

    const container = this.widget.dragHandleContainer;
    const grabber = this.widget.dragHandleGrabber;
    if (!container || !grabber) return;

    const area = this._pendingHoveredElemArea ?? this.hoveredElemArea;
    this._pendingHoveredElemArea = null;
    if (!area) return;

    if (
      this.widget.isGfxDragHandleVisible &&
      this._isAreaEqual(this._lastAppliedHoveredElemArea, area)
    ) {
      return;
    }

    // Every write below invalidates style, so each one happens only when it
    // actually changes something.
    if (container.style.transition !== 'none') {
      container.style.transition = 'none';
    }
    if (container.style.paddingTop !== '0px') {
      container.style.paddingTop = '0px';
    }
    if (container.style.paddingBottom !== '0px') {
      container.style.paddingBottom = '0px';
    }
    const nextLeft = `${area.left}px`;
    if (container.style.left !== nextLeft) {
      container.style.left = nextLeft;
    }
    const nextTop = `${area.top}px`;
    if (container.style.top !== nextTop) {
      container.style.top = nextTop;
    }
    if (container.style.display !== 'flex') {
      container.style.display = 'flex';
    }

    this.widget.handleAnchorModelDisposables();

    this.widget.activeDragHandle = 'gfx';
    this._lastAppliedHoveredElemArea = { ...area };
  };

  private readonly _showDragHandle = (area?: HoveredElemArea | null) => {
    this._pendingHoveredElemArea = area ?? this.hoveredElemArea;
    if (!this._pendingHoveredElemArea) {
      return;
    }
    if (
      this.widget.isGfxDragHandleVisible &&
      this._showDragHandleRafId === null &&
      this._isAreaEqual(
        this._lastAppliedHoveredElemArea,
        this._pendingHoveredElemArea
      )
    ) {
      return;
    }
    if (this._showDragHandleRafId !== null) {
      return;
    }
    this._showDragHandleRafId = requestAnimationFrame(
      this._flushShowDragHandle
    );
  };

  private readonly _updateDragHoverRectTopLevelBlock = (
    area?: HoveredElemArea | null
  ) => {
    if (!this.widget.dragHoverRect) return;

    const nextArea = area ?? this.hoveredElemArea;
    if (!nextArea) {
      this.widget.dragHoverRect = null;
      return;
    }

    const nextRect = new Rect(
      nextArea.left,
      nextArea.top,
      nextArea.right,
      nextArea.bottom
    );
    const prevRect = this.widget.dragHoverRect;
    if (
      prevRect.left === nextRect.left &&
      prevRect.top === nextRect.top &&
      prevRect.width === nextRect.width &&
      prevRect.height === nextRect.height
    ) {
      return;
    }

    this.widget.dragHoverRect = nextRect;
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

  get hoveredElemArea(): HoveredElemArea | null {
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

    disposables.add(() => {
      if (this._showDragHandleRafId !== null) {
        cancelAnimationFrame(this._showDragHandleRafId);
        this._showDragHandleRafId = null;
      }
      if (this._surfaceElementUpdatedRafId !== null) {
        cancelAnimationFrame(this._surfaceElementUpdatedRafId);
        this._surfaceElementUpdatedRafId = null;
      }
      this._pendingHoveredElemArea = null;
      this._lastAppliedHoveredElemArea = null;
    });

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
        surface.elementUpdated.subscribe(
          this._scheduleShowDragHandleFromSurfaceUpdate
        )
      );
    }
  }
}
