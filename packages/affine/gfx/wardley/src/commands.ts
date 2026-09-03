import type { CommandDescriptor } from '@labre/std';
import { type GfxController, GfxControllerIdentifier } from '@labre/std/gfx';
import type { TemplateResult } from 'lit';

import {
  activateWardleyConnector,
  createWardleyAccelerator,
  createWardleyBackground,
  createWardleyInertia,
  createWardleyMarket,
  createWardleyNode,
  createWardleyPipeline,
  createWardleyPorter,
  exportOwmFile,
  importOwmFile,
  importWardleySvgFile,
  wardleyMapsOnBoard,
} from './actions';
import { WARDLEY_ROLE, WARDLEY_ROLES, type WardleyRoleId } from './roles';
import {
  wardleyAcceleratorIcon,
  wardleyAnchorIcon,
  wardleyArrowIcon,
  wardleyBackgroundIcon,
  wardleyDeceleratorIcon,
  wardleyBenefitIcon,
  wardleyComponentIcon,
  wardleyEcosystemIcon,
  wardleyEvolutionGradientIcon,
  wardleyExportOwmIcon,
  wardleyImportOwmIcon,
  wardleyImportSvgIcon,
  wardleyInertiaIcon,
  wardleyLinkIcon,
  wardleyMarketIcon,
  wardleyMethodIcon,
  wardleyOpportunityIcon,
  wardleyPipelineIcon,
  wardleyPorterIcon,
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
 * valid. The six promoted ones shipped keyless (`{ mac: [], other: [] }`) — still
 * registered, so a host override on their id actually binds.
 *
 * Amended 2026-09-02 (staging recette, retour n°12 — labre#538): `w a` is the
 * ANCHOR and the evolution arrow moved to `w e`. `a` reads as "anchor" to every
 * user who tried the chord, and `e` is "evolution". Ids and `labelKey`s are
 * untouched, so persisted override tables keep binding; only the two defaults
 * moved. `keymap-golden.ts` carries the same amendment.
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
    key: 'a',
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
    key: 'e',
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
  // Last of the nodes, and last of the row: a Porter's force is the only
  // artefact on this palette that is not part of the map — it is what presses
  // on it from outside — so it reads as an annotation you reach for once the
  // chain is drawn. Keyless: the `w` chord already seats eight artefacts, and
  // a framework binds past that by host override rather than by default.
  {
    id: 'addPorter',
    label: "Porter's forces",
    iconKey: 'wardley.porter',
    category: 'nodes',
    kind: 'artefact',
    element: 'node:porter',
    run: createWardleyPorter,
  },
  // The two climate annotations, after the force and for the same reason: they
  // are not links in the value chain either, and they are reached for once the
  // chain is drawn and the question becomes how fast it is moving. Keyless,
  // like the porter — the `w` chord seats eight artefacts and a framework binds
  // past that by host override.
  {
    id: 'addAccelerator',
    label: 'Accelerator',
    iconKey: 'wardley.accelerator',
    category: 'nodes',
    kind: 'artefact',
    element: 'node:accelerator',
    run: gfx => createWardleyAccelerator(gfx, 'accelerator'),
  },
  {
    id: 'addDecelerator',
    label: 'Decelerator',
    iconKey: 'wardley.decelerator',
    category: 'nodes',
    kind: 'artefact',
    element: 'node:decelerator',
    run: gfx => createWardleyAccelerator(gfx, 'decelerator'),
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

/**
 * The IMPORT — the first Wardley command whose subject is a whole map rather
 * than something you draw, and the first that needs nothing on the board.
 *
 * ## `'senior-menu'`, per the PO decision of 2026-08-28
 *
 * An interpreted import lives in its framework's sub-menu. On an empty canvas
 * the sub-menu is the first thing a user opens, and "start from the map
 * somebody sent me" belongs in that row beside "start from a component" —
 * asking them to find the catalogue sidepanel first is the friction the
 * decision names. It is the `+1` of ADR 0014's R4 — the single deliberate
 * over-nomination the PO signed off on, and the reason this framework's
 * nomination budget is `SENIOR_MENU_CAP + 1` rather than the cap itself.
 *
 * No `'contextual-toolbar'`: a contextual toolbar is a statement about a
 * SELECTION, and the moment this command is most wanted is on a board with
 * nothing on it at all.
 *
 * ## `'editable'`
 *
 * An import needs no selection, but it WRITES, so a read-only document is one
 * it cannot run on — and that is a precondition a catalogue has to be able to
 * show. `'always'` would light the entry on a read-only board, do nothing when
 * clicked, and put the same untruth into the manifest a host reads.
 */
const importCommand: CommandDescriptor = {
  id: 'wardley.importOwm',
  owner: 'wardley',
  kind: 'action',
  labelKey: 'com.labre.commands.wardley.importOwm',
  labelFallback: 'Import Wardley map (OWM)',
  descriptionKey: 'com.labre.commands.wardley.importOwm.description',
  descriptionFallback:
    'Open an OnlineWardleyMaps .owm file as a map. What Labre cannot draw is kept in the document, and the import says what it was.',
  category: 'interchange',
  iconKey: 'wardley.import-owm',
  surfaces: ['senior-menu', 'catalogue', 'palette', 'agent'],
  order: SPECS.length,
  scope: 'edgeless',
  // Keyless by intent. The `w` chord already seats seven artefacts, and a
  // framework binds past that by host override rather than by shipping a
  // default — still bindable from Settings › Shortcuts.
  defaultKeys: { mac: [], other: [] },
  availability: 'editable',
  run: std => void importOwmFile(std),
  // `board:` and not `node:` — this one is launched with no map anywhere.
  telemetry: { framework: 'wardley', element: 'board:import-owm' },
};

/**
 * The EXPORT — the other direction of the same format.
 *
 * It declines `'senior-menu'`, and the asymmetry with the import above is the
 * ruling BPMN already carries: the sub-menu is where a board COMES FROM, and an
 * export is what you do to a board you already have. It keeps `'catalogue'`,
 * which is the registry's own invariant rather than a category claim — a
 * command missing from the catalogue is unreachable the moment its framework
 * overflows the fourteen slots — plus the palette and the agent. No
 * `'contextual-toolbar'` either, and that is a declaration rather than an
 * oversight: a contextual-toolbar surface is rendered by an element's own
 * `ToolbarModuleConfig`, and declaring one nothing invokes would put an entry
 * in the manifest that no toolbar draws.
 *
 * `'always'` with a `when` on the BOARD, and the pair is deliberate. An export
 * READS: it needs no selection, and it is offered on a locked map and on a
 * read-only document — which is precisely the board somebody wants to take
 * away. What it DOES need is a plot to measure coordinates against, and that is
 * a fact about the surface rather than about the selection: a Wardley node has
 * no `visibility` prop, so its position on the plot IS its coordinate, and with
 * no map there is nothing to invert. `'selection'` would be BPMN's shape copied
 * for the look of it — that command's precondition genuinely is a selected
 * pool, and this one's is not.
 *
 * **v1 writes one map.** An OWM document is one map; a board holding several is
 * written against the first in document order and the export says so out loud
 * in its warnings.
 */
const exportCommand: CommandDescriptor = {
  id: 'wardley.exportOwm',
  owner: 'wardley',
  kind: 'action',
  labelKey: 'com.labre.commands.wardley.exportOwm',
  labelFallback: 'Export Wardley map (OWM)',
  descriptionKey: 'com.labre.commands.wardley.exportOwm.description',
  descriptionFallback:
    'Download the map as an OnlineWardleyMaps .owm file, ready to open in any Wardley mapping tool.',
  category: 'interchange',
  iconKey: 'wardley.export-owm',
  surfaces: ['catalogue', 'palette', 'agent'],
  order: SPECS.length + 1,
  scope: 'edgeless',
  defaultKeys: { mac: [], other: [] },
  availability: 'always',
  run: exportOwmFile,
  telemetry: { framework: 'wardley', element: 'board:export-owm' },
  when: std => wardleyMapsOnBoard(std).length > 0,
};

/**
 * The SVG FALLBACK import — the visual tier, named as such before the picker
 * opens (`docs/adr/0012`, P2).
 *
 * ## Why the catalogue and not the senior row
 *
 * Because {@link importCommand} is already there. The sub-menu carries the
 * framework's NATIVE format — the OWM DSL, which the ADR's roadmap calls the
 * reference Wardley import — and that is the route a user should be pointed at:
 * an `.owm` file carries `[visibility, evolution]` pairs, which ARE the map's
 * meaning, so it round-trips. This one reads a picture. A fallback that
 * outranked the real thing would be the platform offering the lossy door first,
 * and Wardley's fourteen nominations are already exactly the cap — a fifteenth
 * would push a button out of the row for the rarest thing anybody does to a map.
 *
 * So it lands one click away, in the artefact catalogue behind "More
 * artefacts…", and keeps `'palette'` and `'agent'` so it stays findable by name
 * and invocable by an agent.
 *
 * **Flagged for the PO** as a curation call rather than a technical one: it is
 * a one-line change either way.
 *
 * ## The label names the tier before the file is read
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
    'Best effort: recognises shapes and text, no round-trip. The axes and the evolution are not read — what arrives is a sketch you then promote.',
  // The same section the two OWM directions are filed under, and the same one
  // BPMN files its `.bpmn` pair under: a host that translated the header once
  // has translated it for every framework.
  category: 'interchange',
  iconKey: 'wardley.import-svg',
  surfaces: ['catalogue', 'palette', 'agent'],
  // Last of the three interchange entries, which is also how the section reads
  // for somebody scanning "what can I do with a file": the native format both
  // ways, then the best-effort reader.
  order: SPECS.length + 2,
  scope: 'edgeless',
  defaultKeys: { mac: [], other: [] },
  // It WRITES, so a read-only document is one it cannot run on.
  availability: 'editable',
  run: importWardleySvgFile,
  // `board:` and not `node:`: it is launched with nothing selected, and often
  // with nothing on the canvas at all.
  telemetry: { framework: 'wardley', element: 'board:import-svg' },
};

/**
 * The Wardley registry: the sixteen toolbox entries, then the two directions of
 * the OWM DSL and the SVG fallback (`docs/adr/0012`).
 *
 * ## Seventeen nominations, and the curation decision behind them
 *
 * `addPorter` spent the last seat of ADR 0014 R4's `SENIOR_MENU_CAP + 1`
 * budget, and `addAccelerator` / `addDecelerator` are the two past it. The PO
 * made the call on 2026-09-03 (Amendment 2026-09-03 under R4): **every Wardley
 * artefact nominates the row**. The row itself is unchanged — thirteen
 * arbitrated seats plus "More artefacts…", the cap of fourteen it has had since
 * the OWM pair tipped this framework over — so what the decision buys is that
 * a newly-drawn artefact is ELIGIBLE for a seat, and recency and frequency
 * decide who gets one. Nothing becomes unreachable: the catalogue lists
 * everything, which is the registry's own invariant.
 */
export const wardleyCommands: CommandDescriptor[] = [
  ...toolboxCommands,
  importCommand,
  exportCommand,
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
  'wardley.porter': wardleyPorterIcon,
  'wardley.accelerator': wardleyAcceleratorIcon,
  'wardley.decelerator': wardleyDeceleratorIcon,
  'wardley.import-owm': wardleyImportOwmIcon,
  'wardley.export-owm': wardleyExportOwmIcon,
  'wardley.import-svg': wardleyImportSvgIcon,
};
