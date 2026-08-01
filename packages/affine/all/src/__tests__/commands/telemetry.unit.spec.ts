import type { CommandDescriptor, CommandInvocation } from '@labre/std';
import { describe, expect, test } from 'vitest';

import { getCommands } from '../../commands.js';
import { reportCommandTelemetry } from '../../extensions/command-telemetry.js';

/**
 * PF3 moved emission from five hand-written `track()` helpers to the registry's
 * single `runCommand`. The contract is "same gesture, same wire values" — a
 * rename here silently breaks a live PostHog dashboard, so the expectations
 * below are copied from the pre-switchover menus, not from the new code.
 */
const byId = new Map(getCommands().map(c => [c.id, c]));

function emit(id: string, invocation: CommandInvocation) {
  const events: { event: string; payload: Record<string, unknown> }[] = [];
  const command = byId.get(id) as CommandDescriptor;
  expect(command, `unknown command ${id}`).toBeTruthy();
  reportCommandTelemetry(
    (event, payload) => events.push({ event, payload }),
    command,
    invocation
  );
  return events;
}

const fromMenu: CommandInvocation = {
  surface: 'senior-menu',
  source: 'toolbar:general',
};
const fromShortcut: CommandInvocation = {
  surface: 'shortcut',
  source: 'shortcut',
};

describe('one emission per invocation, with the historical values', () => {
  test('exactly one event per invocation', () => {
    expect(emit('wardley.addComponent', fromMenu)).toHaveLength(1);
  });

  test('wardley menu — unchanged from `actions.ts` TOOLBOX_SOURCE', () => {
    expect(emit('wardley.addComponent', fromMenu)[0]).toEqual({
      event: 'FrameworkElementAdded',
      payload: {
        framework: 'wardley',
        element: 'node:component',
        page: 'whiteboard editor',
        segment: 'wardley toolbox',
        module: 'wardley menu',
        control: 'toolbar:general',
      },
    });
  });

  test('wardley chord — unchanged from WARDLEY_SHORTCUT_SOURCE', () => {
    const { payload } = emit('wardley.addComponent', fromShortcut)[0];
    expect(payload.segment).toBe('wardley toolbox');
    expect(payload.module).toBe('keyboard shortcut');
  });

  test('arming a tool still reports FrameworkToolPicked', () => {
    expect(emit('wardley.linkTool', fromMenu)[0].event).toBe(
      'FrameworkToolPicked'
    );
    expect(emit('bpmn.sequenceFlowTool', fromMenu)[0].event).toBe(
      'FrameworkToolPicked'
    );
  });

  test.each([
    ['edgy.addFacets', 'edgy', 'edgy toolbox', 'edgy menu', 'facets'],
    ['bpmn.addPool', 'bpmn', 'bpmn toolbox', 'bpmn menu', 'pool'],
    [
      'ddd-event-storming.addDomainEvent',
      'event-storming',
      'ddd toolbox',
      'event-storming menu',
      'sticky:domainEvent',
    ],
    [
      'ddd-core-domain.addChart',
      'core-domain',
      'ddd toolbox',
      'core-domain menu',
      'background',
    ],
    [
      'ddd-context-map.addCloud',
      'context-map',
      'ddd toolbox',
      'context-map menu',
      'cloud',
    ],
  ])('%s keeps its wire values', (id, framework, segment, module, element) => {
    expect(emit(id, fromMenu)[0].payload).toMatchObject({
      framework,
      segment,
      module,
      element,
    });
  });

  /**
   * The Context Map legend has always reported `FrameworkElementAdded` with
   * element `'legend'`. Promoting it to `kind: 'legend'` would move it to
   * `FrameworkLegendCreated` — a telemetry change, not a refactor, so it does
   * not happen here.
   */
  test('the context-map legend keeps reporting FrameworkElementAdded', () => {
    const [{ event, payload }] = emit('ddd-context-map.addLegend', fromMenu);
    expect(event).toBe('FrameworkElementAdded');
    expect(payload.element).toBe('legend');
  });

  /** ADR 0008: cynefin-estuarine emitted nothing at all before PF3. */
  test('cynefin-estuarine finally emits, under its historical key', () => {
    const [{ payload }] = emit('cynefin-estuarine.addCynefin', fromMenu);
    expect(payload.framework).toBe('cynefin');
    expect(payload.module).toBe('cynefin menu');
  });

  test('core commands still emit nothing', () => {
    expect(emit('undo', fromShortcut)).toEqual([]);
    expect(emit('duplicate', fromShortcut)).toEqual([]);
    expect(emit('shape.cycleTextFit', fromShortcut)).toEqual([]);
  });
});
