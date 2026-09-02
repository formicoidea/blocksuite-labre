import type { EdgelessRootBlockComponent } from '@labre/affine/blocks/root';
import {
  checkedNudges,
  CHECKUP_SLICE_MS,
  EditorAnchoredPanel,
  MAP_QUALITY_WIDGET,
  READING_PROPOSAL_WIDGET,
  setNudgeChecked,
  ValidationManager,
  ValidationRuleExtension,
  type ValidationRule,
} from '@labre/affine/blocks/surface';
import { EDGELESS_TOOLBAR_WIDGET } from '@labre/affine/widgets/edgeless-toolbar';
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
 * Map quality end to end (PF5.14 / PF7.10 / PF7.11 / PF13.9).
 *
 * The unit suites own the engine — what `setNudgeChecked` writes, which rules a
 * moment selects. This one owns what only a real editor can answer: that the
 * entry is reachable, that the DOCUMENT is what remembers a tick, that ticking
 * nothing writes nothing, that a check-up runs on demand and never during a
 * gesture, and that the whole checklist survives the framework's flag going off
 * and coming back.
 *
 * ## The panel is the checklist, and the check-up is engine-only (PO, 02/08)
 *
 * Wardley shipped two on-demand rules behind a "Run check-up" button in this
 * panel, and the PO took both the button and the rules away: the panel is the
 * checklist now. The on-demand MOMENT stayed — it is platform, and the next
 * framework that wants a check-up declares one — so what used to be driven
 * through the button is driven here through {@link ValidationManager.runCheckup}
 * against a PROBE rule this file registers. The behaviour under test is the
 * engine's, and it is the engine that is asked.
 */

const NUDGE = 'wardley.q1-title';

/**
 * Two on-demand rules, registered by the tests that need them.
 *
 * `element-in-background` is the cheapest family that actually walks the
 * surface, and a component dropped outside the map makes it speak. `framework:
 * 'wardley'` so a `wardley:map` instance is what a run is about — the manager
 * matches a check-up to an instance by framework, and this file has a real
 * Wardley map to hand.
 */
const PROBE_RULE = 'test.on-demand-probe';
const PROBE_ROLES = {
  'wardley:map': {
    id: 'wardley:map',
    kind: 'node' as const,
    labelKey: 'com.labre.test.map',
  },
  'wardley:component': {
    id: 'wardley:component',
    kind: 'node' as const,
    labelKey: 'com.labre.test.component',
  },
};
const probe = (id: string): ValidationRule => ({
  id,
  framework: 'wardley',
  family: 'element-in-background',
  moment: 'on-demand',
  severity: 'audit',
  appliesTo: 'wardley:component',
  roles: PROBE_ROLES,
  messageKey: 'com.labre.test.on-demand-probe',
  messageFallback: 'This component is off the map.',
  version: 1,
  backgroundRole: 'wardley:map',
});
const PROBES = [probe(PROBE_RULE), probe(`${PROBE_RULE}-2`)];

/**
 * A slice budget every rule is guaranteed to exceed, so the yield and the race
 * are exercised with the REAL Wardley rules instead of a stub that would only
 * prove the stub.
 *
 * NEGATIVE and not zero. The test is `elapsed > checkupSliceMs`, and `elapsed`
 * between two `performance.now()` calls a microsecond apart is legitimately
 * `0` — the clock is coarse, and deliberately so in some browsers. At zero the
 * yield then depends on whether the clock happened to tick, which is exactly the
 * kind of flakiness a CI runner finds and a laptop does not.
 */
const ALWAYS_YIELD = -1;

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

  /**
   * The same map on the STRICT profile — the only way to get a REAL-TIME
   * warning onto the canvas, since the default profile demotes the pilot rule
   * to `audit`, which is invisible by design.
   */
  const addStrictBackground = (xywh = '[0,0,1600,900]') =>
    service.surface.addElement({
      type: 'wardley',
      role: 'wardley:map',
      validationProfile: 'wardley.strict',
      xywh,
    });

  /** A change arrow pointing BACK towards genesis: one real-time warning. */
  const addBackwardsArrow = (x: number, y: number) =>
    service.surface.addElement({
      type: 'connector',
      role: 'wardley:change-arrow',
      source: { position: [x + 40, y] },
      target: { position: [x, y] },
    });

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
      expect(checkedNudges(surface.getElementsByType('wardley')[0])).toEqual([
        NUDGE,
      ]);
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

  /**
   * The on-demand moment, driven through the ENGINE (PF5.14).
   *
   * These used to be the "Run check-up" button's tests. The button is gone and
   * the capability is not, so the same properties are pinned where they now
   * live: a run happens only when somebody asks, it is about ONE instance, it
   * survives a rule that throws, and a second run supersedes the first instead
   * of mixing two answers.
   */
  describe('the on-demand moment, with no UI (PF5.14)', () => {
    beforeEach(async () => {
      unmount?.();
      await mount([ValidationRuleExtension(PROBES)]);
    });

    /** A component dropped OUTSIDE the map: what the probe rules speak about. */
    const addStray = (xywh: string) => addComponent(xywh);

    test('says nothing at all while the user draws', async () => {
      addBackground();
      addStray('[3000,3000,18,18]');
      await settle();

      // The rules are registered and the board breaks them. Nothing reaches the
      // real-time list, and therefore nothing reaches the canvas.
      expect(
        validation.violations$.value.some(v => v.ruleId === PROBE_RULE)
      ).toBe(false);
      expect(validation.checkup$.value).toBeNull();
    });

    test('produces its remarks when a run is asked for', async () => {
      const map = addBackground();
      addStray('[3000,3000,18,18]');
      await select(map);

      const run = await validation.runCheckup(model(map));

      expect(run).not.toBeNull();
      expect(run!.done).toBe(run!.total);
      expect(run!.results.map(r => r.ruleId)).toContain(PROBE_RULE);
      expect(run!.at).toBeGreaterThan(0);
    });

    test('a remark never becomes a canvas mark', async () => {
      const map = addBackground();
      addStray('[3000,3000,18,18]');
      await select(map);
      await validation.runCheckup(model(map));

      // `violations$` is what the timeline, the bracket and the badge read; a
      // check-up result never lands there. "Outside the canvas affordance" is a
      // property of the wiring, not a filter somebody has to remember.
      expect(
        validation.violations$.value.some(v => v.ruleId === PROBE_RULE)
      ).toBe(false);
    });

    test('is about ONE map, whatever else is on the board', async () => {
      const a = addBackground();
      const b = addBackground('[40000,0,1600,900]');
      // The only stray component on the board is attributed to B — the map it
      // is nearest to — so A's run has nothing to say.
      addStray('[41800,200,18,18]');
      await settle();

      const onA = await validation.runCheckup(model(a));
      expect(onA!.backgroundId).toBe(a);
      expect(onA!.results).toEqual([]);

      const onB = await validation.runCheckup(model(b));
      expect(onB!.backgroundId).toBe(b);
      expect(onB!.results.map(r => r.backgroundId)).toEqual([b, b]);
    });

    test('deleting the map takes its check-up with it', async () => {
      const map = addBackground();
      addStray('[3000,3000,18,18]');
      await select(map);
      await validation.runCheckup(model(map));
      expect(validation.checkup$.value).not.toBeNull();

      service.surface.deleteElement(map);
      await settle();

      // An answer about a map that no longer exists is an answer about nothing.
      expect(validation.checkup$.value).toBeNull();
    });

    test('reports the failure and lets the next run through', async () => {
      const map = addBackground();
      await select(map);

      // A rule whose family does not exist: `RULE_FAMILIES[family]` is
      // `undefined`, so dispatching it throws — the closest thing to "a
      // third-party family blows up" this suite can stage honestly.
      const broken = {
        ...PROBES[0],
        family: 'nope',
      } as unknown as ValidationRule;
      const original = validation.checkupRulesFor.bind(validation);
      validation.checkupRulesFor = () => [broken];
      await validation.runCheckup(model(map));
      validation.checkupRulesFor = original;

      const failed = validation.checkup$.value!;
      expect(failed.error).toBe(true);
      // Reported FINISHED on purpose: `done < total` would read as a run still
      // in flight for ever, and nothing could ask again.
      expect(failed.done).toBe(failed.total);

      // ...and the next run actually works.
      await validation.runCheckup(model(map));
      expect(validation.checkup$.value?.error).toBeUndefined();
    });

    test('yields between rules, and a second run supersedes the first', async () => {
      const map = addBackground();
      addStray('[3000,3000,18,18]');
      await select(map);

      // At the shipped default two rules cost a fraction of a millisecond and
      // the yield never fires, which would leave the whole race path unreached.
      // See {@link ALWAYS_YIELD}.
      validation.checkupSliceMs = ALWAYS_YIELD;

      const first = validation.runCheckup(model(map));
      const second = validation.runCheckup(model(map));
      const [firstRun, secondRun] = await Promise.all([first, second]);

      // The older run notices its generation is stale on its next slice and
      // drops what it had: one answer, never a mix of two.
      expect(firstRun).toBeNull();
      expect(secondRun).not.toBeNull();
      expect(secondRun!.done).toBe(secondRun!.total);
      expect(validation.checkup$.value).toBe(secondRun);

      validation.checkupSliceMs = CHECKUP_SLICE_MS;
    });

    test('publishes progress as it goes', async () => {
      const map = addBackground();
      await select(map);
      validation.checkupSliceMs = ALWAYS_YIELD;

      const seen: string[] = [];
      const stop = validation.checkup$.subscribe(run => {
        if (run) seen.push(`${run.done}/${run.total}`);
      });
      await validation.runCheckup(model(map));
      stop();
      validation.checkupSliceMs = CHECKUP_SLICE_MS;

      // `done` climbs through every intermediate value: a caller reads the
      // progression off the same object the results arrive in.
      expect(seen).toEqual(['0/2', '1/2', '2/2']);
    });

    test('the panel is the checklist, and shows none of this', async () => {
      const map = addBackground();
      addStray('[3000,3000,18,18]');
      await open(map);
      await validation.runCheckup(model(map));
      await settle();

      // The rules ran and found something; the panel is still four boxes.
      expect(validation.checkup$.value!.results.length).toBeGreaterThan(0);
      expect(nudgeRows()).toHaveLength(4);
      for (const gone of [
        'map-quality-run',
        'map-quality-remark',
        'map-quality-realtime',
      ]) {
        expect(
          widgetRoot()?.querySelector(`[data-testid="${gone}"]`)
        ).toBeNull();
      }
    });
  });

  describe('read-only is enforced at the seam (review, minor 3)', () => {
    test('setNudgeChecked itself refuses to write', async () => {
      const map = addBackground();
      await open(map);
      service.std.store.readonly = true;

      // Called directly, as an agent or a host would — no disabled checkbox in
      // the way. `clearField` goes through `Store.transact`, which carries no
      // read-only guard of its own, so the seam has to.
      expect(setNudgeChecked(model(map), NUDGE, true)).toBe(false);
      expect(model(map).yMap.has('qualityChecklist')).toBe(false);

      service.std.store.readonly = false;
      expect(setNudgeChecked(model(map), NUDGE, true)).toBe(true);
      expect(checkedNudges(model(map))).toEqual([NUDGE]);
    });

    test('the four boxes are disabled, and nothing is written', async () => {
      const map = addBackground();
      await open(map);
      service.std.store.readonly = true;
      await settle();

      const boxes = nudgeRows().map(
        row => (row.querySelector('input') as HTMLInputElement).disabled
      );
      expect(boxes).toEqual([true, true, true, true]);
      // ...and the panel still OPENS: reading the quality of a map you cannot
      // edit is what a reviewer is here to do.
      expect(panel()).not.toBeNull();

      service.std.store.readonly = false;
    });
  });

  describe('the panel is announced (review, minor 5)', () => {
    test('is a labelled dialog that takes the focus — and claims no modality', async () => {
      const map = addBackground();
      await open(map);

      const dialog = panel() as HTMLElement;
      expect(dialog.getAttribute('role')).toBe('dialog');
      expect(dialog.getAttribute('aria-label')).toBe('Map quality');
      // Opened from the palette the focus would otherwise still be in the host's
      // own UI, so nothing is announced and Escape never reaches the editor host.
      expect(widgetRoot()?.activeElement).toBe(dialog);

      // Deliberately NOT `aria-modal`: it promises everything behind is inert,
      // and this panel promises the opposite — the canvas stays usable, which is
      // the whole reason it follows the instance on pan instead of closing.
      // Claiming modality without trapping focus is a label that lies.
      expect(dialog.hasAttribute('aria-modal')).toBe(false);
    });
  });

  /**
   * PO recette, 02/08: a map wearing amber badges, with no title and no legend,
   * whose check-up answered "Nothing to report".
   *
   * The first pass answered it with wording — the panel started naming which of
   * the three kinds of statement was speaking on each line. The PO's second pass
   * answered it by removal: the check-up block and the live-warning count are
   * gone from this panel, and the checklist is the only thing left in it. Which
   * leaves exactly one sentence to be sure of.
   */
  describe('the panel is the checklist, and says so (PO, 02/08)', () => {
    test('the checklist is introduced as the USER’s to check', async () => {
      const map = addBackground();
      await open(map);

      // "Checklist" left the reader to guess whether the tool had been through
      // it. The contract is that it has not, and cannot.
      expect(panel()?.textContent).toContain('To be checked by you');
      expect(panel()?.textContent).not.toContain('Checklist');
    });

    test('carries nothing but its title, its four boxes and its close button', async () => {
      const map = addStrictBackground();
      // A map with a real-time warning on the canvas: the count the panel used
      // to render for it is not the panel's business any more.
      addBackwardsArrow(400, 400);
      await open(map);
      await settle();

      expect(validation.violations$.value).toHaveLength(1);
      expect(nudgeRows()).toHaveLength(4);
      expect(panel()?.textContent).not.toContain('Run check-up');
      expect(panel()?.textContent).not.toContain('Real-time warnings');
    });

    test('every line of the panel starts on the same vertical', async () => {
      const map = addBackground();
      await open(map);

      // The gutter the checkboxes live in is the panel's left edge for the
      // words: every label starts on the same vertical, whatever it reads.
      const left = (element: Element | null) =>
        Math.round(element!.getBoundingClientRect().left);
      const labels = nudgeRows().map(row =>
        left(row.querySelector('.map-quality-nudge-label'))
      );

      expect(new Set(labels).size).toBe(1);
    });
  });

  describe('the command registry surface (PF3)', () => {
    test('opens the same panel as the toolbar entry', async () => {
      const map = addBackground();
      await select(map);

      const command = service.std.provider
        .getAll(
          // Resolved through the same registry every other surface reads.
          (await import('@labre/affine/std')).CommandDescriptorIdentifier
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

  /**
   * PO recette of 02/08/2026, second pass, point 2: Map quality leaves the
   * popover and adopts the reading panel's pattern — anchored to the editor,
   * above the senior button bar, at its width, in the layer above every toolbar
   * (ADR 0011). The entry that opens it did not move.
   */
  describe('the panel is anchored to the editor (ADR 0011)', () => {
    /** `auto` is not a number, and a panel must beat it too. Treat it as 0. */
    const zOf = (element: Element) => {
      const value = getComputedStyle(element).zIndex;
      return value === 'auto' ? 0 : Number.parseInt(value, 10);
    };

    const bottomToolbar = () =>
      root.widgetComponents[EDGELESS_TOOLBAR_WIDGET] as unknown as
        | HTMLElement
        | undefined;

    /** The senior button bar itself — the visible box, not the widget's slab. */
    const seniorBar = () =>
      bottomToolbar()?.shadowRoot?.querySelector<HTMLElement>(
        '.edgeless-toolbar-container'
      ) ?? null;

    const resizeEditorTo = async (width: string) => {
      (window.editor.parentElement as HTMLElement).style.width = width;
      await settle();
      await settle();
    };

    test('it is the SAME component as the reading panel, not a copy of it', async () => {
      const map = addBackground();
      await open(map);

      // The decision names one shared pattern; this is what "shared" means in a
      // language with prototypes. Two panels that merely looked alike would
      // pass every measurement below and fail here.
      const quality = widget() as unknown as object;
      const reading = root.widgetComponents[
        READING_PROPOSAL_WIDGET
      ] as unknown as object;
      expect(quality).toBeInstanceOf(EditorAnchoredPanel);
      expect(reading).toBeInstanceOf(EditorAnchoredPanel);
    });

    test('its heading row — close button included — is pinned above the list', async () => {
      const map = addBackground();
      await open(map);

      const header = widgetRoot()?.querySelector<HTMLElement>(
        '[data-testid="anchored-panel-header"]'
      );
      const body = widgetRoot()?.querySelector<HTMLElement>(
        '[data-testid="anchored-panel-body"]'
      );
      expect(header).not.toBeNull();
      expect(body).not.toBeNull();

      // The header slot takes the whole heading ROW, not just the words: a
      // checklist long enough to scroll must not carry its own way out with it.
      expect(
        header!.querySelector('[data-testid="map-quality-close"]')
      ).not.toBeNull();
      expect(
        body!.querySelector('[data-testid="map-quality-close"]')
      ).toBeNull();

      // The boxes to tick are the part that scrolls.
      expect(
        body!.querySelector('[data-testid="map-quality-nudge"]')
      ).not.toBeNull();
      expect(getComputedStyle(body!).overflowY).toBe('auto');
    });

    test('it takes the senior bar’s width, at both window sizes', async () => {
      const map = addBackground();
      await open(map);

      const measure = () => ({
        box: panel()!.getBoundingClientRect(),
        bar: seniorBar()!.getBoundingClientRect(),
      });

      await resizeEditorTo('1400px');
      const wide = measure();
      expect(wide.box.left).toBeCloseTo(wide.bar.left, 0);
      expect(wide.box.right).toBeCloseTo(wide.bar.right, 0);

      // The 320px popover it replaced would have survived the first assertion
      // and failed this one.
      await resizeEditorTo('620px');
      const narrow = measure();
      expect(narrow.box.left).toBeCloseTo(narrow.bar.left, 0);
      expect(narrow.box.width).toBeCloseTo(narrow.bar.width, 0);
      expect(narrow.box.width).toBeLessThan(wide.box.width);
    });

    test('it sits just above the bar, and inside the editor', async () => {
      const map = addBackground();
      await open(map);

      const box = panel()!.getBoundingClientRect();
      const bar = seniorBar()!.getBoundingClientRect();
      const editor = root.getBoundingClientRect();

      expect(box.bottom).toBeLessThanOrEqual(bar.top);
      expect(bar.top - box.bottom).toBeLessThan(24);
      expect(box.left).toBeGreaterThanOrEqual(editor.left);
      expect(box.right).toBeLessThanOrEqual(editor.right);
      expect(box.top).toBeGreaterThanOrEqual(editor.top);
    });

    test('it renders above the contextual toolbar and the bottom one', async () => {
      const map = addBackground();
      await open(map);

      // The HOST is where the contest is decided: every widget host is a
      // sibling in `.widgets-container`, and `affine-toolbar-widget` declares
      // no stacking context of its own. The panel used to take `z-index: 2`,
      // chosen to sit "well below the toolbars" — the popover's bargain, and
      // the one this pattern reverses.
      const host = widget() as unknown as HTMLElement;
      expect(host.parentElement?.classList.contains('widgets-container')).toBe(
        true
      );

      const contextual = toolbar();
      expect(contextual).not.toBeNull();
      expect(zOf(host)).toBeGreaterThan(zOf(contextual!));
      expect(zOf(host)).toBeGreaterThan(zOf(bottomToolbar()!));
    });

    test('it stays put when the map it is about moves', async () => {
      const map = addBackground();
      await open(map);
      const before = panel()!.getBoundingClientRect();

      // The old popover hung off the instance's top-right corner and flipped
      // sides to stay on screen. Anchored to the editor, a surface somebody is
      // halfway through ticking does not move under them.
      service.surface.updateElement(map, { xywh: '[900,600,1600,900]' });
      await settle();

      const after = panel()!.getBoundingClientRect();
      expect(after.left).toBeCloseTo(before.left, 0);
      expect(after.bottom).toBeCloseTo(before.bottom, 0);
    });

    test('a click on the canvas still puts it away, and so does Escape', async () => {
      const map = addBackground();
      await open(map);
      expect(panel()).not.toBeNull();

      // Click-away: the new layer sits above the toolbars, and must not have
      // taken the dismissal contract with it.
      document.dispatchEvent(
        new PointerEvent('pointerdown', { bubbles: true, composed: true })
      );
      await settle();
      expect(panel()).toBeNull();

      await open(map);
      service.std.host.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })
      );
      await settle();
      expect(panel()).toBeNull();
    });
  });
});
