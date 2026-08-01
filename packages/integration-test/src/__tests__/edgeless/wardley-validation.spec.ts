import {
  OverlayIdentifier,
  resolveViolationAnchors,
  ValidationManager,
} from '@labre/affine/blocks/surface';
import type { EdgelessRootBlockComponent } from '@labre/affine/blocks/root';
import { beforeEach, describe, expect, test } from 'vitest';

import type { GroupElementModel } from '@labre/affine/model';
import { createGroupCommand, ungroupCommand } from '@labre/affine/gfx/group';
import { Text } from '@labre/store';

import { wait } from '../utils/common.js';
import { getDocRootBlock } from '../utils/edgeless.js';
import { setupEditor } from '../utils/setup.js';

/**
 * The tracer bullet, end to end: a real editor, real DI, the real Wardley rule
 * registered by its flag-gated view extension, and the reactive violation list
 * a host panel will subscribe to.
 *
 * The unit suite covers the rule's logic; this covers the WIRING — that the
 * manager mounts, finds the surface, sees the registered rule and reacts to
 * document changes.
 */
describe('wardley validation on the canvas', () => {
  let service!: EdgelessRootBlockComponent['service'];
  let validation!: ValidationManager;

  /**
   * A map on the STRICT profile — since PF9 the default (`wardley.sketch`)
   * demotes the pilot rule to `audit`, which raises a finding the engine
   * reports and the canvas deliberately never draws.
   */
  const addBackground = () =>
    service.surface.addElement({
      type: 'wardley',
      role: 'wardley:map',
      validationProfile: 'wardley.strict',
      xywh: '[0,0,1600,900]',
    });

  /** A map authored before `wardley:map` existed: same type, no role. */
  const addLegacyBackground = () =>
    service.surface.addElement({ type: 'wardley', xywh: '[0,0,1600,900]' });

  const addComponent = (xywh: string) =>
    service.surface.addElement({
      type: 'wardleyNode',
      kind: 'component',
      role: 'wardley:component',
      xywh,
    });

  /** Group the given elements, exactly as the Wardley toolbox does. */
  const groupOf = (ids: string[]) => {
    const [, result] = service.std.command.exec(createGroupCommand, {
      elements: ids,
    });
    return result.groupId as string;
  };

  /** Where the overlay would actually draw, given the current violations. */
  const markBounds = () =>
    resolveViolationAnchors(
      validation.violations$.value,
      service.surface
    ).map(anchor => anchor.bound);

  /** Past the manager's re-evaluation debounce. */
  const settle = () => wait(250);

  beforeEach(async () => {
    const cleanup = await setupEditor('edgeless');
    service = getDocRootBlock(window.doc, window.editor, 'edgeless').service;
    validation = service.std.get(ValidationManager);

    return cleanup;
  });

  test('the wardley rule is registered and the engine is live', () => {
    // Flag on (default) => the rule reached the container, so the manager
    // subscribed instead of short-circuiting.
    expect(validation.violations$.value).toEqual([]);
    expect(
      service.std.getOptional(OverlayIdentifier('validation'))
    ).toBeTruthy();
  });

  test('a component dropped outside the map raises a violation', async () => {
    addBackground();
    const id = addComponent('[3000,3000,40,40]');
    await settle();

    const violations = validation.violations$.value;
    expect(violations).toHaveLength(1);
    expect(violations[0]).toMatchObject({
      ruleId: 'wardley.component-outside-map',
      elementIds: [id],
      severity: 'warning',
      messageKey: 'com.labre.wardley.validation.component-outside-map',
    });
  });

  test('a component on the map raises nothing', async () => {
    addBackground();
    addComponent('[200,200,40,40]');
    await settle();

    expect(validation.violations$.value).toEqual([]);
  });

  test('the violation clears when the component is moved back on the map', async () => {
    addBackground();
    const id = addComponent('[3000,3000,40,40]');
    await settle();
    expect(validation.violations$.value).toHaveLength(1);

    service.surface.updateElement(id, { xywh: '[200,200,40,40]' });
    await settle();

    expect(validation.violations$.value).toEqual([]);
  });

  test('a map authored without the role frames nothing, and is not backfilled', async () => {
    addLegacyBackground();
    addComponent('[3000,3000,40,40]');
    await settle();

    // No retro-violation on an older document: it stays a sketch.
    expect(validation.violations$.value).toEqual([]);
    const background = service.surface.getElementsByType('wardley')[0];
    expect(background.role).toBeUndefined();
  });

  /**
   * PO acceptance: a Wardley component made from the toolbox is a GROUP of
   * {node, label}. Marking the bare node collided with the group's selection
   * rect and was unreadable, so the mark anchors on the enclosing group.
   *
   * Evaluation is untouched — the violation still names the element carrying
   * the role, because its position is what the rule is about. Only the drawing
   * moves.
   */
  describe('the mark anchors on the enclosing group', () => {
    test('a grouped violating node is marked on its group', async () => {
      addBackground();
      const nodeId = addComponent('[3000,3000,40,40]');
      const labelId = service.surface.addElement({
        type: 'text',
        xywh: '[3050,3000,120,24]',
        text: new Text('Payments'),
      });
      const groupId = groupOf([nodeId, labelId]);
      await settle();

      // The violation itself is unchanged: the node, never the group.
      expect(validation.violations$.value[0].elementIds).toEqual([nodeId]);

      // ...but the mark is drawn on the group, which spans node AND label.
      const group = service.surface.getElementById(groupId)!;
      expect(markBounds()).toHaveLength(1);
      expect(markBounds()[0].serialize()).toBe(group.elementBound.serialize());
      // Wider than the bare node — that is the whole point of the change.
      expect(markBounds()[0].w).toBeGreaterThan(40);
    });

    test('two violating members of one group share a single mark', async () => {
      addBackground();
      const a = addComponent('[3000,3000,40,40]');
      const b = addComponent('[3100,3000,40,40]');
      groupOf([a, b]);
      await settle();

      // Two violations, one bracket.
      expect(validation.violations$.value).toHaveLength(2);
      expect(markBounds()).toHaveLength(1);
    });

    test('an ungrouped violating node is marked on itself', async () => {
      addBackground();
      const id = addComponent('[3000,3000,40,40]');
      await settle();

      const element = service.surface.getElementById(id)!;
      expect(markBounds()).toHaveLength(1);
      expect(markBounds()[0].serialize()).toBe(
        element.elementBound.serialize()
      );
    });

    test('dissolving the group brings the mark back to the element', async () => {
      addBackground();
      const nodeId = addComponent('[3000,3000,40,40]');
      const labelId = service.surface.addElement({
        type: 'text',
        xywh: '[3050,3000,120,24]',
        text: new Text('Payments'),
      });
      const groupId = groupOf([nodeId, labelId]);
      await settle();
      expect(markBounds()[0].w).toBeGreaterThan(40);

      // Ungroup exactly as the group toolbar does. Anchors are resolved at
      // paint time, so nothing has to be invalidated for the mark to fall
      // back onto the element.
      service.std.command.exec(ungroupCommand, {
        group: service.surface.getElementById(groupId) as GroupElementModel,
      });

      const node = service.surface.getElementById(nodeId)!;
      expect(markBounds()).toHaveLength(1);
      expect(markBounds()[0].serialize()).toBe(node.elementBound.serialize());
    });
  });

  test('a neutral element is never evaluated, wherever it sits', async () => {
    addBackground();
    // A generalist square far off the map: no role, so no message.
    service.surface.addElement({ type: 'shape', xywh: '[3000,3000,40,40]' });
    await settle();

    expect(validation.violations$.value).toEqual([]);
  });
});
