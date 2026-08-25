import { describe, expect, it } from 'vitest';

import { printToPdfStyles } from '../../utils/print-to-pdf.js';

describe('printToPdfStyles', () => {
  it('only applies to the print medium', () => {
    expect(printToPdfStyles.trimStart().startsWith('@media print')).toBe(true);
  });

  it('forces a light colour scheme so nothing prints white on white', () => {
    expect(printToPdfStyles).toContain('color-scheme: light !important');
    expect(printToPdfStyles).toContain('--affine-text-primary: #000 !important');
    expect(printToPdfStyles).toContain(
      '--affine-background-primary: #fff !important'
    );
    // dark theme text is repainted, including text painted through a fill colour
    expect(printToPdfStyles).toContain("[data-theme='dark']");
    expect(printToPdfStyles).toContain(
      '-webkit-text-fill-color: #000 !important'
    );
  });
});
