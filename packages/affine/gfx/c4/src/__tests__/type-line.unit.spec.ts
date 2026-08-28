import type { C4NodeKind } from '@labre/affine-model';
import { describe, expect, it } from 'vitest';

import { NODE_SIZE } from '../consts';
import { c4EditingTransition } from '../node/type-line-watcher';
import {
  C4_TYPE_PLACEHOLDER,
  C4_TYPE_TAKES_TECHNOLOGY,
  C4_TYPE_WORD,
  c4MorphedTypeLine,
  c4TypeLine,
  normalizeC4TypeLine,
  technologyOfTypeLine,
  TYPE_TECHNOLOGY_PLACEHOLDER,
} from '../type-line';

/**
 * The type line, in both directions.
 *
 * It is the one tier of a C4 component that is SEMI-derived: the bracketed word
 * belongs to the notation and comes from the element's kind, the technology
 * belongs to the author. Since the PO's recette of 28/08/2026 that author types
 * it in place, on the canvas, into a text element with no grammar and no
 * validation between the keyboard and the document — so what this file is really
 * about is that the reading is TOTAL over whatever they leave behind.
 */

const ALL_KINDS = Object.keys(NODE_SIZE) as C4NodeKind[];

describe('the technology an author stated', () => {
  it('reads the canonical line', () => {
    expect(technologyOfTypeLine('[Container: Java]')).toBe('Java');
    expect(technologyOfTypeLine('[Component: Spring MVC]')).toBe('Spring MVC');
    expect(technologyOfTypeLine('[Software System: SAP]')).toBe('SAP');
  });

  it('reads a line the in-place editor left half-typed', () => {
    // Every one of these is a state the editor can be blurred in.
    expect(technologyOfTypeLine('Container: Java')).toBe('Java');
    expect(technologyOfTypeLine('[Container: Java')).toBe('Java');
    expect(technologyOfTypeLine('Java]')).toBe('Java');
    expect(technologyOfTypeLine('  [container :  Java  ]  ')).toBe('Java');
    // The whole line selected and retyped: no word, no colon, all technology.
    expect(technologyOfTypeLine('Java')).toBe('Java');
  });

  it('reads a line stating no technology as none', () => {
    expect(technologyOfTypeLine('[Container]')).toBe('');
    expect(technologyOfTypeLine('[Container: ]')).toBe('');
    expect(technologyOfTypeLine('Person')).toBe('');
    expect(technologyOfTypeLine('  ')).toBe('');
    expect(technologyOfTypeLine('')).toBe('');
    expect(technologyOfTypeLine(undefined)).toBe('');
    expect(technologyOfTypeLine(null)).toBe('');
  });

  /**
   * The reason the prefix is matched against the VOCABULARY rather than cut at
   * the first colon, which was the obvious implementation.
   *
   * An architect pasting a link to the internal docs of the thing they are
   * describing is not an edge case, and cutting at the colon would leave them
   * with `//internal/docs` — a technology they never wrote, in a file they are
   * about to hand to somebody else.
   */
  it('never mistakes a colon inside the technology for the notation’s', () => {
    expect(technologyOfTypeLine('https://internal/docs')).toBe(
      'https://internal/docs'
    );
    expect(technologyOfTypeLine('[Container: https://internal/docs]')).toBe(
      'https://internal/docs'
    );
    expect(technologyOfTypeLine('Kafka: the streaming one')).toBe(
      'Kafka: the streaming one'
    );
  });

  it('collapses a line the author broke over two', () => {
    // A canvas text wraps, and Enter puts a real newline in it. The type line is
    // one line by construction.
    expect(technologyOfTypeLine('[Container:\n  Java and\n  Spring]')).toBe(
      'Java and Spring'
    );
  });

  it('does not read the creation placeholder as nothing', () => {
    // Deliberately NOT special-cased here: the commit hook calls this, and a
    // focus-and-blur that quietly rewrote `[Container: technology]` to
    // `[Container]` would eat the stencil's own prompt. Only the EXPORTER, which
    // asks what a component STATES, is allowed to be opinionated about it.
    expect(technologyOfTypeLine(C4_TYPE_PLACEHOLDER.container)).toBe(
      TYPE_TECHNOLOGY_PLACEHOLDER
    );
  });
});

describe('normalizing a type line on commit', () => {
  it('rebuilds the whole line from the kind and the technology', () => {
    expect(normalizeC4TypeLine('container', 'Java')).toBe('[Container: Java]');
    expect(normalizeC4TypeLine('container', '[Container: Java]')).toBe(
      '[Container: Java]'
    );
    expect(normalizeC4TypeLine('container', '')).toBe('[Container]');
  });

  it('takes the word back from an author who retyped it', () => {
    // The word is the notation's: it comes from `kind`, which is what the
    // renderer paints and what the exporter maps. Letting the two disagree is
    // exactly what this function exists to prevent.
    expect(normalizeC4TypeLine('container', '[Person: Java]')).toBe(
      '[Container: Java]'
    );
    // A database says "Container", which is the stencil's own reading: the
    // cylinder is a picture of a container, not a fourth level.
    expect(normalizeC4TypeLine('database', '[Database: PostgreSQL]')).toBe(
      '[Container: Database: PostgreSQL]'
    );
    expect(normalizeC4TypeLine('database', '[Container: PostgreSQL]')).toBe(
      '[Container: PostgreSQL]'
    );
    // An external variant announces the word of the kind it is external to.
    expect(normalizeC4TypeLine('system-ext', 'SAP')).toBe(
      '[Software System: SAP]'
    );
  });

  /**
   * Idempotence is what lets the commit hook run unconditionally: it fires on
   * every edit that ends, including the ones that changed nothing, and a
   * function that drifted on its own output would rewrite the document — and add
   * an undo entry — every time somebody clicked into a line and back out.
   */
  it('is idempotent and total over every kind', () => {
    const inputs = [
      '',
      '   ',
      'Java',
      '[Container: Java]',
      '[Person]',
      'nonsense: with a colon',
      '[[[]]]',
      TYPE_TECHNOLOGY_PLACEHOLDER,
    ];
    for (const kind of ALL_KINDS) {
      for (const input of inputs) {
        const once = normalizeC4TypeLine(kind, input);
        expect(normalizeC4TypeLine(kind, once), `${kind} / ${input}`).toBe(
          once
        );
        // Always the notation's own shape, whatever went in.
        expect(once.startsWith(`[${C4_TYPE_WORD[kind]}`), kind).toBe(true);
        expect(once.endsWith(']'), kind).toBe(true);
      }
    }
  });
});

describe('the prompt a fresh component carries', () => {
  it('gives every kind a placeholder in the notation’s own shape', () => {
    for (const kind of ALL_KINDS) {
      const placeholder = C4_TYPE_PLACEHOLDER[kind];
      expect(placeholder, kind).toBe(
        c4TypeLine(
          kind,
          C4_TYPE_TAKES_TECHNOLOGY[kind]
            ? TYPE_TECHNOLOGY_PLACEHOLDER
            : undefined
        )
      );
      // A placeholder normalizes to itself: the prompt is already canonical, so
      // clicking into a fresh line and out of it writes nothing.
      expect(normalizeC4TypeLine(kind, placeholder), kind).toBe(placeholder);
    }
  });

  it('prompts for a technology only where the notation asks for one', () => {
    // A person is not built with a technology and a software system's is a level
    // down: both read `[Person]` / `[Software System]` full stop. Every
    // container and every component asks, because at those two levels "what is
    // it built with" is the question the diagram exists to answer.
    expect(C4_TYPE_PLACEHOLDER.person).toBe('[Person]');
    expect(C4_TYPE_PLACEHOLDER['person-ext']).toBe('[Person]');
    expect(C4_TYPE_PLACEHOLDER.system).toBe('[Software System]');
    expect(C4_TYPE_PLACEHOLDER.container).toBe('[Container: technology]');
    expect(C4_TYPE_PLACEHOLDER.database).toBe('[Container: technology]');
    expect(C4_TYPE_PLACEHOLDER.mobile).toBe('[Container: technology]');
    expect(C4_TYPE_PLACEHOLDER.browser).toBe('[Container: technology]');
    expect(C4_TYPE_PLACEHOLDER.component).toBe('[Component: technology]');
  });
});

/* ── The commit seam ──────────────────────────────────────────────────── */

/**
 * The one piece of logic in the watcher, and the only part of it worth being
 * wrong about.
 *
 * A canvas text editor binds its inline editor straight onto the element's
 * `Y.Text`, so "the text changed" fires once per keystroke and normalizing on it
 * would rewrite the line under the author's cursor. "The edit committed" is
 * therefore read off the EDITING selection the editor holds while it is mounted:
 * an id that has LEFT that set is a commit, and nothing else is.
 */
describe('when an edit has committed', () => {
  const selection = (elements: string[], editing?: boolean) => ({
    elements,
    editing,
  });

  it('reports nothing while an element is still being edited', () => {
    const first = c4EditingTransition(new Set(), [selection(['t'], true)]);
    expect(first.left).toEqual([]);
    expect([...first.editing]).toEqual(['t']);

    // The editor is still mounted — a re-emitted selection is not a commit.
    const again = c4EditingTransition(first.editing, [selection(['t'], true)]);
    expect(again.left).toEqual([]);
  });

  it('reports the element the moment the editor lets go of it', () => {
    const editing = new Set(['t']);
    // Selected but no longer editing: the editor closed onto its own element.
    expect(c4EditingTransition(editing, [selection(['t'])]).left).toEqual([
      't',
    ]);
    // Clicked away onto something else…
    expect(c4EditingTransition(editing, [selection(['other'])]).left).toEqual([
      't',
    ]);
    // …or onto bare canvas, which is an empty selection list.
    expect(c4EditingTransition(editing, []).left).toEqual(['t']);
  });

  it('reports each committed element once, and never twice', () => {
    const after = c4EditingTransition(new Set(['t']), []);
    expect(after.left).toEqual(['t']);
    // The state moves on with it, so the next empty selection says nothing.
    expect(c4EditingTransition(after.editing, []).left).toEqual([]);
  });

  it('follows an author moving straight from one tier into the next', () => {
    // Double-clicking the description while the type line is open: one commit,
    // one new edit, in a single selection update.
    const moved = c4EditingTransition(new Set(['t-type']), [
      selection(['t-descr'], true),
    ]);
    expect(moved.left).toEqual(['t-type']);
    expect([...moved.editing]).toEqual(['t-descr']);
  });
});

/**
 * The line when the SHAPE becomes something else.
 *
 * Half the caption is derived from `kind`, so a morph that rewrote the kind and
 * left the words alone would draw a picture contradicting itself. The other
 * half is the author's, and the whole difficulty is telling the two apart on a
 * text element somebody may have typed anything into.
 */
describe('c4MorphedTypeLine — the caption follows the shape', () => {
  it('carries an untouched prompt across to the target own prompt', () => {
    // Not "the source prompt with the word swapped": a person is not built
    // with a technology, so the prompt it lands on has no slot for one.
    expect(
      c4MorphedTypeLine('container', 'person', C4_TYPE_PLACEHOLDER.container)
    ).toBe('[Person]');
    expect(
      c4MorphedTypeLine('person', 'container', C4_TYPE_PLACEHOLDER.person)
    ).toBe('[Container: technology]');
    // …and the placeholder never survives as a literal technology, which is
    // what folding this branch into the one below would have produced.
    expect(
      c4MorphedTypeLine('container', 'person', C4_TYPE_PLACEHOLDER.container)
    ).not.toContain(TYPE_TECHNOLOGY_PLACEHOLDER);
  });

  it('re-derives a canonical line, technology and all', () => {
    // `[Container: React]` is what the commit hook leaves behind after every
    // edit, so it is the shape a stated technology is actually stored in.
    expect(
      c4MorphedTypeLine('container', 'component', '[Container: React]')
    ).toBe('[Component: React]');
    expect(c4MorphedTypeLine('container', 'person', '[Container: React]')).toBe(
      '[Person: React]'
    );
    // A canonical line with NO technology stays one.
    expect(c4MorphedTypeLine('container', 'person', '[Container]')).toBe(
      '[Person]'
    );
  });

  it('leaves a line the author wrote exactly as they wrote it', () => {
    // Anything that is not the source kind own derivation is theirs: prose, a
    // line mid-edit, a bare technology typed over the whole box, a URL.
    for (const raw of [
      'see ADR 0042',
      '[Container: Ja',
      'React',
      'https://internal/docs',
      '',
      '   ',
    ]) {
      expect(c4MorphedTypeLine('container', 'database', raw)).toBeNull();
    }
    // …and a caption derived for a DIFFERENT kind than the one the shape is
    // leaving is not this morph business either.
    expect(
      c4MorphedTypeLine('person', 'system', '[Container: Java]')
    ).toBeNull();
  });

  it('changes nothing inside any family the pack actually declares', () => {
    // Every declared family shares one type word and one answer to "does this
    // level state a technology", so the rewrite is inert today — it is
    // insurance for a family that grows, not a behaviour anybody will see.
    for (const [from, to] of [
      ['person', 'person-ext'],
      ['system', 'system-ext'],
      ['container', 'database'],
      ['container', 'mobile'],
      ['database', 'browser'],
    ] as [C4NodeKind, C4NodeKind][]) {
      expect(c4MorphedTypeLine(from, to, C4_TYPE_PLACEHOLDER[from])).toBe(
        C4_TYPE_PLACEHOLDER[from]
      );
      expect(c4MorphedTypeLine(from, to, c4TypeLine(from, 'Java'))).toBe(
        c4TypeLine(from, 'Java')
      );
      // Padded, as a stored tier can be. The answer is the TRIMMED line, which
      // is what the caller compares against before deciding to write — read it
      // against the untrimmed original instead and every inert morph would
      // spend a transaction rewriting the padding away.
      expect(
        c4MorphedTypeLine(from, to, `  ${C4_TYPE_PLACEHOLDER[from]}  `)
      ).toBe(C4_TYPE_PLACEHOLDER[from]);
    }
  });
});
