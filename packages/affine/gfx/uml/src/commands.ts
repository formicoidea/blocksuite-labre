import type { BlockStdScope, CommandDescriptor } from '@labre/std';
import type { TemplateResult } from 'lit';

import {
  activateUmlEdge,
  createUmlClassifier,
  createUmlDiagram,
  createUmlFragment,
  createUmlInteractionUse,
  createUmlNode,
  createUmlPartition,
  createUmlRegion,
  createUmlSubject,
  exportUmlPlantumlFile,
  exportUmlXmiFile,
  importUmlDrawioFile,
  importUmlPlantumlFile,
  importUmlXmiFile,
  umlDiagramsForExport,
} from './actions.js';
import {
  umlExportPlantumlIcon,
  umlExportXmiIcon,
  umlImportDrawioIcon,
  umlImportPlantumlIcon,
  umlImportXmiIcon,
  UML_TOOLBOX_ICONS,
} from './toolbar/icons.js';

/**
 * The UML toolbox as commands — the single source every surface reads: the
 * senior sub-menu, the artefact catalogue, the palette, Settings › Shortcuts
 * and the agent (`docs/adr/0008`).
 *
 * ## Sixty-nine declared, fourteen nominated — a framework that does NOT fit
 *
 * UML 2.5.1 is the largest notation this library packs, by a distance: phase 1
 * declared twenty-one commands against a sub-menu of fourteen, phase 2's
 * structural half (components and deployment) appended eleven, its behavioural
 * half (activities and state machines) twenty-four more, and phase 3's sequence
 * diagrams append ten. So unlike C4 — the framework that fits to the entry —
 * the arbitration RUNS here: `selectSeniorMenuCommands` triggers on
 * `catalogue.length > SENIOR_MENU_CAP`, sixty-nine is nearly five times
 * fourteen, and the row a user meets is thirteen ranked buttons plus
 * "More artefacts…".
 *
 * That makes the head of the NOMINATION list the cold start every new user
 * meets, which is the lesson BPMN learned in a live recette (#144) and the
 * reason the order below is authored rather than grouped by family. It reads:
 *
 *   1. the DIAGRAM first — the sheet has to exist before anything can be put on
 *      it, and a first-time user who reaches for a class before a diagram draws
 *      a class on the void;
 *   2. then the IMPORT, in the second seat — see below, it is the one position
 *      that actually renders;
 *   3. then the classifiers a class diagram is mostly made of (class,
 *      interface, enumeration), then the containers and annotations (package),
 *      then the two shapes a USE-CASE diagram is made of (actor, use case) and
 *      the subject frame drawn round them;
 *   4. then the five relationships an author reaches for first — association,
 *      generalization, dependency, and the two use-case ones;
 *   5. and everything past the fourteenth slot DECLINES the row rather than
 *      contesting it: the object (an instance diagram is a second reading of a
 *      class diagram, not the first thing anybody draws), the four remaining
 *      relationships, the two exports, the other two imports, and — since
 *      phase 2 — the whole of components, deployment, activities and state
 *      machines, and since phase 3 the whole of sequence diagrams.
 *
 * Fourteen nominations is `SENIOR_MENU_CAP` exactly, which is the curation
 * budget `registry.unit.spec.ts` enforces — the pack stays inside it without
 * the PO having to arbitrate an over-nomination.
 *
 * ## Fourteen nominated, THIRTEEN rendered — and why the import is second
 *
 * The cap and the row are not the same number. `SENIOR_MENU_CAP` is 14 and is
 * what an owner may NOMINATE; what an overflowed row RENDERS is
 * `SENIOR_MENU_RANKED_SLOTS` — `MENU_RECENT_SLOTS + MENU_USED_SLOTS` = 13 —
 * plus the permanent "More artefacts…" button. With no usage recorded both
 * ranking axes collapse to authored order, so **the cold start is the first
 * THIRTEEN of this list and the fourteenth is invisible until somebody uses
 * it**.
 *
 * `uml.importXmi` was authored fourteenth when it landed (tranche G) and was
 * therefore the one nomination no new user could ever see — which is the whole
 * of what nominating it was for. It sits second now: a board comes FROM a file,
 * and the two things a user does to an empty canvas are draw a sheet and open
 * one. The command that falls off the cold-start row instead is the LAST
 * authored nomination, `uml.extendTool` — the rarer of the two use-case
 * relationships, one click away in the catalogue, and the honest thing to
 * spend a seat that only thirteen commands can hold.
 *
 * `bpmn.importXml` is authored LAST among BPMN's nominations and has the same
 * gap; it is out of this tranche's scope, and `bpmn.spec.ts` only ever asserts
 * its row with usage seeded.
 *
 * ## Why the aggregation / composition / realization / anchor tools decline
 *
 * Not because they are rare in UML — a composition is anything but — but
 * because of what a senior slot COSTS at this size. Aggregation and composition
 * are an association with a diamond on one end, realization is a
 * generalization with a dashed line, and an anchor is the line that ties a note
 * to what it comments on: each is one gesture away from the nominated tool
 * beside it, and tranche D's morph will make that gesture the toolbar's
 * business rather than the menu's. The catalogue carries all four, which is the
 * registry's own invariant: it is the TOTAL surface, and a command missing from
 * it is unreachable the moment its framework overflows — which this one does.
 */
interface Spec {
  id: string;
  label: string;
  iconKey: keyof typeof UML_TOOLBOX_ICONS;
  kind: 'artefact' | 'tool';
  /**
   * The catalogue section this entry is filed under. All four ids are existing
   * library sections C4 and BPMN already use, and they already mean what UML
   * means by them: the frame is a `diagrams` entry, a classifier an `elements`
   * one, a typed line a `relations` one, and the subject a `boundaries` one —
   * a subject is neither an element of the model nor the sheet it is drawn on,
   * exactly as a C4 boundary is neither.
   */
  category: 'diagrams' | 'elements' | 'boundaries' | 'relations';
  /** Historical `FrameworkElementEvent.element` value — do not rename. */
  element: string;
  /** Places the framework's board — see `CommandTelemetry.board`. */
  board?: true;
  /**
   * Whether the entry contests the senior row. `false` is a DECLARATION, not a
   * default: past the cap `selectSeniorMenuCommands` ranks the nominated list
   * only, so a declined surface is never out-voted by usage (PO ruling of
   * 2026-08-28).
   */
  senior: boolean;
  run: (std: BlockStdScope) => void;
}

const SPECS: Spec[] = [
  /* ── The sheet everything else is drawn on ──────────────────────────── */
  {
    id: 'addDiagram',
    label: 'UML diagram',
    iconKey: 'uml.diagram',
    kind: 'artefact',
    category: 'diagrams',
    element: 'board',
    board: true,
    senior: true,
    // Wrapped, not passed by reference: `run` is called `(std, invocation)` and
    // `createUmlDiagram` takes `(std, kind = 'class')`, so handing it over bare
    // would make the invocation object the diagram's KIND. The frame is always
    // born a class diagram; the picker on its own row is what changes it.
    run: std => createUmlDiagram(std),
  },
  /* ── The classifiers a class diagram is mostly made of ──────────────── */
  {
    id: 'addClass',
    label: 'Class',
    iconKey: 'uml.class',
    kind: 'artefact',
    category: 'elements',
    element: 'node:class',
    senior: true,
    run: std => createUmlClassifier(std, 'class'),
  },
  {
    id: 'addInterface',
    label: 'Interface',
    iconKey: 'uml.interface',
    kind: 'artefact',
    category: 'elements',
    element: 'node:interface',
    senior: true,
    run: std => createUmlClassifier(std, 'interface'),
  },
  {
    id: 'addEnumeration',
    label: 'Enumeration',
    iconKey: 'uml.enumeration',
    kind: 'artefact',
    category: 'elements',
    element: 'node:enumeration',
    senior: true,
    run: std => createUmlClassifier(std, 'enumeration'),
  },
  /* ── What holds them and what comments on them ──────────────────────── */
  {
    id: 'addPackage',
    label: 'Package',
    iconKey: 'uml.package',
    kind: 'artefact',
    category: 'elements',
    element: 'node:package',
    senior: true,
    run: std => createUmlNode(std, 'package'),
  },
  {
    id: 'addNote',
    label: 'Note',
    iconKey: 'uml.note',
    kind: 'artefact',
    category: 'elements',
    element: 'node:note',
    senior: false,
    // ponytail: DEMOTED from the nominated fourteen to make room for
    // `uml.importXmi` (tranche G, `docs/adr/0019`). The budget is fourteen plus
    // the single over-nomination the PO authorized on 2026-08-28, which BPMN
    // has spent, so a fifteenth UML nomination would break
    // `registry.unit.spec.ts` — and an import is the one entry a user wants on
    // an EMPTY board, which is exactly when the sub-menu is open (the same
    // ruling that put `bpmn.importXml` in its row). The note is still one click
    // away behind "More artefacts…".
    //
    // Which of the fourteen an import ought to displace is a PO curation point
    // with usage data behind it, not a tranche's to settle: the note was picked
    // because it is the only nominated artefact that annotates a diagram rather
    // than being part of one. Revisit with the phase-2 recette.
    run: std => createUmlNode(std, 'note'),
  },
  /* ── The two shapes a USE-CASE diagram is made of, and their frame ───── */
  {
    id: 'addActor',
    label: 'Actor',
    iconKey: 'uml.actor',
    kind: 'artefact',
    category: 'elements',
    element: 'node:actor',
    senior: true,
    run: std => createUmlNode(std, 'actor'),
  },
  {
    id: 'addUseCase',
    label: 'Use case',
    iconKey: 'uml.use-case',
    kind: 'artefact',
    category: 'elements',
    element: 'node:use-case',
    senior: true,
    run: std => createUmlNode(std, 'use-case'),
  },
  {
    id: 'addSubject',
    label: 'Subject',
    iconKey: 'uml.subject',
    kind: 'artefact',
    category: 'boundaries',
    element: 'boundary:subject',
    senior: true,
    run: createUmlSubject,
  },
  /* ── The relationships an author reaches for first ──────────────────── */
  {
    id: 'associationTool',
    label: 'Association',
    iconKey: 'uml.association',
    kind: 'tool',
    category: 'relations',
    element: 'connector:association',
    senior: true,
    run: std => activateUmlEdge(std, 'association'),
  },
  {
    id: 'generalizationTool',
    label: 'Generalization',
    iconKey: 'uml.generalization',
    kind: 'tool',
    category: 'relations',
    element: 'connector:generalization',
    senior: true,
    run: std => activateUmlEdge(std, 'generalization'),
  },
  {
    id: 'dependencyTool',
    label: 'Dependency',
    iconKey: 'uml.dependency',
    kind: 'tool',
    category: 'relations',
    element: 'connector:dependency',
    senior: true,
    run: std => activateUmlEdge(std, 'dependency'),
  },
  {
    id: 'includeTool',
    label: 'Include',
    iconKey: 'uml.include',
    kind: 'tool',
    category: 'relations',
    element: 'connector:include',
    senior: true,
    run: std => activateUmlEdge(std, 'include'),
  },
  {
    id: 'extendTool',
    label: 'Extend',
    iconKey: 'uml.extend',
    kind: 'tool',
    category: 'relations',
    element: 'connector:extend',
    senior: true,
    run: std => activateUmlEdge(std, 'extend'),
  },
  /* ── Past the fourteenth slot: declared, reachable, off the row ──────── */
  {
    // An instance diagram is a SECOND reading of a class diagram — you draw one
    // once the classes exist — so it is the first thing to leave the row.
    id: 'addObject',
    label: 'Object',
    iconKey: 'uml.object',
    kind: 'artefact',
    category: 'elements',
    element: 'node:object',
    senior: false,
    run: std => createUmlClassifier(std, 'object'),
  },
  {
    id: 'aggregationTool',
    label: 'Aggregation',
    iconKey: 'uml.aggregation',
    kind: 'tool',
    category: 'relations',
    element: 'connector:aggregation',
    senior: false,
    run: std => activateUmlEdge(std, 'aggregation'),
  },
  {
    id: 'compositionTool',
    label: 'Composition',
    iconKey: 'uml.composition',
    kind: 'tool',
    category: 'relations',
    element: 'connector:composition',
    senior: false,
    run: std => activateUmlEdge(std, 'composition'),
  },
  {
    id: 'realizationTool',
    label: 'Realization',
    iconKey: 'uml.realization',
    kind: 'tool',
    category: 'relations',
    element: 'connector:realization',
    senior: false,
    run: std => activateUmlEdge(std, 'realization'),
  },
  {
    id: 'anchorTool',
    label: 'Anchor',
    iconKey: 'uml.anchor',
    kind: 'tool',
    category: 'relations',
    element: 'connector:anchor',
    senior: false,
    run: std => activateUmlEdge(std, 'anchor'),
  },
  /* ── Phase 2: components (§11.6.4, §11.3.4, §10.4.4) ─────────────────── */
  // Every one of the eleven below declines the row, and it is ONE decision
  // rather than eleven: the phase-1 fourteen are what a user meets on a cold
  // start, they are the class and use-case diagrams an architect draws first,
  // and phase 2 does not get to re-argue that from inside its own tranche.
  // The PO's curation point #1 is where `uml.addComponent` contests a seat —
  // most likely `uml.addNote`'s — and until it is made the whole of components
  // and deployment lives in the catalogue, the palette and the agent, which is
  // the registry's own invariant: the catalogue is the TOTAL surface.
  {
    id: 'addComponent',
    label: 'Component',
    iconKey: 'uml.component',
    kind: 'artefact',
    category: 'elements',
    element: 'node:component',
    senior: false,
    run: std => createUmlClassifier(std, 'component'),
  },
  {
    id: 'addPort',
    label: 'Port',
    iconKey: 'uml.port',
    kind: 'artefact',
    category: 'elements',
    element: 'node:port',
    senior: false,
    run: std => createUmlNode(std, 'port'),
  },
  {
    id: 'addProvidedInterface',
    label: 'Provided interface',
    iconKey: 'uml.provided-interface',
    kind: 'artefact',
    category: 'elements',
    element: 'node:provided-interface',
    senior: false,
    run: std => createUmlNode(std, 'provided-interface'),
  },
  {
    id: 'addRequiredInterface',
    label: 'Required interface',
    iconKey: 'uml.required-interface',
    kind: 'artefact',
    category: 'elements',
    element: 'node:required-interface',
    senior: false,
    run: std => createUmlNode(std, 'required-interface'),
  },
  /* ── Phase 2: deployment (§19.2.4, §19.3.4, §19.4.4) ─────────────────── */
  {
    id: 'addArtifact',
    label: 'Artifact',
    iconKey: 'uml.artifact',
    kind: 'artefact',
    category: 'elements',
    element: 'node:artifact',
    senior: false,
    run: std => createUmlClassifier(std, 'artifact'),
  },
  {
    id: 'addNode',
    label: 'Node',
    iconKey: 'uml.node',
    kind: 'artefact',
    category: 'elements',
    element: 'node:node',
    senior: false,
    run: std => createUmlNode(std, 'node'),
  },
  {
    id: 'addDevice',
    label: 'Device',
    iconKey: 'uml.device',
    kind: 'artefact',
    category: 'elements',
    element: 'node:device',
    senior: false,
    run: std => createUmlNode(std, 'device'),
  },
  {
    id: 'addExecutionEnvironment',
    label: 'Execution environment',
    iconKey: 'uml.execution-environment',
    kind: 'artefact',
    category: 'elements',
    element: 'node:execution-environment',
    senior: false,
    run: std => createUmlNode(std, 'execution-environment'),
  },
  {
    id: 'deployTool',
    label: 'Deploy',
    iconKey: 'uml.deploy',
    kind: 'tool',
    category: 'relations',
    element: 'connector:deploy',
    senior: false,
    run: std => activateUmlEdge(std, 'deploy'),
  },
  {
    id: 'manifestTool',
    label: 'Manifest',
    iconKey: 'uml.manifest',
    kind: 'tool',
    category: 'relations',
    element: 'connector:manifest',
    senior: false,
    run: std => activateUmlEdge(std, 'manifest'),
  },
  {
    id: 'communicationPathTool',
    label: 'Communication path',
    iconKey: 'uml.communication-path',
    kind: 'tool',
    category: 'relations',
    element: 'connector:communication-path',
    senior: false,
    run: std => activateUmlEdge(std, 'communication-path'),
  },
  /* ── Phase 2: activities (§15.2.4, §15.3.4, §15.4.4, §16.3.4, §16.10.4) ─ */
  // The same ONE decision the eleven above made, restated for twenty-four: the
  // senior row is the phase-1 fourteen, and a behaviour tranche does not get to
  // re-argue it from inside itself either. At this many catalogue entries the
  // row would be arbitrary whatever it held, and the honest place for that
  // arbitration is a PO curation point with the usage data in front of it —
  // which is also why `uml.addAction`, the single most-drawn shape of an
  // activity diagram, declines a seat it would plainly deserve. Everything is
  // reachable: the catalogue is the TOTAL surface, and the palette and the
  // agent carry every one of them.
  {
    id: 'addAction',
    label: 'Action',
    iconKey: 'uml.action',
    kind: 'artefact',
    category: 'elements',
    element: 'node:action',
    senior: false,
    run: std => createUmlNode(std, 'action'),
  },
  {
    id: 'addInitial',
    label: 'Initial node',
    iconKey: 'uml.initial',
    kind: 'artefact',
    category: 'elements',
    element: 'node:initial',
    senior: false,
    run: std => createUmlNode(std, 'initial'),
  },
  {
    id: 'addActivityFinal',
    label: 'Activity final',
    iconKey: 'uml.activity-final',
    kind: 'artefact',
    category: 'elements',
    element: 'node:activity-final',
    senior: false,
    run: std => createUmlNode(std, 'activity-final'),
  },
  {
    id: 'addFlowFinal',
    label: 'Flow final',
    iconKey: 'uml.flow-final',
    kind: 'artefact',
    category: 'elements',
    element: 'node:flow-final',
    senior: false,
    run: std => createUmlNode(std, 'flow-final'),
  },
  {
    id: 'addDecision',
    label: 'Decision',
    iconKey: 'uml.decision',
    kind: 'artefact',
    category: 'elements',
    element: 'node:decision',
    senior: false,
    run: std => createUmlNode(std, 'decision'),
  },
  {
    id: 'addFork',
    label: 'Fork',
    iconKey: 'uml.fork',
    kind: 'artefact',
    category: 'elements',
    element: 'node:fork',
    senior: false,
    run: std => createUmlNode(std, 'fork'),
  },
  {
    id: 'addObjectNode',
    label: 'Object node',
    iconKey: 'uml.object-node',
    kind: 'artefact',
    category: 'elements',
    element: 'node:object-node',
    senior: false,
    run: std => createUmlNode(std, 'object-node'),
  },
  {
    id: 'addSendSignal',
    label: 'Send signal',
    iconKey: 'uml.send-signal',
    kind: 'artefact',
    category: 'elements',
    element: 'node:send-signal',
    senior: false,
    run: std => createUmlNode(std, 'send-signal'),
  },
  {
    id: 'addAcceptEvent',
    label: 'Accept event',
    iconKey: 'uml.accept-event',
    kind: 'artefact',
    category: 'elements',
    element: 'node:accept-event',
    senior: false,
    run: std => createUmlNode(std, 'accept-event'),
  },
  {
    id: 'addTimeEvent',
    label: 'Time event',
    iconKey: 'uml.time-event',
    kind: 'artefact',
    category: 'elements',
    element: 'node:time-event',
    senior: false,
    run: std => createUmlNode(std, 'time-event'),
  },
  {
    // A swimlane is filed under `boundaries` for the reason the subject is: it
    // is neither an element of the model nor the sheet the model is drawn on,
    // it is a band drawn ROUND part of the drawing, and what belongs to it is
    // read back from where things sit (§15.6.4).
    id: 'addPartition',
    label: 'Partition',
    iconKey: 'uml.partition',
    kind: 'artefact',
    category: 'boundaries',
    element: 'boundary:partition',
    senior: false,
    run: createUmlPartition,
  },
  /* ── Phase 2: state machines (§14.2.4) ───────────────────────────────── */
  {
    id: 'addState',
    label: 'State',
    iconKey: 'uml.state',
    kind: 'artefact',
    category: 'elements',
    element: 'node:state',
    senior: false,
    // The one behaviour artefact that walks the CLASSIFIER path: §14.2.4 draws
    // a state as a divided box, so it arrives with a name compartment and the
    // internal-activities tier the renderer rules off (`actions.ts`).
    run: std => createUmlClassifier(std, 'state'),
  },
  {
    id: 'addFinalState',
    label: 'Final state',
    iconKey: 'uml.final-state',
    kind: 'artefact',
    category: 'elements',
    element: 'node:final-state',
    senior: false,
    run: std => createUmlNode(std, 'final-state'),
  },
  {
    id: 'addChoice',
    label: 'Choice',
    iconKey: 'uml.choice',
    kind: 'artefact',
    category: 'elements',
    element: 'node:choice',
    senior: false,
    run: std => createUmlNode(std, 'choice'),
  },
  {
    id: 'addJunction',
    label: 'Junction',
    iconKey: 'uml.junction',
    kind: 'artefact',
    category: 'elements',
    element: 'node:junction',
    senior: false,
    run: std => createUmlNode(std, 'junction'),
  },
  {
    id: 'addShallowHistory',
    label: 'Shallow history',
    iconKey: 'uml.shallow-history',
    kind: 'artefact',
    category: 'elements',
    element: 'node:shallow-history',
    senior: false,
    run: std => createUmlNode(std, 'shallow-history'),
  },
  {
    id: 'addDeepHistory',
    label: 'Deep history',
    iconKey: 'uml.deep-history',
    kind: 'artefact',
    category: 'elements',
    element: 'node:deep-history',
    senior: false,
    run: std => createUmlNode(std, 'deep-history'),
  },
  {
    id: 'addEntryPoint',
    label: 'Entry point',
    iconKey: 'uml.entry-point',
    kind: 'artefact',
    category: 'elements',
    element: 'node:entry-point',
    senior: false,
    run: std => createUmlNode(std, 'entry-point'),
  },
  {
    id: 'addExitPoint',
    label: 'Exit point',
    iconKey: 'uml.exit-point',
    kind: 'artefact',
    category: 'elements',
    element: 'node:exit-point',
    senior: false,
    run: std => createUmlNode(std, 'exit-point'),
  },
  {
    id: 'addTerminate',
    label: 'Terminate',
    iconKey: 'uml.terminate',
    kind: 'artefact',
    category: 'elements',
    element: 'node:terminate',
    senior: false,
    run: std => createUmlNode(std, 'terminate'),
  },
  {
    // A composite state, as the container it is drawn as (§14.2.4) — and a
    // `boundaries` entry for the same reason the partition beside it is one:
    // what is IN a region is read back from geometry, never from a list.
    id: 'addRegion',
    label: 'Region',
    iconKey: 'uml.region',
    kind: 'artefact',
    category: 'boundaries',
    element: 'boundary:region',
    senior: false,
    run: createUmlRegion,
  },
  /* ── Phase 2: the behaviour lines ────────────────────────────────────── */
  {
    id: 'controlFlowTool',
    label: 'Control flow',
    iconKey: 'uml.control-flow',
    kind: 'tool',
    category: 'relations',
    element: 'connector:control-flow',
    senior: false,
    run: std => activateUmlEdge(std, 'control-flow'),
  },
  {
    id: 'objectFlowTool',
    label: 'Object flow',
    iconKey: 'uml.object-flow',
    kind: 'tool',
    category: 'relations',
    element: 'connector:object-flow',
    senior: false,
    run: std => activateUmlEdge(std, 'object-flow'),
  },
  {
    id: 'transitionTool',
    label: 'Transition',
    iconKey: 'uml.transition',
    kind: 'tool',
    category: 'relations',
    element: 'connector:transition',
    senior: false,
    run: std => activateUmlEdge(std, 'transition'),
  },
  /* ── Phase 3: sequence diagrams (§17.2.4, §17.4.4, §17.6.4, §17.7.4) ─── */
  // The same ONE decision phases 2 and 2b made, restated for ten: the senior
  // row is the phase-1 fourteen and a sequence tranche does not get to
  // re-argue it from inside itself either. `uml.addLifeline` is the entry with
  // the strongest claim on a seat — a sequence diagram is the second-most-drawn
  // UML diagram after the class diagram — and it is a PO curation point with
  // usage data behind it rather than this tranche's to take. Everything is
  // reachable: the catalogue is the TOTAL surface, and the palette and the
  // agent carry all sixty-nine.
  {
    id: 'addLifeline',
    label: 'Lifeline',
    iconKey: 'uml.lifeline',
    kind: 'artefact',
    category: 'elements',
    element: 'node:lifeline',
    senior: false,
    run: std => createUmlNode(std, 'lifeline'),
  },
  {
    id: 'addExecution',
    label: 'Execution',
    iconKey: 'uml.execution',
    kind: 'artefact',
    category: 'elements',
    element: 'node:execution',
    senior: false,
    run: std => createUmlNode(std, 'execution'),
  },
  {
    id: 'addDestruction',
    label: 'Destruction',
    iconKey: 'uml.destruction',
    kind: 'artefact',
    category: 'elements',
    element: 'node:destruction',
    senior: false,
    run: std => createUmlNode(std, 'destruction'),
  },
  {
    // A combined fragment is filed under `boundaries` for the reason the
    // partition and the region are: it is neither an element of the model nor
    // the sheet the model is drawn on, it is a box drawn ROUND part of the
    // drawing, and what is inside it is read back from where things sit
    // (§17.6.4).
    id: 'addFragment',
    label: 'Combined fragment',
    iconKey: 'uml.fragment',
    kind: 'artefact',
    category: 'boundaries',
    element: 'boundary:fragment',
    senior: false,
    // Wrapped rather than passed by reference, the same call `uml.addDiagram`
    // makes: `run` is called `(std, invocation)` and `createUmlFragment` takes
    // `(std, operator = 'alt')`, so handing it over bare would make the
    // invocation object the fragment's OPERATOR.
    run: std => createUmlFragment(std),
  },
  {
    // The same element with `ref` in its tag (§17.7.4) — a command of its own
    // because it is a different modelling act: pointing at another diagram
    // rather than branching this one. See `createUmlInteractionUse`.
    id: 'addInteractionUse',
    label: 'Interaction use',
    iconKey: 'uml.interaction-use',
    kind: 'artefact',
    category: 'boundaries',
    element: 'boundary:interaction-use',
    senior: false,
    run: createUmlInteractionUse,
  },
  /* ── Phase 3: the five message lines ─────────────────────────────────── */
  {
    id: 'messageSyncTool',
    label: 'Synchronous message',
    iconKey: 'uml.message-sync',
    kind: 'tool',
    category: 'relations',
    element: 'connector:message-sync',
    senior: false,
    run: std => activateUmlEdge(std, 'message-sync'),
  },
  {
    id: 'messageAsyncTool',
    label: 'Asynchronous message',
    iconKey: 'uml.message-async',
    kind: 'tool',
    category: 'relations',
    element: 'connector:message-async',
    senior: false,
    run: std => activateUmlEdge(std, 'message-async'),
  },
  {
    id: 'messageReplyTool',
    label: 'Reply message',
    iconKey: 'uml.message-reply',
    kind: 'tool',
    category: 'relations',
    element: 'connector:message-reply',
    senior: false,
    run: std => activateUmlEdge(std, 'message-reply'),
  },
  {
    id: 'messageCreateTool',
    label: 'Create message',
    iconKey: 'uml.message-create',
    kind: 'tool',
    category: 'relations',
    element: 'connector:message-create',
    senior: false,
    run: std => activateUmlEdge(std, 'message-create'),
  },
  {
    id: 'messageDeleteTool',
    label: 'Delete message',
    iconKey: 'uml.message-delete',
    kind: 'tool',
    category: 'relations',
    element: 'connector:message-delete',
    senior: false,
    run: std => activateUmlEdge(std, 'message-delete'),
  },
];

/**
 * The authored slot the senior row's IMPORT sits in — second, between the
 * diagram frame and the class.
 *
 * A named constant rather than a literal because two things have to agree about
 * it and they are three hundred lines apart: `uml.importXmi`'s descriptor, and
 * the shift below that leaves the slot empty. The header says why it is this
 * slot and not the fourteenth.
 */
const UML_IMPORT_ROW_ORDER = 1;

const toolboxCommands: CommandDescriptor[] = SPECS.map((spec, index) => ({
  id: `uml.${spec.id}`,
  owner: 'uml',
  kind: spec.kind,
  labelKey: `com.labre.commands.uml.${spec.id}`,
  labelFallback: spec.label,
  category: spec.category,
  iconKey: spec.iconKey,
  surfaces: spec.senior
    ? ['senior-menu', 'catalogue', 'palette', 'agent']
    : ['catalogue', 'palette', 'agent'],
  // The sheet keeps slot 0 and everything after it shifts by one, which leaves
  // {@link UML_IMPORT_ROW_ORDER} free for the import. A gap rather than a
  // fractional order: `order` is sorted numerically on four surfaces and a
  // `0.5` in the middle of it is a thing the next author has to decode.
  order: index === 0 ? 0 : index + 1,
  scope: 'edgeless',
  // Keyless by intent, and at sixty-nine commands there is no chord alphabet
  // that would not be arbitrary — still bindable from Settings › Shortcuts,
  // which is what `toShortcutDescriptor` being total buys.
  defaultKeys: { mac: [], other: [] },
  availability: 'always',
  run: spec.run,
  telemetry: { framework: 'uml', element: spec.element, board: spec.board },
}));

/**
 * The two EXPORTS — the commands whose subject is a whole DIAGRAM.
 *
 * ## Two formats, two commands, and neither implies the other
 *
 * ADR 0012 declares interchange per framework × format × direction, so PlantUML
 * and XMI are two rows rather than one row with an option. They are also two
 * different promises: XMI 2.5.1 is the OMG's own interchange format and carries
 * the model (classifiers, their attributes and operations, the typed ends of
 * every relationship); PlantUML carries the same model as a source a human
 * reads and a renderer redraws. Both are `tier: 'semantic'` — neither is a
 * picture — and `interchange.ts` is where that is declared.
 *
 * ## Why the selection is the scope
 *
 * A UML diagram frame is ONE diagram — a class diagram, a use-case diagram —
 * and the point of drawing three side by side is that they are three diagrams.
 * Merging them would produce a document neither format can express (a `@startuml`
 * has one title; an XMI `uml:Model` one root), so the selection decides: one
 * frame, one document; several frames, several documents in one file.
 *
 * ## Surfaces
 *
 * Both decline `'senior-menu'`: the sub-menu is what you reach for to DRAW
 * something, and an export draws nothing — and UML is already past the cap, so
 * a slot spent here is a slot taken from an artefact. They keep `'catalogue'`,
 * which is not a category claim but the registry's own invariant: the catalogue
 * is the TOTAL surface.
 *
 * On the frame's own row they sit in the "⋮" rather than as buttons, and in the
 * ALWAYS-ON toolbar module — the entry hides itself when the command is absent
 * from the registry (the `when` guard every `commandAction` carries), so with
 * the UML tooling flag off the row is the resize toggle alone and nothing on it
 * can be clicked into a no-op. See `toolbar/config.ts`.
 */
const exportCommands: CommandDescriptor[] = [
  {
    id: 'uml.exportPlantuml',
    owner: 'uml',
    kind: 'action',
    labelKey: 'com.labre.commands.uml.exportPlantuml',
    labelFallback: 'Export as PlantUML',
    descriptionKey: 'com.labre.commands.uml.exportPlantuml.description',
    descriptionFallback:
      'Download the selected diagram as PlantUML source, ready to paste into any PlantUML renderer.',
    category: 'diagrams',
    iconKey: 'uml.export-plantuml',
    surfaces: ['catalogue', 'contextual-toolbar', 'palette', 'agent'],
    // `+ 1` because the toolbox's own orders run 0 then 2…SPECS.length — the
    // gap that reserves {@link UML_IMPORT_ROW_ORDER} costs one at this end too.
    order: SPECS.length + 1,
    scope: 'edgeless',
    defaultKeys: { mac: [], other: [] },
    availability: 'selection',
    run: exportUmlPlantumlFile,
    telemetry: { framework: 'uml', element: 'board:export-plantuml' },
    // A diagram in the selection, and no more than that: an export READS, so
    // it is offered on a read-only document — which is precisely the diagram
    // somebody wants to take away.
    when: std => umlDiagramsForExport(std).length > 0,
  },
  {
    id: 'uml.exportXmi',
    owner: 'uml',
    kind: 'action',
    labelKey: 'com.labre.commands.uml.exportXmi',
    labelFallback: 'Export as XMI',
    descriptionKey: 'com.labre.commands.uml.exportXmi.description',
    descriptionFallback:
      'Download the selected diagram as XMI 2.5.1, the OMG interchange format every UML tool reads.',
    category: 'diagrams',
    iconKey: 'uml.export-xmi',
    surfaces: ['catalogue', 'contextual-toolbar', 'palette', 'agent'],
    order: SPECS.length + 2,
    scope: 'edgeless',
    defaultKeys: { mac: [], other: [] },
    availability: 'selection',
    run: exportUmlXmiFile,
    telemetry: { framework: 'uml', element: 'board:export-xmi' },
    when: std => umlDiagramsForExport(std).length > 0,
  },
];

/**
 * The three IMPORTS — where a UML board comes FROM (`docs/adr/0019`).
 *
 * ## Three rows, because the unit of declaration is the triple
 *
 * ADR 0012 declares interchange per framework × format × direction, so three
 * formats are three commands and never one command with a format picker. They
 * are also three different PROMISES, and the promise is made by each command's
 * own label and description before the picker opens (P2): PlantUML and XMI
 * carry a MODEL and take the whole preservation contract; draw.io carries a
 * DRAWING, and every UML fact read out of it is a guess made from a style
 * string. A picker with three entries behind one button would hide exactly that
 * difference at exactly the moment it matters.
 *
 * ## One nomination, and it cost the note its seat
 *
 * R5 puts an import in the senior sub-menu — the same ruling of 2026-08-28 that
 * nominated `bpmn.importXml`: a board comes from a file, and the sub-menu is
 * the first thing a user opens on an empty canvas. The budget is
 * `SENIOR_MENU_CAP` nominations plus the single over-nomination the PO
 * authorized that day, which BPMN has spent — so UML's fifteenth nomination
 * would break `registry.unit.spec.ts` rather than merely crowd the row.
 *
 * So exactly ONE of the three takes the seat, and it is XMI: it is the OMG's
 * own interchange format, it is the one every modelling tool writes, and it is
 * the one that re-imports what this pack exports. The other two sit one click
 * away in the catalogue behind "More artefacts…". `uml.addNote` is the entry
 * that stood down for it, with the reasoning recorded at its declaration — a
 * PO curation point, flagged there rather than settled here.
 */
const importCommands: CommandDescriptor[] = [
  {
    id: 'uml.importXmi',
    owner: 'uml',
    kind: 'action',
    labelKey: 'com.labre.commands.uml.importXmi',
    labelFallback: 'Import XMI',
    descriptionKey: 'com.labre.commands.uml.importXmi.description',
    descriptionFallback:
      'Open an XMI 2.5.1 model as a diagram. What Labre cannot draw is kept in the document, and the import says what it was.',
    category: 'diagrams',
    iconKey: 'uml.import-xmi',
    // The one nominated import — see the header. Not the contextual toolbar: a
    // contextual toolbar is a statement about a SELECTION, and the moment this
    // is most wanted is on a board with nothing on it.
    surfaces: ['senior-menu', 'catalogue', 'palette', 'agent'],
    // SECOND, not last. What an overflowed row renders is thirteen, not the
    // fourteen an owner may nominate, and with no usage recorded that is the
    // first thirteen of the authored order — so a fourteenth nomination is one
    // no new user ever sees. See the header.
    order: UML_IMPORT_ROW_ORDER,
    scope: 'edgeless',
    defaultKeys: { mac: [], other: [] },
    // An import WRITES, so a read-only document is one it cannot run on and the
    // declaration says so. `'always'` would light the entry on a read-only
    // board, do nothing when clicked, and put the same untruth into the
    // serializable manifest a host reads. Nothing has to be SELECTED — which is
    // the mirror image of the exports beside it — so there is no `when`.
    availability: 'editable',
    run: importUmlXmiFile,
    // `board:` and not `diagram:`: an export names the frame whose toolbar
    // launched it, and an import is launched with no frame anywhere.
    telemetry: { framework: 'uml', element: 'board:import-xmi' },
  },
  {
    id: 'uml.importPlantuml',
    owner: 'uml',
    kind: 'action',
    labelKey: 'com.labre.commands.uml.importPlantuml',
    labelFallback: 'Import PlantUML',
    descriptionKey: 'com.labre.commands.uml.importPlantuml.description',
    descriptionFallback:
      'Open a PlantUML source as a diagram. Lines Labre cannot read are kept in the document, and the import says which.',
    category: 'diagrams',
    iconKey: 'uml.import-plantuml',
    surfaces: ['catalogue', 'palette', 'agent'],
    order: SPECS.length + 3,
    scope: 'edgeless',
    defaultKeys: { mac: [], other: [] },
    availability: 'editable',
    run: importUmlPlantumlFile,
    telemetry: { framework: 'uml', element: 'board:import-plantuml' },
  },
  {
    id: 'uml.importDrawio',
    owner: 'uml',
    kind: 'action',
    labelKey: 'com.labre.commands.uml.importDrawio',
    labelFallback: 'Import draw.io drawing',
    descriptionKey: 'com.labre.commands.uml.importDrawio.description',
    descriptionFallback:
      'Recognise a draw.io drawing as UML, best effort: the shapes and arrows it understands become a diagram, and it says what it could not read.',
    category: 'diagrams',
    iconKey: 'uml.import-drawio',
    surfaces: ['catalogue', 'palette', 'agent'],
    order: SPECS.length + 4,
    scope: 'edgeless',
    defaultKeys: { mac: [], other: [] },
    availability: 'editable',
    run: importUmlDrawioFile,
    telemetry: { framework: 'uml', element: 'board:import-drawio' },
  },
];

export const umlCommands: CommandDescriptor[] = [
  ...toolboxCommands,
  ...exportCommands,
  ...importCommands,
];

export const umlCommandIcons: Record<string, TemplateResult> = {
  ...UML_TOOLBOX_ICONS,
  'uml.export-plantuml': umlExportPlantumlIcon,
  'uml.export-xmi': umlExportXmiIcon,
  'uml.import-plantuml': umlImportPlantumlIcon,
  'uml.import-xmi': umlImportXmiIcon,
  'uml.import-drawio': umlImportDrawioIcon,
};
