import type { AutoUpdateOptions, ReferenceElement } from '@floating-ui/dom';
import { beforeEach, describe, expect, test, vi } from 'vitest';

const { calls } = vi.hoisted(() => ({
  calls: [] as AutoUpdateOptions[],
}));

vi.mock('@floating-ui/dom', async importOriginal => {
  const actual = await importOriginal<typeof import('@floating-ui/dom')>();
  return {
    ...actual,
    autoUpdate: (
      _reference: unknown,
      _floating: unknown,
      _update: unknown,
      options: AutoUpdateOptions = {}
    ) => {
      calls.push(options);
      return () => {};
    },
  };
});

import { autoUpdatePosition } from '../utils.js';

const reference = {
  getBoundingClientRect: () => new DOMRect(),
} as ReferenceElement;

const start = (flavour: string, options?: AutoUpdateOptions) =>
  autoUpdatePosition(
    new AbortController().signal,
    // Only the `update` closure reads the toolbar, and the stub never runs it.
    {} as never,
    reference,
    flavour,
    'top',
    null,
    options
  );

beforeEach(() => {
  calls.length = 0;
});

describe('autoUpdatePosition', () => {
  test('does not poll every frame for a block anchor', () => {
    start('affine:paragraph');

    expect(calls[0].animationFrame).toBe(false);
    expect(calls[0].elementResize).toBe(false);
  });

  test('polls every frame for a canvas anchor', () => {
    start('affine:surface:shape');

    expect(calls[0].animationFrame).toBe(true);
  });

  test('an explicit option still wins', () => {
    start('affine:surface:shape', { animationFrame: false });

    expect(calls[0].animationFrame).toBe(false);
  });
});
