/**
 * « Replace » on a real editor, with the real mouse (ADR 0044, amendment of
 * 2026-11-04). The host's dialog is a fake that answers one reference.
 *
 * What it would have caught:
 * - a file card with no « Replace » menu on the canvas, or one that a press does not
 *   reach;
 * - a picture arriving at its own size, not in the frame of the card it replaces;
 * - a card stretched by a frame of other proportions, instead of contained in it;
 * - an image's button in a page that opens no dialog.
 */
import {
  AssetPickerExtension,
  type AssetRef,
} from '@labre/affine/shared/services';
import { afterEach, describe, expect, test, vi } from 'vitest';

import { wait } from '../utils/common.js';
import { addNote, getSurface } from '../utils/edgeless.js';
import { pointerDown, pointerMoveTo, pointerUp } from '../utils/pointer.js';
import { setupEditor } from '../utils/setup.js';

const SETTLE_MS = 300;
const PRESS_MS = 80;
const WAIT_STEP_MS = 50;
const WAIT_LIMIT_MS = 3000;
const MIDDLE = 0.5;
// Far from a card's proportions, so that a stretched card shows.
const FRAME = '[0,0,752,200]';
const RATIO_MARGIN = 0.01;

const PICTURE: AssetRef = {
  sourceId: 'picture',
  name: 'p.png',
  type: 'image/png',
  size: 9,
  width: 400,
  height: 400,
};

const TOOLBAR = 'affine-toolbar-widget editor-toolbar';

async function press(selector: string) {
  await pointerMoveTo(selector, MIDDLE, MIDDLE);
  await pointerDown();
  await wait(PRESS_MS);
  await pointerUp();
  await wait(SETTLE_MS);
}

const inToolbar = (selector: string) =>
  document
    .querySelector('affine-toolbar-widget')
    ?.shadowRoot?.querySelector<HTMLElement>(`editor-toolbar ${selector}`) ??
  null;

async function waitForToolbar(selector: string) {
  const start = Date.now();
  while (!inToolbar(selector) && Date.now() - start < WAIT_LIMIT_MS) {
    await wait(WAIT_STEP_MS);
  }
  return inToolbar(selector);
}

describe('« Replace »', () => {
  let cleanup: () => void = () => undefined;

  afterEach(() => {
    cleanup();
    cleanup = () => undefined;
  });

  test('a file on the canvas takes a picture in its frame, from its own menu', async () => {
    const pick = vi.fn(async () => [PICTURE]);
    cleanup = await setupEditor('edgeless', [AssetPickerExtension({ pick })]);
    const surface = getSurface(window.doc, window.editor).model.id;
    const id = window.doc.addBlock(
      'affine:attachment',
      {
        name: 'a.pdf',
        size: 1,
        type: 'application/pdf',
        sourceId: 'file',
        xywh: FRAME,
        style: 'cubeThick',
      },
      surface
    );
    await wait(SETTLE_MS);

    // Contained, not stretched: the card keeps its own proportions in the frame.
    const card = document.querySelector<HTMLElement>(
      'affine-edgeless-attachment .affine-attachment-card'
    );
    expect(card).toBeTruthy();
    const box = card?.getBoundingClientRect();
    const drawn = (box?.width ?? 0) / (box?.height ?? 1);
    const own = (card?.offsetWidth ?? 0) / (card?.offsetHeight ?? 1);
    expect(Math.abs(drawn - own)).toBeLessThan(RATIO_MARGIN);

    await press('affine-edgeless-attachment');
    // The button itself is in the menu's own shadow root; a press pierces it.
    expect(
      await waitForToolbar('[data-testid="image-replace-menu"]')
    ).toBeTruthy();
    await press(`${TOOLBAR} [data-testid="image-replace-button"]`);
    await press(`${TOOLBAR} [data-testid="image-replace-with-image"]`);
    await wait(SETTLE_MS);

    expect(pick).toHaveBeenCalledWith(
      expect.objectContaining({ kind: 'file', mode: 'replace' })
    );
    expect(window.doc.hasBlock(id)).toBe(false);
    const [image] = window.doc.getBlocksByFlavour('affine:image');
    expect((image?.model.props as { xywh: string }).xywh).toBe(FRAME);
    expect((image?.model.props as { crop?: unknown }).crop).toBeTruthy();
  });

  test('an image in a page opens the dialog, and takes a file at its place', async () => {
    const pick = vi.fn(async () => [
      { sourceId: 'pdf', name: 'a.pdf', type: 'application/pdf', size: 3 },
    ]);
    cleanup = await setupEditor('page', [AssetPickerExtension({ pick })]);
    const note = addNote(window.doc);
    const id = window.doc.addBlock(
      'affine:image',
      { sourceId: 'p', size: 1, width: 300, height: 150 },
      note
    );
    await wait(SETTLE_MS);

    await press('affine-image');
    expect(await waitForToolbar('[aria-label="Replace"]')).toBeTruthy();
    await press(`${TOOLBAR} [aria-label="Replace"]`);
    await wait(SETTLE_MS);

    expect(pick).toHaveBeenCalledWith(
      expect.objectContaining({ kind: 'image', mode: 'replace' })
    );
    expect(window.doc.hasBlock(id)).toBe(false);
    const [file] = window.doc.getBlocksByFlavour('affine:attachment');
    expect(file?.model.parent?.id).toBe(note);
  });
});
