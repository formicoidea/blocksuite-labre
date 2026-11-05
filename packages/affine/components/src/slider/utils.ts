import { clamp } from '@labre/global/gfx';

import type { SliderContinuousRange, SliderRange } from './types';

export function isDiscreteRange(range: unknown): range is SliderRange {
  return (
    typeof range === 'object' &&
    range !== null &&
    'points' in range &&
    Array.isArray(range.points)
  );
}

export function isContinuousRange(
  range: unknown
): range is SliderContinuousRange {
  return (
    typeof range === 'object' &&
    range !== null &&
    'min' in range &&
    'max' in range &&
    typeof range.min === 'number' &&
    typeof range.max === 'number' &&
    range.max > range.min
  );
}

/** Steps per span when a continuous range names none. */
const DEFAULT_STEPS = 100;

export function continuousStep({ min, max, step }: SliderContinuousRange) {
  return step && step > 0 ? step : (max - min) / DEFAULT_STEPS;
}

/** `value` inside the range, on the nearest step counted from `min`. */
export function snapContinuous(range: SliderContinuousRange, value: number) {
  const step = continuousStep(range);
  const snapped = range.min + Math.round((value - range.min) / step) * step;
  return clamp(snapped, range.min, range.max);
}

/** Where `value` sits along the range, from 0 (`min`) to 1 (`max`). */
export function continuousFraction(
  range: SliderContinuousRange,
  value: number
) {
  return clamp((value - range.min) / (range.max - range.min), 0, 1);
}

/** The value at a fraction of the track, snapped to the step. */
export function continuousValueAt(
  range: SliderContinuousRange,
  fraction: number
) {
  return snapContinuous(
    range,
    range.min + clamp(fraction, 0, 1) * (range.max - range.min)
  );
}
