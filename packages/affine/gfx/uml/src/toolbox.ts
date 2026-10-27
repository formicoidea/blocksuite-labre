import type {
  FrameworkToolbox,
  SerializedElementProps,
  ToolboxItem,
  ToolboxLink,
  ToolboxPoint,
} from '@labre/affine-block-surface/interchange';
import type {
  UmlDiagramKind,
  UmlFragmentOperator,
  UmlNodeKind,
} from '@labre/affine-model';
import { Bound } from '@labre/global/gfx';

import { umlCommandsManifest } from './commands-manifest.js';
import { umlCompartmentBoxes } from './component.js';
import { UML_NODE_BOX } from './consts.js';
import { UML_EDGE_STYLE, type UmlEdgeRole } from './edge-styles.js';
import {
  UML_NAME_SEED,
  UML_OPERATIONS_SEED,
  UML_UNLABELLED_KINDS,
  umlBodySeed,
} from './keywords.js';
import {
  UML_FRAME_BOX,
  umlArtefactElements,
  umlConnectorProps,
  umlFrameProps,
  type UmlFrameType,
} from './presets.js';
import { umlDiagramRoleKey, umlRoleKey, umlSubjectRoleKey } from './roles.js';

/**
 * UML's toolbar as pure builders (`docs/adr/0045`): what `createUmlNode`,
 * `createUmlClassifier`, the five frame actions and the twenty edge tools
 * place, with no editor behind them. The actions call these, and the
 * importers write an artefact through the same assembly
 * (`umlArtefactElements`, `presets.ts`), so a class a host places, one drawn
 * from the toolbar and one read out of a `.puml` file are the same elements.
 *
 * ## Data, not sixty-four builders
 *
 * {@link UML_TOOLBOX} is walked off the tables that already exist: the
 * toolbar's own rows (`umlCommandsManifest`, in the toolbar's order), the
 * node kinds (`UML_NODE_BOX`), the edge styles (`UML_EDGE_STYLE`) and six
 * frame commands. A node command is `uml.add<Kind>` and an edge tool
 * `uml.<role>Tool`, so a kind or a relationship added to its table and to the
 * toolbar arrives here without a line changing; `toolbox.unit.spec.ts` says
 * which rows are left out — the five interchange commands (export PlantUML,
 * export XMI, import XMI, import PlantUML, import draw.io), which read or
 * write a file and place nothing a builder could.
 */

/** The text slots of an artefact. */
export interface UmlNodeTexts {
  /** The name, or a glyph's one word; the kind's English seed when absent. */
  name?: string;
  /**
   * A divided box's second compartment, one member per line (an object's
   * slots, a state's internal activities); the kind's seed when absent, and
   * empty when given empty.
   */
  attributes?: string;
  /** A class's, an interface's or an enumeration's operations, likewise. */
  operations?: string;
}

/**
 * A UML artefact at `at` (its top-left), at the size the toolbar draws it: the
 * shape, its tiers and the group LAST (`umlArtefactElements`), with ids
 * `<local>:shape`, `<local>:name`, `<local>:attributes`, `<local>:operations`
 * and `<local>:group`. A relationship attaches to `<local>:shape`. A mark the
 * notation draws no word on (an initial node, a fork…) is the shape alone.
 *
 * A port's, an interface mark's and a time event's word is written BESIDE
 * the glyph (`UML_BESIDE_LABEL_KINDS`): the group is wider than the shape's
 * box there, and only there.
 */
export function umlNodeElements(
  kind: UmlNodeKind,
  at: ToolboxPoint,
  texts: UmlNodeTexts = {},
  local: string = kind
): SerializedElementProps[] {
  const { w, h } = UML_NODE_BOX[kind];
  return umlArtefactElements(
    kind,
    { x: at.x, y: at.y, w, h },
    {
      name: texts.name?.trim() || UML_NAME_SEED[kind],
      // `??` and not `||`: an empty compartment is a statement (a class with
      // no operations yet), where an empty name never is.
      attributes: texts.attributes?.trimEnd() ?? umlBodySeed(kind)[1],
      operations: texts.operations?.trimEnd() ?? UML_OPERATIONS_SEED,
    },
    part => `${local}:${part}`
  );
}

/**
 * A frame's name as `[key, English]`: the key the toolbar resolves at
 * placement (`docs/adr/0023`), the English a host with no catalogue writes.
 * The key is the frame ROLE's: the two are the same noun, and a second key
 * would ask a host to word it twice. A combined fragment has none: its `name`
 * is a guard, and the notation draws a guard only where there is one.
 */
export const UML_FRAME_SEED = {
  umlDiagram: [umlDiagramRoleKey, 'Diagram'],
  umlSubject: [umlSubjectRoleKey, 'Subject'],
  umlPartition: [umlRoleKey('partition'), 'Partition'],
  umlRegion: [umlRoleKey('region'), 'Region'],
} as const satisfies Partial<
  Record<UmlFrameType, readonly [key: string, english: string]>
>;

/** What a frame is born as, beyond its name. */
export interface UmlFrameOptions {
  /** A diagram's kind, the word in its heading tag (Annex A); `class` when absent. */
  kind?: UmlDiagramKind;
  /** A fragment's interaction operator (§17.6.4); `alt` when absent. */
  operator?: UmlFragmentOperator;
}

/**
 * A frame at `at`, at the size the toolbar draws it, with id `local`.
 *
 * A diagram, a subject, a partition and a region take `name`, or their
 * English seed. A combined fragment is born unnamed, as the toolbar draws it:
 * its `name` is the guard of its first operand (`[x > 0]`), or under `ref` the
 * name of the interaction it refers to (§17.7.4), and is written only when
 * given. A partition is born vertical (the model's default, never restated)
 * and a fragment with one operand and no `operands` (the model's promise).
 */
export function umlFrameElement(
  type: UmlFrameType,
  at: ToolboxPoint,
  name?: string,
  local: string = type,
  options: UmlFrameOptions = {}
): SerializedElementProps {
  const { w, h } = UML_FRAME_BOX[type];
  const stated = name?.trim();
  const fields =
    type === 'umlFragment'
      ? {
          // The operator IS the fragment: written even at the model's default,
          // so the pentagon never depends on a default nobody can see.
          operator: options.operator ?? 'alt',
          ...(stated ? { name: stated } : {}),
        }
      : {
          name: stated || UML_FRAME_SEED[type][1],
          // Annex A's heading is `<kind> <name>`: a frame with no kind has
          // nothing to write in its tag.
          ...(type === 'umlDiagram' ? { kind: options.kind ?? 'class' } : {}),
        };
  return {
    ...umlFrameProps(
      type,
      { xywh: new Bound(at.x, at.y, w, h).serialize() },
      fields
    ),
    id: local,
  };
}

/** The connector an edge tool is armed with, between two ends. */
export function umlRelationElement(
  edge: UmlEdgeRole,
  from: string,
  to: string,
  label?: string
): SerializedElementProps {
  return {
    ...umlConnectorProps(edge),
    source: { id: from },
    target: { id: to },
    ...(label?.trim() ? { text: label.trim() } : {}),
  };
}

/* ── The list, walked off the tables ──────────────────────────────────── */

const camel = (kebab: string) =>
  kebab.replace(/-(\w)/g, (_, letter: string) => letter.toUpperCase());
const pascal = (kebab: string) => {
  const word = camel(kebab);
  return word.charAt(0).toUpperCase() + word.slice(1);
};

/** `uml.addUseCase` → `use-case`, for every kind the model draws. */
const NODE_OF_COMMAND = new Map(
  (Object.keys(UML_NODE_BOX) as UmlNodeKind[]).map(kind => [
    `uml.add${pascal(kind)}`,
    kind,
  ])
);

/** `uml.communicationPathTool` → `communication-path`, for every edge style. */
const EDGE_OF_COMMAND = new Map(
  (Object.keys(UML_EDGE_STYLE) as UmlEdgeRole[]).map(edge => [
    `uml.${camel(edge)}Tool`,
    edge,
  ])
);

/**
 * The six frame commands. The interaction use is a fragment under `ref`
 * (§17.7.4): the same element, a command of its own because pointing at
 * another diagram is a different modelling act from branching this one.
 */
const FRAME_OF_COMMAND: Readonly<
  Record<string, { id: string; type: UmlFrameType; options?: UmlFrameOptions }>
> = {
  'uml.addDiagram': { id: 'diagram', type: 'umlDiagram' },
  'uml.addSubject': { id: 'subject', type: 'umlSubject' },
  'uml.addPartition': { id: 'partition', type: 'umlPartition' },
  'uml.addRegion': { id: 'region', type: 'umlRegion' },
  'uml.addFragment': { id: 'fragment', type: 'umlFragment' },
  'uml.addInteractionUse': {
    id: 'interaction-use',
    type: 'umlFragment',
    options: { operator: 'ref' },
  },
};

/** The slots a kind's builder fills: the tiers its layout gives it. */
function slotsOf(kind: UmlNodeKind): string[] {
  if (UML_UNLABELLED_KINDS.has(kind)) return [];
  const { w, h } = UML_NODE_BOX[kind];
  const boxes = umlCompartmentBoxes(kind, 0, 0, w, h);
  return [
    'name',
    ...(boxes.attributes ? ['attributes'] : []),
    ...(boxes.operations ? ['operations'] : []),
  ];
}

function toolbox(): FrameworkToolbox {
  const items: ToolboxItem[] = [];
  const links: ToolboxLink[] = [];
  for (const row of umlCommandsManifest) {
    const label = {
      labelKey: row.labelKey,
      labelFallback: row.labelFallback ?? row.id,
    };
    const kind = NODE_OF_COMMAND.get(row.id);
    if (kind) {
      items.push({
        id: kind,
        ...label,
        texts: slotsOf(kind),
        size: UML_NODE_BOX[kind],
        build: (at, texts, local) => umlNodeElements(kind, at, texts, local),
      });
      continue;
    }
    const frame = FRAME_OF_COMMAND[row.id];
    if (frame) {
      items.push({
        id: frame.id,
        ...label,
        texts: ['name'],
        size: UML_FRAME_BOX[frame.type],
        build: (at, texts, local) => [
          umlFrameElement(
            frame.type,
            at,
            texts?.name,
            local ?? frame.id,
            frame.options
          ),
        ],
      });
      continue;
    }
    const edge = EDGE_OF_COMMAND.get(row.id);
    if (edge) {
      links.push({
        id: edge,
        ...label,
        build: (from, to, text) => umlRelationElement(edge, from, to, text),
      });
    }
  }
  return { framework: 'uml', items, links };
}

/** Every item of the UML toolbar that places elements, in the toolbar's order. */
export const UML_TOOLBOX: FrameworkToolbox = toolbox();
