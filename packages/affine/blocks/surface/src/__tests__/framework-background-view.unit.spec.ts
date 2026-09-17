import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { FrameworkBackgroundDef } from '../framework-background/index.js';
import { DeclaredBackgroundView } from '../framework-background/index.js';

/**
 * The rename gesture every framework background shares, tested on the PRIMITIVE
 * rather than on one framework's copy of it.
 *
 * Before issue #355 this code lived in `WardleyView`, and the four frameworks
 * that wanted it copied the half they understood — which is how the Core Domain
 * Chart, the Event Storming board, Cynefin and Estuarine ended up with no
 * rename at all. What is pinned here is the contract the base class owes each
 * of them: it aims only at labels the declaration binds to a prop, it widens
 * the view's hit test over exactly those, it opens on the words on screen, and
 * it writes nothing at all when the user changes nothing.
 */

const W = 400;
const H = 200;

/**
 * Two texts, one renamable and one not — the whole point of the declaration
 * being the thing that decides.
 *
 * Both are anchored in the middle of the plot, well away from the border band a
 * background is picked by, so a hit here can only come from the label walk.
 */
const DEF: FrameworkBackgroundDef = {
  type: 'demo',
  geometry: {
    width: W,
    height: H,
    lockAspectRatio: false,
    resizable: true,
    margin: { top: 0, right: 0, bottom: 0, left: 0 },
  },
  chrome: {
    fontFamily: 'Demo, sans-serif',
    palette: { ink: '#111111' },
    surface: {},
  },
  axes: [
    {
      id: 'x',
      orientation: 'horizontal',
      at: 1,
      stroke: { color: '@ink', width: 1 },
      title: {
        id: 'title',
        // The user's own name for this board — renamable.
        prop: 'boardTitle',
        labelKey: 'demo.title',
        fallback: 'Board',
        anchor: { x: 0.5, y: 0.5 },
        style: { size: 20, color: '@ink' },
        align: 'center',
      },
      endLabels: [
        {
          id: 'fixed',
          // No prop: vocabulary, and therefore not offered for editing.
          labelKey: 'demo.fixed',
          fallback: 'Fixed',
          anchor: { x: 0.5, y: 0.25 },
          style: { size: 20, color: '@ink' },
          align: 'center',
        },
      ],
    },
  ],
};

/** Dead centre of the plot: inside the renamable title's box. */
const ON_TITLE = { x: 200, y: 100 };

/** On the fixed label, which the declaration binds to no prop. */
const ON_FIXED = { x: 200, y: 50 };

/** Inside the plot, on no label at all. */
const ON_OPEN_SPACE = { x: 60, y: 160 };

/** What the picking path passes. */
const PICK = { hitThreshold: 10, zoom: 1 };

class DemoView extends DeclaredBackgroundView {
  static override type: string = 'demo';

  protected override get def(): FrameworkBackgroundDef {
    return DEF;
  }
}

function setup(
  props: Record<string, unknown> = {},
  options: { readonly?: boolean; picked?: boolean } = {},
  View: typeof DemoView = DemoView
) {
  // Only `updateElement` writes in production, so routing the stub through this
  // store is what makes "nothing was written" a real assertion.
  const stored: Record<string, unknown> = { ...props };

  const model = new Proxy(
    {
      id: 'bg',
      deserializedXYWH: [0, 0, W, H],
      rotate: 0,
      isLocked: () => false,
      // The model's own answer: a background is picked by its border, and the
      // fixture keeps that answer constant so every hit below comes from the
      // label walk alone.
      includesPoint: () => options.picked ?? false,
    },
    {
      get(target: Record<string, unknown>, prop: string) {
        if (prop in target) return target[prop];
        return stored[prop];
      },
    }
  );

  const updateElement = vi.fn((_id: string, patch: Record<string, unknown>) => {
    Object.assign(stored, patch);
  });
  const captureSync = vi.fn();

  const gfx = {
    viewport: { toModelCoord: (x: number, y: number) => [x, y] },
    selection: { set: vi.fn() },
    std: {
      store: { captureSync, readonly: options.readonly ?? false },
      get: () => ({ updateElement }),
      getOptional: () => null,
    },
  };

  const view = new View(model as never, gfx as never);
  view.onCreated();

  const dblclick = (at: { x: number; y: number }) =>
    view.dispatch('dblclick', {
      ...at,
      raw: { clientX: at.x, clientY: at.y },
    } as never);

  const editor = () => document.querySelector('input');
  const hits = (at: { x: number; y: number }) =>
    view.includesPoint(at.x, at.y, PICK as never, null as never);

  return { view, stored, updateElement, captureSync, dblclick, editor, hits };
}

describe('where a declared background answers the pointer', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('widens the view over a label the declaration binds to a prop', () => {
    expect(setup().hits(ON_TITLE)).toBe(true);
  });

  it('claims nothing over a label that is only vocabulary', () => {
    // No prop, no editor, and therefore no reason to steal the pointer from
    // whatever the user has drawn there.
    expect(setup().hits(ON_FIXED)).toBe(false);
  });

  it('lets the open plot go, so a node under the pointer gets the click', () => {
    expect(setup().hits(ON_OPEN_SPACE)).toBe(false);
  });

  it('still answers wherever the model itself answers', () => {
    expect(setup({}, { picked: true }).hits(ON_OPEN_SPACE)).toBe(true);
  });
});

describe('the shared in-place label editor', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('opens on a renamable label, showing the words currently on screen', () => {
    // Nothing stored: the box must still read the declaration's own wording.
    const { dblclick, editor } = setup();
    dblclick(ON_TITLE);
    expect(editor()?.value).toBe('Board');
  });

  it('opens nothing on a fixed label, nor on open canvas', () => {
    const onFixed = setup();
    onFixed.dblclick(ON_FIXED);
    expect(onFixed.editor()).toBeNull();

    document.body.innerHTML = '';
    const onOpenSpace = setup();
    onOpenSpace.dblclick(ON_OPEN_SPACE);
    expect(onOpenSpace.editor()).toBeNull();
  });

  it('writes the new wording when the user actually renames it', () => {
    const { dblclick, editor, stored, updateElement, captureSync } = setup();

    dblclick(ON_TITLE);
    const input = editor()!;
    input.value = 'Ma carte';
    input.dispatchEvent(new Event('blur'));

    expect(updateElement).toHaveBeenCalledWith('bg', {
      boardTitle: 'Ma carte',
    });
    expect(stored.boardTitle).toBe('Ma carte');
    expect(captureSync).toHaveBeenCalled();
    expect(editor()).toBeNull();
  });

  it('writes NOTHING when it is dismissed without a keystroke', () => {
    const { dblclick, editor, stored, updateElement, captureSync } = setup();

    dblclick(ON_TITLE);
    // Double-clicked, read, clicked away — the whole gesture.
    editor()!.dispatchEvent(new Event('blur'));

    // The vocabulary was NOT frozen into the document as user text...
    expect(stored.boardTitle).toBeUndefined();
    expect(updateElement).not.toHaveBeenCalled();
    // ...and no empty entry was pushed onto undo.
    expect(captureSync).not.toHaveBeenCalled();
    expect(editor()).toBeNull();
  });

  it('opens nothing at all on a read-only document', () => {
    const { dblclick, editor } = setup({}, { readonly: true });
    dblclick(ON_TITLE);
    expect(editor()).toBeNull();
  });

  /**
   * Enter commits, then removes the focused input — and Chrome fires `blur`
   * SYNCHRONOUSLY inside that `remove()`, which is the second `commit` the
   * re-entrancy guard exists for. This suite runs in Chromium, so the nested
   * blur here is the real one.
   */
  it('writes once on Enter, although removing the input blurs it', () => {
    const { dblclick, editor, updateElement, captureSync } = setup();

    dblclick(ON_TITLE);
    const input = editor()!;
    input.value = 'Ma carte';
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));

    expect(updateElement).toHaveBeenCalledTimes(1);
    expect(captureSync).toHaveBeenCalledTimes(1);
    expect(editor()).toBeNull();
  });
});

/**
 * The one write hook: a label whose target no `{ [prop]: value }` patch can
 * express (a UML combined fragment's operand guard, kept inside an array)
 * brings its own `commit`, and the base calls it INSTEAD of writing the prop.
 */
describe('a label that carries its own commit', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  const commit = vi.fn();

  class HookView extends DemoView {
    protected override labelAt(lx: number, ly: number, w: number, h: number) {
      const hit = super.labelAt(lx, ly, w, h);
      return hit ? { ...hit, commit } : null;
    }
  }

  function hooked() {
    commit.mockReset();
    return setup({}, {}, HookView);
  }

  it('hands the edited words to the hook, and writes no prop itself', () => {
    const { dblclick, editor, updateElement, captureSync } = hooked();

    dblclick(ON_TITLE);
    const input = editor()!;
    // Opened on the drawn words, exactly as a plain label is.
    expect(input.value).toBe('Board');
    input.value = 'Ma carte';
    input.dispatchEvent(new Event('blur'));

    expect(commit).toHaveBeenCalledTimes(1);
    expect(commit).toHaveBeenCalledWith('Ma carte');
    expect(updateElement).not.toHaveBeenCalled();
    // The undo boundary is still the base's, captured before the hook runs.
    expect(captureSync).toHaveBeenCalledTimes(1);
  });

  it('never calls the hook for an untouched value', () => {
    const { dblclick, editor, captureSync } = hooked();

    dblclick(ON_TITLE);
    editor()!.dispatchEvent(new Event('blur'));

    expect(commit).not.toHaveBeenCalled();
    expect(captureSync).not.toHaveBeenCalled();
  });
});
