import { BaseTool } from '@labre/std/gfx';

import type { NavigatorMode } from './frame-manager';

export type PresentToolOption = {
  mode?: NavigatorMode;
  restoredAfterPan?: boolean;
};

export class PresentTool extends BaseTool<PresentToolOption> {
  static override toolName: string = 'frameNavigator';

  // A presentation is not an editing state: no 'editable' command runs while
  // it is on (ADR 0055).
  static override presents = true;
}
