/**
 * "Show special characters" in the inline editor, and the offset rule it
 * rests on.
 *
 * GUARD: the placeholder rule. Offsets used to treat ANY text node whose
 * whole text was the empty-line character (U+200B in Chrome) as length 0, so
 * a zero-width space the USER stored, alone in its run (and, with the marks
 * on, alone in its own span), shifted every caret after it by one. The
 * placeholders now say what they are (`v-text`'s `empty`, `data-v-empty`) and
 * the content decides nothing. This spec would have caught the old rule: a
 * stored U+200B between two runs, and every index around it, round-trips.
 *
 * With the marks on, every special character gets its own `[data-v-text]`
 * span holding the original character: the text the DOM holds is unchanged,
 * every index round-trips through a DOM range, emoji ZWJ sequences stay
 * whole, and outside an editor host (no `std`, no provider) nothing is cut.
 * The budget pins the cost of cutting 2000 runs at once.
 */
import { signal } from '@preact/signals-core';
import { afterEach, expect, test } from 'vitest';
import * as Y from 'yjs';

import { effects } from '../../effects.js';
import {
  InlineEditor,
  InvisibleCharactersDisplayIdentifier,
} from '../../inline/index.js';
import { stdContext } from '../../view/element/lit-host.js';

effects();

const ZWSP = '\u200B';
/** "x", a space, the woman technologist emoji (a ZWJ sequence), a space, "y". */
const TECHNOLOGIST = 'x \uD83D\uDC69\u200D\uD83D\uDCBB y';

const show$ = signal(false);

const fakeStd = {
  getOptional: (identifier: unknown) =>
    identifier === InvisibleCharactersDisplayIdentifier
      ? { showInvisibles$: show$ }
      : null,
};

const mounted: { editor: InlineEditor; wrapper: HTMLElement }[] = [];

afterEach(() => {
  for (const { editor, wrapper } of mounted.splice(0)) {
    editor.unmount();
    wrapper.remove();
  }
  show$.value = false;
});

type Delta = { insert: string; attributes?: Record<string, unknown> }[];

/** An inline editor under an element that answers `std`, like a host. */
async function setup(delta: Delta, withStd = true) {
  const yDoc = new Y.Doc();
  const yText = yDoc.getText('text');
  yText.applyDelta(delta);
  const editor = new InlineEditor(yText);
  const wrapper = document.createElement('div');
  if (withStd) {
    wrapper.addEventListener('context-request', event => {
      const request = event as Event & {
        context: unknown;
        callback: (value: unknown) => void;
      };
      if (request.context !== stdContext) return;
      event.stopPropagation();
      request.callback(fakeStd);
    });
  }
  const root = document.createElement('div');
  wrapper.append(root);
  document.body.append(wrapper);
  editor.mount(root);
  await editor.waitForUpdate();
  mounted.push({ editor, wrapper });
  return { editor, root };
}

async function settle(editor: InlineEditor) {
  await new Promise(resolve => requestAnimationFrame(resolve));
  await editor.waitForUpdate();
}

function spanTexts(root: HTMLElement) {
  return Array.from(root.querySelectorAll('[data-v-text="true"]')).map(
    span => span.textContent
  );
}

function expectEveryIndexRoundTrips(editor: InlineEditor, length: number) {
  for (let index = 0; index <= length; index++) {
    const range = editor.toDomRange({ index, length: 0 });
    expect(range, `index ${index}`).not.toBeNull();
    expect(editor.toInlineRange(range!), `index ${index}`).toEqual({
      index,
      length: 0,
    });
  }
}

test('guard: a stored zero-width space alone in its run keeps its length', async () => {
  const { editor, root } = await setup([
    { insert: 'ab' },
    { insert: ZWSP, attributes: { bold: true } },
    { insert: 'cd' },
  ]);
  expect(root.querySelectorAll('[data-v-empty]')).toHaveLength(0);
  expectEveryIndexRoundTrips(editor, 5);
  // The run after the stored character starts at index 3, not 2.
  const cd = Array.from(root.querySelectorAll('[data-v-text="true"]')).find(
    span => span.textContent === 'cd'
  )!;
  const range = document.createRange();
  range.setStart(cd.lastChild!, 0);
  expect(editor.toInlineRange(range)).toEqual({ index: 3, length: 0 });
});

test('guard: an empty line is still a placeholder of length 0', async () => {
  const { editor, root } = await setup([{ insert: 'ab\n\ncd' }]);
  expect(root.querySelectorAll('[data-v-empty="true"]')).toHaveLength(1);
  expectEveryIndexRoundTrips(editor, 6);
});

test('off: one span per run, nothing marked', async () => {
  const { root } = await setup([{ insert: 'a b\tc' }]);
  expect(spanTexts(root)).toEqual(['a b\tc']);
  expect(root.querySelectorAll('[data-v-invisible]')).toHaveLength(0);
});

test('on: every special character in its own span, the text unchanged', async () => {
  const text = 'a b\tc\u00A0d\u202Fe\u200Bf\u2060g';
  const { editor, root } = await setup([{ insert: text }]);
  show$.value = true;
  await settle(editor);

  const kinds = Array.from(root.querySelectorAll('[data-v-invisible]')).map(
    span => [span.textContent, span.getAttribute('data-v-invisible')]
  );
  expect(kinds).toEqual([
    [' ', 'space'],
    ['\t', 'tab'],
    ['\u00A0', 'nbsp'],
    ['\u202F', 'nbsp'],
    ['\u200B', 'invisible'],
    ['\u2060', 'invisible'],
  ]);
  expect(spanTexts(root).join('')).toBe(text);
  expectEveryIndexRoundTrips(editor, text.length);

  // The mark is drawn over the character, not typed: absolutely positioned,
  // so the space keeps its width.
  const space = root.querySelector('[data-v-invisible="space"]')!;
  const before = getComputedStyle(space, '::before');
  expect(before.content).toBe('"\u00B7"');
  expect(before.position).toBe('absolute');
});

test('on: an emoji sequence stays whole, a stored ZWSP run round-trips', async () => {
  const { editor, root } = await setup([
    { insert: TECHNOLOGIST },
    { insert: ZWSP, attributes: { bold: true } },
  ]);
  show$.value = true;
  await settle(editor);
  expect(spanTexts(root)).toEqual([
    'x',
    ' ',
    TECHNOLOGIST.slice(2, -2),
    ' ',
    'y',
    ZWSP,
  ]);
  expectEveryIndexRoundTrips(editor, TECHNOLOGIST.length + 1);
});

test('the display follows the signal both ways', async () => {
  const { editor, root } = await setup([{ insert: 'a b' }]);
  show$.value = true;
  await settle(editor);
  expect(spanTexts(root)).toEqual(['a', ' ', 'b']);
  show$.value = false;
  await settle(editor);
  expect(spanTexts(root)).toEqual(['a b']);
});

test('outside an editor host nothing is cut', async () => {
  const { editor, root } = await setup([{ insert: 'a b' }], false);
  show$.value = true;
  await settle(editor);
  expect(spanTexts(root)).toEqual(['a b']);
});

/**
 * Budget: switching the marks on over 2000 runs (2000 `v-text`s, each cut in
 * four spans, 8000 in all) re-renders AND lays out within `TOGGLE_BUDGET_MS`.
 * Best of several samples, the repo's rule for a bench that flips under load.
 *
 * Measured on a loaded workstation (headless Chromium, other suites running):
 * best 815 ms, about 215 ms of rendering and 600 ms of layout, where laying
 * out the same 2000 runs unmarked takes 135 ms; the layout grows with the
 * element count, four times the spans. The budget catches a quadratic cut or
 * a mark that re-lays out per character, not the cost of the spans
 * themselves. 2000 runs is a long document: a run is a change of formatting.
 */
const TOGGLE_BUDGET_MS = 1500;

/** Every `v-text` updated, then a forced layout: the cost a user waits for. */
async function renderAndLayout(root: HTMLElement) {
  await Promise.all(
    Array.from(root.querySelectorAll('v-text')).map(
      vText => vText.updateComplete
    )
  );
  return root.offsetHeight;
}

test(
  'budget: 2000 runs cut within the budget',
  { timeout: 30_000 },
  async () => {
    const delta = Array.from({ length: 2000 }, (_, i) => ({
      insert: 'word one ',
      attributes: i % 2 ? { bold: true } : { italic: true },
    }));
    const { root } = await setup(delta);
    expect(root.querySelectorAll('v-text')).toHaveLength(2000);

    const samples: number[] = [];
    for (let i = 0; i < 4; i++) {
      await renderAndLayout(root);
      const start = performance.now();
      show$.value = true;
      await renderAndLayout(root);
      samples.push(performance.now() - start);
      expect(root.querySelectorAll('[data-v-text="true"]')).toHaveLength(8000);
      show$.value = false;
    }
    const best = Math.min(...samples);
    console.info(
      `invisibles toggle over 2000 runs: best ${best.toFixed(1)} ms of [${samples
        .map(sample => sample.toFixed(1))
        .join(', ')}]`
    );
    expect(best).toBeLessThan(TOGGLE_BUDGET_MS);
  }
);
