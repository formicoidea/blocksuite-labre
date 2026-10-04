/**
 * Canvas text decoration end to end (ADR 0030).
 *
 * The unit suites pin the helper and each renderer over fakes. What only a
 * real editor answers is the user's path and the document's: a REAL click on
 * the toolbar toggle writes the one stored key, one undo takes it back, the
 * key survives a duplicate and a snapshot round trip (the reload path), the
 * overlay editor shows the same line as CSS, and the SVG export — which
 * replays the canvas renderers into svgcanvas — carries one `<rect>` per
 * decorated run.
 */
import type { EdgelessRootBlockComponent } from '@labre/affine/blocks/root';
import { renderBoardSvg } from '@labre/affine/blocks/surface';
import { mountTextElementEditor } from '@labre/affine/gfx/text';
import {
  ConnectorElementModel,
  ConnectorMode,
  FrameworkBackgroundElementModel,
  type ShapeElementModel,
  ShapeType,
  TextDecoration,
  TextElementModel,
} from '@labre/affine/model';
import { AffineSchemas } from '@labre/affine/schemas';
import { replaceIdMiddleware } from '@labre/affine/shared/adapters';
import type { SurfaceBlockModel } from '@labre/affine/std/gfx';
import { AFFINE_TOOLBAR_WIDGET } from '@labre/affine/widgets/toolbar';
import { Schema, type Store, Transformer } from '@labre/store';
import { page, userEvent } from '@vitest/browser/context';
import { beforeEach, describe, expect, test } from 'vitest';
import * as Y from 'yjs';

import { wait } from '../utils/common.js';
import { getDocRootBlock, getSurface } from '../utils/edgeless.js';
import { setupEditor } from '../utils/setup.js';

describe('canvas text decoration', () => {
  let edgeless!: EdgelessRootBlockComponent;

  beforeEach(async () => {
    sessionStorage.removeItem('blocksuite:prop:record');
    const cleanup = await setupEditor('edgeless');
    edgeless = getDocRootBlock(window.doc, window.editor, 'edgeless');
    edgeless.std.event.active = true;
    return cleanup;
  });

  const surface = () => getSurface(window.doc, window.editor).model;

  const addText = (props: Record<string, unknown> = {}) => {
    const id = edgeless.service.crud.addElement('text', {
      text: new Y.Text('Order'),
      xywh: '[100,100,200,40]',
      ...props,
    });
    if (!id) throw new Error('failed to add a text');
    return edgeless.service.crud.getElementById(id) as TextElementModel;
  };

  const toolbarButton = (id: string) => {
    const toolbar = (
      edgeless.widgetComponents[AFFINE_TOOLBAR_WIDGET] as
        | { toolbar?: HTMLElement }
        | undefined
    )?.toolbar;
    return (
      toolbar?.querySelector<HTMLElement & { active: boolean }>(
        `[data-toolbar-action-id="${id}"]`
      ) ?? null
    );
  };

  const select = async (id: string) => {
    edgeless.gfx.selection.set({ elements: [id], editing: false });
    await wait(250);
  };

  test('a real click on the underline toggle writes the field, one undo takes it back', async () => {
    const text = addText();
    window.doc.captureSync();
    await select(text.id);

    const underline = toolbarButton('a.underline');
    expect(underline, 'the text toolbar has no underline toggle').toBeTruthy();
    expect(underline!.active).toBe(false);
    expect(toolbarButton('b.overline')).toBeTruthy();

    await userEvent.click(page.elementLocator(underline!));
    await wait(100);

    expect(text.textDecoration).toBe(TextDecoration.Underline);
    expect(text.yMap.get('textDecoration')).toBe('underline');
    expect(toolbarButton('a.underline')!.active).toBe(true);

    // A second toggle composes, it does not replace.
    await userEvent.click(page.elementLocator(toolbarButton('b.overline')!));
    await wait(100);
    expect(text.textDecoration).toBe(TextDecoration.UnderlineOverline);

    // One click, one undo step each; the text itself stays.
    window.doc.undo();
    await wait();
    expect(text.textDecoration).toBe(TextDecoration.Underline);
    window.doc.undo();
    await wait();
    expect(text.yMap.has('textDecoration')).toBe(false);
    expect(surface().getElementById(text.id)).toBe(text);
  });

  test('the next text is plain: a decoration is not a remembered style', async () => {
    // Emphasis on one label, not a house style (ADR 0030 §6).
    const text = addText();
    await select(text.id);
    await userEvent.click(page.elementLocator(toolbarButton('a.underline')!));
    await wait(100);
    expect(text.textDecoration).toBe(TextDecoration.Underline);

    const next = addText({ xywh: '[100,300,200,40]' });
    expect(next.yMap.has('textDecoration')).toBe(false);
  });

  test('turning the decoration off writes none, not an absent key', async () => {
    const text = addText({ textDecoration: TextDecoration.Underline });
    await select(text.id);

    await userEvent.click(page.elementLocator(toolbarButton('a.underline')!));
    await wait(100);

    expect(text.yMap.get('textDecoration')).toBe('none');
  });

  test('a duplicate and a snapshot round trip keep the field', async () => {
    const text = addText({ textDecoration: TextDecoration.Overline });
    await select(text.id);

    document.dispatchEvent(
      new KeyboardEvent('keydown', {
        key: 'd',
        ctrlKey: true,
        bubbles: true,
        cancelable: true,
      })
    );
    await wait(150);

    const texts = surface().getElementsByType('text') as TextElementModel[];
    expect(texts).toHaveLength(2);
    expect(texts.map(t => t.textDecoration)).toEqual([
      TextDecoration.Overline,
      TextDecoration.Overline,
    ]);

    const transformer = () =>
      new Transformer({
        schema: new Schema().register(AffineSchemas),
        blobCRUD: window.collection.blobSync,
        docCRUD: {
          create: (docId: string) =>
            window.collection.createDoc(docId).getStore({ id: docId }),
          get: (docId: string) =>
            window.collection.getDoc(docId)?.getStore({ id: docId }) ?? null,
          delete: (docId: string) => window.collection.removeDoc(docId),
        },
        middlewares: [replaceIdMiddleware(window.collection.idGenerator)],
      });
    const snapshot = transformer().docToSnapshot(window.doc);
    expect(snapshot).toBeTruthy();
    const reloaded = (await transformer().snapshotToDoc(snapshot!)) as Store;
    const reloadedSurface = reloaded.getModelsByFlavour(
      'affine:surface'
    )[0] as SurfaceBlockModel;
    const reloadedTexts = reloadedSurface.getElementsByType(
      'text'
    ) as TextElementModel[];

    expect(reloadedTexts.map(t => t.textDecoration)).toEqual([
      TextDecoration.Overline,
      TextDecoration.Overline,
    ]);
  });

  test('the overlay editor shows the decoration as CSS', async () => {
    const text = addText({ textDecoration: TextDecoration.Underline });
    await wait();

    mountTextElementEditor(text, edgeless);
    await wait();

    const editor = document.querySelector(
      'edgeless-text-editor .edgeless-text-editor'
    ) as HTMLElement | null;
    expect(editor).toBeTruthy();
    expect(getComputedStyle(editor!).textDecorationLine).toBe('underline');
  });

  test('the SVG export carries one rect per decorated text, shape and label', async () => {
    const board = surface().addElement({
      type: 'cynefin',
      xywh: '[0,0,1200,800]',
    });
    const text = addText();
    const shapeId = surface().addElement({
      type: 'shape',
      shapeType: ShapeType.Rect,
      xywh: '[400,100,200,100]',
      text: new Y.Text('Pay'),
    });
    const connectorId = surface().addElement({
      type: 'connector',
      mode: ConnectorMode.Straight,
      source: { position: [100, 500] },
      target: { position: [700, 500] },
      text: new Y.Text('owns'),
      labelXYWH: [380, 490, 40, 20],
    });
    await wait();

    const boardModel = surface().getElementById(board);
    expect(boardModel).toBeInstanceOf(FrameworkBackgroundElementModel);
    const shape = surface().getElementById(shapeId) as ShapeElementModel;
    const connector = surface().getElementById(
      connectorId
    ) as ConnectorElementModel;
    expect(connector).toBeInstanceOf(ConnectorElementModel);
    expect(text).toBeInstanceOf(TextElementModel);

    const rects = () => {
      const { svg } = renderBoardSvg(
        edgeless.std,
        boardModel as FrameworkBackgroundElementModel
      );
      const doc = new DOMParser().parseFromString(svg, 'image/svg+xml');
      expect(doc.querySelector('parsererror')).toBeNull();
      return doc.querySelectorAll('rect').length;
    };

    const before = rects();

    text.textDecoration = TextDecoration.Underline;
    shape.textDecoration = TextDecoration.Underline;
    connector.labelStyle = {
      ...connector.labelStyle,
      textDecoration: TextDecoration.UnderlineOverline,
    };
    await wait();

    // One underline each for the text and the shape, two lines for the label.
    expect(rects()).toBe(before + 4);
  });
});
