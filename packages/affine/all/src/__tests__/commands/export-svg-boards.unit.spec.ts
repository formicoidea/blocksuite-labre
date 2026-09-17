import { exportSvgToolbarConfig } from '@labre/affine-block-surface';
import {
  BpmnPoolElementModel,
  C4BoardElementModel,
  C4BoundaryElementModel,
  ContextMapBoardElementModel,
  CoreDomainChartElementModel,
  CynefinElementModel,
  EdgyBoardElementModel,
  EdgyFacetsElementModel,
  EstuarineElementModel,
  EventStormingBoardElementModel,
  FrameworkBackgroundElementModel,
  UmlDiagramElementModel,
  UmlFragmentElementModel,
  UmlPartitionElementModel,
  UmlRegionElementModel,
  UmlSubjectElementModel,
  WardleyBackgroundElementModel,
} from '@labre/affine-model';
import type { ToolbarContext } from '@labre/affine-shared/services';
import { type FrameworkId, FRAMEWORK_IDS } from '@labre/std';
import { describe, expect, test } from 'vitest';

import { getCommands } from '../../commands.js';

/**
 * R34 of `docs/add-a-framework/02-framework-rules.md`, the unit half.
 *
 * The rule says every framework BOARD exports as SVG, and it is a rule a
 * framework satisfies by doing nothing: the export is one core command
 * (`export.svg`) and one wildcard toolbar module, both keyed on
 * `FrameworkBackgroundElementModel` and neither naming a framework. What can
 * still break it is a board that is NOT a `FrameworkBackgroundElementModel` —
 * a framework drawing its board as a shape, a frame or a group — and that is
 * exactly what this spec refuses.
 *
 * The browser half is `packages/integration-test/src/__tests__/edgeless/
 * board-svg-export.spec.ts`: it renders one board of every kind below and
 * parses what comes out. This one needs no editor, so it is the one that runs
 * on every commit.
 */

/**
 * Every framework's board class, declared — the same reason
 * `board-role.unit.spec.ts` declares `telemetry.element` rather than deriving
 * it: a framework names its board its own way (`pool`, `background`, `cynefin`)
 * and no prefix can be read off the command id.
 *
 * A framework with two boards lists two. A framework absent from this table
 * fails the first test below, which is the point — a new framework has to come
 * here and say which class its board is.
 */
const FRAMEWORK_BOARDS: Record<
  FrameworkId,
  readonly (abstract new (...args: never) => FrameworkBackgroundElementModel)[]
> = {
  wardley: [WardleyBackgroundElementModel],
  edgy: [EdgyBoardElementModel, EdgyFacetsElementModel],
  'cynefin-estuarine': [CynefinElementModel, EstuarineElementModel],
  bpmn: [BpmnPoolElementModel],
  c4: [C4BoardElementModel, C4BoundaryElementModel],
  'ddd-event-storming': [EventStormingBoardElementModel],
  'ddd-core-domain': [CoreDomainChartElementModel],
  'ddd-context-map': [ContextMapBoardElementModel],
  // One diagram frame and the four frames UML nests inside it: the use-case
  // subject, the activity partition, the state region and the combined
  // fragment. Each is a `FrameworkBackgroundElementModel`, so each exports.
  uml: [
    UmlDiagramElementModel,
    UmlSubjectElementModel,
    UmlPartitionElementModel,
    UmlRegionElementModel,
    UmlFragmentElementModel,
  ],
};

/** The sixteen board kinds, flattened — what the export has to cover. */
const ALL_BOARDS = Object.values(FRAMEWORK_BOARDS).flat();

const commands = getCommands();
const exportSvg = commands.find(command => command.id === 'export.svg');

/**
 * A `ToolbarContext` reduced to the one question the module asks it. The
 * instances are `Object.create(Model.prototype)` — a board's identity here is
 * its prototype chain and nothing else, and constructing a real element model
 * would need a surface, a Yjs document and a store.
 */
const stubContext = (models: readonly object[]) =>
  ({
    getSurfaceModelsByType: (klass: abstract new (...args: never) => unknown) =>
      models.filter(model => model instanceof klass),
  }) as unknown as ToolbarContext;

const boardInstance = (
  Model: abstract new (...args: never) => FrameworkBackgroundElementModel
) => Object.create(Model.prototype) as object;

describe('R34 — every framework board exports as SVG', () => {
  test('every framework declares at least one board class', () => {
    expect(Object.keys(FRAMEWORK_BOARDS).sort()).toEqual(
      [...FRAMEWORK_IDS].sort()
    );
    for (const id of FRAMEWORK_IDS) {
      expect(FRAMEWORK_BOARDS[id].length, id).toBeGreaterThan(0);
    }
  });

  test('every board class IS a framework background', () => {
    for (const Model of ALL_BOARDS) {
      expect(
        Model.prototype instanceof FrameworkBackgroundElementModel,
        Model.name
      ).toBe(true);
    }
  });

  /**
   * The board-PLACING commands and the table above name the same boards. It is
   * the drift this spec exists for: a framework that gains a second board
   * command without coming here would export only one of the two, and nothing
   * else in the repo would notice.
   */
  test('every framework with a board command has a board class', () => {
    for (const id of FRAMEWORK_IDS) {
      const placed = commands.filter(
        command => command.owner === id && command.telemetry?.board
      );
      expect(placed.length, `${id} places no board`).toBeGreaterThan(0);
      expect(FRAMEWORK_BOARDS[id].length, id).toBeGreaterThan(0);
    }
  });

  test('the "⋮" module offers the entry for every one of them', () => {
    for (const Model of ALL_BOARDS) {
      const ctx = stubContext([boardInstance(Model)]);
      expect(exportSvgToolbarConfig.when(ctx), Model.name).toBe(true);
    }
  });

  test('and offers nothing when no board is selected', () => {
    expect(exportSvgToolbarConfig.when(stubContext([]))).toBe(false);
    // A plain object is not a board however it is selected.
    expect(exportSvgToolbarConfig.when(stubContext([{}]))).toBe(false);
  });
});

describe('the export.svg descriptor', () => {
  test('is core-owned, selection-gated and named where a board is', () => {
    expect(exportSvg).toBeTruthy();
    expect(exportSvg!.owner).toBe('core');
    expect(exportSvg!.kind).toBe('action');
    expect(exportSvg!.availability).toBe('selection:framework');
    expect(exportSvg!.category).toBe('interchange');
    expect(exportSvg!.labelKey).toBe('com.labre.command.export.svg');
    expect(exportSvg!.labelFallback).toBe('Export SVG');
    expect(exportSvg!.descriptionFallback).toBeTruthy();
    expect(exportSvg!.defaultKeys).toEqual({ mac: [], other: [] });
  });

  test('declares the four surfaces and NOT the senior menu', () => {
    expect([...exportSvg!.surfaces].sort()).toEqual([
      'agent',
      'catalogue',
      'contextual-toolbar',
      'palette',
    ]);
    expect(exportSvg!.surfaces).not.toContain('senior-menu');
  });

  /**
   * `CommandTelemetry.framework` is typed on `FrameworkId` and this command can
   * name none — see its own comment. Pinned so the day a board → framework
   * lookup exists, the omission is reconsidered rather than inherited.
   */
  test('declares no telemetry, because it belongs to no framework', () => {
    expect(exportSvg!.telemetry).toBeUndefined();
  });
});
