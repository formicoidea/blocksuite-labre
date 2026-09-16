import { EdgelessCRUDIdentifier } from '@labre/affine-block-surface';
import {
  TranslationProvider,
  translateKey,
} from '@labre/affine-shared/services';
import type { BlockStdScope, CommandDescriptor } from '@labre/std';
import {
  GfxControllerIdentifier,
  SURFACE_TEXT_UNIQ_IDENTIFIER,
  SURFACE_YMAP_UNIQ_IDENTIFIER,
} from '@labre/std/gfx';
import { Subject } from 'rxjs';
import { describe, expect, it } from 'vitest';
import * as Y from 'yjs';

import { makeTemplateSnapshot, surfaceText } from '../make-snapshot.js';
import { createRegenerateIndexMiddleware } from '../services/template-middlewares.js';
import type { TemplateJob } from '../services/template.js';
import {
  snapshotFromAction,
  templateFromCommand,
} from '../snapshot-from-action.js';

type Element = Record<string, unknown>;

/** The surface-elements map of a snapshot this module produced. */
function elementsOf(snapshot: ReturnType<typeof makeTemplateSnapshot>) {
  return snapshot.blocks.children[0]!.props.elements as Record<string, Element>;
}

/** The surface members a placement action reaches through `gfx.surface`. */
type FakeSurface = {
  addElement: (props: Element) => string;
  getElementById: (id: string) => Element | null;
  getElementsByType: (type: string) => Element[];
  elementModels: Element[];
};

function surfaceOf(std: BlockStdScope) {
  return (
    std.get(GfxControllerIdentifier) as unknown as { surface: FakeSurface }
  ).surface;
}

function layerOf(std: BlockStdScope) {
  return (
    std.get(GfxControllerIdentifier) as unknown as {
      layer: {
        generateIndex: () => string;
        getReorderedIndex: (model: unknown, direction: string) => string;
      };
    }
  ).layer;
}

/* ── What the recorder makes of an action's props ─────────────────────── */

describe('snapshotFromAction', () => {
  it('serializes text — a plain string or a detached Y.Text — and drops undefined props', () => {
    const snapshot = snapshotFromAction(std => {
      const surface = surfaceOf(std);
      surface.addElement({
        type: 'shape',
        shapeType: 'rect',
        xywh: '[0,0,100,50]',
        text: 'Hello',
        strokeColor: undefined,
      });
      surface.addElement({
        type: 'text',
        xywh: '[0,60,100,20]',
        // Some actions build the Y.Text themselves; it reads empty until it is
        // integrated into a doc, which is what the recorder has to cope with.
        text: new Y.Text('World'),
      });
    }, 'texts');

    const [shape, text] = Object.values(elementsOf(snapshot));

    expect(shape!['text']).toEqual({
      [SURFACE_TEXT_UNIQ_IDENTIFIER]: true,
      delta: [{ insert: 'Hello' }],
    });
    expect(shape).not.toHaveProperty('strokeColor');
    expect(text!['text']).toEqual({
      [SURFACE_TEXT_UNIQ_IDENTIFIER]: true,
      delta: [{ insert: 'World' }],
    });
  });

  it('runs a real grouping command, and stores its children as a surface y-map', () => {
    // `@labre/affine-gfx-group` is not a dependency of this package, so the
    // command under test is an inline equivalent of `createGroupCommand`: the
    // point is that the recorder answers `EdgelessCRUDIdentifier` and
    // `std.command.exec` well enough for the REAL command to run unchanged.
    const groupCommand = (
      ctx: { std: BlockStdScope; elements: string[] },
      next: (payload: { groupId: string }) => void
    ) => {
      const crud = ctx.std.get(EdgelessCRUDIdentifier);
      const groupId = crud.addElement('group', {
        children: Object.fromEntries(ctx.elements.map(id => [id, true])),
        title: 'Group 1',
      })!;
      next({ groupId });
    };

    const snapshot = snapshotFromAction(std => {
      const surface = surfaceOf(std);
      const a = surface.addElement({ type: 'shape', xywh: '[0,0,10,10]' });
      const b = surface.addElement({ type: 'shape', xywh: '[20,0,10,10]' });
      const [, result] = std.command.exec(
        groupCommand as never,
        { elements: [a, b] } as never
      );
      expect((result as { groupId: string }).groupId).toBe('el-2');
    }, 'group');

    const group = elementsOf(snapshot)['el-2']!;

    expect(group['type']).toBe('group');
    expect(group['children']).toEqual({
      [SURFACE_YMAP_UNIQ_IDENTIFIER]: true,
      json: { 'el-0': true, 'el-1': true },
    });
    expect(group['title']).toEqual({
      [SURFACE_TEXT_UNIQ_IDENTIFIER]: true,
      delta: [{ insert: 'Group 1' }],
    });
  });

  it('indexes in creation order, and honours an element the action sends to the back', () => {
    const snapshot = snapshotFromAction(std => {
      const surface = surfaceOf(std);
      surface.addElement({ type: 'shape', xywh: '[0,0,10,10]' });
      surface.addElement({ type: 'shape', xywh: '[20,0,10,10]' });
      const backId = surface.addElement({
        type: 'shape',
        xywh: '[40,0,10,10]',
      });
      // The `getReorderedIndex` + write-back idiom the framework backgrounds use.
      const model = surface.getElementById(backId)!;
      model['index'] = layerOf(std).getReorderedIndex(model, 'back');
    }, 'z-order');

    const elements = elementsOf(snapshot);
    const index = (id: string) => elements[id]!['index'] as string;

    expect(index('el-0') < index('el-1')).toBe(true);
    expect(index('el-2') < index('el-0')).toBe(true);
  });

  it('normalizes the drawing to the origin, connector endpoints included', () => {
    const snapshot = snapshotFromAction(std => {
      const surface = surfaceOf(std);
      const shape = surface.addElement({
        type: 'shape',
        xywh: '[100,200,50,50]',
      });
      surface.addElement({
        type: 'connector',
        source: { position: [50, 60] },
        target: { id: shape },
      });
    }, 'connector');

    const elements = elementsOf(snapshot);

    expect(elements['el-0']!['xywh']).toBe('[50,140,50,50]');
    expect(elements['el-1']!['source']).toEqual({ position: [0, 0] });
    expect(elements['el-1']!['target']).toEqual({ id: 'el-0' });
  });

  it('refuses an action that only arms a tool', () => {
    expect(() =>
      snapshotFromAction(std => {
        (
          std.get(GfxControllerIdentifier) as unknown as {
            tool: { setTool: (t: unknown) => void };
          }
        ).tool.setTool({});
      }, 'tool only')
    ).toThrow(/added no element/);
  });
});

/* ── The z-order guarantee, end to end ────────────────────────────────── */

/**
 * A `TemplateJob` reduced to the two members `createRegenerateIndexMiddleware`
 * uses: the `beforeInsert` slot it subscribes to, and `walk`.
 */
function fakeJob(snapshot: ReturnType<typeof makeTemplateSnapshot>) {
  type Block = { children?: Block[] };
  return {
    slots: { beforeInsert: new Subject<never>() },
    walk: (callback: (block: never, template: never) => void) => {
      const iterate = (block: Block) => {
        callback(block as never, snapshot as never);
        block.children?.forEach(iterate);
      };
      iterate(snapshot.blocks as Block);
    },
  } as unknown as TemplateJob;
}

/** Insert the snapshot the way `TemplateJob` would, and report the fresh keys. */
function regenerateIndexes(snapshot: ReturnType<typeof makeTemplateSnapshot>) {
  const job = fakeJob(snapshot);
  let n = 0;
  // Zero-padded so the minted keys sort lexicographically past ten elements.
  createRegenerateIndexMiddleware(() => `k${String(n++).padStart(3, '0')}`)(
    job
  );

  const slot = job.slots.beforeInsert as unknown as Subject<unknown>;
  slot.next({ type: 'template', template: snapshot, bound: null });
  slot.next({
    type: 'block',
    data: { blockJson: snapshot.blocks.children[0] },
  });

  const elements = elementsOf(snapshot);
  return (id: string) => elements[id]!['index'] as string;
}

describe('the z-order a derived template keeps through insertion', () => {
  it('keeps a C4-like component stacked shape → title → type line → description', () => {
    // Mirrors `createC4Node`: four tiers, then the group joining them, each
    // element taking its index from `gfx.layer.generateIndex()` itself.
    const snapshot = snapshotFromAction(std => {
      const surface = surfaceOf(std);
      const layer = layerOf(std);
      const ids = ['shape', 'title', 'typeLine', 'description'].map(role =>
        surface.addElement({
          type: 'shape',
          role,
          xywh: '[0,0,240,120]',
          index: layer.generateIndex(),
        })
      );
      surface.addElement({
        type: 'group',
        index: layer.generateIndex(),
        children: Object.fromEntries(ids.map(id => [id, true])),
      });
    }, 'c4 component');

    const index = regenerateIndexes(snapshot);

    // The group paints below its children, then the tiers in creation order.
    expect(index('el-4') < index('el-0')).toBe(true);
    expect(index('el-0') < index('el-1')).toBe(true);
    expect(index('el-1') < index('el-2')).toBe(true);
    expect(index('el-2') < index('el-3')).toBe(true);
  });

  it('keeps the whole tree order of a nested pair of groups', () => {
    // Mirrors `createWardleyPipeline`: body, handle, label, an inner group of
    // handle + label, an outer group of body + inner group.
    const snapshot = snapshotFromAction(std => {
      const surface = surfaceOf(std);
      const body = surface.addElement({ type: 'shape', xywh: '[0,0,300,80]' });
      const handle = surface.addElement({
        type: 'shape',
        xywh: '[10,10,20,20]',
      });
      const label = surface.addElement({ type: 'text', xywh: '[40,10,80,20]' });
      const inner = surface.addElement({
        type: 'group',
        children: { [handle]: true, [label]: true },
      });
      surface.addElement({
        type: 'group',
        children: { [body]: true, [inner]: true },
      });
    }, 'wardley pipeline');

    const index = regenerateIndexes(snapshot);

    // The tree order, to any depth: a group paints under everything it holds,
    // siblings keep their creation order, and the body (a direct leaf of the
    // outer group, created first) stays under the inner group's handle and
    // label. `sortIndex` used to look one level up only, which made this very
    // shape a cyclic comparison — and the body could land over its handle.
    expect(index('el-4') < index('el-0')).toBe(true); // outer group < body
    expect(index('el-0') < index('el-3')).toBe(true); // body < inner group
    expect(index('el-3') < index('el-1')).toBe(true); // inner group < handle
    expect(index('el-1') < index('el-2')).toBe(true); // handle < label
  });

  it('keeps a sticky shadow under its face', () => {
    const snapshot = snapshotFromAction(std => {
      const surface = surfaceOf(std);
      const shadow = surface.addElement({
        type: 'shape',
        xywh: '[4,4,160,120]',
      });
      const face = surface.addElement({
        type: 'shape',
        xywh: '[0,0,160,120]',
        text: 'note',
      });
      surface.addElement({
        type: 'group',
        children: { [shadow]: true, [face]: true },
      });
    }, 'sticky');

    const index = regenerateIndexes(snapshot);

    expect(index('el-2') < index('el-0')).toBe(true);
    expect(index('el-0') < index('el-1')).toBe(true);
  });
});

/* ── The two seams around the recorder ────────────────────────────────── */

describe('makeTemplateSnapshot', () => {
  it('fills a missing index in key order and leaves an explicit one alone', () => {
    const snapshot = makeTemplateSnapshot({
      a: { type: 'shape' },
      b: { type: 'shape', index: 'zz' },
      c: { type: 'shape' },
    });
    const elements = elementsOf(snapshot);

    expect(elements['b']!['index']).toBe('zz');
    expect(
      (elements['a']!['index'] as string) < (elements['c']!['index'] as string)
    ).toBe(true);
  });

  it('gives a hand-written element its own id, which the index regeneration keys on', () => {
    // Recette of 09/09/2026: a shipped map whose elements carried an `index`
    // but no `id` field landed with ONE shared depth for all 27 elements —
    // `createRegenerateIndexMiddleware` keeps its fresh keys in a map keyed by
    // `element.id`, and every `undefined` overwrote the last.
    const snapshot = makeTemplateSnapshot({
      bg: { type: 'wardley' },
      node: { type: 'shape' },
      explicit: { type: 'shape', id: 'kept' },
    });
    const elements = elementsOf(snapshot);
    expect(elements['bg']!['id']).toBe('bg');
    expect(elements['explicit']!['id']).toBe('kept');

    const index = regenerateIndexes(snapshot);
    expect(index('bg') < index('node')).toBe(true);
  });
});

describe('templateFromCommand', () => {
  it('names the template after the command and records the command id', () => {
    const command = {
      id: 'demo.addBox',
      owner: 'core',
      kind: 'artefact',
      labelKey: 'demo.addBox',
      labelFallback: 'Box',
      surfaces: [],
      scope: 'edgeless',
      defaultKeys: { mac: [], other: [] },
      run: (std: BlockStdScope) => {
        surfaceOf(std).addElement({ type: 'shape', xywh: '[0,0,10,10]' });
      },
    } as unknown as CommandDescriptor;

    const template = templateFromCommand(command, 'preview.svg');

    expect(template.name).toBe('Box');
    expect(template.commandId).toBe('demo.addBox');
    expect(template.type).toBe('template');
    expect(template.preview).toBe('preview.svg');
    expect(
      Object.keys(
        elementsOf(template.content as ReturnType<typeof makeTemplateSnapshot>)
      )
    ).toEqual(['el-0']);
  });
});

describe('a derived template speaks the inserting editor’s language', () => {
  const command = {
    id: 'demo.addBox',
    labelFallback: 'Box',
    run: (std: BlockStdScope) => {
      surfaceOf(std).addElement({
        type: 'shape',
        xywh: '[0,0,10,10]',
        text: translateKey(std, 'com.labre.demo.seed.box', 'Box'),
      });
    },
  } as unknown as CommandDescriptor;

  const textOf = (content: unknown) =>
    elementsOf(content as ReturnType<typeof makeTemplateSnapshot>)['el-0'].text;

  const hostWith = (t?: (key: string) => string | undefined) =>
    ({
      getOptional: (id: unknown) =>
        id === TranslationProvider && t ? { t } : null,
    }) as unknown as BlockStdScope;

  it('localizes the seeds through the host provider, and only through it', () => {
    const template = templateFromCommand(command, 'preview.svg');
    expect(textOf(template.content)).toEqual(surfaceText('Box'));
    expect(textOf(template.localize!(hostWith(() => 'Boîte')))).toEqual(
      surfaceText('Boîte')
    );
  });

  it('without a provider, inserts exactly the English build', () => {
    const template = templateFromCommand(command, 'preview.svg');
    expect(JSON.stringify(template.localize!(hostWith()))).toBe(
      JSON.stringify(template.content)
    );
  });
});

describe('a group in a snapshot always carries a title', () => {
  // Recette of 09/09/2026: a group written without a title (a map's node +
  // label pair, a C4 component) landed with no `title` key, and the group
  // renderer's `group.title.toString()` threw on every frame — the inserted
  // map showed its background and nothing else.
  it('gives a hand-written group the empty title the model would have', () => {
    const elements = elementsOf(
      makeTemplateSnapshot({
        a: { type: 'shape' },
        g: { type: 'group', children: { a: true } },
      })
    );
    expect(elements['g']!['title']).toEqual(surfaceText(''));
  });

  it('gives a derived group written without one the same', () => {
    const snapshot = snapshotFromAction(std => {
      const surface = surfaceOf(std);
      const a = surface.addElement({ type: 'shape', xywh: '[0,0,10,10]' });
      surface.addElement({ type: 'group', children: { [a]: true } });
    }, 'untitled group');
    expect(elementsOf(snapshot)['el-1']!['title']).toEqual(surfaceText(''));
  });
});
