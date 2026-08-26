import { type BpmnLane, BpmnPoolElementModel } from '@labre/affine-model';
import type { BlockStdScope } from '@labre/std';
import { GfxControllerIdentifier } from '@labre/std/gfx';
import { describe, expect, it } from 'vitest';

import {
  addBpmnLane,
  bpmnLanesOf,
  bpmnPoolsForLaneEdit,
  removeBpmnLane,
  renameBpmnLane,
} from '../actions';
import { BPMN_POOL_BACKGROUND } from '../background';
import { bpmnCommands } from '../commands';
import {
  POOL_FRAME_COLOR,
  POOL_FRAME_WIDTH,
  POOL_LANE_NAME_FONT_SIZE,
  POOL_NAME_FONT_SIZE,
} from '../consts';

/**
 * Lanes (couloirs) as pool DATA — B4, at the level where it is pure: what the
 * declaration says, what the three operations write, and when the two commands
 * offer themselves.
 *
 * The wiring — the separator drag, the in-place rename, the undo step, where a
 * task actually lands — is covered by the integration spec, which has an editor
 * to drag in.
 */

/**
 * A stand-in for a pool. `Object.create` off the real prototype so
 * `instanceof BpmnPoolElementModel` — which is how the actions recognise a pool
 * — answers truthfully, with own data properties shadowing the `@field()`
 * accessors so nothing reaches for a Y.Map that is not there.
 */
function fakePool(id: string, lanes?: BpmnLane[], locked = false) {
  const pool = Object.create(BpmnPoolElementModel.prototype) as Record<
    string,
    unknown
  >;
  let cleared = 0;
  Object.defineProperties(pool, {
    id: { value: id, writable: true, enumerable: true },
    lanes: { value: lanes, writable: true, enumerable: true },
    isLocked: { value: () => locked },
    clearField: {
      value: (prop: string) => {
        if (prop !== 'lanes') return;
        cleared++;
        pool.lanes = undefined;
      },
    },
  });
  return {
    model: pool as unknown as BpmnPoolElementModel,
    /** How many times the prop was removed from the document outright. */
    cleared: () => cleared,
  };
}

/** A `std` holding just enough for the lane actions: a selection and a CRUD. */
function fakeStd(
  pools: BpmnPoolElementModel[],
  options: { readonly?: boolean } = {}
) {
  const updates: { id: string; props: Record<string, unknown> }[] = [];
  let captures = 0;

  const crud = {
    updateElement: (id: string, props: Record<string, unknown>) => {
      updates.push({ id, props });
      const target = pools.find(pool => pool.id === id) as unknown as Record<
        string,
        unknown
      >;
      if (target) Object.assign(target, props);
    },
  };
  const gfx = { selection: { selectedElements: pools } };

  const std = {
    store: {
      readonly: options.readonly === true,
      captureSync: () => {
        captures++;
      },
    },
    get: (identifier: unknown) =>
      identifier === GfxControllerIdentifier ? gfx : crud,
  } as unknown as BlockStdScope;

  return { std, updates, captures: () => captures };
}

const sizes = (model: BpmnPoolElementModel) =>
  bpmnLanesOf(model).map(lane => lane.size);

describe('the pool declares that its instances carry lanes', () => {
  const spec = BPMN_POOL_BACKGROUND.instanceZones;

  it('reads the `lanes` prop, stacked as horizontal bands', () => {
    expect(spec).toBeDefined();
    expect(spec?.prop).toBe('lanes');
    // A lane runs ALONG the flow, and the flow runs left to right.
    expect(spec?.stack).toBe('y');
  });

  it('namespaces the zone ids, so a lane can never shadow a framework zone', () => {
    expect(spec?.idPrefix).toBe('lane');
  });

  it('separates lanes with the same line the band divider uses', () => {
    // Not a literal: the two lines meet at the band's inner edge, and a
    // separator that did not match would read as a different KIND of line.
    const band = BPMN_POOL_BACKGROUND.chrome?.sideBands?.[0].divider;
    expect(spec?.divider).toEqual(band);
    expect(spec?.divider).toEqual({
      color: '@frame',
      width: POOL_FRAME_WIDTH,
    });
    expect(BPMN_POOL_BACKGROUND.chrome?.palette?.frame).toBe(POOL_FRAME_COLOR);
  });

  it('writes a lane name quieter than the participant’s own', () => {
    expect(spec?.label?.style).toEqual({
      size: POOL_LANE_NAME_FONT_SIZE,
      color: '@name',
      weight: 600,
    });
    // A subdivision reads as a subdivision when its label is the smaller one.
    expect(POOL_LANE_NAME_FONT_SIZE).toBeLessThan(POOL_NAME_FONT_SIZE);
    // No offsets restated: the primitive's defaults are tuned for exactly this
    // kind of name, and two numbers that must agree eventually do not.
    expect(spec?.label?.dx).toBeUndefined();
    expect(spec?.label?.dy).toBeUndefined();
  });
});

describe('adding a lane', () => {
  it('gives a pool with none exactly ONE lane, covering all of it', () => {
    // One, not two. Seeding a pair would invent a subdivision the user did not
    // ask for and then make them delete half of it.
    const { model } = fakePool('p1');
    const { std, captures } = fakeStd([model]);

    addBpmnLane(std);

    const lanes = bpmnLanesOf(model);
    expect(lanes).toHaveLength(1);
    expect(lanes[0].size).toBe(1);
    expect(typeof lanes[0].id).toBe('string');
    expect(lanes[0].id.length).toBeGreaterThan(0);
    // An unnamed lane is a band and nothing else: no key at all, rather than a
    // key holding `undefined` that would ship in every snapshot for no reader.
    expect('name' in lanes[0]).toBe(false);
    expect(captures()).toBe(1);
  });

  it('gives the newcomer the AVERAGE of the weights already there', () => {
    const { model } = fakePool('p1', [
      { id: 'a', size: 1 },
      { id: 'b', size: 3 },
    ]);
    const { std } = fakeStd([model]);

    addBpmnLane(std);

    // 2 leaves `a` and `b` the same size relative to each other and hands the
    // newcomer the room a typical lane has.
    expect(sizes(model)).toEqual([1, 3, 2]);
  });

  it('gives every lane a distinct id', () => {
    const { model } = fakePool('p1');
    const { std } = fakeStd([model]);

    addBpmnLane(std);
    addBpmnLane(std);
    addBpmnLane(std);

    const ids = bpmnLanesOf(model).map(lane => lane.id);
    expect(new Set(ids).size).toBe(3);
  });

  it('acts on every selected pool, in one undo step', () => {
    const first = fakePool('p1');
    const second = fakePool('p2', [{ id: 'x', size: 4 }]);
    const { std, captures } = fakeStd([first.model, second.model]);

    addBpmnLane(std);

    expect(sizes(first.model)).toEqual([1]);
    expect(sizes(second.model)).toEqual([4, 4]);
    // ONE capture for the whole gesture, whatever the selection holds.
    expect(captures()).toBe(1);
  });
});

describe('removing a lane', () => {
  it('takes the LAST one, which is the one the previous click added', () => {
    const { model } = fakePool('p1', [
      { id: 'a', size: 1 },
      { id: 'b', size: 2 },
      { id: 'c', size: 3 },
    ]);
    const { std } = fakeStd([model]);

    removeBpmnLane(std);

    expect(bpmnLanesOf(model).map(lane => lane.id)).toEqual(['a', 'b']);
  });

  it('takes the prop back OUT of the document when the last one goes', () => {
    // Not `[]`: the pool returns to its pre-lane bytes, which is the whole of
    // the compatibility promise read backwards.
    const { model, cleared } = fakePool('p1', [{ id: 'a', size: 1 }]);
    const { std, updates } = fakeStd([model]);

    removeBpmnLane(std);

    expect(model.lanes).toBeUndefined();
    expect(cleared()).toBe(1);
    // …and no `updateElement` wrote an empty array on the way there.
    expect(updates).toEqual([]);
  });

  it('does nothing at all to a pool that has no lane', () => {
    const { model, cleared } = fakePool('p1');
    const { std, updates, captures } = fakeStd([model]);

    removeBpmnLane(std);

    expect(model.lanes).toBeUndefined();
    expect(cleared()).toBe(0);
    expect(updates).toEqual([]);
    // No capture either: an undo step for a gesture that changed nothing is a
    // second press of ctrl+z that appears to do nothing.
    expect(captures()).toBe(0);
  });
});

describe('renaming a lane', () => {
  it('writes the name onto that lane and leaves the others alone', () => {
    const { model } = fakePool('p1', [
      { id: 'a', size: 1 },
      { id: 'b', size: 1 },
    ]);
    const { std } = fakeStd([model]);

    renameBpmnLane(std, model, 1, '  Back office  ');

    // Trimmed: leading spaces are a typo, never a name.
    expect(bpmnLanesOf(model)).toEqual([
      { id: 'a', size: 1 },
      { id: 'b', name: 'Back office', size: 1 },
    ]);
  });

  it('REMOVES the key when the name is cleared', () => {
    // The renderer treats `''` and absent as the same thing, so storing both
    // would be two ways to say one thing that only the bytes can tell apart.
    const { model } = fakePool('p1', [{ id: 'a', name: 'Sales', size: 1 }]);
    const { std } = fakeStd([model]);

    renameBpmnLane(std, model, 0, '   ');

    expect(bpmnLanesOf(model)).toEqual([{ id: 'a', size: 1 }]);
  });

  it('writes nothing when the name did not change', () => {
    const { model } = fakePool('p1', [{ id: 'a', name: 'Sales', size: 1 }]);
    const { std, updates, captures } = fakeStd([model]);

    renameBpmnLane(std, model, 0, 'Sales');

    expect(updates).toEqual([]);
    expect(captures()).toBe(0);
  });

  it('ignores an index that names no lane', () => {
    const { model } = fakePool('p1', [{ id: 'a', size: 1 }]);
    const { std, updates } = fakeStd([model]);

    renameBpmnLane(std, model, 7, 'Nowhere');

    expect(updates).toEqual([]);
  });
});

describe('what a lane gesture refuses', () => {
  it('refuses a read-only document', () => {
    const { model } = fakePool('p1');
    const { std, updates } = fakeStd([model], { readonly: true });

    expect(bpmnPoolsForLaneEdit(std)).toEqual([]);
    addBpmnLane(std);
    expect(updates).toEqual([]);
    expect(model.lanes).toBeUndefined();
  });

  it('refuses a locked pool', () => {
    const { model } = fakePool('p1', undefined, true);
    const { std, updates } = fakeStd([model]);

    addBpmnLane(std);
    expect(updates).toEqual([]);
  });

  it('reads a malformed prop as no lanes rather than breaking on it', () => {
    // The value comes out of a Y.Map, so it is whatever a peer wrote.
    const { model } = fakePool('p1', 'not an array' as unknown as BpmnLane[]);
    expect(bpmnLanesOf(model)).toEqual([]);
  });
});

describe('the two lane commands', () => {
  const command = (id: string) => {
    const found = bpmnCommands.find(candidate => candidate.id === id);
    expect(found, id).toBeDefined();
    return found!;
  };
  const addLane = command('bpmn.addLane');
  const removeLane = command('bpmn.removeLane');

  it('declare themselves as selection-scoped actions', () => {
    for (const descriptor of [addLane, removeLane]) {
      expect(descriptor.kind).toBe('action');
      expect(descriptor.category).toBe('flow');
      expect(descriptor.availability).toBe('selection');
      expect(descriptor.telemetry?.framework).toBe('bpmn');
      expect(descriptor.iconKey).toBeTruthy();
    }
    expect(addLane.telemetry?.element).toBe('pool:lane-add');
    expect(removeLane.telemetry?.element).toBe('pool:lane-remove');
  });

  it('stay OUT of the senior sub-menu and in the catalogue', () => {
    // A permanently greyed entry in the sub-menu of a framework you have drawn
    // nothing with is furniture, not an affordance — and the sub-menu does not
    // filter on availability.
    for (const descriptor of [addLane, removeLane]) {
      expect(descriptor.surfaces).not.toContain('senior-menu');
      expect(descriptor.surfaces).toContain('catalogue');
      expect(descriptor.surfaces).toContain('contextual-toolbar');
    }
  });

  it('offer themselves only when there is a pool to divide', () => {
    const empty = fakeStd([]);
    expect(addLane.when?.(empty.std)).toBe(false);
    expect(removeLane.when?.(empty.std)).toBe(false);

    const bare = fakeStd([fakePool('p1').model]);
    expect(addLane.when?.(bare.std)).toBe(true);
    // …and only `removeLane` additionally needs a lane to exist.
    expect(removeLane.when?.(bare.std)).toBe(false);

    const divided = fakeStd([fakePool('p1', [{ id: 'a', size: 1 }]).model]);
    expect(addLane.when?.(divided.std)).toBe(true);
    expect(removeLane.when?.(divided.std)).toBe(true);
  });

  it('withdraw on a read-only document', () => {
    const locked = fakeStd([fakePool('p1', [{ id: 'a', size: 1 }]).model], {
      readonly: true,
    });
    expect(addLane.when?.(locked.std)).toBe(false);
    expect(removeLane.when?.(locked.std)).toBe(false);
  });
});
