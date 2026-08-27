import { describe, expect, test } from 'vitest';

import {
  SENIOR_MENU_CAP,
  SENIOR_MENU_RANKED_SLOTS,
  rankCommandsByUsage,
  selectSeniorMenuCommands,
  type AnyCommandDescriptor,
  type CommandUsageStats,
} from '../extension/command-registry.js';

/**
 * PF6, the arbitration between a framework's whole toolbox and fourteen
 * buttons. Pure by construction, so every rule below is a fact about the
 * function rather than about a rendered popover — which is the point of
 * `docs/adr/0008`'s amendment of 2026-08-26: the cap and the ranking are
 * enforced by tests, not by design review.
 */

const command = (id: string, order: number): AnyCommandDescriptor => ({
  id,
  owner: 'bpmn',
  kind: 'artefact',
  labelKey: `label.${id}`,
  surfaces: ['senior-menu', 'catalogue'],
  order,
  scope: 'edgeless',
  defaultKeys: { mac: [], other: [] },
  run: () => {},
});

/** `n` commands in authored order, ids `cmd.0` … `cmd.{n-1}`. */
const catalogueOf = (n: number) =>
  Array.from({ length: n }, (_, index) => command(`cmd.${index}`, index));

const statsFrom =
  (table: Record<string, CommandUsageStats>) =>
  (id: string): CommandUsageStats | undefined =>
    table[id];

const never = () => undefined;
const idsOf = (commands: AnyCommandDescriptor[]) => commands.map(c => c.id);

describe('below the cap nothing is arbitrated', () => {
  test('the sub-menu is the authored menu, whole and in order', () => {
    const catalogue = catalogueOf(SENIOR_MENU_CAP);
    const menu = catalogue.slice(0, 10);
    const { commands, overflow } = selectSeniorMenuCommands(
      menu,
      catalogue,
      never
    );
    expect(overflow).toBe(false);
    expect(commands).toBe(menu);
  });

  test('the usage store is not even consulted', () => {
    const catalogue = catalogueOf(SENIOR_MENU_CAP);
    const asked: string[] = [];
    selectSeniorMenuCommands(catalogue, catalogue, id => {
      asked.push(id);
      return undefined;
    });
    expect(asked).toEqual([]);
  });

  test('fourteen is inside the cap, fifteen is past it', () => {
    const fourteen = catalogueOf(14);
    const fifteen = catalogueOf(15);
    expect(selectSeniorMenuCommands(fourteen, fourteen, never).overflow).toBe(
      false
    );
    expect(
      selectSeniorMenuCommands(fourteen, fourteen, never).commands
    ).toEqual(fourteen);
    const past = selectSeniorMenuCommands(fifteen, fifteen, never);
    expect(past.overflow).toBe(true);
    expect(past.commands).toHaveLength(SENIOR_MENU_RANKED_SLOTS);
  });
});

describe('past the cap, seven slots ranked on two axes', () => {
  /**
   * The cold start. A fresh install has measured nothing, so both axes collapse
   * to authored order and the menu is deterministic rather than empty — the one
   * property a ranking must not get wrong, because it is what every user sees
   * first.
   */
  test('with no usage at all the first seven authored commands are shown', () => {
    const catalogue = catalogueOf(20);
    const { commands, overflow } = selectSeniorMenuCommands(
      catalogue,
      catalogue,
      never
    );
    expect(overflow).toBe(true);
    expect(idsOf(commands)).toEqual([
      'cmd.0',
      'cmd.1',
      'cmd.2',
      'cmd.3',
      'cmd.4',
      'cmd.5',
      'cmd.6',
    ]);
  });

  test('four most-used and three most-recent, when the two disagree', () => {
    const catalogue = catalogueOf(15);
    // Four workhorses, invoked often and long ago; three artefacts picked up
    // once, this morning. Neither axis alone would show both groups.
    const stats = statsFrom({
      'cmd.0': { count: 10, lastUsedAt: 100 },
      'cmd.1': { count: 9, lastUsedAt: 100 },
      'cmd.2': { count: 8, lastUsedAt: 100 },
      'cmd.3': { count: 7, lastUsedAt: 100 },
      'cmd.10': { count: 1, lastUsedAt: 999 },
      'cmd.11': { count: 1, lastUsedAt: 998 },
      'cmd.12': { count: 1, lastUsedAt: 997 },
    });
    const { commands } = selectSeniorMenuCommands(catalogue, catalogue, stats);
    expect(idsOf(commands)).toEqual([
      'cmd.0',
      'cmd.1',
      'cmd.2',
      'cmd.3',
      'cmd.10',
      'cmd.11',
      'cmd.12',
    ]);
  });

  /**
   * The dedup rule, and where the freed slot goes. Three commands top BOTH
   * axes; they take one slot each, and the three gaps are refilled from
   * frequency rather than from the fourth, fifth and sixth most recent.
   */
  test('a command on both axes takes one slot, and frequency backfills the gap', () => {
    const catalogue = catalogueOf(15);
    const stats = statsFrom({
      'cmd.10': { count: 50, lastUsedAt: 1000 },
      'cmd.11': { count: 40, lastUsedAt: 900 },
      'cmd.12': { count: 30, lastUsedAt: 800 },
      'cmd.13': { count: 20, lastUsedAt: 700 },
      'cmd.14': { count: 10, lastUsedAt: 600 },
      'cmd.9': { count: 5, lastUsedAt: 500 },
    });
    const { commands } = selectSeniorMenuCommands(catalogue, catalogue, stats);
    // 10, 11, 12 are both most-used and most-recent → 4 distinct so far; the
    // next most-used (13 is already in, then 14, then 9) fill up to seven, and
    // the seventh is the first never-used command in authored order.
    expect(idsOf(commands)).toEqual([
      'cmd.0',
      'cmd.9',
      'cmd.10',
      'cmd.11',
      'cmd.12',
      'cmd.13',
      'cmd.14',
    ]);
    expect(new Set(idsOf(commands)).size).toBe(SENIOR_MENU_RANKED_SLOTS);
  });

  test('a command nobody ever invoked ranks after every command somebody did', () => {
    const catalogue = catalogueOf(15);
    // The last three authored commands are the only measured ones; they win
    // their slots against eleven earlier, never-used siblings.
    const stats = statsFrom({
      'cmd.12': { count: 3, lastUsedAt: 300 },
      'cmd.13': { count: 2, lastUsedAt: 200 },
      'cmd.14': { count: 1, lastUsedAt: 100 },
    });
    const { commands } = selectSeniorMenuCommands(catalogue, catalogue, stats);
    expect(idsOf(commands)).toContain('cmd.12');
    expect(idsOf(commands)).toContain('cmd.13');
    expect(idsOf(commands)).toContain('cmd.14');
    // The four remaining slots go to the authored head, not to a lottery.
    expect(idsOf(commands)).toEqual([
      'cmd.0',
      'cmd.1',
      'cmd.2',
      'cmd.3',
      'cmd.12',
      'cmd.13',
      'cmd.14',
    ]);
  });

  /**
   * Why the ranking reads the CATALOGUE and not the menu. An artefact its
   * author left out of the fourteen, that this user invokes constantly, has
   * earned a slot — a selection that could only ever demote would never learn
   * that.
   */
  test('a catalogue-only command a user reaches for constantly is promoted', () => {
    const catalogue = catalogueOf(15);
    const menu = catalogue.slice(0, 14);
    const stats = statsFrom({ 'cmd.14': { count: 99, lastUsedAt: 999 } });
    const { commands } = selectSeniorMenuCommands(menu, catalogue, stats);
    expect(idsOf(menu)).not.toContain('cmd.14');
    expect(idsOf(commands)).toContain('cmd.14');
  });

  /**
   * Membership is what the ranking decides; position is not. A menu whose
   * buttons swap places under the cursor is the dark pattern this feature
   * exists to avoid, so the most-used command sits wherever its author put it.
   */
  test('the seven are laid out in authored order, never in rank order', () => {
    const catalogue = catalogueOf(15);
    const stats = statsFrom({
      'cmd.14': { count: 99, lastUsedAt: 999 },
      'cmd.13': { count: 98, lastUsedAt: 998 },
      'cmd.0': { count: 1, lastUsedAt: 1 },
    });
    const { commands } = selectSeniorMenuCommands(catalogue, catalogue, stats);
    const authored = idsOf(commands).map(id => Number(id.split('.')[1]));
    expect(authored).toEqual([...authored].sort((a, b) => a - b));
    expect(commands[0].id).toBe('cmd.0');
    expect(commands[commands.length - 1].id).toBe('cmd.14');
  });

  test('ties on a count fall back to recency, then to authored order', () => {
    const catalogue = catalogueOf(15);
    const stats = statsFrom({
      // Same count everywhere: recency decides, and cmd.5 / cmd.6 tie on that
      // too, so authored order is the last word.
      'cmd.8': { count: 2, lastUsedAt: 800 },
      'cmd.7': { count: 2, lastUsedAt: 700 },
      'cmd.6': { count: 2, lastUsedAt: 600 },
      'cmd.5': { count: 2, lastUsedAt: 600 },
      'cmd.4': { count: 2, lastUsedAt: 500 },
    });
    const { commands } = selectSeniorMenuCommands(catalogue, catalogue, stats);
    // Most-used: 8, 7, 5, 6 (5 before 6 on the authored tiebreak) → four slots.
    // Most-recent: 8, 7, 5 — all already in. Backfill from frequency: 4, then
    // the first two never-used commands.
    expect(idsOf(commands)).toEqual([
      'cmd.0',
      'cmd.1',
      'cmd.4',
      'cmd.5',
      'cmd.6',
      'cmd.7',
      'cmd.8',
    ]);
  });
});

describe('rankCommandsByUsage (the catalogue head section)', () => {
  test('no usage at all yields nothing — the section is absent, not padded', () => {
    expect(rankCommandsByUsage(catalogueOf(16), never)).toEqual([]);
  });

  test('only commands that carry a measure appear, in pick order', () => {
    const stats = statsFrom({
      'cmd.9': { count: 5, lastUsedAt: 100 },
      'cmd.3': { count: 4, lastUsedAt: 400 },
      'cmd.12': { count: 1, lastUsedAt: 900 },
    });
    // Frequency ranks first (9, 3, 12 fills slot 3 and 4 stops for lack of
    // used commands), the recency additions after — 12 is already in. Never
    // re-sorted by authored order: "most-reached-for first" IS the message.
    expect(idsOf(rankCommandsByUsage(catalogueOf(16), stats))).toEqual([
      'cmd.9',
      'cmd.3',
      'cmd.12',
    ]);
  });

  test('a recency-only pick joins after the frequency ranks', () => {
    const stats = statsFrom({
      'cmd.1': { count: 9, lastUsedAt: 10 },
      'cmd.2': { count: 8, lastUsedAt: 20 },
      'cmd.3': { count: 7, lastUsedAt: 30 },
      'cmd.4': { count: 6, lastUsedAt: 40 },
      'cmd.15': { count: 1, lastUsedAt: 999 },
    });
    expect(idsOf(rankCommandsByUsage(catalogueOf(16), stats))).toEqual([
      'cmd.1',
      'cmd.2',
      'cmd.3',
      'cmd.4',
      'cmd.15',
    ]);
  });

  test('caps at the ranked slot count even when more were used', () => {
    const table: Record<string, CommandUsageStats> = {};
    for (let index = 0; index < 12; index++) {
      table[`cmd.${index}`] = { count: 12 - index, lastUsedAt: index };
    }
    const ranked = rankCommandsByUsage(catalogueOf(16), statsFrom(table));
    expect(ranked).toHaveLength(SENIOR_MENU_RANKED_SLOTS);
  });
});
