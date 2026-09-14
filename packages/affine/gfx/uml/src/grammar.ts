/**
 * The UML member grammar, as pure parsers.
 *
 * ## What these read
 *
 * Three BNFs, transcribed from UML 2.5.1 and cited where they are used:
 *
 *  - **§9.5.4** (printed p. 113) — a Property:
 *    `[<visibility>] [`/`] <name> [`:` <prop-type>] [`[` <multiplicity-range> `]`]
 *     [`=` <default>] [`{` <prop-modifier> [`,` <prop-modifier>]* `}`]`
 *  - **§9.6.4** (p. 117) — an Operation:
 *    `[<visibility>] <name> `(` [<parameter-list>] `)` [`:` [<return-type>]
 *     [`[` <multiplicity-range> `]`] [`{` <oper-property>* `}`]]`, with
 *    `<parameter>` from §9.4.4 (p. 110):
 *    `[<direction>] <parameter-name> `:` <type-expression>
 *     [`[`<multiplicity-range>`]`] [`=` <default>]`
 *  - **§7.5.4** (p. 34) — a multiplicity range: `[ <lower> `..` ] <upper>`
 *
 * ## Why they never throw
 *
 * A compartment is FREE TEXT an architect types while thinking. Half of it is a
 * half-finished line at any moment, and a parser that threw would turn a
 * keystroke into a broken export. So every entry point degrades: a line the
 * grammar does not recognise comes back as `{ name: <the line> }` and travels
 * through the exporters as an element named exactly what the author wrote. The
 * picture keeps saying what it said; the file says the same thing, less
 * structured.
 *
 * ## Purity
 *
 * Strings in, plain records out. No `std`, no DOM, no clock, no randomness — the
 * same discipline `c4/export.ts` and `bpmn/export.ts` hold, and for the same
 * reason: a host can call these, a test can call them with literals, and the
 * same compartment always parses to the same record.
 */

/* ── Visibility (§7.4, §9.5.4) ────────────────────────────────────────── */

/** The four VisibilityKind values UML's `<visibility>` terminal can spell. */
export type UmlVisibility = 'public' | 'private' | 'protected' | 'package';

/**
 * A visibility marker as its VisibilityKind — `undefined` for anything else.
 *
 * `~` is `package` and not "default": §7.4 gives all four a glyph, and an
 * omitted marker means the author has not said, which is a different statement
 * from package visibility and is why the callers leave the field absent.
 */
export function visibilityOf(marker: string): UmlVisibility | undefined {
  switch (marker) {
    case '+':
      return 'public';
    case '-':
      return 'private';
    case '#':
      return 'protected';
    case '~':
      return 'package';
    default:
      return undefined;
  }
}

/* ── Multiplicity (§7.5.4) ────────────────────────────────────────────── */

/**
 * A multiplicity range — `0..*` as `{ lower: 0, upper: '*' }`.
 *
 * `upper` is `number | '*'` rather than a number with `Infinity` or `-1` as a
 * sentinel, because `*` is what the file has to say: XMI writes it as the
 * `value` of a `LiteralUnlimitedNatural`, and PlantUML prints it. A sentinel
 * would have to be translated back at both ends and is one convention away from
 * a `-1` reaching a document.
 */
export interface UmlMultiplicity {
  lower: number;
  upper: number | '*';
}

/**
 * A multiplicity range, brackets optional — `undefined` when it is not one.
 *
 * §7.5.4's `[ <lower> '..' ] <upper>`, plus the two readings the clause states
 * around it:
 *
 *  - a bare `<upper>` means `lower = upper` — `1` is exactly one;
 *  - `*` is the unlimited upper bound, and a bare `*` is §7.5.4's shorthand for
 *    `0..*` (the clause's own "0..* … may be abbreviated to *").
 *
 * The brackets are stripped rather than required, because the SAME range is
 * written both ways depending on where it sits: `[0..1]` inside a property line
 * (§9.5.4 puts it in brackets) and `0..1` beside an association end (§11.5.4
 * does not). One parser, both call sites.
 *
 * `<lower>` and `<upper>` are ValueSpecifications in the metamodel, so `n..m`
 * with symbolic bounds is legal UML. It parses to `undefined` here on purpose:
 * this module's callers write bounds into files as integers, and a made-up
 * integer for `n` would be a fact the author never stated. A symbolic range
 * survives instead as part of the line's own text.
 */
export function parseMultiplicity(raw: string): UmlMultiplicity | undefined {
  const inner = raw.trim().replace(/^\[/, '').replace(/\]$/, '').trim();
  if (!inner) return undefined;

  const parts = inner.split('..');
  if (parts.length > 2) return undefined;

  const bound = (value: string): number | '*' | undefined => {
    const text = value.trim();
    if (text === '*') return '*';
    return /^\d+$/.test(text) ? Number(text) : undefined;
  };

  if (parts.length === 1) {
    const only = bound(parts[0]);
    if (only === undefined) return undefined;
    // §7.5.4: a lone `*` abbreviates `0..*`; any other lone bound is exact.
    return only === '*'
      ? { lower: 0, upper: '*' }
      : { lower: only, upper: only };
  }

  const lower = bound(parts[0]);
  const upper = bound(parts[1]);
  // An unlimited LOWER bound is not a range: `*..1` says nothing UML can hold.
  if (typeof lower !== 'number' || upper === undefined) return undefined;
  return { lower, upper };
}

/* ── Property (§9.5.4) ────────────────────────────────────────────────── */

/** One line of an attribute compartment, as the grammar reads it. */
export interface UmlProperty {
  /** Absent when the author wrote no marker — see {@link visibilityOf}. */
  visibility?: UmlVisibility;
  /** The `/` of §9.5.4: this Property is derived. */
  isDerived: boolean;
  name: string;
  /** `<prop-type>` — the name of a Classifier, resolved by the exporters. */
  type?: string;
  multiplicity?: UmlMultiplicity;
  /** `<default>`, verbatim: it is an expression, and we do not evaluate it. */
  defaultValue?: string;
  /** `<prop-modifier>`s, in order, each trimmed and otherwise verbatim. */
  modifiers: string[];
  /**
   * `true` only when `{static}` was written.
   *
   * A static feature is UNDERLINED in UML (§9.2.4), and an underline is not a
   * character: nothing in a plain-text compartment can carry it, so it cannot be
   * detected here. `{static}` is the spelling that survives a text round-trip,
   * and the field is absent rather than `false` when nothing said so — "not
   * stated" and "stated not static" are different, and only one of them is in
   * the line.
   */
  isStatic?: boolean;
}

/** `{ readOnly, subsets x }` at the end of a line — the modifier group. */
const MODIFIER_GROUP = /\{([^}]*)\}\s*$/;

/** `[0..*]` at the end of what is left once default and modifiers are off. */
const MULTIPLICITY_GROUP = /\[([^\]]*)\]\s*$/;

/** The four `<visibility>` glyphs, as a leading marker. */
const VISIBILITY_MARKER = /^([+\-#~])\s*/;

/** Splits a `{…}` group into its comma-separated modifiers. */
function modifiersOf(group: string | undefined): string[] {
  if (!group) return [];
  return group
    .split(',')
    .map(entry => entry.trim())
    .filter(entry => entry.length > 0);
}

/** Whether a modifier list states `{static}`, however it was capitalised. */
function statedStatic(modifiers: readonly string[]): boolean {
  return modifiers.some(modifier => modifier.toLowerCase() === 'static');
}

/**
 * One attribute line, per §9.5.4.
 *
 * Parsed from the RIGHT, which is what makes the optional parts optional: the
 * modifier group, then the default, then the multiplicity, then the type — each
 * peeled off the tail it is the last thing on. Parsing left to right would have
 * to guess where the name ends, and a name with a space in it (`order date`) is
 * legal UML.
 *
 * `=` is split on its FIRST occurrence, because §9.5.4 puts the default last of
 * the three and an expression may contain `==`. A `:` inside a default —
 * `= {a: 1}` — therefore survives, since the type split happens on what is left
 * after the default is gone.
 *
 * A line the grammar cannot see structure in keeps all of itself:
 * `parseProperty('???')` is a property NAMED `???`. That is the degradation
 * contract at the top of this file, and it is what lets a compartment be typed
 * into rather than filled in.
 */
export function parseProperty(line: string): UmlProperty {
  let rest = line.trim();

  const modifierMatch = MODIFIER_GROUP.exec(rest);
  const modifiers = modifiersOf(modifierMatch?.[1]);
  if (modifierMatch) rest = rest.slice(0, modifierMatch.index).trim();

  let defaultValue: string | undefined;
  const equals = rest.indexOf('=');
  if (equals >= 0) {
    const value = rest.slice(equals + 1).trim();
    if (value) defaultValue = value;
    rest = rest.slice(0, equals).trim();
  }

  let multiplicity: UmlMultiplicity | undefined;
  const multiplicityMatch = MULTIPLICITY_GROUP.exec(rest);
  if (multiplicityMatch) {
    multiplicity = parseMultiplicity(multiplicityMatch[1]);
    // Dropped from the name either way: `orders[n]` is a multiplicity the
    // grammar could not read, not part of what the property is called.
    rest = rest.slice(0, multiplicityMatch.index).trim();
  }

  let type: string | undefined;
  const colon = rest.indexOf(':');
  if (colon >= 0) {
    const named = rest.slice(colon + 1).trim();
    if (named) type = named;
    rest = rest.slice(0, colon).trim();
  }

  const visibilityMatch = VISIBILITY_MARKER.exec(rest);
  const visibility = visibilityMatch
    ? visibilityOf(visibilityMatch[1])
    : undefined;
  if (visibilityMatch) rest = rest.slice(visibilityMatch[0].length).trim();

  const isDerived = rest.startsWith('/');
  if (isDerived) rest = rest.slice(1).trim();

  const property: UmlProperty = {
    isDerived,
    name: rest,
    modifiers,
  };
  if (visibility) property.visibility = visibility;
  if (type) property.type = type;
  if (multiplicity) property.multiplicity = multiplicity;
  if (defaultValue) property.defaultValue = defaultValue;
  if (statedStatic(modifiers)) property.isStatic = true;
  return property;
}

/* ── Operation (§9.6.4) and Parameter (§9.4.4) ────────────────────────── */

/** `<direction>` — §9.4.4's three, plus the one XMI writes for a result. */
export type UmlParameterDirection = 'in' | 'out' | 'inout' | 'return';

/** One entry of a `<parameter-list>`. */
export interface UmlParameter {
  /**
   * Absent when the author wrote none. §9.4.4 says an omitted direction
   * "defaults to `in`", and the DEFAULT is applied by the writer that needs one
   * rather than invented here: the parsers report what the line says.
   */
  direction?: UmlParameterDirection;
  name: string;
  type?: string;
  multiplicity?: UmlMultiplicity;
  defaultValue?: string;
}

/** One line of an operation compartment, as the grammar reads it. */
export interface UmlOperation {
  visibility?: UmlVisibility;
  name: string;
  parameters: UmlParameter[];
  returnType?: string;
  returnMultiplicity?: UmlMultiplicity;
  /** `<oper-property>`s — `query`, `redefines x`, `ordered`, a constraint. */
  modifiers: string[];
  /** See {@link UmlProperty.isStatic}: `{static}`, never an underline. */
  isStatic?: boolean;
  /** `{abstract}` — §9.2.4's text alternative to an italic name. */
  isAbstract?: boolean;
}

/** `in`, `out`, `inout` or `return` as a leading word of a parameter. */
const DIRECTION_WORD = /^(in|out|inout|return)\s+/i;

/**
 * The index of the `)` matching the `(` at `open` — `-1` when there is none.
 *
 * Depth-counted rather than `lastIndexOf(')')`, because a default value may hold
 * parentheses (`x : Point = Point(0, 0)`) and the return part comes after the
 * list, not inside it.
 */
function matchingParen(text: string, open: number): number {
  let depth = 0;
  for (let index = open; index < text.length; index++) {
    const char = text[index];
    if (char === '(') depth++;
    else if (char === ')') {
      depth--;
      if (depth === 0) return index;
    }
  }
  return -1;
}

/**
 * A `<parameter-list>` split on its TOP-LEVEL commas.
 *
 * A naive `split(',')` would cut `Map(String, Int)` and `[0, 1]` in half, and
 * both are ordinary inside a type expression or a default.
 */
function splitParameters(list: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let current = '';
  for (const char of list) {
    if (char === '(' || char === '[' || char === '{') depth++;
    else if (char === ')' || char === ']' || char === '}') depth--;
    if (char === ',' && depth === 0) {
      parts.push(current);
      current = '';
      continue;
    }
    current += char;
  }
  parts.push(current);
  return parts.map(part => part.trim()).filter(part => part.length > 0);
}

/** One `<parameter>`, per §9.4.4. Peeled from the right like a property. */
function parseParameter(raw: string): UmlParameter {
  let rest = raw.trim();

  // §9.4.4 admits `{ordered}` and friends on a parameter; they are read off and
  // dropped rather than modelled — no writer here has a slot for them, and
  // leaving the group glued to the default would corrupt the default.
  const modifierMatch = MODIFIER_GROUP.exec(rest);
  if (modifierMatch) rest = rest.slice(0, modifierMatch.index).trim();

  let defaultValue: string | undefined;
  const equals = rest.indexOf('=');
  if (equals >= 0) {
    const value = rest.slice(equals + 1).trim();
    if (value) defaultValue = value;
    rest = rest.slice(0, equals).trim();
  }

  let multiplicity: UmlMultiplicity | undefined;
  const multiplicityMatch = MULTIPLICITY_GROUP.exec(rest);
  if (multiplicityMatch) {
    multiplicity = parseMultiplicity(multiplicityMatch[1]);
    rest = rest.slice(0, multiplicityMatch.index).trim();
  }

  let type: string | undefined;
  const colon = rest.indexOf(':');
  if (colon >= 0) {
    const named = rest.slice(colon + 1).trim();
    if (named) type = named;
    rest = rest.slice(0, colon).trim();
  }

  let direction: UmlParameterDirection | undefined;
  const directionMatch = DIRECTION_WORD.exec(rest);
  if (directionMatch) {
    direction = directionMatch[1].toLowerCase() as UmlParameterDirection;
    rest = rest.slice(directionMatch[0].length).trim();
  }

  const parameter: UmlParameter = { name: rest };
  if (direction) parameter.direction = direction;
  if (type) parameter.type = type;
  if (multiplicity) parameter.multiplicity = multiplicity;
  if (defaultValue) parameter.defaultValue = defaultValue;
  return parameter;
}

/**
 * One operation line, per §9.6.4.
 *
 * The parentheses are the anchor: everything before the `(` is the visibility
 * and the name, everything inside is the `<parameter-list>`, and everything
 * after is the optional return part and the `<oper-property>` group. A line with
 * no parentheses is not an operation the grammar can see — it degrades to a
 * NAME, exactly as a property does, and an author halfway through typing
 * `place` keeps their word.
 *
 * `{abstract}` is reported separately from `modifiers` (which keeps it too),
 * because §9.2.4's marker decides a metamodel FLAG — `isAbstract` on the
 * Operation — where the rest of the group is notation a writer passes through.
 */
export function parseOperation(line: string): UmlOperation {
  const trimmed = line.trim();

  const open = trimmed.indexOf('(');
  const close = open >= 0 ? matchingParen(trimmed, open) : -1;
  if (open < 0 || close < 0) {
    return { name: trimmed, parameters: [], modifiers: [] };
  }

  let head = trimmed.slice(0, open).trim();
  const list = trimmed.slice(open + 1, close);
  let tail = trimmed.slice(close + 1).trim();

  const modifierMatch = MODIFIER_GROUP.exec(tail);
  const modifiers = modifiersOf(modifierMatch?.[1]);
  if (modifierMatch) tail = tail.slice(0, modifierMatch.index).trim();

  let returnType: string | undefined;
  let returnMultiplicity: UmlMultiplicity | undefined;
  if (tail.startsWith(':')) {
    let returns = tail.slice(1).trim();
    const multiplicityMatch = MULTIPLICITY_GROUP.exec(returns);
    if (multiplicityMatch) {
      returnMultiplicity = parseMultiplicity(multiplicityMatch[1]);
      returns = returns.slice(0, multiplicityMatch.index).trim();
    }
    if (returns) returnType = returns;
  }

  const visibilityMatch = VISIBILITY_MARKER.exec(head);
  const visibility = visibilityMatch
    ? visibilityOf(visibilityMatch[1])
    : undefined;
  if (visibilityMatch) head = head.slice(visibilityMatch[0].length).trim();

  const operation: UmlOperation = {
    name: head,
    parameters: splitParameters(list).map(parseParameter),
    modifiers,
  };
  if (visibility) operation.visibility = visibility;
  if (returnType) operation.returnType = returnType;
  if (returnMultiplicity) operation.returnMultiplicity = returnMultiplicity;
  if (statedStatic(modifiers)) operation.isStatic = true;
  if (modifiers.some(modifier => modifier.toLowerCase() === 'abstract')) {
    operation.isAbstract = true;
  }
  return operation;
}

/* ── A compartment ────────────────────────────────────────────────────── */

/**
 * The lines of a compartment that SAY something — trimmed, in order.
 *
 * Two kinds of line are dropped and both are notation rather than content:
 *
 *  - a blank line, which is spacing;
 *  - an ellipsis — `...` or `…` — which is §9.2.4's ELISION marker. It means
 *    "there are more features, not shown", and a file that wrote it back as a
 *    property named `...` would turn "some are hidden" into "one is called dot
 *    dot dot".
 */
export function parseCompartment(text: string | undefined | null): string[] {
  const raw = text === null || text === undefined ? '' : String(text);
  return raw
    .split('\n')
    .map(line => line.trim())
    .filter(line => line.length > 0 && line !== '...' && line !== '…');
}
