import { legendFromCommands } from '@labre/affine-block-surface';
import { ES_HOTSPOT, ES_STICKIES } from '@labre/affine-gfx-ddd-shared';
import {
  CommandDescriptorIdentifier,
  type AnyCommandDescriptor,
  type BlockStdScope,
  type CommandLegendEntry,
} from '@labre/std';
import { describe, expect, it } from 'vitest';

import { eventStormingCommands } from '../commands';
import { ES_ROLE, ES_STICKY_ROLE, EVENT_STORMING_ROLES } from '../roles';

/**
 * The board's automatic legend is a SUBSCRIPTION: every row is declared on the
 * command that sticks the artefact to the wall (`docs/adr/0026`). What is worth
 * freezing is its DERIVATION — the colour the legend shows for a kind must BE
 * the colour the palette sticks on the wall, and a tenth sticky kind must get
 * its row for free.
 */

function entriesOf(command: AnyCommandDescriptor): CommandLegendEntry[] {
  const { legend } = command;
  if (!legend) return [];
  return Array.isArray(legend) ? [...legend] : [legend as CommandLegendEntry];
}

const subscribed = eventStormingCommands.flatMap(entriesOf);

/**
 * The sections the engine derives for a board carrying `present`, with no host
 * catalogue: `translateKey` falls through to the fallback it is given, so the
 * plain English wording is still what these rows show.
 */
function legendOf(present: Iterable<string>) {
  const registry = new Map<string, AnyCommandDescriptor>(
    eventStormingCommands.map((command, i) => [`Command-${i}`, command])
  );
  const std = {
    getOptional: () => undefined,
    provider: {
      getAll: (identifier: unknown) =>
        identifier === (CommandDescriptorIdentifier as unknown)
          ? registry
          : new Map([['RoleVocabulary-1', EVENT_STORMING_ROLES]]),
    },
  } as unknown as BlockStdScope;
  return legendFromCommands(std, 'ddd-event-storming', new Set(present));
}

describe('the Event Storming legend derives from the palette', () => {
  it('has one row per sticky kind, hotspot included, in palette order', () => {
    expect(subscribed.map(e => e.role)).toEqual([
      ...ES_STICKIES.map(preset => ES_STICKY_ROLE[preset.kind]),
      ES_STICKY_ROLE.hotspot,
      ES_ROLE.flow,
    ]);
  });

  it('shows each kind in the colour the palette draws it with', () => {
    expect(
      subscribed.filter(e => e.row.swatch === 'square').map(e => e.row.color)
    ).toEqual([...ES_STICKIES.map(preset => preset.fill), ES_HOTSPOT.fill]);
  });

  it('files the flow apart from the stickies, as a line', () => {
    const flow = subscribed.find(e => e.role === ES_ROLE.flow);
    expect(flow).toBeDefined();
    expect(flow!.row.swatch).toBe('line');
    // Every command of this framework sits in ONE category, so without the
    // declared section the Flow would be listed among the post-its.
    expect(flow!.section?.[1]).toBe('Flow');
  });

  it('names only roles the vocabulary declares', () => {
    for (const entry of subscribed) {
      expect(EVENT_STORMING_ROLES[entry.role]).toBeDefined();
    }
  });

  it('subscribes nothing on the board itself', () => {
    const board = eventStormingCommands.find(
      command => command.telemetry?.board === true
    );
    expect(entriesOf(board!)).toEqual([]);
  });
});

describe('what a stormed board puts in its legend', () => {
  it('lists the kinds actually stuck to it, and nothing else', () => {
    const sections = legendOf([
      ES_STICKY_ROLE.domainEvent,
      ES_STICKY_ROLE.command,
      ES_ROLE.flow,
    ]);
    expect(sections.map(s => s.title)).toEqual(['Stickies', 'Flow']);
    expect(sections.map(s => s.rows.map(r => r.label))).toEqual([
      ['Domain event', 'Command'],
      ['Flow'],
    ]);
  });

  it('drops the Flow section on a board with no arc drawn yet', () => {
    const sections = legendOf([ES_STICKY_ROLE.hotspot]);
    expect(sections.map(s => s.title)).toEqual(['Stickies']);
  });

  it('is empty on a board stormed before the roles existed', () => {
    expect(legendOf([])).toEqual([]);
  });
});
