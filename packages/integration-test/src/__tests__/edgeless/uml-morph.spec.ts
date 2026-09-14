import type { EdgelessRootBlockComponent } from '@labre/affine/blocks/root';
import { applyMorph, morphToolbarConfig } from '@labre/affine/blocks/surface';
// Straight off the framework package, as the bpmn, wardley and c4 specs already
// reach for theirs: `@labre/affine` re-exports the blocks, not the framework
// modules.
import {
  UML_EDGE_MORPH_SPEC,
  UML_MORPH_SPEC,
  UML_NAME_SEED,
  UML_ROLE,
  umlEdgeProps,
  umlMorphProps,
  umlNodeOfGroup,
} from '@labre/affine-gfx-uml';
import {
  ConnectorElementModel,
  GroupElementModel,
  PointStyle,
  TextElementModel,
  UmlNodeElementModel,
} from '@labre/affine/model';
import {
  ToolbarContext,
  ToolbarRegistryIdentifier,
  toolbarModuleKey,
} from '@labre/affine/shared/services';
import { getRegisteredCommands, runCommand } from '@labre/affine/std';
import {
  AFFINE_TOOLBAR_WIDGET,
  type AffineToolbarWidget,
} from '@labre/affine/widgets/toolbar';
import { render, type TemplateResult } from 'lit';
import { beforeEach, describe, expect, test } from 'vitest';

import { wait } from '../utils/common.js';
import { getDocRootBlock, getSurface } from '../utils/edgeless.js';
import { setupEditor } from '../utils/setup.js';

/**
 * Retyping a UML artefact — a classifier and a relationship — end to end.
 *
 * The unit suites own the two halves: when the generic dropdown stands up and
 * how its hooks behave (surface), and what UML's families, patches and name rule
 * say (gfx/uml). What only a real editor can answer is what a user actually
 * notices — that the group they clicked is the thing the toolbar offers the menu
 * on, that the patch lands on the SHAPE inside it, that the compartments and the
 * box do not move, that a line keeps both its ENDPOINTS, and that one ctrl+z
 * puts the artefact back.
 */
describe('morphing a UML artefact into a nearby kind', () => {
  let edgeless!: EdgelessRootBlockComponent;

  beforeEach(async () => {
    const cleanup = await setupEditor('edgeless');
    edgeless = getDocRootBlock(window.doc, window.editor, 'edgeless');
    return cleanup;
  });

  const surfaceModel = () => getSurface(window.doc, window.editor).model;

  /** Draw one classifier through the registered command, as the sub-menu does. */
  const draw = async (commandId: string) => {
    const command = getRegisteredCommands(edgeless.std).find(
      c => c.id === commandId
    );
    expect(command, commandId).toBeDefined();
    runCommand(edgeless.std, command!, {
      surface: 'senior-menu',
      source: 'toolbar:general',
    });
    await wait();

    const groups = surfaceModel().elementModels.filter(
      (model): model is GroupElementModel => model instanceof GroupElementModel
    );
    const group = groups[groups.length - 1];
    const node = umlNodeOfGroup(group);
    expect(node, commandId).toBeDefined();
    return { group, node: node as UmlNodeElementModel };
  };

  /** One tier of a component, by the role it carries. */
  const tierOf = (group: GroupElementModel, role: string) =>
    group.childElements.find(
      (child): child is TextElementModel =>
        child instanceof TextElementModel && child.role === role
    )!;

  /**
   * The selection made the way the real toolbar makes it: the widget derives
   * the flavour itself, so these cases prove the modules are registered on keys
   * the editor actually asks for.
   */
  const select = (...models: { id: string }[]) => {
    edgeless.gfx.selection.set({
      elements: models.map(model => model.id),
      editing: false,
    });
    const widget = edgeless.widgetComponents[
      AFFINE_TOOLBAR_WIDGET
    ] as AffineToolbarWidget;
    expect(widget).toBeDefined();

    const ctx = new ToolbarContext(edgeless.std);
    widget.updateWithSurface(
      ctx,
      true,
      models.map(model => model.id)
    );
    return ctx;
  };

  /** The `EditorToolbar` element the widget renders the row into. */
  const toolbar = () =>
    (
      edgeless.widgetComponents[AFFINE_TOOLBAR_WIDGET] as
        | { toolbar?: HTMLElement }
        | undefined
    )?.toolbar ?? null;

  const onRow = (selector: string) =>
    toolbar()?.querySelector(selector) ?? null;

  const frames = async (count = 4) => {
    for (let i = 0; i < count; i++) {
      await new Promise(resolve => requestAnimationFrame(resolve));
    }
  };

  /**
   * Select, then let the widget do the whole of its own work — the flavour, the
   * module lookup, the merge and the render are all the editor's, which is the
   * only way to find out whether the entry reaches the row a user looks at.
   */
  const selectAndRender = async (...ids: string[]) => {
    edgeless.gfx.selection.set({ elements: ids, editing: false });
    await wait(250);
    await edgeless.updateComplete;
    await frames();
  };

  /** Two classifiers and the relationship between them, as the tool arms it. */
  const drawRelationship = async (role = UML_ROLE.association) => {
    const from = await draw('uml.addClass');
    const to = await draw('uml.addClass');
    const surface = surfaceModel();
    const id = surface.addElement({
      type: 'connector',
      source: { id: from.node.id },
      target: { id: to.node.id },
      ...umlEdgeProps(
        role === UML_ROLE.association ? 'association' : 'generalization'
      ),
    });
    await wait();
    return surface.getElementById(id) as ConnectorElementModel;
  };

  /* ── Where the two modules are registered ────────────────────────────── */

  test('both entries are registered under the uml-morph owner', () => {
    const registry = edgeless.std.get(ToolbarRegistryIdentifier);

    // A classifier is a native `group`, and both group keys were claimed long
    // ago — the native group operations on one, Wardley's qualification
    // dropdown on the other — with C4's morph already hanging off a third. The
    // owner-suffixed variant is what lifts that ceiling.
    expect(
      registry
        .modulesFor('custom:affine:surface:group')
        .map(module => module.id.variant)
    ).toContain(toolbarModuleKey('custom:affine:surface:group', 'uml-morph'));
    // A relationship is a connector, and the same suffix keeps this addition
    // apart from whatever else the `custom:` twin of that row carries.
    expect(
      registry
        .modulesFor('custom:affine:surface:connector')
        .map(module => module.id.variant)
    ).toContain(
      toolbarModuleKey('custom:affine:surface:connector', 'uml-morph')
    );
  });

  test('the morph entry is drawn on the real row of a classifier', async () => {
    const { group } = await draw('uml.addClass');
    await selectAndRender(group.id);

    expect(toolbar()).not.toBeNull();
    expect(onRow('[data-testid="element-morph"]')).not.toBeNull();
  });

  /* ── A classifier becomes another metaclass ──────────────────────────── */

  test('a class becomes an interface, and only the keyword moves', async () => {
    const { group, node } = await draw('uml.addClass');
    const name = tierOf(group, UML_ROLE.name);
    const attributes = tierOf(group, UML_ROLE.attributes);
    const operations = tierOf(group, UML_ROLE.operations);

    const box = group.xywh;
    const shapeBox = node.xywh;
    const tierBoxes = [name.xywh, attributes.xywh, operations.xywh];
    const words = {
      attributes: attributes.text.toString(),
      operations: operations.text.toString(),
    };
    expect(node.kind).toBe('class');
    expect(name.text.toString()).toBe(UML_NAME_SEED.class);

    applyMorph(select(group), UML_MORPH_SPEC, 'interface');
    await wait(200);

    // What changed: the props that say what this artefact IS, on the SHAPE —
    // the child of the group the user actually selected.
    expect(node.kind).toBe('interface');
    expect(node.role).toBe(UML_ROLE.interface);
    expect(node.fillColor).toBe(umlMorphProps('interface').fillColor);
    // …and the one thing a reader sees: §9.5.4's keyword line. The seeded name
    // travels with it, because an unnamed class is not a name somebody wrote.
    expect(name.text.toString()).toBe(UML_NAME_SEED.interface);
    expect(name.text.toString().split('\n')[0]).toBe('«interface»');

    // …and nothing else a user could point at. Same elements, same ids, same
    // geometry — the compartments are what a delete-and-redraw would have cost.
    expect(node.xywh).toBe(shapeBox);
    expect(group.xywh).toBe(box);
    expect(group.role).toBeUndefined();
    expect(group.childElements).toHaveLength(4);
    expect(attributes.text.toString()).toBe(words.attributes);
    expect(operations.text.toString()).toBe(words.operations);
    expect([name.xywh, attributes.xywh, operations.xywh]).toEqual(tierBoxes);
    // The tier ROLES say which COMPARTMENT this is, never what kind of box it
    // belongs to, so the morph never touches them.
    expect(name.role).toBe(UML_ROLE.name);
    expect(operations.role).toBe(UML_ROLE.operations);
  });

  test('a name the author wrote survives, and gains the keyword', async () => {
    const { group, node } = await draw('uml.addClass');
    const name = tierOf(group, UML_ROLE.name);

    window.doc.transact(() => {
      name.text.delete(0, name.text.length);
      name.text.insert(0, 'Payments');
    });
    await wait();

    applyMorph(select(group), UML_MORPH_SPEC, 'interface');
    await wait(200);

    expect(node.kind).toBe('interface');
    // The notation's own line is written above the author's, and the author's
    // is still there — the brief's case, on a real document.
    expect(name.text.toString().split('\n')).toEqual([
      '«interface»',
      'Payments',
    ]);
  });

  test('one undo puts the classifier back', async () => {
    const { group, node } = await draw('uml.addClass');
    const name = tierOf(group, UML_ROLE.name);
    window.doc.captureSync();

    applyMorph(select(group), UML_MORPH_SPEC, 'enumeration');
    await wait(200);
    expect(node.kind).toBe('enumeration');
    expect(name.text.toString()).toBe(UML_NAME_SEED.enumeration);

    window.doc.undo();
    await wait(200);

    // ONE undo, and it takes the shape and the words the morph rewrote with it
    // — `afterMorph` runs inside the same `captureSync`, so there is no second
    // step where the keyword is gone and the kind is not.
    expect(node.kind).toBe('class');
    expect(name.text.toString()).toBe(UML_NAME_SEED.class);
  });

  test('the dropdown draws the classifier family, with the current one lit', async () => {
    const { group, node } = await draw('uml.addClass');
    const ctx = select(group);

    const config = morphToolbarConfig(UML_MORPH_SPEC);
    const action = config.actions[0] as {
      content: (ctx: ToolbarContext) => TemplateResult | null;
    };
    const template = action.content(ctx);
    expect(template).not.toBeNull();

    const host = document.createElement('div');
    document.body.append(host);
    try {
      render(template, host);
      await wait();

      const options = Array.from(
        host.querySelectorAll('[data-testid="element-morph-option"]')
      );
      // Declaration order is menu order, and it opens on the plain class.
      expect(options.map(el => el.getAttribute('data-value'))).toEqual([
        'class',
        'interface',
        'enumeration',
      ]);
      const active = options.filter(
        el => (el as HTMLElement & { active?: boolean }).active
      );
      expect(active).toHaveLength(1);
      expect(active[0].getAttribute('data-value')).toBe('class');

      // …and clicking one is the gesture a user performs: same shape, new
      // metaclass, through the real dropdown rather than through `applyMorph`.
      (
        options.find(el => el.getAttribute('data-value') === 'interface') as
          | HTMLElement
          | undefined
      )?.click();
      await wait(200);
      expect(node.kind).toBe('interface');
      expect(tierOf(group, UML_ROLE.name).text.toString()).toBe(
        UML_NAME_SEED.interface
      );
    } finally {
      host.remove();
    }
  });

  test('a package and a plain group are offered nothing', async () => {
    const config = morphToolbarConfig(UML_MORPH_SPEC);
    const refuses = (...models: { id: string }[]) => {
      const ctx = select(...models);
      return typeof config.when === 'function' ? config.when(ctx) : config.when;
    };

    // A package is a namespace, not another drawing of a classifier: it is
    // alone in its family, so there is no menu at all.
    const pkg = await draw('uml.addPackage');
    expect(refuses(pkg.group)).toBe(false);

    // A lasso somebody drew round two shapes: a group, and not one of ours.
    const surface = surfaceModel();
    const first = surface.addElement({
      type: 'shape',
      shapeType: 'rect',
      xywh: '[0,0,100,100]',
    });
    const second = surface.addElement({
      type: 'shape',
      shapeType: 'rect',
      xywh: '[200,0,100,100]',
    });
    const plainId = surface.addElement({
      type: 'group',
      children: { [first]: true, [second]: true },
    });
    await wait();
    const plain = surface.getElementById(plainId) as GroupElementModel;
    expect(umlNodeOfGroup(plain)).toBeUndefined();
    expect(refuses(plain)).toBe(false);

    // …and one classifier beside it is still nothing: the resolution is per
    // element, so a selection the menu could only half answer is refused whole.
    const cls = await draw('uml.addClass');
    expect(refuses(cls.group, plain)).toBe(false);
    expect(refuses(cls.group)).toBe(true);
  });

  /* ── A relationship becomes another relationship ─────────────────────── */

  test('an association becomes a composition, endpoints and all', async () => {
    const edge = await drawRelationship();
    expect(UML_EDGE_MORPH_SPEC.kindOf(edge)).toBe('association');
    const source = edge.source.id;
    const target = edge.target.id;
    expect(edge.frontEndpointStyle).toBe(PointStyle.None);

    applyMorph(select(edge), UML_EDGE_MORPH_SPEC, 'composition');
    await wait(200);

    // The meaning AND the drawing: §11.5.4's filled diamond on the whole's end,
    // which is the source end of `uml:composition` (`roles.ts`).
    expect(edge.role).toBe(UML_ROLE.composition);
    expect(edge.frontEndpointStyle).toBe(PointStyle.Diamond);
    expect(edge.frontEndpointStyle).toBe('Diamond');
    expect(edge.rearEndpointStyle).toBe(PointStyle.None);

    // …and the reason an edge morph is worth having at all: both ends are still
    // attached to the classifiers the author dragged them onto.
    expect(edge.source.id).toBe(source);
    expect(edge.target.id).toBe(target);
  });

  test('a plain connector is offered nothing', async () => {
    const surface = surfaceModel();
    const id = surface.addElement({
      type: 'connector',
      source: { position: [0, 0] },
      target: { position: [100, 100] },
    });
    await wait();
    const plain = surface.getElementById(id) as ConnectorElementModel;

    // A line drawn with the ordinary connector tool carries no role, so there
    // is nothing for this menu to be about.
    expect(UML_EDGE_MORPH_SPEC.kindOf(plain)).toBeUndefined();
    const config = morphToolbarConfig(UML_EDGE_MORPH_SPEC);
    const ctx = select(plain);
    expect(
      typeof config.when === 'function' ? config.when(ctx) : config.when
    ).toBe(false);
  });

  test('the morph entry is drawn on the real row of a relationship', async () => {
    const edge = await drawRelationship();
    await selectAndRender(edge.id);

    expect(toolbar()).not.toBeNull();
    expect(onRow('[data-testid="element-morph"]')).not.toBeNull();
  });
});
