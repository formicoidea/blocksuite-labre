import { TelemetryProvider } from '@labre/affine-shared/services';
import {
  CommandTelemetryIdentifier,
  runCommand,
  type BlockStdScope,
  type CommandDescriptor,
  type CommandInvocation,
} from '@labre/std';
import { GfxControllerIdentifier } from '@labre/std/gfx';
import { describe, expect, test } from 'vitest';

import { getCommands } from '../../commands.js';
import { commandTelemetryReporter } from '../../extensions/command-telemetry.js';

/**
 * PF3 moved emission from five hand-written `track()` helpers to the registry's
 * single `runCommand`. The contract is "same gesture, same wire values" — a
 * rename here silently breaks a live PostHog dashboard, so the expectations
 * below are copied from the pre-switchover menus, not from the new code.
 *
 * Everything runs through `runCommand` and the REAL reporter, on a stub `std`.
 * That is what makes "exactly one event per invocation" mean something: the
 * command body actually executes, and the stub also answers `TelemetryProvider`
 * — the identifier a leftover per-menu `track()` would reach for — so a second
 * emitter shows up as a second event instead of passing unnoticed.
 */
const byId = new Map(getCommands().map(c => [c.id, c]));

interface Captured {
  event: string;
  payload: Record<string, unknown>;
}

/**
 * The smallest `std` a command body can run against. Creation actions bail on
 * `!gfx.surface` — this test is about the emission, not the geometry — and the
 * two connector tools, which do not bail, only need `EditPropsStore
 * .recordLastProps` and `gfx.tool.setTool`.
 */
function stubStd(events: Captured[]) {
  const telemetry = {
    track: (event: string, payload: Record<string, unknown>) =>
      events.push({ event, payload }),
  };
  const services = {
    recordLastProps: () => {},
    lastUsedStyle$: { value: {} },
    updateElement: () => {},
  };
  const std = {
    store: { canUndo: false, canRedo: false, readonly: false, root: undefined },
    selection: { filter: () => [] },
    view: { getBlock: () => null },
    get: (identifier: unknown) =>
      identifier === GfxControllerIdentifier ? gfx : services,
    getOptional: (identifier: unknown) => {
      if (identifier === CommandTelemetryIdentifier) {
        return commandTelemetryReporter;
      }
      if (identifier === TelemetryProvider) return telemetry;
      return undefined;
    },
  } as unknown as BlockStdScope;

  const gfx = {
    surface: undefined,
    std,
    tool: { setTool: () => {} },
    selection: { selectedElements: [], editing: false, set: () => {} },
    viewport: { centerX: 0, centerY: 0, zoom: 1 },
    doc: { captureSync: () => {} },
  };
  return std;
}

function emit(id: string, invocation: CommandInvocation): Captured[] {
  const command = byId.get(id) as CommandDescriptor;
  expect(command, `unknown command ${id}`).toBeTruthy();
  const events: Captured[] = [];
  runCommand(stubStd(events), command, invocation);
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
  test('the bottleneck emits exactly once — no surface adds its own', () => {
    // Reads 2 if any action body still calls `track()` itself.
    for (const id of [
      'wardley.addComponent',
      'wardley.linkTool',
      'bpmn.addPool',
      'bpmn.sequenceFlowTool',
      'edgy.addFacets',
      'cynefin-estuarine.addCynefin',
      'ddd-context-map.addCloud',
      'ddd-event-storming.addFlow',
    ]) {
      expect(emit(id, fromMenu), id).toHaveLength(1);
    }
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

  /**
   * The four Wardley backgrounds are the highest-risk `element` values in the
   * conversion: they are the only ones carrying a variant suffix, and three of
   * the four variant names differ from the command ids now wrapping them
   * (`addEvolutionBackground` → `background:evolution-gradient`).
   */
  test.each([
    ['wardley.addBackground', 'background:classic'],
    ['wardley.addOpportunityBackground', 'background:opportunity'],
    ['wardley.addBenefitBackground', 'background:benefit'],
    ['wardley.addEvolutionBackground', 'background:evolution-gradient'],
  ])('%s still reports element %s', (id, element) => {
    expect(emit(id, fromMenu)[0].payload.element).toBe(element);
  });

  test('the other wardley artefacts keep their element values', () => {
    const elements = Object.fromEntries(
      [
        'wardley.addMethod',
        'wardley.addMarket',
        'wardley.addEcosystem',
        'wardley.addAnchor',
        'wardley.addPipeline',
        'wardley.addInertia',
        'wardley.linkTool',
        'wardley.evolutionArrow',
      ].map(id => [id, emit(id, fromMenu)[0].payload.element])
    );
    expect(elements).toEqual({
      'wardley.addMethod': 'node:method',
      'wardley.addMarket': 'node:market',
      'wardley.addEcosystem': 'node:ecosystem',
      'wardley.addAnchor': 'node:anchor',
      'wardley.addPipeline': 'node:pipeline',
      'wardley.addInertia': 'node:inertia',
      'wardley.linkTool': 'connector:link',
      'wardley.evolutionArrow': 'connector:arrow',
    });
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

/**
 * Guard the stub itself. If `std` were inert enough that no command body ran,
 * every "exactly once" assertion above would be vacuously true.
 */
describe('the stub really executes the command body', () => {
  test('arming the wardley link tool reaches EditPropsStore and the tool controller', () => {
    const recorded: unknown[] = [];
    const tools: unknown[] = [];
    const std = {
      get: (identifier: unknown) =>
        identifier === GfxControllerIdentifier
          ? gfx
          : { recordLastProps: (...args: unknown[]) => recorded.push(args) },
      getOptional: () => undefined,
    } as unknown as BlockStdScope;
    const gfx = {
      surface: undefined,
      std,
      tool: { setTool: (...args: unknown[]) => tools.push(args) },
    };

    runCommand(std, byId.get('wardley.linkTool')!, fromMenu);
    expect(recorded).toHaveLength(1);
    expect(tools).toHaveLength(1);
  });
});
