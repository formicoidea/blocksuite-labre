import type { BlockStdScope, CommandDescriptor } from '@labre/std';
import type { TemplateResult } from 'lit';

import {
  activateUmlEdge,
  createUmlClassifier,
  createUmlDiagram,
  createUmlNode,
  createUmlSubject,
  exportUmlPlantumlFile,
  exportUmlXmiFile,
  umlDiagramsForExport,
} from './actions.js';
import {
  umlExportPlantumlIcon,
  umlExportXmiIcon,
  UML_TOOLBOX_ICONS,
} from './toolbar/icons.js';

/**
 * The UML toolbox as commands — the single source every surface reads: the
 * senior sub-menu, the artefact catalogue, the palette, Settings › Shortcuts
 * and the agent (`docs/adr/0008`).
 *
 * ## Twenty-one declared, fourteen nominated — a framework that does NOT fit
 *
 * UML 2.5.1 is the largest notation this library packs, and phase 1 already
 * declares twenty-one commands against a sub-menu of fourteen. So unlike C4 —
 * the framework that fits to the entry — the arbitration RUNS here:
 * `selectSeniorMenuCommands` triggers on `catalogue.length > SENIOR_MENU_CAP`,
 * twenty-one is over fourteen, and the row a user meets is thirteen ranked
 * buttons plus "More artefacts…".
 *
 * That makes the head of the NOMINATION list the cold start every new user
 * meets, which is the lesson BPMN learned in a live recette (#144) and the
 * reason the order below is authored rather than grouped by family. It reads:
 *
 *   1. the DIAGRAM first — the sheet has to exist before anything can be put on
 *      it, and a first-time user who reaches for a class before a diagram draws
 *      a class on the void;
 *   2. then the classifiers a class diagram is mostly made of (class,
 *      interface, enumeration), then the containers and annotations (package,
 *      note), then the two shapes a USE-CASE diagram is made of (actor, use
 *      case) and the subject frame drawn round them;
 *   3. then the five relationships an author reaches for first — association,
 *      generalization, dependency, and the two use-case ones;
 *   4. and everything past the fourteenth slot DECLINES the row rather than
 *      contesting it: the object (an instance diagram is a second reading of a
 *      class diagram, not the first thing anybody draws), the four remaining
 *      relationships, and the two exports.
 *
 * Fourteen nominations is `SENIOR_MENU_CAP` exactly, which is the curation
 * budget `registry.unit.spec.ts` enforces — the pack stays inside it without
 * the PO having to arbitrate an over-nomination.
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
    senior: true,
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
];

const toolboxCommands: CommandDescriptor[] = SPECS.map((spec, order) => ({
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
  order,
  scope: 'edgeless',
  // Keyless by intent, and at twenty-one commands there is no chord alphabet
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
    order: SPECS.length,
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
    order: SPECS.length + 1,
    scope: 'edgeless',
    defaultKeys: { mac: [], other: [] },
    availability: 'selection',
    run: exportUmlXmiFile,
    telemetry: { framework: 'uml', element: 'board:export-xmi' },
    when: std => umlDiagramsForExport(std).length > 0,
  },
];

export const umlCommands: CommandDescriptor[] = [
  ...toolboxCommands,
  ...exportCommands,
];

export const umlCommandIcons: Record<string, TemplateResult> = {
  ...UML_TOOLBOX_ICONS,
  'uml.export-plantuml': umlExportPlantumlIcon,
  'uml.export-xmi': umlExportXmiIcon,
};
