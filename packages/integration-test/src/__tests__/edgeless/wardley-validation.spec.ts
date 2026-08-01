import {
  OverlayIdentifier,
  ValidationManager,
} from '@labre/affine/blocks/surface';
import type { EdgelessRootBlockComponent } from '@labre/affine/blocks/root';
import { beforeEach, describe, expect, test } from 'vitest';

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

  const addBackground = () =>
    service.surface.addElement({ type: 'wardley', xywh: '[0,0,1600,900]' });

  const addComponent = (xywh: string) =>
    service.surface.addElement({
      type: 'wardleyNode',
      kind: 'component',
      role: 'wardley:component',
      xywh,
    });

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

  test('a neutral element is never evaluated, wherever it sits', async () => {
    addBackground();
    // A generalist square far off the map: no role, so no message.
    service.surface.addElement({ type: 'shape', xywh: '[3000,3000,40,40]' });
    await settle();

    expect(validation.violations$.value).toEqual([]);
  });
});
