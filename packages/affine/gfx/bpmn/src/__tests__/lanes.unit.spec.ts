import {
  backgroundInstanceZoneBand,
  backgroundInstanceZones,
  backgroundPlot,
} from '@labre/affine-block-surface';
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
  bpmnInPoolTitleBand,
  bpmnLaneBoundaryAt,
  bpmnLaneTitleBandAt,
  bpmnPoolTargetAt,
} from '../pool-hit';
import {
  POOL_BAND_WIDTH,
  POOL_FRAME_COLOR,
  POOL_FRAME_WIDTH,
  POOL_LANE_BAND_WIDTH,
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
  });

  it('writes it down a title BAND, as BPMN 2.0 draws a lane', () => {
    // PO recette, 2026-08-26: the name used to sit across the lane's top-left
    // corner. bpmn.io, Camunda and Visio all draw a strip at the leading edge
    // with the words turned on their side, and a reader who knows BPMN reads a
    // corner word as a note rather than as a lane title.
    expect(spec?.label?.band?.width).toBe(POOL_LANE_BAND_WIDTH);
    // No fill: a second grey gutter beside the participant band would leave the
    // flow area looking inset twice.
    expect(spec?.label?.band).not.toHaveProperty('fill');
    // The corner insets are gone with the corner.
    expect(spec?.label?.dx).toBeUndefined();
    expect(spec?.label?.dy).toBeUndefined();
  });

  it('rules the strip with the frame’s own line', () => {
    expect(spec?.label?.band?.divider).toEqual({
      color: '@frame',
      width: POOL_FRAME_WIDTH,
    });
  });

  it('keeps the lane band narrower than the participant band it sits in', () => {
    // The two strips are side by side, so the subordinate one has to say so:
    // equal widths read as one 56-unit gutter rather than as a participant
    // containing lanes.
    expect(POOL_LANE_BAND_WIDTH).toBeLessThan(POOL_BAND_WIDTH);
  });

  it('puts the strip inside the plot, leaving lane MEMBERSHIP untouched', () => {
    // The BPMN reading: the title band belongs TO the lane, so an element
    // dropped on it is in that lane, and naming a lane does not shrink its
    // share of the pool. Everything downstream — the audit, the rules, B5's
    // facts — therefore sees exactly what it saw before the band existed.
    const plot = backgroundPlot(BPMN_POOL_BACKGROUND, 560, 200);
    const zones = backgroundInstanceZones(BPMN_POOL_BACKGROUND, {
      lanes: [
        { id: 'a', size: 1 },
        { id: 'b', size: 1 },
      ],
    });
    expect(zones.map(z => z.rect)).toEqual([
      { x: 0, y: 0, w: 1, h: 0.5 },
      { x: 0, y: 0.5, w: 1, h: 0.5 },
    ]);

    const strip = backgroundInstanceZoneBand(
      BPMN_POOL_BACKGROUND,
      zones[0],
      plot
    );
    // Immediately inside the participant band (`margin.left`), not over it.
    expect(strip).toEqual({
      x: POOL_BAND_WIDTH,
      y: 0,
      w: POOL_LANE_BAND_WIDTH,
      h: 100,
    });
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
    // Named on creation (PO recette, 2026-08-26), which is what makes that
    // first click VISIBLE: a titled band appears down a pool that had none.
    // Before it, one lane looked exactly like no lane and the gesture read as
    // broken until the second click.
    expect(lanes[0].name).toBe('Lane 1');
    expect(captures()).toBe(1);
  });

  it('numbers each new lane after the ones already there', () => {
    const { model } = fakePool('p1');
    const { std } = fakeStd([model]);

    addBpmnLane(std);
    addBpmnLane(std);
    addBpmnLane(std);

    expect(bpmnLanesOf(model).map(lane => lane.name)).toEqual([
      'Lane 1',
      'Lane 2',
      'Lane 3',
    ]);
  });

  it('writes the default name as plain document data, not a vocabulary key', () => {
    // Exactly like the pool's own `'Pool'` default: the string is persisted and
    // is the author's to rewrite. A `labelKey` here would let a host's locale
    // silently retitle a lane somebody named, and would make one document say
    // different things to different readers.
    const { model } = fakePool('p1');
    const { std, updates } = fakeStd([model]);

    addBpmnLane(std);

    const written = updates[0].props.lanes as BpmnLane[];
    expect(written[0].name).toBe('Lane 1');
    expect(JSON.stringify(written)).not.toContain('com.labre');
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

/**
 * Which gesture a point on a pool means (PO recette, 2026-08-26).
 *
 * A 560 × 200 pool, so the participant band is x 0 → 28, the plot is x 28 →
 * 560, and each lane's title strip is the 24 units from 28 to 52. Zoom 1
 * throughout except where the touch floor is the subject.
 */
describe('what a point on a pool is aiming at', () => {
  const POOL = {
    deserializedXYWH: [0, 0, 560, 200] as const,
    lanes: [
      { id: 'a', name: 'Front office', size: 1 },
      { id: 'b', name: 'Back office', size: 1 },
    ],
  };
  const BARE = { deserializedXYWH: [0, 0, 560, 200] as const };

  it('reads the participant band, and only it, as the pool’s own title', () => {
    // Inside the 28-unit margin.
    expect(bpmnInPoolTitleBand(POOL, [14, 100], 1)).toBe(true);
    expect(bpmnInPoolTitleBand(POOL, [0, 0], 1)).toBe(true);
    expect(bpmnInPoolTitleBand(POOL, [27, 199], 1)).toBe(true);
    // The flow area is NOT the participant's name any more. This is the whole
    // of the recette's zoning: a double-click out here used to rename the
    // participant, which is not one of the things the user could have meant.
    expect(bpmnInPoolTitleBand(POOL, [300, 100], 1)).toBe(false);
    expect(bpmnInPoolTitleBand(POOL, [559, 199], 1)).toBe(false);
    // …and outside the element entirely.
    expect(bpmnInPoolTitleBand(POOL, [-1, 100], 1)).toBe(false);
    expect(bpmnInPoolTitleBand(POOL, [14, 201], 1)).toBe(false);
  });

  it('reads each lane’s title strip as that lane’s name', () => {
    // Lane 0 spans y 0 → 100, lane 1 spans 100 → 200; both strips x 28 → 52.
    expect(bpmnLaneTitleBandAt(POOL, [40, 50], 1)).toBe(0);
    expect(bpmnLaneTitleBandAt(POOL, [40, 150], 1)).toBe(1);
    // The WHOLE height of the strip is live, not just the top: the name is
    // centred in it, and a band you may only click the top of would be a
    // target that lies about where it is.
    expect(bpmnLaneTitleBandAt(POOL, [30, 99], 1)).toBe(0);
    expect(bpmnLaneTitleBandAt(POOL, [30, 199], 1)).toBe(1);
    // Past the strip is the flow area, which renames nothing.
    expect(bpmnLaneTitleBandAt(POOL, [200, 50], 1)).toBeNull();
    // …and so is the participant band, on the other side.
    expect(bpmnLaneTitleBandAt(POOL, [10, 50], 1)).toBeNull();
  });

  it('offers no lane target on a pool that has no lane', () => {
    expect(bpmnLaneTitleBandAt(BARE, [40, 50], 1)).toBeNull();
    expect(bpmnLaneBoundaryAt(BARE, [300, 100])).toBeNull();
    // …while the participant band is still there to be renamed.
    expect(bpmnInPoolTitleBand(BARE, [14, 100], 1)).toBe(true);
  });

  it('grabs a separator within six units of an INTERNAL boundary', () => {
    expect(bpmnLaneBoundaryAt(POOL, [300, 100])).toBe(1);
    expect(bpmnLaneBoundaryAt(POOL, [300, 94])).toBe(1);
    expect(bpmnLaneBoundaryAt(POOL, [300, 106])).toBe(1);
    expect(bpmnLaneBoundaryAt(POOL, [300, 93])).toBeNull();
    // The outer edges are the pool's own: dragging one is a resize, which the
    // handles already do.
    expect(bpmnLaneBoundaryAt(POOL, [300, 0])).toBeNull();
    expect(bpmnLaneBoundaryAt(POOL, [300, 200])).toBeNull();
    // And the grab zone does not run through the participant band.
    expect(bpmnLaneBoundaryAt(POOL, [10, 100])).toBeNull();
  });

  it('grows both targets to a fingertip when the board is zoomed out', () => {
    // At 0.25 zoom the 24-unit strip is six pixels wide — unhittable. The floor
    // is 44 view pixels, i.e. 176 model units here.
    expect(bpmnLaneTitleBandAt(POOL, [150, 50], 0.25)).toBe(0);
    expect(bpmnLaneTitleBandAt(POOL, [150, 50], 1)).toBeNull();
    expect(bpmnInPoolTitleBand(POOL, [50, 100], 0.25)).toBe(true);
    expect(bpmnInPoolTitleBand(POOL, [50, 100], 1)).toBe(false);
  });

  it('caps that growth, so a target never swallows what it sits beside', () => {
    // Uncapped, a 0.02 zoom would make the strip 2200 units wide and the whole
    // pool would rename lane 0. The cap is half the plot.
    expect(bpmnLaneTitleBandAt(POOL, [500, 50], 0.02)).toBeNull();
    expect(bpmnLaneTitleBandAt(POOL, [280, 50], 0.02)).toBe(0);
    // The participant band is capped at twice its own width, because past that
    // lies the lane strip, which has its own claim on those units.
    expect(bpmnInPoolTitleBand(POOL, [57, 100], 0.02)).toBe(false);
  });

  it('gives the OVERLAP to the lane, because that is the name written there', () => {
    // The two bands are adjacent and both grow to the touch floor, so on a
    // 560-unit pool they already overlap at zoom 1: the participant band
    // reaches x 44, the lane strip starts at 28. Both claim x = 40…
    expect(bpmnInPoolTitleBand(POOL, [40, 50], 1)).toBe(true);
    expect(bpmnLaneTitleBandAt(POOL, [40, 50], 1)).toBe(0);
    // …and the arbiter hands it to the lane, whose name is the one painted
    // there. Renaming the participant instead would rewrite the one thing the
    // user demonstrably was not pointing at.
    expect(bpmnPoolTargetAt(POOL, [40, 50], 1)).toEqual({
      kind: 'lane',
      index: 0,
    });
  });

  it('answers the whole question in one call, for the view to act on', () => {
    // x = 14 is inside the participant band and short of the lane strip.
    expect(bpmnPoolTargetAt(POOL, [14, 100], 1)).toEqual({
      kind: 'participant',
    });
    expect(bpmnPoolTargetAt(POOL, [40, 150], 1)).toEqual({
      kind: 'lane',
      index: 1,
    });
    // A double-click on open canvas inside the pool renames nothing — the
    // recette's zoning, stated where the view reads it.
    expect(bpmnPoolTargetAt(POOL, [300, 100], 1)).toBeNull();
    // …and on a pool with no lane, the participant band still answers.
    expect(bpmnPoolTargetAt(BARE, [14, 100], 1)).toEqual({
      kind: 'participant',
    });
    expect(bpmnPoolTargetAt(BARE, [300, 100], 1)).toBeNull();
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
      // Filed with the pool they divide, not in a section of their own.
      expect(descriptor.category).toBe('swimlanes');
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
