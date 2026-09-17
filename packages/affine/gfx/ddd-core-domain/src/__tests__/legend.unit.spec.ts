import { legendFromCommands } from '@labre/affine-block-surface';
import {
  CD_SUBDOMAINS,
  MOVEMENT_COLOR,
  TEAM_TOPOLOGIES,
} from '@labre/affine-gfx-ddd-shared';
import {
  CommandDescriptorIdentifier,
  type AnyCommandDescriptor,
  type BlockStdScope,
  type CommandLegendEntry,
} from '@labre/std';
import { describe, expect, it } from 'vitest';

import { coreDomainCommands } from '../commands';
import { CORE_DOMAIN_ROLE, CORE_DOMAIN_ROLES } from '../roles';

/**
 * The chart's automatic legend is a SUBSCRIPTION: every row is declared on the
 * command that places the artefact (`docs/adr/0026`). What is worth freezing is
 * its DERIVATION — the five dot colours the legend shows must BE the five the
 * palette draws, the same five `core-domain.off-legend-colour` sanctions.
 */

function entriesOf(command: AnyCommandDescriptor): CommandLegendEntry[] {
  const { legend } = command;
  if (!legend) return [];
  return Array.isArray(legend) ? [...legend] : [legend as CommandLegendEntry];
}

const subscribed = coreDomainCommands.flatMap(entriesOf);
const dots = subscribed.filter(entry => entry.row.swatch === 'dot');
const markers = subscribed.filter(entry => entry.row.letter !== undefined);

/**
 * The sections the engine derives for a chart carrying `present`, with no host
 * catalogue: `translateKey` falls through to the fallback it is given, so the
 * plain English wording is still what these rows show.
 */
function legendOf(present: Iterable<string>) {
  const registry = new Map<string, AnyCommandDescriptor>(
    coreDomainCommands.map((command, i) => [`Command-${i}`, command])
  );
  const std = {
    getOptional: () => undefined,
    provider: {
      getAll: (identifier: unknown) =>
        identifier === (CommandDescriptorIdentifier as unknown)
          ? registry
          : new Map([['RoleVocabulary-1', CORE_DOMAIN_ROLES]]),
    },
  } as unknown as BlockStdScope;
  return legendFromCommands(std, 'ddd-core-domain', new Set(present));
}

describe('the Core Domain legend derives from the presets', () => {
  it('has one dot row per sub-domain preset, in the presets’ own order', () => {
    expect(dots.map(e => e.role)).toEqual(
      CD_SUBDOMAINS.map(preset => CORE_DOMAIN_ROLE[preset.kind])
    );
    expect(dots.map(e => e.row.color)).toEqual(
      CD_SUBDOMAINS.map(preset => preset.fill)
    );
    // Each row says the ROLE's key with the PALETTE's shorter label behind it:
    // a host resolving the key reads what it always read, and a host without a
    // catalogue keeps "Bounded context" rather than the role's fuller
    // "Bounded context (current position)".
    expect(dots.map(e => e.labelWording?.[0])).toEqual(
      CD_SUBDOMAINS.map(
        preset => CORE_DOMAIN_ROLES[CORE_DOMAIN_ROLE[preset.kind]].labelKey
      )
    );
    expect(dots.map(e => e.labelWording?.[1])).toEqual(
      CD_SUBDOMAINS.map(preset => preset.label)
    );
  });

  /**
   * The markers were missing for one release: detection is by role only and
   * `addMarker` stamped none, so a chart covered in them produced a legend that
   * mentioned none (PO recette, 26/08/2026). Now that they carry a role, the row
   * has to show what identifies a marker on the chart — the LETTER, not just a
   * coloured square a reader has no key to.
   */
  it('shows each Team Topologies marker as its own square, letter included', () => {
    expect(markers.map(e => e.role)).toEqual(
      TEAM_TOPOLOGIES.map(preset => CORE_DOMAIN_ROLE[preset.kind])
    );
    expect(markers.map(e => e.row.color)).toEqual(
      TEAM_TOPOLOGIES.map(preset => preset.fill)
    );
    expect(markers.map(e => e.row.letter)).toEqual(['C', 'X', 'F']);
    expect(markers.every(e => e.row.swatch === 'square')).toBe(true);
  });

  it('draws the movement red and dashed, like the chart does', () => {
    const movement = subscribed.find(e => e.role === CORE_DOMAIN_ROLE.movement);
    expect(movement).toBeDefined();
    expect(movement!.row.swatch).toBe('line');
    expect(movement!.row.color).toBe(MOVEMENT_COLOR);
    expect(movement!.row.dashed).toBe(true);
  });

  it('names only roles the vocabulary declares', () => {
    for (const entry of subscribed) {
      expect(CORE_DOMAIN_ROLES[entry.role]).toBeDefined();
    }
  });

  it('subscribes nothing on the chart itself', () => {
    const board = coreDomainCommands.find(
      command => command.telemetry?.board === true
    );
    expect(entriesOf(board!)).toEqual([]);
  });
});

describe('what a drawn chart puts in its legend', () => {
  it('titles the box in English', () => {
    // PO recette, 26/08/2026. Identifiers and fallback wordings are English in
    // this library; the box used to be the one that was not. No `legendBox`
    // here, so the shared `BOARD_LEGEND_TITLE` is what the engine resolves.
    const board = coreDomainCommands.find(
      command => command.telemetry?.board === true
    );
    expect(board!.legendBox).toBeUndefined();
  });

  it('lists the dot kinds actually placed, and nothing else', () => {
    const sections = legendOf([
      CORE_DOMAIN_ROLE.bigBet,
      CORE_DOMAIN_ROLE.bcCurrent,
    ]);
    // No marker on the chart, so no marker section — sub-title included.
    expect(sections.map(s => s.rows.map(r => r.label))).toEqual([
      ['Big-bet sub-domain', 'Bounded context'],
    ]);
  });

  it('lists a marker once one is on the chart, and only the ones that are', () => {
    const sections = legendOf([CORE_DOMAIN_ROLE.bigBet, CORE_DOMAIN_ROLE.xaas]);
    expect(sections.map(s => s.title)).toEqual([
      'Sub-domains',
      'Team interaction modes',
    ]);
    expect(sections[1].rows).toEqual([
      {
        swatch: 'square',
        color: '#66b2ff',
        letter: 'X',
        label: 'X-as-a-Service',
      },
    ]);
  });

  it('files the movement under its own sub-title', () => {
    const sections = legendOf([
      CORE_DOMAIN_ROLE.bigBet,
      CORE_DOMAIN_ROLE.movement,
    ]);
    expect(sections.map(s => s.title)).toEqual(['Sub-domains', 'Movement']);
  });

  it('is empty on a chart drawn before the roles existed', () => {
    // Every dot on such a chart is neutral, so nothing is recognised — and the
    // box the toolbar then draws is a title with no rows, not the full notation
    // it used to fall back to.
    expect(legendOf([])).toEqual([]);
  });
});
