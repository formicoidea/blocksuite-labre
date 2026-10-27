/**
 * The canvas image's « Replace » menu (ADR 0044, amendment of 2026-10-27),
 * on the real editor and its real toolbar row, driven with the real mouse.
 *
 * This spec would have caught:
 * - the two old buttons coming back beside the menu, or the menu missing from
 *   the row a user sees (module lookup, `when`, id merge, render);
 * - « Replace with shape » offering no choice, or a list that is not the shape
 *   tool's (six shapes, same order);
 * - the sub-menu closing the Replace menu on the click that opens it (every
 *   menu button closes on a click outside its own trigger);
 * - a picked shape ignored (a rectangle whatever the pick), or landing
 *   elsewhere than the image's box, or leaving its connector on the deleted
 *   image's id;
 * - Escape leaving the menu open.
 */
import type { EdgelessRootBlockComponent } from '@labre/affine/blocks/root';
import type {
  ConnectorElementModel,
  ShapeElementModel,
} from '@labre/affine/model';
import { AFFINE_TOOLBAR_WIDGET } from '@labre/affine/widgets/toolbar';
import { page, userEvent } from '@vitest/browser/context';
import { beforeEach, describe, expect, test } from 'vitest';

import { wait } from '../utils/common.js';
import { getDocRootBlock, getSurface } from '../utils/edgeless.js';
import { setupEditor } from '../utils/setup.js';

async function greenPng(): Promise<Blob> {
  const canvas = document.createElement('canvas');
  canvas.width = 200;
  canvas.height = 100;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = 'rgb(0, 128, 0)';
  ctx.fillRect(0, 0, 200, 100);
  return new Promise(resolve =>
    canvas.toBlob(blob => resolve(blob!), 'image/png')
  );
}

describe('the Replace menu of a canvas image', () => {
  let edgeless!: EdgelessRootBlockComponent;

  beforeEach(async () => {
    const cleanup = await setupEditor('edgeless');
    edgeless = getDocRootBlock(window.doc, window.editor, 'edgeless');
    return cleanup;
  });

  const surface = () => getSurface(window.doc, window.editor).model;

  const toolbarRow = () =>
    (
      edgeless.widgetComponents[AFFINE_TOOLBAR_WIDGET] as
        | { toolbar?: HTMLElement }
        | undefined
    )?.toolbar ?? null;

  const settle = async () => {
    await wait(250);
    await edgeless.updateComplete;
    await wait(0);
  };

  const click = (element: Element | null | undefined) => {
    expect(element).toBeTruthy();
    return userEvent.click(page.elementLocator(element as HTMLElement));
  };

  /** An image wired to a shape by a connector, selected, toolbar drawn. */
  const selectedImage = async () => {
    const sourceId = await window.doc.blobSync.set(await greenPng());
    const imageId = window.doc.addBlock(
      'affine:image',
      { sourceId, xywh: '[0,0,200,100]', width: 200, height: 100 },
      surface().id
    );
    const other = surface().addElement({
      type: 'shape',
      xywh: '[400,0,60,60]',
    });
    const connectorId = surface().addElement({
      type: 'connector',
      source: { id: other },
      target: { id: imageId },
    });
    await wait();
    // The suite shares one page and leaves it scrolled and the camera
    // anywhere: bring the editor into the window and the image under the
    // camera, or the toolbar is drawn off screen and no real click lands.
    edgeless.scrollIntoView({ block: 'center' });
    edgeless.gfx.viewport.setZoom(1);
    edgeless.gfx.viewport.setCenter(100, 50);
    await edgeless.updateComplete;
    edgeless.gfx.selection.set({ elements: [imageId], editing: false });
    await settle();
    return { imageId, connectorId };
  };

  const menu = () =>
    toolbarRow()?.querySelector<HTMLElement>(
      '[data-testid="image-replace-menu"]'
    ) ?? null;

  const isOpen = (element: HTMLElement | null) =>
    element?.dataset.open === 'true';

  test('one Replace menu, where the two buttons were', async () => {
    await selectedImage();

    expect(menu()).not.toBeNull();
    const ids = Array.from(
      toolbarRow()!.querySelectorAll<HTMLElement>('[data-toolbar-action-id]'),
      element => element.dataset.toolbarActionId
    );
    // The row's icon buttons are read (Download is one), and the old
    // « Replace with shape » button is not among them any more.
    expect(ids).toContain('a.download');
    expect(ids).not.toContain('a.replace-with-shape');
    expect(
      toolbarRow()!.querySelectorAll('[data-testid="image-replace-menu"]')
    ).toHaveLength(1);
  });

  test('« Replace with shape » lists the shape tool, and Ellipse takes the image box', async () => {
    const { imageId, connectorId } = await selectedImage();

    await click(menu());
    await settle();
    expect(isOpen(menu())).toBe(true);
    expect(
      menu()!.querySelector('[data-testid="image-replace-with-image"]')
    ).not.toBeNull();

    const submenu = menu()!.querySelector<HTMLElement>(
      '[data-testid="image-replace-shape"]'
    );
    await click(submenu);
    await settle();
    // The click that opened the sub-menu did not close the menu around it.
    expect(isOpen(menu())).toBe(true);
    expect(isOpen(submenu)).toBe(true);

    const options = Array.from(
      submenu!.querySelectorAll<HTMLElement>(
        '[data-testid="image-replace-shape-option"]'
      )
    );
    expect(options.map(option => option.dataset.value)).toEqual([
      'rect',
      'ellipse',
      'diamond',
      'triangle',
      'polygon',
      'roundedRect',
    ]);

    await click(options.find(option => option.dataset.value === 'ellipse'));
    await settle();

    expect(window.doc.getModelById(imageId)).toBeNull();
    const connector = surface().getElementById(
      connectorId
    ) as ConnectorElementModel;
    const shape = surface().getElementById(
      connector.target.id!
    ) as ShapeElementModel;
    expect(shape.type).toBe('shape');
    expect(shape.shapeType).toBe('ellipse');
    expect(shape.xywh).toBe('[0,0,200,100]');
    expect(edgeless.gfx.selection.selectedIds).toEqual([shape.id]);
  });

  test('Escape closes the menu', async () => {
    await selectedImage();

    await click(menu());
    await settle();
    expect(isOpen(menu())).toBe(true);

    await userEvent.keyboard('{Escape}');
    await settle();
    expect(isOpen(menu())).toBe(false);
  });
});
