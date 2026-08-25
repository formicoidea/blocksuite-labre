/**
 * Middle-button panning, seen from the only place it is observable: the
 * `pointerup` listener the tool hangs on `document` when the wheel is pressed.
 *
 * The tool itself is unreachable in a unit test — it lives behind a
 * `GfxController`, a tool controller and a surface — so the tests below drive
 * the ONE seam that matters: `mounted()` registers a `pointerDown` hook, and
 * everything the gesture does (tool switch, selection restore, listener
 * teardown) happens inside it. A hand-rolled double stands in for the gfx
 * controller, and it deliberately reproduces the one behaviour of the real
 * `ToolController.setTool` these tests hinge on: it CLEARS the selection.
 */
import { MouseButton } from '@labre/std/gfx';
import { beforeEach, describe, expect, test, vi } from 'vitest';

import { PanTool } from '../tools/pan-tool.js';

class FakeTool {
  static toolName = 'fake';
}

/** Stands in for the selection tool, the only one that lends a finger drag away. */
class SelectTool {
  static toolName = 'default';
}

type Hook = (evt: unknown) => unknown;

function setup(
  currentTool: { toolType?: unknown; options?: unknown } = {
    toolType: FakeTool,
    options: { some: 'option' },
  },
  initialSelection: unknown[] = [{ elements: ['a'] }],
  /** What sits under the pointer; `null` is bare canvas. */
  elementAtPoint: unknown = null
) {
  let selections = initialSelection;

  const selection = {
    get surfaceSelections() {
      return selections;
    },
    set: vi.fn((next: unknown) => {
      selections = Array.isArray(next) ? next : [];
    }),
  };

  let activeTool = currentTool;

  const setTool = vi.fn((type: unknown, options?: unknown) => {
    // What the real `ToolController.setTool` does before activating the tool.
    selection.set([]);
    activeTool = { toolType: type, options };
  });

  const getElementByPoint = vi.fn(() => elementAtPoint);

  const gfx = {
    tool: {
      currentToolOption$: { peek: () => activeTool },
      setTool,
    },
    selection,
    std: { get: vi.fn(() => ({ navigatorSettingUpdated: { next: vi.fn() } })) },
    getElementByPoint,
    viewport: {
      // Identity: the model coordinates the hit test receives do not matter
      // here, only that a hit test happens at all.
      toModelCoord: (x: number, y: number) => [x, y],
      applyDeltaCenter: vi.fn(),
      zoom: 1,
    },
  };

  const tool = new PanTool(gfx as never);
  const hooks = new Map<string, Hook>();
  // `addHook` is an own instance property on `BaseTool`, so it can simply be
  // replaced — no tool controller needed to capture what `mounted()` registers.
  (tool as unknown as { addHook: unknown }).addHook = (
    evtName: string,
    handler: Hook
  ) => {
    hooks.set(evtName, handler);
  };
  tool.mounted();

  const preventDefault = vi.fn();
  const pressMiddle = () =>
    hooks.get('pointerDown')?.({
      raw: { button: MouseButton.MIDDLE, preventDefault },
    });

  /** One drag gesture: the controller's `dragStart` hook, then the tool. */
  const startDrag = (raw: {
    pointerType?: string;
    isPrimary?: boolean;
    button?: number;
  }) => {
    const evt = {
      x: 10,
      y: 20,
      raw: { button: MouseButton.MAIN, isPrimary: true, ...raw },
    };
    hooks.get('dragStart')?.(evt);
    // What `ToolController.invokeToolHandler` does once the hooks have run:
    // it resolves the tool AFTER them, so a hook that swapped tools wins.
    if (activeTool.toolType === PanTool) tool.dragStart(evt as never);
    return evt;
  };

  const endDrag = (evt: unknown) => tool.dragEnd(evt as never);

  return {
    gfx,
    tool,
    hooks,
    pressMiddle,
    startDrag,
    endDrag,
    preventDefault,
    getElementByPoint,
    setTool,
    selection,
    activeToolName: () =>
      (activeTool.toolType as { toolName?: string } | undefined)?.toolName,
    currentSelection: () => selections,
  };
}

/** A `pointerup` on `document`, as the browser would deliver it. */
function releaseButton(button: number) {
  document.dispatchEvent(new MouseEvent('pointerup', { button }));
}

describe('pan tool — middle button gesture', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  test('the pointerup listener is released whatever button ended the gesture', () => {
    const { pressMiddle, setTool } = setup();

    pressMiddle();
    expect(setTool).toHaveBeenCalledTimes(1); // PanTool is now active

    // A right-click release: not the middle button, so nothing is restored…
    releaseButton(MouseButton.SECONDARY);
    expect(setTool).toHaveBeenCalledTimes(1);

    // …and the listener must be gone all the same. If it survived, this later
    // middle-button release — belonging to no gesture at all — would restore a
    // long-dead tool over whatever the user is doing now.
    releaseButton(MouseButton.MIDDLE);
    expect(setTool).toHaveBeenCalledTimes(1);
  });

  test('a middle-button release restores the previous tool, once', () => {
    const { pressMiddle, setTool } = setup();

    pressMiddle();
    releaseButton(MouseButton.MIDDLE);

    expect(setTool).toHaveBeenCalledTimes(2);
    expect(setTool.mock.calls[1]).toEqual([FakeTool, { some: 'option' }]);

    // The listener is gone: a second release changes nothing.
    releaseButton(MouseButton.MIDDLE);
    expect(setTool).toHaveBeenCalledTimes(2);
  });

  test('the selection is the one held when the wheel went down', () => {
    const held = [{ elements: ['a'] }];
    const { pressMiddle, currentSelection } = setup(undefined, held);

    pressMiddle();
    // Activating the pan tool cleared the selection — which is exactly why the
    // snapshot has to be taken at pointer-down and not read back here.
    expect(currentSelection()).toEqual([]);

    releaseButton(MouseButton.MIDDLE);
    expect(currentSelection()).toEqual(held);
  });

  test('the selection snapshot survives a mutation of the live array', () => {
    const live = [{ elements: ['a'] }];
    const { pressMiddle, currentSelection } = setup(undefined, live);

    pressMiddle();
    live.length = 0; // the real selection manager mutates in place

    releaseButton(MouseButton.MIDDLE);
    expect(currentSelection()).toEqual([{ elements: ['a'] }]);
  });

  test('the tool switch happens on the same frame as the press', () => {
    const { pressMiddle, setTool } = setup();

    // Not on a later animation frame: a pan that starts one frame late drops
    // the first pointer moves of the gesture.
    pressMiddle();
    expect(setTool).toHaveBeenCalledTimes(1);
    expect(setTool.mock.calls[0]?.[0]).toBe(PanTool);
    expect(setTool.mock.calls[0]?.[1]).toEqual({ panning: true });
  });

  test('a middle click while the pan tool is already active is left alone', () => {
    const { pressMiddle, preventDefault, setTool, currentSelection } = setup({
      toolType: PanTool,
      options: { panning: true },
    });

    expect(pressMiddle()).toBeUndefined(); // the hook does not claim the event
    expect(preventDefault).not.toHaveBeenCalled();
    expect(setTool).not.toHaveBeenCalled();

    // And no listener was hung: a release restores nothing.
    releaseButton(MouseButton.MIDDLE);
    expect(setTool).not.toHaveBeenCalled();
    expect(currentSelection()).toEqual([{ elements: ['a'] }]);
  });
});

/**
 * Sliding the board with a finger. The selection tool answers a one-finger
 * drag with a rubber band, which on a touchscreen leaves the board immobile —
 * upstream #15091. The pan tool takes the gesture over for the time it lasts,
 * exactly as it does for the middle mouse button, and only when the finger
 * landed on nothing: an element under it is still an element being moved.
 */
describe('pan tool — one-finger gesture', () => {
  const selecting = { toolType: SelectTool, options: { some: 'option' } };
  const finger = { pointerType: 'touch' as const };

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  test('a finger dragging bare canvas slides the board', () => {
    const { startDrag, setTool, tool, activeToolName } = setup(selecting);

    startDrag(finger);

    expect(setTool).toHaveBeenCalledTimes(1);
    expect(setTool.mock.calls[0]).toEqual([PanTool, { panning: true }]);
    expect(activeToolName()).toBe('pan');
    // Not merely activated: the gesture itself reached the tool.
    expect(tool.panning$.value).toBe(true);
  });

  test('lifting the finger gives the selection tool and its selection back', () => {
    const held = [{ elements: ['a'] }];
    const { startDrag, endDrag, setTool, currentSelection, activeToolName } =
      setup(selecting, held);

    const evt = startDrag(finger);
    expect(currentSelection()).toEqual([]); // the tool switch cleared it

    endDrag(evt);

    expect(setTool).toHaveBeenCalledTimes(2);
    expect(setTool.mock.calls[1]).toEqual([SelectTool, { some: 'option' }]);
    expect(activeToolName()).toBe('default');
    expect(currentSelection()).toEqual(held);
  });

  test('the borrow is handed back once, not on every later drag end', () => {
    const { startDrag, endDrag, setTool } = setup(selecting);

    const evt = startDrag(finger);
    endDrag(evt);
    endDrag(evt);

    expect(setTool).toHaveBeenCalledTimes(2);
  });

  test('a finger landing on an element is left to move that element', () => {
    // What keeps dragging a Wardley or EDGY node by hand working.
    const { startDrag, setTool } = setup(selecting, undefined, {
      id: 'wardley-node',
    });

    startDrag(finger);

    expect(setTool).not.toHaveBeenCalled();
  });

  test('a mouse drag over bare canvas still rubber-bands', () => {
    const { startDrag, setTool, getElementByPoint } = setup(selecting);

    startDrag({ pointerType: 'mouse' });

    expect(setTool).not.toHaveBeenCalled();
    expect(getElementByPoint).not.toHaveBeenCalled();
  });

  test('a second finger is left to the two-finger pan and pinch', () => {
    const { startDrag, setTool } = setup(selecting);

    startDrag({ ...finger, isPrimary: false });

    expect(setTool).not.toHaveBeenCalled();
  });

  test('a finger drawing with another tool is left alone', () => {
    // Brush, shape, connector, the framework tools: on bare canvas a finger is
    // how they are meant to draw, so the gesture is not theirs to lend.
    const { startDrag, setTool } = setup();

    startDrag(finger);

    expect(setTool).not.toHaveBeenCalled();
  });
});
