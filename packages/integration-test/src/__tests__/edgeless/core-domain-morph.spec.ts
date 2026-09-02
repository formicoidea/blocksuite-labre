import type { EdgelessRootBlockComponent } from '@labre/affine/blocks/root';
import { applyMorph, morphToolbarConfig } from '@labre/affine/blocks/surface';
// Straight off the framework package, as the c4 and wardley specs already reach
// for theirs: `@labre/affine` re-exports the blocks, not the framework modules.
import {
  CORE_DOMAIN_MORPH_SPEC,
  CORE_DOMAIN_ROLE,
  coreDomainArtefactOf,
  coreDomainMorphProps,
} from '@labre/affine-gfx-ddd-core-domain';
import {
  GroupElementModel,
  type ShapeElementModel,
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
import { beforeEach, describe, expect, test } from 'vitest';

import { wait } from '../utils/common.js';
import { getDocRootBlock, getSurface } from '../utils/edgeless.js';
import { setupEditor } from '../utils/setup.js';

/**
 * Morphing a Core Domain dot or marker into a nearby kind, end to end.
 *
 * The unit suites own the two halves: when the generic dropdown stands up and
 * how its two composite hooks behave (surface), and what this framework's
 * families, patch and word rules say (gfx/ddd-core-domain). What only a real
 * editor can answer is what a user actually notices — that the group they
 * clicked is the thing the toolbar offers the menu on, that the patch lands on
 * the SHAPE inside it, that the caption and the box do not move, and that one
 * ctrl+z puts the artefact back.
 */
describe('morphing a Core Domain artefact inside its family', () => {
  let edgeless!: EdgelessRootBlockComponent;

  beforeEach(async () => {
    const cleanup = await setupEditor('edgeless');
    edgeless = getDocRootBlock(window.doc, window.editor, 'edgeless');
    return cleanup;
  });

  /** Place one artefact through the registered command, as the sub-menu does. */
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
    const shape = coreDomainArtefactOf(group);
    expect(shape, commandId).toBeDefined();
    return { group, shape: shape as ShapeElementModel };
  };

  /**
   * The words of a composite, told apart the way the morph tells them apart:
   * the letter sits ON the square, the caption stands beside the artefact.
   */
  const wordsOf = (group: GroupElementModel, shape: ShapeElementModel) => {
    const texts = group.childElements.filter(
      (child): child is TextElementModel => child instanceof TextElementModel
    );
    const on = (text: TextElementModel) =>
      text.x + text.w / 2 >= shape.x &&
      text.x + text.w / 2 <= shape.x + shape.w;
    return {
      glyph: texts.find(on),
      caption: texts.find(text => !on(text)),
    };
  };

  /**
   * The selection made the way the real toolbar makes it: the widget derives the
   * flavour itself, so these cases prove the module is registered on a key the
   * editor actually asks for — which for a composite is the whole risk.
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

  /** Set the canvas selection and leave the whole render to the editor. */
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
      'ddd-core-domain-morph'
    );
    const modules = registry.modulesFor('custom:affine:surface:group');

    // Both group keys were long since taken — the native group operations on
    // one, Wardley's qualification dropdown on the other, with C4's morph
    // already on a suffixed variant — so this one is registered under its own
    // and merged into the same row.
    expect(modules.map(module => module.id.variant)).toContain(key);
    expect(registry.getModuleBy('affine:surface:group')).toBeTruthy();
  });

  test('the morph entry is drawn on the real row of a dot', async () => {
    // Everything else in this file drives `updateWithSurface` or calls
    // `applyMorph` directly, and every one of those would still pass against a
    // registry that had gone back to one module per key. This case sets the
    // canvas selection and reads the toolbar's own DOM, with the flavour
    // resolution, the module lookup, the `when` filter, the id merge and the
    // render all left to the editor.
    const { group } = await draw('ddd-core-domain.addBigBet');
    await selectAndRender(group.id);

    expect(toolbar()).not.toBeNull();
    expect(onRow('[data-testid="element-morph"]')).not.toBeNull();
  });

  test('a big bet becomes a platform, and only the dot changes', async () => {
    const { group, shape } = await draw('ddd-core-domain.addBigBet');
    const { caption } = wordsOf(group, shape);
    expect(caption).toBeDefined();

    const box = group.xywh;
    const dotBox = shape.xywh;
    const captionBox = caption!.xywh;
    expect(shape.role).toBe(CORE_DOMAIN_ROLE.bigBet);
    expect(caption!.text.toString()).toBe('Big-bet sub-domain');

    applyMorph(select(group), CORE_DOMAIN_MORPH_SPEC, 'platform');
    await wait(200);

    // What changed: the props that say what this artefact IS, on the SHAPE —
    // the child of the group the user actually selected.
    expect(shape.role).toBe(CORE_DOMAIN_ROLE.platform);
    expect(shape.fillColor).toBe(coreDomainMorphProps('platform').fillColor);
    expect(shape.fillColor).not.toBe(coreDomainMorphProps('bigBet').fillColor);

    // …and nothing else a user could point at. Same elements, same ids, same
    // geometry — the group is the one thing a morph must not rewrite.
    expect(shape.xywh).toBe(dotBox);
    expect(group.xywh).toBe(box);
    expect(group.role).toBeUndefined();
    expect(group.childElements).toHaveLength(2);
    // The one thing that moves, and it moves because it MUST: the caption of a
    // dot nobody has named is the kind's own prompt, and a blue platform dot
    // captioned "Big-bet sub-domain" is a picture contradicting itself.
    expect(caption!.text.toString()).toBe('Platform sub-domain');
    expect(caption!.xywh).toBe(captionBox);
  });

  test('a caption the author wrote survives the morph', async () => {
    const { group, shape } = await draw('ddd-core-domain.addBcCurrent');
    const caption = wordsOf(group, shape).caption!;

    window.doc.transact(() => {
      caption.text.delete(0, caption.text.length);
      caption.text.insert(0, 'Billing');
    });
    await wait();

    applyMorph(select(group), CORE_DOMAIN_MORPH_SPEC, 'bcFuture');
    await wait(200);

    expect(shape.role).toBe(CORE_DOMAIN_ROLE.bcFuture);
    expect(caption.text.toString()).toBe('Billing');
  });

  test('a collaboration becomes an X-as-a-Service, letter and all', async () => {
    const { group, shape } = await draw('ddd-core-domain.addCollaboration');
    const { glyph, caption } = wordsOf(group, shape);
    expect(glyph).toBeDefined();
    expect(glyph!.text.toString()).toBe('C');
    expect(shape.role).toBe(CORE_DOMAIN_ROLE.collaboration);
    const glyphBox = glyph!.xywh;

    applyMorph(select(group), CORE_DOMAIN_MORPH_SPEC, 'xaas');
    await wait(200);

    expect(shape.role).toBe(CORE_DOMAIN_ROLE.xaas);
    expect(shape.fillColor).toBe(coreDomainMorphProps('xaas').fillColor);
    // The letter is NOTATION, not words anybody wrote: a square that has become
    // an X-as-a-Service while still showing a C is the picture lying about
    // itself, so it is rewritten always — and it does not move.
    expect(glyph!.text.toString()).toBe('X');
    expect(glyph!.xywh).toBe(glyphBox);
    expect(caption!.text.toString()).toBe('X-as-a-Service');
    expect(group.childElements).toHaveLength(3);
  });

  test('one undo puts the artefact back', async () => {
    const { group, shape } = await draw('ddd-core-domain.addCollaboration');
    const { glyph, caption } = wordsOf(group, shape);
    window.doc.captureSync();
    const green = shape.fillColor;

    applyMorph(select(group), CORE_DOMAIN_MORPH_SPEC, 'facilitating');
    await wait(200);
    expect(shape.role).toBe(CORE_DOMAIN_ROLE.facilitating);
    expect(glyph!.text.toString()).toBe('F');
    expect(caption!.text.toString()).toBe('Facilitating');

    window.doc.undo();
    await wait(200);

    // ONE undo, and it takes the square, the glyph and the caption with it —
    // `afterMorph` runs inside the same `captureSync`, so there is no second
    // step where the colour is back and the letter is not.
    expect(shape.role).toBe(CORE_DOMAIN_ROLE.collaboration);
    expect(shape.fillColor).toBe(green);
    expect(glyph!.text.toString()).toBe('C');
    expect(caption!.text.toString()).toBe('Collaboration');
  });

  test('a dot and a marker together are offered nothing', async () => {
    const config = morphToolbarConfig(CORE_DOMAIN_MORPH_SPEC);
    const dot = await draw('ddd-core-domain.addPlatform');
    const marker = await draw('ddd-core-domain.addXaas');

    const offers = (...groups: GroupElementModel[]) => {
      const ctx = select(...groups);
      return typeof config.when === 'function' ? config.when(ctx) : config.when;
    };

    // A sub-domain is plotted ON the chart, a marker is an annotation ABOUT it,
    // and the two families never meet: a selection holding one of each has no
    // common family, so there is no menu at all.
    expect(offers(dot.group, marker.group)).toBe(false);
    // …where each of them alone is offered its own family.
    expect(offers(dot.group)).toBe(true);
    expect(offers(marker.group)).toBe(true);
  });

  test('a plain group is offered nothing', async () => {
    const surface = getSurface(window.doc, window.editor).model;
    const config = morphToolbarConfig(CORE_DOMAIN_MORPH_SPEC);
    const dot = await draw('ddd-core-domain.addPlatform');

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

    const offers = (...groups: GroupElementModel[]) => {
      const ctx = select(...groups);
      return typeof config.when === 'function' ? config.when(ctx) : config.when;
    };

    expect(offers(plain)).toBe(false);
    // …and one dot beside it is still nothing: the resolution is per element,
    // so a selection the menu could only half answer is refused whole.
    expect(offers(dot.group, plain)).toBe(false);
  });
});
