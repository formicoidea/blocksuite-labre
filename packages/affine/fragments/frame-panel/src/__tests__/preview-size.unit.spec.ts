/**
 * The box of a fluid frame preview (recette 1, P0-1.2).
 *
 * Why it exists: the frame panel's cards were 284 × 170 whatever the panel's
 * width, so a wider sidebar left an empty strip beside every thumbnail. A
 * card now takes the panel's width and its preview the frame's proportions;
 * this pins the arithmetic — the width followed, the ratio kept, a portrait
 * frame capped at a square so one card never fills the screen, and no box
 * before the container is laid out.
 */
import { describe, expect, test } from 'vitest';

import { fluidPreviewSize } from '../card/preview-size.js';

describe('fluidPreviewSize', () => {
  test('takes the container width and keeps the frame proportions', () => {
    expect(fluidPreviewSize(320, 1920, 1080)).toEqual({
      width: 320,
      height: 180,
    });
  });

  test('grows and shrinks with the container', () => {
    const narrow = fluidPreviewSize(200, 1600, 900);
    const wide = fluidPreviewSize(480, 1600, 900);
    expect(wide.width / wide.height).toBeCloseTo(
      narrow.width / narrow.height,
      1
    );
    expect(wide.height).toBeGreaterThan(narrow.height);
  });

  test('caps a portrait frame at a square box', () => {
    expect(fluidPreviewSize(300, 400, 1200)).toEqual({
      width: 300,
      height: 300,
    });
  });

  test('a frame without an area gets a square box', () => {
    expect(fluidPreviewSize(240, 0, 0)).toEqual({ width: 240, height: 240 });
  });

  test('no box before the container is laid out', () => {
    expect(fluidPreviewSize(0, 1920, 1080)).toEqual({ width: 0, height: 0 });
    expect(fluidPreviewSize(-4, 1920, 1080)).toEqual({ width: 0, height: 0 });
  });

  test('whole pixels, so a sub-pixel resize does not repaint', () => {
    expect(fluidPreviewSize(320.7, 1000, 333)).toEqual({
      width: 320,
      height: 107,
    });
  });
});
