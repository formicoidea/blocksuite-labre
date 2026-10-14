import type { EdgelessRootBlockComponent } from '@labre/affine/blocks/root';
import { getViewExports, runViewAction } from '@labre/affine/host-panels';
import { ShapeType } from '@labre/affine/model';
import { CanvasLocalVisibility } from '@labre/affine/shared/services';
import { WARDLEY_BACKGROUND } from '@labre/affine-gfx-wardley';
import { Bound } from '@labre/global/gfx';
import { beforeEach, describe, expect, test } from 'vitest';

import { wait } from '../utils/common.js';
import { addNote, getDocRootBlock } from '../utils/edgeless.js';
import { setupEditor } from '../utils/setup.js';

/**
 * "Export as SVG" of the WHOLE canvas (`canvas.export.svg`, ADR 0034
 * amendment of 2026-10-14), on a real editor.
 *
 * The unit suite cannot answer it: the export replays the canvas renderer
 * into svgcanvas, and only a mounted surface has one. What this spec pins:
 * - the entry is listed among the view's exports and hands back a file;
 * - the file is a parsable SVG holding EVERY canvas element, two boards far
 *   apart included — the board export (`export.svg`) takes one;
 * - what the replay cannot draw (a note, a DOM block) is absent, as the
 *   command's description says;
 * - what this viewer hid is left out (ADR 0031), as in the board export.
 */
describe('exporting the whole canvas as SVG', () => {
  let edgeless!: EdgelessRootBlockComponent;

  beforeEach(async () => {
    localStorage.clear();
    const cleanup = await setupEditor('edgeless');
    edgeless = getDocRootBlock(window.doc, window.editor, 'edgeless');
    return cleanup;
  });

  const addMap = (x: number) =>
    edgeless.service.surface.addElement({
      type: WARDLEY_BACKGROUND.type,
      role: WARDLEY_BACKGROUND.role,
      xywh: new Bound(x, 0, 1600, 900).serialize(),
    });

  const exportSvg = async () => {
    const { file } = await runViewAction(edgeless.std, 'canvas.export.svg');
    expect(file, 'no file').toBeDefined();
    expect(file!.filename).toMatch(/\.svg$/);
    const svg = await file!.blob.text();
    const doc = new DOMParser().parseFromString(svg, 'image/svg+xml');
    expect(doc.querySelector('parsererror'), svg.slice(0, 400)).toBeNull();
    return doc;
  };

  const idsIn = (doc: Document) =>
    [...doc.querySelectorAll('[data-labre-id]')].map(node =>
      node.getAttribute('data-labre-id')
    );

  test('is listed among the canvas exports', async () => {
    await wait();
    expect(getViewExports(edgeless.std).map(a => a.id)).toContain(
      'canvas.export.svg'
    );
  });

  test('draws every canvas element, and no DOM block', async () => {
    const mapA = addMap(0);
    const mapB = addMap(3000);
    const shape = edgeless.service.crud.addElement('shape', {
      shapeType: ShapeType.Rect,
      xywh: '[1800,200,100,100]',
    })!;
    const note = addNote(window.doc);
    await wait(100);

    const doc = await exportSvg();
    const ids = idsIn(doc);
    expect(ids).toEqual(expect.arrayContaining([mapA, mapB, shape]));
    expect(ids).not.toContain(note);
    // Both boards, so the picture spans from the first to the last.
    const width = Number(
      doc.documentElement.getAttribute('viewBox')?.split(' ')[2]
    );
    expect(width).toBeGreaterThanOrEqual(4600);
  });

  test('leaves out what this viewer hid', async () => {
    const kept = edgeless.service.crud.addElement('shape', {
      shapeType: ShapeType.Rect,
      xywh: '[0,0,100,100]',
    })!;
    const hidden = edgeless.service.crud.addElement('shape', {
      shapeType: ShapeType.Rect,
      xywh: '[300,0,100,100]',
    })!;
    await wait(100);
    edgeless.std.get(CanvasLocalVisibility).hide([hidden]);
    await wait(50);

    const ids = idsIn(await exportSvg());
    expect(ids).toContain(kept);
    expect(ids).not.toContain(hidden);
  });

  test('an empty canvas hands back no file and throws nothing', async () => {
    await wait();
    await expect(
      runViewAction(edgeless.std, 'canvas.export.svg')
    ).resolves.toEqual({});
  });
});
