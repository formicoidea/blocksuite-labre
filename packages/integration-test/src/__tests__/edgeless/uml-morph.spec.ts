import type { EdgelessRootBlockComponent } from '@labre/affine/blocks/root';
import { applyMorph, morphToolbarConfig } from '@labre/affine/blocks/surface';
// Straight off the framework package, as the bpmn, wardley and c4 specs already
// reach for theirs: `@labre/affine` re-exports the blocks, not the framework
// modules.
import {
  UML_BARE_MORPH_SPEC,
  UML_EDGE_MORPH_SPEC,
  UML_MORPH_SPEC,
  UML_NAME_SEED,
  UML_ROLE,
  umlEdgeProps,
  umlMorphProps,
  umlNodeOfGroup,
} from '@labre/affine-gfx-uml';
import { getFontString, getLineHeight, wrapText } from '@labre/affine/gfx/text';
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

  /**
   * Draw one of phase 2's BARE marks — the routing shapes §15.3.4 and §14.2.4
   * name none of, which are created as the shape alone and therefore have no
   * group for `umlNodeOfGroup` to resolve.
   */
  const drawBare = async (commandId: string) => {
    const command = getRegisteredCommands(edgeless.std).find(
      c => c.id === commandId
    );
    expect(command, commandId).toBeDefined();
    runCommand(edgeless.std, command!, {
      surface: 'senior-menu',
      source: 'toolbar:general',
    });
    await wait();

    const nodes = surfaceModel().elementModels.filter(
      (model): model is UmlNodeElementModel =>
        model instanceof UmlNodeElementModel
    );
    const node = nodes[nodes.length - 1];
    expect(node, commandId).toBeDefined();
    // The whole point of this fixture: nothing was grouped with it.
    expect(umlNodeOfGroup(node), commandId).toBeUndefined();
    return node;
  };

  /** One tier of a component, by the role it carries. */
  const tierOf = (group: GroupElementModel, role: string) =>
    group.childElements.find(
      (child): child is TextElementModel =>
        child instanceof TextElementModel && child.role === role
    )!;

  /**
   * How tall the canvas renderer PAINTS this tier — the renderer's own wrap at
   * the compartment's width, times its own line height.
   *
   * Never a line count: a tier is created with `hasMaxWidth`, so a long line is
   * broken before it is drawn, and "how many lines did the author type" is not
   * the question a compartment has to fit.
   */
  const paintedHeight = (tier: TextElementModel) => {
    const font = getFontString(tier);
    const [, , w] = tier.deserializedXYWH;
    const lines = tier.text
      .toString()
      .split('\n')
      .reduce(
        (total, line) => total + wrapText(line, font, w).split('\n').length,
        0
      );
    return (
      lines * getLineHeight(tier.fontFamily, tier.fontSize, tier.fontWeight)
    );
  };

  /** Whether the compartment is tall enough for the words that are in it. */
  const nameFits = (tier: TextElementModel) =>
    tier.deserializedXYWH[3] + 0.5 >= paintedHeight(tier);

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
    // …and phase 2's routing marks are neither: they are created as the shape
    // alone, so the widget derives `affine:surface:umlNode` from `model.type`
    // and the row a user sees is that one. A third registration, under the same
    // owner suffix and sharing the same families.
    expect(
      registry
        .modulesFor('custom:affine:surface:umlNode')
        .map(module => module.id.variant)
    ).toContain(toolbarModuleKey('custom:affine:surface:umlNode', 'uml-morph'));
  });

  test('the morph entry is drawn on the real row of a classifier', async () => {
    const { group } = await draw('uml.addClass');
    await selectAndRender(group.id);

    expect(toolbar()).not.toBeNull();
    expect(onRow('[data-testid="element-morph"]')).not.toBeNull();
  });

  test('the morph entry is drawn on the row of a BARE mark too', async () => {
    // The regression this closes: an activity final is created as the shape
    // alone, so a click selects a `umlNode` and the group spec resolves
    // nothing for it — three whole families had a dropdown nobody could open.
    const mark = await drawBare('uml.addActivityFinal');
    await selectAndRender(mark.id);

    expect(toolbar()).not.toBeNull();
    expect(onRow('[data-testid="element-morph"]')).not.toBeNull();
  });

  /* ── A bare mark becomes its sibling ─────────────────────────────────── */

  test('an activity final becomes a flow final, and nothing moves', async () => {
    const mark = await drawBare('uml.addActivityFinal');
    const box = mark.xywh;
    expect(mark.kind).toBe('activity-final');
    expect(mark.role).toBe(UML_ROLE['activity-final']);

    applyMorph(select(mark), UML_BARE_MORPH_SPEC, 'flow-final');
    await wait(200);

    // §15.3.4's distinction, made after the fact: the bullseye ends the whole
    // activity, the crossed circle ends ONE token. The patch lands on the very
    // element the user selected — there is no composite to resolve.
    expect(mark.kind).toBe('flow-final');
    expect(mark.role).toBe(UML_ROLE['flow-final']);
    expect(mark.strokeColor).toBe(umlMorphProps('flow-final').strokeColor);
    // Geometry is the user's, and a mark carries no words for anything to do
    // to: no group appeared, and none was needed.
    expect(mark.xywh).toBe(box);
    expect(umlNodeOfGroup(mark)).toBeUndefined();
  });

  test('one undo puts the bare mark back', async () => {
    const mark = await drawBare('uml.addEntryPoint');
    expect(mark.kind).toBe('entry-point');

    applyMorph(select(mark), UML_BARE_MORPH_SPEC, 'exit-point');
    await wait(200);
    expect(mark.kind).toBe('exit-point');

    window.doc.undo();
    await wait(200);
    expect(mark.kind).toBe('entry-point');
    expect(mark.role).toBe(UML_ROLE['entry-point']);
  });

  /* ── A classifier becomes another metaclass ──────────────────────────── */

  test('a class becomes an interface, and only the keyword moves', async () => {
    const { group, node } = await draw('uml.addClass');
    const name = tierOf(group, UML_ROLE.name);
    const attributes = tierOf(group, UML_ROLE.attributes);
    const operations = tierOf(group, UML_ROLE.operations);

    const shapeBox = node.xywh;
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
    // words — the compartments are what a delete-and-redraw would have cost.
    expect(node.xywh).toBe(shapeBox);
    expect(group.role).toBeUndefined();
    expect(group.childElements).toHaveLength(4);
    expect(attributes.text.toString()).toBe(words.attributes);
    expect(operations.text.toString()).toBe(words.operations);
    // The tier ROLES say which COMPARTMENT this is, never what kind of box it
    // belongs to, so the morph never touches them.
    expect(name.role).toBe(UML_ROLE.name);
    expect(operations.role).toBe(UML_ROLE.operations);

    // The NAME COMPARTMENT is the one box that does move, and it has to: the
    // keyword is a LINE (§9.5.4), so a one-line heading became a two-line one.
    // The PO's recette of 14/09/2026 found the second line painted straight
    // through the rule under it, because nothing re-laid the component for a
    // morph — the watcher listens for an editor closing, and a morph opens none.
    expect(nameFits(name)).toBe(true);
    const [, , , nameHeight] = name.deserializedXYWH;
    expect(nameHeight).toBeGreaterThan(paintedHeight(name) - 1);
    // …and the tier under it starts below the heading, not inside it.
    expect(attributes.deserializedXYWH[1]).toBeGreaterThanOrEqual(
      name.deserializedXYWH[1] + nameHeight
    );
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
    // …and it has somewhere to be written: the compartment grew with it.
    expect(nameFits(name)).toBe(true);
  });

  /**
   * « Le titre va accumuler «interface» » — the PO's own words, 14/09/2026.
   *
   * A compartment can already carry the keyword the morph is about to write: an
   * import, a paste from a tool that spells it out, or an author typing it by
   * hand all produce a shape whose `kind` and whose name compartment disagree.
   * The rewrite used to stack a second line on top, and a third on the next
   * morph. One keyword, once, however it got there.
   */
  test('the keyword is written once, never stacked', async () => {
    const { group, node } = await draw('uml.addClass');
    const name = tierOf(group, UML_ROLE.name);

    window.doc.transact(() => {
      name.text.delete(0, name.text.length);
      name.text.insert(0, '«interface»\nLigne');
    });
    await wait();

    applyMorph(select(group), UML_MORPH_SPEC, 'interface');
    await wait(200);

    expect(node.kind).toBe('interface');
    expect(name.text.toString().split('\n')).toEqual(['«interface»', 'Ligne']);
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
