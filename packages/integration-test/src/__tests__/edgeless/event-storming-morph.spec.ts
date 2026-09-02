import type { EdgelessRootBlockComponent } from '@labre/affine/blocks/root';
import { applyMorph, morphToolbarConfig } from '@labre/affine/blocks/surface';
// Straight off the framework packages, as the c4, bpmn and wardley specs
// already reach for theirs: `@labre/affine` re-exports the blocks, not the
// framework modules.
import {
  ES_STICKY_ROLE,
  EVENT_STORMING_MORPH_SPEC,
  eventStormingFaceOfSticky,
} from '@labre/affine-gfx-ddd-event-storming';
import { SHADOW_COLOR } from '@labre/affine-gfx-ddd-shared';
import {
  GroupElementModel,
  ShapeElementModel,
  ShapeType,
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
 * Re-saying an Event Storming sticky, end to end.
 *
 * The unit suites own the two halves: when the generic dropdown stands up and
 * how its composite hooks behave (surface), and what the family, the patch and
 * the label rule say (gfx/ddd-event-storming). What only a real editor can
 * answer is what the workshop actually sees — that the group they clicked is
 * what the toolbar offers the menu on, that the patch lands on the FACE inside
 * it, that the drop shadow changes silhouette with the face rather than being
 * left behind as a rectangular smudge, and that one ctrl+z puts the sticky back.
 */
describe('morphing an Event Storming sticky into another kind', () => {
  let edgeless!: EdgelessRootBlockComponent;

  beforeEach(async () => {
    const cleanup = await setupEditor('edgeless');
    edgeless = getDocRootBlock(window.doc, window.editor, 'edgeless');
    return cleanup;
  });

  /** Draw one sticky through the registered command, as the sub-menu does. */
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
    const face = eventStormingFaceOfSticky(group);
    expect(face, commandId).toBeDefined();
    return { group, face: face as ShapeElementModel, shadow: shadowOf(group) };
  };

  /** The ink behind the face: the sibling shape drawn in the shadow colour. */
  const shadowOf = (group: GroupElementModel) =>
    group.childElements.find(
      (child): child is ShapeElementModel =>
        child instanceof ShapeElementModel && child.fillColor === SHADOW_COLOR
    )!;

  /**
   * Everything about a face that is NOT its place on the board — the claim
   * behind "a morphed sticky and a freshly drawn one are the same element".
   */
  const paintOf = (shape: ShapeElementModel) => ({
    role: shape.role,
    fillColor: shape.fillColor,
    color: shape.color,
    shapeType: shape.shapeType,
    radius: shape.radius,
    filled: shape.filled,
    strokeColor: shape.strokeColor,
    strokeWidth: shape.strokeWidth,
    shapeStyle: shape.shapeStyle,
    roughness: shape.roughness,
    fontFamily: shape.fontFamily,
    fontSize: shape.fontSize,
    textAlign: shape.textAlign,
    textFitMode: shape.textFitMode,
    text: shape.text?.toString(),
  });

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
   * Select, then let the widget do the whole of its own work: the flavour, the
   * module lookup, the merge and the render are all the editor's — the only way
   * to find out whether the entry reaches the row a user is looking at.
   */
  const selectAndRender = async (...ids: string[]) => {
    edgeless.gfx.selection.set({ elements: ids, editing: false });
    await wait(250);
    await edgeless.updateComplete;
    await frames();
  };

  test('the entry is registered on the group flavour, beside the others', () => {
    const registry = edgeless.std.get(ToolbarRegistryIdentifier);
    const key = toolbarModuleKey(
      'custom:affine:surface:group',
      'ddd-event-storming-morph'
    );
    const modules = registry.modulesFor('custom:affine:surface:group');

    // A sticky is a native group, so its row is the group's row. Both plain
    // group keys were taken (the native operations, Wardley's qualification
    // dropdown) and C4's morph already holds a suffixed variant, so this one is
    // the third contributor to the same row.
    expect(modules.map(module => module.id.variant)).toContain(key);
    expect(modules.map(module => module.id.variant)).toContain(
      toolbarModuleKey('custom:affine:surface:group', 'c4-morph')
    );
    expect(registry.getModuleBy('affine:surface:group')).toBeTruthy();
  });

  test('the morph entry is drawn on the real row of a sticky', async () => {
    const { group } = await draw('ddd-event-storming.addCommand');
    await selectAndRender(group.id);

    expect(toolbar()).not.toBeNull();
    expect(onRow('[data-testid="element-morph"]')).not.toBeNull();
  });

  test('a command becomes a domain event, and only the face changes', async () => {
    const { group, face, shadow } = await draw('ddd-event-storming.addCommand');

    const box = group.xywh;
    const faceBox = face.xywh;
    const shadowBox = shadow.xywh;
    expect(face.role).toBe(ES_STICKY_ROLE.command);
    expect(face.text?.toString()).toBe('Command');
    const blue = face.fillColor;

    applyMorph(select(group), EVENT_STORMING_MORPH_SPEC, 'domainEvent');
    await wait(200);

    // What changed: the props that say what this sticky CLAIMS, on the face —
    // the child of the group the user actually selected.
    expect(face.role).toBe(ES_STICKY_ROLE.domainEvent);
    expect(face.fillColor).not.toBe(blue);
    expect(face.fillColor).toBe('#F5963B');
    expect(face.color).toBe('#5a3000');
    // …and the words, because a sticky nobody has written on still carries the
    // notation's own prompt and an orange one reading "Command" is a wall
    // contradicting itself.
    expect(face.text?.toString()).toBe('Domain event');

    // …and nothing else a user could point at. Same elements, same ids, same
    // geometry — including the shadow, whose offset is the author's as much as
    // the face's box is.
    expect(face.xywh).toBe(faceBox);
    expect(group.xywh).toBe(box);
    expect(shadow.xywh).toBe(shadowBox);
    expect(shadow.fillColor).toBe(SHADOW_COLOR);
    expect(shadow.role).toBeUndefined();
    expect(group.role).toBeUndefined();
    expect(group.childElements).toHaveLength(2);
  });

  test('a hotspot takes the shadow into the diamond with it', async () => {
    const { group, face, shadow } = await draw('ddd-event-storming.addCommand');
    expect(face.shapeType).toBe(ShapeType.Rect);
    expect(shadow.shapeType).toBe(ShapeType.Rect);

    applyMorph(select(group), EVENT_STORMING_MORPH_SPEC, 'hotspot');
    await wait(200);

    // The one morph where the silhouette moves, and the reason `afterMorph`
    // exists at all: the drop shadow is a separate ELEMENT, so a diamond over
    // an untouched rectangle would be a diamond floating on a smudge.
    expect(face.shapeType).toBe(ShapeType.Diamond);
    expect(face.radius).toBe(0);
    expect(shadow.shapeType).toBe(ShapeType.Diamond);
    expect(shadow.radius).toBe(0);
    expect(face.role).toBe(ES_STICKY_ROLE.hotspot);
    expect(face.text?.toString()).toBe('Hotspot');

    // …and back out again, corners and all.
    applyMorph(select(group), EVENT_STORMING_MORPH_SPEC, 'policy');
    await wait(200);

    expect(face.shapeType).toBe(ShapeType.Rect);
    expect(shadow.shapeType).toBe(ShapeType.Rect);
    expect(shadow.radius).toBe(face.radius);
    expect(shadow.radius).toBeGreaterThan(0);
  });

  test('words the workshop wrote survive the morph', async () => {
    const { group, face } = await draw('ddd-event-storming.addCommand');

    window.doc.transact(() => {
      face.text!.delete(0, face.text!.length);
      face.text!.insert(0, 'Place order');
    });
    await wait();

    applyMorph(select(group), EVENT_STORMING_MORPH_SPEC, 'domainEvent');
    await wait(200);

    expect(face.role).toBe(ES_STICKY_ROLE.domainEvent);
    expect(face.text?.toString()).toBe('Place order');
  });

  test('one undo puts the sticky back', async () => {
    const { group, face, shadow } = await draw('ddd-event-storming.addCommand');
    window.doc.captureSync();
    const before = paintOf(face);

    applyMorph(select(group), EVENT_STORMING_MORPH_SPEC, 'hotspot');
    await wait(200);
    expect(face.role).toBe(ES_STICKY_ROLE.hotspot);
    expect(shadow.shapeType).toBe(ShapeType.Diamond);

    window.doc.undo();
    await wait(200);

    // ONE undo, and it takes the face, the words and the shadow with it —
    // `afterMorph` runs inside the same `captureSync`, so there is no
    // intermediate step where the sticky is blue again and its shadow is still
    // a diamond.
    expect(paintOf(face)).toEqual(before);
    expect(shadow.shapeType).toBe(ShapeType.Rect);
  });

  test('a morphed sticky is a drawn one, save for where it sits', async () => {
    const morphed = await draw('ddd-event-storming.addCommand');
    applyMorph(select(morphed.group), EVENT_STORMING_MORPH_SPEC, 'readModel');
    await wait(200);

    const drawn = await draw('ddd-event-storming.addReadModel');

    // The whole point of patching the preset rather than `{role}`: the palette
    // and the morph produce the same element, so nobody can tell from the board
    // which stickies were re-said.
    expect(paintOf(morphed.face)).toEqual(paintOf(drawn.face));
    expect(morphed.shadow.fillColor).toBe(drawn.shadow.fillColor);
    expect(morphed.shadow.shapeType).toBe(drawn.shadow.shapeType);
    expect(morphed.shadow.radius).toBe(drawn.shadow.radius);
  });

  test('an aggregate keeps the room the author gave it', async () => {
    // The documented residual: `xywh` is the one thing a morph never touches,
    // so an aggregate — BORN at 160 against the standard 120 — keeps its 160
    // when it becomes a command. Size is the author's statement about how much
    // room the sticky needs; the paint is the notation's about what it means.
    const { group, face } = await draw('ddd-event-storming.addAggregate');
    const box = face.xywh;
    expect(face.w).toBe(160);

    applyMorph(select(group), EVENT_STORMING_MORPH_SPEC, 'command');
    await wait(200);

    expect(face.role).toBe(ES_STICKY_ROLE.command);
    expect(face.xywh).toBe(box);
    expect(face.w).toBe(160);
  });

  test('the dropdown draws all nine kinds, with the current one lit', async () => {
    const { group, face } = await draw('ddd-event-storming.addCommand');
    const ctx = select(group);

    const config = morphToolbarConfig(EVENT_STORMING_MORPH_SPEC);
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
      // Declaration order is menu order, and it is the grammar's order — the
      // same one the senior sub-menu renders, hotspot last.
      expect(options.map(el => el.getAttribute('data-value'))).toEqual([
        'domainEvent',
        'command',
        'aggregate',
        'actor',
        'constraint',
        'policy',
        'readModel',
        'system',
        'hotspot',
      ]);
      const active = options.filter(
        el => (el as HTMLElement & { active?: boolean }).active
      );
      expect(active).toHaveLength(1);
      expect(active[0].getAttribute('data-value')).toBe('command');

      // …and clicking one is the gesture: same sticky, new claim.
      (
        options.find(el => el.getAttribute('data-value') === 'policy') as
          | HTMLElement
          | undefined
      )?.click();
      await wait(200);
      expect(face.role).toBe(ES_STICKY_ROLE.policy);
    } finally {
      host.remove();
    }
  });

  test('a plain group and a mixed selection are offered nothing', async () => {
    const surface = getSurface(window.doc, window.editor).model;
    const config = morphToolbarConfig(EVENT_STORMING_MORPH_SPEC);
    const sticky = await draw('ddd-event-storming.addCommand');

    // A lasso somebody drew round two rectangles: a group, and not one of ours.
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
    // …and one sticky beside it is still nothing: the resolution is per
    // element, so a selection the menu could only half answer is refused whole.
    expect(refuses(sticky.group, plain)).toBe(false);
    // The sticky alone, on the other hand, is offered the whole notation.
    expect(refuses(sticky.group)).toBe(true);
    // Two stickies together are one gesture, which is the point of the module
    // being per-selection rather than per-element.
    const second_ = await draw('ddd-event-storming.addActor');
    expect(refuses(sticky.group, second_.group)).toBe(true);
  });
});
