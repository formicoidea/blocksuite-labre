import { Bound } from '@labre/global/gfx';
import last from 'lodash-es/last';

import type { PointerEventState } from '../../event';
import { compare } from '../../utils/layer.js';
import type { GfxController } from '../controller.js';
import type { GfxElementModelView, SupportedEvent } from '../view/view.js';

export class GfxViewEventManager {
  private _hoveredElementsStack: GfxElementModelView[] = [];
  private _draggingElement: GfxElementModelView | null = null;

  private _callInReverseOrder(
    callback: (view: GfxElementModelView) => void,
    arr = this._hoveredElementsStack
  ) {
    for (let i = arr.length - 1; i >= 0; i--) {
      const view = arr[i];

      callback(view);
    }
  }

  constructor(private readonly gfx: GfxController) {}

  dispatch(eventName: SupportedEvent, evt: PointerEventState) {
    if (eventName === 'pointermove') {
      this._handlePointerMove(evt);
      return false;
    } else if (eventName.startsWith('drag')) {
      return this._handleDrag(
        eventName as 'dragstart' | 'dragend' | 'dragmove',
        evt
      );
    } else {
      return last(this._hoveredElementsStack)?.dispatch(eventName, evt);
    }
  }

  private _handleDrag(
    evtName: 'dragstart' | 'dragend' | 'dragmove',
    _evt: PointerEventState
  ): boolean {
    switch (evtName) {
      case 'dragstart': {
        if (this._draggingElement) {
          this._draggingElement.dispatch('dragend', _evt);
        }
        this._draggingElement = last(this._hoveredElementsStack) ?? null;
        return this._draggingElement?.dispatch('dragstart', _evt) ?? false;
      }
      case 'dragmove': {
        return this._draggingElement?.dispatch('dragmove', _evt) ?? false;
      }
      case 'dragend': {
        const dispatched =
          this._draggingElement?.dispatch('dragend', _evt) ?? false;
        this._draggingElement = null;
        return dispatched;
      }
    }
  }

  private _handlePointerMove(_evt: PointerEventState): void {
    const [x, y] = this.gfx.viewport.toModelCoord(_evt.x, _evt.y);
    const hoveredElmViews = this.gfx.grid
      .search(new Bound(x - 5, y - 5, 10, 10), {
        filter: ['canvas', 'local'],
      })
      .reduce((pre, model) => {
        const view = this.gfx.view.get(model) as GfxElementModelView | null;

        if (!view) return pre;

        // The VIEW's hit test, not the model's.
        //
        // `GfxElementModelView.includesPoint` delegates to the model by
        // default, so for every view that does not override it this is the
        // same answer as before. It is the seam a framework needs when the
        // area that SELECTS an element and the area that its own gestures
        // answer on are not the same rectangle: a framework background is
        // picked by its border alone (issue #194), yet its editable labels
        // must keep receiving the double-click that renames them, and a BPMN
        // pool's lane separators must keep receiving the drag that moves them.
        // Those zones are drawn by the framework's view, so that is where they
        // are declared — the model layer stays free of geometry it cannot see.
        if (
          view.includesPoint(
            x,
            y,
            {
              hitThreshold: 10,
              responsePadding: [5, 5],
            },
            this.gfx.std.host
          ) ||
          ('externalBound' in model
            ? model.externalBound?.isPointInBound([x, y])
            : false)
        ) {
          pre.push(view);
        }

        return pre;
      }, [] as GfxElementModelView[])
      // Sort by paint order (same convention as `getElementByPoint`) so the
      // stack's last entry — the click/dblclick target — is the TOPMOST view,
      // not whichever the grid returned last (e.g. a background under a node).
      .sort((a, b) => compare(a.model, b.model));

    const currentStackedViews = new Set(this._hoveredElementsStack);
    const visited = new Set<GfxElementModelView>();

    this._callInReverseOrder(view => {
      if (currentStackedViews.has(view)) {
        visited.add(view);
        view.dispatch('pointermove', _evt);
      } else {
        view.dispatch('pointerenter', _evt);
      }
    }, hoveredElmViews);
    this._callInReverseOrder(
      view => !visited.has(view) && view.dispatch('pointerleave', _evt)
    );
    this._hoveredElementsStack = hoveredElmViews;
  }
}
