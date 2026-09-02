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
      return this._targetOf(evt)?.dispatch(eventName, evt);
    }
  }

  /**
   * Which view a POSITIONED event (click, dblclick, pointerdown/up) belongs to.
   *
   * The hovered stack answers whenever it is still true — the pointer has not
   * moved off the view it was last seen on, which is the ordinary case and the
   * one every framework gesture already relies on. What this adds is the
   * fallback: when the top of the stack is NOT under the event's own
   * coordinates, the target is resolved from those coordinates instead of the
   * event being dropped.
   *
   * ## The bug this repairs
   *
   * The stack is only ever rebuilt by {@link _handlePointerMove}, so a pointer
   * that arrives somewhere without a `pointermove` reaching this manager leaves
   * it EMPTY or STALE — and every click and double-click on a canvas element is
   * then delivered to nobody, or to whatever the pointer was last over. It
   * happens for real: a `pointermove` emitted while the event dispatcher is not
   * yet active is dropped before it gets here (the first gesture in a freshly
   * mounted editor), an element created under a stationary pointer is never
   * moved onto, and a viewport change slides the canvas under a pointer that
   * never moves.
   *
   * The symptom is a very specific one, and it is what sent us here: SELECTING
   * the element works — `handleElementSelection` re-picks by point on every
   * click — while the element's own gestures do not, because they came through
   * this stack. Two answers to "what is under the pointer", one of them stale.
   * Reported on the C4 board's title band, where a click selected the sheet and
   * a double-click renamed nothing.
   *
   * Deliberately NOT a rebuild of the stack: hover enter/leave is a `pointermove`
   * story, and firing those from a click would announce arrivals and departures
   * that never happened.
   */
  private _targetOf(evt: PointerEventState): GfxElementModelView | null {
    const [x, y] = this.gfx.viewport.toModelCoord(evt.x, evt.y);

    const hovered = last(this._hoveredElementsStack) ?? null;
    if (hovered && this._answersAt(hovered, x, y)) return hovered;

    return last(this._viewsAt(x, y)) ?? null;
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

  /**
   * Whether a view answers for a MODEL point — the VIEW's hit test, not the
   * model's.
   *
   * `GfxElementModelView.includesPoint` delegates to the model by default, so
   * for every view that does not override it this is the same answer as
   * before. It is the seam a framework needs when the area that SELECTS an
   * element and the area that its own gestures answer on are not the same
   * rectangle: a framework background is picked by its border alone (issue
   * #194), yet its editable labels must keep receiving the double-click that
   * renames them, and a BPMN pool's lane separators must keep receiving the
   * drag that moves them. Those zones are drawn by the framework's view, so
   * that is where they are declared — the model layer stays free of geometry it
   * cannot see.
   */
  private _answersAt(view: GfxElementModelView, x: number, y: number): boolean {
    const model = view.model;
    return (
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
        ? (model.externalBound?.isPointInBound([x, y]) ?? false)
        : false)
    );
  }

  /**
   * The views under a MODEL point, in PAINT ORDER — the topmost last.
   *
   * One walk, used by the hover bookkeeping and by {@link _targetOf}, so "what
   * is under the pointer" has exactly one answer however it is asked.
   */
  private _viewsAt(x: number, y: number): GfxElementModelView[] {
    return (
      this.gfx.grid
        .search(new Bound(x - 5, y - 5, 10, 10), {
          filter: ['canvas', 'local'],
        })
        .reduce((pre, model) => {
          const view = this.gfx.view.get(model) as GfxElementModelView | null;
          if (!view) return pre;
          if (this._answersAt(view, x, y)) pre.push(view);
          return pre;
        }, [] as GfxElementModelView[])
        // Sort by paint order (same convention as `getElementByPoint`) so the
        // stack's last entry — the click/dblclick target — is the TOPMOST view,
        // not whichever the grid returned last (e.g. a background under a node).
        .sort((a, b) => compare(a.model, b.model))
    );
  }

  private _handlePointerMove(_evt: PointerEventState): void {
    const [x, y] = this.gfx.viewport.toModelCoord(_evt.x, _evt.y);
    const hoveredElmViews = this._viewsAt(x, y);

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
