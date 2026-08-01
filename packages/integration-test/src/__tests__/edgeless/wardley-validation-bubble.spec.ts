import type { EdgelessRootBlockComponent } from '@labre/affine/blocks/root';
import {
  resolveMarkAnchors,
  ValidationManager,
  VIOLATION_DETAIL_WIDGET,
  VIOLATION_MARK_PADDING,
} from '@labre/affine/blocks/surface';
import { createGroupCommand, ungroupCommand } from '@labre/affine/gfx/group';
import type { GroupElementModel } from '@labre/affine/model';
import { TranslationExtension } from '@labre/affine/shared/services';
import type { ExtensionType } from '@labre/store';
import { Text } from '@labre/store';
import { beforeEach, describe, expect, test } from 'vitest';

import { wait } from '../utils/common.js';
import { getDocRootBlock } from '../utils/edgeless.js';
import { setupEditor } from '../utils/setup.js';

/**
 * PF7 restitution: the badge that outlives the flash, and the bubble behind it.
 *
 * The unit suite owns the ephemeral → persistent state machine (it takes
 * timestamps, so it needs no browser). This suite owns everything that only a
 * real editor can answer: that a badge lands on the group anchor, that clicking
 * it names the rule instead of selecting the shape underneath, and that
 * correcting the drawing takes both away.
 */

/** Native-shaped click: composed, so it crosses the widget's shadow boundary. */
function clickElement(element: Element) {
  const rect = element.getBoundingClientRect();
  const init = {
    bubbles: true,
    composed: true,
    cancelable: true,
    clientX: rect.x + rect.width / 2,
    clientY: rect.y + rect.height / 2,
    pointerId: 1,
    isPrimary: true,
  };
  element.dispatchEvent(new PointerEvent('pointerdown', init));
  element.dispatchEvent(new PointerEvent('pointerup', init));
  element.dispatchEvent(new MouseEvent('click', init));
}

const setup = (extensions: ExtensionType[] = []) =>
  setupEditor('edgeless', extensions);

describe('the violation badge and its detail bubble', () => {
  let service!: EdgelessRootBlockComponent['service'];
  let root!: EdgelessRootBlockComponent;
  let validation!: ValidationManager;

  const addBackground = () =>
    service.surface.addElement({
      type: 'wardley',
      role: 'wardley:map',
      xywh: '[0,0,1600,900]',
    });

  /** Group the given elements, exactly as the Wardley toolbox does. */
  const groupOf = (ids: string[]) => {
    const [, result] = service.std.command.exec(createGroupCommand, {
      elements: ids,
    });
    return result.groupId as string;
  };

  const addComponent = (xywh: string) =>
    service.surface.addElement({
      type: 'wardleyNode',
      kind: 'component',
      role: 'wardley:component',
      xywh,
    });

  /** The widget's shadow root — where badges and bubbles live. */
  const widgetRoot = () => {
    const widget = root.widgetComponents[VIOLATION_DETAIL_WIDGET];
    return widget?.shadowRoot ?? null;
  };

  const badges = () =>
    Array.from(
      widgetRoot()?.querySelectorAll('[data-testid="violation-badge"]') ?? []
    );

  const bubble = () => widgetRoot()?.querySelector('.violation-bubble') ?? null;

  /** Past the manager's 120 ms debounce, then past lit's render. */
  const settle = async () => {
    await wait(250);
    await root.updateComplete;
    const widget = root.widgetComponents[VIOLATION_DETAIL_WIDGET];
    await widget?.updateComplete;
    await wait(0);
  };

  const mount = async (extensions?: ExtensionType[]) => {
    const cleanup = await setup(extensions);
    root = getDocRootBlock(window.doc, window.editor, 'edgeless');
    service = root.service;
    validation = service.std.get(ValidationManager);
    return cleanup;
  };

  describe('with no catalogue registered', () => {
    beforeEach(async () => mount());

    test('a violation raises one badge, anchored on the enclosing group', async () => {
      addBackground();
      // Far off the map, and inside the viewport is irrelevant: the badge is
      // positioned in view coords, which may well be off screen.
      const id = addComponent('[3000,3000,40,40]');
      await settle();

      expect(validation.violations$.value).toHaveLength(1);
      expect(badges()).toHaveLength(1);

      // It sits on the bracket's top-right corner: same anchor bounds, same
      // screen-pixel gap the overlay uses.
      const [anchor] = resolveMarkAnchors([id], service.surface);
      const [x, y] = service.viewport.toViewCoord(anchor.maxX, anchor.y);
      const style = (badges()[0] as HTMLElement).style;
      expect(parseFloat(style.left)).toBeCloseTo(x + VIOLATION_MARK_PADDING, 0);
      expect(parseFloat(style.top)).toBeCloseTo(y - VIOLATION_MARK_PADDING, 0);
    });

    test('a clean board raises no badge at all', async () => {
      addBackground();
      addComponent('[200,200,40,40]');
      await settle();

      expect(badges()).toHaveLength(0);
      expect(bubble()).toBeNull();
    });

    test('clicking the badge opens a bubble naming the rule', async () => {
      addBackground();
      addComponent('[3000,3000,40,40]');
      await settle();

      clickElement(badges()[0]);
      await settle();

      const open = bubble();
      expect(open).not.toBeNull();
      // No catalogue: the raw key is shown rather than wording the library
      // invented for somebody else's rule.
      expect(open?.textContent).toContain(
        'com.labre.wardley.validation.component-outside-map'
      );
      // The rule carries a remediation hint, so the bubble lists it too.
      expect(open?.textContent).toContain(
        'com.labre.wardley.validation.component-outside-map.suggestion'
      );
      // ...and the severity, as chrome, which the library may word itself.
      expect(open?.textContent?.toLowerCase()).toContain('warning');
    });

    test('clicking the badge does not select the element underneath', async () => {
      addBackground();
      addComponent('[3000,3000,40,40]');
      await settle();

      clickElement(badges()[0]);
      await settle();

      expect(service.gfx.selection.selectedElements).toHaveLength(0);
      expect(bubble()).not.toBeNull();
    });

    test('clicking elsewhere closes the bubble', async () => {
      addBackground();
      addComponent('[3000,3000,40,40]');
      await settle();
      clickElement(badges()[0]);
      await settle();
      expect(bubble()).not.toBeNull();

      clickElement(document.body);
      await settle();

      expect(bubble()).toBeNull();
      // The badge itself stays: the violation has not gone anywhere.
      expect(badges()).toHaveLength(1);
    });

    test('escape closes the bubble', async () => {
      addBackground();
      addComponent('[3000,3000,40,40]');
      await settle();
      clickElement(badges()[0]);
      await settle();
      expect(bubble()).not.toBeNull();

      document.dispatchEvent(
        new KeyboardEvent('keydown', {
          key: 'Escape',
          bubbles: true,
          composed: true,
        })
      );
      await settle();

      expect(bubble()).toBeNull();
    });

    test('clicking the badge again closes the bubble', async () => {
      addBackground();
      addComponent('[3000,3000,40,40]');
      await settle();

      clickElement(badges()[0]);
      await settle();
      expect(bubble()).not.toBeNull();

      clickElement(badges()[0]);
      await settle();
      expect(bubble()).toBeNull();
    });

    test('correcting the drawing takes badge and bubble away', async () => {
      addBackground();
      const id = addComponent('[3000,3000,40,40]');
      await settle();
      clickElement(badges()[0]);
      await settle();
      expect(bubble()).not.toBeNull();

      // Back on the map.
      service.surface.updateElement(id, { xywh: '[200,200,40,40]' });
      await settle();

      expect(validation.violations$.value).toEqual([]);
      expect(badges()).toHaveLength(0);
      expect(bubble()).toBeNull();

      // ...and it stays closed: breaking the same element again must not
      // resurrect the bubble on its own.
      service.surface.updateElement(id, { xywh: '[3000,3000,40,40]' });
      await settle();

      expect(badges()).toHaveLength(1);
      expect(bubble()).toBeNull();
    });

    test('two violating members of one group share one badge and one line', async () => {
      addBackground();
      const a = addComponent('[3000,3000,40,40]');
      const b = addComponent('[3100,3000,40,40]');
      groupOf([a, b]);
      await settle();

      // Two violations — the engine still indicts each element separately —
      // but one badge, and one line: the bubble speaks about RULES, and the
      // same rule said twice says nothing extra.
      expect(validation.violations$.value).toHaveLength(2);
      expect(badges()).toHaveLength(1);

      clickElement(badges()[0]);
      await settle();

      expect(bubble()?.querySelectorAll('.violation-entry')).toHaveLength(1);
    });

    test('a group that is dissolved hands its badge back to the element', async () => {
      addBackground();
      const nodeId = addComponent('[3000,3000,40,40]');
      const labelId = service.surface.addElement({
        type: 'text',
        xywh: '[3050,3000,120,24]',
        text: new Text('Payments'),
      });
      const groupId = groupOf([nodeId, labelId]);
      await settle();

      const grouped = (badges()[0] as HTMLElement).style.left;
      service.std.command.exec(ungroupCommand, {
        group: service.surface.getElementById(groupId) as GroupElementModel,
      });
      await settle();

      expect(badges()).toHaveLength(1);
      // The anchor shrank back to the bare node, so the badge moved left.
      expect(parseFloat((badges()[0] as HTMLElement).style.left)).toBeLessThan(
        parseFloat(grouped)
      );
    });
  });

  describe('with a catalogue registered by the host', () => {
    beforeEach(async () =>
      mount([
        TranslationExtension({
          t: key =>
            key === 'com.labre.wardley.validation.component-outside-map'
              ? 'This component sits outside the map'
              : undefined,
        }),
      ])
    );

    test('the bubble shows the resolved label, and falls back per key', async () => {
      addBackground();
      addComponent('[3000,3000,40,40]');
      await settle();

      clickElement(badges()[0]);
      await settle();

      const text = bubble()?.textContent ?? '';
      expect(text).toContain('This component sits outside the map');
      // The message key itself is gone from the bubble; the only occurrence
      // left is the SUGGESTION key, which the catalogue does not know.
      expect(
        text.split('com.labre.wardley.validation.component-outside-map').length
      ).toBe(2);
      // The suggestion has no entry, so it degrades on its own.
      expect(text).toContain(
        'com.labre.wardley.validation.component-outside-map.suggestion'
      );
    });
  });
});
