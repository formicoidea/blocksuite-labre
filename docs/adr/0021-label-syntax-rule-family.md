# ADR 0021 — `label-syntax`: a rule family whose verdict is a parser

- Status: **accepted** (September 2026)
- Deciders: Mathieu Jolly
- Milestone: UML 2.5.1, tranche H
- Related ADRs:
  [0015](0015-rule-dependency-scope.md) (a family declares what its verdict
  depends on — this one's line, and the argument for it),
  [0009](0009-reversed-flag-contract.md) (rules ship with the tooling: a flag
  off means no finding and no parser call),
  [0017](0017-uml-one-framework-with-diagram-kinds.md) (the framework these
  four rules belong to),
  [0020](0020-connector-end-labels.md) (the per-end labels the multiplicity
  rule reads).

## Context

Every rule family in `packages/affine/blocks/surface/src/extensions/validation.ts`
is a TABLE the engine interprets: a matrix of allowed endpoint triplets, a set
of zone ids, a pair of bounds, a palette, a level and the roles it forbids. That
is what has let seven packs ship sixty-odd rules without the engine learning a
single notation, and it is the claim `docs/add-a-framework` makes about the
seam.

UML broke it. The pack already ships `gfx/uml/src/grammar.ts` — seven BNFs
transcribed from the specification, written for the exporters — and the first
thing a UML author asks of a checker is the one thing those BNFs answer: **is
this compartment line spelled the way §9.5.4 spells it?** `label-presence`
(the family C4 and BPMN opened) asks whether the artefact says anything at all.
It cannot ask whether what it says parses, and no amount of declarative data is
going to express

```
[<visibility>] ['/'] <name> [':' <prop-type>] ['[' <mult> ']'] ['=' <default>]
  ['{' <prop-modifier> [',' <prop-modifier>]* '}']
```

as a table. A declarative encoding of it is a parser generator shipped inside a
validation engine, for one clause of one specification, with a second dialect
arriving with every notation after it.

## Decision

**A sixteenth family, `label-syntax`, whose declaration carries the framework's
own parse FUNCTION, and whose evaluator owns only the walk.**

```ts
interface LabelSyntaxDef {
  parse: (line: string) => { ok: boolean; reason?: string };
  perLine?: boolean; // default true
  target?: 'center-label' | 'source-label' | 'target-label' | 'end-labels';
}
```

The family — `evaluateLabelSyntax`, written against `evaluateLabelPresence`
line for line — resolves subjects by `appliesTo` through `roleIsA`, reads the
label `target` names, cuts it into lines, drops the lines that are notation,
asks `parse` about each, and raises ONE finding per offending element attributed
to the frame `backgroundRole` names. Everything that decides a verdict is in the
function the framework shipped.

`RULE_SCOPES['label-syntax'] = 'element'`.

### The per-line contract

- `perLine` defaults to `true`: the label is a LIST and each line is judged on
  its own — a compartment of attributes, a compartment of operations.
- `perLine: false`: the label is ONE expression and a newline inside it is still
  part of it — a transition's `trigger [guard] / effect`, an end's `0..*`.
- Either way, two kinds of line are dropped because in both readings they are
  notation rather than content: a **blank** line (spacing) and an **ellipsis**,
  `...` or `…`, which is §9.2.4's elision marker. A rule indicting an ellipsis
  would be indicting the author for having said that something is not shown.
- A label with no visible line is silence. "This artefact says nothing" is
  `label-presence`'s question, and a framework that wants both asks with two
  rules.
- Invisible code points are stripped before the cut, exactly as `elementLabel`
  strips them, so a line the reader cannot see is never quoted back at them.

### `'element'`, and the ADR 0015 argument

The verdict is the framework's parser applied to the subject's own words.
Nothing about the neighbourhood takes part: a compartment is right or wrong
whatever is drawn beside it, and an end label is read off the connector that
carries it rather than off what the connector joins. That is the same evidence
`label-presence` has, which is already `'element'`, and the frame is attribution
only — a dirty frame forces a full pass anyway, so frames are free at this level.

Over-approximating is always safe and under-approximating is a stale verdict, so
the question was asked the other way round: what could change a verdict without
changing the subject? Nothing that we could name. A rule that reads more than
this — a name that must match the zone it sits in, say — widens on itself
(`ValidationRule.scope`), which is exactly the escape hatch ADR 0015 provides.

### Why the parser belongs to the framework, and not to the engine

Three reasons, in order of weight.

1. **The engine names no notation.** A grammar in `validation.ts` would be
   §9.5.4 living in a file that must not know what UML is. The rule survives
   because the rule is what has kept seven packs from leaking into the engine.
2. **The framework already has one.** `grammar.ts` is that grammar, written for
   the exporters. A rule that calls it is a rule that can never disagree with
   the file the same diagram exports to: a finding is exactly the line that will
   export short. No other family in this library can make that claim.
3. **A parser is not data.** Encoding one declaratively is a parser generator,
   and the second notation would need a different one.

### What it costs, and the answer

A rule of this family is **not serializable**. Every other rule in this library
is plain data a host could ship over a wire; this one holds a closure, and a
round trip through JSON loses it.

The family answers that the way it answers a malformed declaration anywhere
else: a rule whose `parse` is not a function evaluates **nothing** and warns
once. Passing every line would be the dangerous answer — a compartment nobody
checks that reports itself checked. Nothing in this library serializes a rule
today, and the day something does, the fifteen families that carry only data
keep working.

### The known limit: the line is in the FALLBACK, not in the key

A finding carries no message parameters. So the offending line and the parser's
reason are appended to the rule's own `messageFallback` — "This line is not an
attribute: “balance :” — nothing follows the ":"." — and a host that ships a
catalogue for `messageKey` gets the rule's sentence without the line.

Recorded rather than worked around: inventing a parameter channel for one family
is a change to every family's contract, and the fallback is what every host
reads today. The quotation is capped at 80 characters, because a pasted
paragraph must not set the width of a bubble.

### The finding names the TEXT element, and not its group

A UML compartment belongs to a group, and the mark is drawn on that group
already (`anchorOf`). `Violation.elementIds` keeps naming the elements actually
at fault; the group carries no role, is never evaluated, and by that documented
contract never appears in a finding. The compartment is also the element the
author edits, which is the other half of the reason.

### `'end-labels'`

§11.5.4 puts the same grammar at BOTH ends of an association. A rule naming one
end could only ever check half of every line drawn, and two rules would be two
ids, two sentences and two lines in every profile table for one requirement. So
`'end-labels'` reads the two ends as two LINES of one subject: each is judged on
its own by the per-line walk, and the finding quotes whichever one is wrong.

## The first four rules

All four are UML's, all four are `audit` (so on-demand, PF7.6), all four are
`provenance: 'standard'` — they are the only clauses in the pack quoted as
productions rather than as sentences — and `uml.strict` promotes all four.

| rule                      | subject                               | clause    | checker                     |
| ------------------------- | ------------------------------------- | --------- | --------------------------- |
| `uml.attribute-syntax`    | `uml:attributes`, per line            | §9.5.4    | `checkPropertyLine`         |
| `uml.operation-syntax`    | `uml:operations`, per line            | §9.6.4    | `checkOperationLine`        |
| `uml.transition-syntax`   | `uml:transition`, centre label, whole | §14.2.4.8 | `checkTransitionLabel`      |
| `uml.multiplicity-syntax` | `uml:association`, both end labels    | §7.5.4    | `checkEndLabelMultiplicity` |

`uml.multiplicity-syntax` reaches aggregation and composition for free: they
specialise `uml:association`, because §11.5.4 makes the aggregation kind a
property of an association END rather than a different relationship.

### The one rule the checkers follow, and why `standard` stays honest

**A line is reported only when the LENIENT parse lost something the author
wrote.** Not when it is terse: §9.5.4 makes everything but `<name>` optional, so
a bare `balance` is a conformant Property and a checker requiring a type would
indict it — and the `provenance: 'standard'` these rules declare would be
claiming UML forbids what UML does not.

So `checkPropertyLine` fires on a `:` with no type after it, a `[…]` that is not
a multiplicity range, an unclosed bracket, an empty name, an operation typed into
the attribute compartment. `checkOperationLine` fires on a line with no
parameter list — the fall-back `parseOperation` itself documents. And
`checkEndLabelMultiplicity` is silent about role names altogether, including
`1st choice`, because `parseEndLabel` keeps that as a name: **a checker is never
stricter than the parser it checks.**

The strict checkers are new functions beside the lenient ones. `parseProperty`,
`parseOperation`, `parseTransition` and `parseMultiplicity` return exactly what
they returned before, and the exporters read exactly what they read.

## Consequences

- **The engine still names no notation.** It gained a function-shaped field and
  a walk; `validation.ts` contains no clause of any specification.
- **A framework's checker and its exporter cannot drift**, because they are the
  same module. That is a property no other family has, and the reason this one
  is worth a sixteenth entry in `RULE_FAMILIES`.
- **`text` becomes verdict-bearing for a real-time rule of this family too**
  (`verdictPropsOf`). Every rule shipped today is `audit`, hence on-demand,
  hence off the drawing path entirely — which is deliberate: these read ALL of
  the words, line by line, and a real-time rule would re-run four parsers on
  every keystroke in every compartment on the sheet.
- **A framework declaring this family must ship a pure, total parser.** The
  evaluator does not wrap the call in a `try`: a parser that throws is a bug in
  the framework, and swallowing it would turn a crash into a silently unchecked
  compartment.
- **No persisted data, no schema change.** The family lives on a rule
  declaration, which is code a framework ships — never a document. Older
  documents are byte-identical and open unchanged.
