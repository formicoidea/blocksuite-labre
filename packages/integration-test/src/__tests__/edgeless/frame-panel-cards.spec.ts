/**
 * The frame panel's cards: their size, their name, their double-click.
 *
 * Why it exists: at recette 1 (P0-1.2, P0-1.4, P0-1.6) the product owner
 * asked for three things the cards did not do or did not guarantee.
 *
 * - A card was 284 × 170 whatever the panel's width: a wider sidebar left an
 *   empty strip beside every thumbnail. A card now takes the panel's width
 *   and its preview the frame's proportions, and follows the panel when it is
 *   resized — wider panel, bigger cards, fewer on screen.
 * - The name was a rich text bound live to the stored title: every key wrote,
 *   and Escape could not take a keystroke back. A double-click now opens a
 *   field committed once through `canvas.frame.rename`: Enter saves in one
 *   undo step, Escape and an unchanged name write nothing, a read-only
 *   document opens no field.
 * - A double-click on a preview frames it on the canvas; kept on purpose.
 *
 * The panel is mounted on its own, as a host docks it, in a box whose width
 * the test changes.
 */
import type { EdgelessRootBlockComponent } from '@labre/affine/blocks/root';
import type { FramePanel } from '@labre/affine/fragments/frame-panel';
import type { FrameBlockModel } from '@labre/affine/model';
import { Bound } from '@labre/global/gfx';
import { generateKeyBetweenV2 } from '@labre/affine/std/gfx';
import { Text } from '@labre/store';
import { userEvent } from '@vitest/browser/context';
import { beforeEach, describe, expect, test } from 'vitest';

import { wait } from '../utils/common.js';
import { getDocRootBlock } from '../utils/edgeless.js';
import { setupEditor } from '../utils/setup.js';

describe('frame panel cards', () => {
  let edgeless!: EdgelessRootBlockComponent;
  let container: HTMLElement | null = null;
  let panel!: FramePanel;

  beforeEach(async () => {
    const cleanup = await setupEditor('edgeless');
    edgeless = getDocRootBlock(window.doc, window.editor, 'edgeless');
    edgeless.std.event.active = true;
    return () => {
      container?.remove();
      container = null;
      cleanup();
    };
  });

  const settle = async () => {
    await panel?.updateComplete;
    await wait(150);
  };

  /** Two 16:9 frames, in presentation order. */
  const addFrames = async (): Promise<[string, string]> => {
    let key: string | null = null;
    const ids = [0, 1].map(i => {
      key = generateKeyBetweenV2(key, null);
      return edgeless.service.crud.addBlock(
        'affine:frame',
        {
          xywh: `[${i * 500},0,400,225]`,
          title: new Text(`Frame ${i + 1}`),
          presentationIndex: key,
        },
        edgeless.service.surface.id
      );
    });
    await wait(100);
    return ids as [string, string];
  };

  const mount = async (width: number) => {
    container = document.createElement('div');
    Object.assign(container.style, {
      position: 'fixed',
      top: '0',
      right: '0',
      width: `${width}px`,
      height: '760px',
      zIndex: '1000',
      background: 'white',
    });
    panel = document.createElement('affine-frame-panel') as FramePanel;
    panel.host = window.editor.host!;
    container.append(panel);
    document.body.append(container);
    await settle();
    await wait(300);
  };

  const card = (id: string) =>
    panel.querySelector<HTMLElement>(
      `affine-frame-card[data-frame-id="${id}"]`
    )!;
  const preview = (id: string) =>
    card(id)
      .querySelector<HTMLElement>('frame-preview')!
      .getBoundingClientRect();
  const frame = (id: string) =>
    window.doc.getBlock(id)!.model as FrameBlockModel;
  const titleOf = (id: string) => frame(id).props.title.toString();
  const nameField = (id: string) =>
    card(id).querySelector<HTMLInputElement>(
      '[data-testid="frame-card-title-input"]'
    );

  const recordUpdates = () => {
    const updates: Uint8Array[] = [];
    window.doc.doc.spaceDoc.on('update', (update: Uint8Array) =>
      updates.push(update)
    );
    return updates;
  };

  const startRename = async (id: string) => {
    await userEvent.dblClick(
      card(id).querySelector<HTMLElement>('[data-testid="frame-card-title"]')!
    );
    await settle();
  };

  test('a card takes the panel width and the frame proportions, and follows a resize', async () => {
    const [a, b] = await addFrames();
    await mount(320);

    const panelWidth = panel.getBoundingClientRect().width;
    const narrow = preview(a);
    expect(narrow.width, 'no empty strip beside the card').toBeGreaterThan(
      panelWidth - 48
    );
    expect(narrow.height / narrow.width).toBeCloseTo(225 / 400, 1);

    container!.style.width = '520px';
    await settle();
    const wide = preview(a);
    expect(wide.width - narrow.width).toBeGreaterThan(190);
    expect(wide.height / wide.width).toBeCloseTo(225 / 400, 1);
    expect(preview(b).width).toBeCloseTo(wide.width, 0);
  });

  test('a double-click on the name renames the frame: Enter saves, in one undo step', async () => {
    const [a] = await addFrames();
    await mount(320);
    edgeless.std.store.resetHistory();

    await startRename(a);
    const field = nameField(a);
    expect(field, 'the name became a field').toBeTruthy();
    expect(document.activeElement).toBe(field);
    expect(titleOf(a), 'nothing written while typing').toBe('Frame 1');

    await userEvent.keyboard('Intro{Enter}');
    await settle();
    expect(titleOf(a)).toBe('Intro');
    expect(nameField(a)).toBeNull();
    expect(
      card(a).querySelector('[data-testid="frame-card-title"]')?.textContent
    ).toContain('Intro');

    edgeless.std.store.undo();
    await settle();
    expect(titleOf(a)).toBe('Frame 1');
    expect(edgeless.std.store.canUndo).toBe(false);
  });

  test('Escape cancels the rename and writes nothing', async () => {
    const [a] = await addFrames();
    await mount(320);
    const updates = recordUpdates();

    await startRename(a);
    await userEvent.keyboard('Intro{Escape}');
    await settle();

    expect(nameField(a)).toBeNull();
    expect(titleOf(a)).toBe('Frame 1');
    expect(updates).toHaveLength(0);
  });

  test('an unchanged name writes nothing', async () => {
    const [a] = await addFrames();
    await mount(320);
    const updates = recordUpdates();

    await startRename(a);
    await userEvent.keyboard('{Enter}');
    await settle();

    expect(nameField(a)).toBeNull();
    expect(updates).toHaveLength(0);
  });

  test('a read-only document opens no field', async () => {
    const [a] = await addFrames();
    edgeless.std.store.readonly = true;
    await mount(320);

    await startRename(a);
    expect(nameField(a)).toBeNull();
  });

  test('a double-click on a preview frames it on the canvas', async () => {
    const [, b] = await addFrames();
    await mount(320);
    const viewport = edgeless.gfx.viewport;
    viewport.setViewport(1, [-2000, -2000], false);
    await settle();
    expect(
      viewport.viewportBounds.contains(Bound.deserialize(frame(b).xywh))
    ).toBe(false);

    await userEvent.dblClick(
      card(b).querySelector<HTMLElement>('.frame-card-body')!
    );
    await wait(600);

    expect(
      viewport.viewportBounds.contains(Bound.deserialize(frame(b).xywh))
    ).toBe(true);
  });
});
