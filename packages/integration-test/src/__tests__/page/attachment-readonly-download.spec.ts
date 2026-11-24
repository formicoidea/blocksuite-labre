/**
 * A reader of a read-only document downloads an attachment from its card, on
 * a real editor, in the page and on the canvas (issue #744, ADR 0058). The
 * unit side is `blocks/attachment/src/__tests__/readonly-download.unit.spec.ts`.
 *
 * What it would have caught: a read-only reader with no way to the file (the
 * toolbar that holds Download is never shown on read-only, and the canvas
 * viewer does not mount it, ADR 0051); a button the real mouse cannot reach
 * on the canvas, where the read-only pan tool and the selection listen on the
 * host; a button the keyboard cannot reach or press; a Download that writes
 * to the document; a button drawn on an editable document, which must look
 * as before.
 *
 * The file is never written: the anchor the download path clicks is caught,
 * and its name and blob url are read instead.
 */
import type { EdgelessRootBlockComponent } from '@labre/affine/blocks/root';
import { PanTool } from '@labre/affine/gfx/pointer';
import { Bound } from '@labre/global/gfx';
import { userEvent } from '@vitest/browser/context';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

import { wait } from '../utils/common.js';
import { addNote, getDocRootBlock } from '../utils/edgeless.js';
import { pointerDown, pointerMoveTo, pointerUp } from '../utils/pointer.js';
import { setupEditor } from '../utils/setup.js';

const NAME = 'report.zip';
const BUTTON = '[data-testid="attachment-download"]';
/** Any bytes: the file is never read back. */
const FILE_BYTES = 16;
const FILE = new Uint8Array(FILE_BYTES);
/** A horizontal card on the canvas, at its stored size. */
const CARD = Bound.deserialize('[0,0,752,80]');
/** The middle of the button, as a person aims at it. */
const MIDDLE = 0.5;
/** Where the press starts and ends across the button, as fractions of it. */
const PRESS_FROM = 0.2;
const PRESS_TO = 0.8;

type AttachmentElement = HTMLElement & { blobUrl: string | null };

/** The anchors the download path clicks, caught before the browser saves. */
function catchDownloads() {
  const downloads: { name: string; href: string }[] = [];
  const dispatch = HTMLAnchorElement.prototype.dispatchEvent;
  vi.spyOn(HTMLAnchorElement.prototype, 'dispatchEvent').mockImplementation(
    function (this: HTMLAnchorElement, event: Event) {
      if (!this.download) return dispatch.call(this, event);
      downloads.push({ name: this.download, href: this.href });
      return true;
    }
  );
  return downloads;
}

/** The Yjs updates the document emits from now on. */
function recordUpdates() {
  const updates: Uint8Array[] = [];
  window.doc.spaceDoc.on('update', (update: Uint8Array) =>
    updates.push(update)
  );
  return updates;
}

async function waitForBlob(id: string) {
  return vi.waitFor(() => {
    const element = document.querySelector<AttachmentElement>(
      `[data-block-id="${id}"]`
    );
    if (!element?.blobUrl) throw new Error('no blob url yet');
    return { element, blobUrl: element.blobUrl };
  });
}

function waitForButton(element: HTMLElement) {
  return vi.waitFor(() => {
    const button = element.querySelector<HTMLButtonElement>(BUTTON);
    if (!button) throw new Error('no Download yet');
    return button;
  });
}

/**
 * Presses the button with the real mouse, through every layer above it,
 * sliding across it while pressed: a press the pan tool heard would pan.
 */
async function pressWithMouse() {
  await pointerMoveTo(BUTTON, PRESS_FROM, MIDDLE);
  await pointerDown();
  await pointerMoveTo(BUTTON, PRESS_TO, MIDDLE);
  await pointerUp();
}

afterEach(() => {
  vi.restoreAllMocks();
  window.doc.readonly = false;
});

describe('an attachment in a page', () => {
  let id = '';

  beforeEach(async () => {
    const cleanup = await setupEditor('page');
    const sourceId = await window.doc.blobSync.set(
      new Blob([FILE], { type: 'application/zip' })
    );
    id = window.doc.addBlock(
      'affine:attachment',
      {
        name: NAME,
        size: FILE.length,
        type: 'application/zip',
        sourceId,
        style: 'horizontalThin',
      },
      addNote(window.doc)
    );
    return cleanup;
  });

  test('an editable document draws no Download in the card', async () => {
    const { element } = await waitForBlob(id);
    await wait();

    expect(element.querySelector(BUTTON)).toBeNull();
  });

  test('read-only: the card draws a Download the mouse presses', async () => {
    const { element, blobUrl } = await waitForBlob(id);
    window.doc.readonly = true;
    const button = await waitForButton(element);
    const downloads = catchDownloads();
    const updates = recordUpdates();

    expect(button.getAttribute('aria-label')).toBe(`Download ${NAME}`);
    await pressWithMouse();

    expect(downloads).toEqual([{ name: NAME, href: blobUrl }]);
    expect(updates).toEqual([]);
    expect(window.doc.readonly).toBe(true);
  });

  test('read-only: the keyboard focuses the Download and presses it', async () => {
    const { element, blobUrl } = await waitForBlob(id);
    window.doc.readonly = true;
    const button = await waitForButton(element);
    const downloads = catchDownloads();

    button.focus();
    expect(document.activeElement).toBe(button);
    expect(button.tabIndex).toBe(0);
    await userEvent.keyboard('{Enter}');
    await userEvent.keyboard(' ');

    expect(downloads).toEqual([
      { name: NAME, href: blobUrl },
      { name: NAME, href: blobUrl },
    ]);
  });
});

describe('an attachment on the canvas', () => {
  let id = '';

  beforeEach(async () => {
    const cleanup = await setupEditor('edgeless');
    const service: EdgelessRootBlockComponent['service'] = getDocRootBlock(
      window.doc,
      window.editor,
      'edgeless'
    ).service;
    const sourceId = await window.doc.blobSync.set(
      new Blob([FILE], { type: 'application/zip' })
    );
    id = service.crud.addBlock(
      'affine:attachment',
      {
        name: NAME,
        size: FILE.length,
        type: 'application/zip',
        sourceId,
        style: 'horizontalThin',
        xywh: CARD.serialize(),
        index: service.generateIndex(),
      },
      service.surface.id
    );
    service.viewport.setCenter(...CARD.center);
    await wait();
    return cleanup;
  });

  test('an editable canvas draws no Download in the card', async () => {
    const { element } = await waitForBlob(id);
    await wait();

    expect(element.querySelector(BUTTON)).toBeNull();
  });

  test('read-only: the mouse reaches the Download under the pan tool', async () => {
    const { element, blobUrl } = await waitForBlob(id);
    window.doc.readonly = true;
    // What the edgeless root picks when it mounts on a read-only store, as
    // the canvas viewer does (ADR 0051): a press there starts a pan.
    const { gfx } = getDocRootBlock(window.doc, window.editor, 'edgeless');
    gfx.tool.setTool(PanTool, { panning: true });
    expect(gfx.tool.currentToolName$.peek()).toBe('pan');
    const { centerX, centerY } = gfx.viewport;
    await waitForButton(element);
    await wait();
    const downloads = catchDownloads();
    const updates = recordUpdates();

    await pressWithMouse();

    expect(downloads).toEqual([{ name: NAME, href: blobUrl }]);
    expect(updates).toEqual([]);
    // The press never reached the pan tool: the canvas did not move.
    expect([gfx.viewport.centerX, gfx.viewport.centerY]).toEqual([
      centerX,
      centerY,
    ]);
  });
});
