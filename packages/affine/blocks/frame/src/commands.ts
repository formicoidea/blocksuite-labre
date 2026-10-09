import type { AnyCommandDescriptor, CommandDescriptor } from '@labre/std';
import { z } from 'zod';

import { reorderFramePresentation } from './frame-order.js';

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

export const frameCommands: AnyCommandDescriptor[] = [reorderFrames];
