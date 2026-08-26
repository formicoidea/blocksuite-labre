import { describe, expect, it } from 'vitest';

import { RecordField } from '../core/detail/field.js';

/**
 * The number cell is rendered by the `affine-database-number-cell` custom
 * element, whose inner node carries the `number` class. The detail panel
 * left-aligns that node with a dedicated rule; the selector of that rule has to
 * match the markup the cell actually produces.
 */
const numberCellMarkup = `
  <div class="field-content">
    <affine-database-number-cell>
      <div class="css-generated-hash number">42</div>
    </affine-database-number-cell>
  </div>
`;

const alignmentSelector = () => {
  const cssText = (
    RecordField.styles as unknown as { cssText: string }
  ).cssText.replace(/\s+/g, ' ');
  // The rule that overrides the right-aligned default of a number cell.
  const match = cssText.match(/([^{}]+)\{ text-align: left;[^{}]*\}/);
  const selector = match?.[1];
  expect(selector, 'the detail panel keeps a number alignment rule').toBeTruthy();
  return selector!.trim();
};

describe('detail panel number alignment', () => {
  it('targets the node the number cell actually renders', () => {
    const host = document.createElement('div');
    host.innerHTML = numberCellMarkup;

    const selector = alignmentSelector();
    const target = host.querySelector(selector);

    expect(target).not.toBeNull();
    expect(target?.classList.contains('number')).toBe(true);
  });

  it('aligns to the start of the line box', () => {
    const cssText = (
      RecordField.styles as unknown as { cssText: string }
    ).cssText.replace(/\s+/g, ' ');

    expect(cssText).toContain('justify-content: flex-start');
  });
});
