import type { EdgelessRootBlockComponent } from '@labre/affine/blocks/root';
import {
  grantException,
  hasException,
  ValidationManager,
  VIOLATION_DETAIL_WIDGET,
} from '@labre/affine/blocks/surface';
import type { BlockFlags } from '@labre/affine/flags';
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
 * PF9 end to end: a level of requirement, chosen per map.
 *
 * The unit suites own the resolution itself (which profile judges which
 * finding, what `'off'` costs). This one owns what only a real editor can
 * answer — that the choice is reachable, that the DOCUMENT is what remembers
 * it, that the default writes nothing at all, and that it survives a
 * duplicate, an export and a reload.
 */

const RULE_ID = 'wardley.component-outside-map';
const SKETCH = 'wardley.sketch';
const STRICT = 'wardley.strict';

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

describe('validation profiles', () => {
  let service!: EdgelessRootBlockComponent['service'];
  let root!: EdgelessRootBlockComponent;
  let validation!: ValidationManager;
  let tracked!: TrackedEvent[];
  let unmount: (() => void) | null = null;

  /** A map with no profile key at all — i.e. every map ever drawn before PF9. */
  const addBackground = (xywh = '[0,0,1600,900]') =>
    service.surface.addElement({ type: 'wardley', role: 'wardley:map', xywh });

  const addComponent = (xywh: string) =>
    service.surface.addElement({
      type: 'wardleyNode',
      kind: 'component',
      role: 'wardley:component',
      xywh,
    });

  const widget = () => root.widgetComponents[VIOLATION_DETAIL_WIDGET];
  const widgetRoot = () => widget()?.shadowRoot ?? null;
  const query = (selector: string) =>
    widgetRoot()?.querySelector(selector) ?? null;

  const chip = () => query('[data-testid="validation-profile-chip"]');
  const menu = () => query('[data-testid="validation-profile-menu"]');
  const options = () =>
    Array.from(
      widgetRoot()?.querySelectorAll('[data-testid="validation-profile-option"]') ??
        []
    );
  const option = (id: string) =>
    options().find(el => (el as HTMLElement).dataset.profileId === id) ?? null;
  const badges = () =>
    Array.from(
      widgetRoot()?.querySelectorAll('[data-testid="violation-badge"]') ?? []
    );

  const model = (id: string) => service.surface.getElementById(id)!;

  const settle = async () => {
    await wait(250);
    await root.updateComplete;
    await widget()?.updateComplete;
    await wait(0);
  };

  const select = async (id: string) => {
    service.gfx.selection.set({ elements: [id], editing: false });
    await settle();
  };

  /** Select the map and pick `profileId` from the chip, as a user would. */
  const pick = async (mapId: string, profileId: string) => {
    await select(mapId);
    expect(chip()).not.toBeNull();
    clickElement(chip()!);
    await settle();
    expect(option(profileId)).not.toBeNull();
    clickElement(option(profileId)!);
    await settle();
  };

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
    return () => {
      unmount?.();
      unmount = null;
    };
  });
  afterEach(() => forgetStoredViewport());

  describe('a document that predates profiles', () => {
    test('opens on the permissive default, and stays silent', async () => {
      const map = addBackground();
      addComponent('[3000,3000,40,40]');
      await settle();

      expect(validation.profileOf(model(map))?.id).toBe(SKETCH);
      // The finding exists and is reported...
      expect(validation.violations$.value).toHaveLength(1);
      expect(validation.violations$.value[0].severity).toBe('audit');
      // ...and the canvas says nothing at all: the sketch wins.
      expect(badges()).toHaveLength(0);
    });

    test('writes nothing, ever, while it stays on the default', async () => {
      const map = addBackground();
      addComponent('[3000,3000,40,40]');
      await settle();
      // Selecting it, opening the chip, and choosing the profile it is already
      // on: no key appears in the document.
      await pick(map, SKETCH);

      expect(model(map).yMap.has('validationProfile')).toBe(false);
      expect(model(map).validationProfile).toBeUndefined();
    });
  });

  describe('the chip is where the choice lives', () => {
    test('appears on a selected map, naming the level in force', async () => {
      const map = addBackground();
      await select(map);

      expect(chip()).not.toBeNull();
      expect((chip() as HTMLElement).dataset.profileId).toBe(SKETCH);
    });

    test('is reachable on a CLEAN board, with no violation anywhere', async () => {
      // The whole reason it is not on the violation bubble: on the permissive
      // default nothing is ever drawn, so a bubble-only selector would make
      // the strict profile unreachable — a one-way door.
      const map = addBackground();
      await settle();
      expect(validation.violations$.value).toEqual([]);

      await select(map);
      expect(chip()).not.toBeNull();
    });

    test('offers every profile the framework ships, marking the current one', async () => {
      const map = addBackground();
      await select(map);
      clickElement(chip()!);
      await settle();

      expect(menu()).not.toBeNull();
      expect(
        options().map(el => (el as HTMLElement).dataset.profileId)
      ).toEqual([SKETCH, STRICT]);
      expect(option(SKETCH)!.getAttribute('aria-checked')).toBe('true');
      expect(option(STRICT)!.getAttribute('aria-checked')).toBe('false');
    });

    test('never appears on something that is not a root instance', async () => {
      addBackground();
      const node = addComponent('[100,100,40,40]');
      await select(node);

      // The chip is derived from the registered rules' `backgroundRole`: a
      // component is not a frame, so there is nothing to choose.
      expect(chip()).toBeNull();
    });

    test('never appears on a map authored before its role existed', async () => {
      const legacy = service.surface.addElement({
        type: 'wardley',
        xywh: '[0,0,1600,900]',
      });
      await select(legacy);

      expect(chip()).toBeNull();
    });

    test('goes away with its instance, even when the selection does not', async () => {
      const map = addBackground();
      await select(map);
      expect(chip()).not.toBeNull();

      service.surface.deleteElement(map);
      await settle();

      // Nothing prunes the selection when an element leaves the surface — an
      // undo, or a peer's deletion, gets there with no local gesture at all. So
      // the chip resolves its instance LATE: held as a model it would be drawn
      // over nothing, and a click would write into a Y.Map the document no
      // longer reaches, silently losing the write.
      expect(service.gfx.selection.selectedIds).toContain(map);
      expect(chip()).toBeNull();
    });

    test('is gone when the framework is flagged off', async () => {
      unmount?.();
      await mount([], { wardley: false });
      const map = addBackground();
      await select(map);

      // A level of requirement is tooling: no rule registered, nothing to
      // choose between.
      expect(validation.profilesFor(model(map))).toEqual([]);
      expect(chip()).toBeNull();
    });
  });

  describe('changing the level re-judges the board', () => {
    test('strict makes the finding visible on the canvas', async () => {
      const map = addBackground();
      addComponent('[3000,3000,40,40]');
      await settle();
      expect(validation.violations$.value[0].severity).toBe('audit');

      await pick(map, STRICT);

      // Applied IMMEDIATELY — no waiting for the 120 ms debounce.
      expect(validation.violations$.value[0].severity).toBe('warning');
      expect(validation.profileOf(model(map))?.id).toBe(STRICT);
    });

    test('and going back to the default silences it again', async () => {
      const map = addBackground();
      addComponent('[3000,3000,40,40]');
      await settle();
      await pick(map, STRICT);
      expect(model(map).yMap.has('validationProfile')).toBe(true);

      await pick(map, SKETCH);

      expect(validation.violations$.value[0].severity).toBe('audit');
      // Choosing the default removes the KEY rather than writing it: a map that
      // tried strict and came back leaves no trace, in the document and not
      // just in this tab.
      expect(model(map).yMap.has('validationProfile')).toBe(false);
    });

    test('gives two maps on one canvas two different levels (PF9.1)', async () => {
      const sketchMap = addBackground();
      const strictMap = addBackground('[40000,0,1600,900]');
      const nearSketch = addComponent('[3000,3000,40,40]');
      const nearStrict = addComponent('[41800,300,40,40]');
      await settle();

      await pick(strictMap, STRICT);

      const severityOf = (elementId: string) =>
        validation.violations$.value.find(violation =>
          violation.elementIds.includes(elementId)
        )?.severity;
      expect(severityOf(nearSketch)).toBe('audit');
      expect(severityOf(nearStrict)).toBe('warning');
      expect(model(sketchMap).validationProfile).toBeUndefined();
    });

    test('never touches an exception the user made (PF9.3)', async () => {
      const map = addBackground();
      const excused = addComponent('[3000,3000,40,40]');
      grantException(model(excused), RULE_ID);
      await settle();

      await pick(map, STRICT);
      expect(hasException(model(excused), RULE_ID)).toBe(true);
      await pick(map, SKETCH);

      // Raising the level does not resurrect a decision, and lowering it does
      // not quietly delete one.
      expect(hasException(model(excused), RULE_ID)).toBe(true);
      expect(
        validation.violations$.value.find(violation =>
          violation.elementIds.includes(excused)
        )?.exemption
      ).toBe('element');
    });
  });

  describe('what the document remembers', () => {
    test('it is in the Y document, not in the tab', async () => {
      const map = addBackground();
      await pick(map, STRICT);

      // Straight out of the CRDT: what a peer and a reload will see.
      expect(model(map).yMap.get('validationProfile')).toBe(STRICT);
    });

    test('a mod+d duplicate carries it (the @field base declaration)', async () => {
      const map = addBackground();
      await pick(map, STRICT);

      await select(map);
      press('d');
      await wait(200);

      const maps = service.surface.getElementsByType('wardley');
      expect(maps).toHaveLength(2);
      // Declared on the BASE class precisely so a copy cannot strip it:
      // duplicating a strict map must give a strict map.
      expect(maps.every(el => el.validationProfile === STRICT)).toBe(true);
    });

    test('a snapshot round trip keeps it', async () => {
      const map = addBackground();
      addComponent('[3000,3000,40,40]');
      await pick(map, STRICT);

      const { snapshot, surface } = await roundTrip();
      expect(JSON.stringify(snapshot)).toContain('validationProfile');

      const maps = surface.getElementsByType('wardley');
      expect(maps).toHaveLength(1);
      expect(maps[0].validationProfile).toBe(STRICT);
      // Round trip, not resurrection: the source element is untouched.
      expect(model(map).validationProfile).toBe(STRICT);
    });

    test('a round trip on the default carries no key at all', async () => {
      addBackground();
      addComponent('[3000,3000,40,40]');
      await settle();

      const { snapshot, surface } = await roundTrip();
      expect(JSON.stringify(snapshot)).not.toContain('validationProfile');
      expect(
        surface.getElementsByType('wardley')[0].validationProfile
      ).toBeUndefined();
    });
  });

  describe('telemetry', () => {
    test('reports the change, and nothing for a no-op', async () => {
      const map = addBackground();
      await pick(map, STRICT);

      const changed = tracked.filter(
        event => event.name === 'ValidationProfileChanged'
      );
      expect(changed).toHaveLength(1);
      expect(changed[0].props).toMatchObject({
        framework: 'wardley',
        profileId: STRICT,
        previousProfileId: SKETCH,
      });

      // Choosing the profile it is already on is not a decision.
      await pick(map, STRICT);
      expect(
        tracked.filter(event => event.name === 'ValidationProfileChanged')
      ).toHaveLength(1);
    });
  });
});
