import {
  FontFamily,
  FontFamilyList,
  FontStyle,
  FontWeight,
} from '@labre/affine-model';
import {
  CommunityCanvasTextFonts,
  type FontConfig,
  FontConfigIdentifier,
} from '@labre/affine-shared/services';
import type { BlockStdScope } from '@labre/std';
import { render } from 'lit';
import { describe, expect, test, vi } from 'vitest';

import { EdgelessFontFamilyPanel } from '../panel/font-family-panel.js';

/**
 * #396: the canvas font-family picker listed every `FontFamily` whatever
 * `FontConfig` the host registered, so a host that dropped a family (Satoshi,
 * whose licence forbids offering it as a selectable font in a SaaS) still
 * offered it, and picking it silently painted the fallback. This spec would
 * have caught that: with a reduced config the dropped family must not be a
 * row.
 *
 * It also pins the two degraded paths the fix chose:
 * - a stored element whose family the host no longer configures keeps its
 *   name in the picker, greyed and marked unavailable, and nothing is written
 *   (the panel reports no pick, on render or on a click);
 * - no `FontConfig` at all (seam absent) keeps the full list, as before.
 *
 * The panel reads the config through `std.getOptional`, so a one-method stub
 * is enough: no editor, no network, no `document.fonts`.
 */

if (!customElements.get('edgeless-font-family-panel')) {
  customElements.define('edgeless-font-family-panel', EdgelessFontFamilyPanel);
}

const face = (font: FontFamily, weight = FontWeight.Regular): FontConfig => ({
  font,
  weight,
  style: FontStyle.Normal,
  url: `https://fonts.example/${font}-${weight}.woff2`,
});

/** A host that ships Inter and Kalam only. */
const REDUCED: FontConfig[] = [
  face(FontFamily.Inter),
  face(FontFamily.Inter, FontWeight.SemiBold),
  face(FontFamily.Kalam),
];

const stdWith = (config: FontConfig[] | undefined) =>
  ({
    getOptional: (id: unknown) =>
      id === FontConfigIdentifier ? config : undefined,
  }) as unknown as BlockStdScope;

type Row = HTMLElement & { disabled: boolean; active: boolean };

function mount(options: {
  std?: BlockStdScope;
  value?: FontFamily;
  onSelect?: (value: FontFamily) => void;
}) {
  const panel = document.createElement(
    'edgeless-font-family-panel'
  ) as EdgelessFontFamilyPanel;
  panel.std = options.std;
  if (options.value) panel.value = options.value;
  panel.onSelect = options.onSelect;

  const container = document.createElement('div');
  render(panel.render(), container);

  const rows = [...container.querySelectorAll<Row>('[data-font]')];
  return {
    rows,
    fonts: rows.map(row => row.dataset.font),
    row: (font: string) => rows.find(row => row.dataset.font === font),
    label: (row: Row | undefined) =>
      (row?.textContent ?? '').replace(/\s+/g, ' ').trim(),
  };
}

const ALL_NAMES = FontFamilyList.map(([, name]) => name);

describe('edgeless font family panel (#396)', () => {
  test('lists only the families the host configured, in the list order', () => {
    const { fonts } = mount({ std: stdWith(REDUCED) });

    expect(fonts).toEqual(['Inter', 'Kalam']);
    expect(fonts).not.toContain('Satoshi');
  });

  test('keeps a stored family the host dropped, greyed and marked unavailable, and writes nothing', () => {
    const onSelect = vi.fn();
    const { fonts, row, label } = mount({
      std: stdWith(REDUCED),
      value: FontFamily.Satoshi,
      onSelect,
    });

    // Its place in the list order, between the configured ones.
    expect(fonts).toEqual(['Inter', 'Kalam', 'Satoshi']);
    const satoshi = row('Satoshi');
    expect(satoshi?.disabled).toBe(true);
    expect(label(satoshi)).toBe('Satoshi (unavailable)');

    // Neither drawing the panel nor clicking the greyed row picks anything:
    // the stored family is never rewritten from here.
    satoshi?.click();
    expect(onSelect).not.toHaveBeenCalled();

    // A configured family still picks normally.
    row('Kalam')?.click();
    expect(onSelect).toHaveBeenCalledWith(FontFamily.Kalam);
  });

  test('a configured current family is active and not marked', () => {
    const { row, label } = mount({
      std: stdWith(REDUCED),
      value: FontFamily.Kalam,
    });

    expect(row('Kalam')?.active).toBe(true);
    expect(row('Kalam')?.disabled).toBe(false);
    expect(label(row('Kalam'))).toBe('Kalam');
  });

  test('with no FontConfig registered (seam absent), every family is listed', () => {
    expect(mount({ std: stdWith(undefined) }).fonts).toEqual(ALL_NAMES);
    expect(mount({ std: stdWith([]) }).fonts).toEqual(ALL_NAMES);
    expect(mount({}).fonts).toEqual(ALL_NAMES);
  });

  test('the default community list offers Plus Jakarta Sans and no Satoshi', () => {
    const { fonts } = mount({ std: stdWith(CommunityCanvasTextFonts) });

    expect(fonts).toContain('Plus Jakarta Sans');
    expect(fonts).not.toContain('Satoshi');
  });
});
