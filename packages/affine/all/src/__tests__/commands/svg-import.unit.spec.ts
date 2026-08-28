import { describe, expect, test } from 'vitest';

import { getCommandManifest, getCommands } from '../../commands.js';

/**
 * The two SVG fallback imports, as DECLARATIONS (`docs/adr/0012`, P2).
 *
 * One command per framework and not one shared "import a picture", because the
 * ADR rejects inferring a framework from a `.svg`: the file says nothing about
 * which vocabulary it is a picture of, and only the person opening it knows.
 *
 * What is pinned here is what a surface RENDERS from — the tier in the words,
 * and the four surfaces including the one both of them decline. The parser
 * itself is pinned next door, in the surface package, with no DI in sight.
 */

const commands = getCommands();
const SVG_IMPORTS = ['bpmn.importSvg', 'wardley.importSvg'] as const;

const commandOf = (id: string) => {
  const found = commands.find(c => c.id === id);
  expect(found, `unknown command ${id}`).toBeTruthy();
  return found!;
};

describe('the SVG fallback import is declared by each framework that reads one', () => {
  test('both commands exist, one per framework', () => {
    expect(SVG_IMPORTS.map(id => commandOf(id).owner)).toEqual([
      'bpmn',
      'wardley',
    ]);
  });

  test('the label and the description name the tier BEFORE the file is read', () => {
    // P2's product obligation, and the sentence the ADR uses to justify it:
    // "a single 'Import…' entry that hides the difference would earn a support
    // ticket per user". The surface is the only place the difference can be
    // stated, because the report comes after the decision to open the file.
    for (const id of SVG_IMPORTS) {
      const command = commandOf(id);
      expect(command.labelFallback).toBe('Import SVG sketch');
      expect(command.descriptionFallback).toContain('Best effort');
      expect(command.descriptionFallback).toContain('no round-trip');
    }
  });

  test('they are catalogue, palette and agent — and NOT the senior sub-menu', () => {
    // The arbitration, pinned so that changing it is a decision rather than a
    // diff: the senior sub-menu carries a framework's NATIVE-format import
    // (`bpmn.importXml` today, `wardley.importOwm` when it lands), and the
    // fallback lives one click away in the artefact catalogue behind
    // "More artefacts…".
    for (const id of SVG_IMPORTS) {
      expect(commandOf(id).surfaces).toEqual(['catalogue', 'palette', 'agent']);
      expect(commandOf(id).surfaces).not.toContain('senior-menu');
    }
  });

  test('no owner spends a second over-nomination on one', () => {
    // The budget assertion in `registry.unit.spec.ts` allows exactly ONE
    // over-nomination per owner and BPMN has spent it on `bpmn.importXml`.
    // Stated here too, from the other end, because this is the file somebody
    // edits when they want the fallback in the row.
    const nominated = commands.filter(
      c => c.surfaces.includes('senior-menu') && c.id.endsWith('.importSvg')
    );
    expect(nominated).toEqual([]);
  });

  test('it writes, so it is `editable` and filed under interchange', () => {
    for (const id of SVG_IMPORTS) {
      const command = commandOf(id);
      // `'always'` would light the entry on a read-only document, do nothing
      // when clicked, and put the same untruth into the manifest a host reads.
      expect(command.availability).toBe('editable');
      // The same section BPMN files its two `.bpmn` directions under: a host
      // that translated the header once has translated it for both frameworks.
      expect(command.category).toBe('interchange');
      expect(command.kind).toBe('action');
      expect(command.scope).toBe('edgeless');
      // Keyless by intent, still bindable from Settings › Shortcuts.
      expect(command.defaultKeys).toEqual({ mac: [], other: [] });
    }
  });

  test('it emits a BOARD-level telemetry element, not an artefact', () => {
    // It is launched with nothing selected, and usually with nothing on the
    // canvas at all — `board:` is what the taxonomy calls that.
    expect(SVG_IMPORTS.map(id => commandOf(id).telemetry?.element)).toEqual([
      'board:import-svg',
      'board:import-svg',
    ]);
  });

  test('it crosses the manifest seam whole, with an icon key', () => {
    const manifest = getCommandManifest();
    for (const id of SVG_IMPORTS) {
      const entry = manifest.find(e => e.id === id);
      expect(entry, id).toBeTruthy();
      expect(entry!.iconKey, id).toBeTruthy();
      expect(entry).not.toHaveProperty('run');
    }
  });
});
