import { Bound } from '@labre/global/gfx';
import {
  createAutoIncrementIdGenerator,
  TestWorkspace,
} from '@labre/store/test';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

import { effects } from '../../effects.js';
import { GfxControllerIdentifier } from '../../gfx/identifiers.js';
import { TestEditorContainer } from '../test-editor.js';
import {
  RootBlockSchemaExtension,
  type SurfaceBlockModel,
  SurfaceBlockSchemaExtension,
  TestGfxBlockSchemaExtension,
} from '../test-schema.js';
import { testSpecs } from '../test-spec.js';

effects();

const extensions = [
  RootBlockSchemaExtension,
  SurfaceBlockSchemaExtension,
  TestGfxBlockSchemaExtension,
];

function createTestOptions() {
  const idGenerator = createAutoIncrementIdGenerator();
  return { id: 'test-collection', idGenerator };
}

const commonSetup = async () => {
  const collection = new TestWorkspace(createTestOptions());

  collection.meta.initialize();
  const doc = collection.createDoc('home');
  const store = doc.getStore({ extensions });
  doc.load();

  const rootId = store.addBlock('test:page');
  const surfaceId = store.addBlock('test:surface', {}, rootId);

  const surfaceBlock = store.getBlock(surfaceId)!;

  const editorContainer = new TestEditorContainer();
  editorContainer.doc = store;
  editorContainer.specs = testSpecs;
  document.body.append(editorContainer);

  await editorContainer.updateComplete;

  const gfx = editorContainer.std.get(GfxControllerIdentifier);

  return {
    gfx,
    store,
    editorContainer,
    surfaceId,
    rootId,
    surfaceModel: surfaceBlock.model as SurfaceBlockModel,
  };
};

describe('gfx element highlight', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    document.body.innerHTML = '';
  });

  test('should expose the api on the gfx controller', async () => {
    const { gfx } = await commonSetup();

    expect(typeof gfx.highlightElements).toBe('function');
    expect(gfx.highlight).toBeDefined();
    expect(gfx.highlight.highlighted$.value).toEqual([]);
  });

  test('should highlight the given elements and auto clear', async () => {
    const { gfx, surfaceModel } = await commonSetup();

    const first = surfaceModel.addElement({ type: 'testShape' });
    const second = surfaceModel.addElement({ type: 'testShape' });

    gfx.highlightElements([first, second]);

    expect(gfx.highlight.highlighted$.value).toEqual([first, second]);
    expect(gfx.highlight.highlightedElements).toHaveLength(2);

    // still visible right before the default duration elapses
    vi.advanceTimersByTime(1999);
    expect(gfx.highlight.highlighted$.value).toEqual([first, second]);

    vi.advanceTimersByTime(1);
    expect(gfx.highlight.highlighted$.value).toEqual([]);
    expect(gfx.highlight.highlightedElements).toEqual([]);
  });

  test('should honor a custom duration', async () => {
    const { gfx, surfaceModel } = await commonSetup();

    const id = surfaceModel.addElement({ type: 'testShape' });

    gfx.highlightElements([id], { duration: 50 });
    expect(gfx.highlight.highlighted$.value).toEqual([id]);

    vi.advanceTimersByTime(50);
    expect(gfx.highlight.highlighted$.value).toEqual([]);
  });

  test('should keep the highlight forever when duration is 0', async () => {
    const { gfx, surfaceModel } = await commonSetup();

    const id = surfaceModel.addElement({ type: 'testShape' });

    gfx.highlightElements([id], { duration: 0 });

    vi.advanceTimersByTime(100_000);
    expect(gfx.highlight.highlighted$.value).toEqual([id]);

    gfx.highlight.clear();
    expect(gfx.highlight.highlighted$.value).toEqual([]);
  });

  test('a second call should replace the previous highlight and restart the timer', async () => {
    const { gfx, surfaceModel } = await commonSetup();

    const first = surfaceModel.addElement({ type: 'testShape' });
    const second = surfaceModel.addElement({ type: 'testShape' });

    gfx.highlightElements([first], { duration: 100 });
    vi.advanceTimersByTime(80);

    gfx.highlightElements([second], { duration: 100 });
    expect(gfx.highlight.highlighted$.value).toEqual([second]);

    // the first timer must not clear the second highlight
    vi.advanceTimersByTime(80);
    expect(gfx.highlight.highlighted$.value).toEqual([second]);

    vi.advanceTimersByTime(20);
    expect(gfx.highlight.highlighted$.value).toEqual([]);
  });

  test('should highlight gfx blocks as well as canvas elements', async () => {
    const { gfx, store, surfaceId, surfaceModel } = await commonSetup();

    const elementId = surfaceModel.addElement({ type: 'testShape' });
    const blockId = store.addBlock(
      'test:gfx-block',
      { xywh: '[0,0,100,100]' },
      surfaceId
    );

    gfx.highlightElements([elementId, blockId]);

    expect(gfx.highlight.highlighted$.value).toEqual([elementId, blockId]);
  });

  test('should ignore unknown ids and non gfx blocks', async () => {
    const { gfx, rootId, surfaceModel } = await commonSetup();

    const id = surfaceModel.addElement({ type: 'testShape' });

    gfx.highlightElements([id, 'does-not-exist', rootId]);

    expect(gfx.highlight.highlighted$.value).toEqual([id]);
  });

  test('should clear when none of the ids resolves', async () => {
    const { gfx, surfaceModel } = await commonSetup();

    const id = surfaceModel.addElement({ type: 'testShape' });

    gfx.highlightElements([id], { duration: 0 });
    gfx.highlightElements(['nope', 'nope-either']);

    expect(gfx.highlight.highlighted$.value).toEqual([]);
  });

  test('should drop elements deleted while highlighted', async () => {
    const { gfx, surfaceModel } = await commonSetup();

    const first = surfaceModel.addElement({ type: 'testShape' });
    const second = surfaceModel.addElement({ type: 'testShape' });

    gfx.highlightElements([first, second], { duration: 0 });
    surfaceModel.deleteElement(first);

    expect(gfx.highlight.highlightedElements.map(e => e.id)).toEqual([second]);
  });

  test('should not mutate the document', async () => {
    const { gfx, store, surfaceModel } = await commonSetup();

    const id = surfaceModel.addElement({ type: 'testShape' });

    const updates: unknown[] = [];
    const onUpdate = (update: Uint8Array) => updates.push(update);
    store.spaceDoc.on('update', onUpdate);

    gfx.highlightElements([id], { reframe: true });
    vi.advanceTimersByTime(5000);

    store.spaceDoc.off('update', onUpdate);

    expect(updates).toEqual([]);
    // and no persisted selection either
    expect(gfx.selection.surfaceSelections).toEqual([]);
  });

  test('should work on a readonly store', async () => {
    const { gfx, store, surfaceModel } = await commonSetup();

    const id = surfaceModel.addElement({ type: 'testShape' });
    store.readonly = true;

    gfx.highlightElements([id], { duration: 0 });

    expect(store.readonly).toBe(true);
    expect(gfx.highlight.highlighted$.value).toEqual([id]);
  });

  test('should reframe the viewport only when asked', async () => {
    const { gfx, surfaceModel } = await commonSetup();

    const id = surfaceModel.addElement({
      type: 'testShape',
      xywh: '[10,20,30,40]',
    });

    const spy = vi.spyOn(gfx.viewport, 'setViewportByBound');

    gfx.highlightElements([id], { duration: 0 });
    expect(spy).not.toHaveBeenCalled();

    gfx.highlightElements([id], { reframe: true, duration: 0 });
    expect(spy).toHaveBeenCalledTimes(1);

    const bound = spy.mock.calls[0][0] as Bound;
    expect(bound.x).toBe(10);
    expect(bound.y).toBe(20);
    expect(bound.w).toBe(30);
    expect(bound.h).toBe(40);
  });

  test('should not reframe when no id resolves', async () => {
    const { gfx } = await commonSetup();

    const spy = vi.spyOn(gfx.viewport, 'setViewportByBound');

    gfx.highlightElements(['unknown'], { reframe: true });

    expect(spy).not.toHaveBeenCalled();
  });
});
