import { RESERVED_EDGELESS_KEYS } from '@labre/affine-block-root';
import { wardleyCommands } from '@labre/affine-gfx-wardley';
import {
  canonicalCombo,
  FRAMEWORK_IDS,
  type CommandDescriptor,
  type FrameworkId,
} from '@labre/std';
import { describe, expect, test } from 'vitest';

import { getCommandManifest, getCommands } from '../../commands.js';
import { FRAMEWORK_DESCRIPTORS } from '../../frameworks.js';

/**
 * The invariants ADR 0008 asks to be enforced by unit tests rather than by
 * design review. Every one of them was tribal knowledge before.
 */
const commands = getCommands();
const byOwner = (owner: string) => commands.filter(c => c.owner === owner);
const chordsOf = (c: CommandDescriptor) => c.defaultKeys.other;

describe('command registry invariants', () => {
  /**
   * The converted inventory, spelled out so a framework silently losing (or
   * gaining) an artefact shows up in review rather than in production.
   */
  test('every framework contributes its whole toolbox', () => {
    const counts = Object.fromEntries(
      [...FRAMEWORK_IDS, 'core'].map(owner => [owner, byOwner(owner).length])
    );
    expect(counts).toEqual({
      wardley: 13,
      // 8 since the hand-drawn typed relation (`edgy.addRelation`) joined the
      // seven artefacts — the first EDGY entry that arms a tool.
      edgy: 8,
      'cynefin-estuarine': 3,
      // 23 since the descriptive-profile pack: 17 artefacts, 3 connecting-object
      // tools, the pool, and the two lane gestures (`bpmn.addLane`,
      // `bpmn.removeLane`) that act on a SELECTION rather than create something.
      // BPMN is the first shipped framework whose CATALOGUE outgrows the
      // fourteen senior slots — seven of the twenty-three decline `senior-menu`
      // on top of the two lane gestures, and past the cap
      // `selectSeniorMenuCommands` ranks the nominated fourteen ONLY: a
      // declined surface is a statement, not a default usage can out-vote (PO
      // ruling of 2026-08-28). The two tests at the bottom of this file are
      // what make that safe: everything is in the catalogue, and the menu is a
      // subset of it.
      // …and 24 since `bpmn.exportXml`, the first command in the library whose
      // subject is the whole BOARD rather than an element: it is reached from
      // the pool's "⋮" menu, and what it serializes is every BPMN artefact on
      // the surface.
      // 25 since `bpmn.importXml` — the other direction of the same format, and
      // the first framework command that needs NOTHING on the board: it is
      // `availability: 'always'`, declines the contextual toolbar (a selection
      // is exactly what an empty board has none of) and is reached from the
      // catalogue and the palette.
      bpmn: 25,
      // 14: the thirteen-entry toolbox (nine elements, two boundaries, the
      // board and the relationship tool) plus `c4.exportMermaid`, whose subject
      // is a SELECTED board and which declines the sub-menu. Fourteen against a
      // cap of fourteen — which `selectSeniorMenuCommands` measures on the
      // CATALOGUE — makes C4 the last framework that FITS, to the entry: the
      // sub-menu is its thirteen artefacts in author order, and the ranking
      // never runs. A fifteenth of anything tips it over.
      //
      // The board's automatic legend is NOT among them and is not a command at
      // all: the PO's arbitration of 27/08/2026 is that generating one belongs
      // to a board you have selected and to nothing else, so it is a button on
      // that board's contextual toolbar and is absent from the catalogue, the
      // palette and Settings › Shortcuts. It emits `FrameworkLegendCreated` by
      // hand, exactly as the Context Map's legend does
      // (`gfx/c4/src/toolbar/config.ts`).
      c4: 14,
      // 11 since WS5 added the board (`ddd-event-storming.addBoard`) and the
      // aggregate sticky (`ddd-event-storming.addAggregate`).
      'ddd-event-storming': 11,
      'ddd-core-domain': 10,
      // 12 since the PO's recette (27/08/2026) removed the palette's static
      // Legend entry — the board's contextual auto-legend is THE legend.
      'ddd-context-map': 12,
      // 5 root commands (undo, redo, redo-windows, duplicate, applyLastStyle)
      // + shape.cycleTextFit + pivot.bind + tag.set + validation.mapQuality
      // + map.audit + edge.invert-direction + element.read
      //
      // `map.audit` is counted here because `getCommands()` is called with no
      // flags and `ai-audit` defaults to enabled, like every switch. Its
      // absence under `{ 'ai-audit': false }` is asserted in
      // `audit-gating.unit.spec.ts`.
      //
      // These two numbers are where a merge goes wrong SILENTLY: every branch
      // that adds one core command writes the count it saw, so two of them
      // agree on a number that is short by one and git keeps it without a
      // conflict. They are the whole point of this test — the line that
      // notices a command appearing or vanishing — so re-derive them at every
      // merge instead of trusting the diff.
      core: 12,
    });
    expect(commands).toHaveLength(108);
  });

  /**
   * ADR 0008 puts emission in `runCommand` "and nowhere else". Three commands
   * are excepted — the two PROMOTION rungs and the direction inversion, whose
   * events depend on their params and on which elements actually changed,
   * neither of which the bottleneck receives (see the ADR's Resolved question
   * 5). They are enumerated here
   * rather than left as a comment in a function body, because the failure mode
   * they open is silent: a command that emits from its body AND declares
   * `telemetry` reports the same gesture twice, forever.
   */
  const SELF_EMITTING_COMMANDS = [
    'pivot.bind',
    'tag.set',
    // Same shape, same reason (`docs/adr/0010` M3): an inversion is neither a
    // creation nor a static `{ framework, element }` pair — its role and its
    // element count are facts of the invocation.
    'edge.invert-direction',
  ];

  test('a self-emitting command never also declares telemetry', () => {
    for (const id of SELF_EMITTING_COMMANDS) {
      const command = commands.find(c => c.id === id);
      expect(command, `unknown command ${id}`).toBeTruthy();
      expect(command!.telemetry, id).toBeUndefined();
    }
  });

  test('ids are unique', () => {
    const ids = commands.map(c => c.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  test('a framework id prefixes its commands; core is exempt', () => {
    for (const c of commands) {
      if (c.owner === 'core') continue;
      expect(FRAMEWORK_IDS).toContain(c.owner);
      expect(c.id.startsWith(`${c.owner}.`), c.id).toBe(true);
    }
  });

  /** The one numeric cap, and it is a UI one: 14 slots in the sub-menu. */
  test('no owner exceeds 14 senior-menu slots', () => {
    for (const id of FRAMEWORK_IDS) {
      const slots = byOwner(id).filter(c => c.surfaces.includes('senior-menu'));
      expect(slots.length, `${id} sub-menu`).toBeLessThanOrEqual(14);
    }
  });

  /**
   * PF10, and the same 14 as above rather than a second budget: a framework's
   * configurable shortcuts are the ones a senior slot can also reach, so the
   * chord pattern (framework prefix + artefact letter) stays sufficient. The
   * engine (`framework/std/src/extension/shortcut.ts`) enforces nothing here —
   * this is a curation convention, and a test is the only place it can live.
   * Beyond 14, a framework binds by host override, not by default.
   */
  test('no framework ships more than 14 default-bound shortcuts', () => {
    for (const id of FRAMEWORK_IDS) {
      const bound = byOwner(id).filter(
        c => c.defaultKeys.mac.length > 0 || c.defaultKeys.other.length > 0
      );
      expect(bound.length, `${id} default bindings`).toBeLessThanOrEqual(14);
    }
  });

  test('every chord uses its framework’s prefix, with unique second keys', () => {
    for (const descriptor of FRAMEWORK_DESCRIPTORS) {
      const chords = byOwner(descriptor.id)
        .map(chordsOf)
        .filter(keys => keys.length > 0);
      if (!chords.length) continue;
      expect(
        descriptor.chordPrefix,
        `${descriptor.id} has chords but no allocated prefix`
      ).toBeTruthy();
      expect(chords.every(keys => keys[0] === descriptor.chordPrefix)).toBe(
        true
      );
      const seconds = chords.map(keys => keys.slice(1).join(' '));
      expect(new Set(seconds).size).toBe(seconds.length);
    }
  });

  test('chord prefixes are unique and never shadow an imperative edgeless key', () => {
    const prefixes = FRAMEWORK_DESCRIPTORS.map(d => d.chordPrefix).filter(
      (p): p is string => !!p
    );
    expect(new Set(prefixes).size).toBe(prefixes.length);
    const reserved = new Set(
      RESERVED_EDGELESS_KEYS.map(k => canonicalCombo([k]))
    );
    for (const prefix of prefixes) {
      expect(reserved.has(canonicalCombo([prefix])), prefix).toBe(false);
    }
  });

  test('every framework has a descriptor and every descriptor a framework', () => {
    expect(FRAMEWORK_DESCRIPTORS.map(d => d.id).sort()).toEqual(
      [...FRAMEWORK_IDS].sort()
    );
  });

  test('the historical PostHog values are the ones declared', () => {
    // Renaming any of these silently breaks a live dashboard.
    const wire = Object.fromEntries(
      FRAMEWORK_DESCRIPTORS.map(d => [d.id, d.telemetryKey])
    );
    expect(wire).toEqual({
      wardley: 'wardley',
      edgy: 'edgy',
      'cynefin-estuarine': 'cynefin',
      bpmn: 'bpmn',
      c4: 'c4',
      'ddd-event-storming': 'event-storming',
      'ddd-core-domain': 'core-domain',
      'ddd-context-map': 'context-map',
    });
  });
});

describe('the serializable catalogue projection', () => {
  test('carries no function and no template across the seam', () => {
    for (const entry of getCommandManifest()) {
      for (const value of Object.values(entry)) {
        expect(typeof value).not.toBe('function');
      }
      expect(entry).not.toHaveProperty('run');
      expect(entry).not.toHaveProperty('when');
    }
  });

  test('availability is always one of the closed union’s members', () => {
    const allowed = ['always', 'selection', 'selection:framework', 'editable'];
    for (const entry of getCommandManifest()) {
      expect(allowed).toContain(entry.availability);
    }
  });

  test('every framework command declares an icon key', () => {
    for (const entry of getCommandManifest()) {
      if (entry.owner === 'core') continue;
      expect(entry.iconKey, entry.id).toBeTruthy();
    }
  });
});

/**
 * The drift this ADR exists to kill: Wardley's menu listed 13 artefacts and
 * its shortcut manifest 7, and nothing detected the six missing ones.
 */
describe('menu and manifest enumerate the same source', () => {
  test('the wardley sub-menu and the wardley manifest agree', () => {
    const menu = wardleyCommands
      .filter(c => c.surfaces.includes('senior-menu'))
      .map(c => c.id);
    const manifest = getCommandManifest()
      .filter(e => e.owner === 'wardley')
      .map(e => e.id);
    expect(menu).toEqual(manifest);
    expect(menu).toHaveLength(13);
  });

  /**
   * The catalogue is the TOTAL surface, and the sub-menu a selection out of it.
   * Since the eligibility ruling of 2026-08-28 that inclusion is what makes a
   * command reachable at all: `selectSeniorMenuCommands` ranks the NOMINATED
   * list, so a command its framework kept out of the fourteen lives in the
   * sidepanel and nowhere else — and one missing from the catalogue too is
   * unreachable the moment its framework overflows.
   */
  test('every framework command is in the catalogue, and the sub-menu is a subset', () => {
    for (const id of FRAMEWORK_IDS as readonly FrameworkId[]) {
      const owned = byOwner(id);
      expect(owned.length, `${id} declares no command`).toBeGreaterThan(0);
      expect(
        owned.every(c => c.surfaces.includes('catalogue')),
        `${id} keeps a command out of its catalogue`
      ).toBe(true);

      const catalogue = new Set(
        owned.filter(c => c.surfaces.includes('catalogue')).map(c => c.id)
      );
      const menu = owned
        .filter(c => c.surfaces.includes('senior-menu'))
        .map(c => c.id);
      expect(
        menu.filter(commandId => !catalogue.has(commandId)),
        `${id} sub-menu entries absent from its catalogue`
      ).toEqual([]);
    }
  });
});
