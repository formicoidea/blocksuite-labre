import { describe, expect, test } from 'vitest';

import {
  planToolbarLayout,
  type ToolbarLayoutItem,
  type ToolbarLayoutStep,
  type ToolbarMetrics,
  toolbarDegradationSteps,
} from '../../services/toolbar-service/layout.js';

/**
 * The arithmetic behind "the toolbar never wraps".
 *
 * Everything the widget does with a browser — measuring the row, re-rendering
 * it — is pinned by `toolbar-priority-collapse.spec.ts`. What is left here is
 * the part that decides ANYTHING: in which order entries give way, and how many
 * of them have to.
 */

const item = (
  id: string,
  extra: Partial<ToolbarLayoutItem> = {}
): ToolbarLayoutItem => ({
  id,
  priority: 0,
  shrinkable: false,
  collapsible: true,
  ...extra,
});

const ids = (steps: readonly ToolbarLayoutStep[]) =>
  steps.map(step => `${step.kind}:${step.id}`);

const metrics = (extra: Partial<ToolbarMetrics> = {}): ToolbarMetrics => ({
  content: 0,
  available: Number.POSITIVE_INFINITY,
  label: {},
  entry: {},
  menuCost: 30,
  hasMenu: true,
  ...extra,
});

describe('the order entries give way in', () => {
  test('nothing declared: the row gives way from its end', () => {
    // The default IS the toolbar's own order — an entry that says nothing about
    // its priority keeps exactly the place it has today.
    const steps = toolbarDegradationSteps([item('a'), item('b'), item('c')]);

    expect(ids(steps)).toEqual(['collapse:c', 'collapse:b', 'collapse:a']);
  });

  test('a declared priority overrides the place an entry sorts in', () => {
    // `c.validation-revoke-exception` sorts early and is still the first thing
    // that should move into the "⋮".
    const steps = toolbarDegradationSteps([
      item('rare', { priority: -1 }),
      item('core'),
      item('tail'),
    ]);

    expect(ids(steps)).toEqual([
      'collapse:rare',
      'collapse:tail',
      'collapse:core',
    ]);
  });

  test('every entry that can shrink shrinks before any entry moves', () => {
    // The PO's point 2: icon only comes BEFORE being a candidate for the "⋮" —
    // and that holds across the whole row, not just per entry. A row of icons
    // is still a row of things you can click; a menu is not.
    const steps = toolbarDegradationSteps([
      item('wordy', { shrinkable: true }),
      item('plain'),
    ]);

    expect(ids(steps)).toEqual([
      'shrink:wordy',
      'collapse:plain',
      'collapse:wordy',
    ]);
  });

  test('an entry that can neither shrink nor move offers nothing', () => {
    // The two qualification dropdowns: opaque templates the widget cannot turn
    // into a menu line, so they keep their text and keep their place.
    const steps = toolbarDegradationSteps([
      item('nature', { collapsible: false }),
      item('other'),
    ]);

    expect(ids(steps)).toEqual(['collapse:other']);
  });
});

describe('how much of the row is spent', () => {
  const steps = toolbarDegradationSteps([
    item('read', { shrinkable: true }),
    item('lock'),
  ]);

  test('a row that fits spends nothing', () => {
    const plan = planToolbarLayout(
      steps,
      metrics({ content: 300, available: 300 })
    );

    expect(plan).toEqual([]);
  });

  test('an unconstrained row spends nothing', () => {
    // Before the first reposition there is no cap on the toolbar at all, and a
    // toolbar with all the room in the world collapses nothing.
    const plan = planToolbarLayout(steps, metrics({ content: 900 }));

    expect(plan).toEqual([]);
  });

  test('it stops the moment the row fits', () => {
    // Dropping one label is enough here, so the entry never moves — a toolbar
    // that collapses more than it must is a toolbar hiding things for nothing.
    const plan = planToolbarLayout(
      steps,
      metrics({
        content: 320,
        available: 300,
        label: { read: 90 },
        entry: { read: 130, lock: 32 },
      })
    );

    expect(ids(plan)).toEqual(['shrink:read']);
  });

  test('when shrinking is not enough, entries move', () => {
    const plan = planToolbarLayout(
      steps,
      metrics({
        content: 420,
        available: 300,
        label: { read: 90 },
        entry: { read: 130, lock: 32 },
      })
    );

    // 420 − 90 (label) = 330, still over; − 32 (the lock, least important of
    // the two) = 298, which fits. The wordy entry keeps its icon on the row.
    expect(ids(plan)).toEqual(['shrink:read', 'collapse:lock']);
  });

  test('opening the "⋮" is paid for out of what it swallows', () => {
    const plan = planToolbarLayout(
      steps,
      metrics({
        content: 320,
        available: 300,
        hasMenu: false,
        menuCost: 30,
        label: {},
        entry: { read: 130, lock: 25 },
      })
    );

    // The lock is narrower than the "⋮" that would have to appear to hold it:
    // moving it would make the row WIDER. Skipped, and the entry that can
    // actually pay for the menu is the one that moves.
    expect(ids(plan)).toEqual(['collapse:read']);
  });

  test('the second entry to move is free', () => {
    const plan = planToolbarLayout(
      steps,
      metrics({
        content: 480,
        available: 300,
        hasMenu: false,
        menuCost: 30,
        entry: { read: 130, lock: 32 },
      })
    );

    // The menu is bought once: 480 − (32 − 30) = 478, then − 130 = 348. Still
    // over, and nothing is left to spend.
    expect(ids(plan)).toEqual(['collapse:lock', 'collapse:read']);
  });

  test('a row that cannot fit spends what it has and stays one line', () => {
    const plan = planToolbarLayout(
      steps,
      metrics({
        content: 900,
        available: 120,
        label: { read: 90 },
        entry: { read: 130, lock: 32 },
      })
    );

    // Everything spent, still over — the caller renders it anyway. One line is
    // the invariant; fitting is only the goal.
    expect(ids(plan)).toEqual(['shrink:read', 'collapse:lock', 'collapse:read']);
  });

  test('a step that would free nothing is not spent', () => {
    // An entry whose label measures zero (it never had one) is not turned into
    // an "icon only" entry for the pleasure of re-rendering it.
    const plan = planToolbarLayout(
      toolbarDegradationSteps([item('ghost', { shrinkable: true })]),
      metrics({ content: 320, available: 300, label: { ghost: 0 }, entry: {} })
    );

    expect(plan).toEqual([]);
  });
});
