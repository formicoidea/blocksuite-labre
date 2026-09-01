import { effect } from '@preact/signals-core';
import { describe, expect, test } from 'vitest';

import { Flag, Flags } from '../../services/toolbar-service/flags.js';

describe('toolbar flags', () => {
  test('`refresh` re-triggers subscribers the way the toolbar reads them', () => {
    const flags = new Flags();
    flags.toggle(Flag.Surface, true);

    let runs = 0;
    // Mirrors the two `effect`s of `affine-toolbar-widget`.
    const dispose = effect(() => {
      void flags.value$.value;
      void flags.revision$.value;
      runs++;
    });

    expect(runs).toBe(1);

    // Regression guard: under `@preact/signals-core` >= 1.14 a `batch` whose
    // net value is unchanged notifies nobody, so the previous
    // toggle-off-then-on implementation left the toolbar frozen.
    flags.refresh(Flag.Surface);
    expect(runs).toBe(2);

    flags.refresh(Flag.Surface);
    expect(runs).toBe(3);

    dispose();
  });

  test('`refresh` never exposes a transient `Flag.None`', () => {
    const flags = new Flags();
    flags.toggle(Flag.Surface, true);

    const seen: Flag[] = [];
    const dispose = effect(() => {
      void flags.revision$.value;
      seen.push(flags.value$.value);
    });

    flags.refresh(Flag.Surface);

    expect(seen).toEqual([Flag.Surface, Flag.Surface]);
    expect(seen).not.toContain(Flag.None);

    dispose();
  });

  test('`refresh` activates a flag that was not set yet', () => {
    const flags = new Flags();

    flags.refresh(Flag.Text);

    expect(flags.check(Flag.Text)).toBe(true);
    expect(flags.revision).toBe(1);
  });

  test('a plain toggle still notifies without touching the revision', () => {
    const flags = new Flags();

    let runs = 0;
    const dispose = effect(() => {
      void flags.value$.value;
      void flags.revision$.value;
      runs++;
    });

    flags.toggle(Flag.Block, true);

    expect(runs).toBe(2);
    expect(flags.revision).toBe(0);

    dispose();
  });
});
