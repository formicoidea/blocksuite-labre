/**
 * An html attachment on a real editor, in a page and on the canvas, through a real
 * page in the shape ADR 0047 asks of a host (`html-frame-page.html`).
 *
 * What it would have caught:
 * - a preview that never gets its bytes, or that gets them through a `blob:` url
 *   instead of the handshake;
 * - a file running anywhere but in the isolated frame;
 * - a script of the file that runs without the reader's gesture, in a thumbnail or an
 *   embed view, closed by the page's `scripts` field;
 * - a thumbnail with a frame before it is in view, or one that takes the pointer;
 * - "Interact" not reaching the frame, or surviving a press outside, or a page
 *   reloaded when the interaction ends;
 * - an embed view offered without a page from the host;
 * - in a note on the canvas, a mask that swallows "Interact", the frame or the height
 *   handle until the note is entered, or a preview that stops selecting the note;
 * - a height drag that ignores the canvas's zoom and the note's own scale.
 */
import type { HtmlFrame } from '@labre/affine/components/html-frame';
import type { AttachmentBlockModel, NoteBlockModel } from '@labre/affine/model';
import { HtmlFileConfigExtension } from '@labre/affine/shared/services';
import { Bound } from '@labre/global/gfx';
import { GfxControllerIdentifier } from '@labre/std/gfx';
import { afterEach, describe, expect, test, vi } from 'vitest';

import { wait } from '../utils/common.js';
import { addNote } from '../utils/edgeless.js';
import { setupEditor } from '../utils/setup.js';

const PAGE = new URL('./html-frame-page.html', import.meta.url).href;
const MARK = 'labre-html-attachment-ran';
// Every ancestor: the runner holds the test page in a frame of its own, and the
// file sits one level deeper with a host's page.
const FILE = `<!doctype html><p>a report</p><script>let w = window; while (w !== w.parent) { w = w.parent; w.postMessage({ mark: '${MARK}', origin: self.origin }, '*'); }</script>`;
const FRAME_LOAD_MS = 5000;
/** Long enough for a frame that should not exist to have run. */
const SILENCE_MS = 1500;

const views = () =>
  [
    ...document.querySelectorAll('affine-attachment-html-view'),
  ] as HTMLElement[];

function frameOf(view: HTMLElement) {
  return view.shadowRoot?.querySelector('labre-html-frame') as HtmlFrame;
}

async function ranOrigin() {
  return new Promise<string>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('no run')), FRAME_LOAD_MS);
    const listen = (event: MessageEvent) => {
      if (event.data?.mark !== MARK) return;
      clearTimeout(timer);
      window.removeEventListener('message', listen);
      resolve(event.data.origin);
    };
    window.addEventListener('message', listen);
  });
}

/** Counts what ran, from now on. */
function watchRuns() {
  const runs = { count: 0 };
  const listen = (event: MessageEvent) => {
    if (event.data?.mark === MARK) runs.count++;
  };
  window.addEventListener('message', listen);
  return { runs, stop: () => window.removeEventListener('message', listen) };
}

async function addFile(parent: string) {
  const doc = window.doc;
  const sourceId = await doc.blobSync.set(new Blob([FILE]));
  return doc.addBlock(
    'affine:attachment',
    {
      name: 'report.html',
      size: FILE.length,
      type: 'text/html',
      sourceId,
    },
    parent
  );
}

function turnIntoEmbed(id: string) {
  const model = window.doc.getBlock(id)?.model as AttachmentBlockModel;
  window.doc.updateBlock(model, { embed: true, style: 'html' });
}

describe('an html attachment', () => {
  let cleanup: (() => void) | undefined;
  afterEach(() => {
    cleanup?.();
    cleanup = undefined;
  });

  test('its thumbnail shows the file and never runs it, nor takes the pointer', async () => {
    cleanup = await setupEditor('page', [
      HtmlFileConfigExtension({ frameUrl: PAGE }),
    ]);
    const { runs, stop } = watchRuns();
    await addFile(addNote(window.doc));
    await wait(SILENCE_MS);
    stop();
    expect(runs.count).toBe(0);

    const frame = frameOf(views()[0] as HTMLElement);
    expect(frame.scripts).toBe(false);
    expect(frame.iframe?.hasAttribute('inert')).toBe(true);
    expect(frame.iframe?.getAttribute('src')).toBe(PAGE);
    expect(frame.iframe?.style.transform).toContain('scale(');
  });

  test('its embed view runs nothing before "Interact", and runs in the isolated frame after', async () => {
    cleanup = await setupEditor('page', [
      HtmlFileConfigExtension({ frameUrl: PAGE }),
    ]);
    const { runs, stop } = watchRuns();
    turnIntoEmbed(await addFile(addNote(window.doc)));

    const view = await vi.waitFor(() => {
      const found = views().find(candidate => candidate.hasAttribute('embed'));
      if (!found) throw new Error('no embed view yet');
      return found;
    });
    const frame = frameOf(view);
    await frame.updateComplete;
    expect(frame.iframe?.hasAttribute('inert')).toBe(true);
    await wait(SILENCE_MS);
    expect(runs.count).toBe(0);

    const ran = ranOrigin();
    view.shadowRoot
      ?.querySelector<HTMLElement>('[data-testid="attachment-html-interact"]')
      ?.click();
    // An opaque origin: the frame the page isolates, not the app's.
    expect(await ran).toBe('null');
    await vi.waitFor(() =>
      expect(frame.iframe?.hasAttribute('inert')).toBe(false)
    );

    // The pointer goes back, the page stays: it is not loaded again.
    const started = frame.iframe;
    const before = runs.count;
    document.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
    await vi.waitFor(() =>
      expect(frame.iframe?.hasAttribute('inert')).toBe(true)
    );
    await wait(SILENCE_MS);
    stop();
    expect(frame.iframe).toBe(started);
    expect(runs.count).toBe(before);
  });

  test('on the canvas too, in the card that was placed', async () => {
    cleanup = await setupEditor('edgeless', [
      HtmlFileConfigExtension({ frameUrl: PAGE }),
    ]);
    const surface = window.doc.getModelsByFlavour('affine:surface')[0];
    const { runs, stop } = watchRuns();
    const sourceId = await window.doc.blobSync.set(new Blob([FILE]));
    window.doc.addBlock(
      'affine:attachment',
      {
        name: 'report.html',
        size: FILE.length,
        type: 'text/html',
        sourceId,
        style: 'cubeThick',
        xywh: '[0,0,170,132]',
      },
      surface?.id
    );
    await wait(SILENCE_MS);
    stop();
    expect(runs.count).toBe(0);
    expect(views()).toHaveLength(1);
  });

  describe('in a note on the canvas', () => {
    const NOTE_SCALE = 1.5;

    const viewport = () =>
      window.editor.std.get(GfxControllerIdentifier).viewport;

    // What the pointer hits at the centre of a part, through the view's shadow
    // root, once the part is in the runner's small frame at any zoom.
    const hitAt = async (view: HTMLElement, part: HTMLElement) => {
      const centre = () => {
        const box = part.getBoundingClientRect();
        return [box.x + box.width / 2, box.y + box.height / 2] as const;
      };
      const [px, py] = centre();
      const host = window.editor.host!.getBoundingClientRect();
      const { centerX, centerY, zoom } = viewport();
      viewport().setCenter(
        centerX + (px - (host.x + host.width / 2)) / zoom,
        centerY + (py - (host.y + host.height / 2)) / zoom
      );
      await wait(100);
      const [x, y] = centre();
      const top = document.elementFromPoint(x, y);
      return top === view ? view.shadowRoot?.elementFromPoint(x, y) : top;
    };

    async function viewInNote() {
      cleanup = await setupEditor('edgeless', [
        HtmlFileConfigExtension({ frameUrl: PAGE }),
      ]);
      const noteId = addNote(window.doc);
      const note = window.doc.getModelById(noteId) as NoteBlockModel;
      window.doc.updateBlock(note, () => {
        note.props.edgeless.scale = NOTE_SCALE;
      });
      const id = await addFile(noteId);
      turnIntoEmbed(id);
      await wait(200);
      const view = views()[0] as HTMLElement;
      const part = (testid: string) =>
        view.shadowRoot?.querySelector(
          `[data-testid="${testid}"]`
        ) as HTMLElement;
      return { id, view, part };
    }

    test.each([0.6, 1, 1.5])(
      'at zoom %s, the view claims the pointer past the mask, and only there',
      async zoom => {
        const { view, part } = await viewInNote();
        viewport().setZoom(zoom);
        await wait(200);

        const interact = part('attachment-html-interact');
        const handle = part('attachment-html-height');
        const preview = frameOf(view);
        expect(await hitAt(view, interact)).toBe(interact);
        expect(await hitAt(view, handle)).toBe(handle);
        const under = (await hitAt(view, preview)) as HTMLElement;
        expect(under.classList.contains('affine-note-mask')).toBe(true);

        interact.click();
        await wait(50);
        expect(await hitAt(view, preview)).toBe(preview);
        expect(part('attachment-html-height')).toBeNull();
      }
    );

    test('the height handle moves with the pointer at any scale', async () => {
      const { id, view, part } = await viewInNote();
      const zoom = 0.5;
      viewport().setZoom(zoom);
      await wait(200);

      const model = window.doc.getModelById(id) as AttachmentBlockModel;
      const before = view.getBoundingClientRect().height;
      const stored = view.offsetHeight;
      const handle = part('attachment-html-height');
      const fire = (type: string, clientY: number) =>
        handle.dispatchEvent(
          new PointerEvent(type, {
            bubbles: true,
            composed: true,
            pointerId: 1,
            clientY,
          })
        );
      handle.setPointerCapture = () => undefined;
      fire('pointerdown', 100);
      fire('pointermove', 160);
      fire('pointerup', 160);
      await wait(50);

      const stepped = Bound.deserialize(model.props.xywh).h;
      expect(stepped).toBeCloseTo(stored + 60 / (zoom * NOTE_SCALE), 0);
      expect(view.getBoundingClientRect().height).toBeCloseTo(before + 60, 0);
    });
  });

  test('without a page from the host it is a card that runs nothing', async () => {
    cleanup = await setupEditor('page');
    let runs = 0;
    const listen = (event: MessageEvent) => {
      if (event.data?.mark === MARK) runs++;
    };
    window.addEventListener('message', listen);
    const id = await addFile(addNote(window.doc));
    turnIntoEmbed(id);

    await wait(SILENCE_MS);
    window.removeEventListener('message', listen);

    expect(runs).toBe(0);
    expect(views()).toHaveLength(0);
    expect(document.querySelector(`[data-block-id="${id}"] iframe`)).toBeNull();
    expect(
      document.querySelector(`[data-block-id="${id}"] .affine-attachment-card`)
    ).not.toBeNull();
  });
});
