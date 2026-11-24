import { commands } from '@vitest/browser/context';

/**
 * The page's JS heap, through the DevTools protocol (the commands live in
 * `vitest.config.ts`): a full garbage collection, then the exact used size.
 * For a spec that counts what a teardown left alive, never for a timing.
 */
declare module '@vitest/browser/context' {
  interface BrowserCommands {
    collectGarbage: () => Promise<void>;
    heapUsage: () => Promise<number>;
  }
}

/** Run a full garbage collection of the page's isolate. */
export function collectGarbage(): Promise<void> {
  return commands.collectGarbage();
}

/** The used JS heap of the page's isolate, in bytes, after a collection. */
export async function usedHeapAfterGc(): Promise<number> {
  await commands.collectGarbage();
  return commands.heapUsage();
}

/**
 * How many of `refs` still point at something after a full collection. A
 * `WeakRef` keeps its target until the job that dereferenced or created it
 * ends; the command round trip ends it.
 */
export async function aliveAfterGc(refs: WeakRef<object>[]): Promise<number> {
  await commands.collectGarbage();
  return refs.filter(ref => ref.deref() !== undefined).length;
}
