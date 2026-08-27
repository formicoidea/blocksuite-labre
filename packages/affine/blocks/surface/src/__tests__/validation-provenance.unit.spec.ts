import { Bound } from '@labre/global/gfx';
import type { GfxPrimitiveElementModel, RoleDefs } from '@labre/std/gfx';
import { render } from 'lit';
import { describe, expect, it } from 'vitest';

import {
  evaluateRules,
  ValidationManager,
  type ValidationRule,
  type Violation,
} from '../extensions/validation.js';
import { ViolationDetailWidget } from '../extensions/violation-detail-widget.js';

/**
 * `ValidationRule.provenance`: where a rule's authority comes from, as DATA.
 *
 * Two halves, and the first one is the load-bearing promise. The field is
 * DESCRIPTIVE — a rule that declares it must evaluate exactly as it did before,
 * or the platform has quietly turned a documentation field into a control one.
 * The second half is what the field is FOR: the violation bubble saying whether
 * the sentence above it restates a standard or a house style, which is the
 * distinction an architecture review of the BPMN pack asked to be made visible.
 */

const ROLES: RoleDefs = {
  'test:frame': { id: 'test:frame', kind: 'node', labelKey: 'test.frame' },
  'test:actor': { id: 'test:actor', kind: 'node', labelKey: 'test.actor' },
  'test:command': {
    id: 'test:command',
    kind: 'node',
    labelKey: 'test.command',
  },
  'test:flow': { id: 'test:flow', kind: 'edge', labelKey: 'test.flow' },
};

/** The rule under test, with nothing said about where it comes from. */
const BARE: ValidationRule = {
  id: 'test.forbidden-arc',
  framework: 'test',
  family: 'relation-endpoints',
  severity: 'warning',
  roles: ROLES,
  messageKey: 'com.labre.test.forbidden-arc',
  version: 1,
  backgroundRole: 'test:frame',
  endpoints: {
    edgeRole: 'test:flow',
    allowed: [
      { source: 'test:actor', edge: 'test:flow', target: 'test:command' },
    ],
    offMatrix: { messageKey: 'com.labre.test.off-matrix' },
    selfLoop: { messageKey: 'com.labre.test.self-loop' },
  },
};

function element(
  id: string,
  xywh: [number, number, number, number],
  props: Record<string, unknown> = {}
): GfxPrimitiveElementModel {
  const stub = {
    id,
    type: 'test',
    ...props,
    get elementBound() {
      return new Bound(...xywh);
    },
  };
  return stub as unknown as GfxPrimitiveElementModel;
}

const frame = () =>
  element('frame', [0, 0, 1000, 1000], { role: 'test:frame' });
const node = (id: string, role: string) =>
  element(id, [50, 50, 20, 20], { role });
const edge = (id: string, sourceId: string, targetId: string) =>
  element(id, [0, 0, 100, 100], {
    role: 'test:flow',
    source: { id: sourceId },
    target: { id: targetId },
  });

describe('provenance is inert', () => {
  /**
   * A board with one finding of each kind the rule can raise, so the comparison
   * below is over more than a single code path: a sentence off the matrix, and a
   * self-loop the rule asked to hear about.
   */
  const board = () => [
    frame(),
    node('a', 'test:actor'),
    node('c', 'test:command'),
    // Backwards — off the matrix.
    edge('e1', 'c', 'a'),
    // ...and a loop, which the family judges before it reads the matrix at all.
    edge('e2', 'a', 'a'),
  ];

  it('changes no verdict, no severity and no message', () => {
    // The SAME rule, declared twice: the engine's evaluators never read the
    // field, so the two must agree finding for finding. If a family ever starts
    // branching on it, this is the test that says so.
    const declared: ValidationRule = {
      ...BARE,
      provenance: {
        source: 'standard',
        reference: 'OMG BPMN 2.0.2 (ISO/IEC 19510) p.95',
      },
    };

    const before = evaluateRules([BARE], board());
    const after = evaluateRules([declared], board());

    expect(before.length).toBeGreaterThan(0);
    expect(after).toEqual(before);
  });

  it('is inert whichever source it names, reference or not', () => {
    // The four sources are four words to a reader and nothing at all to the
    // engine, so none of them may move a verdict either.
    const baseline = evaluateRules([BARE], board());
    for (const source of [
      'standard',
      'recommendation',
      'labre-convention',
      'organization',
    ] as const) {
      const declared: ValidationRule = { ...BARE, provenance: { source } };
      expect(evaluateRules([declared], board()), source).toEqual(baseline);
    }
  });
});

/**
 * The bubble half.
 *
 * `_renderEntry` is reached through the prototype over a stub, which is the
 * pattern `violation-overlay-placement.unit.spec.ts` already uses on this
 * widget: the instance fields a lit component gets from its base classes are
 * not what any of these assertions are about, and standing a real editor up to
 * read one line of text would test the editor.
 */
function violation(ruleId: string): Violation {
  return {
    ruleId,
    elementIds: ['a'],
    severity: 'warning',
    messageKey: 'com.labre.test.forbidden-arc',
    messageFallback: 'An aggregate does not issue a command.',
  };
}

function bubbleEntry(rule: ValidationRule | undefined): HTMLElement {
  const manager = {
    ruleOf: (id: string) => (rule?.id === id ? rule : undefined),
  };
  const values: Record<string, unknown> = {
    // `translateKey` asks for a `TranslationProvider` and gets nothing, so
    // every label falls back to the wording the widget itself declares — which
    // is exactly the catalogue-less host this line has to read correctly in.
    std: {
      getOptional: (id: unknown) =>
        id === ValidationManager ? manager : undefined,
    },
    _violations: [],
    _swallow: () => {},
    _exception: () => () => {},
  };
  const stub = Object.create(ViolationDetailWidget.prototype) as object;
  for (const [key, value] of Object.entries(values)) {
    Object.defineProperty(stub, key, { value, writable: true });
  }

  const entry = violation('test.forbidden-arc');
  const method = (
    ViolationDetailWidget.prototype as unknown as Record<
      string,
      (this: unknown, ...rest: unknown[]) => unknown
    >
  )._renderEntry;
  const container = document.createElement('div');
  render(method.call(stub, entry, [entry]) as never, container);
  return container;
}

const provenanceLine = (rule: ValidationRule | undefined) =>
  bubbleEntry(rule).querySelector<HTMLElement>('.violation-provenance');

describe('the violation bubble says where the rule comes from', () => {
  it('names the standard and prints its citation verbatim', () => {
    const line = provenanceLine({
      ...BARE,
      provenance: {
        source: 'standard',
        reference: 'OMG BPMN 2.0.2 (ISO/IEC 19510) p.95',
      },
    });
    expect(line).not.toBeNull();
    expect(line?.dataset.provenance).toBe('standard');
    // The label is chrome and translatable; the citation is the framework's own
    // data and is shown exactly as declared.
    expect(line?.textContent).toContain('Standard');
    expect(line?.textContent).toContain('OMG BPMN 2.0.2 (ISO/IEC 19510) p.95');
  });

  it('says "Labre convention" rather than implying a norm', () => {
    // The whole point of the field: a house style must never reach an architect
    // dressed as a conformance defect.
    const line = provenanceLine({
      ...BARE,
      provenance: {
        source: 'labre-convention',
        reference: 'Labre house style — BPMN 2.0.2 states no prohibition',
      },
    });
    expect(line?.dataset.provenance).toBe('labre-convention');
    expect(line?.textContent).toContain('Labre convention');
    expect(line?.textContent).not.toContain('Standard');
  });

  it('renders the label alone when the rule cites nothing', () => {
    const line = provenanceLine({
      ...BARE,
      provenance: { source: 'recommendation' },
    });
    expect(line?.textContent?.trim()).toBe('Recommendation');
  });

  it('renders no line at all when the rule declares no provenance', () => {
    // Silence, not an invented authority: the library must not put a
    // provenance in a framework's mouth any more than it puts words there.
    expect(provenanceLine(BARE)).toBeNull();
  });

  it('renders no line when the rule cannot be resolved', () => {
    // A finding whose framework has since been switched off: `ruleOf` answers
    // `undefined`, and the bubble still shows the message it was handed.
    const container = bubbleEntry(undefined);
    expect(container.querySelector('.violation-provenance')).toBeNull();
    expect(container.querySelector('.violation-message')).not.toBeNull();
  });
});
