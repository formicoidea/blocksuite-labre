/**
 * ADR 0044 — « Replace with image » on a shape and « Replace with shape » on a
 * canvas image, on a real document (every store extension of the assembly).
 *
 * This spec would have caught:
 * - a replacement that lands elsewhere: another box, rotation, depth or user
 *   layer than the model it replaces (ADR 0031 §6 for the layer);
 * - a picture stretched to the shape's box instead of cut to it (the crop is
 *   the largest centred window of the box's proportions, ADR 0037), or a
 *   crop written for a picture that already has the box's proportions;
 * - a connector left pointing at the deleted id, a group or a frame that
 *   loses the member instead of swapping it;
 * - a gesture split into several undo steps (undo must give back the shape
 *   AND its connector), or a refusal that still pushes an empty undo step;
 * - a notation shape, a shape with text, a captioned image, a locked model
 *   or a read-only document being replaced;
 * - the commands emitting anything but kinds (`ElementReplaced`), plus
 *   `BlockCreated` for the image block shape → image inserts.
 */
import {
  imageReplaceCommands,
  REPLACE_IMAGE_WITH_SHAPE,
  REPLACE_SHAPE_WITH_IMAGE,
  replaceImageWithShape,
  replaceShapeWithImage,
} from '@labre/affine-block-image';
import {
  CanvasActiveLayer,
  type SurfaceBlockModel,
} from '@labre/affine-block-surface';
import { StoreExtensionManager } from '@labre/affine-ext-loader';
import type {
  ConnectorElementModel,
  FrameBlockModel,
  GroupElementModel,
  ImageBlockModel,
  ShapeElementModel,
} from '@labre/affine-model';
import {
  AssetPickerProvider,
  EditPropsStore,
  TelemetryProvider,
} from '@labre/affine-shared/services';
import { type BlockStdScope, runCommandAsync } from '@labre/std';
import { DEFAULT_LAYER_ID, GfxControllerIdentifier } from '@labre/std/gfx';
import { type Store, Text } from '@labre/store';
import { TestWorkspace } from '@labre/store/test';
import { describe, expect, test } from 'vitest';

import { getInternalStoreExtensions } from '../extensions/store.js';

let seq = 0;

function createBoard() {
  const id = `replace-${seq++}`;
  const manager = new StoreExtensionManager(getInternalStoreExtensions({}));
  const collection = new TestWorkspace({ id });
  collection.storeExtensions = manager.get('store');
  collection.meta.initialize();
  const store = collection.createDoc(id).getStore({ id });
  let surfaceId = '';
  store.load(() => {
    const rootId = store.addBlock('affine:page', { title: new Text('r') });
    surfaceId = store.addBlock('affine:surface', {}, rootId);
  });
  const surface = store.getBlock(surfaceId)!.model as SurfaceBlockModel;
  surface.props.layers = {
    [DEFAULT_LAYER_ID]: { name: 'Layer 1', index: 'a0' },
    top: { name: 'Layer 2', index: 'a1' },
  };
  return { store, surface };
}

function mount(store: Store, surface: SurfaceBlockModel) {
  const events: { name: string; props: Record<string, unknown> }[] = [];
  const selected: string[] = [];
  const getElementById = (id: string) =>
    surface.getElementById(id) ?? store.getModelById(id) ?? null;
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
  const services = new Map<unknown, unknown>();
  const std = {
    store,
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
  return { std, events, selected, services };
}

const PICTURE = { sourceId: 'blob-1', size: 1234, width: 400, height: 400 };

function shapeScene() {
  const { store, surface } = createBoard();
  const shapeId = surface.addElement({
    type: 'shape',
    xywh: '[10,20,200,100]',
    rotate: 30,
    index: 'a5',
    layer: 'top',
  });
  const other = surface.addElement({ type: 'shape', xywh: '[400,0,10,10]' });
  const connectorId = surface.addElement({
    type: 'connector',
    source: { id: shapeId, position: [1, 0.5] },
    target: { id: other },
  });
  const grouped = surface.addElement({ type: 'shape', xywh: '[0,300,50,50]' });
  const sibling = surface.addElement({ type: 'shape', xywh: '[60,300,5,5]' });
  const groupId = surface.addElement({
    type: 'group',
    children: { [grouped]: true, [sibling]: true },
  });
  const frameId = store.addBlock(
    'affine:frame',
    {
      xywh: '[-100,-100,600,600]',
      childElementIds: { [shapeId]: true },
    },
    surface.id
  );
  store.resetHistory();
  const shape = surface.getElementById(shapeId) as ShapeElementModel;
  return {
    store,
    surface,
    shape,
    shapeId,
    connectorId,
    grouped,
    groupId,
    frameId,
  };
}

function watchUpdates(store: Store) {
  const updates: Uint8Array[] = [];
  store.doc.spaceDoc.on('update', update => updates.push(update));
  return updates;
}

describe('replace a shape with an image', () => {
  test('takes the place, depth, layer, connector and frame of the shape', () => {
    const { store, surface, shape, shapeId, connectorId, frameId } =
      shapeScene();
    const { std } = mount(store, surface);

    const id = replaceShapeWithImage(std, shape, PICTURE)!;

    expect(id).toBeTruthy();
    expect(surface.getElementById(shapeId)).toBeNull();
    const image = store.getModelById(id) as ImageBlockModel;
    expect(image.flavour).toBe('affine:image');
    expect(image.parent?.id).toBe(surface.id);
    expect(image.props.xywh).toBe('[10,20,200,100]');
    expect(image.props.rotate).toBe(30);
    expect(image.props.index).toBe('a5');
    expect(image.props.layer).toBe('top');
    expect(image.props.sourceId).toBe('blob-1');
    expect(image.props.width).toBe(400);
    expect(image.props.height).toBe(400);
    // A 2:1 box on a square picture: the whole width, the middle half.
    const crop = image.props.crop!;
    expect(crop.x).toBeCloseTo(0, 6);
    expect(crop.y).toBeCloseTo(0.25, 6);
    expect(crop.w).toBeCloseTo(1, 6);
    expect(crop.h).toBeCloseTo(0.5, 6);
    expect(crop.mask).toBeUndefined();

    const connector = surface.getElementById(
      connectorId
    ) as ConnectorElementModel;
    expect(connector.source.id).toBe(id);
    expect(connector.source.position).toEqual([1, 0.5]);

    const frame = store.getModelById(frameId) as FrameBlockModel;
    expect(frame.childIds).toEqual([id]);
  });

  test('swaps a group member in place, and writes no crop it does not need', () => {
    const { store, surface, grouped, groupId } = shapeScene();
    const { std } = mount(store, surface);
    const shape = surface.getElementById(grouped) as ShapeElementModel;

    const id = replaceShapeWithImage(std, shape, PICTURE)!;

    const group = surface.getElementById(groupId) as GroupElementModel;
    expect(group.childIds).toContain(id);
    expect(group.childIds).not.toContain(grouped);
    // A square box on a square picture: the whole image, so no key.
    const yBlock = store.doc.spaceDoc.getMap('blocks').get(id) as {
      has: (key: string) => boolean;
    };
    expect(yBlock.has('prop:crop')).toBe(false);
  });

  test('is one undo step: undo gives back the shape and its connector', () => {
    const { store, surface, shape, shapeId, connectorId, frameId } =
      shapeScene();
    const { std } = mount(store, surface);

    const id = replaceShapeWithImage(std, shape, PICTURE)!;
    store.undo();

    expect(store.getModelById(id)).toBeNull();
    expect(surface.getElementById(shapeId)).not.toBeNull();
    const connector = surface.getElementById(
      connectorId
    ) as ConnectorElementModel;
    expect(connector.source.id).toBe(shapeId);
    expect((store.getModelById(frameId) as FrameBlockModel).childIds).toEqual([
      shapeId,
    ]);
    expect(store.canUndo).toBe(false);
  });

  const refusals: [string, (shape: ShapeElementModel, store: Store) => void][] =
    [
      ['a read-only document', (_, store) => (store.readonly = true)],
      ['a locked shape', shape => (shape.lockedBySelf = true)],
      ['a notation shape', shape => (shape.role = 'wardley:component')],
      [
        'a shape with text',
        shape => shape.surface.updateElement(shape.id, { text: 'Hello' }),
      ],
    ];

  test.each(refusals)('refuses %s and writes nothing', (_, arrange) => {
    const { store, surface, shape, shapeId } = shapeScene();
    const { std } = mount(store, surface);
    arrange(shape, store);
    store.resetHistory();
    const updates = watchUpdates(store);

    expect(replaceShapeWithImage(std, shape, PICTURE)).toBeNull();

    expect(updates).toHaveLength(0);
    expect(store.canUndo).toBe(false);
    expect(surface.getElementById(shapeId)).not.toBeNull();
  });
});

describe('replace an image with a shape', () => {
  function imageScene() {
    const { store, surface } = createBoard();
    const imageId = store.addBlock(
      'affine:image',
      {
        sourceId: 'blob-1',
        width: 400,
        height: 400,
        xywh: '[10,20,200,100]',
        rotate: 45,
        index: 'a7',
        layer: 'top',
        crop: { x: 0, y: 0.25, w: 1, h: 0.5 },
      },
      surface.id
    );
    const other = surface.addElement({ type: 'shape', xywh: '[400,0,10,10]' });
    const connectorId = surface.addElement({
      type: 'connector',
      source: { id: other },
      target: { id: imageId },
    });
    // A second, unrotated image in a group: a group's bound of a ROTATED
    // member needs `DOMQuad`, which happy-dom does not have.
    const groupedId = store.addBlock(
      'affine:image',
      { sourceId: 'blob-1', width: 10, height: 10, xywh: '[0,0,10,10]' },
      surface.id
    );
    const sibling = surface.addElement({ type: 'shape', xywh: '[0,0,5,5]' });
    const groupId = surface.addElement({
      type: 'group',
      children: { [groupedId]: true, [sibling]: true },
    });
    store.resetHistory();
    const image = store.getModelById(imageId) as ImageBlockModel;
    return { store, surface, image, imageId, connectorId, groupId, groupedId };
  }

  test('puts a rectangle at its place, depth, layer and connector; one undo step', () => {
    const { store, surface, image, imageId, connectorId } = imageScene();
    const { std } = mount(store, surface);

    const id = replaceImageWithShape(std, image)!;

    expect(store.getModelById(imageId)).toBeNull();
    const shape = surface.getElementById(id) as ShapeElementModel;
    expect(shape.type).toBe('shape');
    expect(shape.shapeType).toBe('rect');
    expect(shape.xywh).toBe('[10,20,200,100]');
    expect(shape.rotate).toBe(45);
    expect(shape.index).toBe('a7');
    expect(shape.layer).toBe('top');
    const connector = surface.getElementById(
      connectorId
    ) as ConnectorElementModel;
    expect(connector.target.id).toBe(id);

    store.undo();
    expect(store.getModelById(imageId)).not.toBeNull();
    expect(surface.getElementById(id)).toBeNull();
    expect(
      (surface.getElementById(connectorId) as ConnectorElementModel).target.id
    ).toBe(imageId);
    expect(store.canUndo).toBe(false);
  });

  test('swaps a group member in place', () => {
    const { store, surface, groupId, groupedId } = imageScene();
    const { std } = mount(store, surface);
    const grouped = store.getModelById(groupedId) as ImageBlockModel;

    const id = replaceImageWithShape(std, grouped)!;

    const group = surface.getElementById(groupId) as GroupElementModel;
    expect(group.childIds).toContain(id);
    expect(group.childIds).not.toContain(groupedId);
  });

  const refusals: [string, (image: ImageBlockModel) => void][] = [
    [
      'a captioned image',
      image => image.store.updateBlock(image, { caption: 'A caption' }),
    ],
    [
      'a locked image',
      image => image.store.updateBlock(image, { lockedBySelf: true }),
    ],
    ['a read-only document', image => (image.store.readonly = true)],
  ];

  test.each(refusals)('refuses %s and writes nothing', (_, arrange) => {
    const { store, surface, image, imageId } = imageScene();
    const { std } = mount(store, surface);
    arrange(image);
    store.resetHistory();
    const updates = watchUpdates(store);

    expect(replaceImageWithShape(std, image)).toBeNull();

    expect(updates).toHaveLength(0);
    expect(store.canUndo).toBe(false);
    expect(store.getModelById(imageId)).not.toBeNull();
  });
});

describe('the commands', () => {
  const INVOCATION = {
    surface: 'contextual-toolbar',
    source: 'toolbar:general',
  } as const;
  const command = (id: string) => imageReplaceCommands.find(c => c.id === id)!;

  test('shape → image asks the host for one picture and reports kinds only', async () => {
    const { store, surface, shapeId } = shapeScene();
    const { std, events, selected, services } = mount(store, surface);
    const requests: unknown[] = [];
    services.set(AssetPickerProvider, {
      pick: async (request: unknown) => {
        requests.push(request);
        return [{ ...PICTURE, type: 'image/png' }];
      },
    });
    selected.push(shapeId);

    await runCommandAsync(std, command(REPLACE_SHAPE_WITH_IMAGE), INVOCATION);

    expect(requests).toEqual([
      { kind: 'image', mode: 'replace', multiple: false, docId: store.id },
    ]);
    expect(surface.getElementById(shapeId)).toBeNull();
    expect(selected).toHaveLength(1);
    expect(store.getModelById(selected[0])?.flavour).toBe('affine:image');
    expect(events).toEqual([
      {
        name: 'BlockCreated',
        props: {
          page: 'whiteboard editor',
          blockType: 'affine:image',
          control: 'toolbar:general',
          module: 'contextual-toolbar',
        },
      },
      {
        name: 'ElementReplaced',
        props: {
          page: 'whiteboard editor',
          from: 'shape',
          to: 'image',
          control: 'toolbar:general',
          module: 'contextual-toolbar',
        },
      },
    ]);
  });

  test('a cancelled picker writes and reports nothing', async () => {
    const { store, surface, shapeId } = shapeScene();
    const { std, events, selected, services } = mount(store, surface);
    services.set(AssetPickerProvider, { pick: async () => null });
    selected.push(shapeId);

    await runCommandAsync(std, command(REPLACE_SHAPE_WITH_IMAGE), INVOCATION);

    expect(surface.getElementById(shapeId)).not.toBeNull();
    expect(store.canUndo).toBe(false);
    expect(events).toEqual([]);
  });

  test('image → shape is offered for an image only, and acts on the selection', async () => {
    const { store, surface, shapeId } = shapeScene();
    const { std, events, selected } = mount(store, surface);
    const toShape = command(REPLACE_IMAGE_WITH_SHAPE);
    const toImage = command(REPLACE_SHAPE_WITH_IMAGE);
    selected.push(shapeId);
    expect(toShape.when!(std)).toBe(false);
    expect(toImage.when!(std)).toBe(true);

    const shape = surface.getElementById(shapeId) as ShapeElementModel;
    replaceShapeWithImage(std, shape, PICTURE);
    selected.splice(0, 1, store.getModelsByFlavour('affine:image')[0].id);
    expect(toShape.when!(std)).toBe(true);
    expect(toImage.when!(std)).toBe(false);

    await runCommandAsync(std, toShape, INVOCATION);

    expect(surface.getElementById(selected[0])?.type).toBe('shape');
    expect(events).toEqual([
      {
        name: 'ElementReplaced',
        props: {
          page: 'whiteboard editor',
          from: 'image',
          to: 'shape',
          control: 'toolbar:general',
          module: 'contextual-toolbar',
        },
      },
    ]);
  });
});
