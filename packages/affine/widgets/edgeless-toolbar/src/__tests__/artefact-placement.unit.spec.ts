import { EdgelessCRUDIdentifier } from '@labre/affine-block-surface';
import { ConnectorElementModel, NoteBlockModel } from '@labre/affine-model';
import {
  type AnyCommandDescriptor,
  type BlockStdScope,
  type CommandInvocation,
  type CommandKind,
  CommandDescriptorIdentifier,
  CommandUsageIdentifier,
} from '@labre/std';
import { gfxGroupCompatibleSymbol, type GfxController } from '@labre/std/gfx';
import { Subject } from 'rxjs';
import { describe, expect, test, vi } from 'vitest';

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
