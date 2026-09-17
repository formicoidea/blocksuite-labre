import {
  FeatureFlagService,
  TelemetryProvider,
} from '@labre/affine-shared/services';
import {
  type GfxController,
  type GfxInteractivityContext,
  InteractivityExtension,
  InteractivityIdentifier,
} from '@labre/std/gfx';

import { insertEdgelessTextCommand } from './commands';
import { addText } from './edgeless-text-editor';

/**
 * Whether a double click at this model point lands on nothing at all.
 *
 * Two layers have to agree, because they answer different questions: the model
 * hit test (`getElementByPoint`) answers "may I be selected here?", the view
 * router answers "is this point mine?". Since framework backgrounds became
 * border-only for picking (#194), their axis labels are a place where the two
 * disagree — the model calls the label empty canvas while the view is opening
 * its rename editor there, and dropping a text block on top blurs that editor
 * shut before the user can type.
 */
export function isEmptyCanvasAt(
  gfx: GfxController,
  x: number,
  y: number
): boolean {
  if (gfx.getElementByPoint(x, y)) return false;
  return !gfx.std.getOptional(InteractivityIdentifier)?.hasViewAt(x, y);
}

export class DblClickAddEdgelessText extends InteractivityExtension {
  static override key = 'dbl-click-add-edgeless-text';

  override mounted() {
    this.event.on('dblclick', (ctx: GfxInteractivityContext) => {
      const { event: e } = ctx;
      const textFlag = this.std.store
        .get(FeatureFlagService)
        .getFlag('enable_edgeless_text');
      const [x, y] = this.gfx.viewport.toModelCoord(e.x, e.y);

      if (!isEmptyCanvasAt(this.gfx, x, y)) {
        return;
      }

      if (textFlag) {
        this.std.command.exec(insertEdgelessTextCommand, { x, y });
      } else {
        const edgelessView = this.std.view.getBlock(
          this.std.store.root?.id || ''
        );

        if (edgelessView) {
          addText(edgelessView, e);
        }
      }

      this.std.getOptional(TelemetryProvider)?.track('CanvasElementAdded', {
        control: 'canvas:dbclick',
        page: 'whiteboard editor',
        module: 'toolbar',
        segment: 'toolbar',
        type: 'text',
      });
    });
  }
}
