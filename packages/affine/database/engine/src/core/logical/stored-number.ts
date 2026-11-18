import zod from 'zod';

/**
 * A number as stored (a cell, a filter argument), read back. zod 3's `number()` accepted `Infinity`
 * and `-Infinity`; zod 4's refuses them (ADR 0052). A cell can hold one (a
 * number column parses "1e999" to `Infinity`), and a refused stored value
 * reads as the column's default, so under a bare zod 4 `number()` such a cell
 * would have shown empty. `NaN` stays refused, as it was.
 */
export const storedNumber = () =>
  zod.union([zod.number(), zod.literal([Infinity, -Infinity])]);
