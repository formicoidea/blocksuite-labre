/**
 * Drag and drop in the frame panel, with a real pointer pressed, moved in
 * steps and released (`../utils/pointer.ts`), so the gesture can be watched
 * while it happens.
 *
 * Why it exists: the frame panel's drag was its own (`utils/drag.ts`, mouse
 * events) and drifted from the selection pane's — no read-only refusal, no way
 * to cancel, and a drop after the last card drew its line at the top of the
 * list. Both panels now run on the side panels' one controller
 * (`createPanelReorderDrag`, ADR 0034); this spec pins what the frame panel
 * shows and writes with it: a ghost and a line between two cards, the line
 * UNDER the last card for a drop at the end, one undo step per reorder, the
 * selected cards moving together, nothing offered on a read-only document,
 * Escape cancelling, and a nudge under 5px staying a click.
 *
 * The panel is mounted on its own, 320px wide, as a host docks it. Frame
 * previews are mini editors: three frames, and generous settling.
 */
import type { EdgelessRootBlockComponent } from '@labre/affine/blocks/root';
import type { FramePanel } from '@labre/affine/fragments/frame-panel';
import type { FrameBlockModel } from '@labre/affine/model';
import { generateKeyBetweenV2 } from '@labre/affine/std/gfx';
import { Text } from '@labre/store';
import { userEvent } from '@vitest/browser/context';
import { beforeEach, describe, expect, test } from 'vitest';

import { wait } from '../utils/common.js';
import { getDocRootBlock } from '../utils/edgeless.js';
import { pointerDown, pointerMoveTo, pointerUp } from '../utils/pointer.js';
import { setupEditor } from '../utils/setup.js';

const cardSelector = (id: string) =>
  `affine-frame-card[data-frame-id="${id}"] .frame-card-body`;

describe('frame panel drag and drop', () => {
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

  /** Three frames with explicit, chained presentation keys: a, b, c. */
  const addFrames = async (): Promise<[string, string, string]> => {
    let key: string | null = null;
    const ids = [0, 1, 2].map(i => {
      key = generateKeyBetweenV2(key, null);
      return edgeless.service.crud.addBlock(
        'affine:frame',
        {
          xywh: `[${i * 400},0,300,300]`,
          title: new Text(`Frame ${i + 1}`),
          presentationIndex: key,
        },
        edgeless.service.surface.id
      );
    });
    await wait(100);
    return ids as [string, string, string];
  };

  /** The frames in presentation order. */
  const order = () =>
    window.doc
      .getBlocksByFlavour('affine:frame')
      .map(block => block.model as FrameBlockModel)
      .sort((x, y) =>
        x.props.presentationIndex! < y.props.presentationIndex! ? -1 : 1
      )
      .map(frame => frame.id);

  const mount = async () => {
    container = document.createElement('div');
    Object.assign(container.style, {
      position: 'fixed',
      top: '0',
      right: '0',
      width: '320px',
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
  const ghost = () =>
    document.querySelector<HTMLElement>(
      '[data-testid="frame-panel-drag-ghost"]'
    );
  const line = () =>
    document.querySelector<HTMLElement>(
      '[data-testid="frame-panel-drop-indicator"]'
    );
  const mask = () =>
    document.querySelector<HTMLElement>(
      '[data-testid="frame-panel-drag-mask"]'
    );
  const selected = (id: string) =>
    card(id)
      .querySelector('.frame-card-container')!
      .classList.contains('selected');

  const grab = async (id: string) => {
    await pointerMoveTo(cardSelector(id), 0.5, 0.5, 1);
    await pointerDown();
    await pointerMoveTo(cardSelector(id), 0.5, 0.75, 3);
    await settle();
  };

  const moveTo = async (id: string, fy: number) => {
    await pointerMoveTo(cardSelector(id), 0.5, fy, 6);
    await settle();
  };

  const release = async () => {
    await pointerUp();
    await settle();
  };

  /** Yjs updates written from now on. */
  const recordUpdates = () => {
    const updates: Uint8Array[] = [];
    window.doc.doc.spaceDoc.on('update', (update: Uint8Array) =>
      updates.push(update)
    );
    return updates;
  };

  /** A plain or shift click on a card, as its body's click handler sees it. */
  const click = (id: string, shiftKey = false) =>
    card(id)
      .querySelector('.frame-card-body')!
      .dispatchEvent(new MouseEvent('click', { bubbles: true, shiftKey }));

  const near = (a: number, b: number) => Math.abs(a - b) <= 3;

  test('a ghost follows the pointer, a line marks the gap between two cards', async () => {
    const [a, b, c] = await addFrames();
    await mount();
    expect(order()).toEqual([a, b, c]);

    await grab(a);
    await moveTo(c, 0.2);

    expect(ghost(), 'the dragged card follows the pointer').toBeTruthy();
    expect(mask()?.style.cursor).toBe('grabbing');
    expect(line(), 'a line marks the gap').toBeTruthy();
    const between =
      (card(b).getBoundingClientRect().bottom +
        card(c).getBoundingClientRect().top) /
      2;
    expect(near(line()!.getBoundingClientRect().top, between)).toBe(true);

    await release();
    expect(ghost()).toBeNull();
    expect(line()).toBeNull();
    expect(mask()).toBeNull();
    expect(order()).toEqual([b, a, c]);
  });

  test('dropped under the last card, the line is under it and the frame goes last', async () => {
    const [a, b, c] = await addFrames();
    await mount();

    await grab(a);
    await moveTo(c, 0.95);
    const bottom = card(c).getBoundingClientRect().bottom;
    const top = line()!.getBoundingClientRect().top;
    expect(top, 'the line is under the last card, not at 0').toBeGreaterThan(
      bottom
    );
    expect(near(top, bottom + 8)).toBe(true);

    await release();
    expect(order()).toEqual([b, c, a]);
  });

  test('a reorder is one undo step', async () => {
    const [a, b, c] = await addFrames();
    await mount();
    edgeless.std.store.resetHistory();

    await grab(c);
    await moveTo(a, 0.2);
    await release();
    expect(order()).toEqual([c, a, b]);

    edgeless.std.store.undo();
    await settle();
    expect(order()).toEqual([a, b, c]);
    expect(edgeless.std.store.canUndo).toBe(false);
  });

  test('two selected cards move together and keep their order', async () => {
    const [a, b, c] = await addFrames();
    await mount();
    click(a);
    click(c, true);
    await settle();
    expect(selected(a) && selected(c)).toBe(true);

    await grab(c);
    expect(
      ghost()?.querySelector('.dragging-card-number')?.textContent?.trim()
    ).toBe('2');
    await moveTo(a, 0.2);
    await release();

    expect(order()).toEqual([a, c, b]);
  });

  test('a read-only document offers no drag and writes nothing', async () => {
    const [a, b, c] = await addFrames();
    edgeless.std.store.readonly = true;
    await mount();
    const updates = recordUpdates();

    await grab(a);
    await moveTo(c, 0.95);
    expect(ghost()).toBeNull();
    expect(line()).toBeNull();
    expect(mask()).toBeNull();
    await release();

    expect(updates).toHaveLength(0);
    expect(order()).toEqual([a, b, c]);
  });

  test('Escape cancels: ghost, line and mask gone, the release writes nothing', async () => {
    const [a, b, c] = await addFrames();
    await mount();
    const updates = recordUpdates();

    await grab(a);
    await moveTo(c, 0.95);
    expect(line()).toBeTruthy();
    await userEvent.keyboard('{Escape}');
    await settle();
    expect(ghost()).toBeNull();
    expect(line()).toBeNull();
    expect(mask()).toBeNull();

    await release();
    expect(updates).toHaveLength(0);
    expect(order()).toEqual([a, b, c]);
  });

  test('a nudge under five pixels is a click: the card is selected, no ghost', async () => {
    const [a] = await addFrames();
    await mount();
    expect(selected(a)).toBe(false);

    const { width, height } = card(a)
      .querySelector('.frame-card-body')!
      .getBoundingClientRect();
    await pointerMoveTo(cardSelector(a), 0.5, 0.5, 1);
    await pointerDown();
    await pointerMoveTo(
      cardSelector(a),
      0.5 + 3.5 / width,
      0.5 + 3.5 / height,
      2
    );
    await settle();
    expect(
      ghost(),
      'under five pixels a side does not start a drag'
    ).toBeNull();
    await release();

    expect(selected(a)).toBe(true);
  });
});
