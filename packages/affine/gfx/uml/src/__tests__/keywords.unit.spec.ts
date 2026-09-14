import type { UmlNodeKind } from '@labre/affine-model';
import { describe, expect, it } from 'vitest';

import {
  GUILLEMET_CLOSE,
  GUILLEMET_OPEN,
  UML_ATTRIBUTES_SEED,
  UML_KEYWORD_PLACEMENT,
  UML_NAME_SEED,
  UML_OPERATIONS_SEED,
  UML_SLOTS_SEED,
  guillemets,
  stereotypesOf,
} from '../keywords';
import { parseOperation, parseProperty } from '../grammar';

/**
 * Keywords, the seeds, and reading a name compartment back.
 *
 * The seeds are pinned because C2's creation sites write them and the exporters
 * read them: they are the one string in this pack that two agents' files have to
 * agree about, and a silent change to one of them is a class that stops being an
 * interface.
 */

describe('writing a keyword', () => {
  it('uses the real guillemets, not doubled angle brackets', () => {
    // Annex C's note: `<<` and `>>` are a fallback for character sets that lack
    // `«»`, not a spelling.
    expect(guillemets('interface')).toBe('«interface»');
    expect(guillemets('x')).toBe(`${GUILLEMET_OPEN}x${GUILLEMET_CLOSE}`);
  });
});

describe('the Annex C subset', () => {
  it('places the three box-header keywords in the name compartment', () => {
    // These are what make one rectangle mean three different metaclasses.
    expect(UML_KEYWORD_PLACEMENT.interface).toBe('box header');
    expect(UML_KEYWORD_PLACEMENT.enumeration).toBe('box header');
    expect(UML_KEYWORD_PLACEMENT.dataType).toBe('box header');
  });

  it('places every relationship keyword on a dashed line', () => {
    for (const keyword of [
      'use',
      'create',
      'call',
      'import',
      'access',
      'merge',
      'include',
      'extend',
    ]) {
      expect(UML_KEYWORD_PLACEMENT[keyword]).toBe('dashed-line label');
    }
  });

  it('records `abstract` as a marker after the name, not a keyword', () => {
    // Not in Table C.1 at all: §9.2.4's `{abstract}`, which the parser has to
    // recognise and which takes no guillemets.
    expect(UML_KEYWORD_PLACEMENT.abstract).toBe('after name');
  });
});

describe('the seeds', () => {
  const kinds: UmlNodeKind[] = [
    'class',
    'interface',
    'enumeration',
    'object',
    'package',
    'note',
    'actor',
    'use-case',
    'component',
    'port',
    'provided-interface',
    'required-interface',
    'artifact',
    'node',
    'device',
    'execution-environment',
  ];

  it('names every kind', () => {
    // `Record<UmlNodeKind, string>` is compile-total; this is the runtime half,
    // which also catches an empty string slipping in.
    for (const kind of kinds) {
      expect(UML_NAME_SEED[kind]).toBeTruthy();
    }
  });

  it('opens the two keyword-bearing kinds with their keyword', () => {
    expect(UML_NAME_SEED.interface).toBe(
      `${guillemets('interface')}\nInterface`
    );
    expect(UML_NAME_SEED.enumeration).toBe(
      `${guillemets('enumeration')}\nEnumeration`
    );
  });

  it('seeds an object as `name : Type` with no underline in the text', () => {
    // The underline of §11.6.4 is drawn by the renderer: it is notation, not a
    // character, and an author retyping the line would otherwise have to
    // reproduce it.
    expect(UML_NAME_SEED.object).toBe('object : Class');
  });

  it('seeds compartments the grammar can read back', () => {
    // A worked example rather than a prompt — it parses, so it exports.
    expect(parseProperty(UML_ATTRIBUTES_SEED)).toMatchObject({
      visibility: 'public',
      name: 'attribute',
      type: 'Type',
    });
    expect(parseOperation(UML_OPERATIONS_SEED)).toMatchObject({
      visibility: 'public',
      name: 'operation',
      parameters: [],
      returnType: 'Type',
    });
    expect(parseProperty(UML_SLOTS_SEED)).toMatchObject({
      name: 'attribute',
      defaultValue: 'value',
    });
  });
});

describe('reading a name compartment', () => {
  it('lifts a keyword written above the name', () => {
    expect(stereotypesOf(UML_NAME_SEED.interface)).toEqual({
      keywords: ['interface'],
      name: 'Interface',
      isAbstract: false,
    });
  });

  it('lifts a keyword written beside the name', () => {
    // What every tool that does not put it on its own line writes.
    expect(stereotypesOf('«entity» Order')).toEqual({
      keywords: ['entity'],
      name: 'Order',
      isAbstract: false,
    });
  });

  it('reads the ASCII fallback', () => {
    // A class pasted in from a tool with no guillemets would otherwise export
    // as a class named `<<interface>> Payable`.
    expect(stereotypesOf('<<interface>>\nPayable').keywords).toEqual([
      'interface',
    ]);
  });

  it('splits several labels in one pair of guillemets', () => {
    // Annex C: `"«" <label> ["," <label>]* "»"`.
    expect(stereotypesOf('«entity, root»\nOrder').keywords).toEqual([
      'entity',
      'root',
    ]);
  });

  it('reports `{abstract}` and takes it out of the name', () => {
    const stated = stereotypesOf('Payment {abstract}');
    expect(stated.isAbstract).toBe(true);
    expect(stated.name).toBe('Payment');
  });

  it('keeps a name that wraps onto two lines', () => {
    // A name compartment that wraps is a name that wraps; nothing is folded.
    expect(stereotypesOf('Order\nRepository').name).toBe('Order\nRepository');
  });

  it('reads a plain name as a plain name', () => {
    expect(stereotypesOf('Class')).toEqual({
      keywords: [],
      name: 'Class',
      isAbstract: false,
    });
    expect(stereotypesOf(undefined)).toEqual({
      keywords: [],
      name: '',
      isAbstract: false,
    });
  });
});
