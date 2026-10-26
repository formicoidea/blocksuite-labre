/**
 * The built-in "Slides" masks, inserted for real through the canvas's
 * template job, the way the Templates panel inserts them.
 *
 * What it would have caught:
 * - a mask whose frame lands without its members (the template job's frame
 *   path, deferred after the surface elements, not remapping
 *   `childElementIds`), or with members painted outside it;
 * - a slide number that is not the inserted frame's rank in the deck;
 * - a mask whose snapshot the job refuses (a malformed frame block).
 */
import {
  createTemplateJob,
  templateManagerFor,
} from '@labre/affine/gfx/template';
import type { FrameBlockModel } from '@labre/affine/model';
import { Bound } from '@labre/global/gfx';
import type { BlockStdScope } from '@labre/std';
import type { GfxModel } from '@labre/std/gfx';
import { beforeEach, describe, expect, test } from 'vitest';

import { wait } from '../utils/common.js';
import { getDocRootBlock, getSurface } from '../utils/edgeless.js';
import { setupEditor } from '../utils/setup.js';

const frames = () =>
  window.doc.getModelsByFlavour('affine:frame') as FrameBlockModel[];

describe('slide masks', () => {
  let std!: BlockStdScope;

  beforeEach(async () => {
    const cleanup = await setupEditor('edgeless');
    std = getDocRootBlock(window.doc, window.editor, 'edgeless').std;
    return cleanup;
  });

  test('every mask inserts one 16:9 frame holding its elements', async () => {
    const surface = getSurface(window.doc, window.editor).model;
    const masks = await templateManagerFor(std).list('Slides');
    expect(masks.length).toBeGreaterThan(0);

    for (const mask of masks) {
      const known = new Set(frames().map(f => f.id));
      const job = createTemplateJob(std, mask.type);
      await job.insertTemplate(mask.localize?.(std) ?? mask.content);
      mask.afterInsert?.(std, job.insertedElementIds);
      await wait();

      const added = frames().filter(f => !known.has(f.id));
      expect(added, mask.name).toHaveLength(1);
      const frame = added[0]!;
      const box = Bound.deserialize(frame.xywh);
      expect([box.w, box.h], mask.name).toEqual([1600, 900]);
      expect(frame.props.title.toString(), mask.name).toBe(mask.name);

      // The frame owns exactly what was inserted, all of it inside it.
      expect([...frame.childIds].sort(), mask.name).toEqual(
        [...job.insertedElementIds].sort()
      );
      for (const id of frame.childIds) {
        const element = surface.getElementById(id) as GfxModel | null;
        expect(element, `${mask.name} / ${id}`).toBeTruthy();
        const inner = Bound.deserialize(element!.xywh);
        // A connector's bound carries its stroke; a unit of slack.
        expect(box.expand(4).contains(inner), `${mask.name} / ${id}`).toBe(
          true
        );
      }
    }
  });

  test('the slide number is the frame rank in the deck', async () => {
    const surface = getSurface(window.doc, window.editor).model;
    const [cover, agenda] = await templateManagerFor(std).list('Slides');

    for (const mask of [cover!, agenda!]) {
      const job = createTemplateJob(std, mask.type);
      await job.insertTemplate(mask.content);
      mask.afterInsert?.(std, job.insertedElementIds);
      await wait();
      const numberId = job.insertedElementIds.at(-1)!;
      const number = surface.getElementById(numberId) as unknown as {
        text: { toString(): string };
      };
      // The rank in presentation order, as the frame manager sorts frames.
      // ponytail: which rank that is depends on the inserted frame's
      // `presentationIndex`; once the template job keys it after the last
      // frame, this is always `frames().length`.
      const ordered = [...frames()].sort((a, b) =>
        (a.props.presentationIndex || '\uffff') <
        (b.props.presentationIndex || '\uffff')
          ? -1
          : 1
      );
      const own = ordered.findIndex(f => f.childIds.includes(numberId));
      expect(own).toBeGreaterThanOrEqual(0);
      expect(number.text.toString()).toBe(String(own + 1));
    }
  });
});
