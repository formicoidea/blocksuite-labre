import type { InterchangeNote } from '@labre/affine-block-surface';
import {
  UML_DIAGRAM_KIND_TAG,
  type UmlDiagramKind,
  type UmlNodeKind,
} from '@labre/affine-model';

import { UML_NODE_BOX, UML_REGION_BOX, UML_SUBJECT_BOX } from './consts.js';
import { parseOperation, parseProperty, parseTransition } from './grammar.js';
import { umlInventLayout } from './import.js';
import { stereotypesOf } from './keywords.js';
import type {
  UmlClassifier,
  UmlDeploymentNode,
  UmlModel,
  UmlNodeBase,
  UmlNote,
  UmlPseudostateKind,
  UmlRelation,
  UmlRelationKind,
  UmlState,
  UmlTransition,
} from './model.js';

/**
 * **PlantUML source, read back** — the inverse of `plantuml.ts` over the
 * vocabulary that writer emits, and a tolerant reading of the rest of the
 * language (`docs/adr/0012`, D1–D6).
 *
 * ## What it is for, and it is not symmetry
 *
 * A `.puml` is the format UML diagrams actually live in: it sits in a `docs/`
 * folder beside the code, it diffs line by line in review, and every
 * architecture repository already has some. An importer is what turns that
 * corpus into boards somebody can edit, and it is the only one of the three
 * readers whose input a human wrote by hand — which is why the contract below is
 * "never throw" rather than "refuse what is malformed".
 *
 * ## Never a throw, always a report
 *
 * PlantUML is a large language with a preprocessor, sprites, styles, JSON and
 * YAML diagrams and a dozen shorthands per relationship. This reads the UML
 * subset and files EVERY line it does not understand as a `carried` remark
 * naming the line, so an import of a file half of which is `!include` and
 * `skinparam` produces the diagram it does understand and tells the user
 * precisely what it left on the floor. The alternative — an exception — would
 * turn one unknown directive into a file nobody can open.
 *
 * That is a deliberate departure from `gfx/bpmn/src/import.ts`, which throws: an
 * XML document either is a BPMN interchange file or is not, and there is a root
 * element to ask. A text file has no such question to answer.
 *
 * ## The fixed point
 *
 * Our own export re-imports to the model it was written from, and re-exports to
 * the same bytes. `__tests__/import-roundtrip.unit.spec.ts` pins it on the
 * phase-1 fixtures and `__tests__/plantuml-import.unit.spec.ts` on the corpus
 * file an earlier build actually produced. That property is what makes a `.puml`
 * a place a Labre board can be kept.
 *
 * ## The loss table
 *
 * | what                                                    | state    | after a round trip |
 * | ------------------------------------------------------- | -------- | ------------------ |
 * | classes, interfaces, enums, objects and their members   | mapped   | drawn, and written back verbatim |
 * | packages, subjects, actors, use cases, notes            | mapped   | drawn, and nested as the file nested them |
 * | every relationship operator, and the keyword on it      | mapped   | the role, and the arrow it is drawn as |
 * | components, artifacts, cubes, declared interfaces       | mapped   | drawn; a lollipop comes back as `interface` + the two arrows §10.4.4 says it IS |
 * | state machines — states, pseudostates, transitions      | mapped   | drawn on an `stm` sheet |
 * | end multiplicities (`"1" -- "0..*"`)                    | carried  | named in the report. The IR has no end labels until tranche H, so they are not drawn and not written back |
 * | `skinparam`, `!include`, styles, sprites, preprocessor  | carried  | named in the report, one line each. A theme in an exported file overrides the repository it lands in, which is why this pack writes none |
 * | the alias a declaration was written under               | mapped   | kept as the element's source id (D3); the export re-derives an alias from the NAME, so a file whose aliases are hashes comes back readable |
 * | **layout**                                              | invented | PlantUML carries no coordinates. Rows by generalization depth, containers sized to fit — and the report says so (D4) |
 * | a direction hint inside an arrow (`-down->`)            | **lost** | read as the plain arrow: Labre lays the diagram out itself |
 * | `hide`, `remove`, `together`, layout directives         | carried  | named; they say how to DRAW, and the drawing is the board's |
 */

/* ── What a reader hands back ─────────────────────────────────────────── */

export interface UmlPlantumlImport {
  /**
   * One model per `@startuml … @enduml` block.
   *
   * A LIST and not one model, because `exportUmlPlantuml` writes one document
   * per diagram and concatenates them: a file holding four blocks is four
   * sheets, and collapsing them would lose exactly the fact ADR 0017 is about.
   * A source with no `@startuml` at all is read as one unwrapped block, which is
   * what half the snippets in the wild are.
   */
  models: UmlModel[];
  notes: InterchangeNote[];
}

/* ── The vocabulary ───────────────────────────────────────────────────── */

/** Annex A's frame tags, read back: `class Orders` → the `class` kind. */
const KIND_OF_TAG = new Map<string, UmlDiagramKind>(
  Object.entries(UML_DIAGRAM_KIND_TAG).map(([kind, tag]) => [
    tag as string,
    kind as UmlDiagramKind,
  ])
);

/**
 * The declaration words this reader understands, and the artefact each makes.
 *
 * `enum` and `enumeration` are one kind under two spellings because PlantUML
 * accepts both; `entity` reads as a class, which is what PlantUML draws it as.
 * `rectangle`, `folder` and `frame` all read as §18.1.4's SUBJECT — a plain
 * boundary box — because that is the only thing this pack draws round a group of
 * use cases, and it is what our own writer emits for one.
 */
const DECLARATION_KIND: Readonly<Record<string, UmlNodeKind | 'subject'>> = {
  class: 'class',
  entity: 'class',
  interface: 'interface',
  enum: 'enumeration',
  enumeration: 'enumeration',
  object: 'object',
  package: 'package',
  namespace: 'package',
  rectangle: 'subject',
  folder: 'subject',
  frame: 'subject',
  actor: 'actor',
  usecase: 'use-case',
  component: 'component',
  artifact: 'artifact',
  node: 'node',
  state: 'state',
};

/** The declaration words, as the alternation the line matcher is built on. */
const DECLARATION_WORDS = [
  'abstract class',
  'abstract',
  ...Object.keys(DECLARATION_KIND),
].join('|');

/**
 * The state stereotypes `plantuml.ts` writes, read back to the glyph they stand
 * for.
 *
 * The inverse of `PLANTUML_STATE_STEREOTYPE`, with the two conflations that
 * table declares resolved the way it resolves them: `<<choice>>` comes back as a
 * choice (a junction was borrowing the diamond) and `<<end>>` as a final state
 * (a terminate was borrowing the stop). Reading them the other way would turn a
 * diagram somebody drew into a different one on the way home.
 */
const STATE_KIND_OF_STEREOTYPE: Readonly<Record<string, UmlNodeKind>> = {
  start: 'initial',
  end: 'final-state',
  choice: 'choice',
  junction: 'junction',
  fork: 'fork',
  history: 'shallow-history',
  deephistory: 'deep-history',
  entrypoint: 'entry-point',
  exitpoint: 'exit-point',
  terminate: 'terminate',
};

/** The vertices §14.2.4.6 files under `Pseudostate`, as a set. */
const PSEUDOSTATE_KINDS = new Set<string>([
  'initial',
  'choice',
  'junction',
  'shallow-history',
  'deep-history',
  'entry-point',
  'exit-point',
  'terminate',
  'fork',
]);

/**
 * Every relationship operator, and the role it states.
 *
 * Both directions of each, because a `.puml` in the wild is written either way
 * round and the two say the SAME thing about different ends: `B --|> A` and
 * `A <|-- B` are both "B is an A". `reversed` says the sentence's SUBJECT — the
 * source, per the role table in `roles.ts` — is written on the RIGHT of the
 * arrow, which is the case for every operator whose mark is drawn at the LEFT
 * end: the triangle of `<|--` points at the general classifier, so the specific
 * one is on the other side.
 *
 * Matched longest-first, which the order of this table IS: `<|--` has to be
 * tried before `<--`, and `..>` before `..`.
 */
const OPERATORS: readonly {
  pattern: RegExp;
  kind: UmlRelationKind;
  reversed?: boolean;
}[] = [
  { pattern: /^<\|-+$/, kind: 'generalization', reversed: true },
  { pattern: /^<\|\.+$/, kind: 'realization', reversed: true },
  { pattern: /^-+\|>$/, kind: 'generalization' },
  { pattern: /^\.+\|>$/, kind: 'realization' },
  // The diamond is the WHOLE (`roles.ts`: "is composed of"), so the end it is
  // drawn at is the source — the opposite half of the same rule.
  { pattern: /^o-+$/, kind: 'aggregation' },
  { pattern: /^-+o$/, kind: 'aggregation', reversed: true },
  { pattern: /^\*-+$/, kind: 'composition' },
  { pattern: /^-+\*$/, kind: 'composition', reversed: true },
  { pattern: /^<\.+$/, kind: 'dependency', reversed: true },
  { pattern: /^\.+>$/, kind: 'dependency' },
  { pattern: /^<-+$/, kind: 'association', reversed: true },
  { pattern: /^-+>$/, kind: 'association' },
  { pattern: /^-+$/, kind: 'association' },
  // A dashed line with nothing on either end: Annex A's anchor, which is how a
  // note is attached to what it comments on.
  { pattern: /^\.+$/, kind: 'anchor' },
];

/**
 * The keywords §7.8.4 and §18.1.4 say a dashed arrow is told apart BY.
 *
 * Five relationships share one drawing — a dashed line with an open arrow-head —
 * and the specification is explicit that the word written on the line is what
 * separates them. So `<<include>>` on a `..>` is not a label at all: it is the
 * role, and reading it as prose would import an include as an untyped dependency
 * carrying a stereotype.
 */
const KEYWORD_ROLE: Readonly<Record<string, UmlRelationKind>> = {
  include: 'include',
  extend: 'extend',
  deploy: 'deploy',
  manifest: 'manifest',
  use: 'dependency',
};

/** PlantUML's contextual beginning-and-end marker (`plantuml.ts`). */
const TERMINAL = '[*]';

/* ── Reading a line ───────────────────────────────────────────────────── */

/** A `<<stereo>>` / `«stereo»` group, wherever it was written. */
const STEREOTYPE = /<<([^>]*)>>|«([^»]*)»/g;

/** Direction hints inside an arrow — `-down->`, `-up->`: layout, not model. */
const DIRECTION_HINT = /-(?:left|right|up|down|le|ri|do)-/gi;

/** A colour or a style tail — `#red`, `#line:blue;line.dashed`. */
const STYLE_TAIL = /\s#\S+/g;

/** The arrow token, as the run of operator characters between two spaces. */
const ARROW = /\s([<>|o*.+#x{}^-]+)\s/;

/** What a declaration says once its notation has been pulled off it. */
interface Declaration {
  label: string;
  alias?: string;
  stereotypes: string[];
  /** The declaration opens a `{ … }` block. */
  opens: boolean;
}

/** `"Name" as alias <<stereo>> {` — every part, or `undefined` for nonsense. */
function parseDeclaration(tail: string): Declaration | undefined {
  let rest = tail.trim();
  const opens = rest.endsWith('{');
  if (opens) rest = rest.slice(0, -1).trim();

  const stereotypes: string[] = [];
  rest = rest
    .replaceAll(STEREOTYPE, (_match, angled, guillemet) => {
      for (const label of String(angled ?? guillemet ?? '').split(',')) {
        const trimmed = label.trim();
        if (trimmed) stereotypes.push(trimmed);
      }
      return ' ';
    })
    .replaceAll(STYLE_TAIL, ' ')
    .trim();

  const named =
    /^(?:"([^"]*)"|\(([^)]*)\)|([^\s"]+))(?:\s+as\s+(\S+))?\s*$/.exec(rest);
  if (!named) return undefined;
  return {
    label: named[1] ?? named[2] ?? named[3] ?? '',
    ...(named[4] ? { alias: named[4] } : {}),
    stereotypes,
    opens,
  };
}

/** The label after the first ` : `, and the line without it. */
function splitLabel(line: string): { head: string; label?: string } {
  const colon = line.indexOf(' : ');
  if (colon < 0) return { head: line };
  return { head: line.slice(0, colon), label: line.slice(colon + 3).trim() };
}

/**
 * `A "1"` → the artefact and the multiplicity written against its end.
 *
 * A side that is NOTHING BUT a quoted string is the artefact rather than a
 * multiplicity: `"Order" -- "Line"` is two named ends, and reading them as two
 * cardinalities on an arrow between nothing would lose the whole relationship.
 */
function splitEnd(
  side: string,
  trailing: boolean
): { name: string; end?: string } {
  const matched = trailing
    ? /^(.*?)\s*"([^"]*)"\s*$/.exec(side)
    : /^\s*"([^"]*)"\s*(.*)$/.exec(side);
  if (!matched) return { name: side.trim() };
  const name = (trailing ? matched[1] : matched[2]).trim();
  const end = (trailing ? matched[2] : matched[1]).trim();
  if (!name) return { name: end };
  return { name, ...(end ? { end } : {}) };
}

/** An operation is a member line with a parameter list; anything else is not. */
const isOperation = (line: string) => line.includes('(');

/** A line of an object's compartment as a SLOT — `model.ts`'s own reading. */
function slotOf(line: string): { name: string; value?: string } {
  const property = parseProperty(line);
  return {
    name: property.name,
    ...(property.defaultValue ? { value: property.defaultValue } : {}),
  };
}

/* ── One `@startuml … @enduml` block ──────────────────────────────────── */

/** Everything one block declared, by the alias the arrows refer to it by. */
interface Entry {
  id: string;
  /** Where a member line typed outside the block goes. */
  classifier?: UmlClassifier;
  state?: UmlState;
  /** Which container this artefact is drawn inside, when it is. */
  parentId?: string;
  /**
   * Minted by an ARROW rather than by a declaration.
   *
   * A `.puml` is routinely written arrow-first — `[*] --> Draft` above
   * `state Draft`, `A --> B` above the class that declares B's members — so a
   * reader that treated the later declaration as a second artefact would split
   * every forward-referenced box in two. An implicit entry is ADOPTED by the
   * declaration that catches up with it: same id, so every arrow already drawn
   * still points at it.
   */
  implicit?: boolean;
}

/** What a `{ … }` means, which depends entirely on what opened it. */
type Frame =
  | { type: 'root' }
  | { type: 'members'; classifier: UmlClassifier }
  | { type: 'container'; id: string }
  | { type: 'note'; note: UmlNote };

/** An empty model, so every list below is spelled once. */
function blankModel(id: string): UmlModel {
  return {
    diagram: { id, kind: 'class', name: '', heading: '' },
    classifiers: [],
    packages: [],
    actors: [],
    useCases: [],
    subjects: [],
    notes: [],
    components: [],
    ports: [],
    artifacts: [],
    nodes: [],
    activities: [],
    stateMachines: [],
    relations: [],
    warnings: [],
  };
}

/**
 * One block, read.
 *
 * A single pass with a frame stack, which is what `{ … }` nesting asks for and
 * the only shape in which a package inside a package inside a package needs no
 * special case. Nothing here looks ahead: a `.puml` is written in declaration
 * order and read in it.
 */
function parseBlock(
  lines: readonly string[],
  blockIndex: number,
  note: (entry: InterchangeNote) => void
): UmlModel {
  const model = blankModel(`plantuml-${blockIndex + 1}`);
  const entries = new Map<string, Entry>();
  /** What each container holds, in declaration order — the layout reads it. */
  const contains = new Map<string, string[]>();
  const stack: Frame[] = [{ type: 'root' }];
  let titleKind: UmlDiagramKind | undefined;
  let behaviour = false;
  let minted = 0;

  const top = () => stack[stack.length - 1];

  /** The container a declaration written here belongs to, if any. */
  const containerId = (): string | undefined => {
    const frame = top();
    return frame.type === 'container' ? frame.id : undefined;
  };

  const register = (id: string, entry: Omit<Entry, 'id'> = {}) => {
    const parent = containerId();
    entries.set(id, { id, ...entry, ...(parent ? { parentId: parent } : {}) });
    if (!parent) return;
    const held = contains.get(parent);
    if (held) held.push(id);
    else contains.set(parent, [id]);
  };

  /** A declared artefact's shared half — the name compartment, parsed. */
  const base = (id: string, declaration: Declaration): UmlNodeBase => {
    const stated = stereotypesOf(declaration.label);
    return {
      id,
      name: stated.name,
      keywords: [...declaration.stereotypes, ...stated.keywords],
      isAbstract: stated.isAbstract,
    };
  };

  /** The one state machine an `stm` sheet holds, created on first need. */
  const machine = () => {
    if (model.stateMachines.length === 0) {
      model.stateMachines.push({
        id: model.diagram.id,
        name: model.diagram.name,
        regions: [],
        states: [],
        finalStates: [],
        pseudostates: [],
        transitions: [],
      });
    }
    return model.stateMachines[0];
  };

  function addClassifier(
    id: string,
    kind: UmlClassifier['kind'],
    declaration: Declaration
  ): UmlClassifier {
    const record = base(id, declaration);
    // `object : Class` — §11.6.4's instance, and the one name this reader
    // splits: everything else keeps whatever the author wrote.
    let instanceOf: string | undefined;
    let name = record.name;
    if (kind === 'object') {
      const colon = name.indexOf(':');
      if (colon >= 0) {
        instanceOf = name.slice(colon + 1).trim() || undefined;
        name = name.slice(0, colon).trim();
      }
    }
    const classifier: UmlClassifier = {
      ...record,
      name,
      kind,
      attributes: [],
      operations: [],
      slots: [],
      lines: { attributes: [], operations: [] },
      ...(instanceOf ? { instanceOf } : {}),
    };
    model.classifiers.push(classifier);
    register(id, { classifier });
    return classifier;
  }

  function addState(id: string, declaration: Declaration): UmlState {
    const state: UmlState = {
      ...base(id, declaration),
      entry: [],
      doActivity: [],
      exit: [],
      lines: [],
    };
    machine().states.push(state);
    register(id, { state });
    return state;
  }

  /** A member line, filed in the compartment its syntax puts it in. */
  const addMember = (classifier: UmlClassifier, line: string) => {
    if (isOperation(line)) classifier.lines.operations.push(line);
    else classifier.lines.attributes.push(line);
  };

  /** The id an arrow's end names — minting a vertex for `[*]` on the way. */
  function endOf(raw: string, asSource: boolean): string | undefined {
    const name = raw.trim().replace(/^"(.*)"$/, '$1');
    if (!name) return undefined;

    if (name === TERMINAL) {
      // `[*]` is contextual (`plantuml.ts`): the source of an arrow is the
      // filled disc, the target is the bullseye. One vertex per arrow, because
      // that is what the picture draws.
      behaviour = true;
      const id = `${model.diagram.id}-terminal-${++minted}`;
      const vertex: UmlNodeBase = {
        id,
        name: '',
        keywords: [],
        isAbstract: false,
      };
      if (asSource) machine().pseudostates.push({ ...vertex, kind: 'initial' });
      else machine().finalStates.push(vertex);
      entries.set(id, { id });
      return id;
    }

    const known = entries.get(name);
    if (known) return known.id;

    // An arrow naming something the file never declared. PlantUML draws it as a
    // bare box, and so does this: dropping the arrow would lose the statement
    // the author actually made.
    const declaration: Declaration = {
      label: name,
      stereotypes: [],
      opens: false,
    };
    const id = behaviour
      ? addState(name, declaration).id
      : addClassifier(name, 'class', declaration).id;
    const entry = entries.get(id);
    if (entry) entry.implicit = true;
    return id;
  }

  /**
   * Forget an artefact an arrow minted, so the declaration that follows it can
   * be read as the artefact rather than as a second one.
   *
   * The ID is what is kept: every relation already written names it, and a
   * declaration that arrived late is still a declaration OF the thing the
   * arrows have been pointing at.
   */
  function forget(entry: Entry): void {
    const held = model.stateMachines[0];
    model.classifiers = model.classifiers.filter(
      record => record.id !== entry.id
    );
    if (held) {
      held.states = held.states.filter(record => record.id !== entry.id);
    }
    entries.delete(entry.id);
  }

  /**
   * Is this id one of the machine's vertices?
   *
   * A REGION counts, and it is the one entry here that is not a vertex in the
   * metamodel: §14.2.4 draws a composite state as a box and lets a transition
   * end on it, and this pack draws that box as a `umlRegion`. An arrow onto one
   * is therefore drawn — the author sees what they wrote — and is the one
   * statement in this format that does not survive a round trip through the
   * canvas, because `model.ts` deliberately attributes nothing to a background.
   */
  function isVertex(id: string): boolean {
    const held = model.stateMachines[0];
    if (!held) return false;
    return (
      held.states.some(state => state.id === id) ||
      held.finalStates.some(final => final.id === id) ||
      held.pseudostates.some(pseudo => pseudo.id === id) ||
      held.regions.some(region => region.id === id)
    );
  }

  /* ── The four readers one line is offered to, in order ───────────── */

  function readNote(line: string): boolean {
    if (!/^note\b/i.test(line)) return false;
    const { head, label } = splitLabel(line);

    // `note left of X : the prose` — a comment and the anchor Annex A attaches
    // it with, which is two statements written on one line.
    const anchored = /^note\s+(?:left|right|top|bottom)\s+of\s+(\S+)$/i.exec(
      head.trim()
    );
    if (anchored) {
      const record = addNote(
        `${model.diagram.id}-note-${++minted}`,
        label ?? ''
      );
      const target = entries.get(anchored[1]);
      if (target) {
        model.relations.push({
          kind: 'anchor',
          sourceId: record.id,
          targetId: target.id,
        });
      }
      return true;
    }

    // `note "the prose" as N` — the one-line form.
    const inline = /^note\s+"([^"]*)"\s+as\s+(\S+)$/i.exec(head.trim());
    if (inline) {
      addNote(inline[2], inline[1]);
      return true;
    }

    // `note as N` … `end note` — the block form, which is what this pack
    // writes, because a note is prose and routinely several lines.
    const block = /^note(?:\s+as\s+(\S+))?$/i.exec(head.trim());
    if (block) {
      const record = addNote(
        block[1] ?? `${model.diagram.id}-note-${++minted}`,
        ''
      );
      stack.push({ type: 'note', note: record });
      return true;
    }
    return false;
  }

  function addNote(id: string, body: string): UmlNote {
    const unique = entries.has(id) ? `${id}-${++minted}` : id;
    const record: UmlNote = {
      id: unique,
      name: '',
      keywords: [],
      isAbstract: false,
      body,
    };
    model.notes.push(record);
    register(unique);
    return record;
  }

  function readRelation(line: string): boolean {
    const { head, label } = splitLabel(line);
    const text = head.replaceAll(DIRECTION_HINT, '--').trim();
    const arrow = ARROW.exec(` ${text} `);
    if (!arrow) return false;
    const operator = OPERATORS.find(entry => entry.pattern.test(arrow[1]));
    if (!operator) return false;

    const cut = text.indexOf(` ${arrow[1]} `);
    if (cut < 0) return false;
    const left = splitEnd(text.slice(0, cut), true);
    const right = splitEnd(text.slice(cut + arrow[1].length + 2), false);
    if (!left.name || !right.name) return false;

    // §7.8.4: the keyword written on a dashed arrow IS which dependency it is.
    let kind = operator.kind;
    let written = label;
    const keyword = label
      ? /^(?:<<([^>]*)>>|«([^»]*)»)$/.exec(label.trim())
      : null;
    const named = (keyword?.[1] ?? keyword?.[2] ?? '').trim().toLowerCase();
    const role = KEYWORD_ROLE[named];
    if (role && (kind === 'dependency' || kind === 'association')) {
      // The keyword is DROPPED when it became the role, because the writer
      // emits it back from the role — `«include»` kept as a label as well would
      // be written on the line twice. `«use»` is the one that stays: a Usage is
      // a plain Dependency here, nothing re-emits the word, and the author put
      // it on the picture (§10.4.4's Figure 10.11 labels the socket with it).
      if (role !== kind) written = undefined;
      kind = role;
    }

    const fromId = endOf(left.name, !operator.reversed);
    const toId = endOf(right.name, Boolean(operator.reversed));
    if (!fromId || !toId) return false;

    const sourceId = operator.reversed ? toId : fromId;
    const targetId = operator.reversed ? fromId : toId;

    // §14.2.4.8's transition is the one relationship this reader projects, for
    // the reason `model.ts` projects it: the label carries a grammar no
    // structural relationship has, and both writers read it off the machine.
    const isTransition = behaviour && isVertex(sourceId) && isVertex(targetId);
    const relation: UmlRelation = {
      kind: isTransition ? 'transition' : kind,
      sourceId,
      targetId,
      ...(written ? { label: written } : {}),
    };
    model.relations.push(relation);
    if (isTransition) {
      const transition: UmlTransition = {
        sourceId,
        targetId,
        ...parseTransition(written),
      };
      machine().transitions.push(transition);
    }

    for (const [side, multiplicity] of [
      ['source', left.end],
      ['target', right.end],
    ] as const) {
      if (!multiplicity) continue;
      note({
        kind: 'carried',
        sourceId,
        message: `The ${side} end of the ${relation.kind} between "${left.name}" and "${right.name}" is written "${multiplicity}". Labre draws no end labels yet, so the multiplicity is recorded here and is not on the board.`,
      });
    }
    return true;
  }

  function readDeclaration(line: string): boolean {
    // `(Place an order) as UC` — the parenthesised use case, with no keyword.
    const bare = /^\(([^)]*)\)\s*(?:as\s+(\S+))?$/.exec(line);
    if (bare) {
      return declare('usecase', {
        label: bare[1],
        ...(bare[2] ? { alias: bare[2] } : {}),
        stereotypes: [],
        opens: false,
      });
    }

    const worded = new RegExp(`^(${DECLARATION_WORDS})\\b\\s*(.*)$`, 'i').exec(
      line
    );
    if (!worded) return false;
    const word = worded[1].toLowerCase().replace(/\s+/g, ' ');
    const declaration = parseDeclaration(worded[2]);
    if (!declaration) return false;
    if (word === 'abstract class' || word === 'abstract') {
      return declare('class', declaration, true);
    }
    return declare(word, declaration);
  }

  function declare(
    word: string,
    declaration: Declaration,
    abstract = false
  ): boolean {
    const kind = DECLARATION_KIND[word];
    if (!kind) return false;
    const wanted = declaration.alias || declaration.label || word;
    const standing = entries.get(wanted);
    if (standing?.implicit) forget(standing);
    if (entries.has(wanted)) {
      note({
        kind: 'substituted-id',
        sourceId: wanted,
        message: `This document declares "${wanted}" twice. The second declaration was read as a separate artefact under an id of Labre's own.`,
      });
    }
    const id = entries.has(wanted) ? `${wanted}-${++minted}` : wanted;

    switch (kind) {
      case 'class':
      case 'interface':
      case 'enumeration':
      case 'object': {
        const classifier = addClassifier(id, kind, declaration);
        if (abstract) classifier.isAbstract = true;
        // `{ … }` after a classifier is its MEMBER block, not a container.
        if (declaration.opens) stack.push({ type: 'members', classifier });
        return true;
      }
      case 'package':
      case 'subject': {
        const record = base(id, declaration);
        if (kind === 'package') model.packages.push(record);
        else model.subjects.push(record);
        register(id);
        if (declaration.opens) stack.push({ type: 'container', id });
        return true;
      }
      case 'actor':
        model.actors.push(base(id, declaration));
        register(id);
        return true;
      case 'use-case':
        model.useCases.push(base(id, declaration));
        register(id);
        return true;
      case 'component':
        model.components.push({
          ...base(id, declaration),
          ports: [],
          provided: [],
          required: [],
        });
        register(id);
        return true;
      case 'artifact':
        model.artifacts.push(base(id, declaration));
        register(id);
        return true;
      case 'node': {
        // §19.4.4 draws a Device and an ExecutionEnvironment as a Node cube
        // carrying a keyword, which is exactly what `plantuml.ts` writes.
        const stated = declaration.stereotypes.map(each => each.toLowerCase());
        const cube: UmlDeploymentNode['kind'] = stated.includes('device')
          ? 'device'
          : stated.includes('executionenvironment')
            ? 'execution-environment'
            : 'node';
        model.nodes.push({ ...base(id, declaration), kind: cube });
        register(id);
        return true;
      }
      case 'state': {
        behaviour = true;
        const stereotype = declaration.stereotypes
          .map(each => STATE_KIND_OF_STEREOTYPE[each.toLowerCase()])
          .find(Boolean);
        // The stereotype that named the GLYPH is PlantUML's notation for a
        // shape, not an Annex C keyword: `state c <<choice>>` draws a diamond,
        // and a diamond labelled «choice» would be the word written twice.
        if (stereotype) {
          declaration.stereotypes = declaration.stereotypes.filter(
            each => !STATE_KIND_OF_STEREOTYPE[each.toLowerCase()]
          );
        }
        const record = base(id, declaration);
        if (stereotype && PSEUDOSTATE_KINDS.has(stereotype)) {
          machine().pseudostates.push({
            ...record,
            kind: stereotype as UmlPseudostateKind,
          });
          register(id);
          return true;
        }
        if (stereotype === 'final-state') {
          machine().finalStates.push(record);
          register(id);
          return true;
        }
        // A composite state — §14.2.4's box drawn round its sub-machine, which
        // this pack draws as a REGION (`actions.ts`).
        if (declaration.opens) {
          machine().regions.push(record);
          register(id);
          stack.push({ type: 'container', id });
          return true;
        }
        addState(id, declaration);
        return true;
      }
      default:
        return false;
    }
  }

  /** `alias : line` — a member, or a state's internal activity. */
  function readExternalMember(line: string): boolean {
    const split = /^(\S+)\s*:\s*(.*)$/.exec(line);
    if (!split) return false;
    const entry = entries.get(split[1]);
    if (!entry) return false;
    const words = split[2].trim();
    if (entry.classifier) {
      if (words) addMember(entry.classifier, words);
      return true;
    }
    if (!entry.state) return false;
    // §14.2.4.4's compartment, read exactly as `model.ts` reads it off the
    // canvas: three labels, and everything else kept as a line of its own.
    const behaviourLine = /^(entry|do|exit)\s*\/\s*(.*)$/i.exec(words);
    const expression = behaviourLine?.[2].trim();
    if (behaviourLine && expression) {
      const label = behaviourLine[1].toLowerCase();
      if (label === 'entry') entry.state.entry.push(expression);
      else if (label === 'do') entry.state.doActivity.push(expression);
      else entry.state.exit.push(expression);
    } else if (words) {
      entry.state.lines.push(words);
    }
    return true;
  }

  /* ── The pass ────────────────────────────────────────────────────── */

  for (const raw of lines) {
    const line = raw.trim();
    if (!line || line.startsWith("'")) continue;

    const frame = top();

    if (frame.type === 'members') {
      if (line === '}') {
        stack.pop();
        continue;
      }
      // §9.5.4's own compartment separators, which are notation rather than a
      // member: on this canvas the compartments are the roles on the tiers.
      if (/^(-{2,}|\.{2,}|={2,}|_{2,})$/.test(line)) continue;
      addMember(frame.classifier, line);
      continue;
    }

    if (frame.type === 'note') {
      if (/^end\s*note$/i.test(line)) {
        stack.pop();
        continue;
      }
      frame.note.body = frame.note.body ? `${frame.note.body}\n${line}` : line;
      continue;
    }

    if (line === '}') {
      if (stack.length > 1) stack.pop();
      continue;
    }

    const title = /^title\s+(.+)$/i.exec(line);
    if (title) {
      const words = title[1].trim().split(/\s+/);
      const tagged = KIND_OF_TAG.get(words[0]);
      if (tagged && words.length > 1) {
        titleKind = tagged;
        model.diagram.name = words.slice(1).join(' ');
      } else {
        model.diagram.name = title[1].trim();
      }
      continue;
    }

    if (/^skinparam\b/i.test(line) || line.startsWith('!')) {
      note({
        kind: 'carried',
        element: line.split(/\s+/)[0],
        message: `"${line}" says how to DRAW the diagram. Labre's canvas has a look of its own, so the directive is recorded here and not applied.`,
      });
      continue;
    }

    if (readNote(line)) continue;
    if (readRelation(line)) continue;
    if (readDeclaration(line)) continue;
    if (readExternalMember(line)) continue;

    note({
      kind: 'carried',
      message: `Labre does not read "${line}", so it is not on the board. The line is recorded here exactly as the file wrote it.`,
    });
  }

  /* ── Finishing the model ─────────────────────────────────────────── */

  // The compartments, parsed — the same two readings `model.ts` makes of the
  // same lines, so an imported class and a drawn one hold the same record.
  for (const classifier of model.classifiers) {
    const attributeLines = classifier.lines.attributes;
    const isObject = classifier.kind === 'object';
    classifier.attributes = isObject ? [] : attributeLines.map(parseProperty);
    classifier.operations = classifier.lines.operations.map(parseOperation);
    classifier.slots = isObject ? attributeLines.map(slotOf) : [];
  }

  // The nesting §14.2.4 draws: a vertex inside a composite state belongs to it.
  const held = model.stateMachines[0];
  if (held) {
    const isRegion = (id: string) =>
      held.regions.some(region => region.id === id);
    for (const region of held.regions) {
      const parent = entries.get(region.id)?.parentId;
      if (parent && isRegion(parent)) region.parentId = parent;
    }
    for (const vertex of [
      ...held.states,
      ...held.finalStates,
      ...held.pseudostates,
    ]) {
      const parent = entries.get(vertex.id)?.parentId;
      if (parent && isRegion(parent)) vertex.regionId = parent;
    }
  }

  const kind: UmlDiagramKind =
    titleKind ??
    (behaviour ? 'stm' : model.useCases.length > 0 ? 'uc' : 'class');
  model.diagram.kind = kind;
  model.diagram.heading =
    `${UML_DIAGRAM_KIND_TAG[kind] ?? kind} ${model.diagram.name}`.trim();
  if (held) held.name = model.diagram.name;
  if (titleKind && titleKind !== 'stm' && behaviour) {
    note({
      kind: 'warning',
      sourceId: model.diagram.id,
      message: `"${model.diagram.heading}" is written in PlantUML's state-diagram syntax, which Labre reads as a state machine. The frame keeps the kind the title gave it.`,
    });
  }

  layOut(model, contains);
  return model;
}

/* ── Where PlantUML says nothing (D4) ─────────────────────────────────── */

/** The footprint each artefact of a model wants, by id, in document order. */
function footprints(model: UmlModel) {
  const out: { id: string; size: { w: number; h: number } }[] = [];
  const node = (record: UmlNodeBase, kind: UmlNodeKind) =>
    out.push({ id: record.id, size: UML_NODE_BOX[kind] });

  for (const record of model.packages) node(record, 'package');
  for (const record of model.classifiers) node(record, record.kind);
  for (const record of model.subjects) {
    out.push({ id: record.id, size: UML_SUBJECT_BOX });
  }
  for (const record of model.actors) node(record, 'actor');
  for (const record of model.useCases) node(record, 'use-case');
  for (const record of model.components) node(record, 'component');
  for (const record of model.artifacts) node(record, 'artifact');
  for (const record of model.nodes) node(record, record.kind);
  for (const machine of model.stateMachines) {
    for (const record of machine.regions) {
      out.push({ id: record.id, size: UML_REGION_BOX });
    }
    for (const record of machine.states) node(record, 'state');
    for (const record of machine.finalStates) node(record, 'final-state');
    for (const record of machine.pseudostates) node(record, record.kind);
  }
  for (const record of model.notes) node(record, 'note');
  return out;
}

/**
 * Give the model the geometry PlantUML does not carry.
 *
 * Written onto the IR's own `bounds` rather than handed to the materializer as
 * hints, because on this canvas geometry IS the statement: a class is in a
 * package when it is drawn inside it, and both writers read the nesting back
 * that way. A layout that lost `package P { class C }` would mean an import
 * followed by an export was not the file that went in.
 */
function layOut(model: UmlModel, contains: Map<string, string[]>): void {
  const boxes = umlInventLayout(
    footprints(model).map(entry => {
      const children = contains.get(entry.id);
      return { ...entry, ...(children ? { children } : {}) };
    }),
    model.relations
  );

  const place = (record: UmlNodeBase) => {
    const box = boxes.get(record.id);
    if (box) record.bounds = box;
  };
  for (const record of model.packages) place(record);
  for (const record of model.classifiers) place(record);
  for (const record of model.subjects) place(record);
  for (const record of model.actors) place(record);
  for (const record of model.useCases) place(record);
  for (const record of model.components) place(record);
  for (const record of model.artifacts) place(record);
  for (const record of model.nodes) place(record);
  for (const record of model.notes) place(record);
  for (const machine of model.stateMachines) {
    for (const record of machine.regions) place(record);
    for (const record of machine.states) place(record);
    for (const record of machine.finalStates) place(record);
    for (const record of machine.pseudostates) place(record);
  }
}

/* ── The reader ───────────────────────────────────────────────────────── */

/**
 * Read PlantUML source as one model per `@startuml … @enduml` block.
 *
 * Pure: a string in, records out. No `std`, no DOM, no clock, no randomness —
 * the same source always produces the same models, down to the coordinates.
 */
export function importPlantuml(source: string): UmlPlantumlImport {
  const notes: InterchangeNote[] = [];
  const note = (entry: InterchangeNote) => notes.push(entry);

  const lines = source.replaceAll('\r\n', '\n').split('\n');
  const blocks: string[][] = [];
  let open: string[] | undefined;
  for (const line of lines) {
    if (/^\s*@startuml\b/i.test(line)) {
      open = [];
      blocks.push(open);
      continue;
    }
    if (/^\s*@enduml\b/i.test(line)) {
      open = undefined;
      continue;
    }
    if (open) open.push(line);
  }

  // A snippet with no `@startuml` is the commonest thing anybody pastes, and
  // refusing it would be this reader insisting on a wrapper every editor plugin
  // in the ecosystem treats as optional.
  if (blocks.length === 0) blocks.push(lines);

  const models = blocks.map((block, index) => parseBlock(block, index, note));
  for (const model of models) {
    if (footprints(model).length === 0) continue;
    notes.push({
      kind: 'invented-layout',
      sourceId: model.diagram.id,
      message: `PlantUML carries no coordinates, so "${model.diagram.heading}" was laid out by Labre — in rows by generalization depth, with every container sized to fit what it holds. The positions are ours, not the file's.`,
    });
  }
  return { models, notes };
}
