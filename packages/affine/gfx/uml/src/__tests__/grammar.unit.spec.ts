import { describe, expect, it } from 'vitest';

import {
  parseCompartment,
  parseMultiplicity,
  parseOperation,
  parseProperty,
  visibilityOf,
} from '../grammar';

/**
 * The UML member grammar.
 *
 * Literals in, records out, and nothing else in the file: the parsers are pure
 * functions of a string, which is the whole reason they are a module of their
 * own rather than a private helper of the exporters.
 *
 * The cases are the BNF's, clause by clause — every optional part present, every
 * optional part absent, and the malformed line that has to degrade rather than
 * throw. That last group is the one that matters in practice: a compartment is
 * free text somebody is typing INTO, so half of it is a half-finished line at
 * any moment, and a parser that threw would turn a keystroke into a broken
 * export.
 */

describe('visibility (§7.4)', () => {
  it('reads the four markers', () => {
    expect(visibilityOf('+')).toBe('public');
    expect(visibilityOf('-')).toBe('private');
    expect(visibilityOf('#')).toBe('protected');
    expect(visibilityOf('~')).toBe('package');
  });

  it('is undefined for anything else', () => {
    // "not stated" is a different fact from "package", which is what `~` says.
    expect(visibilityOf('')).toBeUndefined();
    expect(visibilityOf('*')).toBeUndefined();
  });
});

describe('multiplicity (§7.5.4)', () => {
  it('reads a range', () => {
    expect(parseMultiplicity('0..*')).toEqual({ lower: 0, upper: '*' });
    expect(parseMultiplicity('1..5')).toEqual({ lower: 1, upper: 5 });
  });

  it('reads a bare upper bound as an exact multiplicity', () => {
    expect(parseMultiplicity('1')).toEqual({ lower: 1, upper: 1 });
    expect(parseMultiplicity('0')).toEqual({ lower: 0, upper: 0 });
  });

  it('reads a lone star as `0..*`', () => {
    expect(parseMultiplicity('*')).toEqual({ lower: 0, upper: '*' });
  });

  it('tolerates the brackets §9.5.4 writes it in', () => {
    // The same range is written both ways depending on where it sits: in
    // brackets inside a property line, bare beside an association end.
    expect(parseMultiplicity('[1..*]')).toEqual({ lower: 1, upper: '*' });
    expect(parseMultiplicity(' [ 2 ] ')).toEqual({ lower: 2, upper: 2 });
  });

  it('declines a range it cannot write down as integers', () => {
    // `<lower>` is a ValueSpecification in the metamodel, so `n..m` is legal
    // UML — and inventing an integer for `n` would be a fact the author never
    // stated.
    expect(parseMultiplicity('n..m')).toBeUndefined();
    expect(parseMultiplicity('*..1')).toBeUndefined();
    expect(parseMultiplicity('')).toBeUndefined();
    expect(parseMultiplicity('1..2..3')).toBeUndefined();
  });
});

describe('a property (§9.5.4)', () => {
  it('reads every optional part at once', () => {
    expect(
      parseProperty('+ /orders : Order [0..*] = none {readOnly, ordered}')
    ).toEqual({
      visibility: 'public',
      isDerived: true,
      name: 'orders',
      type: 'Order',
      multiplicity: { lower: 0, upper: '*' },
      defaultValue: 'none',
      modifiers: ['readOnly', 'ordered'],
    });
  });

  it('reads a bare name', () => {
    // An omitted multiplicity implies exactly one (§9.5.4) and is left ABSENT
    // rather than filled in: the parser reports what the line says.
    expect(parseProperty('total')).toEqual({
      isDerived: false,
      name: 'total',
      modifiers: [],
    });
  });

  it('reads the derived slash with no visibility', () => {
    expect(parseProperty('/age : Integer')).toMatchObject({
      isDerived: true,
      name: 'age',
      type: 'Integer',
    });
  });

  it('keeps a name with a space in it', () => {
    // Parsed from the RIGHT, which is what makes this work: a left-to-right
    // pass would have to guess where the name ends.
    expect(parseProperty('- order date : Date').name).toBe('order date');
  });

  it('reports `{static}` and leaves the underline alone', () => {
    // A static feature is UNDERLINED in UML and an underline is not a
    // character: `{static}` is the only spelling a text compartment can carry.
    const property = parseProperty('+ instances : Integer {static}');
    expect(property.isStatic).toBe(true);
    expect(property.modifiers).toEqual(['static']);
    expect(parseProperty('+ id : String').isStatic).toBeUndefined();
  });

  it('keeps a default that contains a colon', () => {
    // The default is peeled off BEFORE the type split, so an expression with
    // its own punctuation survives.
    expect(parseProperty('label : String = "a: b"')).toMatchObject({
      type: 'String',
      defaultValue: '"a: b"',
    });
  });

  it('reads a trailing brace group as modifiers, never as a default', () => {
    // §9.5.4 puts the modifier group LAST, so a line ending in `{…}` is
    // modifiers — there is no reading in which it is the tail of a default, and
    // an author who wants braces in a value has to quote them.
    expect(parseProperty('config : Map = {a: 1}')).toMatchObject({
      type: 'Map',
      modifiers: ['a: 1'],
    });
  });

  it('degrades a malformed line to a name', () => {
    expect(parseProperty('???')).toEqual({
      isDerived: false,
      name: '???',
      modifiers: [],
    });
    // A multiplicity the grammar cannot read is still not part of the name.
    const symbolic = parseProperty('orders[n]');
    expect(symbolic.name).toBe('orders');
    expect(symbolic.multiplicity).toBeUndefined();
  });
});

describe('an operation (§9.6.4)', () => {
  it('reads every optional part at once', () => {
    expect(
      parseOperation(
        '# place(in order : Order, out receipt : Receipt [0..1] = none) : Boolean [1] {query}'
      )
    ).toEqual({
      visibility: 'protected',
      name: 'place',
      parameters: [
        { direction: 'in', name: 'order', type: 'Order' },
        {
          direction: 'out',
          name: 'receipt',
          type: 'Receipt',
          multiplicity: { lower: 0, upper: 1 },
          defaultValue: 'none',
        },
      ],
      returnType: 'Boolean',
      returnMultiplicity: { lower: 1, upper: 1 },
      modifiers: ['query'],
    });
  });

  it('reads an operation with no parameters and no return', () => {
    expect(parseOperation('+ cancel()')).toEqual({
      visibility: 'public',
      name: 'cancel',
      parameters: [],
      modifiers: [],
    });
  });

  it('leaves an omitted direction absent', () => {
    // §9.4.4 defaults it to `in`; the DEFAULT is applied by the writer that
    // needs one, not by the parser.
    expect(parseOperation('total(x : Int)').parameters[0]).toEqual({
      name: 'x',
      type: 'Int',
    });
  });

  it('does not cut a parameter list inside a type expression', () => {
    const operation = parseOperation('lookup(index : Map(String, Int)) : Int');
    expect(operation.parameters).toHaveLength(1);
    expect(operation.parameters[0].type).toBe('Map(String, Int)');
    expect(operation.returnType).toBe('Int');
  });

  it('does not read the return part out of a default value', () => {
    // The matching paren is depth-counted, so parentheses in a default cannot
    // close the list early.
    const operation = parseOperation('move(to : Point = Point(0, 0)) : Void');
    expect(operation.parameters[0].defaultValue).toBe('Point(0, 0)');
    expect(operation.returnType).toBe('Void');
  });

  it('reports `{abstract}` and `{static}` beside the modifiers', () => {
    const operation = parseOperation('+ total() : Real {abstract, static}');
    expect(operation.isAbstract).toBe(true);
    expect(operation.isStatic).toBe(true);
    expect(operation.modifiers).toEqual(['abstract', 'static']);
  });

  it('degrades a line with no parentheses to a name', () => {
    // An author halfway through typing `place` keeps their word.
    expect(parseOperation('place')).toEqual({
      name: 'place',
      parameters: [],
      modifiers: [],
    });
  });
});

describe('a compartment', () => {
  it('keeps the lines that say something, in order', () => {
    expect(parseCompartment('  + a : A \n\n  - b : B  ')).toEqual([
      '+ a : A',
      '- b : B',
    ]);
  });

  it('drops the elision marker (§9.2.4)', () => {
    // `...` means "there are more features, not shown". Writing it back as a
    // property named `...` would turn that into a feature called dot dot dot.
    expect(parseCompartment('+ a : A\n...\n…')).toEqual(['+ a : A']);
  });

  it('reads nothing out of nothing', () => {
    expect(parseCompartment(undefined)).toEqual([]);
    expect(parseCompartment('')).toEqual([]);
  });
});
