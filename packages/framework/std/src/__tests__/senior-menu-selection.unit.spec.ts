import { describe, expect, test } from 'vitest';

import {
  CATALOGUE_HEAD_RANKED_SLOTS,
  SENIOR_MENU_CAP,
  SENIOR_MENU_RANKED_SLOTS,
  rankCommandsByUsage,
  selectSeniorMenuCommands,
  type AnyCommandDescriptor,
  type CommandSurface,
  type CommandUsageStats,
} from '../extension/command-registry.js';

/**
 * PF6, the arbitration between a framework's whole toolbox and fourteen
 * buttons. Pure by construction, so every rule below is a fact about the
 * function rather than about a rendered popover — which is the point of
 * `docs/adr/0008`'s amendment of 2026-08-26: the cap and the ranking are
 * enforced by tests, not by design review.
 *
 * Re-arbitrated by the PO on 2026-08-28 (same ADR, second amendment): thirteen
 * ranked slots instead of seven, recency-first instead of frequency-first, and
 * membership drawn from the `'senior-menu'` surface instead of the catalogue.
 * The sidepanel head section keeps its own seven — same arbitration, its own
 * magnitude — which is the third decision of that amendment.
 */

const command = (
  id: string,
  order: number,
  surfaces: CommandSurface[] = ['senior-menu', 'catalogue']
): AnyCommandDescriptor => ({
  id,
  owner: 'bpmn',
  kind: 'artefact',
  labelKey: `label.${id}`,
  surfaces,
  order,
  scope: 'edgeless',
  defaultKeys: { mac: [], other: [] },
  run: () => {},
});

/** `n` commands in authored order, ids `cmd.0` … `cmd.{n-1}`. */
const catalogueOf = (n: number) =>
  Array.from({ length: n }, (_, index) => command(`cmd.${index}`, index));

/**
 * The shape every shipped framework past the cap actually has: a nominated
 * sub-menu list, and a bigger catalogue behind it. `menu` is what gets ranked;
 * `catalogue` only decides that there IS an overflow.
 */
const overflowing = (menuSize = SENIOR_MENU_CAP, catalogueSize = 20) => {
  const catalogue = catalogueOf(catalogueSize);
  return { menu: catalogue.slice(0, menuSize), catalogue };
};

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

  /**
   * The TRIGGER reads the catalogue even though the RANKING no longer does: a
   * framework overflows when its whole toolbox outgrows the fourteen, whatever
   * it nominated. A ten-button menu behind a twenty-command catalogue still
   * collapses — which is what puts the "More artefacts…" button on screen.
   */
  test('a small menu behind a big catalogue still overflows', () => {
    const { menu, catalogue } = overflowing(10);
    const { commands, overflow } = selectSeniorMenuCommands(
      menu,
      catalogue,
      never
    );
    expect(overflow).toBe(true);
    // Nothing to rank away: ten is under thirteen, so all ten survive.
    expect(idsOf(commands)).toEqual(idsOf(menu));
  });
});

describe('eligibility: ranked membership is declared, never earned', () => {
  /**
   * The PO ruling of 2026-08-28, and the regression it exists to stop. BPMN's
   * `bpmn.exportXml` declines `'senior-menu'` on purpose — its subject is the
   * whole BOARD, it lives in the pool's "⋮" and in the catalogue — and the
   * ranking used to drag it into the sub-menu by its own usage. "Export BPMN"
   * in a row of things you DRAW answers no question a user asked. A declined
   * surface is a statement, not a default to out-vote.
   *
   * What the rule does NOT say is that a declaration cannot change: the same
   * day's second decision nominated `bpmn.importXml`, because a board comes
   * FROM a file. That is a framework rewriting its own statement, which is the
   * one thing allowed to move a command into this row.
   */
  test('a catalogue-only command never enters the sub-menu, however used', () => {
    const menu = catalogueOf(14);
    const boardAction = command('cmd.export', 14, ['catalogue']);
    const catalogue = [...menu, boardAction, ...catalogueOf(20).slice(15)];

    const { commands, overflow } = selectSeniorMenuCommands(
      menu,
      catalogue,
      statsFrom({ 'cmd.export': { count: 9999, lastUsedAt: 9999 } })
    );

    expect(overflow).toBe(true);
    expect(idsOf(commands)).not.toContain('cmd.export');
    expect(commands).toHaveLength(SENIOR_MENU_RANKED_SLOTS);
    // …and its usage does not distort the row either: the thirteen are the
    // cold-start thirteen, because nothing else was ever invoked.
    expect(idsOf(commands)).toEqual(idsOf(menu.slice(0, 13)));
  });

  test('the store is asked about the nominated commands and nobody else', () => {
    const menu = catalogueOf(14);
    const catalogue = [...menu, ...catalogueOf(20).slice(14)];
    const asked: string[] = [];
    selectSeniorMenuCommands(menu, catalogue, id => {
      asked.push(id);
      return undefined;
    });
    expect(new Set(asked)).toEqual(new Set(idsOf(menu)));
  });
});

describe('past the cap, thirteen slots ranked on two axes', () => {
  /**
   * The cold start. A fresh install has measured nothing, so both axes collapse
   * to authored order and the menu is deterministic rather than empty — the one
   * property a ranking must not get wrong, because it is what every user sees
   * first.
   *
   * Pure AUTHOR ORDER, and nothing else: the sub-menu convention is "boards
   * first, base next, niche last", and a zero-usage row must read exactly as
   * its author wrote it, head to tail with no gaps.
   */
  test('with no usage at all the first thirteen authored commands are shown', () => {
    const { menu, catalogue } = overflowing();
    const { commands, overflow } = selectSeniorMenuCommands(
      menu,
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
      'cmd.7',
      'cmd.8',
      'cmd.9',
      'cmd.10',
      'cmd.11',
      'cmd.12',
    ]);
    // The prefix of the nominated list, with nothing skipped and nothing
    // reordered — the fourteenth is simply the one the More button covers.
    expect(idsOf(commands)).toEqual(idsOf(menu.slice(0, 13)));
  });

  /**
   * Seven recent and six used, when the two axes disagree completely: every
   * nominated command is measured, the newest seven are the last seven
   * authored, and the heaviest six are the first six. Exactly one command is
   * neither, and it is exactly the one that loses its seat.
   */
  test('seven most-recent, six most-used, and the one that is neither loses', () => {
    const { menu, catalogue } = overflowing();
    const stats = statsFrom(
      Object.fromEntries(
        menu.map((c, index) => [
          c.id,
          // Newest last, heaviest first: the two rankings run head to head.
          { count: 50 - index, lastUsedAt: 100 + index },
        ])
      )
    );
    const { commands } = selectSeniorMenuCommands(menu, catalogue, stats);
    // Recency takes cmd.7 … cmd.13, frequency takes cmd.0 … cmd.5, and cmd.6 —
    // neither recent enough nor used enough — is the one the More button covers.
    expect(idsOf(commands)).toEqual([
      'cmd.0',
      'cmd.1',
      'cmd.2',
      'cmd.3',
      'cmd.4',
      'cmd.5',
      'cmd.7',
      'cmd.8',
      'cmd.9',
      'cmd.10',
      'cmd.11',
      'cmd.12',
      'cmd.13',
    ]);
  });

  /**
   * The dedup rule, and where the freed slot goes. Three commands top BOTH
   * axes; each takes ONE slot, and the slot it took is a RECENT one — so the
   * three most-used slots it did not consume go to the next candidates down the
   * frequency ranking rather than evaporating.
   */
  test('a command on both axes takes a recent slot, and frequency backfills', () => {
    const { menu, catalogue } = overflowing();
    const stats = statsFrom({
      // Top of both rankings.
      'cmd.13': { count: 100, lastUsedAt: 1000 },
      'cmd.12': { count: 99, lastUsedAt: 999 },
      'cmd.11': { count: 98, lastUsedAt: 998 },
      // Recent only — picked up once, this morning.
      'cmd.10': { count: 1, lastUsedAt: 997 },
      'cmd.9': { count: 1, lastUsedAt: 996 },
      'cmd.8': { count: 1, lastUsedAt: 995 },
      'cmd.7': { count: 1, lastUsedAt: 994 },
      // Used only — workhorses, but not touched today.
      'cmd.0': { count: 50, lastUsedAt: 10 },
      'cmd.1': { count: 49, lastUsedAt: 9 },
      'cmd.2': { count: 48, lastUsedAt: 8 },
      'cmd.3': { count: 47, lastUsedAt: 7 },
      'cmd.4': { count: 46, lastUsedAt: 6 },
      'cmd.5': { count: 45, lastUsedAt: 5 },
    });
    const { commands } = selectSeniorMenuCommands(menu, catalogue, stats);
    // Six workhorses, not three: 13/12/11 sat down in recent seats, so all six
    // frequency seats were still free when the backfill walked the ranking.
    expect(idsOf(commands)).toEqual([
      'cmd.0',
      'cmd.1',
      'cmd.2',
      'cmd.3',
      'cmd.4',
      'cmd.5',
      'cmd.7',
      'cmd.8',
      'cmd.9',
      'cmd.10',
      'cmd.11',
      'cmd.12',
      'cmd.13',
    ]);
    expect(new Set(idsOf(commands)).size).toBe(SENIOR_MENU_RANKED_SLOTS);
    expect(idsOf(commands)).not.toContain('cmd.6');
  });

  /**
   * The pin for ruling 2's OTHER half — that recency LEADS.
   *
   * The fixture above proves the dedup arbitration but not the axis priority:
   * with three doubles over a fourteen-command menu, recency-first and
   * frequency-first happen to seat the same thirteen, and
   * `selectSeniorMenuCommands` re-sorts into author order so the pick order is
   * invisible. Inverting `pickByUsage` to seed with `mostUsed` therefore escapes
   * every other sub-menu test in this file.
   *
   * This shape does not let it. Twenty commands, all measured, in three groups:
   * three that top BOTH axes, six touched today and almost never otherwise, and
   * eleven workhorses last touched long ago. The two orderings disagree on four
   * seats — recency-first seats `cmd.13`/`cmd.14` and drops `cmd.7`/`cmd.8`,
   * frequency-first does the reverse and takes `cmd.19` besides.
   */
  test('recency leads: inverting the two axes changes who is seated', () => {
    const { menu, catalogue } = overflowing(20, 20);
    const table: Record<string, CommandUsageStats> = {
      'cmd.0': { count: 1000, lastUsedAt: 1000 },
      'cmd.1': { count: 999, lastUsedAt: 999 },
      'cmd.2': { count: 998, lastUsedAt: 998 },
    };
    // Picked up this morning, once each — invisible to frequency.
    for (let i = 3; i <= 8; i++) {
      table[`cmd.${i}`] = { count: 1, lastUsedAt: 1000 - i };
    }
    // Heavy, and not touched in weeks — invisible to recency.
    for (let i = 9; i <= 19; i++) {
      table[`cmd.${i}`] = { count: 500 - i, lastUsedAt: i };
    }

    const { commands } = selectSeniorMenuCommands(
      menu,
      catalogue,
      statsFrom(table)
    );

    // Seven recent seats: the three doubles plus cmd.3 … cmd.6. Six frequency
    // seats: the heaviest six that are not already in, cmd.9 … cmd.14. So the
    // two commands touched this morning but ranked eighth and ninth on recency
    // are the ones that lose — under a frequency-first ranking they would be
    // seated and cmd.13 / cmd.14 would not.
    expect(idsOf(commands)).toEqual([
      'cmd.0',
      'cmd.1',
      'cmd.2',
      'cmd.3',
      'cmd.4',
      'cmd.5',
      'cmd.6',
      'cmd.9',
      'cmd.10',
      'cmd.11',
      'cmd.12',
      'cmd.13',
      'cmd.14',
    ]);
    expect(idsOf(commands)).not.toContain('cmd.7');
    expect(idsOf(commands)).not.toContain('cmd.8');
  });

  test('a command nobody ever invoked ranks after every command somebody did', () => {
    const { menu, catalogue } = overflowing();
    // The last three nominated commands are the only measured ones; they win
    // their slots against eleven earlier, never-used siblings.
    const stats = statsFrom({
      'cmd.11': { count: 3, lastUsedAt: 300 },
      'cmd.12': { count: 2, lastUsedAt: 200 },
      'cmd.13': { count: 1, lastUsedAt: 100 },
    });
    const { commands } = selectSeniorMenuCommands(menu, catalogue, stats);
    expect(idsOf(commands)).toContain('cmd.11');
    expect(idsOf(commands)).toContain('cmd.12');
    expect(idsOf(commands)).toContain('cmd.13');
    // The ten remaining slots go to the authored head, not to a lottery — and
    // the single command dropped is the last never-used one in author order.
    expect(idsOf(commands)).toEqual([
      'cmd.0',
      'cmd.1',
      'cmd.2',
      'cmd.3',
      'cmd.4',
      'cmd.5',
      'cmd.6',
      'cmd.7',
      'cmd.8',
      'cmd.9',
      'cmd.11',
      'cmd.12',
      'cmd.13',
    ]);
  });

  /**
   * Membership is what the ranking decides; position is not. A menu whose
   * buttons swap places under the cursor is the dark pattern this feature
   * exists to avoid, so the most-used command sits wherever its author put it.
   */
  test('the thirteen are laid out in authored order, never in rank order', () => {
    const { menu, catalogue } = overflowing();
    const stats = statsFrom({
      'cmd.13': { count: 99, lastUsedAt: 999 },
      'cmd.12': { count: 98, lastUsedAt: 998 },
      'cmd.0': { count: 1, lastUsedAt: 1 },
    });
    const { commands } = selectSeniorMenuCommands(menu, catalogue, stats);
    const authored = idsOf(commands).map(id => Number(id.split('.')[1]));
    expect(authored).toEqual([...authored].sort((a, b) => a - b));
    expect(commands[0].id).toBe('cmd.0');
    expect(commands[commands.length - 1].id).toBe('cmd.13');
  });

  test('ties on a count fall back to recency, then to authored order', () => {
    const { menu, catalogue } = overflowing();
    // Same count everywhere, so recency is the whole ranking — and cmd.12 and
    // cmd.13 tie on that too, so authored order is the last word and cmd.13 is
    // the one seat that has to be given up.
    const stats = statsFrom(
      Object.fromEntries(
        menu.map((c, index) => [
          c.id,
          { count: 2, lastUsedAt: index < 12 ? 100 - index : 50 },
        ])
      )
    );
    const { commands } = selectSeniorMenuCommands(menu, catalogue, stats);
    expect(idsOf(commands)).toEqual(idsOf(menu.slice(0, 13)));
    expect(idsOf(commands)).not.toContain('cmd.13');
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
    // Recency ranks first (12, 3, 9), the frequency additions after — all three
    // are already in. Never re-sorted by authored order: "yours, latest first"
    // IS the message.
    expect(idsOf(rankCommandsByUsage(catalogueOf(16), stats))).toEqual([
      'cmd.12',
      'cmd.3',
      'cmd.9',
    ]);
  });

  test('a frequency-only pick joins after the four recency ranks', () => {
    const table: Record<string, CommandUsageStats> = {
      // Two old workhorses, past the four-deep recency head.
      'cmd.0': { count: 500, lastUsedAt: 1 },
      'cmd.1': { count: 400, lastUsedAt: 2 },
    };
    // Seven commands touched today, each exactly once.
    for (let index = 0; index < 7; index++) {
      table[`cmd.${9 + index}`] = { count: 1, lastUsedAt: 900 + index };
    }
    expect(
      idsOf(rankCommandsByUsage(catalogueOf(16), statsFrom(table)))
    ).toEqual([
      // The four recency seats, newest first…
      'cmd.15',
      'cmd.14',
      'cmd.13',
      'cmd.12',
      // …then the three frequency ones: the two workhorses, and — the seats
      // still not full — the next command down the frequency ranking.
      'cmd.0',
      'cmd.1',
      'cmd.11',
    ]);
  });

  /**
   * The architect's ruling of 2026-08-28, third decision of the day: the head
   * section is NOT the sub-menu's thirteen. Both PO rulings concern a
   * horizontal row of icon buttons; this is a vertical list of 44px rows in a
   * 320px panel, and thirteen of them would push every category below the fold.
   *
   * Written so the cap is genuinely SENSED: eleven measured commands, so the
   * result is bounded by the slot count and by nothing else. It would go red at
   * 13, and red again at 4 or at 6 — a `.slice(0, 7)` of the sub-menu's pick,
   * the tempting shortcut, would return seven recency picks and no workhorse at
   * all, so the last two assertions are what keep "& frequent" honest.
   */
  test('the head section seats seven, four of them by recency', () => {
    const table: Record<string, CommandUsageStats> = {};
    // Four touched today, seven heavy and stale — eleven measured for seven
    // seats, so something must be dropped and WHICH is the whole assertion.
    for (let index = 0; index < 4; index++) {
      table[`cmd.${index}`] = { count: 1, lastUsedAt: 900 - index };
    }
    for (let index = 4; index < 11; index++) {
      table[`cmd.${index}`] = { count: 500 - index, lastUsedAt: index };
    }

    const ranked = rankCommandsByUsage(catalogueOf(16), statsFrom(table));
    expect(ranked).toHaveLength(CATALOGUE_HEAD_RANKED_SLOTS);
    expect(CATALOGUE_HEAD_RANKED_SLOTS).toBeLessThan(SENIOR_MENU_RANKED_SLOTS);
    expect(idsOf(ranked)).toEqual([
      // Recency first, four deep…
      'cmd.0',
      'cmd.1',
      'cmd.2',
      'cmd.3',
      // …then three by frequency, and not one more.
      'cmd.4',
      'cmd.5',
      'cmd.6',
    ]);
  });

  /**
   * Same measure, same arbitration, two magnitudes: the sub-menu seats thirteen
   * of these and the panel head seven, and the head is a prefix-by-membership
   * of nothing — it is its own selection, run at its own size.
   */
  test('the same usage seats thirteen in the row and seven in the head', () => {
    const { menu, catalogue } = overflowing(16, 20);
    const stats = statsFrom(
      Object.fromEntries(
        menu.map((c, index) => [c.id, { count: 16 - index, lastUsedAt: index }])
      )
    );

    expect(rankCommandsByUsage(menu, stats)).toHaveLength(
      CATALOGUE_HEAD_RANKED_SLOTS
    );
    expect(
      selectSeniorMenuCommands(menu, catalogue, stats).commands
    ).toHaveLength(SENIOR_MENU_RANKED_SLOTS);
  });

  /**
   * The eligibility ruling of 2026-08-28 is about the SUB-MENU. This section
   * stays on the catalogue surface: the sidepanel is the one place every
   * command of a framework is reachable, so a command that declines the
   * sub-menu heading "Recent & frequent" is the section doing its job.
   */
  test('a command that declines the sub-menu can still head this section', () => {
    const catalogue = [
      ...catalogueOf(15),
      command('cmd.export', 15, ['catalogue']),
    ];
    const ranked = rankCommandsByUsage(
      catalogue,
      statsFrom({ 'cmd.export': { count: 9, lastUsedAt: 900 } })
    );
    expect(idsOf(ranked)).toEqual(['cmd.export']);
  });

  /**
   * The store is asked once per command per selection, not once more per row
   * returned: the ranking already built the measure map, and the filter reads
   * it rather than the store. At the sidepanel's size that is 7 reads saved per
   * panel render; the promise is in `pickByUsage`'s own comment.
   */
  test('the usage store is read once per command, not twice', () => {
    const asked: string[] = [];
    rankCommandsByUsage(catalogueOf(16), id => {
      asked.push(id);
      return { count: 1, lastUsedAt: 1 };
    });
    expect(asked).toHaveLength(16);
    expect(new Set(asked).size).toBe(16);
  });
});
