import { describe, expect, it } from 'vitest';

import {
  checkEndLabelMultiplicity,
  checkLifelineIdent,
  checkMessageLabel,
  checkMultiplicity,
  checkOperationLine,
  checkPropertyLine,
  checkTransitionLabel,
  formatEndLabel,
  formatMultiplicity,
  parseActivityEdge,
  parseCompartment,
  parseEndLabel,
  parseGuard,
  parseLifelineIdent,
  parseMessageLabel,
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

describe('an association end’s adornments (§11.5.4)', () => {
  it('reads a multiplicity and the role after it', () => {
    expect(parseEndLabel('0..* items')).toEqual({
      multiplicity: { lower: 0, upper: '*' },
      role: 'items',
      raw: '0..* items',
    });
  });

  it('reads a bare multiplicity, in every spelling §7.5.4 allows', () => {
    expect(parseEndLabel('1')).toEqual({
      multiplicity: { lower: 1, upper: 1 },
      raw: '1',
    });
    expect(parseEndLabel('*')).toEqual({
      multiplicity: { lower: 0, upper: '*' },
      raw: '*',
    });
    // §9.5.4 brackets the same range that §11.5.4 writes bare; both parse.
    expect(parseEndLabel('[0..1]')).toEqual({
      multiplicity: { lower: 0, upper: 1 },
      raw: '[0..1]',
    });
  });

  it('reads the visibility glyph on either side of the range', () => {
    expect(parseEndLabel('- owner')).toEqual({
      role: 'owner',
      visibility: 'private',
      raw: '- owner',
    });
    expect(parseEndLabel('+ 0..1 a')).toEqual({
      multiplicity: { lower: 0, upper: 1 },
      role: 'a',
      visibility: 'public',
      raw: '+ 0..1 a',
    });
    // No space needed: `#1 b` is the spelling a property line would use.
    expect(parseEndLabel('#1 b')).toEqual({
      multiplicity: { lower: 1, upper: 1 },
      role: 'b',
      visibility: 'protected',
      raw: '#1 b',
    });
  });

  it('leaves a leading token that is not a range in the role', () => {
    // Only the CLOSED grammar of §7.5.4 is taken as a multiplicity; a word is
    // a name, whatever it starts with.
    expect(parseEndLabel('1st choice')).toEqual({
      role: '1st choice',
      raw: '1st choice',
    });
    // A symbolic bound is legal UML and has no integer this module may invent
    // (see `parseMultiplicity`), so it survives as the end's own words.
    expect(parseEndLabel('1..n')).toEqual({ role: '1..n', raw: '1..n' });
  });

  it('never throws, and never loses what was typed', () => {
    expect(parseEndLabel('')).toEqual({ raw: '' });
    expect(parseEndLabel(undefined)).toEqual({ raw: '' });
    expect(parseEndLabel(null)).toEqual({ raw: '' });
    expect(parseEndLabel('  {ordered}  ')).toEqual({
      role: '{ordered}',
      raw: '{ordered}',
    });
  });

  it('prints back in the clause’s own order', () => {
    expect(
      formatEndLabel({
        multiplicity: { lower: 0, upper: '*' },
        role: 'items',
        raw: 'whatever',
      })
    ).toBe('0..* items');
    expect(
      formatEndLabel({ role: 'owner', visibility: 'private', raw: '' })
    ).toBe('-owner');
  });

  it('prints the raw text for a label it read nothing structural out of', () => {
    expect(formatEndLabel({ raw: '{ordered, subsets b}' })).toBe(
      '{ordered, subsets b}'
    );
  });

  it('round-trips every range a diagram spells in full', () => {
    for (const raw of ['1', '0..1', '2..7', '1..*', '0..*']) {
      expect(formatMultiplicity(parseMultiplicity(raw)!)).toBe(raw);
    }
    // §7.5.4's other abbreviation is READ and not written back: `*` is the
    // spelling that reads as unfinished beside a line.
    expect(formatMultiplicity(parseMultiplicity('*')!)).toBe('0..*');
  });

  it('is the exact inverse of itself for a label in the clause’s order', () => {
    for (const raw of ['1', '0..* items', '-owner', '0..1 +a']) {
      expect(formatEndLabel(parseEndLabel(raw))).toBe(raw);
    }
    // A marker written IN FRONT of the range is read and then printed where
    // §11.5.4 puts it, which is beside the name. Same record, one spelling.
    expect(formatEndLabel(parseEndLabel('+ 0..1 a'))).toBe('0..1 +a');
  });
});

/**
 * The STRICT half — the same grammars asked a yes/no question, and the verdict
 * the four `label-syntax` rules actually carry (ADR 0021).
 *
 * One contract holds the whole suite: a line is `ok: false` when the LENIENT
 * parse lost something the author wrote, and never merely because it is terse.
 * §9.5.4 makes everything but the name optional, so `balance` alone is a
 * conformant Property and the checker has to say so — a checker stricter than
 * its clause would hand `provenance: 'standard'` a claim UML does not make.
 *
 * Every case below is therefore paired: the parser's own answer is asserted
 * beside the verdict wherever the two could drift apart.
 */
describe('checkPropertyLine (§9.5.4, strict)', () => {
  it('accepts every optional part being absent', () => {
    // The contract, stated as a test: terse is not wrong.
    expect(checkPropertyLine('balance')).toEqual({ ok: true });
    expect(checkPropertyLine('balance : Money')).toEqual({ ok: true });
    expect(checkPropertyLine('- /total : Money [0..*] = 0 {readOnly}')).toEqual(
      {
        ok: true,
      }
    );
    // A name with a space in it is legal UML, and the parser says so.
    expect(checkPropertyLine('order date : Date')).toEqual({ ok: true });
    // A default holding parentheses is not an operation.
    expect(checkPropertyLine('origin : Point = Point(0, 0)')).toEqual({
      ok: true,
    });
  });

  it('reports a line the parser had to DROP something from', () => {
    expect(checkPropertyLine('balance :').ok).toBe(false);
    expect(checkPropertyLine('balance =').ok).toBe(false);
    expect(checkPropertyLine('balance {}').ok).toBe(false);
    // ...and the lenient parse really did drop it, which is the point.
    expect(parseProperty('balance :').type).toBeUndefined();
    expect(parseProperty('balance =').defaultValue).toBeUndefined();
  });

  it('reports a [ ] group that is not a multiplicity range', () => {
    expect(checkPropertyLine('orders [n]').ok).toBe(false);
    expect(checkPropertyLine('orders [0..*]')).toEqual({ ok: true });
    // The parser drops it from the name either way — see `parseProperty`.
    expect(parseProperty('orders [n]').multiplicity).toBeUndefined();
  });

  it('reports an operation typed into the attribute compartment', () => {
    const verdict = checkPropertyLine('+ place(order : Order)');
    expect(verdict.ok).toBe(false);
    expect(verdict.reason).toContain('operation');
  });

  it('reports an unclosed bracket before anything else', () => {
    expect(checkPropertyLine('orders [0..*').ok).toBe(false);
    expect(checkPropertyLine('balance {readOnly').ok).toBe(false);
  });

  it('reports a line with no name at all', () => {
    expect(checkPropertyLine('+ : Money').ok).toBe(false);
    expect(checkPropertyLine(': Money').ok).toBe(false);
  });

  it('is total, and says nothing about an empty line', () => {
    expect(checkPropertyLine('')).toEqual({ ok: true });
    expect(checkPropertyLine('   ')).toEqual({ ok: true });
  });
});

describe('checkOperationLine (§9.6.4, strict)', () => {
  it('accepts the clause’s own productions', () => {
    expect(checkOperationLine('place()')).toEqual({ ok: true });
    expect(checkOperationLine('+ place(order : Order) : Receipt')).toEqual({
      ok: true,
    });
    expect(
      checkOperationLine('# find(in id : Id) : Order [0..1] {query}')
    ).toEqual({ ok: true });
    // A default holding a comma and parentheses does not cut the list.
    expect(checkOperationLine('at(p : Point = Point(0, 0))')).toEqual({
      ok: true,
    });
  });

  it('reports the FALL-BACK the parser documents: no parameter list', () => {
    const verdict = checkOperationLine('place');
    expect(verdict.ok).toBe(false);
    expect(verdict.reason).toContain('( )');
    // The lenient parse kept the whole line as a name, which is exactly the
    // degradation this rule exists to report.
    expect(parseOperation('place')).toEqual({
      name: 'place',
      parameters: [],
      modifiers: [],
    });
  });

  it('reports an unclosed parenthesis', () => {
    expect(checkOperationLine('place(order : Order').ok).toBe(false);
  });

  it('reports text after the ) that is neither a return nor a group', () => {
    expect(checkOperationLine('place() Receipt').ok).toBe(false);
    // ...and the parser drops it, so the file would lose the word.
    expect(parseOperation('place() Receipt').returnType).toBeUndefined();
  });

  it('reports an empty return type and an unreadable return multiplicity', () => {
    expect(checkOperationLine('place() :').ok).toBe(false);
    expect(checkOperationLine('place() : Receipt [n]').ok).toBe(false);
  });

  it('reports a parameter the parser could not read', () => {
    expect(checkOperationLine('place(order :)').ok).toBe(false);
    expect(checkOperationLine('place(: Order)').ok).toBe(false);
  });

  it('reports an operation with no name', () => {
    expect(checkOperationLine('+ (order : Order)').ok).toBe(false);
  });
});

describe('checkTransitionLabel (§14.2.4.8, strict)', () => {
  it('accepts an EMPTY label — a completion transition', () => {
    expect(checkTransitionLabel('')).toEqual({ ok: true });
    expect(checkTransitionLabel(undefined)).toEqual({ ok: true });
    expect(checkTransitionLabel(null)).toEqual({ ok: true });
  });

  it('accepts the three parts, together and apart', () => {
    expect(checkTransitionLabel('submit')).toEqual({ ok: true });
    expect(checkTransitionLabel('[ready]')).toEqual({ ok: true });
    expect(checkTransitionLabel('/ open()')).toEqual({ ok: true });
    expect(
      checkTransitionLabel('after 5 s, submit(a, b) [total > 0] / open()')
    ).toEqual({ ok: true });
    // A guard holding an indexed expression closes where the author closed it.
    expect(checkTransitionLabel('submit [a[0] > 1] / log()')).toEqual({
      ok: true,
    });
  });

  it('reports the parser’s two documented tolerances', () => {
    // An unclosed `[` is "a guard somebody is still typing".
    expect(checkTransitionLabel('submit [ready').ok).toBe(false);
    // A `/` with nothing behind it loses the effect.
    expect(checkTransitionLabel('submit /').ok).toBe(false);
    expect(parseTransition('submit /').effect).toBeUndefined();
  });

  it('reports an empty guard and an empty trigger', () => {
    expect(checkTransitionLabel('submit []').ok).toBe(false);
    expect(checkTransitionLabel('a,,b').ok).toBe(false);
    expect(parseTransition('a,,b').triggers).toEqual(['a', 'b']);
  });

  it('reports text after the guard that is not an effect', () => {
    expect(checkTransitionLabel('submit [ready] then open').ok).toBe(false);
  });
});

describe('checkMultiplicity and checkEndLabelMultiplicity (§7.5.4, §11.5.4)', () => {
  it('accepts every range the writers can hold', () => {
    for (const range of ['1', '0..1', '0..*', '*', '[0..1]']) {
      expect(checkMultiplicity(range), range).toEqual({ ok: true });
    }
  });

  it('reports a range the writers cannot hold', () => {
    expect(checkMultiplicity('1..n').ok).toBe(false);
    expect(checkMultiplicity('*..1').ok).toBe(false);
    expect(checkMultiplicity('0...*').ok).toBe(false);
    expect(parseMultiplicity('1..n')).toBeUndefined();
  });

  it('reads an END LABEL’s leading token, and only when it is a range attempt', () => {
    expect(checkEndLabelMultiplicity('0..* items')).toEqual({ ok: true });
    expect(checkEndLabelMultiplicity('- 0..1 owner')).toEqual({ ok: true });
    expect(checkEndLabelMultiplicity('[0..1] owner')).toEqual({ ok: true });
    expect(checkEndLabelMultiplicity('1..n items').ok).toBe(false);
  });

  it('leaves a ROLE NAME alone, even one starting with a digit', () => {
    // `parseEndLabel` keeps `1st choice` as a name rather than a multiplicity of
    // one, and a checker stricter than the parser it checks would indict an end
    // the exporters read correctly.
    expect(checkEndLabelMultiplicity('items')).toEqual({ ok: true });
    expect(checkEndLabelMultiplicity('- owner')).toEqual({ ok: true });
    expect(checkEndLabelMultiplicity('1st choice')).toEqual({ ok: true });
    expect(parseEndLabel('1st choice').multiplicity).toBeUndefined();
    expect(checkEndLabelMultiplicity('')).toEqual({ ok: true });
  });
});

describe('parseLifelineIdent (§17.3.4)', () => {
  it('reads the three parts, together and apart', () => {
    expect(parseLifelineIdent('o : Order')).toEqual({
      name: 'o',
      type: 'Order',
    });
    expect(parseLifelineIdent('o')).toEqual({ name: 'o' });
    // The anonymous participant of a known type — the clause makes the name
    // optional and the figures use it constantly.
    expect(parseLifelineIdent(': Order')).toEqual({ type: 'Order' });
    expect(parseLifelineIdent('accounts[k] : Account')).toEqual({
      name: 'accounts',
      type: 'Account',
      selector: 'k',
    });
    expect(parseLifelineIdent('accounts[k]')).toEqual({
      name: 'accounts',
      selector: 'k',
    });
  });

  it('keeps `self` as the name it is', () => {
    // §17.3.4's own alternative. It is words, not a flag: nothing in this
    // library reads a "this is the enclosing object" bit.
    expect(parseLifelineIdent('self')).toEqual({ name: 'self' });
  });

  it('splits on the FIRST top-level colon and counts brackets', () => {
    expect(parseLifelineIdent('o : Map[String, Int]')).toEqual({
      name: 'o',
      type: 'Map[String, Int]',
    });
    // A selector carrying a colon of its own stays whole.
    expect(parseLifelineIdent('accounts[k : Key]')).toEqual({
      name: 'accounts',
      selector: 'k : Key',
    });
  });

  it('degrades rather than throws', () => {
    expect(parseLifelineIdent('')).toEqual({});
    expect(parseLifelineIdent(undefined)).toEqual({});
    expect(parseLifelineIdent(null)).toEqual({});
    // A head the grammar cannot see structure in is a lifeline NAMED exactly
    // what the author wrote — the module's degradation contract.
    expect(parseLifelineIdent('???')).toEqual({ name: '???' });
    // Nothing after the colon: the type is lost, the name is kept.
    expect(parseLifelineIdent('o :')).toEqual({ name: 'o' });
    // An empty selector is no selector.
    expect(parseLifelineIdent('accounts[]')).toEqual({ name: 'accounts' });
  });
});

describe('parseMessageLabel (§17.4.4)', () => {
  it('reads a REQUEST label', () => {
    expect(parseMessageLabel('place')).toEqual({ name: 'place' });
    expect(parseMessageLabel('place()')).toEqual({ name: 'place', args: [] });
    expect(parseMessageLabel('place(order, now)')).toEqual({
      name: 'place',
      args: ['order', 'now'],
    });
    // §17.4.4's named and wildcard arguments travel RAW: four spellings, and
    // what a writer does with them differs per format.
    expect(parseMessageLabel('place(item = book, -)')).toEqual({
      name: 'place',
      args: ['item = book', '-'],
    });
  });

  it('reads a REPLY label, with both of its extra parts', () => {
    expect(parseMessageLabel('r = place(order) : Receipt')).toEqual({
      name: 'place',
      assign: 'r',
      args: ['order'],
      returnValue: 'Receipt',
    });
    expect(parseMessageLabel('r = place')).toEqual({
      name: 'place',
      assign: 'r',
    });
    expect(parseMessageLabel('place : Receipt')).toEqual({
      name: 'place',
      returnValue: 'Receipt',
    });
  });

  it('tells an EMPTY list from no list at all', () => {
    // §17.4.4 says the parentheses are not part of the argument list, so the
    // two spellings are two things an author typed differently.
    expect(parseMessageLabel('place').args).toBeUndefined();
    expect(parseMessageLabel('place()').args).toEqual([]);
  });

  it('counts brackets rather than guessing', () => {
    // The `)` that closes the list, not the last one on the line.
    expect(parseMessageLabel('place(at(1, 2), now) : ok')).toEqual({
      name: 'place',
      args: ['at(1, 2)', 'now'],
      returnValue: 'ok',
    });
    // A comparison is not the assignment §17.4.4 puts before the name.
    expect(parseMessageLabel('check(a == b)')).toEqual({
      name: 'check',
      args: ['a == b'],
    });
    expect(parseMessageLabel('ok = check(a >= b)')).toEqual({
      name: 'check',
      assign: 'ok',
      args: ['a >= b'],
    });
  });

  it('degrades rather than throws', () => {
    expect(parseMessageLabel('')).toEqual({ name: '' });
    expect(parseMessageLabel(undefined)).toEqual({ name: '' });
    expect(parseMessageLabel(null)).toEqual({ name: '' });
    // The §17.4.4 shorthand keeps its character — the fragment it stands for is
    // not drawn on this canvas (ADR 0022).
    expect(parseMessageLabel('*')).toEqual({ name: '*' });
    // An unclosed list is a label somebody is still typing: the parentheses
    // never match, so nothing is peeled and the whole line is the name.
    expect(parseMessageLabel('place(order')).toEqual({ name: 'place(order' });
  });
});

describe('checkLifelineIdent (§17.3.4, strict)', () => {
  it('accepts an EMPTY head — `uml.unnamed-lifeline` owns that question', () => {
    expect(checkLifelineIdent('')).toEqual({ ok: true });
    expect(checkLifelineIdent(undefined)).toEqual({ ok: true });
    expect(checkLifelineIdent(null)).toEqual({ ok: true });
  });

  it('accepts every head the clause spells', () => {
    for (const head of [
      'o',
      'o : Order',
      ': Order',
      'self',
      'accounts[k] : Account',
      'o : Map[String, Int]',
    ]) {
      expect(checkLifelineIdent(head), head).toEqual({ ok: true });
    }
  });

  it('reports what the lenient parse LOSES', () => {
    // A `:` with nothing behind it: the type is gone from the record.
    expect(checkLifelineIdent('o :').ok).toBe(false);
    expect(parseLifelineIdent('o :').type).toBeUndefined();
    // An empty selector: the brackets are gone from the record.
    expect(checkLifelineIdent('accounts[]').ok).toBe(false);
    expect(parseLifelineIdent('accounts[]').selector).toBeUndefined();
    // A bracket still open.
    expect(checkLifelineIdent('accounts[k').ok).toBe(false);
    // Neither a name nor a type left.
    expect(checkLifelineIdent('[k]').ok).toBe(false);
  });

  it('reports a MESSAGE label typed into the head', () => {
    const verdict = checkLifelineIdent('place(order)');
    expect(verdict.ok).toBe(false);
    expect(verdict.reason).toContain('parentheses');
  });

  /**
   * The one check here that is stricter than "the parse lost something", and the
   * reason it is allowed to be: `parseLifelineIdent` takes everything past the
   * first top-level `:` as the type, so `: :` comes back as a participant whose
   * CLASS is the character ":" — nothing was lost, and nothing was read either.
   * §17.3.4's production has one colon, and this counts them.
   */
  it('reports a head carrying a SECOND colon', () => {
    for (const head of [': :', 'o : Order : Extra', 'a::b']) {
      const verdict = checkLifelineIdent(head);
      expect(verdict.ok, head).toBe(false);
      expect(verdict.reason, head).toContain('two');
    }
    // …and a colon inside the type's own brackets is not a second one: the
    // depth count is what tells a map's key type from a malformed head.
    expect(checkLifelineIdent('o : Map[K : V]')).toEqual({ ok: true });
  });
});

describe('checkMessageLabel (§17.4.4, strict)', () => {
  it('accepts an EMPTY label — an unlabelled arrow is legal', () => {
    expect(checkMessageLabel('')).toEqual({ ok: true });
    expect(checkMessageLabel(undefined)).toEqual({ ok: true });
    expect(checkMessageLabel(null)).toEqual({ ok: true });
  });

  it('accepts every label the two productions spell', () => {
    for (const label of [
      'place',
      'place()',
      'place(order)',
      'place(item = book, -)',
      'r = place(order) : Receipt',
      'place : Receipt',
      'check(a == b)',
      // §17.4.4's shorthand for "a message of any type".
      '*',
    ]) {
      expect(checkMessageLabel(label), label).toEqual({ ok: true });
    }
  });

  it('reports what the lenient parse LOSES', () => {
    // A bracket still open — a label somebody is mid-word on.
    expect(checkMessageLabel('place(order').ok).toBe(false);
    // An argument between two commas: the file holds two where three were typed.
    expect(checkMessageLabel('place(a,,b)').ok).toBe(false);
    expect(parseMessageLabel('place(a,,b)').args).toEqual(['a', 'b']);
    // A `:` with nothing behind it, with and without a list.
    expect(checkMessageLabel('place() :').ok).toBe(false);
    expect(checkMessageLabel('place :').ok).toBe(false);
    // An `=` with nothing in front of it.
    expect(checkMessageLabel('= place').ok).toBe(false);
    expect(parseMessageLabel('= place').assign).toBeUndefined();
    // Text after the `)` that is neither a return value nor nothing.
    expect(checkMessageLabel('place() then reply').ok).toBe(false);
    // No name left at all.
    expect(checkMessageLabel('r =').ok).toBe(false);
  });
});
