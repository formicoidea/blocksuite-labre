import type { EdgelessRootBlockComponent } from '@labre/affine/blocks/root';
import {
  elementExceptions,
  evaluateRules,
  grantException,
  hasException,
  ValidationManager,
  VIOLATION_DETAIL_WIDGET,
  VIOLATION_EMPHASIS_MS,
} from '@labre/affine/blocks/surface';
import type { BlockFlags } from '@labre/affine/flags';
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
  let unmount: (() => void) | null = null;

  /**
   * A map on the STRICT profile — since PF9 the default (`wardley.sketch`)
   * demotes the pilot rule to `audit`, and an arbitration you cannot see is an
   * arbitration nobody makes. The profile and the exception are orthogonal on
   * purpose: this suite proves the latter, on a map that asked to be checked.
   */
  const addBackground = (xywh = '[0,0,1600,900]') =>
    service.surface.addElement({
      type: 'wardley',
      role: 'wardley:map',
      validationProfile: 'wardley.strict',
      xywh,
    });

  /** A second map, far enough away that "nearest" is never in doubt. */
  const addSecondBackground = () => addBackground('[40000,0,1600,900]');

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

  /**
   * Serialize the live document and read it back — fresh element models, built
   * from the snapshot rather than handed over from the running surface.
   */
  const roundTrip = async () => {
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
    const reloaded = (await transformer().snapshotToDoc(snapshot!)) as Store;
    return {
      snapshot: snapshot!,
      surface: reloaded.getModelsByFlavour(
        'affine:surface'
      )[0] as SurfaceBlockModel,
    };
  };

  const mount = async (
    extensions: ExtensionType[] = [],
    flags?: BlockFlags
  ) => {
    forgetStoredViewport();
    tracked = [];
    const cleanup = await setupEditor(
      'edgeless',
      [
        TelemetryExtension({
          track: (name, props) =>
            tracked.push({
              name,
              props: props as unknown as Record<string, unknown>,
            }),
        }),
        ...extensions,
      ],
      flags ? { flags } : undefined
    );
    unmount = cleanup;
    root = getDocRootBlock(window.doc, window.editor, 'edgeless');
    service = root.service;
    service.std.event.active = true;
    validation = service.std.get(ValidationManager);
  };

  beforeEach(async () => {
    await mount();
    // Tear down whatever is mounted at the END of the test, not whatever was
    // mounted here: one spec below remounts with a framework flagged off.
    return () => {
      unmount?.();
      unmount = null;
    };
  });
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

      // Still reported by the engine — zero hidden violations (PF8.3).
      expect(validation.violations$.value).toHaveLength(1);
      // But the canvas goes quiet: no bracket, and no badge either. The grey
      // one PF8 shipped here was sent back by the PO — an excused finding is a
      // decision the user made, and a permanent dot arguing with it is noise.
      // The way back is the element's contextual toolbar; see
      // `wardley-revoke-exception.spec.ts`.
      expect(bracketHits()).toHaveLength(0);
      expect(badges()).toHaveLength(0);
      expect(bubble()).toBeNull();
    });

    test('revoking restores the violation', async () => {
      addBackground();
      const id = addComponent('[3000,3000,40,40]');
      await settle();
      await openBubble();
      clickElement(ignoreButton()!);
      await settle();

      // Taken back from the element's contextual toolbar, which is what the
      // entry's `run` calls.
      validation.revokeExceptionsOn(model(id));
      await settle();

      expect(violationOf(id)?.exemption).toBeUndefined();
      expect(model(id).validationExceptions).toBeUndefined();
      await age();
      expect(badges()).toHaveLength(1);
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

  describe('a gesture can always be undone', () => {
    /**
     * Open the bubble on a lone violation and close the undo step behind
     * everything that built the board, so the next `undo()` takes back the
     * GESTURE and not the drawing it was made on.
     */
    const readyToWaive = async () => {
      addBackground();
      const id = addComponent('[3000,3000,40,40]');
      await settle();
      await openBubble();
      service.std.store.captureSync();
      return id;
    };

    test('undoing a waiver brings the live violation back, with a working bubble', async () => {
      const id = await readyToWaive();
      clickElement(ignoreButton()!);
      await settle();
      expect(violationOf(id)?.exemption).toBe('element');

      // An undo DELETES the key. That is a `delete` action, which fills only
      // `oldValues` — the payload shape neither guard used to look at, so the
      // board stayed frozen on a stale verdict with a dead Revoke on it.
      service.std.store.undo();
      await settle();

      expect(model(id).validationExceptions).toBeUndefined();
      expect(violationOf(id)?.exemption).toBeUndefined();
      // The affordance followed the document: the marker the waiver took away
      // is back, and it opens a bubble offering the way out again.
      await age();
      expect(badges()).toHaveLength(1);
      clickElement(badges()[0]);
      await settle();
      expect(ignoreButton()).not.toBeNull();
      expect(revokeButton()).toBeNull();
    });

    test('redoing puts the waiver back', async () => {
      const id = await readyToWaive();
      clickElement(ignoreButton()!);
      await settle();

      service.std.store.undo();
      await settle();
      expect(violationOf(id)?.exemption).toBeUndefined();

      service.std.store.redo();
      await settle();
      expect(violationOf(id)?.exemption).toBe('element');
      expect(hasException(model(id), RULE_ID)).toBe(true);
    });

    test('undoing a revocation restores the waiver', async () => {
      const id = await readyToWaive();
      clickElement(ignoreButton()!);
      await settle();
      service.std.store.captureSync();

      validation.revokeExceptionsOn(model(id));
      await settle();
      expect(model(id).yMap.has('validationExceptions')).toBe(false);

      // The revocation is itself a delete, so the round trip exercises the
      // guard in both directions.
      service.std.store.undo();
      await settle();

      expect(hasException(model(id), RULE_ID)).toBe(true);
      expect(violationOf(id)?.exemption).toBe('element');
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
      // One badge left, on the element nobody arbitrated about. The excused
      // one draws nothing at all.
      expect(badges()).toHaveLength(1);
      expect((badges()[0] as HTMLElement).dataset.anchorId).toBe(other);
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

    test('a residual key on an element the rule never evaluates is not a decision', async () => {
      addBackground();
      const id = addComponent('[3000,3000,40,40]');
      // A neutral rectangle carrying the key — a shape pasted from another
      // board, or a leftover. The rule never evaluates it (no role), so it is
      // not an arbitration and must not unlock the map-wide action on the very
      // first bubble.
      const stray = service.surface.addElement({
        type: 'shape',
        xywh: '[9000,9000,40,40]',
      });
      grantException(model(stray), RULE_ID);
      await settle();
      await openBubble();

      expect(violationOf(id)?.exemption).toBeUndefined();
      expect(ignoreButton()).not.toBeNull();
      expect(ignoreMapButton()).toBeNull();
    });

    test('writes on the map the finding was measured against, and on no other', async () => {
      const mapA = addBackground();
      const mapB = addSecondBackground();
      // Two components parked next to their own map.
      const nearA = addComponent('[3000,3000,40,40]');
      const nearB = addComponent('[43000,3000,40,40]');
      await settle();
      expect(violationOf(nearA)?.backgroundId).toBe(mapA);
      expect(violationOf(nearB)?.backgroundId).toBe(mapB);
      await age();

      const badgeOf = (id: string) =>
        badges().find(el => (el as HTMLElement).dataset.anchorId === id)!;

      // Repeat the call on map A's side, so the wider action is offered there.
      clickElement(badgeOf(nearA));
      await settle();
      clickElement(ignoreButton()!);
      await settle();
      await age();
      const secondNearA = addComponent('[3200,3000,40,40]');
      await settle();
      await age();
      clickElement(badgeOf(secondNearA));
      await settle();
      clickElement(ignoreMapButton()!);
      await settle();

      // The user designated ONE map. The other one is untouched, and the
      // component parked next to it is still in violation.
      expect(hasException(model(mapA), RULE_ID)).toBe(true);
      expect(hasException(model(mapB), RULE_ID)).toBe(false);
      expect(violationOf(secondNearA)?.exemption).toBe('map');
      expect(violationOf(nearB)?.exemption).toBeUndefined();
    });

    test('reports only the map it wrote on, whatever the board carries', async () => {
      addBackground();
      addSecondBackground();
      addBackground('[80000,0,1600,900]');
      const first = addComponent('[3000,3000,40,40]');
      const second = addComponent('[3200,3000,40,40]');
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
      tracked.length = 0;
      clickElement(ignoreMapButton()!);
      await settle();

      const [granted] = tracked.filter(
        event => event.name === 'ValidationExceptionGranted'
      );
      // Three maps on the board, one arbitration, one element written.
      expect(granted.props).toMatchObject({ scope: 'map', elementCount: 1 });
    });

    test('deleting the map takes its own arbitration and no other', async () => {
      const mapA = addBackground();
      const mapB = addSecondBackground();
      const nearA = addComponent('[3000,3000,40,40]');
      const nearB = addComponent('[43000,3000,40,40]');
      await settle();

      // Write both map-scope exceptions straight on the models: the UI path is
      // covered above, what is under test here is the lifetime.
      grantException(model(mapA), RULE_ID);
      grantException(model(mapB), RULE_ID);
      validation.evaluate();
      expect(violationOf(nearA)?.exemption).toBe('map');
      expect(violationOf(nearB)?.exemption).toBe('map');

      service.surface.deleteElement(mapA);
      await settle();

      // A's arbitration died with A. B's is intact — nothing orphaned, nothing
      // leaked across.
      expect(hasException(model(mapB), RULE_ID)).toBe(true);
      // The component that was A's now falls to the only map left, which does
      // carry an exception — so it reads as excused BY B, honestly.
      expect(violationOf(nearB)?.exemption).toBe('map');
      expect(violationOf(nearA)?.backgroundId).toBe(mapB);
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

      // The map-wide arbitration is answered for by the MAP, so it comes off
      // from the background's own contextual toolbar.
      const background = service.surface.getElementsByType('wardley')[0];
      validation.revokeExceptionsOn(background);
      await settle();

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

    test('revoking removes the KEY, not just its value', async () => {
      addBackground();
      const id = addComponent('[3000,3000,40,40]');
      await settle();
      await openBubble();
      clickElement(ignoreButton()!);
      await settle();
      expect(model(id).yMap.has('validationExceptions')).toBe(true);

      validation.revokeExceptionsOn(model(id));
      await settle();

      // Asserted on the Y.Map, not through the getter: assigning `undefined`
      // reads back as absent while leaving a key that syncs to every peer and
      // ships in every snapshot. Byte-identical means byte-identical.
      expect(model(id).yMap.has('validationExceptions')).toBe(false);
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

      const { snapshot, surface } = await roundTrip();
      // A non-conformant map stays readable AND honest about its gaps: the
      // arbitration travels with the export, it is not silently dropped.
      expect(JSON.stringify(snapshot)).toContain('validationExceptions');

      const nodes = surface.getElementsByType('wardleyNode');
      expect(nodes).toHaveLength(1);
      expect(hasException(nodes[0], RULE_ID)).toBe(true);
      expect(elementExceptions(nodes[0])[0].ruleId).toBe(RULE_ID);
      // Round trip, not resurrection: the source element is untouched.
      expect(hasException(model(id), RULE_ID)).toBe(true);
    });
  });

  describe('the framework cycle (PF8.6)', () => {
    test('a manager mounted with the flag OFF evaluates nothing and cleans nothing', async () => {
      // A REAL mount with the Wardley tooling disabled: the flag-gated view
      // extension is absent, so it registers no rule and `mounted()` returns
      // before subscribing to anything.
      unmount?.();
      await mount([], { wardley: false });

      addBackground();
      const excused = addComponent('[3000,3000,40,40]');
      addComponent('[4000,3000,40,40]');
      grantException(model(excused), RULE_ID);
      await settle();

      expect(validation.ruleOf(RULE_ID)).toBeUndefined();
      expect(validation.violations$.value).toEqual([]);
      // And nothing was garbage-collected on the way past: the arbitration is
      // document data, out of reach of a tooling flag by construction.
      expect(hasException(model(excused), RULE_ID)).toBe(true);
    });

    test('a manager mounted with the flag ON honours an exception it did not write', async () => {
      addBackground();
      const excused = addComponent('[3000,3000,40,40]');
      const other = addComponent('[4000,3000,40,40]');
      // Written before the first evaluation ever runs — i.e. exactly what a
      // reload, or a framework switched back on, is handed.
      grantException(model(excused), RULE_ID);
      await settle();

      const byElement = new Map(
        validation.violations$.value.map(v => [v.elementIds[0], v])
      );
      expect(byElement.size).toBe(2);
      expect(byElement.get(excused)?.exemption).toBe('element');
      expect(byElement.get(other)?.exemption).toBeUndefined();
    });

    test('a reloaded document still honours its exceptions', async () => {
      addBackground();
      const id = addComponent('[3000,3000,40,40]');
      await settle();
      await openBubble();
      clickElement(ignoreButton()!);
      await settle();

      // Fresh element models, deserialized from a snapshot — not the live ones.
      const { surface } = await roundTrip();
      const rule = validation.ruleOf(RULE_ID)!;
      const violations = evaluateRules([rule], surface.elementModels);

      expect(violations).toHaveLength(1);
      expect(violations[0].exemption).toBe('element');
      expect(hasException(model(id), RULE_ID)).toBe(true);
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

      // Granting the same exception twice is not two arbitrations: nothing is
      // written, so the widget has nothing to report.
      expect(validation.setException([violationOf(id)!], 'element', true)).toEqual(
        []
      );
      expect(
        tracked.filter(event => event.name === 'ValidationExceptionGranted')
      ).toHaveLength(1);

      // The REVOCATION is reported by the toolbar entry that now owns it — the
      // manager writes, the entry reports — so it is asserted where that entry
      // is tested (`validation-toolbar.unit.spec.ts`). What the manager owes is
      // an honest account of what it wrote, and a no-op writing nothing.
      expect(validation.revokeExceptionsOn(model(id))).toEqual([
        {
          ruleId: RULE_ID,
          framework: 'wardley',
          scope: 'element',
          elementCount: 1,
        },
      ]);
      expect(validation.revokeExceptionsOn(model(id))).toEqual([]);
    });
  });
});
