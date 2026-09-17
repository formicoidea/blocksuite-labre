import { legendFromCommands } from '@labre/affine-block-surface';
import {
  CLOUD,
  CM_BUBBLE,
  CM_RELATIONSHIPS,
} from '@labre/affine-gfx-ddd-shared';
import {
  CommandDescriptorIdentifier,
  type AnyCommandDescriptor,
  type BlockStdScope,
  type CommandLegendEntry,
} from '@labre/std';
import { describe, expect, it } from 'vitest';

import { contextMapCommands } from '../commands';
import { CM_PATTERN_ROLE, CONTEXT_MAP_ROLE, CONTEXT_MAP_ROLES } from '../roles';

/**
 * The board's automatic legend is a SUBSCRIPTION: every row is declared on the
 * command that draws the artefact (`docs/adr/0026`). What is worth freezing is
 * not its prose but its DERIVATION — the day a tenth pattern lands in
 * `CM_RELATIONSHIPS` it must get its legend row for free, exactly as it gets its
 * role and its palette entry for free.
 */

function entriesOf(command: AnyCommandDescriptor): CommandLegendEntry[] {
  const { legend } = command;
  if (!legend) return [];
  return Array.isArray(legend) ? [...legend] : [legend as CommandLegendEntry];
}

const subscribed = contextMapCommands.flatMap(entriesOf);
const entryFor = (role: string) =>
  subscribed.find(entry => entry.role === role);
const patternEntries = subscribed.filter(entry =>
  Object.values(CM_PATTERN_ROLE).includes(entry.role as never)
);

/**
 * The sections the engine derives for a board carrying `present`, with no host
 * catalogue: `translateKey` falls through to the fallback it is given, so the
 * plain English wording is still what these rows show.
 */
function legendOf(present: Iterable<string>) {
  const registry = new Map<string, AnyCommandDescriptor>(
    contextMapCommands.map((command, i) => [`Command-${i}`, command])
  );
  const std = {
    getOptional: () => undefined,
    provider: {
      getAll: (identifier: unknown) =>
        identifier === (CommandDescriptorIdentifier as unknown)
          ? registry
          : new Map([['RoleVocabulary-1', CONTEXT_MAP_ROLES]]),
    },
  } as unknown as BlockStdScope;
  return legendFromCommands(std, 'ddd-context-map', new Set(present));
}

describe('the Context Map legend derives from the commands', () => {
  it('has one relationship row per pattern, in the presets’ own order', () => {
    expect(patternEntries.map(e => e.role)).toEqual(
      CM_RELATIONSHIPS.map(preset => CM_PATTERN_ROLE[preset.kind])
    );
    // The abbreviation is stitched back on AFTER translation — it is never a
    // translatable word — so it lives on the entry and not in the wording.
    expect(patternEntries.map(e => e.labelPrefix)).toEqual(
      CM_RELATIONSHIPS.map(preset => preset.abbrev)
    );
  });

  it('draws the two no-integration patterns dashed, like the board does', () => {
    expect(patternEntries.map(e => e.row.dashed)).toEqual(
      CM_RELATIONSHIPS.map(preset => preset.dashed)
    );
    const dashed = patternEntries.filter(e => e.row.dashed).map(e => e.role);
    expect(dashed).toEqual([
      CM_PATTERN_ROLE.separateWays,
      CM_PATTERN_ROLE.bbom,
    ]);
  });

  it('takes the bounded-context swatch colour from the shared units', () => {
    const context = entryFor(CONTEXT_MAP_ROLE.context);
    expect(context).toBeDefined();
    expect(context!.row.swatch).toBe('square');
    expect(context!.row.color).toBe(CM_BUBBLE.fill);
  });

  it('names only roles the vocabulary declares', () => {
    for (const entry of subscribed) {
      expect(CONTEXT_MAP_ROLES[entry.role]).toBeDefined();
    }
  });

  /**
   * The cloud carries `context-map:system` (PO recette, 17/09/2026, #369), so it
   * has a row — subscribed by `addCloud`, which is why it lands in BOUNDARIES
   * beside the bounded context and in the cloud's own lilac. (The "BBoM" row
   * further down is the PATTERN, not the cloud shape.)
   */
  it('lists the cloud under its role, in the fill the palette draws it with', () => {
    const cloud = contextMapCommands.find(
      command => command.id === 'ddd-context-map.addCloud'
    );
    expect(cloud, 'ddd-context-map.addCloud').toBeDefined();
    const [system, ...rest] = entriesOf(cloud!);
    expect(rest).toEqual([]);
    expect(system.role).toBe(CONTEXT_MAP_ROLE.system);
    expect(system.row.swatch).toBe('square');
    expect(system.row.color).toBe(CLOUD.fill);
    expect(system.section).toBe(entryFor(CONTEXT_MAP_ROLE.context)!.section);
  });

  it('subscribes nothing on the board itself, only its box', () => {
    const board = contextMapCommands.find(
      command => command.telemetry?.board === true
    );
    expect(entriesOf(board!)).toEqual([]);
    expect(board!.legendBox?.width).toBe(290);
  });
});

describe('what a drawn board puts in its legend', () => {
  it('lists the contexts and the patterns actually drawn, and nothing else', () => {
    const sections = legendOf([CONTEXT_MAP_ROLE.context, CM_PATTERN_ROLE.acl]);
    expect(sections.map(s => s.title)).toEqual(['Boundaries', 'Relationships']);
    expect(sections.map(s => s.rows.map(r => r.label))).toEqual([
      ['Bounded context'],
      ['ACL — Anticorruption Layer'],
    ]);
  });

  it('gives a cloud on the board its row, and a board without one none', () => {
    const rows = (present: string[]) =>
      legendOf(present).flatMap(s => s.rows.map(r => r.label));
    expect(rows([CONTEXT_MAP_ROLE.system])).toEqual([
      'System / Big Ball of Mud',
    ]);
    // A legacy cloud carries no role: it contributes nothing to `present`.
    expect(rows([CONTEXT_MAP_ROLE.context])).toEqual(['Bounded context']);
    // And where both are drawn, the cloud reads second — `addCloud` comes after
    // `addBoundedContext` in the palette, and the legend is the palette's order.
    expect(rows([CONTEXT_MAP_ROLE.system, CONTEXT_MAP_ROLE.context])).toEqual([
      'Bounded context',
      'System / Big Ball of Mud',
    ]);
  });

  it('drops the Relationships section on a map with no link drawn yet', () => {
    const sections = legendOf([CONTEXT_MAP_ROLE.context]);
    expect(sections.map(s => s.title)).toEqual(['Boundaries']);
  });

  it('is empty on a map drawn before the roles existed', () => {
    expect(legendOf([])).toEqual([]);
  });
});
