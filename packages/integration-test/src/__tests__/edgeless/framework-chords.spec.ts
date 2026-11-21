/**
 * The framework chord prefixes of `docs/adr/0055`, driven by the REAL keyboard
 * on a real edgeless editor: `b`, `u`, `g`, `y`, `o` and the shared DDD `d`
 * each place the artefact their table announces, the way `w c` has placed a
 * Wardley component since PF3 (`wardley-shortcuts.spec.ts`).
 *
 * The unit parity tests prove the declarations (`chord-prefixes`,
 * `keymap-golden`, `keymap-chord` in `framework/std`); only this spec proves the
 * path a user takes, and the refusals the review of the first cut found
 * missing:
 * - after a prefix, a key that cannot continue a chord (Delete, an arrow,
 *   Escape, Ctrl+Z, Ctrl+D, Space) does what it does without the prefix: it
 *   was swallowed for 1.2 s, for `w` too;
 * - a read-only document throws nothing and places nothing, and the prefix
 *   letter does not even arm (`w c` threw "Cannot add element in readonly
 *   mode" before);
 * - a letter typed into a note, a polygon whose vertices are being edited, a
 *   framework switched off by its flag: no prefix arms.
 *
 * The artefact is identified by the `FrameworkElementAdded` event the command
 * bottleneck emits (framework and element, the command's own declaration), so
 * a permuted second key fails here. Real keystrokes go to whatever holds the
 * focus, and the suite shares one page, so every test blurs the focus first.
 */
import { PresentTool } from '@labre/affine/blocks/frame';
import type { EdgelessRootBlockComponent } from '@labre/affine/blocks/root';
import type { BlockFlags } from '@labre/affine/flags';
import {
  DEFAULT_POLYGON_VERTICES,
  type ShapeElementModel,
} from '@labre/affine/model';
import { TelemetryExtension } from '@labre/affine/shared/services';
import { SurfaceSelection } from '@labre/std';
import { userEvent } from '@vitest/browser/context';
import { afterAll, beforeAll, describe, expect, test, vi } from 'vitest';

import { addNote, getDocRootBlock } from '../utils/edgeless.js';
import { snapshotPageState } from '../utils/page-state.js';
import { setupEditor } from '../utils/setup.js';

// The commands these tests run write the usage store, and the Templates panel
// its remembered category: the shared page gets them back as it was.
let restorePage: () => void = () => {};
beforeAll(() => {
  restorePage = snapshotPageState();
});
afterAll(() => restorePage());

type Service = EdgelessRootBlockComponent['service'];
type Tracked = { name: string; props: Record<string, unknown> };

async function mount(flags?: BlockFlags) {
  const tracked: Tracked[] = [];
  const cleanup = await setupEditor(
    'edgeless',
    [
      TelemetryExtension({
        track: (name, props) =>
          tracked.push({
            name,
            props: props as unknown as Record<string, unknown>,
          }),
      }),
    ],
    { flags }
  );
  const service: Service = getDocRootBlock(
    window.doc,
    window.editor,
    'edgeless'
  ).service;
  // The dispatcher only runs keyDown handlers while active (normally set by a
  // pointerdown, click or focusin on the host).
  service.std.event.active = true;
  (document.activeElement as HTMLElement | null)?.blur();
  const placed = () =>
    tracked
      .filter(t => t.name === 'FrameworkElementAdded')
      .map(t => `${String(t.props.framework)}/${String(t.props.element)}`);
  const tool = () => service.gfx.tool.currentToolName$.peek();
  return { cleanup, service, placed, tool };
}

/** One chord per framework that ships some, and the artefact it places. */
const CASES = [
  { keys: 'bp', placed: 'bpmn/pool' },
  { keys: 'uc', placed: 'uml/node:class' },
  { keys: 'gp', placed: 'edgy/node:people' },
  { keys: 'yh', placed: 'cynefin/node:hexagon' },
  { keys: 'db', placed: 'context-map/bounded-context' },
  { keys: 'dc', placed: 'core-domain/background' },
  { keys: 'oe', placed: 'event-storming/sticky:domainEvent' },
] as const;

describe('framework chords on the real keyboard', () => {
  test.each(CASES)('$keys places $placed', async ({ keys, placed: what }) => {
    const { cleanup, service, placed } = await mount();
    try {
      await userEvent.keyboard(keys);
      await vi.waitFor(() => expect(placed()).toEqual([what]));
      expect(service.gfx.gfxElements.length).toBeGreaterThan(0);
    } finally {
      cleanup();
    }
  });

  test('a chord typed into a note being edited is text, not a shortcut', async () => {
    const { cleanup, service, placed } = await mount();
    try {
      const noteId = addNote(window.doc);
      const paragraphId = window.doc.getModelById(noteId)!.children[0]!.id;
      const surfaceId = window.doc.getModelsByFlavour('affine:surface')[0]!.id;
      service.std.selection.setGroup('gfx', [
        new SurfaceSelection(surfaceId, [noteId], true),
      ]);
      const paragraph = await vi.waitFor(() => {
        const block = window.editor.host!.view.getBlock(
          paragraphId
        ) as unknown as HTMLElement & {
          inlineEditor?: { focusEnd(): void };
        };
        expect(block?.inlineEditor).toBeTruthy();
        return block;
      });
      paragraph.inlineEditor!.focusEnd();
      const before = service.gfx.gfxElements.length;

      await userEvent.keyboard('bp');

      const text = () =>
        (
          window.doc.getModelById(paragraphId) as unknown as {
            props: { text: { toString(): string } };
          }
        ).props.text.toString();
      await vi.waitFor(() => expect(text()).toBe('bp'));
      expect(service.gfx.gfxElements.length).toBe(before);
      expect(placed()).toEqual([]);
    } finally {
      cleanup();
    }
  });

  test('a framework switched off by its flag binds no chord, and its letter arms nothing', async () => {
    const { cleanup, service, placed, tool } = await mount({ bpmn: false });
    try {
      // `b` arms nothing, so `h` reaches the hand tool, as on the base.
      await userEvent.keyboard('bh');
      await vi.waitFor(() => expect(tool()).toBe('pan'));
      await userEvent.keyboard('v');
      await userEvent.keyboard('bp');
      expect(placed()).toEqual([]);
      expect(service.gfx.gfxElements.length).toBe(0);
      // …while a framework still on keeps its own.
      await userEvent.keyboard('uc');
      await vi.waitFor(() => expect(placed()).toEqual(['uml/node:class']));
    } finally {
      cleanup();
    }
  });
});

describe('after a prefix, the canvas keeps its own keys', () => {
  async function mountWithShape() {
    const mounted = await mount();
    const { service } = mounted;
    const id = service.crud.addElement('shape', {
      shapeType: 'rect',
      xywh: '[0,0,100,100]',
    })!;
    // The creation is its own undo step, for the Ctrl+Z case.
    window.doc.captureSync();
    const shape = service.crud.getElementById(id) as ShapeElementModel;
    service.selection.set({ elements: [id], editing: false });
    const shapes = () => service.gfx.gfxElements.length;
    return { ...mounted, id, shape, shapes };
  }

  // `w` was already like this before ADR 0055, and is fixed with the rest.
  describe.each(['d', 'w'] as const)('prefix %s', prefix => {
    test('then Delete deletes the selection', async () => {
      const { cleanup, shapes } = await mountWithShape();
      try {
        await userEvent.keyboard(`${prefix}{Delete}`);
        await vi.waitFor(() => expect(shapes()).toBe(0));
      } finally {
        cleanup();
      }
    });

    test('then ArrowRight moves the selection', async () => {
      const { cleanup, shape } = await mountWithShape();
      try {
        const x = shape.elementBound.x;
        await userEvent.keyboard(`${prefix}{ArrowRight}`);
        await vi.waitFor(() => expect(shape.elementBound.x).toBeGreaterThan(x));
      } finally {
        cleanup();
      }
    });

    test('then Escape clears the selection', async () => {
      const { cleanup, service } = await mountWithShape();
      try {
        await userEvent.keyboard(`${prefix}{Escape}`);
        await vi.waitFor(() =>
          expect(service.selection.selectedElements).toHaveLength(0)
        );
      } finally {
        cleanup();
      }
    });

    test('then Ctrl+Z undoes', async () => {
      const { cleanup, shapes } = await mountWithShape();
      try {
        await userEvent.keyboard(`${prefix}{Control>}z{/Control}`);
        await vi.waitFor(() => expect(shapes()).toBe(0));
      } finally {
        cleanup();
      }
    });

    test('then Ctrl+D duplicates', async () => {
      const { cleanup, shapes } = await mountWithShape();
      try {
        await userEvent.keyboard(`${prefix}{Control>}d{/Control}`);
        await vi.waitFor(() => expect(shapes()).toBe(2));
      } finally {
        cleanup();
      }
    });

    test('then Space held pans', async () => {
      const { cleanup, tool } = await mountWithShape();
      try {
        await userEvent.keyboard(`${prefix}[Space>]`);
        await vi.waitFor(() => expect(tool()).toBe('pan'));
        await userEvent.keyboard('[/Space]');
      } finally {
        cleanup();
      }
    });

    test('then an unmatched letter is still swallowed', async () => {
      const { cleanup, tool } = await mountWithShape();
      try {
        // No chord on `h` under either prefix: the namespace swallows it…
        await userEvent.keyboard(`${prefix}h`);
        expect(tool()).toBe('default');
        // …and the prefix is forgotten: `h` alone reaches the hand tool.
        await userEvent.keyboard('h');
        await vi.waitFor(() => expect(tool()).toBe('pan'));
      } finally {
        cleanup();
      }
    });
  });

  test('then a matching key still places its artefact', async () => {
    const { cleanup, placed } = await mountWithShape();
    try {
      await userEvent.keyboard('db');
      await vi.waitFor(() =>
        expect(placed()).toEqual(['context-map/bounded-context'])
      );
    } finally {
      cleanup();
    }
  });
});

describe('where no chord can run, no prefix arms', () => {
  test('a read-only document throws nothing, places nothing, and keeps its tools', async () => {
    const { cleanup, service, placed, tool } = await mount();
    const errors: string[] = [];
    const onError = (e: ErrorEvent) => errors.push(String(e.message));
    const onRejection = (e: PromiseRejectionEvent) =>
      errors.push(String(e.reason));
    window.addEventListener('error', onError);
    window.addEventListener('unhandledrejection', onRejection);
    try {
      service.std.store.readonly = true;
      for (const { keys } of CASES) {
        await userEvent.keyboard(keys);
        await userEvent.keyboard('v');
      }
      // Wardley's, which threw before ADR 0055 on the base as well.
      await userEvent.keyboard('wc');
      await userEvent.keyboard('v');
      // The prefix letter does not arm, so `h` reaches the hand tool, which
      // the read-only canvas allows.
      await userEvent.keyboard('bh');
      await vi.waitFor(() => expect(tool()).toBe('pan'));

      expect(errors).toEqual([]);
      expect(placed()).toEqual([]);
      expect(service.gfx.gfxElements.length).toBe(0);
    } finally {
      window.removeEventListener('error', onError);
      window.removeEventListener('unhandledrejection', onRejection);
      cleanup();
    }
  });

  test('a polygon whose vertices are being edited keeps `b` to itself', async () => {
    const { cleanup, service, placed, tool } = await mount();
    try {
      const id = service.crud.addElement('shape', {
        shapeType: 'polygon',
        vertices: DEFAULT_POLYGON_VERTICES.map(([x, y]) => [x, y]),
        isClosed: true,
        xywh: '[0,0,200,200]',
      })!;
      service.selection.set({ elements: [id], editing: false });
      const view = await vi.waitFor(() => {
        const v = service.gfx.view.get(id) as unknown as
          | { enterVertexEditingMode(): void }
          | null
          | undefined;
        expect(v).toBeTruthy();
        return v!;
      });
      view.enterVertexEditingMode();
      await vi.waitFor(() => expect(service.gfx.selection.editing).toBe(true));

      // With no vertex hovered the polygon's own `b` (Bézier smoothing) does
      // nothing, and BPMN's prefix must not arm either. Tools do not switch
      // while editing, so the proof is taken just after: Escape is the
      // polygon's own (a capture listener the dispatcher never sees, so it
      // would not disarm a chord), and `h` must then reach the hand tool
      // rather than being swallowed in a BPMN namespace armed during the edit.
      await userEvent.keyboard('b{Escape}');
      await vi.waitFor(() => expect(service.gfx.selection.editing).toBe(false));
      await userEvent.keyboard('h');
      await vi.waitFor(() => expect(tool()).toBe('pan'));
      expect(placed()).toEqual([]);
    } finally {
      cleanup();
    }
  });
});

describe('a held key, a presentation', () => {
  test('b then p HELD places one pool and leaves the Pen tool alone', async () => {
    const { cleanup, placed, tool } = await mount();
    try {
      // `{p>4/}`: p pressed and held for four keydowns (the last three with
      // `repeat`), then released — the auto-repeat of a held key.
      await userEvent.keyboard('b{p>4/}');
      await vi.waitFor(() => expect(placed()).toEqual(['bpmn/pool']));
      expect(tool()).not.toBe('brush');
      // Released, `p` alone is the Pen tool again.
      await userEvent.keyboard('p');
      await vi.waitFor(() => expect(tool()).toBe('brush'));
    } finally {
      cleanup();
    }
  });

  test('while presenting, a prefix arms nothing and writes nothing', async () => {
    const { cleanup, service, placed, tool } = await mount();
    try {
      service.gfx.tool.setTool(PresentTool, { mode: 'fit' });
      await vi.waitFor(() => expect(tool()).toBe('frameNavigator'));

      // `b` arms nothing, so `p` does what it does alone during a
      // presentation (it picks the Pen tool, which ends the presentation),
      // and no pool is written into the document.
      await userEvent.keyboard('bp');
      await vi.waitFor(() => expect(tool()).toBe('brush'));
      expect(placed()).toEqual([]);
      expect(service.gfx.gfxElements.length).toBe(0);

      // Wardley's `w c`, which wrote a component during a presentation before
      // ADR 0055, too.
      service.gfx.tool.setTool(PresentTool, { mode: 'fit' });
      await vi.waitFor(() => expect(tool()).toBe('frameNavigator'));
      await userEvent.keyboard('wc');
      await vi.waitFor(() => expect(tool()).toBe('connector'));
      expect(placed()).toEqual([]);
      expect(service.gfx.gfxElements.length).toBe(0);
    } finally {
      cleanup();
    }
  });
});
