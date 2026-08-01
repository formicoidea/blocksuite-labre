import type { Violation } from './validation.js';

/**
 * The ephemeral half of the PF7 affordance.
 *
 * A violation is reported twice, on two different clocks:
 *
 * - **now** — the moment it appears, the bracket flashes bright on the anchor
 *   so the eye is pulled to it while the user still remembers the gesture that
 *   caused it (PRD principle 3: tell me at the moment I can act);
 * - **later** — once that window closes the bracket fades out and a small,
 *   permanent badge takes over. The board stays legible; the finding does not
 *   disappear (PRD principle 6: a violation is an object, and it persists as
 *   long as it holds).
 *
 * This class owns the FIRST half. It is pure state — a map of first-seen
 * timestamps, keyed by violation identity — and it is deliberately not a
 * component, not a signal and not persisted: it is OVERLAY state, rebuilt from
 * scratch on every reload. A document tells you which rules it breaks, never
 * when you happened to look at them.
 *
 * Every method takes `now` explicitly rather than reading a clock, so the
 * machine is exercised in unit tests by passing numbers instead of by faking
 * timers.
 */

/** How long a fresh violation stays at full strength. */
export const VIOLATION_HOLD_MS = 3000;

/** How long it then takes to fade out, handing over to the badge. */
export const VIOLATION_FADE_MS = 600;

/** Total lifetime of the ephemeral mark. */
export const VIOLATION_EMPHASIS_MS = VIOLATION_HOLD_MS + VIOLATION_FADE_MS;

/**
 * Identity of a violation ACROSS evaluations. `evaluateRules` is pure and
 * rebuilds its objects from scratch every 120 ms, so reference equality would
 * make every violation look brand new on every debounce tick and the flash
 * would never end.
 *
 * A violation is the same violation when the same rule indicts the same
 * elements. Element ids are sorted so the key does not depend on the order the
 * engine happened to walk the surface in, and the two halves are joined by a
 * character neither a rule id nor an element id can contain.
 */
export function violationKey(violation: Violation): string {
  return `${violation.ruleId}|${[...violation.elementIds].sort().join(',')}`;
}

export class ViolationTimeline {
  private readonly _firstSeen = new Map<string, number>();

  /**
   * Reconcile with the violations currently reported.
   *
   * - a violation not seen before starts its window at `now`;
   * - a violation still present keeps the timestamp it already had, so it ages;
   * - a violation that disappeared is forgotten IMMEDIATELY — a corrected
   *   element must lose its mark on the spot, with no lingering fade;
   * - a violation that comes back after being corrected is a new one, and gets
   *   a new flash. It has to: the user just did something that re-broke it.
   */
  sync(violations: readonly Violation[], now: number): void {
    const live = new Set<string>();
    for (const violation of violations) {
      const key = violationKey(violation);
      live.add(key);
      if (!this._firstSeen.has(key)) this._firstSeen.set(key, now);
    }
    for (const key of this._firstSeen.keys()) {
      if (!live.has(key)) this._firstSeen.delete(key);
    }
  }

  /**
   * How loudly to draw this violation right now: `1` while held, ramping
   * linearly to `0` across the fade, `0` afterwards and for anything unknown.
   */
  emphasis(violation: Violation, now: number): number {
    const seen = this._firstSeen.get(violationKey(violation));
    if (seen === undefined) return 0;

    const age = now - seen;
    if (age <= VIOLATION_HOLD_MS) return 1;
    if (age >= VIOLATION_EMPHASIS_MS) return 0;
    return 1 - (age - VIOLATION_HOLD_MS) / VIOLATION_FADE_MS;
  }

  /**
   * Whether anything is still inside its window — i.e. whether the overlay has
   * a reason to keep repainting. False on a clean board, false on a board whose
   * violations have all settled: no animation frame is ever requested when
   * there is nothing to animate.
   */
  isAnimating(now: number): boolean {
    for (const seen of this._firstSeen.values()) {
      if (now - seen < VIOLATION_EMPHASIS_MS) return true;
    }
    return false;
  }

  /**
   * When the next mark finishes fading, or `null` when none is still in its
   * window.
   *
   * The bracket and the badge are mutually exclusive — the badge appears only
   * once the bracket is fully gone — so the DOM half has to wake up at the
   * exact moment the canvas half goes quiet. This is the one instant it needs,
   * so it can arm a single timer instead of polling. Nothing to arm on a board
   * whose marks have all settled: the answer is `null`.
   */
  nextExpiryAt(now: number): number | null {
    let earliest: number | null = null;
    for (const seen of this._firstSeen.values()) {
      const expiry = seen + VIOLATION_EMPHASIS_MS;
      if (expiry <= now) continue;
      if (earliest === null || expiry < earliest) earliest = expiry;
    }
    return earliest;
  }

  clear(): void {
    this._firstSeen.clear();
  }
}
