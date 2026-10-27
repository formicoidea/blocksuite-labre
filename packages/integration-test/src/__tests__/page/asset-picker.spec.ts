/**
 * The host's asset dialog (`AssetPickerProvider`, labre P4) on a real
 * editor: the slash menu's Image and Attachment ask the host instead of the
 * system file chooser, and the image toolbar's "Replace" swaps the picture
 * in place, in a page and on the canvas.
 *
 * What it would have caught:
 * - a slash entry that still opens the file chooser with a host, or uploads
 *   the bytes again instead of referencing the blob the host stores;
 * - "Replace" missing from the real toolbar, with a host or without one (the
 *   system file chooser stands in since ADR 0044's amendment of 2026-10-27);
 * - a replacement that changes the displayed width, keeps the old ratio or
 *   takes more than one undo step.
 */
import type { ImageBlockModel } from '@labre/affine/model';
import {
  type AssetPickerRequest,
  AssetPickerExtension,
  type AssetRef,
} from '@labre/affine/shared/services';
import { SlashMenuConfigIdentifier } from '@labre/affine/widgets/slash-menu';
import { AFFINE_TOOLBAR_WIDGET } from '@labre/affine/widgets/toolbar';
import { BlockSelection, type BlockStdScope, TextSelection } from '@labre/std';
import type { BlockModel } from '@labre/store';
import { page, userEvent } from '@vitest/browser/context';
import { beforeEach, describe, expect, test } from 'vitest';

import { wait } from '../utils/common.js';
import { addNote, getDocRootBlock } from '../utils/edgeless.js';
import { setupEditor } from '../utils/setup.js';

async function png(width: number, height: number) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const blob = await new Promise<Blob | null>(resolve =>
    canvas.toBlob(resolve, 'image/png')
  );
  if (!blob) throw new Error('no png');
  return blob;
}

/** A host whose library holds one 80x20 image and one pdf. */
function libraryHost() {
  const requests: AssetPickerRequest[] = [];
  const assets: { image?: AssetRef; file?: AssetRef } = {};
  return {
    requests,
    assets,
    service: {
      pick: async (request: AssetPickerRequest) => {
        requests.push(request);
        const asset = assets[request.kind];
        return asset ? [asset] : null;
      },
    },
    /** What the host stored before the dialog opened. */
    async stock() {
      const image = await png(80, 20);
      assets.image = {
        sourceId: await window.doc.blobSync.set(image),
        name: 'wide.png',
        type: 'image/png',
        size: image.size,
        width: 80,
        height: 20,
      };
      const pdf = new Blob(['%PDF-1.4'], { type: 'application/pdf' });
      assets.file = {
        sourceId: await window.doc.blobSync.set(pdf),
        name: 'plan.pdf',
        type: 'application/pdf',
        size: pdf.size,
      };
    },
  };
}

function slashAction(std: BlockStdScope, name: string) {
  const model = std.store.root!;
  for (const config of std.provider
    .getAll(SlashMenuConfigIdentifier)
    .values()) {
    const items =
      typeof config.items === 'function'
        ? config.items({ std, model })
        : config.items;
    for (const item of items) {
      if (item.name === name && 'action' in item) return item.action;
    }
  }
  throw new Error(`no slash entry ${name}`);
}

/**
 * Clicks a toolbar entry the way a viewer does: a narrow image's inner
 * toolbar folds entries into its "more" menu, so open that menu first.
 */
async function clickEntry(entry: HTMLElement) {
  const menu = entry.closest<HTMLElement & { show(force?: boolean): void }>(
    'editor-menu-button'
  );
  if (menu) {
    menu.show(true);
    await settle();
  }
  await userEvent.click(page.elementLocator(entry));
}

const settle = async () => {
  await wait(250);
  for (let i = 0; i < 4; i++) {
    await new Promise(resolve => requestAnimationFrame(resolve));
  }
};

describe('the asset dialog in a page', () => {
  let std!: BlockStdScope;
  let host!: ReturnType<typeof libraryHost>;
  let noteId!: string;

  beforeEach(async () => {
    host = libraryHost();
    const cleanup = await setupEditor('page', [
      AssetPickerExtension(host.service),
    ]);
    std = getDocRootBlock(window.doc, window.editor, 'page').std;
    noteId = addNote(window.doc);
    await host.stock();
    await wait(100);
    return cleanup;
  });

  const note = () => window.doc.getModelById(noteId) as BlockModel;

  /** The slash gesture: a caret on the note's empty line, then the entry. */
  async function slash(name: string) {
    const line = note().children[0];
    std.selection.setGroup('note', [
      std.selection.create(TextSelection, {
        from: { blockId: line.id, index: 0, length: 0 },
        to: null,
      }),
    ]);
    await wait();
    slashAction(std, name)({ std, model: line });
    await settle();
  }

  test('Image inserts the picked image by reference, in place of the line', async () => {
    await slash('Image');

    expect(host.requests).toEqual([
      { kind: 'image', mode: 'insert', multiple: true, docId: window.doc.id },
    ]);
    const [image] = note().children as ImageBlockModel[];
    expect(note().children).toHaveLength(1);
    expect(image.flavour).toBe('affine:image');
    expect(image.props.sourceId).toBe(host.assets.image!.sourceId);
    expect([image.props.width, image.props.height]).toEqual([80, 20]);
  });

  test('Attachment inserts the picked file by reference', async () => {
    await slash('Attachment');

    expect(host.requests[0]).toMatchObject({ kind: 'file', mode: 'insert' });
    const [card] = note().children;
    expect(card.flavour).toBe('affine:attachment');
    expect((card.props as { sourceId: string }).sourceId).toBe(
      host.assets.file!.sourceId
    );
  });

  test('Replace on the image toolbar keeps the width and follows the new ratio, one undo step', async () => {
    const square = await png(40, 40);
    const imageId = window.doc.addBlock(
      'affine:image',
      {
        sourceId: await window.doc.blobSync.set(square),
        width: 200,
        height: 200,
        size: square.size,
      },
      noteId
    );
    window.doc.captureSync();
    window.editor.host!.focus();
    std.selection.setGroup('note', [
      std.selection.create(BlockSelection, { blockId: imageId }),
    ]);
    await settle();

    const root = getDocRootBlock(window.doc, window.editor, 'page');
    const replace = (
      root.widgetComponents[AFFINE_TOOLBAR_WIDGET] as
        | { toolbar?: HTMLElement }
        | undefined
    )?.toolbar?.querySelector<HTMLElement>(
      '[data-toolbar-action-id="a.replace"]'
    );
    expect(replace, 'the image toolbar has no Replace').toBeTruthy();
    await clickEntry(replace!);
    await settle();

    const image = window.doc.getModelById(imageId) as ImageBlockModel;
    expect(host.requests.at(-1)).toMatchObject({
      kind: 'image',
      mode: 'replace',
    });
    expect(image.props.sourceId).toBe(host.assets.image!.sourceId);
    expect([image.props.width, image.props.height]).toEqual([200, 50]);

    window.doc.undo();
    expect([image.props.width, image.props.height]).toEqual([200, 200]);
    expect(image.props.sourceId).not.toBe(host.assets.image!.sourceId);
  });
});

describe('the image toolbar without a host', () => {
  test('still offers Replace', async () => {
    const cleanup = await setupEditor('page');
    try {
      const root = getDocRootBlock(window.doc, window.editor, 'page');
      const noteId = addNote(window.doc);
      const image = await png(40, 40);
      const imageId = window.doc.addBlock(
        'affine:image',
        {
          sourceId: await window.doc.blobSync.set(image),
          width: 100,
          height: 100,
        },
        noteId
      );
      window.editor.host!.focus();
      root.std.selection.setGroup('note', [
        root.std.selection.create(BlockSelection, { blockId: imageId }),
      ]);
      await settle();

      const toolbar = (
        root.widgetComponents[AFFINE_TOOLBAR_WIDGET] as
          | { toolbar?: HTMLElement }
          | undefined
      )?.toolbar;
      expect(
        toolbar?.querySelector('[data-toolbar-action-id="a.download"]'),
        'the image toolbar is shown'
      ).toBeTruthy();
      // Offered all the same: without a library the system file chooser
      // stands in (ADR 0044, amendment of 2026-10-27). Not clicked here, a
      // real file chooser would open.
      expect(
        toolbar?.querySelector('[data-toolbar-action-id="a.replace"]')
      ).not.toBe(null);
    } finally {
      cleanup();
    }
  });
});

describe('the asset dialog on the canvas', () => {
  test('Replace keeps the corner and the width of a canvas image', async () => {
    const host = libraryHost();
    const cleanup = await setupEditor('edgeless', [
      AssetPickerExtension(host.service),
    ]);
    try {
      await host.stock();
      const edgeless = getDocRootBlock(window.doc, window.editor, 'edgeless');
      edgeless.std.event.active = true;
      const square = await png(40, 40);
      const imageId = edgeless.service.crud.addBlock(
        'affine:image',
        {
          sourceId: await window.doc.blobSync.set(square),
          width: 40,
          height: 40,
          xywh: '[100,100,300,300]',
        },
        edgeless.service.surface.id
      )!;
      window.doc.captureSync();
      edgeless.gfx.selection.set({ elements: [imageId], editing: false });
      await settle();

      // On the canvas « Replace » is a menu (ADR 0044, amendment of
      // 2026-10-27); its « Replace with image » asks the host.
      const replace = (
        edgeless.widgetComponents[AFFINE_TOOLBAR_WIDGET] as
          | { toolbar?: HTMLElement }
          | undefined
      )?.toolbar?.querySelector<HTMLElement>(
        '[data-testid="image-replace-with-image"]'
      );
      expect(replace, 'the canvas image toolbar has no Replace').toBeTruthy();
      await clickEntry(replace!);
      await settle();
      expect(host.requests.at(-1)).toMatchObject({
        kind: 'image',
        mode: 'replace',
        multiple: false,
      });

      const image = window.doc.getModelById(imageId) as ImageBlockModel;
      expect(image.props.sourceId).toBe(host.assets.image!.sourceId);
      expect(image.props.xywh).toBe('[100,100,300,75]');

      window.doc.undo();
      expect(image.props.xywh).toBe('[100,100,300,300]');
    } finally {
      cleanup();
    }
  });
});
