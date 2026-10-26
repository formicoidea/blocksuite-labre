import type { BlockStdScope } from '@labre/std';
import type { BlockSnapshot } from '@labre/store';
import { describe, expect, test } from 'vitest';

import {
  type ClipboardConfigCreationContext,
  EdgelessClipboardConfig,
} from '../extensions/clipboard-config.js';

/**
 * `EdgelessClipboardConfig` gained `prepare` (ADR 0042: a canvas paste
 * prepares every block, then writes them all in one transaction) without
 * breaking a host's own config. A host subclass of the previous shape —
 * `createBlock` only, sync or async — must still compile on a minor bump and
 * still paste, through the default `prepare` that defers to `createBlock`.
 * The two classes below are those literal shapes, typechecked by `yarn build`
 * (tests included); a `prepare` made abstract, or a `createBlock` dropped or
 * narrowed, fails the build here.
 */

class HostSyncConfig extends EdgelessClipboardConfig {
  static override readonly key = 'host:sync';

  override createBlock(snapshot: BlockSnapshot): string | null {
    return `sync-${snapshot.id}`;
  }
}

class HostAsyncConfig extends EdgelessClipboardConfig {
  static override readonly key = 'host:async';

  override async createBlock(
    snapshot: BlockSnapshot,
    context: ClipboardConfigCreationContext
  ): Promise<string | null> {
    return `async-${snapshot.id}-${context.oldToNewIdMap.size}`;
  }
}

const snapshot = {
  type: 'block',
  id: 'a',
  flavour: 'host:block',
  props: {},
  children: [],
} as BlockSnapshot;

const context = (): ClipboardConfigCreationContext => ({
  oldToNewIdMap: new Map(),
  originalIndexes: new Map(),
  newPresentationIndexes: new Map(),
});

describe('a config written before prepare()', () => {
  const std = {} as BlockStdScope;

  test('writes through its createBlock, only when the paste writes', async () => {
    const config = new HostSyncConfig(std);
    const prepared = await config.prepare(snapshot, context());

    expect(prepared?.write()).toBe('sync-a');
    expect(prepared?.afterWrite).toBeUndefined();
  });

  test('an async createBlock still resolves its id, with the live context', async () => {
    const config = new HostAsyncConfig(std);
    const ctx = context();
    const prepared = await config.prepare(snapshot, ctx);
    // The context is filled between preparation and writing (a frame maps
    // its children's new ids then).
    ctx.oldToNewIdMap.set('child', 'new-child');

    expect(await prepared?.write()).toBe('async-a-1');
  });
});
