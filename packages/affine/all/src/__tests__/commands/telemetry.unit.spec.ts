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

/** What the connector trap throws, and the only failure the sweep rethrows. */
const CONNECTOR_LEAK =
  'a framework activation must never record the connector last props (#144 M1)';

interface Captured {
  event: string;
  payload: Record<string, unknown>;
}

/**
 * The smallest `std` a command body can run against. Creation actions bail on
 * `!gfx.surface` — this test is about the emission, not the geometry — and the
 * connector tools, which do not bail, only need `gfx.tool.setTool`.
 */
function stubStd(
  events: Captured[],
  onSetTool?: (tool: { toolName?: string } | undefined) => void
) {
  const telemetry = {
    track: (event: string, payload: Record<string, unknown>) =>
      events.push({ event, payload }),
  };
  const services = {
    // KEY-SCOPED trap, not a no-op recorder: a framework activation that
    // recorded the connector's last props would dress the next PLAIN connector
    // in its own costume (#144 M1). `shape` and `mindmap` recorders are the
    // ordinary creation path and stay welcome.
    //
    // The trap only bites what actually runs, which is why the registry-wide
    // sweep below exists: the hand-picked lists in this file reach eight
    // commands, and the invariant is about all of them.
    recordLastProps: (key: string) => {
      if (key === 'connector') {
        throw new Error(CONNECTOR_LEAK);
      }
    },
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
    tool: {
      setTool: (tool?: { toolName?: string }) => onSetTool?.(tool),
    },
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
  test('the context-map legend left the palette, and its command with it', () => {
    // PO recette (27/08/2026): the ONE legend is the board's contextual
    // auto-legend (`FrameworkLegendCreated`). The palette entry that used to
    // emit `FrameworkElementAdded`/`legend` is deliberately gone — this pins
    // the removal so a re-added duplicate has to explain itself here.
    expect(
      getCommands().find(c => c.id === 'ddd-context-map.addLegend')
    ).toBeUndefined();
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
  test('arming the wardley link tool reaches the tool controller', () => {
    const tools: [unknown, Record<string, unknown>][] = [];
    const std = {
      get: (identifier: unknown) =>
        identifier === GfxControllerIdentifier ? gfx : undefined,
      getOptional: () => undefined,
    } as unknown as BlockStdScope;
    const gfx = {
      surface: undefined,
      std,
      tool: {
        setTool: (...args: [unknown, Record<string, unknown>]) =>
          tools.push(args),
      },
    };

    runCommand(std, byId.get('wardley.linkTool')!, fromMenu);
    expect(tools).toHaveLength(1);
    // The activation carries the link's role AND its full look — the style
    // rides on the tool options, never through EditPropsStore (#144 M1).
    expect(tools[0][1].role).toBe('wardley:dependency');
    expect(tools[0][1].style).toMatchObject({ strokeStyle: 'solid' });
  });
});

/**
 * Review #144 M1, swept across the WHOLE registry.
 *
 * Nine commands arm the native connector tool for a typed edge, and every one
 * of them must dress its own edges through `ConnectorToolOptions.style` rather
 * than through the shared `EditPropsStore` — a framework look written to the
 * store comes back out on the next PLAIN connector, which BPMN 2.0 p.40
 * forbids. Six of the nine were fixed under review #144; three more (C4's
 * relationship, BPMN's message flow and its association) arrived afterwards
 * and reproduced the bug verbatim. That is the whole reason this is a sweep
 * and not another hand-written list: the tenth framework will be written by
 * someone who never read the review.
 *
 * `stubStd`'s recorder is the trap; here it simply runs against everything.
 */
describe('no framework activation records the connector last props', () => {
  test('every command in the registry, not a hand-picked few', () => {
    const armedConnector = new Set<string>();

    for (const command of getCommands()) {
      const std = stubStd([], tool => {
        if (tool?.toolName === 'connector') armedConnector.add(command.id);
      });
      try {
        runCommand(std, command, fromMenu);
      } catch (error) {
        // The leak is the ONLY failure this sweep is about. Anything else is a
        // command asking the deliberately minimal stub for something it does
        // not carry — an export wanting a notifier, an import wanting a file
        // picker — and belongs to that command's own spec, not to this one.
        if (error instanceof Error && error.message === CONNECTOR_LEAK) {
          throw new Error(`${command.id}: ${error.message}`);
        }
      }
    }

    // A sweep that reached no connector activation would pass while proving
    // nothing, so it has to say how many it saw. Nine today, and the floor only
    // ever moves up: frameworks get added, not removed.
    expect(armedConnector.size).toBeGreaterThanOrEqual(9);
  });
});
