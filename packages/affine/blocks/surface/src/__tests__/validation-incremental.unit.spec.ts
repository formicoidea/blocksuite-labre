import { Bound } from '@labre/global/gfx';
import type { GfxPrimitiveElementModel, RoleDefs } from '@labre/std/gfx';
import { signal } from '@preact/signals-core';
import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  evaluateRules,
  type IncrementalContext,
  ValidationManager,
  type ValidationProfile,
  type ValidationRule,
  ValidationRuleIdentifier,
  type Violation,
} from '../extensions/validation.js';

/**
 * The dirty set (PF5.13), on its own terms.
 *
 * `no-overlap` is the only family that is not element-local, and the only one
 * that can be asked to re-judge PART of a surface. The contract it has to keep
 * is short and absolute: **an incremental pass returns exactly what a full pass
 * would**. It is a way of not doing work, never a different answer — so every
 * test here compares the two rather than asserting a hand-written expectation.
 *
 * The two failures this suite exists for were both invisible to a "nothing
 * moved" check: a frame DELETED (nothing on the surface looks dirty, so the
 * findings attributed to it silently vanished), and a dirty set large enough
 * that the shortcut cost eight times the sweep it replaced.
 */

const ROLES: RoleDefs = {
  'test:frame': { id: 'test:frame', kind: 'node', labelKey: 'test.frame' },
  'test:node': { id: 'test:node', kind: 'node', labelKey: 'test.node' },
  'test:edge': { id: 'test:edge', kind: 'edge', labelKey: 'test.edge' },
};

const RULE: ValidationRule = {
  id: 'test.no-overlap',
  framework: 'test',
  family: 'no-overlap',
  severity: 'warning',
  roles: ROLES,
  messageKey: 'com.labre.test.no-overlap',
  version: 1,
  backgroundRole: 'test:frame',
  overlap: [['test:node', 'test:node']],
};

function element(
  id: string,
  xywh: [number, number, number, number],
  role?: string
): GfxPrimitiveElementModel {
  return {
    id,
    role,
    get elementBound() {
      return new Bound(...xywh);
    },
  } as unknown as GfxPrimitiveElementModel;
}

const frame = () => element('map', [0, 0, 1600, 900], 'test:frame');
const node = (id: string, x: number) =>
  element(id, [x, 400, 20, 20], 'test:node');

const key = (violation: Violation) =>
  `${violation.ruleId}|${violation.elementIds.join('+')}|${violation.backgroundId ?? '-'}`;

const keys = (violations: readonly Violation[]) => violations.map(key).sort();

/** Both passes over the same surface, which must agree. */
function bothWays(
  elements: GfxPrimitiveElementModel[],
  incremental: IncrementalContext
) {
  return {
    full: keys(evaluateRules([RULE], elements)),
    incremental: keys(evaluateRules([RULE], elements, [], incremental)),
  };
}

describe('an incremental pass answers exactly what a full pass would', () => {
  it('when nothing moved at all', () => {
    const elements = [frame(), node('a', 400), node('b', 410)];
    const previous = evaluateRules([RULE], elements);

    const { full, incremental } = bothWays(elements, {
      dirty: new Set(['a']),
      previous,
    });
    expect(incremental).toEqual(full);
    expect(full).toHaveLength(1);
  });

  it('when an element moved into a collision', () => {
    const before = [frame(), node('a', 400), node('b', 800)];
    const previous = evaluateRules([RULE], before);
    expect(previous).toEqual([]);

    const after = [frame(), node('a', 400), node('b', 410)];
    const { full, incremental } = bothWays(after, {
      dirty: new Set(['b']),
      previous,
    });
    expect(incremental).toEqual(full);
    expect(full).toHaveLength(1);
  });

  it('when an element was removed', () => {
    const before = [frame(), node('a', 400), node('b', 410)];
    const previous = evaluateRules([RULE], before);

    const after = [frame(), node('a', 400)];
    const { full, incremental } = bothWays(after, {
      dirty: new Set(['b']),
      previous,
    });
    expect(incremental).toEqual(full);
    expect(full).toEqual([]);
  });

  it('when the frame MOVED', () => {
    const elements = [
      element('map', [200, 200, 1600, 900], 'test:frame'),
      node('a', 400),
      node('b', 410),
    ];
    const previous = evaluateRules([RULE], [frame(), node('a', 400), node('b', 410)]);

    const { full, incremental } = bothWays(elements, {
      dirty: new Set(['map']),
      previous,
    });
    expect(incremental).toEqual(full);
  });

  it('when the frame was DELETED, and the collision is still live', () => {
    // The regression this suite was written for. With the map gone nothing on
    // the surface carries the frame role, so "is a current background dirty"
    // sees nothing, no couple is re-tested — and the carried finding used to be
    // dropped for naming a `backgroundId` that had just become dirty. Net
    // result: a live overlap disappeared from the board until the next full
    // pass or the next nudge of one of the two elements.
    const before = [frame(), node('a', 400), node('b', 410)];
    const previous = evaluateRules([RULE], before);
    expect(previous).toHaveLength(1);
    expect(previous[0].backgroundId).toBe('map');

    const after = [node('a', 400), node('b', 410)];
    const { full, incremental } = bothWays(after, {
      dirty: new Set(['map']),
      previous,
    });

    expect(incremental).toEqual(full);
    // The overlap survives its map: it never depended on the frame for
    // anything but attribution, and it loses only that.
    expect(full).toHaveLength(1);
    expect(evaluateRules([RULE], after, [], {
      dirty: new Set(['map']),
      previous,
    })[0].backgroundId).toBeUndefined();
  });

  it('when EVERYTHING moved at once', () => {
    // Past the crossover the family gives up on being clever and sweeps. The
    // answer must not depend on which branch it took.
    // Three 20-wide nodes in a heap, every pair genuinely overlapping.
    const elements = [frame(), node('a', 400), node('b', 410), node('c', 415)];
    const previous = evaluateRules([RULE], elements);

    const { full, incremental } = bothWays(elements, {
      dirty: new Set(['a', 'b', 'c']),
      previous,
    });
    expect(incremental).toEqual(full);
    expect(full).toHaveLength(3);
  });

  it('and reports each colliding couple exactly once', () => {
    // Two dirty elements that collide are reachable from both ends of the
    // scan. Reported twice, one bubble would say the same thing twice.
    const elements = [frame(), node('a', 400), node('b', 410), node('c', 900)];
    const previous: Violation[] = [];

    const raised = evaluateRules([RULE], elements, [], {
      dirty: new Set(['a', 'b']),
      previous,
    });
    expect(keys(raised)).toEqual(['test.no-overlap|a+b|map']);
  });
});

/**
 * The BOUND: past the crossover the family gives up on being clever and sweeps.
 *
 * The cost of the two branches — and therefore that the bound is worth having —
 * is measured in the bench, which has a median harness and a warm-up
 * (`validation.bench.unit.spec.ts`, "stays inside the frame at EVERY dirty-set
 * size"). A clock read inside the unit suite would measure the machine's mood.
 *
 * What is worth pinning HERE is that switching branch cannot change the answer,
 * at every size on both sides of the crossover.
 */
describe('the bound cannot change the answer', () => {
  /** A dense board: `size` participants, every other one overlapping. */
  const board = (size: number) => {
    const elements = [frame()];
    for (let i = 0; i < size; i++) {
      elements.push(node(`n${i}`, 100 + Math.floor(i / 2) * 40 + (i % 2) * 10));
    }
    return elements;
  };

  const elements = board(60);
  const previous = evaluateRules([RULE], elements);

  for (const size of [1, 2, 15, 29, 30, 31, 45, 60]) {
    it(`agrees with a full pass at |dirty| = ${size}`, () => {
      // 30 of 60 participants is exactly the crossover, so this walks over it.
      const dirty = new Set(elements.slice(1, size + 1).map(el => el.id));
      const { full, incremental } = bothWays(elements, { dirty, previous });

      expect(incremental).toEqual(full);
      expect(full).toHaveLength(30);
    });
  }
});

/**
 * The one hole the family cannot close on its own (recette #2, R5).
 *
 * `no-overlap` finds a DELETED frame by looking for its id among the previous
 * findings, because that is the only trace an element that has left the surface
 * can leave. A frame whose profile put the rule on `'off'` leaves no such
 * trace: `applyProfiles` dropped every finding measured against it, so
 * `previous` is empty, the deletion reads as an ordinary one — and the overlap
 * that becomes live again under the default profile is reported by a full pass
 * and not by the incremental one.
 *
 * No shipped Wardley profile uses `'off'` today, so this was latent rather than
 * live. `'off'` is a documented state of PF9 all the same, and the first
 * framework that ships one would reopen the bug — so the invariant is closed by
 * construction instead of by luck: the MANAGER remembers which ids were
 * backgrounds at the last evaluation, which is exactly the memory a family that
 * only ever sees the current surface cannot have.
 *
 * Driven through the real path — subscription, dirty set, 120 ms debounce —
 * because the decision it tests lives between them.
 */
describe('a background that has been SILENCED still forces a full pass', () => {
  afterEach(() => vi.useRealTimers());

  /** A profile that switches the pair-wise rule off, and is not the default. */
  const OFF: ValidationProfile = {
    id: 'test.off',
    framework: 'test',
    labelKey: 'com.labre.test.profile.off',
    rules: { [RULE.id]: 'off' },
  };
  const DEFAULT: ValidationProfile = {
    id: 'test.sketch',
    framework: 'test',
    labelKey: 'com.labre.test.profile.sketch',
    isDefault: true,
    rules: {},
  };

  /** The minimum of a surface: the element list, and the three change feeds. */
  function fakeSurface(elements: GfxPrimitiveElementModel[]) {
    const feed = () => {
      const listeners: ((payload: { id: string }) => void)[] = [];
      return {
        subscribe(fn: (payload: { id: string }) => void) {
          listeners.push(fn);
          return { unsubscribe() {} };
        },
        emit(id: string) {
          for (const fn of [...listeners]) fn({ id });
        },
      };
    };
    return {
      elementModels: elements,
      elementAdded: feed(),
      elementRemoved: feed(),
      elementUpdated: feed(),
    };
  }

  it('when the SILENCED map is deleted and the overlap comes back to life', () => {
    vi.useFakeTimers();

    // Two nodes genuinely on top of each other, on a map whose chosen level of
    // requirement switches the rule off entirely.
    const map = element('map', [0, 0, 1600, 900], 'test:frame') as {
      validationProfile?: string;
    } & GfxPrimitiveElementModel;
    (map as { validationProfile?: string }).validationProfile = OFF.id;
    const elements: GfxPrimitiveElementModel[] = [map, node('a', 400), node('b', 410)];

    const surface = fakeSurface(elements);
    const manager = new ValidationManager({
      surface,
      surface$: signal(surface),
      std: {
        provider: {
          getAll: (identifier: unknown) =>
            new Map<string, unknown>(
              identifier === ValidationRuleIdentifier
                ? [['rule', RULE]]
                : [
                    ['off', OFF],
                    ['default', DEFAULT],
                  ]
            ),
        },
        getOptional: () => null,
      },
    } as never);

    // First verdict: silent, and silent for the right reason — the map says so.
    manager.mounted();
    expect(manager.violations$.peek()).toEqual([]);

    // The map is deleted. Nothing else moves.
    elements.shift();
    surface.elementRemoved.emit('map');
    vi.advanceTimersByTime(200);

    // What a full pass says now, which is the only right answer.
    const full = keys(evaluateRules([RULE], elements, [OFF, DEFAULT]));
    expect(full).toHaveLength(1);
    expect(keys(manager.violations$.peek())).toEqual(full);

    manager.unmounted();
  });
});

describe('a rule that can never fire says so', () => {
  afterEach(() => vi.restoreAllMocks());

  it('warns when an attachment rule names a NODE role as its carrier', () => {
    // "Posed on" is a distance to a PATH, and a node has none. Silently
    // matching nothing is the worst thing declarative data can do: the rule
    // looks registered, looks enabled, and never fires.
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const broken: ValidationRule = {
      id: `test.attached-to-a-node-${Math.random()}`,
      framework: 'test',
      family: 'attachment',
      severity: 'warning',
      appliesTo: 'test:node',
      roles: ROLES,
      messageKey: 'com.labre.test.attached-to-a-node',
      version: 1,
      attachment: { carrierRole: 'test:frame', tolerance: 10 },
    };

    expect(evaluateRules([broken], [frame(), node('a', 400)])).toEqual([]);
    expect(warn).toHaveBeenCalledOnce();
    expect(warn.mock.calls[0][0]).toContain('can never fire');

    // …once, not on every evaluation: a family runs several times a second
    // while somebody drags.
    evaluateRules([broken], [frame(), node('a', 400)]);
    expect(warn).toHaveBeenCalledOnce();
  });
});
