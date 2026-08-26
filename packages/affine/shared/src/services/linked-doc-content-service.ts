import { createIdentifier } from '@labre/global/di';
import type { BlockStdScope } from '@labre/std';
import type { ExtensionType } from '@labre/store';

/**
 * Host seam for hydrating a linked doc's content on demand. An app that does not
 * preload its whole corpus into the workspace (so a referenced doc has no
 * content in memory) implements this to fetch/load that doc when its
 * preview/embed needs it.
 */
export interface LinkedDocContentResolver {
  /**
   * Load the referenced doc's content into the workspace. May resolve before
   * the content actually arrives — the preview also watches for the doc's root
   * and is bounded by {@link LinkedDocContentResolver.timeoutMs}.
   */
  resolve: (docId: string) => void | Promise<void>;
  /** Max time the preview waits for content before degrading. Default 8000ms. */
  timeoutMs?: number;
}

export const LinkedDocContentResolverIdentifier =
  createIdentifier<LinkedDocContentResolver>('AffineLinkedDocContentResolver');

/** Inject a host {@link LinkedDocContentResolver}. */
export function LinkedDocContentResolverExtension(
  resolver: LinkedDocContentResolver
): ExtensionType {
  return {
    setup: di => {
      di.override(LinkedDocContentResolverIdentifier, () => resolver);
    },
  };
}

export const DEFAULT_LINKED_DOC_CONTENT_TIMEOUT_MS = 8000;

/** Minimal shape of a loadable doc store the preview waits on. */
interface AwaitableDoc {
  root: object | null;
  slots: {
    rootAdded: { subscribe: (cb: () => void) => { unsubscribe: () => void } };
  };
}

/**
 * Resolve a linked doc's content for preview, **bounded in time**. If a host
 * {@link LinkedDocContentResolver} is registered it is asked to hydrate the doc
 * first. Returns `true` once the doc has a root (content available), or `false`
 * if it timed out — in which case the caller should render a degraded preview
 * (title only) instead of spinning forever.
 */
export async function whenLinkedDocContentReady(
  std: BlockStdScope,
  doc: AwaitableDoc,
  docId: string
): Promise<boolean> {
  if (doc.root) return true;

  const resolver = std.getOptional(LinkedDocContentResolverIdentifier);
  if (resolver) {
    try {
      await resolver.resolve(docId);
    } catch (e) {
      console.error(e);
    }
    if (doc.root) return true;
  }

  const timeoutMs =
    resolver?.timeoutMs ?? DEFAULT_LINKED_DOC_CONTENT_TIMEOUT_MS;
  return new Promise<boolean>(resolve => {
    let settled = false;
    const finish = (ready: boolean) => {
      if (settled) return;
      settled = true;
      subscription.unsubscribe();
      clearTimeout(timer);
      resolve(ready);
    };
    const subscription = doc.slots.rootAdded.subscribe(() => finish(true));
    const timer = setTimeout(() => finish(false), timeoutMs);
  });
}
