import {
  commandCategoryTranslationEntries,
  SENIOR_MENU_CAP,
  selectSeniorMenuCommands,
  toShortcutManifestEntry,
} from '@labre/std';
import { describe, expect, it } from 'vitest';

import { umlCommands, umlCommandIcons } from '../commands.js';
import { umlCommandsManifest } from '../commands-manifest.js';
import { UML_DIAGRAM_KIND_MENU } from '../kinds.js';

/**
 * The UML toolbox as a whole, and its `./commands-manifest` projection.
 *
 * The cross-framework copy of the projection test lives in
 * `affine/all/src/__tests__/commands/commands-manifest.unit.spec.ts`, which
 * also asserts the data-only property of the module. This file is the one that
 * fails FIRST, in the package's own suite, and it carries the inventory
 * assertions the shared table has no room for.
 */
describe('the uml command inventory', () => {
  // Sorted by `order`, which is what every surface that renders these does —
  // and the only reading in which "authored order" means anything. Filtering
  // the declaration array alone would answer with the order the descriptors
  // happen to be WRITTEN in, which is not the order a user meets them in.
  const byOrder = (commands: typeof umlCommands) =>
    [...commands].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  const nominated = byOrder(
    umlCommands.filter(c => c.surfaces.includes('senior-menu'))
  );
  const catalogue = byOrder(
    umlCommands.filter(c => c.surfaces.includes('catalogue'))
  );

  it('declares sixty-nine commands, every one of them in the catalogue', () => {
    // Phase 1's twenty-one — ten artefacts (the frame, six classifiers and
    // containers, the actor, the use case, the subject), nine relationship tools
    // and the two exports — plus phase 2's structural eleven: four component
    // artefacts (the component, the port, the ball and the socket), four
    // deployment ones (the artifact and the three cubes) and three relationship
    // tools. …and its behavioural twenty-four: ten activity artefacts, nine
    // state-machine ones, the partition and region backgrounds, and the
    // control-flow, object-flow and transition tools. …and three IMPORTS since
    // tranche G (`docs/adr/0019`): PlantUML, XMI 2.5.1 and draw.io, three
    // formats and therefore three rows, because ADR 0012 declares interchange
    // per framework × format × direction and a picker behind one button would
    // hide the one thing that differs between them — the tier.
    //
    // …and phase 3's ten (§17): three artefacts on the sheet — the lifeline,
    // the execution bar and the destruction cross — two frames (the combined
    // fragment and the interaction use it is the `ref` spelling of), and five
    // message tools, which is the widest a single tranche has added. §17.4.4
    // gives a message five drawings and tells three of them apart BY the
    // drawing, which is why they are five rows and not one with an option.
    expect(umlCommands).toHaveLength(69);
    expect(new Set(umlCommands.map(c => c.id)).size).toBe(69);
    expect(catalogue).toHaveLength(69);

    for (const command of umlCommands) {
      expect(command.owner, command.id).toBe('uml');
      expect(command.scope, command.id).toBe('edgeless');
      expect(command.id.startsWith('uml.'), command.id).toBe(true);
      expect(command.surfaces, command.id).toContain('agent');
      expect(command.surfaces, command.id).toContain('palette');
      expect(command.iconKey, command.id).toBeTruthy();
      expect(command.telemetry?.framework, command.id).toBe('uml');
      // Keyless by intent — still bindable from Settings › Shortcuts.
      expect(command.defaultKeys.mac, command.id).toEqual([]);
      expect(command.defaultKeys.other, command.id).toEqual([]);
    }
  });

  it('gives every command glyph a home, and every glyph a command', () => {
    // A key a descriptor names and the icon record does not hold renders as
    // nothing; a glyph no descriptor names is a drawing nobody can reach.
    expect(Object.keys(umlCommandIcons).sort()).toEqual(
      umlCommands.map(c => c.iconKey!).sort()
    );
  });

  it('places exactly one board command, and names it `board`', () => {
    const boards = umlCommands.filter(c => c.telemetry?.board);
    expect(boards.map(c => c.id)).toEqual(['uml.addDiagram']);
    // The historical wire value every framework's board reports under — never
    // the element type, which is `umlDiagram`.
    expect(boards[0].telemetry?.element).toBe('board');
  });

  it('nominates exactly the fourteen of the senior row, in author order', () => {
    // `SENIOR_MENU_CAP` nominations against a catalogue of fifty-nine: UML is
    // past the cap, so the arbitration RUNS and the head of this list is the
    // cold start a new user meets. The order is the one `commands.ts`
    // documents: the sheet, the classifiers, the containers, the use-case
    // shapes, the subject, then the five relationships reached for first.
    //
    // …and, since tranche G, one IMPORT (R5, ADR 0019 §7): a board comes FROM a
    // file and the sub-menu is the first thing a user opens on an empty canvas.
    // `uml.addNote` is the entry that stood down for it — the trade is recorded
    // at its declaration as the PO curation point it is — so the pool is still
    // fourteen rather than a fifteenth nomination the budget has no room for.
    //
    // It is authored LAST, and that is the trade tranche J made: one `order`
    // serves the sub-menu and the catalogue alike, so the second seat it held
    // from tranche G also put it — and the four interchange commands beside it
    // — above every artefact in the catalogue, which is what the PO's recette
    // of 2026-09-14 rejected (O7). The catalogue wins, and the row follows ADR
    // 0014 § R3: "the cold-start row favours drawing tools; import buttons
    // surface through use".
    expect(nominated.map(c => c.id)).toEqual([
      'uml.addDiagram',
      'uml.addClass',
      'uml.addInterface',
      'uml.addEnumeration',
      'uml.addPackage',
      'uml.addActor',
      'uml.addUseCase',
      'uml.addSubject',
      'uml.associationTool',
      'uml.generalizationTool',
      'uml.dependencyTool',
      'uml.includeTool',
      'uml.extendTool',
      'uml.importXmi',
    ]);
    // The curation budget `registry.unit.spec.ts` enforces across the library,
    // asserted here too because this is the file somebody adding a command
    // reads: a fifteenth nomination is a PO decision, not a merge.
    expect(nominated).toHaveLength(SENIOR_MENU_CAP);
  });

  /**
   * O7 of the PO's recette of 2026-09-14, verbatim: « Les imports et exports
   * devraient être à la fin du catalogue. »
   *
   * The catalogue sidepanel does NOT lay its entries out in authored order: it
   * groups them by `category` and shows the groups in the order each category
   * is first MET along the order-sorted list (`groupCommandsByCategory`). So an
   * interchange command filed under `diagrams` — the section the FRAME is filed
   * under, which is met at order 0 — lands in the first section of the panel
   * whatever its own order is, which is what the PO saw: five of the six rows
   * of "Diagrams" were an import or an export, above every artefact UML draws.
   *
   * The grouping is re-derived here rather than imported, because the widget
   * that owns it sits above this package; it is three lines and it is the
   * behaviour this test is about.
   */
  it('files the catalogue by diagram kind, interchange last', () => {
    const sections: string[] = [];
    const rows = new Map<string, string[]>();
    for (const command of catalogue) {
      const category = command.category ?? '(none)';
      if (!rows.has(category)) {
        rows.set(category, []);
        sections.push(category);
      }
      rows.get(category)!.push(command.id);
    }

    // The eight artefact sections, then the ninth — the one BPMN and Wardley
    // already file their own imports and exports under, so a host that
    // translated the header once has translated it for every framework.
    //
    // The eight are the PO's ruling of 2026-09-16: the catalogue is filed by
    // DIAGRAM KIND, in the order of the frame's own kind picker
    // (`UML_DIAGRAM_KIND_MENU`), with the artefacts several kinds share under
    // "General" first. It replaces the four library sections UML used to
    // borrow — `elements` over fifty rows, from a lifeline to a deep history,
    // sorted nothing at this size.
    expect(sections).toEqual([
      'general',
      'class-diagram',
      'use-case-diagram',
      'component-diagram',
      'deployment-diagram',
      'activity-diagram',
      'state-machine-diagram',
      'sequence-diagram',
      'interchange',
    ]);
    // …and each section's own rows: elements, then boundaries, then relations,
    // which is how the ruling orders a section internally. The order is NOT
    // this array's — the panel gathers a category wherever its rows sit along
    // the order-sorted list — so a section reading correctly here is a claim
    // about the interleave at the head of `commands.ts`, not about its layout.
    expect(rows.get('general')).toEqual([
      'uml.addDiagram',
      'uml.addPackage',
      'uml.addNote',
      // Generalization before dependency because the senior ROW is authored
      // that way and one `order` serves both surfaces. The ruling orders a
      // section by type, not the relations inside it, so this costs nothing.
      'uml.generalizationTool',
      'uml.dependencyTool',
      'uml.realizationTool',
      'uml.anchorTool',
    ]);
    expect(rows.get('class-diagram')).toEqual([
      'uml.addClass',
      'uml.addInterface',
      'uml.addEnumeration',
      'uml.addObject',
      'uml.associationTool',
      'uml.aggregationTool',
      'uml.compositionTool',
    ]);
    expect(rows.get('use-case-diagram')).toEqual([
      'uml.addActor',
      'uml.addUseCase',
      'uml.addSubject',
      'uml.includeTool',
      'uml.extendTool',
    ]);
    expect(rows.get('component-diagram')).toEqual([
      'uml.addComponent',
      'uml.addPort',
      'uml.addProvidedInterface',
      'uml.addRequiredInterface',
    ]);
    expect(rows.get('deployment-diagram')).toEqual([
      'uml.addArtifact',
      'uml.addNode',
      'uml.addDevice',
      'uml.addExecutionEnvironment',
      'uml.deployTool',
      'uml.manifestTool',
      'uml.communicationPathTool',
    ]);
    expect(rows.get('activity-diagram')).toEqual([
      'uml.addAction',
      'uml.addInitial',
      'uml.addActivityFinal',
      'uml.addFlowFinal',
      'uml.addDecision',
      'uml.addFork',
      'uml.addObjectNode',
      'uml.addSendSignal',
      'uml.addAcceptEvent',
      'uml.addTimeEvent',
      'uml.addPartition',
      'uml.controlFlowTool',
      'uml.objectFlowTool',
    ]);
    expect(rows.get('state-machine-diagram')).toEqual([
      'uml.addState',
      'uml.addFinalState',
      'uml.addChoice',
      'uml.addJunction',
      'uml.addShallowHistory',
      'uml.addDeepHistory',
      'uml.addEntryPoint',
      'uml.addExitPoint',
      'uml.addTerminate',
      'uml.addRegion',
      'uml.transitionTool',
    ]);
    expect(rows.get('sequence-diagram')).toEqual([
      'uml.addLifeline',
      'uml.addExecution',
      'uml.addDestruction',
      'uml.addFragment',
      'uml.addInteractionUse',
      'uml.messageSyncTool',
      'uml.messageAsyncTool',
      'uml.messageReplyTool',
      'uml.messageCreateTool',
      'uml.messageDeleteTool',
    ]);
    // Exports first, then imports: what leaves a board you have, before what
    // arrives on one you do not.
    expect(rows.get('interchange')).toEqual([
      'uml.exportPlantuml',
      'uml.exportXmi',
      'uml.importXmi',
      'uml.importPlantuml',
      'uml.importDrawio',
    ]);
  });

  /**
   * Every section header a host is asked to translate, and the English it gets
   * for free — derived from the category id by `humanizeCategory`, never minted
   * beside it, which is what lets a kind's header read the same words the
   * frame's own picker offers (`kinds.ts`).
   */
  it('derives a header key and its English from every category', () => {
    expect(
      commandCategoryTranslationEntries(umlCommands).map(entry => [
        entry.key,
        entry.fallback,
      ])
    ).toEqual([
      ['com.labre.catalogue.category.general', 'General'],
      ['com.labre.catalogue.category.class-diagram', 'Class diagram'],
      ['com.labre.catalogue.category.use-case-diagram', 'Use case diagram'],
      ['com.labre.catalogue.category.component-diagram', 'Component diagram'],
      ['com.labre.catalogue.category.deployment-diagram', 'Deployment diagram'],
      ['com.labre.catalogue.category.activity-diagram', 'Activity diagram'],
      [
        'com.labre.catalogue.category.state-machine-diagram',
        'State machine diagram',
      ],
      ['com.labre.catalogue.category.sequence-diagram', 'Sequence diagram'],
      ['com.labre.catalogue.category.interchange', 'Interchange'],
    ]);
    // …and the seven kind headers are the picker's own wordings, letter for
    // letter: a reader who filed a frame under "Sequence diagram" finds its
    // shapes under "Sequence diagram".
    const pickerWordings = new Set(
      UML_DIAGRAM_KIND_MENU.options.map(option => option.labelFallback)
    );
    for (const header of [
      'Class diagram',
      'Use case diagram',
      'Component diagram',
      'Deployment diagram',
      'Activity diagram',
      'State machine diagram',
      'Sequence diagram',
    ]) {
      expect(pickerWordings.has(header), header).toBe(true);
    }
  });

  it('overflows, and renders a capped row with the way to the rest', () => {
    const ordered = [...catalogue].sort(
      (a, b) => (a.order ?? 0) - (b.order ?? 0)
    );
    const { commands, overflow } = selectSeniorMenuCommands(
      nominated,
      ordered,
      () => undefined
    );
    // Fifty-nine over fourteen: unlike C4, this framework does not fit — and
    // both halves of phase 2 declined the row whole rather than re-arguing the
    // fourteen from inside their own tranche (`commands.ts`).
    expect(overflow, 'uml no longer overflows — re-read this test').toBe(true);
    // Thirteen arbitrated seats plus the permanent "More artefacts…" button.
    expect(commands.length + 1).toBe(SENIOR_MENU_CAP);

    // THE COLD START, which is the row every new user meets: no usage recorded,
    // both ranking axes collapse to authored order, thirteen survive out of
    // fourteen nominated. Thirteen DRAWING tools, which is what ADR 0014 § R3
    // says a cold row is for.
    const ids = commands.map(c => c.id);
    expect(ids).toEqual([
      'uml.addDiagram',
      'uml.addClass',
      'uml.addInterface',
      'uml.addEnumeration',
      'uml.addPackage',
      'uml.addActor',
      'uml.addUseCase',
      'uml.addSubject',
      'uml.associationTool',
      'uml.generalizationTool',
      'uml.dependencyTool',
      'uml.includeTool',
      'uml.extendTool',
    ]);
    // …and the one that falls off is the LAST authored nomination, named here
    // so the trade is visible rather than discovered: the XMI import, which
    // keeps its seat and takes it the first time anybody opens a file. See the
    // nomination test above for why the catalogue won this arbitration.
    expect(ids).not.toContain('uml.importXmi');
    expect(nominated.at(-1)!.id).toBe('uml.importXmi');

    // …and nothing is unreachable, which is what the catalogue is for.
    expect(ordered).toHaveLength(umlCommands.length);
  });

  it('reaches the frame’s row with the two exports and nothing else', () => {
    expect(
      umlCommands
        .filter(c => c.surfaces.includes('contextual-toolbar'))
        .map(c => c.id)
    ).toEqual(['uml.exportPlantuml', 'uml.exportXmi']);
    // An export READS, so it is offered on a selection rather than always —
    // and on a read-only document, which is precisely the diagram somebody
    // wants to take away.
    for (const id of ['uml.exportPlantuml', 'uml.exportXmi']) {
      const command = umlCommands.find(c => c.id === id)!;
      expect(command.availability, id).toBe('selection');
      expect(typeof command.when, id).toBe('function');
    }
  });
});

describe('the ./commands-manifest projection', () => {
  it('is the projection of the real commands, row for row', () => {
    expect(umlCommandsManifest).toEqual(
      umlCommands.map(toShortcutManifestEntry)
    );
  });

  it('carries no `run`, no `when`, no icon', () => {
    for (const entry of umlCommandsManifest) {
      expect(entry).not.toHaveProperty('run');
      expect(entry).not.toHaveProperty('when');
      expect(entry).not.toHaveProperty('iconKey');
      for (const value of Object.values(entry)) {
        expect(typeof value).not.toBe('function');
      }
    }
  });
});
