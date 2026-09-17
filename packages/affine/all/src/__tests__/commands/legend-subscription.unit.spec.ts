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
 * ## Why it is green today
 *
 * {@link PENDING_OWNERS} lists the frameworks whose rows still live in a
 * hand-written `legend.ts`. Each migration tranche removes its own entry and
 * the check starts biting for it; the last one removes the constant. The
 * control case at the bottom is what keeps the list honest in the meantime: it
 * proves the recording really finds roles and that removing an owner from the
 * list without subscribing its commands would FAIL, rather than pass vacuously.
 */

const commands = getCommands();

/**
 * Frameworks whose legend is still a table. Emptied one tranche at a time; the
 * constant itself goes with the last one.
 */
const PENDING_OWNERS: readonly CommandOwner[] = [
  'wardley',
  'edgy',
  'c4',
  'uml',
];

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
  // The facets diagram is the frame the EDGY elements are drawn inside.
  'edgy:facets': 'a frame, like a board',
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
 * The commands that OWE a row: an artefact or a tool, and not the one that puts
 * the board itself down — a legend is drawn ON the board, and listing it would
 * be listing the paper.
 */
function subjectsOf(owner: CommandOwner): AnyCommandDescriptor[] {
  return commands.filter(
    command =>
      command.owner === owner &&
      (command.kind === 'artefact' || command.kind === 'tool') &&
      command.telemetry?.board !== true
  );
}

/** Every row the owner's commands subscribe. */
function rowsOf(owner: CommandOwner): CommandLegendEntry[] {
  return commands
    .filter(command => command.owner === owner)
    .flatMap(command => [...entriesOf(command)]);
}

/** A role is covered when a row names it, or a family it belongs to. */
function covers(entry: CommandLegendEntry, role: string): boolean {
  return entry.exact ? entry.role === role : roleIsA(role, entry.role, ROLES);
}

/** The roles an owner stamps that no row covers and no exemption names. */
function uncoveredRolesOf(owner: CommandOwner): string[] {
  const rows = rowsOf(owner);
  const uncovered = new Set<string>();
  for (const command of subjectsOf(owner)) {
    for (const role of rolesStampedBy(command)) {
      if (role in EXEMPT_ROLES) continue;
      if (rows.some(entry => covers(entry, role))) continue;
      uncovered.add(role);
    }
  }
  return [...uncovered].sort();
}

const OWED = FRAMEWORK_IDS.filter(
  id => !(id in NO_LEGEND) && !PENDING_OWNERS.includes(id)
);

describe('every artefact a framework draws is in its legend', () => {
  test('a migrated framework subscribes a row for every role it stamps', () => {
    const uncovered = Object.fromEntries(
      OWED.map(owner => [owner, uncoveredRolesOf(owner)]).filter(
        ([, roles]) => (roles as string[]).length > 0
      )
    );
    expect(uncovered, 'roles no legend row covers').toEqual({});
  });

  /**
   * The other direction, and the one that catches the real regression: a row
   * left naming a role after somebody renamed it. Checked for EVERY framework,
   * pending or not — a table-driven legend declares no rows here, so this is
   * simply silent until a tranche lands, and bites from the first one on.
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
 * the armed tool's options) against a framework that is still pending, and
 * asserts both halves: that roles are actually found, and that they are
 * actually uncovered. So the day somebody deletes an owner from
 * {@link PENDING_OWNERS} without subscribing its commands, the check fails —
 * which is the only property that makes the list safe to keep.
 */
describe('the coverage check is not vacuous', () => {
  const owner: CommandOwner = 'c4';

  test('the recording finds the roles a framework stamps on what it creates', () => {
    const stamped = new Set(
      subjectsOf(owner).flatMap(command => [...rolesStampedBy(command)])
    );
    // The stencil's own nine node roles are among them; naming three is enough
    // to prove the recording ran the bodies rather than silently swallowing them.
    expect(stamped).toContain('c4:person');
    expect(stamped).toContain('c4:container');
    expect(stamped.size).toBeGreaterThan(5);
  });

  test('the ARMED tool’s role is found too, where nothing is created', () => {
    const tool = commands.find(c => c.id === 'c4.relationshipTool');
    expect(tool, 'c4.relationshipTool').toBeDefined();
    expect(tool!.kind).toBe('tool');
    // It creates no element at all: without reading the tool options this
    // command would look like it stamps nothing, and the check would wave
    // through a framework with no row for its relationships.
    expect([...rolesStampedBy(tool!)]).toEqual(['c4:relationship']);
  });

  test('a pending framework really is uncovered, so removing it would fail', () => {
    expect(PENDING_OWNERS).toContain(owner);
    expect(rowsOf(owner), 'c4 subscribes nothing yet').toEqual([]);
    expect(uncoveredRolesOf(owner).length).toBeGreaterThan(0);
  });

  test('every exemption names a role some command really stamps', () => {
    // A waiver for a role nobody stamps any more is a line to delete, not a
    // rule — and it would hide the next role that took the same name.
    const stamped = new Set(
      FRAMEWORK_IDS.flatMap(owner =>
        subjectsOf(owner).flatMap(command => [...rolesStampedBy(command)])
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
