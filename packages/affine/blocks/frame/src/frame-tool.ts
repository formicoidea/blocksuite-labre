import { DefaultTool, OverlayIdentifier } from '@labre/affine-block-surface';
import type { FrameBlockModel } from '@labre/affine-model';
import {
  EditPropsStore,
  TelemetryProvider,
  translateKey,
} from '@labre/affine-shared/services';
import type { IPoint, IVec } from '@labre/global/gfx';
import { Bound, Vec } from '@labre/global/gfx';
import type { PointerEventState } from '@labre/std';
import { BaseTool, getTopElements } from '@labre/std/gfx';
import { Text } from '@labre/store';
import * as Y from 'yjs';

import {
  EdgelessFrameManagerIdentifier,
  type FrameOverlay,
} from './frame-manager';
import { FRAME_SEED_NAME } from './translations';

export class FrameTool extends BaseTool {
  static override toolName = 'frame';

  private _frame: FrameBlockModel | null = null;

  private _startPoint: IVec | null = null;

  get frameManager() {
    return this.std.get(EdgelessFrameManagerIdentifier);
  }

  get frameOverlay() {
    return this.std.get(OverlayIdentifier('frame')) as FrameOverlay;
  }

  private _toModelCoord(p: IPoint): IVec {
    return this.gfx.viewport.toModelCoord(p.x, p.y);
  }

  override dragEnd(): void {
    if (this._frame) {
      const frame = this._frame;
      frame.pop('xywh');
      this.gfx.tool.setTool(DefaultTool);
      this.gfx.selection.set({
        elements: [frame.id],
        editing: false,
      });

      this.frameManager.addElementsToFrame(
        frame,
        getTopElements(this.frameManager.getElementsInFrameBound(frame))
      );
    }

    this._frame = null;
    this._startPoint = null;
    this.frameOverlay.clear();
  }

  override dragMove(e: PointerEventState): void {
    if (!this._startPoint) return;

    const currentPoint = this._toModelCoord(e.point);
    if (Vec.dist(this._startPoint, currentPoint) < 8 && !this._frame) return;

    if (!this._frame) {
      const frames = this.gfx.layer.blocks.filter(
        block => block.flavour === 'affine:frame'
      ) as FrameBlockModel[];

      const bound = Bound.fromPoints([this._startPoint, currentPoint]);
      const props = this.std
        .get(EditPropsStore)
        .applyLastProps('affine:frame', {
          // Translated HERE and once, like `EdgelessFrameManager._addFrameBlock`:
          // the title is document content the moment it lands (ADR 0016).
          title: new Text(
            new Y.Text(
              translateKey(this.std, ...FRAME_SEED_NAME, {
                n: frames.length + 1,
              })
            )
          ),
          xywh: bound.serialize(),
          // Not the raw back of the stack: a frame drawn on a framework
          // background must sit just above it, or the author draws blind
          // behind an opaque map. See `EdgelessFrameManager.frameIndexAt`.
          index: this.frameManager.frameIndexAt(bound),
          presentationIndex: this.frameManager.generatePresentationIndex(),
        });

      const id = this.doc.addBlock('affine:frame', props, this.gfx.surface);

      this.std.getOptional(TelemetryProvider)?.track('CanvasElementAdded', {
        control: 'canvas:draw',
        page: 'whiteboard editor',
        module: 'toolbar',
        segment: 'toolbar',
        type: 'frame',
      });
      this._frame = this.gfx.getElementById(id) as FrameBlockModel;
      this._frame.stash('xywh');
      return;
    }

    this.gfx.doc.updateBlock(this._frame, {
      xywh: Bound.fromPoints([this._startPoint, currentPoint]).serialize(),
    });

    this.frameOverlay.highlight(this._frame, true);
  }

  override dragStart(e: PointerEventState): void {
    this.doc.captureSync();
    const { point } = e;
    this._startPoint = this._toModelCoord(point);
  }
}
