import { recordAction } from '@labre/affine-block-surface';
import { ViewExtensionManager } from '@labre/affine-ext-loader';
import { Container } from '@labre/global/di';
import {
  FRAMEWORK_IDS,
  type AnyCommandDescriptor,
  type CommandLegendEntry,
  type CommandOwner,
} from '@labre/std';
import {
  GfxControllerIdentifier,
  RoleVocabularyIdentifier,
  roleIsA,
  type RoleDefs,
} from '@labre/std/gfx';
import { describe, expect, test } from 'vitest';

import { getCommands } from '../../commands.js';
import { getInternalViewExtensions } from '../../extensions/view.js';

/**
 * GUARD — a framework's legend is a SUBSCRIPTION, and every artefact it draws
 * is in it.
 *
 * ## What it is for
 *
 * A legend used to be a second table, maintained by hand beside the commands.
 * Nothing connected the two, so a framework could gain an artefact and lose a
 * row without anyone noticing — and a row could keep naming a role that had
 * been renamed out of existence. Both directions are checked here.
 *
 * ## Why it runs the commands
 *
 * There is NO static field carrying the role: it is stamped inside `run`, by
 * the preset a creation command calls or by the options a tool command arms.
 * So the check RUNS each command against `recordAction`'s recording fake
 * (`@labre/affine-block-surface`) and reads back what it asked the surface for
 * — the props of every element it created, plus the options of any tool it
 * armed, which is where a typed connector's role lives since it creates
 * nothing at all.
 *
 * ## Why it cannot pass vacuously
 *
 * The control block at the bottom exercises the very same mechanism on
 * synthetic commands and asserts both halves: that a stamped role really is
 * found, and that an unsubscribed one really is reported. See `docs/adr/0026`.
 */

const commands = getCommands();

/**
 * Frameworks with no legend at all, permanently. Estuarine draws a landscape
 * whose regions are named ON the sheet: a key beside it would restate the
 * drawing (`docs/adr/0013`).
 */
const NO_LEGEND: Readonly<Record<string, string>> = {
  'cynefin-estuarine': 'docs/adr/0013 — the sheet names its own regions',
};

/**
 * Roles a command stamps that deliberately get NO row, with the reason.
 *
 * Short by design: a VARIANT needs no exemption (C4's `addMobile` stamps
 * `c4:container`, which `addContainer`'s row already covers), and neither does
 * a specialisation (EDGY's twenty-two verbs are covered by `edgy:relation`).
 * The board a legend is drawn ON is excluded by construction below, through
 * `telemetry.board`. What is left is the handful of roles that are not
 * artefacts at all.
 */
const EXEMPT_ROLES: Readonly<Record<string, string>> = {
  // The three lines of ONE C4 label, not three artefacts (`gfx/c4/src/roles.ts`).
  'c4:title': 'a third of a label',
  'c4:type-line': 'a third of a label',
  'c4:description': 'a third of a label',
  // The same shape in UML: a compartment of a classifier's own label, not a
  // thing on the sheet (`kind: 'text'`, `gfx/uml/src/roles.ts`). A "Name" row
  // would be the legend describing the legend's own medium.
  'uml:name': 'a tier of a label',
  'uml:attributes': 'a tier of a label',
  'uml:operations': 'a tier of a label',
  'uml:label': 'a tier of a label',
  'uml:lifeline-ident': 'a tier of a label',
  // The facets diagram is the frame the EDGY elements are drawn inside.
  'edgy:facets': 'a frame, like a board',
  // The square a pipeline's connectors land on — the body's own plumbing, and
  // the reason the body itself declares `connectable: false`.
  'wardley:handle': 'the pipeline’s connection point',
  // The name written BESIDE a Wardley artefact, grouped with it. A role so W3
  // can say where it must not land, not an artefact of its own.
  'wardley:label': 'the name beside an artefact',
};

const INVOCATION = {
  surface: 'senior-menu',
  source: 'toolbar:general',
} as const;

/** Every registered role vocabulary, merged — a role id is namespaced. */
function vocabulary(): RoleDefs {
  const manager = new ViewExtensionManager(getInternalViewExtensions({}));
  const container = new Container();
  manager.get('edgeless').forEach(extension => extension.setup(container));
  const merged: RoleDefs = {};
  for (const defs of container
    .provider()
    .getAll(RoleVocabularyIdentifier)
    .values()) {
    Object.assign(merged, defs as RoleDefs);
  }
  return merged;
}

const ROLES = vocabulary();

/**
 * The roles one command stamps — on the elements it creates AND on the tool it
 * arms.
 *
 * A command the recording fake cannot run (it asks for a service the fake
 * refuses) contributes nothing rather than failing the suite: the fake answers
 * what PLACEMENT actions touch, and a command outside that shape is not an
 * artefact command. The control case below proves the fake reaches enough of
 * them for the check to mean something.
 */
function rolesStampedBy(command: AnyCommandDescriptor): Set<string> {
  const stamped = new Set<string>();
  let recorded;
  try {
    recorded = recordAction(std => {
      // A template command is async and rejects on the fake's half-document;
      // swallowing it here keeps the rejection from escaping the run. What it
      // stamped BEFORE giving up is still recorded, which is all this reads.
      const running = command.run(std, INVOCATION) as void | Promise<void>;
      if (running instanceof Promise) running.catch(() => {});
    });
  } catch {
    return stamped;
  }
  for (const record of recorded.records) {
    const role = record['role'];
    if (typeof role === 'string') stamped.add(role);
  }
  const armed = recorded.armedToolOptions?.['role'];
  if (typeof armed === 'string') stamped.add(armed);
  return stamped;
}

function entriesOf(
  command: AnyCommandDescriptor
): readonly CommandLegendEntry[] {
  const { legend } = command;
  if (!legend) return [];
  return Array.isArray(legend) ? legend : [legend as CommandLegendEntry];
}

/**
 * A command that OWES a row: an artefact or a tool, and not the one that puts
 * the board itself down — a legend is drawn ON the board, and listing it would
 * be listing the paper.
 */
function owesARow(command: AnyCommandDescriptor): boolean {
  return (
    (command.kind === 'artefact' || command.kind === 'tool') &&
    command.telemetry?.board !== true
  );
}

const ownedBy = (owner: CommandOwner): AnyCommandDescriptor[] =>
  commands.filter(command => command.owner === owner);

function subjectsOf(owner: CommandOwner): AnyCommandDescriptor[] {
  return ownedBy(owner).filter(owesARow);
}

/** Every row the owner's commands subscribe. */
function rowsOf(owner: CommandOwner): CommandLegendEntry[] {
  return ownedBy(owner).flatMap(command => [...entriesOf(command)]);
}

/** A role is covered when a row names it, or a family it belongs to. */
function covers(entry: CommandLegendEntry, role: string): boolean {
  return entry.exact ? entry.role === role : roleIsA(role, entry.role, ROLES);
}

/**
 * The roles a SET of commands stamps that none of their rows covers and no
 * exemption names.
 *
 * Takes the commands rather than an owner so the control below can run the very
 * same check against synthetic ones — which is what makes it a control and not
 * a second implementation.
 */
function uncoveredRolesIn(owned: readonly AnyCommandDescriptor[]): string[] {
  const rows = owned.flatMap(command => [...entriesOf(command)]);
  const uncovered = new Set<string>();
  for (const command of owned.filter(owesARow)) {
    for (const role of rolesStampedBy(command)) {
      if (role in EXEMPT_ROLES) continue;
      if (rows.some(entry => covers(entry, role))) continue;
      uncovered.add(role);
    }
  }
  return [...uncovered].sort();
}

const uncoveredRolesOf = (owner: CommandOwner): string[] =>
  uncoveredRolesIn(ownedBy(owner));

const OWED = FRAMEWORK_IDS.filter(id => !(id in NO_LEGEND));

describe('every artefact a framework draws is in its legend', () => {
  test('a framework subscribes a row for every role it stamps', () => {
    const uncovered = Object.fromEntries(
      OWED.map(owner => [owner, uncoveredRolesOf(owner)]).filter(
        ([, roles]) => (roles as string[]).length > 0
      )
    );
    expect(uncovered, 'roles no legend row covers').toEqual({});
  });

  /**
   * The other direction, and the one that catches the real regression: a row
   * left naming a role after somebody renamed it.
   */
  test('no row names a role the vocabulary does not declare', () => {
    const orphans = FRAMEWORK_IDS.flatMap(owner =>
      rowsOf(owner)
        .map(entry => entry.role)
        .filter(role => !(role in ROLES))
    ).sort();
    expect(orphans, 'legend rows naming an unknown role').toEqual([]);
  });

  test('a swatch never declares the role of the artefact it pictures', () => {
    // Structurally impossible on the drawing side (the swatch helper strips
    // it), and pointless to write: this keeps a table from implying otherwise.
    for (const owner of FRAMEWORK_IDS) {
      for (const entry of rowsOf(owner)) {
        expect(
          entry.row.props ?? {},
          `${owner} ${entry.role}`
        ).not.toHaveProperty('role');
      }
    }
  });
});

/**
 * The CONTROL — without it the suite above is green because it checks nothing.
 *
 * It exercises the exact mechanism the real check runs on (`recordAction` plus
 * the armed tool's options) and asserts both halves: that roles are actually
 * found, and that an unsubscribed one is actually reported. So the day a
 * framework gains an artefact and no row, the check fails rather than passing
 * on an empty reading.
 *
 * It runs on SYNTHETIC commands rather than on a real framework. A control
 * pinned to a real one is a control with an expiry date: it has to be rewritten
 * the day its subject changes, and it was the frameworks themselves that the
 * migration was moving.
 */
describe('the coverage check is not vacuous', () => {
  const ROLE = 'control:artefact';
  const TOOL_ROLE = 'control:relation';

  /** A command in the shape the real ones have, and nothing more. */
  const command = (
    id: string,
    run: AnyCommandDescriptor['run'],
    legend?: CommandLegendEntry
  ): AnyCommandDescriptor => ({
    id,
    // Any real owner: nothing below reads it, because the check is handed the
    // list of commands rather than asked to filter the registry by owner.
    owner: 'core',
    kind: 'artefact',
    labelKey: `com.labre.commands.${id}`,
    surfaces: ['catalogue'],
    scope: 'edgeless',
    defaultKeys: { mac: [], other: [] },
    run,
    ...(legend ? { legend } : {}),
  });

  /** Draws one element carrying a role, the way every creation command does. */
  const draws = command('control.add', std => {
    std.get(GfxControllerIdentifier).surface!.addElement({
      type: 'shape',
      xywh: '[0,0,10,10]',
      role: ROLE,
    } as never);
  });

  /** Arms a typed connector and creates nothing at all, the way a tool does. */
  const armsTool = command('control.relationTool', std =>
    std
      .get(GfxControllerIdentifier)
      .tool.setTool('connector' as never, { role: TOOL_ROLE } as never)
  );

  test('the recording finds the role a command stamps on what it creates', () => {
    expect([...rolesStampedBy(draws)]).toEqual([ROLE]);
  });

  test('the ARMED tool’s role is found too, where nothing is created', () => {
    // A tool creates no element at all: without reading the tool options such a
    // command would look like it stamps nothing, and the check would wave
    // through a framework with no row for its relationships.
    expect([...rolesStampedBy(armsTool)]).toEqual([TOOL_ROLE]);
  });

  test('an unsubscribed role is reported, so a missing row really fails', () => {
    expect(uncoveredRolesIn([draws, armsTool])).toEqual([ROLE, TOOL_ROLE]);
  });

  test('…and a subscribed one is not, so the check can ever pass', () => {
    const subscribed = command('control.add', draws.run, {
      role: ROLE,
      row: { swatch: 'square', color: '#000000' },
    });
    expect(uncoveredRolesIn([subscribed])).toEqual([]);
  });

  test('the real registry is reachable by the recording at all', () => {
    // The synthetic halves above prove the MECHANISM; this proves the mechanism
    // meets the actual commands, so a registry that stopped being runnable
    // against the fake could not leave the suite silently green.
    const stamped = new Set(
      FRAMEWORK_IDS.flatMap(owner =>
        subjectsOf(owner).flatMap(cmd => [...rolesStampedBy(cmd)])
      )
    );
    expect(stamped.size).toBeGreaterThan(50);
  });

  test('every exemption names a role some command really stamps', () => {
    // A waiver for a role nobody stamps any more is a line to delete, not a
    // rule — and it would hide the next role that took the same name.
    const stamped = new Set(
      FRAMEWORK_IDS.flatMap(owner =>
        subjectsOf(owner).flatMap(cmd => [...rolesStampedBy(cmd)])
      )
    );
    expect(
      Object.keys(EXEMPT_ROLES)
        .filter(role => !stamped.has(role))
        .sort(),
      'exemptions no command stamps'
    ).toEqual([]);
  });
});
