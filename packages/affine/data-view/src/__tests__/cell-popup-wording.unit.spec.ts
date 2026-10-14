import { effects as datePickerEffects } from '@labre/affine-components/date-picker';
import { effects as portalEffects } from '@labre/affine-components/portal';
import {
  type ChromeWording,
  TranslationProvider,
} from '@labre/affine-shared/services';
import { type BlockStdScope, stdContext } from '@labre/std';
import { ContextProvider } from '@lit/context';
import { signal } from '@preact/signals-core';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

import { selectOptionColors } from '../core/component/tags/colors.js';
import { coreEffects } from '../core/effect.js';
import {
  createStandaloneCell,
  type PropertyMetaConfig,
  type StandaloneCellHost,
  type StandaloneCellSource,
} from '../core/index.js';
import { propertyPresetsEffects } from '../property-presets/effect.js';
import { propertyPresets } from '../property-presets/index.js';
import {
  TAG_SELECT_CREATE,
  TAG_SELECT_PLACEHOLDER,
  TAG_SELECT_TIP,
} from '../translations.js';

/**
 * The popups a cell opens, the tag menu and the date picker, speak the host's
 * catalogue (issue "textes anglais en dur dans data-view", ADR 0023). They
 * render outside the editor, so the cell resolves their words while it is in
 * the editor's DOM and hands them over.
 *
 * What it would have caught:
 * - a menu or picker wording written as an English literal again, which a
 *   French host showed untranslated in its chips band and its bases;
 * - the picker's day and month names read from a fixed English table instead
 *   of `Intl` in the host's locale;
 * - a colour entry without its wording, or a cell outside any editor that
 *   stops reading English.
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

const french: Record<string, string> = {
  [TAG_SELECT_TIP[0]]: 'Choisissez une étiquette ou créez-en une',
  [TAG_SELECT_PLACEHOLDER[0]]: 'Saisissez ici…',
  [TAG_SELECT_CREATE[0]]: 'Créer',
  'com.labre.date-picker.today': "Aujourd'hui",
  'com.labre.date-picker.clear': 'Effacer',
};

const frenchStd = {
  getOptional: (id: unknown) =>
    id === TranslationProvider
      ? { t: (key: string) => french[key], language: 'fr' }
      : null,
} as unknown as BlockStdScope;

function source(
  value: unknown,
  over: Partial<StandaloneCellSource> = {}
): StandaloneCellSource {
  return {
    propertyId: 'p',
    name$: signal('Prop'),
    data$: signal({}),
    value$: signal<unknown>(value),
    readonly$: signal(false),
    valueSet: vi.fn(),
    ...over,
  } as StandaloneCellSource;
}

/** A cell mounted inside an element that provides `std`, as an editor does. */
async function mount(
  meta: PropertyMetaConfig,
  src: StandaloneCellSource,
  std?: BlockStdScope
) {
  const editor = document.createElement('div');
  if (std) {
    new ContextProvider(editor, {
      context: stdContext,
      initialValue: std,
    }).hostConnected();
  }
  document.body.append(editor);
  const host = document.createElement('dv-standalone-cell');
  host.cell = createStandaloneCell(meta, src);
  editor.append(host);
  await host.updateComplete;
  return host as StandaloneCellHost;
}

const meta = (config: { type: string }) => config as PropertyMetaConfig;

/** A popup portal renders into a shadow root of its own, under the body. */
type Found = HTMLElement & { updateComplete?: Promise<void> };
function findDeep(selector: string, root: ParentNode = document): Found | null {
  const found = root.querySelector(selector);
  if (found) return found as Found;
  for (const element of root.querySelectorAll('*')) {
    const inner: ParentNode | null = element.shadowRoot;
    const hit: (HTMLElement & { updateComplete?: Promise<void> }) | null = inner
      ? findDeep(selector, inner)
      : null;
    if (hit) return hit;
  }
  return null;
}
const options = [{ id: 'a', value: 'Alpha', color: 'red' }];

describe('the popups of a cell', () => {
  it('the tag menu speaks the catalogue of the editor it opens from', async () => {
    const host = await mount(
      meta(propertyPresets.selectPropertyConfig),
      source('a', { data$: signal({ options }), dataSet: vi.fn() }),
      frenchStd
    );
    host.edit();
    await frame();
    const menu = document.querySelector('affine-multi-tag-select');
    expect(menu?.textContent).toContain(french[TAG_SELECT_TIP[0]]);
    expect(menu?.querySelector('input')?.placeholder).toBe(
      french[TAG_SELECT_PLACEHOLDER[0]]
    );
  });

  it('the tag menu reads English outside an editor', async () => {
    const host = await mount(
      meta(propertyPresets.selectPropertyConfig),
      source('a', { data$: signal({ options }), dataSet: vi.fn() })
    );
    host.edit();
    await frame();
    const menu = document.querySelector('affine-multi-tag-select');
    expect(menu?.textContent).toContain('Select tag or create one');
    expect(menu?.querySelector('input')?.placeholder).toBe('Type here...');
  });

  it('every option colour has a wording whose fallback is its name', () => {
    for (const color of selectOptionColors) {
      const wording = color.wording as ChromeWording;
      expect(wording[0]).toMatch(/^com\.labre\./);
      expect(wording[1]).toBe(color.name);
    }
  });

  it('the date picker speaks the catalogue and the locale of the editor', async () => {
    const host = await mount(
      meta(propertyPresets.datePropertyConfig),
      source(Date.UTC(2026, 9, 13)),
      frenchStd
    );
    host.edit();
    await frame();
    const picker = findDeep('date-picker');
    expect(picker).not.toBeNull();
    await picker?.updateComplete;
    const root = picker?.shadowRoot ?? picker;
    const text = root?.textContent ?? '';
    expect(text).toContain("Aujourd'hui");
    expect(text).not.toContain('TODAY');
    const days = [
      ...(root?.querySelectorAll('.days-header .date-cell') ?? []),
    ].map(cell => cell.textContent?.trim());
    expect(days).toEqual(['Di', 'Lu', 'Ma', 'Me', 'Je', 'Ve', 'Sa']);
  });
});
