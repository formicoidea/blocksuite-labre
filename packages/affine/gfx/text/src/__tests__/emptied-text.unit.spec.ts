import { describe, expect, test } from 'vitest';

import { emptiedTextIsDeleted } from '../edgeless-text-editor.js';

/**
 * What the canvas text editor does with a text committed EMPTY.
 *
 * Asked of the pure rule rather than of the editor, because the editor's copy
 * of it lives inside a `disconnectedCallback` disposable: reaching it means
 * mounting a Lit element on a live surface, and what is actually in question is
 * one predicate over three properties of an element.
 *
 * The recette of 2026-09-15 is why the predicate takes two of them and not one.
 * Tranche J's first answer was `role !== undefined`, which saved a UML
 * compartment and broke every roled LABEL beside it — a Wardley component's
 * name, a BPMN task's — by leaving an invisible box on the board where the
 * author had just deleted the words.
 */

/** The three properties the rule reads, and nothing else. */
const text = (
  words: string,
  extra: { role?: string; hasMaxWidth?: boolean } = {}
) => ({ text: { length: words.length }, ...extra });

describe('a canvas text committed empty', () => {
  test('a free text is deleted — the rule that was always there', () => {
    expect(emptiedTextIsDeleted(text(''))).toBe(true);
  });

  test('a text with words is never deleted', () => {
    expect(emptiedTextIsDeleted(text('Payments'))).toBe(false);
    expect(
      emptiedTextIsDeleted(
        text('Payments', { hasMaxWidth: true, role: 'uml:name' })
      )
    ).toBe(false);
  });

  test('a COMPARTMENT TIER survives it', () => {
    // A role AND a fixed width: a `uml:name`, a `c4:type`, a lane's title. The
    // tier stays at its compartment's box, drawing its framework's placeholder
    // and answering the next double-click.
    expect(
      emptiedTextIsDeleted(text('', { hasMaxWidth: true, role: 'uml:name' }))
    ).toBe(false);
    expect(
      emptiedTextIsDeleted(
        text('', { hasMaxWidth: true, role: 'uml:attributes' })
      )
    ).toBe(false);
  });

  test('a roled LABEL with no fixed width is still deleted', () => {
    // `wardley:label`, a BPMN name: roled, but sized to its own words and
    // floating beside its artefact rather than filling a compartment. Emptied,
    // it is exactly the invisible selectable box the deletion rule removes.
    expect(emptiedTextIsDeleted(text('', { role: 'wardley:label' }))).toBe(
      true
    );
    expect(
      emptiedTextIsDeleted(text('', { hasMaxWidth: false, role: 'bpmn:name' }))
    ).toBe(true);
  });

  test('a fixed width with no role is still deleted', () => {
    // Nothing owns it, so there is no composite to leave a hole in.
    expect(emptiedTextIsDeleted(text('', { hasMaxWidth: true }))).toBe(true);
  });
});
