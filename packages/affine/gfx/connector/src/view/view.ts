import {
  CONNECTOR_END_LABEL_GRAB,
  type ConnectorElementModel,
  LocalShapeElementModel,
} from '@labre/affine-model';
import {
  Bound,
  type IVec,
  serializeXYWH,
  Vec,
  type XYWH,
} from '@labre/global/gfx';
import type { PointerEventState } from '@labre/std';
import {
  type DragEndContext,
  type DragMoveContext,
  type DragStartContext,
  generateKeyBetween,
  GfxElementModelView,
  GfxViewInteractionExtension,
} from '@labre/std/gfx';

import {
  type ConnectorLabelWhich,
  mountConnectorLabelEditor,
} from '../text/edgeless-connector-label-editor';

/**
 * How close to an endpoint a double-click has to land to mean "the label of
 * THAT end" (`docs/adr/0018` phase 2).
 *
 * Re-exported rather than declared: the number is the model's now, because the
 * connector's own HIT TEST has to claim the same discs — a gesture the
 * dispatcher never delivers is a gesture no picker gets to interpret
 * (`connectorEndNear`, and the PO's recette of 14/09/2026). Kept exported here
 * because this is where every caller has always reached for it.
 */
export { CONNECTOR_END_LABEL_GRAB };

/** What {@link pickConnectorLabelWhich} needs, and nothing more. */
export type ConnectorLabelHitTarget = {
  absolutePath: readonly IVec[];
  sourceLabelXYWH?: XYWH;
  targetLabelXYWH?: XYWH;
};

/**
 * Which of a connector's three labels a point is asking for.
 *
 * The order is what makes the gesture predictable:
 *
 * 1. an END LABEL BOX under the pointer — an existing label is edited where it
 *    is drawn, never re-created somewhere else;
 * 2. otherwise, within {@link CONNECTOR_END_LABEL_GRAB} of an ENDPOINT — the
 *    nearer end, which is where a label the connector does not have yet gets
 *    created;
 * 3. otherwise the CENTRE, which is what a double-click on a connector has
 *    always meant and stays the answer everywhere else on the line.
 *
 * Pure, and exported, because the ordering is the whole behaviour and a spec
 * that had to drive a real pointer to check it would test the dispatcher.
 */
export function pickConnectorLabelWhich(
  connector: ConnectorLabelHitTarget,
  point: IVec,
  grab: number = CONNECTOR_END_LABEL_GRAB
): ConnectorLabelWhich {
  const boxes = [
    ['source', connector.sourceLabelXYWH],
    ['target', connector.targetLabelXYWH],
  ] as const;

  for (const [end, box] of boxes) {
    if (box && Bound.fromXYWH(box).isPointInBound(point)) return end;
  }

  const path = connector.absolutePath;
  if (path.length) {
    const first = path[0];
    const last = path[path.length - 1];
    const toSource = Vec.dist(point, [first[0], first[1]]);
    const toTarget = Vec.dist(point, [last[0], last[1]]);

    if (Math.min(toSource, toTarget) <= grab) {
      return toSource <= toTarget ? 'source' : 'target';
    }
  }

  return 'center';
}

export class ConnectorElementView extends GfxElementModelView<ConnectorElementModel> {
  static override type = 'connector';

  override onDragStart = (context: DragStartContext) => {
    super.onDragStart(context);
    this.model.stash('labelXYWH');
  };

  override onDragEnd = (context: DragEndContext) => {
    super.onDragEnd(context);
    this.model.stash('labelXYWH');
  };

  override onDragMove = (context: DragMoveContext) => {
    const { dx, dy, currentBound } = context;

    this.model.moveTo(currentBound.moveDelta(dx, dy));
  };

  override onCreated(): void {
    super.onCreated();

    // What the GRID must offer before any hit test is asked. The grid indexes a
    // connector by its `responseBound` — the box of its PATH — and the end-label
    // grab discs stick out of it by up to `CONNECTOR_END_LABEL_GRAB`, so without
    // this nothing is ever a candidate out there and
    // `ConnectorElementModel.endGrabIncludesPoint` never gets asked. It widens
    // the CANDIDATE set only: what is picked, hovered and selected is still
    // decided by the model's own `includesPoint`.
    //
    // Set from the view rather than defaulted on the model because it is a
    // LOCAL fact about this peer's pointer, which is exactly what
    // `responseExtension` is for — nothing about it is written to the document.
    this.model.responseExtension = [
      CONNECTOR_END_LABEL_GRAB,
      CONNECTOR_END_LABEL_GRAB,
    ];

    this._initLabelMoving();
  }

  private _initLabelMoving(): void {
    let curLabelElement: LocalShapeElementModel | null = null;

    if (this.model.isLocked()) {
      return;
    }

    const enterLabelEditor = (
      evt: PointerEventState,
      which: ConnectorLabelWhich = 'center'
    ) => {
      const edgeless = this.std.view.getBlock(this.std.store.root!.id);

      if (edgeless && !this.model.isLocked()) {
        mountConnectorLabelEditor(
          this.model,
          edgeless,
          this.gfx.viewport.toModelCoord(evt.x, evt.y),
          { which }
        );
      }
    };
    /** Which label the pointer is asking for, in model coordinates. */
    const labelEndAt = (evt: PointerEventState): ConnectorLabelWhich =>
      pickConnectorLabelWhich(
        this.model,
        this.gfx.viewport.toModelCoord(evt.x, evt.y)
      );
    const getCurrentPosition = (evt: PointerEventState) => {
      const [x, y] = this.gfx.viewport.toModelCoord(evt.x, evt.y);
      return {
        x,
        y,
        clientX: evt.raw.clientX,
        clientY: evt.raw.clientY,
      };
    };
    const watchEvent = (labelModel: LocalShapeElementModel) => {
      // `ViewManager.get` returns null for an element that has no view yet —
      // the local label element is registered a beat before its view exists.
      const view = this.gfx.view.get(labelModel) as GfxElementModelView | null;
      if (!view) return;

      const connectorModel = this.model;

      let labelBound: Bound | null = null;
      let startPoint = {
        x: 0,
        y: 0,
        clientX: 0,
        clientY: 0,
      };
      let lastPoint = {
        x: 0,
        y: 0,
        clientX: 0,
        clientY: 0,
      };

      view.on('dblclick', evt => {
        // This view IS the centre label's box, so the answer is not up for
        // discussion — a short connector whose caption sits within grabbing
        // distance of an arrowhead still edits its caption when you click it.
        enterLabelEditor(evt, 'center');
      });
      view.on('dragstart', evt => {
        startPoint = getCurrentPosition(evt);
        labelBound = Bound.deserialize(labelModel.xywh);

        connectorModel.stash('labelXYWH');
        connectorModel.stash('labelOffset');
      });

      view.on('dragmove', evt => {
        if (!labelBound) {
          return;
        }

        lastPoint = getCurrentPosition(evt);
        const newBound = labelBound.clone();
        const delta = [lastPoint.x - startPoint.x, lastPoint.y - startPoint.y];
        const center = connectorModel.getNearestPoint(
          Vec.add(newBound.center, delta)
        );
        const distance = connectorModel.getOffsetDistanceByPoint(center);
        newBound.center = center;

        connectorModel.labelXYWH = newBound.toXYWH();
        connectorModel.labelOffset = {
          distance,
        };
      });

      view.on('dragend', () => {
        if (labelBound) {
          labelBound = null;
          connectorModel.pop('labelXYWH');
          connectorModel.pop('labelOffset');
        }
      });
    };
    const updateLabelElement = () => {
      if (!this.model.labelXYWH || !this.model.text) {
        // Clean up existing label element if conditions are no longer met
        if (curLabelElement) {
          this.surface.deleteLocalElement(curLabelElement);
          curLabelElement = null;
        }
        return;
      }

      const labelElement =
        curLabelElement || new LocalShapeElementModel(this.surface);
      labelElement.xywh = serializeXYWH(...this.model.labelXYWH);
      labelElement.index = generateKeyBetween(this.model.index, null);

      if (!curLabelElement) {
        curLabelElement = labelElement;

        labelElement.id = `#${this.model.id}-label`;
        labelElement.creator = this.model;
        labelElement.fillColor = 'transparent';
        labelElement.strokeColor = 'transparent';
        labelElement.strokeWidth = 0;

        this.surface.addLocalElement(labelElement);
        this.disposable.add(() => {
          this.surface.deleteLocalElement(labelElement);
        });
        watchEvent(labelElement);
      }
    };

    this.disposable.add(
      this.model.propsUpdated.subscribe(payload => {
        if (
          payload.key === 'labelXYWH' ||
          payload.key === 'text' ||
          payload.key === 'index'
        ) {
          updateLabelElement();
        }
      })
    );

    updateLabelElement();

    this.on('dblclick', evt => {
      // The centre label, when it exists, is a local element with its own view
      // and its own `dblclick` above: anything that lands inside its box is
      // already spoken for, and answering here too would mount two editors.
      if (
        curLabelElement &&
        Bound.deserialize(curLabelElement.xywh).isPointInBound(
          this.gfx.viewport.toModelCoord(evt.x, evt.y)
        )
      ) {
        return;
      }

      const which = labelEndAt(evt);

      // Outside that box, `center` means what it meant before this tranche:
      // open the caption editor when there is no caption yet, and otherwise do
      // nothing (the caption is edited by clicking the caption). The two ends
      // are new, and they answer whether the connector has a caption or not.
      if (which === 'center' && curLabelElement) return;

      enterLabelEditor(evt, which);
    });
  }
}

export const ConnectorInteraction =
  GfxViewInteractionExtension<ConnectorElementView>(ConnectorElementView.type, {
    handleResize: ({ model, gfx }) => {
      const initialPath = model.absolutePath;

      return {
        beforeResize(context): void {
          const { elements } = context;
          // show the handles only when connector is selected along with
          // its source and target elements
          if (
            elements.length === 1 ||
            (model.source.id &&
              !elements.some(el => el.model.id === model.source.id)) ||
            (model.target.id &&
              !elements.some(el => el.model.id === model.target.id))
          ) {
            context.set({
              allowedHandlers: [],
            });
          }
        },

        onResizeStart(): void {
          model.stash('labelXYWH');
          model.stash('source');
          model.stash('target');
          model.stash('curveControlPoint');
        },

        onResizeMove(context): void {
          const { matrix } = context;
          const props = model.resize(initialPath, matrix);

          gfx.updateElement(model, props);
        },

        onResizeEnd(): void {
          model.pop('labelXYWH');
          model.pop('source');
          model.pop('target');
          model.pop('curveControlPoint');
        },
      };
    },
    handleRotate({ model, gfx }) {
      const initialPath = model.absolutePath;

      return {
        onRotateStart(): void {
          model.stash('labelXYWH');
          model.stash('source');
          model.stash('target');
          model.stash('curveControlPoint');
        },

        onRotateMove(context): void {
          const { matrix } = context;
          const props = model.resize(initialPath, matrix);

          gfx.updateElement(model, props);
        },

        onRotateEnd(): void {
          model.pop('labelXYWH');
          model.pop('source');
          model.pop('target');
          model.pop('curveControlPoint');
        },
      };
    },
  });
