/**
 * "Save as template" on a frame, end to end on a real editor, through the
 * `FrameTemplateProvider` seam: the frame toolbar's save hands the host a
 * snapshot, the Templates panel lists what the host gives back, and the
 * canvas's template job inserts it as a fresh copy.
 *
 * Replaces the spec of `EdgelessTemplatePanel.templates.extend`, the
 * module-level registry this seam retired (it appended for every editor of
 * the page and was never emptied).
 *
 * What it would have caught:
 * - a snapshot that loses the frame's members or its connector ends (the
 *   copy is an empty frame, or a connector pointing at the source shapes);
 * - an insertion that reuses the source ids, or a frame whose children are
 *   not the inserted copies;
 * - the deletion cascade reported for a remote change, or not undone by an
 *   undo (a template sent to the trash while its frame is back).
 */
import { saveFrameAsTemplate } from '@labre/affine/blocks/frame';
import {
  createTemplateJob,
  SAVED_FRAMES_CATEGORY,
  templateManagerFor,
} from '@labre/affine/gfx/template';
import {
  type ConnectorElementModel,
  type FrameBlockModel,
  ShapeType,
} from '@labre/affine/model';
import {
  type FrameTemplateDraft,
  FrameTemplateExtension,
  type FrameTemplateFrameRef,
} from '@labre/affine/shared/services';
import { Bound } from '@labre/global/gfx';
import type { BlockStdScope } from '@labre/std';
import type { GfxModel } from '@labre/std/gfx';
import { Text } from '@labre/store';
import { beforeEach, describe, expect, test } from 'vitest';

import { wait } from '../utils/common.js';
import { getDocRootBlock } from '../utils/edgeless.js';
import { setupEditor } from '../utils/setup.js';

/** A host keeping templates in memory, and what it was told. */
function memoryHost() {
  const saved: FrameTemplateDraft[] = [];
  const deleted: FrameTemplateFrameRef[] = [];
  const restored: FrameTemplateFrameRef[] = [];
  let listed = 0;
  return {
    saved,
    deleted,
    restored,
    get listed() {
      return listed;
    },
    service: {
      save: async (draft: FrameTemplateDraft) => {
        saved.push(structuredClone(draft));
      },
      list: async () => {
        listed++;
        return saved.map((draft, i) => ({
          id: `t${i}`,
          title: draft.title,
          snapshot: structuredClone(draft.snapshot),
        }));
      },
      frameDeleted: (frame: FrameTemplateFrameRef) => deleted.push(frame),
      frameRestored: (frame: FrameTemplateFrameRef) => restored.push(frame),
    },
  };
}

const frames = () =>
  window.doc.getModelsByFlavour('affine:frame') as FrameBlockModel[];

describe('frame templates with a host', () => {
  let std!: BlockStdScope;
  let host!: ReturnType<typeof memoryHost>;

  beforeEach(async () => {
    host = memoryHost();
    const cleanup = await setupEditor('edgeless', [
      FrameTemplateExtension(host.service),
    ]);
    std = getDocRootBlock(window.doc, window.editor, 'edgeless').std;
    return cleanup;
  });

  /** A titled frame holding two shapes, a connector between them and a note. */
  async function frameWithMembers() {
    const service = getDocRootBlock(
      window.doc,
      window.editor,
      'edgeless'
    ).service;
    const surfaceId = service.surface.id;
    const frameId = service.crud.addBlock(
      'affine:frame',
      { xywh: '[0,0,1200,800]', title: new Text('Plan') },
      surfaceId
    )!;
    await wait();
    const a = service.crud.addElement('shape', {
      shapeType: ShapeType.Rect,
      xywh: '[100,100,100,100]',
    })!;
    const b = service.crud.addElement('shape', {
      shapeType: ShapeType.Ellipse,
      xywh: '[400,100,100,100]',
    })!;
    const connector = service.crud.addElement('connector', {
      source: { id: a },
      target: { id: b },
    })!;
    const note = service.crud.addBlock(
      'affine:note',
      { xywh: '[100,400,300,100]' },
      window.doc.root!.id
    )!;
    await wait();
    const frame = window.doc.getBlock(frameId)!.model as FrameBlockModel;
    for (const id of [a, b, connector, note]) {
      const model = service.gfx.getElementById(id) as GfxModel;
      if (!frame.hasChild(model)) frame.addChild(model);
    }
    await wait();
    return { frame, members: [a, b, connector, note] };
  }

  test('save hands the host the frame and its members, layer-free', async () => {
    const { frame, members } = await frameWithMembers();

    await saveFrameAsTemplate(std, frame);

    expect(host.saved).toHaveLength(1);
    const draft = host.saved[0]!;
    expect(draft.docId).toBe(window.doc.id);
    expect(draft.frameId).toBe(frame.id);
    expect(draft.title).toBe('Plan');

    const [surface, ...pageBlocks] = draft.snapshot.blocks.children;
    const elements = surface!.props['elements'] as Record<
      string,
      Record<string, unknown>
    >;
    expect(Object.keys(elements).sort()).toEqual(members.slice(0, 3).sort());
    expect(surface!.children.map(b => b.id)).toEqual([frame.id]);
    expect(pageBlocks.map(b => b.id)).toEqual([members[3]]);
    for (const element of Object.values(elements)) {
      expect(element).not.toHaveProperty('layer');
    }
  });

  test('the panel lists the saved frame lazily, and inserting it copies it', async () => {
    const { frame, members } = await frameWithMembers();
    await saveFrameAsTemplate(std, frame);

    const catalogue = templateManagerFor(std);
    expect(await catalogue.categories()).toContain(SAVED_FRAMES_CATEGORY);
    expect(host.listed).toBe(0);

    const [template] = await catalogue.list(SAVED_FRAMES_CATEGORY);
    expect(host.listed).toBe(1);
    expect(template!.name).toBe('Plan');

    const job = createTemplateJob(std, 'template');
    await job.insertTemplate(template!.content);
    await wait();

    const copy = frames().find(f => f.id !== frame.id)!;
    expect(copy).toBeDefined();
    expect(copy.props.title.toString()).toBe('Plan');

    const children = copy.childIds;
    expect(children).toHaveLength(members.length);
    for (const id of children) {
      expect(members).not.toContain(id);
      expect(
        std.store.getModelById(id) ??
          getDocRootBlock(
            window.doc,
            window.editor,
            'edgeless'
          ).service.surface.getElementById(id)
      ).toBeTruthy();
    }

    // The copy keeps its geometry relative to its frame.
    const dx = Bound.deserialize(copy.xywh).x - Bound.deserialize(frame.xywh).x;
    const surface = getDocRootBlock(window.doc, window.editor, 'edgeless')
      .service.surface;
    const shapes = surface
      .getElementsByType('shape')
      .filter(s => children.includes(s.id));
    expect(shapes).toHaveLength(2);
    expect(Bound.deserialize(shapes[0]!.xywh).x).toBe(
      Bound.deserialize(surface.getElementById(members[0]!)!.xywh).x + dx
    );

    // The connector joins the two copies, not the source shapes.
    const connector = surface
      .getElementsByType('connector')
      .find(c => children.includes(c.id)) as ConnectorElementModel;
    expect(children).toContain(connector.source.id);
    expect(children).toContain(connector.target.id);
  });

  test('a local deletion is reported once, and its undo restores it', async () => {
    const { frame } = await frameWithMembers();
    const crud = getDocRootBlock(window.doc, window.editor, 'edgeless').service
      .crud;
    const ref = { docId: window.doc.id, frameId: frame.id };

    window.doc.captureSync();
    crud.removeElement(frame.id);
    await wait();
    expect(host.deleted).toEqual([ref]);

    window.doc.undo();
    await wait();
    expect(frames().map(f => f.id)).toContain(frame.id);
    expect(host.restored).toEqual([ref]);
  });
});

describe('frame templates without a host', () => {
  beforeEach(async () => setupEditor('edgeless'));

  test('the panel has no saved-frames category', async () => {
    const std = getDocRootBlock(window.doc, window.editor, 'edgeless').std;
    expect(await templateManagerFor(std).categories()).not.toContain(
      SAVED_FRAMES_CATEGORY
    );
  });
});
