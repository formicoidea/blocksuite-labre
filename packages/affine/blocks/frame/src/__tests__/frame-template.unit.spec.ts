/**
 * The `FrameTemplateProvider` seam on the frame side: the deletion cascade
 * towards the host, and the toolbar button that exists only with a host.
 *
 * What it would have caught:
 * - a host told about a deletion another peer made (every connected viewer
 *   would report it, the host acting once per viewer) or about a change on a
 *   read-only document;
 * - an undo of the deletion that leaves the host's template in the trash
 *   while its frame is back;
 * - "Save as template" drawn without a host to keep the template, or the
 *   watcher failing to mount without one.
 */
import { FrameBlockModel } from '@labre/affine-model';
import {
  FrameTemplateProvider,
  type FrameTemplateService,
  type ToolbarAction,
  type ToolbarContext,
} from '@labre/affine-shared/services';
import type { BlockStdScope } from '@labre/std';
import { Subject } from 'rxjs';
import { describe, expect, it } from 'vitest';

import { FrameDeletionCascade, FrameTemplateWatcher } from '../frame-template';
import { frameToolbarExtension } from '../frame-toolbar';

function recorder() {
  const calls: string[] = [];
  const service: FrameTemplateService = {
    save: async () => {},
    list: async () => [],
    frameDeleted: ({ docId, frameId }) =>
      calls.push(`deleted ${docId}/${frameId}`),
    frameRestored: ({ docId, frameId }) =>
      calls.push(`restored ${docId}/${frameId}`),
  };
  return { calls, service };
}

const frame = (
  type: 'add' | 'delete' | 'update',
  isLocal: boolean,
  id = 'f1'
) => ({ type, id, flavour: 'affine:frame', isLocal });

describe('FrameDeletionCascade', () => {
  it('reports a local deletion on a writable document', () => {
    const { calls, service } = recorder();
    const cascade = new FrameDeletionCascade(
      { id: 'doc', readonly: false },
      service
    );

    cascade.handle(frame('delete', true));

    expect(calls).toEqual(['deleted doc/f1']);
  });

  it('never reports a deletion that arrives from another peer', () => {
    const { calls, service } = recorder();
    const cascade = new FrameDeletionCascade(
      { id: 'doc', readonly: false },
      service
    );

    cascade.handle(frame('delete', false));

    expect(calls).toEqual([]);
  });

  it('reports nothing on a read-only document', () => {
    const { calls, service } = recorder();
    const cascade = new FrameDeletionCascade(
      { id: 'doc', readonly: true },
      service
    );

    cascade.handle(frame('delete', true));

    expect(calls).toEqual([]);
  });

  it('ignores every other flavour, and every update', () => {
    const { calls, service } = recorder();
    const cascade = new FrameDeletionCascade(
      { id: 'doc', readonly: false },
      service
    );

    cascade.handle({ ...frame('delete', true), flavour: 'affine:note' });
    cascade.handle(frame('update', true));

    expect(calls).toEqual([]);
  });

  it('reports the return of a frame it saw deleted, and only that one', () => {
    const { calls, service } = recorder();
    const cascade = new FrameDeletionCascade(
      { id: 'doc', readonly: false },
      service
    );

    // A frame created now was never reported: nothing to undo at the host.
    cascade.handle(frame('add', true, 'fresh'));
    cascade.handle(frame('delete', true));
    // An add from another peer is that peer's to report, not this viewer's.
    cascade.handle(frame('add', false));
    cascade.handle(frame('add', true));
    // Redone and undone again: one report per gesture.
    cascade.handle(frame('delete', true));
    cascade.handle(frame('add', true));

    expect(calls).toEqual([
      'deleted doc/f1',
      'restored doc/f1',
      'deleted doc/f1',
      'restored doc/f1',
    ]);
  });

  it('works with a host that follows neither notification', () => {
    const cascade = new FrameDeletionCascade(
      { id: 'doc', readonly: false },
      { save: async () => {}, list: async () => [] }
    );

    expect(() => {
      cascade.handle(frame('delete', true));
      cascade.handle(frame('add', true));
    }).not.toThrow();
  });
});

function stdWith(service: FrameTemplateService | null) {
  const blockUpdated = new Subject<ReturnType<typeof frame>>();
  const std = {
    getOptional: (id: unknown) =>
      id === FrameTemplateProvider ? service : null,
    store: { id: 'doc', readonly: false, slots: { blockUpdated } },
  } as unknown as BlockStdScope;
  return { std, blockUpdated };
}

describe('FrameTemplateWatcher', () => {
  it('mounts without a host and listens to nothing', () => {
    const { std, blockUpdated } = stdWith(null);
    const watcher = new FrameTemplateWatcher(std);

    watcher.mounted();

    expect(blockUpdated.observed).toBe(false);
    watcher.unmounted();
  });

  it('forwards the store events to the cascade until unmounted', () => {
    const { calls, service } = recorder();
    const { std, blockUpdated } = stdWith(service);
    const watcher = new FrameTemplateWatcher(std);

    watcher.mounted();
    blockUpdated.next(frame('delete', true));
    watcher.unmounted();
    blockUpdated.next(frame('delete', true, 'f2'));

    expect(calls).toEqual(['deleted doc/f1']);
  });
});

/** The toolbar module's config, read back from the extension's own setup. */
function saveAction(): ToolbarAction {
  let config: { actions: ToolbarAction[] } | undefined;
  frameToolbarExtension.setup({
    addImpl: (_id: unknown, module: { config: typeof config }) => {
      config = module.config;
    },
    override: () => {},
  } as never);
  const action = config?.actions.find(a => a.id === 'b.save-as-template');
  if (!action) throw new Error('no "Save as template" action');
  return action;
}

function toolbarContext(service: FrameTemplateService | null, frames = 1) {
  const model = Object.create(FrameBlockModel.prototype);
  return {
    getSurfaceModelsByType: () => Array.from({ length: frames }, () => model),
    std: {
      getOptional: (id: unknown) =>
        id === FrameTemplateProvider ? service : null,
    },
  } as unknown as ToolbarContext;
}

describe('"Save as template" on the frame toolbar', () => {
  it('is absent without a host', () => {
    const when = saveAction().when as (cx: ToolbarContext) => boolean;

    expect(when(toolbarContext(null))).toBe(false);
  });

  it('is offered with a host, for one frame at a time', () => {
    const when = saveAction().when as (cx: ToolbarContext) => boolean;
    const { service } = recorder();

    expect(when(toolbarContext(service))).toBe(true);
    expect(when(toolbarContext(service, 2))).toBe(false);
  });
});
