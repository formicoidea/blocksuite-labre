import { MindmapElementModel } from '@labre/affine-model';
import type { ToolbarContext } from '@labre/affine-shared/services';
import type { SerializedXYWH } from '@labre/global/gfx';
import { GfxPrimitiveElementModel } from '@labre/std/gfx';
import { html, render, type TemplateResult } from 'lit';
import { beforeEach, describe, expect, it, vi } from 'vitest';

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

/**
 * What a COMPOSITE artefact is selected as — the wrapper a click lands on,
 * whose kind lives on a child. C4's `group` in miniature.
 */
class TestGroup extends GfxPrimitiveElementModel {
  rotate = 0;
  xywh: SerializedXYWH = '[0,0,0,0]';
  override get type() {
    return 'testGroup';
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
    // `getOptional` is what `translateKey` reaches for: absent provider means
    // the declared English fallback, which is what a standalone editor shows.
    std: { store: { captureSync }, getOptional: () => undefined },
    getSurfaceModels: () => models,
    getSurfaceModelsByType: (klass: abstract new (...a: never[]) => unknown) =>
      models.filter(model => model instanceof klass),
    track: vi.fn(),
  } as unknown as ToolbarContext;
}

/** Human wordings, so an `aria-label` assertion is not just the kind again. */
const WORDING: Record<Kind, string> = {
  task: 'Task',
  taskUser: 'User task',
  taskService: 'Service task',
  dataObject: 'Data object',
  dataStore: 'Data store',
};

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
  labelOf: kind => ({
    key: `com.labre.test.morph.${kind}`,
    fallback: WORDING[kind],
  }),
  iconOf: kind => html`<svg data-icon-for=${kind}></svg>`,
  label: { key: 'com.labre.test.morph.label', fallback: 'Change type' },
};

/**
 * A composite selection: the wrapper the toolbar sees, and the element the
 * kind actually lives on. Both are real models, so the config's `instanceof`
 * gates are the shipped ones on either side of the indirection.
 */
function composite(
  kind: Kind | undefined,
  options: { locked?: boolean; childLocked?: boolean; orphan?: boolean } = {}
) {
  const child = node(kind, { locked: options.childLocked });
  const group = Object.create(TestGroup.prototype) as GfxPrimitiveElementModel &
    Stub & { child?: GfxPrimitiveElementModel };

  const own = {
    id: `group-${++seq}`,
    kind: undefined,
    surface: { updateElement: vi.fn() },
    clearField: vi.fn(),
    isLocked: () => options.locked === true,
    group: null,
    // An `orphan` wrapper is a group that is not one of ours — the plain group
    // somebody lassoed round three shapes, or another framework's component.
    child: options.orphan ? undefined : child,
  };
  for (const [key, value] of Object.entries(own)) {
    Object.defineProperty(group, key, { value, configurable: true });
  }
  return { group, child };
}

/** What `afterMorph` was handed, and how far into the gesture it was called. */
const afterMorphCalls: {
  id: string;
  from: Kind;
  to: Kind;
  checkpoints: number;
}[] = [];

/**
 * The same declaration, made by a framework whose artefact is a COMPOSITE: the
 * selection is the wrapper, the kind is written on the child, and the wrapper
 * owes the change something of its own afterwards.
 */
const COMPOSITE_SPEC: MorphSpec<Kind> = {
  ...SPEC,
  modelType: TestGroup,
  resolveTarget: model =>
    (model as unknown as { child?: GfxPrimitiveElementModel }).child,
  afterMorph: (model, from, to) => {
    afterMorphCalls.push({
      id: model.id,
      from,
      to,
      // Read INSIDE the hook: the whole contract is that it runs after the
      // one checkpoint the gesture takes and before any other, so a second
      // `captureSync` — a second ctrl+z — would show up here.
      checkpoints: captureSync.mock.calls.length,
    });
  },
};

const config = morphToolbarConfig(SPEC);
const compositeConfig = morphToolbarConfig(COMPOSITE_SPEC);

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
const actionContent = (
  config.actions[0] as {
    content: (ctx: ToolbarContext) => TemplateResult | null;
  }
).content;

const shown = (models: unknown[], readonly = false) => {
  const ctx = context(models, readonly);
  const module = moduleWhen(ctx);
  expect(actionWhen(ctx)).toBe(module);
  return module;
};

/**
 * The rendered dropdown.
 *
 * This suite runs in vitest BROWSER mode (`vitest.config.ts` in this package:
 * chromium via playwright), so `document` is the real one and lit renders into
 * it — no jsdom shim and no new infrastructure. The custom elements are
 * deliberately NOT defined here: `isolate: false` means every spec file in this
 * package shares one page, so calling `effects()` would either throw on the
 * second file to try it or leak definitions across the suite. Unupgraded,
 * `editor-menu-button` and `editor-icon-button` still receive every attribute
 * binding, and lit sets property bindings (`.active`) as plain expandos — which
 * is exactly what these assertions read.
 */
describe('morphToolbarConfig — the rendered dropdown', () => {
  /**
   * Render one template into a host, and always take it away again — this
   * package runs `isolate: false`, so every spec file shares one page and a
   * host left behind is another file's problem.
   *
   * `await`ed inside the `try`, not returned from it: returning the promise
   * would run the `finally` — and so remove the host — before an async body had
   * made its assertions.
   */
  const draw = async (
    template: TemplateResult,
    body: (host: HTMLElement) => void | Promise<void>
  ) => {
    const host = document.createElement('div');
    document.body.append(host);
    try {
      render(template, host);
      await body(host);
    } finally {
      host.remove();
    }
  };

  const optionsOf = (host: HTMLElement) =>
    Array.from(
      host.querySelectorAll<HTMLElement & { active?: boolean }>(
        '[data-testid="element-morph-option"]'
      )
    );

  it('draws the whole family, in declaration order, under the entry testid', async () => {
    const ctx = context([node('task')]);
    const template = actionContent(ctx);
    // The mutation this whole case exists for: a `content` that returned `null`
    // satisfies every OTHER test in this file.
    expect(template).not.toBeNull();

    await draw(template!, host => {
      expect(
        host.querySelector('[data-testid="element-morph"]')
      ).not.toBeNull();

      const options = optionsOf(host);
      // One per family member, in the order the spec declared them — because
      // declaration order IS menu order.
      expect(options.map(el => el.getAttribute('data-value'))).toEqual([
        'task',
        'taskUser',
        'taskService',
      ]);
      // …and the family the selection is NOT in is nowhere in the menu.
      expect(options.map(el => el.getAttribute('data-value'))).not.toContain(
        'dataObject'
      );
    });
  });

  it('names every option with its resolved wording', async () => {
    const ctx = context([node('taskUser')]);
    await draw(actionContent(ctx)!, host => {
      // The label the host would translate, falling back to the declared
      // English because this context registers no `TranslationProvider`.
      expect(optionsOf(host).map(el => el.getAttribute('aria-label'))).toEqual([
        'Task',
        'User task',
        'Service task',
      ]);
    });
  });

  it('lights exactly one option, and it is what the selection is', async () => {
    const ctx = context([node('taskService')]);
    await draw(actionContent(ctx)!, host => {
      const active = optionsOf(host).filter(el => el.active === true);
      expect(active).toHaveLength(1);
      expect(active[0].getAttribute('data-value')).toBe('taskService');
    });
  });

  it('shows the most common kind as current across a multi-selection', async () => {
    const ctx = context([node('task'), node('task'), node('taskUser')]);
    await draw(actionContent(ctx)!, host => {
      const active = optionsOf(host).filter(el => el.active === true);
      expect(active).toHaveLength(1);
      expect(active[0].getAttribute('data-value')).toBe('task');
    });
  });

  it('morphs the selection when an option is clicked', async () => {
    const model = node('task');
    const ctx = context([model]);

    await draw(actionContent(ctx)!, host => {
      const target = optionsOf(host).find(
        el => el.getAttribute('data-value') === 'taskService'
      );
      expect(target).toBeDefined();

      // The gesture, not a call to `applyMorph`: this is the wiring between the
      // rendered button and the write, which nothing else in this file covers.
      target!.click();

      expect(model.surface.updateElement).toHaveBeenCalledWith(model.id, {
        kind: 'taskService',
        role: 'test:taskService',
        filled: false,
      });
      expect(ctx.track).toHaveBeenCalledWith(
        'FrameworkElementMorphed',
        expect.objectContaining({
          fromRole: 'test:task',
          toRole: 'test:taskService',
          elementCount: 1,
        })
      );
    });
  });

  it('draws nothing at all when the selection has nothing to become', () => {
    // `content` answers `null` on exactly the selections `when` refuses, so the
    // two can never disagree about whether there is an entry.
    expect(
      actionContent(context([node('task'), node('dataObject')]))
    ).toBeNull();
    expect(actionContent(context([]))).toBeNull();
  });
});

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

/**
 * The two hooks a COMPOSITE artefact needs — the whole of what separates C4's
 * declaration from BPMN's.
 *
 * `resolveTarget` is an indirection AND a gate: the patch has to land on the
 * element the kind lives on, and every wrapper that resolves to nothing has to
 * be refused rather than written to. `afterMorph` is the rest of what the
 * artefact owes the change, and its one hard requirement is that it happens
 * inside the same undo step.
 */
describe('morphToolbarConfig — a composite artefact', () => {
  const compositeWhen = compositeConfig.when as (
    ctx: ToolbarContext
  ) => boolean;

  beforeEach(() => {
    afterMorphCalls.length = 0;
    captureSync.mockClear();
  });

  it('writes the patch on the resolved child, never on the selection', () => {
    const { group, child } = composite('task');
    applyMorph(context([group]), COMPOSITE_SPEC, 'taskService');

    expect(child.surface.updateElement).toHaveBeenCalledWith(child.id, {
      kind: 'taskService',
      role: 'test:taskService',
      filled: false,
    });
    // The hazard this hook exists for: a patch on the wrapper would put `kind`
    // and `role` on an element that means nothing, and leave the shape as it
    // was.
    expect(group.surface.updateElement).not.toHaveBeenCalled();
    expect(child.clearField).toHaveBeenCalledWith('textVerticalAlign');
    expect(group.clearField).not.toHaveBeenCalled();
  });

  it('reads the current kind through the resolution too', () => {
    // `kindOf` is asked of the child, so the dropdown opens on what the SHAPE
    // is — the wrapper carries no kind at all.
    const { group } = composite('dataStore');
    expect(compositeWhen(context([group]))).toBe(true);

    const ctx = context([group]);
    applyMorph(ctx, COMPOSITE_SPEC, 'dataObject');
    expect(ctx.track).toHaveBeenCalledWith(
      'FrameworkElementMorphed',
      expect.objectContaining({
        fromRole: 'test:dataStore',
        toRole: 'test:dataObject',
      })
    );
  });

  it('refuses every wrapper the spec does not resolve', () => {
    // A plain group, another framework's component, a group of two of ours:
    // all of them answer `undefined`, and none of them is offered the menu…
    const { group } = composite('task', { orphan: true });
    expect(compositeWhen(context([group]))).toBe(false);

    // …nor written to when the write is attempted directly.
    applyMorph(context([group]), COMPOSITE_SPEC, 'taskUser');
    expect(group.surface.updateElement).not.toHaveBeenCalled();
  });

  it('refuses a mixed selection where only some wrappers resolve', () => {
    const mine = composite('task');
    const theirs = composite('task', { orphan: true });
    expect(compositeWhen(context([mine.group, theirs.group]))).toBe(false);
  });

  it('refuses a locked child under an unlocked wrapper', () => {
    // The lock the generic guard would miss: the wrapper is free to move and
    // the element the patch is aimed at is not.
    const { group } = composite('task', { childLocked: true });
    expect(compositeWhen(context([group]))).toBe(false);
  });

  it('calls afterMorph once per changed element, inside the one checkpoint', () => {
    const first = composite('task');
    const second = composite('taskService');
    const unchanged = composite('taskUser');

    applyMorph(
      context([first.group, second.group, unchanged.group]),
      COMPOSITE_SPEC,
      'taskUser'
    );

    // One checkpoint for the whole gesture — and the hook saw it already
    // taken, which is what makes its own writes part of the same ctrl+z.
    expect(captureSync).toHaveBeenCalledTimes(1);
    expect(afterMorphCalls).toEqual([
      { id: first.group.id, from: 'task', to: 'taskUser', checkpoints: 1 },
      {
        id: second.group.id,
        from: 'taskService',
        to: 'taskUser',
        checkpoints: 1,
      },
    ]);
  });

  it('hands afterMorph the SELECTED element, not the resolved one', () => {
    // What the hook has to reach is the rest of the composite — C4's type line
    // is a sibling of the shape, not a child of it.
    const { group, child } = composite('task');
    applyMorph(context([group]), COMPOSITE_SPEC, 'taskUser');

    expect(afterMorphCalls.map(call => call.id)).toEqual([group.id]);
    expect(afterMorphCalls.map(call => call.id)).not.toContain(child.id);
  });

  it('never calls afterMorph when nothing changed', () => {
    const { group } = composite('taskUser');
    applyMorph(context([group]), COMPOSITE_SPEC, 'taskUser');

    expect(afterMorphCalls).toHaveLength(0);
    expect(captureSync).not.toHaveBeenCalled();
  });

  it('leaves a spec that declares neither hook exactly as it was', () => {
    // The defaults are identity and nothing: BPMN's declaration is unchanged
    // by this feature, and this is the assertion that says so.
    const model = node('task');
    applyMorph(context([model]), SPEC, 'taskUser');

    expect(model.surface.updateElement).toHaveBeenCalledWith(
      model.id,
      expect.objectContaining({ kind: 'taskUser' })
    );
    expect(afterMorphCalls).toHaveLength(0);
  });
});
