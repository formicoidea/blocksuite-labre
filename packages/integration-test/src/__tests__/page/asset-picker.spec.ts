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
 * - a replacement that leaves the frame of what it replaces, distorts the picture
 *   instead of cropping it, or takes more than one undo step (ADR 0044, amendment
 *   of 2026-11-04);
 * - an attachment card replaced by an image that stays a card, moves, loses its
 *   depth on the canvas, leaves the selection on the block that went (a stray
 *   toolbar on the canvas), or takes more than one undo step to come back.
 */
import type {
  AttachmentBlockModel,
  ImageBlockModel,
} from '@labre/affine/model';
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

/**
 * What a page image shows: `width` and `height` are the WHOLE picture, the crop its
 * visible share (ADR 0037).
 */
const shownInPage = ({ props: { width, height, crop } }: ImageBlockModel) => [
  (width ?? 0) * (crop?.w ?? 1),
  (height ?? 0) * (crop?.h ?? 1),
];

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

  test('Replace on the image toolbar keeps the frame and crops the picture to it, one undo step', async () => {
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
    expect(shownInPage(image)).toEqual([200, 200]);
    // A 4:1 picture in a square: the whole picture is four times the frame's width.
    expect([image.props.width, image.props.height]).toEqual([800, 200]);
    expect(image.props.crop).toBeTruthy();

    window.doc.undo();
    expect([image.props.width, image.props.height]).toEqual([200, 200]);
    expect(image.props.crop).toBeUndefined();
    expect(image.props.sourceId).not.toBe(host.assets.image!.sourceId);
  });
});

describe("the attachment card's Replace", () => {
  let host: ReturnType<typeof libraryHost>;
  let cleanup: () => void;

  const replaceFromToolbar = async (
    root: { widgetComponents: Record<string, unknown> },
    selector: string
  ) => {
    const entry = (
      root.widgetComponents[AFFINE_TOOLBAR_WIDGET] as
        | { toolbar?: HTMLElement }
        | undefined
    )?.toolbar?.querySelector<HTMLElement>(selector);
    expect(entry, 'the attachment toolbar has no Replace').toBeTruthy();
    await clickEntry(entry!);
    await settle();
  };

  const IN_PAGE = '[data-toolbar-action-id="c.replace"]';
  // On the canvas « Replace » is the menu an image has (ADR 0044, amendment of
  // 2026-11-04).
  const ON_CANVAS = '[data-testid="image-replace-with-image"]';

  const addHtmlCard = async (parent: string) => {
    const file = new Blob(['<p>a report</p>'], { type: 'text/html' });
    const sourceId = await window.doc.blobSync.set(file);
    return {
      sourceId,
      id: window.doc.addBlock(
        'affine:attachment',
        {
          name: 'report.html',
          type: 'text/html',
          size: file.size,
          sourceId,
        },
        parent
      ),
    };
  };

  describe('in a page', () => {
    let noteId: string;
    let std: BlockStdScope;

    beforeEach(async () => {
      host = libraryHost();
      cleanup = await setupEditor('page', [AssetPickerExtension(host.service)]);
      await host.stock();
      noteId = addNote(window.doc);
      std = window.editor.std;
      std.event.active = true;
      return () => cleanup();
    });

    const select = async (blockId: string) => {
      window.doc.captureSync();
      window.editor.host!.focus();
      std.selection.setGroup('note', [
        std.selection.create(BlockSelection, { blockId }),
      ]);
      await settle();
    };

    test('answered with an image, the card is an image block in its place, one undo step', async () => {
      // addNote already wrote the paragraph before the card.
      const { id, sourceId } = await addHtmlCard(noteId);
      window.doc.addBlock('affine:paragraph', {}, noteId);
      host.assets.file = host.assets.image;
      await select(id);
      const shown = std.view
        .getBlock(id)
        ?.querySelector<HTMLElement>('.affine-attachment-container');
      const frame = [shown?.offsetWidth, shown?.offsetHeight];
      expect(frame[0], 'the card was laid out').toBeGreaterThan(0);

      await replaceFromToolbar(
        getDocRootBlock(window.doc, window.editor, 'page'),
        IN_PAGE
      );

      const flavours = () =>
        window.doc.getBlock(noteId)!.model.children.map(c => c.flavour);
      expect(host.requests.at(-1)).toMatchObject({
        kind: 'file',
        mode: 'replace',
      });
      expect(window.doc.getBlock(id)).toBeFalsy();
      expect(flavours()).toEqual([
        'affine:paragraph',
        'affine:image',
        'affine:paragraph',
      ]);
      const image = window.doc.getBlock(noteId)!.model
        .children[1] as ImageBlockModel;
      expect(image.props.sourceId).toBe(host.assets.image!.sourceId);
      // The picture is the band the card was, whatever its own size: enlarged to the
      // card's width, then cropped to its height.
      expect(shownInPage(image)).toEqual(frame);
      expect(image.props.crop).toBeTruthy();
      expect(
        std.selection.filter(BlockSelection).map(s => s.blockId),
        'the selection follows the block'
      ).toEqual([image.id]);

      window.doc.undo();
      expect(flavours()).toEqual([
        'affine:paragraph',
        'affine:attachment',
        'affine:paragraph',
      ]);
      const card = window.doc.getBlock(noteId)!.model
        .children[1] as AttachmentBlockModel;
      expect(card.props.sourceId).toBe(sourceId);
      expect(card.props.name).toBe('report.html');
    });

    test('answered with a file, it stays a card; cancelled, nothing changes', async () => {
      const { id, sourceId } = await addHtmlCard(noteId);
      await select(id);
      const card = window.doc.getModelById(id) as AttachmentBlockModel;

      const pdf = host.assets.file;
      host.assets.file = undefined;
      await replaceFromToolbar(
        getDocRootBlock(window.doc, window.editor, 'page'),
        IN_PAGE
      );
      expect(card.props.sourceId).toBe(sourceId);

      host.assets.file = pdf;
      await replaceFromToolbar(
        getDocRootBlock(window.doc, window.editor, 'page'),
        IN_PAGE
      );
      expect(window.doc.getModelById(id)).toBe(card);
      expect(card.props.name).toBe('plan.pdf');
    });
  });

  test('on the canvas, the image takes its frame and its depth', async () => {
    host = libraryHost();
    cleanup = await setupEditor('edgeless', [
      AssetPickerExtension(host.service),
    ]);
    try {
      await host.stock();
      host.assets.file = host.assets.image;
      const edgeless = getDocRootBlock(window.doc, window.editor, 'edgeless');
      edgeless.std.event.active = true;
      const surfaceId = edgeless.service.surface.id;
      const file = new Blob(['<p>a report</p>'], { type: 'text/html' });
      const id = edgeless.service.crud.addBlock(
        'affine:attachment',
        {
          name: 'report.html',
          type: 'text/html',
          size: file.size,
          sourceId: await window.doc.blobSync.set(file),
          style: 'cubeThick',
          xywh: '[100,100,170,132]',
        },
        surfaceId
      )!;
      const above = edgeless.service.crud.addBlock(
        'affine:attachment',
        { name: 'above.pdf', type: 'application/pdf', xywh: '[0,0,170,132]' },
        surfaceId
      )!;
      const card = window.doc.getModelById(id) as AttachmentBlockModel;
      const { index } = card.props;
      window.doc.captureSync();
      edgeless.gfx.selection.set({ elements: [id], editing: false });
      await settle();

      await replaceFromToolbar(edgeless, ON_CANVAS);

      expect(window.doc.getBlock(id)).toBeFalsy();
      const [image] = window.doc.getModelsByFlavour(
        'affine:image'
      ) as ImageBlockModel[];
      expect(image?.props.xywh).toBe('[100,100,170,132]');
      expect(image?.props.crop).toBeTruthy();
      expect(image?.props.index).toBe(index);
      expect(
        edgeless.gfx.selection.selectedIds,
        'the selection follows the block'
      ).toEqual([image?.id]);
      expect(
        (window.doc.getModelById(above) as AttachmentBlockModel).props.index >
          index
      ).toBe(true);

      window.doc.undo();
      expect(window.doc.getModelsByFlavour('affine:image')).toHaveLength(0);
      expect(window.doc.getModelsByFlavour('affine:attachment')).toHaveLength(
        2
      );
    } finally {
      cleanup();
    }
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
  test('Replace keeps the frame of a canvas image and crops the picture to it', async () => {
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

      // On the canvas « Replace » is a menu (ADR 0044, amendments of 2026-10-27 and
      // 2026-11-04); its first entry asks the host.
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
      expect(image.props.xywh).toBe('[100,100,300,300]');
      expect(image.props.crop).toBeTruthy();

      window.doc.undo();
      expect(image.props.xywh).toBe('[100,100,300,300]');
      expect(image.props.crop).toBeUndefined();
      expect(image.props.sourceId).not.toBe(host.assets.image!.sourceId);
    } finally {
      cleanup();
    }
  });
});
