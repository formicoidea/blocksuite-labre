/**
 * GUARD — a new source is named in the menu that creates it (ADR 0035
 * amendment of 2026-10-30): with the host's `sourceName`, "New source" opens
 * a step in the same cascade instead of creating at once.
 *
 * What it would have caught (labre recette of 2.0): the host opening a modal
 * dialog of its own over the picker's popover to name the source; a name
 * the host says is taken, or an empty one, still created by "Create" or by
 * Enter; the name reaching the host untrimmed, or a host without naming
 * called with an extra `undefined` argument it never declared.
 */
import {
  effects as contextMenuEffects,
  popupTargetFromElement,
} from '@labre/affine-components/context-menu';
import type {
  DataSourcePickerDatabase,
  DataSourcePickerService,
  DataSourcePickerSourceNaming,
} from '@labre/affine-shared/services';
import type { BlockStdScope } from '@labre/std';
import { signal } from '@preact/signals-core';
import { afterEach, beforeAll, describe, expect, test, vi } from 'vitest';

import {
  type DataSourceChoice,
  popDataSourcePicker,
} from '../data-source-picker.js';

beforeAll(() => {
  if (!customElements.get('affine-menu')) contextMenuEffects();
});

afterEach(() => {
  document.body.innerHTML = '';
});

const PLAN: DataSourcePickerDatabase = {
  id: 'db-plan',
  title: 'Plan',
  sources: [
    { id: 's-1', title: 'Projects' },
    { id: 's-2', title: 'Risks' },
  ],
};

const std = {
  store: { readonly: false },
  getOptional: () => null,
} as unknown as BlockStdScope;

const frame = () =>
  new Promise<void>(resolve => requestAnimationFrame(() => resolve()));

const byTestId = (id: string) =>
  document.querySelector<HTMLElement>(`[data-testid="${id}"]`);

/** Names taken in this database, compared as the host would (case-blind). */
const naming: DataSourcePickerSourceNaming = {
  suggest: async () => 'Source 3',
  check: name => {
    const key = name.trim().toLowerCase();
    if (!key) return 'empty';
    return PLAN.sources.some(s => s.title.toLowerCase() === key)
      ? 'taken'
      : 'ok';
  },
};

async function open(picker: DataSourcePickerService) {
  const anchor = document.createElement('div');
  document.body.append(anchor);
  const onPick = vi.fn<(choice: DataSourceChoice) => void>();
  popDataSourcePicker(std, picker, popupTargetFromElement(anchor), {
    databaseId: PLAN.id,
    onPick,
  });
  await frame();
  return onPick;
}

async function openStep() {
  byTestId('data-source-picker-new-source')!.click();
  await vi.waitFor(() =>
    expect(
      byTestId('data-source-picker-new-source-naming')?.querySelector(
        'affine-menu-input'
      )
    ).not.toBeNull()
  );
  const host = byTestId('data-source-picker-new-source-naming')!.querySelector(
    'affine-menu-input'
  )!;
  await frame();
  return (host.shadowRoot ?? host).querySelector('input')!;
}

function type(input: HTMLInputElement, value: string) {
  input.value = value;
  input.dispatchEvent(new InputEvent('input', { bubbles: true }));
}

const verdict = () =>
  byTestId('data-source-picker-new-source-verdict')?.dataset.verdict;

describe('naming a new source in the menu', () => {
  test('without the host naming, "New source" creates at once, unnamed', async () => {
    const createSource = vi.fn(async () => ({ id: 's-3', title: 'Source 3' }));
    const onPick = await open({ list: () => signal([PLAN]), createSource });
    byTestId('data-source-picker-new-source')!.click();
    await vi.waitFor(() => expect(onPick).toHaveBeenCalledTimes(1));
    expect(createSource.mock.calls[0]).toEqual(['db-plan']);
    expect(byTestId('data-source-picker-new-source-naming')).toBeNull();
  });

  test('opens on the suggestion, available, and creates it trimmed', async () => {
    const createSource = vi.fn(async () => ({ id: 's-3', title: 'Budget' }));
    const onPick = await open({
      list: () => signal([PLAN]),
      createSource,
      sourceName: naming,
    });
    const input = await openStep();
    expect(input.value).toBe('Source 3');
    expect(verdict()).toBe('ok');
    expect(createSource).not.toHaveBeenCalled();

    type(input, '  Budget ');
    await frame();
    byTestId('data-source-picker-new-source-create')!.click();
    await vi.waitFor(() => expect(onPick).toHaveBeenCalledTimes(1));
    expect(createSource.mock.calls[0]).toEqual(['db-plan', 'Budget']);
    expect(onPick.mock.calls[0]![0]).toMatchObject({
      sourceId: 's-3',
      source: 'new',
    });
  });

  test('a taken or empty name creates nothing, by click or by Enter', async () => {
    const createSource = vi.fn(async () => ({ id: 's-3', title: 'x' }));
    await open({
      list: () => signal([PLAN]),
      createSource,
      sourceName: naming,
    });
    const input = await openStep();

    type(input, 'projects');
    await frame();
    expect(verdict()).toBe('taken');
    byTestId('data-source-picker-new-source-create')!.click();
    input.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Enter', bubbles: true })
    );

    type(input, '   ');
    await frame();
    expect(verdict()).toBe('empty');
    input.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Enter', bubbles: true })
    );

    await frame();
    expect(createSource).not.toHaveBeenCalled();
    expect(byTestId('data-source-picker-new-source-naming')).not.toBeNull();
  });

  test('Enter on an available name creates it', async () => {
    const createSource = vi.fn(async () => ({ id: 's-3', title: 'Budget' }));
    const onPick = await open({
      list: () => signal([PLAN]),
      createSource,
      sourceName: naming,
    });
    const input = await openStep();
    type(input, 'Budget');
    input.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Enter', bubbles: true })
    );
    await vi.waitFor(() => expect(onPick).toHaveBeenCalledTimes(1));
    expect(createSource.mock.calls[0]).toEqual(['db-plan', 'Budget']);
  });
});
