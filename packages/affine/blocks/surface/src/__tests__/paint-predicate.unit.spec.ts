/// <reference types="vite/client" />
/**
 * ADR 0031, stage 1: one paint predicate behind every renderer site.
 *
 * The canvas and DOM renderers asked "is this painted?" four times, each with
 * its own copy of `(display ?? true) && !hidden`. Later stages add a viewer's
 * local hide and a stored "hide for everyone" to that question; a copy that
 * missed one of them would paint, in one renderer or one pass, what the others
 * skip. This spec pins the truth table of today's question — the refactor is
 * NO behaviour change — and fails if a renderer file spells the expression
 * inline again instead of calling the predicate.
 */
import { describe, expect, test } from 'vitest';

import { isPainted } from '../renderer/paint-predicate.js';

describe('isPainted', () => {
  test('an element with neither flag set is painted', () => {
    expect(isPainted({})).toBe(true);
  });

  test('`display` undefined reads as painted, `false` as not', () => {
    expect(isPainted({ display: undefined })).toBe(true);
    expect(isPainted({ display: true })).toBe(true);
    expect(isPainted({ display: false })).toBe(false);
  });

  test('the stored `hidden` (mindmap collapse) wins over `display`', () => {
    expect(isPainted({ display: true, hidden: true })).toBe(false);
    expect(isPainted({ display: false, hidden: true })).toBe(false);
    expect(isPainted({ display: true, hidden: false })).toBe(true);
  });
});

describe('the renderer sites call the predicate', () => {
  const sources = import.meta.glob<string>('../renderer/*-renderer.ts', {
    query: '?raw',
    import: 'default',
    eager: true,
  });

  test('both renderers are scanned', () => {
    expect(Object.keys(sources)).toHaveLength(2);
  });

  test.each(Object.entries(sources))(
    '%s spells no inline check',
    (_, source) => {
      expect(source).not.toMatch(/\.display \?\? true/);
      expect(source).toMatch(/isPainted\(/);
    }
  );
});
