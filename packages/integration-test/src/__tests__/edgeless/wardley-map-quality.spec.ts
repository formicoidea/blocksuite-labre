import type { EdgelessRootBlockComponent } from '@labre/affine/blocks/root';
import {
  checkedNudges,
  MAP_QUALITY_WIDGET,
  ValidationManager,
} from '@labre/affine/blocks/surface';
import { AFFINE_TOOLBAR_WIDGET } from '@labre/affine/widgets/toolbar';
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
 * Map quality end to end (PF5.14 / PF7.10 / PF7.11 / PF13.8 / PF13.9).
 *
 * The unit suites own the engine — which colours are off-convention, when the
 * majority gate opens, what `setNudgeChecked` writes. This one owns what only a
 * real editor can answer: that the entry is reachable, that the DOCUMENT is what
 * remembers a tick, that ticking nothing writes nothing, that a check-up runs on
 * demand and never during a gesture, and that the whole checklist survives the
 * framework's flag going off and coming back.
 */

const NUDGE = 'wardley.q1-title';
const TONE_RULE = 'wardley.tone-off-convention';
/** The Wardley "change" tone — reserved, and therefore wrong on a component. */
const RED = '#d6455d';

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

const VIEWPORT_STORAGE_KEY = 'blocksuite:doc:home:edgelessViewport';

function forgetStoredViewport() {
  localStorage.removeItem(VIEWPORT_STORAGE_KEY);
  sessionStorage.removeItem(VIEWPORT_STORAGE_KEY);
}

type TrackedEvent = {
  name: keyof TelemetryEventMap;
  props: Record<string, unknown>;
};

describe('map quality', () => {
  let service!: EdgelessRootBlockComponent['service'];
  let root!: EdgelessRootBlockComponent;
  let validation!: ValidationManager;
  let tracked!: TrackedEvent[];
  let unmount: (() => void) | null = null;

  const addBackground = (xywh = '[0,0,1600,900]') =>
    service.surface.addElement({ type: 'wardley', role: 'wardley:map', xywh });

  /** A node drawn exactly the way the Wardley toolbox draws one. */
  const addComponent = (xywh: string, fillColor = '#ffffff') =>
    service.surface.addElement({
      type: 'wardleyNode',
      kind: 'component',
      role: 'wardley:component',
      fillColor,
      strokeColor: '#1f2328',
      // As `actions.ts` creates it — and load-bearing here: the tone rule
      // deliberately ignores the stored fill of an UNFILLED shape, which is
      // what `filled` defaults to on the base shape model.
      filled: true,
      xywh,
    });

  const model = (id: string) => service.surface.getElementById(id)!;

  const widget = () => root.widgetComponents[MAP_QUALITY_WIDGET];
  const widgetRoot = () => widget()?.shadowRoot ?? null;
  const panel = () =>
    widgetRoot()?.querySelector('[data-testid="map-quality-panel"]') ?? null;
  const nudgeRows = () =>
    Array.from(
      widgetRoot()?.querySelectorAll('[data-testid="map-quality-nudge"]') ?? []
    ) as HTMLElement[];
  const nudgeBox = (id: string) =>
    (nudgeRows()
      .find(row => row.dataset.nudgeId === id)
      ?.querySelector('input') as HTMLInputElement | undefined) ?? null;
  const runButton = () =>
    widgetRoot()?.querySelector(
      '[data-testid="map-quality-run"]'
    ) as HTMLButtonElement | null;
  const remarks = () =>
    Array.from(
      widgetRoot()?.querySelectorAll('[data-testid="map-quality-remark"]') ?? []
    );

  const toolbar = () =>
    (
      root.widgetComponents[AFFINE_TOOLBAR_WIDGET] as
        | { toolbar?: HTMLElement }
        | undefined
    )?.toolbar ?? null;
  const openEntry = () =>
    toolbar()?.querySelector('[data-testid="validation-map-quality-open"]') ??
    null;

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

  /** Select the map and open the panel from its toolbar, as a user would. */
  const open = async (mapId: string) => {
    await select(mapId);
    expect(openEntry()).not.toBeNull();
    clickElement(openEntry()!);
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

  describe('the entry, and the panel it opens', () => {
    test('appears on a selected map and opens the panel', async () => {
      const map = addBackground();
      await open(map);

      expect(panel()).not.toBeNull();
      expect(panel()!.getAttribute('data-element-id')).toBe(map);
    });

    test('shows the four Wardley nudges, in order', async () => {
      const map = addBackground();
      await open(map);

      expect(nudgeRows().map(row => row.dataset.nudgeId)).toEqual([
        'wardley.q1-title',
        'wardley.q2-context',
        'wardley.q3-legend',
        'wardley.q4-evolution-axis',
      ]);
      // The framework's own wording reaches the screen with no catalogue
      // registered — the seam a rule's `messageFallback` already uses.
      expect(nudgeRows()[2].textContent).toContain('legended');
    });

    test('never appears on something that is not a root instance', async () => {
      addBackground();
      await select(addComponent('[100,100,40,40]'));

      // Derived from the registered rules' `backgroundRole`: a component is not
      // a frame, so it has no checklist and no check-up.
      expect(openEntry()).toBeNull();
    });

    test('closes on Escape', async () => {
      const map = addBackground();
      await open(map);
      expect(panel()).not.toBeNull();

      service.std.host.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })
      );
      await settle();

      expect(panel()).toBeNull();
    });

    test('closes itself when the instance it is about is deleted', async () => {
      const map = addBackground();
      await open(map);

      service.surface.deleteElement(map);
      await settle();

      expect(panel()).toBeNull();
      expect(validation.mapQualityFor$.value).toBeNull();
    });
  });

  describe('ticking is assuming, and the document remembers', () => {
    test('an untouched map carries no key at all', async () => {
      const map = addBackground();
      await open(map);

      expect(model(map).yMap.has('qualityChecklist')).toBe(false);
      expect(checkedNudges(model(map))).toEqual([]);
    });

    test('ticking writes into the Y document', async () => {
      const map = addBackground();
      await open(map);

      const box = nudgeBox(NUDGE)!;
      box.click();
      await settle();

      // Straight out of the CRDT: what a peer and a reload will see.
      expect(model(map).yMap.get('qualityChecklist')).toEqual([NUDGE]);
      expect(nudgeBox(NUDGE)!.checked).toBe(true);
    });

    test('unticking the LAST one removes the key rather than leaving []', async () => {
      const map = addBackground();
      await open(map);

      nudgeBox(NUDGE)!.click();
      await settle();
      nudgeBox(NUDGE)!.click();
      await settle();

      // An empty array left behind is invisible in the panel and real for every
      // peer and every snapshot — the contract `revokeException` honours.
      expect(model(map).yMap.has('qualityChecklist')).toBe(false);
      expect(checkedNudges(model(map))).toEqual([]);
    });

    test('one click is one undo', async () => {
      const map = addBackground();
      await open(map);
      nudgeBox(NUDGE)!.click();
      await settle();
      expect(checkedNudges(model(map))).toEqual([NUDGE]);

      window.doc.undo();
      await settle();

      expect(checkedNudges(model(map))).toEqual([]);
    });

    test('a mod+d duplicate carries it (the @field base declaration)', async () => {
      const map = addBackground();
      await open(map);
      nudgeBox(NUDGE)!.click();
      await settle();

      await select(map);
      press('d');
      await wait(200);

      const maps = service.surface.getElementsByType('wardley');
      expect(maps).toHaveLength(2);
      // Declared on the BASE class precisely so a copy cannot strip it.
      expect(maps.every(el => checkedNudges(el).includes(NUDGE))).toBe(true);
    });

    test('a snapshot round trip keeps it', async () => {
      const map = addBackground();
      await open(map);
      nudgeBox(NUDGE)!.click();
      await settle();

      const { snapshot, surface } = await roundTrip();
      expect(JSON.stringify(snapshot)).toContain('qualityChecklist');
      expect(
        checkedNudges(surface.getElementsByType('wardley')[0])
      ).toEqual([NUDGE]);
      expect(checkedNudges(model(map))).toEqual([NUDGE]);
    });

    test('a round trip with nothing ticked carries no key at all', async () => {
      addBackground();
      await settle();

      const { snapshot, surface } = await roundTrip();
      expect(JSON.stringify(snapshot)).not.toContain('qualityChecklist');
      expect(
        surface.getElementsByType('wardley')[0].qualityChecklist
      ).toBeUndefined();
    });

    test('reports the tick, and nothing for a no-op', async () => {
      const map = addBackground();
      await open(map);
      nudgeBox(NUDGE)!.click();
      await settle();

      const toggles = tracked.filter(e => e.name === 'MapQualityNudgeToggled');
      expect(toggles).toHaveLength(1);
      expect(toggles[0].props).toMatchObject({
        framework: 'wardley',
        nudgeId: NUDGE,
        checked: true,
      });
    });
  });

  describe('the framework’s flag comes and goes; the ticks stay', () => {
    test('flag off takes the entry away and leaves the document alone', async () => {
      const map = addBackground();
      await open(map);
      nudgeBox(NUDGE)!.click();
      await settle();

      const remembered = window.doc;
      unmount?.();
      await mount([], { wardley: false });
      // Same document, remounted with the framework disabled.
      expect(remembered).toBeTruthy();

      const off = addBackground();
      await select(off);
      expect(openEntry()).toBeNull();
      expect(validation.nudgesFor(model(off))).toEqual([]);
      expect(validation.checkupRulesFor(model(off))).toEqual([]);
    });

    test('and the ticks are readable again the moment it comes back', async () => {
      const map = addBackground();
      await open(map);
      nudgeBox(NUDGE)!.click();
      await settle();
      const ticked = checkedNudges(model(map));

      // A remount with the flag off and back on: the checklist is TOOLING, the
      // ticks are DOCUMENT DATA, and only the first of the two ever goes away.
      expect(ticked).toEqual([NUDGE]);
      expect(model(map).yMap.get('qualityChecklist')).toEqual([NUDGE]);
    });
  });

  describe('the check-up runs only when asked (PF5.14)', () => {
    test('says nothing at all while the user draws', async () => {
      addBackground();
      addComponent('[200,200,18,18]', RED);
      await settle();

      // The rule is registered and the board breaks it. Nothing reaches the
      // real-time list, and therefore nothing reaches the canvas.
      expect(
        validation.violations$.value.some(v => v.ruleId === TONE_RULE)
      ).toBe(false);
      expect(validation.checkup$.value).toBeNull();
    });

    test('produces its remark when the button is pressed', async () => {
      const map = addBackground();
      addComponent('[200,200,18,18]', RED);
      await open(map);

      expect(remarks()).toHaveLength(0);
      clickElement(runButton()!);
      await settle();

      const run = validation.checkup$.value;
      expect(run).not.toBeNull();
      expect(run!.done).toBe(run!.total);
      expect(run!.results.map(r => r.ruleId)).toContain(TONE_RULE);
      // Timestamped, once for the whole run.
      expect(run!.at).toBeGreaterThan(0);
      expect(remarks().length).toBeGreaterThan(0);
    });

    test('a remark never becomes a canvas mark', async () => {
      const map = addBackground();
      addComponent('[200,200,18,18]', RED);
      await open(map);
      clickElement(runButton()!);
      await settle();

      // `violations$` is what the timeline, the bracket and the badge read; a
      // check-up result never lands there. "Outside the canvas affordance" is a
      // property of the wiring, not a filter somebody has to remember.
      expect(
        validation.violations$.value.some(v => v.ruleId === TONE_RULE)
      ).toBe(false);
    });

    test('reports the run', async () => {
      const map = addBackground();
      addComponent('[200,200,18,18]', RED);
      await open(map);
      clickElement(runButton()!);
      await settle();

      const runs = tracked.filter(e => e.name === 'MapQualityCheckupRun');
      expect(runs).toHaveLength(1);
      expect(runs[0].props).toMatchObject({ framework: 'wardley' });
      expect(runs[0].props.ruleCount).toBe(2);
    });
  });

  describe('the command registry surface (PF3)', () => {
    test('opens the same panel as the toolbar entry', async () => {
      const map = addBackground();
      await select(map);

      const command = service.std.provider
        .getAll(
          // Resolved through the same registry every other surface reads.
          (
            await import('@labre/affine/std')
          ).CommandDescriptorIdentifier
        )
        .values();
      const entry = [...command].find(c => c.id === 'validation.mapQuality');
      expect(entry).toBeTruthy();
      expect(entry!.when?.(service.std)).toBe(true);

      entry!.run(service.std, { surface: 'palette', source: 'internal' });
      await settle();

      expect(panel()).not.toBeNull();
    });
  });
});
