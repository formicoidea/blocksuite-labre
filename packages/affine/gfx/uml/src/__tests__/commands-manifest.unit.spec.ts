import {
  SENIOR_MENU_CAP,
  selectSeniorMenuCommands,
  toShortcutManifestEntry,
} from '@labre/std';
import { describe, expect, it } from 'vitest';

import { umlCommands, umlCommandIcons } from '../commands.js';
import { umlCommandsManifest } from '../commands-manifest.js';

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
    // …and, since tranche G, one IMPORT in the SECOND seat (R5, ADR 0019 §7):
    // a board comes FROM a file and the sub-menu is the first thing a user
    // opens on an empty canvas. `uml.addNote` is the entry that stood down for
    // it — the trade is recorded at its declaration as the PO curation point it
    // is — so the pool is still fourteen rather than a fifteenth nomination the
    // budget has no room for.
    //
    // Second and not fourteenth, and the position is the whole of whether the
    // nomination does anything: an overflowed row renders THIRTEEN
    // (`SENIOR_MENU_RANKED_SLOTS`) and the cold start is the first thirteen of
    // this list, so a fourteenth nomination is one no new user can see.
    expect(nominated.map(c => c.id)).toEqual([
      'uml.addDiagram',
      'uml.importXmi',
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
    // The curation budget `registry.unit.spec.ts` enforces across the library,
    // asserted here too because this is the file somebody adding a command
    // reads: a fifteenth nomination is a PO decision, not a merge.
    expect(nominated).toHaveLength(SENIOR_MENU_CAP);
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
    // fourteen nominated. The import has to be among them or nominating it did
    // nothing at all — this is the recette blocker that moved it to the second
    // seat, and the assertion that keeps it there.
    const ids = commands.map(c => c.id);
    expect(ids).toHaveLength(13);
    expect(ids).toContain('uml.importXmi');
    expect(ids[1]).toBe('uml.importXmi');
    // …and the one that falls off is the LAST authored nomination, named here
    // so the trade is visible rather than discovered: the rarer of the two
    // use-case relationships, one click away in the catalogue.
    expect(ids).not.toContain('uml.extendTool');
    expect(nominated.at(-1)!.id).toBe('uml.extendTool');

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
