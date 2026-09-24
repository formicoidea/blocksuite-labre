import {
  createTemplateJob,
  templateManagerFor,
} from '@labre/affine/gfx/template';
import type { BlockStdScope } from '@labre/std';
import { beforeEach, describe, expect, test } from 'vitest';

import { getDocRootBlock, getSurface } from '../utils/edgeless.js';
import { setupEditor } from '../utils/setup.js';

describe('Framework template catalog', () => {
  let std!: BlockStdScope;

  beforeEach(async () => {
    const cleanup = await setupEditor('edgeless');
    std = getDocRootBlock(window.doc, window.editor, 'edgeless').std;
    return cleanup;
  });

  const CATEGORIES = [
    'Wardley',
    'EDGY',
    'Cynefin',
    'Estuarine',
    'BPMN',
    'Other',
  ];

  test('the catalog exposes every framework + Other category, not cat stickers', async () => {
    const cats = await templateManagerFor(std).categories();
    expect(cats).toEqual(expect.arrayContaining(CATEGORIES));
    expect(cats).not.toContain('Paws and pals');

    const other = await templateManagerFor(std).list('Other');
    expect(other.map(t => t.name)).toEqual(
      expect.arrayContaining([
        'SWOT',
        'Kanban board',
        'Business model canvas',
        'Fishbone (Ishikawa)',
        'Gantt chart',
      ])
    );
  });

  test('every template in every category inserts valid elements', async () => {
    const surface = getSurface(window.doc, window.editor).model;
    for (const cat of CATEGORIES) {
      const list = await templateManagerFor(std).list(cat);
      expect(list.length).toBeGreaterThan(0);
      for (const template of list) {
        const before = surface.elementModels.length;
        const job = createTemplateJob(std, template.type);
        const bound = await job.insertTemplate(template.content);
        expect(bound, `${cat} / ${template.name}`).not.toBeNull();
        expect(
          surface.elementModels.length,
          `${cat} / ${template.name}`
        ).toBeGreaterThan(before);
      }
    }
  });

  test('the BPMN category is registered with its templates', async () => {
    const cats = await templateManagerFor(std).categories();
    expect(cats).toContain('BPMN');

    const bpmn = await templateManagerFor(std).list('BPMN');
    const names = bpmn.map(t => t.name);
    expect(names).toEqual(
      expect.arrayContaining([
        'Simple process',
        'Start event',
        'End event',
        'Task',
        'Exclusive gateway',
        'Sequence flow',
        'Pool',
      ])
    );
  });

  test('the simple-process template inserts a pool, nodes and connectors', async () => {
    const surface = getSurface(window.doc, window.editor).model;
    const tpl = (await templateManagerFor(std).list('BPMN')).find(
      t => t.name === 'Simple process'
    )!;

    const job = createTemplateJob(std, tpl.type);
    await job.insertTemplate(tpl.content);

    const counts: Record<string, number> = {};
    for (const el of surface.elementModels)
      counts[el.type] = (counts[el.type] ?? 0) + 1;

    expect(counts.bpmnPool).toBe(1);
    expect(counts.bpmnNode).toBe(6); // start, 3 tasks, gateway, end
    expect(counts.connector).toBe(6);
    // R38: the start, the gateway and the end are named by a gravitating label,
    // grouped with the symbol — and the group must survive the id remap of the
    // insertion, or the pair would come apart at the first drag.
    expect(counts.text).toBe(3);
    expect(counts.group).toBe(3);
    for (const el of surface.elementModels) {
      if (el.type !== 'group') continue;
      const members = (el as unknown as { childElements: { type: string }[] })
        .childElements;
      expect(members.map(member => member.type).sort()).toEqual([
        'bpmnNode',
        'text',
      ]);
    }
  });
});

/**
 * The same catalogue, on an editor whose flags switch two frameworks OFF — in
 * the SAME browser page as the all-on editors above, which is the whole point.
 *
 * Until 0.38.2 a category was appended to a module-level Set from `effect()`,
 * once per process: the categories the default editor registered outlived it,
 * so this editor would have listed Wardley, Cynefin and Estuarine although its
 * own flags forbid them — the shipped symptom of #244, where a framework
 * switched off in the host kept its shelf in the Templates panel until a full
 * reload. Categories now come from the editor's own DI container.
 *
 * Its own `setupEditor`, not the `beforeEach` above: that one mounts the
 * default all-on editor, and mounting a second on top would leave two editors
 * in one page.
 */
describe('Framework template catalog with a framework switched off', () => {
  let std!: BlockStdScope;

  beforeEach(async () => {
    const cleanup = await setupEditor('edgeless', undefined, {
      flags: { wardley: false, 'cynefin-estuarine': false },
    });
    std = getDocRootBlock(window.doc, window.editor, 'edgeless').std;
    return cleanup;
  });

  test('only the frameworks this editor enables have a category', async () => {
    const cats = await templateManagerFor(std).categories();

    // What the flag takes away is the shelf that CREATES a map — the renderer
    // that paints one already drawn is always on (`docs/adr/0009`).
    expect(cats).not.toContain('Wardley');
    expect(cats).not.toContain('Cynefin');
    expect(cats).not.toContain('Estuarine');

    // …and nothing else moved: the built-in category, the frameworks left on,
    // and Mind Map — registered by an always-on extension, so it is there
    // whatever the flags say.
    expect(cats).toEqual(
      expect.arrayContaining(['Other', 'EDGY', 'BPMN', 'Mind Map'])
    );
  });
});
