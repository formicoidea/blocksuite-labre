import { describe, expect, it } from 'vitest';

import type { Violation } from '../extensions/validation.js';
import {
  distinctByRule,
  userFacingViolations,
} from '../extensions/validation.js';
import {
  VIOLATION_EMPHASIS_MS,
  VIOLATION_HOLD_MS,
  violationKey,
  ViolationTimeline,
} from '../extensions/violation-timeline.js';

/**
 * The ephemeral → persistent state machine, driven by explicit timestamps.
 *
 * Nothing here fakes a clock: `sync`/`emphasis`/`isAnimating` all take `now`,
 * which is the whole reason the machine was written that way. The overlay
 * feeds them `performance.now()`; the tests feed them numbers.
 */

const violation = (
  ruleId: string,
  elementIds: string[],
  severity: Violation['severity'] = 'warning'
): Violation => ({
  ruleId,
  elementIds,
  severity,
  messageKey: `com.labre.test.${ruleId}`,
});

describe('violation identity across evaluations', () => {
  it('is the same for two evaluations reporting the same finding', () => {
    // `evaluateRules` is pure and rebuilds its objects every 120 ms: reference
    // equality would restart the flash on every debounce tick.
    expect(violationKey(violation('r', ['a']))).toBe(
      violationKey(violation('r', ['a']))
    );
  });

  it('does not depend on the order the engine walked the surface in', () => {
    expect(violationKey(violation('r', ['a', 'b']))).toBe(
      violationKey(violation('r', ['b', 'a']))
    );
  });

  it('separates two rules indicting the same element', () => {
    expect(violationKey(violation('r1', ['a']))).not.toBe(
      violationKey(violation('r2', ['a']))
    );
  });
});

describe('ephemeral emphasis, then handover to the badge', () => {
  it('is silent about a violation it has never been told about', () => {
    const timeline = new ViolationTimeline();

    expect(timeline.emphasis(violation('r', ['a']), 0)).toBe(0);
    expect(timeline.isAnimating(0)).toBe(false);
  });

  it('flashes a violation the moment it appears', () => {
    const timeline = new ViolationTimeline();
    const v = violation('r', ['a']);

    timeline.sync([v], 1000);

    expect(timeline.emphasis(v, 1000)).toBe(1);
    expect(timeline.isAnimating(1000)).toBe(true);
  });

  it('holds at full strength for the whole hold window', () => {
    const timeline = new ViolationTimeline();
    const v = violation('r', ['a']);
    timeline.sync([v], 0);

    expect(timeline.emphasis(v, VIOLATION_HOLD_MS - 1)).toBe(1);
    expect(timeline.emphasis(v, VIOLATION_HOLD_MS)).toBe(1);
  });

  it('fades out across the fade window', () => {
    const timeline = new ViolationTimeline();
    const v = violation('r', ['a']);
    timeline.sync([v], 0);

    const midway = (VIOLATION_HOLD_MS + VIOLATION_EMPHASIS_MS) / 2;
    expect(timeline.emphasis(v, midway)).toBeCloseTo(0.5, 5);
    // Monotonic: it never brightens back up on the way down.
    expect(timeline.emphasis(v, midway + 100)).toBeLessThan(
      timeline.emphasis(v, midway)
    );
  });

  it('expires, and stops asking for animation frames', () => {
    const timeline = new ViolationTimeline();
    const v = violation('r', ['a']);
    timeline.sync([v], 0);

    expect(timeline.emphasis(v, VIOLATION_EMPHASIS_MS)).toBe(0);
    expect(timeline.emphasis(v, VIOLATION_EMPHASIS_MS + 10_000)).toBe(0);
    // The badge has taken over: nothing left to repaint.
    expect(timeline.isAnimating(VIOLATION_EMPHASIS_MS)).toBe(false);
  });

  it('does not restart the flash when the same finding is re-reported', () => {
    const timeline = new ViolationTimeline();
    timeline.sync([violation('r', ['a'])], 0);

    // A later evaluation producing a fresh, equal object.
    const reported = violation('r', ['a']);
    timeline.sync([reported], VIOLATION_HOLD_MS);

    expect(timeline.emphasis(reported, VIOLATION_EMPHASIS_MS)).toBe(0);
  });

  it('ages each violation on its own clock', () => {
    const timeline = new ViolationTimeline();
    const first = violation('r', ['a']);
    const second = violation('r', ['b']);

    timeline.sync([first], 0);
    timeline.sync([first, second], VIOLATION_EMPHASIS_MS);

    expect(timeline.emphasis(first, VIOLATION_EMPHASIS_MS)).toBe(0);
    expect(timeline.emphasis(second, VIOLATION_EMPHASIS_MS)).toBe(1);
    expect(timeline.isAnimating(VIOLATION_EMPHASIS_MS)).toBe(true);
  });
});

describe('a corrected violation', () => {
  it('is dropped immediately, with no lingering fade', () => {
    const timeline = new ViolationTimeline();
    const v = violation('r', ['a']);
    timeline.sync([v], 0);

    // The user moved the node back on the map after one second.
    timeline.sync([], 1000);

    expect(timeline.emphasis(v, 1000)).toBe(0);
    expect(timeline.isAnimating(1000)).toBe(false);
  });

  it('flashes again when it is broken a second time', () => {
    const timeline = new ViolationTimeline();
    const v = violation('r', ['a']);
    timeline.sync([v], 0);
    timeline.sync([], 1000);

    // Same rule, same element, much later: a NEW finding, because the user
    // just did something that re-broke it.
    timeline.sync([violation('r', ['a'])], 100_000);

    expect(timeline.emphasis(v, 100_000)).toBe(1);
    expect(timeline.isAnimating(100_000)).toBe(true);
  });

  it('is forgotten wholesale by clear()', () => {
    const timeline = new ViolationTimeline();
    const v = violation('r', ['a']);
    timeline.sync([v], 0);

    timeline.clear();

    expect(timeline.emphasis(v, 0)).toBe(0);
    expect(timeline.isAnimating(0)).toBe(false);
  });
});

describe('what the drawing user is shown', () => {
  it('keeps warnings and blocking findings', () => {
    const warning = violation('r1', ['a'], 'warning');
    const blocking = violation('r2', ['b'], 'blocking-overridable');

    expect(userFacingViolations([warning, blocking])).toEqual([
      warning,
      blocking,
    ]);
  });

  it('hides audit findings, which are collected for reporting only', () => {
    const audit = violation('r3', ['c'], 'audit');
    const warning = violation('r1', ['a'], 'warning');

    expect(userFacingViolations([audit, warning])).toEqual([warning]);
  });
});

describe('what the detail bubble lists', () => {
  it('says the same rule once, however many elements broke it', () => {
    // Two components of one group, both off the map: two violations, one
    // sentence. The engine still names each element; the bubble does not.
    const first = violation('wardley.component-outside-map', ['a']);
    const second = violation('wardley.component-outside-map', ['b']);

    expect(distinctByRule([first, second])).toEqual([first]);
  });

  it('keeps one line per distinct rule', () => {
    const outside = violation('wardley.component-outside-map', ['a']);
    const other = violation('wardley.some-other-rule', ['a']);

    expect(distinctByRule([outside, other])).toEqual([outside, other]);
  });

  it('leaves a single finding alone', () => {
    const only = violation('r', ['a']);

    expect(distinctByRule([only])).toEqual([only]);
    expect(distinctByRule([])).toEqual([]);
  });
});
