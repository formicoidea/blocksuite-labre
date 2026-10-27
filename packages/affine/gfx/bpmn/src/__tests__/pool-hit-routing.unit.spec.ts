import { BpmnPoolElementModel } from '@labre/affine-model';
import { describe, expect, it, vi } from 'vitest';

import { BpmnPoolView } from '../element-view';

/**
 * Where a pool answers the pointer, now that it is picked by its border and its
 * title bands rather than by its whole area (issue #194).
 *
 * Two of this view's gestures live off those bands and must still be heard:
 * the internal LANE SEPARATORS, in the middle of the flow area, and the
 * zoom-GROWN rename targets, which reach past the painted bands so a fingertip
 * can land on one when the board is small on screen. Neither is a selection
 * zone — picking asks the MODEL, which knows only the painted geometry — so
 * they are declared on the VIEW, which is what the pointer router consults.
 *
 * A third joined them when the title bands started to GROW with their names
 * (`fit: 'wrap'`, PO 2026-10-27): the model selects by the DECLARED band widths,
 * because `affine-model` cannot measure text, so the part of a band a long name
 * widened is reachable only through the view. This spec would catch a rename
 * double-click on the outer line of a long name falling through to the flow
 * area.
 */

const W = 560;
const H = 200;

/** Two equal lanes: the internal separator sits at y = 100. */
const LANES = [
  { id: 'a', name: 'Front office', size: 1 },
  { id: 'b', name: 'Back office', size: 1 },
];

const PICK = { hitThreshold: 10, zoom: 1 };

function setup(props: { lanes?: typeof LANES; name?: string } = {}) {
  const listeners: Array<(event: { key: string }) => void> = [];
  const model = {
    id: 'pool',
    deserializedXYWH: [0, 0, W, H],
    x: 0,
    y: 0,
    w: W,
    h: H,
    rotate: 0,
    lanes: props.lanes,
    name: props.name,
    // The view re-measures its bands when a name, the lanes or the box change.
    propsUpdated: {
      subscribe: (listener: (event: { key: string }) => void) => {
        listeners.push(listener);
        return { unsubscribe: vi.fn() };
      },
    },
    /** What the surface does after an update: one event per changed key. */
    emit: (key: string) => listeners.forEach(listener => listener({ key })),
    isLocked: () => false,
    // The real model's answer, called through the very prototype the document
    // uses — border band, participant band, lane strip.
    includesPoint(x: number, y: number, options: object) {
      return BpmnPoolElementModel.prototype.includesPoint.call(
        this as never,
        x,
        y,
        options as never
      );
    },
  };

  const gfx = {
    viewport: { toModelCoord: (x: number, y: number) => [x, y], zoom: 1 },
    selection: {
      set: vi.fn(),
      selectedIds: [] as string[],
      // The view drops its lane focus when the pool leaves the selection.
      slots: { updated: { subscribe: () => ({ unsubscribe: vi.fn() }) } },
    },
    cursor$: { value: 'default' },
    std: {
      store: { captureSync: vi.fn(), readonly: false },
      get: () => ({ updateElement: vi.fn() }),
      getOptional: () => null,
    },
  };

  const view = new BpmnPoolView(model as never, gfx as never);
  view.onCreated();
  return view;
}

const at = (view: BpmnPoolView, x: number, y: number) =>
  view.includesPoint(x, y, PICK as never, null as never);

describe('where a BPMN pool answers the pointer', () => {
  it('hears the pointer on an internal lane separator', () => {
    const view = setup({ lanes: LANES });

    // Mid flow area, on the boundary between the two lanes: not a selection
    // zone, but the strip that arms the drag which moves it.
    expect(at(view, 300, 100)).toBe(true);
    expect(at(view, 300, 104)).toBe(true);
  });

  it('lets the rest of the flow area go', () => {
    const view = setup({ lanes: LANES });

    // The bug, at the view layer: the pool used to answer everywhere, so a
    // flow object dropped on it never received a click of its own.
    expect(at(view, 300, 50)).toBe(false);
    expect(at(view, 300, 160)).toBe(false);
  });

  it('keeps both title bands and the border', () => {
    const view = setup({ lanes: LANES });

    expect(at(view, 14, 100)).toBe(true); // participant band
    expect(at(view, 40, 50)).toBe(true); // lane strip
    expect(at(view, 555, 30)).toBe(true); // border
  });

  it('offers no separator on a pool with no lane', () => {
    const view = setup();

    expect(at(view, 300, 100)).toBe(false);
    // …while the participant band is still there to be renamed.
    expect(at(view, 14, 100)).toBe(true);
  });

  it('hears the rename on a participant band a long name has widened', () => {
    // Past the zoom-grown target a short name gets at zoom 1 (44 units, capped
    // at twice the declared 28): only a band that GREW reaches x = 60.
    const long = Array.from(
      { length: 4 },
      () => 'Supplier onboarding office'
    ).join(' ');
    expect(at(setup({ name: 'Customer' }), 60, 100)).toBe(false);
    expect(at(setup({ name: long }), 60, 100)).toBe(true);
  });

  it('measures the bands the model picks by before any paint, and on a rename', () => {
    // Picking asks the MODEL (`paintedBands`); a hidden tab never paints, so
    // the view writes the cache itself — at creation and whenever a name, the
    // lanes or the box change, never on the cache's own update (no loop).
    const long = Array.from(
      { length: 4 },
      () => 'Supplier onboarding office'
    ).join(' ');
    const view = setup({ name: long });
    const model = view.model as unknown as {
      name: string;
      paintedBands?: { margin: number };
      emit: (key: string) => void;
      includesPoint: (x: number, y: number, o: object) => boolean;
    };
    expect(model.paintedBands?.margin).toBeGreaterThan(56);
    expect(model.includesPoint(60, 100, PICK)).toBe(true);

    model.name = 'Customer';
    model.emit('paintedBands');
    expect(model.paintedBands?.margin).toBeGreaterThan(56);
    model.emit('name');
    expect(model.paintedBands?.margin).toBe(28);
    expect(model.includesPoint(60, 100, PICK)).toBe(false);
  });
});
