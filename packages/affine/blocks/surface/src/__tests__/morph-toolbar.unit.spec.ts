import { MindmapElementModel } from '@labre/affine-model';
import type { ToolbarContext } from '@labre/affine-shared/services';
import type { SerializedXYWH } from '@labre/global/gfx';
import { GfxPrimitiveElementModel } from '@labre/std/gfx';
import { html } from 'lit';
import { describe, expect, it, vi } from 'vitest';

import {
  applyMorph,
  type MorphSpec,
  morphToolbarConfig,
} from '../extensions/morph-toolbar.js';

/**
 * The generic morph module: WHEN the dropdown stands up, and WHAT one pick
 * writes.
 *
 * Everything here is the config's own logic, so nothing here needs a document.
 * What only a real editor can answer — that the entry renders on a selected
 * BPMN node, that the connectors survive and that ctrl+z brings the previous
 * kind back — is the integration suite's (`edgeless/bpmn.spec.ts`).
 */

type Kind = 'task' | 'taskUser' | 'taskService' | 'dataObject' | 'dataStore';

/**
 * The element type the spec claims — a real `GfxPrimitiveElementModel`, so the
 * config's `instanceof` gate is the shipped one. Never CONSTRUCTED: instances
 * are prototype-grafted, so these two fields exist only to satisfy the abstract
 * base.
 */
class TestNode extends GfxPrimitiveElementModel {
  rotate = 0;
  xywh: SerializedXYWH = '[0,0,0,0]';
  override get type() {
    return 'testNode';
  }
}

/**
 * Something else on the canvas — a SIBLING of {@link TestNode}, never a
 * subclass, so `instanceof TestNode` is false and "homogeneous" has a way to
 * fail.
 */
class OtherNode extends GfxPrimitiveElementModel {
  rotate = 0;
  xywh: SerializedXYWH = '[0,0,0,0]';
  override get type() {
    return 'otherNode';
  }
}

interface Stub {
  id: string;
  kind: Kind | undefined;
  surface: { updateElement: ReturnType<typeof vi.fn> };
  clearField: ReturnType<typeof vi.fn>;
}

let seq = 0;

/**
 * An element that passes the config's `instanceof` gate and records what was
 * written to it, without a surface, a Y.Doc or a renderer.
 */
function node(
  kind: Kind | undefined,
  options: {
    locked?: boolean;
    mindmap?: boolean;
    of?: abstract new (...args: never[]) => GfxPrimitiveElementModel;
  } = {}
) {
  const el = Object.create(
    (options.of ?? TestNode).prototype
  ) as GfxPrimitiveElementModel & Stub;

  // `id` and `group` are GETTERS on the base class, so every one of these goes
  // through `defineProperty` rather than assignment.
  const own = {
    id: `el-${++seq}`,
    kind,
    surface: { updateElement: vi.fn() },
    clearField: vi.fn(),
    isLocked: () => options.locked === true,
    group: options.mindmap
      ? (Object.create(MindmapElementModel.prototype) as unknown)
      : null,
  };
  for (const [key, value] of Object.entries(own)) {
    Object.defineProperty(el, key, { value, configurable: true });
  }
  return el;
}

const captureSync = vi.fn();

function context(models: unknown[], readonly = false) {
  return {
    readonly,
    std: { store: { captureSync } },
    getSurfaceModels: () => models,
    getSurfaceModelsByType: (klass: abstract new (...a: never[]) => unknown) =>
      models.filter(model => model instanceof klass),
    track: vi.fn(),
  } as unknown as ToolbarContext;
}

/**
 * Two families and a per-kind patch that flips a hazard key, which is the whole
 * shape of a real one: within the first family, `taskService` is the kind whose
 * preset says "not filled", and `taskUser` the only one whose preset writes
 * `textVerticalAlign` at all.
 */
const SPEC: MorphSpec<Kind> = {
  framework: 'bpmn',
  families: [
    ['task', 'taskUser', 'taskService'],
    ['dataObject', 'dataStore'],
  ],
  modelType: TestNode,
  kindOf: model => (model as unknown as Stub).kind,
  roleOf: kind => `test:${kind}`,
  propsOf: kind => ({
    kind,
    role: `test:${kind}`,
    filled: kind !== 'taskService',
    ...(kind === 'taskUser' ? { textVerticalAlign: 'top' } : {}),
  }),
  clearOf: kind => (kind === 'taskUser' ? [] : ['textVerticalAlign']),
  labelOf: kind => ({ fallback: kind }),
  iconOf: () => html``,
  label: { fallback: 'Change type' },
};

const config = morphToolbarConfig(SPEC);

/**
 * Both gates, and they must agree: the MODULE's `when` decides whether the
 * framework pays a resolution at all, the ACTION's decides whether the entry is
 * drawn. A test that read only one of them would pass on a config that showed a
 * dropdown nobody could answer.
 */
const moduleWhen = config.when as (ctx: ToolbarContext) => boolean;
const actionWhen = (
  config.actions[0] as { when: (ctx: ToolbarContext) => boolean }
).when;

const shown = (models: unknown[], readonly = false) => {
  const ctx = context(models, readonly);
  const module = moduleWhen(ctx);
  expect(actionWhen(ctx)).toBe(module);
  return module;
};

describe('morphToolbarConfig — when the dropdown stands up', () => {
  it('shows on a homogeneous selection whose kinds share one family', () => {
    expect(shown([node('task')])).toBe(true);
    expect(shown([node('task'), node('taskService')])).toBe(true);
  });

  it('says nothing about an empty selection', () => {
    expect(shown([])).toBe(false);
  });

  it('stands down on a kind that is in no family', () => {
    // The BPMN group and text annotation are exactly this case: declared,
    // drawable, and never morphable.
    expect(shown([node('group' as Kind)])).toBe(false);
  });

  it('stands down on an element carrying no kind at all', () => {
    expect(shown([node(undefined)])).toBe(false);
    expect(shown([node('task'), node(undefined)])).toBe(false);
  });

  it('stands down when the selection spans two families', () => {
    // Mixed families have no single menu to show, and guessing which of the two
    // the user meant is the one thing worse than showing nothing.
    expect(shown([node('task'), node('dataObject')])).toBe(false);
  });

  it('stands down on a selection that is not homogeneous on the type', () => {
    expect(shown([node('task'), node('task', { of: OtherNode })])).toBe(false);
  });

  it('stands down on a locked element, a mindmap member and a read-only doc', () => {
    expect(shown([node('task', { locked: true })])).toBe(false);
    expect(shown([node('task', { mindmap: true })])).toBe(false);
    expect(shown([node('task')], true)).toBe(false);
  });
});

describe('applyMorph — what one pick writes', () => {
  it('writes kind, role and the target presets, and clears what it omits', () => {
    const model = node('task');
    const ctx = context([model]);

    applyMorph(ctx, SPEC, 'taskService');

    expect(model.surface.updateElement).toHaveBeenCalledWith(model.id, {
      kind: 'taskService',
      role: 'test:taskService',
      // The hazard: a `{kind, role}` patch would have left this `true`.
      filled: false,
    });
    // The other hazard: a key the target's props omit is DELETED rather than
    // left in force from the previous kind.
    expect(model.clearField).toHaveBeenCalledWith('textVerticalAlign');
  });

  it('never touches geometry, identity or text', () => {
    const model = node('task');
    applyMorph(context([model]), SPEC, 'taskUser');

    const [, props] = model.surface.updateElement.mock.calls[0];
    expect(Object.keys(props as object)).not.toContain('type');
    expect(Object.keys(props as object)).not.toContain('xywh');
    expect(Object.keys(props as object)).not.toContain('text');
    // …and this target writes the key, so nothing is cleared.
    expect(model.clearField).not.toHaveBeenCalled();
  });

  it('strips identity, geometry and text even when the spec hands them over', () => {
    // `propsOf` is DATA a framework author writes, and it is most naturally
    // derived from a CREATION builder — which of course emits `type` and
    // `xywh`. The contract is stated in the type and enforced here, so a spec
    // that forgets one strip cannot silently move an element to the origin or
    // empty its label.
    const leaky: MorphSpec<Kind> = {
      ...SPEC,
      propsOf: kind => ({
        ...SPEC.propsOf(kind),
        type: 'testNode',
        xywh: '[0,0,0,0]',
        text: 'clobbered',
      }),
    };
    const model = node('task');
    applyMorph(context([model]), leaky, 'taskUser');

    const [, props] = model.surface.updateElement.mock.calls[0];
    expect(props).not.toHaveProperty('type');
    expect(props).not.toHaveProperty('xywh');
    expect(props).not.toHaveProperty('text');
    // …and everything the spec legitimately asked for still lands.
    expect(props).toMatchObject({ kind: 'taskUser', role: 'test:taskUser' });
  });

  it('takes one undo checkpoint for a whole multi-selection', () => {
    captureSync.mockClear();
    const models = [node('task'), node('taskService'), node('task')];
    const ctx = context(models);

    applyMorph(ctx, SPEC, 'taskUser');

    expect(captureSync).toHaveBeenCalledTimes(1);
    for (const model of models) {
      expect(model.surface.updateElement).toHaveBeenCalledTimes(1);
    }
  });

  it('reports the gesture once, with the two roles and the count', () => {
    const models = [node('task'), node('task'), node('taskService')];
    const ctx = context(models);

    applyMorph(ctx, SPEC, 'taskUser');

    expect(ctx.track).toHaveBeenCalledTimes(1);
    expect(ctx.track).toHaveBeenCalledWith('FrameworkElementMorphed', {
      framework: 'bpmn',
      // The most common source kind, which is what the dropdown showed.
      fromRole: 'test:task',
      toRole: 'test:taskUser',
      elementCount: 3,
    });
  });

  it('writes and reports nothing when there is nothing to change', () => {
    captureSync.mockClear();
    const model = node('taskUser');
    const ctx = context([model]);

    applyMorph(ctx, SPEC, 'taskUser');

    expect(model.surface.updateElement).not.toHaveBeenCalled();
    expect(captureSync).not.toHaveBeenCalled();
    expect(ctx.track).not.toHaveBeenCalled();
  });

  it('counts only the elements it actually rewrote', () => {
    const already = node('taskUser');
    const changing = node('task');
    const ctx = context([already, changing]);

    applyMorph(ctx, SPEC, 'taskUser');

    expect(already.surface.updateElement).not.toHaveBeenCalled();
    expect(changing.surface.updateElement).toHaveBeenCalledTimes(1);
    expect(ctx.track).toHaveBeenCalledWith(
      'FrameworkElementMorphed',
      expect.objectContaining({ elementCount: 1 })
    );
  });

  it('refuses a kind outside the selection own family', () => {
    const model = node('task');
    const ctx = context([model]);

    applyMorph(ctx, SPEC, 'dataStore');

    expect(model.surface.updateElement).not.toHaveBeenCalled();
    expect(ctx.track).not.toHaveBeenCalled();
  });

  it('refuses to write on a read-only document', () => {
    const model = node('task');
    const ctx = context([model], true);

    applyMorph(ctx, SPEC, 'taskUser');

    expect(model.surface.updateElement).not.toHaveBeenCalled();
  });
});
