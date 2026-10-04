import type { EdgelessRootBlockComponent } from '@labre/affine/blocks/root';
import { EdgelessClipboardController } from '@labre/affine/blocks/root';
import { CanvasRenderer, ExportManager } from '@labre/affine/blocks/surface';
import type { GfxBlockElementModel } from '@labre/std/gfx';
import { afterEach, describe, expect, test } from 'vitest';

import { wait } from '../utils/common.js';
import { addNote, getDocRootBlock, getSurface } from '../utils/edgeless.js';
import { setupEditor } from '../utils/setup.js';

/**
 * The raster exports — PNG/PDF (`ExportManager`) and "copy as image"
 * (`EdgelessClipboardController.toCanvas`) — rasterise blocks with
 * html2canvas 1.4.1, which throws on any colour function but rgb(a)/hsl(a).
 * A host whose theme is written in `oklch()` therefore lost every raster
 * export: "Attempting to parse an unsupported color function \"oklch\"".
 *
 * Each test paints the page the way such a host does — an oklch page
 * background, and an oklch CSS variable a note consumes — and drives the real
 * export path to a canvas.
 */
describe('raster exports under an oklch theme', () => {
  const cleanups: (() => void)[] = [];

  afterEach(() => {
    cleanups.splice(0).forEach(cleanup => cleanup());
  });

  const paintTheHostTheme = () => {
    const previous = document.body.style.background;
    document.body.style.background = 'oklch(0.97 0.01 250)';
    const sheet = document.createElement('style');
    sheet.textContent = `
      :root { --host-ink: oklch(0.3 0.05 260); --host-paper: oklch(0.95 0.03 90); }
      affine-edgeless-note, affine-note {
        color: var(--host-ink);
        background-color: var(--host-paper);
        border-color: var(--host-ink);
      }
    `;
    document.head.append(sheet);
    cleanups.push(() => {
      document.body.style.background = previous;
      sheet.remove();
    });
  };

  test('"copy as image" of a note resolves to a canvas', async () => {
    cleanups.push(await setupEditor('edgeless'));
    paintTheHostTheme();
    const noteId = addNote(window.doc, { xywh: '[0, 0, 400, 100]' });
    await wait();

    const note = window.doc.getModelById(noteId) as GfxBlockElementModel;
    const clipboard = window.editor.std.get(EdgelessClipboardController);

    const canvas = await clipboard.toCanvas([note], []);

    expect(canvas).toBeInstanceOf(HTMLCanvasElement);
  });

  test('the edgeless PNG/PDF export of a note resolves to a canvas', async () => {
    cleanups.push(await setupEditor('edgeless'));
    paintTheHostTheme();
    addNote(window.doc, { xywh: '[0, 0, 400, 100]' });
    await wait();

    const edgeless = getDocRootBlock(
      window.doc,
      window.editor,
      'edgeless'
    ) as EdgelessRootBlockComponent;
    const surface = getSurface(window.doc, window.editor);
    const renderer = surface.renderer;
    expect(renderer).toBeInstanceOf(CanvasRenderer);

    const canvas = await window.editor.std
      .get(ExportManager)
      .edgelessToCanvas(
        renderer as CanvasRenderer,
        edgeless.gfx.elementsBound,
        edgeless.gfx
      );

    expect(canvas).toBeInstanceOf(HTMLCanvasElement);
  });

  test('the page PNG/PDF export resolves to a canvas', async () => {
    cleanups.push(await setupEditor('page'));
    paintTheHostTheme();
    const { viewportElement } = getDocRootBlock(
      window.doc,
      window.editor,
      'page'
    );
    // The viewport's own background is passed to html2canvas as an option,
    // outside any clone: it must be converted too.
    viewportElement.style.backgroundColor = 'oklch(0.99 0.005 250)';
    await wait();

    const exportManager = window.editor.std.get(ExportManager) as unknown as {
      _docToCanvas(): Promise<HTMLCanvasElement | void>;
    };

    const canvas = await exportManager._docToCanvas();

    expect(canvas).toBeInstanceOf(HTMLCanvasElement);
  });
});
