import type { GfxViewInteractionConfig } from '@labre/std/gfx';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { EdgelessNoteInteraction } from '../note-edgeless-block.js';

const mocks = vi.hoisted(() => ({ handleNativeRangeAtPoint: vi.fn() }));

vi.mock('@labre/affine-shared/utils', async importOriginal => {
  const actual =
    await importOriginal<typeof import('@labre/affine-shared/utils')>();
  return {
    ...actual,
    handleNativeRangeAtPoint: mocks.handleNativeRangeAtPoint,
  };
});

/**
 * `GfxViewInteractionExtension` hands its config straight to the DI container,
 * so the only way in is to run the extension's `setup` with a container that
 * keeps the factory.
 */
function interactionConfig() {
  let config: GfxViewInteractionConfig | undefined;
  EdgelessNoteInteraction.setup?.({
    addImpl: (_identifier: unknown, factory: () => unknown) => {
      config = factory() as GfxViewInteractionConfig;
    },
  } as never);
  if (!config) throw new Error('EdgelessNoteInteraction registered no config');
  return config;
}

/**
 * A note holding one paragraph, with a title band at y ∈ [0, 40] and a content
 * band at y ∈ [40, 240], both 400 wide.
 */
function setup({
  editing,
  alreadySelected,
}: {
  editing: boolean;
  alreadySelected: boolean;
}) {
  const selectionSet = vi.fn();
  const gfx = {
    selection: {
      editing,
      has: () => alreadySelected,
      set: selectionSet,
    },
    viewport: { zoom: 1 },
  };
  const view = {
    isConnected: true,
    updateComplete: Promise.resolve(true),
    querySelector: (selector: string) => {
      if (selector === 'edgeless-page-block-title') {
        return {
          getBoundingClientRect: () => ({ x: 0, y: 0, width: 400, height: 40 }),
        };
      }
      if (selector === '.affine-block-children-container') {
        return {
          getBoundingClientRect: () => ({
            left: 0,
            right: 400,
            top: 40,
            bottom: 240,
          }),
        };
      }
      return null;
    },
  };
  const model = {
    id: 'note-1',
    children: [{ id: 'paragraph-1' }],
    isLocked: () => false,
  };
  const std = { store: { addBlock: vi.fn() } };

  const handlers = interactionConfig().handleSelection?.({
    std,
    gfx,
    view,
    model,
  } as never);
  if (!handlers?.onSelect) throw new Error('no onSelect handler');

  return { onSelect: handlers.onSelect, selectionSet };
}

function selectContext(
  clientX: number,
  clientY: number,
  {
    multiSelect = false,
    fallback = vi.fn(),
  }: { multiSelect?: boolean; fallback?: ReturnType<typeof vi.fn> } = {}
) {
  return {
    selected: true,
    multiSelect,
    event: { clientX, clientY },
    default: fallback,
  };
}

/** The caret is placed inside `view.updateComplete.then(...)`. */
async function flush() {
  await Promise.resolve();
  await Promise.resolve();
}

describe('edgeless note selection', () => {
  beforeEach(() => {
    mocks.handleNativeRangeAtPoint.mockClear();
  });

  describe('caret on first focus (upstream #14229)', () => {
    it('leaves a click on the title on the title', async () => {
      const { onSelect } = setup({ editing: false, alreadySelected: true });

      onSelect(selectContext(120, 20) as never);
      await flush();

      expect(mocks.handleNativeRangeAtPoint).toHaveBeenCalledWith(120, 20);
    });

    it('still clamps a click on the note body into the content area', async () => {
      const { onSelect } = setup({ editing: false, alreadySelected: true });

      // Just inside the top of the content band: the clamp pushes it down to
      // `top + 8 * zoom`.
      onSelect(selectContext(120, 41) as never);
      await flush();

      expect(mocks.handleNativeRangeAtPoint).toHaveBeenCalledWith(120, 48);
    });
  });

  describe('shift-click range selection (upstream #14675)', () => {
    it('keeps the editing state when shift-clicking inside the note', () => {
      const { onSelect, selectionSet } = setup({
        editing: true,
        alreadySelected: true,
      });
      const fallback = vi.fn();

      onSelect(
        selectContext(120, 120, { multiSelect: true, fallback }) as never
      );

      // The default multi-select toggles the note out of editing, which drops
      // the range the shift-click was building.
      expect(fallback).not.toHaveBeenCalled();
      expect(selectionSet).not.toHaveBeenCalled();
    });

    it('still runs the default multi-select on a note that is not being edited', () => {
      const { onSelect } = setup({ editing: false, alreadySelected: true });
      const fallback = vi.fn();

      onSelect(
        selectContext(120, 120, { multiSelect: true, fallback }) as never
      );

      expect(fallback).toHaveBeenCalledTimes(1);
    });
  });
});
