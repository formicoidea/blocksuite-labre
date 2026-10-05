/**
 * User layers (ADR 0031 §6): a block DERIVED from another one goes beside it.
 *
 * `canvas-layers.spec.ts` owns what lands in the active layer (a new drawing,
 * a foreign paste, a template, an import) and what a duplicate keeps. This
 * one owns the gestures that make a block out of an existing one and delete
 * nothing of the user's intent about where it lives:
 *
 * - the note or shape an auto-complete arrow clones beside its source;
 * - the note the note slicer splits off;
 * - the block that replaces a link when its view changes on the canvas
 *   (bookmark → embed, an external embed → card, an iframe → card);
 * - a linked doc turned into a synced doc and back;
 * - the note "duplicate as note" puts beside a synced doc.
 *
 * Each one used to write through `store.addBlock` with no layer (the default
 * layer) or through the CRUD `addBlock` with none (the active layer); both
 * left the new block away from its source once the viewer had picked another
 * layer. A source in the default layer keeps its derived block there too,
 * whatever layer is active.
 */
import type { EdgelessRootBlockComponent } from '@labre/affine/blocks/root';
import { EdgelessLegacySlotIdentifier } from '@labre/affine/blocks/surface';
import { ShapeType } from '@labre/affine/model';
import {
  SelectionPaneProvider,
  type ToolbarAction,
  type ToolbarActions,
  ToolbarContext,
  ToolbarRegistryIdentifier,
} from '@labre/affine/shared/services';
import {
  DEFAULT_LAYER_ID,
  type GfxModel,
  ownLayerOf,
} from '@labre/affine/std/gfx';
import { Text } from '@labre/store';
import { page, userEvent } from '@vitest/browser/context';
import { beforeEach, describe, expect, test } from 'vitest';

import { wait } from '../utils/common.js';
import { getDocRootBlock } from '../utils/edgeless.js';
import { setupEditor } from '../utils/setup.js';

const PANE_WIDGET = 'edgeless-selection-pane-widget';

describe('a derived block lands beside its source', () => {
  let edgeless!: EdgelessRootBlockComponent;

  beforeEach(async () => {
    const cleanup = await setupEditor('edgeless');
    edgeless = getDocRootBlock(window.doc, window.editor, 'edgeless');
    edgeless.std.event.active = true;
    return cleanup;
  });

  const gfx = () => edgeless.service.gfx;
  const surface = () => edgeless.service.surface;
  const crud = () => edgeless.service.crud;
  const model = (id: string) => gfx().getElementById(id) as GfxModel;
  const root = () => edgeless.widgetComponents[PANE_WIDGET]!.shadowRoot!;
  const layerRow = (id: string) =>
    Array.from(
      root().querySelectorAll<HTMLElement>(
        '[data-testid="selection-pane-layer"]'
      )
    ).find(row => row.dataset.id === id)!;
  const blockIds = () => new Set(gfx().layer.blocks.map(block => block.id));
  const newBlocks = (before: Set<string>, flavour: string) =>
    gfx()
      .layer.blocks.filter(
        block => !before.has(block.id) && block.flavour === flavour
      )
      .map(block => block.id);

  const settle = async () => {
    await edgeless.updateComplete;
    await wait(50);
  };

  const frames = async (count = 4) => {
    for (let i = 0; i < count; i++) {
      await new Promise(resolve => requestAnimationFrame(resolve));
    }
  };

  /** A second layer, made active: what is created next lands in it. */
  const secondLayer = async () => {
    edgeless.std.get(SelectionPaneProvider).open();
    await settle();
    await userEvent.click(
      page.elementLocator(
        root().querySelector('[data-testid="selection-pane-new-layer"]')!
      )
    );
    await settle();
    await userEvent.keyboard('{Enter}');
    await settle();
    return Object.keys(surface().props.layers ?? {}).find(
      id => id !== DEFAULT_LAYER_ID
    )!;
  };

  /** Make the default layer the active one, from its row. */
  const activateDefault = async () => {
    await userEvent.click(
      page.elementLocator(
        layerRow(DEFAULT_LAYER_ID).querySelector('.selection-pane-label')!
      )
    );
    await settle();
    expect(layerRow(DEFAULT_LAYER_ID).hasAttribute('data-active')).toBe(true);
  };

  const addNote = (xywh: string, paragraphs = 1) => {
    const note = crud().addBlock('affine:note', { xywh }, window.doc.root!.id);
    for (let i = 0; i < paragraphs; i++) {
      window.doc.addBlock(
        'affine:paragraph',
        { text: new Text(`line ${i + 1}`) },
        note
      );
    }
    return note;
  };

  /** Select, then let the toolbar widget resolve the selection as a user's. */
  const selectAndRender = async (id: string) => {
    gfx().selection.set({ elements: [id], editing: false });
    await wait(250);
    await edgeless.updateComplete;
    await frames();
  };

  /** The canvas toolbar's own action, run as its button runs it. */
  const runSurfaceAction = (flavour: string, actionId: string) => {
    const find = (actions: ToolbarActions): ToolbarAction | undefined => {
      for (const action of actions) {
        if (action.id === actionId && 'run' in action && action.run) {
          return action as ToolbarAction;
        }
        if ('actions' in action && Array.isArray(action.actions)) {
          const found = find(action.actions as ToolbarActions);
          if (found) return found;
        }
      }
      return undefined;
    };
    const row = `affine:surface:${flavour.split(':').pop()}`;
    const registry = edgeless.std.get(ToolbarRegistryIdentifier);
    for (const [variant, module] of registry.modules) {
      if (!variant.endsWith(row)) continue;
      const action = find(module.config.actions);
      if (action) {
        action.run!(new ToolbarContext(edgeless.std));
        return;
      }
    }
    throw new Error(`no canvas toolbar action ${actionId} for ${flavour}`);
  };

  const autoCompleteArrow = () => {
    const rect = document.querySelector('edgeless-selected-rect');
    const widget = (rect?.shadowRoot ?? rect)?.querySelector(
      'edgeless-auto-complete'
    );
    return (widget?.shadowRoot ?? widget)?.querySelector<HTMLElement>(
      '.edgeless-auto-complete-arrow'
    );
  };

  describe('what an auto-complete arrow clones', () => {
    const cloneByArrow = async (note: string) => {
      const before = blockIds();
      await selectAndRender(note);
      const arrow = autoCompleteArrow();
      expect(arrow, 'the note offers an arrow').toBeTruthy();
      await userEvent.click(page.elementLocator(arrow!));
      await settle();
      const clones = newBlocks(before, 'affine:note');
      expect(clones).toHaveLength(1);
      return clones[0];
    };

    test('beside a note in a user layer', async () => {
      const created = await secondLayer();
      const note = addNote('[0,0,400,100]');
      await settle();
      expect(ownLayerOf(model(note))).toBe(created);
      await activateDefault();

      expect(ownLayerOf(model(await cloneByArrow(note)))).toBe(created);
    });

    test('beside a note in the default layer, a user layer active', async () => {
      const note = addNote('[0,0,400,100]');
      await settle();
      const created = await secondLayer();
      expect(ownLayerOf(model(note))).toBeUndefined();

      const clone = await cloneByArrow(note);
      expect(created).toBeTruthy();
      expect(ownLayerOf(model(clone))).toBeUndefined();
    });

    // The element counterpart: the clone is built from `serialize()`, which
    // names no layer for a default-layer shape, so it asks explicitly.
    test('beside a shape in the default layer, a user layer active', async () => {
      const shape = crud().addElement('shape', {
        shapeType: ShapeType.Rect,
        xywh: '[0,0,100,100]',
      })!;
      await settle();
      const created = await secondLayer();
      expect(ownLayerOf(model(shape))).toBeUndefined();
      const before = new Set(surface().elementModels.map(e => e.id));

      await selectAndRender(shape);
      const arrow = autoCompleteArrow();
      expect(arrow, 'the shape offers an arrow').toBeTruthy();
      await userEvent.click(page.elementLocator(arrow!));
      await settle();

      const clones = surface()
        .getElementsByType('shape')
        .filter(element => !before.has(element.id));
      expect(clones).toHaveLength(1);
      expect(created).toBeTruthy();
      expect(ownLayerOf(clones[0])).toBeUndefined();
      expect(clones[0].yMap.has('layer')).toBe(false);
    });
  });

  test('the note split off by the note slicer', async () => {
    const created = await secondLayer();
    const note = addNote('[0,0,400,200]', 3);
    await settle();
    await activateDefault();
    const before = blockIds();

    await selectAndRender(note);
    // The pointer is over the note first (any viewport change hides the
    // slicer until it moves), then the toolbar's scissors toggle it on.
    await userEvent.hover(
      page.elementLocator(edgeless.std.view.getBlock(note)!)
    );
    edgeless.std.get(EdgelessLegacySlotIdentifier).toggleNoteSlicer.next();
    await settle();
    await frames();
    const slicer = document.querySelector('note-slicer');
    const button = slicer?.shadowRoot?.querySelector<HTMLElement>(
      '.note-slicer-button'
    );
    expect(button, 'the slicer offers its button').toBeTruthy();
    await userEvent.click(page.elementLocator(button!));
    await settle();

    const split = newBlocks(before, 'affine:note');
    expect(split).toHaveLength(1);
    expect(ownLayerOf(model(split[0]))).toBe(created);
  });

  describe('the block that replaces a link when its view changes', () => {
    const YOUTUBE = 'https://www.youtube.com/watch?v=dQw4w9WgXcQ';

    const replace = async (
      flavour: string,
      props: Record<string, unknown>,
      actionId: string
    ) => {
      const created = await secondLayer();
      const source = crud().addBlock(flavour, props, surface().id);
      await settle();
      expect(ownLayerOf(model(source))).toBe(created);
      await activateDefault();
      const before = blockIds();

      await selectAndRender(source);
      runSurfaceAction(flavour, actionId);
      await settle();

      expect(window.doc.getBlock(source), 'the source is replaced').toBeFalsy();
      const replacement = [...blockIds()].filter(id => !before.has(id));
      expect(replacement).toHaveLength(1);
      expect(ownLayerOf(model(replacement[0]))).toBe(created);
    };

    test('a bookmark shown as an embed', async () => {
      await replace(
        'affine:bookmark',
        { url: YOUTUBE, xywh: '[0,0,400,100]', style: 'horizontal' },
        'embed'
      );
    });

    test('an external embed shown as a card', async () => {
      await replace(
        'affine:embed-youtube',
        { url: YOUTUBE, xywh: '[0,0,400,300]', style: 'video' },
        'card'
      );
    });

    test('an iframe shown as a card', async () => {
      await replace(
        'affine:embed-iframe',
        { url: YOUTUBE, xywh: '[0,0,400,300]' },
        'card'
      );
    });
  });

  describe('a doc embed', () => {
    const otherDoc = () => {
      const store = window.collection.createDoc('doc:other').getStore({
        id: 'doc:other',
      });
      store.load(() => {
        const rootId = store.addBlock('affine:page', {
          title: new Text('Other'),
        });
        store.addBlock('affine:surface', {}, rootId);
        const note = store.addBlock('affine:note', {}, rootId);
        store.addBlock(
          'affine:paragraph',
          { text: new Text('borrowed') },
          note
        );
      });
      return 'doc:other';
    };

    const convert = async (
      flavour: string,
      style: string,
      method: 'convertToEmbed' | 'convertToCard'
    ) => {
      const pageId = otherDoc();
      const created = await secondLayer();
      const source = crud().addBlock(
        flavour,
        { pageId, xywh: '[0,0,400,300]', style },
        surface().id
      );
      await settle();
      expect(ownLayerOf(model(source))).toBe(created);
      await activateDefault();
      const before = blockIds();

      (
        edgeless.std.view.getBlock(source) as unknown as Record<
          typeof method,
          () => void
        >
      )[method]();
      await settle();

      const replacement = [...blockIds()].filter(id => !before.has(id));
      expect(replacement).toHaveLength(1);
      expect(ownLayerOf(model(replacement[0]))).toBe(created);
    };

    test('a linked doc turned into a synced doc', async () => {
      await convert('affine:embed-linked-doc', 'vertical', 'convertToEmbed');
    });

    test('a synced doc turned into a linked doc', async () => {
      await convert('affine:embed-synced-doc', 'syncedDoc', 'convertToCard');
    });

    test('the note "duplicate as note" puts beside a synced doc', async () => {
      const pageId = otherDoc();
      const created = await secondLayer();
      const synced = crud().addBlock(
        'affine:embed-synced-doc',
        { pageId, xywh: '[0,0,400,300]', style: 'syncedDoc' },
        surface().id
      );
      await settle();
      await activateDefault();
      const before = blockIds();

      await selectAndRender(synced);
      runSurfaceAction('affine:embed-synced-doc', 'c.duplicate-as-note');
      await wait(200);
      await settle();

      const notes = newBlocks(before, 'affine:note');
      expect(notes).toHaveLength(1);
      expect(ownLayerOf(model(notes[0]))).toBe(created);
    });
  });
});
