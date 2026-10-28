import { effects as datePickerEffects } from '@labre/affine-components/date-picker';
import { effects as portalEffects } from '@labre/affine-components/portal';
import { signal } from '@preact/signals-core';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

import { coreEffects } from '../core/effect.js';
import {
  createStandaloneCell,
  type PropertyMetaConfig,
  type StandaloneCellSource,
} from '../core/index.js';
import { propertyPresetsEffects } from '../property-presets/effect.js';
import { propertyPresets } from '../property-presets/index.js';
import { TYPING_COMMIT_MS } from '../property-presets/typing-commit.js';

/**
 * When an in-place cell editor (text, number) hands what is typed to its
 * source (recette 3, P3-5).
 *
 * A table cell committed only when the view's selection left it: Enter, Tab,
 * Escape or another cell. A click outside the editor (the host's chrome, a
 * panel, a link that navigates) changes no selection, so the edit stayed in
 * an input nobody would commit and was lost when the cell went away. The
 * title band's cell (`dv-standalone-cell`) already left on focusout; the
 * table's container does not, so the renderer commits by itself.
 *
 * What it would have caught:
 * - a cell left by a blur, with no exit, that writes nothing;
 * - a cell removed while editing (a navigation) that drops the edit;
 * - nothing written while typing: « la case se met à jour à la
 *   modification, pas à la validation »;
 * - a write per keystroke (a host writing to a server would spam it);
 * - an exit with nothing typed that still writes (an empty undo entry, a
 *   server write for nothing, a peer's value overwritten);
 * - a commit while typing that rewrites the input under the caret, or a
 *   half-typed number committed as garbage.
 *
 * The renderer is mounted bare, the way the table's cell container mounts it:
 * `isEditing$` stays true until the test says otherwise, `selectCurrentCell`
 * is a spy, so only the renderer's own commits reach `valueSet`.
 */

const frame = () =>
  new Promise<void>(resolve => requestAnimationFrame(() => resolve()));

beforeAll(() => {
  if (!customElements.get('uni-lit')) coreEffects();
  if (!customElements.get('date-picker')) datePickerEffects();
  if (!customElements.get('blocksuite-portal')) portalEffects();
  if (!customElements.get('affine-database-text-cell')) {
    propertyPresetsEffects();
  }
});

afterEach(() => {
  vi.useRealTimers();
  document.body.innerHTML = '';
});

interface BareCell extends HTMLElement {
  cell: unknown;
  isEditing$: { value: boolean; peek(): boolean };
  selectCurrentCell: (editing: boolean) => void;
  updateComplete: Promise<boolean>;
  beforeExitEditingMode(): void;
}

async function mount(tag: string, config: { type: string }, value: unknown) {
  const value$ = signal<unknown>(value);
  const valueSet = vi.fn((next: unknown) => {
    value$.value = next;
  });
  const src = {
    propertyId: 'p',
    name$: signal('Prop'),
    data$: signal({}),
    value$,
    readonly$: signal(false),
    valueSet,
  } as unknown as StandaloneCellSource;
  const el = document.createElement(tag) as BareCell;
  el.cell = createStandaloneCell(config as PropertyMetaConfig, src);
  el.isEditing$ = signal(true);
  el.selectCurrentCell = vi.fn();
  document.body.append(el);
  await el.updateComplete;
  const input = el.querySelector('input');
  if (!input) throw new Error('no input');
  return { el, input, valueSet, value$ };
}

function type(input: HTMLInputElement, text: string) {
  input.value = text;
  input.dispatchEvent(new Event('input'));
}

describe('a text cell', () => {
  const text = () =>
    mount('affine-database-text-cell', propertyPresets.textPropertyConfig, 'A');

  it('commits on blur, with no exit', async () => {
    const { input, valueSet } = await text();
    type(input, 'Ada');
    input.dispatchEvent(new FocusEvent('blur'));
    expect(valueSet.mock.calls).toEqual([['Ada']]);
  });

  it('commits once the typing pauses, not per keystroke', async () => {
    vi.useFakeTimers();
    const { input, valueSet } = await text();
    type(input, 'Ad');
    vi.advanceTimersByTime(TYPING_COMMIT_MS - 1);
    type(input, 'Ada');
    vi.advanceTimersByTime(TYPING_COMMIT_MS - 1);
    expect(valueSet).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(valueSet.mock.calls).toEqual([['Ada']]);
  });

  it('keeps the input as typed when its commit echoes back', async () => {
    vi.useFakeTimers();
    const { el, input, value$ } = await text();
    type(input, 'Ad');
    vi.advanceTimersByTime(TYPING_COMMIT_MS);
    expect(value$.value).toBe('Ad');
    input.value = 'Ada';
    await el.updateComplete;
    expect(input.value).toBe('Ada');
  });

  it('commits when removed while editing', async () => {
    const { el, input, valueSet } = await text();
    type(input, 'Ada');
    el.remove();
    expect(valueSet.mock.calls).toEqual([['Ada']]);
  });

  it('writes nothing on an exit with nothing new typed', async () => {
    vi.useFakeTimers();
    const { el, input, valueSet } = await text();
    input.dispatchEvent(new FocusEvent('blur'));
    el.beforeExitEditingMode();
    vi.runAllTimers();
    expect(valueSet).not.toHaveBeenCalled();

    type(input, 'Ada');
    vi.advanceTimersByTime(TYPING_COMMIT_MS);
    input.dispatchEvent(new FocusEvent('blur'));
    el.beforeExitEditingMode();
    vi.runAllTimers();
    expect(valueSet.mock.calls).toEqual([['Ada']]);
  });

  it('still commits on exit (Enter, Escape, Tab, another cell)', async () => {
    const { el, input, valueSet } = await text();
    type(input, 'Ada');
    el.beforeExitEditingMode();
    await frame();
    expect(valueSet.mock.calls).toEqual([['Ada']]);
  });
});

describe('a number cell', () => {
  const num = () =>
    mount(
      'affine-database-number-cell',
      propertyPresets.numberPropertyConfig,
      3
    );

  it('commits a number once the typing pauses, not a half-typed one', async () => {
    vi.useFakeTimers();
    const { el, input, valueSet } = await num();
    type(input, '-');
    vi.advanceTimersByTime(TYPING_COMMIT_MS);
    expect(valueSet).not.toHaveBeenCalled();
    type(input, '-4.');
    vi.advanceTimersByTime(TYPING_COMMIT_MS);
    expect(valueSet.mock.calls).toEqual([[-4]]);
    await el.updateComplete;
    expect(input.value).toBe('-4.');
  });

  it('writes nothing on an exit when the number did not change', async () => {
    const { el, input, valueSet } = await num();
    type(input, '3');
    el.beforeExitEditingMode();
    await frame();
    expect(valueSet).not.toHaveBeenCalled();
  });

  it('commits when removed while editing', async () => {
    const { el, input, valueSet } = await num();
    type(input, '12');
    el.remove();
    expect(valueSet.mock.calls).toEqual([[12]]);
  });
});
