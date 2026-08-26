import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as Y from 'yjs';

import { WardleyView } from '../element-view';

/**
 * The in-place label editor, driven through the REAL path: a `dblclick`
 * dispatched on the view, the declaration's hit test, the `<input>` it opens,
 * and the commit that fires on blur and on Enter.
 *
 * What this file exists for: opening an editor is not renaming. Since the ten
 * label props default to `undefined`, the box opens on the resolved VOCABULARY
 * — so a commit that wrote back unconditionally would turn a glance into a
 * permanent English (or worse, half-translated) label, beyond the reach of any
 * catalogue, on a map the user never meant to edit.
 */

const W = 1600;
const H = 900;

/**
 * Inside the `xAxisTitle` box of a 1600 × 900 map: the title is right-aligned
 * at (1554, 884) and "Evolution" is ~97 wide, so 1450 → 1560 horizontally and
 * 860 → 895 vertically.
 */
const ON_X_AXIS_TITLE = { x: 1500, y: 880 };

/** Well inside the plot, on no label at all. */
const ON_OPEN_SPACE = { x: 800, y: 400 };

function setup(props: Record<string, unknown> = {}) {
  // The element as the document holds it. `updateElement` is the only writer
  // in production, so routing the stub through this map is what makes
  // "nothing was written" a real assertion rather than a spy count.
  const yMap = new Y.Map<unknown>();
  new Y.Doc().getMap<Y.Map<unknown>>('elements').set('bg', yMap);
  for (const [key, value] of Object.entries(props)) yMap.set(key, value);

  const model = new Proxy(
    {
      id: 'bg',
      deserializedXYWH: [0, 0, W, H],
      rotate: 0,
      isLocked: () => false,
    },
    {
      get(target: Record<string, unknown>, prop: string) {
        if (prop in target) return target[prop];
        // Everything else — the ten label props, the toggles — reads through
        // to the document, exactly as a `@field` accessor does.
        return yMap.get(prop);
      },
    }
  );

  const updateElement = vi.fn((_id: string, patch: Record<string, unknown>) => {
    for (const [key, value] of Object.entries(patch)) yMap.set(key, value);
  });
  const captureSync = vi.fn();

  const gfx = {
    viewport: { toModelCoord: (x: number, y: number) => [x, y] },
    selection: { set: vi.fn() },
    std: {
      store: { captureSync },
      get: () => ({ updateElement }),
      getOptional: () => null,
    },
  };

  const view = new WardleyView(model as never, gfx as never);
  view.onCreated();

  const dblclick = (at: { x: number; y: number }) =>
    view.dispatch('dblclick', {
      ...at,
      raw: { clientX: at.x, clientY: at.y },
    } as never);

  const editor = () => document.querySelector('input');

  return { view, yMap, updateElement, captureSync, dblclick, editor };
}

describe('the in-place label editor', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('opens on a label, showing the words currently on screen', () => {
    // No `xAxisTitle` in the document: the box must still read "Evolution".
    const { dblclick, editor } = setup({ showXAxis: true });
    dblclick(ON_X_AXIS_TITLE);
    expect(editor()?.value).toBe('Evolution');
  });

  it('writes NOTHING when it is dismissed without a keystroke', () => {
    const { dblclick, editor, yMap, updateElement, captureSync } = setup({
      showXAxis: true,
    });

    dblclick(ON_X_AXIS_TITLE);
    const input = editor();
    expect(input).not.toBeNull();

    // Double-clicked, read, clicked away — the whole gesture.
    input!.dispatchEvent(new Event('blur'));

    // The vocabulary was NOT frozen into the document as user text...
    expect(yMap.has('xAxisTitle')).toBe(false);
    expect(updateElement).not.toHaveBeenCalled();
    // ...and no empty entry was pushed onto undo.
    expect(captureSync).not.toHaveBeenCalled();
    // The editor is gone either way.
    expect(editor()).toBeNull();
  });

  it('writes the new wording when the user actually renames it', () => {
    const { dblclick, editor, yMap, updateElement, captureSync } = setup({
      showXAxis: true,
    });

    dblclick(ON_X_AXIS_TITLE);
    const input = editor()!;
    input.value = 'Maturité';
    input.dispatchEvent(new Event('blur'));

    expect(yMap.get('xAxisTitle')).toBe('Maturité');
    expect(updateElement).toHaveBeenCalledWith('bg', {
      xAxisTitle: 'Maturité',
    });
    expect(captureSync).toHaveBeenCalled();
  });

  it('lets the user clear a label they had previously renamed', () => {
    // Emptying is a real edit, not a no-op: the guard compares against the
    // words that were SHOWN, which here are the user's own.
    const { dblclick, editor, yMap } = setup({
      showXAxis: true,
      xAxisTitle: 'Maturité',
    });

    dblclick(ON_X_AXIS_TITLE);
    const input = editor()!;
    expect(input.value).toBe('Maturité');
    input.value = '';
    input.dispatchEvent(new Event('blur'));

    expect(yMap.get('xAxisTitle')).toBe('');
  });

  it('opens nothing on a hidden label, or on open canvas', () => {
    const onOpenSpace = setup({ showXAxis: true });
    onOpenSpace.dblclick(ON_OPEN_SPACE);
    expect(onOpenSpace.editor()).toBeNull();

    document.body.innerHTML = '';
    const axisHidden = setup({ showXAxis: false });
    axisHidden.dblclick(ON_X_AXIS_TITLE);
    expect(axisHidden.editor()).toBeNull();
  });
});
