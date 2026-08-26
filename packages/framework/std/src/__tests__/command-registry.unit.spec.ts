import { describe, expect, test } from 'vitest';

import {
  CommandTelemetryIdentifier,
  CommandUsageIdentifier,
  runCommand,
  type AnyCommandDescriptor,
  type CommandInvocation,
  type CommandUsageStore,
} from '../extension/command-registry.js';
import type { BlockStdScope } from '../scope/std-scope.js';

const invocation: CommandInvocation = {
  surface: 'senior-menu',
  source: 'toolbar:general',
};

const command = (
  id: string,
  extra: Partial<AnyCommandDescriptor> = {}
): AnyCommandDescriptor => ({
  id,
  owner: 'core',
  kind: 'action',
  labelKey: `label.${id}`,
  surfaces: ['senior-menu'],
  scope: 'global',
  defaultKeys: { mac: [], other: [] },
  run: () => {},
  ...extra,
});

/** A `std` that answers both sinks and nothing else. */
function stubStd() {
  const recorded: { id: string; invocation: CommandInvocation }[] = [];
  const emitted: string[] = [];
  const usage: CommandUsageStore = {
    record: (cmd, inv) => recorded.push({ id: cmd.id, invocation: inv }),
    statsOf: () => undefined,
  };
  const std = {
    getOptional: (identifier: unknown) => {
      if (identifier === CommandUsageIdentifier) return usage;
      if (identifier === CommandTelemetryIdentifier) {
        return ({ command: cmd }: { command: AnyCommandDescriptor }) =>
          emitted.push(cmd.id);
      }
      return undefined;
    },
  } as unknown as BlockStdScope;
  return { std, recorded, emitted };
}

describe('runCommand feeds the usage store', () => {
  test('a run is recorded with the command and its invocation', () => {
    const { std, recorded } = stubStd();
    runCommand(std, command('wardley.addComponent'), invocation);
    expect(recorded).toEqual([{ id: 'wardley.addComponent', invocation }]);
  });

  /**
   * THE reason the call sits before the telemetry gate. PF6 ranks a
   * framework's whole sub-menu, and most of what it ranks — core actions,
   * toggles, the self-emitting commands of ADR 0008's resolved question 5 —
   * declares no `telemetry` at all. A measure that only covered instrumented
   * commands would silently rank half a menu.
   */
  test('a command with no telemetry metadata is still recorded', () => {
    const { std, recorded, emitted } = stubStd();
    runCommand(std, command('undo'), invocation);
    expect(recorded.map(r => r.id)).toEqual(['undo']);
    expect(emitted).toEqual([]);
  });

  test('an instrumented command is both recorded and emitted, once each', () => {
    const { std, recorded, emitted } = stubStd();
    runCommand(
      std,
      command('bpmn.addPool', {
        telemetry: { framework: 'bpmn', element: 'pool' },
      }),
      invocation
    );
    expect(recorded.map(r => r.id)).toEqual(['bpmn.addPool']);
    expect(emitted).toEqual(['bpmn.addPool']);
  });

  test('every run counts — the store sees the same command twice', () => {
    const { std, recorded } = stubStd();
    const undo = command('undo');
    runCommand(std, undo, invocation);
    runCommand(std, undo, { surface: 'shortcut', source: 'shortcut' });
    expect(recorded.map(r => r.invocation.surface)).toEqual([
      'senior-menu',
      'shortcut',
    ]);
  });

  test('no registered store is not an error', () => {
    const std = { getOptional: () => undefined } as unknown as BlockStdScope;
    expect(() => runCommand(std, command('undo'), invocation)).not.toThrow();
  });
});
