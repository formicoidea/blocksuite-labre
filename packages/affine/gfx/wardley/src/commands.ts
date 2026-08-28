import type { CommandDescriptor } from '@labre/std';
import { type GfxController, GfxControllerIdentifier } from '@labre/std/gfx';
import type { TemplateResult } from 'lit';

import {
  activateWardleyConnector,
  createWardleyBackground,
  createWardleyInertia,
  createWardleyMarket,
  createWardleyNode,
  createWardleyPipeline,
  importWardleySvgFile,
} from './actions';
import { WARDLEY_ROLE, WARDLEY_ROLES, type WardleyRoleId } from './roles';
import {
  wardleyAnchorIcon,
  wardleyArrowIcon,
  wardleyBackgroundIcon,
  wardleyBenefitIcon,
  wardleyComponentIcon,
  wardleyEcosystemIcon,
  wardleyEvolutionGradientIcon,
  wardleyImportSvgIcon,
  wardleyInertiaIcon,
  wardleyLinkIcon,
  wardleyMarketIcon,
  wardleyMethodIcon,
  wardleyOpportunityIcon,
  wardleyPipelineIcon,
} from './toolbar/icons';

/**
 * The Wardley toolbox as {@link CommandDescriptor}s — the SINGLE declaration
 * the senior sub-menu, the keymap, Settings › Shortcuts, the catalogue and the
 * agent all read (`docs/adr/0008`). Before PF3 the same artefacts were spelled
 * twice: 13 hard-coded buttons in `toolbar/wardley-menu.ts` and 7 shortcut
 * descriptors in `shortcuts.ts`. The six that existed only in the menu were
 * invisible to Settings › Shortcuts, and nothing detected the omission.
 *
 * The seven ids that already shipped keep their id AND their `labelKey`
 * verbatim, so persisted host override tables and translation catalogues stay
 * valid. The six promoted ones ship keyless (`{ mac: [], other: [] }`) — still
 * registered, so a host override on their id actually binds.
 *
 * Declaration order IS the sub-menu order, kept identical to the pre-PF3
 * button row so the switchover is invisible on the canvas.
 */
interface Spec {
  /** Un-namespaced id; `wardley.` is prepended. */
  id: string;
  /** English default, verbatim from the button it replaces. */
  label: string;
  /**
   * The role this tool STAMPS on what it draws, when it draws a typed edge.
   *
   * Present only on the two connector tools, and it is what makes M1 of
   * `docs/adr/0010` free of duplicated prose: the sentence a user reads under
   * the button ("drag from the component that has the need to what it needs")
   * is the one the ROLE declares, so the tooltip, the hover reveal and the tool
   * hint can never disagree about which way a link is meant to be drawn.
   */
  edgeRole?: WardleyRoleId;
  /** Historical label key, for the seven commands that already shipped. */
  labelKey?: string;
  /** Second keystroke of the `w` chord; absent = keyless by intent. */
  key?: string;
  iconKey: string;
  category: 'backgrounds' | 'nodes' | 'connectors';
  kind: 'artefact' | 'tool';
  /** Historical `FrameworkElementEvent.element` value — do not rename. */
  element: string;
  run: (gfx: GfxController) => void;
}

const SPECS: Spec[] = [
  {
    id: 'addBackground',
    label: 'Wardley map background',
    labelKey: 'com.labre.keyboardShortcuts.wardley.addBackground',
    key: 'b',
    iconKey: 'wardley.background',
    category: 'backgrounds',
    kind: 'artefact',
    element: 'background:classic',
    run: gfx => createWardleyBackground(gfx, 'classic'),
  },
  {
    id: 'addOpportunityBackground',
    label: 'Opportunity background (gradient)',
    iconKey: 'wardley.background.opportunity',
    category: 'backgrounds',
    kind: 'artefact',
    element: 'background:opportunity',
    run: gfx => createWardleyBackground(gfx, 'opportunity'),
  },
  {
    id: 'addBenefitBackground',
    label: 'Benefit / Investment background (gradient)',
    iconKey: 'wardley.background.benefit',
    category: 'backgrounds',
    kind: 'artefact',
    element: 'background:benefit',
    run: gfx => createWardleyBackground(gfx, 'benefit'),
  },
  {
    id: 'addEvolutionBackground',
    label: 'Evolution background (Wardley presentation)',
    iconKey: 'wardley.background.evolution',
    category: 'backgrounds',
    kind: 'artefact',
    element: 'background:evolution-gradient',
    run: gfx => createWardleyBackground(gfx, 'evolution-gradient'),
  },
  {
    id: 'addComponent',
    label: 'Component',
    labelKey: 'com.labre.keyboardShortcuts.wardley.addComponent',
    key: 'c',
    iconKey: 'wardley.component',
    category: 'nodes',
    kind: 'artefact',
    element: 'node:component',
    run: gfx => createWardleyNode(gfx, 'component'),
  },
  {
    id: 'addMethod',
    label: 'Component + method',
    labelKey: 'com.labre.keyboardShortcuts.wardley.addMethod',
    key: 'm',
    iconKey: 'wardley.method',
    category: 'nodes',
    kind: 'artefact',
    element: 'node:method',
    run: gfx => createWardleyNode(gfx, 'method'),
  },
  {
    id: 'addMarket',
    label: 'Market',
    iconKey: 'wardley.market',
    category: 'nodes',
    kind: 'artefact',
    element: 'node:market',
    run: createWardleyMarket,
  },
  {
    id: 'addEcosystem',
    label: 'Ecosystem',
    iconKey: 'wardley.ecosystem',
    category: 'nodes',
    kind: 'artefact',
    element: 'node:ecosystem',
    run: gfx => createWardleyNode(gfx, 'ecosystem'),
  },
  {
    id: 'addAnchor',
    label: 'Anchor',
    iconKey: 'wardley.anchor',
    category: 'nodes',
    kind: 'artefact',
    element: 'node:anchor',
    run: gfx => createWardleyNode(gfx, 'anchor'),
  },
  {
    id: 'addPipeline',
    label: 'Pipeline',
    labelKey: 'com.labre.keyboardShortcuts.wardley.addPipeline',
    key: 'p',
    iconKey: 'wardley.pipeline',
    category: 'nodes',
    kind: 'artefact',
    element: 'node:pipeline',
    run: createWardleyPipeline,
  },
  {
    id: 'linkTool',
    label: 'Link',
    labelKey: 'com.labre.keyboardShortcuts.wardley.linkTool',
    key: 'l',
    iconKey: 'wardley.link',
    category: 'connectors',
    kind: 'tool',
    element: 'connector:link',
    edgeRole: WARDLEY_ROLE.dependency,
    run: gfx => activateWardleyConnector(gfx, 'link'),
  },
  {
    id: 'evolutionArrow',
    label: 'Arrow (evolution)',
    labelKey: 'com.labre.keyboardShortcuts.wardley.evolutionArrow',
    key: 'a',
    iconKey: 'wardley.arrow',
    category: 'connectors',
    kind: 'tool',
    element: 'connector:arrow',
    edgeRole: WARDLEY_ROLE.changeArrow,
    run: gfx => activateWardleyConnector(gfx, 'arrow'),
  },
  {
    id: 'addInertia',
    label: 'Inertia',
    labelKey: 'com.labre.keyboardShortcuts.wardley.addInertia',
    key: 'i',
    iconKey: 'wardley.inertia',
    category: 'nodes',
    kind: 'artefact',
    element: 'node:inertia',
    run: createWardleyInertia,
  },
];

/**
 * The sentence a tool shows under its label — the role's own gesture hint
 * (M1 of `docs/adr/0010`), or nothing at all for a tool that draws no typed
 * edge. Read off the vocabulary rather than written here twice.
 */
function gestureOf(spec: Spec) {
  const direction =
    spec.edgeRole === undefined
      ? undefined
      : WARDLEY_ROLES[spec.edgeRole]?.direction;
  if (!direction?.gestureHintKey) return {};
  return {
    descriptionKey: direction.gestureHintKey,
    descriptionFallback: direction.gestureHintFallback,
  };
}

/**
 * The SVG FALLBACK import — Wardley's first command whose subject is a FILE
 * rather than something you draw, and the first that is not in the sub-menu.
 *
 * ## Why the catalogue and not the senior row
 *
 * The thirteen entries above are the toolbox: every one of them draws
 * something, and the sub-menu is the row you open to draw. This opens a file
 * picker. It stays one click away — the catalogue sidepanel, reached from
 * "More artefacts…" — and it keeps `'palette'` and `'agent'` so it is still
 * findable by name and still invocable by an agent. Wardley's thirteen are
 * also, since the eligibility ruling of 2026-08-28, its whole nomination pool
 * against a row that seats fourteen; putting a board-level action into the
 * last free slot would spend it on the rarest thing anybody does to a map.
 *
 * When the OWM DSL import lands it is the framework's NATIVE format and the
 * reference Wardley route (ADR 0012's roadmap says so in as many words), and
 * the senior sub-menu is where that one belongs — beside "start from a
 * component" sits "start from a map somebody sent me". This is the fallback,
 * and a fallback that outranked the real thing would be the platform pointing
 * a user at the lossy door first.
 *
 * **Flagged for the PO** as a curation call rather than a technical one: it is
 * a one-line change either way.
 *
 * ## The label names the tier before the file is read (ADR 0012, P2)
 *
 * A map is coordinates, and this reader recovers none: it recognises circles
 * and words. Saying so in the description is not modesty, it is the contract —
 * "the import surface must name the tier before the file is read".
 */
const importSvgCommand: CommandDescriptor = {
  id: 'wardley.importSvg',
  owner: 'wardley',
  kind: 'action',
  labelKey: 'com.labre.commands.wardley.importSvg',
  labelFallback: 'Import SVG sketch',
  descriptionKey: 'com.labre.commands.wardley.importSvg.description',
  descriptionFallback:
    'Best effort: recognizes shapes and text, no round-trip. The axes and the evolution are not read — what arrives is a sketch you then promote.',
  // The same section id BPMN files its two `.bpmn` directions under, so a host
  // that translated the header once has translated it for every framework.
  category: 'interchange',
  iconKey: 'wardley.import-svg',
  surfaces: ['catalogue', 'palette', 'agent'],
  // After the thirteen toolbox entries, which are ordered 0…12: a category is
  // where a command is FILED and `order` only ranks it inside one.
  order: SPECS.length,
  scope: 'edgeless',
  defaultKeys: { mac: [], other: [] },
  // It WRITES, so a read-only document is one it cannot run on.
  availability: 'editable',
  run: importWardleySvgFile,
  // `board:` and not `node:`: it is launched with nothing selected, and often
  // with nothing on the canvas at all.
  telemetry: { framework: 'wardley', element: 'board:import-svg' },
};

const toolboxCommands: CommandDescriptor[] = SPECS.map((spec, order) => ({
  id: `wardley.${spec.id}`,
  owner: 'wardley',
  kind: spec.kind,
  labelKey: spec.labelKey ?? `com.labre.commands.wardley.${spec.id}`,
  labelFallback: spec.label,
  ...gestureOf(spec),
  category: spec.category,
  iconKey: spec.iconKey,
  surfaces: ['senior-menu', 'catalogue', 'palette', 'agent'],
  order,
  scope: 'edgeless',
  defaultKeys: spec.key
    ? { mac: ['w', spec.key], other: ['w', spec.key] }
    : { mac: [], other: [] },
  availability: 'always',
  run: std => spec.run(std.get(GfxControllerIdentifier)),
  telemetry: { framework: 'wardley', element: spec.element },
}));

export const wardleyCommands: CommandDescriptor[] = [
  ...toolboxCommands,
  importSvgCommand,
];

/** `iconKey` → template. Never travels through either manifest (ADR 0008). */
export const wardleyCommandIcons: Record<string, TemplateResult> = {
  'wardley.background': wardleyBackgroundIcon,
  'wardley.background.opportunity': wardleyOpportunityIcon,
  'wardley.background.benefit': wardleyBenefitIcon,
  'wardley.background.evolution': wardleyEvolutionGradientIcon,
  'wardley.component': wardleyComponentIcon,
  'wardley.method': wardleyMethodIcon,
  'wardley.market': wardleyMarketIcon,
  'wardley.ecosystem': wardleyEcosystemIcon,
  'wardley.anchor': wardleyAnchorIcon,
  'wardley.pipeline': wardleyPipelineIcon,
  'wardley.link': wardleyLinkIcon,
  'wardley.arrow': wardleyArrowIcon,
  'wardley.inertia': wardleyInertiaIcon,
  'wardley.import-svg': wardleyImportSvgIcon,
};
