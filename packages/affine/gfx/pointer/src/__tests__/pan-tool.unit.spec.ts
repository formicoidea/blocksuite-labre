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

type PointerDownHook = (evt: {
  raw: { button: number; preventDefault: () => void };
}) => unknown;

function setup(
  currentTool: { toolType?: unknown; options?: unknown } = {
    toolType: FakeTool,
    options: { some: 'option' },
  },
  initialSelection: unknown[] = [{ elements: ['a'] }]
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

  const setTool = vi.fn((_type: unknown, _options?: unknown) => {
    // What the real `ToolController.setTool` does before activating the tool.
    selection.set([]);
  });

  const gfx = {
    tool: {
      currentToolOption$: { peek: () => currentTool },
      setTool,
    },
    selection,
    std: { get: vi.fn(() => ({ navigatorSettingUpdated: { next: vi.fn() } })) },
    viewport: {},
  };

  const tool = new PanTool(gfx as never);
  let hook: PointerDownHook | undefined;
  // `addHook` is an own instance property on `BaseTool`, so it can simply be
  // replaced — no tool controller needed to capture what `mounted()` registers.
  (tool as unknown as { addHook: unknown }).addHook = (
    _evtName: string,
    handler: PointerDownHook
  ) => {
    hook = handler;
  };
  tool.mounted();

  const preventDefault = vi.fn();
  const pressMiddle = () =>
    hook?.({ raw: { button: MouseButton.MIDDLE, preventDefault } });

  return {
    gfx,
    pressMiddle,
    preventDefault,
    setTool,
    selection,
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
});
