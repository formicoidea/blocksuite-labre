import {
  formatActivityEdgeLabel,
  formatTransitionLabel,
  parseCompartment,
} from './grammar.js';
import {
  type UmlActivityNode,
  type UmlClassifier,
  type UmlDeploymentNode,
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
 * ## The one thing it drops, said out loud
 *
 * A PORT. §11.3.4's small square has a place in the XMI file — it is an
 * `ownedAttribute` of its component, with an id other elements can point at —
 * and in a `.puml` it would have to be a `port` declaration inside a
 * `component … { }` block, which is a recent addition to the language and not
 * one every renderer in a repository's toolchain has. What the port CARRIES is
 * not lost: the lollipops and sockets drawn on it are attributed to its
 * component by `model.ts` and written below, so the picture still says which
 * contracts the component offers and needs. Only the square itself goes, and
 * the day the `port` syntax is safe to assume it is four lines here and a
 * golden.
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
 * The same, for the structural declarations — plus the two §19.4.4 writes as a
 * stereotype rather than as a word of its own.
 *
 * `component Cart` needs no `<<component>>` and `artifact "cart.jar"` no
 * `<<artifact>>`: the declaration word is the statement, and the stencil seeds
 * the keyword into the name tier (`keywords.ts`) precisely so the CANVAS draws
 * it. `device` and `executionEnvironment` are here because this writer emits
 * them from the node's KIND — see {@link deploymentStereotype} — so leaving them
 * in the keyword list would draw the word twice on the rendered picture.
 */
const STRUCTURAL_KEYWORDS = new Set([
  'component',
  'artifact',
  'node',
  'device',
  'executionenvironment',
  'execution environment',
]);

/**
 * What a cube is declared as — always `node`, with the keyword as a stereotype.
 *
 * PlantUML's component-diagram vocabulary has `node` and has no `device`, so a
 * writer that took §19.4.4's words literally would emit a line no renderer
 * parses. It does not need to: §19.4.4 itself says a Device is drawn as "a Node
 * graphic with the keyword «device»" and an ExecutionEnvironment as "a Node
 * annotated with the keyword «executionEnvironment»", which is a `node`
 * declaration carrying a stereotype — the same picture, in the format's own
 * grammar, with nothing invented and nothing lost.
 */
function deploymentStereotype(kind: UmlDeploymentNode['kind']): string {
  return kind === 'node'
    ? ''
    : ` <<${kind === 'device' ? 'device' : 'executionEnvironment'}>>`;
}

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
    case 'deploy':
      // §19.4.4's own alternative to nesting the artefact inside the cube: "a
      // dashed arrow with the keyword «deploy»", from the artefact to the node.
      return `${source} ..> ${target} : <<deploy>>`;
    case 'manifest':
      // §19.3.4: notated as an Abstraction — a dashed line with an open
      // arrow-head — labelled with the keyword.
      return `${source} ..> ${target} : <<manifest>>`;
    case 'communication-path':
      // §19.4.4: "depicted using the same as normal Association links", and an
      // association is undirected, so the line carries no head either way.
      return `${source} -- ${target}${label}`;
    case 'control-flow':
    case 'object-flow':
    case 'transition':
      // Written by the ACTIVITY and the STATE MACHINE sections of the document
      // rather than here: both are drawn in PlantUML's state-diagram syntax, and
      // a behaviour arrow's label carries a guard, a weight or a trigger list
      // that this function has no parsed form of. The empty string is filtered
      // out by the caller, exactly as an unresolved end already is.
      return '';
    default: {
      // Exhaustive: a relationship added to the union with no arrow to draw it
      // fails the build here rather than vanishing from a file.
      const never: never = relation.kind;
      throw new Error(`unhandled UML relation: ${String(never)}`);
    }
  }
}

/* ── Behaviour: the two flow sheets (§15.2.4, §14.2.4) ────────────────── */

/**
 * PlantUML's own marker for a beginning and an end — never an alias.
 *
 * `[*]` is CONTEXTUAL in PlantUML: read as the source of an arrow it draws the
 * filled disc, read as the target it draws the bullseye. That is exactly what
 * §15.3.4 and §14.2.4 mean by the two glyphs, and it is why an initial node and
 * a final node are never declared here — they have no alias to declare, and
 * `[*] --> Draft` says the whole of it.
 */
const PLANTUML_TERMINAL = '[*]';

/**
 * Which PlantUML state stereotype draws each behaviour glyph — and, where it
 * draws none, which word is kept instead.
 *
 * ## Why BOTH sheets are written in the state-diagram syntax
 *
 * The decision this file makes for the behaviour half, stated once and cited
 * wherever it shows:
 *
 *  - PlantUML's **classic activity syntax** (`(*) --> "Action"`) is deprecated
 *    upstream and no longer rendered by current versions. A file nobody can
 *    render is worth less than one drawn slightly plainer — the same call the
 *    lollipop operators got, a hundred lines up.
 *  - PlantUML's **new activity syntax** (`start`, `:Action;`,
 *    `if (c) then … else … endif`, `fork` / `fork again` / `end fork`, `stop`)
 *    is a STRUCTURED BLOCK language. It can express a tree of nested blocks and
 *    nothing else, while a whiteboard draws arbitrary directed graphs: an arrow
 *    back three steps, two branches rejoining somewhere neither block contains,
 *    a decision whose arms end in different final nodes. A writer using it would
 *    have to reshape or refuse most real drawings, and reshaping a drawing is
 *    the one thing an exporter must never do.
 *  - The **state-diagram syntax** IS a general directed graph — `A --> B : …`,
 *    `[*] --> A`, `state X <<choice>>`, `state C { … }` — so every graph this
 *    canvas can draw comes out whole, and it is the NATIVE syntax for half the
 *    job anyway.
 *
 * So an activity sheet is written in a notation one step away from its own, and
 * the document says so in a comment line rather than leaving a reader to work it
 * out. What is lost is shape, never structure: every node, every arrow, every
 * guard and every lane is in the file.
 *
 * ## What each glyph becomes
 *
 * The stereotypes PlantUML actually implements are used where one fits —
 * `<<choice>>` for a diamond, `<<fork>>` for a bar, `<<history>>` and
 * `<<deepHistory>>` for the two H circles, `<<entryPoint>>` / `<<exitPoint>>`
 * for the connection points, `<<end>>` for a stop. Everything else takes a
 * stereotype PlantUML does not know, which it renders as the word itself under
 * the name: an object node reads «objectNode», a signal reads «signal». That is
 * strictly better than borrowing a shape that means something else, because the
 * reader is told what the glyph was instead of being shown the wrong one.
 *
 * Two conflations are worth naming because a reader will notice them: a JUNCTION
 * borrows the choice diamond (§14.2.4.6 draws a small filled circle, PlantUML
 * has no such glyph, and both are a branch) and a TERMINATE borrows `<<end>>`
 * (§14.2.4.6 draws a cross, PlantUML has no cross, and both stop the machine).
 */
const PLANTUML_STATE_STEREOTYPE: Readonly<Record<string, string>> = {
  // The activity glyphs.
  'flow-final': 'end',
  decision: 'choice',
  fork: 'fork',
  'object-node': 'objectNode',
  'send-signal': 'signal',
  'accept-event': 'accept',
  'time-event': 'time',
  // The pseudostates.
  choice: 'choice',
  junction: 'choice',
  'shallow-history': 'history',
  'deep-history': 'deepHistory',
  'entry-point': 'entryPoint',
  'exit-point': 'exitPoint',
  terminate: 'end',
};

/** `A --> B : label`, with the label left off when there is nothing to say. */
function arrowLine(source: string, target: string, label: string): string {
  const written = label.trim();
  return written
    ? `${source} --> ${target} : ${toPlantumlLabel(written)}`
    : `${source} --> ${target}`;
}

/*
 * §15.2.4's and §14.2.4.8's labels — `name [guard] {weight = w}` and
 * `trigger [guard] / effect` — are re-spelled in the notation's own syntax
 * rather than printed as records, because a PlantUML label is read by a HUMAN
 * looking at the picture: the brackets, the braces and the slash are what tell
 * them which part is which, and they are the same delimiters the author typed on
 * the canvas.
 *
 * Both printers live in `grammar.ts`, beside the parsers they invert:
 * `import.ts` writes the same words into an imported connector's centre label,
 * and one grammar spelled in two files is how a guard comes back without its
 * brackets.
 */

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
  const components = model.components.map(declare);
  const artifacts = model.artifacts.map(declare);
  const cubes = model.nodes.map(declare);
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
  // ── The structural sheets (§11.6.4, §19.3.4, §19.4.4) ────────────────
  //
  // Declared after the class-side artefacts and before the relations, for the
  // reason the whole function is ordered this way: PlantUML resolves an arrow by
  // alias, and an element declared after the line referring to it renders as a
  // bare box.
  for (const component of components) {
    lines.push(
      `component "${toPlantumlLabel(component.node.name) || UNNAMED}" as ${component.alias}${stereotypes(
        component.node.keywords.filter(
          keyword => !STRUCTURAL_KEYWORDS.has(keyword.toLowerCase())
        )
      )}`
    );
  }
  for (const artifact of artifacts) {
    lines.push(
      `artifact "${toPlantumlLabel(artifact.node.name) || UNNAMED}" as ${artifact.alias}${stereotypes(
        artifact.node.keywords.filter(
          keyword => !STRUCTURAL_KEYWORDS.has(keyword.toLowerCase())
        )
      )}`
    );
  }
  for (const cube of cubes) {
    const node = cube.node as UmlDeploymentNode;
    lines.push(
      `node "${toPlantumlLabel(node.name) || UNNAMED}" as ${cube.alias}${deploymentStereotype(
        node.kind
      )}${stereotypes(
        node.keywords.filter(
          keyword => !STRUCTURAL_KEYWORDS.has(keyword.toLowerCase())
        )
      )}`
    );
  }

  // The lollipops and the sockets, as the two dependencies §10.4.4 says they
  // ARE.
  //
  // One `interface` declaration per NAME across the sheet, because that is what
  // an alias is: two components providing `IOrder` are two arrows onto one
  // declared identifier, and declaring it twice would be a duplicate-alias
  // error. This is where PlantUML and XMI part company on purpose — the XMI
  // writer mints an Interface per lollipop, since a file has to say which
  // component declares which contract, while a `.puml` is a picture and the
  // picture has one circle.
  //
  // The arrows are `i <|.. c` and `c ..> i` rather than the `-(` / `)-` lollipop
  // operators: the realization and the usage arrows are the notation §10.4.4's
  // own Figure 10.11 gives for the same two facts, they are the two this file
  // already writes for a class diagram, and they parse in every version of the
  // renderer. The ball-and-socket operators are newer and their spelling has
  // changed; a file nobody can render is worth less than one drawn slightly
  // plainer.
  const interfaceAlias = new Map<string, string>();
  const interfaceLines: string[] = [];
  const wiring: string[] = [];
  const aliasForInterface = (name: string): string => {
    const known = interfaceAlias.get(name);
    if (known) return known;
    const alias = minter.mint(name);
    interfaceAlias.set(name, alias);
    interfaceLines.push(`interface "${toPlantumlLabel(name)}" as ${alias}`);
    return alias;
  };
  // `components` is `model.components.map(declare)`, so the two stay in step by
  // index — no lookup, and no way for them to drift.
  for (const [index, component] of components.entries()) {
    const node = model.components[index];
    for (const name of node.provided) {
      // "This component realizes that contract" — the dashed hollow triangle,
      // which is what a ball on a stub means (§10.4.4).
      wiring.push(`${aliasForInterface(name)} <|.. ${component.alias}`);
    }
    for (const name of node.required) {
      // "This component uses that contract" — the socket, which §10.4.4 draws
      // as a Usage dependency and Figure 10.11 labels «use».
      wiring.push(
        `${component.alias} ..> ${aliasForInterface(name)} : <<use>>`
      );
    }
  }
  lines.push(...interfaceLines);

  // ── The behaviour sheets (§15.2.4, §14.2.4) ──────────────────────────
  //
  // Written in PlantUML's STATE-DIAGRAM syntax, both of them — see
  // {@link PLANTUML_STATE_STEREOTYPE} for the whole argument, and the comment
  // line this emits for an activity so a reader of the file is told rather than
  // left to work it out.
  //
  // Declared here, after everything else and before the arrows, for the reason
  // the whole function is ordered this way: PlantUML resolves an arrow by alias.
  const activity = model.activities[0];
  const machine = model.stateMachines[0];
  const behaviourLines: string[] = [];
  const behaviourArrows: string[] = [];

  /** A state declaration — the quoted form when there is a name to quote. */
  const stateLine = (
    alias: string,
    label: string,
    stereotype: string | undefined,
    indent: string
  ): string => {
    const tail = stereotype ? ` <<${stereotype}>>` : '';
    const written = toPlantumlLabel(label);
    return written
      ? `${indent}state "${written}" as ${alias}${tail}`
      : // A control node carries no words (§15.3.4 draws none), and
        // `state "" as D` is a box with an empty name rather than an unnamed
        // one. The bare form is what PlantUML has for exactly this.
        `${indent}state ${alias}${tail}`;
  };

  if (activity) {
    behaviourLines.push(
      "' An activity (§15.2.4), written in PlantUML's state-diagram syntax:",
      "' its structured activity syntax cannot express an arbitrary graph."
    );

    const terminalKind = (kind: string) =>
      kind === 'initial' || kind === 'activity-final';
    for (const node of activity.nodes) {
      // The disc and the bullseye ARE `[*]`, read from either end — see
      // {@link PLANTUML_TERMINAL}. Nothing to mint and nothing to declare.
      aliasOf.set(
        node.id,
        terminalKind(node.kind)
          ? PLANTUML_TERMINAL
          : minter.mint(node.name || node.kind)
      );
    }

    const activityNodeLine = (node: UmlActivityNode, indent: string) =>
      terminalKind(node.kind)
        ? []
        : [
            stateLine(
              aliasOf.get(node.id)!,
              node.name,
              PLANTUML_STATE_STEREOTYPE[node.kind],
              indent
            ),
          ];

    // The swimlanes, as composite boxes. An approximation and it says so: a
    // state diagram has no lane, §15.6.4's band is the nearest thing PlantUML
    // draws to one, and a box round the actions of one lane keeps the fact the
    // lane states — who is responsible for what. The flows still cross freely,
    // because every arrow is written at the TOP level below.
    for (const partition of activity.partitions) {
      const alias = minter.mint(partition.name || 'partition');
      aliasOf.set(partition.id, alias);
      const inside = activity.nodes.filter(
        node => node.partitionId === partition.id
      );
      const head = stateLine(alias, partition.name, 'partition', '');
      const inner = inside.flatMap(node => activityNodeLine(node, '  '));
      behaviourLines.push(
        ...(inner.length === 0 ? [head] : [`${head} {`, ...inner, '}'])
      );
    }
    for (const node of activity.nodes) {
      if (node.partitionId) continue;
      behaviourLines.push(...activityNodeLine(node, ''));
    }

    for (const edge of activity.edges) {
      const source = aliasOf.get(edge.sourceId);
      const target = aliasOf.get(edge.targetId);
      if (!source || !target) continue;
      behaviourArrows.push(
        arrowLine(source, target, formatActivityEdgeLabel(edge))
      );
    }
  }

  if (machine) {
    // A vertex at the TOP of the sheet gets PlantUML's own terminal marker; one
    // drawn inside a composite state gets a declared box with `<<start>>` or
    // `<<end>>` instead.
    //
    // The reason is `[*]`'s scoping: PlantUML reads it against the block the
    // line is written in, and this writer emits every transition at the top
    // level so that one crossing out of a composite state still resolves. A
    // nested `[*]` would therefore render as the MACHINE's beginning rather than
    // the composite state's, which is a different statement. A declared box is
    // always right, at the cost of a circle drawn as a labelled node.
    const terminalOf = (
      vertex: { id: string; regionId?: string },
      kind: string
    ) =>
      vertex.regionId === undefined && (kind === 'initial' || kind === 'final')
        ? PLANTUML_TERMINAL
        : undefined;

    for (const state of machine.states) {
      aliasOf.set(state.id, minter.mint(state.name || 'state'));
    }
    for (const region of machine.regions) {
      aliasOf.set(region.id, minter.mint(region.name || 'state'));
    }
    for (const final of machine.finalStates) {
      aliasOf.set(
        final.id,
        terminalOf(final, 'final') ?? minter.mint(final.name || 'final')
      );
    }
    for (const pseudo of machine.pseudostates) {
      aliasOf.set(
        pseudo.id,
        terminalOf(pseudo, pseudo.kind) ??
          minter.mint(pseudo.name || pseudo.kind)
      );
    }

    /** One region's contents — its vertices, and the composite states in it. */
    const regionLines = (
      regionId: string | undefined,
      indent: string
    ): string[] => {
      const out: string[] = [];
      for (const state of machine.states) {
        if (state.regionId !== regionId) continue;
        const alias = aliasOf.get(state.id)!;
        out.push(stateLine(alias, state.name, undefined, indent));
        // §14.2.4.4's internal activities, in PlantUML's own `S : …` form —
        // which is the same line UML writes inside the second compartment.
        for (const body of state.entry) {
          out.push(`${indent}${alias} : entry / ${toPlantumlLabel(body)}`);
        }
        for (const body of state.doActivity) {
          out.push(`${indent}${alias} : do / ${toPlantumlLabel(body)}`);
        }
        for (const body of state.exit) {
          out.push(`${indent}${alias} : exit / ${toPlantumlLabel(body)}`);
        }
        // Everything else the author wrote in that compartment — an internal
        // transition, a constraint — kept verbatim rather than dropped.
        for (const line of state.lines) {
          out.push(`${indent}${alias} : ${toPlantumlLabel(line)}`);
        }
      }
      for (const final of machine.finalStates) {
        if (final.regionId !== regionId) continue;
        const alias = aliasOf.get(final.id)!;
        if (alias === PLANTUML_TERMINAL) continue;
        out.push(stateLine(alias, final.name, 'end', indent));
      }
      for (const pseudo of machine.pseudostates) {
        if (pseudo.regionId !== regionId) continue;
        const alias = aliasOf.get(pseudo.id)!;
        if (alias === PLANTUML_TERMINAL) continue;
        out.push(
          stateLine(
            alias,
            pseudo.name,
            pseudo.kind === 'initial'
              ? 'start'
              : PLANTUML_STATE_STEREOTYPE[pseudo.kind],
            indent
          )
        );
      }
      for (const region of machine.regions) {
        if (region.parentId !== regionId) continue;
        const head = stateLine(
          aliasOf.get(region.id)!,
          region.name,
          undefined,
          indent
        );
        const inner = regionLines(region.id, `${indent}  `);
        out.push(
          ...(inner.length === 0
            ? [head]
            : [`${head} {`, ...inner, `${indent}}`])
        );
      }
      return out;
    };

    behaviourLines.push(...regionLines(undefined, ''));

    for (const transition of machine.transitions) {
      const source = aliasOf.get(transition.sourceId);
      const target = aliasOf.get(transition.targetId);
      if (!source || !target) continue;
      behaviourArrows.push(
        arrowLine(source, target, formatTransitionLabel(transition))
      );
    }
  }

  if (behaviourLines.length > 0) lines.push(...behaviourLines);

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
  const drawn = [...wiring, ...relations, ...behaviourArrows];
  if (drawn.length > 0) lines.push('', ...drawn);

  lines.push('@enduml');
  return `${lines.join('\n')}\n`;
}
