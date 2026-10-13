import { effects as datePickerEffects } from '@labre/affine-components/date-picker';
import { effects as portalEffects } from '@labre/affine-components/portal';
import { signal } from '@preact/signals-core';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

import { coreEffects } from '../core/effect.js';
import {
  createStandaloneCell,
  type PropertyMetaConfig,
  type StandaloneCellHost,
  type StandaloneCellSource,
} from '../core/index.js';
import { propertyPresetsEffects } from '../property-presets/effect.js';
import { propertyPresets } from '../property-presets/index.js';

/**
 * A cell outside any view (`standalone-cell.ts`, ADR 0035 §11 amended
 * 2026-10-13): the title band draws and edits a page's property values with
 * the cell renderers the inline table mounts, through a `Cell` that has no
 * view, no row and no data source behind it.
 *
 * What it would have caught:
 * - a preset renderer that starts reading a member of `SingleView`, `Row` or
 *   `Property` the seam does not provide: it throws here, at mount or at
 *   edit, instead of in a host's title band;
 * - the edit lifecycle drifting from the table's: Enter on a text commits
 *   once, a checkbox toggles without entering an editor, a read-only cell
 *   opens nothing;
 * - an exit hook that closes a popup whose close asks to exit again (the
 *   date picker's abort): the value is committed once, never cleared by a
 *   second pass;
 * - a select whose host cannot write the property's config still offering to
 *   create, edit or reorder options it could never keep.
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
  document.body.innerHTML = '';
});

function source(
  value: unknown,
  over: Partial<StandaloneCellSource> = {}
): StandaloneCellSource & { valueSet: ReturnType<typeof vi.fn> } {
  const value$ = signal<unknown>(value);
  return {
    propertyId: 'p',
    name$: signal('Prop'),
    data$: signal({}),
    value$,
    readonly$: signal(false),
    valueSet: vi.fn(),
    ...over,
  } as StandaloneCellSource & { valueSet: ReturnType<typeof vi.fn> };
}

async function mount(
  meta: PropertyMetaConfig,
  src: StandaloneCellSource,
  readonly = false
) {
  const host = document.createElement('dv-standalone-cell');
  host.cell = createStandaloneCell(meta, src);
  host.readonly = readonly;
  host.placeholder = 'Not set';
  document.body.append(host);
  await host.updateComplete;
  return host as StandaloneCellHost;
}

const meta = (config: { type: string }) => config as PropertyMetaConfig;

describe('a standalone cell', () => {
  it('mounts every preset the band draws, with no view behind it', async () => {
    const cases: [PropertyMetaConfig, unknown, Record<string, unknown>][] = [
      [meta(propertyPresets.checkboxPropertyConfig), true, {}],
      [meta(propertyPresets.datePropertyConfig), Date.UTC(2026, 9, 13), {}],
      [
        meta(propertyPresets.multiSelectPropertyConfig),
        ['a'],
        { options: [{ id: 'a', value: 'Alpha', color: 'red' }] },
      ],
      [meta(propertyPresets.numberPropertyConfig), 12, { format: 'number' }],
      [meta(propertyPresets.progressPropertyConfig), 40, {}],
      [
        meta(propertyPresets.selectPropertyConfig),
        'a',
        { options: [{ id: 'a', value: 'Alpha', color: 'red' }] },
      ],
      [meta(propertyPresets.textPropertyConfig), 'Ada', {}],
    ];
    for (const [config, value, data] of cases) {
      const host = await mount(config, source(value, { data$: signal(data) }));
      const cell = host.querySelector(`affine-database-${config.type}-cell`);
      expect(cell, config.type).not.toBeNull();
      expect(cell?.getAttribute('data-testid'), config.type).toBe(config.type);
    }
    expect(document.body.textContent).toContain('Alpha');
    expect(document.body.textContent).toContain('Ada');
    expect(document.body.textContent).toContain('2026/10/13');
  });

  it('draws the placeholder while empty and no editor is open', async () => {
    const host = await mount(
      meta(propertyPresets.textPropertyConfig),
      source(undefined)
    );
    expect(host.textContent).toContain('Not set');
    host.edit();
    await host.updateComplete;
    expect(host.textContent).not.toContain('Not set');
  });

  it('commits a text once, on Enter, and leaves the editor', async () => {
    const src = source('Ada');
    const host = await mount(meta(propertyPresets.textPropertyConfig), src);
    host.edit();
    await host.updateComplete;
    await frame();
    const input = host.querySelector('input');
    expect(input).not.toBeNull();
    input!.value = 'Grace';
    input!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
    await new Promise(resolve => setTimeout(resolve, 0));
    await frame();
    await frame();
    expect(host.isEditing$.value).toBe(false);
    expect(src.valueSet).toHaveBeenCalledWith('Grace');
    expect(new Set(src.valueSet.mock.calls.map(call => call[0]))).toEqual(
      new Set(['Grace'])
    );
  });

  it('toggles a checkbox without opening an editor', async () => {
    const src = source(false);
    const host = await mount(meta(propertyPresets.checkboxPropertyConfig), src);
    host.click();
    expect(src.valueSet).toHaveBeenCalledWith(true);
    expect(host.isEditing$.value).toBe(false);
  });

  it('opens nothing on a read-only cell', async () => {
    const src = source(false);
    const host = await mount(
      meta(propertyPresets.checkboxPropertyConfig),
      src,
      true
    );
    host.click();
    host.edit();
    expect(src.valueSet).not.toHaveBeenCalled();
    expect(host.hasAttribute('tabindex')).toBe(false);
  });

  it('commits the picked date once when the picker closes itself', async () => {
    const src = source(undefined);
    const host = await mount(meta(propertyPresets.datePropertyConfig), src);
    host.edit();
    await frame();
    const cell = host.querySelector('affine-database-date-cell') as unknown as {
      tempValue$: { value: Date | undefined };
    };
    const picked = new Date(Date.UTC(2026, 9, 13));
    cell.tempValue$.value = picked;
    // The click away aborts the picker, whose abort asks to leave again.
    host.exit();
    await frame();
    await frame();
    expect(host.isEditing$.value).toBe(false);
    expect(src.valueSet.mock.calls).toEqual([[picked.getTime()]]);
  });

  it('offers fixed options when the host cannot write the config', async () => {
    const options = [
      { id: 'a', value: 'Alpha', color: 'red' },
      { id: 'b', value: 'Beta', color: 'blue' },
    ];
    const fixed = await mount(
      meta(propertyPresets.selectPropertyConfig),
      source('a', { data$: signal({ options }) })
    );
    fixed.edit();
    await frame();
    const menu = document.querySelector('affine-multi-tag-select');
    expect(menu).not.toBeNull();
    expect(menu!.onOptionsChange).toBeUndefined();
    expect(menu!.querySelector('[data-testid="option-more"]')).toBeNull();
    fixed.exit();

    const dataSet = vi.fn();
    const editable = await mount(
      meta(propertyPresets.selectPropertyConfig),
      source('a', { data$: signal({ options }), dataSet })
    );
    editable.edit();
    await frame();
    const menus = document.querySelectorAll('affine-multi-tag-select');
    const open = menus[menus.length - 1]!;
    expect(open.onOptionsChange).toBeTypeOf('function');
    expect(open.querySelector('[data-testid="option-more"]')).not.toBeNull();
  });
});
