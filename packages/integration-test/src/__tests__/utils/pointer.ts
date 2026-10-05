import { commands } from '@vitest/browser/context';

/**
 * Real pointer input a step at a time, for gestures that must be observed
 * while they happen (a drag's ghost, its drop line). The commands themselves
 * live in `vitest.config.ts` and drive Playwright's mouse.
 */
declare module '@vitest/browser/context' {
  interface BrowserCommands {
    pointerMoveTo: (
      selector: string,
      fx: number,
      fy: number,
      steps?: number
    ) => Promise<void>;
    pointerDown: () => Promise<void>;
    pointerUp: () => Promise<void>;
  }
}

/**
 * Move the mouse over what `selector` matches, at the fraction `(fx, fy)` of
 * its box, in `steps` moves. Open shadow roots are pierced.
 */
export function pointerMoveTo(
  selector: string,
  fx: number,
  fy: number,
  steps = 5
): Promise<void> {
  return commands.pointerMoveTo(selector, fx, fy, steps);
}

/** Press the primary button where the mouse is. */
export function pointerDown(): Promise<void> {
  return commands.pointerDown();
}

/** Release the primary button where the mouse is. */
export function pointerUp(): Promise<void> {
  return commands.pointerUp();
}
