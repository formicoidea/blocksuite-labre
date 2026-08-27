import { dddLegendIcon } from '@labre/affine-gfx-ddd-shared';
import type { BlockStdScope, CommandDescriptor } from '@labre/std';
import type { TemplateResult } from 'lit';

import {
  activateC4Relationship,
  c4BoardsSelected,
  createC4Board,
  createC4Boundary,
  createC4Legend,
  createC4Node,
} from './actions';
import { C4_TOOLBOX_ICONS } from './toolbar/icons';

/**
 * The C4 toolbox as commands — the single source every surface reads: the
 * senior sub-menu, the artefact catalogue, the palette, Settings › Shortcuts
 * and the agent (`docs/adr/0008`).
 *
 * ## Thirteen, against fourteen slots
 *
 * The pack draws nine elements, two boundaries, one board and one connecting
 * object: thirteen entries against a sub-menu that holds fourteen. C4 is
 * therefore the LAST framework that fits — nothing is arbitrated, nothing
 * overflows, and the sub-menu is exactly this list in exactly this order
 * (`selectSeniorMenuCommands` returns the menu untouched below the cap).
 *
 * That does not make the ORDER free, and it is why the declarations lead with
 * the canonical core rather than by family. The day a fourteenth artefact lands
 * — a deployment node, a code-level element — the catalogue outgrows the cap and
 * the first seven of this list become the COLD START every new user meets. BPMN
 * learned that the hard way in a live recette (#144): its declarations were
 * grouped by family, so the seven a first-time user met were six events and a
 * task, with nothing to connect them. The fix was the order, and the lesson is
 * cheaper to apply before the overflow than after it.
 *
 * The first seven here are the seven a C4 diagram cannot be drawn without: a
 * person, a system, a container, a component — the four levels — the
 * relationship that joins any two of them, the board they are drawn on, and the
 * database, which is the container flavour every real system has one of.
 */
interface Spec {
  id: string;
  label: string;
  iconKey: keyof typeof C4_TOOLBOX_ICONS;
  kind: 'artefact' | 'tool';
  /**
   * The catalogue section this entry is filed under. Kebab ids; the header
   * wording is the host's (`com.labre.catalogue.category.<id>`), with the
   * panel's own `humanizeCategory` as the fallback — so the framework names its
   * sections and invents no prose for them.
   *
   * `boundaries` is new to the library. The three existing ids C4 reuses
   * (`diagrams`, `elements`, `relations`) already mean what C4 means by them; a
   * boundary is neither an element of the model nor the sheet it is drawn on,
   * and filing it under either would put the lasso among the things it is drawn
   * round.
   */
  category: 'diagrams' | 'elements' | 'boundaries' | 'relations';
  /** Historical `FrameworkElementEvent.element` value — do not rename. */
  element: string;
  run: (std: BlockStdScope) => void;
}

const SPECS: Spec[] = [
  /* ── The core: a drawable diagram, from the first click ─────────────── */
  {
    id: 'addPerson',
    label: 'Person',
    iconKey: 'c4.person',
    kind: 'artefact',
    category: 'elements',
    element: 'node:person',
    run: std => createC4Node(std, 'person'),
  },
  {
    id: 'addSystem',
    label: 'Software system',
    iconKey: 'c4.system',
    kind: 'artefact',
    category: 'elements',
    element: 'node:system',
    run: std => createC4Node(std, 'system'),
  },
  {
    id: 'addContainer',
    label: 'Container',
    iconKey: 'c4.container',
    kind: 'artefact',
    category: 'elements',
    element: 'node:container',
    run: std => createC4Node(std, 'container'),
  },
  {
    id: 'addComponent',
    label: 'Component',
    iconKey: 'c4.component',
    kind: 'artefact',
    category: 'elements',
    element: 'node:component',
    run: std => createC4Node(std, 'component'),
  },
  {
    // Fifth, and the reason the four levels above are worth drawing: C4 asks
    // every relationship to be READ as a sentence, and the tool is where the
    // author says which way it runs.
    id: 'relationshipTool',
    label: 'Relationship',
    iconKey: 'c4.relationship',
    kind: 'tool',
    category: 'relations',
    element: 'connector:relationship',
    run: activateC4Relationship,
  },
  {
    id: 'addBoard',
    label: 'C4 board',
    iconKey: 'c4.board',
    kind: 'artefact',
    category: 'diagrams',
    element: 'board',
    run: createC4Board,
  },
  {
    // Seventh, and the last of the would-be cold start: the container flavour
    // every real system has one of, and the only one with a role of its own.
    id: 'addDatabase',
    label: 'Database',
    iconKey: 'c4.database',
    kind: 'artefact',
    category: 'elements',
    element: 'node:database',
    run: std => createC4Node(std, 'database'),
  },
  /* ── The frames drawn INSIDE a diagram ──────────────────────────────── */
  {
    id: 'addSystemBoundary',
    label: 'System boundary',
    iconKey: 'c4.boundary.system',
    kind: 'artefact',
    category: 'boundaries',
    element: 'boundary:system',
    run: std => createC4Boundary(std, 'system'),
  },
  {
    id: 'addContainerBoundary',
    label: 'Container boundary',
    iconKey: 'c4.boundary.container',
    kind: 'artefact',
    category: 'boundaries',
    element: 'boundary:container',
    run: std => createC4Boundary(std, 'container'),
  },
  /* ── The remaining container flavours ───────────────────────────────── */
  {
    id: 'addMobile',
    label: 'Mobile app',
    iconKey: 'c4.mobile',
    kind: 'artefact',
    category: 'elements',
    element: 'node:mobile',
    run: std => createC4Node(std, 'mobile'),
  },
  {
    id: 'addBrowser',
    label: 'Web browser',
    iconKey: 'c4.browser',
    kind: 'artefact',
    category: 'elements',
    element: 'node:browser',
    run: std => createC4Node(std, 'browser'),
  },
  /* ── The two "somebody else owns this" variants ─────────────────────── */
  {
    id: 'addPersonExt',
    label: 'Person (external)',
    iconKey: 'c4.person.external',
    kind: 'artefact',
    category: 'elements',
    element: 'node:person-ext',
    run: std => createC4Node(std, 'person-ext'),
  },
  {
    id: 'addSystemExt',
    label: 'Software system (external)',
    iconKey: 'c4.system.external',
    kind: 'artefact',
    category: 'elements',
    element: 'node:system-ext',
    run: std => createC4Node(std, 'system-ext'),
  },
];

const toolboxCommands: CommandDescriptor[] = SPECS.map((spec, order) => ({
  id: `c4.${spec.id}`,
  owner: 'c4',
  kind: spec.kind,
  labelKey: `com.labre.commands.c4.${spec.id}`,
  labelFallback: spec.label,
  category: spec.category,
  iconKey: spec.iconKey,
  // All thirteen, on every surface: the catalogue is the total surface and the
  // sub-menu holds fourteen, so nothing has to be left out of either.
  surfaces: ['senior-menu', 'catalogue', 'palette', 'agent'],
  order,
  scope: 'edgeless',
  // Keyless by intent — still bindable from Settings › Shortcuts, which is what
  // `toShortcutDescriptor` being total buys.
  defaultKeys: { mac: [], other: [] },
  availability: 'always',
  run: spec.run,
  telemetry: { framework: 'c4', element: spec.element },
}));

/**
 * The LEGEND — the one C4 command that is not a toolbox slot.
 *
 * It acts on a SELECTION (a board), so it declines `'senior-menu'` exactly as
 * BPMN's lane gestures do: a permanently greyed entry in the sub-menu of a
 * framework you have drawn nothing with yet is furniture, not an affordance. It
 * keeps `'catalogue'`, which is the registry's own invariant rather than a
 * category claim, and joins `'contextual-toolbar'`, whose entry is declared by
 * the board's `ToolbarModuleConfig` and INVOKES this — one behaviour, one
 * availability rule, one telemetry emission (`docs/adr/0008`, `docs/adr/0010`
 * M3).
 *
 * Declaring it as a command rather than as a toolbar-only action is what makes
 * its telemetry free and correct: `kind: 'legend'` is the one `CommandKind` the
 * central reporter maps to `FrameworkLegendCreated`, so the event is emitted by
 * `runCommand` with the historical wire values, and the button below is spared
 * a hand-written `track()` call — which is what Wardley and the Context Map
 * still carry, and the one place their legends can drift from everybody else's.
 */
const legendCommand: CommandDescriptor = {
  id: 'c4.legend',
  owner: 'c4',
  kind: 'legend',
  labelKey: 'com.labre.commands.c4.legend',
  labelFallback: 'Generate the legend',
  descriptionKey: 'com.labre.commands.c4.legend.description',
  descriptionFallback:
    'Draw a legend of the notation actually used on the selected board.',
  // Filed with the board, which is the selection that offers it.
  category: 'diagrams',
  iconKey: 'c4.legend',
  surfaces: ['catalogue', 'contextual-toolbar', 'palette', 'agent'],
  order: SPECS.length,
  scope: 'edgeless',
  defaultKeys: { mac: [], other: [] },
  availability: 'selection',
  run: createC4Legend,
  telemetry: { framework: 'c4', element: 'legend' },
  // Narrows `'selection'`, never contradicts it: a selection holding no board
  // has nothing to describe. The read-only test rides in `c4BoardsSelected` —
  // a legend is real elements, and drawing them is a write.
  when: std => c4BoardsSelected(std).length > 0,
};

export const c4Commands: CommandDescriptor[] = [
  ...toolboxCommands,
  legendCommand,
];

export const c4CommandIcons: Record<string, TemplateResult> = {
  ...C4_TOOLBOX_ICONS,
  // The gesture the three DDD boards already have, so it takes their glyph
  // rather than a lookalike: one icon for one gesture.
  'c4.legend': dddLegendIcon,
};
