import { evaluateRules } from '@labre/affine-block-surface';
import { snapshotFromAction } from '@labre/affine-gfx-template';
import { type BpmnNodeKind, TextFitMode } from '@labre/affine-model';
import { Bound } from '@labre/global/gfx';
import type { CommandInvocation } from '@labre/std';
import type { GfxPrimitiveElementModel } from '@labre/std/gfx';
import { describe, expect, it } from 'vitest';

import { bpmnCommands } from '../commands';
import { bpmnLabelMode } from '../consts';
import { bpmnLabelBoxFor, bpmnNodeProps } from '../presets';
import { BPMN_PROFILES } from '../profiles';
import { BPMN_ROLE } from '../roles';
import { BPMN_RULES } from '../rules';
import { bpmnTemplateCategory } from '../templates';

/**
 * The guard the palette never had: **a template must be what its command
 * draws**, and **a card the product ships must not break the rules the same
 * release enforces.**
 *
 * The BPMN templates were written in August 2026 with a private `node()`
 * builder beside `presets.ts` rather than through it, and the pack kept moving:
 * the nodes never gained the `textFitMode: Overflow` #160 centralised, the
 * events and gateways lost their typography on an early return, the labels
 * stayed English literals outside the translation seam (#192), and eleven of the
 * seventeen kinds had no card at all. Nothing in the repository compared the two
 * sides — `bpmn.unit.spec.ts` checked the templates' roles, and a template with
 * the right roles and the wrong fit mode passed.
 *
 * So: every single-artefact template is DERIVED (`templateFromCommand` runs the
 * command against a recording surface), and this file re-runs the command and
 * compares. The three hand-written cards are checked on COMPOSITION instead —
 * same presets, same roles — and the two SCENES additionally on CONFORMANCE:
 * the whole descriptive rule pack, run over the card, must raise nothing.
 */

/** A template's stored snapshot, as far as this file reads it. */
type Snapshot = {
  blocks: { children: { props: { elements: Record<string, RawElement> } }[] };
};

type RawElement = {
  type?: string;
  kind?: string;
  role?: string;
  shapeType?: string;
  textFitMode?: string;
  xywh?: string;
  source?: { id?: string; position?: [number, number] };
  target?: { id?: string; position?: [number, number] };
  text?: { delta: { insert: string }[] };
  children?: { json?: Record<string, boolean> };
};

/**
 * The invocation a derived template is recorded under.
 *
 * Any value does: a BPMN command's `run` hands the `BlockStdScope` to its action
 * and reads nothing off the invocation, so the recording cannot depend on it.
 * Spelled out rather than cast, so the day one does the failure is a comparison
 * rather than a crash.
 */
const INVOCATION: CommandInvocation = {
  surface: 'senior-menu',
  source: 'internal',
};

/**
 * The three templates written by hand, and why each one is.
 *
 * The two scenes are arrangements no command draws. "Sequence flow" is a sample
 * of a STROKE: its command activates a tool and draws nothing at all, so there
 * is no artefact to record — the user draws it.
 */
const HAND_AUTHORED = ['Simple process', 'Message exchange', 'Sequence flow'];

/** The two cards that are a PROCESS, and therefore judgeable by the rule pack. */
const SCENES = ['Simple process', 'Message exchange'];

const shipped = bpmnTemplateCategory.templates;
if (typeof shipped === 'function') {
  throw new Error('the BPMN template category is expected to be eager');
}
const templates = shipped;

const elementsOf = (template: (typeof templates)[number]) =>
  (template.content as unknown as Snapshot).blocks.children[0].props.elements;

const cardNamed = (name: string) => {
  const found = templates.find(template => template.name === name);
  if (!found) throw new Error(`no template named "${name}"`);
  return elementsOf(found);
};

describe('the BPMN palette covers the toolbox', () => {
  const artefacts = bpmnCommands.filter(command => command.kind === 'artefact');

  it('ships one derived template per artefact command', () => {
    expect(artefacts.length).toBeGreaterThan(0);
    for (const command of artefacts) {
      const derived = templates.filter(
        template => template.commandId === command.id
      );
      expect(
        derived.map(template => template.name),
        `templates for ${command.id}`
      ).toHaveLength(1);
    }
  });

  it('names every template that is NOT derived', () => {
    const free = templates
      .filter(template => template.commandId === undefined)
      .map(template => template.name);
    expect([...free].sort()).toEqual([...HAND_AUTHORED].sort());
  });
});

describe('every derived template is what its command draws', () => {
  for (const template of templates) {
    if (template.commandId === undefined) continue;
    const command = bpmnCommands.find(entry => entry.id === template.commandId);

    it(`${template.name} re-runs identically`, () => {
      expect(command, template.commandId).toBeDefined();
      expect(template.content).toEqual(
        snapshotFromAction(
          std => command!.run(std, INVOCATION),
          template.name ?? 'Template'
        )
      );
    });
  }
});

describe('the worked scenes are composed of the same presets', () => {
  for (const name of SCENES) {
    describe(name, () => {
      const elements = cardNamed(name);
      const nodes = Object.entries(elements).filter(
        ([, element]) => element.type === 'bpmnNode'
      );

      it('draws every node from `bpmnNodeProps`', () => {
        expect(nodes.length).toBeGreaterThan(2);
        for (const [id, element] of nodes) {
          const kind = element.kind as BpmnNodeKind;
          const preset = bpmnNodeProps(kind, { xywh: element.xywh ?? '' });
          expect(
            {
              type: element.type,
              kind: element.kind,
              role: element.role,
              shapeType: element.shapeType,
              textFitMode: element.textFitMode,
            },
            id
          ).toEqual({
            type: preset.type,
            kind: preset.kind,
            role: preset.role,
            shapeType: preset.shapeType,
            // The drift the audit named first: eleven nodes with the model's
            // own `Grow`, so a long label deformed a symbol whose size the
            // notation fixes.
            textFitMode: TextFitMode.Overflow,
          });
        }
      });

      it('frames itself in declared pools', () => {
        const pools = Object.entries(elements).filter(
          ([, element]) => element.type === 'bpmnPool'
        );
        expect(pools.length).toBeGreaterThan(0);
        for (const [id, element] of pools) {
          expect(element.role, id).toBe(BPMN_ROLE.pool);
        }
      });
    });
  }
});

/* ── Gravitating labels (R38) ─────────────────────────────────────────────── */

/**
 * Why this block exists: since R38 an event, a gateway or a data shape is
 * named by a free `bpmn:label` text grouped with it, never by its own inner
 * text — and a card is the first BPMN most people ever insert. A derived card
 * follows `createBpmnNode` by construction (the re-run above), but that proves
 * only that card and command AGREE; this proves what they agree on is the
 * shape R38 asks for, and that the two hand-laid scenes say the same thing
 * about the same kinds.
 */
const textOfRaw = (element: RawElement | undefined) =>
  element?.text?.delta.map(op => op.insert).join('') ?? '';

/** The group, if any, whose children include `id`. */
const groupOf = (elements: Record<string, RawElement>, id: string) =>
  Object.entries(elements).find(
    ([, element]) =>
      element.type === 'group' && element.children?.json?.[id] === true
  );

/** Every node of a card is named the way its kind asks (R38). */
function expectNamedByMode(elements: Record<string, RawElement>) {
  const nodes = Object.entries(elements).filter(
    ([, element]) => element.type === 'bpmnNode'
  );
  expect(nodes.length).toBeGreaterThan(0);
  for (const [id, node] of nodes) {
    const kind = node.kind as BpmnNodeKind;
    const group = groupOf(elements, id);
    if (bpmnLabelMode(kind) === 'inscribed') {
      expect(textOfRaw(node), `${id} carries its own name`).not.toBe('');
      expect(group, `${id} is not grouped`).toBeUndefined();
      continue;
    }
    expect(node.text, `${id} has no inner text`).toBeUndefined();
    expect(group, `${id} is grouped with its label`).toBeDefined();
    const members = Object.keys(group![1].children!.json!);
    expect(members, id).toHaveLength(2);
    const label = elements[members.find(member => member !== id)!];
    expect(label?.type, id).toBe('text');
    expect(label?.role, id).toBe(BPMN_ROLE.label);
    expect(textOfRaw(label), `${id}'s label says something`).not.toBe('');
    // Centred under the symbol, at the box the palette computes.
    const at = Bound.deserialize(node.xywh!).center;
    const box = bpmnLabelBoxFor(kind, at[0], at[1]);
    const drawn = Bound.deserialize(label!.xywh!);
    expect([drawn.x, drawn.y], `${id}'s label position`).toEqual([
      box.x,
      box.y,
    ]);
  }
}

describe('every card names its nodes the way R38 asks', () => {
  for (const template of templates) {
    const elements = elementsOf(template);
    const hasNode = Object.values(elements).some(
      element => element.type === 'bpmnNode'
    );
    // The pool and the free "Sequence flow" swatch have no node to name.
    if (!hasNode) continue;
    it(template.name ?? '(unnamed)', () => expectNamedByMode(elements));
  }
});

/**
 * Why: the scenes were laid out by hand for a 120×72 task, and at 180×108 the
 * "Reject" branch left its 200-high pool. `bpmnPoolOf` judges WHOLE
 * containment, so a node that pokes out belongs to no participant and every
 * pool-scoped rule stops seeing it — and a gravitating name hanging out of its
 * pool reads as belonging to nobody.
 */
describe('every scene keeps its artefacts inside a pool', () => {
  for (const name of SCENES) {
    it(name, () => {
      const elements = cardNamed(name);
      const pools = Object.values(elements)
        .filter(element => element.type === 'bpmnPool')
        .map(element => Bound.deserialize(element.xywh!));
      const placed = Object.entries(elements).filter(
        ([, element]) => element.type !== 'bpmnPool' && element.xywh
      );
      expect(placed.length).toBeGreaterThan(0);
      for (const [id, element] of placed) {
        const bound = Bound.deserialize(element.xywh!);
        expect(
          pools.some(pool => pool.contains(bound)),
          `${id} lies inside a pool`
        ).toBe(true);
      }
    });

    // The other half of the same regression: grown tasks landed on the
    // gateway and the end event, and a name drawn over a neighbour is
    // unreadable.
    it(`${name} overlaps no artefact with another`, () => {
      const placed = Object.entries(cardNamed(name))
        .filter(([, element]) => element.type !== 'bpmnPool' && element.xywh)
        .map(
          ([id, element]) => [id, Bound.deserialize(element.xywh!)] as const
        );
      const clashes: string[] = [];
      placed.forEach(([id, bound], i) => {
        for (const [other, next] of placed.slice(i + 1)) {
          if (bound.isOverlapWithBound(next, 0)) clashes.push(`${id}+${other}`);
        }
      });
      expect(clashes).toEqual([]);
    });
  }
});

/* ── Conformance ─────────────────────────────────────────────────────────── */

/**
 * One scene, flattened into what the validation engine reads.
 *
 * A template snapshot stores an element as JSON and a connector as two
 * references; the engine reads `id`, `role`, `elementBound`, the two ends, and
 * the profile in force. That is all this builds.
 *
 * ## What it does NOT model, deliberately
 *
 * - **routing** — a BPMN connector is `Orthogonal`, so unlike the Wardley corpus
 *   this reader cannot reconstruct the drawn path. It does not have to: every
 *   BPMN family that judges a link (`relation-endpoints`, `edge-degree`,
 *   `edge-locality`) reads the two ENDS and the frame each end's element sits
 *   in, never the line. The bounding box handed over is the box of the two
 *   centres, which nothing in the pack asks a question about.
 * - **lanes** — no shipped scene declares any, and a pool with no `lanes` prop
 *   has one plot, which is exactly what `backgroundPlot` computes.
 * - **the audit-only rules** — `evaluateRules` runs the REALTIME moment, and an
 *   `audit` severity puts a rule on the other one. The five that stay `audit`
 *   under `descriptive` (`activity-dead-end`, `fake-join`, `implicit-split`,
 *   `single-blank-start`, `unlabeled-step`) are therefore not judged here, which
 *   is the same reading the canvas gives.
 */
function cardOf(raw: Record<string, RawElement>): GfxPrimitiveElementModel[] {
  const centreOf = (xywh: string): [number, number] => {
    const [x, y, w, h] = JSON.parse(xywh) as number[];
    return [x + w / 2, y + h / 2];
  };
  const endpoint = (
    end: RawElement['source']
  ): [number, number] | undefined => {
    if (end?.position && end.id === undefined) return end.position;
    const referenced = end?.id === undefined ? undefined : raw[end.id];
    return referenced?.xywh ? centreOf(referenced.xywh) : undefined;
  };

  const elements: GfxPrimitiveElementModel[] = [];
  for (const [id, el] of Object.entries(raw)) {
    // The level of requirement the card is judged at: the DESCRIPTIVE posture,
    // which is what a shipped card has to survive — a user who switches a pool
    // to it must not be handed a finding on factory content.
    const common = { id, role: el.role, validationProfile: 'bpmn.descriptive' };

    if (el.type === 'connector') {
      const from = endpoint(el.source);
      const to = endpoint(el.target);
      // Not resolvable: dropped rather than guessed at.
      if (!from || !to) continue;
      const bound = new Bound(
        Math.min(from[0], to[0]),
        Math.min(from[1], to[1]),
        Math.abs(to[0] - from[0]) || 1,
        Math.abs(to[1] - from[1]) || 1
      );
      elements.push({
        ...common,
        // The two ENDS, carried verbatim: since `docs/adr/0010` the pair is the
        // relation's ORIENTATION, and three of the five BPMN families read it.
        source: el.source,
        target: el.target,
        get elementBound() {
          return bound.clone();
        },
      } as unknown as GfxPrimitiveElementModel);
      continue;
    }

    if (!el.xywh) continue;
    const xywh = el.xywh;
    elements.push({
      ...common,
      ...(el.text ? { text: el.text.delta.map(op => op.insert).join('') } : {}),
      get elementBound() {
        return Bound.deserialize(xywh);
      },
    } as unknown as GfxPrimitiveElementModel);
  }
  return elements;
}

/**
 * The invariant the pack was missing: **a scene the product ships must evaluate
 * to zero findings at the descriptive level of requirement.**
 *
 * "Message exchange" did not. Its customer pool held a start event and no end
 * event, which is `bpmn.pool-start-without-end` — a verbatim normative MUST
 * (BPMN 2.0.2 p.246), `warning` under `descriptive` — raised on the card the
 * moment anybody inserted it and switched the profile. Factory content teaching
 * the mistake the rule pack reports is the worst possible first BPMN diagram,
 * and this is the assertion that would have caught it the day it landed.
 */
describe('every shipped scene is conformant', () => {
  for (const name of SCENES) {
    it(`${name} raises nothing under descriptive`, () => {
      const elements = cardOf(cardNamed(name));
      // Guard against the reader silently resolving nothing.
      expect(elements.length).toBeGreaterThan(5);

      const findings = evaluateRules(BPMN_RULES, elements, BPMN_PROFILES).map(
        violation => `${violation.ruleId}:${violation.elementIds.join('+')}`
      );

      expect(findings).toEqual([]);
    });
  }
});
