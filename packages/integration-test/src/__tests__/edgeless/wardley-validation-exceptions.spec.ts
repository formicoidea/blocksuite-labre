import type { EdgelessRootBlockComponent } from '@labre/affine/blocks/root';
import {
  elementExceptions,
  evaluateRules,
  hasException,
  ValidationManager,
  VIOLATION_DETAIL_WIDGET,
  VIOLATION_EMPHASIS_MS,
} from '@labre/affine/blocks/surface';
import { createGroupCommand } from '@labre/affine/gfx/group';
import { AffineSchemas } from '@labre/affine/schemas';
import { replaceIdMiddleware } from '@labre/affine/shared/adapters';
import {
  TelemetryExtension,
  type TelemetryEventMap,
} from '@labre/affine/shared/services';
import type { SurfaceBlockModel } from '@labre/affine/std/gfx';
import type { ExtensionType, Store } from '@labre/store';
import { Schema, Transformer } from '@labre/store';
import { afterEach, beforeEach, describe, expect, test } from 'vitest';

import { wait } from '../utils/common.js';
import { getDocRootBlock } from '../utils/edgeless.js';
import { setupEditor } from '../utils/setup.js';

/**
 * PF8 end to end: "no rule is a wall".
 *
 * The unit suites own the arbitration logic (`validation-exceptions.unit.spec`)
 * and the rule itself. This one owns what only a real editor can answer — that
 * the way out is one click on the message, that the document is what remembers
 * it, and that it survives everything a document goes through: a copy, an
 * export, a reload, and the framework being switched off and back on.
 */

const RULE_ID = 'wardley.component-outside-map';

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

const press = (key: string) =>
  document.dispatchEvent(
    new KeyboardEvent('keydown', {
      key,
      ctrlKey: true,
      bubbles: true,
      cancelable: true,
    })
  );

/** See the note in `wardley-validation-bubble.spec.ts`: the viewport persists. */
const VIEWPORT_STORAGE_KEY = 'blocksuite:doc:home:edgelessViewport';

function forgetStoredViewport() {
  localStorage.removeItem(VIEWPORT_STORAGE_KEY);
  sessionStorage.removeItem(VIEWPORT_STORAGE_KEY);
}

type TrackedEvent = {
  name: keyof TelemetryEventMap;
  props: Record<string, unknown>;
};

describe('validation exceptions', () => {
  let service!: EdgelessRootBlockComponent['service'];
  let root!: EdgelessRootBlockComponent;
  let validation!: ValidationManager;
  let tracked!: TrackedEvent[];

  const addBackground = () =>
    service.surface.addElement({
      type: 'wardley',
      role: 'wardley:map',
      xywh: '[0,0,1600,900]',
    });

  const addComponent = (xywh: string) =>
    service.surface.addElement({
      type: 'wardleyNode',
      kind: 'component',
      role: 'wardley:component',
      xywh,
    });

  const groupOf = (ids: string[]) => {
    const [, result] = service.std.command.exec(createGroupCommand, {
      elements: ids,
    });
    return result.groupId as string;
  };

  const widget = () => root.widgetComponents[VIOLATION_DETAIL_WIDGET];
  const widgetRoot = () => widget()?.shadowRoot ?? null;
  const queryAll = (selector: string) =>
    Array.from(widgetRoot()?.querySelectorAll(selector) ?? []);

  const badges = () => queryAll('[data-testid="violation-badge"]');
  const bracketHits = () => queryAll('[data-testid="violation-bracket-hit"]');
  const bubble = () =>
    widgetRoot()?.querySelector('[data-testid="violation-bubble"]') ?? null;
  const ignoreButton = () =>
    widgetRoot()?.querySelector('[data-testid="violation-ignore"]') ?? null;
  const ignoreMapButton = () =>
    widgetRoot()?.querySelector('[data-testid="violation-ignore-map"]') ?? null;
  const revokeButton = () =>
    widgetRoot()?.querySelector('[data-testid="violation-revoke"]') ?? null;

  const settle = async () => {
    await wait(250);
    await root.updateComplete;
    await widget()?.updateComplete;
    await wait(0);
  };

  /** Age every mark past its window, so the badge is due. */
  const age = async () => {
    validation.timeline.clear();
    validation.timeline.sync(
      validation.violations$.value.filter(
        violation =>
          violation.severity !== 'audit' && violation.exemption === undefined
      ),
      performance.now() - VIOLATION_EMPHASIS_MS - 1
    );
    widget()?.requestUpdate();
    await settle();
  };

  const violationOf = (elementId: string) =>
    validation.violations$.value.find(violation =>
      violation.elementIds.includes(elementId)
    );

  const model = (id: string) => service.surface.getElementById(id)!;

  /** Open the bubble on the anchor of the only violation on the board. */
  const openBubble = async () => {
    await age();
    clickElement(badges()[0]);
    await settle();
    expect(bubble()).not.toBeNull();
  };

  const mount = async (extensions: ExtensionType[] = []) => {
    forgetStoredViewport();
    tracked = [];
    const cleanup = await setupEditor('edgeless', [
      TelemetryExtension({
        track: (name, props) =>
          tracked.push({
            name,
            props: props as unknown as Record<string, unknown>,
          }),
      }),
      ...extensions,
    ]);
    root = getDocRootBlock(window.doc, window.editor, 'edgeless');
    service = root.service;
    service.std.event.active = true;
    validation = service.std.get(ValidationManager);
    return cleanup;
  };

  beforeEach(async () => mount());
  afterEach(() => forgetStoredViewport());

  describe('the way out is on the message itself (PF8.1)', () => {
    test('one click on the bubble waives the rule, with no detour', async () => {
      addBackground();
      const id = addComponent('[3000,3000,40,40]');
      await settle();
      await openBubble();

      expect(ignoreButton()).not.toBeNull();
      clickElement(ignoreButton()!);

      // Applied IMMEDIATELY — no waiting for the 120 ms re-evaluation debounce.
      expect(violationOf(id)?.exemption).toBe('element');
      expect(hasException(model(id), RULE_ID)).toBe(true);
    });

    test('the finding changes state, it does not disappear (PF8.3)', async () => {
      addBackground();
      addComponent('[3000,3000,40,40]');
      await settle();
      await openBubble();
      clickElement(ignoreButton()!);
      await settle();

      // Still reported by the engine — zero hidden violations.
      expect(validation.violations$.value).toHaveLength(1);
      // Out of the loud affordance: no bracket, and a badge that has gone grey.
      expect(bracketHits()).toHaveLength(0);
      expect(badges()).toHaveLength(1);
      expect((badges()[0] as HTMLElement).dataset.exempted).toBe('true');
      // ...and still listed, now with the way back.
      expect(revokeButton()).not.toBeNull();
      expect(ignoreButton()).toBeNull();
    });

    test('revoking restores the violation', async () => {
      addBackground();
      const id = addComponent('[3000,3000,40,40]');
      await settle();
      await openBubble();
      clickElement(ignoreButton()!);
      await settle();

      clickElement(revokeButton()!);
      await settle();

      expect(violationOf(id)?.exemption).toBeUndefined();
      expect(model(id).validationExceptions).toBeUndefined();
      await age();
      expect((badges()[0] as HTMLElement).dataset.exempted).toBe('false');
      expect(ignoreButton()).not.toBeNull();
    });

    test('one click settles every member of a grouped component', async () => {
      addBackground();
      const a = addComponent('[3000,3000,40,40]');
      const b = addComponent('[3100,3000,40,40]');
      groupOf([a, b]);
      await settle();
      await openBubble();

      // One line for the rule, one click, both indicted members excused.
      expect(queryAll('.violation-entry')).toHaveLength(1);
      clickElement(ignoreButton()!);
      await settle();

      expect(hasException(model(a), RULE_ID)).toBe(true);
      expect(hasException(model(b), RULE_ID)).toBe(true);
      expect(
        validation.violations$.value.every(v => v.exemption === 'element')
      ).toBe(true);
    });
  });

  describe('an exception reaches nothing else (PF8.2)', () => {
    test('the element next to it keeps its live violation', async () => {
      addBackground();
      const excused = addComponent('[3000,3000,40,40]');
      const other = addComponent('[4000,3000,40,40]');
      await settle();
      await age();

      const badge = badges().find(
        el => (el as HTMLElement).dataset.anchorId === excused
      )!;
      clickElement(badge);
      await settle();
      clickElement(ignoreButton()!);
      await settle();

      expect(violationOf(excused)?.exemption).toBe('element');
      expect(violationOf(other)?.exemption).toBeUndefined();
      expect(model(other).validationExceptions).toBeUndefined();

      await age();
      const exemptedFlags = badges().map(
        el => (el as HTMLElement).dataset.exempted
      );
      expect(exemptedFlags.sort()).toEqual(['false', 'true']);
    });

    test('deleting the element takes its exception with it', async () => {
      addBackground();
      const id = addComponent('[3000,3000,40,40]');
      await settle();
      await openBubble();
      clickElement(ignoreButton()!);
      await settle();

      service.surface.deleteElement(id);
      await settle();

      // It lived in the element's own props: nothing to garbage-collect, and
      // nothing left behind to excuse a future element that reuses the id.
      expect(service.surface.getElementById(id)).toBeNull();
      expect(validation.violations$.value).toEqual([]);
    });
  });

  describe('ignoring on the whole map (PF8.4)', () => {
    test('is offered only once the call has been repeated', async () => {
      addBackground();
      const first = addComponent('[3000,3000,40,40]');
      const second = addComponent('[4000,3000,40,40]');
      await settle();
      await age();

      const badgeOf = (id: string) =>
        badges().find(el => (el as HTMLElement).dataset.anchorId === id)!;

      // First time: a local judgement about one element, and nothing more.
      clickElement(badgeOf(first));
      await settle();
      expect(ignoreButton()).not.toBeNull();
      expect(ignoreMapButton()).toBeNull();
      clickElement(ignoreButton()!);
      await settle();

      // Second time, same rule: now the wider way out is worth proposing.
      await age();
      clickElement(badgeOf(second));
      await settle();
      expect(ignoreMapButton()).not.toBeNull();
    });

    test('writes the exception on the map, and covers everything it frames', async () => {
      addBackground();
      const first = addComponent('[3000,3000,40,40]');
      const second = addComponent('[4000,3000,40,40]');
      const third = addComponent('[5000,3000,40,40]');
      await settle();
      await age();

      const badgeOf = (id: string) =>
        badges().find(el => (el as HTMLElement).dataset.anchorId === id)!;
      clickElement(badgeOf(first));
      await settle();
      clickElement(ignoreButton()!);
      await settle();
      await age();
      clickElement(badgeOf(second));
      await settle();
      clickElement(ignoreMapButton()!);
      await settle();

      const background = service.surface.getElementsByType('wardley')[0];
      // No block schema change and no per-document store: "the whole map" is
      // literally a property of the map element.
      expect(hasException(background, RULE_ID)).toBe(true);
      expect(violationOf(second)?.exemption).toBe('map');
      expect(violationOf(third)?.exemption).toBe('map');
      // The one that already had its own keeps the narrower scope reported.
      expect(violationOf(first)?.exemption).toBe('element');
    });

    test('a map-scope exception is revocable like any other', async () => {
      addBackground();
      const first = addComponent('[3000,3000,40,40]');
      const second = addComponent('[4000,3000,40,40]');
      await settle();
      await age();

      const badgeOf = (id: string) =>
        badges().find(el => (el as HTMLElement).dataset.anchorId === id)!;
      clickElement(badgeOf(first));
      await settle();
      clickElement(ignoreButton()!);
      await settle();
      await age();
      clickElement(badgeOf(second));
      await settle();
      clickElement(ignoreMapButton()!);
      await settle();
      expect(violationOf(second)?.exemption).toBe('map');

      clickElement(revokeButton()!);
      await settle();

      const background = service.surface.getElementsByType('wardley')[0];
      expect(hasException(background, RULE_ID)).toBe(false);
      expect(violationOf(second)?.exemption).toBeUndefined();
    });
  });

  describe('what the document remembers', () => {
    test('the exception carries the rule and the moment of the gesture', async () => {
      addBackground();
      const before = Date.now();
      const id = addComponent('[3000,3000,40,40]');
      await settle();
      await openBubble();
      clickElement(ignoreButton()!);
      await settle();

      const [exception] = elementExceptions(model(id));
      expect(exception.ruleId).toBe(RULE_ID);
      expect(exception.at).toBeGreaterThanOrEqual(before);
      expect(exception.at).toBeLessThanOrEqual(Date.now());
    });

    test('it is in the Y document, not in the tab', async () => {
      addBackground();
      const id = addComponent('[3000,3000,40,40]');
      await settle();
      await openBubble();
      clickElement(ignoreButton()!);
      await settle();

      // Straight out of the CRDT: what a peer and a reload will see.
      const stored = model(id).yMap.get('validationExceptions') as unknown[];
      expect(stored).toHaveLength(1);
      expect((stored[0] as { ruleId: string }).ruleId).toBe(RULE_ID);
    });

    test('a mod+d duplicate carries it (PF8.2, the @field base declaration)', async () => {
      addBackground();
      const id = addComponent('[3000,3000,40,40]');
      await settle();
      await openBubble();
      clickElement(ignoreButton()!);
      await settle();

      service.gfx.selection.set({ elements: [id], editing: false });
      press('d');
      await wait(200);

      const nodes = service.surface.getElementsByType('wardleyNode');
      expect(nodes).toHaveLength(2);
      // Declared on the BASE class precisely so a copy cannot strip it: an
      // arbitration the user made explicitly must survive a duplicate.
      expect(nodes.every(node => hasException(node, RULE_ID))).toBe(true);
    });

    test('a snapshot round trip keeps it (PF8.5: exceptions are exported)', async () => {
      addBackground();
      const id = addComponent('[3000,3000,40,40]');
      await settle();
      await openBubble();
      clickElement(ignoreButton()!);
      await settle();

      const transformer = () =>
        new Transformer({
          schema: new Schema().register(AffineSchemas),
          blobCRUD: window.collection.blobSync,
          docCRUD: {
            create: (docId: string) =>
              window.collection.createDoc(docId).getStore({ id: docId }),
            get: (docId: string) =>
              window.collection.getDoc(docId)?.getStore({ id: docId }) ?? null,
            delete: (docId: string) => window.collection.removeDoc(docId),
          },
          middlewares: [replaceIdMiddleware(window.collection.idGenerator)],
        });

      const snapshot = transformer().docToSnapshot(window.doc);
      expect(snapshot).toBeTruthy();
      // A non-conformant map stays readable AND honest about its gaps: the
      // arbitration travels with the export, it is not silently dropped.
      expect(JSON.stringify(snapshot)).toContain('validationExceptions');

      const reloaded = (await transformer().snapshotToDoc(snapshot!)) as Store;
      const surface = reloaded.getModelsByFlavour(
        'affine:surface'
      )[0] as SurfaceBlockModel;
      const nodes = surface.getElementsByType('wardleyNode');

      expect(nodes).toHaveLength(1);
      expect(hasException(nodes[0], RULE_ID)).toBe(true);
      expect(elementExceptions(nodes[0])[0].ruleId).toBe(RULE_ID);
      // Round trip, not resurrection: the source element is untouched.
      expect(hasException(model(id), RULE_ID)).toBe(true);
    });
  });

  describe('the framework cycle (PF8.6)', () => {
    test('flag off evaluates nothing and cleans nothing; flag on honours the exception', async () => {
      addBackground();
      const excused = addComponent('[3000,3000,40,40]');
      const other = addComponent('[4000,3000,40,40]');
      await settle();
      await age();

      const badge = badges().find(
        el => (el as HTMLElement).dataset.anchorId === excused
      )!;
      clickElement(badge);
      await settle();
      clickElement(ignoreButton()!);
      await settle();

      // Flag OFF: the flag-gated view extension registers no rule, so the
      // engine has nothing to run — and nothing to clean up either.
      const elements = service.surface.elementModels;
      const rule = validation.ruleOf(RULE_ID)!;
      expect(rule).toBeTruthy();
      expect(evaluateRules([], elements)).toEqual([]);
      expect(hasException(model(excused), RULE_ID)).toBe(true);

      // Flag back ON: the violations come back — all but the excused one.
      const back = evaluateRules([rule], elements);
      expect(back).toHaveLength(2);
      const byElement = new Map(back.map(v => [v.elementIds[0], v]));
      expect(byElement.get(excused)?.exemption).toBe('element');
      expect(byElement.get(other)?.exemption).toBeUndefined();
    });
  });

  describe('telemetry', () => {
    test('reports a grant and a revocation, and nothing for a no-op', async () => {
      addBackground();
      const id = addComponent('[3000,3000,40,40]');
      await settle();
      await openBubble();

      clickElement(ignoreButton()!);
      await settle();
      const granted = tracked.filter(
        event => event.name === 'ValidationExceptionGranted'
      );
      expect(granted).toHaveLength(1);
      expect(granted[0].props).toMatchObject({
        ruleId: RULE_ID,
        framework: 'wardley',
        scope: 'element',
        elementCount: 1,
      });

      clickElement(revokeButton()!);
      await settle();
      expect(
        tracked.filter(event => event.name === 'ValidationExceptionRevoked')
      ).toHaveLength(1);

      // Granting the same exception twice is not two arbitrations: nothing is
      // written, so the widget has nothing to report.
      clickElement(ignoreButton()!);
      await settle();
      expect(validation.setException([violationOf(id)!], 'element', true)).toEqual(
        []
      );
      expect(
        tracked.filter(event => event.name === 'ValidationExceptionGranted')
      ).toHaveLength(2);
    });
  });
});
