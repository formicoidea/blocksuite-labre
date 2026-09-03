import type { CommandInvocation } from '@labre/std';
import { describe, expect, test } from 'vitest';

import { getCommands } from '../../commands.js';
import { reportCommandTelemetry } from '../../extensions/command-telemetry.js';
import { FRAMEWORK_DESCRIPTORS } from '../../frameworks.js';

/**
 * "Boards created per framework" is a product ratio, not a naming convention:
 * every framework spells its board differently in `element`, so the only thing
 * analytics can rely on is the declaration. Spelled out so a framework losing
 * (or renaming) its board command shows up in review, not in a dashboard that
 * silently reads zero.
 */
const commands = getCommands();

describe('board role', () => {
  test('every framework declares the command that places its board', () => {
    const boards = Object.fromEntries(
      FRAMEWORK_DESCRIPTORS.map(f => [
        f.id,
        commands
          .filter(c => c.owner === f.id && c.telemetry?.board)
          .map(c => c.telemetry?.element)
          .sort(),
      ])
    );
    expect(boards).toEqual({
      wardley: [
        'background:benefit',
        'background:classic',
        'background:evolution-gradient',
        'background:opportunity',
      ],
      edgy: ['board'],
      'cynefin-estuarine': ['cynefin', 'estuarine'],
      bpmn: ['pool'],
      'ddd-event-storming': ['board'],
      c4: ['board'],
      'ddd-core-domain': ['background'],
      'ddd-context-map': ['board'],
    });
  });

  test('the reporter forwards role on a board and nothing on an element', () => {
    const invocation: CommandInvocation = {
      surface: 'senior-menu',
      source: 'toolbar:general',
    };
    const payloads: Record<string, unknown>[] = [];
    const track = (_event: string, payload: Record<string, unknown>) =>
      payloads.push(payload);

    const board = commands.find(c => c.id === 'wardley.addBackground');
    const node = commands.find(c => c.id === 'wardley.addComponent');
    if (!board || !node) throw new Error('wardley toolbox is missing');

    reportCommandTelemetry(track, board, invocation);
    reportCommandTelemetry(track, node, invocation);

    expect(payloads[0]).toMatchObject({
      framework: 'wardley',
      element: 'background:classic',
      role: 'board',
    });
    expect(payloads[1]).toMatchObject({
      framework: 'wardley',
      element: 'node:component',
    });
    expect(payloads[1]).not.toHaveProperty('role');
  });
});
