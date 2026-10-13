import { EditPropsStore } from '@labre/affine-shared/services';
import type { AnyCommandDescriptor, CommandDescriptor } from '@labre/std';
import { GfxControllerIdentifier } from '@labre/std/gfx';
import { z } from 'zod';

import { reorderFramePresentation } from './frame-order.js';
import { PresentTool } from './present-tool.js';

/**
 * The frames' commands, `owner: 'core'`: a frame belongs to no framework, and
 * `'core'` owners are exempt from the id-prefix rule (ADR 0008).
 *
 * They live here and not beside the selection pane's: `blocks/surface` cannot
 * import `blocks/frame` (the dependency runs the other way), and the action
 * reads the frame manager's presentation order.
 */

export const reorderFramesParams = z.object({
  /** The frames to move, as one block, keeping their relative order. */
  ids: z.array(z.string().min(1)).min(1),
  /**
   * The frame they land directly BEFORE in the presentation order; `null`
   * puts them at the end.
   */
  before: z.string().min(1).nullable(),
});

export type ReorderFramesParams = z.infer<typeof reorderFramesParams>;

/**
 * Reorder the presentation (ADR 0034). The frame panel's drag, the
 * presentation toolbar's order menu and a host's own slide panel all run it
 * through `runCommand`, so the read-only refusal, the no-op check and the one
 * undo step live in the action, once.
 */
const reorderFrames: CommandDescriptor<ReorderFramesParams> = {
  id: 'canvas.frame.reorder',
  owner: 'core',
  kind: 'action',
  labelKey: 'com.labre.command.canvas.frame.reorder',
  labelFallback: 'Reorder frames',
  descriptionKey: 'com.labre.command.canvas.frame.reorder.description',
  descriptionFallback:
    'Move frames before another frame in the presentation order, or to its end.',
  // Agent only: without an explicit target there is nothing to say where.
  surfaces: ['agent'],
  scope: 'edgeless',
  defaultKeys: { mac: [], other: [] },
  availability: 'editable',
  params: reorderFramesParams,
  run: (std, _invocation, params) => {
    const parsed = reorderFramesParams.safeParse(params);
    if (!parsed.success) {
      console.error('canvas.frame.reorder: invalid params', parsed.error);
      return;
    }
    reorderFramePresentation(std, parsed.data.ids, parsed.data.before);
  },
};

/**
 * Start the slideshow (ADR 0034, amendment of 2026-10-13): the frames in
 * presentation order, full screen, Esc to leave — the presentation tool owns
 * all of it from here. The entry a host's view menu (or its header's
 * "Present" button) runs; a document without frames gets the tool's own
 * "no frame" notice.
 *
 * Edgeless only, like the tool it arms: a host showing the page view switches
 * to the canvas with its OWN mode toggle first (it owns the toggle's state and
 * the persisted mode), then runs this on the new editor scope once the canvas
 * has mounted. It reads, so a reader may present. The fit or fill choice is the
 * viewer's, stored by the frame panel's setting (`presentFillScreen`).
 */
const present: AnyCommandDescriptor = {
  id: 'canvas.present',
  owner: 'core',
  kind: 'action',
  labelKey: 'com.labre.command.canvas.present',
  labelFallback: 'Present',
  descriptionKey: 'com.labre.command.canvas.present.description',
  descriptionFallback:
    'Show the frames one after the other, full screen, in presentation order.',
  category: 'present',
  iconKey: 'canvas.present',
  keywords: ['present', 'slides', 'slideshow', 'frames', 'presentation'],
  surfaces: ['view-menu', 'palette'],
  order: 20,
  scope: 'edgeless',
  defaultKeys: { mac: [], other: [] },
  run: std => {
    const fill = std
      .getOptional(EditPropsStore)
      ?.getStorage('presentFillScreen');
    std.get(GfxControllerIdentifier).tool.setTool(PresentTool, {
      mode: fill ? 'fill' : 'fit',
    });
  },
};

export const frameCommands: AnyCommandDescriptor[] = [reorderFrames, present];
