/**
 * A frame lands in the viewer's ACTIVE layer, like every other new model
 * (ADR 0031 §6).
 *
 * Both frame creation paths — the frame tool's drag (`FrameTool.dragMove`) and
 * the manager's `_addFrameBlock` behind "frame the selection", the frame menu
 * presets and the surface-ref slash menu — wrote through `store.addBlock`
 * directly and so skipped the stamp the CRUD `addBlock` path applies. The
 * frame always fell in the default layer, which the selection pane made
 * visible once frames became ordinary rows of their layer. What this pins:
 *
 * - an active user layer is written on the frame;
 * - the default layer active, or no layer record at all, writes no `layer`
 *   key — the same rule as for elements (`resolveCreationLayer`);
 * - the frame keeps the index `frameIndexAt` gives it: the layer is stamped
 *   beside it, the stacking rule is not re-derived.
 */
import {
  CanvasActiveLayer,
  OverlayIdentifier,
} from '@labre/affine-block-surface';
import { EditPropsStore } from '@labre/affine-shared/services';
import { Bound } from '@labre/global/gfx';
import type { BlockStdScope, PointerEventState } from '@labre/std';
import { DEFAULT_LAYER_ID, GfxControllerIdentifier } from '@labre/std/gfx';
import { describe, expect, it } from 'vitest';

import {
  EdgelessFrameManager,
  EdgelessFrameManagerIdentifier,
} from '../frame-manager';
import { FrameTool } from '../frame-tool';

type Layers = Record<string, { name: string; index: string }> | undefined;

function fakeCanvas(layers: Layers, active: string | null) {
  const added: Record<string, unknown>[] = [];
  const services = new Map<unknown, unknown>();
  const std = {
    get: (id: unknown) => {
      const service = services.get(id);
      if (service === undefined) throw new Error(`unexpected get`);
      return service;
    },
    getOptional: (id: unknown) => services.get(id) ?? null,
  } as unknown as BlockStdScope;

  const frameModel = {
    id: 'frame-id',
    flavour: 'affine:frame',
    stash() {},
    pop() {},
  };
  const noopSubscribable = { subscribe: () => ({ unsubscribe() {} }) };
  const doc = {
    addBlock: (
      _flavour: string,
      props: Record<string, unknown>,
      _parent: unknown
    ) => {
      added.push(props);
      return 'frame-id';
    },
    captureSync() {},
    blocks: { value: {} },
    slots: { blockUpdated: noopSubscribable },
  };
  const gfx = {
    std,
    doc,
    surface: { elementAdded: noopSubscribable, props: { layers } },
    layer: { layers: [], blocks: [], generateIndex: () => 'a1' },
    viewport: { toModelCoord: (x: number, y: number) => [x, y] },
    getElementById: () => frameModel,
  };

  const manager = new EdgelessFrameManager(gfx as never);
  services.set(GfxControllerIdentifier, gfx);
  services.set(EditPropsStore, {
    applyLastProps: (_flavour: string, props: Record<string, unknown>) => props,
  });
  services.set(EdgelessFrameManagerIdentifier, manager);
  services.set(OverlayIdentifier('frame'), { clear() {}, highlight() {} });
  if (active) services.set(CanvasActiveLayer, { resolve: () => active });

  const drawWithTool = () => {
    const tool = new FrameTool(gfx as never);
    tool.dragStart({ point: { x: 0, y: 0 } } as PointerEventState);
    tool.dragMove({ point: { x: 100, y: 100 } } as PointerEventState);
  };
  const frameSelection = () =>
    (
      manager as unknown as { _addFrameBlock: (b: Bound) => unknown }
    )._addFrameBlock(new Bound(0, 0, 100, 100));

  return { added, drawWithTool, frameSelection };
}

const TWO_LAYERS = {
  [DEFAULT_LAYER_ID]: { name: 'Layer 1', index: 'a0' },
  mine: { name: 'Mine', index: 'a1' },
};

describe('a new frame lands in the active layer', () => {
  for (const [path, create] of [
    ['the frame tool', 'drawWithTool'],
    ['frame the selection', 'frameSelection'],
  ] as const) {
    it(`${path}: an active user layer is written on the frame`, () => {
      const canvas = fakeCanvas(TWO_LAYERS, 'mine');
      canvas[create]();
      expect(canvas.added).toHaveLength(1);
      expect(canvas.added[0].layer).toBe('mine');
      expect(canvas.added[0].index).toBe('a1');
    });

    it(`${path}: the default layer active writes no layer key`, () => {
      const canvas = fakeCanvas(TWO_LAYERS, DEFAULT_LAYER_ID);
      canvas[create]();
      expect('layer' in canvas.added[0]).toBe(false);
    });

    it(`${path}: no layer record writes no layer key`, () => {
      const canvas = fakeCanvas(undefined, null);
      canvas[create]();
      expect('layer' in canvas.added[0]).toBe(false);
    });
  }
});
