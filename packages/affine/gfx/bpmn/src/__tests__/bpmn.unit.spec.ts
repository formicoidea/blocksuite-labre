import {
  type BpmnNodeKind,
  StrokeStyle,
  TextAlign,
  TextVerticalAlign,
} from '@labre/affine-model';
import { describe, expect, it } from 'vitest';

import { NODE_PRESETS } from '../actions';
import {
  CALL_ACTIVITY_WIDTH,
  EVENT_END,
  EVENT_START,
  END_WIDTH,
  GROUP_RADIUS,
  GROUP_STROKE,
  NEUTRAL_STROKE,
  NODE_LABEL,
  NODE_SIZE,
  START_WIDTH,
  TASK_RADIUS,
} from '../consts';
import { BPMN_ROLE, BPMN_ROLE_OF_KIND } from '../roles';
import { bpmnTemplateCategory } from '../templates';

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

  it('finds the seven cards and every element in them', () => {
    // If this ever drops to zero the assertions below become vacuous, which is
    // the failure mode a corpus test is most likely to die of.
    expect(templates).toHaveLength(7);
    expect(templateElements.length).toBeGreaterThanOrEqual(19);
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
    expect(pools).toHaveLength(2);
    for (const pool of pools) expect(pool.role).toBe(BPMN_ROLE.pool);
  });

  it('types the BOUND connectors, and only those', () => {
    const connectors = templateElements.filter(el => el.type === 'connector');
    expect(connectors).toHaveLength(7);
    for (const connector of connectors) {
      const ends = connector as {
        source?: { id?: string };
        target?: { id?: string };
      };
      const bound = Boolean(ends.source?.id) && Boolean(ends.target?.id);
      // A typed edge claims "this is followed by that". The free arrow of the
      // "Sequence flow" card is attached to neither end, so it has no this and
      // no that to say it about, and it stays neutral (`docs/adr/0010`).
      expect(connector.role, connector.id).toBe(
        bound ? BPMN_ROLE.sequenceFlow : undefined
      );
    }
    expect(connectors.filter(c => c.role === undefined)).toHaveLength(1);
  });
});
