import type { EdgelessRootBlockComponent } from '@labre/affine/blocks/root';
import { applyMorph, morphToolbarConfig } from '@labre/affine/blocks/surface';
// Straight off the framework package, as the bpmn and wardley specs already
// reach for theirs: `@labre/affine` re-exports the blocks, not the framework
// modules.
import {
  C4_MORPH_SPEC,
  C4_ROLE,
  C4_TYPE_PLACEHOLDER,
  c4MorphProps,
  c4NodeOfComponent,
} from '@labre/affine-gfx-c4';
import {
  C4NodeElementModel,
  GroupElementModel,
  TextElementModel,
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
 * Morphing a C4 component into a nearby kind, end to end.
 *
 * The unit suites own the two halves: when the generic dropdown stands up and
 * how its two composite hooks behave (surface), and what C4's families, patch
 * and caption rule say (gfx/c4). What only a real editor can answer is what a
 * user actually notices — that the group they clicked is the thing the toolbar
 * offers the menu on, that the patch lands on the SHAPE inside it, that the
 * three tiers of words and the box do not move, and that one ctrl+z puts the
 * component back.
 */
describe('morphing a C4 component into a nearby kind', () => {
  let edgeless!: EdgelessRootBlockComponent;

  beforeEach(async () => {
    const cleanup = await setupEditor('edgeless');
    edgeless = getDocRootBlock(window.doc, window.editor, 'edgeless');
    return cleanup;
  });

  /** Draw one component through the registered command, as the sub-menu does. */
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

    const surface = getSurface(window.doc, window.editor).model;
    const groups = surface.elementModels.filter(
      (model): model is GroupElementModel => model instanceof GroupElementModel
    );
    const group = groups[groups.length - 1];
    const node = c4NodeOfComponent(group);
    expect(node, commandId).toBeDefined();
    return { group, node: node as C4NodeElementModel };
  };

  /** The three tiers of a component, by the role each carries. */
  const tiersOf = (group: GroupElementModel) => {
    const texts = group.childElements.filter(
      (child): child is TextElementModel => child instanceof TextElementModel
    );
    const by = (role: string) => texts.find(text => text.role === role)!;
    return {
      title: by(C4_ROLE.title),
      typeLine: by(C4_ROLE['type-line']),
      description: by(C4_ROLE.description),
    };
  };

  /**
   * The selection made the way the real toolbar makes it: the widget derives
   * the flavour itself, so these cases prove the module is registered on a key
   * the editor actually asks for — which for a composite is the whole risk.
   */
  const select = (...groups: GroupElementModel[]) => {
    edgeless.gfx.selection.set({
      elements: groups.map(group => group.id),
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
      groups.map(group => group.id)
    );
    return ctx;
  };

  /* ── The row the user actually sees ──────────────────────────────────── */

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
   * Select, then let the widget do the whole of its own work.
   *
   * `select` above drives `updateWithSurface` by hand, which is deterministic
   * and right for the cases about the MORPH. This one sets the canvas
   * selection and nothing else, so the flavour, the module lookup, the merge
   * and the render are all the editor's — which is the only way to find out
   * whether the entry reaches the row a user is looking at.
   */
  const selectAndRender = async (...ids: string[]) => {
    edgeless.gfx.selection.set({ elements: ids, editing: false });
    await wait(250);
    await edgeless.updateComplete;
    await frames();
  };

  /** A Wardley component: the circle that carries the role, and its label. */
  const addWardleyComponent = () => {
    const surface = getSurface(window.doc, window.editor).model;
    const node = surface.addElement({
      type: 'wardleyNode',
      kind: 'component',
      role: 'wardley:component',
      xywh: '[900,900,60,60]',
    });
    const label = surface.addElement({
      type: 'text',
      text: 'Payments',
      role: 'wardley:label',
      xywh: '[970,910,120,26]',
    });
    return surface.addElement({
      type: 'group',
      children: { [node]: true, [label]: true },
    });
  };

  test('the entry is registered on the group flavour, beside Wardley own', () => {
    const registry = edgeless.std.get(ToolbarRegistryIdentifier);
    const key = toolbarModuleKey('custom:affine:surface:group', 'c4-morph');
    const modules = registry.modulesFor('custom:affine:surface:group');

    // Both group keys were taken — the native group operations on one, the
    // Wardley qualification dropdown on the other — so the morph is registered
    // under an owner-suffixed variant and merged into the same row.
    expect(modules.map(module => module.id.variant)).toContain(key);
    expect(modules.length).toBeGreaterThan(1);
    expect(registry.getModuleBy('affine:surface:group')).toBeTruthy();
    // The bare-key question still answers about the bare key: Wardley's module
    // defines this row, C4's is an addition to it.
    expect(modules.map(module => module.id.variant)[0]).toBe(
      'custom:affine:surface:group'
    );
  });

  /**
   * The claim the registry test above cannot make: that the entry reaches the
   * row a user is looking at.
   *
   * Everything else in this file drives `updateWithSurface` or calls
   * `applyMorph` directly, and every one of those would still pass against a
   * registry that had gone back to one module per key — the module would simply
   * never be merged into the rendered row and nobody would notice. So these two
   * cases set the canvas selection and read the toolbar's own DOM, with the
   * flavour resolution, the module lookup, the `when` filter, the id merge and
   * the render all left to the editor.
   *
   * They are two cases and not one because "two contributors on one flavour" is
   * two claims, and no single element can carry both: a C4 component's tiers
   * carry `c4:*` roles, so Wardley's qualification dropdown correctly stands
   * down on it, and a Wardley component carries no `kind` the C4 morph knows.
   * What has to hold is that EACH module reaches the row of the element it is
   * about — the suffixed one as much as the bare one.
   */
  test('the morph entry is drawn on the real row of a C4 component', async () => {
    const { group } = await draw('c4.addContainer');
    await selectAndRender(group.id);

    expect(toolbar()).not.toBeNull();
    expect(onRow('[data-testid="element-morph"]')).not.toBeNull();
    // Wardley's module is on this very flavour and correctly says nothing
    // here: its `when` asks about roles this element does not carry.
    expect(onRow('[data-testid="element-tags-entry"]')).toBeNull();
  });

  test('the bare module on the same flavour still reaches its own row', async () => {
    // The regression the grouping could have caused: a Wardley component is
    // also a group, and its qualification dropdown is registered under the BARE
    // `custom:affine:surface:group`. If `modulesFor` dropped bare modules — or
    // returned only the first of a flavour — this row would come up empty.
    const wardley = addWardleyComponent();
    await wait();
    await selectAndRender(wardley);

    expect(onRow('[data-testid="element-tags-entry"]')).not.toBeNull();
    expect(onRow('[data-testid="element-morph"]')).toBeNull();
  });

  test('a container becomes a database, and only the shape changes', async () => {
    const { group, node } = await draw('c4.addContainer');
    const tiers = tiersOf(group);

    const box = group.xywh;
    const shapeBox = node.xywh;
    const words = {
      title: tiers.title.text.toString(),
      typeLine: tiers.typeLine.text.toString(),
      description: tiers.description.text.toString(),
    };
    const tierBoxes = [
      tiers.title.xywh,
      tiers.typeLine.xywh,
      tiers.description.xywh,
    ];
    expect(node.kind).toBe('container');
    expect(node.filled).toBe(true);

    applyMorph(select(group), C4_MORPH_SPEC, 'database');
    await wait(200);

    // What changed: the props that say what this artefact IS, on the SHAPE —
    // the child of the group the user actually selected.
    expect(node.kind).toBe('database');
    expect(node.role).toBe(C4_ROLE.database);
    // …including the appearance a `{kind, role}` patch would have left behind:
    // a cylinder is drawn by the renderer, so the native body must stop
    // painting or the rectangle stays behind it.
    expect(node.filled).toBe(false);
    expect(node.strokeStyle).toBe(c4MorphProps('database').strokeStyle);
    // The level is the colour, and a database is still a container.
    expect(node.fillColor).toBe(c4MorphProps('container').fillColor);

    // …and nothing else a user could point at. Same elements, same ids, same
    // geometry — the group is the one thing morph must not rewrite.
    expect(node.xywh).toBe(shapeBox);
    expect(group.xywh).toBe(box);
    expect(group.role).toBeUndefined();
    expect(group.childElements).toHaveLength(4);
    const after = tiersOf(group);
    // The one tier that moves, and it moves because it MUST: the title of a
    // component nobody has named is the kind's own prompt, and a cylinder
    // captioned "Container" is a picture contradicting itself.
    expect(words.title).toBe('Container');
    expect(after.title.text.toString()).toBe('Database');
    expect(after.description.text.toString()).toBe(words.description);
    expect([
      after.title.xywh,
      after.typeLine.xywh,
      after.description.xywh,
    ]).toEqual(tierBoxes);
    // The tier ROLES are about which LINE this is, never about what kind of
    // box it belongs to, so the morph never touches them.
    expect(after.title.role).toBe(C4_ROLE.title);
    expect(after.typeLine.role).toBe(C4_ROLE['type-line']);
  });

  test('the caption keeps saying what the shape is', async () => {
    const { group, node } = await draw('c4.addContainer');
    const typeLine = tiersOf(group).typeLine;
    expect(typeLine.text.toString()).toBe(C4_TYPE_PLACEHOLDER.container);

    applyMorph(select(group), C4_MORPH_SPEC, 'mobile');
    await wait(200);

    expect(node.kind).toBe('mobile');
    // Inert inside this family and asserted anyway: every member of it
    // announces itself `[Container: …]`, so the caption a reader sees is
    // unchanged BECAUSE the notation says so, not because nothing ran.
    expect(typeLine.text.toString()).toBe(C4_TYPE_PLACEHOLDER.mobile);
    expect(typeLine.text.toString()).toBe(C4_TYPE_PLACEHOLDER.container);
  });

  test('a name the author wrote survives the morph', async () => {
    // The other half of the title rule, and the one that matters most: the
    // prompt follows the shape, and content never does. A component called
    // "Customer database" is called that whatever silhouette it ends up with.
    const { group, node } = await draw('c4.addContainer');
    const title = tiersOf(group).title;

    window.doc.transact(() => {
      title.text.delete(0, title.text.length);
      title.text.insert(0, 'Customer database');
    });
    await wait();

    applyMorph(select(group), C4_MORPH_SPEC, 'database');
    await wait(200);

    expect(node.kind).toBe('database');
    expect(title.text.toString()).toBe('Customer database');
  });

  test('a technology the author stated survives the morph', async () => {
    const { group, node } = await draw('c4.addContainer');
    const typeLine = tiersOf(group).typeLine;

    window.doc.transact(() => {
      typeLine.text.delete(0, typeLine.text.length);
      typeLine.text.insert(0, '[Container: React]');
    });
    await wait();

    applyMorph(select(group), C4_MORPH_SPEC, 'browser');
    await wait(200);

    expect(node.kind).toBe('browser');
    // The half of the line the author owns is theirs, whatever the shape
    // becomes.
    expect(typeLine.text.toString()).toBe('[Container: React]');
  });

  test('one undo puts the component back', async () => {
    const { group, node } = await draw('c4.addPerson');
    const title = tiersOf(group).title;
    window.doc.captureSync();
    expect(title.text.toString()).toBe('Person');

    applyMorph(select(group), C4_MORPH_SPEC, 'person-ext');
    await wait(200);
    expect(node.kind).toBe('person-ext');
    expect(title.text.toString()).toBe('External person');
    const grey = node.fillColor;

    window.doc.undo();
    await wait(200);

    // ONE undo, and it takes the shape and the words the morph rewrote with
    // it — `afterMorph` runs inside the same `captureSync`, so there is no
    // second step where the cylinder is back and the caption is not.
    expect(node.kind).toBe('person');
    expect(node.fillColor).not.toBe(grey);
    expect(title.text.toString()).toBe('Person');
  });

  test('the dropdown draws the container family, with the current one lit', async () => {
    const { group, node } = await draw('c4.addContainer');
    const ctx = select(group);

    const config = morphToolbarConfig(C4_MORPH_SPEC);
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
      // Declaration order is menu order, and it opens on the plain container.
      expect(options.map(el => el.getAttribute('data-value'))).toEqual([
        'container',
        'database',
        'mobile',
        'browser',
      ]);
      const active = options.filter(
        el => (el as HTMLElement & { active?: boolean }).active
      );
      expect(active).toHaveLength(1);
      expect(active[0].getAttribute('data-value')).toBe('container');

      // …and clicking one is the gesture: same shape, new kind.
      (
        options.find(el => el.getAttribute('data-value') === 'database') as
          | HTMLElement
          | undefined
      )?.click();
      await wait(200);
      expect(node.kind).toBe('database');
    } finally {
      host.remove();
    }
  });

  test('a component is offered nothing outside its own level', async () => {
    const { group } = await draw('c4.addComponent');
    const config = morphToolbarConfig(C4_MORPH_SPEC);
    const ctx = select(group);

    // A component is a PART of a container, not another drawing of one: it is
    // in no family, so there is no menu at all.
    expect(
      typeof config.when === 'function' ? config.when(ctx) : config.when
    ).toBe(false);
  });

  test('a plain group and a mixed selection are offered nothing', async () => {
    const surface = getSurface(window.doc, window.editor).model;
    const config = morphToolbarConfig(C4_MORPH_SPEC);
    const container = await draw('c4.addContainer');

    // A lasso somebody drew round two shapes: a group, and not one of ours.
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

    const refuses = (...groups: GroupElementModel[]) => {
      const ctx = select(...groups);
      return typeof config.when === 'function' ? config.when(ctx) : config.when;
    };

    expect(refuses(plain)).toBe(false);
    // …and one C4 component beside it is still nothing: the resolution is per
    // element, so a selection the menu could only half answer is refused whole.
    expect(refuses(container.group, plain)).toBe(false);
    // The component alone, on the other hand, is offered its family.
    expect(refuses(container.group)).toBe(true);
  });
});
