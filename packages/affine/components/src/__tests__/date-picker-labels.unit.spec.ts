import { describe, expect, it } from 'vitest';

import { monthLabels, weekdayLabels } from '../date-picker/date-picker.js';

/**
 * The date picker's day and month names come from `Intl` in the caller's
 * locale (issue "textes anglais en dur dans data-view"; CLAUDE.md i18n:
 * dates use `Intl`, never keys).
 *
 * What it would have caught:
 * - the default (`en-US`) reading differently from the fixed English tables
 *   it replaced (`Su Mo Tu…`, `Jan Feb…`), a visible change for every host
 *   that never sets a locale;
 * - a French host seeing English names, or a week that no longer starts on
 *   Sunday, which the month grid (`getMonthMatrix`) assumes.
 */

describe('the date picker names', () => {
  it('read as the English tables they replaced by default', () => {
    expect(weekdayLabels('en-US')).toEqual([
      'Su',
      'Mo',
      'Tu',
      'We',
      'Th',
      'Fr',
      'Sa',
    ]);
    expect(monthLabels('en-US')).toEqual([
      'Jan',
      'Feb',
      'Mar',
      'Apr',
      'May',
      'Jun',
      'Jul',
      'Aug',
      'Sep',
      'Oct',
      'Nov',
      'Dec',
    ]);
  });

  it('follow the locale, Sunday first', () => {
    expect(weekdayLabels('fr')).toEqual([
      'Di',
      'Lu',
      'Ma',
      'Me',
      'Je',
      'Ve',
      'Sa',
    ]);
    expect(monthLabels('fr')[0]).toBe('janv.');
  });
});
