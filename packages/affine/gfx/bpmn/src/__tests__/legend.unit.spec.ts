import { recordAction } from '@labre/affine-block-surface';
import type { BpmnNodeKind } from '@labre/affine-model';
import { PointStyle, StrokeStyle } from '@labre/affine-model';
import { TelemetryProvider } from '@labre/affine-shared/services';
import type {
  AnyCommandDescriptor,
  BlockStdScope,
  CommandLegendEntry,
} from '@labre/std';
import { describe, expect, it, vi } from 'vitest';

import { bpmnCommands } from '../commands';
import { BPMN_EDGE_STYLE, NODE_SIZE } from '../consts';
import { bpmnNodeProps } from '../presets';
import { BPMN_ROLE, BPMN_ROLE_OF_KIND } from '../roles';
import { bpmnPoolToolingToolbarConfig } from '../toolbar/config';

/**
 * The pool's legend, as a SUBSCRIPTION — every assertion below is about the
 * rows the commands declare, never about a table somebody wrote beside them.
 *
 * What the engine then does with the rows (scan the pool, resolve the labels
 * through the role vocabulary, drop the empty sections, place the box) belongs
 * to `blocks/surface` and is proved where it can be: in the browser, against a
 * real pool, in `integration-test/src/__tests__/edgeless/bpmn.spec.ts`.
 */

const KINDS = Object.keys(NODE_SIZE) as BpmnNodeKind[];

const entryOf = (
  command: AnyCommandDescriptor
): CommandLegendEntry | undefined =>
  command.legend as CommandLegendEntry | undefined;

const subscribed = bpmnCommands.filter(command => command.legend !== undefined);

/** What a sub-menu click carries; the commands here ignore it. */
const INVOCATION = {
  surface: 'senior-menu',
  source: 'toolbar:general',
} as const;

const rowFor = (id: string): CommandLegendEntry => {
  const entry = entryOf(bpmnCommands.find(c => c.id === id)!);
  expect(entry, id).toBeDefined();
  return entry!;
};

describe('the pool subscribes its notation instead of tabulating it', () => {
  it('gives every artefact and every tool exactly one row, and the pool none', () => {
    // The seventeen node kinds plus the three connecting objects. NOT the pool:
    // it is the sheet the legend is drawn on, and listing it would be listing
    // the paper.
    expect(subscribed.map(command => command.id)).toEqual(
      bpmnCommands
        .filter(
          command =>
            (command.kind === 'artefact' || command.kind === 'tool') &&
            command.telemetry?.board !== true
        )
        .map(command => command.id)
    );
    expect(subscribed).toHaveLength(KINDS.length + 3);
    expect(
      subscribed.filter(c => entryOf(c)!.row.swatch === 'glyph')
    ).toHaveLength(KINDS.length);
    expect(
      subscribed.filter(c => entryOf(c)!.row.swatch === 'edge')
    ).toHaveLength(3);
    expect(
      bpmnCommands.find(c => c.id === 'bpmn.addPool')?.legend
    ).toBeUndefined();
  });

  it('names the role its own command stamps', () => {
    for (const command of subscribed) {
      const entry = entryOf(command)!;
      // The recording fake runs the body and hands back what it asked the
      // surface for — which is where the role is written, since no static field
      // carries one.
      const recorded = recordAction(std => command.run(std, INVOCATION));
      const stamped = new Set(
        recorded.records
          .map(record => record['role'])
          .concat(recorded.armedToolOptions?.['role'])
          .filter((role): role is string => typeof role === 'string')
      );
      expect([...stamped], command.id).toEqual([entry.role]);
    }
  });

  it('asks for an EXACT match on the three roles that have children, and no others', () => {
    expect(
      subscribed
        .filter(c => entryOf(c)!.exact)
        .map(c => entryOf(c)!.role)
        .sort()
    ).toEqual(
      [BPMN_ROLE.startEvent, BPMN_ROLE.endEvent, BPMN_ROLE.task].sort()
    );
  });

  it('files its rows under the catalogue’s own category headers', () => {
    // No `section` on any row: the platform then heads each group with
    // `com.labre.catalogue.category.<category>` — the very key the artefact
    // panel already puts above the same commands. Zero new i18n keys, and zero
    // new exceptions in the manifest's one-word-one-key check.
    for (const command of subscribed) {
      expect(entryOf(command)!.section, command.id).toBeUndefined();
      expect(entryOf(command)!.labelWording, command.id).toBeUndefined();
      expect(command.category, command.id).toBeDefined();
    }
  });
});

describe('a glyph row is the creation preset, minus three keys', () => {
  it.each(KINDS)('%s draws what the gesture draws', kind => {
    const command = bpmnCommands.find(
      c => c.telemetry?.element === `node:${kind}`
    )!;
    const entry = entryOf(command)!;
    expect(entry.role).toBe(BPMN_ROLE_OF_KIND[kind]);

    const {
      role: _role,
      xywh: _xywh,
      text: _text,
      radius,
      ...expected
    } = bpmnNodeProps(kind, { xywh: '[0,0,0,0]' });
    const { radius: drawn, ...props } = entry.row.props!;

    expect(props).toEqual(expected);
    // `radius` is the ONE prop scaled to the swatch: it is absolute and
    // unbounded, so the group's 20 and the task's 10 would round a 44 × 30 box
    // into a pill.
    expect(drawn).toBe(
      Math.round((Number(radius) || 0) * (30 / NODE_SIZE[kind].h))
    );
    // …and `strokeWidth` is the one that must NOT be scaled: the thin ring
    // against the thick one is the notation itself.
    expect(props['strokeWidth']).toBe(
      bpmnNodeProps(kind, { xywh: '[0,0,0,0]' })['strokeWidth']
    );
    expect(entry.row.aspect).toBeCloseTo(
      NODE_SIZE[kind].w / NODE_SIZE[kind].h,
      6
    );
  });

  it('never carries a role, a box or a caption', () => {
    for (const command of subscribed) {
      const props = entryOf(command)!.row.props ?? {};
      expect(props, command.id).not.toHaveProperty('role');
      expect(props, command.id).not.toHaveProperty('xywh');
      expect(props, command.id).not.toHaveProperty('text');
    }
  });
});

describe('an edge row is the line the tool arms', () => {
  const TOOLS = [
    ['bpmn.sequenceFlowTool', 'sequenceFlow', BPMN_ROLE.sequenceFlow],
    ['bpmn.messageFlowTool', 'messageFlow', BPMN_ROLE.messageFlow],
    ['bpmn.associationTool', 'association', BPMN_ROLE.association],
  ] as const;

  it.each(TOOLS)('%s pictures what it arms', (id, key, role) => {
    const entry = rowFor(id);
    expect(entry.role).toBe(role);
    expect(entry.row.props).toEqual({ ...BPMN_EDGE_STYLE[key] });

    // The TOOL's own options, read back off the recording fake: the row and the
    // gesture are the same five props, not two copies that agree today.
    const armed = recordAction(std => {
      const command = bpmnCommands.find(c => c.id === id)!;
      command.run(std, INVOCATION);
    });
    expect(armed.armedTool).toBe('connector');
    expect(armed.armedToolOptions?.['style']).toEqual(entry.row.props);
    // …and `mode` stays OUT of the row: an orthogonal route is a property of
    // the drawing gesture, not of the line.
    expect(entry.row.props).not.toHaveProperty('mode');
    expect(armed.armedToolOptions).toHaveProperty('mode');
  });

  it('derives `dashed` rather than restating it', () => {
    expect(rowFor('bpmn.sequenceFlowTool').row.dashed).toBe(false);
    expect(rowFor('bpmn.messageFlowTool').row.dashed).toBe(true);
    expect(rowFor('bpmn.associationTool').row.dashed).toBe(true);
    // The endpoints are what actually tell the three apart — they are drawn by
    // the connector renderer at swatch size rather than approximated by a bar.
    expect(BPMN_EDGE_STYLE.sequenceFlow.rearEndpointStyle).toBe(
      PointStyle.Triangle
    );
    expect(BPMN_EDGE_STYLE.messageFlow.frontEndpointStyle).toBe(
      PointStyle.Circle
    );
    expect(BPMN_EDGE_STYLE.association.strokeStyle).toBe(StrokeStyle.Dash);
  });
});

describe('the box, and the button that fills it', () => {
  it('is declared once, on the command that puts the pool down', () => {
    const withBox = bpmnCommands.filter(command => command.legendBox);
    expect(withBox.map(command => command.id)).toEqual(['bpmn.addPool']);
    expect(withBox[0].legendBox).toEqual({
      width: 300,
      rowHeight: 36,
      swatchWidth: 44,
      swatchHeight: 30,
    });
  });

  it('sits after the lane gestures and before Validation', () => {
    const ids = bpmnPoolToolingToolbarConfig.actions.map(action => action.id);
    expect(ids).toContain('c.legend');
    // The row sorts lexicographically by id: `b.legend` would wedge the button
    // between `b.add-lane` and `b.remove-lane`.
    expect('b.remove-lane' < 'c.legend').toBe(true);
    expect('c.legend' < 'z.validation').toBe(true);
    // Merged with the generic dropdown, because a flavour carries exactly one
    // toolbar module.
    expect(ids).toContain('z.validation');
  });

  it('emits the one FrameworkLegendCreated payload', () => {
    const track = vi.fn();
    const std = {
      // Nothing is drawn: the engine returns early without a surface, which is
      // what leaves this test about the WIRE VALUES and nothing else.
      get: () => ({ surface: null }),
      getOptional: (identifier: unknown) =>
        identifier === (TelemetryProvider as unknown) ? { track } : undefined,
      store: { readonly: false },
    } as unknown as BlockStdScope;
    const ctx = {
      std,
      getSurfaceModelsByType: () => [{ xywh: '[0,0,600,400]' }],
    } as never;

    const legend = bpmnPoolToolingToolbarConfig.actions.find(
      action => action.id === 'c.legend'
    ) as { run?: (ctx: never) => void } | undefined;
    expect(legend, 'the c.legend action').toBeDefined();
    legend!.run?.(ctx);

    expect(track).toHaveBeenCalledTimes(1);
    expect(track).toHaveBeenCalledWith('FrameworkLegendCreated', {
      framework: 'bpmn',
      element: 'legend',
      page: 'whiteboard editor',
      segment: 'element toolbar',
      module: 'bpmn toolbar',
    });
  });
});
