/**
 * Anything replaces anything, in the frame of what it replaces (ADR 0044, amendment of
 * 2026-11-04), on a real document (every store extension of the assembly).
 *
 * This spec would have caught:
 * - a replacement that lands elsewhere: another box, rotation, depth or layer on a
 *   canvas, another place in a note; the corner of the product owner's recette, a file
 *   of 752 x 544 turning into a picture of 460 x 230;
 * - a picture distorted to the frame, or an html view opened at its own default size;
 * - a connector left on the deleted id, a gesture split into two undo steps;
 * - a caption lost between an image and an attachment, or to a shape (refused);
 * - an element replaced while locked, or a citation's card;
 * - telemetry other than kinds, or a block inserted without its `BlockCreated`.
 */
import {
  attachmentReplaceCommands,
  REPLACE_ATTACHMENT,
  REPLACE_ATTACHMENT_WITH_SHAPE,
  replaceAttachmentFile,
} from '@labre/affine-block-attachment';
import {
  imageReplaceCommands,
  REPLACE_IMAGE_WITH_IMAGE,
  REPLACE_SHAPE_WITH_IMAGE,
  replaceWithAnswer,
} from '@labre/affine-block-image';
import type { SurfaceBlockModel } from '@labre/affine-block-surface';
import { StoreExtensionManager } from '@labre/affine-ext-loader';
import type {
  AttachmentBlockModel,
  ConnectorElementModel,
  ImageBlockModel,
  ShapeElementModel,
} from '@labre/affine-model';
import {
  type AssetRef,
  AssetPickerProvider,
  EditPropsStore,
  HtmlFileConfigExtension,
  TelemetryProvider,
} from '@labre/affine-shared/services';
import { type BlockStdScope, runCommandAsync } from '@labre/std';
import { DEFAULT_LAYER_ID, GfxControllerIdentifier } from '@labre/std/gfx';
import { CanvasActiveLayer } from '@labre/affine-block-surface';
import { Text } from '@labre/store';
import { TestWorkspace } from '@labre/store/test';
import { describe, expect, test, vi } from 'vitest';

import { getInternalStoreExtensions } from '../extensions/store.js';

vi.mock('@labre/affine-components/toast', () => ({ toast: vi.fn() }));

const FRAME = '[10,20,752,544]';
const INVOCATION = {
  surface: 'contextual-toolbar',
  source: 'toolbar:general',
} as const;
const PICTURE = { sourceId: 'pic', size: 9, width: 400, height: 400 };
const PDF = {
  sourceId: 'pdf',
  name: 'plan.pdf',
  type: 'application/pdf',
  size: 7,
};
const HTML = { sourceId: 'htm', name: 'a.html', type: 'text/html', size: 5 };
const OLD_FILE = {
  sourceId: 'old',
  name: 'old.pdf',
  type: 'application/pdf',
  size: 1,
};

let seq = 0;

function scene(services = new Map<unknown, unknown>()) {
  const id = `replace-any-${seq++}`;
  const manager = new StoreExtensionManager(getInternalStoreExtensions({}));
  const collection = new TestWorkspace({ id });
  collection.storeExtensions = manager.get('store');
  collection.meta.initialize();
  const store = collection.createDoc(id).getStore({ id });
  let surfaceId = '';
  let noteId = '';
  store.load(() => {
    const rootId = store.addBlock('affine:page', { title: new Text('r') });
    surfaceId = store.addBlock('affine:surface', {}, rootId);
    noteId = store.addBlock('affine:note', {}, rootId);
  });
  const surface = store.getBlock(surfaceId)!.model as SurfaceBlockModel;
  surface.props.layers = {
    [DEFAULT_LAYER_ID]: { name: 'Layer 1', index: 'a0' },
    top: { name: 'Layer 2', index: 'a1' },
  };

  const events: { name: string; props: Record<string, unknown> }[] = [];
  const selected: string[] = [];
  const getElementById = (elementId: string) =>
    surface.getElementById(elementId) ?? store.getModelById(elementId) ?? null;
  const gfx = {
    surface,
    getElementById,
    selection: {
      get selectedElements() {
        return selected.map(getElementById).filter(Boolean);
      },
      set({ elements }: { elements: string[] }) {
        selected.splice(0, selected.length, ...elements);
      },
    },
  };
  const std = {
    store,
    host: {},
    selection: { create: (_: unknown, v: unknown) => v, setGroup: vi.fn() },
    get: (identifier: unknown) =>
      identifier === GfxControllerIdentifier ? gfx : services.get(identifier),
    getOptional: (identifier: unknown) => services.get(identifier) ?? null,
  } as unknown as BlockStdScope;
  services.set(EditPropsStore, new EditPropsStore(std));
  services.set(CanvasActiveLayer, new CanvasActiveLayer(std));
  services.set(TelemetryProvider, {
    track: (name: string, props: Record<string, unknown>) =>
      events.push({ name, props }),
  });
  return { store, surface, noteId, std, events, selected, services };
}

/** A card of 752 x 544 on the canvas, a connector on it, selected. */
function canvasFile(extra: Record<string, unknown> = {}) {
  const parts = scene();
  const { store, surface, selected } = parts;
  const fileId = store.addBlock(
    'affine:attachment',
    {
      ...OLD_FILE,
      xywh: FRAME,
      rotate: 15,
      index: 'a7',
      layer: 'top',
      caption: 'kept',
      ...extra,
    },
    surface
  );
  const other = surface.addElement({ type: 'shape', xywh: '[900,0,10,10]' });
  const connectorId = surface.addElement({
    type: 'connector',
    source: { id: fileId, position: [1, 0.5] },
    target: { id: other },
  });
  store.resetHistory();
  selected.splice(0, selected.length, fileId);
  const file = store.getModelById(fileId) as AttachmentBlockModel;
  return { ...parts, file, fileId, connectorId };
}

function command(id: string) {
  const found = [...attachmentReplaceCommands, ...imageReplaceCommands].find(
    c => c.id === id
  );
  if (!found) throw new Error(`no command ${id}`);
  return found;
}

const answering = (ref: AssetRef) => ({ pick: async () => [ref] });

describe('on a canvas, what arrives takes the frame', () => {
  test('a picture in place of a file keeps the 752 x 544, cut, and the rest', () => {
    const { store, surface, std, file, fileId, connectorId } = canvasFile();

    const id = replaceWithAnswer(std, file, {
      kind: 'image',
      source: PICTURE,
    })!;

    const image = store.getModelById(id) as ImageBlockModel;
    expect(image.flavour).toBe('affine:image');
    expect(image.props.xywh).toBe(FRAME);
    expect(image.props.rotate).toBe(15);
    expect(image.props.index).toBe('a7');
    expect(image.props.layer).toBe('top');
    expect(image.props.caption).toBe('kept');
    // The natural size: `xywh` alone is the box on a canvas (ADR 0037).
    expect([image.props.width, image.props.height]).toEqual([400, 400]);
    const crop = image.props.crop!;
    expect((crop.w * 400) / (crop.h * 400)).toBeCloseTo(752 / 544);
    expect(store.getModelById(fileId)).toBeNull();
    const connector = surface.getElementById(
      connectorId
    ) as ConnectorElementModel;
    expect(connector.source.id).toBe(id);

    store.undo();
    expect(store.getModelById(fileId)).not.toBeNull();
    expect(store.getModelById(id)).toBeNull();
    expect(store.canUndo).toBe(false);
  });

  test('a file in place of a picture is a card of the frame, caption kept', () => {
    const { store, surface, std } = scene();
    const imageId = store.addBlock(
      'affine:image',
      { ...PICTURE, xywh: FRAME, caption: 'kept' },
      surface
    );
    store.resetHistory();
    const image = store.getModelById(imageId) as ImageBlockModel;

    const id = replaceWithAnswer(std, image, { kind: 'file', source: PDF })!;

    const file = store.getModelById(id) as AttachmentBlockModel;
    expect(file.flavour).toBe('affine:attachment');
    expect(file.props.xywh).toBe(FRAME);
    expect(file.props.embed).toBe(false);
    expect(file.props.style).toBe('cubeThick');
    expect(file.props.caption).toBe('kept');
    expect(file.props.name).toBe('plan.pdf');
  });

  test('a shape takes a file, in a band when its frame is wide', () => {
    const { store, surface, std } = scene();
    const shapeId = surface.addElement({
      type: 'shape',
      xywh: '[0,0,400,60]',
    });
    const shape = surface.getElementById(shapeId) as ShapeElementModel;

    const id = replaceWithAnswer(std, shape, { kind: 'file', source: PDF })!;

    const file = store.getModelById(id) as AttachmentBlockModel;
    expect(file.props.xywh).toBe('[0,0,400,60]');
    expect(file.props.style).toBe('horizontalThin');
    expect(surface.getElementById(shapeId)).toBeNull();
  });

  test('an html file opens on its view, at the size of the frame', () => {
    const { store, surface, std, services } = scene();
    services.set(HtmlFileConfigExtension.identifier, { frameUrl: '/frame' });
    const shapeId = surface.addElement({ type: 'shape', xywh: FRAME });
    const shape = surface.getElementById(shapeId) as ShapeElementModel;

    const id = replaceWithAnswer(std, shape, { kind: 'file', source: HTML })!;

    const file = store.getModelById(id) as AttachmentBlockModel;
    expect(file.props.embed).toBe(true);
    expect((file.props.style as string) === 'html').toBe(true);
    expect(file.props.xywh).toBe(FRAME);
  });

  test('another file stays in the same block, and a view gives way to the frame', () => {
    const { store, std, file, fileId } = canvasFile();
    // The embed service, as `convertTo` really does: its own size.
    const provider = {
      embedded: () => true,
      convertTo: (model: AttachmentBlockModel) =>
        store.updateBlock(model, {
          embed: true,
          style: 'html' as never,
          xywh: '[0,0,1,1]',
        }),
    };
    const stdWithProvider = {
      ...std,
      store,
      view: undefined,
      get: () => provider,
    } as unknown as BlockStdScope;

    expect(replaceAttachmentFile(stdWithProvider, file, HTML)).toBe(fileId);

    expect(file.props.sourceId).toBe('htm');
    expect(file.props.xywh).toBe(FRAME);
    expect(file.props.caption).toBe('kept');
    store.undo();
    expect(file.props.sourceId).toBe('old');
    expect(store.canUndo).toBe(false);
  });
});

describe('in a page', () => {
  function pageScene() {
    const parts = scene();
    const { store, noteId } = parts;
    const before = store.addBlock(
      'affine:paragraph',
      { text: new Text('before') },
      noteId
    );
    return { ...parts, before };
  }
  const flavours = (store: ReturnType<typeof scene>['store'], id: string) =>
    store.getModelById(id)!.children.map(m => m.flavour);

  test('a file takes the place of an image, in its note, caption kept', () => {
    const { store, noteId, std } = pageScene();
    const imageId = store.addBlock(
      'affine:image',
      { ...PICTURE, width: 300, height: 150, caption: 'kept' },
      noteId
    );
    store.addBlock('affine:paragraph', { text: new Text('after') }, noteId);
    const image = store.getModelById(imageId) as ImageBlockModel;

    const id = replaceWithAnswer(std, image, { kind: 'file', source: PDF })!;

    expect(flavours(store, noteId)).toEqual([
      'affine:paragraph',
      'affine:attachment',
      'affine:paragraph',
    ]);
    expect((store.getModelById(id) as AttachmentBlockModel).props.caption).toBe(
      'kept'
    );
    store.undo();
    expect(flavours(store, noteId)).toEqual([
      'affine:paragraph',
      'affine:image',
      'affine:paragraph',
    ]);
  });

  test('an html view takes the height of the image it replaces', () => {
    const { store, noteId, std, services } = pageScene();
    services.set(HtmlFileConfigExtension.identifier, { frameUrl: '/frame' });
    const imageId = store.addBlock(
      'affine:image',
      { ...PICTURE, width: 300, height: 150 },
      noteId
    );
    const image = store.getModelById(imageId) as ImageBlockModel;

    const id = replaceWithAnswer(std, image, { kind: 'file', source: HTML })!;

    const file = store.getModelById(id) as AttachmentBlockModel;
    expect(file.props.embed).toBe(true);
    expect(file.props.xywh).toBe('[0,0,300,150]');
  });

  test('a picture takes the size a file card shows, low as it is', () => {
    const { store, noteId, std } = pageScene();
    const fileId = store.addBlock('affine:attachment', OLD_FILE, noteId);
    const file = store.getModelById(fileId) as AttachmentBlockModel;
    const shown = { offsetWidth: 700, offsetHeight: 56 };
    const laidOut = {
      ...std,
      store,
      selection: std.selection,
      get: std.get,
      getOptional: std.getOptional,
      view: { getBlock: () => ({ querySelector: () => shown }) },
    } as unknown as BlockStdScope;

    const id = replaceWithAnswer(laidOut, file, {
      kind: 'image',
      source: PICTURE,
    })!;

    const image = store.getModelById(id) as ImageBlockModel;
    const crop = image.props.crop!;
    expect((image.props.width ?? 0) * crop.w).toBeCloseTo(700);
    expect((image.props.height ?? 0) * crop.h).toBeCloseTo(56);
  });
});

describe('what is refused writes nothing', () => {
  test('a locked file', () => {
    const { store, std, file, fileId } = canvasFile({ lockedBySelf: true });
    expect(
      replaceWithAnswer(std, file, { kind: 'image', source: PICTURE })
    ).toBeNull();
    expect(store.getModelById(fileId)).not.toBeNull();
    expect(store.canUndo).toBe(false);
  });

  test('a read-only document', () => {
    const { store, std, file } = canvasFile();
    store.readonly = true;
    expect(
      replaceWithAnswer(std, file, { kind: 'image', source: PICTURE })
    ).toBeNull();
  });

  test('a citation, whose card its footnote holds', () => {
    const { std } = canvasFile({ footnoteIdentifier: '1' });
    expect(command(REPLACE_ATTACHMENT).when!(std)).toBe(false);
  });

  test('a caption would be lost to a shape: the entry is hidden', async () => {
    const { store, std, fileId } = canvasFile();
    expect(command(REPLACE_ATTACHMENT).when!(std)).toBe(true);
    expect(command(REPLACE_ATTACHMENT_WITH_SHAPE).when!(std)).toBe(false);
    await runCommandAsync(
      std,
      command(REPLACE_ATTACHMENT_WITH_SHAPE),
      INVOCATION
    );
    expect(store.getModelById(fileId)).not.toBeNull();
    expect(store.canUndo).toBe(false);
  });
});

describe('the commands', () => {
  test('a file becomes a shape, in its frame, reporting kinds only', async () => {
    const { surface, std, events, selected } = canvasFile({
      caption: undefined,
    });

    await runCommandAsync(
      std,
      command(REPLACE_ATTACHMENT_WITH_SHAPE),
      INVOCATION
    );

    const shape = surface.getElementById(selected[0]!) as ShapeElementModel;
    expect(shape.xywh).toBe(FRAME);
    expect(events).toEqual([
      {
        name: 'ElementReplaced',
        props: {
          page: 'whiteboard editor',
          from: 'attachment',
          to: 'shape',
          control: 'toolbar:general',
          module: 'contextual-toolbar',
        },
      },
    ]);
  });

  test('a file answers an image: a new block, selected and reported', async () => {
    const { store, std, events, selected, services, fileId } = canvasFile();
    services.set(
      AssetPickerProvider,
      answering({ ...PICTURE, name: 'p.png', type: 'image/png' })
    );

    await runCommandAsync(std, command(REPLACE_ATTACHMENT), INVOCATION);

    expect(store.getModelById(fileId)).toBeNull();
    expect(store.getModelById(selected[0]!)?.flavour).toBe('affine:image');
    expect(events.map(e => [e.name, e.props.blockType ?? e.props.to])).toEqual([
      ['BlockCreated', 'affine:image'],
      ['ElementReplaced', 'image'],
    ]);
  });

  test('a shape and an image answer a file through their own entries', async () => {
    const { store, surface, std, events, selected, services } = scene();
    services.set(AssetPickerProvider, answering(PDF));
    const shapeId = surface.addElement({ type: 'shape', xywh: FRAME });
    selected.splice(0, selected.length, shapeId);

    await runCommandAsync(std, command(REPLACE_SHAPE_WITH_IMAGE), INVOCATION);
    expect(store.getModelById(selected[0]!)?.flavour).toBe('affine:attachment');
    expect(events.at(-1)?.props).toMatchObject({
      from: 'shape',
      to: 'attachment',
    });

    const imageId = store.addBlock(
      'affine:image',
      { ...PICTURE, xywh: FRAME },
      surface
    );
    selected.splice(0, selected.length, imageId);
    await runCommandAsync(std, command(REPLACE_IMAGE_WITH_IMAGE), INVOCATION);
    expect(store.getModelById(imageId)).toBeNull();
    expect(events.at(-1)?.props).toMatchObject({
      from: 'image',
      to: 'attachment',
    });
  });

  test('a cancelled dialog reports nothing', async () => {
    const { std, events, services } = canvasFile();
    services.set(AssetPickerProvider, { pick: async () => null });
    await runCommandAsync(std, command(REPLACE_ATTACHMENT), INVOCATION);
    expect(events).toEqual([]);
  });
});
