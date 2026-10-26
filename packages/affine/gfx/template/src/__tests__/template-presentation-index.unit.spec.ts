/**
 * A frame inserted from a template takes its own place in the slideshow.
 *
 * A saved frame (`FrameTemplateProvider`, `saveFrameAsTemplate`) is a
 * snapshot of the source frame's props, `presentationIndex` included. The
 * template job remapped ids and `childElementIds` but kept that key, so the
 * copy shared its slideshow position with the source frame — and every
 * further insertion of the same template with both. The clipboard has always
 * minted a fresh key on paste (`blocks/frame/src/edgeless-clipboard-config.ts`,
 * `newPresentationIndexes`); this spec holds the template path to the same
 * guarantee: every inserted frame gets a distinct key AFTER the last frame of
 * the document, the template's own frames keeping their relative order.
 */
import {
  getSurfaceBlock,
  type SurfaceBlockModel,
  SurfaceBlockSchemaExtension,
} from '@labre/affine-block-surface';
import {
  type FrameBlockModel,
  FrameBlockSchemaExtension,
  RootBlockSchemaExtension,
} from '@labre/affine-model';
import type { BlockSnapshot, DocSnapshot, Store } from '@labre/store';
import { Text } from '@labre/store';
import { TestWorkspace } from '@labre/store/test';
import { describe, expect, it } from 'vitest';

import {
  createPresentationIndexMiddleware,
  replaceIdMiddleware,
} from '../services/template-middlewares.js';
import { TemplateJob } from '../services/template.js';

let seq = 0;

/** A document holding one frame, made the way the frame tool makes it. */
function docWithFrame() {
  const collection = new TestWorkspace({ id: `template-pi-${seq++}` });
  collection.storeExtensions = [
    RootBlockSchemaExtension,
    SurfaceBlockSchemaExtension,
    FrameBlockSchemaExtension,
  ];
  collection.meta.initialize();
  const store = collection.createDoc().getStore();
  store.load(() => {
    const rootId = store.addBlock('affine:page', { title: new Text('doc') });
    const surfaceId = store.addBlock('affine:surface', {}, rootId);
    store.addBlock(
      'affine:frame',
      { title: new Text('Source'), xywh: '[0,0,100,100]' },
      surfaceId
    );
  });
  return store;
}

const frames = (store: Store) =>
  store.getModelsByFlavour('affine:frame') as FrameBlockModel[];

function frameJson(id: string, presentationIndex: string): BlockSnapshot {
  return {
    type: 'block',
    id,
    flavour: 'affine:frame',
    props: {
      title: { '$blocksuite:internal:text$': true, delta: [{ insert: id }] },
      background: 'transparent',
      xywh: '[0,0,100,100]',
      index: 'a0',
      childElementIds: {},
      presentationIndex,
    },
    children: [],
  };
}

/** A saved-frame-like snapshot: the source's own `presentationIndex` kept. */
function templateOf(...frames: BlockSnapshot[]): DocSnapshot {
  return {
    type: 'page',
    meta: { id: 'doc:t', title: 'T', createDate: 0, tags: [] },
    blocks: {
      type: 'block',
      id: 'block:page',
      flavour: 'affine:page',
      props: {
        title: { '$blocksuite:internal:text$': true, delta: [] },
      },
      children: [
        {
          type: 'block',
          id: 'block:surface',
          flavour: 'affine:surface',
          props: { elements: {} },
          children: frames,
        },
      ],
    },
  };
}

async function insert(store: Store, template: DocSnapshot) {
  const job = TemplateJob.create({
    model: getSurfaceBlock(store) as SurfaceBlockModel,
    type: 'template',
    // The frame-relevant middlewares of `createTemplateJob`, in its order.
    middlewares: [createPresentationIndexMiddleware, replaceIdMiddleware],
  });
  // The job rewrites the snapshot in place; the panel hands it a fresh one.
  await job.insertTemplate(structuredClone(template));
}

describe('a frame inserted from a template', () => {
  it('gets a slideshow position of its own, after the existing frames, at every insertion', async () => {
    const store = docWithFrame();
    const [source] = frames(store);
    const sourceIndex = source!.props.presentationIndex!;
    const template = templateOf(frameJson('saved', sourceIndex));

    await insert(store, template);
    await insert(store, template);

    const all = frames(store);
    expect(all).toHaveLength(3);
    const copies = all
      .filter(f => f.id !== source!.id)
      .map(f => f.props.presentationIndex!);
    expect(new Set(copies).size).toBe(2);
    for (const key of copies) expect(key > sourceIndex).toBe(true);
  });

  it("keeps the template's own frames in their relative order", async () => {
    const store = docWithFrame();
    const [source] = frames(store);
    // Listed second-first in the snapshot, ordered first-second by their keys,
    // both keys BELOW the existing frame's: the copies still go after it.
    await insert(
      store,
      templateOf(frameJson('second', 'Zz'), frameJson('first', 'Zy'))
    );

    const byTitle = (title: string) =>
      frames(store).find(f => f.props.title.toString() === title)!.props
        .presentationIndex!;
    expect(byTitle('first') > source!.props.presentationIndex!).toBe(true);
    expect(byTitle('second') > byTitle('first')).toBe(true);
  });
});
