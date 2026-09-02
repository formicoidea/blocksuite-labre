import type { EdgelessRootBlockComponent } from '@labre/affine/blocks/root';
import { applyMorph, morphToolbarConfig } from '@labre/affine/blocks/surface';
// Straight off the framework package, as the bpmn and c4 specs already reach
// for theirs: `@labre/affine` re-exports the blocks, not the framework modules.
import {
  WARDLEY_MORPH_SPEC,
  WARDLEY_NODE_LABEL,
  WARDLEY_NODE_SIZE,
  WARDLEY_ROLE,
  wardleyMorphProps,
  wardleyNodeOfComponent,
} from '@labre/affine-gfx-wardley';
import {
  ConnectorElementModel,
  GroupElementModel,
  TextElementModel,
  WardleyNodeElementModel,
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
 * Morphing a Wardley artefact into a nearby one, end to end.
 *
 * The unit suites own the two halves: when the generic dropdown stands up and
 * how its two composite hooks behave (surface), and what Wardley's family,
 * patch, resolution and structural rewrite say (gfx/wardley). What only a real
 * editor can answer is what a user actually notices — that the group they
 * clicked is the thing the toolbar offers the menu on, that a market arrives
 * with the three dots that MAKE it a market, that the dependency they drew
 * survives a pipeline's handle appearing under it, and that one ctrl+z puts the
 * component back whole.
 */
describe('morphing a Wardley artefact into a nearby one', () => {
  let edgeless!: EdgelessRootBlockComponent;

  beforeEach(async () => {
    const cleanup = await setupEditor('edgeless');
    edgeless = getDocRootBlock(window.doc, window.editor, 'edgeless');
    return cleanup;
  });

  const surfaceModel = () => getSurface(window.doc, window.editor).model;

  /** Draw one artefact through the registered command, as the sub-menu does. */
  const drawGroup = async (commandId: string) => {
    const command = getRegisteredCommands(edgeless.std).find(
      c => c.id === commandId
    );
    expect(command, commandId).toBeDefined();
    runCommand(edgeless.std, command!, {
      surface: 'senior-menu',
      source: 'toolbar:general',
    });
    await wait();

    // The OUTER group: a pipeline nests (handle + label) inside its own, so the
    // last group in document order is not always the one a click selects.
    const groups = surfaceModel().elementModels.filter(
      (model): model is GroupElementModel =>
        model instanceof GroupElementModel && model.group === null
    );
    return groups[groups.length - 1];
  };

  /** …and the node the morph is about, for the kinds that have one. */
  const draw = async (commandId: string) => {
    const group = await drawGroup(commandId);
    const node = wardleyNodeOfComponent(group);
    expect(node, commandId).toBeDefined();
    return { group, node: node as WardleyNodeElementModel };
  };

  /** Everything under a group, the nested pipeline sub-group included. */
  const flat = (group: GroupElementModel): unknown[] =>
    group.childElements.flatMap(child =>
      child instanceof GroupElementModel ? [child, ...flat(child)] : [child]
    );

  const nodesOf = (group: GroupElementModel) =>
    flat(group).filter(
      (child): child is WardleyNodeElementModel =>
        child instanceof WardleyNodeElementModel
    );

  const linksOf = (group: GroupElementModel) =>
    flat(group).filter(
      (child): child is ConnectorElementModel =>
        child instanceof ConnectorElementModel
    );

  const labelOf = (group: GroupElementModel) =>
    flat(group).find(
      (child): child is TextElementModel => child instanceof TextElementModel
    )!;

  const centreOf = (model: { deserializedXYWH: number[] }) => {
    const [x, y, w, h] = model.deserializedXYWH;
    return [x + w / 2, y + h / 2];
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

  const allOnRow = (selector: string) =>
    Array.from(toolbar()?.querySelectorAll(selector) ?? []);

  const frames = async (count = 4) => {
    for (let i = 0; i < count; i++) {
      await new Promise(resolve => requestAnimationFrame(resolve));
    }
  };

  /** Select, then let the widget do the whole of its own work. */
  const selectAndRender = async (...ids: string[]) => {
    edgeless.gfx.selection.set({ elements: ids, editing: false });
    await wait(250);
    await edgeless.updateComplete;
    await frames();
  };

  test('the entry is registered on the group flavour, beside its own tags', () => {
    const registry = edgeless.std.get(ToolbarRegistryIdentifier);
    const key = toolbarModuleKey(
      'custom:affine:surface:group',
      'wardley-morph'
    );
    const modules = registry.modulesFor('custom:affine:surface:group');

    // Three claims on one flavour now: Wardley's qualification dropdown on the
    // bare key, and one owner-suffixed morph per framework whose artefact is a
    // group. Without the suffix the fourth registration would have thrown
    // before the editor finished setting up.
    expect(modules.map(module => module.id.variant)).toContain(key);
    expect(modules.map(module => module.id.variant)).toContain(
      toolbarModuleKey('custom:affine:surface:group', 'c4-morph')
    );
    expect(modules.map(module => module.id.variant)[0]).toBe(
      'custom:affine:surface:group'
    );
  });

  test('both of Wardley own entries are drawn on a component real row', async () => {
    const { group } = await draw('wardley.addComponent');
    await selectAndRender(group.id);

    expect(toolbar()).not.toBeNull();
    // The morph, from the suffixed module…
    expect(onRow('[data-testid="element-morph"]')).not.toBeNull();
    // …and the qualification dropdown, from the bare one: one element, two
    // modules of the SAME framework, both merged into the row a user is
    // looking at.
    expect(onRow('[data-testid="element-tags-entry"]')).not.toBeNull();
    // EXACTLY one morph, and this is the case that only became possible to get
    // wrong once four frameworks claimed this flavour: `custom:affine:surface:
    // group` now carries C4's morph, event storming's, core domain's and this
    // one, and every one of them is registered on the row of ANY group. What
    // keeps a Wardley component showing one dropdown rather than four is each
    // spec's `resolveTarget` refusing a composite that is not its own — a
    // refusal no unit suite can observe across framework boundaries.
    expect(allOnRow('[data-testid="element-morph"]')).toHaveLength(1);
  });

  test('a component becomes a market, glyph and all', async () => {
    const { group, node } = await draw('wardley.addComponent');
    const before = centreOf(node);
    expect(node.kind).toBe('component');
    expect(labelOf(group).text.toString()).toBe(WARDLEY_NODE_LABEL.component);

    applyMorph(select(group), WARDLEY_MORPH_SPEC, 'market');
    await wait(200);

    // What changed: the props that say what this artefact IS, on the NODE — the
    // child of the group the user actually selected.
    expect(node.kind).toBe('market');
    expect(node.role).toBe(WARDLEY_ROLE.market);
    expect(node.strokeWidth).toBe(wardleyMorphProps('market').strokeWidth);
    // …the canonical size, centred where the component already stood. The
    // DEVIATION from BPMN and C4, and the reason for it: at a component's 18
    // pixels a market is an unreadable smudge with three dots crammed into it.
    expect(node.deserializedXYWH.slice(2)).toEqual([
      WARDLEY_NODE_SIZE.market.w,
      WARDLEY_NODE_SIZE.market.h,
    ]);
    expect(centreOf(node)).toEqual(before);

    // …and the glyph a market IS: three role-less dots, wired into a triangle.
    const dots = nodesOf(group).filter(child => child.role === undefined);
    expect(dots).toHaveLength(3);
    expect(linksOf(group)).toHaveLength(3);
    // The prompt nobody had typed over follows the artefact.
    expect(labelOf(group).text.toString()).toBe(WARDLEY_NODE_LABEL.market);
  });

  test('a morphed market is the same element as a drawn one', async () => {
    const drawn = await draw('wardley.addMarket');
    const morphed = await draw('wardley.addComponent');
    applyMorph(select(morphed.group), WARDLEY_MORPH_SPEC, 'market');
    await wait(200);

    for (const key of [
      'kind',
      'role',
      'shapeType',
      'filled',
      'fillColor',
      'strokeColor',
      'strokeWidth',
    ] as const) {
      expect(
        (morphed.node as unknown as Record<string, unknown>)[key],
        key
      ).toEqual((drawn.node as unknown as Record<string, unknown>)[key]);
    }
    expect(morphed.node.deserializedXYWH.slice(2)).toEqual(
      drawn.node.deserializedXYWH.slice(2)
    );
    expect(nodesOf(morphed.group)).toHaveLength(nodesOf(drawn.group).length);
    expect(linksOf(morphed.group)).toHaveLength(linksOf(drawn.group).length);
  });

  test('and back again: the round trip leaves a plain component', async () => {
    const { group, node } = await draw('wardley.addMarket');
    const before = centreOf(node);
    const boardSize = surfaceModel().elementModels.length;

    applyMorph(select(group), WARDLEY_MORPH_SPEC, 'component');
    await wait(200);

    expect(node.kind).toBe('component');
    expect(node.role).toBe(WARDLEY_ROLE.component);
    expect(centreOf(node)).toEqual(before);
    expect(node.deserializedXYWH.slice(2)).toEqual([
      WARDLEY_NODE_SIZE.component.w,
      WARDLEY_NODE_SIZE.component.h,
    ]);
    // The three dots and the triangle are GONE from the board, not merely
    // orphaned out of the group: a market's glyph means nothing without one.
    expect(nodesOf(group)).toHaveLength(1);
    expect(linksOf(group)).toHaveLength(0);
    expect(surfaceModel().elementModels.length).toBe(boardSize - 6);
  });

  test('a dependency the user drew moves onto the pipeline handle', async () => {
    const { group, node } = await draw('wardley.addComponent');
    const surface = surfaceModel();
    const otherId = surface.addElement({
      type: 'wardleyNode',
      kind: 'component',
      role: WARDLEY_ROLE.component,
      xywh: '[600,600,18,18]',
    });
    const linkId = surface.addElement({
      type: 'connector',
      role: WARDLEY_ROLE.dependency,
      source: { id: otherId },
      target: { id: node.id },
    });
    await wait();

    applyMorph(select(group), WARDLEY_MORPH_SPEC, 'pipeline');
    await wait(200);

    const handle = nodesOf(group).find(child => child.kind === 'handle');
    expect(handle).toBeDefined();
    expect(handle!.role).toBe(WARDLEY_ROLE.handle);
    // Flat in the outer group — the documented simplification: a drawn pipeline
    // nests its handle with the label, and nothing reads that nesting.
    expect(group.childElements).toContain(handle!);

    const link = surface.getElementById(linkId) as ConnectorElementModel;
    // The whole point of morphing rather than re-drawing. A pipeline BODY
    // declares `connectable === false`, so a dependency left pointing at it
    // would point at something that no longer accepts it.
    expect(link.target?.id).toBe(handle!.id);
    expect(link.source?.id).toBe(otherId);
  });

  test('a pipeline gives its links back to the body, and unnests its label', async () => {
    const { group, node } = await draw('wardley.addPipeline');
    const surface = surfaceModel();
    const handle = nodesOf(group).find(child => child.kind === 'handle')!;
    const label = labelOf(group);
    // What a DRAWN pipeline is: (body + (handle + label)).
    expect(group.childElements).not.toContain(label);

    const otherId = surface.addElement({
      type: 'wardleyNode',
      kind: 'component',
      role: WARDLEY_ROLE.component,
      xywh: '[600,600,18,18]',
    });
    const linkId = surface.addElement({
      type: 'connector',
      role: WARDLEY_ROLE.dependency,
      source: { id: otherId },
      target: { id: handle.id },
    });
    await wait();

    applyMorph(select(group), WARDLEY_MORPH_SPEC, 'component');
    await wait(200);

    expect(node.kind).toBe('component');
    expect(nodesOf(group)).toHaveLength(1);
    const link = surface.getElementById(linkId) as ConnectorElementModel;
    expect(link.target?.id).toBe(node.id);
    // The label came up into the outer group with the handle's removal, and the
    // emptied wrapper went with it.
    expect(group.childElements).toContain(label);
    expect(flat(group).some(child => child instanceof GroupElementModel)).toBe(
      false
    );
  });

  test('one undo puts the whole artefact back', async () => {
    const { group, node } = await draw('wardley.addComponent');
    window.doc.captureSync();
    const boardSize = surfaceModel().elementModels.length;
    const box = node.xywh;
    const label = labelOf(group);

    applyMorph(select(group), WARDLEY_MORPH_SPEC, 'market');
    await wait(200);
    expect(node.kind).toBe('market');
    expect(surfaceModel().elementModels.length).toBe(boardSize + 6);

    window.doc.undo();
    await wait(200);

    // ONE undo, and it takes the kind, the size, the six elements the glyph is
    // made of and the renamed label with it — `afterMorph` runs inside the same
    // `captureSync`, so there is no second step where the dots are gone and the
    // circle is still claiming to be a market.
    expect(node.kind).toBe('component');
    expect(node.xywh).toBe(box);
    expect(surfaceModel().elementModels.length).toBe(boardSize);
    expect(label.text.toString()).toBe(WARDLEY_NODE_LABEL.component);
  });

  test('the dropdown draws the family, with the current one lit', async () => {
    const { group, node } = await draw('wardley.addComponent');
    const ctx = select(group);

    const config = morphToolbarConfig(WARDLEY_MORPH_SPEC);
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
      // Declaration order is menu order, and it opens on the plain component.
      expect(options.map(el => el.getAttribute('data-value'))).toEqual([
        'component',
        'market',
        'ecosystem',
        'pipeline',
      ]);
      const active = options.filter(
        el => (el as HTMLElement & { active?: boolean }).active
      );
      expect(active).toHaveLength(1);
      expect(active[0].getAttribute('data-value')).toBe('component');

      // …and clicking one is the gesture: same node, new kind.
      (
        options.find(el => el.getAttribute('data-value') === 'ecosystem') as
          | HTMLElement
          | undefined
      )?.click();
      await wait(200);
      expect(node.kind).toBe('ecosystem');
      expect(node.deserializedXYWH[2]).toBe(WARDLEY_NODE_SIZE.ecosystem.w);
    } finally {
      host.remove();
    }
  });

  test('an anchor, a method and a plain group are offered nothing', async () => {
    const config = morphToolbarConfig(WARDLEY_MORPH_SPEC);
    const surface = surfaceModel();
    const component = await draw('wardley.addComponent');
    // Not `draw`: these two resolve to NOTHING, which is the claim.
    const anchor = await drawGroup('wardley.addAnchor');
    const method = await drawGroup('wardley.addMethod');
    expect(wardleyNodeOfComponent(anchor)).toBeUndefined();
    expect(wardleyNodeOfComponent(method)).toBeUndefined();

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

    // The anchor is what the value chain HANGS FROM and the method is an
    // annotation whose fill encodes a decision: neither is in the family, so
    // neither is ever offered the menu.
    expect(refuses(anchor)).toBe(false);
    expect(refuses(method)).toBe(false);
    expect(refuses(plain)).toBe(false);
    // …and one real component beside any of them is still nothing: the
    // resolution is per element, so a selection the menu could only half answer
    // is refused whole.
    expect(refuses(component.group, plain)).toBe(false);
    expect(refuses(component.group, anchor)).toBe(false);
    // The component alone, on the other hand, is offered its family.
    expect(refuses(component.group)).toBe(true);
  });
});
