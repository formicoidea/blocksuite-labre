import { BpmnNodeElementModel, type BpmnNodeKind } from '@labre/affine-model';
import type {
  ToolbarAction,
  ToolbarContext,
} from '@labre/affine-shared/services';
import { describe, expect, it } from 'vitest';

import { BPMN_EXTERNAL_LABEL_KINDS } from '../consts';
import { bpmnNodeToolbarConfig } from '../toolbar/node-config';

/**
 * The base shape features on a selected BPMN node.
 *
 * Why it exists: `renderToolbar` merges by flavour KEY, so a BPMN node — a
 * `ShapeElementModel` subclass — got none of the shape toolbar until a module
 * was registered on `affine:surface:bpmnNode` (PO, 24/09/2026). This pins what
 * that module keeps, what it drops, and the one narrowing it adds: "Add text"
 * never appears on an event, a gateway or a data shape, whose name is a
 * grouped label under the symbol (R38) and never the shape's inner text.
 */

/** A node built detached: the shipped `instanceof` gates, plain accessors. */
function node(kind: BpmnNodeKind, text?: unknown) {
  const element = Object.create(BpmnNodeElementModel.prototype) as object;
  for (const [key, value] of Object.entries({ kind, text, group: null })) {
    Object.defineProperty(element, key, { value, configurable: true });
  }
  return element as BpmnNodeElementModel;
}

/** The two context members the kept actions' `when`s read. */
function ctxOf(models: BpmnNodeElementModel[]) {
  return {
    getSurfaceModelsByType: (
      Ctor: abstract new (...args: never[]) => unknown
    ) => models.filter(model => model instanceof Ctor),
    features: { getFlag: () => false },
  } as unknown as ToolbarContext;
}

const actions = bpmnNodeToolbarConfig.actions as ToolbarAction[];
const ids = actions.map(action => action.id);
const actionOf = (id: string) => actions.find(action => action.id === id)!;
const shows = (id: string, ctx: ToolbarContext) => {
  const when = actionOf(id).when;
  return typeof when === 'function' ? when(ctx) : when !== false;
};

describe('the bpmn node toolbar', () => {
  it('offers the colour picker, the style and every text action', () => {
    expect(ids).toContain('e.color');
    expect(ids).toContain('d.style');
    expect(ids).toContain('f.text');
    expect(ids).toContain('f2.text-fit');
    expect(ids.some(id => id.startsWith('g.text-'))).toBe(true);
  });

  it('drops the shape switch and the vertex editor', () => {
    // The kind decides the native shape; no BPMN symbol is a free polygon.
    expect(ids).not.toContain('c.switch-type');
    expect(ids).not.toContain('f1.edit-vertices');
  });

  it('shows the colour picker on every kind', () => {
    expect(shows('e.color', ctxOf([node('startEvent')]))).toBe(true);
    expect(shows('e.color', ctxOf([node('task', 'Task')]))).toBe(true);
  });

  it('offers "Add text" on an inscribed kind with no text', () => {
    expect(shows('f.text', ctxOf([node('task')]))).toBe(true);
  });

  it.each(BPMN_EXTERNAL_LABEL_KINDS)(
    'never offers "Add text" on a %s',
    kind => {
      expect(shows('f.text', ctxOf([node(kind)]))).toBe(false);
      // …nor on a selection that mixes one in with an inscribed kind.
      expect(shows('f.text', ctxOf([node('task'), node(kind)]))).toBe(false);
    }
  );
});
