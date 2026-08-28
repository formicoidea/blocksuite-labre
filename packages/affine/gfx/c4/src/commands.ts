import type { BlockStdScope, CommandDescriptor } from '@labre/std';
import type { TemplateResult } from 'lit';

import {
  activateC4Relationship,
  c4BoardsForExport,
  createC4Board,
  createC4Boundary,
  createC4Node,
  exportC4MermaidFile,
} from './actions';
import { c4ExportMermaidIcon, C4_TOOLBOX_ICONS } from './toolbar/icons';

/**
 * The C4 toolbox as commands — the single source every surface reads: the
 * senior sub-menu, the artefact catalogue, the palette, Settings › Shortcuts
 * and the agent (`docs/adr/0008`).
 *
 * ## Thirteen drawn, fourteen declared — exactly the cap
 *
 * The pack draws nine elements, two boundaries, one board and one connecting
 * object: thirteen entries, all thirteen on a sub-menu that holds fourteen. The
 * mermaid EXPORT is the fourteenth catalogue entry and declines the sub-menu, so
 * the catalogue lands on fourteen against a cap of fourteen — which
 * `selectSeniorMenuCommands` measures on the CATALOGUE, not on the menu. C4 is
 * therefore still the framework that FITS, to the entry: nothing is arbitrated,
 * the ranking never runs, and the sub-menu is exactly this list in exactly this
 * order.
 *
 * The board's automatic LEGEND is deliberately not among them, and is not a
 * command at all: it is reached from the selected board's contextual toolbar and
 * from nowhere else (PO arbitration, 27/08/2026 — the same call the Context Map
 * board makes). See `toolbar/config.ts` for what that costs and why it is the
 * arbitrated exception to the command bottleneck.
 *
 * That does not make the ORDER free — it makes it a fifteenth entry away from
 * mattering. Add one more of anything, an artefact or a second export, and the
 * catalogue outgrows the cap, the ranking kicks in, and the first seven of this
 * list become the COLD START every new user meets. BPMN learned that the hard
 * way in a live recette (#144): its declarations were grouped by family, so the
 * seven a first-time user met were six events and a task, with nothing to
 * connect them. The fix was the order, and the lesson is cheaper to apply before
 * the overflow than after it.
 *
 * ## The house order for a framework that FITS (PO, 28/08/2026)
 *
 * A general convention, decided on this pack and applying to every framework of
 * fourteen commands or fewer — i.e. every one whose sub-menu is never
 * arbitrated, so the author's order is the only order anybody ever sees:
 *
 *   1. the BOARDS first — the sheet has to exist before anything can be put on
 *      it, and a first-time user who reaches for a person before a board draws
 *      a person on the void;
 *   2. then the BASE components, the ones a diagram of this kind is mostly made
 *      of;
 *   3. then the NICHE ones last;
 *   4. and components of the SAME TYPE stay adjacent — the external variant sits
 *      against the plain one it varies, not in a ghetto of externals at the end.
 *
 * This SUPERSEDES the previous C4 order, which led with the four levels and put
 * the board sixth: it was built to make the would-be cold start drawable, and
 * the PO's answer is that a cold start which opens with the sheet is drawable
 * sooner. Applied here, it reads: the board, then person / person-ext, system /
 * system-ext (each variant next to its plain form), container, component,
 * database, then the two container flavours that are a container with a picture,
 * then the relationship, then the two boundaries, then the export.
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
  /* ── Boards first: the sheet everything else is drawn on ────────────── */
  {
    id: 'addBoard',
    label: 'C4 board',
    iconKey: 'c4.board',
    kind: 'artefact',
    category: 'diagrams',
    element: 'board',
    run: createC4Board,
  },
  /* ── The base components: the four levels, each plain form immediately
       followed by its external variant ─────────────────────────────────── */
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
    id: 'addPersonExt',
    label: 'Person (external)',
    iconKey: 'c4.person.external',
    kind: 'artefact',
    category: 'elements',
    element: 'node:person-ext',
    run: std => createC4Node(std, 'person-ext'),
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
    id: 'addSystemExt',
    label: 'Software system (external)',
    iconKey: 'c4.system.external',
    kind: 'artefact',
    category: 'elements',
    element: 'node:system-ext',
    run: std => createC4Node(std, 'system-ext'),
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
  /* ── The niche components: a container with a picture on it ─────────── */
  {
    // The container flavour every real system has one of, and the only one with
    // a role of its own — so it leads the three.
    id: 'addDatabase',
    label: 'Database',
    iconKey: 'c4.database',
    kind: 'artefact',
    category: 'elements',
    element: 'node:database',
    run: std => createC4Node(std, 'database'),
  },
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
  /* ── What joins the components, then the frames drawn round them ────── */
  {
    // C4 asks every relationship to be READ as a sentence, and the tool is where
    // the author says which way it runs.
    id: 'relationshipTool',
    label: 'Relationship',
    iconKey: 'c4.relationship',
    kind: 'tool',
    category: 'relations',
    element: 'connector:relationship',
    run: activateC4Relationship,
  },
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
 * The EXPORT — the first C4 command whose subject is a whole BOARD.
 *
 * ## Why it hangs off the board's toolbar, and why the board is also the scope
 *
 * BPMN's export makes the opposite call and the difference is the notation's,
 * not a preference. A BPMN document is a process and half a process is not a
 * smaller process, so `bpmn.exportXml` serializes the whole surface and the
 * selected pool decides only the filename. A C4 board is one LEVEL of one model
 * — a context diagram, a container diagram, a component diagram — and the whole
 * point of drawing three of them side by side is that they are three separate
 * diagrams. Merging them would produce the picture C4 exists to stop people
 * drawing, and mermaid renders one diagram per document anyway. So the selection
 * is the scope: one board, one document; several boards, several documents in
 * one file.
 *
 * ## Surfaces
 *
 * It declines `'senior-menu'`: the sub-menu is what you reach for to DRAW
 * something, and this draws nothing — and C4 has exactly one senior slot left,
 * which an export would be a poor use of. It keeps `'catalogue'`, which is not a
 * category claim but the registry's own invariant: the catalogue is the TOTAL
 * surface, and a command missing from it is unreachable the moment its framework
 * overflows the fourteen slots (pinned by `registry.unit.spec.ts`). It is also
 * what makes the catalogue exactly fourteen — the cap, to the entry.
 *
 * On the row itself it sits in the "⋮" rather than as a button: it is the rarest
 * thing anybody does to a board, and the row already carries the resize toggle
 * and the legend.
 *
 * ## Where the "⋮" entry is registered
 *
 * In the ALWAYS-ON toolbar module (`c4BoardToolbarConfig`), not the flag-gated
 * one, which is where BPMN puts its own export entry: `bpmnPoolToolbarExtension`
 * carries `bpmn.exportXml` and is registered by `BpmnRenderViewExtension`. The
 * entry hides itself when the command is absent from the registry — the `when`
 * guard every `commandAction` carries — so with the C4 tooling flag off the row
 * is the resize toggle alone, and nothing on it can be clicked into a no-op.
 */
const exportCommand: CommandDescriptor = {
  id: 'c4.exportMermaid',
  owner: 'c4',
  kind: 'action',
  labelKey: 'com.labre.commands.c4.exportMermaid',
  labelFallback: 'Export as mermaid',
  descriptionKey: 'com.labre.commands.c4.exportMermaid.description',
  descriptionFallback:
    'Download the selected board as a mermaid C4 diagram, ready to paste into any mermaid renderer.',
  // Filed with the board, which is the selection that offers it.
  category: 'diagrams',
  iconKey: 'c4.export-mermaid',
  surfaces: ['catalogue', 'contextual-toolbar', 'palette', 'agent'],
  order: SPECS.length,
  scope: 'edgeless',
  defaultKeys: { mac: [], other: [] },
  availability: 'selection',
  run: exportC4MermaidFile,
  telemetry: { framework: 'c4', element: 'board:export-mermaid' },
  // A board in the selection, and no more than that: an export READS, so unlike
  // the legend button it is offered on a read-only document — which is precisely
  // the board somebody wants to take away. That is what `c4BoardsForExport` is,
  // and why it is not `c4BoardsSelected`.
  when: std => c4BoardsForExport(std).length > 0,
};

export const c4Commands: CommandDescriptor[] = [
  ...toolboxCommands,
  exportCommand,
];

export const c4CommandIcons: Record<string, TemplateResult> = {
  ...C4_TOOLBOX_ICONS,
  'c4.export-mermaid': c4ExportMermaidIcon,
};
