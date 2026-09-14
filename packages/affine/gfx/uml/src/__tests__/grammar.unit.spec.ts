import { describe, expect, it } from 'vitest';

import {
  parseActivityEdge,
  parseCompartment,
  parseGuard,
  parseMultiplicity,
  parseOperation,
  parseProperty,
  parseStateBehavior,
  parseTransition,
  parseTrigger,
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

/* ── The behaviour grammars (§14.2.4.8, §13.3.4, §15.2.4, §14.2.4.4) ───── */

describe('a guard', () => {
  it('comes back without its brackets, whether or not they were written', () => {
    expect(parseGuard('[x > 0]')).toBe('x > 0');
    expect(parseGuard('x > 0')).toBe('x > 0');
    expect(parseGuard('  [ stock >= quantity ]  ')).toBe('stock >= quantity');
  });

  it('is undefined when there is nothing in it', () => {
    expect(parseGuard('[]')).toBeUndefined();
    expect(parseGuard('   ')).toBeUndefined();
    expect(parseGuard(undefined)).toBeUndefined();
    expect(parseGuard(null)).toBeUndefined();
  });
});

describe('a trigger', () => {
  it('classifies the four notations §13.3.4 gives a keyword to', () => {
    expect(parseTrigger('after 5 seconds')).toEqual({
      kind: 'relative-time',
      text: 'after 5 seconds',
      expression: '5 seconds',
    });
    expect(parseTrigger('at Jan 1, 2000, Noon')).toEqual({
      kind: 'absolute-time',
      text: 'at Jan 1, 2000, Noon',
      expression: 'Jan 1, 2000, Noon',
    });
    expect(parseTrigger('when stock = 0')).toEqual({
      kind: 'change',
      text: 'when stock = 0',
      expression: 'stock = 0',
    });
    expect(parseTrigger('all')).toEqual({ kind: 'any-receive', text: 'all' });
  });

  it('reads a bare name as a call OR a signal, never one of the two', () => {
    // §14.2.4.8: the two "are not distinguishable by syntax and must be
    // discriminated by their declaration elsewhere", and a canvas holds no such
    // declaration. Guessing would be inventing the half of the fact the drawing
    // does not carry.
    expect(parseTrigger('submit')).toEqual({
      kind: 'call-or-signal',
      text: 'submit',
      name: 'submit',
    });
    expect(parseTrigger('place(order, total)')).toEqual({
      kind: 'call-or-signal',
      text: 'place(order, total)',
      name: 'place',
      assignment: 'order, total',
    });
  });

  it('keeps the author’s capitals while classifying in lower case', () => {
    expect(parseTrigger('After 5 s').kind).toBe('relative-time');
    expect(parseTrigger('After 5 s').text).toBe('After 5 s');
    expect(parseTrigger('ALL').kind).toBe('any-receive');
  });

  it('classifies a keyword somebody is halfway through typing', () => {
    // The kind is what the word says; the expression is simply not stated yet.
    expect(parseTrigger('after')).toEqual({
      kind: 'relative-time',
      text: 'after',
    });
  });

  it('does not mistake a longer word for a keyword', () => {
    // `afterwards` is a signal called `afterwards`, not a time event.
    expect(parseTrigger('afterwards').kind).toBe('call-or-signal');
    expect(parseTrigger('allocate').kind).toBe('call-or-signal');
  });
});

describe('a transition label', () => {
  it('reads §14.2.4.8’s three parts', () => {
    expect(parseTransition('submit [stock > 0] / reserve()')).toEqual({
      triggers: ['submit'],
      guard: 'stock > 0',
      effect: 'reserve()',
    });
  });

  it('reads each part on its own, and every part is optional', () => {
    expect(parseTransition('submit')).toEqual({ triggers: ['submit'] });
    expect(parseTransition('[stock > 0]')).toEqual({
      triggers: [],
      guard: 'stock > 0',
    });
    expect(parseTransition('/ reserve()')).toEqual({
      triggers: [],
      effect: 'reserve()',
    });
    // A COMPLETION transition — one that fires when its source state finishes —
    // is written with no label at all, and §14.2.4.8's outer brackets say so.
    expect(parseTransition('')).toEqual({ triggers: [] });
    expect(parseTransition(undefined)).toEqual({ triggers: [] });
    expect(parseTransition(null)).toEqual({ triggers: [] });
  });

  it('splits a trigger list on its TOP-LEVEL commas', () => {
    // A call event's assignment specification holds commas of its own, and
    // cutting one in half would produce two triggers neither of which is a
    // trigger.
    expect(
      parseTransition('submit, place(order, total), all').triggers
    ).toEqual(['submit', 'place(order, total)', 'all']);
  });

  it('keeps a slash inside a guard out of the effect', () => {
    expect(parseTransition('tick [a/b > 1] / log()')).toEqual({
      triggers: ['tick'],
      guard: 'a/b > 1',
      effect: 'log()',
    });
  });

  it('closes a guard where the author closed it', () => {
    expect(parseTransition('[items[0] > 1] / ship()')).toEqual({
      triggers: [],
      guard: 'items[0] > 1',
      effect: 'ship()',
    });
  });

  it('treats an unclosed bracket as a guard somebody is still typing', () => {
    expect(parseTransition('submit [stock >')).toEqual({
      triggers: ['submit'],
      guard: 'stock >',
    });
  });

  it('reads a bare change event’s slash as the effect separator', () => {
    // The one degradation, stated in the docblock rather than discovered in an
    // export: §13.3.4's value specification has no delimiters, so no reading of
    // a flat string can tell this apart. Bracketing the expression resolves it.
    expect(parseTransition('when x/2 > 1')).toEqual({
      triggers: ['when x'],
      effect: '2 > 1',
    });
    expect(parseTransition('when [x/2 > 1]')).toEqual({
      triggers: ['when'],
      guard: 'x/2 > 1',
    });
  });
});

describe('an activity edge’s label', () => {
  it('reads §15.2.4’s three annotations out of one text', () => {
    expect(parseActivityEdge('ready [stock > 0] {weight = 2}')).toEqual({
      name: 'ready',
      guard: 'stock > 0',
      weight: '2',
    });
  });

  it('reads a bare label as the edge’s NAME, never as a guard', () => {
    // §15.2.4 brackets a guard. Inventing one from a bare word would put a
    // condition in a file the drawing does not show.
    expect(parseActivityEdge('approved')).toEqual({ name: 'approved' });
  });

  it('reads the unlimited weight §15.2.4 spells with a star', () => {
    expect(parseActivityEdge('{weight = *}')).toEqual({ weight: '*' });
    expect(parseActivityEdge('{ WEIGHT=n }')).toEqual({ weight: 'n' });
  });

  it('drops a braced group that is not a weight annotation', () => {
    // `{stream}` is notation this pack does not model, and gluing it onto the
    // name would rename the edge.
    expect(parseActivityEdge('ready {stream}')).toEqual({ name: 'ready' });
  });

  it('is empty for an unlabelled arrow', () => {
    expect(parseActivityEdge('')).toEqual({});
    expect(parseActivityEdge(undefined)).toEqual({});
  });
});

describe('a state’s internal activities', () => {
  it('reads §14.2.4.4’s three labels, slash or no slash', () => {
    expect(parseStateBehavior('entry / reserve()')).toEqual({
      kind: 'entry',
      expression: 'reserve()',
    });
    expect(parseStateBehavior('do / poll()')).toEqual({
      kind: 'do',
      expression: 'poll()',
    });
    expect(parseStateBehavior('EXIT release()')).toEqual({
      kind: 'exit',
      expression: 'release()',
    });
  });

  it('is undefined for every other line of the compartment', () => {
    // §14.2.4.4's next compartment holds internal TRANSITIONS, and an author
    // writes prose besides. Only the three labels the clause names are lifted.
    expect(parseStateBehavior('submit [x > 0] / log()')).toBeUndefined();
    expect(parseStateBehavior('invariant: total >= 0')).toBeUndefined();
    // …and a longer word starting with a label is not a label.
    expect(parseStateBehavior('entrypoint / x')).toBeUndefined();
  });

  it('reports a label with nothing after it as a line half typed', () => {
    expect(parseStateBehavior('entry')).toEqual({ kind: 'entry' });
  });
});
