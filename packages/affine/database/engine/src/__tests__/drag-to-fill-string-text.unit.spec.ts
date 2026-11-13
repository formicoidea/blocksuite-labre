/**
 * Drag-to-fill copies a rich-text cell stored as a plain string, and fills
 * over one (`fillSelectionWithFocusCellData`, the table and the virtual
 * table alike).
 *
 * A rich-text cell may be stored as a plain string (an older document, a
 * snapshot or an import writing plain text); the data sources read it as
 * stored since #656's follow-up (`storedShapeIsReadable`), where they used
 * to read it as `undefined`. The fill took every rich-text value for a
 * `Text`: a string source threw on `toDelta` and filled nothing, a string
 * target threw on `clear` and stopped the fill halfway, the rows after it
 * left as they were.
 *
 * What it would have caught: either `TypeError`, or a fill that drops the
 * source's text.
 */
import { Text } from '@labre/store';
import { describe, expect, test } from 'vitest';
import * as Y from 'yjs';

import { t } from '../core/index.js';
import { fillSelectionWithFocusCellData as fillTable } from '../view-presets/table/pc/controller/drag-to-fill.js';
import { fillSelectionWithFocusCellData as fillVirtual } from '../view-presets/table/pc-virtual/controller/drag-to-fill.js';

type Slot = { value: unknown };

// A stored rich-text cell is a `Text` over a Y.Text that lives in a
// document; a detached one refuses to be read or written.
const storedDoc = new Y.Doc();
let stored = 0;
const storedText = (content: string) => {
  const yText = new Y.Text();
  storedDoc.getMap('cells').set(`${stored++}`, yText);
  yText.insert(0, content);
  return new Text(yText);
};

// Rows 0..n-1 of one rich-text column, the focus on row 0; each slot holds
// what the cell stores and receives what `valueSet` writes.
function fillOver(
  fill: typeof fillTable | typeof fillVirtual,
  values: unknown[]
) {
  const slots: Slot[] = values.map(value => ({ value }));
  // A new Y.Text reads its content once it lives in a document, as a
  // written cell does.
  const doc = new Y.Doc();
  const column = { dataType$: { value: t.richText.instance() } };
  const logic = {
    selectionController: {
      getCellContainer: (_group: string, row: number) => ({
        column,
        column$: { value: column },
        cell$: {
          value: {
            value$: {
              get value() {
                return slots[row]?.value;
              },
            },
            valueSet: (value: unknown) => {
              if (value instanceof Y.Text)
                doc.getMap('cells').set(`${row}`, value);
              slots[row] = { value };
            },
          },
        },
      }),
    },
  };
  fill(
    logic as never,
    {
      groupKey: 'group',
      rowsSelection: { start: 0, end: slots.length - 1 },
      columnsSelection: { start: 0, end: 0 },
      focus: { rowIndex: 0, columnIndex: 0 },
    } as never
  );
  return slots.map(slot => slot.value?.toString());
}

describe.each([
  ['the table', fillTable],
  ['the virtual table', fillVirtual],
])('drag-to-fill in %s', (_name, fill) => {
  test('copies a rich-text source stored as a string', () => {
    expect(fillOver(fill, ['note', undefined, storedText('old')])).toEqual([
      'note',
      'note',
      'note',
    ]);
  });

  test('fills over a rich-text target stored as a string, and the rows after it', () => {
    expect(
      fillOver(fill, [
        storedText('note'),
        'old',
        undefined,
        storedText('older'),
      ])
    ).toEqual(['note', 'note', 'note', 'note']);
  });
});
