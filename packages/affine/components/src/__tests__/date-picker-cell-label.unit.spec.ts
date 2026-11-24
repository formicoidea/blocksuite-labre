/**
 * A day cell of the date picker names its date to assistive technologies
 * (`aria-label`: the full date in words, in the picker's `locale`) and to
 * selectors (`data-date`: the ISO date `YYYY-MM-DD`) (GitHub issue #736;
 * upstream toeverything/AFFiNE#15870).
 *
 * What it would have caught: both were `YYYY-M-D(weekday)` built from
 * `Date#getMonth()`, which is 0-based, so a screen reader announced
 * 24 November 2026 as "2026-10-24(2)".
 */
import { afterEach, describe, expect, it } from 'vitest';

import { DatePicker } from '../date-picker/date-picker.js';

/** Local midnight, 24 November 2026, a Tuesday. */
const NOVEMBER_24_2026 = new Date('2026-11-24T00:00:00');

/** Local midnight, 5 March 2026: a one-digit month and day. */
const MARCH_5_2026 = new Date('2026-03-05T00:00:00');

if (!customElements.get('date-picker')) {
  customElements.define('date-picker', DatePicker);
}

describe('a date picker day cell', () => {
  let picker: DatePicker | undefined;

  afterEach(() => {
    picker?.remove();
    picker = undefined;
  });

  /** The selected day cell of a picker showing `date` in `locale`. */
  async function selectedCell(date: Date, locale?: string) {
    picker = document.createElement('date-picker') as DatePicker;
    picker.value = date.getTime();
    if (locale) picker.locale = locale;
    document.body.append(picker);
    await picker.updateComplete;
    const cell = picker.shadowRoot?.querySelector<HTMLButtonElement>(
      'button.date-cell--selected'
    );
    expect(cell, 'the selected day is drawn').toBeTruthy();
    return cell!;
  }

  it('reads its date in words, month included, in English by default', async () => {
    const cell = await selectedCell(NOVEMBER_24_2026);
    expect(cell.textContent?.trim()).toBe('24');
    expect(cell.getAttribute('aria-label')).toBe('Tuesday, November 24, 2026');
  });

  it("reads its date in the picker's locale", async () => {
    const cell = await selectedCell(NOVEMBER_24_2026, 'fr-FR');
    expect(cell.getAttribute('aria-label')).toBe('mardi 24 novembre 2026');
  });

  it('carries a zero-padded ISO date for selectors', async () => {
    expect((await selectedCell(NOVEMBER_24_2026)).dataset.date).toBe(
      '2026-11-24'
    );
    picker?.remove();
    expect((await selectedCell(MARCH_5_2026)).dataset.date).toBe('2026-03-05');
  });
});
