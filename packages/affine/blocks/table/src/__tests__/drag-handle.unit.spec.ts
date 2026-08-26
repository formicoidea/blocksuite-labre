import { describe, expect, it } from 'vitest';

import { isTableDragHandle } from '../utils.js';

function buildCell(handleAttribute?: string) {
  const cell = document.createElement('td');
  const inner = document.createElement('div');
  if (handleAttribute) {
    inner.setAttribute(handleAttribute, 'col-1');
  }
  const leaf = document.createElement('span');
  inner.append(leaf);
  cell.append(inner);
  return { cell, inner, leaf };
}

describe('isTableDragHandle', () => {
  it('recognises the column width grip', () => {
    const { inner } = buildCell('data-width-adjust-column-id');
    expect(isTableDragHandle(inner)).toBe(true);
  });

  it('recognises the column and row drag handles', () => {
    expect(isTableDragHandle(buildCell('data-drag-column-id').inner)).toBe(
      true
    );
    expect(isTableDragHandle(buildCell('data-drag-row-id').inner)).toBe(true);
  });

  it('recognises a descendant of a handle, which is what the event targets', () => {
    const { leaf } = buildCell('data-width-adjust-column-id');
    expect(isTableDragHandle(leaf)).toBe(true);
  });

  it('ignores the rest of the cell', () => {
    const { leaf } = buildCell();
    expect(isTableDragHandle(leaf)).toBe(false);
  });

  it('ignores a missing or non-element target', () => {
    expect(isTableDragHandle(null)).toBe(false);
    expect(isTableDragHandle(document)).toBe(false);
  });
});
