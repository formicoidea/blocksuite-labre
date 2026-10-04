/**
 * The canvas grid as a setting (ADR 0031, stage 4), on a real editor.
 *
 * The grid used to be a `radial-gradient` nobody could turn off. What only a
 * mounted editor can answer, and this spec checks:
 *
 * - `canvas.grid.toggle` removes the painted grid from the edgeless
 *   background for this viewer, writes ZERO Yjs update, and is remembered for
 *   this document in `localStorage`;
 * - `canvas.grid.saveForEveryone` stores `showGrid` on the surface and a
 *   second client receiving the update sees it; a peer's saved setting
 *   reaching this client repaints its grid;
 * - the host default (`edgelessShowGrid`) applies when nobody else decided.
 *
 * The library has no page "more" menu, so the commands are the grid's whole
 * in-library UI and the spec drives them as the palette does.
 */
import type { EdgelessRootBlockComponent } from '@labre/affine/blocks/root';
import { EditorSettingExtension } from '@labre/affine/shared/services';
import { getRegisteredCommands, runCommand } from '@labre/affine/std';
import { signal } from '@preact/signals-core';
import { afterEach, describe, expect, test } from 'vitest';
import * as Y from 'yjs';

import { wait } from '../utils/common.js';
import { getDocRootBlock, getSurface } from '../utils/edgeless.js';
import { setupEditor } from '../utils/setup.js';

describe('the canvas grid', () => {
  let edgeless!: EdgelessRootBlockComponent;
  let unmount: (() => void) | undefined;

  const mount = async (extensions: Parameters<typeof setupEditor>[1] = []) => {
    unmount = await setupEditor('edgeless', extensions);
    edgeless = getDocRootBlock(window.doc, window.editor, 'edgeless');
    edgeless.std.event.active = true;
    await wait(50);
  };

  afterEach(() => {
    unmount?.();
    unmount = undefined;
    localStorage.clear();
  });

  const run = async (id: string) => {
    const command = getRegisteredCommands(edgeless.std).find(c => c.id === id);
    expect(command, id).toBeDefined();
    runCommand(edgeless.std, command!, {
      surface: 'palette',
      source: 'shortcut',
    });
    await edgeless.updateComplete;
    await wait(50);
  };

  /** What the edgeless background actually paints. */
  const paintsGrid = () => {
    const background = edgeless.querySelector('.edgeless-background')!;
    return getComputedStyle(background).backgroundImage.includes('gradient');
  };

  const spaceDoc = () => window.doc.doc.spaceDoc;
  const surfaceId = () => getSurface(window.doc, window.editor).model.id;

  test('the toggle is this viewer’s, and writes nothing', async () => {
    await mount();
    expect(paintsGrid()).toBe(true);
    const updates: Uint8Array[] = [];
    spaceDoc().on('update', (update: Uint8Array) => updates.push(update));

    await run('canvas.grid.toggle');

    expect(paintsGrid()).toBe(false);
    expect(updates).toHaveLength(0);
    expect(
      localStorage.getItem(`blocksuite:${window.doc.id}:localShowGrid`)
    ).toBe('false');

    await run('canvas.grid.toggle');
    expect(paintsGrid()).toBe(true);
  });

  test('save for everyone reaches a second client; theirs reaches us', async () => {
    await mount();
    // A second client holding the same document.
    const peer = new Y.Doc();
    Y.applyUpdate(peer, Y.encodeStateAsUpdate(spaceDoc()));
    spaceDoc().on('update', (update: Uint8Array, origin: unknown) => {
      if (origin !== 'peer') Y.applyUpdate(peer, update, 'author');
    });
    const peerSurface = () =>
      peer.getMap<Y.Map<unknown>>('blocks').get(surfaceId())!;

    await run('canvas.grid.toggle');
    await run('canvas.grid.saveForEveryone');

    expect(peerSurface().get('prop:showGrid')).toBe(false);
    // The saver's override is gone: they see what everyone sees.
    expect(
      localStorage.getItem(`blocksuite:${window.doc.id}:localShowGrid`)
    ).toBeNull();
    expect(paintsGrid()).toBe(false);

    // The peer turns it back on for everyone; this client repaints.
    const before = Y.encodeStateVector(peer);
    peerSurface().set('prop:showGrid', true);
    Y.applyUpdate(spaceDoc(), Y.encodeStateAsUpdate(peer, before), 'peer');
    await edgeless.updateComplete;
    await wait(50);

    expect(paintsGrid()).toBe(true);
  });

  test('the host default applies when nobody else decided', async () => {
    await mount([
      EditorSettingExtension({ setting$: signal({ edgelessShowGrid: false }) }),
    ]);
    expect(paintsGrid()).toBe(false);

    await run('canvas.grid.toggle');
    expect(paintsGrid()).toBe(true);
  });
});
