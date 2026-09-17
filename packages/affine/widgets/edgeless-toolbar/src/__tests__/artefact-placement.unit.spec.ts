import {
  CanvasRenderer,
  EdgelessCRUDIdentifier,
  ElementRendererIdentifier,
} from '@labre/affine-block-surface';
import { ConnectorElementModel, NoteBlockModel } from '@labre/affine-model';
import { ThemeProvider } from '@labre/affine-shared/services';
import { Bound } from '@labre/global/gfx';
import {
  type AnyCommandDescriptor,
  type BlockStdScope,
  type CommandInvocation,
  type CommandKind,
  CommandDescriptorIdentifier,
  CommandUsageIdentifier,
} from '@labre/std';
import {
  type GfxController,
  gfxGroupCompatibleSymbol,
  GfxGroupLikeElementModel,
} from '@labre/std/gfx';
import { Subject } from 'rxjs';
import { describe, expect, test, vi } from 'vitest';

import type { ArtefactGhostOverlay } from '../placement/artefact-ghost-overlay.js';
import {
  armedArtefact,
  ArtefactPlacementTool,
  cycleArmedArtefact,
} from '../placement/artefact-placement-tool.js';
import { translateCreated } from '../placement/translate-created.js';

/**
 * The placement tool's half of the contract: which artefact Shift+S walks to,
 * where a click puts what the command created, and what arming does NOT report.
 *
 * All three need a `gfx` and no editor — the gestures themselves (a real click
 * on a real canvas) belong to the integration suite.
 */

const command = (
  id: string,
  kind: CommandKind = 'artefact',
  run: AnyCommandDescriptor['run'] = () => {}
): AnyCommandDescriptor =>
  ({
    id,
    owner: 'wardley',
    kind,
    labelKey: `com.labre.commands.${id}`,
    labelFallback: id,
    surfaces: ['senior-menu', 'catalogue'],
    scope: 'edgeless',
    defaultKeys: { mac: [], other: [] },
    run,
  }) as unknown as AnyCommandDescriptor;

/** A `gfx` that answers exactly what the placement path asks it. */
const stubGfx = (options: {
  commands?: AnyCommandDescriptor[];
  armed?: AnyCommandDescriptor;
  centre?: [number, number];
  models?: Record<string, unknown>;
  usage?: { record: () => void; statsOf: () => undefined };
}) => {
  const { commands = [], armed, centre = [0, 0], models = {}, usage } = options;

  const setTool = vi.fn();
  const select = vi.fn();
  const updateElement = vi.fn();
  const updateBlock = vi.fn();
  const elementAdded = new Subject<{ id: string; local: boolean }>();
  const blockUpdated = new Subject<{ type: string; id: string }>();

  const std = {
    get: (identifier: unknown) => {
      if (identifier === (EdgelessCRUDIdentifier as unknown)) {
        return { updateElement };
      }
      throw new Error('unexpected service');
    },
    getOptional: (identifier: unknown) =>
      identifier === (CommandUsageIdentifier as unknown) ? usage : undefined,
    provider: {
      getAll: (identifier: unknown) =>
        identifier === (CommandDescriptorIdentifier as unknown)
          ? new Map(commands.map((c, index) => [String(index), c]))
          : new Map(),
    },
    store: { slots: { blockUpdated }, updateBlock },
  };

  const gfx = {
    std,
    doc: { captureSync: () => {} },
    surface: { elementAdded },
    surfaceComponent: null,
    viewport: {
      centerX: centre[0],
      centerY: centre[1],
      zoom: 1,
      toModelCoord: (x: number, y: number) => [x, y],
    },
    selection: { set: select },
    tool: {
      setTool,
      currentToolOption$: {
        value: armed
          ? {
              toolType: ArtefactPlacementTool,
              options: { owner: 'wardley', command: armed },
            }
          : {},
      },
    },
    getElementById: (id: string) => models[id] ?? null,
  };

  (std as { command?: unknown }).command = undefined;

  return {
    gfx: gfx as unknown as GfxController,
    std: std as unknown as BlockStdScope,
    setTool,
    select,
    updateElement,
    updateBlock,
    elementAdded,
    blockUpdated,
  };
};

describe('cycleArmedArtefact', () => {
  test('a backwards step from the first artefact wraps to the last, skipping the tools', () => {
    const first = command('a');
    const commands = [
      first,
      command('link', 'tool'),
      command('b'),
      command('area', 'tool'),
      command('c'),
    ];
    const { gfx, setTool } = stubGfx({ commands, armed: first });

    expect(cycleArmedArtefact(gfx, -1)).toBe(true);
    expect(setTool).toHaveBeenCalledWith(ArtefactPlacementTool, {
      owner: 'wardley',
      command: commands[4],
    });
  });

  test('a forwards step lands on the next artefact, not the next button', () => {
    const commands = [command('a'), command('link', 'tool'), command('b')];
    const { gfx, setTool } = stubGfx({ commands, armed: commands[0] });

    expect(cycleArmedArtefact(gfx, 1)).toBe(true);
    expect(setTool).toHaveBeenCalledWith(ArtefactPlacementTool, {
      owner: 'wardley',
      command: commands[2],
    });
  });

  test('an artefact armed from the catalogue enters the row from its end', () => {
    const commands = [command('a'), command('b')];
    const { gfx, setTool } = stubGfx({
      commands,
      armed: command('catalogue-only'),
    });

    expect(cycleArmedArtefact(gfx, -1)).toBe(true);
    expect(setTool).toHaveBeenCalledWith(ArtefactPlacementTool, {
      owner: 'wardley',
      command: commands[1],
    });
  });

  test('with nothing armed the keystroke is not consumed', () => {
    const { gfx, setTool } = stubGfx({ commands: [command('a')] });

    expect(armedArtefact(gfx)).toBeNull();
    expect(cycleArmedArtefact(gfx, -1)).toBe(false);
    expect(setTool).not.toHaveBeenCalled();
  });
});

describe('translateCreated', () => {
  test('a shape moves, a created group moves through its children, a connector is asked to move itself', () => {
    const child = {
      id: 'child',
      xywh: '[10,10,20,20]',
      group: null as unknown,
    };
    const group = {
      id: 'group',
      xywh: '[10,10,20,20]',
      group: null,
      childElements: [child],
      [gfxGroupCompatibleSymbol]: true,
    };
    child.group = group;

    // A real `ConnectorElementModel` needs a live surface; what the move cares
    // about is only that `updateXYWH` recognises one, which is an `instanceof`.
    const moveTo = vi.fn();
    const connector = Object.defineProperties(
      Object.create(ConnectorElementModel.prototype),
      {
        id: { value: 'connector' },
        xywh: { value: '[0,0,40,40]' },
        group: { value: null },
        moveTo: { value: moveTo },
      }
    ) as ConnectorElementModel;

    const shape = { id: 'shape', xywh: '[0,0,100,50]', group: null };

    const { gfx, updateElement, updateBlock, std } = stubGfx({
      models: { shape, group, child, connector },
    });

    // A canvas BLOCK, reached through `updateXYWH`'s note branch — the one path
    // that writes through the store rather than the surface CRUD. The store it
    // carries is the harness's, so a receiver-sensitive call is exercised for
    // real instead of being assumed away.
    const note = Object.defineProperties(
      Object.create(NoteBlockModel.prototype),
      {
        id: { value: 'note' },
        xywh: { value: '[0,0,400,200]', writable: true },
        group: { value: null },
        store: { value: std.store },
        props: { value: { edgeless: { scale: 1 } } },
      }
    ) as NoteBlockModel;
    (
      gfx as unknown as { getElementById: (id: string) => unknown }
    ).getElementById = (id: string) =>
      ({ shape, group, child, connector, note })[
        id as 'shape' | 'group' | 'child' | 'connector' | 'note'
      ] ?? null;

    const placed = translateCreated(
      gfx,
      ['shape', 'group', 'child', 'connector', 'note'],
      200,
      -30
    );

    // The child is carried by the group it was created inside, so it is neither
    // moved twice nor offered to the selection.
    expect(placed).toEqual(['shape', 'group', 'connector', 'note']);
    expect(updateElement).toHaveBeenCalledWith('shape', {
      xywh: '[200,-30,100,50]',
    });
    expect(updateElement).toHaveBeenCalledWith('child', {
      xywh: '[210,-20,20,20]',
    });
    expect(moveTo).toHaveBeenCalledTimes(1);
    expect(updateElement).not.toHaveBeenCalledWith(
      'connector',
      expect.anything()
    );
    // The canvas block moves too, and its store write lands on the store — not
    // on an undefined receiver.
    expect(updateElement).toHaveBeenCalledWith('note', {
      xywh: '[200,-30,400,200]',
    });
    expect(updateBlock).toHaveBeenCalledTimes(1);
    expect(updateBlock.mock.instances[0]).toBe(std.store);
  });

  test('a placement that lands on the centre writes nothing', () => {
    const shape = { id: 'shape', xywh: '[0,0,10,10]', group: null };
    const { gfx, updateElement } = stubGfx({ models: { shape } });

    expect(translateCreated(gfx, ['shape'], 0, 0)).toEqual(['shape']);
    expect(updateElement).not.toHaveBeenCalled();
  });
});

describe('ArtefactPlacementTool.click', () => {
  const clickAt = (x: number, y: number) =>
    ({ point: { x, y }, x, y }) as never;

  test('the command runs once, through the bottleneck, and what it made lands under the cursor', () => {
    const invocations: CommandInvocation[] = [];
    const usage = { record: vi.fn(), statsOf: () => undefined };
    const shape = { id: 'el', xywh: '[-50,-25,100,50]', group: null };

    const harness = stubGfx({
      centre: [0, 0],
      models: { el: shape },
      usage,
    });

    // The invocation `runCommand` builds is what the telemetry reads; capture it.
    const run = vi.fn((_std: unknown, invocation: CommandInvocation) => {
      invocations.push(invocation);
      harness.elementAdded.next({ id: 'el', local: true });
    });
    const artefact = command(
      'wardley.addComponent',
      'artefact',
      run as unknown as AnyCommandDescriptor['run']
    );

    const tool = new ArtefactPlacementTool(harness.gfx);
    tool.activatedOption = { owner: 'wardley', command: artefact };
    tool.click(clickAt(400, 300));

    expect(run).toHaveBeenCalledTimes(1);
    expect(invocations).toEqual([
      { surface: 'senior-menu', source: 'toolbar:general' },
    ]);
    // Measured, because a placement IS a use — unlike arming.
    expect(usage.record).toHaveBeenCalledTimes(1);
    // Created around the viewport centre (0, 0), moved to the click point.
    expect(harness.updateElement).toHaveBeenCalledWith('el', {
      xywh: '[350,275,100,50]',
    });
    expect(harness.select).toHaveBeenCalledWith({
      elements: ['el'],
      editing: false,
    });
  });

  test('a canvas block the command added is collected too', () => {
    const note = { id: 'note', xywh: '[0,0,100,100]', group: null };
    const harness = stubGfx({ centre: [0, 0], models: { note } });

    const artefact = command('bpmn.addPool', 'artefact', () => {
      harness.blockUpdated.next({ type: 'add', id: 'note' });
    });

    const tool = new ArtefactPlacementTool(harness.gfx);
    tool.activatedOption = { owner: 'bpmn', command: artefact };
    tool.click(clickAt(10, 20));

    expect(harness.updateElement).toHaveBeenCalledWith('note', {
      xywh: '[10,20,100,100]',
    });
  });

  test('the subscriptions stop when the command does, so a later creation is left alone', () => {
    const shape = { id: 'late', xywh: '[0,0,10,10]', group: null };
    const harness = stubGfx({ centre: [0, 0], models: { late: shape } });

    const artefact = command('wardley.addComponent');
    const tool = new ArtefactPlacementTool(harness.gfx);
    tool.activatedOption = { owner: 'wardley', command: artefact };
    tool.click(clickAt(50, 50));

    harness.elementAdded.next({ id: 'late', local: true });

    expect(harness.updateElement).not.toHaveBeenCalled();
    expect(harness.select).not.toHaveBeenCalled();
  });
});

describe('the armed ghost is the artefact itself', () => {
  type Model = { id: string; type: string; deserializedXYWH: number[] };

  /**
   * A `gfx` with a canvas renderer, a surface that builds detached models, and
   * a renderer registered for every type but `connector`.
   */
  const previewHarness = () => {
    const renderCalls: { type: string; matrix: DOMMatrix }[] = [];
    const paint = vi.fn((model: Model, _ctx: unknown, matrix: DOMMatrix) => {
      renderCalls.push({ type: model.type, matrix });
    });
    const renderers: Record<string, typeof paint> = {
      shape: paint,
      text: paint,
      group: paint,
    };

    const std = {
      get: (identifier: unknown) => {
        if (identifier === (ThemeProvider as unknown)) {
          return { getCssVariableColor: () => '#000' };
        }
        throw new Error('unexpected service');
      },
      getOptional: (identifier: {
        identifierName?: string;
        variant?: string;
      }) =>
        identifier?.identifierName ===
        (ElementRendererIdentifier as { identifierName: string }).identifierName
          ? renderers[identifier.variant as string]
          : undefined,
    };

    const createDetachedElement = vi.fn(
      (props: { id: string; type: string; xywh: string }) =>
        ({
          id: props.id,
          type: props.type,
          deserializedXYWH: Bound.deserialize(props.xywh).toXYWH(),
        }) as Model
    );
    // Only its prototype chain is asked; it is never built.
    abstract class Group extends GfxGroupLikeElementModel {}
    const surface = {
      getConstructor: (type: string) =>
        type === 'group' ? Group : class Primitive {},
      createDetachedElement,
    };

    const renderer = Object.assign(Object.create(CanvasRenderer.prototype), {
      addOverlay: vi.fn(),
      removeOverlay: vi.fn(),
      refresh: vi.fn(),
    }) as {
      addOverlay: ReturnType<typeof vi.fn>;
      removeOverlay: ReturnType<typeof vi.fn>;
      refresh: ReturnType<typeof vi.fn>;
    };

    const gfx = {
      std,
      surface,
      surfaceComponent: { renderer, refresh: vi.fn() },
      viewport: {
        zoom: 1,
        viewportBounds: new Bound(0, 0, 1000, 1000),
        viewportUpdated: new Subject<void>(),
        toModelCoord: (x: number, y: number) => [x, y],
      },
      tool: { lastMouseViewPos$: { value: { x: 0, y: 0 } } },
    };

    const ctx = {
      save: vi.fn(),
      restore: vi.fn(),
      getTransform: () => new DOMMatrix(),
      beginPath: vi.fn(),
      roundRect: vi.fn(),
      stroke: vi.fn(),
      setLineDash: vi.fn(),
      fillText: vi.fn(),
      globalAlpha: 1,
    };

    const arm = (run: unknown) => {
      const tool = new ArtefactPlacementTool(gfx as unknown as GfxController);
      tool.activatedOption = {
        owner: 'wardley',
        command: command(
          'wardley.addComponent',
          'artefact',
          run as AnyCommandDescriptor['run']
        ),
      };
      tool.activate();
      return tool;
    };

    const ghost = () =>
      renderer.addOverlay.mock.calls.at(-1)?.[0] as
        | ArtefactGhostOverlay
        | undefined;

    const moveAndRender = (
      tool: ArtefactPlacementTool,
      x: number,
      y: number
    ) => {
      tool.pointerMove({ x, y } as never);
      ghost()?.render(ctx as unknown as CanvasRenderingContext2D, {} as never);
    };

    return {
      arm,
      ghost,
      moveAndRender,
      ctx,
      renderCalls,
      renderer,
      createDetachedElement,
    };
  };

  /** A command that creates through the CRUD, as every framework action does. */
  const creating =
    (...elements: [string, Record<string, unknown>][]) =>
    (std: BlockStdScope) => {
      const crud = std.get(EdgelessCRUDIdentifier);
      for (const [type, props] of elements) crud.addElement(type, props);
    };

  test('a shape and a text are painted at the cursor, the connector is not', () => {
    const h = previewHarness();
    const tool = h.arm(
      creating(
        ['shape', { xywh: '[-50,-25,100,50]' }],
        ['connector', { source: { position: [0, 0] }, target: { id: 'x' } }],
        ['text', { xywh: '[-40,30,80,20]', text: 'Component' }]
      )
    );

    h.moveAndRender(tool, 400, 300);

    expect(h.renderCalls.map(call => call.type)).toEqual(['shape', 'text']);
    // Cursor + recorded offset.
    const at = (i: number) => [
      h.renderCalls[i].matrix.e,
      h.renderCalls[i].matrix.f,
    ];
    expect(at(0)).toEqual([350, 275]);
    expect(at(1)).toEqual([360, 330]);
    // The real preview carries its own words: no box, no label.
    expect(h.ctx.roundRect).not.toHaveBeenCalled();
    expect(h.ctx.fillText).not.toHaveBeenCalled();
    // Seeds reach the surface as the CRUD received them, for its `propsToY`.
    expect(h.createDetachedElement).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'text', text: 'Component' })
    );
    expect(h.createDetachedElement).not.toHaveBeenCalledWith(
      expect.objectContaining({ type: 'connector' })
    );
  });

  test('a group is not painted, its children are', () => {
    const h = previewHarness();
    const tool = h.arm((std: BlockStdScope) => {
      const crud = std.get(EdgelessCRUDIdentifier);
      const a = crud.addElement('shape', { xywh: '[0,0,10,10]' });
      crud.addElement('group', { children: { [a as string]: true } });
    });

    h.moveAndRender(tool, 0, 0);

    expect(h.renderCalls.map(call => call.type)).toEqual(['shape']);
  });

  test('connectors only: no ghost at all, and so no fallback box', () => {
    const h = previewHarness();
    const tool = h.arm(
      creating([
        'connector',
        { source: { position: [0, 0] }, target: { position: [10, 10] } },
      ])
    );

    h.moveAndRender(tool, 10, 10);

    expect(h.renderer.addOverlay).not.toHaveBeenCalled();
    expect(h.renderCalls).toEqual([]);
    expect(h.ctx.roundRect).not.toHaveBeenCalled();
  });

  test('a recording that throws falls back to the dashed box and its label', () => {
    const h = previewHarness();
    const tool = h.arm(() => {
      throw new Error('unsupported');
    });

    h.moveAndRender(tool, 10, 10);

    expect(h.ghost()?.drawsArtefact).toBe(false);
    expect(h.renderCalls).toEqual([]);
    expect(h.ctx.roundRect).toHaveBeenCalledTimes(1);
    expect(h.ctx.fillText).toHaveBeenCalledWith(
      'wardley.addComponent',
      expect.any(Number),
      expect.any(Number)
    );
  });

  test('the models are built once per arming and once per cycle, never per move', () => {
    const h = previewHarness();
    const tool = h.arm(creating(['shape', { xywh: '[0,0,10,10]' }]));

    for (let i = 0; i < 10; i++) h.moveAndRender(tool, i, i);
    expect(h.createDetachedElement).toHaveBeenCalledTimes(1);
    expect(h.renderCalls).toHaveLength(10);

    // A Shift+S cycle re-arms the tool, and `setTool` activates it again.
    tool.activate();
    for (let i = 0; i < 10; i++) h.moveAndRender(tool, i, i);
    expect(h.createDetachedElement).toHaveBeenCalledTimes(2);
    expect(h.renderCalls).toHaveLength(20);
  });
});
