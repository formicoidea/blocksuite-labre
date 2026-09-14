import { parseCompartment } from './grammar.js';
import {
  type UmlClassifier,
  type UmlModel,
  type UmlNodeBase,
  type UmlRelation,
  umlCentreInside,
} from './model.js';

/**
 * One diagram as **PlantUML** source (https://plantuml.com/class-diagram).
 *
 * ## Why PlantUML beside XMI
 *
 * They answer different questions. XMI is what a MODELLING TOOL reads — it
 * carries the metamodel, and no human opens it. PlantUML is what a repository
 * reads: it goes in a `docs/` folder beside the code, it diffs line by line in a
 * review, and the architect who wrote the diagram can still read it a year
 * later. A framework that only exported XMI would be a framework whose diagrams
 * cannot live in version control.
 *
 * ## What it writes, and what it declines to
 *
 * No `skinparam`, not one line. A `skinparam` is a THEME, and a theme baked into
 * an exported file overrides whatever the repository it lands in has decided
 * about how its diagrams look — silently, and in every diagram, forever. Labre's
 * canvas colours are Labre's; the file carries the model.
 *
 * Member lines are written back VERBATIM, and that is a decision rather than
 * laziness: PlantUML's member syntax IS UML's own §9.5.4 / §9.6.4 notation, the
 * same grammar the author typed in the compartment. Re-spelling a parsed
 * property could only lose what the parser did not model — a constraint, an
 * unusual modifier, a qualified redefinition — so the parser is used where
 * PlantUML needs STRUCTURE it cannot infer (an enumeration's literals, an
 * object's slots) and nowhere else.
 *
 * ## Pure
 *
 * A model in, a string out. No `std`, no DOM, no clock — `docs/adr/0012` P3.
 */

/* ── Identifiers ──────────────────────────────────────────────────────── */

/**
 * An alias — the identifier every declaration takes and every relation refers
 * back to.
 *
 * Derived from the NAME rather than from the surface id, because an alias is
 * READ: `customer --> order` says what it relates and `_x7fQa --> _9bTz1` says
 * nothing at all to the person who opens the file. The folding is deliberately
 * lossy — ASCII only, since PlantUML's bare identifier is a word and a unicode
 * one needs quoting everywhere — and the NAME is preserved separately, in the
 * quoted label every declaration carries.
 */
export function toPlantumlAlias(raw: string): string {
  let out = '';
  for (const char of raw.toLowerCase()) {
    out += /[a-z0-9_]/.test(char) ? char : '_';
  }
  out = out.replaceAll(/_{2,}/g, '_').replace(/^_+/, '').replace(/_+$/, '');
  if (out.length === 0) return 'e';
  // An identifier may not open on a digit, and `e_` — for "element" — rather
  // than a bare `_`, so two names one digit apart stay one character apart.
  return /^\d/.test(out) ? `e_${out}` : out;
}

/** Mints document-unique aliases, and remembers what it minted. */
class AliasMinter {
  readonly #taken = new Set<string>();

  mint(name: string): string {
    const base = toPlantumlAlias(name);
    if (!this.#taken.has(base)) {
      this.#taken.add(base);
      return base;
    }
    let n = 2;
    while (this.#taken.has(`${base}_${n}`)) n++;
    const unique = `${base}_${n}`;
    this.#taken.add(unique);
    return unique;
  }
}

/* ── Text ─────────────────────────────────────────────────────────────── */

/**
 * A label, as something PlantUML can carry inside `"…"`.
 *
 * Two transformations, and both are a thing the grammar cannot express:
 *
 * - **a line break becomes `\n`**, PlantUML's own escape. A declaration is one
 *   line and a canvas label routinely is not — it is how a class name fits in
 *   its box — so a raw newline would end the statement halfway through;
 * - **`"` becomes `'`**, because PlantUML has no escape for a double quote
 *   inside a quoted label: the first one ENDS it, and the rest of the line is
 *   read as syntax.
 *
 * Nothing else is touched. Accents, CJK and emoji go through unharmed: they are
 * text, PlantUML carries text, and folding them would be this exporter
 * rewriting somebody's diagram.
 */
export function toPlantumlLabel(raw: string): string {
  return raw
    .replaceAll('\r\n', '\n')
    .replaceAll('"', "'")
    .replaceAll('\n', '\\n')
    .trim();
}

/** What an unnamed box is called — see `c4/export.ts`'s `UNNAMED`. */
const UNNAMED = '?';

/** `<<entity>>` — the stereotype spelling PlantUML parses. */
function stereotypes(keywords: readonly string[]): string {
  return keywords.map(keyword => ` <<${toPlantumlLabel(keyword)}>>`).join('');
}

/**
 * The keywords PlantUML's own declaration word already states.
 *
 * `interface Payable` needs no `<<interface>>` after it: the word is the
 * statement. Repeating it would draw the keyword twice on the rendered picture.
 */
const DECLARED_KEYWORDS = new Set([
  'interface',
  'enumeration',
  'enum',
  'class',
]);

/**
 * A compartment line, guarded for the one character that could end a block.
 *
 * PlantUML closes a member block on a line that is exactly `}`. A compartment
 * holding one is not a member anybody meant to write, and letting it through
 * would unbalance the document from that point on.
 */
function memberLines(lines: readonly string[]): string[] {
  return lines.filter(line => line !== '}' && line !== '{');
}

/* ── Declarations ─────────────────────────────────────────────────────── */

/** The PlantUML word each classifier kind is declared with. */
const DECLARATION: Record<UmlClassifier['kind'], string> = {
  class: 'class',
  interface: 'interface',
  enumeration: 'enum',
  object: 'object',
};

interface Declared {
  alias: string;
  node: UmlNodeBase;
}

/* ── Relations ────────────────────────────────────────────────────────── */

/**
 * One relationship, as the arrow PlantUML draws it with.
 *
 * The two INHERITANCE arrows read right to left — `A <|-- B` is "B is an A" —
 * so the specific classifier, which the role table makes the SOURCE, is written
 * on the right. Getting this backwards would render every hierarchy upside down,
 * which is why it is stated here once rather than inlined at two call sites.
 */
function relationLine(
  relation: UmlRelation,
  source: string,
  target: string
): string {
  const label = relation.label ? ` : ${toPlantumlLabel(relation.label)}` : '';
  switch (relation.kind) {
    case 'association':
      return `${source} -- ${target}${label}`;
    case 'aggregation':
      // The diamond is drawn at the LEFT end, and the source is the whole.
      return `${source} o-- ${target}${label}`;
    case 'composition':
      return `${source} *-- ${target}${label}`;
    case 'generalization':
      return `${target} <|-- ${source}${label}`;
    case 'realization':
      return `${target} <|.. ${source}${label}`;
    case 'dependency':
      return `${source} ..> ${target}${label}`;
    case 'anchor':
      // A plain dashed line with no head: an anchor attaches a note, it does
      // not point anywhere.
      return `${source} .. ${target}`;
    case 'include':
      return `${source} ..> ${target} : <<include>>`;
    case 'extend':
      return `${source} ..> ${target} : <<extend>>`;
    default: {
      // Exhaustive: a relationship added to the union with no arrow to draw it
      // fails the build here rather than vanishing from a file.
      const never: never = relation.kind;
      throw new Error(`unhandled UML relation: ${String(never)}`);
    }
  }
}

/* ── The document ─────────────────────────────────────────────────────── */

/**
 * One diagram, as one complete PlantUML document.
 *
 * Elements first, nested in the packages and subjects they are drawn inside,
 * then every relationship — PlantUML resolves an arrow by alias, and an element
 * declared after the line referring to it renders as a bare box with none of its
 * members.
 *
 * Containment is geometric, exactly as it is in `xmi.ts` and for the same
 * reason: on a UML diagram, a class drawn inside a package IS in that package
 * (§12.2.4), and a use case inside the subject rectangle IS the subject's
 * (§18.1.4). Layout is the statement here, which is the one place this exporter
 * reads geometry at all.
 *
 * The `title` is the diagram's own HEADING — `class Orders`, Annex A's frame tag
 * — and there is no option to override it: the document's name is a different
 * fact about a different thing, and substituting it would drop the kind tag,
 * which is the half of the heading a `.puml` has nowhere else to put.
 */
export function exportPlantuml(model: UmlModel): string {
  const minter = new AliasMinter();
  const aliasOf = new Map<string, string>();
  const declare = (node: UmlNodeBase): Declared => {
    const alias = minter.mint(node.name || node.id);
    aliasOf.set(node.id, alias);
    return { alias, node };
  };

  // Aliases are minted in declaration order, so a collision suffix is stable.
  const packages = model.packages.map(declare);
  const classifiers = model.classifiers.map(declare);
  const subjects = model.subjects.map(declare);
  const actors = model.actors.map(declare);
  const useCases = model.useCases.map(declare);
  const notes = model.notes.map((note, index) => {
    const alias = minter.mint(note.name || `note${index + 1}`);
    aliasOf.set(note.id, alias);
    return { alias, node: note };
  });

  /** The smallest declared container whose box holds this centre. */
  const containerOf = (
    element: UmlNodeBase,
    containers: readonly Declared[],
    strictlyLarger = false
  ): Declared | undefined => {
    const bounds = element.bounds;
    if (!bounds) return undefined;
    const own = Math.max(0, bounds.w) * Math.max(0, bounds.h);
    let best: Declared | undefined;
    let bestArea = Number.POSITIVE_INFINITY;
    for (const candidate of containers) {
      const box = candidate.node.bounds;
      if (candidate.node.id === element.id || !box) continue;
      if (!umlCentreInside(bounds, box)) continue;
      const area = Math.max(0, box.w) * Math.max(0, box.h);
      if (strictlyLarger && area <= own) continue;
      if (area < bestArea) {
        best = candidate;
        bestArea = area;
      }
    }
    return best;
  };

  const packageOf = new Map<string, string | undefined>();
  for (const { node } of packages) {
    packageOf.set(node.id, containerOf(node, packages, true)?.node.id);
  }
  for (const { node } of classifiers) {
    packageOf.set(node.id, containerOf(node, packages)?.node.id);
  }
  const subjectOf = new Map<string, string | undefined>();
  for (const { node } of useCases) {
    subjectOf.set(node.id, containerOf(node, subjects)?.node.id);
  }

  const lines: string[] = ['@startuml'];

  const title = toPlantumlLabel(model.diagram.heading);
  if (title) lines.push(`title ${title}`);
  lines.push('');

  const classifierBlock = (declared: Declared, indent: string): string[] => {
    const classifier = declared.node as UmlClassifier;
    const word = DECLARATION[classifier.kind];
    // An instance is labelled `name : Type` (§11.6.4) — the underlined form the
    // canvas draws, which PlantUML underlines for an `object` of its own accord.
    const stated =
      classifier.kind === 'object' && classifier.instanceOf
        ? `${classifier.name} : ${classifier.instanceOf}`
        : classifier.name;
    const label = toPlantumlLabel(stated) || UNNAMED;
    const extra = stereotypes(
      classifier.keywords.filter(
        keyword => !DECLARED_KEYWORDS.has(keyword.toLowerCase())
      )
    );
    // `abstract class` is PlantUML's own word for §9.2.4's italic name; the
    // `object` declaration has no abstract form, and an instance has no use for
    // one.
    const head =
      classifier.isAbstract && classifier.kind === 'class'
        ? `abstract ${word}`
        : word;

    const body =
      classifier.kind === 'enumeration'
        ? // An enumeration's compartment holds LITERALS: PlantUML wants the bare
          // name, so the line is parsed for it and the rest of §9.5.4's syntax —
          // which a literal has no use for — is dropped.
          classifier.attributes.map(literal => literal.name).filter(Boolean)
        : classifier.kind === 'object'
          ? classifier.slots.map(slot =>
              slot.value ? `${slot.name} = ${slot.value}` : slot.name
            )
          : // Verbatim: PlantUML's member syntax is §9.5.4 / §9.6.4's own.
            memberLines([
              ...classifier.lines.attributes,
              ...classifier.lines.operations,
            ]);

    const declaration = `${indent}${head} "${label}" as ${declared.alias}${extra}`;
    if (body.length === 0) return [declaration];
    return [
      `${declaration} {`,
      ...body.map(line => `${indent}  ${line}`),
      `${indent}}`,
    ];
  };

  const packageBlock = (declared: Declared, indent: string): string[] => {
    const inner: string[] = [];
    for (const nested of packages) {
      if (packageOf.get(nested.node.id) === declared.node.id) {
        inner.push(...packageBlock(nested, `${indent}  `));
      }
    }
    for (const classifier of classifiers) {
      if (packageOf.get(classifier.node.id) === declared.node.id) {
        inner.push(...classifierBlock(classifier, `${indent}  `));
      }
    }
    const label = toPlantumlLabel(declared.node.name) || UNNAMED;
    const head = `${indent}package "${label}" as ${declared.alias}${stereotypes(declared.node.keywords)}`;
    return inner.length === 0 ? [head] : [`${head} {`, ...inner, `${indent}}`];
  };

  for (const pkg of packages) {
    if (!packageOf.get(pkg.node.id)) lines.push(...packageBlock(pkg, ''));
  }
  for (const classifier of classifiers) {
    if (!packageOf.get(classifier.node.id)) {
      lines.push(...classifierBlock(classifier, ''));
    }
  }
  for (const actor of actors) {
    lines.push(
      `actor "${toPlantumlLabel(actor.node.name) || UNNAMED}" as ${actor.alias}${stereotypes(actor.node.keywords)}`
    );
  }
  for (const subject of subjects) {
    const inner = useCases
      .filter(useCase => subjectOf.get(useCase.node.id) === subject.node.id)
      .map(
        useCase =>
          `  usecase "${toPlantumlLabel(useCase.node.name) || UNNAMED}" as ${useCase.alias}`
      );
    // A subject is a `rectangle`, which is PlantUML's plain boundary box — the
    // §18.1.4 rectangle the cases are drawn inside, and nothing more.
    const head = `rectangle "${toPlantumlLabel(subject.node.name) || UNNAMED}" as ${subject.alias}`;
    lines.push(...(inner.length === 0 ? [head] : [`${head} {`, ...inner, '}']));
  }
  for (const useCase of useCases) {
    if (!subjectOf.get(useCase.node.id)) {
      lines.push(
        `usecase "${toPlantumlLabel(useCase.node.name) || UNNAMED}" as ${useCase.alias}${stereotypes(useCase.node.keywords)}`
      );
    }
  }
  for (const note of notes) {
    // The block form rather than `note "…" as N`: a note is prose and routinely
    // several lines, and the one-line form has nowhere to put the second one.
    lines.push(
      `note as ${note.alias}`,
      ...parseCompartment(note.node.body).map(line => `  ${line}`),
      'end note'
    );
  }

  const relations = model.relations
    .map(relation => {
      const source = aliasOf.get(relation.sourceId);
      const target = aliasOf.get(relation.targetId);
      // An end this document has no alias for: there is nothing to point at.
      return source && target ? relationLine(relation, source, target) : '';
    })
    .filter(Boolean);
  if (relations.length > 0) lines.push('', ...relations);

  lines.push('@enduml');
  return `${lines.join('\n')}\n`;
}
