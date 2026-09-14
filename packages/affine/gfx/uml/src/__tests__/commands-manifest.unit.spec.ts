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
  const nominated = umlCommands.filter(c => c.surfaces.includes('senior-menu'));
  const catalogue = umlCommands.filter(c => c.surfaces.includes('catalogue'));

  it('declares twenty-one commands, every one of them in the catalogue', () => {
    // Ten artefacts (the frame, six classifiers and containers, the actor, the
    // use case, the subject), nine relationship tools, and the two exports.
    expect(umlCommands).toHaveLength(21);
    expect(new Set(umlCommands.map(c => c.id)).size).toBe(21);
    expect(catalogue).toHaveLength(21);

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
    // `SENIOR_MENU_CAP` nominations against a catalogue of twenty-one: UML is
    // past the cap, so the arbitration RUNS and the head of this list is the
    // cold start a new user meets. The order is the one `commands.ts`
    // documents: the sheet, the classifiers, the containers, the use-case
    // shapes, the subject, then the five relationships reached for first.
    expect(nominated.map(c => c.id)).toEqual([
      'uml.addDiagram',
      'uml.addClass',
      'uml.addInterface',
      'uml.addEnumeration',
      'uml.addPackage',
      'uml.addNote',
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
    // Twenty-one over fourteen: unlike C4, this framework does not fit.
    expect(overflow, 'uml no longer overflows — re-read this test').toBe(true);
    // Thirteen arbitrated seats plus the permanent "More artefacts…" button.
    expect(commands.length + 1).toBe(SENIOR_MENU_CAP);
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
