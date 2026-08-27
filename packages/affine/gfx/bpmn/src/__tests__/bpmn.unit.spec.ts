import {
  type BpmnNodeKind,
  ConnectorMode,
  PointStyle,
  StrokeStyle,
  TextAlign,
  TextVerticalAlign,
} from '@labre/affine-model';
import type { BlockStdScope, CommandDescriptor } from '@labre/std';
import { GfxControllerIdentifier } from '@labre/std/gfx';
import { describe, expect, it } from 'vitest';

import { NODE_PRESETS } from '../actions';
import { bpmnCommands } from '../commands';
import {
  ASSOCIATION_STROKE,
  ASSOCIATION_WIDTH,
  CALL_ACTIVITY_WIDTH,
  EVENT_END,
  EVENT_START,
  END_WIDTH,
  GROUP_RADIUS,
  GROUP_STROKE,
  MESSAGE_STROKE,
  MESSAGE_WIDTH,
  NEUTRAL_STROKE,
  NODE_LABEL,
  NODE_SIZE,
  START_WIDTH,
  TASK_RADIUS,
} from '../consts';
import { BPMN_ROLE, BPMN_ROLE_OF_KIND } from '../roles';
import { bpmnTemplateCategory } from '../templates';

/**
 * Run a connector-tool command against a stub editor and report what it armed:
 * the props it recorded as the connector's next defaults, and the options it
 * handed the tool.
 *
 * Two records rather than one, because they answer different questions: the
 * props are what the NEXT connector is drawn with, and the tool options are
 * what the connector is born CARRYING — which for a typed edge is the role, and
 * a role acquired after the fact is not the same document.
 */
function armed(command: CommandDescriptor) {
  let props: Record<string, unknown> = {};
  let tool: Record<string, unknown> = {};

  const editProps = {
    recordLastProps: (key: string, next: Record<string, unknown>) => {
      expect(key).toBe('connector');
      props = next;
    },
  };
  const gfx = {
    tool: {
      setTool: (_tool: unknown, options: Record<string, unknown>) => {
        tool = options;
      },
    },
  };
  const std = {
    get: (identifier: unknown) =>
      identifier === GfxControllerIdentifier ? gfx : editProps,
  } as unknown as BlockStdScope;

  // Through `run`, not through the action: what a user reaches is the command,
  // and a spec that called the function directly would keep passing after
  // someone rewired the descriptor to a different one.
  command.run(std, { surface: 'senior-menu', source: 'toolbar:general' });
  return { props, tool };
}

// The pool renderer has its own file: `pool-background.unit.spec.ts`, where the
// declaration it is now built from is checked operation by operation against
// what the hand-written renderer used to draw.

/** Every kind the model declares — the descriptive conformance subclass. */
const KINDS = [
  'startEvent',
  'startEventMessage',
  'startEventTimer',
  'endEvent',
  'endEventMessage',
  'endEventTerminate',
  'task',
  'taskUser',
  'taskService',
  'subProcess',
  'callActivity',
  'gatewayExclusive',
  'gatewayParallel',
  'dataObject',
  'dataStore',
  'textAnnotation',
  'group',
] as const satisfies readonly BpmnNodeKind[];

const EVENTS = KINDS.filter(
  k => k.startsWith('startEvent') || k.startsWith('endEvent')
);
const ACTIVITIES = [
  'task',
  'taskUser',
  'taskService',
  'subProcess',
  'callActivity',
] as const;

describe('bpmn style-C constants', () => {
  it('defines a size, a label and a preset for every node kind', () => {
    // The three tables are TOTAL over the union, and this is what proves it at
    // runtime as well as at compile time: a kind added to the model and
    // forgotten in one of them would paint at zero size or with no shape.
    expect(KINDS).toHaveLength(17);
    for (const kind of KINDS) {
      expect(NODE_SIZE[kind].w, kind).toBeGreaterThan(0);
      expect(NODE_SIZE[kind].h, kind).toBeGreaterThan(0);
      expect(typeof NODE_LABEL[kind], kind).toBe('string');
      expect(NODE_PRESETS[kind], kind).toBeDefined();
      expect(NODE_PRESETS[kind].width, kind).toBeGreaterThan(0);
    }
    expect(Object.keys(NODE_SIZE).sort()).toEqual([...KINDS].sort());
    expect(Object.keys(NODE_LABEL).sort()).toEqual([...KINDS].sort());
    expect(Object.keys(NODE_PRESETS).sort()).toEqual([...KINDS].sort());
  });

  it('gives every event the same ring, every activity the same rectangle, every gateway the same diamond', () => {
    // A family is a family on the canvas too: what distinguishes a message
    // start from a plain one is the GLYPH, never a size or a silhouette.
    for (const kind of EVENTS) {
      expect(NODE_PRESETS[kind].shapeType, kind).toBe('ellipse');
      expect(NODE_SIZE[kind], kind).toEqual(NODE_SIZE.startEvent);
    }
    for (const kind of ACTIVITIES) {
      expect(NODE_PRESETS[kind].shapeType, kind).toBe('rect');
      expect(NODE_PRESETS[kind].radius, kind).toBe(TASK_RADIUS);
      expect(NODE_SIZE[kind], kind).toEqual(NODE_SIZE.task);
    }
    expect(NODE_PRESETS.gatewayExclusive.shapeType).toBe('diamond');
    expect(NODE_PRESETS.gatewayParallel.shapeType).toBe('diamond');
    expect(NODE_SIZE.gatewayParallel).toEqual(NODE_SIZE.gatewayExclusive);
  });

  it('carries the start ring on both starts and the end ring on both ends', () => {
    for (const kind of ['startEventMessage', 'startEventTimer'] as const) {
      expect(NODE_PRESETS[kind].stroke, kind).toBe(EVENT_START);
      expect(NODE_PRESETS[kind].width, kind).toBe(START_WIDTH);
    }
    for (const kind of ['endEventMessage', 'endEventTerminate'] as const) {
      expect(NODE_PRESETS[kind].stroke, kind).toBe(EVENT_END);
      expect(NODE_PRESETS[kind].width, kind).toBe(END_WIDTH);
    }
  });

  it('tells the call activity from the sub-process by its border alone', () => {
    // The two carry the SAME `+` marker; the thick border is the whole of the
    // distinction, so it has to be heavier than a plain activity's.
    expect(NODE_PRESETS.callActivity.width).toBe(CALL_ACTIVITY_WIDTH);
    expect(CALL_ACTIVITY_WIDTH).toBeGreaterThan(NODE_PRESETS.subProcess.width);
    expect(NODE_PRESETS.callActivity.shapeType).toBe(
      NODE_PRESETS.subProcess.shapeType
    );
  });

  /**
   * The group is the cheapest artefact in the profile: a dashed, rounded,
   * unfilled rectangle is entirely expressible as a native shape's own
   * properties, so it costs no glyph code at all.
   *
   * `filled: false` is the load-bearing one and not a matter of taste. An
   * unfilled shape is hit near its border and on its label only, which is what
   * makes a 300x200 lasso safe to draw over the work: it never steals a click
   * from what it encloses. A filled group would swallow the whole process.
   */
  it('draws the group as a dashed hollow rectangle, with no glyph', () => {
    const group = NODE_PRESETS.group;
    expect(group.shapeType).toBe('rect');
    expect(group.strokeStyle).toBe(StrokeStyle.Dash);
    expect(group.hollow).toBe(true);
    expect(group.glyphBody).toBeUndefined();
    // A wide corner: 10 units on a 300-unit box reads as a square one.
    expect(group.radius).toBe(GROUP_RADIUS);
    expect(GROUP_RADIUS).toBeGreaterThan(TASK_RADIUS);
    // Quieter than the flow objects it is drawn around.
    expect(group.stroke).toBe(GROUP_STROKE);
    expect(GROUP_STROKE).not.toBe(NEUTRAL_STROKE);
    // Born big enough to have something in it — it is a lasso, not a node.
    expect(NODE_SIZE.group.w).toBeGreaterThan(NODE_SIZE.task.w * 2);
    expect(NODE_SIZE.group.h).toBeGreaterThan(NODE_SIZE.task.h * 2);
    // Its label names a REGION, so it sits in the corner rather than floating
    // over whatever the group encloses.
    expect(group.textAlign).toBe(TextAlign.Left);
    expect(group.textVerticalAlign).toBe(TextVerticalAlign.Top);
    expect(NODE_LABEL.group).toBeTruthy();
  });

  it('leaves every other kind centred and solid-bordered', () => {
    // The group is the only artefact that departs from either default, and the
    // creation site only writes the keys a preset actually asks for.
    for (const kind of KINDS) {
      if (kind === 'group') continue;
      expect(NODE_PRESETS[kind].textAlign, kind).toBeUndefined();
      expect(NODE_PRESETS[kind].textVerticalAlign, kind).toBeUndefined();
      expect(NODE_PRESETS[kind].strokeStyle, kind).toBeUndefined();
      expect(NODE_PRESETS[kind].hollow, kind).toBeUndefined();
    }
  });

  it('hands the three artifact silhouettes to the glyph, and nothing else', () => {
    const glyphBodied = KINDS.filter(k => NODE_PRESETS[k].glyphBody);
    expect(glyphBodied).toEqual(['dataObject', 'dataStore', 'textAnnotation']);
    // A page is portrait, a store is square, an annotation is a wide strip.
    expect(NODE_SIZE.dataObject.h).toBeGreaterThan(NODE_SIZE.dataObject.w);
    expect(NODE_SIZE.dataStore.w).toBe(NODE_SIZE.dataStore.h);
    expect(NODE_SIZE.textAnnotation.w).toBeGreaterThan(NODE_SIZE.task.w);
  });

  it('labels the activities and the annotation, and nothing else', () => {
    // A rectangle with nothing written in it says nothing at all; an event's
    // meaning is its glyph, and BPMN puts its name outside the symbol anyway.
    for (const kind of ACTIVITIES) {
      expect(NODE_LABEL[kind], kind).toBeTruthy();
    }
    expect(NODE_LABEL.task).toBe('Task');
    expect(NODE_LABEL.textAnnotation).toBeTruthy();
    const labelled = KINDS.filter(k => NODE_LABEL[k] !== '');
    expect(labelled.sort()).toEqual(
      [...ACTIVITIES, 'textAnnotation', 'group'].sort()
    );
  });

  it('accents events only: green thin start, red thick end, neutral task/gateway', () => {
    expect(EVENT_START).toMatch(/^#/);
    expect(EVENT_END).toMatch(/^#/);
    expect(EVENT_START).not.toBe(EVENT_END);
    // End ring is heavier than the start ring (BPMN line weights).
    expect(END_WIDTH).toBeGreaterThan(START_WIDTH);
    expect(NEUTRAL_STROKE).toBe('#262626');
  });
});

/**
 * The toolbox, as the registry sees it.
 *
 * BPMN is the first shipped framework whose CATALOGUE outgrows the fourteen
 * senior slots, so two things that used to be the same list are now two lists,
 * and both of them are pinned here: what the framework offers (22), and the
 * fourteen it opens with before this user has reached for anything.
 */
describe('the bpmn command inventory', () => {
  const byId = new Map(bpmnCommands.map(c => [c.id, c]));
  const seniorIds = bpmnCommands
    .filter(c => c.surfaces.includes('senior-menu'))
    .map(c => c.id);

  it('declares twenty-three commands, every one of them in the catalogue', () => {
    expect(bpmnCommands).toHaveLength(23);
    expect(new Set(bpmnCommands.map(c => c.id)).size).toBe(23);
    for (const command of bpmnCommands) {
      expect(command.owner, command.id).toBe('bpmn');
      expect(command.scope, command.id).toBe('edgeless');
      expect(command.surfaces, command.id).toContain('catalogue');
      expect(command.iconKey, command.id).toBeTruthy();
      // Keyless by intent, all of them: past fourteen, a framework binds by
      // host override rather than by shipping a default chord.
      expect(command.defaultKeys.mac, command.id).toEqual([]);
      expect(command.defaultKeys.other, command.id).toEqual([]);
    }
  });

  it('creates one command per node kind, telemetry named after it', () => {
    const created = bpmnCommands
      .map(c => c.telemetry?.element)
      .filter((element): element is string => !!element?.startsWith('node:'))
      .map(element => element.slice('node:'.length));
    // The whole model, and nothing that is not in it: a kind with no command is
    // a kind nobody can draw, and a command naming a kind the model dropped
    // would create an element the renderer cannot paint.
    expect(created.sort()).toEqual([...KINDS].sort());
  });

  it('spends its fourteen senior slots on one of each family, plus the variants', () => {
    // Exactly at the cap, and spelled out: past fourteen the sub-menu ranks the
    // catalogue by usage, and this list is the COLD START every user meets —
    // the fourteen a host reading the manifest sees, too.
    expect(seniorIds).toEqual([
      'bpmn.addStartEvent',
      'bpmn.addEndEvent',
      'bpmn.addTask',
      'bpmn.addUserTask',
      'bpmn.addServiceTask',
      'bpmn.addSubProcess',
      'bpmn.addCallActivity',
      'bpmn.addExclusiveGateway',
      'bpmn.addParallelGateway',
      'bpmn.sequenceFlowTool',
      'bpmn.messageFlowTool',
      'bpmn.addDataObject',
      'bpmn.addTextAnnotation',
      'bpmn.addPool',
    ]);
    expect(seniorIds).toHaveLength(14);
    // The nine kept out are reachable everywhere else — nothing is orphaned.
    for (const command of bpmnCommands) {
      if (seniorIds.includes(command.id)) continue;
      expect(command.surfaces, command.id).toContain('catalogue');
      expect(command.surfaces, command.id).toContain('agent');
    }
  });

  it('groups the catalogue into seven sections, in reading order', () => {
    // First-met order IS the panel's header order (`groupCommandsByCategory`),
    // so the sections have to be declared contiguously — a category split in
    // two would silently merge into whichever half came first.
    const order = [...bpmnCommands].sort(
      (a, b) => (a.order ?? 0) - (b.order ?? 0)
    );
    const sections: string[] = [];
    for (const command of order) {
      const category = command.category!;
      if (sections.at(-1) !== category) sections.push(category);
    }
    expect(sections).toEqual([
      'events',
      'activities',
      'gateways',
      'flows',
      'data',
      'annotations',
      'swimlanes',
    ]);
    // Contiguous: each section appears once, so nothing is split.
    expect(new Set(sections).size).toBe(sections.length);
  });

  it('arms a dashed, circle-to-arrow connector for the message flow', () => {
    const { props, tool } = armed(byId.get('bpmn.messageFlowTool')!);
    expect(props).toEqual({
      mode: ConnectorMode.Orthogonal,
      stroke: MESSAGE_STROKE,
      strokeStyle: StrokeStyle.Dash,
      strokeWidth: MESSAGE_WIDTH,
      // The two endpoints BPMN draws: a hollow circle where the message leaves,
      // a line-drawn (not filled) head where it lands. `Arrow` is the open V;
      // `Triangle`, which the sequence flow uses, is the filled one.
      frontEndpointStyle: PointStyle.Circle,
      rearEndpointStyle: PointStyle.Arrow,
    });
    // The role is carried by the TOOL, so the connector is born with it.
    expect(tool).toEqual({
      mode: ConnectorMode.Orthogonal,
      role: BPMN_ROLE.messageFlow,
    });
  });

  it('arms a dashed connector with no head at all for the association', () => {
    const { props, tool } = armed(byId.get('bpmn.associationTool')!);
    expect(props).toEqual({
      mode: ConnectorMode.Orthogonal,
      stroke: ASSOCIATION_STROKE,
      // Dashed and not dotted: `StrokeStyle` has no dotted member and a
      // connector's `strokeWidth` is a closed enum whose floor is 2, so the
      // whole distinction from the message flow rides on the ENDPOINTS.
      strokeStyle: StrokeStyle.Dash,
      strokeWidth: ASSOCIATION_WIDTH,
      frontEndpointStyle: PointStyle.None,
      rearEndpointStyle: PointStyle.None,
    });
    expect(tool).toEqual({
      mode: ConnectorMode.Orthogonal,
      // Declared WITHOUT a direction, and stamped all the same: an association
      // names no relation, so there is nothing for either end to be wrong about.
      role: BPMN_ROLE.association,
    });
  });

  it('keeps the sequence flow solid, filled-headed and unchanged', () => {
    // The regression guard for the two new tools: they share one code path with
    // the flow that already shipped, and a document full of sequence flows must
    // not start drawing itself differently because a sibling arrived.
    const { props, tool } = armed(byId.get('bpmn.sequenceFlowTool')!);
    expect(props.strokeStyle).toBe(StrokeStyle.Solid);
    expect(props.frontEndpointStyle).toBe(PointStyle.None);
    expect(props.rearEndpointStyle).toBe(PointStyle.Triangle);
    expect(tool.role).toBe(BPMN_ROLE.sequenceFlow);
  });
});

/**
 * A shipped template is factory content: it is the first BPMN process most
 * users ever see. It must therefore produce the SAME typed artefacts the
 * toolbox does, or a process started from a preset would read differently from
 * a hand-drawn one.
 */
describe('bpmn templates carry the toolbox roles', () => {
  // The category may declare its templates lazily; BPMN's are a plain array,
  // and the walk below needs them in hand.
  const { templates } = bpmnTemplateCategory;
  if (typeof templates === 'function') {
    throw new Error('bpmn templates went lazy — teach this spec to await them');
  }

  /** One surface element of a shipped card, keyed by the id the snapshot gives it. */
  type TemplateElement = Record<string, unknown> & { id: string };

  /** Every surface element of every shipped card. */
  const templateElements: TemplateElement[] = templates.flatMap(template => {
    const surface = (
      template.content as unknown as {
        blocks: {
          children: { props: { elements: Record<string, unknown> } }[];
        };
      }
    ).blocks.children[0];
    return Object.entries(surface.props.elements).map(
      ([id, element]): TemplateElement => ({
        ...(element as Record<string, unknown>),
        id,
      })
    );
  });

  it('finds the eight cards and every element in them', () => {
    // If this ever drops to zero the assertions below become vacuous, which is
    // the failure mode a corpus test is most likely to die of.
    expect(templates).toHaveLength(8);
    expect(templateElements.length).toBeGreaterThanOrEqual(26);
  });

  it('stamps every node with the role its kind means', () => {
    const nodes = templateElements.filter(el => el.type === 'bpmnNode');
    expect(nodes.length).toBeGreaterThanOrEqual(10);
    for (const node of nodes) {
      expect(node.role, `${node.id} (${String(node.kind)})`).toBe(
        BPMN_ROLE_OF_KIND[node.kind as keyof typeof BPMN_ROLE_OF_KIND]
      );
    }
  });

  it('stamps every pool with the frame role', () => {
    const pools = templateElements.filter(el => el.type === 'bpmnPool');
    // Two worked scenes carry pools: "Simple process" (one) and "Message
    // exchange" (two), plus the "Pool" prefab.
    expect(pools).toHaveLength(4);
    for (const pool of pools) expect(pool.role).toBe(BPMN_ROLE.pool);
  });

  it('types the BOUND connectors, and only those', () => {
    const connectors = templateElements.filter(el => el.type === 'connector');
    expect(connectors).toHaveLength(9);
    for (const connector of connectors) {
      const ends = connector as {
        source?: { id?: string };
        target?: { id?: string };
      };
      const bound = Boolean(ends.source?.id) && Boolean(ends.target?.id);
      // A typed edge claims something about two named things. The free arrow of
      // the "Sequence flow" card is attached to neither end, so it has no this
      // and no that to say it about, and it stays neutral (`docs/adr/0010`).
      if (!bound) {
        expect(connector.role, connector.id).toBeUndefined();
        continue;
      }
      expect(
        [BPMN_ROLE.sequenceFlow, BPMN_ROLE.messageFlow],
        connector.id
      ).toContain(connector.role);
    }
    expect(connectors.filter(c => c.role === undefined)).toHaveLength(1);
  });

  /**
   * The card that exists to show the one arrow allowed to leave a pool.
   *
   * Its message flow is the FIRST `bpmn:message-flow` this library ships drawn
   * — the role was declared and stamped by nothing until the tool landed — so
   * what it carries is worth pinning: the role, the dash, and the two endpoint
   * markers that are the whole visual difference from a sequence flow.
   */
  it('draws the message exchange across two pools, dashed and typed', () => {
    const card = templates.find(t => t.name === 'Message exchange');
    expect(card).toBeDefined();

    const elements = (
      card!.content as unknown as {
        blocks: {
          children: { props: { elements: Record<string, unknown> } }[];
        };
      }
    ).blocks.children[0].props.elements;
    const entries = Object.values(elements) as Record<string, unknown>[];

    expect(entries.filter(el => el.type === 'bpmnPool')).toHaveLength(2);

    const flows = entries.filter(el => el.type === 'connector');
    expect(flows).toHaveLength(2);
    const message = flows.find(f => f.role === BPMN_ROLE.messageFlow);
    const sequence = flows.find(f => f.role === BPMN_ROLE.sequenceFlow);
    expect(message, 'the card draws no message flow').toBeDefined();
    expect(sequence, 'the card draws no sequence flow').toBeDefined();

    // Dashed, with an open circle where the message leaves and an open head
    // where it lands — the style `activateBpmnMessageFlow` arms the tool with.
    expect(message!.strokeStyle).toBe(StrokeStyle.Dash);
    expect(message!.frontEndpointStyle).toBe(PointStyle.Circle);
    expect(message!.rearEndpointStyle).toBe(PointStyle.Arrow);
    // …against the sequence flow's solid line and filled triangle.
    expect(sequence!.strokeStyle).toBe(StrokeStyle.Solid);
    expect(sequence!.rearEndpointStyle).toBe(PointStyle.Triangle);

    // And it CROSSES: the two tasks it binds are in the two stacked pools, so
    // they cannot share a row. A message flow that stayed inside one pool would
    // be teaching the mistake the card exists to prevent.
    const topOf = (id: string) =>
      JSON.parse((elements[id] as { xywh: string }).xywh)[1] as number;
    const from = message!.source as { id: string };
    const to = message!.target as { id: string };
    expect(topOf(from.id)).toBeLessThan(topOf(to.id));
  });
});
