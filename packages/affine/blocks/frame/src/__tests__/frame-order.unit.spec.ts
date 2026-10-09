/**
 * One write of the presentation order (ADR 0034).
 *
 * Why this spec exists: two sites wrote `presentationIndex` by hand — the frame
 * panel's drag and the presentation toolbar's order menu — neither refusing a
 * read-only document, the panel taking its `captureSync` AFTER the write (so
 * the reorder merged into the previous undo step) and both writing even when
 * the drop changed nothing. `reorderFramePresentation` is now the only writer;
 * these cases pin its guards so a host's slide panel, which reaches it through
 * `canvas.frame.reorder`, gets the same ones.
 */
import type { BlockStdScope } from '@labre/std';
import { GfxControllerIdentifier } from '@labre/std/gfx';
import { describe, expect, it } from 'vitest';

import {
  EdgelessFrameManager,
  EdgelessFrameManagerIdentifier,
} from '../frame-manager';
import { reorderFramePresentation } from '../frame-order';

interface FakeFrame {
  id: string;
  props: { index: string; presentationIndex?: string };
}

/**
 * A std holding `keys.length` frames `a`, `b`, `c`… keyed in that order, and a
 * log of every store call the action makes, in order.
 */
function fakeStd(keys: string[], { readonly = false } = {}) {
  const frames: FakeFrame[] = keys.map((key, i) => ({
    id: String.fromCharCode(97 + i),
    props: { index: `a${i}`, presentationIndex: key },
  }));
  const log: string[] = [];
  let reads = 0;
  const manager = {
    get frames() {
      return frames
        .slice()
        .sort(EdgelessFrameManager.framePresentationComparator);
    },
    refreshLegacyFrameOrder: () => log.push('refresh'),
  };
  const gfx = {
    updateElement: (frame: FakeFrame, props: { presentationIndex: string }) => {
      log.push(`write:${frame.id}`);
      frame.props.presentationIndex = props.presentationIndex;
    },
  };
  const std = {
    store: {
      get readonly() {
        return readonly;
      },
      captureSync: () => log.push('captureSync'),
      transact: (fn: () => void) => {
        log.push('transact');
        fn();
      },
    },
    get: (id: unknown) => {
      reads++;
      if (id === EdgelessFrameManagerIdentifier) return manager;
      if (id === GfxControllerIdentifier) return gfx;
      throw new Error(`unexpected get(${String(id)})`);
    },
  } as unknown as BlockStdScope;

  return {
    std,
    log,
    reads: () => reads,
    order: () => manager.frames.map(frame => frame.id).join(''),
    key: (id: string) =>
      frames.find(frame => frame.id === id)!.props.presentationIndex!,
  };
}

describe('reorderFramePresentation', () => {
  it('refuses a read-only document before reading anything', () => {
    const fake = fakeStd(['a0', 'a1', 'a2'], { readonly: true });
    expect(reorderFramePresentation(fake.std, ['c'], 'a')).toBe(false);
    expect(fake.reads()).toBe(0);
    expect(fake.log).toEqual([]);
  });

  it('refuses an unknown id, a `before` among the moved frames, an unknown `before`', () => {
    const fake = fakeStd(['a0', 'a1', 'a2']);
    expect(reorderFramePresentation(fake.std, ['x'], 'a')).toBe(false);
    expect(reorderFramePresentation(fake.std, ['a', 'x'], null)).toBe(false);
    expect(reorderFramePresentation(fake.std, ['b', 'c'], 'c')).toBe(false);
    expect(reorderFramePresentation(fake.std, ['c'], 'x')).toBe(false);
    expect(reorderFramePresentation(fake.std, [], null)).toBe(false);
    expect(fake.log).toEqual([]);
    expect(fake.order()).toBe('abc');
  });

  it('writes nothing, and pushes no undo step, when the frames are already there', () => {
    const fake = fakeStd(['a0', 'a1', 'a2']);
    expect(reorderFramePresentation(fake.std, ['b'], 'c')).toBe(false);
    expect(reorderFramePresentation(fake.std, ['c'], null)).toBe(false);
    expect(reorderFramePresentation(fake.std, ['a', 'b'], 'c')).toBe(false);
    expect(fake.log).toEqual([]);
  });

  it('moves one frame before another with a key between its new neighbours', () => {
    const fake = fakeStd(['a0', 'a1', 'a2']);
    expect(reorderFramePresentation(fake.std, ['c'], 'b')).toBe(true);
    expect(fake.order()).toBe('acb');
    expect(fake.key('c') > 'a0').toBe(true);
    expect(fake.key('c') < 'a1').toBe(true);
    // Only the moved frame is written.
    expect(fake.log.filter(entry => entry.startsWith('write:'))).toEqual([
      'write:c',
    ]);
  });

  it('moves several frames as one block, in their current relative order, and `null` is the end', () => {
    const fake = fakeStd(['a0', 'a1', 'a2', 'a3', 'a4']);
    // Listed out of order: the presentation order decides, not `ids`.
    expect(reorderFramePresentation(fake.std, ['d', 'a'], null)).toBe(true);
    expect(fake.order()).toBe('bcead');

    expect(reorderFramePresentation(fake.std, ['d', 'e'], 'b')).toBe(true);
    expect(fake.order()).toBe('edbca');
  });

  it('takes one captureSync before writing, and none after', () => {
    const fake = fakeStd(['a0', 'a1', 'a2']);
    reorderFramePresentation(fake.std, ['b', 'c'], 'a');
    expect(fake.log).toEqual([
      'captureSync',
      'refresh',
      'transact',
      'write:b',
      'write:c',
    ]);
  });

  it('refuses two equal neighbour keys instead of throwing', () => {
    // `a` and `b` share a key: nothing fits between them.
    const fake = fakeStd(['a1', 'a1', 'a2']);
    expect(() => reorderFramePresentation(fake.std, ['c'], 'b')).not.toThrow();
    expect(reorderFramePresentation(fake.std, ['c'], 'b')).toBe(false);
    expect(fake.log.some(entry => entry.startsWith('write:'))).toBe(false);
    expect(fake.order()).toBe('abc');
  });
});
