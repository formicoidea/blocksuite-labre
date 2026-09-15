/**
 * The UML member grammar, as pure parsers.
 *
 * ## What these read
 *
 * Seven BNFs, transcribed from UML 2.5.1 and cited where they are used. The
 * first three are phase 1's, and they are the STRUCTURAL half — what a
 * compartment of a classifier says. Three more arrived with the behaviour sheets
 * and are the same discipline applied to a LINE rather than to a box: what a
 * transition, an activity edge and a state's internal compartment say. The
 * seventh is what is written beside ONE END of a line.
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
 *  - **§11.5.4** (p. 201) — what may be written beside an Association end: a
 *    name string, a multiplicity, a `<prop-modifier>` in braces, a
 *    `<visibility>` symbol
 *  - **§14.2.4.8** (p. 331) — a Transition label:
 *    `[<trigger> [`,` <trigger>]*] [`[` <guard> `]`] [`/` <behavior-expression>]`,
 *    with `<trigger>` from §13.3.4 (p. 293): a call or signal event's name, a
 *    `when` change event, an `after` / `at` time event, or the bare `all`
 *  - **§15.2.4** (p. 379) — an ActivityEdge's annotations: a name near the
 *    arrow, a guard "as text in square brackets near tail of the line", and
 *    `weight-annotation ::= `{` `weight` `=` <value-specification> `}``
 *  - **§14.2.4.4** (p. 320) — a State's internal activities:
 *    `<behavior-type-label> [`/` <behavior-expression>]`, the label being one of
 *    `entry`, `do` and `exit`
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

/* ── An association end's adornments (§11.5.4) ────────────────────────── */

/**
 * What is written BESIDE one end of an association line.
 *
 * §11.5.4 (printed p. 201) names exactly what may sit there: "A name string may
 * be placed near the end of the line to show the name of the Association end",
 * and "various other notations can be placed near the end of the line as
 * follows: a multiplicity … a `<prop-modifier>` enclosed in curly braces … a
 * `<visibility>` symbol".
 *
 * Three of the four are read; the modifier group is not, and that is the same
 * call {@link parseActivityEdge} makes about `{stream}` — it is notation this
 * pack does not model, and folding it into the role would rename the end. It
 * survives in {@link raw}, which is why {@link raw} is not optional: whatever
 * the author typed is kept verbatim, so a label the grammar reads as nothing at
 * all is still the author's words on the board and in the file.
 */
export interface UmlAssociationEnd {
  /** §7.5.4's range, brackets optional — `0..*`, `1`, `[0..1]`. */
  multiplicity?: UmlMultiplicity;
  /** The end's NAME — the Property the far classifier sees (§11.5.4). */
  role?: string;
  /** Absent when the author wrote no marker — see {@link visibilityOf}. */
  visibility?: UmlVisibility;
  /** Exactly what was written beside the end, trimmed. Never absent. */
  raw: string;
}

/** The first token of an end label: a bracketed group, or a run of non-space. */
const END_LABEL_HEAD = /^(\[[^\]]*\]|\S+)\s*([\s\S]*)$/;

/**
 * `0..* items` → a multiplicity and a role; `- owner` → a private role.
 *
 * MULTIPLICITY FIRST, and only from the leading token: §11.5.4 places both a
 * name and a range beside the end with no separator between them, so something
 * has to decide which half is which, and the leading token is the half that can
 * be decided WITHOUT guessing — `0..*`, `1`, `*` and `[0..1]` are a closed
 * grammar (§7.5.4), and a word is not. A leading token that does not parse as a
 * range therefore stays part of the name, which is what keeps `1st choice` an
 * end called "1st choice" rather than a multiplicity of one.
 *
 * The visibility marker is read on either side of the range — `- owner` and
 * `+ 0..1 a` both — because §11.5.4 lists the three adornments without fixing an
 * order between them, and an author who writes the marker first is writing the
 * order §9.5.4 uses for a property.
 *
 * Never throws and never returns nothing: an end label is free text an architect
 * typed beside a line, and the same degradation the rest of this module holds to
 * applies — a label the grammar recognises nothing in comes back as `{ raw }`
 * plus a role that is the whole of it.
 */
export function parseEndLabel(
  label: string | undefined | null
): UmlAssociationEnd {
  const raw = label === null || label === undefined ? '' : String(label).trim();
  if (!raw) return { raw: '' };

  let rest = raw;
  let visibility: UmlVisibility | undefined;
  let multiplicity: UmlMultiplicity | undefined;

  /** `+`, `-`, `#`, `~` off the front of what is left, once. */
  const takeVisibility = (): void => {
    if (visibility !== undefined) return;
    const marker = VISIBILITY_MARKER.exec(rest);
    if (!marker) return;
    const read = visibilityOf(marker[1]);
    if (!read) return;
    visibility = read;
    rest = rest.slice(marker[0].length).trim();
  };

  /** The leading token as a range, and consumed only if it is one. */
  const takeMultiplicity = (): void => {
    const head = END_LABEL_HEAD.exec(rest);
    if (!head) return;
    const read = parseMultiplicity(head[1]);
    if (!read) return;
    multiplicity = read;
    rest = head[2].trim();
  };

  takeMultiplicity();
  takeVisibility();
  // `+ 0..1 a`: the marker was in front of the range, so the range is only now
  // the leading token.
  if (!multiplicity) takeMultiplicity();
  takeVisibility();

  const role = rest.trim();
  return {
    ...(multiplicity ? { multiplicity } : {}),
    ...(role ? { role } : {}),
    ...(visibility ? { visibility } : {}),
    raw,
  };
}

/** The glyph §7.4 gives a VisibilityKind — the inverse of {@link visibilityOf}. */
export function visibilityMarker(visibility: UmlVisibility): string {
  switch (visibility) {
    case 'public':
      return '+';
    case 'private':
      return '-';
    case 'protected':
      return '#';
    case 'package':
      return '~';
  }
}

/**
 * §7.5.4's range, spelled the way a diagram spells it — `1`, `0..1`, `0..*`.
 *
 * Only ONE of the clause's two abbreviations is used: an exact range is written
 * as the single bound (`1..1` is `1`, which is how every diagram in the
 * specification writes it), and an unbounded one is written in full (`0..*`
 * rather than the bare `*` §7.5.4 also permits). The asymmetry is deliberate —
 * `*` is the spelling that reads as "unfinished" beside a line, and the full
 * form is what PlantUML, Papyrus and draw.io all print. Both parse back to the
 * same record, so nothing is lost either way; this is the one that is read.
 */
export function formatMultiplicity(multiplicity: UmlMultiplicity): string {
  const { lower, upper } = multiplicity;
  if (lower === upper) return String(upper);
  return `${lower}..${upper}`;
}

/**
 * An end's adornments, back in one string — `0..* -items`.
 *
 * The inverse of {@link parseEndLabel}, in §11.5.4's own order: the range, then
 * the visibility glyph, then the name. An end the grammar read nothing
 * structural out of prints its {@link UmlAssociationEnd.raw} instead, so a label
 * this module does not understand still comes back exactly as it was typed —
 * the whole point of keeping `raw`.
 */
export function formatEndLabel(end: UmlAssociationEnd): string {
  const parts: string[] = [];
  if (end.multiplicity) parts.push(formatMultiplicity(end.multiplicity));
  const marker = end.visibility ? visibilityMarker(end.visibility) : '';
  if (end.role) parts.push(`${marker}${end.role}`);
  else if (marker) parts.push(marker);
  return parts.length > 0 ? parts.join(' ') : end.raw;
}

/* ── Behaviour: the transition label (§14.2.4.8) and its triggers (§13.3.4) ─ */

/**
 * WHICH of §13.3.4's five notations a trigger is written in.
 *
 * `call-or-signal` is one value for two metaclasses, and the specification is
 * the reason: "SignalEvent triggers and CallEvent triggers are not
 * distinguishable by syntax and must be discriminated by their declaration
 * elsewhere" (§14.2.4.8). A canvas holds no such declaration, so a parser that
 * returned one of the two would be inventing the half of the fact the notation
 * does not carry. The XMI writer therefore mints the one metaclass that is true
 * of both readings, and the drawing keeps what the author typed.
 */
export type UmlTriggerKind =
  | 'call-or-signal'
  | 'any-receive'
  | 'change'
  | 'relative-time'
  | 'absolute-time';

/** One `<trigger>` of §13.3.4, classified and kept whole. */
export interface UmlTrigger {
  kind: UmlTriggerKind;
  /** The trigger as the author wrote it, trimmed — what a writer prints back. */
  text: string;
  /**
   * What follows the KEYWORD: `5 seconds` after an `after`, `Jan 1` after an
   * `at`, `stock = 0` after a `when`. Absent for `all`, which has no argument,
   * and for a call or signal event, whose payload is {@link UmlTrigger.name}.
   */
  expression?: string;
  /** The Operation's or the Signal's name — a call or signal event only. */
  name?: string;
  /** `(a, b)`'s contents, verbatim — §13.3.4's `<assignment-specification>`. */
  assignment?: string;
}

/** `after` / `at` / `when`, as a leading keyword of a trigger. */
const TRIGGER_KEYWORD = /^(after|at|when)\b\s*/i;

/**
 * One trigger, classified per §13.3.4.
 *
 * Total and never throwing, exactly like every parser above it: a word the
 * clause has no notation for is a `call-or-signal`, which is the reading
 * §14.2.4.8 itself gives to an undecorated name. So the fallback is the
 * specification's own default rather than an error state.
 *
 * The keywords are matched case-insensitively and reported LOWERCASE in
 * {@link UmlTrigger.kind} while {@link UmlTrigger.text} keeps the author's
 * capitals: the classification is a fact about the notation, the text is a fact
 * about the drawing, and neither should be made to speak for the other.
 */
export function parseTrigger(raw: string): UmlTrigger {
  const text = raw.trim();

  // §13.3.4: "Any AnyReceiveEvent is denoted by `all`". A bare word, and the
  // only trigger with nothing after it.
  if (text.toLowerCase() === 'all') return { kind: 'any-receive', text };

  const keyword = TRIGGER_KEYWORD.exec(text);
  if (keyword) {
    const word = keyword[1].toLowerCase();
    const expression = text.slice(keyword[0].length).trim();
    const kind: UmlTriggerKind =
      word === 'when'
        ? 'change'
        : word === 'after'
          ? 'relative-time'
          : 'absolute-time';
    // `after` with nothing after it is a keyword somebody is still typing: the
    // kind is what the word says, and the expression is simply not stated yet.
    return { kind, text, ...(expression ? { expression } : {}) };
  }

  // `<name> ['(' [<assignment-specification>] ')']` — §13.3.4's call and signal
  // events, which share one syntax and are told apart nowhere on a drawing.
  const open = text.indexOf('(');
  if (open >= 0 && text.endsWith(')')) {
    const name = text.slice(0, open).trim();
    const assignment = text.slice(open + 1, -1).trim();
    return {
      kind: 'call-or-signal',
      text,
      ...(name ? { name } : {}),
      ...(assignment ? { assignment } : {}),
    };
  }
  return {
    kind: 'call-or-signal',
    text,
    ...(text ? { name: text } : {}),
  };
}

/**
 * The inside of a `[…]` guard — `undefined` when there is nothing in it.
 *
 * The brackets are OPTIONAL on the way in, for the same reason
 * {@link parseMultiplicity} strips its own: the same guard is written both ways
 * depending on where it sits. §15.2.4 puts an activity edge's guard in brackets
 * beside the line and §14.2.4.8 puts a transition's in brackets inside the
 * label, while a caller that has already split a label on its brackets holds the
 * bare expression. One parser, both call sites.
 */
export function parseGuard(raw: string | undefined | null): string | undefined {
  if (raw === null || raw === undefined) return undefined;
  const inner = String(raw).trim().replace(/^\[/, '').replace(/\]$/, '').trim();
  return inner ? inner : undefined;
}

/** A transition label, as §14.2.4.8's three optional parts. */
export interface UmlTransitionLabel {
  /** `<trigger> [',' <trigger>]*`, in order, each trimmed and verbatim. */
  triggers: string[];
  /** `'[' <guard> ']'`, without its brackets. */
  guard?: string;
  /** `'/' <behavior-expression>` — an expression, kept exactly as written. */
  effect?: string;
}

/**
 * The index of the first character at BRACKET DEPTH ZERO that satisfies a test,
 * from `start` — `-1` when there is none.
 *
 * Depth-counted over `[`, `(` and `{` together, which is what makes the three
 * parts of a transition label separable at all: a guard holds `[a/b > 1]` and a
 * call event holds `raise(a, b)`, so a naive `indexOf('/')` cuts one of them in
 * half. The same discipline {@link matchingParen} and {@link splitParameters}
 * already hold for an operation line.
 */
function indexAtTopLevel(
  text: string,
  start: number,
  test: (char: string) => boolean
): number {
  let depth = 0;
  for (let index = start; index < text.length; index++) {
    const char = text[index];
    // Tested BEFORE the depth is adjusted, so that an OPENING bracket can be
    // what is looked for: the guard's own `[` is at depth zero, and a version
    // that counted it first would never see one.
    if (depth === 0 && test(char)) return index;
    if (char === '[' || char === '(' || char === '{') depth++;
    else if (char === ']' || char === ')' || char === '}') depth--;
  }
  return -1;
}

/** A top-level split on `,` — the `<trigger> [',' <trigger>]*` of §14.2.4.8. */
function splitTriggers(list: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let current = '';
  for (const char of list) {
    if (char === '[' || char === '(' || char === '{') depth++;
    else if (char === ']' || char === ')' || char === '}') depth--;
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

/**
 * One transition label, per §14.2.4.8:
 *
 * `[<trigger> [',' <trigger>]*] ['[' <guard> ']'] ['/' <behavior-expression>]`
 *
 * Every part is optional and an empty label is a legal transition — §14.2.4.8's
 * outermost brackets say so, and a completion transition (one that fires when
 * its source state finishes) is written with no label at all. So the empty
 * string parses to `{ triggers: [] }` rather than to a trigger named nothing.
 *
 * ## Read left to right, and anchored on the GUARD
 *
 * The guard is the only part with a delimiter at both ends, so it is found
 * first: the first top-level `[` opens it and its matching `]` closes it.
 * Everything before is the trigger list, and the first top-level `/` after it
 * opens the effect. A label with no guard splits on its first top-level `/`
 * instead, which is the same rule with the anchor missing.
 *
 * ## The one degradation, stated
 *
 * A bare change event holding a slash — `when x/2 > 1`, with no guard and no
 * effect — reads its `/` as the effect separator and comes back as the trigger
 * `when x` with the effect `2 > 1`. §13.3.4's `<value-specification>` is an
 * arbitrary expression and the notation gives it no delimiters, so no reading of
 * a flat string can tell the two apart; bracketing the expression, which is
 * legal, resolves it. Stated here rather than discovered in an export.
 */
export function parseTransition(
  label: string | undefined | null
): UmlTransitionLabel {
  const text =
    label === null || label === undefined ? '' : String(label).trim();
  if (!text) return { triggers: [] };

  const guardOpen = indexAtTopLevel(text, 0, char => char === '[');
  let head = text;
  let guard: string | undefined;
  let tail = '';

  if (guardOpen >= 0) {
    // The matching `]` — depth-counted from the `[` itself, so a guard holding
    // an indexed expression (`[a[0] > 1]`) closes where the author closed it.
    let depth = 0;
    let guardClose = -1;
    for (let index = guardOpen; index < text.length; index++) {
      const char = text[index];
      if (char === '[') depth++;
      else if (char === ']') {
        depth--;
        if (depth === 0) {
          guardClose = index;
          break;
        }
      }
    }
    head = text.slice(0, guardOpen);
    if (guardClose >= 0) {
      guard = parseGuard(text.slice(guardOpen + 1, guardClose));
      tail = text.slice(guardClose + 1);
    } else {
      // An unclosed `[` is a guard somebody is still typing. Everything after it
      // is the guard, and there is no effect to find.
      guard = parseGuard(text.slice(guardOpen + 1));
      tail = '';
    }
  } else {
    const slash = indexAtTopLevel(text, 0, char => char === '/');
    if (slash >= 0) {
      head = text.slice(0, slash);
      tail = text.slice(slash);
    }
  }

  let effect: string | undefined;
  const slash = indexAtTopLevel(tail, 0, char => char === '/');
  if (slash >= 0) {
    const written = tail.slice(slash + 1).trim();
    if (written) effect = written;
  }

  return {
    triggers: splitTriggers(head),
    ...(guard ? { guard } : {}),
    ...(effect ? { effect } : {}),
  };
}

/* ── Behaviour: the activity edge's annotations (§15.2.4) ─────────────────── */

/** What an activity edge's label says — §15.2.4's name, guard and weight. */
export interface UmlActivityEdgeLabel {
  /** The edge's own name, "notated near the arrow" (§15.2.4). */
  name?: string;
  /** "Guards are shown as text in square brackets near tail of the line." */
  guard?: string;
  /**
   * `{weight = <value-specification>}`, as the VALUE alone.
   *
   * A string rather than a number because §15.2.4's own grammar admits `*` for
   * an unlimited weight and a ValueSpecification for everything else — an
   * expression, a constant, the name of a Property. The same call
   * {@link UmlMultiplicity} makes about `*`, one clause over.
   */
  weight?: string;
}

/** `{weight = 3}` — §15.2.4's `weight-annotation`, however it is spaced. */
const WEIGHT_ANNOTATION = /^weight\s*=\s*(.+)$/i;

/**
 * One activity edge's centre label, split into what §15.2.4 writes around a
 * line.
 *
 * Three annotations sharing one text, because this canvas gives a connector ONE
 * label (`docs/adr/0018`) where the notation places three things at three points
 * along the arrow. The delimiters are the notation's own — brackets for the
 * guard, braces for the weight — so an author who writes
 * `ready [stock > 0] {weight = 2}` gets all three read back, and one who writes
 * only a word gets a named edge.
 *
 * Whatever is left once the bracketed and braced groups are lifted out is the
 * NAME, which is why a label with no delimiters is a name and not a guard: a
 * guard is bracketed in §15.2.4 and inventing one from a bare word would put a
 * condition in a file that the drawing does not show.
 *
 * A braced group that is not a `weight-annotation` — `{stream}`, `{ordered}` —
 * is dropped rather than folded into the name: it is notation this pack does not
 * model, and gluing it onto the edge's name would rename the edge.
 */
export function parseActivityEdge(
  label: string | undefined | null
): UmlActivityEdgeLabel {
  const text =
    label === null || label === undefined ? '' : String(label).trim();
  if (!text) return {};

  let guard: string | undefined;
  let weight: string | undefined;

  let rest = text.replace(/\{([^}]*)\}/g, (_whole, group: string) => {
    const annotation = WEIGHT_ANNOTATION.exec(group.trim());
    if (annotation && weight === undefined) weight = annotation[1].trim();
    return ' ';
  });
  rest = rest.replace(/\[([^\]]*)\]/g, (_whole, group: string) => {
    if (guard === undefined) guard = parseGuard(group);
    return ' ';
  });

  const name = rest.replace(/\s+/g, ' ').trim();
  return {
    ...(name ? { name } : {}),
    ...(guard ? { guard } : {}),
    ...(weight ? { weight } : {}),
  };
}

/* ── Behaviour: a state's internal activities (§14.2.4.4) ─────────────────── */

/** Which of §14.2.4.4's three `<behavior-type-label>`s a line carries. */
export type UmlStateBehaviorKind = 'entry' | 'do' | 'exit';

/** One line of a state's internal activities compartment. */
export interface UmlStateBehavior {
  kind: UmlStateBehaviorKind;
  /**
   * `<behavior-expression>` — absent when the author wrote the label and no
   * expression, which is a line somebody is halfway through.
   */
  expression?: string;
}

/**
 * `entry / x`, `do / y`, `exit / z` — §14.2.4.4's internal activities.
 *
 * `undefined` for every other line, and that is what makes the reading safe: a
 * state's compartment holds internal TRANSITIONS too (§14.2.4.4's next
 * compartment, `{<trigger>}* ['[' <guard> ']'] [/<behavior-expression>]`) and
 * ordinary prose besides. Only the three labels the clause names are lifted out;
 * everything else stays a line of the compartment, which is what
 * {@link parseCompartment} already hands over.
 *
 * The separator is optional on the way in — `entry x` reads as `entry / x` —
 * because the slash is the one character of this syntax an author routinely
 * forgets, and the label alone is unambiguous about what the rest of the line
 * is.
 */
export function parseStateBehavior(line: string): UmlStateBehavior | undefined {
  const match = /^(entry|do|exit)\b\s*(?:\/\s*)?(.*)$/i.exec(line.trim());
  if (!match) return undefined;
  const expression = match[2].trim();
  return {
    kind: match[1].toLowerCase() as UmlStateBehaviorKind,
    ...(expression ? { expression } : {}),
  };
}

/* ── Behaviour: the labels, printed back ──────────────────────────────── */

/**
 * §15.2.4's three annotations, back in one string — `name [guard] {weight = w}`.
 *
 * The inverse of {@link parseActivityEdge}, and it lives beside it for the
 * reason every parser and printer pair should: the notation is one grammar, and
 * two files spelling it separately is how a guard comes back without its
 * brackets. Read by the PlantUML writer (which puts it on the arrow) and by the
 * importers' materializer (which puts it in the connector's centre label), so a
 * flow drawn from a file and one exported to one carry the same words.
 */
export function formatActivityEdgeLabel(label: UmlActivityEdgeLabel): string {
  const parts: string[] = [];
  if (label.name) parts.push(label.name);
  if (label.guard) parts.push(`[${label.guard}]`);
  if (label.weight) parts.push(`{weight = ${label.weight}}`);
  return parts.join(' ');
}

/**
 * §14.2.4.8's label, back in one string — `trigger1, trigger2 [guard] / effect`.
 *
 * The inverse of {@link parseTransition}, and a round trip rather than the
 * author's own text passed through: the model holds the parsed parts, and
 * printing them in the BNF's own order is what makes a label somebody typed
 * loosely — a guard before its trigger, a missing space — come out spelled the
 * way the clause spells it.
 */
export function formatTransitionLabel(label: UmlTransitionLabel): string {
  const parts: string[] = [];
  if (label.triggers.length > 0) parts.push(label.triggers.join(', '));
  if (label.guard) parts.push(`[${label.guard}]`);
  if (label.effect) parts.push(`/ ${label.effect}`);
  return parts.join(' ');
}

/* ── Strict checking: the same grammars, asked a yes/no question ─────────── */

/**
 * The STRICT half of this module, and the `label-syntax` rules' whole verdict.
 *
 * Everything above degrades: a line the grammar cannot see structure in comes
 * back as `{ name: <the line> }` and travels through the exporters as an element
 * named exactly what the author wrote. That is the right answer for a WRITER —
 * the picture keeps saying what it said — and it is no answer at all for a
 * CHECKER, which is being asked precisely whether the degradation happened.
 *
 * So the checkers below re-ask the same question with the opposite bias, and
 * they change nothing about the parsers: `parseProperty`, `parseOperation`,
 * `parseTransition` and `parseMultiplicity` return exactly what they returned
 * before this section existed, and the exporters read exactly what they read.
 *
 * ## The one rule every checker follows
 *
 * **A line is `ok: false` when the lenient parse LOST something.** Not when it
 * is terse, not when it omits an optional part — §9.5.4 makes everything but
 * `<name>` optional and a bare `balance` is a conformant Property — but when a
 * part the author actually WROTE is not in the record: a `:` with no type after
 * it, a `[…]` that is not a multiplicity range, an operation with no parameter
 * list, a `/` with no behaviour behind it. Those are the cases where the drawing
 * and the exported file stop saying the same thing, and they are the only ones
 * a user can act on.
 *
 * That rule is what keeps these checks honest about the specification. A stricter
 * reading — "an attribute must carry a type" — would indict a conformant line,
 * and the `provenance: 'standard'` these rules declare would be claiming UML
 * forbids what UML does not.
 *
 * ## The reason is a FRAGMENT, in English
 *
 * The engine prints it after the offending line (`validation.ts`
 * `evaluateLabelSyntax`), so the two read as one sentence. The framework owns
 * the word, as it owns every other `*Fallback` it ships.
 */
export interface UmlSyntaxCheck {
  /** The line is spelled the way the clause spells it. */
  ok: boolean;
  /** Why it is not, when it is not — see the header. */
  reason?: string;
}

/** The one `ok` value, shared so a checker never allocates on the happy path. */
const OK: UmlSyntaxCheck = { ok: true };

const bad = (reason: string): UmlSyntaxCheck => ({ ok: false, reason });

/**
 * Whether a line's `()`, `[]` and `{}` close in the order they opened.
 *
 * One depth over all three, exactly as {@link splitParameters} and
 * {@link indexAtTopLevel} count them: this module never needs to know WHICH
 * bracket is open, only that the line is still being typed. An unclosed group is
 * the single most common half-finished state of a compartment, and every parser
 * above has a documented degradation for it — which is why the checkers ask
 * about it FIRST and say nothing else about such a line.
 */
function unbalanced(text: string): boolean {
  let depth = 0;
  for (const char of text) {
    if (char === '(' || char === '[' || char === '{') depth++;
    else if (char === ')' || char === ']' || char === '}') {
      depth--;
      if (depth < 0) return true;
    }
  }
  return depth !== 0;
}

/**
 * The head of {@link parseProperty}'s peel, for diagnostics alone: the modifier
 * group and the default value lifted off, with what was found reported.
 *
 * Six lines duplicated from the parser rather than the parser refactored to
 * yield them, and deliberately: `parseProperty` is read by three exporters and
 * two importers, and a checker is not a reason to reshape it. The duplication is
 * pinned by `grammar.unit.spec.ts`, which asserts both halves against the same
 * lines.
 */
function peelPropertyTail(text: string): {
  rest: string;
  emptyModifierGroup: boolean;
  danglingDefault: boolean;
} {
  let rest = text;
  const modifierMatch = MODIFIER_GROUP.exec(rest);
  const emptyModifierGroup =
    modifierMatch !== null && modifiersOf(modifierMatch[1]).length === 0;
  if (modifierMatch) rest = rest.slice(0, modifierMatch.index).trim();

  const equals = rest.indexOf('=');
  const danglingDefault = equals >= 0 && rest.slice(equals + 1).trim() === '';
  if (equals >= 0) rest = rest.slice(0, equals).trim();

  return { rest, emptyModifierGroup, danglingDefault };
}

/**
 * One attribute line, checked against §9.5.4 —
 * `[<visibility>] ['/'] <name> [':' <type>] ['[' <mult> ']'] ['=' <default>]
 * ['{' <modifiers> '}']`.
 *
 * Built on {@link parseProperty} and changing nothing about it. An empty line is
 * `ok`: the family that calls this never passes one, and a total function is
 * easier to reason about than one with a precondition.
 *
 * ## The parenthesis case, and why it is worth its own sentence
 *
 * `place(order)` typed into the ATTRIBUTES compartment is the single most common
 * mistake this rule catches, and it is not a spelling mistake — it is a line in
 * the wrong box. The check runs on what is left once the default value is peeled
 * off, so `origin : Point = Point(0, 0)` keeps its parentheses and its silence.
 */
export function checkPropertyLine(line: string): UmlSyntaxCheck {
  const text = line.trim();
  if (!text) return OK;
  if (unbalanced(text)) return bad('a bracket is never closed');

  const { rest, emptyModifierGroup, danglingDefault } = peelPropertyTail(text);
  if (emptyModifierGroup) return bad('the { } group is empty');
  if (danglingDefault) return bad('nothing follows the "="');
  if (rest.includes('(')) {
    return bad(
      'this is an operation — it belongs in the operation compartment'
    );
  }

  const multiplicityMatch = MULTIPLICITY_GROUP.exec(rest);
  if (
    multiplicityMatch &&
    parseMultiplicity(multiplicityMatch[1]) === undefined
  ) {
    return bad('the [ ] multiplicity is not a range — write 1, 0..1 or 0..*');
  }

  const head = multiplicityMatch
    ? rest.slice(0, multiplicityMatch.index).trim()
    : rest;
  const colon = head.indexOf(':');
  if (colon >= 0 && head.slice(colon + 1).trim() === '') {
    return bad('nothing follows the ":"');
  }

  if (parseProperty(text).name === '') return bad('there is no name');
  return OK;
}

/** One `<parameter>` of §9.4.4, on the same contract as its line. */
function checkParameter(raw: string): UmlSyntaxCheck {
  const { rest, emptyModifierGroup, danglingDefault } = peelPropertyTail(
    raw.trim()
  );
  if (emptyModifierGroup) return bad('a parameter’s { } group is empty');
  if (danglingDefault) return bad('nothing follows a parameter’s "="');

  const multiplicityMatch = MULTIPLICITY_GROUP.exec(rest);
  if (
    multiplicityMatch &&
    parseMultiplicity(multiplicityMatch[1]) === undefined
  ) {
    return bad('a parameter’s [ ] multiplicity is not a range');
  }

  const head = multiplicityMatch
    ? rest.slice(0, multiplicityMatch.index).trim()
    : rest;
  const colon = head.indexOf(':');
  if (colon >= 0 && head.slice(colon + 1).trim() === '') {
    return bad('nothing follows a parameter’s ":"');
  }
  if (parseParameter(raw).name === '') return bad('a parameter has no name');
  return OK;
}

/**
 * One operation line, checked against §9.6.4 —
 * `[<visibility>] <name> '(' [<parameter-list>] ')' [':' [<return-type>]
 * ['[' <mult> ']'] ['{' <oper-property>* '}']]`.
 *
 * Built on {@link parseOperation} and changing nothing about it. This is the one
 * checker with a genuine FALL-BACK to report: a line with no parentheses is not
 * an operation the grammar can see at all, and `parseOperation` says so by
 * returning the whole line as a name. An author halfway through typing `place`
 * gets that silence from the rule's `audit` severity, not from the grammar.
 */
export function checkOperationLine(line: string): UmlSyntaxCheck {
  const text = line.trim();
  if (!text) return OK;
  if (unbalanced(text)) return bad('a bracket is never closed');

  const open = text.indexOf('(');
  if (open < 0) {
    return bad('there is no ( ) parameter list — write name(…) : Type');
  }
  const close = matchingParen(text, open);
  if (close < 0) return bad('the ( is never closed');

  const head = text.slice(0, open).trim();
  const withoutVisibility = head.replace(VISIBILITY_MARKER, '').trim();
  if (withoutVisibility === '') return bad('there is no name');

  let tail = text.slice(close + 1).trim();
  const modifierMatch = MODIFIER_GROUP.exec(tail);
  if (modifierMatch && modifiersOf(modifierMatch[1]).length === 0) {
    return bad('the { } group is empty');
  }
  if (modifierMatch) tail = tail.slice(0, modifierMatch.index).trim();

  if (tail !== '') {
    if (!tail.startsWith(':')) {
      return bad('the text after the ) is neither ": Type" nor a { } group');
    }
    let returns = tail.slice(1).trim();
    const multiplicityMatch = MULTIPLICITY_GROUP.exec(returns);
    if (
      multiplicityMatch &&
      parseMultiplicity(multiplicityMatch[1]) === undefined
    ) {
      return bad('the [ ] multiplicity is not a range — write 1, 0..1 or 0..*');
    }
    if (multiplicityMatch) {
      returns = returns.slice(0, multiplicityMatch.index).trim();
    }
    if (returns === '') return bad('nothing follows the ":"');
  }

  for (const parameter of splitParameters(text.slice(open + 1, close))) {
    const verdict = checkParameter(parameter);
    if (!verdict.ok) return verdict;
  }
  return OK;
}

/**
 * One transition label, checked against §14.2.4.8 —
 * `[<trigger> [',' <trigger>]*] ['[' <guard> ']'] ['/' <behavior-expression>]`.
 *
 * Built on {@link parseTransition} and changing nothing about it. An EMPTY label
 * is `ok` and that is the clause's own reading: a completion transition — one
 * that fires when its source state finishes — is written with no label at all,
 * so a rule indicting the empty string would indict half the state machines ever
 * drawn.
 *
 * The parser's two documented tolerances are exactly what this reports: an
 * unclosed `[` ("a guard somebody is still typing") and a `/` with nothing
 * behind it.
 */
export function checkTransitionLabel(
  label: string | undefined | null
): UmlSyntaxCheck {
  const text =
    label === null || label === undefined ? '' : String(label).trim();
  if (!text) return OK;
  if (unbalanced(text)) return bad('a bracket is never closed');

  const guardOpen = indexAtTopLevel(text, 0, char => char === '[');
  let head = text;
  let tail = '';
  if (guardOpen >= 0) {
    let depth = 0;
    let guardClose = -1;
    for (let index = guardOpen; index < text.length; index++) {
      const char = text[index];
      if (char === '[') depth++;
      else if (char === ']') {
        depth--;
        if (depth === 0) {
          guardClose = index;
          break;
        }
      }
    }
    head = text.slice(0, guardOpen);
    tail = text.slice(guardClose + 1);
    if (parseGuard(text.slice(guardOpen + 1, guardClose)) === undefined) {
      return bad('the [ ] guard is empty');
    }
  } else {
    const slash = indexAtTopLevel(text, 0, char => char === '/');
    if (slash >= 0) {
      head = text.slice(0, slash);
      tail = text.slice(slash);
    }
  }

  const slash = indexAtTopLevel(tail, 0, char => char === '/');
  if (slash >= 0 && tail.slice(slash + 1).trim() === '') {
    return bad('nothing follows the "/"');
  }
  if (slash < 0 && tail.trim() !== '') {
    return bad('the text after the guard is neither a "/" effect nor nothing');
  }

  // `a,,b` — the parser drops the empty part and the file loses a trigger the
  // author typed a comma for.
  if (head.trim() !== '') {
    let depth = 0;
    let current = '';
    const parts: string[] = [];
    for (const char of head) {
      if (char === '[' || char === '(' || char === '{') depth++;
      else if (char === ']' || char === ')' || char === '}') depth--;
      if (char === ',' && depth === 0) {
        parts.push(current);
        current = '';
        continue;
      }
      current += char;
    }
    parts.push(current);
    if (parts.some(part => part.trim() === '')) {
      return bad('a trigger between two commas is empty');
    }
  }
  return OK;
}

/**
 * One multiplicity, checked against §7.5.4 — `[<lower> '..'] <upper>`, brackets
 * optional.
 *
 * The thinnest of the four: {@link parseMultiplicity} already answers
 * `undefined` for everything that is not a range, so this is that answer with a
 * sentence attached. The one case worth naming is the SYMBOLIC range — `n..m` is
 * legal UML and parses to `undefined` here on purpose (the module's callers write
 * integer bounds into files, and inventing one for `n` would be a fact the author
 * never stated), so the reason says what the writers can hold rather than what
 * the specification permits.
 */
export function checkMultiplicity(raw: string): UmlSyntaxCheck {
  const text = raw.trim();
  if (!text) return OK;
  if (parseMultiplicity(text) !== undefined) return OK;
  return bad(
    'this is not a multiplicity — write 1, 0..1, 0..* or *, with whole numbers'
  );
}

/**
 * A token that is UNAMBIGUOUSLY an attempt at §7.5.4's range: it opens with a
 * digit or a `*`, and it is either all digits and stars or it carries the `..`
 * of a range.
 *
 * The gate exists because §11.5.4 puts the range and the end's NAME side by side
 * with no separator, so the only thing that tells them apart is the shape of the
 * leading token — {@link parseEndLabel} says exactly that, and a checker must
 * not be stricter than the parser it checks. `1st choice` is an end called "1st
 * choice" there and stays one here; `1..n` is a range with a symbolic bound,
 * which this module's writers cannot hold, and is reported.
 */
const RANGE_ATTEMPT = /^(?:[\d*][\d*]*|[\d*][^\s]*\.\.[^\s]*)$/;

/**
 * The multiplicity an ASSOCIATION END's label opens with, when it opens with one
 * at all — §11.5.4 beside §7.5.4.
 *
 * Reads the label exactly as {@link parseEndLabel} does (visibility marker off
 * the front, then the leading token, brackets optional) and then asks
 * {@link checkMultiplicity} about that token — but only when the token is an
 * attempt at a range. Everything else on an end label is the ROLE name, which is
 * free text and has no syntax to be wrong about.
 *
 * So `0..*`, `1`, `[0..1]` and `0..* items` are silent, `1..n` and `0...*` are
 * reported, and `items`, `- owner` and `1st choice` are none of this rule's
 * business.
 */
export function checkEndLabelMultiplicity(
  label: string | undefined | null
): UmlSyntaxCheck {
  const raw = label === null || label === undefined ? '' : String(label).trim();
  if (!raw) return OK;

  const withoutVisibility = raw.replace(VISIBILITY_MARKER, '').trim();
  const head = END_LABEL_HEAD.exec(withoutVisibility);
  if (!head) return OK;

  const token = head[1].replace(/^\[/, '').replace(/\]$/, '').trim();
  if (!RANGE_ATTEMPT.test(token)) return OK;
  return checkMultiplicity(token);
}
