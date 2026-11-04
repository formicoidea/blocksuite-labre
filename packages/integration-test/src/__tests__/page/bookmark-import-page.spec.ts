/**
 * The import button of a link card and the retired html block, on a real editor, in
 * a page and on the canvas, with the real mouse (ADR 0048, amendment of 2026-11-04).
 * The host's half is a fake; the app's recette holds the real one.
 *
 * What it would have caught:
 * - a button that does not show, or shows without the host's extension;
 * - a first press on a card of an unfocused editor that closes the toolbar it opened:
 *   the focus the selection takes puts a caret in the document's first text, whose
 *   `selectionchange` then replaces the block's selection;
 * - a toolbar whose button a press does not reach;
 * - no feedback while the host reads the page, or a second import on a second press;
 * - a view that does not take the card's place, in a page or on the canvas;
 * - a stored html block that runs its html, draws a frame, or takes the page down
 *   with it, in a page or on the canvas.
 */
import type { HtmlFrame } from '@labre/affine/components/html-frame';
import {
  HtmlFileConfigExtension,
  type HtmlPageImport,
} from '@labre/affine/shared/services';
import { Bound } from '@labre/global/gfx';
import { afterEach, describe, expect, test, vi } from 'vitest';

import { wait } from '../utils/common.js';
import { addNote, getSurface } from '../utils/edgeless.js';
import { pointerDown, pointerMoveTo, pointerUp } from '../utils/pointer.js';
import { setupEditor } from '../utils/setup.js';

const PAGE = new URL('./html-frame-page.html', import.meta.url).href;
const URL_OF_CARD = 'https://example.com/report';
const FILE = '<!doctype html><p>a report</p>';
const SETTLE_MS = 300;
const PRESS_MS = 80;
const LONG_SETTLE_MS = 900;
const MIDDLE = 0.5;
const TWICE = 2;
const PAGE_CARD_MAX_HEIGHT = 120;

const BUTTON = '[data-testid="bookmark-import-page"]';

const WAIT_STEP_MS = 50;
const WAIT_LIMIT_MS = 3000;

const toolbar = () =>
  document
    .querySelector('affine-toolbar-widget')
    ?.shadowRoot?.querySelector('editor-toolbar');

/** The button lives in the toolbar widget's shadow root. The toolbar stays in the DOM
 *  when closed, so a button only counts once it has a box. */
function importButton() {
  return toolbar()?.hasAttribute('data-open')
    ? (toolbar()?.querySelector<HTMLElement & { disabled: boolean }>(BUTTON) ??
        null)
    : null;
}

async function waitForButton() {
  const start = Date.now();
  while (!importButton() && Date.now() - start < WAIT_LIMIT_MS) {
    await wait(WAIT_STEP_MS);
  }
  return importButton();
}

/** A reader's press takes time: with none, the browser's `selectionchange` arrives
 *  after the click and takes the block's selection back. */
async function press(selector: string) {
  await pointerMoveTo(selector, MIDDLE, MIDDLE);
  await pointerDown();
  await wait(PRESS_MS);
  await pointerUp();
  await wait(SETTLE_MS);
}

async function storedFile() {
  const sourceId = await window.doc.blobSync.set(
    new File([FILE], 'report.html', { type: 'text/html' })
  );
  return {
    sourceId,
    name: 'report.html',
    type: 'text/html',
    size: FILE.length,
  };
}

const pageCard = () => {
  const note = addNote(window.doc);
  return window.doc.addBlock(
    'affine:bookmark',
    { url: URL_OF_CARD, style: 'horizontal', title: 't', description: 'd' },
    note
  );
};

const canvasCard = () =>
  window.doc.addBlock(
    'affine:bookmark',
    {
      url: URL_OF_CARD,
      style: 'horizontal',
      title: 't',
      description: 'd',
      xywh: '[0,0,450,100]',
    },
    getSurface(window.doc, window.editor).model.id
  );

describe('the import button of a link card', () => {
  let cleanup: () => void = () => undefined;

  afterEach(() => {
    cleanup();
    cleanup = () => undefined;
  });

  test('without the host it does not exist', async () => {
    cleanup = await setupEditor('page');
    pageCard();
    await wait(SETTLE_MS);
    await press('affine-bookmark .affine-bookmark-card');
    // The toolbar did open: the card's other actions are there.
    expect(toolbar()?.hasAttribute('data-open')).toBe(true);
    expect(toolbar()?.querySelector('affine-link-preview')).toBeTruthy();
    expect(toolbar()?.querySelector(BUTTON)).toBeNull();
  });

  test("in a page, a press gives the view at the card's place", async () => {
    let answer: (value: HtmlPageImport) => void = () => undefined;
    const importer = vi.fn(
      () =>
        new Promise<HtmlPageImport>(resolve => {
          answer = resolve;
        })
    );
    cleanup = await setupEditor('page', [
      HtmlFileConfigExtension({ frameUrl: PAGE, importPage: importer }),
    ]);
    const id = pageCard();
    const asset = await storedFile();
    await wait(SETTLE_MS);

    await press('affine-bookmark .affine-bookmark-card');
    const button = await waitForButton();
    expect(button).toBeTruthy();

    await press(BUTTON);
    expect(importer).toHaveBeenCalledTimes(1);
    expect(importer).toHaveBeenCalledWith({
      url: URL_OF_CARD,
      docId: window.doc.id,
    });
    // Waiting: the button is disabled, the card is still there.
    expect(button?.disabled).toBe(true);
    expect(button?.querySelector('svg .spinner')).toBeTruthy();
    expect(window.doc.hasBlock(id)).toBe(true);
    await press(BUTTON);
    expect(importer).toHaveBeenCalledTimes(1);

    answer({ status: 'imported', asset });
    await wait(SETTLE_MS);

    expect(window.doc.hasBlock(id)).toBe(false);
    const view = document.querySelector('affine-attachment-html-view');
    expect(view).toBeTruthy();
    const frame = view?.shadowRoot?.querySelector(
      'labre-html-frame'
    ) as HtmlFrame;
    expect(frame.iframe?.getAttribute('src')).toBe(PAGE);
    expect(frame.scripts).toBe(false);
  });

  test("on the canvas, a press gives the view around the card's centre", async () => {
    const asset = { sourceId: '', name: '', type: '', size: 0 };
    cleanup = await setupEditor('edgeless', [
      HtmlFileConfigExtension({
        frameUrl: PAGE,
        importPage: async () => ({ status: 'imported', asset }),
      }),
    ]);
    Object.assign(asset, await storedFile());
    const id = canvasCard();
    const before = Bound.deserialize(
      (window.doc.getModelById(id) as unknown as { xywh: string }).xywh
    ).center;
    await wait(SETTLE_MS);

    await pointerMoveTo('affine-edgeless-bookmark', MIDDLE, MIDDLE);
    await pointerDown();
    await pointerUp();
    expect(await waitForButton()).toBeTruthy();

    await press(BUTTON);
    await wait(SETTLE_MS);

    expect(window.doc.hasBlock(id)).toBe(false);
    const [created] = window.doc.getBlocksByFlavour('affine:attachment');
    const after = Bound.deserialize(
      (created?.model as unknown as { xywh: string }).xywh
    ).center;
    expect(after).toEqual(before);
    expect(document.querySelector('affine-attachment-html-view')).toBeTruthy();
  });

  test('a refusal keeps the card and answers another press', async () => {
    const importer = vi.fn(
      async (): Promise<HtmlPageImport> => ({
        status: 'refused',
        message: 'unreadable',
      })
    );
    cleanup = await setupEditor('page', [
      HtmlFileConfigExtension({ frameUrl: PAGE, importPage: importer }),
    ]);
    const id = pageCard();
    await wait(SETTLE_MS);
    await press('affine-bookmark .affine-bookmark-card');
    await waitForButton();
    await press(BUTTON);
    expect(window.doc.hasBlock(id)).toBe(true);
    await press(BUTTON);
    expect(importer).toHaveBeenCalledTimes(TWICE);
  });
});

describe('a stored affine:embed-html block', () => {
  let cleanup: () => void = () => undefined;

  afterEach(() => {
    cleanup();
    cleanup = () => undefined;
  });

  const MARK = 'labre-retired-html-ran';
  const SCRIPT = `<p>stored words</p><script>window.parent.postMessage('${MARK}', '*')</script>`;

  function watchRuns() {
    const runs = { count: 0 };
    const listen = (event: MessageEvent) => {
      if (event.data === MARK) runs.count++;
    };
    window.addEventListener('message', listen);
    return { runs, stop: () => window.removeEventListener('message', listen) };
  }

  test('in a page: a card, no frame, and the page around it still works', async () => {
    cleanup = await setupEditor('page', [
      HtmlFileConfigExtension({ frameUrl: PAGE }),
    ]);
    const { runs, stop } = watchRuns();
    const note = addNote(window.doc);
    const id = window.doc.addBlock(
      'affine:embed-html',
      { html: SCRIPT, style: 'html' },
      note
    );
    await wait(LONG_SETTLE_MS);
    stop();

    const block = document.querySelector('affine-embed-html-block');
    expect(block?.querySelector('.affine-embed-html-retired')).toBeTruthy();
    expect(block?.querySelector('iframe, labre-html-frame')).toBeNull();
    expect(block?.textContent).not.toContain('stored words');
    expect(runs.count).toBe(0);
    expect(block?.getBoundingClientRect().height).toBeLessThan(
      PAGE_CARD_MAX_HEIGHT
    );

    await press('affine-embed-html-block .affine-embed-html-retired');
    expect(window.doc.hasBlock(id)).toBe(true);
    expect(window.doc.getBlock(note)?.model.children.length).toBeGreaterThan(0);
  });

  test('on the canvas: a card in its box, and a press only selects it', async () => {
    cleanup = await setupEditor('edgeless', [
      HtmlFileConfigExtension({ frameUrl: PAGE }),
    ]);
    const { runs, stop } = watchRuns();
    const id = window.doc.addBlock(
      'affine:embed-html',
      { html: SCRIPT, style: 'html', xywh: '[0,0,400,200]' },
      getSurface(window.doc, window.editor).model.id
    );
    await wait(LONG_SETTLE_MS);
    stop();

    const block = document.querySelector('affine-embed-edgeless-html-block');
    expect(block?.querySelector('.affine-embed-html-retired')).toBeTruthy();
    expect(block?.querySelector('iframe, labre-html-frame')).toBeNull();
    expect(runs.count).toBe(0);

    await press('affine-embed-edgeless-html-block');
    expect(window.doc.hasBlock(id)).toBe(true);
    expect(window.doc.getBlocksByFlavour('affine:embed-html')).toHaveLength(1);
  });
});
