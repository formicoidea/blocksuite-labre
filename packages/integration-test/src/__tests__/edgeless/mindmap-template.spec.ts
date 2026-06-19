import { mindmapTemplateCategory } from '@labre/affine/gfx/mindmap';
import type { MindmapElementModel } from '@labre/affine-model';
import { createTemplateJob } from '@labre/affine-gfx-template';
import type { GfxController } from '@labre/std/gfx';
import { beforeEach, describe, expect, test } from 'vitest';

import { wait } from '../utils/common.js';
import { getDocRootBlock } from '../utils/edgeless.js';
import { setupEditor } from '../utils/setup.js';

// Round-trip check: every mindmap template inserts via the real template job
// (id-regeneration middleware included) and rebuilds a valid mindmap tree.
describe('mindmap template round-trip', () => {
  let gfx: GfxController;

  beforeEach(async () => {
    const cleanup = await setupEditor('edgeless');
    gfx = getDocRootBlock(window.doc, window.editor, 'edgeless').gfx;
    return cleanup;
  });

  const templates = mindmapTemplateCategory.templates as {
    name: string;
    content: unknown;
  }[];

  for (const template of templates) {
    test(`inserts "${template.name}" as a working mindmap`, async () => {
      const job = createTemplateJob(window.editor.std, 'template', {
        x: 0,
        y: 0,
      });
      await job.insertTemplate(template.content);
      await wait(50);

      const mindmaps = gfx.surface!.elementModels.filter(
        e => e.type === 'mindmap'
      ) as MindmapElementModel[];
      expect(mindmaps.length).toBe(1);

      const mm = mindmaps[0];
      // Root + 3 children, all resolvable (broken id refs would drop nodes).
      expect(mm.childElements.length).toBe(4);
      expect(mm.tree).toBeTruthy();
      expect(mm.tree.children.length).toBe(3);
      mm.childElements.forEach(el => expect(el).toBeTruthy());
    });
  }
});
